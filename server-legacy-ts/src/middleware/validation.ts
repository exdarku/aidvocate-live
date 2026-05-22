import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';

/**
 * Generic validation middleware factory
 */
export const validate = <T extends ZodSchema>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        }));
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors,
        });
        return;
      }
      next(error);
    }
  };
};

/**
 * Validate request body only
 */
export const validateBody = <T extends ZodSchema>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors,
        });
        return;
      }
      next(error);
    }
  };
};

/**
 * Validate query parameters only
 */
export const validateQuery = <T extends ZodSchema>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          param: err.path.join('.'),
          message: err.message,
        }));
        res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: errors,
        });
        return;
      }
      next(error);
    }
  };
};

/**
 * Validate route parameters only
 */
export const validateParams = <T extends ZodSchema>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params) as typeof req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          param: err.path.join('.'),
          message: err.message,
        }));
        res.status(400).json({
          success: false,
          error: 'Invalid route parameters',
          details: errors,
        });
        return;
      }
      next(error);
    }
  };
};

// =============================================
// Common Validation Schemas
// =============================================

export const schemas = {
  // Auth schemas
  register: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    phone: z.string().optional(),
  }),

  login: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),

  // Donation schemas
  createDonation: z.object({
    charityId: z.string().uuid('Invalid charity ID'),
    amount: z.number().min(10, 'Minimum donation is PHP 10'),
    purpose: z.string().optional(),
    paymentMethod: z.enum(['GCASH', 'PAYMAYA', 'BANK']),
  }),

  // Charity schemas
  createCharity: z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    shortDescription: z.string().optional(),
    imageUrl: z.string().url().optional(),
    categories: z.array(z.string()).min(1, 'At least one category is required'),
    walletAddress: z.string().optional(),
    bankAccount: z.string().optional(),
    gcashNumber: z.string().optional(),
  }),

  // Event schemas
  createEvent: z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    imageUrl: z.string().url().optional(),
    location: z.string().min(1, 'Location is required'),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    maxParticipants: z.number().int().positive().optional(),
    charityId: z.string().uuid('Invalid charity ID'),
  }),

  // Common schemas
  uuid: z.object({
    id: z.string().uuid('Invalid ID'),
  }),

  pagination: z.object({
    page: z.string().transform(Number).default('1'),
    pageSize: z.string().transform(Number).default('10'),
  }),
};
