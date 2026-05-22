import { prisma } from '../config/database';

export const adminService = {
  async getDashboardStats() {
    const [
      totalDonations,
      totalDonors,
      verifiedCharities,
      todayTransactions,
      pendingReview,
      approvedTransactions,
      flaggedTransactions,
    ] = await Promise.all([
      // Total donation amount
      prisma.donation.aggregate({
        _sum: { amount: true },
        where: { status: 'COMPLETED' },
      }),
      // Total unique donors
      prisma.user.count({
        where: { role: 'DONOR' },
      }),
      // Verified charities
      prisma.charity.count({
        where: { verified: true },
      }),
      // Today's transactions
      prisma.donation.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      // Pending review (flagged by fraud detection)
      prisma.donation.count({
        where: {
          OR: [
            { status: 'PENDING' },
            {
              AND: [
                { riskScore: { gte: 0.4 } },
                { status: { not: 'COMPLETED' } },
              ],
            },
          ],
        },
      }),
      // Approved (completed) transactions
      prisma.donation.count({
        where: { status: 'COMPLETED' },
      }),
      // Flagged transactions (high risk)
      prisma.donation.count({
        where: { riskScore: { gte: 0.7 } },
      }),
    ]);

    return {
      totalDonations: Number(totalDonations._sum.amount) || 0,
      totalDonors,
      verifiedCharities,
      todayTransactions,
      pendingReview,
      approvedTransactions,
      flaggedTransactions,
    };
  },

  async getAllDonations(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [donations, total] = await Promise.all([
      prisma.donation.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
            },
          },
        },
      }),
      prisma.donation.count(),
    ]);

    return {
      data: donations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getAllUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          kycVerified: true,
          createdAt: true,
          _count: {
            select: {
              donations: true,
            },
          },
        },
      }),
      prisma.user.count(),
    ]);

    return {
      data: users.map((user) => ({
        ...user,
        donationCount: user._count.donations,
        _count: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async verifyCharity(charityId: string) {
    return prisma.charity.update({
      where: { id: charityId },
      data: { verified: true },
    });
  },

  async getAllCharities(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [charities, total] = await Promise.all([
      prisma.charity.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              donations: true,
              events: true,
            },
          },
        },
      }),
      prisma.charity.count(),
    ]);

    return {
      data: charities.map((charity) => ({
        ...charity,
        donationCount: charity._count.donations,
        eventCount: charity._count.events,
        _count: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};
