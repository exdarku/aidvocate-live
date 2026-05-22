import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database.js';
import env from '../config/env.js';

interface CreateDonationInput {
  charityId: string;
  donorId: string;
  amount: number;
  purpose?: string;
  paymentMethod: 'GCASH' | 'PAYMAYA' | 'BANK';
}

interface FraudAnalysisResult {
  riskScore: number;
  confidenceScore: number;
  flags: string[];
  recommendedAction: 'APPROVE' | 'FLAG' | 'BLOCK' | 'REVIEW';
  velocityCount: number;
  accountAgeDays: number;
  mlAnomalyScore?: number;
}

class DonationService {
  /**
   * Create a new donation
   */
  async create(input: CreateDonationInput) {
    // Verify charity exists
    const charity = await prisma.charity.findUnique({
      where: { id: input.charityId },
    });

    if (!charity) {
      throw new Error('Charity not found');
    }

    // Generate unique reference
    const reference = this.generateReference();

    // Create donation record
    const donation = await prisma.donation.create({
      data: {
        reference,
        amount: input.amount,
        currency: 'PHP',
        purpose: input.purpose,
        status: 'PENDING',
        paymentMethod: input.paymentMethod,
        donorId: input.donorId,
        charityId: input.charityId,
      },
      include: {
        donor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        charity: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    });

    // Call fraud detection service (async, don't wait)
    this.analyzeFraud(donation.id, input.donorId).catch((err) => {
      console.error('Fraud analysis failed:', err);
    });

    // Generate mock payment URL
    const paymentUrl = this.generateMockPaymentUrl(reference, input.amount, input.paymentMethod);

    return {
      donation: {
        ...donation,
        amount: Number(donation.amount),
      },
      paymentUrl,
      reference,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
    };
  }

  /**
   * Get donation by ID
   */
  async getById(id: string, userId?: string) {
    const donation = await prisma.donation.findUnique({
      where: { id },
      include: {
        donor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        charity: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            walletAddress: true,
          },
        },
        blockchainRecord: true,
        fraudAnalysis: true,
      },
    });

    if (!donation) {
      throw new Error('Donation not found');
    }

    // Only allow donor or admin to see full details
    if (userId && donation.donorId !== userId) {
      // Return limited info for non-owners
      return {
        id: donation.id,
        reference: donation.reference,
        amount: Number(donation.amount),
        status: donation.status,
        charity: donation.charity,
        blockchainTxHash: donation.blockchainTxHash,
        createdAt: donation.createdAt,
      };
    }

    return {
      ...donation,
      amount: Number(donation.amount),
    };
  }

  /**
   * Get donation by reference (public verification)
   */
  async getByReference(reference: string) {
    const donation = await prisma.donation.findUnique({
      where: { reference },
      include: {
        charity: {
          select: {
            id: true,
            name: true,
            walletAddress: true,
          },
        },
        blockchainRecord: true,
      },
    });

    if (!donation) {
      throw new Error('Donation not found');
    }

    return {
      reference: donation.reference,
      amount: Number(donation.amount),
      currency: donation.currency,
      status: donation.status,
      charity: donation.charity,
      blockchainTxHash: donation.blockchainTxHash,
      blockchainRecord: donation.blockchainRecord,
      createdAt: donation.createdAt,
      paidAt: donation.paidAt,
    };
  }

  /**
   * Get user's donations
   */
  async getByUser(userId: string) {
    const donations = await prisma.donation.findMany({
      where: { donorId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        charity: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
        blockchainRecord: {
          select: {
            txHash: true,
            blockNumber: true,
          },
        },
      },
    });

    return donations.map((d) => ({
      ...d,
      amount: Number(d.amount),
    }));
  }

  /**
   * Process payment webhook (mock)
   */
  async processPaymentWebhook(reference: string, paymentTxId: string) {
    const donation = await prisma.donation.findUnique({
      where: { reference },
    });

    if (!donation) {
      throw new Error('Donation not found');
    }

    if (donation.status !== 'PENDING' && donation.status !== 'PAYMENT_INITIATED') {
      throw new Error('Invalid donation status');
    }

    // Update donation status
    const updated = await prisma.donation.update({
      where: { reference },
      data: {
        status: 'PAYMENT_CONFIRMED',
        paymentTxId,
        paidAt: new Date(),
      },
      include: {
        charity: true,
      },
    });

    // Update charity total raised
    await prisma.charity.update({
      where: { id: donation.charityId },
      data: {
        totalRaised: {
          increment: donation.amount,
        },
      },
    });

    // Queue blockchain recording (would be async in production)
    // this.recordOnBlockchain(donation.id);

    return {
      ...updated,
      amount: Number(updated.amount),
    };
  }

  /**
   * Analyze fraud for a donation
   */
  private async analyzeFraud(donationId: string, donorId: string): Promise<void> {
    try {
      // Get donor history
      const donor = await prisma.user.findUnique({
        where: { id: donorId },
        include: {
          donations: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      });

      if (!donor) return;

      // Calculate basic metrics
      const accountAgeDays = Math.floor(
        (Date.now() - donor.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Count donations in last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const velocityCount = donor.donations.filter(
        (d) => d.createdAt > oneHourAgo
      ).length;

      // Simple rule-based fraud detection (would call Python service in production)
      let riskScore = 0;
      const flags: string[] = [];

      // New account with large donation
      if (accountAgeDays < 7) {
        riskScore += 0.2;
        flags.push('NEW_ACCOUNT');
      }

      // High velocity
      if (velocityCount > 5) {
        riskScore += 0.3;
        flags.push('HIGH_VELOCITY');
      }

      // Determine action
      let recommendedAction: 'APPROVE' | 'FLAG' | 'BLOCK' | 'REVIEW' = 'APPROVE';
      if (riskScore >= 0.7) {
        recommendedAction = 'BLOCK';
      } else if (riskScore >= 0.4) {
        recommendedAction = 'REVIEW';
      } else if (riskScore >= 0.2) {
        recommendedAction = 'FLAG';
      }

      // Calculate confidence score (inverse of risk)
      const confidenceScore = 1 - riskScore;

      // Store analysis
      await prisma.fraudAnalysis.create({
        data: {
          donationId,
          riskScore,
          confidenceScore,
          flags,
          recommendedAction,
          velocityCount,
          accountAgeDays,
          verificationLevel: riskScore > 0.3 ? 'ENHANCED' : 'STANDARD',
        },
      });

      // Update donation with scores
      await prisma.donation.update({
        where: { id: donationId },
        data: {
          riskScore,
          confidenceScore,
          riskFlags: flags,
        },
      });
    } catch (error) {
      console.error('Fraud analysis error:', error);
    }
  }

  /**
   * Generate unique reference number
   */
  private generateReference(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `REF-${dateStr}-${random}`;
  }

  /**
   * Generate mock payment URL
   */
  private generateMockPaymentUrl(
    reference: string,
    amount: number,
    method: string
  ): string {
    // In production, this would call the actual payment gateway
    const baseUrl = env.PAYMENT_GATEWAY_URL || `http://localhost:${env.PORT}/api/mock-payment`;
    return `${baseUrl}/pay?ref=${reference}&amount=${amount}&method=${method}`;
  }
}

export const donationService = new DonationService();
export default donationService;
