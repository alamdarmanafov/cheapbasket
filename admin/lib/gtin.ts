/**
 * One barcode, one spelling.
 *
 * A GS1 barcode (GTIN) is the same number whether it is printed as 8, 12, 13
 * or 14 digits: the shorter forms are the longer ones with the leading zeros
 * taken off. Wolt hands us the 14-digit form ("0" + EAN-13), the phone's
 * scanner reads the 13 off the packet, iOS reports a UPC-A as a 13 with a
 * leading zero while Android reports the 12 — and a plain string compare
 * called every one of those a different product. This is the rule GS1 itself
 * uses: right-align, drop the zeros, keep the shortest standard length.
 *
 * Only real GTINs are touched. The check digit is the same calculation at any
 * length, so it tells a GTIN apart from a shop's own internal code — and an
 * internal code is left exactly as it came, zeros and all, because for those
 * the zeros may well be part of the number.
 */

const STANDARD_LENGTHS = [8, 12, 13, 14];

function checkDigitOk(digits: string): boolean {
  // Weights 3,1,3,1… from the right, excluding the check digit itself.
  let sum = 0;
  for (let i = digits.length - 2, w = 3; i >= 0; i--, w = 4 - w) sum += Number(digits[i]) * w;
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

/** Digits only, or null when there is nothing to keep. */
export function barcodeDigits(raw: string | null | undefined): string | null {
  const d = (raw ?? '').replace(/\D/g, '');
  return d.length ? d : null;
}

/**
 * The canonical spelling of a barcode: a valid GTIN in its shortest standard
 * form; anything else as its digits. Null when there are no digits at all.
 */
export function normalizeGtin(raw: string | null | undefined): string | null {
  const d = barcodeDigits(raw);
  if (!d) return null;
  // Anything shorter than an EAN-8 was never printed as a barcode; a check
  // digit passes one number in ten by chance, so short internal codes are not
  // put through it.
  const stripped = d.replace(/^0+/, '');
  if (d.length < 8 || !stripped || stripped.length > 14) return d;
  // The check digit does not care how many zeros sit in front, so the first
  // standard length the number fits is its canonical one — if it checks out.
  const len = STANDARD_LENGTHS.find((n) => n >= stripped.length) ?? 14;
  const canon = stripped.padStart(len, '0');
  return checkDigitOk(canon) ? canon : d;
}

/** Every spelling a stored barcode might have, for a lookup that predates normalisation. */
export function gtinVariants(raw: string | null | undefined): string[] {
  const d = barcodeDigits(raw);
  if (!d) return [];
  const out = new Set<string>([d]);
  const n = normalizeGtin(d);
  if (n) {
    out.add(n);
    for (const len of STANDARD_LENGTHS) if (len >= n.length) out.add(n.padStart(len, '0'));
  }
  return [...out];
}
