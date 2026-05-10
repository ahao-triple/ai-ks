import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('global styles', () => {
  it('keeps operation readouts readable inside narrow tool panels', () => {
    expect(styles).toContain('.tool-grid .readout-grid');
    expect(styles).toContain('minmax(120px, 1fr)');
    expect(styles).toContain('overflow-wrap: break-word');
  });

  it('uses a left-side operations function rail instead of the old top nav', () => {
    expect(styles).toContain('.operations-shell');
    expect(styles).toContain('.operations-feature-rail');
    expect(styles).toContain('.operations-feature-nav-item');
    expect(styles).toContain('.operations-workspace-body');
    expect(styles).toContain('grid-template-columns: 220px minmax(0, 1fr)');
    expect(styles).not.toContain('.operations-nav');
    expect(styles).not.toContain('.operations-nav-item');
  });
});
