import fs from 'node:fs';
import path from 'node:path';
import type { Dispatcher } from 'undici';
import { DefaultRangePolicy, download } from '@xmcl/file-transfer';
import { reportMirrorFailure, reportMirrorSuccess } from '../mirrors/scoring';
import { DEFAULT_RANGE_CONCURRENCY, DEFAULT_RANGE_THRESHOLD, HTML_PROBE_BYTES, PROGRESS_STALL_TIMEOUT } from '@shared/constants';
import { getDispatcher } from './dispatcherFactory';
import { ETagCache } from './etagCache';
import { tryConditionalHead, updateEtagCacheFromResponse } from './etagHttp';
import { probeHtmlChallenge, readFileSnippet, isHtmlChallenge } from './htmlChallengeDetector';
import { normalizeHeaders, shouldValidateZip } from './headers';
import { monitorDownloadProgress } from './progressMonitor';
import { validateZipIntegrity } from './zipValidator';
import { validateDownloadChecksum, hasValidDownloadChecksum, type DownloadChecksum } from './checksum';

type DownloadSingleOptions = {
  checksum?: DownloadChecksum;
  expectedTotal?: number;
  headers?: Record<string, string>;
  maxRedirections?: number;
  retryCount?: number;
  maxSockets?: number;
  rangeThresholdBytes?: number;
  rangeConcurrency?: number;
  validateZip?: boolean;
  dispatcher?: Dispatcher;
};

export class DownloadManager {
  /**
   * Download a single file from URL to destination.
   * @param url Source URL or URL candidates
   * @param dest Destination absolute path
   */
  public static async downloadSingle(url: string | string[], dest: string, options: DownloadSingleOptions = {}): Promise<void> {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const candidates = Array.isArray(url) ? url : [url];
    const rangePolicy = new DefaultRangePolicy(
      options.rangeThresholdBytes ?? DEFAULT_RANGE_THRESHOLD,
      options.rangeConcurrency ?? DEFAULT_RANGE_CONCURRENCY
    );
    const dispatcher = options.dispatcher ?? getDispatcher(options.maxSockets, options.retryCount, options.maxRedirections);
    const headers = normalizeHeaders(options.headers);
    const shouldProbe = !options.checksum && !shouldValidateZip(dest, options.validateZip);
    const pendingFile = `${dest}.pending`;

    // Remove old .pending files before starting download to avoid using corrupted files
    try {
      if (fs.existsSync(pendingFile)) {
        fs.unlinkSync(pendingFile);
      }
    } catch {
      // Ignore deletion errors
    }

    const errors: Error[] = [];
    for (const candidate of candidates) {
      const startedAt = Date.now();
      try {
        const cacheEntry = ETagCache.get(candidate);
        // Custom dispatchers may enforce DNS/security policy; do not bypass them with global fetch.
        if (!options.dispatcher && fs.existsSync(dest)) {
          const validCachedFile = await hasValidDownloadChecksum(dest, options.checksum);
          const { skip } = validCachedFile ? await tryConditionalHead(candidate, cacheEntry) : { skip: false };
          if (skip) {
            reportMirrorSuccess(candidate, Date.now() - startedAt);
            return;
          }
        }

        if (shouldProbe) {
          const probe = await probeHtmlChallenge(candidate, headers, dispatcher);
          if (probe.blocked) {
            throw new Error(`Mirror returned HTML challenge (${probe.status ?? 'unknown'})`);
          }
        }

        // Monitor download progress and abort if progress stalls
        const progressAbortController = new AbortController();
        const stopMonitoring = monitorDownloadProgress(pendingFile, progressAbortController);

        try {
          const downloadPromise = download({
            url: candidate,
            destination: pendingFile,
            signal: progressAbortController.signal,
            headers,
            expectedTotal: options.expectedTotal,
            dispatcher,
            rangePolicy,
          });

          await downloadPromise;
        } catch (downloadErr) {
          stopMonitoring();
          // If download was aborted due to no progress, try next source
          const errorMessage = downloadErr instanceof Error ? downloadErr.message : String(downloadErr);
          if (errorMessage.includes('stalled')) {
            // Ensure pending file is removed
            try {
              if (fs.existsSync(pendingFile)) {
                fs.unlinkSync(pendingFile);
              }
            } catch {
              // Ignore deletion errors
            }
            throw downloadErr;
          }
          if (progressAbortController.signal.aborted) {
            throw new Error(`Download stalled - no progress for ${PROGRESS_STALL_TIMEOUT / 1000}s`, { cause: downloadErr });
          }
          throw downloadErr;
        } finally {
          stopMonitoring();
        }

        if (shouldProbe) {
          const snippet = readFileSnippet(pendingFile, HTML_PROBE_BYTES);
          if (isHtmlChallenge(snippet, null)) {
            throw new Error('Downloaded HTML challenge instead of file');
          }
        }

        // Check file size before validation - truncated downloads are a common issue
        const stats = fs.statSync(pendingFile);
        if (stats.size === 0) {
          throw new Error('Downloaded file is empty (0 bytes)');
        }
        
        if (options.checksum) await validateDownloadChecksum(pendingFile, options.checksum);

        if (options.expectedTotal && stats.size !== options.expectedTotal) {
          throw new Error(`File size mismatch: expected ${options.expectedTotal} bytes, got ${stats.size} bytes`);
        }

        if (shouldValidateZip(dest, options.validateZip)) {
          await validateZipIntegrity(pendingFile);
        }

        fs.renameSync(pendingFile, dest);
        reportMirrorSuccess(candidate, Date.now() - startedAt);
        try {
          if (!options.dispatcher) {
            const res = await fetch(candidate, { method: 'HEAD' });
            if (res.ok) updateEtagCacheFromResponse(candidate, res);
          }
        } catch {
          // Ignore cache update errors
        }
        return;
      } catch (err) {
        reportMirrorFailure(candidate);
        const e = err instanceof Error ? err : new Error(String(err));
        // Preserve URL context for callers (and for RuntimeDownloadService.recordBadHosts).
        (e as Error & { url?: string }).url = candidate;
        
        errors.push(e);
        try {
          // Failed candidates only own the pending file; preserve any existing final file.
          if (fs.existsSync(pendingFile)) {
            fs.unlinkSync(pendingFile);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    }
    if (errors.length > 1) {
      const combined = new Error('All download candidates failed');
      (combined as Error & { errors?: Error[] }).errors = errors;
      throw combined;
    }
    throw errors[0];
  }
}
