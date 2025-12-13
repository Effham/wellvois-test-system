# License Management System Implementation

## Overview

This document describes the implementation of a license management system that automatically creates licenses based on the `number_of_seats` column in the tenant table. Licenses are created when subscriptions are created or updated via Stripe webhooks, and administrators can assign these licenses to practitioners.

## Architecture

### Database Structure

#### 1. `licenses` Table (Tenant-Level)
- **Purpose**: Stores individual licenses created based on tenant's `number_of_seats`
- **Fields**:
  - `id`: Primary key
  - `subscription_item_id`: Optional reference to Laravel Cashier's SubscriptionItem (unsignedBigInteger, nullable, no foreign key) - kept for tracking but not used for license creation logic
  - `license_key`: Unique license identifier (format: LIC-XXXXXXXX-XXXX-XXXX-XXXX)
  - `status`: Enum ('available', 'assigned', 'revoked')
  - `assigned_at`: Timestamp when license was assigned
  - `revoked_at`: Timestamp when license was revoked
  - `notes`: Optional notes about the license
  - `created_at`, `updated_at`: Timestamps

#### 2. `practitioner_license` Pivot Table (Tenant-Level)
- **Purpose**: Many-to-many relationship between licenses and practitioners
- **Fields**:
  - `id`: Primary key
  - `license_id`: Reference to licenses table (unsignedBigInteger, no foreign key)
  - `practitioner_id`: Reference to practitioners table (unsignedBigInteger, no foreign key)
  - `assigned_at`: Timestamp when license was assigned to practitioner
  - `assigned_by`: User ID who assigned the license (unsignedBigInteger, nullable, no foreign key)
  - `notes`: Optional notes about the assignment
  - `created_at`, `updated_at`: Timestamps
  - Unique constraint on `[license_id, practitioner_id]`

#### 3. `tenants` Table (Central Database)
- **Key Field**: `number_of_seats` (integer)
  - This column stores the total number of seats/licenses purchased for the tenant
  - Updated automatically when Stripe subscription webhooks are received
  - Used as the source of truth for license creation

### Models

#### License Model (`app/Models/Tenant/License.php`)
- **Relationships**:
  - `subscriptionItem()`: Optional BelongsTo Laravel Cashier's `SubscriptionItem` model (nullable)
  - `practitioners()`: BelongsToMany Practitioner model via `practitioner_license` pivot
- **Methods**:
  - `generateLicenseKey()`: Static method to generate unique license keys
  - `isAvailable()`: Check if license is available
  - `isAssigned()`: Check if license is assigned
  - Scopes: `available()`, `assigned()`

#### Practitioner Model (`app/Models/Practitioner.php`)
- **New Relationship**:
  - `licenses()`: BelongsToMany License model via `practitioner_license` pivot

#### Tenant Model (`app/Models/Tenant.php`)
- **Key Field**: `number_of_seats` (integer)
  - Updated from Stripe subscription quantity in webhook handlers
  - Used to determine how many licenses should exist

### Services

#### LicenseService (`app/Services/LicenseService.php`)
- **Purpose**: Handles license creation, update, and revocation logic based on `number_of_seats`
- **Primary Method**:
  - `createLicensesForTenantSeats($tenant)`: 
    - Creates licenses based on tenant's `number_of_seats` value
    - Creates additional licenses when `number_of_seats` increases
    - Revokes excess licenses when `number_of_seats` decreases
    - Handles seat changes intelligently (protects assigned licenses)
- **Helper Methods**:
  - `revokeExcessLicensesBySeats(int $excessCount)`: Revokes excess licenses with priority (unassigned first, then oldest assigned)
  - `revokeAllLicenses()`: Revokes all licenses when seats becomes 0
- **Legacy Methods** (kept for backward compatibility):
  - `createLicensesForSubscriptionItem()`: Old method based on subscription items (deprecated)
  - `createLicensesForTenant()`: Delegates to `createLicensesForTenantSeats()`

### Controllers

#### LicenseController (`app/Http/Controllers/Tenant/LicenseController.php`)
- **Routes**:
  - `GET /settings/licenses`: Display licenses index page
  - `POST /settings/licenses/{license}/attach`: Attach license to practitioner
  - `DELETE /settings/licenses/{license}/detach/{practitioner}`: Detach license from practitioner
  - `POST /settings/licenses/{license}/revoke`: Revoke a license
- **Methods**:
  - `index()`: Display all licenses with filtering and pagination
  - `attach()`: Attach a license to a practitioner
  - `detach()`: Detach a license from a practitioner
  - `revoke()`: Revoke a license (detaches from all practitioners)

