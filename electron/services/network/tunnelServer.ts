import type net from 'node:net';
export async function listen(server: net.Server): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once('error', onError);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', onError);
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('Local tunnel address is unavailable'));
      resolve(address.port);
    });
  });
}

export async function closeServer(server: net.Server): Promise<void> {
  (server as net.Server & { closeAllConnections?: () => void }).closeAllConnections?.();
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
