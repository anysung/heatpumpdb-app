/**
 * deliverPdf — hands the generated data-sheet PDF to the user.
 *
 * Scope note (learned the hard way): DOM printing via window.print() works
 * correctly on Chrome (desktop + Android) and macOS Safari — those give a real
 * print dialog and must keep doing so. It is ONLY broken on iOS (iPhone/iPad),
 * where WebKit lays print out against the meta-viewport and ignores
 * @page margins. So this module is used for:
 *   - "PDF download" on every device  → a plain file download, nothing else.
 *   - "Print" on iOS only             → the share sheet, which contains Print
 *                                        and is the only reliable route to a
 *                                        printer with our own A4 geometry.
 * It must NEVER put a share sheet in front of a desktop print or a download.
 */
import type { jsPDF } from 'jspdf';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Download the generated PDF as a file. Used by "PDF download" everywhere. */
export function downloadPdf(doc: jsPDF, filename: string): void {
  downloadBlob(doc.output('blob') as Blob, filename);
}

/**
 * iOS-only print route: offer the PDF to the system share sheet, whose actions
 * include "Print". Falls back to a download if sharing is unavailable/declined.
 */
export async function printPdfViaShareSheet(doc: jsPDF, filename: string): Promise<void> {
  const blob = doc.output('blob') as Blob;
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err: any) {
      if (err?.name === 'AbortError') return;   // user closed the sheet
    }
  }
  downloadBlob(blob, filename);
}
