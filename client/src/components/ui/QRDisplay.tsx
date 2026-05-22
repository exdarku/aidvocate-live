import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRDisplayProps {
  value: string;
  size?: number;
  className?: string;
  ariaLabel?: string;
}

/**
 * Renders a QR code into a <canvas>. Pure visual component — the value to
 * encode is the caller's responsibility (use `buildReceiptUrl` for receipts).
 */
export function QRDisplay({ value, size = 200, className, ariaLabel }: QRDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      color: { dark: '#1C1D28', light: '#FEFFF6' },
      errorCorrectionLevel: 'M',
    }).catch(() => {
      /* swallow — the canvas just won't render */
    });
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label={ariaLabel ?? `QR code for ${value}`}
    />
  );
}