### Integration Points

#### Stripe Webhook Handlers (`app/Http/Controllers/StripeWebhookController.php`)
- **Updated Methods**:
  - `handleCheckoutSessionCompleted()`: Sets `number_of_seats` from subscription quantity, creates licenses after tenant setup
  - `handlePaymentIntentSucceeded()`: Sets `number_of_seats` from subscription quantity, creates licenses after tenant setup
  - `handleSubscriptionCreated()`: Updates `number_of_seats` from Stripe subscription quantity, creates licenses
  - `handleSubscriptionUpdated()`: Updates `number_of_seats` from Stripe subscription quantity, creates/licenses licenses
  - `createLicensesForTenant($tenant)`: Helper method that calls `LicenseService::createLicensesForTenantSeats()`

### Frontend

#### Licenses Index Page (`resources/js/pages/settings/licenses/Index.tsx`)
- **Features**:
  - Two tabs: "All Licenses" and "Attach License"
  - Filtering by status and search
  - Pagination
  - License assignment dialog
  - License detachment and revocation actions

#### Settings Sidebar (`resources/js/Layouts/settings-layout.tsx`)
- Added "Licenses" menu item with `view-organization` permission

## License Creation Flow

### Automatic Creation

1. **Stripe Webhook Received**:
   - Stripe sends `customer.subscription.created`, `customer.subscription.updated`, `checkout.session.completed`, or `payment_intent.succeeded` event
   - Webhook handler extracts subscription quantity from Stripe subscription object
   - `number_of_seats` column in `tenants` table is updated with the quantity value

2. **License Service Processing**:
   - Service initializes tenant context
   - Reads `number_of_seats` from tenant record
   - Compares `number_of_seats` with existing license count (available + assigned licenses)
   - **If seats increased**: Creates additional licenses to match new `number_of_seats`
   - **If seats decreased**: Revokes excess licenses (see Quantity Decrease Handling below)
   - **If seats unchanged**: No action taken
   - **If seats is 0**: Revokes all licenses

3. **License Key Generation**:
   - Format: `LIC-XXXXXXXX-XXXX-XXXX-XXXX`
   - Uses random uppercase alphanumeric characters
   - Ensures uniqueness by checking database before assignment

### Quantity Decrease Handling

When `number_of_seats` decreases (e.g., from 10 to 8 licenses), the system handles excess licenses as follows:

#### Scenario: Subscription Renewal with Lower Quantity

**Example:**
- Previous `number_of_seats`: 10
- 3 licenses assigned to practitioners
- 7 licenses available
- New `number_of_seats`: 8

**System Behavior:**

1. **Priority-Based Revocation**:
   - **Step 1**: Revoke unassigned (available) licenses first
     - If there are 7 available licenses and only need to remove 2, the 2 oldest available licenses are revoked
   - **Step 2**: If more licenses need to be revoked after all available ones are gone:
     - Revoke assigned licenses starting with the oldest assigned ones
     - Detach the license from practitioners before revoking
     - Update license status to 'revoked' and set `revoked_at` timestamp

2. **Revocation Process**:
   - License is detached from all practitioners (removes entries from `practitioner_license` pivot table)
   - License status changes from 'assigned' or 'available' to 'revoked'
   - `revoked_at` timestamp is set
   - `assigned_at` is cleared
   - License remains in database for audit/history purposes

3. **Example Flow**:
   ```
   Initial State:
   - number_of_seats: 10
   - 3 assigned, 7 available
   
   After renewal (number_of_seats: 8):
   - 2 available licenses revoked (oldest first)
   - Result: 8 licenses total (3 assigned, 5 available)
   
   If renewal was for 5 seats:
   - 5 available licenses revoked
   - Result: 5 licenses total (3 assigned, 2 available)
   
   If renewal was for 2 seats:
   - 7 available licenses revoked
   - 1 assigned license revoked (oldest assigned)
   - Result: 2 licenses total (2 assigned, 0 available)
   ```

#### Important Notes:

- **Assigned licenses are protected**: The system prioritizes revoking unassigned licenses first
- **Oldest-first revocation**: When revoking assigned licenses, the oldest ones are revoked first
- **Practitioner impact**: If an assigned license is revoked, the practitioner loses access immediately
- **Audit trail**: All revoked licenses remain in the database with their revocation timestamp
- **No automatic reassignment**: If licenses are revoked, practitioners must be manually reassigned to available licenses

#### Edge Cases:

1. **Seats becomes 0**:
   - All licenses are revoked
   - All practitioner assignments are removed

