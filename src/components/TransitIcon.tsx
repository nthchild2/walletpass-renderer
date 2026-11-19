import type { TransitType } from '../pass/types';

const PATHS: Record<TransitType, string> = {
  PKTransitTypeAir:
    'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z',
  PKTransitTypeTrain:
    'M12 2c-4 0-8 .5-8 4v9.5A3.5 3.5 0 0 0 7.5 19L6 20.5v.5h2.2l2-2h3.6l2 2H18v-.5L16.5 19a3.5 3.5 0 0 0 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
  PKTransitTypeBus:
    'M4 16c0 .9.4 1.7 1 2.2V20a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.8c.6-.5 1-1.3 1-2.2V6c0-3.5-3.6-4-8-4s-8 .5-8 4v10zm3.5 1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm1.5-6H6V6h12v5z',
  PKTransitTypeBoat:
    'M20 21c-1.4 0-2.8-.5-4-1.3a7 7 0 0 1-8 0A7 7 0 0 1 4 21H2v2h2c1.4 0 2.7-.3 4-1a8.7 8.7 0 0 0 8 0c1.3.7 2.6 1 4 1h2v-2h-2zM3.9 19H4c1.6 0 3-.9 4-2 1 1.1 2.4 2 4 2s3-.9 4-2c1 1.1 2.4 2 4 2h.1l1.9-6.7c.1-.3 0-.6-.1-.8a.9.9 0 0 0-.6-.4L20 10.6V6a2 2 0 0 0-2-2h-3V1H9v3H6a2 2 0 0 0-2 2v4.6l-1.3.4a.9.9 0 0 0-.6.4c-.1.2-.2.5-.1.8L3.9 19zM6 6h12v4l-6-2-6 2V6z',
  PKTransitTypeGeneric: 'M4 11h12.2l-5.6-5.6L12 4l8 8-8 8-1.4-1.4 5.6-5.6H4z',
};

export function TransitIcon({ type, color }: { type?: TransitType; color: string }) {
  const d = PATHS[type ?? 'PKTransitTypeGeneric'] ?? PATHS.PKTransitTypeGeneric;
  return (
    <svg className="transit-icon" viewBox="0 0 24 24" width="30" height="30" aria-hidden>
      <path d={d} fill={color} transform={type === 'PKTransitTypeAir' ? 'rotate(90 12 12)' : undefined} />
    </svg>
  );
}
