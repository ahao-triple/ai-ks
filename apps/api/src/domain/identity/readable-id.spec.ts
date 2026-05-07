import { generateReadableId } from './readable-id';

describe('generateReadableId', () => {
  it('generates a stable readable id with at most seven characters', () => {
    const first = generateReadableId('demo-game:open-id-001');
    const second = generateReadableId('demo-game:open-id-001');

    expect(first).toBe(second);
    expect(first).toMatch(/^[A-Z0-9]{7}$/);
    expect(first).toHaveLength(7);
  });
});