2. **Seats increases**:
   - Only new licenses are created
   - Existing licenses (assigned or available) remain unchanged

3. **Tenant has no subscription**:
   - `number_of_seats` remains at 0 or last known value
   - No licenses are created if seats is 0

### Manual Assignment

1. **Admin navigates to Settings > Licenses**
2. **Selects "Attach License" tab or clicks "Attach" button on available license**
3. **Selects practitioner from dropdown**
4. **Optionally adds notes**
5. **Submits form**:
   - License status changes to 'assigned'
   - `assigned_at` timestamp is set
   - Entry created in `practitioner_license` pivot table
   - `assigned_by` is set to current user ID

## Key Design Decisions

### 1. Based on `number_of_seats`, Not Subscription Items

**Critical**: Licenses are created based on the `number_of_seats` column in the `tenants` table, NOT based on subscription item quantities. This provides:
- **Simplicity**: Single source of truth (`number_of_seats`)
- **Reliability**: Doesn't depend on Cashier's subscription sync timing
- **Flexibility**: Can be updated independently of subscription items

### 2. No Foreign Keys
- As requested, all relationships use simple unsignedBigInteger columns without foreign key constraints
- This provides flexibility and avoids migration complexity

### 3. Laravel Cashier Integration
- Uses Laravel Cashier's built-in `SubscriptionItem` model (`Laravel\Cashier\Subscription\SubscriptionItem`) for optional tracking
- `subscription_item_id` in licenses table is nullable and not used for license creation logic
- Leverages Cashier's automatic subscription synchronization for updating `number_of_seats`

### 4. Tenant-Level Implementation
- All licenses are tenant-specific
- License creation happens within tenant context
- Webhook handlers properly initialize/end tenant context

### 5. Status Management
- Three states: `available`, `assigned`, `revoked`
- Status automatically updates when license is assigned/detached/revoked
- Prevents double-assignment through status checks

### 6. Pivot Table Design
- Tracks assignment metadata (who assigned, when, notes)
- Allows for future audit trail
- Supports multiple practitioners per license if needed (though current UI shows one-to-one)

### 7. Quantity Decrease Handling
- **Priority System**: Unassigned licenses are revoked first, then assigned licenses (oldest first)
- **Protection**: Assigned licenses are protected until all unassigned licenses are exhausted
- **Automatic Detachment**: When assigned licenses are revoked, practitioners are automatically detached
- **Audit Trail**: Revoked licenses remain in database with revocation timestamp
- **No Data Loss**: License history is preserved for reporting and compliance

## Usage Examples

### Creating Licenses Manually (for testing)
```php
use App\Models\Tenant;
use App\Services\LicenseService;

$tenant = Tenant::find('tenant-id');
$licenseService = new LicenseService();
$licenseService->createLicensesForTenantSeats($tenant);
```

### Attaching License via Controller
```php
$license = License::find(1);
$license->practitioners()->attach($practitionerId, [
    'assigned_by' => Auth::id(),
    'assigned_at' => now(),
    'notes' => 'Initial assignment',
]);
$license->update(['status' => 'assigned', 'assigned_at' => now()]);
```

### Querying Licenses
```php
// Get all available licenses
$availableLicenses = License::available()->get();

// Get licenses for a practitioner
$practitioner = Practitioner::find(1);
$practitionerLicenses = $practitioner->licenses;

// Get practitioners for a license
$license = License::find(1);
$assignedPractitioners = $license->practitioners;

// Get revoked licenses
$revokedLicenses = License::where('status', 'revoked')->get();
```

### Handling Seat Decreases
```php
// When number_of_seats decreases, the service automatically handles it:
// Example: number_of_seats changed from 10 to 8

$tenant = Tenant::find('tenant-id');
$tenant->number_of_seats = 8; // Updated by webhook handler
$tenant->save();

// Service automatically revokes 2 excess licenses (unassigned ones first)
$licenseService = new LicenseService();
$licenseService->createLicensesForTenantSeats($tenant);

// Result:
// - If 7 licenses were available: 2 oldest available licenses revoked
// - If 3 licenses were assigned: They remain assigned (protected)
// - Final: 8 licenses total (3 assigned, 5 available)
```

## Routes

All routes are under `/settings/licenses` and require:
- Authentication
- Tenant context (`require-tenant` middleware)
- `view-organization` permission

## Permissions

- Uses existing `view-organization` permission for license management
- No new permissions required

## Future Enhancements

