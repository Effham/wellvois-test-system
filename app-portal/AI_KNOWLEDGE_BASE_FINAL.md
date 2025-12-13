# AI Knowledge Base Template for Multi-Tenant EMR: SCHEMA DEFINITION

## Purpose
This document serves as the formal schema and populated knowledge base for generating tenant-specific operational guidance. It is keyed strictly by URL paths and consumed by the Bedrock AI Chatbot.

## 1. Conceptual Diagram: AI Knowledge Flow 🗺️

```mermaid
graph TD
    A[Generic Markdown Template (This File)] --> C[Your Application / Service (Laravel + React)]
    B[Tenant-Specific Data (DB / Config)] --> C
    C --> D[Generated Tenant Knowledge (JSON / Context Object)]
    E[EMR Frontend Page URL / Raw HTML] --> F[Bedrock AI Chatbot / LLM]
    D --> F
    F --> G[Contextual Guidance to User]
```

## 2. Knowledge Structure (URL as Key)

```json
{
  "[TENANT_ID]": {
    "base_url": "[TENANT_PLATFORM_BASE_URL]",
    "knowledge": {
      "/": {
        "page_title": "Tenant Home Redirect",
        "module": "Core",
        "description": "Redirects to tenant login or appropriate landing based on auth. Access: Public; authenticated users are redirected by role to dashboards. Workflow: detect session → resolve role → route to practitioner or patient dashboard. Source: routes/tenant.php (home).",
        "key_data_fields": [
          {"field_name": "redirect_target", "purpose": "Computed destination path based on role", "edit_constraints": "System computed; read-only."}
        ],
        "user_actions": ["Navigate to Login"]
      },

      "/login": {
        "page_title": "Tenant Login Redirect",
        "module": "Authentication",
        "description": "Redirects users to central login to begin secure SSO. Access: Public. Workflow: tenant → central SSO → back to tenant /sso/start. Source: routes/tenant.php (/login).",
        "key_data_fields": [
          {"field_name": "central_login_url", "purpose": "Computed central login URL with return path", "edit_constraints": "System generated; read-only."}
        ],
        "user_actions": ["Proceed to Central Login"]
      },

      "/sso/start": {
        "page_title": "SSO Start (Tenant)",
        "module": "Authentication",
        "description": "Receives one-time SSO code and establishes tenant session after secure server-to-server exchange. Access: Public (code-bound). Workflow: validate code → exchange in central → create/update tenant user → assign role (Patient if linked) → login → redirect. Source: routes/tenant.php (/sso/start).",
        "key_data_fields": [
          {"field_name": "code", "purpose": "Opaque one-time code for SSO exchange", "edit_constraints": "Single-use; expires; read-only from URL"},
          {"field_name": "redirect_internal", "purpose": "Post-auth tenant path", "edit_constraints": "Computed at central; read-only."}
        ],
        "user_actions": ["Establish Session", "Redirect to Dashboard"]
      },

      "/logout": {
        "page_title": "Global Logout",
        "module": "Authentication",
        "description": "Terminates tenant session (and optionally public portal), then redirects to central login. Access: Authenticated. Workflow: perform global logout service → invalidate session → compute redirect (central or public portal). Source: routes/tenant.php (logout).",
        "key_data_fields": [
          {"field_name": "from_public_portal", "purpose": "Signals public portal flow", "edit_constraints": "Query param; read-only at runtime."}
        ],
        "user_actions": ["Logout"]
      },

      "/dashboard": {
        "page_title": "Tenant Dashboard",
        "module": "Core",
        "description": "Role-aware landing. Access: Authenticated. Workflow: if Patient → patient dashboard; if Practitioner → practitioner dashboard; else render tenant dashboard. Source: routes/tenant.php (dashboard).",
        "key_data_fields": [
          {"field_name": "auth.user.roles", "purpose": "Determines landing destination and visible widgets", "edit_constraints": "Managed by RBAC; read-only to UI."}
        ],
        "user_actions": ["Navigate to Role Dashboard"]
      },

      "/patient-dashboard": {
        "page_title": "Patient Dashboard",
        "module": "Patient Portal",
        "description": "Shows patient-specific tiles and summaries. Access: Authenticated Patient. Workflow: resolve patient in central by email → load tenant appointments and tiles. Source: routes/tenant.php (patient-dashboard), Tenant\PatientDashboardController@index.",
        "key_data_fields": [
          {"field_name": "appointments_summary", "purpose": "Upcoming/Recent appointments", "edit_constraints": "Read-only aggregation."}
        ],
        "user_actions": ["View Appointments", "Manage Health History"]
      },

      "/practitioner-dashboard": {
        "page_title": "Practitioner Dashboard",
        "module": "Clinical",
        "description": "Practitioner landing with schedule and tasks. Access: Role 'Practitioner'. Workflow: load practitioner context from central → render schedules, tasks. Source: routes/tenant.php (practitioner-dashboard), Tenant\PractitionerDashboardController@index.",
        "key_data_fields": [
          {"field_name": "today_schedule", "purpose": "List of today's sessions", "edit_constraints": "Read-only aggregation."}
        ],
        "user_actions": ["Open Session", "Review Tasks"]
      },

      "/attendance/status": {
        "page_title": "Attendance Status",
        "module": "Workforce",
        "description": "Returns current user's clock state and last events. Access: Authenticated. Workflow: query attendance state. Source: routes/tenant.php (attendance group), Tenant\AttendanceController@getStatus.",
        "key_data_fields": [
          {"field_name": "status", "purpose": "IN/OUT state", "edit_constraints": "Computed; read-only."},
          {"field_name": "last_clock_in", "purpose": "Timestamp of last IN", "edit_constraints": "System-managed; read-only."},
          {"field_name": "last_clock_out", "purpose": "Timestamp of last OUT", "edit_constraints": "System-managed; read-only."}
        ],
        "user_actions": ["View Status"]
      },

      "/attendance/clock-in": {
        "page_title": "Clock In",
        "module": "Workforce",
        "description": "Creates a clock-in entry. Access: Authenticated staff. Workflow: validate state → insert attendance record. Source: Tenant\AttendanceController@clockIn.",
        "key_data_fields": [
          {"field_name": "timestamp", "purpose": "Clock-in time", "edit_constraints": "Server time; read-only to end-user."},
          {"field_name": "location", "purpose": "Optional point of service", "edit_constraints": "Editable by user; validated by controller if present."}
        ],
        "user_actions": ["Clock In"]
      },

      "/attendance/clock-out": {
        "page_title": "Clock Out",
        "module": "Workforce",
        "description": "Creates a clock-out entry. Access: Authenticated staff. Workflow: validate matching IN → write OUT. Source: Tenant\AttendanceController@clockOut.",
        "key_data_fields": [
          {"field_name": "timestamp", "purpose": "Clock-out time", "edit_constraints": "Server time; read-only to end-user."}
        ],
        "user_actions": ["Clock Out"]
      },

      "/activity-logs": {
        "page_title": "Activity Logs",
        "module": "Audit",
        "description": "Lists tenant activity logs. Access: Authenticated (often Admin). Workflow: paginate activitylog entries. Source: ActivityLogController@index.",
        "key_data_fields": [
          {"field_name": "filters", "purpose": "Filter by actor/date/module", "edit_constraints": "Editable by Admin; filters only."}
        ],
        "user_actions": ["Review Logs"]
      },

      "/calendar": {
        "page_title": "Calendar",
        "module": "Scheduling",
        "description": "Role-aware calendar. Access: Authenticated. Workflow: If Patient, load their appointments; else route to CalendarController@index. Source: routes/tenant.php (/calendar).",
        "key_data_fields": [
          {"field_name": "appointments[]", "purpose": "Events for the view", "edit_constraints": "Read-only aggregation."}
        ],
        "user_actions": ["Browse Calendar"]
      },

      "/appointments": {
        "page_title": "Appointments Index",
        "module": "Scheduling",
        "description": "Shows appointment list/grid with filters. Access: Authenticated; typically Scheduler/Admin. Workflow: load filters → fetch data via Tenant\\AppointmentController@index. Source: routes/tenant.php (appointments group).",
        "key_data_fields": [
          {"field_name": "practitioner", "purpose": "Filter by provider", "edit_constraints": "Editable by Scheduler/Admin."},
          {"field_name": "location", "purpose": "Filter by clinic site", "edit_constraints": "Editable by Scheduler/Admin."},
          {"field_name": "service", "purpose": "Filter by service type", "edit_constraints": "Editable by Scheduler/Admin."},
          {"field_name": "date_range", "purpose": "Filter by window", "edit_constraints": "Editable by Scheduler/Admin."}
        ],
        "user_actions": ["Browse Appointments", "Open Create"]
      },

      "/appointments/create": {
        "page_title": "Create Appointment",
        "module": "Scheduling",
        "description": "Create an appointment. Access: Scheduler, Admin. Workflow: search/link patient → select service/location → calculate availability → store appointment (Tenant\\AppointmentController@store).",
        "key_data_fields": [
          {"field_name": "patient", "purpose": "Patient to link", "edit_constraints": "Editable by 'Scheduler' and 'Admin' until appointment completed."},
          {"field_name": "service", "purpose": "Determines default duration and type", "edit_constraints": {"roles": ["Scheduler", "Admin"], "when": "Editable until status is 'completed'"}},
          {"field_name": "location", "purpose": "Clinic site", "edit_constraints": "Editable by 'Scheduler' if provider supports location."},
          {"field_name": "datetime", "purpose": "Scheduled start", "edit_constraints": "Editable by 'Scheduler'/'Admin' if status in ['pending','confirmed']."},
          {"field_name": "mode", "purpose": "In-person or virtual", "edit_constraints": "Editable before session start; read-only after."}
        ],
        "user_actions": ["Search Patients", "Link Patient", "Check Availability", "Save Appointment"]
      },

      "/appointments/[appointment_id]/manage-appointment": {
        "page_title": "Manage Appointment",
        "module": "Scheduling",
        "description": "Modify appointment details with audit. Access: Scheduler, Admin; Practitioners may edit notes only. Workflow: validate status rules → apply changes → log activity. Source: Tenant\\AppointmentController@updateManageAppointment.",
        "key_data_fields": [
          {"field_name": "service", "purpose": "Change visit type", "edit_constraints": "Editable by 'Scheduler'/'Admin' if status != 'completed'."},
          {"field_name": "location", "purpose": "Update clinic site", "edit_constraints": "Editable by 'Scheduler'/'Admin' if provider supports location."},
          {"field_name": "datetime", "purpose": "Reschedule time", "edit_constraints": "Editable by 'Scheduler' if > 1 hour before start; 'Admin' anytime."},
          {"field_name": "notes", "purpose": "Operational notes", "edit_constraints": "Editable by 'Scheduler','Admin', and assigned 'Practitioner' until completed."}
        ],
        "user_actions": ["Edit Appointment", "Save Changes"]
      },

      "/appointments/[appointment_id]/status": {
        "page_title": "Update Appointment Status",
        "module": "Scheduling",
        "description": "Transition appointment status. Access: Scheduler, Admin. Workflow: validate allowed transitions (e.g., pending ⇄ confirmed; cannot modify after completed) → persist. Source: Tenant\\AppointmentController@updateStatus.",
        "key_data_fields": [
          {"field_name": "status", "purpose": "Lifecycle state", "edit_constraints": "Editable by Scheduler/Admin only while not 'completed'."}
        ],
        "user_actions": ["Update Status"]
      },

      "/appointments/[appointment_id]/session": {
        "page_title": "Session Details",
        "module": "Clinical",
        "description": "Encounter context for an appointment. Access: Assigned Practitioner; enforced by pivot check. Workflow: verify practitioner assignment → load patient (central) and encounter → render session. Source: routes/tenant.php (current-session).",
        "key_data_fields": [
          {"field_name": "appointment", "purpose": "Encounter anchor", "edit_constraints": "Read-only context."},
          {"field_name": "encounter", "purpose": "Clinical notes and vitals", "edit_constraints": "Editable by assigned Practitioner while session active."}
        ],
        "user_actions": ["Start Session", "Capture Notes"]
      },

      "/appointments/[appointment_id]/ai-summary": {
        "page_title": "AI Summary",
        "module": "Clinical AI",
        "description": "Displays AI-generated summary for the appointment context. Access: Practitioner/Admin. Workflow: assemble patient context → call BedrockAIService → render. Source: Tenant\\AppointmentController@showAISummary, Tenant\\AISummaryController.",
        "key_data_fields": [
          {"field_name": "patient_context", "purpose": "Aggregated medical history for LLM", "edit_constraints": "System generated; read-only."}
        ],
        "user_actions": ["View Summary", "Send to Patient"]
      },

      "/ai-summary/generate": {
        "page_title": "Generate AI Summary",
        "module": "Clinical AI",
        "description": "Generates AI summary with robust fallbacks. Access: Practitioner/Admin. Workflow: load appointment + patient + diseases (Tenant\\PatientMedicalHistory), family history, allergens (Tenant\\KnownAllergy), prior encounters → BedrockAIService.generateSummary → return bullets or fallback static summary. Source: Tenant\\AISummaryController@generateSummary.",
        "key_data_fields": [
          {"field_name": "appointment_id", "purpose": "Target appointment", "edit_constraints": "Required integer; validated server-side."}
        ],
        "user_actions": ["Generate Summary"]
      },

      "/notes": {
        "page_title": "Notes Index",
        "module": "Clinical Documentation",
        "description": "List/create clinical notes. Access: Authenticated; typically Practitioner/Admin. Workflow: render list; create via Tenant\\NoteController.",
        "key_data_fields": [
          {"field_name": "title", "purpose": "Note heading", "edit_constraints": "Required on create; editable by author/admin."},
          {"field_name": "content", "purpose": "Note body", "edit_constraints": "Editable by author/admin until signed where applicable."}
        ],
        "user_actions": ["Create Note", "Reorder"]
      },

      "/encounters/[encounter_id]/documents": {
        "page_title": "Encounter Documents",
        "module": "Clinical Documentation",
        "description": "Upload/list/manage documents for an encounter. Access: Practitioner/Admin. Workflow: upload to S3 via signed URL → store metadata → versioned updates. Source: Tenant\\EncounterDocumentController.",
        "key_data_fields": [
          {"field_name": "documents[]", "purpose": "Files linked to encounter", "edit_constraints": "Upload permitted to authorized roles; downloads open to same."}
        ],
        "user_actions": ["Upload Document", "View Document"]
      },

      "/wallet": {
        "page_title": "Wallet Overview",
        "module": "Financials",
        "description": "Tenant wallet dashboard. Access: Admin/Finance roles. Workflow: aggregate balances; allow recalculation endpoint. Source: WalletController@index + Tenant Wallet API routes.",
        "key_data_fields": [
          {"field_name": "balances", "purpose": "Computed financial summary", "edit_constraints": "System computed; read-only."}
        ],
        "user_actions": ["View Wallet"]
      },

      "/wallet/[wallet_id]/recalculate": {
        "page_title": "Recalculate Wallet",
        "module": "Financials",
        "description": "Recomputes wallet balance. Access: Admin/Finance. Workflow: backend recomputation from transactions; audited. Source: Tenant Wallet API controller.",
        "key_data_fields": [
          {"field_name": "wallet_id", "purpose": "Target wallet", "edit_constraints": "Required; Admin/Finance only."}
        ],
        "user_actions": ["Recalculate Balance"]
      },

      "/my-details": {
        "page_title": "My Details",
        "module": "Profile",
        "description": "Role-aware profile editor. Access: Logged-in user (Patient/Practitioner). Workflow: GET shows profile; PUT updates allowed sections. Source: Tenant\\PatientDashboardController@myDetails/@updateMyDetails.",
        "key_data_fields": [
          {"field_name": "contact_info", "purpose": "User contact details", "edit_constraints": "Editable only by logged-in user (self-service)."}
        ],
        "user_actions": ["Update Details"]
      },

      "/settings/organization": {
        "page_title": "Organization Settings",
        "module": "Settings",
        "description": "Initial setup and ongoing practice configuration. Access: Admin with permission:view-organization (view) and permission:view-settings (update endpoints). Workflow: update practice profile → branding (S3 logo proxy) → time/locale → appointment rules; save may trigger cache refresh and signed URLs. Source: routes/settings.php (GET), SettingsController methods; POST under /organization/*.",
        "key_data_fields": [
          {"field_name": "practice_details", "purpose": "Legal/operational practice data (OrganizationSetting: practice_details_*)", "edit_constraints": "Requires 'permission:view-settings' for updates; Admin-only."},
          {"field_name": "appearance.appearance_logo_s3_key", "purpose": "S3 key for tenant logo (proxied via /logo-proxy)", "edit_constraints": {"roles": ["Admin"], "when": "Always; must be valid S3 key and MIME"}},
          {"field_name": "time_locale.time_locale_timezone", "purpose": "Default timezone (overrides from active location if present)", "edit_constraints": "Admin-only; affects scheduler displays."},
          {"field_name": "appointment_settings", "purpose": "Global scheduling rules (OrganizationSetting: appointment_*)", "edit_constraints": "Admin-only; read-only for Scheduler in UI."}
        ],
        "user_actions": ["Edit Organization Settings", "Upload Logo", "Save"]
      },

      "/organization/practice-details": {
        "page_title": "Update Practice Details (API)",
        "module": "Settings API",
        "description": "Updates OrganizationSetting values prefixed with practice_details_. Access: Admin with permission:view-settings. Workflow: POST validate → save settings. Source: routes/settings.php (organization.*).",
        "key_data_fields": [
          {"field_name": "practice_details_*", "purpose": "Atomic fields (name, contact, address)", "edit_constraints": "Admin-only; validated per field type."}
        ],
        "user_actions": ["Save"]
      },

      "/organization/appearance": {
        "page_title": "Update Appearance (API)",
        "module": "Settings API",
        "description": "Updates appearance_* settings and logo S3 key. Access: Admin with permission:view-settings. Workflow: accept S3 key → compute proxy URL → persist. Source: SettingsController@updateAppearance.",
        "key_data_fields": [
          {"field_name": "appearance_theme_color", "purpose": "Theme color", "edit_constraints": "Admin-only"},
          {"field_name": "appearance_font_family", "purpose": "Brand font", "edit_constraints": "Admin-only"},
          {"field_name": "appearance_logo_s3_key", "purpose": "S3 key for logo", "edit_constraints": "Admin-only; must be valid key; MIME validated downstream."}
        ],
        "user_actions": ["Save"]
      },

      "/locations": {
        "page_title": "Locations",
        "module": "Administration",
        "description": "Manage clinic locations. Access: Admin. Workflow: CRUD locations; configure operating hours; assign practitioners via related endpoints. Source: LocationController + routes/tenant.php (resource + extras).",
        "key_data_fields": [
          {"field_name": "name", "purpose": "Location name", "edit_constraints": "Admin-only"},
          {"field_name": "timezone", "purpose": "Primary timezone", "edit_constraints": "Admin-only; impacts displays"}
        ],
        "user_actions": ["Create Location", "Set Hours", "Assign Practitioners"]
      },

      "/locations/[location_id]/operating-hours": {
        "page_title": "Operating Hours",
        "module": "Administration",
        "description": "Gets or updates operating hours for a location and coordinates with practitioner hours. Access: Admin (via settings pages) and location managers. Workflow: enable days → define time slots; disabling a day may prompt to remove practitioners’ hours (see disable-day). Source: routes/tenant.php (locations.operating-hours.get/update), Settings UI resources/js/pages/settings/Location/OperatingHours.tsx, LocationController.",
        "key_data_fields": [
          {"field_name": "day_of_week", "purpose": "Which day the slot applies to", "edit_constraints": "Admin/location-manager editable in UI."},
          {"field_name": "time_slots[]", "purpose": "Start/End ranges for the day", "edit_constraints": "Must not overlap; within reasonable business hours (enforced by UI/ops)."}
        ],
        "user_actions": ["Enable Day", "Add Time Slot", "Save"]
      },

      "/locations/[location_id]/disable-day": {
        "page_title": "Disable Day (Cascade)",
        "module": "Administration",
        "description": "Disables a day for operating hours and removes matching practitioner availability for provided practitioners. Access: Admin/location-manager. Workflow: validate day enum → update OperatingHours (set is_enabled=false, 00:00–00:00) → delete rows in practitioner_availability for given practitioner_ids/day → commit. Source: LocationController@disableDay.",
        "key_data_fields": [
          {"field_name": "day", "purpose": "Target day of week", "edit_constraints": "Required; one of sunday..saturday."},
          {"field_name": "practitioner_ids[]", "purpose": "Practitioners affected", "edit_constraints": "Optional array of integers; Admin/location-manager only."}
        ],
        "user_actions": ["Confirm Disable Day"]
      },

      "/practitioners": {
        "page_title": "Practitioners",
        "module": "Provider Management",
        "description": "List and manage practitioners linked to tenant. Access: Users with permission:view-practitioner. Workflow: search/paginate; invitation status via tenant pivot; profile picture proxied from S3. Source: Tenant\\PractitionerController@index.",
        "key_data_fields": [
          {"field_name": "search", "purpose": "Filter by name/email/title", "edit_constraints": "Editable by viewers; server sanitizes length and pattern."},
          {"field_name": "invitation_status", "purpose": "Link state to tenant", "edit_constraints": "System-derived; read-only."}
        ],
        "user_actions": ["Invite", "Link", "Edit", "Manage Availability", "Assign Services"]
      },

      "/practitioners/basic-info": {
        "page_title": "Save Practitioner Basic Info",
        "module": "Provider Management",
        "description": "Creates or updates basic info. Access: permission:add-practitioner (create) and permission:update-practitioner (update). Workflow: validate fields → for existing, if completed basic info then only the practitioner themselves (user_id match) can edit; supports S3 file keys for profile and documents; links practitioner to tenant upon creation. Source: Tenant\\PractitionerController@storeBasicInfo.",
        "key_data_fields": [
          {"field_name": "first_name", "purpose": "Given name", "edit_constraints": "required|string|max:255; Admin/Scheduler until completed; then practitioner self-service only."},
          {"field_name": "last_name", "purpose": "Family name", "edit_constraints": "required|string|max:255; same as above."},
          {"field_name": "email", "purpose": "Contact and login mapping", "edit_constraints": "required|email|max:255; uniqueness checked across central Users and Practitioners before create; immutable post-create except by practitioner self or admin process."},
          {"field_name": "profile_picture_s3_key", "purpose": "S3 image key", "edit_constraints": "optional|string; Admin/Scheduler or practitioner; proxied via /profile-picture-proxy."},
          {"field_name": "resume_files_s3_keys[]", "purpose": "CV uploads (S3)", "edit_constraints": "optional|array of strings; append-only semantics when updating (merged with existing)."}
        ],
        "user_actions": ["Save Basic Info"]
      },

      "/practitioners/combined-details": {
        "page_title": "Save Combined Practitioner Details",
        "module": "Provider Management",
        "description": "Create/update both basic and professional details in one step. Access: permission:add-practitioner or permission:update-practitioner. Workflow: validate extensive arrays (credentials, specialties, languages, etc.) → create or update practitioner centrally → link to tenant; if both basic info and professional details already saved, form becomes read-only via this endpoint and redirects to locations tab. Source: Tenant\\PractitionerController@storeCombinedDetails.",
        "key_data_fields": [
          {"field_name": "credentials[]", "purpose": "Degrees/certifications", "edit_constraints": "required|array|min:1; Admin/Scheduler until first save; afterwards locked via this form."},
          {"field_name": "years_of_experience", "purpose": "Experience summary", "edit_constraints": "required|string; same locking rule."},
          {"field_name": "license_number", "purpose": "Professional license", "edit_constraints": "required|string|max:100; masked in certain flows; same locking rule."},
          {"field_name": "primary_specialties[]", "purpose": "Primary specialties", "edit_constraints": "required|array|min:1; same locking rule."},
          {"field_name": "therapeutic_modalities[]", "purpose": "Modalities offered", "edit_constraints": "required|array|min:1; same locking rule."},
          {"field_name": "languages_spoken[]", "purpose": "Communication languages", "edit_constraints": "required|array|min:1; same locking rule."},
          {"field_name": "resume_files_s3_keys[]", "purpose": "CV uploads (S3)", "edit_constraints": "optional|array of strings; merged with existing."}
        ],
        "user_actions": ["Save Combined Details"]
      },

      "/practitioners/[practitioner_id]/locations/[location_id]/availability": {
        "page_title": "Practitioner Location Availability",
        "module": "Provider Management",
        "description": "Get/Set clinic hours for a practitioner at a location. Access: permission:update-practitioner (POST); view requires link to tenant. Workflow: GET aggregates rows by day; POST replaces existing rows with provided schedule slots inside a DB transaction. Source: Tenant\\PractitionerController@getLocationAvailability/storeLocationAvailability.",
        "key_data_fields": [
          {"field_name": "availability_schedule", "purpose": "Map day→array of time slots {start,end}", "edit_constraints": "required|array (POST); replaces existing; Admin/Scheduler with update-practitioner permission."}
        ],
        "user_actions": ["View Availability", "Update Availability"]
      },

      "/practitioners/[practitioner_id]/services": {
        "page_title": "Practitioner Services",
        "module": "Provider Management",
        "description": "Get/Set services offered by practitioner with custom price/duration. Access: permission:update-practitioner for POST. Workflow: GET left-joins practitioner_services pivot; POST validates and upserts/deletes per is_offered flag. Source: Tenant\\PractitionerController@getPractitionerServices/storePractitionerServices.",
        "key_data_fields": [
          {"field_name": "services[].pivot.is_offered", "purpose": "Offer toggle", "edit_constraints": "boolean; false removes pivot row."},
          {"field_name": "services[].pivot.custom_price", "purpose": "Price override", "edit_constraints": "nullable|numeric|min:0; Admin/Scheduler with update-practitioner."},
          {"field_name": "services[].pivot.custom_duration_minutes", "purpose": "Duration override (minutes)", "edit_constraints": "nullable|integer|min:15|max:480."}
        ],
        "user_actions": ["Assign Services", "Set Pricing"]
      },

      "/practitioners/pricing": {
        "page_title": "Practitioner Pricing",
        "module": "Provider Management",
        "description": "Store pricing payload on practitioner. Access: permission:update-practitioner. Workflow: validates practitioner_id and payload; updates model. Source: Tenant\\PractitionerController@storePricing.",
        "key_data_fields": [
          {"field_name": "service_pricing", "purpose": "Pricing map for services", "edit_constraints": "optional|array; Admin/Scheduler with update-practitioner."}
        ],
        "user_actions": ["Save Pricing"]
      },

      "/users": {
        "page_title": "Users",
        "module": "Administration",
        "description": "Manage tenant users (RBAC). Access: Admin. Workflow: index/create/edit with role assignment endpoint. Source: routes/tenant.php (users resource).",
        "key_data_fields": [
          {"field_name": "roles[]", "purpose": "Role assignments", "edit_constraints": "Admin-only; via PATCH users/{user}/role."}
        ],
        "user_actions": ["Invite User", "Assign Roles", "Archive/Restore"]
      },

      "/roles": {
        "page_title": "Roles",
        "module": "Administration",
        "description": "RBAC role management. Access: Admin. Workflow: create/edit/delete roles; attach permissions used by controllers (e.g., view-practitioner, add-practitioner, update-practitioner). Source: RoleController.",
        "key_data_fields": [
          {"field_name": "permissions[]", "purpose": "Grants capabilities to role", "edit_constraints": "Admin-only."}
        ],
        "user_actions": ["Create Role", "Assign Permissions"]
      },

      "/public-portal": {
        "page_title": "Public Portal Home",
        "module": "Public Portal",
        "description": "Tenant-branded public site. Access: Public. Workflow: services/locations/staff/booking flows. Source: PublicPortalController.",
        "key_data_fields": [
          {"field_name": "services", "purpose": "Catalog for booking", "edit_constraints": "Read-only to public; Admin edits via settings/services."}
        ],
        "user_actions": ["Browse Services", "Book Appointment"]
      }
    }
  }
}
```


