/** A small CSV reader: quotes, doubled quotes, CR/LF, comma or semicolon. */
export function parseCSV(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      row.push(field); field = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      if (ch === '\r' && next === '\n') i++;
    } else field += ch;
  }
  if (field || row.length) { row.push(field); if (row.some((c) => c !== '')) rows.push(row); }
  return rows;
}

export function detectDelimiter(text: string): ',' | ';' {
  const sample = text.slice(0, 2000);
  const commas = (sample.match(/,/g) ?? []).length;
  const semis = (sample.match(/;/g) ?? []).length;
  return semis > commas ? ';' : ',';
}

/** "2,49", "2.49 ₼", "AZN 2.49" → 2.49; nothing usable → null. */
export function parsePrice(s: string): number | null {
  const n = Number(String(s ?? '').replace(/[^\d.,]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n < 10000 ? Math.round(n * 100) / 100 : null;
}

/** Column indexes guessed from a header row, for the three fields a price list needs. */
export function guessColumns(headers: string[]): { barcode?: number; name?: number; price?: number; size?: number; brand?: number } {
  const find = (kws: string[]) => {
    const i = headers.findIndex((h) => kws.some((k) => h.trim().toLowerCase().includes(k)));
    return i >= 0 ? i : undefined;
  };
  return {
    barcode: find(['barkod', 'barcode', 'ean', 'gtin', 'kod']),
    name: find(['ad', 'name', 'məhsul', 'mehsul', 'product', 'title', 'наимен']),
    brand: find(['brend', 'brand', 'marka']),
    size: find(['ölçü', 'olcu', 'size', 'həcm', 'weight', 'çəki']),
    price: find(['qiymət', 'qiymet', 'price', 'цена', 'fiyat']),
  };
}
