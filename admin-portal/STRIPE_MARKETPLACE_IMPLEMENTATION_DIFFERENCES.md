# Stripe Marketplace Implementation: Documented vs Actual Differences

## Overview

This document outlines the differences between the documented Stripe marketplace setup (`STRIPE_MARKETPLACE_SETUP.md`) and the actual implementation in the codebase.

## What Matches ✅

### 1. Two Types of Stripe Accounts
Both documented and actual implementation correctly use:
- **Customer Account** (`stripe_id`): Tenant pays platform for subscription
- **Connected Account** (`stripe_account_id`): Tenant receives payments from customers

### 2. Database Schema
The database schema matches exactly:
- `stripe_account_id` - Stripe Connect account ID
- `stripe_onboarding_complete` - Whether tenant completed onboarding
- `stripe_requirements` - JSON of missing requirements
- `stripe_verified_at` - When account was fully verified

### 3. StripeConnectService
The service implementation matches the documentation:
- `createConnectedAccount()` - Creates Custom account for tenant ✅
- `updateAccountInformation()` - Updates business/individual/banking info ✅
- `refreshAccountRequirements()` - Syncs requirements from Stripe ✅
- `canAcceptPayments()` / `canReceivePayouts()` - Check account status ✅
- `createPaymentIntent()` - Create payment with platform fee ✅

### 4. Automatic Account Creation
Both document and actual implementation create connected accounts automatically during tenant creation.

---

## Key Differences ⚠️

### 1. Customer Account (`stripe_id`) Creation Timing

**Documented Approach:**
- Customer account is created **during tenant creation** in `TenantController@store`
- Uses Laravel Cashier's `createAsStripeCustomer()` method

**Actual Implementation:**
- Customer account is created **BEFORE tenant creation** during checkout/registration flow
- Created in multiple places:
  - `TenantController@store` (line 306-313) - During registration
  - `BillingController@createSetupCheckoutSession` (line 224-231) - During billing setup
- Customer ID is stored in session and passed to `CreateTenantJob`
- Job stores it in tenant: `'stripe_id' => $this->customerId` (line 138)

**Why Different:**
- Customer account is needed for Stripe Checkout **before** tenant exists
- Allows payment processing before tenant creation completes
- More efficient flow: payment → tenant creation

**Code References:**
- `app/Http/Controllers/TenantController.php:306-313`
- `app/Http/Controllers/BillingController.php:224-231`
- `app/Jobs/CreateTenantJob.php:138`

---

### 2. Connected Account Creation Location

**Documented Approach:**
- Connected account created in `TenantController@store` (line 830-845)

**Actual Implementation:**
- Connected account created in `CreateTenantJob` (line 362-386) - **Step 10**
- Also created in `TenantController@store` (line 830-845) as fallback/legacy path

**Why Different:**
- Tenant creation logic moved to queued job (`CreateTenantJob`)
- Connected account creation moved to job for consistency
- Ensures account creation happens as part of complete tenant setup process

**Code References:**
- `app/Jobs/CreateTenantJob.php:362-386`
- `app/Http/Controllers/TenantController.php:830-845`

---

### 3. Customer Account Creation Method

**Documented Approach:**
- Uses Laravel Cashier: `$tenant->createAsStripeCustomer()`

**Actual Implementation:**
- Uses **direct Stripe API**: `\Stripe\Customer::create()` (line 306-313 in TenantController)
- Also uses Cashier in some places: `$tenant->createAsStripeCustomer()` (BillingController line 1649)

**Why Different:**
- Direct API used when tenant doesn't exist yet (during registration)
- Cashier used when tenant already exists (during billing setup)
- Hybrid approach provides flexibility

**Code References:**
- Direct API: `app/Http/Controllers/TenantController.php:306-313`
- Cashier: `app/Http/Controllers/BillingController.php:1649`

---

### 4. Error Handling

**Documented Approach:**
- Implies errors would stop tenant creation

**Actual Implementation:**
- Connected account creation wrapped in try-catch
- Tenant creation **continues even if Stripe Connect fails** (line 380-386 in CreateTenantJob)
- Logs warning but doesn't throw exception
- Non-blocking: tenant can complete Stripe Connect onboarding later

**Why Different:**
- Tenant creation should succeed even if marketplace features fail
- Allows tenants to complete Stripe Connect onboarding later
- More resilient: doesn't block core tenant functionality

**Code References:**
- `app/Jobs/CreateTenantJob.php:380-386`

---

## Summary Table

| Aspect | Documented | Actual | Status |
|--------|-----------|--------|--------|
| **Customer Account Creation** | During tenant creation | Before tenant creation (during checkout) | ⚠️ Different |
| **Customer Account Method** | Cashier only | Direct API + Cashier | ⚠️ Different |
| **Connected Account Location** | TenantController | CreateTenantJob | ⚠️ Different |
| **Connected Account Creation** | Automatic | Automatic | ✅ Same |
| **Error Handling** | Implied strict | Graceful (continues on failure) | ⚠️ Different |
| **Database Schema** | Matches | Matches | ✅ Same |
| **Service Methods** | Matches | Matches | ✅ Same |

---

## Implementation Flow (Actual)

### Registration Flow:
1. User registers → Central user created
2. **Stripe Customer created** (direct API) → `cus_xxx` stored in session
3. Stripe Checkout Session created → User redirected to Stripe
4. Payment successful → Webhook triggers `CreateTenantJob`
5. Job creates tenant → Stores `stripe_id` from session
6. Job creates **Stripe Connect account** → `acct_xxx` stored in tenant
7. Tenant setup completes → User redirected to onboarding

### Billing Setup Flow (Existing Tenant):
1. User goes to billing setup
2. **Stripe Customer created** (Cashier) → `cus_xxx` stored in tenant
3. Payment method attached → Subscription created
4. Connected account already exists (from registration)

---

## Recommendations

### 1. Documentation Updates
Update `STRIPE_MARKETPLACE_SETUP.md` to reflect:
- Customer account created **before** tenant creation
- Connected account created in `CreateTenantJob` (not TenantController)
- Error handling is graceful (non-blocking)

### 2. Code Standardization (Optional)
Consider standardizing customer account creation:
- Use Cashier consistently when tenant exists
- Use direct API only when tenant doesn't exist
- Add comments explaining why each method is used

### 3. No Code Changes Needed
The actual implementation is **correct and better** than documented:
- More efficient flow (payment before tenant creation)
- More resilient (graceful error handling)
- Better separation of concerns (job handles tenant setup)

---

## Conclusion

The actual implementation differs from the documentation in several ways, but these differences are **intentional improvements**:

1. ✅ **Better Flow**: Customer account created before tenant (enables payment processing)
2. ✅ **Better Architecture**: Connected account in job (consistent with tenant setup)
3. ✅ **Better Resilience**: Graceful error handling (doesn't block tenant creation)
4. ✅ **Better Flexibility**: Hybrid approach (direct API + Cashier)

**Recommendation**: Update documentation to match actual implementation, as the implementation is superior to what was originally documented.

---

## File References

### Key Files:
- `app/Jobs/CreateTenantJob.php` - Main tenant creation job
- `app/Http/Controllers/TenantController.php` - Tenant creation controller
- `app/Http/Controllers/BillingController.php` - Billing setup controller
- `app/Services/StripeConnectService.php` - Stripe Connect service
- `app/Models/Tenant.php` - Tenant model with Stripe fields

### Documentation:
- `STRIPE_MARKETPLACE_SETUP.md` - Original documentation (needs update)

