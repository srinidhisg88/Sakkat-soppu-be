const nodemailer = require('nodemailer');
const sgMail = (() => {
    try {
        return require('@sendgrid/mail');
    } catch (err) {
        return null;
    }
})();

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, SENDGRID_API_KEY, SENDGRID_TEMPLATE_ORDER } = process.env;

const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: true, // true for 465, false for other ports
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});

if (sgMail && SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
}

const sendOrderConfirmation = async (to, order) => {
    // Template expects: customerName, orderId, totalPrice, address, items (array)
    const dynamicTemplateData = {
        customerName: order.customerName || order.userId || 'Customer',
        orderId: String(order._id || order.id || ''),
        totalPrice: order.totalPrice || 0,
        address: order.address || '',
        items: (order.items || []).map(i => ({ name: i.name || i.productName || i.productId, quantity: i.quantity || i.qty || 1, price: i.price || i.unitPrice || 0 })),
    };

    // If SendGrid is configured, use template send
    if (sgMail && SENDGRID_API_KEY && SENDGRID_TEMPLATE_ORDER) {
        const msg = {
            to,
            from: EMAIL_FROM,
            templateId: SENDGRID_TEMPLATE_ORDER || 'd-7b93f14a07734e7eb74c0e0ddf588acf',
            dynamicTemplateData,
        };
        return sgMail.send(msg);
    }

    // Fallback to nodemailer plain text
    const mailOptions = {
        from: EMAIL_FROM,
        to,
        subject: 'Order Confirmation',
        text: `Your order has been confirmed. Details: ${JSON.stringify(order)}`,
    };

    return transporter.sendMail(mailOptions);
};

const sendNewOrderNotification = async (adminEmail, orderDetails) => {
    // Normalize order object (supports either { order } wrapper or raw order)
    const payload = orderDetails && orderDetails.order ? orderDetails.order : orderDetails || {};
    const mapsLink = orderDetails && orderDetails.mapsLink ? orderDetails.mapsLink : orderDetails && orderDetails.mapsLink ? orderDetails.mapsLink : null;

    const orderObj = payload || {};

    const dynamicTemplateData = {
        order: {
            _id: orderObj._id || orderObj.id || orderObj.orderId || '',
            userId: (orderObj.userId && (orderObj.userId._id || orderObj.userId)) || orderObj.userId || '',
            totalPrice: orderObj.totalPrice || 0,
            status: orderObj.status || 'pending',
            address: orderObj.address || '',
            items: (orderObj.items || []).map(i => ({ productId: i.productId || i.productId, quantity: i.quantity, price: i.price })),
        },
        mapsLink: mapsLink || null,
        year: new Date().getFullYear(),
    };

    // If SendGrid is configured, use admin template
    if (sgMail && SENDGRID_API_KEY && process.env.SENDGRID_TEMPLATE_ADMIN) {
        const msg = {
            to: adminEmail,
            from: EMAIL_FROM,
            templateId: process.env.SENDGRID_TEMPLATE_ADMIN || 'd-35f309be92254007b5ae034ab800c1d1',
            dynamicTemplateData,
        };
        return sgMail.send(msg);
    }

    // Fallback to nodemailer plain text
    let text = '';
    if (orderObj && Object.keys(orderObj).length) {
        text += `Order ID: ${orderObj._id || orderObj.id || ''}\nUser: ${orderObj.userId || ''}\nTotal: ${orderObj.totalPrice || 0}\nStatus: ${orderObj.status || 'pending'}\nAddress: ${orderObj.address || ''}\n`;
        if (mapsLink) text += `Maps Link: ${mapsLink}\n`;
        text += `Items: ${JSON.stringify(orderObj.items || [], null, 2)}`;
    } else {
        text = `A new order has been placed. Details: ${JSON.stringify(orderDetails)}`;
    }

    const mailOptions = {
        from: EMAIL_FROM,
        to: adminEmail,
        subject: 'New Order Received',
        text,
    };

    return transporter.sendMail(mailOptions);
};

const sendFarmerCredentials = async (to, credentials) => {
    const { email, password } = credentials;
    const mailOptions = {
        from: EMAIL_FROM,
        to,
        subject: 'Your Farmer Account Credentials',
        text: `Welcome. Your farmer account has been created. Login: ${email}\nPassword: ${password}\nPlease change your password after first login.`,
    };

    await transporter.sendMail(mailOptions);
};

module.exports = {
    sendOrderConfirmation,
    sendNewOrderNotification,
    sendFarmerCredentials,
};