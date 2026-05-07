import { resolve } from 'node:path';

export function resolveWorkspaceEnvPath(fromDir = __dirname): string {
  return resolve(fromDir, '../../../../..', '.env');
}
