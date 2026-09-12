import { parseSize, unitPrice } from '../lib/unitPrice';

describe('parseSize', () => {
  it.each([
    ['500 q', { qty: 0.5, unit: 'kg' }],
    ['1 kq', { qty: 1, unit: 'kg' }],
    ['2,5 kg', { qty: 2.5, unit: 'kg' }],
    ['250 gr', { qty: 0.25, unit: 'kg' }],
    ['200 г', { qty: 0.2, unit: 'kg' }],
    ['1 L', { qty: 1, unit: 'l' }],
    ['330 ml', { qty: 0.33, unit: 'l' }],
    ['0.5л', { qty: 0.5, unit: 'l' }],
    ['1.5 lt', { qty: 1.5, unit: 'l' }],
    ['6 x 1 L', { qty: 6, unit: 'l' }],
    ['10 ədəd', { qty: 10, unit: 'pc' }],
    ['12 шт', { qty: 12, unit: 'pc' }],
  ])('%s', (size, expected) => {
    expect(parseSize(size)).toEqual(expected);
  });
  it('gives up on what it cannot read', () => {
    expect(parseSize('—')).toBeNull();
    expect(parseSize('')).toBeNull();
    expect(parseSize('böyük')).toBeNull();
  });
});

describe('unitPrice', () => {
  it('makes 500 q and 1 kq comparable', () => {
    expect(unitPrice(2.4, '500 q')).toEqual({ per: 4.8, unit: 'kg' });
    expect(unitPrice(4.2, '1 kq')).toEqual({ per: 4.2, unit: 'kg' });
  });
  it('does not repeat the price for a single piece', () => {
    expect(unitPrice(3, '1 ədəd')).toBeNull();
  });
  it('is silent without a price or a readable size', () => {
    expect(unitPrice(null, '1 kq')).toBeNull();
    expect(unitPrice(3, 'yumşaq')).toBeNull();
  });
});
