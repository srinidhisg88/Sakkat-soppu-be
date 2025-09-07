# E-commerce Backend

This is a production-ready backend for an e-commerce application built using Node.js, Express, and MongoDB. The application includes features for user authentication, product management, order processing, and notifications.

## Core Features
# Sakkat Soppu — E-commerce Backend

Welcome to the backend for Sakkat Soppu — a small marketplace for organic fruits and vegetables connecting local farmers to customers.

This repository contains a production-ready backend built with Node.js, Express, and MongoDB. It provides role-based authentication, farmer management, product and order APIs, and multi-channel notifications (email + SMS).

## Core Features

### Authentication
- User signup and login with JWT authentication.
- Passwords are securely hashed using bcrypt.
- Role-based access control for users, farmers, and admins.

Additionally, farmers are first-class actors in the system: admins create farmer accounts and farmers can list and manage their own products.

### Products
- Products include: name, category, price, stock, imageUrl, description, isOrganic, and farmerId.
- Products are associated with farmers (`farmerId`). Farmers can create/edit/delete only their products; admins can manage all products.

### Orders
- Users can create orders with items and delivery details.
- Admins can update order statuses (pending, confirmed, delivered, cancelled).
- When orders are confirmed, the admin receives email and SMS containing a Google Maps link to the delivery location.

### Notifications
- Email notifications sent to users upon order confirmation.
- Admins receive email + SMS notifications for new/confirmed orders with location link.
- Newly created farmers receive their temporary credentials via email (and optionally SMS) when an admin creates an account.

## Security & Middleware
- CORS enabled with a whitelist for the frontend domain.
- Rate limiting implemented to prevent abuse.
- Security headers with Helmet.
- Input validation with Joi.
- Centralized error handling with proper HTTP status codes.

## Integrations
- Cloudinary for product and farm media storage.
- Google Maps Geocoding API for retrieving latitude and longitude.
- Twilio for SMS notifications.

## Getting Started

### Prerequisites
- Node.js (16+)
- MongoDB Atlas or local MongoDB
- SMTP service (Gmail/SendGrid)
- Twilio account for SMS (optional)

### Installation
1. Clone the repository:
```bash
git clone <repository-url>
```
2. Navigate to the project directory:
```bash
cd ecommerce-backend
```
3. Install dependencies:
```bash
npm install
```
4. Create a `.env` file based on `.env.example` and fill in the environment variables listed below.

### Running the Application
- Development:
```bash
npm run dev
```
- Production:
```bash
npm start
```

The application will run on the configured `PORT` (default 3000).

### API Summary
- Auth: `POST /api/auth/signup`, `POST /api/auth/login`
- Products: `GET /api/products`, `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id`
- Orders: `POST /api/orders` (user), `GET /api/orders` (user), `PUT /api/orders/:orderId/status` (admin)
- Farmer: `GET /api/farmer/profile`, `PUT /api/farmer/profile`, `POST /api/farmer/products`
- Admin: `GET /api/admin/analytics`, `POST /api/admin/farmers`, `PUT /api/admin/farmers/:id`, `DELETE /api/admin/farmers/:id`

Refer to the route files in `src/routes` for exact request payloads.

### Important environment variables (examples)
```
PORT=3000
DB_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/sakkat-soppu
JWT_SECRET=very_secure_secret
FRONTEND_URL=https://your-frontend.example.com

# SMTP
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<sendgrid-api-key>
EMAIL_FROM="Sakkat Soppu <no-reply@sakkatsoppu.com>"

# Twilio (optional)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM=+1XXXXXXXXXX
ADMIN_PHONE=+1YYYYYYYYYY

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Google Maps
GOOGLE_MAPS_API_KEY=...

ADMIN_EMAIL=admin@sakkatsoppu.com
```

## Running tests
- Tests (if added):
```bash
npm test
```

## Deployment
- Recommended: containerize with Docker (`node:18-alpine` multi-stage) and deploy on Railway, Render, or AWS.
- Keep sensitive env vars in the deployment provider's secret store.

## Notes
- Farmer credentials are emailed/SMSed upon creation by admin. Consider forcing farmer to reset password on first login.
- For strict multi-product atomicity during ordering, consider enabling MongoDB transactions (requires replica set / Atlas).

## License
MIT