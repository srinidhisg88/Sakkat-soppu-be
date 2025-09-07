const request = require('supertest');
const app = require('../src/app'); // Adjust the path as necessary
const User = require('../src/models/user.model');
const jwt = require('jsonwebtoken');

describe('Authentication Tests', () => {
    beforeAll(async () => {
        await User.deleteMany({}); // Clear the database before tests
    });

    afterAll(async () => {
        await User.deleteMany({}); // Clean up after tests
    });

    it('should sign up a new user', async () => {
        const res = await request(app)
            .post('/api/auth/signup')
            .send({
                username: 'testuser',
                password: 'testpassword',
                role: 'user'
            });
        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('token');
    });

    it('should log in an existing user', async () => {
        await request(app)
            .post('/api/auth/signup')
            .send({
                username: 'testuser',
                password: 'testpassword',
                role: 'user'
            });

        const res = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'testuser',
                password: 'testpassword'
            });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('token');
    });

    it('should not log in with incorrect password', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'testuser',
                password: 'wrongpassword'
            });
        expect(res.statusCode).toEqual(401);
        expect(res.body).toHaveProperty('message', 'Invalid credentials');
    });

    it('should return user info with valid token', async () => {
        const signupRes = await request(app)
            .post('/api/auth/signup')
            .send({
                username: 'testuser2',
                password: 'testpassword',
                role: 'user'
            });

        const token = signupRes.body.token;

        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('username', 'testuser2');
    });

    it('should not access protected route without token', async () => {
        const res = await request(app)
            .get('/api/auth/me');
        expect(res.statusCode).toEqual(401);
        expect(res.body).toHaveProperty('message', 'No token provided');
    });
});