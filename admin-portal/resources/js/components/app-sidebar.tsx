import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { Activity, LayoutGrid, Lock, Users, Settings, Plus, ChevronDown, Calendar, CalendarPlus, User, UserCheck, Zap, FileText, UserPlus, Clock, Timer, Wallet, Shield, CreditCard, Repeat } from 'lucide-react';
import AppLogo from './app-logo';
import { CreateNewDropdown } from '@/components/general/CreateNewDropdown';

// Role-based sidebar configuration
const ROLE_BASED_SIDEBAR = {
    Tenant_Dashboard: [
        { title: 'Dashboard', href: '/dashboard', icon: LayoutGrid, permission: undefined },
        { title: 'Practitioners', href: '/practitioners/list', icon: UserCheck, permission: 'view-practitioner' },
        { title: 'Calendar', href: '/calendar', icon: Calendar, permission: 'view-calendar' },
        { title: 'Appointments', href: '/appointments', icon: CalendarPlus, permission: 'view-appointment' },
        { title: 'Patients', href: '/patients', icon: Users, permission: 'view-patient' },
        { title: 'Waiting List', href: '/waiting-list', icon: Timer, permission: 'view-waitlist' },
        { title: 'Invoices', href: '/invoices', icon: Calendar, permission: 'view-invoices' },
        { title: 'Wallet', href: '/wallet', icon: Wallet, permission: 'view-wallet' },
        { title: 'Users', href: '/users', icon: Users, permission: 'view-users' },
        { title: 'Roles', href: '/roles', icon: Lock, permission: 'view-roles' },
        { title: 'Intake Queue', href: '/public-portal-registrations', icon: UserPlus, permission: 'view-intake-queue' },
        { title: 'Attendance', href: '/attendance-logs', icon: Clock, permission: 'view-attendance' },
        { title: 'Activity Logs', href: '/activity-logs', icon: Activity, permission: 'view-activity-logs' },
        { title: 'Policies & Consent', href: '/policies-consents', icon: FileText, permission: 'view-policies-consents' },
        { title: 'Settings', href: '/settings', icon: Settings, permission: 'has-settings-access' },
    ],
    Practitioner_Central_Dashboard: [
        { title: 'Dashboard', href: '/dashboard', icon: LayoutGrid, permission: undefined },
        { title: 'Appointments', href: '/central/appointments', icon: Calendar, permission: undefined },
        { title: 'Calendar', href: '/central/calendar', icon: Calendar, permission: undefined },
        { title: 'My Details', href: '/central/my-details', icon: UserCheck, permission: undefined },
        { title: 'Personal Details', href: '/central/personal-information', icon: User, permission: undefined },
        
        { title: 'Integrations', href: '/integrations', icon: Zap, permission: undefined },
    ],
    Admin_Central_Dashboard: [
        { title: 'Dashboard', href: '/dashboard', icon: LayoutGrid, permission: undefined },
        { title: 'Tenants', href: '/tenants/v2', icon: Users, permission: 'view-tenants' },
        { title: 'Users', href: '/users', icon: Users, permission: 'view-users' },
        { title: 'Roles', href: '/roles', icon: Lock, permission: 'view-roles' },
        { title: 'Billing Settings', href: '/billing/settings/plans', icon: CreditCard,  },
        // { title: 'Patients', href: '/patients', icon: Users, permission: 'view-patient' },
        // { title: 'Practitioners', href: '/practitioners', icon: UserCheck, permission: 'view-practitioner' },
        // { title: 'Appointments', href: '/appointments', icon: Calendar, permission: 'view-appointment' },
        // { title: 'Calendar', href: '/calendar', icon: Calendar, permission: 'view-calendar' },
        // { title: 'Invoices', href: '/invoices', icon: FileText, permission: 'view-invoices' },
        // { title: 'Wallet', href: '/wallet', icon: Wallet, permission: 'view-wallet' },
        // { title: 'Intake Queue', href: '/public-portal-registrations', icon: UserPlus, permission: 'view-intake-queue' },
        // { title: 'Attendance', href: '/attendance-logs', icon: Clock, permission: 'view-attendance' },
        // { title: 'Activity Logs', href: '/activity-logs', icon: Activity, permission: 'view-activity-logs' },
        // { title: 'Settings', href: '/settings', icon: Settings, permission: 'view-settings' },
    ],
    Practitioner_Tenant_Dashboard: [
        { title: 'Dashboard', href: '/dashboard', icon: LayoutGrid, permission: undefined },
        { title: 'Appointments', href: '/appointments', icon: Calendar, permission: 'view-appointment' },
        { title: 'Calendar', href: '/calendar', icon: Calendar, permission: 'view-practitioner-personal-calendar' },
        { title: 'Wallet', href: '/wallet', icon: Wallet, permission: "view-wallet" },
        // { title: 'Invoices', href: '/invoices', icon: Calendar, permission: 'view-invoices' },

        { title: 'Consents', href: '/practitioner/consents', icon: FileText, permission: undefined },
        { title: 'My Details', href: '/my-details', icon: UserCheck, permission: undefined },
        { title: 'Attendance', href: '/attendance-logs', icon: Clock, permission: 'view-users' },
        { title: 'Activity Logs', href: '/activity-logs', icon: Activity, permission: 'view-activity-logs' },
    ],
    Patient_Central_Dashboard: [
        { title: 'Dashboard', href: '/dashboard', icon: LayoutGrid, permission: undefined },
        { title: 'Calendar', href: '/central/calendar', icon: Calendar, permission: undefined },
        { title: 'My Details', href: '/central/my-details', icon: User, permission: undefined },
    ],
    Patient_Tenant_Dashboard: [
        { title: 'Dashboard', href: '/dashboard', icon: LayoutGrid, permission: undefined },
        { title: 'Appointments', href: '/appointments', icon: Calendar, permission: undefined },
        { title: 'Calendar', href: '/calendar', icon: Calendar, permission: undefined },
        { title: 'Consents', href: '/consents/manage', icon: FileText, permission: undefined },
        { title: 'My Details', href: '/my-details', icon: User, permission: undefined },
        // { title: 'Activity Logs', href: '/activity-logs', icon: Activity, permission: 'view-activity-logs' },
    ],
} as const;

