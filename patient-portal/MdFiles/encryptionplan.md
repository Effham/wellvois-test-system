# Patient Information Encryption Plan for HIPAA Compliance

## Current Status

**Currently Encrypted (✅):**

- `FamilyMedicalHistory` (Tenant DB): `summary`, `details`, `relationship_to_patient`

**Not Yet Encrypted (⚠️):**

- All other PHI fields listed below

---

## HIPAA PHI Categories Requiring Encryption

According to HIPAA §164.514(b)(2), the following 18 identifiers must be protected when they can identify an individual:

### Central Database - `patients` Table

#### 🔴 **CRITICAL PRIORITY** (Direct Identifiers)

| Field | Current Status | HIPAA Category | Blind Index Needed |
|-------|---------------|----------------|-------------------|
| `health_number` | ❌ Not Encrypted | Medical Record Number | ✅ Yes (searchable) |
| `first_name` | ❌ Not Encrypted | Name | ✅ Yes (searchable) |
| `last_name` | ❌ Not Encrypted | Name | ✅ Yes (searchable) |
| `preferred_name` | ❌ Not Encrypted | Name | ✅ Yes (searchable) |
| `email` | ❌ Not Encrypted | Email Address | ✅ Yes (searchable) |
| `email_address` | ❌ Not Encrypted | Email Address | ✅ Yes (searchable) |
| `phone_number` | ❌ Not Encrypted | Telephone Number | ✅ Yes (searchable) |
| `date_of_birth` | ❌ Not Encrypted | Birth Date | ✅ Yes (age queries) |
| `emergency_contact_name` | ❌ Not Encrypted | Name of Relative | ✅ Yes (searchable) |
| `emergency_contact_phone` | ❌ Not Encrypted | Telephone Number | ✅ Yes (searchable) |

#### 🟡 **HIGH PRIORITY** (Geographic & Contact Info)

| Field | Current Status | HIPAA Category | Blind Index Needed |
|-------|---------------|----------------|-------------------|
| `street_address` | ❌ Not Encrypted | Geographic < State | ✅ Yes |
| `apt_suite_unit` | ❌ Not Encrypted | Geographic < State | ❌ No |
| `city` | ❌ Not Encrypted | Geographic < State | ✅ Yes |
| `postal_zip_code` | ❌ Not Encrypted | ZIP Code | ✅ Yes |
| `address` (legacy) | ❌ Not Encrypted | Geographic < State | ❌ No |
| `address_lookup` | ❌ Not Encrypted | Geographic < State | ❌ No |

#### 🟢 **MEDIUM PRIORITY** (Clinical & Medical Info)

| Field | Current Status | HIPAA Category | Blind Index Needed |
|-------|---------------|----------------|-------------------|
| `presenting_concern` | ❌ Not Encrypted | Medical Information | ✅ Yes (clinical search) |
| `goals_for_therapy` | ❌ Not Encrypted | Medical Information | ❌ No |
| `previous_therapy_experience` | ❌ Not Encrypted | Medical History | ❌ No |
| `current_medications` | ❌ Not Encrypted | Medical Information | ✅ Yes (medication search) |
| `diagnoses` | ❌ Not Encrypted | Medical Information | ✅ Yes (diagnosis search) |
| `history_of_hospitalization` | ❌ Not Encrypted | Medical History | ❌ No |
| `risk_safety_concerns` | ❌ Not Encrypted | Medical Information | ✅ Yes (risk assessment) |
| `other_medical_conditions` | ❌ Not Encrypted | Medical Information | ❌ No |
| `cultural_religious_considerations` | ❌ Not Encrypted | Personal Information | ❌ No |
| `accessibility_needs` | ❌ Not Encrypted | Personal Information | ❌ No |

#### 🔵 **LOW PRIORITY** (Insurance & Policy)

| Field | Current Status | HIPAA Category | Blind Index Needed |
|-------|---------------|----------------|-------------------|
| `insurance_provider` | ❌ Not Encrypted | Health Plan Info | ✅ Yes (search by insurer) |
| `policy_number` | ❌ Not Encrypted | Account Number | ✅ Yes (searchable) |
| `coverage_card_path` | ❌ Not Encrypted | Document Reference | ❌ No |

---

### Tenant Database - Medical Records

#### 🔴 **CRITICAL PRIORITY**

**`family_medical_histories` table:**
| Field | Current Status | Notes |
|-------|---------------|-------|
| `summary` | ✅ **ENCRYPTED** | Already implemented |
| `details` | ✅ **ENCRYPTED** | Already implemented |
| `relationship_to_patient` | ✅ **ENCRYPTED** | Already implemented |

**`patient_medical_histories` table:**
| Field | Current Status | Blind Index Needed |
|-------|---------------|-------------------|
| `disease` | ❌ Not Encrypted | ✅ Yes (diagnosis search) |
| `recent_tests` | ❌ Not Encrypted | ✅ Yes (test type search) |

