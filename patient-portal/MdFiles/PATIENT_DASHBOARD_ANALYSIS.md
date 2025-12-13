# Patient Dashboard Dynamic Configuration Analysis

## Overview
The Patient Dashboard has been analyzed and updated to support dynamic configuration while maintaining security and system integrity. This document outlines which fields can be made dynamic vs those that must remain static.

## Architecture

### Central vs Tenant Level Implementation
- **Central Level**: Shows data from ALL tenants the patient has access to
- **Tenant Level**: Shows data for the SPECIFIC tenant only
- **Same Controllers**: Both levels use the same underlying controllers, just with different data scope

## Dynamic Sections (Configurable)

### ✅ **Welcome Header Section** (`welcomeHeader`)
**Widgets that can be configured:**
- `patientGreeting` - Patient welcome message and name display
- `healthStatus` - Health status summary (on track, upcoming appointments, active meds)
- `tenantSwitcher` - Healthcare provider switcher (Central only)
- `clinicFilter` - Clinic/location filter (Central only)

### ✅ **Quick Actions Section** (`quickActions`)
**Widgets that can be configured:**
- `bookAppointment` - Book new appointment button
- `viewLabResults` - Access lab results button
- `updateProfile` - Update patient profile button
- `medicalRecords` - View medical records button

### ✅ **Quick Statistics Section** (`quickStats`)
**Widgets that can be configured:**
- `nextAppointment` - Next appointment card
- `activeMedications` - Active medications count
- `visitsThisYear` - Visits completed this year

### ✅ **Upcoming Appointments Section** (`upcomingAppointments`)
**Widgets that can be configured:**
- `appointmentsList` - List of upcoming appointments
- `scheduleNew` - Schedule new appointment button
- Display fields: Date, time, practitioner, service, location, mode (virtual/in-person)

### ✅ **Current Medications Section** (`currentMedications`)
**Widgets that can be configured:**
- `medicationsList` - List of current medications
- `refillReminders` - Medication refill reminders
- `viewPrescriptions` - View all prescriptions button
- Display fields: Name, dosage, frequency, purpose, prescribing doctor

### ✅ **Recent Visits Section** (`recentVisits`)
**Widgets that can be configured:**
- `visitsList` - List of recent healthcare visits
- `visitHistory` - View complete visit history button
- Display fields: Date, practitioner, service, status, summary, follow-up

### ✅ **Optional Sections** (Disabled by default, can be enabled)
- **Health Reminders** (`healthReminders`)
  - `preventiveCare` - Preventive care reminders
  - `medicationReminders` - Medication adherence reminders

- **Lab Results** (`labResults`)
  - `recentResults` - Recent lab test results
  - `trendsChart` - Lab values trends over time

- **Medical Documents** (`documents`)
  - `recentDocuments` - Recently uploaded documents
  - `uploadDocument` - Document upload interface

- **Vital Signs** (`vitals`)
  - `latestVitals` - Most recent vital signs
  - `vitalsChart` - Vital signs trends

- **Allergies & Conditions** (`allergies`)
  - `activeAllergies` - Current allergies list
  - `chronicConditions` - Chronic conditions summary

- **Family Medical History** (`familyHistory`)
  - `familyConditions` - Family medical conditions
  - `riskFactors` - Genetic risk factors

## ❌ Static Fields (Cannot be Made Dynamic)

### **Security & Authentication**
- `user_authentication_status` - Current login state
- `patient_id` - Patient identifier
- `tenant_id` - Current tenant context
- `session_management` - Session handling and cookies
- `role_permissions` - User role and permissions
- `csrf_token` - CSRF protection tokens

### **System Infrastructure**
- `route_breadcrumbs` - Navigation breadcrumbs
- `app_layout_wrapper` - Overall application layout
- `inertia_head_component` - Page head management
- `error_handling` - Error states and exception handling
- `loading_states` - Loading indicators and states

### **Core Logic**
- `tenant_switching_logic` - Multi-tenancy switching mechanism
- `cookie_based_auto_login` - Automatic login from public portal
- `central_vs_tenant_context` - Context determination logic

### **User Feedback Systems**
- `success_alert_messages` - Success notifications (public portal registration, appointment booking, waiting list signup)
- `error_alert_messages` - Error notifications and validation messages

## Configuration Structure

### **Layout Configuration**
```typescript
layout: {
    theme: 'default' | 'compact' | 'detailed',
    gridColumns: number,
    showBreadcrumbs: boolean,
    compactMode: boolean
}
```

### **Filter Configuration**
```typescript
filters: {
    showTenantSwitcher: boolean,    // Central: true, Tenant: false
    showClinicFilter: boolean,      // Central: true, Tenant: false
    defaultView: 'all' | 'current-tenant'
}
```

### **Section Configuration**
```typescript
sections: {
    [sectionId]: {
        id: string,
        title: string,
        enabled: boolean,
        order: number,
        layout: {
            gridSpan?: number,
            columns?: number
        },
        widgets: Widget[]
    }
}
```

## Implementation Details

### **Configuration Sources** (Priority Order)
1. **User Preferences** - Individual patient customizations
2. **Organization Settings** - Tenant-level defaults
3. **Default Configuration** - System defaults

### **Context-Specific Behavior**
- **Central Context**: Shows tenant switcher, clinic filter, aggregated data from all tenants
- **Tenant Context**: Hides tenant switcher, shows only current tenant data

### **Data Filtering**
- All dynamic sections respect the selected clinic/tenant filter
- Static fields are unaffected by filters
- Real-time updates when switching between contexts

## Future Enhancements

### **Potential Additional Dynamic Sections**
- Insurance information display
- Care team members
- Health goals and progress tracking
- Communication/messaging center
- Billing and payment history
- Health education resources

### **Advanced Configuration Options**
- Color themes per section
- Custom dashboard layouts
- Widget size customization
- Data refresh intervals
- Notification preferences

## Security Considerations

### **What Remains Protected**
- All authentication and authorization logic
- Tenant isolation and data segregation
- Session management and CSRF protection
- Core navigation and routing
- Error handling and logging

### **Configuration Validation**
- All configuration changes are validated server-side
- User permissions are checked before applying configurations
- Malicious configuration attempts are logged and blocked
- Default fallbacks prevent broken dashboard states

## Benefits of Dynamic Configuration

1. **Personalization** - Patients can customize their dashboard experience
2. **Organizational Flexibility** - Different healthcare providers can configure different default layouts
3. **Role-based Views** - Different sections can be enabled/disabled based on patient needs
4. **Context Awareness** - Central vs tenant contexts automatically adjust available features
5. **Scalability** - New sections and widgets can be added without code changes
6. **Maintainability** - Configuration-driven approach reduces hard-coded dependencies