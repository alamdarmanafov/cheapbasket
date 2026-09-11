import { gtinVariants, normalizeGtin } from '../lib/gtin';

describe('normalizeGtin', () => {
  it('drops the leading zero of a 14-digit spelling of a valid EAN-13', () => {
    expect(normalizeGtin('04006381333931')).toBe('4006381333931');
    expect(normalizeGtin('04600080322106')).toBe('4600080322106');
  });
  it('leaves a canonical EAN-13 alone', () => {
    expect(normalizeGtin('4006381333931')).toBe('4006381333931');
  });
  it('reads a UPC-A however it was padded', () => {
    expect(normalizeGtin('036000291452')).toBe('036000291452');
    expect(normalizeGtin('0036000291452')).toBe('036000291452');
    expect(normalizeGtin('00036000291452')).toBe('036000291452');
  });
  it('reads an EAN-8 with zeros in front', () => {
    expect(normalizeGtin('0096385074')).toBe('96385074');
  });
  it('keeps a code whose check digit fails, zeros and all', () => {
    expect(normalizeGtin('04760000000028')).toBe('04760000000028');
  });
  it('keeps short internal codes untouched', () => {
    expect(normalizeGtin('0000123')).toBe('0000123');
  });
  it('strips non-digits and returns null for nothing', () => {
    expect(normalizeGtin('  8690767010012 ')).toBe('8690767010012');
    expect(normalizeGtin('')).toBeNull();
    expect(normalizeGtin(null)).toBeNull();
  });
});

describe('gtinVariants', () => {
  it('lists every spelling a stored row might carry', () => {
    expect(gtinVariants('04006381333931')).toEqual(expect.arrayContaining(['04006381333931', '4006381333931']));
  });
});
