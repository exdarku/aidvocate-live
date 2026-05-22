import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import env from './config/env.js';
import { prisma } from './config/database.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import charityRoutes from './routes/charity.routes.js';
import donationRoutes from './routes/donation.routes.js';
import eventRoutes from './routes/event.routes.js';
import adminRoutes from './routes/admin.routes.js';

const app = express();

// =============================================
// Middleware
// =============================================

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (development)
if (env.NODE_ENV === 'development') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// =============================================
// Routes
// =============================================

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/charities', charityRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/admin', adminRoutes);

// Mock payment endpoint (for development)
app.get('/api/mock-payment/pay', (req: Request, res: Response) => {
  const { ref, amount, method } = req.query;
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Mock Payment - AidVocate</title>
        <style>
          body {
            font-family: 'Poppins', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #FAF3DD;
            margin: 0;
          }
          .card {
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
          }
          h1 { color: #1C1D28; margin-bottom: 20px; }
          p { color: #666; margin: 10px 0; }
          .amount { font-size: 32px; color: #1C1D28; font-weight: bold; }
          .btn {
            background: #FCD384;
            color: #1C1D28;
            border: none;
            padding: 15px 40px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 20px;
          }
          .btn:hover { filter: brightness(0.9); }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Mock Payment</h1>
          <p>Reference: ${ref}</p>
          <p class="amount">PHP ${amount}</p>
          <p>Method: ${method}</p>
          <form action="/api/mock-payment/complete" method="POST">
            <input type="hidden" name="ref" value="${ref}" />
            <button type="submit" class="btn">Complete Payment</button>
          </form>
        </div>
      </body>
    </html>
  `);
});

app.post('/api/mock-payment/complete', express.urlencoded({ extended: true }), async (req: Request, res: Response) => {
  const { ref } = req.body;

  try {
    // Simulate payment gateway webhook
    const mockTxId = `MOCK-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    // Call our webhook endpoint
    const response = await fetch(`http://localhost:${env.PORT}/api/donations/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference: ref,
        transactionId: mockTxId,
        status: 'PAID',
      }),
    });

    res.redirect(`http://localhost:5173/payment-success?ref=${ref}`);
  } catch (error) {
    res.redirect(`http://localhost:5173/payment-failed?ref=${ref}`);
  }
});

// =============================================
// Error Handling
// =============================================

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    error: env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// =============================================
// Server Startup
// =============================================

const PORT = env.PORT;

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('Database connected successfully');

    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   AidVocate API Server                               ║
║                                                      ║
║   Environment: ${env.NODE_ENV.padEnd(38)}║
║   Port: ${String(PORT).padEnd(44)}║
║   URL: http://localhost:${String(PORT).padEnd(27)}║
║                                                      ║
╚══════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
