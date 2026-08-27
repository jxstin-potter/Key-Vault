import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import prisma from './lib/prisma.js';

// Import routes
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import categoryRoutes from './routes/categories.js';
import orderRoutes from './routes/orders.js';
import cartRoutes from './routes/cart.js';
import reviewRoutes from './routes/reviews.js';
import userRoutes from './routes/users.js';
import analyticsRoutes from './routes/analytics.js';
import keyRoutes from './routes/keys.js';
import checkoutRoutes from './routes/checkout.js';
import webhookRoutes from './routes/webhooks.js';

// Import middleware
import { authenticateToken } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// CRITICAL FIX: Use Render's injected port, no fallback
const PORT = process.env.PORT;

// Environment validation

if (!PORT) {
  console.error('❌ PORT environment variable is required');
  console.error('Available environment variables:', Object.keys(process.env));
  process.exit(1);
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
// Stripe webhooks need the unparsed body for signature verification, so this
// route is mounted before express.json(). It is also above the rate limiter so
// Stripe retries are never throttled. Do not reorder these three lines.
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), webhookRoutes);

app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Root endpoint - Welcome message
app.get('/', (req, res) => {
  res.json({
    message: '🚀 KeyVault API is running!',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
      docs: 'Coming soon...'
    },
    timestamp: new Date().toISOString()
  });
});

// Health check - CRITICAL for Render
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    database: !!process.env.DATABASE_URL,
    jwt: !!process.env.JWT_SECRET,
    uptime: process.uptime()
  });
});

// API base endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'KeyVault API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      categories: '/api/categories',
      orders: '/api/orders',
      cart: '/api/cart',
      reviews: '/api/reviews',
      users: '/api/users',
      analytics: '/api/analytics'
    },
    docs: '/api/docs',
    health: '/health'
  });
});

// Test database connection
app.get('/test-db', async (req, res) => {
  try {
    await prisma.$connect();
    const dbUrl = process.env.DATABASE_URL || 'not set';
    const hostMatch = dbUrl.match(/@([^:/\s]+)/);
    const host = hostMatch ? hostMatch[1] : 'unknown';
    
    res.json({ 
      status: 'Database connected successfully',
      host: host,
      urlFormat: dbUrl.includes('render.com') ? 'Render format detected' : 'Check URL format'
    });
  } catch (error) {
    const dbUrl = process.env.DATABASE_URL || 'not set';
    const hostMatch = dbUrl.match(/@([^:/\s]+)/);
    const host = hostMatch ? hostMatch[1] : 'unknown';
    
    let errorMessage = 'Database connection failed';
    let troubleshooting = [];
    
    if (error.code === 'P1001') {
      errorMessage = 'Cannot reach database server';
      troubleshooting = [
        'Database may be paused - check Render dashboard and resume if needed',
        'Verify DATABASE_URL uses internal URL (ends with .render.com)',
        'Ensure database service is linked to web service in Render',
        'Check if database service is running in Render dashboard'
      ];
    }
    
    res.status(500).json({ 
      error: errorMessage,
      code: error.code,
      message: error.message,
      host: host,
      troubleshooting: troubleshooting,
      renderDashboard: 'https://dashboard.render.com'
    });
  }
});

// API Docs endpoint for demo/portfolio
app.get('/api/docs', (req, res) => {
  res.json({
    message: 'KeyVault API Documentation',
    endpoints: {
      health: '/health',
      products: '/api/products',
      categories: '/api/categories',
      auth: {
        register: '/api/auth/register (POST)',
        login: '/api/auth/login (POST)',
        me: '/api/auth/me (GET, requires auth)'
      },
      cart: '/api/cart (requires auth)',
      orders: '/api/orders (requires auth)',
      reviews: '/api/reviews',
      users: '/api/users (admin only)'
    },
    demoAccounts: {
      admin: 'admin@keyvault.com / admin123',
      user: 'user@keyvault.com / user123'
    },
    note: 'For POST endpoints, use JSON body as described in the README.'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', authenticateToken, orderRoutes);
app.use('/api/cart', authenticateToken, cartRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/keys', authenticateToken, keyRoutes);
app.use('/api/checkout', authenticateToken, checkoutRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default app; 