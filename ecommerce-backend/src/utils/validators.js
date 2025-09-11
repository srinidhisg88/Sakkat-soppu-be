const Joi = require('joi');

const productSchema = Joi.object({
    name: Joi.string().required(),
    category: Joi.string().required(),
    price: Joi.number().positive().required(),
    stock: Joi.number().integer().min(0).required(),
    imageUrl: Joi.string().uri().optional(),
    description: Joi.string().optional(),
    isOrganic: Joi.boolean().optional(),
    g: Joi.number().integer().min(0).optional(),
    pieces: Joi.number().integer().min(0).optional(),
});

const orderSchema = Joi.object({
    items: Joi.array().items(Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().integer().positive().required(),
        price: Joi.number().positive().optional(),
    })).required(),
    totalPrice: Joi.number().positive().required(),
    address: Joi.string().required(),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional(),
});

const signupSchema = Joi.object({
    name: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    phone: Joi.string().optional(),
    address: Joi.string().optional(),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional(),
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
    email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
    email: Joi.string().email().required(),
    token: Joi.string().min(10).required(),
    newPassword: Joi.string().min(6).required(),
});

// Coupon validators
const couponCreateSchema = Joi.object({
    code: Joi.string().alphanum().min(3).max(20).required(),
    description: Joi.string().allow('').optional(),
    discountType: Joi.string().valid('percentage', 'flat').required(),
    discountValue: Joi.number().positive().required(),
    minOrderValue: Joi.number().min(0).optional(),
    maxDiscount: Joi.number().min(0).optional(),
    startsAt: Joi.date().optional(),
    expiresAt: Joi.date().optional(),
    usageLimit: Joi.number().integer().min(1).optional(),
    isActive: Joi.boolean().optional(),
});

const couponUpdateSchema = couponCreateSchema.fork(['code'], (s) => s.optional());

// Admin signup requires an adminCode to prevent open admin creation
const adminSignupSchema = signupSchema.keys({
    adminCode: Joi.string().min(6).required(),
});

const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });
    next();
};

module.exports = {
    validateProduct: validate(productSchema),
    validateOrder: validate(orderSchema),
    validateSignup: validate(signupSchema),
    validateLogin: validate(loginSchema),
    validateForgotPassword: validate(forgotPasswordSchema),
    validateResetPassword: validate(resetPasswordSchema),
    validateAdminSignup: validate(adminSignupSchema),
    // For admin login we can reuse the standard login schema
    validateAdminLogin: validate(loginSchema),
    validateCouponCreate: validate(couponCreateSchema),
    validateCouponUpdate: validate(couponUpdateSchema),
    validateFarmer: validate(Joi.object({
        name: Joi.string().min(2).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).optional(),
        phone: Joi.string().optional(),
        address: Joi.string().optional(),
        farmName: Joi.string().optional(),
        farmDescription: Joi.string().optional(),
        latitude: Joi.number().optional(),
        longitude: Joi.number().optional(),
    })),
};