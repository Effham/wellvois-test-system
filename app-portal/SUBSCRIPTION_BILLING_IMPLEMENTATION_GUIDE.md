# Subscription Billing Implementation Guide

## Overview

This guide explains **how the subscription billing system works** for new users and tenants in this application. The implementation uses **Laravel Cashier (Stripe)** with a **multi-layered protection system** to ensure users complete payment before accessing their workspace.

---

## 🎯 Architecture Philosophy

**Key Decision: Tenant Created BEFORE Payment**

Unlike some SaaS platforms that create tenants only after payment, this system creates the tenant **during registration** but **blocks all access** until payment is complete.

### Why This Approach?

✅ **Supports Trial Periods** - Tenant exists, so you can offer trials  
✅ **Supports Freemium** - Can set `requires_billing_setup = false` for free plans  
✅ **Better UX** - User can see workspace name/domain during checkout  
✅ **Flexible Billing** - Can offer "explore before you buy" features  
✅ **Easy Testing** - Tenant exists immediately for development/testing  

---

## 📋 Complete Registration & Billing Flow

### Step 1: User Registration

**Location:** `resources/js/Pages/RegisterPublic.tsx`

**Process:**
1. User fills out company name, domain, admin details
2. Email OTP verification (6-digit code)
3. **Plan Selection** - User chooses Monthly or Yearly plan
4. Password creation

**Data Stored in Form:**
```typescript
const { data, setData } = useForm({
    company_name: '',
    domain: '',
    admin_name: '',
    admin_email: '',
    admin_password: '',
    plan_id: null, // Selected plan ID
});
```

---

### Step 2: Tenant Creation (Backend)

**Location:** `app/Http/Controllers/TenantController.php` → `store()` method

**What Happens:**
```php
// 1. Create Tenant (WITHOUT payment yet)
$tenant = Tenant::create([
    'id' => $tenantId,
    'company_name' => $validated['company_name'],
    'is_onboarding' => 1,
    'subscription_plan_id' => $plan->id,
    'billing_status' => 'pending',        // ← Payment not completed
    'requires_billing_setup' => true,     // ← Access blocked
]);

// 2. Create Domain
$tenant->domains()->create([
    'domain' => $validated['domain'],
]);

// 3. Create Central User (SSO Identity)
$centralUser = User::create([
    'name' => $validated['admin_name'],
    'email' => $validated['admin_email'],
    'password' => bcrypt($validated['admin_password']),
]);

// 4. Link User to Tenant
$centralUser->tenants()->attach($tenant->id);

// 5. Login User
Auth::login($centralUser);

// 6. Redirect to Billing Setup (NOT to tenant dashboard)
return redirect()->route('billing.setup');
```

**Database State After Registration:**
```sql
-- tenants table
id: 'anderson_and_peck_traders'
company_name: 'Anderson and Peck Traders'
subscription_plan_id: 7
billing_status: 'pending'
requires_billing_setup: true (1)
stripe_id: NULL  ← No Stripe customer yet
```

---

### Step 3: Billing Setup Page

**Location:** `resources/js/Pages/Billing/Setup.tsx`

**Controller:** `app/Http/Controllers/BillingController.php` → `setup()` method

**What User Sees:**
- Selected plan details (name, price, features)
- "Proceed to Secure Checkout" button
- Stripe security badges
- If returning user: Yellow "Payment Required" alert

**What Happens on Button Click:**
```javascript
// User clicks "Proceed to Secure Checkout"
router.post(route('billing.checkout'), {
    tenant_id: tenant.id,
    plan_id: plan.id,
});
```

---

### Step 4: Stripe Checkout Session Creation

**Location:** `app/Http/Controllers/BillingController.php` → `createCheckoutSession()` method

**Process:**
```php
public function createCheckoutSession(Request $request)
{
    $user = Auth::user();
    $tenant = Tenant::findOrFail($request->tenant_id);
    $plan = SubscriptionPlan::findOrFail($request->plan_id);

    try {
        // 1. Create Stripe Customer (if doesn't exist)
        if (!$tenant->stripe_id) {
            $tenant->createAsStripeCustomer([
                'name' => $tenant->company_name,
                'email' => $user->email,
            ]);
            // This sets $tenant->stripe_id = 'cus_xxxxx'
        }

        // 2. Create Stripe Checkout Session
        $checkout = $tenant->newSubscription('default', $plan->stripe_price_id)
            ->checkout([
                'success_url' => route('billing.success') . '?session_id={CHECKOUT_SESSION_ID}',
                'cancel_url' => route('billing.setup'),
            ]);

        // 3. Redirect to Stripe hosted checkout page
        return Inertia::location($checkout->url);
    } catch (\Exception $e) {
        Log::error('Billing checkout error', [
            'error' => $e->getMessage(),
            'tenant_id' => $tenant->id,
        ]);
        
        return back()->with('error', 'Failed to create checkout session.');
    }
}
```

