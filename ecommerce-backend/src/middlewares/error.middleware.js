const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    console.error(err);

    res.status(statusCode).json({
        success: false,
        message,
    });
};

const handleError = (res, error) => {
    console.error(error);
    res.status(500).json({ message: error.message || 'Internal server error' });
};

module.exports = errorHandler;
module.exports.handleError = handleError;