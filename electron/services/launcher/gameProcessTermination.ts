import type { ChildProcess } from 'child_process';
import kill from 'tree-kill';

export async function killProcess(proc: ChildProcess): Promise<void> {
    const pid = proc.pid;
    if (!pid) return;
    await new Promise<void>((resolve, reject) => {
      kill(pid, 'SIGKILL', (err) => {
        if (err) {
          try { proc.kill('SIGKILL'); }
          catch { reject(err); return; }
        }
        resolve();
      });
    });
  }

export async function waitForClose(closed: Promise<void> | null): Promise<void> {
    if (!closed) throw new Error('Minecraft process did not report a close listener');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        closed,
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Timed out waiting for Minecraft to exit')), 5_000); }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
