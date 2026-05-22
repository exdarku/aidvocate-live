import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';

interface CharityFilters {
  category?: string;
  search?: string;
  verified?: boolean;
  sortBy?: 'recent' | 'popular' | 'raised';
}

interface CreateCharityInput {
  name: string;
  description: string;
  shortDescription?: string;
  imageUrl?: string;
  categories: string[];
  walletAddress?: string;
  bankAccount?: string;
  gcashNumber?: string;
  managerId?: string;
}

class CharityService {
  /**
   * Get all charities with filters
   */
  async getAll(filters: CharityFilters, userId?: string) {
    const where: Prisma.CharityWhereInput = {};

    if (filters.category) {
      where.categories = { has: filters.category };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.verified !== undefined) {
      where.verified = filters.verified;
    }

    let orderBy: Prisma.CharityOrderByWithRelationInput = { createdAt: 'desc' };
    if (filters.sortBy === 'popular') {
      orderBy = { totalVolunteers: 'desc' };
    } else if (filters.sortBy === 'raised') {
      orderBy = { totalRaised: 'desc' };
    }

    const charities = await prisma.charity.findMany({
      where,
      orderBy,
      include: {
        _count: {
          select: { likes: true, donations: true },
        },
        likes: userId
          ? {
              where: { userId },
              select: { id: true },
            }
          : false,
      },
    });

    return charities.map((charity) => ({
      ...charity,
      totalLikes: charity._count.likes,
      isLiked: userId ? charity.likes.length > 0 : false,
      totalRaised: Number(charity.totalRaised),
      _count: undefined,
      likes: undefined,
    }));
  }

  /**
   * Get charity by ID
   */
  async getById(id: string, userId?: string) {
    const charity = await prisma.charity.findUnique({
      where: { id },
      include: {
        _count: {
          select: { likes: true, donations: true, events: true },
        },
        likes: userId
          ? {
              where: { userId },
              select: { id: true },
            }
          : false,
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!charity) {
      throw new Error('Charity not found');
    }

    return {
      ...charity,
      totalLikes: charity._count.likes,
      totalDonations: charity._count.donations,
      totalEvents: charity._count.events,
      isLiked: userId ? charity.likes.length > 0 : false,
      totalRaised: Number(charity.totalRaised),
      _count: undefined,
      likes: undefined,
    };
  }

  /**
   * Create a new charity
   */
  async create(input: CreateCharityInput) {
    const charity = await prisma.charity.create({
      data: {
        name: input.name,
        description: input.description,
        shortDescription: input.shortDescription,
        imageUrl: input.imageUrl,
        categories: input.categories,
        walletAddress: input.walletAddress,
        bankAccount: input.bankAccount,
        gcashNumber: input.gcashNumber,
        managerId: input.managerId,
      },
    });

    return {
      ...charity,
      totalRaised: Number(charity.totalRaised),
    };
  }

  /**
   * Update a charity
   */
  async update(id: string, data: Partial<CreateCharityInput>) {
    const charity = await prisma.charity.update({
      where: { id },
      data,
    });

    return {
      ...charity,
      totalRaised: Number(charity.totalRaised),
    };
  }

  /**
   * Delete a charity
   */
  async delete(id: string) {
    await prisma.charity.delete({
      where: { id },
    });
  }

  /**
   * Like a charity
   */
  async like(charityId: string, userId: string) {
    const existingLike = await prisma.charityLike.findUnique({
      where: {
        userId_charityId: {
          userId,
          charityId,
        },
      },
    });

    if (existingLike) {
      throw new Error('Already liked');
    }

    await prisma.charityLike.create({
      data: {
        userId,
        charityId,
      },
    });
  }

  /**
   * Unlike a charity
   */
  async unlike(charityId: string, userId: string) {
    await prisma.charityLike.delete({
      where: {
        userId_charityId: {
          userId,
          charityId,
        },
      },
    });
  }

  /**
   * Verify a charity (admin only)
   */
  async verify(id: string) {
    const charity = await prisma.charity.update({
      where: { id },
      data: { verified: true },
    });

    return {
      ...charity,
      totalRaised: Number(charity.totalRaised),
    };
  }

  /**
   * Get unique categories
   */
  async getCategories() {
    const charities = await prisma.charity.findMany({
      select: { categories: true },
    });

    const categories = new Set<string>();
    charities.forEach((charity) => {
      charity.categories.forEach((cat) => categories.add(cat));
    });

    return Array.from(categories).sort();
  }
}

export const charityService = new CharityService();
export default charityService;
