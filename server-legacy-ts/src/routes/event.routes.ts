import { Router, Request, Response } from 'express';
import { eventService } from '../services/event.service';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/events - List all events with filters
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { charityId, upcoming, search, page, limit } = req.query;

    const filters = {
      charityId: charityId as string | undefined,
      upcoming: upcoming !== undefined ? upcoming === 'true' : undefined,
      search: search as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    };

    const userId = req.user?.id;
    const result = await eventService.findAll(filters, userId);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch events',
    });
  }
});

// GET /api/events/:id - Get event by ID
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const event = await eventService.findById(id, userId);

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
      });
    }

    res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch event',
    });
  }
});

// POST /api/events - Create event (Admin/NGO only)
router.post('/', authenticate, requireRole('ADMIN', 'NGO'), async (req: Request, res: Response) => {
  try {
    const { name, description, imageUrl, location, startDate, endDate, maxParticipants, charityId } = req.body;

    if (!name || !description || !location || !startDate || !endDate || !charityId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const event = await eventService.create({
      name,
      description,
      imageUrl,
      location,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
      charity: {
        connect: { id: charityId },
      },
    });

    res.status(201).json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create event',
    });
  }
});

// PUT /api/events/:id - Update event (Admin/NGO only)
router.put('/:id', authenticate, requireRole('ADMIN', 'NGO'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, imageUrl, location, startDate, endDate, maxParticipants } = req.body;

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (location) updateData.location = location;
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (maxParticipants !== undefined) updateData.maxParticipants = maxParticipants ? parseInt(maxParticipants) : null;

    const event = await eventService.update(id, updateData);

    res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update event',
    });
  }
});

// DELETE /api/events/:id - Delete event (Admin only)
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await eventService.delete(id);

    res.json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete event',
    });
  }
});

// POST /api/events/:id/join - Join event
router.post('/:id/join', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    await eventService.join(id, userId);

    res.json({
      success: true,
      message: 'Successfully joined event',
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Join event error:', error);

    if (err.message === 'Event not found') {
      return res.status(404).json({
        success: false,
        error: err.message,
      });
    }

    if (err.message === 'Event has already ended' || err.message === 'Event is at full capacity' || err.message === 'Already joined this event') {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to join event',
    });
  }
});

// DELETE /api/events/:id/leave - Leave event
router.delete('/:id/leave', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    await eventService.leave(id, userId);

    res.json({
      success: true,
      message: 'Successfully left event',
    });
  } catch (error) {
    console.error('Leave event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to leave event',
    });
  }
});

// POST /api/events/:id/like - Like event
router.post('/:id/like', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    await eventService.like(id, userId);

    res.json({
      success: true,
      message: 'Event liked',
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Like event error:', error);

    if (err.message === 'Already liked this event') {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to like event',
    });
  }
});

// DELETE /api/events/:id/like - Unlike event
router.delete('/:id/like', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    await eventService.unlike(id, userId);

    res.json({
      success: true,
      message: 'Event unliked',
    });
  } catch (error) {
    console.error('Unlike event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlike event',
    });
  }
});

export default router;
