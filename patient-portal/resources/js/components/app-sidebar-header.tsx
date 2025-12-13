import { Breadcrumbs } from '@/components/breadcrumbs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { UserMenuContent } from '@/components/user-menu-content';
import { useInitials } from '@/hooks/use-initials';
import { type BreadcrumbItem as BreadcrumbItemType } from '@/types';
import { usePage, router } from '@inertiajs/react';
import { Bell, Building2, ChevronDown, Home, Globe, Sparkles, ArrowRightLeft, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { LoadingOverlay } from '@/components/loading-overlay';
import { AttendanceWidget } from '@/components/attendance-widget';

export function AppSidebarHeader({ breadcrumbs = [] }: { breadcrumbs?: BreadcrumbItemType[] }) {
    const { auth, tenancy }: any = usePage().props;
    const getInitials = useInitials();
    const isCentral = tenancy?.is_central;
    const currentTenantName = tenancy?.current?.name;
    const tenantLogo = tenancy?.logo;
    const userTenants = auth?.user?.tenants || [];
    const isPractitioner = auth?.user?.is_practitioner || false;
    const isPatient = auth?.user?.is_patient || false;
    const userRole = auth?.user?.user_role || null;
    const isAdmin = userRole === 'admin' || userRole === 'Admin' || userRole === 'staff' || userRole === 'Staff';
    
    // Show tenant switcher ONLY if user has actual records in Practitioner OR Patient table
    // Tenant admins without practitioner/patient records should NOT see the switcher
    // The isPractitioner and isPatient flags check for actual record existence in the database
    const hasPractitionerOrPatientAccess = (isPractitioner || isPatient);
    const shouldShowTenantSwitching = hasPractitionerOrPatientAccess && userTenants.length > 0;
    
    // Debug logging
    useEffect(() => {
        console.log('Tenant Switcher Debug:', {
            userTenants,
            userTenantsLength: userTenants.length,
            isCentral,
            isPractitioner,
            isPatient,
            hasPractitionerOrPatientAccess,
            shouldShowTenantSwitching,
            authUser: auth?.user,
        });
    }, [userTenants, isCentral, auth, isPractitioner, isPatient, hasPractitionerOrPatientAccess, shouldShowTenantSwitching]);
    
    // Fetch real-time invitation statuses for patients
    const fetchInvitationStatuses = async () => {
        if (!isPatient || isPractitioner || !userTenants?.length) return;

        setStatusesLoading(true);
        try {
            const response = await fetch('/api/patient/invitation-statuses', {
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'Accept': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                setTenantStatuses(data.statuses || {});
            } else if (response.status === 404) {
                // Route not found, silently ignore for now
                console.warn('Patient invitation statuses endpoint not available');
            } else {
                console.warn('Failed to fetch invitation statuses:', response.status, response.statusText);
            }
        } catch (error) {
            // Silently handle network errors to avoid console spam
            console.warn('Network error fetching invitation statuses:', error.message);
        } finally {
            setStatusesLoading(false);
        }
    };

    // Load invitation statuses on mount and set up periodic refresh
    useEffect(() => {
        fetchInvitationStatuses();
        
        // Refresh statuses every 30 seconds for patients
        const interval = isPatient && !isPractitioner ? setInterval(fetchInvitationStatuses, 30000) : null;
        
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isPatient, isPractitioner]);

    // Helper function to check if tenant is accessible for patients
    const isTenantAccessible = (tenant: any) => {
        if (!isPatient || isPractitioner) return true; // Practitioners have full access
        
        // Use real-time status if available, fallback to initial status
        const currentStatus = tenantStatuses[tenant.id] || tenant.invitation_status;
        return currentStatus === 'ACCEPTED';
    };

    // Get current invitation status for display
    const getTenantStatus = (tenant: any) => {
        return tenantStatuses[tenant.id] || tenant.invitation_status;
    };
    
    // Loading states for smooth transitions
    const [isNavigating, setIsNavigating] = useState(false);
    const [tenantStatuses, setTenantStatuses] = useState<Record<string, string>>({});
    const [statusesLoading, setStatusesLoading] = useState(false);
    
    // Redirect to login if user is not authenticated
    if (!auth?.user) {
        window.location.href = route('login');
        return null;
    }

    const handleTenantSwitch = (tenant: any) => {
        // Check if tenant is accessible for patients
        if (!isTenantAccessible(tenant)) {
            return; // Don't allow switching to non-accessible tenants
        }
        
        setIsNavigating(true);
        
        // Add a small delay to show loading state before navigation
        setTimeout(() => {
            if (isCentral) {
                // In central context, use the normal SSO redirect
                router.post(route('tenant.sso.redirect'), { tenant_id: tenant.id }, {
                    preserveScroll: true,
                    onFinish: () => setIsNavigating(false),
                    onError: () => setIsNavigating(false)
                });
            } else {
                // In tenant context, use the tenant route to switch to another tenant
                router.post(route('tenant.switch-to-tenant'), { tenant_id: tenant.id }, {
                    preserveScroll: true,
                    onFinish: () => setIsNavigating(false),
                    onError: () => setIsNavigating(false)
                });
            }
        }, 200);
    };

    const handleCentralSwitch = () => {
        if (isCentral) return;
        setIsNavigating(true);
        
        // Add a small delay to show loading state before navigation
        setTimeout(() => {
            // If in tenant, use the tenant route to switch back to central
            router.get(route('tenant.switch-to-central'), {}, {
                preserveScroll: true,
                onFinish: () => setIsNavigating(false),
                onError: () => setIsNavigating(false)
            });
        }, 200);
    };
    
    return (
        <>
            <LoadingOverlay 
                isVisible={isNavigating} 
                message={isCentral ? "Switching to clinic workspace..." : "Switching to platform hub..."} 
            />
            <header className="bg-white border-sidebar-border/50 flex h-14 sm:h-16 shrink-0 items-center gap-2 border-b px-3 sm:px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4 rounded-t-xl">
            <div className="flex items-center gap-2 min-w-0 flex-1" >
                <SidebarTrigger className="-ml-1" />
                <div className="min-w-0 flex-1">
                    <Breadcrumbs breadcrumbs={breadcrumbs} />
                </div>
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-3 flex-shrink-0">
                {/* Attendance Widget - Only in tenant context */}
                {!isCentral && (
                    <AttendanceWidget 
                        userRole={auth?.user?.user_role || 'admin'} 
                        hasSignedIn={false} // This will be determined by the attendance status
                    />
                )}

                {/* Brand/Logo - Hidden on very small screens, shown on sm+ */}
                <div className="hidden sm:block">
                    {isCentral ? (
                        <span className="text-sm font-semibold text-gray-700">
                            Wellovis
                        </span>
                    ) : tenantLogo ? (
                        <img 
                            src={tenantLogo} 
                            alt={currentTenantName} 
                            className="h-7 sm:h-8 w-auto object-contain"
                        />
                    ) : (
                        <span className="text-sm font-semibold text-gray-700 truncate max-w-[120px]">
                            {currentTenantName}
                        </span>
                    )}
                </div>

                {/* Context Switching Dropdown - Show for all users with multiple tenants */}
                {shouldShowTenantSwitching ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button 
                            id='platform-hub-12' 
                                variant="outline" 
                                size="sm" 
                                className="h-8 gap-2 px-3 border-2 hover:border-primary/50 transition-all duration-200 hover:shadow-md"
                                disabled={isNavigating}
                            >
                                {isNavigating ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                        <span className="hidden sm:inline font-medium text-primary">Switching...</span>
                                    </>
                                ) : isCentral ? (
                                    <>
                                        <div className="flex items-center gap-1">
                                            <Globe className="h-3.5 w-3.5 text-blue-600" />
                                            <Sparkles className="h-2.5 w-2.5 text-amber-500" />
                                        </div>
                                        <span className="hidden sm:inline font-medium text-blue-700"
                                        

                                        >Platform Hub</span>
                                    </>
                                ) : (
                                    <>
                                        <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                                        <span className="hidden sm:inline font-medium text-emerald-700">
                                            {currentTenantName || 'Current Clinic'}
                                        </span>
                                    </>
                                )}
                                {!isNavigating && (
                                    <div className="flex items-center gap-0.5">
                                        <ArrowRightLeft className="h-2.5 w-2.5 text-gray-400" />
                                        <ChevronDown className="h-3 w-3 text-gray-500" />
                                    </div>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 p-2">
                            <DropdownMenuLabel className="flex items-center gap-2 text-sm font-semibold text-gray-700 px-2 py-1.5">
                                <ArrowRightLeft className="h-4 w-4" />
                                Switch Context
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            
                            {/* Central Option */}
                            {!isCentral && (
                                <>
                                    <DropdownMenuItem 
                                        onClick={handleCentralSwitch}
                                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <Globe className="h-4 w-4 text-blue-600" />
                                            <Sparkles className="h-3 w-3 text-amber-500" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-blue-700">Platform Hub</span>
                                            <span className="text-xs text-blue-500">Central management & oversight</span>
                                        </div>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            
                            {/* Clinic Options */}
                            {isCentral ? (
                                // In central: show all available clinics
                                <>
                                    <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                                        Available Clinics
                                    </div>
                                    {userTenants.map((tenant: any) => {
                                        const isAccessible = isTenantAccessible(tenant);
                                        return (
                                            <DropdownMenuItem 
                                                key={tenant.id} 
                                                onClick={() => handleTenantSwitch(tenant)}
                                                disabled={!isAccessible}
                                                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                                    isAccessible 
                                                        ? 'hover:bg-emerald-50 cursor-pointer' 
                                                        : 'opacity-50 cursor-not-allowed bg-gray-50'
                                                }`}
                                            >
                                                <Building2 className={`h-4 w-4 flex-shrink-0 ${
                                                    isAccessible ? 'text-emerald-600' : 'text-gray-400'
                                                }`} />
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className={`font-medium truncate ${
                                                        isAccessible ? 'text-emerald-700' : 'text-gray-400'
                                                    }`}>
                                                        {tenant.name}
                                                    </span>
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-xs ${
                                                            isAccessible ? 'text-emerald-500' : 'text-gray-400'
                                                        }`}>
                                                            Clinic workspace
                                                        </span>
                                                        {!isAccessible && isPatient && (
                                                            <span className="text-xs text-amber-600 font-medium">
                                                                {getTenantStatus(tenant) === 'PENDING_INVITATION' ? 'Pending' : 
                                                                 getTenantStatus(tenant) === 'INVITED' ? 'Invited' : 
                                                                 getTenantStatus(tenant) === 'DECLINED' ? 'Declined' : 'Restricted'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </DropdownMenuItem>
                                        );
                                    })}
                                </>
                            ) : (
                                // In clinic: show other clinics (excluding current one)
                                <>
                                    <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                                        Switch to Clinic
                                    </div>
                                    {userTenants?.filter((tenant: any) => tenant.id !== tenancy?.current?.id).map((tenant: any) => {
                                        const isAccessible = isTenantAccessible(tenant);
                                        return (
                                            <DropdownMenuItem 
                                                key={tenant.id} 
                                                onClick={() => handleTenantSwitch(tenant)}
                                                disabled={!isAccessible}
                                                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                                    isAccessible 
                                                        ? 'hover:bg-emerald-50 cursor-pointer' 
                                                        : 'opacity-50 cursor-not-allowed bg-gray-50'
                                                }`}
                                            >
                                                <Building2 className={`h-4 w-4 flex-shrink-0 ${
                                                    isAccessible ? 'text-emerald-600' : 'text-gray-400'
                                                }`} />
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className={`font-medium truncate ${
                                                        isAccessible ? 'text-emerald-700' : 'text-gray-400'
                                                    }`}>
                                                        {tenant.name}
                                                    </span>
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-xs ${
                                                            isAccessible ? 'text-emerald-500' : 'text-gray-400'
                                                        }`}>
                                                            Clinic workspace
                                                        </span>
                                                        {!isAccessible && isPatient && (
                                                            <span className="text-xs text-amber-600 font-medium">
                                                                {getTenantStatus(tenant) === 'PENDING_INVITATION' ? 'Pending' : 
                                                                 getTenantStatus(tenant) === 'INVITED' ? 'Invited' : 
                                                                 getTenantStatus(tenant) === 'DECLINED' ? 'Declined' : 'Restricted'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </DropdownMenuItem>
                                        );
                                    })}
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null}
                
                {/* Notifications - Smaller on mobile */}
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                    <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </Button>
                
                {/* User Menu - Smaller on mobile */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="size-8 sm:size-10 rounded-full p-1">
                            <Avatar className="size-6 sm:size-8 overflow-hidden rounded-full">
                                <AvatarImage src={auth.user.avatar} alt={auth.user.name} />
                                <AvatarFallback className="rounded-lg bg-sidebar-accent/10 text-sidebar-accent text-xs sm:text-sm">
                                    {getInitials(auth.user.name)}
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end">
                        <UserMenuContent user={auth.user} />
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
        </>
    );
}
