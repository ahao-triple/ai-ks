import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('global styles', () => {
  it('keeps operation readouts readable inside narrow tool panels', () => {
    expect(styles).toContain('.tool-grid .readout-grid');
    expect(styles).toContain('minmax(120px, 1fr)');
    expect(styles).toContain('overflow-wrap: break-word');
  });
});
