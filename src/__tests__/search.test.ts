import { catalog, Product, searchProducts } from '../data/products';

const product = (id: string, brand: string, name: string, category = 'süd məhsulları'): Product => ({
  id, barcode: '', name, brand, size: '', category, emoji: '', tint: '', imageUrl: null, prices: { araz: 1 }, regularPrices: {}, history: [], updatedMinutesAgo: 0,
});

beforeEach(() => {
  // Categories are searched too, so each fixture gets its own: a shared
  // "süd məhsulları" would make every product match "sud".
  catalog.products = [product('1', 'Milla', 'Qatıq', 'qatıq'), product('2', 'Palsüd', 'Süd 3.2%', 'süd'), product('3', 'Sabah', 'Yumurta 10 ədəd', 'yumurta'), product('4', 'Atena', 'Kəsmik', 'pendir')];
  catalog.categories = [];
});

describe('searchProducts', () => {
  it('finds through normalised letters', () => {
    expect(searchProducts('sud').map((p) => p.id)).toEqual(['2']);
    expect(searchProducts('qatiq').map((p) => p.id)).toEqual(['1']);
  });
  it('forgives one wrong letter in a word of four or more', () => {
    expect(searchProducts('yumrta').map((p) => p.id)).toEqual(['3']);
    expect(searchProducts('kesmyk').map((p) => p.id)).toEqual(['4']);
  });
  it('keeps short words exact', () => {
    expect(searchProducts('sut')).toEqual([]);
  });
  it('puts exact matches before near ones', () => {
    catalog.products.push(product('5', 'Bravo', 'Yumurta 6 ədəd', 'yumurta'));
    const ids = searchProducts('yumurta').map((p) => p.id);
    expect(ids).toEqual(['3', '5']);
  });
});
