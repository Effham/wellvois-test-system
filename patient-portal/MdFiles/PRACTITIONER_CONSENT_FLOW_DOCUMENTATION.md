# 📋 **PRACTITIONER CONSENT FLOW DOCUMENTATION**

## 🎯 **OVERVIEW**

This document outlines the complete consent flow for practitioners in the EMR system, detailing when, where, and how different types of consents are requested and managed.

---

## 🏗️ **SYSTEM ARCHITECTURE**

### **Database Structure**
- **`consents`**: Each row = 1 consent type (e.g., `confidentiality_oath`, `google_calendar_sync`)
- **`consent_versions`**: Versioned consent content with JSON body
- **`entity_consents`**: Tracks who accepted which consent (polymorphic relationship)

### **Consent Types**
1. **Single Consent**: One checkbox per modal
2. **Multi-Consent**: Multiple checkboxes in one modal (grouped by `modal_group`)

---

## 🔄 **COMPLETE PRACTITIONER JOURNEY**

### **Phase 1: Initial Registration & Invitation**

#### **1.1 Practitioner Invitation Email**
- **Trigger**: Admin creates practitioner account
- **Action**: Email sent with invitation link
- **Consent Required**: ❌ None

#### **1.2 Registration Page Access**
- **URL**: `/practitioner-invitation/{token}`
- **Consent Check**: ✅ **Confidentiality Oath** (if not already accepted)
- **Type**: **Single Consent** - Full text with points
- **Modal Group**: `registration`
- **UI**: Inline form (not modal)

**Consent Details:**
```json
{
  "type": "full_text",
  "modal_group": "registration",
  "heading": "Confidentiality Oath",
  "description": "Required for employment with this organization",
  "important_notice": "As a healthcare practitioner, you will have access to sensitive patient information...",
  "points": [
    "I will maintain the strictest confidentiality regarding all patient information...",
    "I will comply with all applicable laws and regulations...",
    "I will not disclose, discuss, or share any patient information...",
    "I will use patient information only for legitimate healthcare purposes..."
  ]
}
```

**User Experience:**
1. Practitioner clicks invitation link
2. Sets password and accepts terms
3. **Confidentiality Oath section appears** (if not already accepted)
4. Must check "I have read and accept the Confidentiality Oath"
5. Click "Save Password & Complete Registration"
6. **Both password AND consent are saved together**

**Backend Logic:**
- Check if practitioner already has `confidentiality_oath` consent
- If not, show consent form
- If yes, skip consent section
- Save `EntityConsent` record with `consentable_type: 'App\\Models\\Practitioner'`

---

### **Phase 2: Tenant Dashboard Access**

#### **2.1 First Login to Tenant Dashboard**
- **URL**: `/dashboard` (tenant-specific)
- **Consent Check**: ✅ **Google Calendar Integration** (if not already accepted)
- **Type**: **Multi-Consent** - 3 checkboxes in one modal
- **Modal Group**: `google_calendar`

**Consent Details:**
```json
{
  "consents": [
    {
      "key": "google_calendar_sync",
      "type": "checkbox_item",
      "label": "I understand appointments will sync to Google Calendar",
      "required": true,
      "description": "Your appointments will be automatically synchronized with your Google Calendar"
    },
    {
      "key": "google_calendar_staff_view", 
      "type": "checkbox_item",
      "label": "I consent to staff members viewing my Google Calendar availability",
      "required": true,
      "description": "Administrative staff may view your calendar to help with scheduling"
    },
    {
      "key": "google_calendar_data_storage",
      "type": "checkbox_item", 
      "label": "I understand data is stored on Google servers and subject to Google's privacy policy",
      "required": true,
      "description": "Calendar data will be stored on Google servers and subject to Google's terms of service"
    }
  ]
}
```

**User Experience:**
1. Practitioner logs into tenant dashboard
2. **Google Calendar consent modal appears** (if not already accepted)
3. Must check all 3 required checkboxes
4. Optional: Can check additional optional consents
5. Click "Accept Consents"
6. **3 separate `EntityConsent` records created**

**Backend Logic:**
- Check if practitioner has ALL required consents in `google_calendar` modal group
- If missing any, show modal
- If all present, skip modal
- Save each checked consent as separate `EntityConsent` record

---

