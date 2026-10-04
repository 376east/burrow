"""Repack pinned XMCL 6.3.1 with packaging, integrity and cancellation repairs."""
from pathlib import Path
import gzip
import hashlib
import io
import json
import tarfile
import urllib.request

SOURCE = 'https://registry.npmjs.org/@xmcl/installer/-/installer-6.3.1.tgz'
SHA256 = '91aa24de7c0a12adf81bf177e95213099b8adc5ee9ef3b5d76b2d665565bddd4'
def replace_once(source, old, new):
    assert source.count(old) == 1, f'expected one match: {old[:100]}'
    return source.replace(old, new, 1)


def patch_runtime(source):
    # Identical semantic patches in the published CJS and ESM bundles.
    helper = """
async function assertDownloadedSha1(file, expectedChecksum, options, role) {
  const signal = options.signal ?? options.abortSignal;
  signal?.throwIfAborted();
  if (!expectedChecksum) return;
  const issue = await diagnoseFile({ file, expectedChecksum, role, hint: "Downloaded file failed SHA1 validation" }, { signal, checksum: options.checksum });
  signal?.throwIfAborted();
  if (issue) {
    const { rm } = await import("node:fs/promises");
    await rm(file, { force: true });
    const error = new Error(`${role} SHA1 mismatch: expected ${expectedChecksum}, received ${issue.receivedChecksum ?? issue.type}`);
    error.code = issue.type === "corrupted" ? "XMCL_SHA1_MISMATCH" : "XMCL_MISSING_DOWNLOAD";
    throw error;
  }
}

async function discardAbortedDownload(file, options) {
  const signal = options.signal ?? options.abortSignal;
  if (!signal?.aborted) return;
  const { rm } = await import("node:fs/promises");
  await rm(file, { force: true });
  throw signal.reason;
}

async function verifyDownloadedWithFallback(file, expectedChecksum, options, role, candidates, progress, index) {
  try {
    await assertDownloadedSha1(file, expectedChecksum, options, role);
    return;
  } catch (initialError) {
    await discardAbortedDownload(file, options);
    if (initialError.code !== "XMCL_SHA1_MISMATCH") throw initialError;
    const urls = [...new Set(candidates)];
    const usedUrl = progress.trackers[index]?.url;
    const usedIndex = urls.indexOf(usedUrl);
    let remaining = usedIndex < 0 ? urls : [...urls.slice(usedIndex + 1), ...urls.slice(0, usedIndex)];
    const { download, getDownloadBaseOptions } = await import("@xmcl/file-transfer");
    let lastError = initialError;
    const retryTracker = progress.trackers[index];
    for (let attempt = 0; remaining.length && attempt < urls.length; attempt++) {
      const signal = options.signal ?? options.abortSignal;
      signal?.throwIfAborted();
      await download({ url: remaining, destination: file, ...getDownloadBaseOptions(options), signal, tracker: retryTracker }).catch(async (error) => {
        await discardAbortedDownload(file, options);
        throw error;
      });
      const completedIndex = remaining.indexOf(retryTracker?.url);
      remaining = remaining.slice(completedIndex < 0 ? 1 : completedIndex + 1);
      try {
        await assertDownloadedSha1(file, expectedChecksum, options, role);
        return;
      } catch (error) {
        await discardAbortedDownload(file, options);
        if (error.code !== "XMCL_SHA1_MISMATCH") throw error;
        lastError = error;
      }
    }
    throw lastError;
  }
}
"""
    source = replace_once(source, 'var DEFAULT_RESOURCE_ROOT_URL =', helper + '\nvar DEFAULT_RESOURCE_ROOT_URL =')

    def section(start, end, transform):
        nonlocal source
        first = source.index(start)
        last = source.index(end, first)
        source = source[:first] + transform(source[first:last]) + source[last:]

    def assets(block):
        # diagnoseFile resolves an Issue; it does not reject for missing files.
        block = replace_once(block, '    await diagnoseFile(', '    const logIssue = await diagnoseFile(')
        block = replace_once(block, '    ).catch(async (e) => {\n      if (options.diagnose) {\n        throw e;\n      }', '    );\n    if (logIssue) {\n      if (options.diagnose) throw new Error(`Log configuration is ${logIssue.type}`);')
        block = replace_once(block, '    }).catch(() => {\n    });', '      await assertDownloadedSha1(folder.getLogConfig(file.id), file.sha1, options, "log config");\n    }')
        # Keep downloaded JSON bytes intact: reserialization changes its SHA1.
        import re
        match = re.search(r'        const json = await response.json\(\);\n        await (.+?)\(jsonPath, JSON.stringify\(json\)\);\n        return json;', block)
        assert match
        block = block.replace(match.group(0), f'        const bytes = Buffer.from(await response.arrayBuffer());\n        await {match.group(1)}(jsonPath, bytes);\n        await assertDownloadedSha1(jsonPath, assetIndexInfo.sha1, options, "asset index");\n        return JSON.parse(bytes.toString("utf-8"));')
        block = replace_once(block, '      } catch {\n      }', '      } catch {\n        options.abortSignal?.throwIfAborted();\n      }')
        match = re.search(r'  const readJson = async \(\) => (.+?)\(jsonPath, "utf-8"\).then\(\(b\) => JSON.parse\(b\)\);', block)
        assert match
        block = block.replace(match.group(0), f'  const readJson = async () => {{\n    await assertDownloadedSha1(jsonPath, assetIndexInfo.sha1, options, "asset index");\n    return {match.group(1)}(jsonPath, "utf-8").then((b) => JSON.parse(b));\n  }};')
        block = replace_once(block, '  const assetIndex = await readJson().catch(async (e) => {', '  const assetIndex = await readJson().catch(async (e) => {\n    options.abortSignal?.throwIfAborted();')
        return block
    section('async function installAssets(', 'async function diagnoseAssets(', assets)

    def resolved_assets(block):
        import re
        block, count = re.subn(r'    const results = await (.+?)\(\{', r'    const transferProgress = onDownloadMultiple(options.tracker, "assets.assets", { count: assets2.length });\n    const results = await \1({', block)
        assert count == 1
        block = replace_once(block, 'tracker: onDownloadMultiple(options.tracker, "assets.assets", { count: assets2.length })', 'tracker: transferProgress')
        block = replace_once(block, '      signal: options.abortSignal,', '      onFileComplete: (index) => verifyDownloadedWithFallback(folder.getAsset(assets2[index].hash), assets2[index].hash, options, "asset", assetsHosts.map((host) => `${host}/${assets2[index].hash.substring(0, 2)}/${assets2[index].hash}`), transferProgress, index),\n      signal: options.abortSignal,')
        block = replace_once(block, '    const unfixedIssues = results.filter((r) => r.status === "rejected").map((r, index) => {\n      return { reason: r.reason, asset: assets2[index] };\n    });', '    options.abortSignal?.throwIfAborted();\n    const unfixedIssues = results.flatMap((r, index) => r.status === "rejected" ? [{ reason: r.reason, asset: assets2[index] }] : []);')
        return block
    section('async function installResolvedAssets(', '// fabric.ts', resolved_assets)

    def libraries(block):
        import re
        block, count = re.subn(r'    const results = await (.+?)\(\{', r'    const transferProgress = onDownloadMultiple(option.tracker, "libraries", { count: libraries.length });\n    const results = await \1({', block)
        assert count == 1
        block = replace_once(block, 'tracker: onDownloadMultiple(option.tracker, "libraries", { count: libraries.length })', 'tracker: transferProgress')
        return replace_once(block, '      signal: option.signal,', '      onFileComplete: (index) => verifyDownloadedWithFallback(folder.getLibraryByPath(libs[index].download.path), libs[index].download.sha1, option, "library", resolveLibraryDownloadUrls(libs[index], option), transferProgress, index),\n      signal: option.signal,')
    section('async function installResolvedLibraries(', 'var DEFAULT_MAVENS', libraries)

    def forge(block):
        return replace_once(block, '  return installJarPath;', '  await assertDownloadedSha1(installJarPath, library.download.sha1, options, "forge installer");\n  return installJarPath;')
    section('async function downloadForgeJar(', 'async function installForge(', forge)

    def java_files(block):
        block = replace_once(block, '  const filesToDownload = diagnoseResults.filter((r) => r.needsDownload).map((r) => ({', '  const pendingFiles = diagnoseResults.filter((r) => r.needsDownload);\n  const filesToDownload = pendingFiles.map((r) => ({')
        import re
        block, count = re.subn(r'    await (.+?)\(\{\n      options: filesToDownload,', r'    const results = await \1({\n      options: filesToDownload,\n      signal: options.signal,\n      onFileComplete: (index) => assertDownloadedSha1(pendingFiles[index].dest, pendingFiles[index].hash, options, "java runtime"),', block)
        assert count == 1
        block = replace_once(block, '    });\n  }\n  if (unpackLzma)', '    });\n    options.signal?.throwIfAborted();\n    const failures = results.flatMap((result) => result.status === "rejected" ? [result.reason] : []);\n    if (failures.length) throw new AggregateError(failures, "Java runtime downloads failed");\n  }\n  if (unpackLzma)')
        block = replace_once(block, 'diagnoseResults.filter((r) => r.needsUnpack && r.needsDownload).map((r) => unpackLzma(r.dest, r.rawDest))', 'diagnoseResults.filter((r) => r.needsUnpack).map(async (r) => {\n        options.signal?.throwIfAborted();\n        await unpackLzma(r.dest, r.rawDest);\n        await assertDownloadedSha1(r.rawDest, manifest.files[r.file].downloads.raw.sha1, options, "java runtime unpacked");\n      })')
        block = replace_once(block, '  await Promise.all(\n    Object.entries(manifest.files)', '  options.signal?.throwIfAborted();\n  await Promise.all(\n    Object.entries(manifest.files)')
        return block
    section('async function downloadFiles(', 'async function installJavaRuntime(', java_files)

    def java_manifest(block):
        block = replace_once(block, '      destination: jsonPath,', '      destination: jsonPath,\n      signal: options.signal,')
        return replace_once(block, '  const manifest = await readManifest();', '  await assertDownloadedSha1(jsonPath, target.manifest.sha1, options, "java runtime manifest");\n  const manifest = await readManifest();')
    section('async function installJavaRuntimeWithJson(', '// labymod.ts', java_manifest)
    return source