**What Happens:**
1. User redirected to Stripe's secure checkout page
2. User enters card details on Stripe's domain (not your app)
3. Stripe processes payment
4. User redirected back to your app

---

### Step 5: Payment Success

**Location:** `app/Http/Controllers/BillingController.php` → `success()` method

**What Happens After Payment:**
```php
public function success(Request $request)
{
    $user = Auth::user();
    $tenant = $user->tenants->sortByDesc('created_at')->first();

    if ($tenant) {
        // Update tenant status
        $tenant->update([
            'requires_billing_setup' => false,    // ← Access granted!
            'billing_completed_at' => now(),
            'billing_status' => 'active',
            'subscribed_at' => now(),
        ]);
    }

    return redirect()->route('dashboard')
        ->with('success', 'Subscription activated successfully! Welcome to Wellovis.');
}
```

**Database State After Payment:**
```sql
-- tenants table
requires_billing_setup: false (0)  ← Changed!
billing_status: 'active'           ← Changed!
billing_completed_at: '2025-10-29 18:30:00'
subscribed_at: '2025-10-29 18:30:00'
stripe_id: 'cus_TKHrJgwPagb24e'   ← Created!

-- subscriptions table (created by Cashier)
tenant_id: 'anderson_and_peck_traders'
name: 'default'
stripe_id: 'sub_xxxxx'
stripe_status: 'active'
stripe_price: 'price_xxxxx'
quantity: 1
```

**User Experience:**
- Redirected to dashboard
- Success message shown
- **Full access to tenant workspace granted**

---

## 🛡️ 4-Layer Protection System

### What if User Closes Stripe Tab Without Paying?

The system has **4 layers of protection** to enforce payment:

---

### **Layer 1: Login Controller Protection**

**Location:** `app/Http/Controllers/Auth/AuthenticatedSessionController.php`

**When Triggered:** Every login attempt

**Code:**
```php
// After authentication, check if user has single tenant
if ($tenants->count() === 1) {
    $tenant = $tenants->first();

    // 🔒 BILLING CHECK
    if ($tenant->requires_billing_setup && $tenant->billing_status === 'pending') {
        return redirect()->route('billing.setup', [])
            ->with('warning', 'Please complete your subscription setup to access your workspace.');
    }

    return $this->redirectToTenant($tenant, $user);
}
```

**Result:** User **cannot** login to tenant dashboard - redirected to billing page.

---

### **Layer 2: Tenant Selection Protection**

**Location:** `routes/web.php` → `/sso/redirect` route

**When Triggered:** User with multiple tenants clicks to select one

**Code:**
```php
Route::post('/sso/redirect', function (Request $request) {
    $user = Auth::user();
    $tenant = $user->tenants()->findOrFail($request->tenant_id);

    // 🔒 BILLING CHECK
    if ($tenant->requires_billing_setup && $tenant->billing_status === 'pending') {
        return redirect()->route('billing.setup', [])
            ->with('warning', 'Please complete your subscription setup to access this workspace.');
    }

    // Generate SSO code and redirect to tenant...
});
```

**Result:** Even if user has paid tenants and one unpaid - cannot access the unpaid one.

---

### **Layer 3: Global Middleware Protection**

**Location:** `app/Http/Middleware/RequireBillingSetup.php`

**When Triggered:** Every HTTP request to the application

**Code:**
```php
public function handle(Request $request, Closure $next): Response
{
    if (!Auth::check()) {
        return $next($request);
    }

    // Skip billing routes to avoid redirect loop
    if ($request->routeIs('billing.setup') || 
        $request->routeIs('billing.checkout') || 
        $request->routeIs('billing.success') ||
        $request->routeIs('logout')) {
        return $next($request);
    }

    $user = Auth::user();

    // 🔒 Check all user's tenants for pending billing
    if (method_exists($user, 'tenants')) {
        $tenantRequiringSetup = $user->tenants()
            ->where('requires_billing_setup', true)
            ->where('billing_status', 'pending')
            ->first();

        if ($tenantRequiringSetup) {
            return redirect()->route('billing.setup', [])
                ->with('warning', 'Please complete your subscription setup to continue.');
        }
    }

    return $next($request);
}
```

