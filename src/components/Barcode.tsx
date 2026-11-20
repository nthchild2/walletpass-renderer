import { useMemo } from 'react';
import { toSVG } from 'bwip-js/browser';
import { bytesToBinaryString, encodeMessage } from '../pass/encoding';
import { BARCODE_FORMATS, type BarcodeFormat, type PassBarcode } from '../pass/types';

// 2D symbologies carry arbitrary bytes, so they get the message encoded with messageEncoding.
const BYTE_SYMBOLOGIES = new Set(['qrcode', 'pdf417', 'azteccode']);

/**
 * `status` (voided / expired) is shown on top of the dimmed barcode, inside its box, so the bottom
 * of the pass keeps the same size and never pushes the barcode up into the fields.
 */
export function Barcode({ barcode, status }: { barcode: PassBarcode; status?: string }) {
  const dimmed = !!status;
  const info = BARCODE_FORMATS[barcode.format as BarcodeFormat];
  const bcid = info?.bcid;
  const isSquare = !!info?.square;
  const kind = !info ? 'unknown' : isSquare ? 'square' : bcid === 'pdf417' ? 'pdf417' : 'linear';

  const result = useMemo(() => {
    if (!bcid) return { error: `Unsupported format: ${barcode.format}` };
    if (!barcode.message) return { error: 'No barcode message' };
    try {
      const bytes = BYTE_SYMBOLOGIES.has(bcid);
      const svg = toSVG({
        bcid,
        text: bytes ? bytesToBinaryString(encodeMessage(barcode.message, barcode.messageEncoding).bytes) : barcode.message,
        ...(bytes ? { binarytext: true } : {}),
        scale: 3,
        ...(bcid === 'pdf417' ? { columns: 3, rowmult: 3 } : {}),
      });
      // Wallet draws wide barcodes into a fixed box (229.5×52.5 pt PDF417, 209×40 pt linear).
      return { svg: isSquare ? svg : svg.replace('<svg ', '<svg preserveAspectRatio="none" ') };
    } catch (e) {
      return { error: e instanceof Error ? e.message.replace(/^bwipp\.\w+#\d+:\s*/, '') : String(e) };
    }
  }, [bcid, barcode.message, barcode.messageEncoding, barcode.format, isSquare]);

  return (
    <div className={`barcode barcode--${kind} ${dimmed ? 'barcode--dimmed' : ''}`}>
      {'svg' in result ? (
        <div className="barcode__frame">
          <div className="barcode__image" dangerouslySetInnerHTML={{ __html: result.svg! }} />
          {status && <div className="barcode__status">{status}</div>}
        </div>
      ) : (
        <div className="barcode__error">{result.error}</div>
      )}
      {barcode.altText && <div className="barcode__alt">{barcode.altText}</div>}
    </div>
  );
}
