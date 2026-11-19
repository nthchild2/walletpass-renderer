import { useMemo } from 'react';
import { toSVG } from 'bwip-js/browser';
import type { PassBarcode } from '../pass/types';

const BCID: Record<string, string> = {
  PKBarcodeFormatQR: 'qrcode',
  PKBarcodeFormatPDF417: 'pdf417',
  PKBarcodeFormatAztec: 'azteccode',
  PKBarcodeFormatCode128: 'code128',
};

export function Barcode({ barcode, dimmed }: { barcode: PassBarcode; dimmed?: boolean }) {
  const bcid = BCID[barcode.format];
  const isSquare = barcode.format === 'PKBarcodeFormatQR' || barcode.format === 'PKBarcodeFormatAztec';

  const result = useMemo(() => {
    if (!bcid || !barcode.message) return { error: 'No barcode message' };
    try {
      const svg = toSVG({
        bcid,
        text: barcode.message,
        scale: 3,
        ...(barcode.format === 'PKBarcodeFormatPDF417' ? { columns: 3, rowmult: 3 } : {}),
      });
      // Wallet draws wide barcodes into a fixed box (229.5×52.5 pt PDF417, 209×40 pt Code 128).
      return { svg: isSquare ? svg : svg.replace('<svg ', '<svg preserveAspectRatio="none" ') };
    } catch (e) {
      return { error: e instanceof Error ? e.message.replace(/^bwipp\.\w+#\d+:\s*/, '') : String(e) };
    }
  }, [bcid, barcode.message, barcode.format, isSquare]);

  return (
    <div className={`barcode barcode--${bcid ?? 'unknown'} ${isSquare ? 'barcode--square' : 'barcode--wide'} ${dimmed ? 'barcode--dimmed' : ''}`}>
      {'svg' in result ? (
        <div className="barcode__image" dangerouslySetInnerHTML={{ __html: result.svg! }} />
      ) : (
        <div className="barcode__error">{bcid ? result.error : `Unsupported format: ${barcode.format}`}</div>
      )}
      {barcode.altText && <div className="barcode__alt">{barcode.altText}</div>}
    </div>
  );
}