1. **License Expiration**: Add expiration dates and automatic revocation
2. **License Transfer**: Allow transferring licenses between practitioners
3. **License History**: Track all assignment/detachment history
4. **Bulk Operations**: Attach/detach multiple licenses at once
5. **License Reports**: Generate reports on license usage
6. **Email Notifications**: Notify practitioners when licenses are assigned

## Testing Considerations

1. Test license creation when `number_of_seats` is set/updated
2. Test license assignment to practitioners
3. Test license detachment
4. Test license revocation
5. Test duplicate prevention (licenses already exist for seats count)
6. Test filtering and search functionality
7. Test pagination
8. Test permission checks
9. **Test seat decrease scenarios**:
   - `number_of_seats` decreases from 10 to 8 (with some licenses assigned)
   - Verify unassigned licenses are revoked first
   - Verify assigned licenses are protected until all unassigned are revoked
   - Verify practitioners are detached when their licenses are revoked
   - Verify revocation timestamps are set correctly
10. **Test seat increase scenarios**:
   - `number_of_seats` increases from 8 to 10
   - Verify only new licenses are created
   - Verify existing licenses remain unchanged
11. **Test zero seats scenario**:
   - `number_of_seats` becomes 0
   - Verify all licenses are revoked
   - Verify all practitioner assignments are removed

## Migration Notes

- Migrations are created but not run (as requested)
- No foreign keys are used (simple unsignedBigInteger columns)
- All tables are tenant-level (in tenant database migrations folder)
- `subscription_item_id` in licenses table is nullable

## Real-World Scenario: Subscription Renewal with Lower Seats

### Example: 10 Seats → 8 Seats Renewal

**Initial State:**
- Tenant has `number_of_seats` = 10
- 3 licenses assigned to practitioners (Dr. Smith, Dr. Jones, Dr. Brown)
- 7 licenses available/unassigned

**Renewal Action:**
- Customer renews subscription but only purchases 8 seats (down from 10)
- Stripe webhook triggers `customer.subscription.updated` event
- Webhook handler extracts quantity from Stripe subscription: 8
- `tenants.number_of_seats` is updated to 8

**System Response:**

1. **LicenseService detects seat decrease**:
   - Current licenses: 10 (3 assigned, 7 available)
   - New `number_of_seats`: 8
   - Excess: 2 licenses

2. **Revocation Process**:
   - **Step 1**: Identifies 2 oldest unassigned licenses
   - **Step 2**: Revokes those 2 licenses:
     - Status changes: `available` → `revoked`
     - `revoked_at` timestamp set
     - Licenses remain in database for audit

3. **Final State**:
   - Total licenses: 8
   - Assigned licenses: 3 (Dr. Smith, Dr. Jones, Dr. Brown) - **Protected**
   - Available licenses: 5
   - Revoked licenses: 2 (marked as revoked, still in database)

**What Happens to Practitioners?**
- ✅ **No impact**: All 3 practitioners keep their licenses
- ✅ **No disruption**: Their access continues uninterrupted
- ✅ **Protection**: Assigned licenses are protected until all unassigned licenses are exhausted

### Example: 10 Seats → 2 Seats Renewal (Extreme Case)

**Initial State:**
- `number_of_seats`: 10
- 3 assigned, 7 available

**Renewal Action:**
- Customer renews with only 2 seats
- `number_of_seats` updated to 2

**System Response:**

1. **Excess Calculation**: 10 - 2 = 8 licenses to revoke

2. **Revocation Priority**:
   - **First**: Revoke all 7 available licenses
   - **Then**: Revoke 1 assigned license (oldest assigned)
   - **Result**: 2 licenses remain (2 assigned)

3. **Practitioner Impact**:
   - 2 practitioners keep their licenses
   - 1 practitioner loses their license (oldest assignment)
   - The detached practitioner must be manually reassigned if a license becomes available

**Important**: The system does NOT automatically reassign licenses. Administrators must manually reassign licenses through the Settings > Licenses interface.

### Key Takeaways

1. **Licenses are based on `number_of_seats`**: The tenant's `number_of_seats` column is the single source of truth
2. **Assigned licenses are protected**: System prioritizes revoking unassigned licenses first
3. **Oldest-first when needed**: If assigned licenses must be revoked, oldest assignments are revoked first
4. **Audit trail preserved**: All revoked licenses remain in database with revocation timestamps
5. **No automatic reassignment**: Practitioners who lose licenses must be manually reassigned
6. **Immediate effect**: Revocation happens immediately when `number_of_seats` is updated
7. **Webhook-driven**: `number_of_seats` is automatically updated from Stripe subscription webhooks
