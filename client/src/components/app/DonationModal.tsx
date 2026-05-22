import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  donationApi,
  type Organization,
  type EventItem,
  getToken,
} from '@/services/api';
import './donationModal.css';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization: Organization;
  event?: EventItem | null;
}

const QUICK_AMOUNTS = [100, 250, 500, 1000];

export default function DonationModal({ isOpen, onClose, organization, event = null }: DonationModalProps) {
  const navigate = useNavigate();
  const isAuthed = !!getToken();

  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; content: string } | null>(null);

  // Guest fields
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestContact, setGuestContact] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setMessage({ type: 'error', content: 'Please enter a valid amount.' });
      return;
    }
    if (!isAuthed && !isAnonymous && (!guestName.trim() || !guestEmail.trim())) {
      setMessage({
        type: 'error',
        content: 'Please enter your name and email — or check Anonymous.',
      });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const description = event
        ? `Aidvocate - Donation for ${event.name} by ${organization.name}`
        : `Aidvocate - Donation for ${organization.name}`;
      const result = await donationApi.create({
        organizationId: organization.id,
        eventId: event?.id,
        amount: amt,
        description,
        ...(!isAuthed && {
          guestName: isAnonymous ? undefined : guestName.trim(),
          guestEmail: isAnonymous ? undefined : guestEmail.trim(),
          guestContact: isAnonymous ? undefined : guestContact.trim() || undefined,
          isAnonymous,
        }),
      });
      setMessage({
        type: 'success',
        content: `Donation recorded. Commitment: ${result.commitment.slice(0, 12)}…`,
      });
      setTimeout(() => {
        onClose();
        navigate({ to: '/payment-success', search: { ref: result.paymentReference } });
      }, 1200);
    } catch (err) {
      const m = err instanceof Error ? err.message : 'Failed to process donation';
      setMessage({ type: 'error', content: m });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="donation-modal-overlay" onClick={onClose}>
      <div className="donation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Make a Donation</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-content">
          <div className="donation-target">
            <h3>{organization.name}</h3>
            {event && <p>Event: {event.name}</p>}
          </div>

          {!isAuthed && (
            <div className="guest-banner">
              <span>Donating as guest.</span>{' '}
              <button
                type="button"
                className="guest-banner__link"
                onClick={() => navigate({ to: '/login' })}
              >
                Log in
              </button>{' '}
              to track your donations.
            </div>
          )}

          {message && <div className={`message ${message.type}`}>{message.content}</div>}

          <form onSubmit={handleSubmit}>
            <div className="amount-section">
              <label htmlFor="donation-amount">Donation Amount (PHP)</label>
              <input
                type="number"
                id="donation-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                min="1"
                step="0.01"
                required
              />
              <div className="quick-amounts">
                {QUICK_AMOUNTS.map((v) => (
                  <button key={v} type="button" onClick={() => setAmount(String(v))}>
                    ₱{v}
                  </button>
                ))}
              </div>
            </div>

            {!isAuthed && (
              <div className="guest-fields">
                <label className="anonymous-toggle">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                  />
                  <span>Donate anonymously</span>
                </label>
                <p className="guest-fields__hint">
                  {isAnonymous
                    ? 'Your details will not be stored. Save the salt below to verify later.'
                    : 'Your name will appear on the public leaderboard.'}
                </p>

                {!isAnonymous && (
                  <>
                    <div className="form-row">
                      <label htmlFor="guest-name">Name</label>
                      <input
                        id="guest-name"
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Juan dela Cruz"
                        required
                      />
                    </div>
                    <div className="form-row">
                      <label htmlFor="guest-email">Email</label>
                      <input
                        id="guest-email"
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                    <div className="form-row">
                      <label htmlFor="guest-contact">Contact number (optional)</label>
                      <input
                        id="guest-contact"
                        type="tel"
                        value={guestContact}
                        onChange={(e) => setGuestContact(e.target.value)}
                        placeholder="09171234567"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="payment-methods">
              <h4>Privacy-preserving commitment:</h4>
              <div className="payment-options">
                <span className="payment-method">Poseidon hash</span>
                <span className="payment-method">Merkle batched</span>
                <span className="payment-method">ZK-provable</span>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" onClick={onClose} className="cancel-btn">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="donate-btn">
                {submitting ? 'Processing…' : 'Donate Now'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
