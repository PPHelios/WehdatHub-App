/**
 * Lexical gate for voice transcripts: pauses short/garbled fragments, unit codes, or
 * conflicting market signals for quick review before firing a search or report query.
 */
export function needsVoiceConfirm(raw: string): {
  confirm: boolean;
  reason?: 'unit_code' | 'short_fragment' | 'mixed_market';
} {
  const clean = String(raw || '').trim();
  if (!clean) return { confirm: false };

  const hasUnitCode = /\b[a-z]{1,4}\s*[-–]?\s*\d{1,5}\b/i.test(clean);
  if (hasUnitCode) return { confirm: true, reason: 'unit_code' };

  const norm = clean
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
  const hasResale = /\bresale\b|ريسيل|اعاده البيع/.test(norm);
  const hasPrimary = /\b(primary|developer|projects?)\b|برايمر[ي]|مطور(?:ين)?|مشاريع/.test(norm);
  if (hasResale && hasPrimary) return { confirm: true, reason: 'mixed_market' };

  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length === 1 && clean.length <= 3) {
    return { confirm: true, reason: 'short_fragment' };
  }

  return { confirm: false };
}
