import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { PublicReceipt } from '@/services/api';

interface DownloadOptions {
  /** Scale factor for rendering. 2 is sharp on retina, 3 is print-ready, 1 is fast/blurry. */
  scale?: number;
}

/**
 * Rasterize the on-screen <Receipt> element and download it as a single-page PDF.
 * This guarantees the PDF looks identical to the website because it IS a
 * screenshot of the website.
 *
 * The caller must pass the DOM element corresponding to .receipt-doc.
 */
export async function downloadReceipt(
  element: HTMLElement,
  receipt: PublicReceipt,
  options: DownloadOptions = {}
): Promise<void> {
  const scale = options.scale ?? 2;

  // Render the element to a canvas. background: '#FFFFFF' avoids the page bg
  // bleeding through if the receipt has rounded corners.
  const canvas = await html2canvas(element, {
    scale,
    backgroundColor: '#FFFFFF',
    logging: false,
    useCORS: true,
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  // Fit the image inside an A4 portrait page with a small margin.
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const pageMargin = 24;
  const availableW = pageW - pageMargin * 2;
  const availableH = pageH - pageMargin * 2;

  // Maintain aspect ratio. Scale to fit width first; if that overflows the
  // height, scale to fit height instead.
  const imgAspect = canvas.width / canvas.height;
  let drawW = availableW;
  let drawH = drawW / imgAspect;
  if (drawH > availableH) {
    drawH = availableH;
    drawW = drawH * imgAspect;
  }
  const drawX = (pageW - drawW) / 2;
  const drawY = pageMargin;

  pdf.addImage(imgData, 'JPEG', drawX, drawY, drawW, drawH);
  pdf.save(`aidvocate-receipt-${receipt.paymentReference.slice(0, 12)}.pdf`);
}