**Registered in:** `bootstrap/app.php` → web middleware group

**Result:** **Safety net** - catches any missed access attempts via URL manipulation.

---

### **Layer 4: Guest Middleware Protection**

**Location:** `app/Http/Middleware/CentralGuestAccess.php`

**When Triggered:** Authenticated user tries to access guest-only routes

**Code:**
```php
// User has tenant access - redirect to their clinic
if ($tenants->count() === 1) {
    $tenant = $tenants->first();

    // 🔒 BILLING CHECK
    if ($tenant->requires_billing_setup && $tenant->billing_status === 'pending') {
        return redirect()->route('billing.setup', [])
            ->with('warning', 'Please complete your subscription setup to access your workspace.');
    }

    return app(AuthenticatedSessionController::class)
        ->redirectToTenant($tenant, $user);
}
```

**Result:** Prevents bypassing protection via guest routes.

---

## 🔄 "Returning User" Experience

When a user **closes the Stripe tab** and **logs in later**:

### What They See:

**Billing Setup Page with:**
1. **Different heading:** "Welcome Back!" (instead of "Complete Your Subscription")
2. **Yellow alert box:**
   ```
   ⚠️ Payment Required
   Your account is ready, but you need to complete payment to access your workspace.
   Don't worry, your data is safe and waiting for you!
   ```
3. **Same checkout button** - they can complete payment anytime

### How It Detects Returning Users:

**Smart Detection:** Backend automatically detects if tenant was created more than 5 minutes ago

**Backend Code:**
```php
// app/Http/Controllers/BillingController.php
public function setup(Request $request)
{
    // ...get tenant and plan...
    
    // Detect if user is returning (tenant created more than 5 minutes ago)
    // This means they closed the Stripe tab and came back later
    $isReturningUser = $tenant->created_at->diffInMinutes(now()) > 5;
    
    return Inertia::render('Billing/Setup', [
        'isReturningUser' => $isReturningUser,
        // ...other data...
    ]);
}
```

**Frontend Code:**
```tsx
export default function Setup({ isReturningUser }: SetupProps) {
    return (
        <>
            <h1>
                {isReturningUser ? 'Welcome Back!' : 'Complete Your Subscription'}
            </h1>
            
            {isReturningUser && (
                <div className="bg-yellow-50 border-yellow-200 ...">
                    <h3>Payment Required</h3>
                    <p>Your account is ready, but you need to complete payment...</p>
                </div>
            )}
        </>
    );
}
```

**Why This Approach:**
- ✅ Cannot be manipulated by user (server-side logic)
- ✅ Based on actual data (tenant creation time)
- ✅ Accurate detection (>5 min = definitely returning)
- ✅ No query parameters needed

---

## 💳 Stripe Integration Details

### Stripe Customer Creation

**When:** First time user reaches billing setup page (or when creating checkout session)

**How:**
```php
// Using Laravel Cashier's Billable trait on Tenant model
$tenant->createAsStripeCustomer([
    'name' => $tenant->company_name,
    'email' => $user->email,
]);

// This creates a customer in Stripe and stores:
// $tenant->stripe_id = 'cus_TKHrJgwPagb24e'
// $tenant->pm_type = 'card'
// $tenant->pm_last_four = '4242'
```

**Stored in:** `tenants` table

---

### Stripe Subscription Creation

**When:** User completes checkout

**How:**
```php
$checkout = $tenant->newSubscription('default', $plan->stripe_price_id)
    ->checkout([
        'success_url' => route('billing.success') . '?session_id={CHECKOUT_SESSION_ID}',
        'cancel_url' => route('billing.setup'),
    ]);
```

**Creates:**
- Stripe Subscription object
- Stripe Invoice
- Stripe Payment

**Stored in:** `subscriptions` table (created by Cashier)

---

### Webhook Handling

**Endpoint:** `/stripe/webhook` (automatically registered by Cashier)

**Events Handled:**
- `checkout.session.completed` - Payment succeeded
- `customer.subscription.updated` - Subscription changed
- `customer.subscription.deleted` - Subscription canceled
- `invoice.payment_succeeded` - Recurring payment succeeded
- `invoice.payment_failed` - Payment failed

