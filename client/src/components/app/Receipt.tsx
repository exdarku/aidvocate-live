import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, QRDisplay } from '@/components/ui';
import { downloadReceipt } from '@/utils/downloadReceipt';
import { buildReceiptUrl } from '@/utils/receiptUrl';
import type { PublicReceipt } from '@/services/api';
import './receipt.css';

interface ReceiptProps {
  receipt: PublicReceipt;
  /** Compact mode renders without the outer card/shadow — useful inside other cards. */
  compact?: boolean;
}

const PHP = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
});

const DATE_FMT = new Intl.DateTimeFormat('en-PH', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied`),
    () => toast.error('Copy failed')
  );
}

/* Wait one paint frame so the DOM reflects state changes before html2canvas
   walks the tree. Without this, expanding the proof and capturing in the
   same tick would still capture the collapsed version. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export function Receipt({ receipt, compact = false }: ReceiptProps) {
  const [proofOpen, setProofOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const docRef = useRef<HTMLElement>(null);
  const recipient = receipt.organizationName || receipt.ngoName;
  const date = DATE_FMT.format(new Date(receipt.createdAt));
  const status = receipt.batchId ? `Batched (#${receipt.batchId})` : 'Pending batch';
  const qrValue = buildReceiptUrl(receipt.paymentReference);

  const handleDownload = async () => {
    if (!docRef.current) return;
    setDownloading(true);
    const wasOpen = proofOpen;
    try {
      // Always expand the crypto proof for the PDF — paper can't toggle.
      if (!wasOpen) setProofOpen(true);
      await nextFrame();
      await nextFrame(); // second frame for the layout to settle
      await downloadReceipt(docRef.current, receipt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not generate PDF';
      toast.error(msg);
    } finally {
      // Restore the previous open state.
      if (!wasOpen) setProofOpen(false);
      setDownloading(false);
    }
  };

  return (
    <article
      ref={docRef}
      className={`receipt-doc ${compact ? 'receipt-doc--compact' : ''} ${
        downloading ? 'receipt-doc--capturing' : ''
      }`}
    >
      <div className="receipt-doc__qr" title="Scan to look up this receipt">
        <QRDisplay value={qrValue} size={140} ariaLabel="Receipt QR code" />
      </div>

      <header className="receipt-doc__header">
        <p className="receipt-doc__logo">AIDVOCATE</p>
        <p className="receipt-doc__tagline">Donation receipt</p>
      </header>

      <section className="receipt-doc__amount-block">
        <p className="receipt-doc__amount">{PHP.format(receipt.amount)}</p>
        <p className="receipt-doc__lead">
          Donation to <strong>{recipient}</strong>
        </p>
        <p className="receipt-doc__date">{date}</p>
      </section>

      <hr className="receipt-doc__divider" />

      <dl className="receipt-doc__meta">
        <div className="receipt-doc__meta-row">
          <dt>Status</dt>
          <dd>{status}</dd>
        </div>
        {receipt.eventName && (
          <div className="receipt-doc__meta-row">
            <dt>Event</dt>
            <dd>{receipt.eventName}</dd>
          </div>
        )}
        <div className="receipt-doc__meta-row">
          <dt>Reference</dt>
          <dd className="receipt-doc__mono receipt-doc__copyable">
            <span>{receipt.paymentReference}</span>
            <button
              type="button"
              className="receipt-doc__copy receipt-doc__no-capture"
              onClick={() => copy(receipt.paymentReference, 'Reference')}
              aria-label="Copy reference"
            >
              Copy
            </button>
          </dd>
        </div>
      </dl>

      <hr className="receipt-doc__divider" />

      <section className="receipt-doc__proof">
        <button
          type="button"
          className="receipt-doc__proof-toggle receipt-doc__no-capture"
          onClick={() => setProofOpen((v) => !v)}
          aria-expanded={proofOpen}
        >
          <span>Cryptographic proof</span>
          <span className="receipt-doc__chevron" aria-hidden>
            {proofOpen ? '▾' : '▸'}
          </span>
        </button>
        {proofOpen && (
          <div className="receipt-doc__proof-body">
            <div className="receipt-doc__proof-row">
              <p className="receipt-doc__proof-label">Commitment (public)</p>
              <p className="receipt-doc__mono receipt-doc__proof-value">{receipt.commitment}</p>
              <button
                type="button"
                className="receipt-doc__copy receipt-doc__no-capture"
                onClick={() => copy(receipt.commitment, 'Commitment')}
              >
                Copy
              </button>
            </div>
            <div className="receipt-doc__proof-row">
              <p className="receipt-doc__proof-label">Salt (keep private)</p>
              <p className="receipt-doc__mono receipt-doc__proof-value">{receipt.salt}</p>
              <button
                type="button"
                className="receipt-doc__copy receipt-doc__no-capture"
                onClick={() => copy(receipt.salt, 'Salt')}
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="receipt-doc__actions receipt-doc__no-capture">
        <Button variant="primary" onClick={handleDownload} isLoading={downloading}>
          Download PDF
        </Button>
      </div>
    </article>
  );
}
