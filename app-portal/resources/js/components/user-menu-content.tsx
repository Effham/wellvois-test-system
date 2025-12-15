import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import { type User, SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { LogOut, Settings, User as UserIcon } from 'lucide-react';

interface CustomPageProps extends SharedData {
    auth: {
        user: User;
    };
    centralAppUrl: string; // Ensure centralAppUrl is always available
}

interface UserMenuContentProps {
    user: User;
}

export function UserMenuContent({ user }: UserMenuContentProps) {
    const cleanup = useMobileNavigation();
    const { props } = usePage<CustomPageProps>();
    const currentUser = props.auth.user;

    return (
        <>
            <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <UserInfo user={currentUser} showEmail={true} />
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
                {/* Profile - Redirect to Keycloak Account Management */}
                <DropdownMenuItem asChild>
                    <button
                        className="flex items-center w-full px-2 py-1.5 text-sm"
                        onClick={() => {
                            cleanup();
                            // Redirect to Keycloak account management
                            const keycloakAccountUrl = props.keycloak?.account_management_url;
                            if (keycloakAccountUrl) {
                                window.open(keycloakAccountUrl, '_blank');
                            } else {
                                // Fallback to Laravel profile if Keycloak URL not available
                                router.visit(route('profile.edit'));
                            }
                        }}
                    >
                        <UserIcon className="mr-2" />
                        Profile
                    </button>
                </DropdownMenuItem>

                {/* Settings - Redirect to Keycloak Account Management for account settings */}
                <DropdownMenuItem asChild>
                    <button
                        className="flex items-center w-full px-2 py-1.5 text-sm"
                        onClick={() => {
                            cleanup();
                            // Redirect to Keycloak account management for password, MFA, etc.
                            const keycloakAccountUrl = props.keycloak?.account_management_url;
                            if (keycloakAccountUrl) {
                                window.open(keycloakAccountUrl, '_blank');
                            } else {
                                // Fallback to Laravel settings if Keycloak URL not available
                                router.visit(route('settings.index'));
                            }
                        }}
                    >
                        <Settings className="mr-2" />
                        Account Settings
                    </button>
                </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
                <button
                    className="flex items-center w-full px-2 py-1.5 text-sm"
                    onClick={(e) => {
                        e.preventDefault();
                        cleanup();

                        // If user is logged into Keycloak, use Keycloak logout
                        // This will log them out of Keycloak and automatically log them out of Laravel
                        if (props.keycloak?.logged_in) {
                            const keycloakBaseUrl = props.keycloak?.base_url || 'http://localhost:8080';
                            const realm = props.keycloak?.realm || 'dev';
                            const clientId = props.keycloak?.client_id || 'app-portal';
                            
                            // Use central domain for logout redirect (must match Keycloak client config)
                            // Pass current origin as query param so we can redirect back to tenant login if needed
                            const currentOrigin = window.location.origin;
                            const centralAppUrl = props.centralAppUrl || 'http://localhost:8000';
                            const postLogoutRedirectUri = encodeURIComponent(
                                `${centralAppUrl}/logged-out?from=${encodeURIComponent(currentOrigin)}`
                            );
                            
                            // Include client_id to ensure proper logout session handling
                            const logoutUrl = `${keycloakBaseUrl}/realms/${realm}/protocol/openid-connect/logout?client_id=${clientId}&post_logout_redirect_uri=${postLogoutRedirectUri}`;
                            window.location.href = logoutUrl;
                        } else {
                            // Fallback to Laravel logout if not logged into Keycloak
                            // Clear Inertia page cache to prevent back-button issues
                            if (router.clearHistory) {
                                router.clearHistory();
                            }

                            // Use POST method with replace to prevent back-button navigation
                            router.post(route('logout'), {}, {
                                preserveState: false,
                                preserveScroll: false,
                                replace: true,
                                onSuccess: () => {
                                    window.location.href = route('login');
                                },
                                onError: (errors) => {
                                    console.error('Logout failed:', errors);
                                    window.location.href = route('login');
                                }
                            });
                        }
                    }}
                >
                    <LogOut className="mr-2" />
                    Log out
                </button>
            </DropdownMenuItem>
        </>
    );
}
