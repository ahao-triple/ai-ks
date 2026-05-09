const path = require('node:path');

const rootDir = __dirname;

module.exports = {
  apps: [
    {
      name: 'ai-ks-api',
      cwd: path.join(rootDir, 'apps/api'),
      script: 'dist/main.js',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'ai-ks-web',
      cwd: rootDir,
      script: 'scripts/serve-web-dist.mjs',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
