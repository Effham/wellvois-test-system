# Login Flow and Role-Based Access Control

## Overview

The Wellovis EMR implements a **tenant-specific role-based access control system** where users are granted access based on their **roles assigned in each tenant**, not their central practitioner/patient status. This allows users to have different roles and access levels in different clinics.

---

## Core Principle

**Tenant-Specific Roles Override Central Status**

- Users can be practitioners/patients in the central database
- But their **access in each tenant is determined by their role in that tenant's database**
- A user can be **Admin in Clinic A** and **Practitioner in Clinic B** - they get different interfaces based on which clinic they're accessing
- Roles are stored in **tenant databases**, allowing different roles per tenant

---

## Login Flows

### 1. Intent Selector Page (`/login`)

Users first select their login type:
- **Practitioner Login** - For practitioners
- **Patient Login** - For patients
- **Admin Login** (`/admin/login`) - For administrators and staff

### 2. Practitioner Login (`/login/practitioner`)

**Requirements:**
- User MUST have a record in the central `practitioners` table
- If no practitioner record exists → Logout and redirect with error

**Post-Login Flow:**
1. Authenticate credentials
2. Check 2FA if enabled
3. **Tenant Resolution:**
   - **No Tenants**: Redirect to Central Practitioner Dashboard
   - **One Tenant**: Redirect directly to that tenant's dashboard
   - **Multiple Tenants**: Show tenant selection page

**In Tenant Context:**
- User's role in that tenant determines their dashboard:
  - **Admin/Staff role** → Admin Dashboard (onboarding checked)
  - **Practitioner role only** → Practitioner Dashboard
  - **Patient role** → Patient Dashboard

### 3. Patient Login (`/login/patient`)

**Requirements:**
- User MUST have a record in the central `patients` table
- If no patient record exists → Logout and redirect with error

**Post-Login Flow:**
1. Authenticate credentials
2. Check 2FA if enabled
3. **Always redirect** to Central Patient Dashboard
4. **No tenant selection** - patients always use central dashboard

### 4. Admin Login (`/admin/login`)

**Requirements:**
- **NO requirement** for practitioner/patient table entries
- Pure patients (not practitioners) are blocked
- Practitioners can login via admin (they may be admin in one tenant, practitioner in another)

**Post-Login Flow:**
1. Authenticate credentials
2. Check 2FA if enabled
3. **Tenant Resolution (Prioritized by Role):**
   - **Filter tenants** where user has Admin/Staff role (not Practitioner-only)
   - **No Admin Tenants**: Fallback to all tenants or Central Dashboard
   - **One Admin Tenant**: Redirect directly to that tenant's dashboard
   - **Multiple Admin Tenants**: Show tenant selection page

**In Tenant Context:**
- User's role in that tenant determines their dashboard:
  - **Admin/Staff role** → Admin Dashboard (highest priority)
  - **Patient role** → Patient Dashboard
  - **Practitioner role only** → Practitioner Dashboard

---

## Role Priority in Tenant Dashboard

When a user accesses a tenant dashboard (`/dashboard`), the system checks roles in this priority order:

1. **Admin/Staff Role** (Highest Priority)
   - If user has Admin or Staff role → Show Admin Dashboard
   - Onboarding is checked and shown if incomplete

2. **Patient Role**
   - If user has Patient role → Redirect to Patient Dashboard

3. **Practitioner Role**
   - If user has only Practitioner role → Redirect to Practitioner Dashboard

**Example Scenarios:**

- **User with Admin + Practitioner roles**: Gets Admin Dashboard
- **User with only Practitioner role**: Gets Practitioner Dashboard
- **User with Patient role**: Gets Patient Dashboard

---

## Multi-Clinic Scenarios

### Scenario 1: User in Single Clinic

**Practitioner Login:**
- User logs in → Redirected directly to that clinic's tenant dashboard
- Role in that tenant determines interface (Admin/Practitioner/Patient)

**Admin Login:**
- User logs in → Redirected directly to that clinic's tenant dashboard
- Role in that tenant determines interface (Admin/Practitioner/Patient)

