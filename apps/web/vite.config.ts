import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, workspaceRoot, '');

  return {
    envDir: workspaceRoot,
    plugins: [react()],
    server: {
      port: resolveWebPort(env.WEB_PORT),
      proxy: {
        '/api': {
          target: resolveApiOrigin(env.API_PORT),
          changeOrigin: true,
        },
      },
      strictPort: true,
    },
  };
});

function resolveWebPort(value: string | undefined): number {
  return resolvePort(value, 5173, 'WEB_PORT');
}

function resolveApiOrigin(apiPort: string | undefined): string {
  return `http://localhost:${resolvePort(apiPort, 3000, 'API_PORT')}`;
}

function resolvePort(
  value: string | undefined,
  defaultPort: number,
  name: string,
): number {
  const rawValue = value?.trim();
  if (!rawValue) {
    return defaultPort;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`${name} must be a valid port number`);
  }

  const port = Number.parseInt(rawValue, 10);
  if (port < 1 || port > 65535) {
    throw new Error(`${name} must be a valid port number`);
  }

  return port;
}
