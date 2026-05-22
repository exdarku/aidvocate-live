import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button, CloseIcon } from '@/components/ui';
import './qrScanner.css';

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the decoded text (URL or bare reference). */
  onDecode: (decodedText: string) => void;
}

type Mode = 'camera' | 'upload';

const SCAN_ELEMENT_ID = 'aidvocate-qr-scan-region';

export default function QRScanner({ isOpen, onClose, onDecode }: QRScannerProps) {
  const [mode, setMode] = useState<Mode>('camera');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch {
        /* nothing useful to do — element may already be gone */
      }
      scannerRef.current = null;
    }
  }, []);

  const handleDecodeAndClose = useCallback(
    (decoded: string) => {
      onDecode(decoded);
      onClose();
    },
    [onDecode, onClose]
  );

  // Start camera when modal opens in camera mode
  useEffect(() => {
    if (!isOpen || mode !== 'camera') return;

    let cancelled = false;
    setError(null);

    const start = async () => {
      try {
        const instance = new Html5Qrcode(SCAN_ELEMENT_ID, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = instance;

        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (cancelled) return;
            handleDecodeAndClose(decoded);
          },
          () => {
            /* per-frame failures are normal while user lines up the QR */
          }
        );
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Could not access the camera.';
        setError(message);
      }
    };
    start();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, mode, handleDecodeAndClose, stopCamera]);

  // Clean up when modal closes
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setError(null);
    }
  }, [isOpen, stopCamera]);

  const handleUpload = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      // Use a separate, throwaway scanner instance for file decoding.
      const fileScanner = new Html5Qrcode(SCAN_ELEMENT_ID, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      const decoded = await fileScanner.scanFile(file, true);
      handleDecodeAndClose(decoded);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not read a QR code from that image.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="qr-scanner-overlay" onClick={onClose}>
      <div
        className="qr-scanner"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Scan QR code"
      >
        <div className="qr-scanner__header">
          <h2>Scan receipt QR</h2>
          <button
            type="button"
            className="qr-scanner__close"
            onClick={onClose}
            aria-label="Close scanner"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="qr-scanner__tabs" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'camera'}
            className={`qr-scanner__tab ${mode === 'camera' ? 'is-active' : ''}`}
            onClick={() => setMode('camera')}
          >
            Camera
          </button>
          <button
            role="tab"
            aria-selected={mode === 'upload'}
            className={`qr-scanner__tab ${mode === 'upload' ? 'is-active' : ''}`}
            onClick={() => setMode('upload')}
          >
            Upload image
          </button>
        </div>

        <div className="qr-scanner__body">
          {/* The scanner library injects its video / canvas into this element.
              We render it in both modes so a single ref works for both flows. */}
          <div id={SCAN_ELEMENT_ID} className="qr-scanner__region" />

          {mode === 'camera' && (
            <p className="qr-scanner__hint">
              Allow camera access, then point your camera at a receipt QR.
            </p>
          )}

          {mode === 'upload' && (
            <div className="qr-scanner__upload">
              <input
                type="file"
                accept="image/*"
                id="qr-upload-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
                style={{ display: 'none' }}
              />
              <label htmlFor="qr-upload-input" className="qr-scanner__upload-label">
                {busy ? 'Reading…' : 'Choose an image file'}
              </label>
              <p className="qr-scanner__hint">PNG, JPG, or any image containing a QR code.</p>
            </div>
          )}

          {error && <div className="qr-scanner__error">{error}</div>}
        </div>

        <div className="qr-scanner__footer">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