**Patient Login:**
- User logs in → Always redirected to Central Patient Dashboard
- No tenant selection

### Scenario 2: User in Multiple Clinics

**Practitioner Login:**
- User logs in → Tenant selection page shown
- User selects clinic → Redirected to that clinic's tenant dashboard
- **Tenant switcher appears** in sidebar for easy switching

**Admin Login:**
- User logs in → Tenant selection page shown (filtered by admin/staff tenants)
- User selects clinic → Redirected to that clinic's tenant dashboard
- **Tenant switcher appears** in sidebar for easy switching

**Patient Login:**
- User logs in → Always redirected to Central Patient Dashboard
- No tenant selection (patients use central dashboard)

### Scenario 3: User with Different Roles in Different Clinics

**Example: Admin in Clinic A, Practitioner in Clinic B**

1. **Admin Login:**
   - System filters tenants where user has Admin role → Only Clinic A shown
   - User selects Clinic A → Gets Admin Dashboard
   - Tenant switcher shows Clinic B (if user is also practitioner there)

2. **Practitioner Login:**
   - System shows all clinics where user is practitioner → Clinic B shown
   - User selects Clinic B → Gets Practitioner Dashboard
   - Tenant switcher shows Clinic A (if user has access)

3. **Switching Between Clinics:**
   - When switching from Clinic A (Admin) to Clinic B (Practitioner):
     - User's role context changes
     - Interface changes from Admin Dashboard to Practitioner Dashboard
   - When switching from Clinic B (Practitioner) to Clinic A (Admin):
     - User's role context changes
     - Interface changes from Practitioner Dashboard to Admin Dashboard

---

## Tenant Switcher Visibility

The tenant switcher appears in the sidebar when:

1. **User is a practitioner** with multiple tenants
2. **User is a patient** with multiple tenants
3. **User is an admin** with multiple tenants (even if also practitioner)
4. **User has multiple roles** across different clinics

The tenant switcher allows users to:
- See all clinics they have access to
- Switch between clinics with one click
- See their role in each clinic (if displayed)
- Access different interfaces based on their role in each clinic

---

## Role Assignment in Tenants

### How Roles Are Assigned

1. **During Tenant Creation:**
   - When a user creates a new tenant, they get Admin role in that tenant
   - Their central practitioner/patient status doesn't affect this

2. **During Admin Login:**
   - If user is a practitioner (central), they get Practitioner role assigned in tenant
   - If user has no roles, they get Admin role assigned by default
   - Roles are stored in tenant database

3. **During User Addition:**
   - When adding users to tenants, roles are assigned based on context
   - Users can have different roles in different tenants

### Role Storage

- **Roles are stored in tenant databases** - each tenant has its own role assignments
- **Central database** stores practitioner/patient status (for login validation)
- **Tenant databases** store role assignments (for access control)

---

## Access Control Flow

### Step-by-Step Access Determination

1. **User logs in** via Practitioner/Patient/Admin login
2. **Tenant is resolved** (single tenant → direct, multiple → selection)
3. **User is redirected** to tenant dashboard
4. **System checks user's roles** in that tenant database:
   - Checks for Admin/Staff role first
   - Then checks for Patient role
   - Then checks for Practitioner role
5. **Dashboard is determined** based on role priority
6. **Onboarding is checked** (for admin users)
7. **Interface is rendered** based on role

### Key Points

- **Tenant-specific roles override central status**
- **Role priority**: Admin/Staff > Patient > Practitioner
- **Different roles = Different interfaces**
- **Switching tenants = Changing role context**

---

## Implementation Details

### Files Involved

1. **`app/Http/Controllers/Auth/AuthenticatedSessionController.php`**
   - Handles login authentication
   - Resolves tenant relationships
   - Filters tenants by role for admin login
   - Ensures tenant users exist with proper roles

2. **`routes/tenant.php`** (Dashboard Route)
   - Checks user roles in tenant database
   - Prioritizes Admin/Staff role over Practitioner role
   - Redirects to appropriate dashboard based on role

3. **`app/Http/Middleware/HandleInertiaRequests.php`**
   - Loads tenant list for tenant switcher
   - Provides user role information to frontend
   - Determines tenant switcher visibility