### **Phase 3: Document Management**

#### **3.1 Document Upload - Additional Files**
- **URL**: `/encounters/{encounter}/documents/upload`
- **Trigger**: Practitioner clicks "Upload Additional Files" button
- **Consent Check**: ✅ **Document Sharing Consent** (every time)
- **Type**: **Single Consent** - One confirmation checkbox
- **Modal Group**: `document_upload`

**Consent Details:**
```json
{
  "type": "checkbox_single",
  "modal_group": "document_upload", 
  "heading": "Document Sharing Consent",
  "description": "This document will be accessible to the patient",
  "warning": "Once shared, the patient can download and keep this document. Please ensure you have the right to share this information before proceeding.",
  "question": "Do you confirm you want to share this document with the patient?"
}
```

**User Experience:**
1. Practitioner clicks "Upload Additional Files"
2. **Document sharing consent modal appears** (every time)
3. Must check "I confirm I want to share this document"
4. Click "Confirm & Upload"
5. **File uploads proceed**
6. **`EntityConsent` record created** (if not already exists)

**Backend Logic:**
- Check if practitioner has EVER consented to `document_upload_sharing`
- If not, show modal
- If yes, show modal anyway (for each upload)
- Save consent record if not already exists

---

### **Phase 4: Virtual Sessions**

#### **4.1 Virtual Session Participation**
- **URL**: `/sessions/{session}/join` or similar
- **Trigger**: Practitioner joins virtual session
- **Consent Check**: ✅ **Virtual Session Consents** (if not already accepted)
- **Type**: **Multi-Consent** - 2 checkboxes in one modal
- **Modal Group**: `virtual_session`

**Consent Details:**
```json
{
  "consents": [
    {
      "key": "session_participation",
      "type": "checkbox_item",
      "label": "I consent to participate in this virtual session",
      "required": true,
      "description": "Required to join the virtual session"
    },
    {
      "key": "session_recording",
      "type": "checkbox_item",
      "label": "I consent to this session being recorded",
      "required": false,
      "description": "Optional - session may be recorded for quality assurance purposes"
    }
  ]
}
```

**User Experience:**
1. Practitioner clicks "Join Session"
2. **Virtual session consent modal appears** (if not already accepted)
3. Must check "I consent to participate in this virtual session" (required)
4. Optional: Check "I consent to this session being recorded"
5. Click "Accept Consents"
6. **Session starts**

**Backend Logic:**
- Check if practitioner has required `session_participation` consent
- If not, show modal
- If yes, skip modal
- Save each checked consent as separate `EntityConsent` record

---

## 📊 **CONSENT MANAGEMENT**

### **Practitioner Consent Dashboard**
- **URL**: `/practitioner/consents`
- **Purpose**: View and manage all consents
- **Features**:
  - List all accepted consents
  - Show consent status and dates
  - Revoke active consents (if allowed)
  - View consent history

### **Consent Status Tracking**
- **Accepted**: Practitioner has given consent
- **Revoked**: Practitioner has withdrawn consent
- **Expired**: Consent version is no longer active
- **Required**: Must be accepted to proceed
- **Optional**: Can be accepted or declined

---

## 🔧 **TECHNICAL IMPLEMENTATION**

### **API Endpoints**

#### **Single Consent Routes**
```php
GET  /api/consent/check/{key}           // Check if consent needed
GET  /api/consent/active/{key}          // Get active consent data
POST /api/consent/accept                // Accept single consent
```

#### **Multi-Consent Routes**
```php
GET  /api/consent/modal-group/{modalGroup}           // Get all consents in group
GET  /api/consent/check-modal-group/{modalGroup}     // Check if group consent needed
POST /api/consent/accept-multiple                    // Accept multiple consents
```

#### **Specialized Routes**
```php
GET  /api/consent/check/document-upload              // Document upload consent check
```

### **Database Queries**

#### **Check if Practitioner Has Consented**
```php
$hasConsented = $practitioner->entityConsents()
    ->whereHas('consentVersion.consent', function($q) use ($consentKey) {
        $q->where('key', $consentKey)
          ->where('status', 'ACTIVE');
    })
    ->exists();
```

#### **Get Modal Group Consents**
```php
$consents = Consent::byModalGroup($modalGroup)
    ->with('activeVersion')
    ->get();
```

