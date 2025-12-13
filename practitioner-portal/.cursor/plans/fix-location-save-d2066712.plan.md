---
name: Replace Patient Search with Full Patient Form in QuickBook Appointment
overview: ""
todos:
  - id: ffef74e8-5338-41ab-8bfe-611faa55c004
    content: Test location update to confirm toast message displays
    status: pending
---

# Replace Patient Search with Full Patient Form in QuickBook Appointment

## Overview

Replace the patient search functionality in QuickBook appointment page with a full patient form identical to the Create appointment page. The form will check if patient exists (by email or health number at tenant level) and auto-fill if found, otherwise create a new patient when booking the appointment.

## Implementation Steps

### 1. Update QuickBook.tsx Frontend

**File**: `resources/js/pages/Appointments/QuickBook.tsx`

- Remove patient search card and related state (`patientSearchQuery`, `showPatientSearchResults`)
- Keep `usePatientSearch` hook for auto-fill functionality (search by health number, email, name)
- Add full patient form fields matching Create appointment page:
- Health Card Number (with auto-search via `searchByHealthNumber`)
- First Name, Middle Name, Last Name, Preferred Name (with auto-search by name)
- Phone Number (PhoneInput component)
- Email Address (with auto-search via `searchByEmail`)
- Gender/Pronouns
- Date of Birth
- Client Type (Select dropdown)
- Emergency Contact Name
- Emergency Contact Phone (PhoneInput component)
- Contact Person
- Preferred Language
- Add `handleAutoFill` function to populate form when patient is found (same as Create.tsx lines 233-259)
- Add `handleSelectPatient` function for multiple matches selection
- Add patient found alerts (single match, multiple matches, conflicts) matching Create.tsx styling
- Update form state to include all patient fields
- Update form submission to send all patient fields instead of `patient_id`

### 2. Update QuickBookAppointmentController Backend

**File**: `app/Http/Controllers/Tenant/QuickBookAppointmentController.php`

- Update `store()` method validation to accept all patient fields instead of `patient_id`:
- `first_name`, `last_name`, `middle_name`, `preferred_name`
- `health_number`, `phone_number`, `email_address`
- `gender`, `gender_pronouns`, `date_of_birth`
- `client_type`, `emergency_contact_name`, `emergency_contact_phone`
- `contact_person`, `preferred_language`
- Implement patient existence check and creation logic (same as `AppointmentController@store` lines 2157-2210):
- Check if patient exists by email using `Patient::whereBlind('email', 'email_index', $email)`
- If not found, check by health_number using `Patient::whereBlind('health_number', 'health_number_index', $healthNumber)`
- If still not found, create new patient with all provided fields
- Generate temporary health number if not provided: `'TMP-'.time().'-'.rand(1000, 9999)`
- Create wallet for new patient: `\App\Models\Tenant\Wallet::getOrCreatePatientWallet($patientId)`
- Use tenant-level Patient model: `App\Models\Tenant\Patient`
- Use existing patient ID if found, or newly created patient ID for appointment creation
- Keep existing appointment creation logic unchanged

### 3. Form Field Structure

Match the exact field layout from Create.tsx:

- Health Number row (single field with search trigger)
- First Name, Last Name, Preferred Name row (3 columns)
- Phone Number, Email Address, Gender/Pronouns row (3 columns)
- Date of Birth, Client Type, Emergency Contact Phone row (3 columns)
- Emergency Contact Name, Contact Person, Preferred Language row (3 columns)

### 4. Auto-fill Functionality

- When health number is entered, trigger `searchByHealthNumber()`
- When email is entered, trigger `searchByEmail()`
- When first_name + last_name are entered, trigger `searchByName()`
- Show "Patient Already Exists" alert with "Load Patient Data" button
- On "Load Patient Data" click, call `handleAutoFill()` to populate all fields
- Handle multiple matches with selection UI
- Handle conflicts with warning UI

### 5. Validation

- Use same validation rules as Create appointment page
- Required fields: health_number (optional), first_name, last_name, phone_number, email_address, gender_pronouns, date_of_birth, client_type, emergency_contact_phone
- Optional fields: middle_name, preferred_name, emergency_contact_name, contact_person, preferred_language

## Files to Modify

1. `resources/js/pages/Appointments/QuickBook.tsx` - Replace patient search with full form
2. `app/Http/Controllers/Tenant/QuickBookAppointmentController.php` - Update store method for patient creation/checking

## Expected Behavior

- User fills out patient form fields
- As they type health number/email/name, system searches for existing patient
- If patient found, shows alert with option to auto-fill
- If patient not found, user continues filling form
- On submit, backend checks if patient exists (by email or health number)
- If exists, uses existing patient; if not, creates new patient
- Appointment is created with the patient (existing or new)