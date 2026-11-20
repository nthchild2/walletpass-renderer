/**
 * Preview widths. On iPhone a classic pass is the screen width minus 32 pt (16 pt each side) and
 * always 503 pt tall; nothing inside scales. Measured: 343 pt in Apple's renders (375 pt screen)
 * and 370 pt in a real iPhone 17 screenshot (402 pt screen).
 */
export interface Device {
  id: string;
  label: string;
  screen: number;
}

export const DEVICES: Device[] = [
  { id: '375', label: 'iPhone SE · 13 mini', screen: 375 },
  { id: '390', label: 'iPhone 16e', screen: 390 },
  { id: '393', label: 'iPhone 16 · 15', screen: 393 },
  { id: '402', label: 'iPhone 17 · 17 Pro', screen: 402 },
  { id: '420', label: 'iPhone Air', screen: 420 },
  { id: '430', label: 'iPhone 16 Plus', screen: 430 },
  { id: '440', label: 'iPhone 17 Pro Max', screen: 440 },
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
