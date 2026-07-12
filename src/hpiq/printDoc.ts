/**
 * printDoc — reliable cross-browser printing of the data-sheet document.
 *
 * Why an iframe instead of window.print() on the whole page:
 * The whole-page approach hides #root with `visibility:hidden; height:0;
 * overflow:hidden` and re-shows the absolutely-positioned `.hpiq-print-doc`.
 * That works in Chrome/Android but is fragile in Safari/WebKit (Mac + iOS) —
 * the print preview comes up blank. Printing a dedicated iframe that contains
 * ONLY the document removes every one of those hacks: no #root to hide, no
 * clipping ancestor, no visibility juggling. It prints identically in Chrome,
 * Safari (macOS + iOS) and Firefox.
 *
 * Self-contained by construction: the document's styling is all inline (React
 * inline styles travel with outerHTML), the fonts are system fonts (no
 * @font-face to load), and the small <style> below supplies the CSS custom
 * properties, the @page box and the per-page watermark. Because nothing loads
 * asynchronously, `iframe.contentWindow.print()` is called SYNCHRONOUSLY inside
 * the click gesture — required so the browser never treats it as an
 * "automatic" print and blocks it.
 */

const FONT_VARS =
  '--hp-font-display: "SF Pro Display", system-ui, -apple-system, BlinkMacSystemFont, "Inter", sans-serif;' +
  '--hp-font-text: "SF Pro Text", system-ui, -apple-system, BlinkMacSystemFont, "Inter", sans-serif;';

// Mirrors hpiq.css watermark rules + the print @page box, scoped to the
// isolated iframe document (which contains only the data sheet).
const PRINT_STYLE = `
  :root { ${FONT_VARS} }
  html, body { margin: 0; padding: 0; background: #fff; font-family: var(--hp-font-text); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .hpiq-print-doc { width: 100% !important; max-width: 100% !important; border: none !important; border-radius: 0 !important; padding: 0 !important; box-sizing: border-box !important; }
  .hpiq-watermark { display: none !important; }
  .hpiq-print-watermark { display: flex; position: fixed; inset: 0; align-items: center; justify-content: center; pointer-events: none; opacity: 0.06; }
  @page { size: A4; margin: 15mm 12mm; }
`;

/**
 * Print the current `.hpiq-print-doc` via an isolated iframe.
 * Falls back to window.print() if the document node isn't present.
 * MUST be called directly from a user-gesture handler (click).
 */
export function printDataSheet(): void {
  const src = document.querySelector('.hpiq-print-doc');
  if (!src) { window.print(); return; }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.title = 'print';
  // Kept in the layout (not display:none) so WebKit reliably renders + prints it.
  iframe.style.cssText = 'position:fixed; right:0; bottom:0; width:1px; height:1px; border:0; opacity:0; pointer-events:none;';
  document.body.appendChild(iframe);

  const idoc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!idoc || !win) { iframe.remove(); window.print(); return; }

  // Synchronous write → styles + inline markup are ready immediately.
  idoc.open();
  idoc.write(
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<style>${PRINT_STYLE}</style></head>` +
    `<body>${src.outerHTML}</body></html>`
  );
  idoc.close();

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try { iframe.remove(); } catch { /* already gone */ }
  };
  // afterprint fires when the dialog closes (desktop) or after the OS print
  // sheet on mobile; keep a long safety-net timeout for engines that never fire it.
  win.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(cleanup, 120_000);

  win.focus();
  win.print();
}
