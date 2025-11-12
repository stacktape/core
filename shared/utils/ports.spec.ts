import { describe, expect, test } from 'bun:test';
import { isPortInUse } from './ports';

describe('ports', () => {
  test('should return false for free port', async () => {
    // Port 0 lets OS choose a free port
    const inUse = await isPortInUse(0);
    expect(inUse).toBe(false);
  });

  test('should detect port in use', async () => {
    // Start a server on a random port
    const net = await import('node:net');
    const server = net.createServer();
    await new Promise((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    const inUse = await isPortInUse(port);
    expect(inUse).toBe(true);

    server.close();
  });

  test('should check different hosts', async () => {
    const inUse = await isPortInUse(0, 'localhost');
    expect(typeof inUse).toBe('boolean');
  });
});
