import { Router, Request, Response } from 'express';
import { adminService } from '../services/admin.service';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate, requireRole('ADMIN'));

// GET /api/admin/dashboard - Get dashboard statistics
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const stats = await adminService.getDashboardStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
    });
  }
});

// GET /api/admin/donations - Get all donations with pagination
router.get('/donations', async (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query;

    const result = await adminService.getAllDonations(
      page ? parseInt(page as string) : undefined,
      limit ? parseInt(limit as string) : undefined
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Get all donations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch donations',
    });
  }
});

// GET /api/admin/users - Get all users with pagination
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query;

    const result = await adminService.getAllUsers(
      page ? parseInt(page as string) : undefined,
      limit ? parseInt(limit as string) : undefined
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
    });
  }
});

// GET /api/admin/charities - Get all charities with pagination
router.get('/charities', async (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query;

    const result = await adminService.getAllCharities(
      page ? parseInt(page as string) : undefined,
      limit ? parseInt(limit as string) : undefined
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Get all charities error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch charities',
    });
  }
});

// PUT /api/admin/charities/:id/verify - Verify a charity
router.put('/charities/:id/verify', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const charity = await adminService.verifyCharity(id);

    res.json({
      success: true,
      data: charity,
      message: 'Charity verified successfully',
    });
  } catch (error) {
    console.error('Verify charity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify charity',
    });
  }
});

export default router;
