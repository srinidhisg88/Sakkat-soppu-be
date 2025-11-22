# Order Delivery Fee Calculation - Updated Implementation

## Summary
The order creation process has been updated to use the new city-based, weight-based delivery fee calculation system instead of the old flat-rate system.

---

## Changes Made

### 1. **Updated Delivery Utility** - [src/utils/delivery.js](ecommerce-backend/src/utils/delivery.js)

Added new function `computeCityBasedDeliveryFee()` that:
- Takes city, total weight (kg), and order subtotal as parameters
- Uses the `DeliveryConfig.calculateDeliveryFee()` static method
- Returns delivery fee based on city-specific weight pricing
- Handles errors gracefully with proper error messages

**Old Function (Legacy - kept for compatibility):**
```javascript
function computeDeliveryFee(subtotal, config) {
  // Simple flat fee with threshold
  const fee = Math.max(0, Number(cfg.deliveryFee || 0));
  const threshold = Math.max(0, Number(cfg.freeDeliveryThreshold || 0));

  if (threshold > 0 && subtotal >= threshold) {
    return { deliveryFee: 0, freeDeliveryApplied: true };
  }
  return { deliveryFee: fee, freeDeliveryApplied: false };
}
```

**New Function:**
```javascript
async function computeCityBasedDeliveryFee(city, totalWeight, orderSubtotal) {
  const DeliveryConfig = require('../models/deliveryConfig.model');
  const result = await DeliveryConfig.calculateDeliveryFee(city, totalWeight, orderSubtotal);

  return {
    success: result.success,
    deliveryFee: result.deliveryFee,
    freeDeliveryApplied: result.isFree,
    error: result.message
  };
}
```

---

### 2. **Updated Orders Controller** - [src/controllers/orders.controller.js](ecommerce-backend/src/controllers/orders.controller.js)

#### Changes in `createOrder` function:

**A. Calculate Total Weight from Cart Items (Lines 327-330)**
```javascript
// Calculate total weight from fulfilled items (convert grams to kg)
const totalWeight = fulfilledItems.reduce((sum, item) => {
    const weightInKg = item.g ? (item.g / 1000) * item.quantity : 0;
    return sum + weightInKg;
}, 0);
```

**How it works:**
- Iterates through all fulfilled items from the user's cart
- Converts grams (`g` field) to kilograms by dividing by 1000
- Multiplies by quantity to get total weight per item
- Sums up all item weights to get total cart weight

**B. Extract Delivery City (Lines 332-348)**
```javascript
// Extract city from address
const deliveryCity = (address && address.city) ? address.city.trim() : '';

if (!deliveryCity) {
    // If no city provided, abort the order
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({
        message: 'Delivery city is required in address',
        itemsOutOfStock: outOfStock
    });
}
```

**Validation:**
- City must be provided in the address object
- If missing, the transaction is aborted and returns 400 error

**C. Calculate City-Based Delivery Fee (Lines 350-380)**
```javascript
try {
    const { computeCityBasedDeliveryFee } = require('../utils/delivery');
    const calc = await computeCityBasedDeliveryFee(
        deliveryCity,
        totalWeight,
        subtotal - discountAmount
    );

    if (!calc.success) {
        // City not supported or delivery disabled
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
            message: calc.error || 'Delivery not available for your city',
            reason: 'DELIVERY_NOT_AVAILABLE',
            city: deliveryCity,
            itemsOutOfStock: outOfStock
        });
    }

    deliveryFee = calc.deliveryFee || 0;
    freeDeliveryApplied = !!calc.freeDeliveryApplied;
} catch (e) {
    console.error('Delivery fee calculation failed', e);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
        message: 'Failed to calculate delivery fee',
        itemsOutOfStock: outOfStock
    });
}
```

**Error Handling:**
1. **City Not Supported:** If the city is not configured (e.g., not Bengaluru or Mysuru), returns 400 with clear message
2. **Delivery Disabled:** If delivery is globally disabled, returns 400
3. **Calculation Error:** If any error occurs, returns 500 and aborts transaction

---

## How It Works - Step by Step

### Order Creation Flow with New Delivery Fee Calculation

1. **User initiates checkout** with cart items and delivery address containing city

2. **Stock validation** - Each cart item is checked for availability and stock is decremented

3. **Weight calculation:**
   - For each fulfilled item, get `g` (grams) field
   - Convert to kg: `weightInKg = (g / 1000) × quantity`
   - Sum all item weights: `totalWeight`

4. **City extraction:**
   - Get city from `address.city`
   - Validate city is not empty

