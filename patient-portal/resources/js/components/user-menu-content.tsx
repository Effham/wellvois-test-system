import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import { type User, SharedData } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { LogOut, Settings, ShieldCheck, User as UserIcon } from 'lucide-react';

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
                <DropdownMenuItem asChild>
                    <Link href={route('profile.edit')} className="block w-full" as="button" prefetch onClick={cleanup}>
                        <UserIcon className="mr-2" />
                        Profile
                    </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                    <Link href={route('settings.index')} className="block w-full" as="button" prefetch onClick={cleanup}>
                        <Settings className="mr-2" />
                        Settings
                    </Link>
                </DropdownMenuItem>

        {/* TWO FACTOR AUTH */}
            <DropdownMenuItem asChild>
                {currentUser.tenancy?.is_central ? (
                    <Link className="block w-full" href={route('two-factor-authentication.setup')} as="button" prefetch onClick={cleanup}>
                        <ShieldCheck className="mr-2" />
                        2 Step Verification
                    </Link>
                ) : (
                    <button 
                        className="flex items-center w-full px-2 py-1.5 text-sm" 
                        onClick={() => {
                            cleanup();
                            const centralAppUrl = props.centralAppUrl;
                            // The target central route to redirect to after SSO
                            const targetCentralRoute = route('two-factor-authentication.setup', {}, false); // Get raw path without encoding
                            
                            // Construct the URL to the new central-redirect route.
                            // Let Ziggy encode the `redirect` query parameter once.
                            const ssoCentralRedirectUrl = `${centralAppUrl}${route('sso.central-redirect', { redirect: targetCentralRoute }, false)}`;
                            
                            window.location.href = ssoCentralRedirectUrl;
                        }}
                    >
                        <ShieldCheck className="mr-2" />
                        2 Step Verification
                    </button>
                )}
            </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
                <button
                    className="flex items-center w-full px-2 py-1.5 text-sm"
                    onClick={(e) => {
                        e.preventDefault();
                        cleanup();

                        // Clear Inertia page cache to prevent back-button issues
                        if (router.clearHistory) {
                            router.clearHistory();
                        }

                        // Use POST method with replace to prevent back-button navigation
                        router.post(route('logout'), {}, {
                            preserveState: false,
                            preserveScroll: false,
                            replace: true, // Replace history entry instead of adding new one
                            onSuccess: () => {
                                // Force full page reload to clear all state
                                window.location.href = route('login.intent');
                            },
                            onError: (errors) => {
                                console.error('Logout failed:', errors);
                                // Fallback: force navigation even on error
                                window.location.href = route('login.intent');
                            }
                        });
                    }}
                >
                    <LogOut className="mr-2" />
                    Log out
                </button>
            </DropdownMenuItem>
        </>
    );
}
