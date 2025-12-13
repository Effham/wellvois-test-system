<!-- 28812494-2dc9-4af3-b224-d49beb17c463 a296d972-1e62-4486-b316-09ccf1175e0b -->
# Consent System Standardization Plan

## Overview

Standardize all consent-related emails and pages across patient and practitioner flows with unified design, proper Wellovis logo placement, and single "Accept All" functionality. Remove blocking consent modal from patient dashboard.

## Changes Required

### 1. Email Template Standardization

**Create Unified Base Email Template**

- Create `resources/views/emails/layouts/consent-base.blade.php` with:
- Wellovis logo centered in header (from `public/logo.svg`)
- Consistent styling and structure
- Single variable content section
- Unified footer with Wellovis branding

**Update Patient Consent Email**

- File: `resources/views/emails/patient_consent.blade.php`
- Extend new base template
- Add centered Wellovis logo in header
- Keep "Accept All" checkbox functionality
- Match practitioner email styling

**Update Practitioner Consent Emails**

- Files:
- `resources/views/emails/practitioner_administrative_consent.blade.php`
- `resources/views/emails/practitioner_staff_permissions_consent.blade.php`
- Extend new base template
- Add centered Wellovis logo in header
- Update to mention "Accept All" checkbox functionality
- Unify colors and spacing with patient emails

**Update Session Recording Email**

- File: `resources/views/emails/session_recording_consent.blade.php`
- Apply same standardization

### 2. Practitioner Consent Page Implementation

**Create Practitioner Consent Controller**

- File: `app/Http/Controllers/Tenant/PractitionerConsentController.php`
- Methods needed:
- `index()` - Show consent management page
- `acceptAll()` - Accept multiple consents at once
- Similar structure to `PatientConsentController`

**Create Practitioner Consent Page Component**

- File: `resources/js/pages/Tenant/Practitioner/Consents.tsx`
- Should match `resources/js/pages/Consents/PatientConsents.tsx` exactly:
- Same layout and styling
- Same "Accept All" checkbox at bottom
- Same consent card display
- Same button text and behavior
- Reuse `ConsentCard` component from patient implementation

**Update Practitioner Routes**

- File: `routes/tenant.php` (line 458-469)
- Replace mock route with proper controller route:
- `Route::get('practitioner/consents', [PractitionerConsentController::class, 'index'])`
- `Route::post('practitioner/consents/accept-all', [PractitionerConsentController::class, 'acceptAll'])`

**Add Sidebar Link**

- File: `resources/js/components/app-sidebar.tsx` (line 56-66)
- Add to `Practitioner_Tenant_Dashboard`:
- `{ title: 'Consents', href: '/practitioner/consents', icon: FileText, permission: undefined }`

### 3. Remove Blocking Modal from Patient Dashboard

**Remove Modal from Dashboard**

- File: `resources/js/pages/PatientDashboard/Index.tsx` (line 335-341)
- Remove the `TenantDashboardConsentModal` component entirely
- Remove `pendingConsents` and `patientId` props handling

**Update Dashboard Controller**

- File: `app/Http/Controllers/Tenant/PatientDashboardController.php` (line 180-234)
- Remove consent checking logic
- Remove `pendingConsents` and `patientId` from Inertia render

**Keep Sidebar Consents Link**

- Patient sidebar already has consents link at `/consents/manage`
- This navigates to dedicated consent management page (non-blocking)

### 4. Ensure Consent Acceptance Routes Work

**Patient Routes** (Already exist)

- `routes/tenant.php` (line 472-476)
- Routes for `/consents/manage` and accept/revoke

**Practitioner Routes** (Need to add)

- Similar structure to patient routes
- Use new `PractitionerConsentController`

## Key Files to Modify

1. **New Files:**

- `resources/views/emails/layouts/consent-base.blade.php`
- `app/Http/Controllers/Tenant/PractitionerConsentController.php`
- `resources/js/pages/Tenant/Practitioner/Consents.tsx`

2. **Modified Files:**

- `resources/views/emails/patient_consent.blade.php`
- `resources/views/emails/practitioner_administrative_consent.blade.php`
- `resources/views/emails/practitioner_staff_permissions_consent.blade.php`
- `resources/views/emails/session_recording_consent.blade.php`
- `resources/js/pages/PatientDashboard/Index.tsx`
- `app/Http/Controllers/Tenant/PatientDashboardController.php`
- `routes/tenant.php`
- `resources/js/components/app-sidebar.tsx`

3. **Can be Deleted:**

- `resources/js/components/TenantDashboardConsentModal.tsx` (no longer needed)

## Design Specifications

**Unified Email Design:**

- Wellovis logo: Centered in header, max-width 150px
- Primary color: #2563eb (blue)
- Background: #f4f4f4 (light gray)
- Content box: white with border-radius 8px
- Button: Blue (#2563eb) with hover state (#1d4ed8)
- Footer: Gray text with Wellovis copyright

**Unified Page Design:**

- Both patient and practitioner consent pages should be identical
- Single "Accept All" checkbox at bottom
- Individual consent cards showing full content
- Same button text: "Accept All & Continue to Dashboard"
- Same progress indicator: "X of Y consents accepted"

### To-dos

- [ ] Create unified base email template with Wellovis logo centered in header
- [ ] Update patient consent email to use base template and standardize design
- [ ] Update both practitioner consent emails to use base template and standardize design
- [ ] Update session recording consent email to use base template
- [ ] Create PractitionerConsentController with index and acceptAll methods
- [ ] Create practitioner consent page component matching patient design exactly
- [ ] Update practitioner consent routes to use controller and add sidebar link
- [ ] Remove TenantDashboardConsentModal from patient dashboard and controller
- [ ] Delete TenantDashboardConsentModal.tsx component file
- [ ] Test both patient and practitioner consent flows end-to-end