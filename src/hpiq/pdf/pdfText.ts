/**
 * pdfText — the symbol folding every GENERATED PDF shares (data sheet,
 * comparison). Moved out of dataSheetPdf.ts unchanged (2026-09-29) so the
 * comparison builder cannot drift from it.
 *
 * WinAnsi (the PDF standard font, Helvetica fallback) covers Latin-1 plus a
 * small extras set, but NOT: eta (U+03B7, "ηs"), U+2212 MINUS ("A−7/W35"),
 * ≈, ≠. Left unmapped these come out as mojibake. NFC first so combining marks
 * compose into real letters, then fold the known symbols, then drop anything
 * still unsupported (a belt-and-braces guard for strings added later).
 * `latinExt` = the embedded Noto Sans registered on this document, so
 * Latin-Extended-A letters (Polish ą ć ę ł …) are kept instead of dropped.
 */
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';

const keepChar = (ch: string, latinExt: boolean): boolean => {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp <= 0xFF) return true;
  if (latinExt && cp >= 0x100 && cp <= 0x17F) return true;
  return WINANSI_EXTRA.includes(ch);
};

export const foldPdfText = (s: string, latinExt: boolean): string =>
  (s ?? '').toString()
    .normalize('NFC')
    .replace(/ηs/g, 'eta-s')     // seasonal space-heating efficiency
    .replace(/η/g, 'eta')
    .replace(/−/g, '-')          // MINUS SIGN
    .replace(/≈/g, '~')
    .replace(/≠/g, '!=')
    .replace(/…/g, '...')
    .replace(/[›»]/g, '>')
    .replace(/[‹«]/g, '<')
    .replace(/\u00a0/g, ' ')     // non-breaking space
    .split('')
    .filter(ch => keepChar(ch, latinExt))
    .join('');
