/**
 * Starter lists. Each entry is a search term; the first product it finds in
 * the catalogue is what goes into the basket, so the templates follow the
 * catalogue rather than hard-coding ids that go stale.
 */
export const TEMPLATES: Array<{ id: string; emoji: string; terms: string[] }> = [
  { id: 'breakfast', emoji: '🍳', terms: ['süd', 'yumurta', 'çörək', 'pendir', 'kərə yağı', 'çay'] },
  { id: 'weekly', emoji: '🧺', terms: ['süd', 'yumurta', 'çörək', 'düyü', 'makaron', 'şəkər', 'günəbaxan yağı', 'un', 'toyuq', 'kartof', 'soğan'] },
  { id: 'kids', emoji: '🧒', terms: ['qatıq', 'banan', 'alma', 'peçenye', 'şirə', 'süd'] },
];
