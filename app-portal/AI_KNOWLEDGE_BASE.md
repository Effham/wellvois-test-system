{
  "[TENANT_ID]": "[EMR_SAAS_TENANT]",
  "base_url": "https://[clinic-subdomain].emr-saas.com",
  "knowledge": {
    "version": "1.4",
    "updated_at": "2025-01-27",
    "context": "EMR SaaS — Complete Application Knowledge. Purpose: let the LLM guide users on WHERE to perform actions, WHY something does/doesn't appear, and WHAT fields exist.",
    "user_types": {
      "description": "The system distinguishes three distinct user types with different management paths and access patterns.",
      "users": {
        "definition": "Staff/admin users managed via RBAC (Role-Based Access Control)",
        "management_path": "/users",
        "description": "These are tenant staff members (Admin, Scheduler, etc.) who have user accounts with assigned roles and permissions. They are managed at /users and can be assigned roles via /roles.",
        "key_features": [
          "Managed at /users",
          "Have roles assigned (Admin, Scheduler, etc.)",
          "Can be linked to Patients or Practitioners via user_id",
          "Access controlled via permissions (e.g., view-practitioner, add-patient)",
          "Can be archived/restored"
        ],
        "relationships": "Users can be linked to Patient records or Practitioner profiles via user_id field"
      },
      "patients": {
        "definition": "Patient records stored in tenant database",
        "management_paths": [
          "/patients",
          "/intake/create",
          "/patient-invitations"
        ],
        "description": "Patient records are medical records stored in the tenant database. They can be created via /patients/create or /intake/create (intake workflow). Patients can be invited to the portal via /patient-invitations.",
        "key_features": [
          "Managed at /patients (list, create, edit, view)",
          "Created via /intake/create (intake/registration workflow)",
          "Can be invited to portal at /patients/{id}/invite",
          "Have patient records with medical history, allergies, etc.",
          "Can have user_id linking to a User account",
          "Permission: view-patient, add-patient, update-patient, approve-patient-registration"
        ],
        "relationships": "Patients can be linked to Users via user_id. When linked, the User has 'Patient' role and accesses /patient-dashboard",
        "distinction": "Patient records (data) vs Patient role (RBAC role for authenticated users)"
      },
      "practitioners": {
        "definition": "Medical practitioners with professional profiles",
        "management_paths": [
          "/settings/practitioners/list",
          "/settings/practitioners/invitations"
        ],
        "description": "Practitioners are medical providers managed at Settings → Practitioners. They have professional details (license, credentials, specialties) and can be assigned to locations with specific hours and service pricing.",
        "key_features": [
          "Managed at /settings/practitioners/list",
          "Can be invited via /settings/practitioners/invitations",
          "Have professional details (license, credentials, specialties)",
          "Assigned to locations with specific hours",
          "Can have custom pricing per service",
          "Can have user_id linking to a User account",
          "Permission: view-practitioner, add-practitioner, update-practitioner"
        ],
        "relationships": "Practitioners can be linked to Users via user_id. When linked, the User has 'Practitioner' role and accesses /practitioner-dashboard",
        "distinction": "Practitioner records (profiles) vs Practitioner role (RBAC role for authenticated users)",
        "edit_constraints": "After creation, clinic cannot edit Basic Info or Professional Details. Clinic CAN edit locations assignment, practitioner hours, and pricing per service."
      }
    },
    "navigation": {
      "organization": {
        "label": "Organization",
        "url": "/settings/organization"
      },
      "locations": {
        "label": "Locations",
        "url": "/settings/locations"
      },
      "practitioners_tabs": {
        "list": {
          "label": "Practitioners",
          "url": "/settings/practitioners/list"
        },
        "invitations": {
          "label": "Invitations",
          "url": "/settings/practitioners/invitations"
        }
      },
      "services": {
        "label": "Services",
        "url": "/settings/services"
      },
      "integrations": {
        "label": "Integrations",
        "url": "/settings/integrations"
      }
    },
    "high_level_rules": [
      "Settings uses different URLs per submenu but stays in the same page shell.",
      "Clinic can add a practitioner once; after creation, the clinic cannot edit Basic Info or Professional Details for that practitioner.",
      "Clinic admins CAN edit: (a) practitioner-to-location assignment (and practitioner hours within those locations) and (b) practitioner pricing per service (offer toggle + fee).",
      "Services are managed at Settings → Services; practitioner-specific pricing overrides the service default price for that clinic.",
      "Locations are managed at Settings → Locations.",
      "Organization-level branding, time/locale, compliance, and appointment defaults are under Settings → Organization."
    ],
    "where_to_do_what": [
      {
        "action": "Add a new location",
        "where": "Settings → Locations",
        "url": "/settings/locations",
        "notes": "Use 'Add New Location'; then attach practitioners."
      },
      {
        "action": "Edit a location (hours, contact, address)",
        "where": "Settings → Locations → open a location",
        "url": "/settings/locations"
      },
      {
        "action": "Attach/remove practitioner from a location",
        "where": "Settings → Locations → open a location → Attach Practitioners",
        "url": "/settings/locations",
        "notes": "You can also set practitioner hours per location."
      },
      {
        "action": "Add a practitioner (one-time per practitioner)",
        "where": "Settings → Practitioners → Practitioners tab → Add Practitioner",
        "url": "/settings/practitioners/list",
        "notes": "Lookup supports first_name, last_name, optional license_number; if not found, fill Basic Info & Professional Details."
      },
      {
        "action": "Set practitioner hours per location",
        "where": "Settings → Locations → open a location (or from practitioner → Locations tab)",
        "url": "/settings/locations",
        "notes": "Hours must fit inside the location's operating hours."
      },
      {
        "action": "Set practitioner pricing per service",
        "where": "Settings → Practitioners → open practitioner → Pricing",
        "url": "/settings/practitioners/list",
        "notes": "Toggle offer_service and set fee. Fee overrides service default price for this clinic."
      },
      {
        "action": "Invite / resend invite to practitioner",
        "where": "Settings → Practitioners → Invitations",
        "url": "/settings/practitioners/invitations"
      },
      {
        "action": "Manage services (add/edit/archive)",
        "where": "Settings → Services",
        "url": "/settings/services"
      },
      {
        "action": "Branding (logo/theme/colors/font)",
        "where": "Settings → Organization → Appearance",
        "url": "/settings/organization"
      },
      {
        "action": "Time zone / locale / formats",
        "where": "Settings → Organization → Time & Locale",
        "url": "/settings/organization"
      },
      {
        "action": "Compliance & business identifiers",
        "where": "Settings → Organization → Business & Compliance",
        "url": "/settings/organization"
      },
      {
        "action": "Appointment defaults",
        "where": "Settings → Organization → Appointment Settings",
        "url": "/settings/organization"
      },
      {
        "action": "Create a patient",
        "where": "Patients → Create Patient or Intake → Create",
        "url": "/patients/create",
        "notes": "Use /patients/create for direct creation or /intake/create for intake workflow"
      },
      {
        "action": "Manage patients",
        "where": "Patients",
        "url": "/patients",
        "notes": "List, view, edit, and manage patient records"
      },
      {
        "action": "Invite patient",
        "where": "Patients → Patient Details → Invite or Patient Invitations",
        "url": "/patient-invitations",
        "notes": "Send invitation to patient portal at /patients/{id}/invite or view all invitations at /patient-invitations"
      },
      {
        "action": "Edit patient medical history",
        "where": "Patients → Patient Details → Edit Medical History",
        "url": "/patients/{id}/edit-medical-history",
        "notes": "Admin-only access to edit medical history, family history, and allergies"
      },
      {
        "action": "Create an appointment",
        "where": "Appointments → Create",
        "url": "/appointments/create",
        "notes": "Requires permission:add-appointment (typically Scheduler/Admin)"
      },
      {
        "action": "Manage appointments",
        "where": "Appointments",
        "url": "/appointments",
        "notes": "View, filter, and manage appointments"
      },
      {
        "action": "View calendar",
        "where": "Calendar",
        "url": "/calendar",
        "notes": "Role-aware calendar view"
      },
      {
        "action": "Create an invoice",
        "where": "Invoices → Create",
        "url": "/invoices/create",
        "notes": "Requires permission:add-invoice"
      },
      {
        "action": "Manage invoices",
        "where": "Invoices",
        "url": "/invoices",
        "notes": "View, create, edit, send invoices, create transactions and payouts"
      },
      {
        "action": "View ledger",
        "where": "Ledger",
        "url": "/ledger",
        "notes": "View accounting ledger with all financial transactions"
      },
      {
        "action": "View wallet",
        "where": "Wallet",
        "url": "/wallet",
        "notes": "View tenant wallet dashboard and balances"
      },
      {
        "action": "Create a note",
        "where": "Notes → Create",
        "url": "/notes/create",
        "notes": "Create clinical notes (typically Practitioner/Admin)"
      },
      {
        "action": "Manage notes",
        "where": "Notes",
        "url": "/notes",
        "notes": "View and manage clinical notes"
      },
      {
        "action": "Clock in",
        "where": "Attendance → Clock In",
        "url": "/attendance/clock-in",
        "notes": "Staff attendance clock-in"
      },
      {
        "action": "Clock out",
        "where": "Attendance → Clock Out",
        "url": "/attendance/clock-out",
        "notes": "Staff attendance clock-out"
      },
      {
        "action": "View attendance logs",
        "where": "Attendance Logs",
        "url": "/attendance-logs",
        "notes": "View attendance history for staff"
      },
      {
        "action": "Manage waiting list",
        "where": "Waiting List",
        "url": "/waiting-list",
        "notes": "Add patients to waiting list and notify when slots available"
      },
      {
        "action": "Manage users",
        "where": "Users",
        "url": "/users",
        "notes": "Manage tenant users (staff/admin) with RBAC roles"
      },
      {
        "action": "Manage roles",
        "where": "Roles",
        "url": "/roles",
        "notes": "Create and manage RBAC roles and permissions"
      },
      {
        "action": "Manage consents",
        "where": "Consents",
        "url": "/consents",
        "notes": "Manage entity consents (patient/practitioner/user)"
      },
      {
        "action": "Manage policies and consents",
        "where": "Policies & Consents",
        "url": "/policies-consents",
        "notes": "Manage policy templates and consent versions"
      },
      {
        "action": "View public portal registrations",
        "where": "Public Portal Registrations",
        "url": "/public-portal-registrations",
        "notes": "Approve/reject patient registrations from public portal"
      },
      {
        "action": "Manage integrations",
        "where": "Settings → Integrations",
        "url": "/settings/integrations",
        "notes": "Connect/disconnect third-party integrations (calendar sync, etc.)"
      },
      {
        "action": "Manage website settings",
        "where": "Settings → Website",
        "url": "/settings/website",
        "notes": "Configure public portal website settings"
      }
    ],
    "access_control": {
      "description": "Role-based access control (RBAC) governs access to modules and actions. Users have roles (Admin, Scheduler, Practitioner, Patient) with associated permissions.",
      "roles": {
        "Admin": {
          "description": "Full access to all modules and settings",
          "typical_permissions": [
            "view-*",
            "add-*",
            "update-*",
            "delete-*",
            "view-settings",
            "view-organization",
            "view-location",
            "view-practitioner",
            "view-services",
            "view-integration",
            "view-website",
            "view-policies-consents"
          ],
          "access_patterns": [
            "Full CRUD on all modules",
            "Manage settings (organization, locations, practitioners, services, integrations, website)",
            "Manage users and roles",
            "View all financials (invoices, wallet, ledger)",
            "Manage consents and policies",
            "Approve patient registrations"
          ]
        },
        "Scheduler": {
          "description": "Manages appointments, patients, and calendar",
          "typical_permissions": [
            "view-appointment",
            "add-appointment",
            "update-appointment",
            "view-patient",
            "add-patient",
            "update-patient",
            "add-intake",
            "view-calendar"
          ],
          "access_patterns": [
            "Create and manage appointments",
            "View and manage patients",
            "Create patients via intake workflow",
            "View calendar",
            "Cannot access settings or financials"
          ]
        },
        "Practitioner": {
          "description": "Medical practitioner role - accesses own dashboard and assigned appointments",
          "typical_permissions": [
            "view-practitioner-dashboard",
            "view-appointment",
            "update-appointment",
            "view-patient",
            "add-note",
            "update-note",
            "view-encounter"
          ],
          "access_patterns": [
            "Access /practitioner-dashboard",
            "View and manage assigned appointments",
            "Start sessions for assigned appointments",
            "View patient details for assigned appointments",
            "Create and manage clinical notes",
            "Generate AI summaries for appointments",
            "Manage own consents at /practitioner/consents",
            "Cannot access settings, financials, or other practitioners' data"
          ],
          "distinction": "Practitioner role (RBAC) vs Practitioner record (profile managed at /settings/practitioners)"
        },
        "Patient": {
          "description": "Patient role - accesses own dashboard and medical information",
          "typical_permissions": [
            "view-patient-dashboard",
            "view-own-appointments",
            "view-own-medical-history",
            "update-own-contact-info"
          ],
          "access_patterns": [
            "Access /patient-dashboard",
            "View own appointments",
            "View own medical history",
            "Update own contact details at /my-details",
            "Manage own consents at /consents/manage",
            "Cannot access other patients' data or admin functions"
          ],
          "distinction": "Patient role (RBAC) vs Patient record (data managed at /patients)"
        }
      },
      "permissions": {
        "patient_management": {
          "view-patient": "View patient list and details",
          "add-patient": "Create new patient records",
          "update-patient": "Edit patient records",
          "add-intake": "Access intake/registration workflow",
          "approve-patient-registration": "Approve patient registrations from public portal"
        },
        "practitioner_management": {
          "view-practitioner": "View practitioner list and details",
          "add-practitioner": "Add new practitioners",
          "update-practitioner": "Edit practitioner assignments, hours, pricing"
        },
        "appointment_management": {
          "view-appointment": "View appointments",
          "add-appointment": "Create appointments",
          "update-appointment": "Edit appointments"
        },
        "financials": {
          "view-invoice": "View invoices",
          "add-invoice": "Create invoices",
          "view-ledger": "View accounting ledger",
          "view-wallet": "View wallet dashboard"
        },
        "clinical": {
          "add-note": "Create clinical notes",
          "update-note": "Edit clinical notes",
          "view-encounter": "View encounter details"
        },
        "settings": {
          "view-settings": "Access settings",
          "view-organization": "View organization settings",
          "view-location": "View locations",
          "view-services": "View services",
          "view-integration": "View integrations",
          "view-website": "View website settings",
          "view-policies-consents": "View policies and consents"
        },
        "workforce": {
          "view-attendance": "View attendance logs",
          "clock-in": "Clock in for attendance",
          "clock-out": "Clock out for attendance"
        },
        "scheduling": {
          "view-waiting-list": "View waiting list",
          "manage-waiting-list": "Add/remove patients from waiting list"
        }
      },
      "access_patterns": {
        "patient_records_vs_patient_role": {
          "patient_records": "Data stored in tenant database, managed at /patients. Access controlled by permissions: view-patient, add-patient, update-patient",
          "patient_role": "RBAC role for authenticated users. Users with Patient role access /patient-dashboard and see only their own data"
        },
        "practitioner_records_vs_practitioner_role": {
          "practitioner_records": "Profiles managed at /settings/practitioners. Access controlled by permissions: view-practitioner, add-practitioner, update-practitioner",
          "practitioner_role": "RBAC role for authenticated users. Users with Practitioner role access /practitioner-dashboard and see only assigned appointments"
        },
        "user_management": {
          "description": "Users (staff/admin) are managed at /users with RBAC roles assigned via /roles. Users can be linked to Patients or Practitioners via user_id field"
        }
      }
    },
    "dependencies": [
      {
        "goal": "Attach a practitioner to a location",
        "requires": [
          "Practitioner exists",
          "Location exists"
        ],
        "how_to_create_missing": [
          {
            "if_missing": "Practitioner",
            "do": "Add at /settings/practitioners/list (lookup by first_name, last_name, optional license_number; then invite/activate if applicable)"
          },
          {
            "if_missing": "Location",
            "do": "Create at /settings/locations"
          }
        ]
      },
      {
        "goal": "Set practitioner-specific pricing",
        "requires": [
          "Practitioner exists",
          "Service exists"
        ],
        "how_to_create_missing": [
          {
            "if_missing": "Service",
            "do": "Create at /settings/services"
          },
          {
            "then": "Open practitioner → Pricing at /settings/practitioners/list to set offer toggles and fees"
          }
        ]
      },
      {
        "goal": "Set practitioner hours at a location",
        "requires": [
          "Location operating hours defined",
          "Practitioner assigned to that location"
        ],
        "how_to_create_missing": [
          {
            "if_missing": "Location hours",
            "do": "Define in the location's detail at /settings/locations"
          },
          {
            "if_missing": "Assignment",
            "do": "Attach practitioner to the location first at /settings/locations"
          }
        ]
      }
    ],
    "permissions_and_editability": [
      {
        "entity": "Practitioner",
        "create": "Clinic can add practitioner once via Settings → Practitioners.",
        "edit": {
          "clinic": "After creation, clinic cannot edit Basic Info or Professional Details. Clinic CAN edit (a) locations assignment and practitioner hours per assigned location, (b) pricing per service (offer toggle + fee).",
          "system_admin": "May edit identity/licensure per global policy (implementation-specific)."
        }
      },
      {
        "entity": "Location",
        "create_edit": "Clinic can create/edit location data and operating hours; can attach/detach practitioners and set practitioner hours for that location."
      },
      {
        "entity": "Service",
        "create_edit": "Managed in Settings → Services (name/category/description/delivery mode/default price/status). Clinic sets practitioner-specific overrides via practitioner → Pricing."
      }
    ],
    "troubleshooting": [
      {
        "symptom": "Practitioners not showing in Locations when attaching.",
        "explanations": [
          "No practitioners exist yet for this clinic.",
          "Invitation pending / practitioner not active (if workflow requires activation).",
          "Search/filter mismatch or wrong clinic context."
        ],
        "fix": [
          "Add practitioners at /settings/practitioners/list (use lookup: first_name, last_name, optional license_number).",
          "Activate/accept invitations at /settings/practitioners/invitations.",
          "Clear filters and ensure correct clinic context."
        ],
        "where_to_fix": [
          "/settings/practitioners/list",
          "/settings/practitioners/invitations",
          "/settings/locations"
        ]
      },
      {
        "symptom": "Cannot edit practitioner name, email, license, or professional profile.",
        "explanations": [
          "By design, clinic cannot edit Basic Info or Professional Details after creation."
        ],
        "fix": [
          "Edit only locations assignment, practitioner hours, and pricing per service.",
          "Escalate to system admin for identity/licensure updates if policy allows."
        ],
        "where_to_fix": [
          "/settings/practitioners/list",
          "/settings/locations"
        ]
      },
      {
        "symptom": "Practitioner pricing screen shows no services.",
        "explanations": [
          "No services exist yet.",
          "Service is inactive/archived.",
          "Practitioner not assigned to any location (some UIs hide pricing if unassigned)."
        ],
        "fix": [
          "Create/activate services at /settings/services.",
          "Assign practitioner to at least one location at /settings/locations.",
          "Then set offer toggles and fees under practitioner → Pricing."
        ],
        "where_to_fix": [
          "/settings/services",
          "/settings/locations",
          "/settings/practitioners/list"
        ]
      },
      {
        "symptom": "Cannot set practitioner hours for a location.",
        "explanations": [
          "Location operating hours not defined.",
          "Practitioner not yet attached to that location."
        ],
        "fix": [
          "Define location operating hours in /settings/locations.",
          "Attach the practitioner to the location, then set practitioner-specific hours."
        ],
        "where_to_fix": [
          "/settings/locations"
        ]
      },
      {
        "symptom": "Service visible but not selectable for booking with this practitioner.",
        "explanations": [
          "Offer toggle is OFF for that practitioner.",
          "Service inactive/archived.",
          "Delivery mode conflicts with clinic/practitioner availability rules."
        ],
        "fix": [
          "Turn ON 'offer service' in practitioner → Pricing.",
          "Activate/edit the service at /settings/services.",
          "Align delivery mode and availability settings."
        ],
        "where_to_fix": [
          "/settings/practitioners/list",
          "/settings/services"
        ]
      }
    ],
    "faq_examples": [
      {
        "q": "Where can I add a new location?",
        "a": "Settings → Locations (/settings/locations) → 'Add New Location'."
      },
      {
        "q": "How do I attach a practitioner to a location?",
        "a": "Open the location at /settings/locations → 'Attach Practitioners' → Save. Set practitioner hours if needed."
      },
      {
        "q": "Why aren't practitioners appearing when I try to attach them to a location?",
        "a": "Add/activate practitioners first in Settings → Practitioners, or clear filters. Then attach from Locations."
      },
      {
        "q": "How do I set which services a practitioner offers and their fees?",
        "a": "Settings → Practitioners (/settings/practitioners/list) → open the practitioner → Pricing tab. Toggle 'offer service' and set fee."
      },
      {
        "q": "Why can't I edit a practitioner's basic or professional details?",
        "a": "Clinics can only edit locations assignment, practitioner hours, and pricing after creation. Basic/Professional details are locked by design."
      },
      {
        "q": "Where do I add or edit services?",
        "a": "Settings → Services (/settings/services). Practitioner-level overrides live under practitioner → Pricing."
      },
      {
        "q": "How do I change logo or theme?",
        "a": "Settings → Organization (/settings/organization) → Appearance tab."
      },
      {
        "q": "How do I set time zone or date/time format?",
        "a": "Settings → Organization → Time & Locale tab."
      },
      {
        "q": "Where do I enter tax/registration/license info for the clinic?",
        "a": "Settings → Organization → Business & Compliance tab."
      },
      {
        "q": "How do I change default session duration or booking windows?",
        "a": "Settings → Organization → Appointment Settings tab."
      }
    ],
    "routing_aliases": [
      {
        "alias": "public portal",
        "maps_to": "/settings/locations|/settings/services|/settings/practitioners/list (depends on task)"
      },
      {
        "alias": "public website",
        "maps_to": "/settings/locations|/settings/services|/settings/practitioners/list"
      },
      {
        "alias": "add doctor",
        "maps_to": "/settings/practitioners/list"
      },
      {
        "alias": "invite practitioner",
        "maps_to": "/settings/practitioners/invitations"
      },
      {
        "alias": "manage services",
        "maps_to": "/settings/services"
      },
      {
        "alias": "manage locations",
        "maps_to": "/settings/locations"
      }
    ],
    "knowledge": {
      "/": {
        "page_title": "Tenant Home Redirect",
        "module": "Core",
        "description": "Redirects to tenant login or appropriate landing based on auth. Access: Public; authenticated users are redirected by role to dashboards. Workflow: detect session → resolve role → route to practitioner or patient dashboard. Source: routes/tenant.php (home).",
        "key_data_fields": [
          {
            "field_name": "redirect_target",
            "purpose": "Computed destination path based on role",
            "edit_constraints": "System computed; read-only."
          }
        ],
        "user_actions": [
          "Navigate to Login"
        ]
      },
      "/login": {
        "page_title": "Tenant Login Redirect",
        "module": "Authentication",
        "description": "Redirects users to central login to begin secure SSO. Access: Public. Workflow: tenant → central SSO → back to tenant /sso/start. Source: routes/tenant.php (/login).",
        "key_data_fields": [
          {
            "field_name": "central_login_url",
            "purpose": "Computed central login URL with return path",
            "edit_constraints": "System generated; read-only."
          }
        ],
        "user_actions": [
          "Proceed to Central Login"
        ]
      },
      "/sso/start": {
        "page_title": "SSO Start (Tenant)",
        "module": "Authentication",
        "description": "Receives one-time SSO code and establishes tenant session after secure server-to-server exchange. Access: Public (code-bound). Workflow: validate code → exchange in central → create/update tenant user → assign role (Patient if linked) → login → redirect. Source: routes/tenant.php (/sso/start).",
        "key_data_fields": [
          {
            "field_name": "code",
            "purpose": "Opaque one-time code for SSO exchange",
            "edit_constraints": "Single-use; expires; read-only from URL"
          },
          {
            "field_name": "redirect_internal",
            "purpose": "Post-auth tenant path",
            "edit_constraints": "Computed at central; read-only."
          }
        ],
        "user_actions": [
          "Establish Session",
          "Redirect to Dashboard"
        ]
      },
      "/logout": {
        "page_title": "Global Logout",
        "module": "Authentication",
        "description": "Terminates tenant session (and optionally public portal), then redirects to central login. Access: Authenticated. Workflow: perform global logout service → invalidate session → compute redirect (central or public portal). Source: routes/tenant.php (logout).",
        "key_data_fields": [
          {
            "field_name": "from_public_portal",
            "purpose": "Signals public portal flow",
            "edit_constraints": "Query param; read-only at runtime."
          }
        ],
        "user_actions": [
          "Logout"
        ]
      },
      "/dashboard": {
        "page_title": "Tenant Dashboard",
        "module": "Core",
        "description": "Role-aware landing. Access: Authenticated. Workflow: if Patient → patient dashboard; if Practitioner → practitioner dashboard; else render tenant dashboard. Source: routes/tenant.php (dashboard).",
        "key_data_fields": [
          {
            "field_name": "auth.user.roles",
            "purpose": "Determines landing destination and visible widgets",
            "edit_constraints": "Managed by RBAC; read-only to UI."
          }
        ],
        "user_actions": [
          "Navigate to Role Dashboard"
        ]
      },
      "/patient-dashboard": {
        "page_title": "Patient Dashboard",
        "module": "Patient Portal",
        "description": "Shows patient-specific tiles and summaries. Access: Authenticated Patient. Workflow: resolve patient in central by email → load tenant appointments and tiles. Source: routes/tenant.php (patient-dashboard), Tenant\\PatientDashboardController@index.",
        "key_data_fields": [
          {
            "field_name": "appointments_summary",
            "purpose": "Upcoming/Recent appointments",
            "edit_constraints": "Read-only aggregation."
          }
        ],
        "user_actions": [
          "View Appointments",
          "Manage Health History"
        ]
      },
      "/practitioner-dashboard": {
        "page_title": "Practitioner Dashboard",
        "module": "Clinical",
        "description": "Practitioner landing with schedule and tasks. Access: Role 'Practitioner'. Workflow: load practitioner context from central → render schedules, tasks. Source: routes/tenant.php (practitioner-dashboard), Tenant\\PractitionerDashboardController@index.",
        "key_data_fields": [
          {
            "field_name": "today_schedule",
            "purpose": "List of today's sessions",
            "edit_constraints": "Read-only aggregation."
          }
        ],
        "user_actions": [
          "Open Session",
          "Review Tasks"
        ]
      },
      "/attendance/status": {
        "page_title": "Attendance Status",
        "module": "Workforce",
        "description": "Returns current user's clock state and last events. Access: Authenticated. Workflow: query attendance state. Source: routes/tenant.php (attendance group), Tenant\\AttendanceController@getStatus.",
        "key_data_fields": [
          {
            "field_name": "status",
            "purpose": "IN/OUT state",
            "edit_constraints": "Computed; read-only."
          },
          {
            "field_name": "last_clock_in",
            "purpose": "Timestamp of last IN",
            "edit_constraints": "System-managed; read-only."
          },
          {
            "field_name": "last_clock_out",
            "purpose": "Timestamp of last OUT",
            "edit_constraints": "System-managed; read-only."
          }
        ],
        "user_actions": [
          "View Status"
        ]
      },
      "/attendance/clock-in": {
        "page_title": "Clock In",
        "module": "Workforce",
        "description": "Creates a clock-in entry. Access: Authenticated staff. Workflow: validate state → insert attendance record. Source: Tenant\\AttendanceController@clockIn.",
        "key_data_fields": [
          {
            "field_name": "timestamp",
            "purpose": "Clock-in time",
            "edit_constraints": "Server time; read-only to end-user."
          },
          {
            "field_name": "location",
            "purpose": "Optional point of service",
            "edit_constraints": "Editable by user; validated by controller if present."
          }
        ],
        "user_actions": [
          "Clock In"
        ]
      },
      "/attendance/clock-out": {
        "page_title": "Clock Out",
        "module": "Workforce",
        "description": "Creates a clock-out entry. Access: Authenticated staff. Workflow: validate matching IN → write OUT. Source: Tenant\\AttendanceController@clockOut.",
        "key_data_fields": [
          {
            "field_name": "timestamp",
            "purpose": "Clock-out time",
            "edit_constraints": "Server time; read-only to end-user."
          }
        ],
        "user_actions": [
          "Clock Out"
        ]
      },
      "/activity-logs": {
        "page_title": "Activity Logs",
        "module": "Audit",
        "description": "Lists tenant activity logs. Access: Authenticated (often Admin). Workflow: paginate activitylog entries. Source: ActivityLogController@index.",
        "key_data_fields": [
          {
            "field_name": "filters",
            "purpose": "Filter by actor/date/module",
            "edit_constraints": "Editable by Admin; filters only."
          }
        ],
        "user_actions": [
          "Review Logs"
        ]
      },
      "/calendar": {
        "page_title": "Calendar",
        "module": "Scheduling",
        "description": "Role-aware calendar. Access: Authenticated. Workflow: If Patient, load their appointments; else route to CalendarController@index. Source: routes/tenant.php (/calendar).",
        "key_data_fields": [
          {
            "field_name": "appointments[]",
            "purpose": "Events for the view",
            "edit_constraints": "Read-only aggregation."
          }
        ],
        "user_actions": [
          "Browse Calendar"
        ]
      },
      "/appointments": {
        "page_title": "Appointments Index",
        "module": "Scheduling",
        "description": "Shows appointment list/grid with filters. Access: Authenticated; typically Scheduler/Admin. Workflow: load filters → fetch data via Tenant\\AppointmentController@index. Source: routes/tenant.php (appointments group).",
        "key_data_fields": [
          {
            "field_name": "practitioner",
            "purpose": "Filter by provider",
            "edit_constraints": "Editable by Scheduler/Admin."
          },
          {
            "field_name": "location",
            "purpose": "Filter by clinic site",
            "edit_constraints": "Editable by Scheduler/Admin."
          },
          {
            "field_name": "service",
            "purpose": "Filter by service type",
            "edit_constraints": "Editable by Scheduler/Admin."
          },
          {
            "field_name": "date_range",
            "purpose": "Filter by window",
            "edit_constraints": "Editable by Scheduler/Admin."
          }
        ],
        "user_actions": [
          "Browse Appointments",
          "Open Create"
        ]
      },
      "/appointments/create": {
        "page_title": "Create Appointment",
        "module": "Scheduling",
        "description": "Create an appointment. Access: Scheduler, Admin. Workflow: search/link patient → select service/location → calculate availability → store appointment (Tenant\\AppointmentController@store).",
        "key_data_fields": [
          {
            "field_name": "patient",
            "purpose": "Patient to link",
            "edit_constraints": "Editable by 'Scheduler' and 'Admin' until appointment completed."
          },
          {
            "field_name": "service",
            "purpose": "Determines default duration and type",
            "edit_constraints": {
              "roles": [
                "Scheduler",
                "Admin"
              ],
              "when": "Editable until status is 'completed'"
            }
          },
          {
            "field_name": "location",
            "purpose": "Clinic site",
            "edit_constraints": "Editable by 'Scheduler' if provider supports location."
          },
          {
            "field_name": "datetime",
            "purpose": "Scheduled start",
            "edit_constraints": "Editable by 'Scheduler'/'Admin' if status in ['pending','confirmed']."
          },
          {
            "field_name": "mode",
            "purpose": "In-person or virtual",
            "edit_constraints": "Editable before session start; read-only after."
          }
        ],
        "user_actions": [
          "Search Patients",
          "Link Patient",
          "Check Availability",
          "Save Appointment"
        ]
      },
      "/appointments/[appointment_id]/manage-appointment": {
        "page_title": "Manage Appointment",
        "module": "Scheduling",
        "description": "Modify appointment details with audit. Access: Scheduler, Admin; Practitioners may edit notes only. Workflow: validate status rules → apply changes → log activity. Source: Tenant\\AppointmentController@updateManageAppointment.",
        "key_data_fields": [
          {
            "field_name": "service",
            "purpose": "Change visit type",
            "edit_constraints": "Editable by 'Scheduler'/'Admin' if status != 'completed'."
          },
          {
            "field_name": "location",
            "purpose": "Update clinic site",
            "edit_constraints": "Editable by 'Scheduler'/'Admin' if provider supports location."
          },
          {
            "field_name": "datetime",
            "purpose": "Reschedule time",
            "edit_constraints": "Editable by 'Scheduler' if > 1 hour before start; 'Admin' anytime."
          },
          {
            "field_name": "notes",
            "purpose": "Operational notes",
            "edit_constraints": "Editable by 'Scheduler','Admin', and assigned 'Practitioner' until completed."
          }
        ],
        "user_actions": [
          "Edit Appointment",
          "Save Changes"
        ]
      },
      "/appointments/[appointment_id]/status": {
        "page_title": "Update Appointment Status",
        "module": "Scheduling",
        "description": "Transition appointment status. Access: Scheduler, Admin. Workflow: validate allowed transitions (e.g., pending ⇄ confirmed; cannot modify after completed) → persist. Source: Tenant\\AppointmentController@updateStatus.",
        "key_data_fields": [
          {
            "field_name": "status",
            "purpose": "Lifecycle state",
            "edit_constraints": "Editable by Scheduler/Admin only while not 'completed'."
          }
        ],
        "user_actions": [
          "Update Status"
        ]
      },
      "/appointments/[appointment_id]/session": {
        "page_title": "Session Details",
        "module": "Clinical",
        "description": "Encounter context for an appointment. Access: Assigned Practitioner; enforced by pivot check. Workflow: verify practitioner assignment → load patient (central) and encounter → render session. Source: routes/tenant.php (current-session).",
        "key_data_fields": [
          {
            "field_name": "appointment",
            "purpose": "Encounter anchor",
            "edit_constraints": "Read-only context."
          },
          {
            "field_name": "encounter",
            "purpose": "Clinical notes and vitals",
            "edit_constraints": "Editable by assigned Practitioner while session active."
          }
        ],
        "user_actions": [
          "Start Session",
          "Capture Notes"
        ]
      },
      "/appointments/[appointment_id]/ai-summary": {
        "page_title": "AI Summary",
        "module": "Clinical AI",
        "description": "Displays AI-generated summary for the appointment context. Access: Practitioner/Admin. Workflow: assemble patient context → call BedrockAIService → render. Source: Tenant\\AppointmentController@showAISummary, Tenant\\AISummaryController.",
        "key_data_fields": [
          {
            "field_name": "patient_context",
            "purpose": "Aggregated medical history for LLM",
            "edit_constraints": "System generated; read-only."
          }
        ],
        "user_actions": [
          "View Summary",
          "Send to Patient"
        ]
      },
      "/ai-summary/generate": {
        "page_title": "Generate AI Summary",
        "module": "Clinical AI",
        "description": "Generates AI summary with robust fallbacks. Access: Practitioner/Admin. Workflow: load appointment + patient + diseases (Tenant\\PatientMedicalHistory), family history, allergens (Tenant\\KnownAllergy), prior encounters → BedrockAIService.generateSummary → return bullets or fallback static summary. Source: Tenant\\AISummaryController@generateSummary.",
        "key_data_fields": [
          {
            "field_name": "appointment_id",
            "purpose": "Target appointment",
            "edit_constraints": "Required integer; validated server-side."
          }
        ],
        "user_actions": [
          "Generate Summary"
        ]
      },
      "/notes": {
        "page_title": "Notes Index",
        "module": "Clinical Documentation",
        "description": "List/create clinical notes. Access: Authenticated; typically Practitioner/Admin. Workflow: render list; create via Tenant\\NoteController.",
        "key_data_fields": [
          {
            "field_name": "title",
            "purpose": "Note heading",
            "edit_constraints": "Required on create; editable by author/admin."
          },
          {
            "field_name": "content",
            "purpose": "Note body",
            "edit_constraints": "Editable by author/admin until signed where applicable."
          }
        ],
        "user_actions": [
          "Create Note",
          "Reorder"
        ]
      },
      "/encounters/[encounter_id]/documents": {
        "page_title": "Encounter Documents",
        "module": "Clinical Documentation",
        "description": "Upload/list/manage documents for an encounter. Access: Practitioner/Admin. Workflow: upload to S3 via signed URL → store metadata → versioned updates. Source: Tenant\\EncounterDocumentController.",
        "key_data_fields": [
          {
            "field_name": "documents[]",
            "purpose": "Files linked to encounter",
            "edit_constraints": "Upload permitted to authorized roles; downloads open to same."
          }
        ],
        "user_actions": [
          "Upload Document",
          "View Document"
        ]
      },
      "/wallet": {
        "page_title": "Wallet Overview",
        "module": "Financials",
        "description": "Tenant wallet dashboard. Access: Admin/Finance roles. Workflow: aggregate balances; allow recalculation endpoint. Source: WalletController@index + Tenant Wallet API routes.",
        "key_data_fields": [
          {
            "field_name": "balances",
            "purpose": "Computed financial summary",
            "edit_constraints": "System computed; read-only."
          }
        ],
        "user_actions": [
          "View Wallet"
        ]
      },
      "/wallet/[wallet_id]/recalculate": {
        "page_title": "Recalculate Wallet",
        "module": "Financials",
        "description": "Recomputes wallet balance. Access: Admin/Finance. Workflow: backend recomputation from transactions; audited. Source: Tenant Wallet API controller.",
        "key_data_fields": [
          {
            "field_name": "wallet_id",
            "purpose": "Target wallet",
            "edit_constraints": "Required; Admin/Finance only."
          }
        ],
        "user_actions": [
          "Recalculate Balance"
        ]
      },
      "/my-details": {
        "page_title": "My Details",
        "module": "Profile",
        "description": "Role-aware profile editor. Access: Logged-in user (Patient/Practitioner). Workflow: GET shows profile; PUT updates allowed sections. Source: Tenant\\PatientDashboardController@myDetails/@updateMyDetails.",
        "key_data_fields": [
          {
            "field_name": "contact_info",
            "purpose": "User contact details",
            "edit_constraints": "Editable only by logged-in user (self-service)."
          }
        ],
        "user_actions": [
          "Update Details"
        ]
      },
      "/settings/organization": {
        "page_title": "Organization Settings",
        "module": "Settings",
        "description": "Initial setup and ongoing practice configuration. Access: Admin. Workflow: update practice profile → branding → time/locale → appointment rules; save may trigger cache refresh. Composed of Practice Details, Appearance, Time & Locale, Business & Compliance, and Appointment Settings tabs.",
        "key_data_fields": [
          {
            "field_name": "Practice Details",
            "purpose": "Legal/operational practice data (e.g., Practice Name, Contact Email)",
            "edit_constraints": "Admin-only; Practice Name is required."
          },
          {
            "field_name": "Appearance",
            "purpose": "Branding elements (Logo, Theme, Custom Color, Font)",
            "edit_constraints": "Admin-only; manages visual identity."
          },
          {
            "field_name": "Time & Locale",
            "purpose": "Time Zone, Locale, Date/Time Formats",
            "edit_constraints": "Admin-only; Time Zone is required and affects scheduling."
          },
          {
            "field_name": "Business & Compliance",
            "purpose": "Official identifiers (Tax ID, License Expiry, Address)",
            "edit_constraints": "Admin-only."
          },
          {
            "field_name": "Appointment Settings",
            "purpose": "Global defaults (Default Session Duration, Min/Max Advance Booking)",
            "edit_constraints": "Admin-only; Default Session Duration is required."
          }
        ],
        "user_actions": [
          "Edit Organization Settings",
          "Upload Logo",
          "Save"
        ]
      },
      "/organization/practice-details": {
        "page_title": "Update Practice Details (API)",
        "module": "Settings API",
        "description": "Updates OrganizationSetting values prefixed with practice_details_. Access: Admin with permission:view-settings. Workflow: POST validate → save settings. Source: routes/settings.php (organization.*).",
        "key_data_fields": [
          {
            "field_name": "practice_details_*",
            "purpose": "Atomic fields (name, contact, address)",
            "edit_constraints": "Admin-only; validated per field type."
          }
        ],
        "user_actions": [
          "Save"
        ]
      },
      "/organization/appearance": {
        "page_title": "Update Appearance (API)",
        "module": "Settings API",
        "description": "Updates appearance_* settings and logo S3 key. Access: Admin with permission:view-settings. Workflow: accept S3 key → compute proxy URL → persist. Source: SettingsController@updateAppearance.",
        "key_data_fields": [
          {
            "field_name": "appearance_theme_color",
            "purpose": "Theme color",
            "edit_constraints": "Admin-only"
          },
          {
            "field_name": "appearance_font_family",
            "purpose": "Brand font",
            "edit_constraints": "Admin-only"
          },
          {
            "field_name": "appearance_logo_s3_key",
            "purpose": "S3 key for logo",
            "edit_constraints": "Admin-only; must be valid key; MIME validated downstream."
          }
        ],
        "user_actions": [
          "Save"
        ]
      },
      "/settings/locations": {
        "page_title": "Locations",
        "module": "Administration",
        "description": "Manage clinic locations, including adding new sites, editing details, setting operating hours, and attaching practitioners. Access: Admin. Workflow: CRUD locations; configure operating hours; assign practitioners.",
        "key_data_fields": [
          {
            "field_name": "location_name",
            "purpose": "Name of the clinic site",
            "edit_constraints": "Admin-only; Required on creation."
          },
          {
            "field_name": "location_timezone",
            "purpose": "Time zone for this location",
            "edit_constraints": "Admin-only; Required; impacts scheduling and displays."
          },
          {
            "field_name": "operating_hours",
            "purpose": "Weekly hours the location is open",
            "edit_constraints": "Admin-only; must be defined before practitioner hours can be set."
          },
          {
            "field_name": "attach_practitioners",
            "purpose": "List of practitioners assigned to this location",
            "edit_constraints": "Admin-only; a practitioner must exist before they can be attached."
          },
          {
            "field_name": "practitioner_hours",
            "purpose": "Specific working hours for each assigned practitioner within location hours",
            "edit_constraints": "Admin-only; hours must be a subset of the location's operating hours."
          }
        ],
        "user_actions": [
          "Add New Location",
          "Edit Location Details",
          "Set Location Hours",
          "Attach Practitioners"
        ]
      },
      "/locations/[location_id]/operating-hours": {
        "page_title": "Operating Hours",
        "module": "Administration",
        "description": "Gets or updates operating hours for a location and coordinates with practitioner hours. Access: Admin (via settings pages) and location managers. Workflow: enable days → define time slots; disabling a day may prompt to remove practitioners’ hours (see disable-day). Source: routes/tenant.php (locations.operating-hours.get/update), Settings UI resources/js/pages/settings/Location/OperatingHours.tsx, LocationController.",
        "key_data_fields": [
          {
            "field_name": "day_of_week",
            "purpose": "Which day the slot applies to",
            "edit_constraints": "Admin/location-manager editable in UI."
          },
          {
            "field_name": "time_slots[]",
            "purpose": "Start/End ranges for the day",
            "edit_constraints": "Must not overlap; within reasonable business hours (enforced by UI/ops)."
          }
        ],
        "user_actions": [
          "Enable Day",
          "Add Time Slot",
          "Save"
        ]
      },
      "/locations/[location_id]/disable-day": {
        "page_title": "Disable Day (Cascade)",
        "module": "Administration",
        "description": "Disables a day for operating hours and removes matching practitioner availability for provided practitioners. Access: Admin/location-manager. Workflow: validate day enum → update OperatingHours (set is_enabled=false, 00:00–00:00) → delete rows in practitioner_availability for given practitioner_ids/day → commit. Source: LocationController@disableDay.",
        "key_data_fields": [
          {
            "field_name": "day",
            "purpose": "Target day of week",
            "edit_constraints": "Required; one of sunday..saturday."
          },
          {
            "field_name": "practitioner_ids[]",
            "purpose": "Practitioners affected",
            "edit_constraints": "Optional array of integers; Admin/location-manager only."
          }
        ],
        "user_actions": [
          "Confirm Disable Day"
        ]
      },
      "/practitioners": {
        "page_title": "Practitioners",
        "module": "Provider Management",
        "description": "List and manage practitioners linked to tenant. Access: Users with permission:view-practitioner. Workflow: search/paginate; invitation status via tenant pivot; profile picture proxied from S3. Source: Tenant\\PractitionerController@index.",
        "key_data_fields": [
          {
            "field_name": "search",
            "purpose": "Filter by name/email/title",
            "edit_constraints": "Editable by viewers; server sanitizes length and pattern."
          },
          {
            "field_name": "invitation_status",
            "purpose": "Link state to tenant",
            "edit_constraints": "System-derived; read-only."
          }
        ],
        "user_actions": [
          "Invite",
          "Link",
          "Edit",
          "Manage Availability",
          "Assign Services"
        ]
      },
      "/settings/practitioners/list": {
        "page_title": "Practitioner List and Management",
        "module": "Provider Management",
        "description": "Index view for practitioners. Allows adding a new practitioner (one-time Basic/Professional details entry) and editing ongoing assignments (Locations, Hours, Pricing). Access: Admin. Clinic cannot edit Basic Info or Professional Details after initial creation.",
        "key_data_fields": [
          {
            "field_name": "Add Practitioner",
            "purpose": "Initiates the one-time creation flow.",
            "edit_constraints": "Admin-only. Basic Info fields (first_name, last_name, email) and Professional Details are **locked** after initial save."
          },
          {
            "field_name": "Edit Practitioner",
            "purpose": "Opens the edit flow for ongoing management.",
            "edit_constraints": "Admin-only. Only the Locations Assignment and Pricing sections are editable."
          },
          {
            "field_name": "locations_assignment",
            "purpose": "Practitioner-to-location links and working hours.",
            "edit_constraints": "Admin-only; **Editable after creation**."
          },
          {
            "field_name": "pricing (service_offerings)",
            "purpose": "Toggle which services a practitioner offers and their custom fee.",
            "edit_constraints": "Admin-only; **Editable after creation**; custom fee overrides default service price."
          }
        ],
        "user_actions": [
          "Add Practitioner",
          "Edit Locations/Hours/Pricing"
        ]
      },
      "/settings/practitioners/invitations": {
        "page_title": "Practitioner Invitations",
        "module": "Provider Management",
        "description": "List of pending or failed practitioner invitations, allowing for resend or revocation. Access: Admin.",
        "key_data_fields": [
          {
            "field_name": "email",
            "purpose": "Invited email address",
            "edit_constraints": "Read-only."
          },
          {
            "field_name": "status",
            "purpose": "Invitation state (e.g., pending, accepted, failed)",
            "edit_constraints": "System-derived; read-only."
          },
          {
            "field_name": "Resend Invitation",
            "purpose": "Sends a new invitation link.",
            "edit_constraints": "Admin-only action."
          }
        ],
        "user_actions": [
          "Resend Invitation",
          "Revoke Invitation"
        ]
      },
      "/practitioners/basic-info": {
        "page_title": "Save Practitioner Basic Info",
        "module": "Provider Management",
        "description": "Creates or updates basic info. Access: permission:add-practitioner (create) and permission:update-practitioner (update). Workflow: validate fields → for existing, if completed basic info then only the practitioner themselves (user_id match) can edit; supports S3 file keys for profile and documents; links practitioner to tenant upon creation. Source: Tenant\\PractitionerController@storeBasicInfo.",
        "key_data_fields": [
          {
            "field_name": "first_name",
            "purpose": "Given name",
            "edit_constraints": "required|string|max:255; Admin/Scheduler until completed; then practitioner self-service only. **LOCKED by clinic post-creation**."
          },
          {
            "field_name": "last_name",
            "purpose": "Family name",
            "edit_constraints": "required|string|max:255; same as above. **LOCKED by clinic post-creation**."
          },
          {
            "field_name": "email",
            "purpose": "Contact and login mapping",
            "edit_constraints": "required|email|max:255; immutable post-create except by practitioner self or admin process. **LOCKED by clinic post-creation**."
          },
          {
            "field_name": "profile_picture_s3_key",
            "purpose": "S3 image key",
            "edit_constraints": "optional|string; Admin/Scheduler or practitioner; proxied via /profile-picture-proxy."
          }
        ],
        "user_actions": [
          "Save Basic Info"
        ]
      },
      "/practitioners/combined-details": {
        "page_title": "Save Combined Practitioner Details",
        "module": "Provider Management",
        "description": "Create/update both basic and professional details in one step. Access: permission:add-practitioner or permission:update-practitioner. If both basic info and professional details already saved, form becomes read-only and redirects to locations tab. Source: Tenant\\PractitionerController@storeCombinedDetails.",
        "key_data_fields": [
          {
            "field_name": "credentials[]",
            "purpose": "Degrees/certifications",
            "edit_constraints": "required|array|min:1; Admin/Scheduler until first save; afterwards **LOCKED by clinic** via this form."
          },
          {
            "field_name": "license_number",
            "purpose": "Professional license",
            "edit_constraints": "required|string|max:100; masked in certain flows; same **LOCKED** rule."
          },
          {
            "field_name": "primary_specialties[]",
            "purpose": "Primary specialties",
            "edit_constraints": "required|array|min:1; same **LOCKED** rule."
          },
          {
            "field_name": "resume_files_s3_keys[]",
            "purpose": "CV uploads (S3)",
            "edit_constraints": "optional|array of strings; merged with existing."
          }
        ],
        "user_actions": [
          "Save Combined Details"
        ]
      },
      "/practitioners/[practitioner_id]/locations/[location_id]/availability": {
        "page_title": "Practitioner Location Availability",
        "module": "Provider Management",
        "description": "Get/Set clinic hours for a practitioner at a location. Access: permission:update-practitioner (POST); view requires link to tenant. Hours must be within the location's operating hours. Source: Tenant\\PractitionerController@getLocationAvailability/storeLocationAvailability.",
        "key_data_fields": [
          {
            "field_name": "availability_schedule",
            "purpose": "Map day→array of time slots {start,end}",
            "edit_constraints": "required|array (POST); replaces existing; Admin/Scheduler with update-practitioner permission. Must respect Location Operating Hours."
          }
        ],
        "user_actions": [
          "View Availability",
          "Update Availability"
        ]
      },
      "/practitioners/[practitioner_id]/services": {
        "page_title": "Practitioner Services",
        "module": "Provider Management",
        "description": "Get/Set services offered by practitioner with custom price/duration. Access: permission:update-practitioner for POST. Custom price/duration overrides the service default. Source: Tenant\\PractitionerController@getPractitionerServices/storePractitionerServices.",
        "key_data_fields": [
          {
            "field_name": "services[].pivot.is_offered",
            "purpose": "Offer toggle",
            "edit_constraints": "boolean; false removes pivot row."
          },
          {
            "field_name": "services[].pivot.custom_price",
            "purpose": "Price override (fee)",
            "edit_constraints": "nullable|numeric|min:0; Admin/Scheduler with update-practitioner. Overrides default service price."
          },
          {
            "field_name": "services[].pivot.custom_duration_minutes",
            "purpose": "Duration override (minutes)",
            "edit_constraints": "nullable|integer|min:15|max:480."
          }
        ],
        "user_actions": [
          "Assign Services",
          "Set Pricing"
        ]
      },
      "/practitioners/pricing": {
        "page_title": "Practitioner Pricing",
        "module": "Provider Management",
        "description": "Store pricing payload on practitioner. Access: permission:update-practitioner. Workflow: validates practitioner_id and payload; updates model. Source: Tenant\\PractitionerController@storePricing.",
        "key_data_fields": [
          {
            "field_name": "service_pricing",
            "purpose": "Pricing map for services",
            "edit_constraints": "optional|array; Admin/Scheduler with update-practitioner."
          }
        ],
        "user_actions": [
          "Save Pricing"
        ]
      },
      "/settings/services": {
        "page_title": "Service Management",
        "module": "Settings",
        "description": "Manage the clinic's catalog of services (treatments, sessions, etc.). Defines default price and status. Access: Admin. Practitioner-specific pricing is managed elsewhere.",
        "key_data_fields": [
          {
            "field_name": "service_name",
            "purpose": "Human-readable name of the service",
            "edit_constraints": "Admin-only; Required."
          },
          {
            "field_name": "delivery_mode",
            "purpose": "How the service is provided (in_person, virtual)",
            "edit_constraints": "Admin-only; Enum value required."
          },
          {
            "field_name": "default_price",
            "purpose": "The standard price for this service",
            "edit_constraints": "Admin-only; overridden by practitioner-specific pricing."
          },
          {
            "field_name": "status",
            "purpose": "Service availability (active, inactive, archived)",
            "edit_constraints": "Admin-only; affects booking availability."
          }
        ],
        "user_actions": [
          "Add Service",
          "Edit Service",
          "Archive Service"
        ]
      },
      "/users": {
        "page_title": "Users",
        "module": "Administration",
        "description": "Manage tenant users (RBAC). Access: Admin. Workflow: index/create/edit with role assignment endpoint. Source: routes/tenant.php (users resource).",
        "key_data_fields": [
          {
            "field_name": "roles[]",
            "purpose": "Role assignments",
            "edit_constraints": "Admin-only; via PATCH users/{user}/role."
          }
        ],
        "user_actions": [
          "Invite User",
          "Assign Roles",
          "Archive/Restore"
        ]
      },
      "/roles": {
        "page_title": "Roles",
        "module": "Administration",
        "description": "RBAC role management. Access: Admin. Workflow: create/edit/delete roles; attach permissions used by controllers (e.g., view-practitioner, add-practitioner, update-practitioner). Source: RoleController.",
        "key_data_fields": [
          {
            "field_name": "permissions[]",
            "purpose": "Grants capabilities to role",
            "edit_constraints": "Admin-only."
          }
        ],
        "user_actions": [
          "Create Role",
          "Assign Permissions"
        ]
      },
      "/public-portal": {
        "page_title": "Public Portal Home",
        "module": "Public Portal",
        "description": "Tenant-branded public site. Access: Public. Workflow: services/locations/staff/booking flows. Source: PublicPortalController.",
        "key_data_fields": [
          {
            "field_name": "services",
            "purpose": "Catalog for booking",
            "edit_constraints": "Read-only to public; Admin edits via settings/services."
          }
        ],
        "user_actions": [
          "Browse Services",
          "Book Appointment"
        ]
      },
      "/patients": {
        "page_title": "Patients List",
        "module": "Patient Management",
        "description": "List and manage patient records in tenant database. Access: Authenticated with permission:view-patient. Workflow: search/filter patients; create new patient; view/edit patient details. Source: Tenant\\PatientController@index.",
        "key_data_fields": [
          {
            "field_name": "search",
            "purpose": "Filter by name/email/health_number",
            "edit_constraints": "Editable by users with view-patient permission."
          },
          {
            "field_name": "filters",
            "purpose": "Filter by status, date range, etc.",
            "edit_constraints": "Editable by users with view-patient permission."
          }
        ],
        "user_actions": [
          "View Patient List",
          "Create New Patient",
          "Search Patients",
          "View Patient Details",
          "Edit Patient"
        ]
      },
      "/patients/create": {
        "page_title": "Create Patient",
        "module": "Patient Management",
        "description": "Create a new patient record in tenant database. Access: Authenticated with permission:add-patient. Workflow: fill patient form → validate → create patient record → create wallet → trigger consents. Source: Tenant\\PatientController@create/store.",
        "key_data_fields": [
          {
            "field_name": "health_number",
            "purpose": "Unique health identifier",
            "edit_constraints": "Required; validated for uniqueness."
          },
          {
            "field_name": "first_name",
            "purpose": "Patient first name",
            "edit_constraints": "Required; editable by add-patient permission."
          },
          {
            "field_name": "last_name",
            "purpose": "Patient last name",
            "edit_constraints": "Required; editable by add-patient permission."
          },
          {
            "field_name": "email",
            "purpose": "Contact email",
            "edit_constraints": "Optional; validated if provided."
          },
          {
            "field_name": "phone_number",
            "purpose": "Contact phone",
            "edit_constraints": "Optional."
          },
          {
            "field_name": "date_of_birth",
            "purpose": "Date of birth",
            "edit_constraints": "Optional; date format."
          },
          {
            "field_name": "gender",
            "purpose": "Gender (male/female/other)",
            "edit_constraints": "Optional; enum."
          },
          {
            "field_name": "address",
            "purpose": "Patient address",
            "edit_constraints": "Optional."
          }
        ],
        "user_actions": [
          "Fill Patient Form",
          "Validate Health Number",
          "Save Patient",
          "Cancel"
        ]
      },
      "/intake/create": {
        "page_title": "Patient Intake/Registration",
        "module": "Patient Management",
        "description": "Patient intake/registration workflow. Access: Authenticated with permission:add-intake. Workflow: search existing patient → link or create new → fill intake data → store. Source: Tenant\\IntakeController@create/store.",
        "key_data_fields": [
          {
            "field_name": "patient_search",
            "purpose": "Search for existing patient",
            "edit_constraints": "Editable by users with add-intake permission."
          },
          {
            "field_name": "patient_id",
            "purpose": "Link to existing patient",
            "edit_constraints": "Optional; if found, links to existing patient."
          },
          {
            "field_name": "intake_data",
            "purpose": "Patient registration information",
            "edit_constraints": "Required if creating new patient; follows patient creation fields."
          }
        ],
        "user_actions": [
          "Search Existing Patient",
          "Link Patient",
          "Create New Patient",
          "Fill Intake Form",
          "Complete Registration"
        ]
      },
      "/patients/{id}": {
        "page_title": "Patient Details",
        "module": "Patient Management",
        "description": "View patient record details. Access: Authenticated with permission:view-patient. Workflow: load patient record → display details, medical history, appointments, invoices. Source: Tenant\\PatientController@show.",
        "key_data_fields": [
          {
            "field_name": "patient",
            "purpose": "Patient record data",
            "edit_constraints": "Read-only view; edit via /patients/{id}/edit."
          },
          {
            "field_name": "medical_history",
            "purpose": "Patient medical history",
            "edit_constraints": "Viewable; editable via /patients/{id}/edit-medical-history (Admin only)."
          },
          {
            "field_name": "appointments",
            "purpose": "Patient appointments",
            "edit_constraints": "Read-only aggregation."
          }
        ],
        "user_actions": [
          "View Patient Details",
          "Edit Patient",
          "View Medical History",
          "View Appointments",
          "Invite to Portal"
        ]
      },
      "/patients/{id}/edit": {
        "page_title": "Edit Patient",
        "module": "Patient Management",
        "description": "Edit patient record. Access: Authenticated with permission:update-patient. Workflow: load patient → edit form → validate → update. Source: Tenant\\PatientController@edit/update.",
        "key_data_fields": [
          {
            "field_name": "health_number",
            "purpose": "Unique health identifier",
            "edit_constraints": "Required; validated for uniqueness."
          },
          {
            "field_name": "first_name",
            "purpose": "Patient first name",
            "edit_constraints": "Required; editable by update-patient permission."
          },
          {
            "field_name": "last_name",
            "purpose": "Patient last name",
            "edit_constraints": "Required; editable by update-patient permission."
          },
          {
            "field_name": "email",
            "purpose": "Contact email",
            "edit_constraints": "Optional; validated if provided."
          },
          {
            "field_name": "phone_number",
            "purpose": "Contact phone",
            "edit_constraints": "Optional."
          },
          {
            "field_name": "date_of_birth",
            "purpose": "Date of birth",
            "edit_constraints": "Optional; date format."
          },
          {
            "field_name": "gender",
            "purpose": "Gender (male/female/other)",
            "edit_constraints": "Optional; enum."
          },
          {
            "field_name": "address",
            "purpose": "Patient address",
            "edit_constraints": "Optional."
          }
        ],
        "user_actions": [
          "Edit Patient Form",
          "Save Changes",
          "Cancel"
        ]
      },
      "/patients/{id}/edit-medical-history": {
        "page_title": "Edit Patient Medical History (Admin)",
        "module": "Patient Management",
        "description": "Admin-only page to edit patient medical history. Access: Authenticated with Admin role. Workflow: load patient → edit medical history, family history, allergies → save. Source: Tenant\\PatientController@editMedicalHistory.",
        "key_data_fields": [
          {
            "field_name": "patient_medical_histories",
            "purpose": "Patient's medical conditions/diseases",
            "edit_constraints": "Admin-only; editable via API endpoints."
          },
          {
            "field_name": "family_medical_histories",
            "purpose": "Family medical history",
            "edit_constraints": "Admin-only; editable via API endpoints."
          },
          {
            "field_name": "known_allergies",
            "purpose": "Patient allergies",
            "edit_constraints": "Admin-only; editable via API endpoints."
          }
        ],
        "user_actions": [
          "Edit Medical History",
          "Add Condition",
          "Add Allergy",
          "Save Changes"
        ]
      },
      "/patient-invitations": {
        "page_title": "Patient Invitations",
        "module": "Patient Management",
        "description": "List of patient invitations to portal. Access: Authenticated with permission:view-patient. Workflow: view pending invitations → resend or revoke. Source: Tenant\\PatientController@invitations.",
        "key_data_fields": [
          {
            "field_name": "email",
            "purpose": "Invited email address",
            "edit_constraints": "Read-only."
          },
          {
            "field_name": "status",
            "purpose": "Invitation state (pending, accepted, failed)",
            "edit_constraints": "System-derived; read-only."
          }
        ],
        "user_actions": [
          "View Invitations",
          "Resend Invitation",
          "Revoke Invitation"
        ]
      },
      "/patients/{id}/invite": {
        "page_title": "Invite Patient to Portal",
        "module": "Patient Management",
        "description": "Send invitation to patient to access portal. Access: Authenticated with permission:view-patient. Workflow: select patient → send invitation email. Source: Tenant\\PatientController@invite.",
        "key_data_fields": [
          {
            "field_name": "patient_id",
            "purpose": "Target patient",
            "edit_constraints": "Required; must exist."
          },
          {
            "field_name": "email",
            "purpose": "Invitation email address",
            "edit_constraints": "Required; validated."
          }
        ],
        "user_actions": [
          "Send Invitation",
          "Resend Invitation"
        ]
      },
      "/invoices": {
        "page_title": "Invoices List",
        "module": "Financials",
        "description": "List and manage invoices. Access: Authenticated with permission:view-invoice. Workflow: view invoices → create/edit → send email → create transactions → create payouts. Source: Tenant\\InvoicesController@index.",
        "key_data_fields": [
          {
            "field_name": "search",
            "purpose": "Filter invoices by customer/search term",
            "edit_constraints": "Editable by users with view-invoice permission."
          },
          {
            "field_name": "status",
            "purpose": "Invoice status filter",
            "edit_constraints": "Editable filter."
          },
          {
            "field_name": "date_range",
            "purpose": "Filter by date range",
            "edit_constraints": "Editable filter."
          }
        ],
        "user_actions": [
          "View Invoices",
          "Create Invoice",
          "Edit Invoice",
          "Send Invoice Email",
          "Create Transaction",
          "Create Payout",
          "Export Invoices"
        ]
      },
      "/invoices/create": {
        "page_title": "Create Invoice",
        "module": "Financials",
        "description": "Create a new invoice. Access: Authenticated with permission:add-invoice. Workflow: select customer → add line items → set amounts → save. Source: Tenant\\InvoicesController@create/store.",
        "key_data_fields": [
          {
            "field_name": "customer",
            "purpose": "Invoice recipient (patient/practitioner)",
            "edit_constraints": "Required; searchable."
          },
          {
            "field_name": "line_items",
            "purpose": "Invoice line items",
            "edit_constraints": "Required; array of items with description, quantity, price."
          },
          {
            "field_name": "due_date",
            "purpose": "Invoice due date",
            "edit_constraints": "Optional; date format."
          },
          {
            "field_name": "notes",
            "purpose": "Invoice notes",
            "edit_constraints": "Optional."
          }
        ],
        "user_actions": [
          "Search Customer",
          "Add Line Items",
          "Set Amounts",
          "Save Invoice"
        ]
      },
      "/invoices/{id}": {
        "page_title": "Invoice Details",
        "module": "Financials",
        "description": "View invoice details and manage transactions. Access: Authenticated with permission:view-invoice. Workflow: view invoice → create transaction → send email → create payout. Source: Tenant\\InvoicesController@show.",
        "key_data_fields": [
          {
            "field_name": "invoice",
            "purpose": "Invoice data",
            "edit_constraints": "Read-only view; edit via /invoices/{id}/edit."
          },
          {
            "field_name": "transactions",
            "purpose": "Invoice transactions",
            "edit_constraints": "Viewable; can create new transactions."
          }
        ],
        "user_actions": [
          "View Invoice",
          "Edit Invoice",
          "Create Transaction",
          "Send Email",
          "Create Payout"
        ]
      },
      "/ledger": {
        "page_title": "Accounting Ledger",
        "module": "Financials",
        "description": "View accounting ledger with all financial transactions. Access: Authenticated with permission:view-ledger (typically Admin/Finance). Workflow: view ledger entries → filter by date/type → export. Source: Tenant\\LedgerController@index.",
        "key_data_fields": [
          {
            "field_name": "filters",
            "purpose": "Filter by date range, transaction type, etc.",
            "edit_constraints": "Editable by Admin/Finance."
          },
          {
            "field_name": "entries",
            "purpose": "Ledger entries",
            "edit_constraints": "Read-only aggregation."
          }
        ],
        "user_actions": [
          "View Ledger",
          "Filter Entries",
          "Export Ledger"
        ]
      },
      "/notes/create": {
        "page_title": "Create Note",
        "module": "Clinical Documentation",
        "description": "Create a new clinical note. Access: Authenticated with permission:add-note (typically Practitioner/Admin). Workflow: fill note form → save. Source: Tenant\\NoteController@create/store.",
        "key_data_fields": [
          {
            "field_name": "title",
            "purpose": "Note heading",
            "edit_constraints": "Required; editable by author/admin."
          },
          {
            "field_name": "content",
            "purpose": "Note body",
            "edit_constraints": "Required; editable by author/admin until signed."
          },
          {
            "field_name": "patient_id",
            "purpose": "Associated patient",
            "edit_constraints": "Optional; links note to patient."
          }
        ],
        "user_actions": [
          "Fill Note Form",
          "Save Note",
          "Cancel"
        ]
      },
      "/attendance-logs": {
        "page_title": "Attendance Logs",
        "module": "Workforce",
        "description": "View attendance logs for staff. Access: Authenticated (typically Admin/Manager). Workflow: view attendance records → filter by user/date → export. Source: Tenant\\AttendanceController@index.",
        "key_data_fields": [
          {
            "field_name": "filters",
            "purpose": "Filter by user, date range, etc.",
            "edit_constraints": "Editable by Admin/Manager."
          },
          {
            "field_name": "logs",
            "purpose": "Attendance log entries",
            "edit_constraints": "Read-only aggregation."
          }
        ],
        "user_actions": [
          "View Attendance Logs",
          "Filter Logs",
          "Export Logs"
        ]
      },
      "/waiting-list": {
        "page_title": "Waiting List",
        "module": "Scheduling",
        "description": "Manage waiting list for appointments. Access: Authenticated with permission:view-waiting-list. Workflow: view waiting list → add patients → notify when slot available. Source: Tenant\\WaitingListController@index.",
        "key_data_fields": [
          {
            "field_name": "patients",
            "purpose": "Patients on waiting list",
            "edit_constraints": "Viewable; can add/remove patients."
          },
          {
            "field_name": "service",
            "purpose": "Service type filter",
            "edit_constraints": "Editable filter."
          },
          {
            "field_name": "practitioner",
            "purpose": "Practitioner filter",
            "edit_constraints": "Editable filter."
          }
        ],
        "user_actions": [
          "View Waiting List",
          "Add Patient to Waiting List",
          "Remove Patient",
          "Notify Patient"
        ]
      },
      "/public-portal-registrations": {
        "page_title": "Public Portal Registrations",
        "module": "Patient Management",
        "description": "View and manage patient registrations from public portal. Access: Authenticated with permission:view-intake-queue. Workflow: view registrations → approve/reject → create patient. Source: Tenant\\PublicPortalRegistrationController@index.",
        "key_data_fields": [
          {
            "field_name": "registrations",
            "purpose": "Pending registrations",
            "edit_constraints": "Viewable; can approve/reject."
          },
          {
            "field_name": "status",
            "purpose": "Registration status filter",
            "edit_constraints": "Editable filter."
          }
        ],
        "user_actions": [
          "View Registrations",
          "Approve Registration",
          "Reject Registration",
          "Create Patient"
        ]
      },
      "/consents": {
        "page_title": "Consents Management",
        "module": "Compliance",
        "description": "Manage entity consents (patient/practitioner/user). Access: Authenticated with permission:view-policies-consents. Workflow: view consents → create/edit → archive. Source: EntityConsentController@index.",
        "key_data_fields": [
          {
            "field_name": "consents",
            "purpose": "List of consents",
            "edit_constraints": "Viewable; can create/edit/archive."
          },
          {
            "field_name": "entity_type",
            "purpose": "Filter by entity type (PATIENT/PRACTITIONER/USER)",
            "edit_constraints": "Editable filter."
          }
        ],
        "user_actions": [
          "View Consents",
          "Create Consent",
          "Edit Consent",
          "Archive Consent"
        ]
      },
      "/policies-consents": {
        "page_title": "Policies & Consents",
        "module": "Compliance",
        "description": "Manage policies and consent templates. Access: Authenticated with permission:view-policies-consents. Workflow: view policies → create/edit → manage consent versions. Source: PolicyConsentController.",
        "key_data_fields": [
          {
            "field_name": "policies",
            "purpose": "Policy templates",
            "edit_constraints": "Editable by Admin."
          },
          {
            "field_name": "consent_versions",
            "purpose": "Consent versions",
            "edit_constraints": "Editable by Admin."
          }
        ],
        "user_actions": [
          "View Policies",
          "Create Policy",
          "Edit Policy",
          "Manage Consent Versions"
        ]
      },
      "/settings/integrations": {
        "page_title": "Integrations",
        "module": "Settings",
        "description": "Manage third-party integrations (calendar sync, etc.). Access: Authenticated with permission:view-integration. Workflow: view integrations → connect/disconnect → configure → sync. Source: SettingsController@integrations.",
        "key_data_fields": [
          {
            "field_name": "integrations",
            "purpose": "List of available integrations",
            "edit_constraints": "Viewable; can connect/disconnect."
          },
          {
            "field_name": "configuration",
            "purpose": "Integration configuration",
            "edit_constraints": "Editable by Admin."
          }
        ],
        "user_actions": [
          "View Integrations",
          "Connect Integration",
          "Disconnect Integration",
          "Configure Integration",
          "Sync Integration"
        ]
      },
      "/settings/website": {
        "page_title": "Website Settings",
        "module": "Settings",
        "description": "Manage public portal website settings. Access: Authenticated with permission:view-website. Workflow: configure website appearance → manage public content → save. Source: SettingsController@website.",
        "key_data_fields": [
          {
            "field_name": "website_settings",
            "purpose": "Website configuration",
            "edit_constraints": "Editable by Admin."
          },
          {
            "field_name": "public_content",
            "purpose": "Public portal content",
            "edit_constraints": "Editable by Admin."
          }
        ],
        "user_actions": [
          "Configure Website",
          "Manage Public Content",
          "Save Settings"
        ]
      }
    }
  }
}