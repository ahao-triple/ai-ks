import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, workspaceRoot, '');

  return {
    plugins: [react()],
    server: {
      port: resolveWebPort(env.WEB_PORT),
      strictPort: true,
    },
  };
});

function resolveWebPort(value: string | undefined): number {
  const rawValue = value?.trim();
  if (!rawValue) {
    return 5173;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error('WEB_PORT must be a valid port number');
  }

  const port = Number.parseInt(rawValue, 10);
  if (port < 1 || port > 65535) {
    throw new Error('WEB_PORT must be a valid port number');
  }

  return port;
}
