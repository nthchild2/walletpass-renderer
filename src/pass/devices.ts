/**
 * Preview widths. A classic pass is the screen width minus 32 pt (16 pt margins) and always 503 pt
 * tall; fonts, slots and barcode boxes don't scale.
 *
 * Measured with the same signed pass in Apple's own Add Pass sheet (PKAddPassesViewController) in
 * the iOS 27 Simulator, at exact screenshot scale:
 *   - iPhone SE (375 pt screen): card 343.0 × 503.0 pt, margins 16.0 pt
 *   - iPhone 17 (402 pt screen): card 370.0 × 503.0 pt, margins 16.0 pt
 * plus a real iPhone 17 screenshot (≈370 × 503 pt). The other sizes apply the same rule.
 */
export interface Device {
  id: string;
  label: string;
  screen: number;
  /** Device pixels per point; Wallet snaps QR / Aztec modules to whole device pixels. */
  scale: number;
}

export const DEVICES: Device[] = [
  { id: '375', label: 'iPhone SE (measured)', screen: 375, scale: 2 },
  { id: '375m', label: 'iPhone 13 mini', screen: 375, scale: 3 },
  { id: '390', label: 'iPhone 16e', screen: 390, scale: 3 },
  { id: '393', label: 'iPhone 16 · 15', screen: 393, scale: 3 },
  { id: '402', label: 'iPhone 17 · 17 Pro (measured)', screen: 402, scale: 3 },
  { id: '420', label: 'iPhone Air', screen: 420, scale: 3 },
  { id: '430', label: 'iPhone 16 Plus', screen: 430, scale: 3 },
  { id: '440', label: 'iPhone 17 Pro Max', screen: 440, scale: 3 },
];

export const DEFAULT_DEVICE = '402';
export const passWidth = (d: Device) => d.screen - 32;

const KEY = 'pass-renderer:device';

export function getDeviceId(): string {
  try {
    const v = localStorage.getItem(KEY);
    if (v && DEVICES.some((d) => d.id === v)) return v;
  } catch {
    /* storage blocked */
  }
  return DEFAULT_DEVICE;
}

export function saveDeviceId(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* not remembered */
  }
}
