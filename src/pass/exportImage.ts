import { toSvg } from 'html-to-image';

export type ImageFormat = 'png' | 'svg';

/** The pass is drawn at Wallet's size in points; PNGs are rendered at @3x like a modern iPhone. */
const PASS_WIDTH = 343;
const PASS_HEIGHT = 503;
const PNG_SCALE = 3;

/**
 * Exports one side of the rendered pass as an image file.
 * - PNG: 1029×1509 px (@3x), transparent outside the card's corners, notch and perforation.
 * - SVG: the pass's own markup wrapped in an SVG (foreignObject). It stays sharp at any size in
 *   browsers, but design tools that don't render foreignObject (e.g. Figma import) will show it blank.
 */
export async function exportPassImage(el: HTMLElement, format: ImageFormat, fileName: string): Promise<void> {
  const options = {
    width: PASS_WIDTH,
    height: PASS_HEIGHT,
    // The pass uses system fonts (SF Pro / SF Mono), so there are no web fonts to embed.
    skipFonts: true,
    // Undo any on-screen scaling or flip transform; render the card as-is.
    style: { transform: 'none', margin: '0', zoom: '1' },
  };
  const svg = await toSvg(el, options);
  const dataUrl = format === 'png' ? await svgToPng(svg) : svg;

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${fileName}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Rasterizes the SVG ourselves rather than with html-to-image's toPng, which waits on
 * requestAnimationFrame and stalls in background tabs.
 */
async function svgToPng(svgDataUrl: string): Promise<string> {
  const img = new Image();
  img.src = svgDataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('the rendered pass could not be loaded as an image'));
  });
  const canvas = document.createElement('canvas');
  canvas.width = PASS_WIDTH * PNG_SCALE;
  canvas.height = PASS_HEIGHT * PNG_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas is not available');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

/** A safe file name from the pass's serial number or description. */
export function passFileName(base: unknown, side: 'front' | 'back'): string {
  const stem = String(base ?? 'pass')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${stem || 'pass'}-${side}`;
}