data = urllib.request.urlopen(SOURCE, timeout=60).read()
assert hashlib.sha256(data).hexdigest() == SHA256, 'upstream archive changed'
destination = Path(__file__).with_name('xmcl-installer-6.3.1-fixed.tgz')
preimage = destination.read_bytes() if destination.exists() else None
temporary = destination.with_suffix('.tgz.part')
with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as source:
    with temporary.open('wb') as output, gzip.GzipFile(fileobj=output, mode='wb', filename='', mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w') as target:
            for entry in source.getmembers():
                content = source.extractfile(entry).read() if entry.isfile() else None
                if entry.name == 'package/package.json':
                    manifest = json.loads(content)
                    manifest.update(main='./dist/index.js', module='./dist/index.mjs', types='./dist/index.d.ts')
                    manifest.pop('browser', None)
                    manifest['dependencies'].update({
                        '@xmcl/asm': '1.0.1', '@xmcl/core': '2.16.2',
                        '@xmcl/file-transfer': '2.1.4', '@xmcl/forge-site-parser': '2.0.9',
                        '@xmcl/unzip': '2.1.2', '@xmcl/yauzl': '2.10.0',
                    })
                    content = (json.dumps(manifest, indent=2) + '\n').encode()
                elif entry.name == 'package/dist/index.js':
                    assert content.count(b'require("@xmcl/core/utils")') == 2
                    content = content.replace(b'require("@xmcl/core/utils")', b'({ isNotNull: (v) => v !== void 0 })')
                elif entry.name == 'package/dist/index.mjs':
                    content = b'import { createRequire as xmclCreateRequire } from \"node:module\"; const require = xmclCreateRequire(import.meta.url);\n' + content
                    content = content.replace(b'import { isNotNull } from "@xmcl/core/utils";', b'const isNotNull = (v) => v !== void 0;')
                    content = content.replace(b'import { isNotNull as isNotNull2 } from "@xmcl/core/utils";', b'const isNotNull2 = (v) => v !== void 0;')
                    content = content.replace(b'import { ClassReader, ClassVisitor, Opcodes } from "@xmcl/asm";', b'import asm from "@xmcl/asm"; const { ClassReader, ClassVisitor, Opcodes } = asm;')
                if entry.name in ('package/dist/index.js', 'package/dist/index.mjs'):
                    content = patch_runtime(content.decode()).encode()
                if content is not None:
                    entry.size = len(content)
                target.addfile(entry, io.BytesIO(content) if content is not None else None)
assert (destination.read_bytes() if destination.exists() else None) == preimage, 'concurrent archive edit'
temporary.replace(destination)
print(hashlib.sha256(destination.read_bytes()).hexdigest())
