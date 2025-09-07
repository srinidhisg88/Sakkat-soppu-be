const Joi = require('joi');

const productSchema = Joi.object({
    name: Joi.string().required(),
    category: Joi.string().required(),
    price: Joi.number().positive().required(),
    stock: Joi.number().integer().min(0).required(),
    imageUrl: Joi.string().uri().required(),
    description: Joi.string().optional(),
    isOrganic: Joi.boolean().optional(),
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