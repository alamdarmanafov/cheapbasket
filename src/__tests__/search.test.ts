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

describe('coverage ordering', () => {
  it('puts products priced at more stores first within a band', () => {
    catalog.categories = [];
    catalog.products = [
      { ...catalog.products[0], id: 'one', brand: 'Sütaş', name: 'Süd 1L', category: 'süd', prices: { araz: 2.1 } } as never,
      { ...catalog.products[0], id: 'three', brand: 'Sütaş', name: 'Süd 1L', category: 'süd', prices: { araz: 2.1, bravo: 2.2, oba: 2.3 } } as never,
      { ...catalog.products[0], id: 'two', brand: 'Sütaş', name: 'Süd 1L', category: 'süd', prices: { araz: 2.1, bravo: 2.0 } } as never,
    ];
    expect(searchProducts('sütaş süd').map((p) => p.id)).toEqual(['three', 'two', 'one']);
  });
});
