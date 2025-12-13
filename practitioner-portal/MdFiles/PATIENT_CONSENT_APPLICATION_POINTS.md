# Patient Consent Application Points

## Overview
This document lists all points in the application where patient consent is required before proceeding.

---

## ✅ **Point 1: Patient Intake Form Submission**
- **Location**: `app/Http/Controllers/Tenant/IntakeController.php`
- **When**: Patient submits intake form to register as new patient
- **Current Status**: ✅ IMPLEMENTED via email
- **Consents Required**:
  - patient_privacy_practices_acknowledgment
  - patient_consent_for_treatment
  - patient_consent_phi_use_disclosure
  - patient_consent_third_party_sharing (AI)
  - patient_consent_receive_communications
  - patient_consent_data_storage
  - patient_privacy_policy_acknowledgment
- **Flow**: Email sent → Patient clicks link → Public page shows all consents → Accepts → EntityConsent records created
- **File**: Already implemented in `app/Http/Controllers/Tenant/IntakeController.php` (line 465-500)

---

## 🔨 **Point 2: Patient Dashboard Access (Central)**
- **Location**: `routes/web.php` (line 203-274)
- **When**: Patient logs in from public portal OR registers from public portal
- **Current Status**: ❌ NOT IMPLEMENTED
- **Issue**: No consent check before showing dashboard
- **Consents Required**: ALL 7 patient consents
- **Fix Required**: 
  - Add consent checking logic before `Inertia::render('PatientDashboard/Index')`
  - If consents not accepted, redirect to consent modal or page
  - Show modal blocking dashboard access until consents accepted

---

## 🔨 **Point 3: Appointment Booking from Public Portal**
- **Location**: `app/Http/Controllers/PublicPortalController.php` - `submitAppointment()` and `registerAndBook()`
- **When**: Patient books appointment without being registered
- **Current Status**: ❌ NOT IMPLEMENTED
- **Consents Required**: ALL 7 patient consents
- **Fix Required**: 
  - Check consents before completing appointment booking
  - If not accepted, show consent modal
  - Only proceed with booking after acceptance

---

## 🔨 **Point 4: First-Time Patient Portal Login**
- **Location**: `app/Http/Controllers/Auth/AuthenticatedSessionController.php`
- **When**: Patient logs in for the first time
- **Current Status**: ❌ NOT IMPLEMENTED
- **Consents Required**: ALL 7 patient consents
- **Fix Required**: 
  - Check consent acceptance status in `store()` method
  - If not accepted, redirect to consent page
  - Prevent dashboard access until accepted

---

## 🔨 **Point 5: Waiting List Slot Acceptance**
- **Location**: `app/Http/Controllers/PublicPortalController.php` - `acceptWaitingListSlot()`
- **When**: Patient accepts a waiting list slot offer
- **Current Status**: ❌ NOT IMPLEMENTED
- **Consents Required**: ALL 7 patient consents (if not already accepted)
- **Fix Required**: 
  - Check consents before confirming appointment from waiting list
  - Show consent modal if needed

---

## Current Email-Based Implementation
- **File**: `app/Http/Controllers/Tenant/IntakeController.php` (lines 465-500)
- **Method**: Email with link → Public consent page → Accepts consents
- **URL**: `/consents/show/{token}?patient_id={id}`
- **Controller**: `app/Http/Controllers/PublicConsentController.php`

---

## New Modal-Based Implementation Needed
Similar to practitioner's `DocumentSecurityModal`, we need:
1. **PatientConsentModal** React component
2. Check consents before accessing dashboard
3. Show modal if consents not accepted
4. AJAX endpoint to accept consents
5. Block dashboard until all consents accepted

---

## Priority Order
1. 🔴 **HIGH**: Patient Dashboard Access (most critical)
2. 🟡 **MEDIUM**: Appointment Booking from Public Portal
3. 🟢 **LOW**: Other points (can be implemented later)

---

## Database Consents Required
All seeded via `php artisan tenants:seed --class="Database\Seeders\Tenant\DefaultConsentSeeder"`:
1. patient_privacy_practices_acknowledgment
2. patient_consent_for_treatment
3. patient_consent_phi_use_disclosure
4. patient_consent_third_party_sharing (for AI)
5. patient_consent_receive_communications
6. patient_consent_data_storage
7. patient_privacy_policy_acknowledgment

