// Patient Dashboard Dynamic Configuration Types

export interface DashboardWidgetConfig {
    id: string;
    title: string;
    enabled: boolean;
    order: number;
    settings?: Record<string, any>;
}

export interface DashboardSectionConfig {
    id: string;
    title: string;
    enabled: boolean;
    widgets: DashboardWidgetConfig[];
    order: number;
    layout?: {
        columns?: number;
        gridSpan?: number;
    };
}

export interface PatientDashboardConfig {
    // Dynamic sections that can be configured
    sections: {
        welcomeHeader: DashboardSectionConfig;
        quickStats: DashboardSectionConfig;
        upcomingAppointments: DashboardSectionConfig;
        currentMedications: DashboardSectionConfig;
        recentVisits: DashboardSectionConfig;
        quickActions: DashboardSectionConfig;
        healthReminders: DashboardSectionConfig;
        labResults: DashboardSectionConfig;
        documents: DashboardSectionConfig;
        vitals: DashboardSectionConfig;
        allergies: DashboardSectionConfig;
        familyHistory: DashboardSectionConfig;
    };

    // Layout configuration
    layout: {
        theme: 'default' | 'compact' | 'detailed';
        gridColumns: number;
        showBreadcrumbs: boolean;
        compactMode: boolean;
    };

    // Filter configuration
    filters: {
        showTenantSwitcher: boolean;
        showClinicFilter: boolean;
        defaultView: 'all' | 'current-tenant';
    };
}

// Default configuration that can be overridden
export const DEFAULT_PATIENT_DASHBOARD_CONFIG: PatientDashboardConfig = {
    sections: {
        welcomeHeader: {
            id: 'welcomeHeader',
            title: 'Welcome Header',
            enabled: true,
            order: 1,
            layout: { gridSpan: 2 },
            widgets: [
                { id: 'patientGreeting', title: 'Patient Greeting', enabled: true, order: 1 },
                { id: 'healthStatus', title: 'Health Status Summary', enabled: true, order: 2 },
                { id: 'tenantSwitcher', title: 'Healthcare Provider Switcher', enabled: true, order: 3 },
                { id: 'clinicFilter', title: 'Clinic Filter', enabled: true, order: 4 }
            ]
        },
        quickActions: {
            id: 'quickActions',
            title: 'Quick Actions',
            enabled: true,
            order: 2,
            layout: { gridSpan: 1 },
            widgets: [
                { id: 'bookAppointment', title: 'Book Appointment', enabled: true, order: 1 },
                { id: 'viewLabResults', title: 'Lab Results', enabled: true, order: 2 },
                { id: 'updateProfile', title: 'Update Profile', enabled: true, order: 3 },
                { id: 'medicalRecords', title: 'Medical Records', enabled: true, order: 4 }
            ]
        },
        quickStats: {
            id: 'quickStats',
            title: 'Quick Statistics',
            enabled: true,
            order: 3,
            layout: { columns: 3 },
            widgets: [
                { id: 'nextAppointment', title: 'Next Appointment', enabled: true, order: 1 },
                { id: 'activeMedications', title: 'Active Medications', enabled: true, order: 2 },
                { id: 'visitsThisYear', title: 'Visits This Year', enabled: true, order: 3 }
            ]
        },
        upcomingAppointments: {
            id: 'upcomingAppointments',
            title: 'Upcoming Appointments',
            enabled: true,
            order: 4,
            layout: { gridSpan: 1 },
            widgets: [
                { id: 'appointmentsList', title: 'Appointments List', enabled: true, order: 1 },
                { id: 'scheduleNew', title: 'Schedule New Appointment', enabled: true, order: 2 }
            ]
        },
        currentMedications: {
            id: 'currentMedications',
            title: 'Current Medications',
            enabled: true,
            order: 5,
            layout: { gridSpan: 1 },
            widgets: [
                { id: 'medicationsList', title: 'Medications List', enabled: true, order: 1 },
                { id: 'refillReminders', title: 'Refill Reminders', enabled: true, order: 2 },
                { id: 'viewPrescriptions', title: 'View All Prescriptions', enabled: true, order: 3 }
            ]
        },
        recentVisits: {
            id: 'recentVisits',
            title: 'Recent Visits',
            enabled: true,
            order: 6,
            layout: { gridSpan: 2 },
            widgets: [
                { id: 'visitsList', title: 'Visits List', enabled: true, order: 1 },
                { id: 'visitHistory', title: 'View All Visit History', enabled: true, order: 2 }
            ]
        },
        healthReminders: {
            id: 'healthReminders',
            title: 'Health Reminders',
            enabled: false, // Optional section
            order: 7,
            layout: { gridSpan: 1 },
            widgets: [
                { id: 'preventiveCare', title: 'Preventive Care Reminders', enabled: true, order: 1 },
                { id: 'medicationReminders', title: 'Medication Reminders', enabled: true, order: 2 }
            ]
        },
        labResults: {
            id: 'labResults',
            title: 'Lab Results',
            enabled: false, // Optional section
            order: 8,
            layout: { gridSpan: 1 },
            widgets: [
                { id: 'recentResults', title: 'Recent Lab Results', enabled: true, order: 1 },
                { id: 'trendsChart', title: 'Lab Trends Chart', enabled: true, order: 2 }
            ]
        },
        documents: {
            id: 'documents',
            title: 'Medical Documents',
            enabled: false, // Optional section
            order: 9,
            layout: { gridSpan: 1 },
            widgets: [
                { id: 'recentDocuments', title: 'Recent Documents', enabled: true, order: 1 },
                { id: 'uploadDocument', title: 'Upload Document', enabled: true, order: 2 }
            ]
        },
        vitals: {
            id: 'vitals',
            title: 'Vital Signs',
            enabled: false, // Optional section
            order: 10,
            layout: { gridSpan: 1 },
            widgets: [
                { id: 'latestVitals', title: 'Latest Vital Signs', enabled: true, order: 1 },
                { id: 'vitalsChart', title: 'Vitals Trends', enabled: true, order: 2 }
            ]
        },
        allergies: {
            id: 'allergies',
            title: 'Allergies & Conditions',
            enabled: false, // Optional section
            order: 11,
            layout: { gridSpan: 1 },
            widgets: [
                { id: 'activeAllergies', title: 'Active Allergies', enabled: true, order: 1 },
                { id: 'chronicConditions', title: 'Chronic Conditions', enabled: true, order: 2 }
            ]
        },
        familyHistory: {
            id: 'familyHistory',
            title: 'Family Medical History',
            enabled: false, // Optional section
            order: 12,
            layout: { gridSpan: 1 },
            widgets: [
                { id: 'familyConditions', title: 'Family Conditions', enabled: true, order: 1 },
                { id: 'riskFactors', title: 'Risk Factors', enabled: true, order: 2 }
            ]
        }
    },

    layout: {
        theme: 'default',
        gridColumns: 2,
        showBreadcrumbs: true,
        compactMode: false
    },

    filters: {
        showTenantSwitcher: true,
        showClinicFilter: true,
        defaultView: 'all'
    }
};

// Static fields that cannot be made dynamic (for security/system requirements)
export const STATIC_DASHBOARD_FIELDS = [
    'user_authentication_status',
    'patient_id',
    'tenant_id',
    'session_management',
    'role_permissions',
    'csrf_token',
    'route_breadcrumbs',
    'app_layout_wrapper',
    'inertia_head_component',
    'success_alert_messages', // Success messages from public portal, waiting list, etc.
    'error_handling',
    'loading_states',
    'tenant_switching_logic',
    'cookie_based_auto_login',
    'central_vs_tenant_context'
];