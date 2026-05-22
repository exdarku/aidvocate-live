import { Router, Request, Response } from 'express';
import { charityService } from '../services/charity.service.js';
import { authenticate, optionalAuth, requireAdmin, requireNGOOrAdmin } from '../middleware/auth.js';
import { validateBody, schemas } from '../middleware/validation.js';

const router = Router();

/**
 * GET /api/charities
 * Get all charities with optional filters
 */
router.get('/', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = {
      category: req.query.category as string | undefined,
      search: req.query.search as string | undefined,
      verified: req.query.verified === 'true' ? true : req.query.verified === 'false' ? false : undefined,
      sortBy: req.query.sortBy as 'recent' | 'popular' | 'raised' | undefined,
    };

    const charities = await charityService.getAll(filters, req.user?.userId);

    res.json({
      success: true,
      data: {
        data: charities,
        total: charities.length,
        page: 1,
        pageSize: charities.length,
        totalPages: 1,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch charities';
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /api/charities/categories
 * Get all unique categories
 */
router.get('/categories', async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await charityService.getCategories();
    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
    });
  }
});

/**
 * GET /api/charities/:id
 * Get charity by ID
 */
router.get('/:id', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const charity = await charityService.getById(req.params.id, req.user?.userId);
    res.json({
      success: true,
      data: charity,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch charity';
    res.status(404).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /api/charities
 * Create a new charity (admin only)
 */
router.post(
  '/',
  authenticate,
  requireAdmin,
  validateBody(schemas.createCharity),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const charity = await charityService.create(req.body);
      res.status(201).json({
        success: true,
        data: charity,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create charity';
      res.status(400).json({
        success: false,
        error: message,
      });
    }
  }
);

/**
 * PUT /api/charities/:id
 * Update a charity (admin or NGO manager)
 */
router.put(
  '/:id',
  authenticate,
  requireNGOOrAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const charity = await charityService.update(req.params.id, req.body);
      res.json({
        success: true,
        data: charity,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update charity';
      res.status(400).json({
        success: false,
        error: message,
      });
    }
  }
);

/**
 * DELETE /api/charities/:id
 * Delete a charity (admin only)
 */
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await charityService.delete(req.params.id);
      res.json({
        success: true,
        message: 'Charity deleted successfully',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete charity';
      res.status(400).json({
        success: false,
        error: message,
      });
    }
  }
);

/**
 * POST /api/charities/:id/like
 * Like a charity
 */
router.post('/:id/like', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    await charityService.like(req.params.id, req.user!.userId);
    res.json({
      success: true,
      message: 'Charity liked',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to like charity';
    res.status(400).json({
      success: false,
      error: message,
    });
  }
});

/**
 * DELETE /api/charities/:id/like
 * Unlike a charity
 */
router.delete('/:id/like', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    await charityService.unlike(req.params.id, req.user!.userId);
    res.json({
      success: true,
      message: 'Charity unliked',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to unlike charity';
    res.status(400).json({
      success: false,
      error: message,
    });
  }
});

export default router;
