# AI Knowledge Base Template for Multi-Tenant EMR

This template defines the schema and structure for an AI-readable knowledge base in a multi-tenant EMR. It is a generic blueprint to be populated programmatically by an external system with tenant-specific values. The structure is strict: each tenant’s knowledge is keyed by its unique "[TENANT_ID]", and each knowledge entry is keyed by a parameterized URL path representing an EMR page.

## 1. Conceptual Diagram: AI Knowledge Flow 🗺️

```mermaid
graph TD
  A[Generic Markdown Template<br/>(This File / Schema)] --> C[Your Application / Service<br/>(Laravel + React)]
  B[Tenant-Specific Data<br/>(DB / Config)] --> C
  C --> D[Generated Tenant Knowledge<br/>(JSON / Context Object)]
  E[EMR Frontend Page URL / Raw HTML<br/>(Live Browser Context)] --> F[Bedrock AI Chatbot / LLM]
  D --> F
  F --> G[Contextual Guidance to User]
  A -. Blueprint guides mapping .-> D
  B -. Provides tenant values .-> D
```

## 2. Generic Knowledge Structure (URL as Key)

The structure below updates the description to include workflow and access rules, and revises key_data_fields to include field purpose and edit constraints.

```json
{
  "[TENANT_ID]": {
    "base_url": "[TENANT_PLATFORM_BASE_URL]",
    "knowledge": {
      "/": {
        "page_title": "Tenant Home Redirect",
        "module": "Core",
        "description": "Redirects to tenant login or appropriate landing based on auth. Access: public; redirects authenticated users based on role. Workflow: identifies role then routes to practitioner or patient dashboards. (GET)",
        "key_data_fields": ["redirect_target"],
        "user_actions": ["Navigate to Login"]
      },
      "/login": {
        "page_title": "Tenant Login Redirect",
        "module": "Authentication",
        "description": "Redirects users to central login to begin secure SSO. (GET)",
        "key_data_fields": ["central_login_url"],
        "user_actions": ["Proceed to Central Login"]
      },
      "/sso/start": {
        "page_title": "SSO Start (Tenant)",
        "module": "Authentication",
        "description": "Receives one-time SSO code and establishes tenant session after secure exchange. (GET)",
        "key_data_fields": ["code", "redirect_internal"],
        "user_actions": ["Establish Session", "Redirect to Dashboard"]
      },
      "/sso/login": {
        "page_title": "Legacy SSO Login (Tenant)",
        "module": "Authentication",
        "description": "Backward-compatibility endpoint for legacy SSO flows. (GET)",
        "key_data_fields": ["email", "central_user_id", "redirect", "session_key", "token", "expires"],
        "user_actions": ["Login via Legacy SSO"]
      },
      "/switch-to-central": {
        "page_title": "Switch To Central",
        "module": "Authentication",
        "description": "Redirect back to central domain dashboard. (GET)",
        "key_data_fields": ["central_url"],
        "user_actions": ["Return to Central"]
      },
      "/switch-to-tenant": {
        "page_title": "Switch To Tenant",
        "module": "Authentication",
        "description": "Generates SSO URL for switching tenants securely. (POST)",
        "key_data_fields": ["tenant_id", "redirect"],
        "user_actions": ["Switch Tenant"]
      },
      "/logout": {
        "page_title": "Global Logout",
        "module": "Authentication",
        "description": "Terminates session in tenant (and optionally public portal), redirects to central login. (GET/POST)",
        "key_data_fields": ["from_public_portal"],
        "user_actions": ["Logout"]
      },
      "/dashboard": {
        "page_title": "Dashboard",
        "module": "Core",
        "description": "Role-aware landing: redirects Patients to Patient Dashboard, Practitioners to Practitioner Dashboard. (GET)",
        "key_data_fields": ["auth.user.roles"],
        "user_actions": ["Navigate to Role Dashboard"]
      },
      "/patient-dashboard": {
        "page_title": "Patient Dashboard (Tenant)",
        "module": "Patient Portal",
        "description": "Tenant patient dashboard for authenticated patient users. (GET)",
        "key_data_fields": ["patient_tiles", "appointments_summary"],
        "user_actions": ["View Appointments", "Manage Health History"]
      },
      "/attendance/status": {
        "page_title": "Attendance Status",
        "module": "Workforce",
        "description": "Returns current user's clock-in/clock-out status history. (GET)",
        "key_data_fields": ["status", "last_clock_in", "last_clock_out"],
        "user_actions": ["View Status"]
      },
      "/attendance/clock-in": {
        "page_title": "Clock In",
        "module": "Workforce",
        "description": "Clock-in action for authenticated staff. (POST)",
        "key_data_fields": ["timestamp", "location"],
        "user_actions": ["Clock In"]
      },
      "/attendance/clock-out": {
        "page_title": "Clock Out",
        "module": "Workforce",
        "description": "Clock-out action for authenticated staff. (POST)",
        "key_data_fields": ["timestamp"],
        "user_actions": ["Clock Out"]
      },
      "/attendance/history": {
        "page_title": "Attendance History",
        "module": "Workforce",
        "description": "Attendance entries listing for current user. (GET)",
        "key_data_fields": ["entries[]"],
        "user_actions": ["Browse History"]
      },
      "/attendance-logs": {
        "page_title": "Attendance Logs (Admin)",
        "module": "Workforce",
        "description": "Administrative view of all attendance logs. Requires permission. (GET)",
        "key_data_fields": ["filters", "logs[]"],
        "user_actions": ["Audit Attendance"]
      },
      "/practitioner-dashboard": {
        "page_title": "Practitioner Dashboard",
        "module": "Clinical",
        "description": "Practitioner-focused dashboard with schedules and tasks. (GET)",
        "key_data_fields": ["today_schedule", "tasks"],
        "user_actions": ["Open Session", "Review Tasks"]
      },
      "/api/complete-onboarding": {
        "page_title": "Complete Onboarding",
        "module": "Administration",
        "description": "Marks tenant onboarding as complete at central. (POST)",
        "key_data_fields": ["tenant_id"],
        "user_actions": ["Complete Onboarding"]
      },
      "/roles": {
        "page_title": "Roles Management",
        "module": "Administration",
        "description": "RESTful resource for roles (index, create, store, edit, update, delete). (GET/POST/PATCH/DELETE)",
        "key_data_fields": {"role": ["name", "permissions[]"]},
        "user_actions": ["Create Role", "Assign Permissions"]
      },
      "/users": {
        "page_title": "Users Management",
        "module": "Administration",
        "description": "RESTful resource for users with archive/restore/force-delete and role update. (GET/POST/PATCH/DELETE)",
        "key_data_fields": {"user": ["name", "email", "roles[]", "status"]},
        "user_actions": ["Invite User", "Archive", "Restore", "Set Role"]
      },
      "/public-portal-registrations": {
        "page_title": "Public Portal Registrations",
        "module": "Public Portal",
        "description": "Admin view listing public portal registration records. (GET)",
        "key_data_fields": ["registrations[]"],
        "user_actions": ["Review Registration"]
      },
      "/patients": {
        "page_title": "Patients",
        "module": "Patient Management",
        "description": "RESTful patient management (index/show/create/edit). Includes email and health number validations. (GET/POST)",
        "key_data_fields": {"patient": ["first_name", "last_name", "email", "health_number"]},
        "user_actions": ["Create Patient", "Validate Email", "Check Health Number"]
      },
      "/waiting-list": {
        "page_title": "Waiting List",
        "module": "Scheduling",
        "description": "Tenant waiting list overview for appointments. (GET)",
        "key_data_fields": ["entries[]", "filters"],
        "user_actions": ["Review Waiting List"]
      },
      "/practitioners": {
        "page_title": "Practitioners",
        "module": "Provider Management",
        "description": "RESTful practitioner management with availability, locations, services, pricing, and invitations. (GET/POST)",
        "key_data_fields": {"practitioner": ["demographics", "locations[]", "services[]", "availability[]"]},
        "user_actions": ["Create Practitioner", "Link", "Invite", "Set Availability", "Assign Services"]
      },
      "/practitioner-details": {
        "page_title": "My Practitioner Details",
        "module": "Provider Self-Service",
        "description": "Practitioner self-service profile page. (GET/POST)",
        "key_data_fields": {"profile": ["specialties", "bio", "experience", "contact"]},
        "user_actions": ["Update Profile"]
      },
      "/services": {
        "page_title": "Services Catalog",
        "module": "Administration",
        "description": "RESTful services management with archive/restore and force-delete. (GET/POST/DELETE)",
        "key_data_fields": {"service": ["name", "default_duration_minutes", "price"]},
        "user_actions": ["Create Service", "Archive", "Restore"]
      },
      "/locations": {
        "page_title": "Locations",
        "module": "Administration",
        "description": "RESTful location management; includes operating hours and practitioner assignment. (GET/POST)",
        "key_data_fields": {"location": ["name", "address", "operating_hours[]", "practitioners[]"]},
        "user_actions": ["Create Location", "Set Hours", "Assign Practitioners", "Disable Day"]
      },
      "/appointments": {
        "page_title": "Appointments Index",
        "module": "Scheduling",
        "description": "Scheduling grid and appointment list. (GET)",
        "key_data_fields": {"filters": ["practitioner", "location", "service", "date_range"]},
        "user_actions": ["Browse Appointments", "Open Create"]
      },
      "/appointments/create": {
        "page_title": "Create Appointment",
        "module": "Scheduling",
        "description": "Appointment creation form with patient search/link and practitioner availability. Access: Scheduler, Admin. Workflow: select patient → choose service/location → compute availability → save appointment. (GET/POST)",
        "key_data_fields": {
          "appointment": [
            {"field_name": "patient", "purpose": "Links appointment to a patient", "edit_constraints": "Editable by 'Scheduler' and 'Admin' until appointment is completed"},
            {"field_name": "service", "purpose": "Determines visit type and duration", "edit_constraints": {"roles": ["Scheduler", "Admin"], "when": "Always until status is 'completed'"}},
            {"field_name": "location", "purpose": "Determines clinic site for the visit", "edit_constraints": "Editable by 'Scheduler' only if provider is available at location"},
            {"field_name": "datetime", "purpose": "Start time for appointment", "edit_constraints": "Editable by 'Scheduler' and 'Admin' if appointment status in ['pending','confirmed']"},
            {"field_name": "mode", "purpose": "In-person or virtual", "edit_constraints": "Editable by 'Scheduler' before session starts; read-only after session start"}
          ]
        },
        "user_actions": ["Search Patients", "Link Patient", "Check Availability", "Save Appointment"]
      },
      "/appointments/store": {
        "page_title": "Store Appointment",
        "module": "Scheduling",
        "description": "Persists new appointment. (POST)",
        "key_data_fields": ["patient_id", "service_id", "location_id", "appointment_datetime"],
        "user_actions": ["Create Appointment"]
      },
      "/appointments/[appointment_id]/status": {
        "page_title": "Update Appointment Status",
        "module": "Scheduling",
        "description": "Status transitions for appointment lifecycle. (PATCH)",
        "key_data_fields": ["status"],
        "user_actions": ["Update Status"]
      },
      "/appointments/[appointment_id]/manage-appointment": {
        "page_title": "Manage Appointment",
        "module": "Scheduling",
        "description": "Detailed manage view allowing updates. Access: Scheduler, Admin; Practitioners may edit notes only. Workflow: modify details within status constraints; edits audited. (GET/PATCH)",
        "key_data_fields": [
          {"field_name": "service", "purpose": "Adjusts appointment type", "edit_constraints": "Editable by 'Scheduler' and 'Admin' if status != 'completed'"},
          {"field_name": "location", "purpose": "Updates clinic site", "edit_constraints": "Editable by 'Scheduler' and 'Admin' only if provider supports location"},
          {"field_name": "datetime", "purpose": "Reschedule time", "edit_constraints": "Editable by 'Scheduler' if > 1 hour before start; Admin anytime"},
          {"field_name": "notes", "purpose": "Operational notes", "edit_constraints": "Editable by 'Scheduler', 'Admin', and assigned 'Practitioner' until completed"}
        ],
        "user_actions": ["Edit Appointment", "Save Changes"]
      },
      "/appointments/search": {
        "page_title": "Search Patients (Scheduling)",
        "module": "Scheduling",
        "description": "Patient search helper used during appointment creation. (POST)",
        "key_data_fields": ["query"],
        "user_actions": ["Search"]
      },
      "/appointments/fill-patient": {
        "page_title": "Fill Patient Data",
        "module": "Scheduling",
        "description": "Pre-fills patient data when selected in scheduler. (POST)",
        "key_data_fields": ["patient_id"],
        "user_actions": ["Autofill Patient"]
      },
      "/appointments/lookup-patients": {
        "page_title": "Lookup Patients",
        "module": "Scheduling",
        "description": "Lookup endpoint for patients. (POST)",
        "key_data_fields": ["filters"],
        "user_actions": ["Search"]
      },
      "/appointments/link-patient": {
        "page_title": "Link Patient",
        "module": "Scheduling",
        "description": "Links selected patient to appointment draft. (POST)",
        "key_data_fields": ["patient_id"],
        "user_actions": ["Link Patient"]
      },
      "/appointments/practitioner-availability": {
        "page_title": "Practitioner Availability",
        "module": "Scheduling",
        "description": "Calculates availability based on provider/location/service. (POST)",
        "key_data_fields": ["practitioner_id", "location_id", "service_id", "date_range"],
        "user_actions": ["Check Availability"]
      },
      "/appointments/[appointment_id]/session": {
        "page_title": "Open Session",
        "module": "Clinical",
        "description": "Session view for the appointment (encounter context). (GET)",
        "key_data_fields": ["appointment", "patient", "encounter", "antMediaUrl"],
        "user_actions": ["Start Session", "Capture Notes"]
      },
      "/appointments/[appointment_id]/ai-summary": {
        "page_title": "AI Summary",
        "module": "Clinical AI",
        "description": "Displays AI-generated summary for the appointment context. (GET)",
        "key_data_fields": ["summary", "patient_context"],
        "user_actions": ["View Summary", "Send to Patient"]
      },
      "/appointments/[appointment_id]/send-ai-summary": {
        "page_title": "Send AI Summary",
        "module": "Clinical AI",
        "description": "Sends AI summary to the patient. (POST)",
        "key_data_fields": ["delivery_channel"],
        "user_actions": ["Send Summary"]
      },
      "/appointments/[appointment_id]/update-ai-summary": {
        "page_title": "Update AI Summary",
        "module": "Clinical AI",
        "description": "Allows edits to the AI summary. (PUT)",
        "key_data_fields": ["summary_text"],
        "user_actions": ["Save Summary"]
      },
      "/appointments/[appointment_id]/regenerate-ai-summary": {
        "page_title": "Regenerate AI Summary",
        "module": "Clinical AI",
        "description": "Regenerates summary from latest data. (POST)",
        "key_data_fields": ["regeneration_reason"],
        "user_actions": ["Regenerate"]
      },
      "/appointments/[appointment_id]/history": {
        "page_title": "Appointment History",
        "module": "Scheduling",
        "description": "Audit/history for an appointment. (GET)",
        "key_data_fields": ["events[]"],
        "user_actions": ["Review History"]
      },
      "/appointments/[appointment_id]/feedback": {
        "page_title": "Appointment Feedback",
        "module": "Patient Experience",
        "description": "Displays feedback form or results for appointment. (GET/POST)",
        "key_data_fields": ["ratings", "comments"],
        "user_actions": ["Submit Feedback"]
      },
      "/appointments/[appointment_id]/send-patient-link": {
        "page_title": "Send Patient Link",
        "module": "Scheduling",
        "description": "Sends appointment link to patient. (POST)",
        "key_data_fields": ["channel", "message"],
        "user_actions": ["Send Link"]
      },
      "/appointments/[appointment_id]/complete": {
        "page_title": "Complete Appointment",
        "module": "Scheduling",
        "description": "Marks appointment completed and triggers transactions. (POST)",
        "key_data_fields": ["appointment_id"],
        "user_actions": ["Complete Appointment"]
      },
      "/activity-logs": {
        "page_title": "Activity Logs",
        "module": "Audit",
        "description": "Lists activity logs for tenant. (GET)",
        "key_data_fields": ["logs[]", "filters"],
        "user_actions": ["Review Logs"]
      },
      "/calendar": {
        "page_title": "Calendar",
        "module": "Scheduling",
        "description": "Calendar view for practitioners or patients (role-aware). (GET)",
        "key_data_fields": ["appointments[]", "currentDate", "userRole"],
        "user_actions": ["Browse Calendar"]
      },
      "/my-details": {
        "page_title": "My Details",
        "module": "Profile",
        "description": "Role-aware profile details (patient/practitioner). (GET/PUT)",
        "key_data_fields": ["profile"],
        "user_actions": ["Update Details"]
      },
      "/api/patient-dashboard/data": {
        "page_title": "Patient Dashboard Data API",
        "module": "Patient Portal",
        "description": "Provides data for patient dashboard widgets. (GET)",
        "key_data_fields": ["widgets"],
        "user_actions": ["Fetch Data"]
      },
      "/api/dashboard/data": {
        "page_title": "Tenant Dashboard Data API",
        "module": "Core",
        "description": "Provides data for tenant dashboard widgets. (GET)",
        "key_data_fields": ["widgets"],
        "user_actions": ["Fetch Data"]
      },
      "/my-details/family-medical-histories": {
        "page_title": "Update Family Medical Histories",
        "module": "Patient Portal",
        "description": "Modify patient's family medical histories. (PUT/DELETE)",
        "key_data_fields": ["entries[]"],
        "user_actions": ["Save", "Delete Entry"]
      },
      "/my-details/patient-medical-histories": {
        "page_title": "Update Patient Medical Histories",
        "module": "Patient Portal",
        "description": "Modify patient's own medical histories. (PUT/DELETE)",
        "key_data_fields": ["entries[]"],
        "user_actions": ["Save", "Delete Entry"]
      },
      "/my-details/known-allergies": {
        "page_title": "Update Known Allergies",
        "module": "Patient Portal",
        "description": "Modify patient's known allergies. (PUT/DELETE)",
        "key_data_fields": ["allergies[]"],
        "user_actions": ["Save", "Delete Allergy"]
      },
      "/integrations/check-calendar-conflicts": {
        "page_title": "Check Calendar Conflicts",
        "module": "Integrations",
        "description": "Checks conflicts against connected external calendars. (POST)",
        "key_data_fields": ["time_range", "calendar_ids[]"],
        "user_actions": ["Check Conflicts"]
      },
      "/integrations/check-day-conflicts": {
        "page_title": "Check Day Conflicts",
        "module": "Integrations",
        "description": "Checks all conflicts for a date across integrations. (POST)",
        "key_data_fields": ["date"],
        "user_actions": ["Check Conflicts"]
      },
      "/wallet": {
        "page_title": "Wallet (Inertia Page)",
        "module": "Financials",
        "description": "Wallet overview page for tenant. (GET)",
        "key_data_fields": ["balances", "filters"],
        "user_actions": ["View Wallet"]
      },
      "/wallet/[wallet_id]": {
        "page_title": "Wallet API: Show",
        "module": "Financials",
        "description": "Returns wallet details by ID. (GET)",
        "key_data_fields": ["wallet"],
        "user_actions": ["View Wallet Details"]
      },
      "/wallet/user/[user_id]": {
        "page_title": "Wallet API: By User",
        "module": "Financials",
        "description": "Returns wallet details by user. (GET)",
        "key_data_fields": ["wallet", "user"],
        "user_actions": ["View User Wallet"]
      },
      "/wallet/[wallet_id]/recalculate": {
        "page_title": "Wallet Recalculate",
        "module": "Financials",
        "description": "Recalculates wallet balance. (POST)",
        "key_data_fields": ["wallet_id"],
        "user_actions": ["Recalculate Balance"]
      },
      "/wallet/practitioner/[practitioner_id]/earnings": {
        "page_title": "Practitioner Earnings",
        "module": "Financials",
        "description": "Returns earnings summary for practitioner. (GET)",
        "key_data_fields": ["earnings", "period"],
        "user_actions": ["View Earnings"]
      },
      "/current-session/[appointment_id]": {
        "page_title": "Current Session",
        "module": "Clinical",
        "description": "Validates access and opens encounter session context for assigned practitioner. (GET)",
        "key_data_fields": ["appointment", "patient", "encounter", "antMediaUrl"],
        "user_actions": ["Open Session"]
      },
      "/encounters/[encounter_id]/documents": {
        "page_title": "Encounter Documents",
        "module": "Clinical Documentation",
        "description": "Upload/list/manage documents for an encounter. (GET/POST)",
        "key_data_fields": ["documents[]", "upload_url"],
        "user_actions": ["Upload Document", "View Document"]
      },
      "/encounters/[encounter_id]/documents/[document_id]": {
        "page_title": "Encounter Document Details",
        "module": "Clinical Documentation",
        "description": "Show/download/update/delete a specific encounter document. (GET/PATCH/DELETE)",
        "key_data_fields": ["document"],
        "user_actions": ["Download", "Update Metadata", "Delete"]
      },
      "/encounters/[encounter_id]/documents/count": {
        "page_title": "Encounter Documents Count",
        "module": "Clinical Documentation",
        "description": "Returns document count for encounter. (GET)",
        "key_data_fields": ["count"],
        "user_actions": ["View Count"]
      },
      "/session/save": {
        "page_title": "Save Session",
        "module": "Clinical",
        "description": "Saves in-progress encounter/session. (POST)",
        "key_data_fields": ["encounter_fields"],
        "user_actions": ["Save"]
      },
      "/session/finish": {
        "page_title": "Finish Session",
        "module": "Clinical",
        "description": "Completes the session and finalizes encounter. (POST)",
        "key_data_fields": ["finalization"],
        "user_actions": ["Finish Session"]
      },
      "/ai-summary/generate": {
        "page_title": "Generate AI Summary",
        "module": "Clinical AI",
        "description": "Generates AI summary using patient context and history. (POST)",
        "key_data_fields": ["appointment_id"],
        "user_actions": ["Generate Summary"]
      },
      "/intake/create": {
        "page_title": "Create Intake",
        "module": "Intake",
        "description": "Intake form for creating new patient/appointment intake. (GET)",
        "key_data_fields": ["patient_demographics", "contact"],
        "user_actions": ["Open Intake"]
      },
      "/intake/store": {
        "page_title": "Store Intake",
        "module": "Intake",
        "description": "Stores intake submission. (POST)",
        "key_data_fields": ["intake_payload"],
        "user_actions": ["Submit Intake"]
      },
      "/intake/search": {
        "page_title": "Search Patients (Intake)",
        "module": "Intake",
        "description": "Search endpoint for intake flow. (POST)",
        "key_data_fields": ["query"],
        "user_actions": ["Search"]
      },
      "/intake/link": {
        "page_title": "Link Patient (Intake)",
        "module": "Intake",
        "description": "Links patient to intake record. (POST)",
        "key_data_fields": ["patient_id"],
        "user_actions": ["Link Patient"]
      },
      "/intake/fill-patient": {
        "page_title": "Fill Patient Data (Intake)",
        "module": "Intake",
        "description": "Returns patient data to prefill intake forms. (POST)",
        "key_data_fields": ["patient_id"],
        "user_actions": ["Autofill"]
      },
      "/notes": {
        "page_title": "Notes",
        "module": "Clinical Documentation",
        "description": "RESTful notes management plus reorder endpoint. (GET/POST)",
        "key_data_fields": {"note": ["title", "content", "tags[]"]},
        "user_actions": ["Create Note", "Reorder"]
      },
      "/notes/reorder": {
        "page_title": "Reorder Notes",
        "module": "Clinical Documentation",
        "description": "Reorders notes for a user or context. (POST)",
        "key_data_fields": ["note_ids[]"],
        "user_actions": ["Save Order"]
      },
      "/stream-creator": {
        "page_title": "Live Stream Creator",
        "module": "Telehealth",
        "description": "Page to initiate a live stream session. (GET)",
        "key_data_fields": ["antMediaUrl"],
        "user_actions": ["Create Stream"]
      },
      "/stream-joiner": {
        "page_title": "Live Stream Joiner",
        "module": "Telehealth",
        "description": "Page to join a live stream session. (GET)",
        "key_data_fields": ["antMediaUrl"],
        "user_actions": ["Join Stream"]
      },
      "/logo-proxy/[tenant_id]": {
        "page_title": "Logo Proxy",
        "module": "Branding",
        "description": "Serves tenant-branded logo from S3 with CORS headers. (GET)",
        "key_data_fields": ["s3_key", "mime_type"],
        "user_actions": ["Fetch Logo"]
      },
      "/patient/appointment/[room_id]": {
        "page_title": "Patient Appointment Iframe",
        "module": "Telehealth",
        "description": "Tenant-branded public iframe for virtual appointment access. (GET)",
        "key_data_fields": ["roomId", "tenant", "patient", "antMediaUrl"],
        "user_actions": ["Join Appointment"]
      },
      "/profile-picture-proxy/[practitioner_id]": {
        "page_title": "Practitioner Profile Picture Proxy",
        "module": "Branding",
        "description": "Serves practitioner profile picture from S3 with CORS headers. (GET)",
        "key_data_fields": ["s3_key", "mime_type"],
        "user_actions": ["Fetch Profile Picture"]
      },
      "/session-check": {
        "page_title": "Session Check",
        "module": "Public Portal",
        "description": "Detects tenant session from public portal context. (GET)",
        "key_data_fields": ["session_status"],
        "user_actions": ["Check Session"]
      },
      "/public-portal": {
        "page_title": "Public Portal Home",
        "module": "Public Portal",
        "description": "Tenant-branded public portal landing page. (GET)",
        "key_data_fields": ["services", "locations", "staff"],
        "user_actions": ["Browse Services", "Book Appointment"]
      },
      "/public-portal/services": {
        "page_title": "Public Portal Services",
        "module": "Public Portal",
        "description": "Lists services available for booking. (GET)",
        "key_data_fields": ["services[]"],
        "user_actions": ["View Service"]
      },
      "/public-portal/locations": {
        "page_title": "Public Portal Locations",
        "module": "Public Portal",
        "description": "Lists practice locations. (GET)",
        "key_data_fields": ["locations[]"],
        "user_actions": ["View Location"]
      },
      "/public-portal/staff": {
        "page_title": "Public Portal Staff",
        "module": "Public Portal",
        "description": "Lists practitioners with public profiles. (GET)",
        "key_data_fields": ["practitioners[]"],
        "user_actions": ["View Practitioner"]
      },
      "/public-portal/assess-yourself": {
        "page_title": "Public Self-Assessment",
        "module": "Public Portal",
        "description": "Public self-assessment page. (GET)",
        "key_data_fields": ["assessment_form"],
        "user_actions": ["Start Assessment"]
      },
      "/public-portal/book-appointment": {
        "page_title": "Public Book Appointment",
        "module": "Public Portal",
        "description": "Public booking flow. (GET/POST)",
        "key_data_fields": ["patient_info", "service", "slot"],
        "user_actions": ["Book Appointment"]
      },
      "/public-portal/practitioner-availability": {
        "page_title": "Public Practitioner Availability",
        "module": "Public Portal",
        "description": "Availability endpoint for public booking. (POST)",
        "key_data_fields": ["practitioner_id", "location_id", "service_id", "date_range"],
        "user_actions": ["Check Availability"]
      },
      "/public-portal/register": {
        "page_title": "Public Portal Register",
        "module": "Public Portal",
        "description": "Public registration page and submission. (GET/POST)",
        "key_data_fields": ["user", "consents"],
        "user_actions": ["Register"]
      },
      "/public-portal/register-and-book": {
        "page_title": "Register And Book",
        "module": "Public Portal",
        "description": "Combined registration and booking endpoint. (POST)",
        "key_data_fields": ["user", "appointment"],
        "user_actions": ["Register & Book"]
      },
      "/public-portal/check-patient-exists": {
        "page_title": "Check Patient Exists",
        "module": "Public Portal",
        "description": "Checks if a patient exists in central by identifiers. (POST)",
        "key_data_fields": ["email", "health_number"],
        "user_actions": ["Verify Patient"]
      },
      "/public-portal/login-and-book": {
        "page_title": "Login And Book",
        "module": "Public Portal",
        "description": "Logs in existing patient and books appointment. (POST)",
        "key_data_fields": ["email", "password", "appointment"],
        "user_actions": ["Login & Book"]
      },
      "/public-portal/request-join-tenant": {
        "page_title": "Request Join Tenant",
        "module": "Public Portal",
        "description": "Requests to join tenant's patient list. (POST)",
        "key_data_fields": ["patient", "reason"],
        "user_actions": ["Request Join"]
      },
      "/public-portal/request-to-join": {
        "page_title": "Request To Join (Alias)",
        "module": "Public Portal",
        "description": "Alias endpoint for join requests. (POST)",
        "key_data_fields": ["patient", "reason"],
        "user_actions": ["Request Join"]
      },
      "/public-portal/join-waiting-list": {
        "page_title": "Join Waiting List",
        "module": "Public Portal",
        "description": "Adds patient to waiting list. (POST)",
        "key_data_fields": ["patient", "service", "preferred_times"],
        "user_actions": ["Join List"]
      },
      "/public-portal/integrations/check-calendar-conflicts": {
        "page_title": "Public Calendar Conflicts (Benign)",
        "module": "Public Portal",
        "description": "Public safe endpoint that always returns no conflicts. (POST)",
        "key_data_fields": ["date", "time_range"],
        "user_actions": ["Check Conflicts"]
      },
      "/public-portal/integrations/check-day-conflicts": {
        "page_title": "Public Day Conflicts (Benign)",
        "module": "Public Portal",
        "description": "Public safe endpoint returning no conflicts. (POST)",
        "key_data_fields": ["date"],
        "user_actions": ["Check Conflicts"]
      },
      "/virtual-session/[appointment_id]": {
        "page_title": "Virtual Session (Public)",
        "module": "Telehealth",
        "description": "Public virtual session page for patients with tokenized access. (GET)",
        "key_data_fields": ["appointment", "session_token"],
        "user_actions": ["Join Session"]
      },
      "/virtual-session/[appointment_id]/login": {
        "page_title": "Virtual Session Login",
        "module": "Telehealth",
        "description": "Performs patient login for virtual session context. (POST)",
        "key_data_fields": ["email", "code"],
        "user_actions": ["Login"]
      },
      "/waiting-list/accept/[token]": {
        "page_title": "Accept Waiting List Slot",
        "module": "Public Portal",
        "description": "Accepts offered slot via tokenized link. (GET)",
        "key_data_fields": ["token"],
        "user_actions": ["Accept Slot"]
      },
      "/waiting-list/confirm/[token]": {
        "page_title": "Confirm Waiting List Slot",
        "module": "Public Portal",
        "description": "Confirms offered slot via tokenized link. (POST)",
        "key_data_fields": ["token", "confirmation"],
        "user_actions": ["Confirm Slot"]
      },
      "/api/website-settings/navigation": {
        "page_title": "Website Navigation Settings",
        "module": "Website Settings",
        "description": "Gets or saves tenant public website navigation. (GET/POST)",
        "key_data_fields": ["navigation[]"],
        "user_actions": ["Get Settings", "Save Settings"]
      },
      "/api/website-settings/layout": {
        "page_title": "Website Layout Settings",
        "module": "Website Settings",
        "description": "Gets or saves tenant public website layout. (GET/POST)",
        "key_data_fields": ["layout"],
        "user_actions": ["Get Settings", "Save Settings"]
      },
      "/api/website-settings/appearance": {
        "page_title": "Website Appearance Settings",
        "module": "Website Settings",
        "description": "Gets or saves tenant public website appearance. (GET/POST)",
        "key_data_fields": ["theme_color", "font_family", "logo"],
        "user_actions": ["Get Settings", "Save Settings"]
      },
      
      "/roles/create": {
        "page_title": "Create Role",
        "module": "Administration",
        "description": "Form to create a new role. (GET)",
        "key_data_fields": {"role": ["name", "permissions[]"]},
        "user_actions": ["Create Role"]
      },
      "/roles/[role_id]": {
        "page_title": "Role Details",
        "module": "Administration",
        "description": "Show/Update/Delete specific role. (GET/PATCH/DELETE)",
        "key_data_fields": {"role": ["name", "permissions[]"]},
        "user_actions": ["Update Role", "Delete Role"]
      },
      "/roles/[role_id]/edit": {
        "page_title": "Edit Role",
        "module": "Administration",
        "description": "Form to edit role. (GET)",
        "key_data_fields": {"role": ["name", "permissions[]"]},
        "user_actions": ["Save Changes"]
      },
      
      "/users/create": {
        "page_title": "Create User",
        "module": "Administration",
        "description": "Form to create a new user. (GET)",
        "key_data_fields": {"user": ["name", "email", "roles[]"]},
        "user_actions": ["Create User"]
      },
      "/users/[user_id]": {
        "page_title": "User Details",
        "module": "Administration",
        "description": "Show/Update/Delete specific user. (GET/PATCH/DELETE)",
        "key_data_fields": {"user": ["name", "email", "roles[]", "status"]},
        "user_actions": ["Update User", "Delete User"]
      },
      "/users/[user_id]/edit": {
        "page_title": "Edit User",
        "module": "Administration",
        "description": "Form to edit user. (GET)",
        "key_data_fields": {"user": ["name", "email", "roles[]"]},
        "user_actions": ["Save Changes"]
      },
      "/users-archived": {
        "page_title": "Archived Users",
        "module": "Administration",
        "description": "List of archived users. (GET)",
        "key_data_fields": ["users[]"],
        "user_actions": ["Restore"]
      },
      "/users/[user_id]/restore": {
        "page_title": "Restore User",
        "module": "Administration",
        "description": "Restores an archived user. (POST)",
        "key_data_fields": ["user_id"],
        "user_actions": ["Restore"]
      },
      "/users/[user_id]/force-delete": {
        "page_title": "Force Delete User",
        "module": "Administration",
        "description": "Permanently deletes a user. (DELETE)",
        "key_data_fields": ["user_id"],
        "user_actions": ["Delete"]
      },
      "/users/[user_id]/role": {
        "page_title": "Update User Role",
        "module": "Administration",
        "description": "Updates a user's role. (PATCH)",
        "key_data_fields": ["role"],
        "user_actions": ["Set Role"]
      },
      
      "/services/create": {
        "page_title": "Create Service",
        "module": "Administration",
        "description": "Form to create a service. (GET)",
        "key_data_fields": {"service": ["name", "default_duration_minutes", "price"]},
        "user_actions": ["Create Service"]
      },
      "/services/[service_id]": {
        "page_title": "Service Details",
        "module": "Administration",
        "description": "Show/Update/Delete specific service. (GET/PATCH/DELETE)",
        "key_data_fields": {"service": ["name", "duration", "price"]},
        "user_actions": ["Update Service", "Delete Service"]
      },
      "/services/[service_id]/edit": {
        "page_title": "Edit Service",
        "module": "Administration",
        "description": "Form to edit service. (GET)",
        "key_data_fields": {"service": ["name", "duration", "price"]},
        "user_actions": ["Save Changes"]
      },
      "/services-archived": {
        "page_title": "Archived Services",
        "module": "Administration",
        "description": "List of archived services. (GET)",
        "key_data_fields": ["services[]"],
        "user_actions": ["Restore"]
      },
      "/services/[service_id]/restore": {
        "page_title": "Restore Service",
        "module": "Administration",
        "description": "Restores an archived service. (POST)",
        "key_data_fields": ["service_id"],
        "user_actions": ["Restore"]
      },
      "/services/[service_id]/force-delete": {
        "page_title": "Force Delete Service",
        "module": "Administration",
        "description": "Permanently deletes a service. (DELETE)",
        "key_data_fields": ["service_id"],
        "user_actions": ["Delete"]
      },
      
      "/notes/create": {
        "page_title": "Create Note",
        "module": "Clinical Documentation",
        "description": "Form to create a note. (GET)",
        "key_data_fields": {"note": ["title", "content"]},
        "user_actions": ["Create Note"]
      },
      "/notes/[note_id]": {
        "page_title": "Note Details",
        "module": "Clinical Documentation",
        "description": "Show/Update/Delete specific note. (GET/PATCH/DELETE)",
        "key_data_fields": {"note": ["title", "content", "tags[]"]},
        "user_actions": ["Update Note", "Delete Note"]
      },
      "/notes/[note_id]/edit": {
        "page_title": "Edit Note",
        "module": "Clinical Documentation",
        "description": "Form to edit note. (GET)",
        "key_data_fields": {"note": ["title", "content"]},
        "user_actions": ["Save Changes"]
      },
      
      "/settings": {
        "page_title": "Settings Index Redirect",
        "module": "Settings",
        "description": "Redirects to default settings page. (GET)",
        "key_data_fields": ["target"],
        "user_actions": ["Open Settings"]
      },
      "/settings/organization": {
        "page_title": "Organization Settings",
        "module": "Settings",
        "description": "Used for initial setup and ongoing practice configuration. Access: Admin only. Workflow: update practice profile → branding → localization → appointment rules; successful save may trigger logo processing and cache refresh. (GET)",
        "key_data_fields": [
          {"field_name": "practice_details", "purpose": "Legal/operational details of clinic", "edit_constraints": "Editable by 'Admin' only"},
          {"field_name": "branding", "purpose": "Logo and theme colors for tenant UI", "edit_constraints": {"roles": ["Admin"], "when": "Always; logo upload requires valid MIME type"}},
          {"field_name": "time_locale", "purpose": "Default timezone and locale", "edit_constraints": "Editable by 'Admin'; changing timezone affects scheduling displays"},
          {"field_name": "appointment_settings", "purpose": "Global scheduling rules", "edit_constraints": "Editable by 'Admin'; read-only for Scheduler"}
        ],
        "user_actions": ["Edit Organization Settings", "Upload Logo", "Save"]
      },
      "/settings/locations": {
        "page_title": "Locations Settings",
        "module": "Settings",
        "description": "Locations management page within settings. (GET)",
        "key_data_fields": ["locations[]"],
        "user_actions": ["Manage Locations"]
      },
      "/settings/practitioners": {
        "page_title": "Practitioners Settings Redirect",
        "module": "Settings",
        "description": "Redirects to practitioners list under settings. (GET)",
        "key_data_fields": ["redirect"],
        "user_actions": ["Open Practitioners"]
      },
      "/settings/practitioners/list": {
        "page_title": "Practitioners List (Settings)",
        "module": "Settings",
        "description": "Lists practitioners for administrative management. (GET)",
        "key_data_fields": ["practitioners[]"],
        "user_actions": ["View Practitioner", "Invite"]
      },
      "/settings/practitioners/invitations": {
        "page_title": "Practitioner Invitations (Settings)",
        "module": "Settings",
        "description": "Lists and manages practitioner invitations. (GET)",
        "key_data_fields": ["invitations[]"],
        "user_actions": ["Resend", "Revoke"]
      },
      "/settings/services": {
        "page_title": "Services (Settings)",
        "module": "Settings",
        "description": "Services configuration view. (GET)",
        "key_data_fields": ["services[]"],
        "user_actions": ["Create Service"]
      },
      "/settings/integrations": {
        "page_title": "Integrations (Settings)",
        "module": "Settings",
        "description": "User integrations management (e.g., Google Calendar). (GET)",
        "key_data_fields": ["integrations[]"],
        "user_actions": ["Connect", "Disconnect", "Sync"]
      },
      "/settings/website": {
        "page_title": "Website (Settings)",
        "module": "Settings",
        "description": "Website builder settings for public portal. (GET)",
        "key_data_fields": ["navigation", "layout", "appearance"],
        "user_actions": ["Configure Website"]
      },
      "/settings/profile": {
        "page_title": "Profile (Settings)",
        "module": "Settings",
        "description": "View, update, or delete user profile. (GET/PATCH/DELETE)",
        "key_data_fields": ["name", "email", "phone"],
        "user_actions": ["Update Profile", "Delete Account"]
      },
      "/settings/password": {
        "page_title": "Password (Settings)",
        "module": "Settings",
        "description": "Change account password. (GET/PUT)",
        "key_data_fields": ["current_password", "new_password"],
        "user_actions": ["Update Password"]
      },
      "/appearance": {
        "page_title": "Appearance (Settings)",
        "module": "Settings",
        "description": "Appearance settings page. (GET)",
        "key_data_fields": ["theme_color", "font_family", "logo"],
        "user_actions": ["Save Appearance"]
      },
      
      "/organization/practice-details": {
        "page_title": "Update Practice Details",
        "module": "Settings API",
        "description": "Updates practice details. (POST)",
        "key_data_fields": ["company_name", "contact", "address"],
        "user_actions": ["Save"]
      },
      "/organization/appearance": {
        "page_title": "Update Appearance",
        "module": "Settings API",
        "description": "Updates branding/appearance settings. (POST)",
        "key_data_fields": ["theme_color", "font_family", "logo_key"],
        "user_actions": ["Save"]
      },
      "/organization/logo-upload": {
        "page_title": "Upload Logo",
        "module": "Settings API",
        "description": "Uploads organization logo to S3. (POST)",
        "key_data_fields": ["file", "mime_type"],
        "user_actions": ["Upload"]
      },
      "/organization/time-locale": {
        "page_title": "Update Time & Locale",
        "module": "Settings API",
        "description": "Updates timezone and locale settings. (POST)",
        "key_data_fields": ["timezone", "locale"],
        "user_actions": ["Save"]
      },
      "/organization/business-compliance": {
        "page_title": "Update Business & Compliance",
        "module": "Settings API",
        "description": "Updates compliance/business settings. (POST)",
        "key_data_fields": ["policies", "compliance_flags"],
        "user_actions": ["Save"]
      },
      "/organization/appointment-settings": {
        "page_title": "Update Appointment Settings",
        "module": "Settings API",
        "description": "Updates appointment-related settings. (POST)",
        "key_data_fields": ["default_durations", "overbooking_rules"],
        "user_actions": ["Save"]
      },
      "/organization/integrations/connect/[provider]": {
        "page_title": "Connect Integration",
        "module": "Settings API",
        "description": "Initiates OAuth/connect flow for provider. (GET/POST)",
        "key_data_fields": ["provider", "scopes"],
        "user_actions": ["Connect"]
      },
      "/organization/integrations/[integration_id]/disconnect": {
        "page_title": "Disconnect Integration",
        "module": "Settings API",
        "description": "Disconnects a user integration. (POST)",
        "key_data_fields": ["integration_id"],
        "user_actions": ["Disconnect"]
      },
      "/organization/integrations/[integration_id]/test": {
        "page_title": "Test Integration",
        "module": "Settings API",
        "description": "Tests connectivity for an integration. (POST)",
        "key_data_fields": ["integration_id"],
        "user_actions": ["Test"]
      },
      "/organization/integrations/[integration_id]/sync": {
        "page_title": "Sync Integration",
        "module": "Settings API",
        "description": "Triggers synchronization for an integration. (POST)",
        "key_data_fields": ["integration_id"],
        "user_actions": ["Sync"]
      },
      "/organization/integrations/[integration_id]/configuration": {
        "page_title": "Update Integration Configuration",
        "module": "Settings API",
        "description": "Updates configuration for an integration. (PUT)",
        "key_data_fields": ["configuration"],
        "user_actions": ["Save Configuration"]
      }
    }
  }
}
```


