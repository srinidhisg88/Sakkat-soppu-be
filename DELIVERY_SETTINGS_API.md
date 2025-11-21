# Delivery Settings API Documentation

## Overview
The delivery settings system supports city-specific, weight-based delivery pricing for Mysuru and Bengaluru. Each city has configurable base prices, per-kg increments, and free delivery thresholds.

## Data Model

### Delivery Configuration Structure
```json
{
  "enabled": true,
  "minOrderSubtotal": 100,
  "cities": [
    {
      "name": "Bengaluru",
      "basePrice": 40,
      "pricePerKg": 10,
      "freeDeliveryThreshold": 500
    },
    {
      "name": "Mysuru",
      "basePrice": 50,
      "pricePerKg": 15,
      "freeDeliveryThreshold": 600
    }
  ]
}
```

### Fields Description
- `enabled` (boolean): Master switch for delivery service
- `minOrderSubtotal` (number): Minimum order amount required
- `cities` (array): List of city-specific configurations
  - `name` (string): City name
  - `basePrice` (number): Base delivery fee for first 1kg
  - `pricePerKg` (number): Additional fee per kg after the first kg
  - `freeDeliveryThreshold` (number): Order subtotal at which delivery becomes free

## Delivery Fee Calculation Logic

### Formula
```
If orderSubtotal >= freeDeliveryThreshold:
  deliveryFee = 0

Else if totalWeight <= 1kg:
  deliveryFee = basePrice

Else:
  additionalWeight = ceil(totalWeight - 1)
  deliveryFee = basePrice + (additionalWeight × pricePerKg)
```

### Examples

**Example 1: Bengaluru, 0.5kg, ₹300 order**
- Weight ≤ 1kg → Base price only
- Order < ₹500 → No free delivery
- **Delivery Fee: ₹40**

**Example 2: Bengaluru, 2.5kg, ₹300 order**
- Weight = 2.5kg → 1kg base + 2kg additional (rounded up)
- Order < ₹500 → No free delivery
- **Delivery Fee: ₹40 + (2 × ₹10) = ₹60**

**Example 3: Bengaluru, 3kg, ₹600 order**
- Order ≥ ₹500 → Free delivery
- **Delivery Fee: ₹0**

**Example 4: Mysuru, 1.8kg, ₹400 order**
- Weight = 1.8kg → 1kg base + 1kg additional (rounded up)
- Order < ₹600 → No free delivery
- **Delivery Fee: ₹50 + (1 × ₹15) = ₹65**

---

## Admin API Endpoints

### 1. Get All Delivery Settings
**GET** `/api/admin/delivery-settings`

**Auth Required:** Yes (Admin only)

**Response:**
```json
{
  "enabled": true,
  "minOrderSubtotal": 100,
  "cities": [
    {
      "name": "Bengaluru",
      "basePrice": 40,
      "pricePerKg": 10,
      "freeDeliveryThreshold": 500
    }
  ],
  "updatedBy": "user_id",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 2. Update All Delivery Settings
**PUT** `/api/admin/delivery-settings`

**Auth Required:** Yes (Admin only)

**Request Body:**
```json
{
  "enabled": true,
  "minOrderSubtotal": 100,
  "cities": [
    {
      "name": "Bengaluru",
      "basePrice": 40,
      "pricePerKg": 10,
      "freeDeliveryThreshold": 500
    },
    {
      "name": "Mysuru",
      "basePrice": 50,
      "pricePerKg": 15,
      "freeDeliveryThreshold": 600
    }
  ]
}
```

**Response:** Updated configuration object

**Notes:**
- All fields are optional
- If `cities` is provided, it replaces the entire cities array
- Each city must have `name`, `basePrice`, and `pricePerKg`

---

### 3. Update Single City Settings
**PUT** `/api/admin/delivery-settings/cities/:cityName`

**Auth Required:** Yes (Admin only)

**URL Parameters:**
- `cityName` (string): Name of the city (e.g., "Bengaluru", "Mysuru")

**Request Body:**
```json
{
  "basePrice": 40,
  "pricePerKg": 10,
  "freeDeliveryThreshold": 500
}
```

**Response:** Updated configuration object

**Notes:**
- Creates the city if it doesn't exist
- Updates the city if it already exists
- `basePrice` and `pricePerKg` are required
- `freeDeliveryThreshold` is optional (defaults to 0)

**Example:**
```bash
curl -X PUT http://localhost:3000/api/admin/delivery-settings/cities/Bengaluru \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "basePrice": 45,
    "pricePerKg": 12,
    "freeDeliveryThreshold": 550
  }'