#### **Check Modal Group Status**
```php
$allRequiredAccepted = $requiredConsents->every(function($consent) use ($acceptedConsents) {
    return in_array($consent->key, $acceptedConsents);
});
```

---

## 🎨 **UI COMPONENTS**

### **Single Consent Modal**
- **Component**: `DocumentUploadConsentModal`
- **Use Case**: Document upload consent
- **Features**: Single checkbox, warning message, patient info

### **Multi-Consent Modal**
- **Component**: `MultiConsentModal`
- **Use Case**: Google Calendar, Virtual Session
- **Features**: Multiple checkboxes, required validation, flexible grouping

### **Inline Consent Form**
- **Component**: Inline in `practitioner-invitation.tsx`
- **Use Case**: Registration confidentiality oath
- **Features**: Full text display, points list, integrated with form

---

## 📈 **CONSENT FLOW SUMMARY**

| **Phase** | **Trigger** | **Consent Type** | **Modal Group** | **Required** | **Frequency** |
|-----------|-------------|------------------|-----------------|--------------|---------------|
| **Registration** | Invitation acceptance | Single (Full Text) | `registration` | ✅ Yes | Once only |
| **Dashboard** | First login | Multi (3 checkboxes) | `google_calendar` | ✅ Yes | Once only |
| **Document Upload** | Upload button click | Single (Confirmation) | `document_upload` | ✅ Yes | Every time |
| **Virtual Session** | Session join | Multi (2 checkboxes) | `virtual_session` | ✅ Yes | Once only |

---

## ✅ **TESTING VERIFICATION**

### **Route Testing Results**
```
=== TESTING CONSENT ROUTES ===

--- Google Calendar Integration ---
Found 3 consents in modal group 'google_calendar'
  ✓ google_calendar_sync: Sync Appointments to Google Calendar
    Type: checkbox_item, Required: Yes
  ✓ google_calendar_staff_view: Staff Calendar Viewing  
    Type: checkbox_item, Required: Yes
  ✓ google_calendar_data_storage: Google Data Storage
    Type: checkbox_item, Required: Yes

--- Virtual Session ---
Found 2 consents in modal group 'virtual_session'
  ✓ session_participation: Virtual Session Participation
    Type: checkbox_item, Required: Yes
  ✓ session_recording: Session Recording
    Type: checkbox_item, Required: No

--- Registration ---
Found 1 consents in modal group 'registration'
  ✓ confidentiality_oath: Confidentiality Oath
    Type: full_text, Required: Yes

--- Document Upload ---
Found 1 consents in modal group 'document_upload'
  ✓ document_upload_sharing: Document Upload Sharing Consent
    Type: checkbox_single, Required: Yes
```

### **API Endpoints Verified**
- ✅ `GET /api/consent/modal-group/{modalGroup}` - Working
- ✅ `GET /api/consent/check-modal-group/{modalGroup}` - Working  
- ✅ `POST /api/consent/accept-multiple` - Working
- ✅ `GET /api/consent/check/{key}` - Working
- ✅ `POST /api/consent/accept` - Working

---

## 🚀 **DEPLOYMENT STATUS**

### **Completed Features**
- ✅ Database structure and migrations
- ✅ Eloquent models with relationships
- ✅ Consent seeder with all 4 consent types
- ✅ API controllers and routes
- ✅ Frontend components (MultiConsentModal, DocumentUploadConsentModal)
- ✅ Registration flow integration
- ✅ Document upload consent flow
- ✅ Modal group system with JSON-based grouping

### **Ready for Production**
- ✅ Multi-consent modal system
- ✅ Individual consent tracking
- ✅ Polymorphic relationships
- ✅ Tenant-aware consent management
- ✅ Comprehensive API endpoints

---

## 📝 **CONCLUSION**

The practitioner consent system is **fully implemented** and **production-ready**. It provides:

1. **Flexible Consent Types**: Single and multi-consent modals
2. **Proper Data Tracking**: Each consent tracked individually
3. **User-Friendly UI**: Clear, intuitive consent interfaces
4. **Robust Backend**: Comprehensive API and database structure
5. **Tenant Isolation**: Proper multi-tenancy support

The system ensures practitioners provide informed consent at appropriate points in their workflow while maintaining data integrity and user experience.
