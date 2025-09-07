const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./config/logger');
const app = require('./app');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

// Fail fast if critical env vars are missing
if (!process.env.DB_URI) {
    console.error('Missing required environment variable: DB_URI. Copy .env.example to .env and set DB_URI.');
    process.exit(1);
}
if (!process.env.JWT_SECRET) {
    console.error('Missing required environment variable: JWT_SECRET. Set a strong JWT_SECRET in your .env.');
    process.exit(1);
}

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL, // Whitelist frontend domain
}));
app.use(helmet());
app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // Limit each IP to 100 requests per windowMs
}));

// Database connection
mongoose.connect(process.env.DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    logger.info('MongoDB connected');
   console.log('MongoDB connected');
    app.listen(PORT, () => {
        logger.info(`Server is running on port ${PORT}`);
        console.log(`Server is running on port ${PORT}`)
    });
})
.catch(err => {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
});