```

---

### 4. Delete City Settings
**DELETE** `/api/admin/delivery-settings/cities/:cityName`

**Auth Required:** Yes (Admin only)

**URL Parameters:**
- `cityName` (string): Name of the city to remove

**Response:** Updated configuration object

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/admin/delivery-settings/cities/Bengaluru \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Public API Endpoints

### 5. Get Public Delivery Settings
**GET** `/api/public/settings/delivery`

**Auth Required:** No

**Response:**
```json
{
  "enabled": true,
  "minOrderSubtotal": 100,
  "cities": [
    {
      "name": "Bengaluru",
      "basePrice": 40,
      "pricePerKg": 10,
      "freeDeliveryThreshold": 500
    },
    {
      "name": "Mysuru",
      "basePrice": 50,
      "pricePerKg": 15,
      "freeDeliveryThreshold": 600
    }
  ]
}
```

**Use Case:** Display available delivery cities and pricing info to users

---

### 6. Calculate Delivery Fee
**POST** `/api/public/settings/delivery/calculate`

**Auth Required:** No

**Request Body:**
```json
{
  "city": "Bengaluru",
  "totalWeight": 2.5,
  "orderSubtotal": 350
}
```

**Response (Success):**
```json
{
  "city": "Bengaluru",
  "deliveryFee": 60,
  "isFree": false
}
```

**Response (Free Delivery):**
```json
{
  "city": "Bengaluru",
  "deliveryFee": 0,
  "isFree": true
}
```

**Response (City Not Available):**
```json
{
  "message": "Delivery not available for Chennai"
}
```

**Response (Delivery Disabled):**
```json
{
  "message": "Delivery is currently disabled"
}
```

**Use Case:**
- Calculate delivery fee during checkout
- Display real-time delivery cost as users add items to cart
- Validate if delivery is available for user's city

**Example:**
```bash
curl -X POST http://localhost:3000/api/public/settings/delivery/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "city": "Bengaluru",
    "totalWeight": 2.5,
    "orderSubtotal": 350
  }'
```

---

## Integration Guide

### Frontend Integration

#### 1. Display Available Cities
```javascript
// Fetch available cities on page load
const response = await fetch('/api/public/settings/delivery');
const settings = await response.json();

// Display cities in dropdown
settings.cities.forEach(city => {
  console.log(`${city.name}: ₹${city.basePrice} base + ₹${city.pricePerKg}/kg`);
});
```

#### 2. Calculate Delivery Fee in Cart
```javascript
// When user updates cart or selects city
async function calculateDelivery(city, cartItems) {
  // Calculate total weight from cart
  const totalWeight = cartItems.reduce((sum, item) =>
    sum + (item.weight * item.quantity), 0
  );

  // Calculate order subtotal
  const orderSubtotal = cartItems.reduce((sum, item) =>
    sum + (item.price * item.quantity), 0
  );

  // Request delivery fee calculation
  const response = await fetch('/api/public/settings/delivery/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city, totalWeight, orderSubtotal })
  });

  const result = await response.json();

  if (result.deliveryFee !== undefined) {
    console.log(`Delivery fee: ₹${result.deliveryFee}`);
    return result.deliveryFee;
  } else {
    console.error(result.message);
    return null;
  }
}
```

#### 3. Admin Settings Management
```javascript
// Update Bengaluru settings
async function updateCitySettings() {
  const response = await fetch('/api/admin/delivery-settings/cities/Bengaluru', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      basePrice: 45,
      pricePerKg: 12,
      freeDeliveryThreshold: 550
    })
  });

  const result = await response.json();
  console.log('Updated settings:', result);
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "message": "City is required"
}
```

### 400 Bad Request (Invalid Data)
```json
{
  "message": "Each city must have name, basePrice, and pricePerKg"
}
```

### 401 Unauthorized
```json
{
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "message": "Admin access required"
}
```

### 404 Not Found
```json
{
  "message": "Delivery configuration not found"
}
```

### 500 Internal Server Error
```json
{
  "message": "Failed to update delivery settings"
}
```

---

## Notes

1. **City Names**: Case-insensitive matching (e.g., "bengaluru", "Bengaluru", "BENGALURU" all match)

2. **Weight Rounding**: Additional weight beyond 1kg is rounded up to the nearest kg

3. **Delivery Restrictions**: Only Mysuru and Bengaluru are supported. Orders to other cities will be rejected.

4. **Free Delivery**: When order subtotal meets or exceeds the city's threshold, delivery fee becomes zero regardless of weight

5. **Product Weight**: Ensure all products have a `weight` field in kg for accurate calculations

6. **Minimum Order**: The `minOrderSubtotal` applies globally across all cities