5. **Delivery fee calculation:**
   - Call `computeCityBasedDeliveryFee(city, totalWeight, orderSubtotal)`
   - This uses `DeliveryConfig.calculateDeliveryFee()` which applies:
     - Base price for first 1kg
     - Additional price per kg for weight > 1kg
     - Free delivery if order meets city's threshold

6. **Order creation:**
   - Total = (Subtotal - Discount) + Delivery Fee
   - Create order with calculated delivery fee
   - Commit transaction

---

## Example Calculation

### Scenario: Bengaluru Order

**Cart Items:**
- Tomatoes: 500g × 2 = 1000g = 1kg, ₹40
- Potatoes: 750g × 1 = 750g = 0.75kg, ₹30
- Onions: 250g × 3 = 750g = 0.75kg, ₹45

**Calculations:**
```
Subtotal = ₹40 + ₹30 + ₹45 = ₹115
Total Weight = 1kg + 0.75kg + 0.75kg = 2.5kg

Delivery Fee Calculation (Bengaluru):
- Base price: ₹40 (first 1kg)
- Additional weight: 2.5kg - 1kg = 1.5kg → rounded up to 2kg
- Additional cost: 2kg × ₹10 = ₹20
- Total delivery fee: ₹40 + ₹20 = ₹60

Order Total = ₹115 + ₹60 = ₹175
```

---

## Error Responses

### 1. Missing City
**Status:** 400 Bad Request
```json
{
  "message": "Delivery city is required in address",
  "itemsOutOfStock": []
}
```

### 2. Unsupported City
**Status:** 400 Bad Request
```json
{
  "message": "Delivery not available for Delhi",
  "reason": "DELIVERY_NOT_AVAILABLE",
  "city": "Delhi",
  "itemsOutOfStock": []
}
```

### 3. Delivery Disabled
**Status:** 400 Bad Request
```json
{
  "message": "Delivery is currently disabled",
  "reason": "DELIVERY_NOT_AVAILABLE",
  "city": "Bengaluru",
  "itemsOutOfStock": []
}
```

### 4. Calculation Failed
**Status:** 500 Internal Server Error
```json
{
  "message": "Failed to calculate delivery fee",
  "itemsOutOfStock": []
}
```

---

## Important Notes

### Weight Source
- Weight is calculated from the `g` (grams) field in the Product model
- If a product doesn't have a `g` value, its weight is considered 0
- Products should have the `g` field populated for accurate delivery fee calculation

### City Matching
- City names are case-insensitive (e.g., "bengaluru", "Bengaluru", "BENGALURU" all match)
- City must exactly match one of the configured cities in the delivery settings

### Transaction Safety
- If delivery fee calculation fails or city is not supported, the entire order transaction is aborted
- Stock decrements are rolled back
- No partial orders are created

### Free Delivery
- Free delivery is applied when `orderSubtotal >= city.freeDeliveryThreshold`
- This is checked AFTER coupon discount is applied
- The `freeDeliveryApplied` flag is saved in the order

---

## Migration Guide

### For Existing Orders
- Old orders created before this update will retain their original delivery fee calculation
- No changes to existing order data

### For Frontend Integration
The frontend must now:
1. **Provide city in address:** Ensure `address.city` is included in the order request
2. **Handle new error codes:** Check for `reason: "DELIVERY_NOT_AVAILABLE"`
3. **Display city restriction:** Show users which cities are supported before checkout
4. **Real-time fee calculation:** Use the `/api/public/settings/delivery/calculate` endpoint to show delivery fee as users add items

**Example Frontend Request:**
```javascript
POST /api/orders
{
  "address": {
    "houseNo": "123",
    "landmark": "Near Park",
    "area": "Koramangala",
    "city": "Bengaluru",  // REQUIRED
    "state": "Karnataka",
    "pincode": "560034"
  },
  "paymentMode": "COD",
  "phone": "9876543210"
}
```

---

## Testing Checklist

- [ ] Order with Bengaluru address calculates correct delivery fee
- [ ] Order with Mysuru address calculates correct delivery fee
- [ ] Order with unsupported city (e.g., Delhi) is rejected
- [ ] Order without city in address is rejected
- [ ] Delivery fee is 0 when free delivery threshold is met
- [ ] Weight calculation handles products without `g` field (treats as 0)
- [ ] Weight calculation correctly multiplies by quantity
- [ ] Transaction is properly rolled back on delivery fee error
- [ ] Error messages are clear and helpful

---

## Backward Compatibility

The old `computeDeliveryFee()` function is still available in [src/utils/delivery.js](ecommerce-backend/src/utils/delivery.js) for backward compatibility with any other code that might use it. However, the order creation flow now exclusively uses the new `computeCityBasedDeliveryFee()` function.