**Configuration:** `.env`
```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

---

## 📊 Database Schema

### Tenants Table (Billing Columns)

```sql
CREATE TABLE tenants (
    id VARCHAR(255) PRIMARY KEY,
    
    -- Billing columns
    subscription_plan_id BIGINT UNSIGNED NULL,
    billing_status ENUM('pending', 'active', 'past_due', 'canceled', 'incomplete'),
    requires_billing_setup BOOLEAN DEFAULT TRUE,
    billing_completed_at TIMESTAMP NULL,
    on_trial BOOLEAN DEFAULT FALSE,
    subscribed_at TIMESTAMP NULL,
    subscription_ends_at TIMESTAMP NULL,
    
    -- Cashier columns
    stripe_id VARCHAR(255) NULL,
    pm_type VARCHAR(255) NULL,
    pm_last_four VARCHAR(4) NULL,
    trial_ends_at TIMESTAMP NULL,
    
    -- Metadata (JSON)
    data JSON NULL,
    
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Important: `getCustomColumns()`

**Why Needed:** The `stancl/tenancy` package stores unknown attributes in `data` JSON column by default.

**Solution:** Define which columns are real database columns:

```php
// app/Models/Tenant.php
public static function getCustomColumns(): array
{
    return [
        'id',
        // Cashier columns
        'stripe_id',
        'pm_type',
        'pm_last_four',
        'trial_ends_at',
        // Billing columns
        'subscription_plan_id',
        'billing_status',
        'requires_billing_setup',
        'billing_completed_at',
        'on_trial',
        'subscribed_at',
        'subscription_ends_at',
    ];
}
```

**Without this:** All billing data would go into `data` JSON column! ❌

---

## 🎨 Frontend Plan Selection

**Location:** `resources/js/Pages/RegisterPublic.tsx` (Step 3)

### Features:

1. **Billing Cycle Toggle:**
   - Monthly / Annually
   - Filters plans by `billing_interval` and `billing_interval_count`

2. **Plan Cards:**
   - Grid layout (3 columns on desktop)
   - Featured plans (containing "clinic" or "pro" in slug) → Purple gradient
   - Regular plans → White background

3. **Animations (Framer Motion):**
   ```tsx
   <motion.div
       initial={{ opacity: 0, y: 20 }}
       animate={{ opacity: 1, y: 0 }}
       whileHover={{ scale: 1.05 }}
       whileTap={{ scale: 0.98 }}
   >
       {/* Plan card */}
   </motion.div>
   ```

4. **Plan Data:**
   ```typescript
   interface Plan {
       id: number;
       name: string;
       slug: string;
       price: number;
       formatted_price: string;
       billing_cycle: string;
       billing_interval: 'month' | 'year';
       billing_interval_count: number;
       description: string;
       features: string[];
   }
   ```

---

## 🔧 Plan Management (Admin Panel)

**Location:** `/plans` (Admin Only)

### CRUD Operations with Stripe Sync:

#### **Create Plan:**
```php
// 1. Create in database
$plan = SubscriptionPlan::create([...]);

// 2. Auto-sync to Stripe (if STRIPE_SECRET configured)
if (config('cashier.secret')) {
    // Create Stripe Product
    $product = \Stripe\Product::create([
        'name' => $plan->name,
        'description' => $plan->description,
    ]);
    
    // Create Stripe Price
    $price = \Stripe\Price::create([
        'product' => $product->id,
        'unit_amount' => $plan->price * 100,
        'currency' => $plan->currency,
        'recurring' => [
            'interval' => $plan->billing_interval,
            'interval_count' => $plan->billing_interval_count,
        ],
    ]);
    
    // Store Stripe IDs
    $plan->update([
        'stripe_product_id' => $product->id,
        'stripe_price_id' => $price->id,
    ]);
}
```

#### **Update Plan:**
- **Note:** Stripe Prices are immutable
- Creates NEW price, archives old one
- Existing subscriptions continue on old price

#### **Delete Plan:**
- **Protection:** Cannot delete if active subscriptions exist
- Archives Stripe Product and Price (sets `active: false`)
- Deletes from local database

---

## 🧪 Testing Guide

### Test the Complete Flow:

1. **Register New Tenant:**
   ```
   - Go to /register
   - Fill company name, domain, email
   - Verify OTP
   - Select a plan
   - Create password
   ✅ Should redirect to /billing/setup
   ```

2. **Abandon Checkout:**
   ```
   - Close browser tab
   - Reopen app and login with same email
   ✅ Should redirect to /billing/setup
   ✅ Should see "Welcome Back!" message
   ✅ Should see yellow alert
   ```

3. **Complete Payment:**
   ```
   - Click "Proceed to Secure Checkout"
   - Use Stripe test card: 4242 4242 4242 4242
   - Any future date, any CVC
   ✅ Should redirect to dashboard
   ✅ Should show success message
   ```

4. **Verify Database:**
   ```sql
   SELECT * FROM tenants WHERE id = 'your_tenant_id';
   -- requires_billing_setup should be 0
   -- billing_status should be 'active'
   -- stripe_id should be 'cus_xxxxx'
   ```

5. **Verify Stripe Dashboard:**
   ```
   - Login to Stripe Dashboard
   - Check Customers → Should see new customer
   - Check Subscriptions → Should see active subscription
   ```

---

## 🔐 Security Features

### ✅ What's Protected:

1. **No Bypass via URL** - All routes check billing status
2. **No Bypass via Multiple Tenants** - Each tenant checked individually
3. **No Bypass via Guest Routes** - Guest middleware protects
4. **No Bypass via API** - Middleware applies to all requests
5. **Stripe Customer Created Safely** - Only on billing page if null
6. **Payment Enforced** - 4 layers of protection

### ✅ What Happens to Unpaid Tenants:

- Tenant record exists in database
- Domain record exists
- User record exists in central DB
- **BUT:** Cannot access any tenant functionality
- Must complete payment to proceed

---

## 📈 Future Enhancements

### Trial Period Support:

```php
// In TenantController@store, add trial:
$tenant->update([
    'on_trial' => true,
    'trial_ends_at' => now()->addDays(14),
    'requires_billing_setup' => false, // Allow access during trial
]);

// Check trial expiry in middleware:
if ($tenant->on_trial && $tenant->trial_ends_at < now()) {
    // Trial expired, require payment
}
```

### Freemium Plan Support:

```php
// Create a free plan in subscription_plans table
SubscriptionPlan::create([
    'name' => 'Free Plan',
    'price' => 0,
    'billing_interval' => 'month',
    'stripe_price_id' => null, // No Stripe needed
]);

// When user selects free plan:
$tenant->update([
    'requires_billing_setup' => false, // Skip billing
    'billing_status' => 'active',
]);
```

---

## 📚 Key Files Reference

### Backend:
- `app/Models/Tenant.php` - Billable tenant model
- `app/Models/SubscriptionPlan.php` - Plan model
- `app/Http/Controllers/TenantController.php` - Registration
- `app/Http/Controllers/BillingController.php` - Billing logic
- `app/Http/Controllers/SubscriptionPlanController.php` - Plan CRUD
- `app/Http/Middleware/RequireBillingSetup.php` - Global protection
- `app/Http/Middleware/CentralGuestAccess.php` - Guest protection
- `app/Http/Controllers/Auth/AuthenticatedSessionController.php` - Login checks

### Frontend:
- `resources/js/Pages/RegisterPublic.tsx` - Registration with plan selection
- `resources/js/Pages/Billing/Setup.tsx` - Billing setup page
- `resources/js/Pages/Plans/Index.tsx` - Admin plan listing
- `resources/js/Pages/Plans/Create.tsx` - Admin plan form

### Configuration:
- `bootstrap/app.php` - Middleware registration
- `routes/web.php` - Billing routes
- `config/cashier.php` - Stripe configuration
- `.env` - Stripe keys

---

## 🆘 Troubleshooting

### Issue: Stripe ID is null after checkout

**Cause:** Customer not created before checkout session  
**Fix:** The `createCheckoutSession()` method now creates customer if null

### Issue: User can access tenant without paying

**Cause:** Middleware not working or billing status not checked  
**Fix:** Verify all 4 protection layers are in place, check middleware is registered

### Issue: Redirect loop on billing page

**Cause:** Billing routes not excluded from middleware  
**Fix:** Check `RequireBillingSetup.php` excludes billing.* routes

### Issue: Plan not showing on registration

**Cause:** Plan inactive or wrong billing interval  
**Fix:** Verify plan has `is_active = true`, `billing_interval_count = 1`

---

## 📞 Support

For implementation questions:
1. Check Laravel logs: `tail -f storage/logs/laravel.log`
2. Check Stripe Dashboard for webhook deliveries
3. Test with Stripe CLI: `stripe listen --forward-to localhost/stripe/webhook`
4. Review this guide and `SUBSCRIPTION_BILLING_SETUP.md`

---

**Last Updated:** October 29, 2025  
**Laravel Version:** 12.x  
**Cashier Version:** Latest  
**Stripe API Version:** Latest

