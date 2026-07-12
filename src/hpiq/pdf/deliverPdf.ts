/**
 * deliverPdf — hands the generated data-sheet PDF to the user.
 *
 * One file, three delivery paths, chosen by capability (never by user agent):
 *   - Mobile (iOS + Android) → the native SHARE SHEET with the PDF attached.
 *     This is the only way iOS users can get a PDF at all (iOS has no
 *     "Save as PDF" print destination) and it offers both "Print" and
 *     "Save to Files" in one place.
 *   - Desktop, print → open the PDF (jsPDF `autoPrint` makes the viewer raise
 *     the print dialog straight away), so the margins/geometry come from OUR
 *     PDF, not from the browser's print engine.
 *   - Anything else / share cancelled → plain file download.
 *
 * Must be called from a click handler: `navigator.share()` needs the transient
 * user activation, and PDF generation is synchronous so it stays inside it.
 */
import type { jsPDF } from 'jspdf';

const canShareFile = (file: File): boolean =>
  typeof navigator !== 'undefined' &&
  typeof navigator.canShare === 'function' &&
  navigator.canShare({ files: [file] });

function download(blob: Blob, filename: string): void {
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

export type PdfIntent = 'print' | 'download';

/**
 * Deliver the PDF. Resolves once the hand-off is done (or the user cancelled
 * the share sheet — in that case nothing else is forced on them).
 */
export async function deliverPdf(doc: jsPDF, filename: string, intent: PdfIntent): Promise<void> {
  // For a desktop print we ask the PDF viewer to open its print dialog itself.
  if (intent === 'print') doc.autoPrint();

  const blob = doc.output('blob') as Blob;
  const file = new File([blob], filename, { type: 'application/pdf' });

  // Mobile: the OS share sheet covers BOTH printing and saving to Files.
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err: any) {
      // AbortError = user closed the sheet; respect that and stop.
      if (err?.name === 'AbortError') return;
      // Anything else (e.g. share unsupported at call time) → fall through.
    }
  }

  if (intent === 'print') {
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    if (win) return;              // PDF opened; autoPrint raises the dialog
    // Pop-up blocked → the user still gets the file.
  }

  download(blob, filename);
}
