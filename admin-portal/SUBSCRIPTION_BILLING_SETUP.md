# Subscription & Billing Setup Guide

## Quick Setup Checklist

### 1. Environment Variables
Add to your `.env` file:
```env
STRIPE_KEY=pk_test_...your_publishable_key...
STRIPE_SECRET=sk_test_...your_secret_key...
STRIPE_WEBHOOK_SECRET=whsec_...your_webhook_secret...
```

### 2. Run Migrations
```bash
php artisan migrate
```

Required migrations:
- `create_subscription_plans_table` - Stores your plans
- `add_billing_columns_to_tenants_table` - Adds billing fields to tenants
- Laravel Cashier migrations (automatically included)

### 3. Stripe Setup

#### Create Products & Prices in Stripe Dashboard
1. Go to https://dashboard.stripe.com/products
2. Click "Add Product"
3. The system will auto-sync when you create plans in the admin panel

#### Setup Webhook
1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://yourdomain.com/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy webhook secret to `.env`

### 4. Create Subscription Plans

#### Via Admin Panel
1. Navigate to `/plans`
2. Click "Create Plan"
3. Fill in:
   - Plan Name (e.g., "Monthly Plan", "Yearly Plan")
   - Slug (auto-generated from name)
   - Price
   - Billing Cycle (Monthly or Yearly)
   - Description
   - Features (list of benefits)
4. Click "Create Plan"
5. Plan automatically syncs to Stripe!

#### Plan Naming Convention
For featured display on registration:
- Include "clinic" or "pro" in slug for purple gradient styling
- Examples: `clinic-monthly`, `pro-yearly`, `basic-monthly`

### 5. How It Works

#### Registration Flow
1. User selects plan (Step 3)
2. User creates account (Step 4)
3. User redirected to billing setup
4. Stripe Checkout session created
5. User enters card details
6. Webhook confirms subscription
7. User redirected to dashboard

#### Abandoned Checkout Protection 🛡️
**What happens if user closes Stripe tab without paying?**
- Tenant is created with `requires_billing_setup = true` and `billing_status = pending`
- Stripe customer ID is null (not created yet)
- User account exists in central database
- **Multiple layers of protection enforce payment:**

**Protection Layer 1: Login Controller**
```php
// app/Http/Controllers/Auth/AuthenticatedSessionController.php
// Checks billing status BEFORE redirecting to tenant
if ($tenant->requires_billing_setup && $tenant->billing_status === 'pending') {
    return redirect()->route('billing.setup', []);
}
```

**Protection Layer 2: Tenant Selection**
```php
// routes/web.php - /sso/redirect
// Blocks access when user selects a tenant
if ($tenant->requires_billing_setup && $tenant->billing_status === 'pending') {
    return redirect()->route('billing.setup', []);
}
```

**Protection Layer 3: Global Middleware**
```php
// app/Http/Middleware/RequireBillingSetup.php
// Applied to ALL web routes as final safety net
// Intercepts ANY attempt to access protected pages
```

**Protection Layer 4: Guest Redirect Middleware**
```php
// app/Http/Middleware/CentralGuestAccess.php
// Prevents authenticated users from bypassing via guest routes
```

**User Experience:**
- ✅ Tenant exists (supports trial features if needed)
- ✅ User can login (account is valid)
- ❌ Cannot access any tenant pages
- 🔁 Auto-redirected to billing setup
- 📢 "Welcome Back" message with yellow payment alert
- 💳 Stripe customer created on billing page if null
- ✅ After payment: full access granted

#### Plan Management
- **Create**: Creates Stripe Product + Price, saves to DB
- **Update**: Creates new Stripe Price (prices immutable), archives old one
- **Delete**: Archives Stripe Product/Price, deletes from DB (only if no active subscriptions)

## Database Schema

### `subscription_plans`
- `id` - Plan ID
- `name` - Plan name
- `slug` - URL-friendly identifier
- `stripe_product_id` - Stripe product ID
- `stripe_price_id` - Stripe price ID
- `price` - Decimal amount
- `currency` - Currency code (default: usd)
- `billing_interval` - month or year
- `billing_interval_count` - Always 1 (monthly/yearly only)
- `description` - Plan description
- `features` - JSON array of features
- `is_active` - Boolean
- `sort_order` - Display order

### `tenants` (billing columns)
- `subscription_plan_id` - FK to subscription_plans
- `billing_status` - pending, active, past_due, canceled, incomplete
- `requires_billing_setup` - Boolean
- `billing_completed_at` - Timestamp
- `on_trial` - Boolean
- `trial_ends_at` - Timestamp (from Cashier)
- `subscribed_at` - Timestamp
- `subscription_ends_at` - Timestamp

## Troubleshooting

### Plan not showing on registration page
- Check `is_active` is true
- Check `billing_interval` is 'month' or 'year'
- Check `billing_interval_count` is 1
- Verify plan has features array

### Stripe sync failing
- Verify STRIPE_SECRET is set correctly
- Check Laravel logs: `storage/logs/laravel.log`
- Ensure Stripe API key has write permissions

### Webhook not working
- Verify STRIPE_WEBHOOK_SECRET is correct
- Check webhook endpoint is publicly accessible
- Test webhook in Stripe Dashboard
- Check Laravel logs for webhook errors

## Testing

### Test Mode
Use Stripe test keys (starting with `pk_test_` and `sk_test_`)

### Test Cards
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Authentication: `4000 0025 0000 3155`

### Test Workflow
1. Create a test plan
2. Go to `/register`
3. Complete registration
4. Select test plan
5. Use test card at checkout
6. Verify subscription in Stripe Dashboard
7. Check tenant `billing_status` updated to 'active'

## Going Live

1. Replace test keys with live keys in `.env`
2. Update webhook to production URL
3. Test complete registration flow
4. Monitor `subscription_plans` and `tenants` tables
5. Check Stripe Dashboard for successful payments

## Key Files

- **Backend**:
  - `app/Models/SubscriptionPlan.php` - Plan model
  - `app/Models/Tenant.php` - Tenant model (Billable)
  - `app/Http/Controllers/SubscriptionPlanController.php` - CRUD + Stripe sync
  - `app/Http/Controllers/BillingController.php` - Checkout handling
  - `app/Http/Controllers/TenantController.php` - Registration with plan
  - `app/Http/Middleware/RequireBillingSetup.php` - **Abandoned checkout protection**

- **Frontend**:
  - `resources/js/Pages/Plans/Index.tsx` - Plans list
  - `resources/js/Pages/Plans/Create.tsx` - Create/edit plan
  - `resources/js/Pages/RegisterPublic.tsx` - Registration with plan selection
  - `resources/js/Pages/Billing/Setup.tsx` - Billing setup page (with returning user alert)

- **Routes**:
  - `routes/web.php` - Plan routes, billing routes, registration
  
- **Configuration**:
  - `bootstrap/app.php` - Middleware registration (RequireBillingSetup in web group)

## Support

For issues:
1. Check Laravel logs: `tail -f storage/logs/laravel.log`
2. Check Stripe Dashboard for events
3. Verify webhook deliveries in Stripe
4. Test with Stripe CLI: `stripe listen --forward-to localhost/stripe/webhook`

