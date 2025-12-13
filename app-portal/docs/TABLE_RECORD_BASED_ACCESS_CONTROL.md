# Table Record Based Access Control - Complete Guide & Implementation Plan

## Table of Contents

1. [Overview](#overview)
2. [Current System Behavior](#current-system-behavior)
3. [Proposed System Behavior](#proposed-system-behavior)
4. [Complete Behavior Guide](#complete-behavior-guide)
5. [Implementation Plan](#implementation-plan)
6. [Testing Checklist](#testing-checklist)
7. [Migration Notes](#migration-notes)

---

## Overview

### Problem Statement

The current system uses **mixed logic** for determining practitioner/patient access:
- Some places check **roles** (`Practitioner`/`Patient` roles)
- Some places check **table records** (practitioner/patient tables)
- This causes **conflicts** when a user has Admin/Staff role + practitioner/patient record

### Solution

**Refactor to use table records as the source of truth for practitioner/patient identity:**
- **Table records** = Identity (practitioner/patient)
- **Roles** = Permissions only (Admin/Staff/Custom)
- **No conflicts**: Users can be Admin + Practitioner simultaneously

### Key Benefits

1. ✅ **No Role Conflicts**: Admin role + practitioner record works together
2. ✅ **Multiple Identities**: User can be Staff + Practitioner + Patient in same tenant
3. ✅ **Table Records as Truth**: Database records determine identity, not roles
4. ✅ **Tenant-Specific**: Each tenant checks its own tables independently
5. ✅ **Backward Compatible**: Existing users continue to work

---

## Current System Behavior

### How Tenant Switcher Works Now

**File**: `resources/js/components/app-sidebar-header.tsx`

**Visibility Logic** (Line 30-31):
```typescript
const hasPractitionerOrPatientAccess = (isPractitioner || isPatient);
const shouldShowTenantSwitching = hasPractitionerOrPatientAccess && userTenants.length > 0;
```

**Problem** (Line 22-23):
```typescript
const isPractitioner = auth?.user?.is_practitioner || false; // ✅ Uses flag
const isPatient = auth?.user?.is_patient || false; // ✅ Uses flag
```

**Note**: The switcher already uses flags correctly, but the sidebar still checks roles.

**Tenant List Source** (`app/helpers.php` - `userTenants()` function):
- ✅ Checks `tenant_user` pivot table (central DB)
- ✅ Checks `tenant_practitioners` table (central DB)
- ✅ Checks `tenant_patients` table (central DB)
- ✅ Merges all tenant IDs and removes duplicates
- ✅ **Already correct** - uses table records

### How Sidebar Works Now

**File**: `resources/js/components/app-sidebar.tsx`

**Tenant Context Logic** (Lines 262-305):
1. Checks roles: `hasAdminOrStaffRole` → Shows `Tenant_Dashboard` items
2. Checks `isTenantPractitioner` (table record) → Adds `Practitioner_Tenant_Dashboard` items
3. Checks `isTenantPatient` (table record) → Adds `Patient_Tenant_Dashboard` items
4. Merges all items

**Problem** (Lines 235-236):
```typescript
// ❌ Still checks roles as fallback
const isPractitioner = auth?.user?.is_practitioner || userRoles.includes('Practitioner');
const isPatient = auth?.user?.is_patient || userRoles.includes('Patient');
```

**Problem** (Line 335):
```typescript
// ❌ Checks roles instead of table flags
{!isCentral && !auth?.user?.roles?.includes('Patient') && !auth?.user?.roles?.includes('Practitioner') && ...}
```

**Central Context Logic** (Lines 251-261):
- Uses `isPractitioner`/`isPatient` flags (which check both central + tenant records)
- ❌ Also checks roles as fallback

### How Tenant Switching Works

**File**: `routes/tenant.php` (Lines 323-358)

**Process**:
1. User clicks tenant switcher
2. Frontend calls `/switch-to-tenant` route
3. Backend validates user has access via `tenant_user` table
4. Generates SSO code via `SecureSSOService`
5. Redirects to tenant domain with SSO code
6. Tenant domain validates SSO code
7. Creates tenant session
8. User lands on tenant dashboard

**Access Control** (`app/Http/Middleware/CanAccessTenant.php`):
- ✅ Checks `tenant_user` pivot table (central DB)
- ✅ Validates user is assigned to tenant
- ✅ **Already correct** - uses table records

### Current Issues

1. **Role Conflicts**: User with Admin role + practitioner record → Role check fails
2. **Inconsistent Logic**: Some places use roles, some use table records
3. **Multi-Role Limitation**: Can't easily be Admin + Practitioner in same tenant
4. **Sidebar Logic**: Still checks roles for practitioner/patient detection

---

## Proposed System Behavior

### Core Principle

**Table Records = Source of Truth for Practitioner/Patient**
- Practitioner access = Record exists in `practitioners` table (central or tenant)
- Patient access = Record exists in `patients` table (central or tenant)
- Roles = Only for Admin/Staff/Custom permissions (not identity)

### How Tenant Switcher Will Work

**Visibility Logic**:
```typescript
// Show switcher if user has practitioner OR patient records in ANY tenant
const hasPractitionerOrPatientAccess = isPractitioner || isPatient;
const shouldShowTenantSwitching = hasPractitionerOrPatientAccess && userTenants.length > 0;
```

**Where**:
- `isPractitioner` = `auth?.user?.is_practitioner` (table record flag, **NO role check**)
- `isPatient` = `auth?.user?.is_patient` (table record flag, **NO role check**)
- `userTenants` = From `userTenants()` helper (already uses table records)

**Result**: Switcher appears if user has practitioner/patient records in any tenant, regardless of roles

### How Sidebar Will Work

**Tenant Context**:
1. **Admin/Staff Roles** → Show `Tenant_Dashboard` items (permission-based)
2. **Practitioner Table Record** (`isTenantPractitioner`) → Add `Practitioner_Tenant_Dashboard` items
3. **Patient Table Record** (`isTenantPatient`) → Add `Patient_Tenant_Dashboard` items
4. **Merge all items** → User sees combined sidebar

**Central Context**:
1. **Patient Table Record** (`isPatient`) → Show `Patient_Central_Dashboard`
2. **Practitioner Table Record** (`isPractitioner`) → Show `Practitioner_Central_Dashboard`
3. **Neither** → Show `Admin_Central_Dashboard`

**Key Change**: Remove all `userRoles.includes('Practitioner')` and `userRoles.includes('Patient')` checks

### How Tenant Switching Will Work

**Process** (unchanged):
1. User clicks tenant switcher
2. Frontend calls `/switch-to-tenant` route
3. Backend validates via `tenant_user` table
4. SSO redirect to tenant domain
5. Tenant context initialized
6. **NEW**: Backend checks tenant-specific table records
7. **NEW**: Sets `is_tenant_practitioner` and `is_tenant_patient` flags
8. Sidebar renders based on tenant-specific records + roles

**After Switch**:
- User's roles in new tenant are loaded (tenant-specific)
- User's practitioner/patient records in new tenant are checked
- Sidebar merges items based on both
- Permissions are tenant-specific (already working)

---

## Complete Behavior Guide

### Scenario 1: User is Admin Only in Tenant A

**Setup**:
- Tenant A: User has Admin role, NO practitioner/patient records

**Current Behavior**:
- ✅ Tenant Switcher: **HIDDEN** (no practitioner/patient records)
- ✅ Sidebar: Shows `Tenant_Dashboard` items only
- ✅ Access: Full admin permissions

**After Changes**:
- ✅ Tenant Switcher: **HIDDEN** (no practitioner/patient records) - **No change**
- ✅ Sidebar: Shows `Tenant_Dashboard` items only - **No change**
- ✅ Access: Full admin permissions - **No change**

### Scenario 2: User is Practitioner Only in Tenant B

**Setup**:
- Tenant B: User has NO roles, HAS practitioner record in tenant DB

**Current Behavior**:
- ⚠️ Tenant Switcher: **VISIBLE** (has practitioner record)
- ⚠️ Sidebar: Shows `Practitioner_Tenant_Dashboard` items only
- ⚠️ Access: Practitioner-specific permissions (if Practitioner role exists)

**After Changes**:
- ✅ Tenant Switcher: **VISIBLE** (has practitioner record) - **No change**
- ✅ Sidebar: Shows `Practitioner_Tenant_Dashboard` items only - **No change**
- ✅ Access: Practitioner-specific permissions (based on table record) - **Improved**

### Scenario 3: User is Patient Only in Tenant C

**Setup**:
- Tenant C: User has NO roles, HAS patient record in tenant DB

**Current Behavior**:
- ⚠️ Tenant Switcher: **VISIBLE** (has patient record)
- ⚠️ Sidebar: Shows `Patient_Tenant_Dashboard` items only
- ⚠️ Access: Patient-specific access (if Patient role exists)

**After Changes**:
- ✅ Tenant Switcher: **VISIBLE** (has patient record) - **No change**
- ✅ Sidebar: Shows `Patient_Tenant_Dashboard` items only - **No change**
- ✅ Access: Patient-specific access (based on table record) - **Improved**

### Scenario 4: User is Staff + Practitioner in Tenant D

**Setup**:
- Tenant D: User has Staff role, HAS practitioner record in tenant DB

**Current Behavior**:
- ⚠️ Tenant Switcher: **VISIBLE** (has practitioner record)
- ⚠️ Sidebar: Shows `Tenant_Dashboard` items (Staff role) + `Practitioner_Tenant_Dashboard` items (practitioner record)
- ⚠️ Access: Staff permissions + Practitioner-specific access
- ⚠️ **Potential conflict**: If Practitioner role doesn't exist, some checks may fail

**After Changes**:
- ✅ Tenant Switcher: **VISIBLE** (has practitioner record) - **No change**
- ✅ Sidebar: Shows `Tenant_Dashboard` items (Staff role) + `Practitioner_Tenant_Dashboard` items (practitioner record) - **No change**
- ✅ Access: Staff permissions + Practitioner-specific access - **No conflicts**
- ✅ **Fixed**: No role conflicts, table record determines practitioner identity

### Scenario 5: User is Admin + Patient in Tenant E

**Setup**:
- Tenant E: User has Admin role, HAS patient record in tenant DB

**Current Behavior**:
- ⚠️ Tenant Switcher: **VISIBLE** (has patient record)
- ⚠️ Sidebar: Shows `Tenant_Dashboard` items (Admin role) + `Patient_Tenant_Dashboard` items (patient record)
- ⚠️ Access: Admin permissions + Patient-specific access
- ⚠️ **Potential conflict**: If Patient role doesn't exist, some checks may fail

**After Changes**:
- ✅ Tenant Switcher: **VISIBLE** (has patient record) - **No change**
- ✅ Sidebar: Shows `Tenant_Dashboard` items (Admin role) + `Patient_Tenant_Dashboard` items (patient record) - **No change**
- ✅ Access: Admin permissions + Patient-specific access - **No conflicts**
- ✅ **Fixed**: No role conflicts, table record determines patient identity

### Scenario 6: User Switches Between Tenants

**Flow**:
1. User in Tenant A (Admin only) → No switcher visible
2. User manually navigates to Tenant B (Practitioner)
3. **After switch**:
   - Tenant context changes
   - Backend checks Tenant B's `practitioners` table
   - Sets `is_tenant_practitioner = true`
   - Sidebar updates to show practitioner items
   - Permissions reload (tenant-specific)

**Current Behavior**:
- ✅ Tenant switching works correctly
- ⚠️ Sidebar may check roles instead of table records

**After Changes**:
- ✅ Tenant switching works correctly - **No change**
- ✅ Sidebar uses table records only - **Improved**

---

## Implementation Plan

### Phase 1: Frontend Sidebar Logic

**File**: `resources/js/components/app-sidebar.tsx`

#### Change 1: Remove Role Checks (Lines 235-236)

**BEFORE**:
```typescript
const isPractitioner = auth?.user?.is_practitioner || userRoles.includes('Practitioner');
const isPatient = auth?.user?.is_patient || userRoles.includes('Patient');
```

**AFTER**:
```typescript
// Only check table records, not roles
const isPractitioner = auth?.user?.is_practitioner || false;
const isPatient = auth?.user?.is_patient || false;
```

**Impact**: Sidebar uses only table records for practitioner/patient detection

#### Change 2: Update Quick Create Button (Line 335)

**BEFORE**:
```typescript
{!isCentral && !auth?.user?.roles?.includes('Patient') && !auth?.user?.roles?.includes('Practitioner') && userPerms.includes('view-new-menu') && isOnboardingComplete && (
```

**AFTER**:
```typescript
{!isCentral && !isTenantPatient && !isTenantPractitioner && userPerms.includes('view-new-menu') && isOnboardingComplete && (
```

**Impact**: Quick Create button uses table record flags instead of role checks

### Phase 2: Role Detection Utility

**File**: `resources/js/utils/role-detection.ts`

#### Change: Remove Role Checks (Lines 59-60)

**BEFORE**:
```typescript
const isPractitioner = hasPractitionerRole || hasTenantPractitionerRecord;
const isPatient = hasPatientRole || hasTenantPatientRecord;
```

**AFTER**:
```typescript
// Only check table records, not roles
const isPractitioner = hasTenantPractitionerRecord;
const isPatient = hasTenantPatientRecord;
```

**Note**: Central context (lines 25-26) already uses flags correctly - no change needed

**Impact**: Role detection uses only table records

### Phase 3: Other Files Using Role Checks

#### File 1: `resources/js/pages/Calendar/Index.tsx` (Line 1057)

**BEFORE**:
```typescript
{!isCentral && !auth?.user?.roles?.includes('Practitioner') && !auth?.user?.roles?.includes('Patient')? (
```

**AFTER**:
```typescript
{!isCentral && !isTenantPractitioner && !isTenantPatient ? (
```

**Note**: Need to ensure `isTenantPractitioner` and `isTenantPatient` are defined in component scope

#### File 2: `resources/js/pages/Appointments/Index.tsx`

**Multiple locations**:
- Line 366: `if (user_role !== 'patient')`
- Line 489: `if (user_role !== 'patient')`
- Line 544: `auth?.user?.roles?.includes('Practitioner')`
- Line 564: `user_role !== 'patient'`
- Line 573: `user_role === 'patient'`
- Line 582: `(user_role === 'admin' || user_role === 'practitioner')`
- Line 705: `!auth?.user?.roles?.includes('Patient') && !auth?.user?.roles?.includes('Practitioner')`

**Changes Needed**:
- Replace `userRoles.includes('Practitioner')` with `isTenantPractitioner` flag
- Replace `userRoles.includes('Patient')` with `isTenantPatient` flag
- Use `auth?.user?.is_practitioner` / `auth?.user?.is_patient` for central context

#### File 3: `resources/js/components/practitioner/DashboardConsentCheck.tsx` (Line 15)

**BEFORE**:
```typescript
const isPractitioner = user?.roles?.some((role: any) => role.name === 'Practitioner');
```

**AFTER**:
```typescript
const isPractitioner = user?.is_practitioner || user?.is_tenant_practitioner || false;
```

**Impact**: Uses table record flags instead of role check

### Phase 4: Backend (No Changes Needed)

**Status**: ✅ Already correct

**Files**:
- `app/Http/Middleware/HandleInertiaRequests.php` (lines 94-130)
  - ✅ `is_practitioner`: Checks central OR tenant practitioner table
  - ✅ `is_patient`: Checks central OR tenant patient table
  - ✅ `is_tenant_practitioner`: Checks tenant practitioner table only
  - ✅ `is_tenant_patient`: Checks tenant patient table only

- `app/helpers.php` - `userTenants()` function
  - ✅ Uses `tenant_user` pivot table
  - ✅ Uses `tenant_practitioners` table
  - ✅ Uses `tenant_patients` table

- `app/Http/Middleware/CanAccessTenant.php`
  - ✅ Uses `tenant_user` table for access validation

**Action**: No changes needed

---

## Testing Checklist

### Test Case 1: Admin Only Tenant

**Setup**:
- Create tenant with user having Admin role only
- No practitioner/patient records

**Expected Results**:
- [ ] Tenant Switcher: **HIDDEN**
- [ ] Sidebar: Shows `Tenant_Dashboard` items only
- [ ] All admin permissions work
- [ ] No errors in console

### Test Case 2: Practitioner Only Tenant

**Setup**:
- Create tenant with user having NO roles
- User has practitioner record in tenant DB

**Expected Results**:
- [ ] Tenant Switcher: **VISIBLE**
- [ ] Sidebar: Shows `Practitioner_Tenant_Dashboard` items only
- [ ] Practitioner permissions work
- [ ] No errors in console

### Test Case 3: Patient Only Tenant

**Setup**:
- Create tenant with user having NO roles
- User has patient record in tenant DB

**Expected Results**:
- [ ] Tenant Switcher: **VISIBLE**
- [ ] Sidebar: Shows `Patient_Tenant_Dashboard` items only
- [ ] Patient access works
- [ ] No errors in console

### Test Case 4: Staff + Practitioner Tenant

**Setup**:
- Create tenant with user having Staff role
- User has practitioner record in tenant DB

**Expected Results**:
- [ ] Tenant Switcher: **VISIBLE**
- [ ] Sidebar: Shows `Tenant_Dashboard` items (Staff) + `Practitioner_Tenant_Dashboard` items (Practitioner)
- [ ] Staff permissions work
- [ ] Practitioner-specific access works
- [ ] No conflicts or errors

### Test Case 5: Admin + Patient Tenant

**Setup**:
- Create tenant with user having Admin role
- User has patient record in tenant DB

**Expected Results**:
- [ ] Tenant Switcher: **VISIBLE**
- [ ] Sidebar: Shows `Tenant_Dashboard` items (Admin) + `Patient_Tenant_Dashboard` items (Patient)
- [ ] Admin permissions work
- [ ] Patient-specific access works
- [ ] No conflicts or errors

### Test Case 6: Tenant Switching

**Setup**:
- User has access to multiple tenants with different roles/records

**Test Steps**:
1. Start in Tenant A (Admin only)
2. Switch to Tenant B (Practitioner only)
3. Switch to Tenant C (Staff + Practitioner)
4. Switch back to Tenant A

**Expected Results**:
- [ ] Switcher visibility updates correctly per tenant
- [ ] Sidebar updates correctly per tenant
- [ ] Permissions reload correctly per tenant
- [ ] No errors during switching
- [ ] No cached data from previous tenant

### Test Case 7: Central Context

**Setup**:
- User logs in via central domain
- User has practitioner/patient records in central DB

**Expected Results**:
- [ ] Central sidebar shows correct items based on table records
- [ ] No role conflicts
- [ ] Permissions work correctly

---

## Migration Notes

### No Database Changes Required

**Status**: ✅ All table structures already support this

**Existing Tables**:
- ✅ `practitioners` table exists (central + tenant)
- ✅ `patients` table exists (central + tenant)
- ✅ `tenant_user` pivot table exists
- ✅ `tenant_practitioners` table exists (central)
- ✅ `tenant_patients` table exists (central)

**Existing Flags**:
- ✅ `is_practitioner` flag already computed correctly
- ✅ `is_patient` flag already computed correctly
- ✅ `is_tenant_practitioner` flag already computed correctly
- ✅ `is_tenant_patient` flag already computed correctly

### Backward Compatibility

**Existing Users**:
- ✅ Users with Practitioner/Patient roles will continue to work
- ✅ Table records take precedence (which is correct)
- ✅ Roles remain for Admin/Staff/Custom permissions

**No Breaking Changes**:
- ✅ All existing functionality continues to work
- ✅ Only removes redundant role checks
- ✅ Improves consistency across the system

### Rollback Plan

**If Issues Arise**:
1. Revert frontend changes (sidebar, switcher, other files)
2. Backend flags remain unchanged (already correct)
3. System returns to role-based checks
4. No data loss or corruption

**Rollback Steps**:
```bash
# Revert frontend changes
git checkout HEAD -- resources/js/components/app-sidebar.tsx
git checkout HEAD -- resources/js/utils/role-detection.ts
git checkout HEAD -- resources/js/pages/Calendar/Index.tsx
git checkout HEAD -- resources/js/pages/Appointments/Index.tsx
git checkout HEAD -- resources/js/components/practitioner/DashboardConsentCheck.tsx
```

---

## Summary

### Current State
- ❌ Mixed role + table record checks
- ❌ Conflicts when user has Admin role + practitioner record
- ❌ Inconsistent logic across files

### Target State
- ✅ Table records for identity (practitioner/patient)
- ✅ Roles for permissions only (Admin/Staff/Custom)
- ✅ No conflicts: Multiple identities per tenant
- ✅ Consistent logic across all files

### Key Benefits
- ✅ **No Role Conflicts**: Admin + Practitioner works together
- ✅ **Multiple Identities**: Staff + Practitioner + Patient in same tenant
- ✅ **Table Records as Truth**: Database records determine identity
- ✅ **Tenant-Specific**: Each tenant checks its own tables
- ✅ **Backward Compatible**: Existing users continue to work

### Implementation
- **Primary Changes**: Frontend (removing role checks)
- **Backend**: No changes needed (already correct)
- **Risk Level**: Low (backend already correct, frontend changes are straightforward)
- **Testing**: Comprehensive test cases provided above

### Files Changed
1. `resources/js/components/app-sidebar.tsx` (2 changes)
2. `resources/js/utils/role-detection.ts` (1 change)
3. `resources/js/pages/Calendar/Index.tsx` (1 change)
4. `resources/js/pages/Appointments/Index.tsx` (multiple changes)
5. `resources/js/components/practitioner/DashboardConsentCheck.tsx` (1 change)

### Files Unchanged (Already Correct)
1. `app/Http/Middleware/HandleInertiaRequests.php` ✅
2. `app/helpers.php` ✅
3. `app/Http/Middleware/CanAccessTenant.php` ✅
4. `resources/js/components/app-sidebar-header.tsx` ✅

---

## Appendix: Code References

### Backend Flags (Already Correct)

**File**: `app/Http/Middleware/HandleInertiaRequests.php`

```php
// Lines 94-108: is_practitioner flag
'is_practitioner' => (function () use ($centralUserId, $request, $isCentral) {
    // Check central database for practitioner record
    $hasCentralPractitioner = $centralUserId
        ? tenancy()->central(function () use ($centralUserId) {
            return \App\Models\Practitioner::where('user_id', $centralUserId)->exists();
        })
        : false;

    // Check tenant database for practitioner record (only in tenant context)
    $hasTenantPractitioner = ! $isCentral && $request->user()
        ? \App\Models\Practitioner::where('user_id', $request->user()->id)->exists()
        : false;

    return $hasCentralPractitioner || $hasTenantPractitioner;
})(),

// Lines 109-123: is_patient flag
'is_patient' => (function () use ($centralUserId, $request, $isCentral) {
    // Check central database for patient record
    $hasCentralPatient = $centralUserId
        ? tenancy()->central(function () use ($centralUserId) {
            return \App\Models\Patient::where('user_id', $centralUserId)->exists();
        })
        : false;

    // Check tenant database for patient record (only in tenant context)
    $hasTenantPatient = ! $isCentral && $request->user()
        ? \App\Models\Tenant\Patient::where('user_id', $request->user()->id)->exists()
        : false;

    return $hasCentralPatient || $hasTenantPatient;
})(),

// Lines 125-130: Tenant-specific flags
'is_tenant_practitioner' => ! $isCentral && $request->user()
    ? \App\Models\Practitioner::where('user_id', $request->user()->id)->exists()
    : false,
'is_tenant_patient' => ! $isCentral && $request->user()
    ? \App\Models\Tenant\Patient::where('user_id', $request->user()->id)->exists()
    : false,
```

### Frontend Sidebar Logic (Needs Changes)

**File**: `resources/js/components/app-sidebar.tsx`

```typescript
// Lines 235-236: CURRENT (needs change)
const isPractitioner = auth?.user?.is_practitioner || userRoles.includes('Practitioner');
const isPatient = auth?.user?.is_patient || userRoles.includes('Patient');

// Lines 240-241: ALREADY CORRECT
const isTenantPractitioner = !isCentral && (auth?.user?.is_tenant_practitioner || false);
const isTenantPatient = !isCentral && (auth?.user?.is_tenant_patient || false);
```

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Author**: System Analysis

