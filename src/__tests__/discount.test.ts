import { daysLeft } from '../lib/discount';

describe('daysLeft', () => {
  const now = new Date('2026-09-11T10:00:00Z');
  it('counts whole days up to the end', () => {
    expect(daysLeft('2026-09-13T00:00:00Z', now)).toBe(2);
    expect(daysLeft('2026-09-11T12:00:00Z', now)).toBe(1);
  });
  it('is null once passed, or without a date', () => {
    expect(daysLeft('2026-09-10T00:00:00Z', now)).toBeNull();
    expect(daysLeft(null, now)).toBeNull();
    expect(daysLeft('nonsense', now)).toBeNull();
  });
});
