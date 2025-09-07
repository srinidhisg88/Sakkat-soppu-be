const request = require('supertest');
const app = require('../src/app');
const Product = require('../src/models/product.model');

describe('Product API', () => {
    let productId;

    beforeAll(async () => {
        await Product.deleteMany({});
    });

    afterAll(async () => {
        await Product.deleteMany({});
    });

    it('should create a new product (admin)', async () => {
        const res = await request(app)
            .post('/api/products')
            .send({
                name: 'Organic Apple',
                category: 'Fruits',
                price: 1.5,
                stock: 100,
                imageUrl: 'http://example.com/apple.jpg',
                description: 'Fresh organic apples',
                isOrganic: true
            })
            .set('Authorization', `Bearer ${adminToken}`); // Assume adminToken is defined

        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('_id');
        productId = res.body._id;
    });

    it('should fetch all products', async () => {
        const res = await request(app).get('/api/products');

        expect(res.statusCode).toEqual(200);
        expect(res.body).toBeInstanceOf(Array);
    });

    it('should update a product (admin)', async () => {
        const res = await request(app)
            .put(`/api/products/${productId}`)
            .send({
                price: 2.0,
                stock: 80
            })
            .set('Authorization', `Bearer ${adminToken}`); // Assume adminToken is defined

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('price', 2.0);
        expect(res.body).toHaveProperty('stock', 80);
    });

    it('should delete a product (admin)', async () => {
        const res = await request(app)
            .delete(`/api/products/${productId}`)
            .set('Authorization', `Bearer ${adminToken}`); // Assume adminToken is defined

        expect(res.statusCode).toEqual(204);
    });

    it('should return 404 for non-existing product', async () => {
        const res = await request(app).get(`/api/products/${productId}`);

        expect(res.statusCode).toEqual(404);
    });
});