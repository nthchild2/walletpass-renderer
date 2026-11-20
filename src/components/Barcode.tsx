import { useEffect, useMemo, useState } from 'react';
import { bytesToBinaryString, encodeMessage } from '../pass/encoding';
import { BARCODE_FORMATS, type BarcodeFormat, type PassBarcode } from '../pass/types';

// bwip-js is most of the app's code, so it loads on its own, right away but after the page shows.
type Bwip = typeof import('bwip-js/browser');
let bwip: Bwip | null = null;
const bwipReady = import('bwip-js/browser').then((m) => (bwip = m));

function useBwip(): Bwip | null {
  const [lib, setLib] = useState(bwip);
  useEffect(() => {
    if (!lib) void bwipReady.then(setLib);
  }, [lib]);
  return lib;
}

// 2D symbologies carry arbitrary bytes, so they get the message encoded with messageEncoding.
const BYTE_SYMBOLOGIES = new Set(['qrcode', 'pdf417', 'azteccode']);

/**
 * The barcode "sticker" as PassKit draws it (PKBarcodeStickerView, iOS 27, measured in the
 * Simulator): a white box with 5 pt corners around the code image, which includes a quiet zone.
 *
 *  - QR: modules of floor(145 pt × pixel ratio ÷ (modules + 2)) device pixels, 1-module quiet zone
 *    (29 modules: 14 px at @3x = 135.3 pt code, 145 pt image; 9 px at @2x = 130.5 pt).
 *  - Aztec: floor(166 pt × ratio ÷ (modules + 4)) px, 2-module quiet zone; Apple picks compact
 *    symbols where they fit.
 *  - PDF417: about 240 × 66 pt of code in a 248 × 74 pt image (Apple's symbol shape varies with
 *    the message; this is its shape for typical 20–60 character messages).
 *  - Code 128 and the other 1D codes: a 245 × 64 pt image; bars 39.3 pt tall, stretched to
 *    245 × modules ÷ (modules + 20) (a 10-module quiet zone each side).
 *  - Box: 6 pt left and right, 5 pt above, 7 pt below the image (9 pt all round for PDF417).
 *    Alt text (SF Pro 14 pt) adds 15 pt; the box grows upwards, its bottom stays put.
 *  - A voided or expired pass: the code is drawn at 8 % and the alt text, if any, is replaced by
 *    "this pass has expired" in grey; without alt text nothing is written.
 */
export function Barcode({ barcode, invalid = false, pixelRatio = 3 }: { barcode: PassBarcode; invalid?: boolean; pixelRatio?: number }) {
  const info = BARCODE_FORMATS[barcode.format as BarcodeFormat];
  const bcid = info?.bcid;
  const isSquare = !!info?.square;
  const kind = !info ? 'unknown' : isSquare ? 'square' : bcid === 'pdf417' ? 'pdf417' : 'linear';
  const lib = useBwip();

  const result = useMemo(() => {
    if (!bcid) return { error: `Unsupported format: ${barcode.format}` };
    if (!lib) return { svg: '', modules: undefined }; // still loading: an empty box of the default size
    const { toSVG } = lib;
    if (!barcode.message) return { error: 'No barcode message' };
    try {
      const bytes = BYTE_SYMBOLOGIES.has(bcid);
      const opts = {
        bcid,
        text: bytes ? bytesToBinaryString(encodeMessage(barcode.message, barcode.messageEncoding).bytes) : barcode.message,
        ...(bytes ? { binarytext: true } : {}),
        ...(bcid === 'pdf417' ? { columns: 3, rowmult: 3 } : {}),
        // bwip-js inserts no quiet zone; the sizes below add PassKit's.
      };
      let svg: string;
      try {
        svg = toSVG({ ...opts, ...(bcid === 'azteccode' ? { format: 'compact' } : {}), scale: 3 });
      } catch (e) {
        if (bcid !== 'azteccode') throw e;
        svg = toSVG({ ...opts, scale: 3 }); // too long for a compact symbol
      }
      // Width in modules: bwip-js draws 2 × scale SVG units per module for 2D codes and scale units
      // per module for 1D codes (a 29-module QR has a 174-unit viewBox at scale 3).
      const vb = /viewBox="0 0 ([\d.]+)/.exec(svg);
      const units = vb ? parseFloat(vb[1]) : 0;
      const modules = units ? Math.round(units / (isSquare ? 6 : 3)) : undefined;
      return {
        svg: isSquare ? svg.replace('<svg ', '<svg shape-rendering="crispEdges" ') : svg.replace('<svg ', '<svg preserveAspectRatio="none" '),
        modules,
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message.replace(/^bwipp\.\w+#\d+:\s*/, '') : String(e) };
    }
  }, [lib, bcid, barcode.message, barcode.messageEncoding, barcode.format, isSquare]);

  const size = 'modules' in result && result.modules ? barcodeSize(bcid!, result.modules, pixelRatio) : undefined;
  const alt = barcode.altText ? (invalid ? 'this pass has expired' : barcode.altText) : undefined;
  return (
    <div className={`barcode barcode--${kind} ${invalid ? 'barcode--dimmed' : ''} ${alt ? 'barcode--alt' : ''}`}>
      {'svg' in result ? (
        <div className="barcode__frame" style={size ? { width: size.imageW, height: size.imageH } : undefined}>
          <div
            className="barcode__image"
            style={size ? { width: size.codeW, height: size.codeH } : undefined}
            dangerouslySetInnerHTML={{ __html: result.svg! }}
          />
        </div>
      ) : (
        <div className="barcode__error">{result.error}</div>
      )}
      {alt && <div className={`barcode__alt ${invalid ? 'barcode__alt--status' : ''}`}>{alt}</div>}
    </div>
  );
}

/** Code and image (code + quiet zone) size in points, as PassKit sizes them. */
export function barcodeSize(bcid: string, modules: number, pixelRatio: number) {
  if (bcid === 'qrcode' || bcid === 'azteccode') {
    const [max, quiet] = bcid === 'qrcode' ? [145, 1] : [166, 2];
    const px = Math.max(1, Math.floor((max * pixelRatio) / (modules + 2 * quiet)));
    const code = (px * modules) / pixelRatio;
    // PassKit rounds the QR image up to whole points (144.67 → 145); Aztec images aren't rounded.
    const exact = (px * (modules + 2 * quiet)) / pixelRatio;
    const image = bcid === 'qrcode' ? Math.ceil(exact - 1e-6) : exact;
    return { codeW: code, codeH: code, imageW: image, imageH: image };
  }
  if (bcid === 'pdf417') return { codeW: 240, codeH: 66, imageW: 248, imageH: 74 };
  return { codeW: (245 * modules) / (modules + 20), codeH: 39.33, imageW: 245, imageH: 64 };
}
