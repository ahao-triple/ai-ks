import { resolve } from 'node:path';
import { resolveWorkspaceEnvPath } from './workspace-env';

describe('resolveWorkspaceEnvPath', () => {
  it('resolves the root env file from source code paths', () => {
    expect(
      resolveWorkspaceEnvPath('/workspace/apps/api/src/common/env'),
    ).toBe(resolve('/workspace/.env'));
  });

  it('resolves the root env file from built dist paths', () => {
    expect(
      resolveWorkspaceEnvPath('/workspace/apps/api/dist/common/env'),
    ).toBe(resolve('/workspace/.env'));
  });
});
