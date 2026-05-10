import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

function mediaBlock(query: string) {
  const start = styles.indexOf(`@media (${query}) {`);
  expect(start).toBeGreaterThanOrEqual(0);

  const nextMedia = styles.indexOf('@media ', start + 1);
  return styles.slice(start, nextMedia === -1 ? undefined : nextMedia);
}

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

  it('stacks the operations rail as a top section on narrow screens', () => {
    const tabletStyles = mediaBlock('max-width: 1120px');
    const mobileStyles = mediaBlock('max-width: 860px');

    expect(tabletStyles).toContain(
      '.operations-shell {\n    grid-template-columns: 1fr;',
    );
    expect(tabletStyles).toContain(
      '.operations-feature-rail {\n    position: static;',
    );
    expect(mobileStyles).toContain(
      '.operations-feature-nav {\n    grid-template-columns: 1fr;',
    );
    expect(styles).not.toContain(
      '.operations-feature-nav {\n    grid-template-columns: repeat(2, minmax(0, 1fr));',
    );
  });
});