// Central domain (landlord) specific items
const centralNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutGrid,
        // no permission required
    },
    {
        title: 'Calendar',
        href: '/central/calendar',
        icon: Calendar,
        // Available to practitioners in central context
    },
    {
        title: 'Personal Information',
        href: '/central/personal-information',
        icon: UserCheck,
    },
    {
        title: 'My Details',
        href: '/central/my-details',
        icon: Settings,
    },
    {
        title: 'Integrations',
        href: '/integrations',
        icon: Zap,
        // Available to all authenticated users for personal integrations
    },
    {
        title: 'Tenants',
        href: '/tenants/v2',
        icon: Users,
        permission: 'view-tenants',
    },
    {
        title: 'Users',
        href: '/users',
        icon: Users,
        permission: 'view-users',
    },
    {
        title: 'Roles',
        href: '/roles',
        permission: 'view-roles',
        icon: Lock,
    },
    {
        title: 'Activity Logs',
        href: '/activity-logs',
        icon: Activity,
        permission: 'view-activity-logs',
    },
];

// Tenant domain specific items
const tenantNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutGrid,
        // no permission required
    },
    {
        title: 'Appointments',
        href: '/appointments',
        icon: Calendar,
        permission: 'view-appointment',
    },

    {
        title: 'Calendar',
        href: '/calendar',
        icon: Calendar,
        permission: 'view-calendar',
    },
    {
        title: 'Patients',
        href: '/patients',
        icon: Users,
        permission: 'view-patient',
    },
    {
        title: 'Roles',
        href: '/roles',
        permission: 'view-roles',
        icon: Lock,
    },
    {
        title: 'Users',
        href: '/users',
        icon: Users,
        permission: 'view-users',
    },
    {
        title: 'Intake Queue',
        href: '/public-portal-registrations',
        icon: UserPlus,
        permission: 'view-intake-queue',
    },

    {
        title: 'Attendance',
        href: '/attendance-logs',
        icon: Clock,
        permission: 'view-attendance',
    },
    {
        title: 'Invoices',
        href: '/invoices',
        icon: Clock,
        permission: 'view-invoices',
    },
    {
        title: 'Activity Logs',
        href: '/activity-logs',
        icon: Activity,
        permission: 'view-activity-logs',
    },
    {
        title: 'Settings',
        href: '/settings',
        icon: Settings,
        permission: 'has-settings-access',
    },
    

];

