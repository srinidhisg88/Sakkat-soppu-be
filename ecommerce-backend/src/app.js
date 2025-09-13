const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const logger = require('./config/logger');
const authRoutes = require('./routes/auth.routes');
const productsRoutes = require('./routes/products.routes');
const ordersRoutes = require('./routes/orders.routes');
const adminRoutes = require('./routes/admin.routes');
const farmerRoutes = require('./routes/farmer.routes');
const cartRoutes = require('./routes/cart.routes');
const usersRoutes = require('./routes/users.routes');
const publicRoutes = require('./routes/public.routes');
const categoriesController = require('./controllers/categories.controller');
const errorMiddleware = require('./middlewares/error.middleware');
require('dotenv').config();

const app = express();

// Middleware
app.set('trust proxy', 1);
// app.use(cors({
//     origin: process.env.FRONTEND_URL, // Whitelist frontend domain
//     credentials: true,
//     methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
//     allowedHeaders: ['Content-Type', 'Authorization'],
// }));
const normalizeOrigin = (o) => (o ? o.replace(/\/$/, '') : o);

// Allow configuring multiple origins via CORS_ORIGINS (comma-separated)
const originsEnv = process.env.CORS_ORIGINS || '';
const envOrigins = originsEnv
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const fallbackOrigins = [
  process.env.FRONTEND_URL,          // e.g., http://localhost:3000
  process.env.ADMIN_DASHBOARD_URL,   // e.g., http://localhost:5173 or https://admin.example.com
  'http://localhost:5173',
  'http://localhost:3000',
  'https://sakkat-soppu-admin.vercel.app',
  'https://sakkatsoppu.com',
  'https://www.sakkatsoppu.com',
  'https://admin.sakkatsoppu.com'
].filter(Boolean);

const allowedOrigins = new Set(
  (envOrigins.length ? envOrigins : fallbackOrigins).map(normalizeOrigin)
);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true); // non-browser or same-origin
    const ok = allowedOrigins.has(normalizeOrigin(origin));
    if (ok) return callback(null, true);
    if (logger?.warn) logger.warn(`CORS blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // Limit each IP to 100 requests per windowMs
}));

// Routes
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/farmer', farmerRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/public', publicRoutes);
app.get('/api/categories', categoriesController.listPublic);

// Error handling middleware
app.use(errorMiddleware);

module.exports = app;