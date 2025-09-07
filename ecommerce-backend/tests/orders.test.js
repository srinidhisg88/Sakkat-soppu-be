const request = require('supertest');
const app = require('../src/app'); // Adjust the path if necessary
const mongoose = require('mongoose');
const Order = require('../src/models/order.model');
const User = require('../src/models/user.model');

describe('Orders API', () => {
    let userToken;
    let adminToken;

    beforeAll(async () => {
        // Connect to the test database
        await mongoose.connect(process.env.DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

        // Create a test user and admin
        const user = await User.create({ username: 'testuser', password: 'password', role: 'user' });
        const admin = await User.create({ username: 'testadmin', password: 'password', role: 'admin' });

        // Simulate JWT tokens (you should replace this with actual token generation)
        userToken = 'Bearer ' + user.generateAuthToken(); // Assuming generateAuthToken is a method in user model
        adminToken = 'Bearer ' + admin.generateAuthToken();
    });

    afterAll(async () => {
        // Clean up the database
        await Order.deleteMany({});
        await User.deleteMany({});
        await mongoose.connection.close();
    });

    describe('Create Order', () => {
        it('should create an order for a user', async () => {
            const orderData = {
                items: [{ productId: 'productId1', quantity: 2, price: 20 }],
                totalPrice: 40,
                status: 'pending',
                address: '123 Test St',
                latitude: 12.34,
                longitude: 56.78,
            };

            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', userToken)
                .send(orderData);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('totalPrice', 40);
        });

        it('should not create an order if quantity exceeds stock', async () => {
            const orderData = {
                items: [{ productId: 'productId1', quantity: 100, price: 20 }],
                totalPrice: 2000,
                status: 'pending',
                address: '123 Test St',
                latitude: 12.34,
                longitude: 56.78,
            };

            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', userToken)
                .send(orderData);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('message', 'Insufficient stock');
        });
    });

    describe('Update Order Status', () => {
        let orderId;

        beforeAll(async () => {
            const order = await Order.create({
                userId: 'testuserId',
                items: [{ productId: 'productId1', quantity: 2, price: 20 }],
                totalPrice: 40,
                status: 'pending',
                address: '123 Test St',
                latitude: 12.34,
                longitude: 56.78,
            });
            orderId = order._id;
        });

        it('should update order status by admin', async () => {
            const response = await request(app)
                .put(`/api/orders/${orderId}/status`)
                .set('Authorization', adminToken)
                .send({ status: 'confirmed' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'confirmed');
        });

        it('should not allow user to update order status', async () => {
            const response = await request(app)
                .put(`/api/orders/${orderId}/status`)
                .set('Authorization', userToken)
                .send({ status: 'delivered' });

            expect(response.status).toBe(403);
            expect(response.body).toHaveProperty('message', 'Access denied');
        });
    });

    describe('Fetch Past Orders', () => {
        it('should fetch past orders for a user', async () => {
            const response = await request(app)
                .get('/api/orders')
                .set('Authorization', userToken);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });
    });
});