const footerNavItems: NavItem[] = [
    // …
];

// Helper function to check if user has any settings permission
function hasAnySettingsPermission(userPerms: string[]): boolean {
    const settingsPermissions = [
        'view-organization',
        'view-location',
        'view-practitioner',
        'view-services',
    ];
    return settingsPermissions.some(perm => userPerms.includes(perm));
}

export function AppSidebar() {
    const page = usePage();
    const { tenancy, auth, onboardingStatus }: any = page.props;
    const isCentral = tenancy?.is_central;
    const userPerms: string[] = auth?.user?.permissions || [];
    const userRoles: string[] = auth?.user?.roles || [];
    // Only check table records, not roles
    const isPractitioner = auth?.user?.is_practitioner || false;
    const isPatient = auth?.user?.is_patient || false;
    const isAdmin = userRoles.includes('Admin');
    
    // Tenant-specific checks (only in tenant context)
    const isTenantPractitioner = !isCentral && (auth?.user?.is_tenant_practitioner || false);
    const isTenantPatient = !isCentral && (auth?.user?.is_tenant_patient || false);

    // Check if onboarding is complete (strict check - undefined means NOT complete)
    // In central context, always consider onboarding complete
    const isOnboardingComplete = isCentral || onboardingStatus?.isComplete === true;

    // Determine the appropriate sidebar configuration based on user role and context
    // For tenant context, merge options from multiple access types
    let allNavItems: typeof ROLE_BASED_SIDEBAR[keyof typeof ROLE_BASED_SIDEBAR] = [];

    if (isCentral) {
        // Central context - check for both practitioner and patient records
        const hasPractitioner = auth?.user?.is_practitioner || false;
        const hasPatient = auth?.user?.is_patient || false;
        
        if (hasPractitioner && hasPatient) {
            // Multi-identity: Merge both dashboards
            const practitionerItems = ROLE_BASED_SIDEBAR['Practitioner_Central_Dashboard'] || [];
            const patientItems = ROLE_BASED_SIDEBAR['Patient_Central_Dashboard'] || [];
            
            // Merge items, rename duplicates
            const mergedItems = new Map();
            
            // Add practitioner items first
            practitionerItems.forEach(item => {
                const key = item.href;
                mergedItems.set(key, {
                    ...item,
                    title: `Practitioner ${item.title}`
                });
            });
            
            // Add patient items, rename if duplicate
            patientItems.forEach(item => {
                const key = item.href;
                if (mergedItems.has(key)) {
                    // Duplicate href - create separate entry with different title
                    mergedItems.set(`${key}_patient`, {
                        ...item,
                        title: `Patient ${item.title}`
                    });
                } else {
                    mergedItems.set(key, {
                        ...item,
                        title: `Patient ${item.title}`
                    });
                }
            });
            
            allNavItems = Array.from(mergedItems.values());
        } else if (hasPatient) {
            const sidebarKey = 'Patient_Central_Dashboard';
            allNavItems = ROLE_BASED_SIDEBAR[sidebarKey as keyof typeof ROLE_BASED_SIDEBAR] || [];
        } else if (hasPractitioner) {
            const sidebarKey = 'Practitioner_Central_Dashboard';
            allNavItems = ROLE_BASED_SIDEBAR[sidebarKey as keyof typeof ROLE_BASED_SIDEBAR] || [];
        } else {
            const sidebarKey = 'Admin_Central_Dashboard';
            allNavItems = ROLE_BASED_SIDEBAR[sidebarKey as keyof typeof ROLE_BASED_SIDEBAR] || [];
        }
    } else {
        // Tenant context - merge options from role-based + tenant records
        const navItemsMap = new Map<string, typeof ROLE_BASED_SIDEBAR[keyof typeof ROLE_BASED_SIDEBAR][0]>();
        
        // Start with role-based items (Tenant_Dashboard for admin/staff)
        // Show admin/staff items if user has Admin or Staff role, regardless of practitioner/patient roles
        const hasAdminOrStaffRole = userRoles.includes('Admin') || userRoles.includes('Staff');
        if (hasAdminOrStaffRole) {
            const roleBasedItems = ROLE_BASED_SIDEBAR['Tenant_Dashboard'] || [];
            roleBasedItems.forEach(item => {
                navItemsMap.set(item.href, item);
            });
        }
        
        // Add Practitioner_Tenant_Dashboard items ONLY if user has a practitioner record in tenant database
        if (isTenantPractitioner) {
            const practitionerItems = ROLE_BASED_SIDEBAR['Practitioner_Tenant_Dashboard'] || [];
            practitionerItems.forEach(item => {
                // Don't override if already exists (keep first occurrence)
                if (!navItemsMap.has(item.href)) {
                    navItemsMap.set(item.href, item);
                }
            });
        }

        // Add Patient_Tenant_Dashboard items ONLY if user has a patient record in tenant database
        if (isTenantPatient) {
            const patientItems = ROLE_BASED_SIDEBAR['Patient_Tenant_Dashboard'] || [];
            patientItems.forEach(item => {
                // Don't override if already exists (keep first occurrence)
                if (!navItemsMap.has(item.href)) {
                    navItemsMap.set(item.href, item);
                }
            });
        }
        
        // Convert map back to array
        allNavItems = Array.from(navItemsMap.values());
        
        // If no items found, fallback to Tenant_Dashboard
        if (allNavItems.length === 0) {
            allNavItems = ROLE_BASED_SIDEBAR['Tenant_Dashboard'] || [];
        }
    }

    // Filter items based on permissions only - let nav-main.tsx handle disabling during onboarding
    const mainNavItems = allNavItems.filter((item) => {
        if (!('permission' in item) || !item.permission) {
            return true;
        }
        // Special case: check for settings access using helper function
        if (item.permission === 'has-settings-access') {
            return hasAnySettingsPermission(userPerms);
        }
        return userPerms.includes(item.permission);
    });

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild className="hover:bg-transparent">
                            <Link href="/dashboard">
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                {/* New Quick Create Button for Tenant only (hide for patients, central, and during onboarding) */}
                {!isCentral && !isTenantPatient && !isTenantPractitioner && userPerms.includes('view-new-menu') && isOnboardingComplete && (
                    <div className="px-2 py-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="default"
                                    className="w-full justify-center bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:p-0 font-medium"
                                    style={{
                                        height: '36.4px',
                                        borderRadius: '8px'
                                    }}
                                >
                                    <div className="flex items-center group-data-[collapsible=icon]:justify-center">
                                        <Plus className="h-4 w-4 group-data-[collapsible=icon]:mr-0 mr-2" />
                                        <span className="group-data-[collapsible=icon]:hidden">Create New</span>
                                    </div>
                                </Button>
                            </DropdownMenuTrigger>
                            <CreateNewDropdown />
                        </DropdownMenu>
                    </div>
                )}
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
            </SidebarFooter>
        </Sidebar>
    );
}