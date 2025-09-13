const { PricingV2TrunkingCountryInstanceOriginatingCallPrices } = require('twilio/lib/rest/pricing/v2/country');
const logger = require('../config/logger');
const config =require('../config/index')
const sgMail = (() => {
    try {
        return require('@sendgrid/mail');
    } catch (e) {
        console.log(e);
    }
})();

const { EMAIL_FROM, SENDGRID_API_KEY, SENDGRID_TEMPLATE_ORDER ,SENDGRID_TEMPLATE_ADMIN,SENDGRID_TEMPLATE_PASSWORD_RESET} = config;


    try {
        
        sgMail.setApiKey(SENDGRID_API_KEY);
        
    } catch (e) {
        logger.error('Failed to initialize SendGrid client', e);
    }


// NOTE: We intentionally do not provide any plain-text fallback. All emails require a SendGrid dynamic template.

const sendOrderConfirmation = async (to, orderDetails) => {
    // Support both raw order object and a wrapper { order }
    const orderObj = orderDetails && orderDetails.order ? orderDetails.order : (orderDetails || {});

    // Provide both top-level and nested order data for template compatibility
    const items = (orderObj.items || []).map(i => ({
        name: i.name || i.productName || i.productId,
        quantity: i.quantity || i.qty || 1,
        price: i.price || i.unitPrice || 0,
        unitLabel: i.unitLabel || null,
        priceForUnitLabel: i.priceForUnitLabel || null,
        lineTotal: (i.price || i.unitPrice || 0) * (i.quantity || i.qty || 0),
    }));

    const dynamicTemplateData = {
        customerName: orderObj.customerName || orderObj.userId || 'Customer',
        customerPhone: orderObj.customerPhone || '',
        orderId: String(orderObj._id || orderObj.id || orderObj.orderId || ''),
        totalPrice: orderObj.totalPrice || 0,
        address: orderObj.address || '',
        latitude: orderObj.latitude ?? null,
        longitude: orderObj.longitude ?? null,
        status: orderObj.status || 'pending',
        paymentMode: orderObj.paymentMode || 'COD',
        paymentMethod: orderObj.paymentMode || 'COD',
        createdAt: orderObj.createdAt || new Date().toISOString(),
        subtotalPrice: orderObj.subtotalPrice ?? null,
        discountAmount: orderObj.discountAmount || 0,
        couponCode: orderObj.couponCode || null,
        deliveryFee: orderObj.deliveryFee || 0,
        freeDeliveryApplied: !!orderObj.freeDeliveryApplied,
        items,
        order: {
            _id: orderObj._id || orderObj.id || orderObj.orderId || '',
            userId: (orderObj.userId && (orderObj.userId._id || orderObj.userId)) || orderObj.userId || '',
            customerName: orderObj.customerName || '',
            customerPhone: orderObj.customerPhone || '',
            totalPrice: orderObj.totalPrice || 0,
            status: orderObj.status || 'pending',
            address: orderObj.address || '',
            latitude: orderObj.latitude ?? null,
            longitude: orderObj.longitude ?? null,
            paymentMode: orderObj.paymentMode || 'COD',
            paymentMethod: orderObj.paymentMode || 'COD',
            createdAt: orderObj.createdAt || new Date().toISOString(),
            subtotalPrice: orderObj.subtotalPrice ?? null,
            discountAmount: orderObj.discountAmount || 0,
            couponCode: orderObj.couponCode || null,
            deliveryFee: orderObj.deliveryFee || 0,
            freeDeliveryApplied: !!orderObj.freeDeliveryApplied,
            items,
        },
    };

    // Send using order confirmation template
    if (sgMail && SENDGRID_API_KEY && SENDGRID_TEMPLATE_ORDER) {
        const msg = {
            to,
            from: EMAIL_FROM,
            templateId: SENDGRID_TEMPLATE_ORDER || 'd-7b93f14a07734e7eb74c0e0ddf588acf',
            dynamicTemplateData,
        };
        return sgMail.send(msg);
    }
    logger.warn('SENDGRID_TEMPLATE_ORDER not configured or SendGrid unavailable; order confirmation email not sent');
    return null;
};

