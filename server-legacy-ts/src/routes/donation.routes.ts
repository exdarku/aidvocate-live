import { Router, Request, Response } from 'express';
import { donationService } from '../services/donation.service.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody, schemas } from '../middleware/validation.js';

const router = Router();

/**
 * POST /api/donations
 * Create a new donation
 */
router.post(
  '/',
  authenticate,
  validateBody(schemas.createDonation),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await donationService.create({
        ...req.body,
        donorId: req.user!.userId,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create donation';
      res.status(400).json({
        success: false,
        error: message,
      });
    }
  }
);

/**
 * GET /api/donations/my
 * Get current user's donations
 */
router.get('/my', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const donations = await donationService.getByUser(req.user!.userId);
    res.json({
      success: true,
      data: donations,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch donations';
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /api/donations/verify/:reference
 * Public verification endpoint
 */
router.get('/verify/:reference', async (req: Request, res: Response): Promise<void> => {
  try {
    const donation = await donationService.getByReference(req.params.reference);

    res.json({
      success: true,
      data: {
        verified: donation.status !== 'PENDING' && donation.status !== 'FAILED',
        donation: {
          reference: donation.reference,
          amount: donation.amount,
          charityName: donation.charity.name,
          status: donation.status,
          timestamp: donation.createdAt,
          txHash: donation.blockchainTxHash,
          blockNumber: donation.blockchainRecord?.blockNumber,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Donation not found';
    res.status(404).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /api/donations/:id
 * Get donation by ID
 */
router.get('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const donation = await donationService.getById(req.params.id, req.user?.userId);
    res.json({
      success: true,
      data: donation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch donation';
    res.status(404).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /api/donations/webhook
 * Payment webhook endpoint (mock)
 */
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const { reference, transactionId, status } = req.body;

    if (status === 'PAID') {
      await donationService.processPaymentWebhook(reference, transactionId);
    }

    res.json({
      success: true,
      received: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    console.error('Webhook error:', message);
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

export default router;
