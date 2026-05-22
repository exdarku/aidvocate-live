import { prisma } from '../config/database';
import type { Event, Prisma } from '@prisma/client';

interface EventFilters {
  charityId?: string;
  upcoming?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export const eventService = {
  async findAll(filters: EventFilters = {}, userId?: string) {
    const { charityId, upcoming, search, page = 1, limit = 12 } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.EventWhereInput = {};

    if (charityId) {
      where.charityId = charityId;
    }

    if (upcoming !== undefined) {
      if (upcoming) {
        where.startDate = { gte: new Date() };
      } else {
        where.endDate = { lt: new Date() };
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: 'asc' },
        include: {
          charity: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
          _count: {
            select: {
              participants: true,
              likes: true,
            },
          },
          ...(userId
            ? {
                likes: {
                  where: { userId },
                  select: { id: true },
                },
                participants: {
                  where: { userId },
                  select: { id: true },
                },
              }
            : {}),
        },
      }),
      prisma.event.count({ where }),
    ]);

    return {
      data: events.map((event) => ({
        ...event,
        participantCount: event._count.participants,
        totalLikes: event._count.likes,
        isLiked: userId ? event.likes?.length > 0 : false,
        isJoined: userId ? event.participants?.length > 0 : false,
        likes: undefined,
        participants: undefined,
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

  async findById(id: string, userId?: string) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        charity: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            description: true,
          },
        },
        _count: {
          select: {
            participants: true,
            likes: true,
          },
        },
        ...(userId
          ? {
              likes: {
                where: { userId },
                select: { id: true },
              },
              participants: {
                where: { userId },
                select: { id: true },
              },
            }
          : {}),
      },
    });

    if (!event) return null;

    return {
      ...event,
      participantCount: event._count.participants,
      totalLikes: event._count.likes,
      isLiked: userId ? event.likes?.length > 0 : false,
      isJoined: userId ? event.participants?.length > 0 : false,
      likes: undefined,
      participants: undefined,
      _count: undefined,
    };
  },

  async create(data: Prisma.EventCreateInput) {
    return prisma.event.create({
      data,
      include: {
        charity: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  },

  async update(id: string, data: Prisma.EventUpdateInput) {
    return prisma.event.update({
      where: { id },
      data,
      include: {
        charity: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  },

  async delete(id: string) {
    return prisma.event.delete({
      where: { id },
    });
  },

  async join(eventId: string, userId: string) {
    // Check if event exists and has capacity
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        _count: {
          select: { participants: true },
        },
      },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    if (event.endDate < new Date()) {
      throw new Error('Event has already ended');
    }

    if (event.maxParticipants && event._count.participants >= event.maxParticipants) {
      throw new Error('Event is at full capacity');
    }

    // Check if already joined
    const existing = await prisma.eventParticipant.findUnique({
      where: {
        userId_eventId: { userId, eventId },
      },
    });

    if (existing) {
      throw new Error('Already joined this event');
    }

    return prisma.eventParticipant.create({
      data: {
        userId,
        eventId,
      },
    });
  },

  async leave(eventId: string, userId: string) {
    return prisma.eventParticipant.delete({
      where: {
        userId_eventId: { userId, eventId },
      },
    });
  },

  async like(eventId: string, userId: string) {
    const existing = await prisma.eventLike.findUnique({
      where: {
        userId_eventId: { userId, eventId },
      },
    });

    if (existing) {
      throw new Error('Already liked this event');
    }

    return prisma.eventLike.create({
      data: {
        userId,
        eventId,
      },
    });
  },

  async unlike(eventId: string, userId: string) {
    return prisma.eventLike.delete({
      where: {
        userId_eventId: { userId, eventId },
      },
    });
  },
};