const sendNewOrderNotification = async (adminEmail, orderDetails) => {
    // Normalize order object (supports either { order } wrapper or raw order)
    const payload = orderDetails && orderDetails.order ? orderDetails.order : orderDetails || {};
    const mapsLink = orderDetails && orderDetails.mapsLink ? orderDetails.mapsLink : orderDetails && orderDetails.mapsLink ? orderDetails.mapsLink : null;

    const orderObj = payload || {};

    const items = (orderObj.items || []).map(i => ({
        name: i.name || i.productName || i.productId,
        quantity: i.quantity,
        price: i.price,
        unitLabel: i.unitLabel || null,
        priceForUnitLabel: i.priceForUnitLabel || null,
        unitPrice: i.priceForUnitLabel || null,
        unit: i.unitLabel || null,
        lineTotal: (i.price || 0) * (i.quantity || 0),
    }));

    const dynamicTemplateData = {
        order: {
            _id: orderObj._id || orderObj.id || orderObj.orderId || '',
            userId: (orderObj.userId && (orderObj.userId._id || orderObj.userId)) || orderObj.userId || '',
            customerName: orderObj.customerName || '',
            customerPhone: orderObj.customerPhone || '',
            totalPrice: orderObj.totalPrice || 0,
            status: orderObj.status || 'pending',
            address: orderObj.address || '',
            latitude: orderObj.latitude ?? null,
            longitude: orderObj.longitude ?? null,
            paymentMode: orderObj.paymentMode || 'COD',
            paymentMethod: orderObj.paymentMode || 'COD',
            createdAt: orderObj.createdAt || new Date().toISOString(),
            subtotalPrice: orderObj.subtotalPrice ?? null,
            discountAmount: orderObj.discountAmount || 0,
            couponCode: orderObj.couponCode || null,
            deliveryFee: orderObj.deliveryFee || 0,
            freeDeliveryApplied: !!orderObj.freeDeliveryApplied,
            items,
        },
        mapsLink: mapsLink || null,
        year: new Date().getFullYear(),
    };

    // Send using admin notification template
    if (sgMail && SENDGRID_API_KEY && process.env.SENDGRID_TEMPLATE_ADMIN) {
        const msg = {
            to: adminEmail,
            from: EMAIL_FROM,
            templateId: process.env.SENDGRID_TEMPLATE_ADMIN || 'd-35f309be92254007b5ae034ab800c1d1',
            dynamicTemplateData,
        };
        return sgMail.send(msg);
        
    }
    logger.warn('SENDGRID_TEMPLATE_ADMIN not configured or SendGrid unavailable; admin order notification email not sent');
    return null;
};

const sendFarmerCredentials = async (to, credentials) => {
    const { email, password } = credentials;
    try {
        if (sgMail && SENDGRID_API_KEY && process.env.SENDGRID_TEMPLATE_FARMER_CREDENTIALS) {
            const msg = {
                to,
                from: EMAIL_FROM,
                templateId: process.env.SENDGRID_TEMPLATE_FARMER_CREDENTIALS,
                dynamicTemplateData: { email, password },
            };
            return sgMail.send(msg);
        }
        logger.warn('SENDGRID_TEMPLATE_FARMER_CREDENTIALS not configured or SendGrid unavailable; farmer credentials email not sent');
        return null;
    } catch (e) {
        logger.error('Failed to send farmer credentials email', e);
        return null;
    }
};

module.exports = {
    sendOrderConfirmation,
    sendNewOrderNotification,
    sendFarmerCredentials,
    sendPasswordReset: async (to, { resetUrl, expiresIn } = {}) => {
    try {
        const dynamicTemplateData = { resetUrl, expiresIn };
        
            const msg = {
                to,
                from: EMAIL_FROM,
                templateId: SENDGRID_TEMPLATE_PASSWORD_RESET,
                dynamicTemplateData,
            };
            if(sgMail && SENDGRID_API_KEY){

             return await sgMail.send(msg)
  
             
            }
            
        
        logger.warn('SENDGRID_TEMPLATE_PASSWORD_RESET not configured or SendGrid unavailable; password reset email not sent');
        return null;
    } catch (err) {
        if (err.response) {
            console.error(err.response.body);
        }
        logger.error('Failed to send password reset email', err);
        return null;
    }
},
};