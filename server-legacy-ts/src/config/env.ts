import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Blockchain
  POLYGON_MUMBAI_RPC: z.string().default('https://rpc-mumbai.maticvigil.com'),
  PRIVATE_KEY: z.string().optional(),
  CONTRACT_ADDRESS: z.string().optional(),
  NETWORK: z.string().default('mumbai'),

  // Fraud Detection Service
  FRAUD_SERVICE_URL: z.string().default('http://localhost:8000'),

  // Payment (Mock)
  PAYMENT_GATEWAY_URL: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

export default env;
