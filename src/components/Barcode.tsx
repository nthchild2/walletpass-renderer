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
export function Barcode({ barcode, status, pixelRatio = 3 }: { barcode: PassBarcode; status?: string; pixelRatio?: number }) {
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
      const opts = {
        bcid,
        text: bytes ? bytesToBinaryString(encodeMessage(barcode.message, barcode.messageEncoding).bytes) : barcode.message,
        ...(bytes ? { binarytext: true } : {}),
        ...(bcid === 'pdf417' ? { columns: 3, rowmult: 3 } : {}),
      };
      const svg = toSVG({ ...opts, scale: 3 });
      // Square codes: how many modules wide, for Wallet's pixel-snapped sizing below. bwip-js draws
      // 2 × scale SVG units per module (a 25-module QR at scale 3 has a 150-unit viewBox).
      const viewBox = /viewBox="0 0 ([\d.]+)/.exec(svg);
      const modules = isSquare && viewBox ? Math.round(parseFloat(viewBox[1]) / 6) : undefined;
      // Wallet draws wide barcodes into a fixed box (229.5×52.5 pt PDF417, 209×40 pt linear).
      return {
        svg: isSquare ? svg.replace('<svg ', '<svg shape-rendering="crispEdges" ') : svg.replace('<svg ', '<svg preserveAspectRatio="none" '),
        modules,
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message.replace(/^bwipp\.\w+#\d+:\s*/, '') : String(e) };
    }
  }, [bcid, barcode.message, barcode.messageEncoding, barcode.format, isSquare]);

  // QR / Aztec sizing, measured in Apple's Add Pass sheet (iOS 27 Simulator): the code aims for
  // ~136 pt with each module rounded down to whole device pixels (29 modules: 9 px on an @2x
  // iPhone SE = 130.5 pt, 14 px on an @3x iPhone 17 = 135.3 pt). Padding is ~9.25 pt, widened so
  // the box stays about 150 pt for smaller codes, with ~2 pt extra at the bottom.
  const square = 'modules' in result && result.modules ? squareBox(result.modules, pixelRatio) : undefined;
  return (
    <div
      className={`barcode barcode--${kind} ${dimmed ? 'barcode--dimmed' : ''}`}
      style={square ? { padding: `${square.pad}px ${square.pad}px ${square.pad + 2}px` } : undefined}
    >
      {'svg' in result ? (
        <div className="barcode__frame">
          <div
            className="barcode__image"
            style={square ? { width: square.code, height: square.code } : undefined}
            dangerouslySetInnerHTML={{ __html: result.svg! }}
          />
          {status && <div className="barcode__status">{status}</div>}
        </div>
      ) : (
        <div className="barcode__error">{result.error}</div>
      )}
      {barcode.altText && <div className="barcode__alt">{barcode.altText}</div>}
    </div>
  );
}

/** Pixel-snapped QR / Aztec code size and box padding, in points. */
export function squareBox(modules: number, pixelRatio: number) {
  const modulePx = Math.max(1, Math.floor((136 * pixelRatio) / modules));
  const code = (modulePx * modules) / pixelRatio;
  const pad = Math.max(9.25, (150 - code) / 2);
  return { code, pad };
}
