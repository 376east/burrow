import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { ZipFile } from 'yazl';
import { afterEach, expect, it } from 'vitest';
import { parseModJar } from '../scanner';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

it('reads Forge TOML metadata and dependencies through the production scanner', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-forge-metadata-'));
  roots.push(root);
  const filePath = path.join(root, 'fixture.jar');
  const zip = new ZipFile();
  zip.addBuffer(Buffer.from([
    'modLoader = "javafml"', 'loaderVersion = "[47,)"', 'license = "MIT"',
    '[[mods]]', 'modId = "sample"', 'version = "1.2.3"', 'displayName = "Sample mod"',
    '[[dependencies.sample]]', 'modId = "minecraft"', 'mandatory = true',
    'versionRange = "[1.20.1,1.21)"', 'ordering = "NONE"', 'side = "BOTH"',
  ].join('\n')), 'META-INF/mods.toml');
  const written = pipeline(zip.outputStream, fs.createWriteStream(filePath));
  zip.end();
  await written;
  const mods = await parseModJar(filePath);
  expect(mods).toHaveLength(1);
  expect(mods[0]).toMatchObject({
    id: 'sample', name: 'Sample mod', version: '1.2.3', loaders: ['forge'],
    deps: [{ id: 'minecraft', versionRange: '[1.20.1,1.21)', optional: false, kind: 'depends' }],
    file: { name: 'fixture.jar' }, hash: { sha1: expect.stringMatching(/^[0-9a-f]{40}$/) },
  });
});
