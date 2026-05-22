/**
 * Build the canonical lookup URL for a receipt. Used both as the QR payload
 * and as the link shown on the printed PDF. Uses the runtime origin so QRs
 * generated in dev resolve to localhost, and prod QRs resolve to the deployed
 * host without configuration.
 */
export function buildReceiptUrl(paymentReference: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/receipt?ref=${encodeURIComponent(paymentReference)}`;
}

/**
 * Try to extract a payment reference from a string that might be either:
 *  - A bare reference: `95f4e478f6015339d6ccdeee9dea4e1f`
 *  - A full receipt URL: `https://host/receipt?ref=...`
 * Returns null if nothing reference-shaped is found.
 */
export function parseReferenceFromScan(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // URL form
  try {
    const url = new URL(trimmed);
    const ref = url.searchParams.get('ref');
    if (ref) return ref;
  } catch {
    // not a URL — fall through
  }

  // Bare hex reference (32 chars from the new format, but accept 6+ for backwards compat)
  if (/^[a-zA-Z0-9_-]{6,}$/.test(trimmed)) return trimmed;

  return null;
}
