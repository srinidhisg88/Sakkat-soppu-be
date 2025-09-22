const Joi = require('joi');

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

// Helper: accept either an array of strings or a JSON string representing an array
const arrayOrJson = (itemSchema = Joi.string()) => Joi.alternatives().try(
    Joi.array().items(itemSchema),
    Joi.string()
).optional();

// Create: require core fields; allow either category or categoryId
const productCreateSchema = Joi.object({
    name: Joi.string().required(),
    category: Joi.string().optional(),
    categoryId: Joi.string().pattern(objectIdRegex).optional(),
    price: Joi.number().positive().required(),
    stock: Joi.number().integer().min(0).required(),
    imageUrl: Joi.string().uri().optional(),
    description: Joi.string().optional(),
    isOrganic: Joi.boolean().optional(),
    g: Joi.number().integer().min(0).optional(),
    pieces: Joi.number().integer().min(0).optional(),
}).xor('category', 'categoryId');

// Update: all fields optional; include media management fields
const productUpdateSchema = Joi.object({
    name: Joi.string().optional(),
    category: Joi.string().optional(),
    categoryId: Joi.string().pattern(objectIdRegex).optional(),
    price: Joi.number().positive().optional(),
    stock: Joi.number().integer().min(0).optional(),
    imageUrl: Joi.string().uri().allow('').optional(),
    description: Joi.string().optional(),
    isOrganic: Joi.boolean().optional(),
    g: Joi.number().integer().min(0).optional(),
    pieces: Joi.number().integer().min(0).optional(),
    // Media management inputs (either repeated fields forming arrays or JSON strings)
    removeImages: arrayOrJson(Joi.string()),
    removeVideos: arrayOrJson(Joi.string()),
    imagesOrder: arrayOrJson(Joi.string()),
    videosOrder: arrayOrJson(Joi.string()),
});

const orderSchema = Joi.object({
    items: Joi.array().items(Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().integer().positive().required(),
        price: Joi.number().positive().optional(),
    })).required(),
    totalPrice: Joi.number().positive().required(),
    address: Joi.string().required(),
    phone: Joi.string().optional(),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional(),
});

const signupSchema = Joi.object({
    name: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    phone: Joi.string().optional(),
    address: Joi.string().required(),
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
    address: Joi.string().optional(),
});

const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });
    next();
};

module.exports = {
    validateProductCreate: validate(productCreateSchema),
    validateProductUpdate: validate(productUpdateSchema),
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
    // Farmers: create/update (no credentials), allow media management fields on update
    validateFarmerCreate: validate(Joi.object({
        name: Joi.string().min(2).required(),
        phone: Joi.string().optional(),
        address: Joi.string().optional(),
        farmName: Joi.string().optional(),
        farmDescription: Joi.string().optional(),
        latitude: Joi.number().optional(),
        longitude: Joi.number().optional(),
    })),
    validateFarmerUpdate: validate(Joi.object({
        name: Joi.string().min(2).optional(),
        phone: Joi.string().optional(),
        address: Joi.string().optional(),
        farmName: Joi.string().optional(),
        farmDescription: Joi.string().optional(),
        latitude: Joi.number().optional(),
        longitude: Joi.number().optional(),
        removeImages: arrayOrJson(Joi.string()),
        removeVideos: arrayOrJson(Joi.string()),
        imagesOrder: arrayOrJson(Joi.string()),
        videosOrder: arrayOrJson(Joi.string()),
    })),
};