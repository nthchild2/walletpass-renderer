import { useEffect, useMemo, useState } from 'react';
import { bytesToBinaryString, encodeMessage } from '../pass/encoding';
import { aztecShape, pdf417Shape } from '../pass/barcodeShape';
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
 *  - QR: modules of round(141 pt × pixel ratio ÷ (modules + 2)) device pixels, 1-module quiet zone
 *    (29 modules: 14 px at @3x = 135.3 pt code, 145 pt image).
 *  - Aztec: Core Image's symbol (see pass/barcodeShape.ts), modules of
 *    round(164 pt × pixel ratio ÷ (modules + 4)) device pixels, 2-module quiet zone.
 *  - PDF417: Core Image's columns and rows (rows 3 modules tall), 2-module quiet zone, scaled
 *    towards a 245 × 64 pt image: if a whole number of device pixels per module comes within 5 %
 *    of 245 pt, that width, with the height rounded the same way (down if the width was rounded
 *    down, up if up); otherwise stretched to exactly 245 × 64 pt.
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
      const data = encodeMessage(barcode.message, barcode.messageEncoding).bytes;
      const opts = {
        bcid,
        text: bytes ? bytesToBinaryString(data) : barcode.message,
        ...(bytes ? { binarytext: true } : {}),
        // bwip-js inserts no quiet zone; the sizes below add PassKit's.
      };
      // PDF417 and Aztec: the shape Core Image picks, filled by bwip-js (which pads the data and
      // fills the rest with error correction). If bwip-js can't fit its encoding into that shape,
      // it picks its own.
      let shape: Shape | undefined;
      const tries: Record<string, unknown>[] = [];
      if (bcid === 'pdf417') {
        const p = pdf417Shape(data);
        if (p) tries.push({ columns: p.columns, rows: p.rows, eclevel: p.eclevel, rowmult: 3 });
        tries.push({ columns: p?.columns ?? 3, eclevel: p?.eclevel ?? 2, rowmult: 3 });
      } else if (bcid === 'azteccode') {
        const a = aztecShape(data);
        if (a) tries.push({ format: a.compact ? 'compact' : 'full', layers: a.layers, eclevel: 5 });
        tries.push({});
      } else tries.push({});
      let svg = '';
      let error: unknown;
      for (const extra of tries) {
        try {
          svg = toSVG({ ...opts, ...extra, scale: 3 });
          break;
        } catch (e) {
          error = e;
        }
      }
      if (!svg) throw error;
      // Size in modules: bwip-js draws 2 × scale SVG units per module for QR and Aztec, and for
      // PDF417 scale units per module across and per row-height unit down (rows 3 units tall).
      const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)/.exec(svg);
      const units = vb ? parseFloat(vb[1]) : 0;
      const modules = units ? Math.round(units / (isSquare ? 6 : 3)) : undefined;
      if (bcid === 'pdf417' && vb) shape = { w: Math.round(units / 3), h: Math.round(parseFloat(vb[2]) / 3) };
      return {
        svg: isSquare ? svg.replace('<svg ', '<svg shape-rendering="crispEdges" ') : svg.replace('<svg ', '<svg preserveAspectRatio="none" '),
        modules,
        shape,
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message.replace(/^bwipp\.\w+#\d+:\s*/, '') : String(e) };
    }
  }, [lib, bcid, barcode.message, barcode.messageEncoding, barcode.format, isSquare]);

  const size = 'modules' in result && result.modules ? barcodeSize(bcid!, result.modules, pixelRatio, result.shape) : undefined;
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

/** A PDF417 symbol's size in modules (without quiet zone): w across, h down (3 per row). */
interface Shape {
  w: number;
  h: number;
}

/**
 * The image view's frame: the module size in points times the modules, rounded up to whole device
 * pixels. In floating point, (14 / 3) × 31 × 3 comes out a hair over 434, so PassKit's frame is
 * 435 px (145 pt) for a 434 px code image; the same arithmetic here reproduces it.
 */
const frame = (px: number, modules: number, ratio: number) => Math.ceil((px / ratio) * modules * ratio) / ratio;

/** Code and image (code + quiet zone) size in points, as PassKit sizes them. */
export function barcodeSize(bcid: string, modules: number, pixelRatio: number, shape?: Shape) {
  if (bcid === 'qrcode' || bcid === 'azteccode') {
    // Device pixels per module: the whole number nearest to a 141 pt (QR) or 164 pt (Aztec) image.
    const [target, quiet] = bcid === 'qrcode' ? [141, 1] : [164, 2];
    const px = Math.max(1, Math.round((target * pixelRatio) / (modules + 2 * quiet)));
    const code = (px * modules) / pixelRatio;
    const image = frame(px, modules + 2 * quiet, pixelRatio);
    return { codeW: code, codeH: code, imageW: image, imageH: image };
  }
  if (bcid === 'pdf417') {
    const { w, h } = shape ?? { w: 120, h: 33 };
    const [W, H] = [w + 4, h + 4];
    const [TW, TH] = [245 * pixelRatio, 64 * pixelRatio];
    const exact = TW / W;
    const whole = Math.round(exact);
    if (whole >= 1 && Math.abs(whole * W - TW) <= 0.05 * TW) {
      const sy = Math.max(1, whole >= exact ? Math.ceil(TH / H - 1e-9) : Math.floor(TH / H + 1e-9));
      return { codeW: (w * whole) / pixelRatio, codeH: (h * sy) / pixelRatio, imageW: frame(whole, W, pixelRatio), imageH: frame(sy, H, pixelRatio) };
    }
    return { codeW: (245 * w) / W, codeH: (64 * h) / H, imageW: 245, imageH: 64 };
  }
  return { codeW: (245 * modules) / (modules + 20), codeH: 39.33, imageW: 245, imageH: 64 };
}
