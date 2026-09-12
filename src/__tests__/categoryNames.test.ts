import { categoryLabel, foldCategory } from '@/data/categoryNames';
import { catalog } from '@/data/products';

describe('categoryLabel', () => {
  beforeEach(() => {
    catalog.categories = [];
  });

  it('folds the Azerbaijani dotted and dotless I the way the alphabet does', () => {
    expect(foldCategory('İçkilər')).toBe('içkilər');
    expect(foldCategory('ISTI')).toBe('ıstı');
  });

  it('translates a seeded name that starts with İ', () => {
    expect(categoryLabel('İçkilər', 'en')).toBe('Drinks');
    expect(categoryLabel('İçkilər', 'ru')).toBe('Напитки');
  });

  it('prefers the admin translation, then the built-in one, then the stored name', () => {
    catalog.categories = [
      { id: 'ickiler', name: 'İçkilər', emoji: null, names: { en: 'Beverages' } },
      { id: 'yeni', name: 'Yeni şey', emoji: null, names: { tr: 'Yeni' } },
    ];
    expect(categoryLabel('İçkilər', 'en')).toBe('Beverages');
    expect(categoryLabel('İçkilər', 'tr')).toBe('İçecekler');
    expect(categoryLabel('Yeni şey', 'tr')).toBe('Yeni');
    expect(categoryLabel('Yeni şey', 'en')).toBe('Yeni şey');
    expect(categoryLabel('Yeni şey', 'az')).toBe('Yeni şey');
  });
});
