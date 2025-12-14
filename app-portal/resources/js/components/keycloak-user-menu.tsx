import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Key, Shield } from 'lucide-react';
import { usePage } from '@inertiajs/react';
import { type SharedData } from '@/types';
import axios from 'axios';

interface KeycloakUserInfo {
    logged_in: boolean;
    user?: {
        name: string;
        email: string;
        keycloak_user_id?: string;
    };
    account_management_url?: string | null;
}

export function KeycloakUserMenu() {
    const { props } = usePage<SharedData>();
    const keycloakFromProps = props.keycloak;
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [keycloakData, setKeycloakData] = useState<KeycloakUserInfo | null>(
        keycloakFromProps ? {
            logged_in: keycloakFromProps.logged_in || false,
            user: keycloakFromProps.user || undefined,
            account_management_url: keycloakFromProps.account_management_url || undefined,
        } : null
    );
    const [isLoading, setIsLoading] = useState(false);

    // Debug: Log keycloak data to console
    useEffect(() => {
        console.log('KeycloakUserMenu - keycloak from props:', keycloakFromProps);
        console.log('KeycloakUserMenu - keycloakData state:', keycloakData);
        console.log('KeycloakUserMenu - isLoading:', isLoading);
    }, [keycloakFromProps, keycloakData, isLoading]);

    // Always try to fetch Keycloak data on mount if not available from props
    useEffect(() => {
        // If we already have valid data from props, use it
        if (keycloakFromProps?.logged_in && keycloakFromProps?.user) {
            setKeycloakData({
                logged_in: keycloakFromProps.logged_in,
                user: keycloakFromProps.user,
                account_management_url: keycloakFromProps.account_management_url || undefined,
            });
            return;
        }

        // Otherwise, try fetching from API (only once)
        if (!isLoading) {
            setIsLoading(true);
            axios.get('/api/keycloak/user-info')
                .then(response => {
                    console.log('KeycloakUserMenu - API response:', response.data);
                    if (response.data.logged_in && response.data.user) {
                        const apiData: KeycloakUserInfo = {
                            logged_in: true,
                            user: response.data.user,
                            account_management_url: response.data.account_management_url || undefined,
                        };
                        setKeycloakData(apiData);
                    } else {
                        setKeycloakData({ logged_in: false });
                    }
                })
                .catch(error => {
                    console.error('KeycloakUserMenu - API error:', error);
                    setKeycloakData({ logged_in: false });
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, []); // Run once on mount

    // Use state data if available, otherwise use props
    const keycloak = keycloakData || keycloakFromProps;

    // Debug: Show what we're checking
    console.log('KeycloakUserMenu render check:', {
        hasKeycloak: !!keycloak,
        loggedIn: keycloak?.logged_in,
        hasUser: !!keycloak?.user,
        userData: keycloak?.user,
        isLoading,
    });

    // Don't show anything if not logged into Keycloak
    if (!keycloak?.logged_in || !keycloak?.user) {
        // Return null but ensure the container doesn't collapse
        return null;
    }

    const user = keycloak.user;

    // Ensure we have valid user data
    if (!user.name || !user.email) {
        console.warn('KeycloakUserMenu - Invalid user data:', user);
        return null;
    }

    const handleLogout = () => {
        setIsLoggingOut(true);
        // Redirect to Keycloak logout endpoint
        // Keycloak will redirect back to /logged-out after logout
        const keycloakBaseUrl = keycloakFromProps?.base_url || 'http://localhost:8080';
        const realm = keycloakFromProps?.realm || 'dev';
        const redirectUri = encodeURIComponent(window.location.origin + '/logged-out');
        const logoutUrl = `${keycloakBaseUrl}/realms/${realm}/protocol/openid-connect/logout?redirect_uri=${redirectUri}`;
        window.location.href = logoutUrl;
    };

    const handleManageAccount = () => {
        const accountUrl = keycloak.account_management_url || keycloakFromProps?.account_management_url;
        if (accountUrl) {
            window.open(accountUrl, '_blank');
        } else {
            // Fallback: construct URL from config
            const keycloakBaseUrl = keycloakFromProps?.base_url || 'http://localhost:8080';
            const realm = keycloakFromProps?.realm || 'dev';
            window.open(`${keycloakBaseUrl}/realms/${realm}/account`, '_blank');
        }
    };

    const initials = user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <div className="relative" style={{ zIndex: 1000 }}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className="relative h-10 w-10 rounded-full border-2 border-purple-200 hover:border-purple-300 transition-colors bg-white shadow-md hover:shadow-lg"
                    >
                        <Avatar className="h-9 w-9 ring-2 ring-purple-100">
                            <AvatarImage src="" alt={user.name} />
                            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-semibold text-xs">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleManageAccount}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Manage Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleManageAccount}>
                    <Key className="mr-2 h-4 w-4" />
                    <span>Change Password</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleManageAccount}>
                    <Shield className="mr-2 h-4 w-4" />
                    <span>Security Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{isLoggingOut ? 'Logging out...' : 'Logout from WELLOVIS'}</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
        </div>
    );
}