**`known_allergies` table:**
| Field | Current Status | Blind Index Needed |
|-------|---------------|-------------------|
| `allergens` | ❌ Not Encrypted | ✅ Yes (allergy search) |
| `type` | ❌ Not Encrypted | ✅ Yes (category search) |
| `reaction` | ❌ Not Encrypted | ❌ No |
| `notes` | ❌ Not Encrypted | ❌ No |

#### 🟡 **HIGH PRIORITY** 

**`encounters` table:**
| Field | Current Status | Blind Index Needed |
|-------|---------------|-------------------|
| `chief_complaint` | ❌ Not Encrypted | ✅ Yes (clinical search) |
| `history_of_present_illness` | ❌ Not Encrypted | ❌ No |
| `examination_notes` | ❌ Not Encrypted | ❌ No |
| `clinical_assessment` | ❌ Not Encrypted | ❌ No |
| `treatment_plan` | ❌ Not Encrypted | ❌ No |
| `additional_notes` | ❌ Not Encrypted | ❌ No |
| `mental_state_exam` | ❌ Not Encrypted | ❌ No |
| `mood_affect` | ❌ Not Encrypted | ❌ No |
| `thought_process` | ❌ Not Encrypted | ❌ No |
| `cognitive_assessment` | ❌ Not Encrypted | ❌ No |
| `risk_assessment` | ❌ Not Encrypted | ✅ Yes (risk tracking) |
| `therapeutic_interventions` | ❌ Not Encrypted | ❌ No |
| `session_goals` | ❌ Not Encrypted | ❌ No |
| `homework_assignments` | ❌ Not Encrypted | ❌ No |
| `ai_summary` | ❌ Not Encrypted | ❌ No |

**`encounter_prescriptions` table:**
| Field | Current Status | Blind Index Needed |
|-------|---------------|-------------------|
| `medicine_name` | ❌ Not Encrypted | ✅ Yes (medication search) |
| `dosage` | ❌ Not Encrypted | ❌ No |
| `frequency` | ❌ Not Encrypted | ❌ No |
| `duration` | ❌ Not Encrypted | ❌ No |
| `instructions` | ❌ Not Encrypted | ❌ No |

**`notes` table (if exists):**
| Field | Current Status | Blind Index Needed |
|-------|---------------|-------------------|
| All note content | ❌ Not Encrypted | ⚠️ Needs assessment |

---

## Fields That DON'T Need Encryption

These fields don't contain PHI or are administrative:

- `id`, `created_at`, `updated_at` (metadata)
- `patient_id` (foreign key reference)
- `gender`, `gender_pronouns`, `client_type` (demographic categories - not identifiable alone)
- `province` (state level geography - HIPAA allows)
- `language_preferences`, `best_time_to_contact`, `best_way_to_contact` (preferences)
- `consent_*` fields (boolean flags)
- `is_active`, `created_via_public_portal` (system flags)
- Vital signs: `blood_pressure_*`, `heart_rate`, `temperature`, etc. (medical data but not identifiable)
- `severity` in allergies (enum value)
- `session_started_at`, `session_completed_at`, `session_duration_seconds` (timestamps)

---

## Implementation Priority Order

### Phase 1: Critical Identifiers (Central DB)

1. `health_number`
2. `first_name`, `last_name`, `preferred_name`
3. `email`, `email_address`
4. `phone_number`
5. `date_of_birth`
6. `emergency_contact_name`, `emergency_contact_phone`

### Phase 2: Geographic Data (Central DB)

7. `street_address`, `city`, `postal_zip_code`

### Phase 3: Clinical Data (Tenant DB)

8. `patient_medical_histories`: `disease`, `recent_tests`
9. `known_allergies`: `allergens`, `type`, `reaction`, `notes`
10. `encounter_prescriptions`: `medicine_name`, `instructions`

### Phase 4: Medical History (Central DB)

11. `presenting_concern`, `current_medications`, `diagnoses`
12. `risk_safety_concerns`, `history_of_hospitalization`

### Phase 5: Encounter Details (Tenant DB)

13. `encounters`: `chief_complaint`, `risk_assessment`
14. `encounters`: all clinical note fields

### Phase 6: Insurance (Central DB)

15. `insurance_provider`, `policy_number`

---

## Command Requirements

For each model that needs encryption, create commands similar to:

- `php artisan tenants:encrypt-patient-medical-history`
- `php artisan tenants:encrypt-known-allergies`
- `php artisan tenants:encrypt-encounters`
- `php artisan tenants:encrypt-prescriptions`
- `php artisan central:encrypt-patients` (for central DB)

---

## Estimated Scope

**Total Fields to Encrypt:**

- Central DB: ~30 fields
- Tenant DB: ~25 fields
- **Grand Total: ~55 PHI fields**

**Models to Update:**

- Central: 1 model (`Patient`)
- Tenant: 4 models (`PatientMedicalHistory`, `KnownAllergy`, `Encounter`, `EncounterPrescription`)
- **Total: 5 models**

**Migration Scripts Needed:**

- 5 encryption command classes
- Database migration consideration (blind_indexes table exists)