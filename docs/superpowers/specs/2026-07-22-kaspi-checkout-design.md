# Kaspi Pay & Cash Checkout Integration

## Overview
This design document outlines the implementation for integrating Kaspi Pay and Cash on Delivery (наличными) into the storefront checkout flow. 

As part of this change, the system shifts towards local order management: the `PushOrderJob` (MoySklad ERP integration) will be retained in the codebase but its dispatching will be disabled ("не использовать пока") during checkout, relying on Filament for order management instead.

## 1. Database & Model Changes
We will expand the `Order` model to track payment state locally:

**New Columns in `orders` table:**
- `payment_method`: enum/string (`kaspi`, `cash`).
- `payment_status`: enum/string (`unpaid`, `paid`, `refunded`). Default is `unpaid`.

*(Note: Existing ERP fields like `external_order_id` will remain but will simply be unused for now.)*

## 2. Checkout Flow Updates
Both Guest and Retail checkout flows (`CheckoutController` & `OrderPlacementService`) will be updated:

**Validation (`GuestCheckoutRequest` / `RetailCheckoutRequest`):**
- Add a required `payment_method` field (must be `kaspi` or `cash`).

**Order Placement:**
- The chosen `payment_method` and initial `payment_status = unpaid` are saved to the `Order`.
- **Kaspi Pay:** If `kaspi` is selected, immediately after saving the order, we generate a payment URL (invoice) via the Kaspi API.
- **PushOrderJob:** The line `PushOrderJob::dispatch($order);` will be commented out or conditionally disabled, as ERP sync is paused.

**API Response:**
- If Kaspi was selected, the response will include a `payment_url` field so the frontend can redirect the user or show a QR code.

## 3. Webhook (Kaspi Payment Confirmation)
A new public endpoint will be added to receive asynchronous payment confirmations from Kaspi:
- **Route:** `POST /api/webhooks/kaspi`
- **Behavior:**
  - Validate the Kaspi signature/payload.
  - Find the order by ID.
  - Update `payment_status` to `paid`.
  - Log the successful payment.

## 4. Tests
- Update `GuestCheckoutTest` and `RetailCheckoutTest` to pass `payment_method` in their payload.
- Assert that `PushOrderJob` is NOT dispatched.
- (Optional) Add a test for the Kaspi webhook endpoint processing a valid payload.