4. **`resources/js/components/app-sidebar-header.tsx`**
   - Displays tenant switcher in sidebar
   - Handles tenant switching
   - Shows tenant switcher based on user roles and tenant count

### Key Methods

**`getTenantsByIntent(User $user, string $intent)`**
- Filters tenants based on login intent
- Admin intent: Returns tenants where user has Admin/Staff role
- Practitioner intent: Returns all tenants where user is practitioner

**`ensureAdminUserInTenant(User $centralUser, Tenant $tenant, bool $isPractitioner)`**
- Ensures user exists in tenant database
- Assigns roles based on practitioner status
- Syncs user data between central and tenant databases

---

## Examples

### Example 1: Admin Who Created Their Own Clinic

**User Profile:**
- Central: Practitioner
- Clinic A: Admin (created clinic)
- Clinic B: Practitioner (works there)

**Login Flow:**
1. User logs in via Admin Login
2. System filters tenants with Admin role → Only Clinic A shown
3. User redirected to Clinic A → Gets Admin Dashboard
4. Tenant switcher shows Clinic B (as practitioner)
5. If user switches to Clinic B → Gets Practitioner Dashboard

### Example 2: Practitioner in Multiple Clinics

**User Profile:**
- Central: Practitioner
- Clinic A: Practitioner
- Clinic B: Practitioner

**Login Flow:**
1. User logs in via Practitioner Login
2. System shows all clinics → Both Clinic A and B shown
3. User selects Clinic A → Gets Practitioner Dashboard
4. Tenant switcher shows Clinic B
5. If user switches to Clinic B → Gets Practitioner Dashboard

### Example 3: Admin Who Is Also Practitioner

**User Profile:**
- Central: Practitioner
- Clinic A: Admin + Practitioner roles
- Clinic B: Practitioner only

**Login Flow:**
1. User logs in via Admin Login
2. System filters tenants with Admin role → Only Clinic A shown
3. User redirected to Clinic A → Gets **Admin Dashboard** (Admin role prioritized)
4. Tenant switcher shows Clinic B
5. If user switches to Clinic B → Gets Practitioner Dashboard

---

## Summary

### Key Takeaways

1. **Roles are tenant-specific** - Each tenant database stores its own role assignments
2. **Role priority matters** - Admin/Staff > Patient > Practitioner
3. **Central status ≠ Tenant access** - Being a practitioner centrally doesn't guarantee practitioner access in all tenants
4. **Multi-clinic support** - Users can have different roles in different clinics
5. **Tenant switcher** - Appears when users have multiple tenants and appropriate roles
6. **Onboarding** - Checked for admin users, shown if incomplete

### Access Determination

```
User logs in → Tenant resolved → Check roles in tenant database → 
Role priority: Admin > Patient > Practitioner → 
Show appropriate dashboard → 
Tenant switcher (if multiple tenants)
```

---

## Testing Scenarios

### Test Case 1: Admin in One Clinic
- **Setup**: User is admin in Clinic A only
- **Expected**: Admin login → Direct redirect to Clinic A → Admin Dashboard

### Test Case 2: Admin + Practitioner in Multiple Clinics
- **Setup**: User is admin in Clinic A, practitioner in Clinic B
- **Expected**: Admin login → Tenant selection (Clinic A only) → Admin Dashboard → Tenant switcher shows Clinic B

### Test Case 3: Practitioner in Multiple Clinics
- **Setup**: User is practitioner in Clinic A and Clinic B
- **Expected**: Practitioner login → Tenant selection → Select clinic → Practitioner Dashboard → Tenant switcher shows other clinic

### Test Case 4: Admin Who Is Also Practitioner in Same Clinic
- **Setup**: User has both Admin and Practitioner roles in Clinic A
- **Expected**: Admin login → Clinic A → **Admin Dashboard** (Admin role prioritized)

---

## Conclusion

The system ensures that **users get access based on their tenant-specific roles**, not their central practitioner/patient status. This allows for flexible multi-clinic scenarios where users can have different roles and access levels in different clinics, with the interface adapting accordingly.
