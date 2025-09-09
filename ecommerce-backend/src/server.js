const mongoose = require('mongoose');
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

// Database connection
const connectWithRetry = async () => {
    try {
        await mongoose.connect(process.env.DB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
        });
        logger.info('MongoDB connected');
        console.log('MongoDB connected');
        app.listen(PORT, () => {
            logger.info(`Server is running on port ${PORT}`);
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        logger.error('MongoDB connection error:', err);
        console.error('MongoDB connection error:', err && err.message ? err.message : err);
        setTimeout(connectWithRetry, 5000);
    }
};

connectWithRetry();