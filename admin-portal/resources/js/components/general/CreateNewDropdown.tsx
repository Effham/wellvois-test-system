import { DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Link, usePage } from '@inertiajs/react';
import { Users, Calendar, FileText } from 'lucide-react';

interface CreateNewDropdownProps {
    // Add any additional props if needed in the future
}

export function CreateNewDropdown({}: CreateNewDropdownProps) {
    const page = usePage();
    const { auth }: any = page.props;
    const userPerms: string[] = auth?.user?.permissions || [];
    
    // Helper function to check if a dropdown item is active
    const isDropdownItemActive = (href: string) => {
        const currentPath = page.url.split('?')[0];
        return currentPath === href || currentPath.startsWith(href + '/');
    };

    return (
        <DropdownMenuContent 
            className="w-64 border-0 p-0 overflow-hidden" 
            align="start"
            sideOffset={12}
            style={{
                background: 'rgba(255, 255, 255, 0.02)',
                backdropFilter: 'blur(24px) saturate(180%) brightness(1.1)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%) brightness(1.1)',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: `
                    0 20px 40px -12px rgba(0, 0, 0, 0.4),
                    0 0 0 1px rgba(255, 255, 255, 0.1),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2),
                    inset 0 -1px 0 rgba(255, 255, 255, 0.1)
                `
            }}
        >
            {/* Ultra-Transparent Glass Background */}
            <div 
                className="absolute inset-0"
                style={{
                    background: `
                        linear-gradient(135deg, 
                            rgba(255, 255, 255, 0.15) 0%, 
                            rgba(255, 255, 255, 0.05) 25%,
                            rgba(255, 255, 255, 0.02) 50%,
                            rgba(255, 255, 255, 0.08) 100%
                        )
                    `,
                    borderRadius: '20px',
                }}
            ></div>
            
            {/* Floating Glass Header */}
            <div className="relative p-4 pb-2">
                <div 
                    className="text-xs font-semibold tracking-wider text-center py-2 px-4 rounded-full"
                    style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: 'rgba(0, 0, 0, 0.8)'
                    }}
                >
                    ✨ CREATE NEW
                </div>
            </div>
            
            {/* Premium Menu Items */}
            <div className="relative px-3 pb-4">
                <div className="space-y-2">
                    {/* New Intake - Show only if user has add-new-intake permission */}
                    {userPerms.includes('add-new-intake') && (
                    <DropdownMenuItem asChild>
                        <Link 
                            href="/intake/create" 
                            className={`group relative flex items-center px-4 py-3 rounded-2xl cursor-pointer transition-all duration-500 overflow-hidden ${
                                isDropdownItemActive('/intake/create') 
                                    ? 'font-medium scale-[1.02]' 
                                    : 'hover:text-gray-800 text-gray-700 hover:scale-[1.01]'
                            }`}
                            style={{
                                background: isDropdownItemActive('/intake/create') 
                                    ? 'rgba(var(--primary), 0.15)'
                                    : 'transparent',
                                backdropFilter: isDropdownItemActive('/intake/create') 
                                    ? 'blur(20px) saturate(180%)' 
                                    : 'none',
                                boxShadow: isDropdownItemActive('/intake/create')
                                    ? '0 4px 20px rgba(var(--primary), 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                                    : 'none',
                                color: isDropdownItemActive('/intake/create')
                                    ? 'hsl(var(--primary))'
                                    : undefined,
                            }}
                            onMouseEnter={(e) => {
                                if (!isDropdownItemActive('/intake/create')) {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                    e.currentTarget.style.backdropFilter = 'blur(20px) saturate(180%)';
                                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isDropdownItemActive('/intake/create')) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.backdropFilter = 'none';
                                    e.currentTarget.style.boxShadow = 'none';
                                }
                            }}
                        >
                            {/* Floating Glass Icon */}
                            <div 
                                className="w-10 h-10 rounded-xl flex items-center justify-center mr-4 transition-all duration-500"
                                style={{
                                    background: isDropdownItemActive('/intake/create')
                                        ? 'rgba(255, 255, 255, 0.3)'
                                        : 'rgba(255, 255, 255, 0.15)',
                                    backdropFilter: 'blur(10px)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                }}
                            >
                                <Users className={`h-5 w-5 transition-all duration-500 ${
                                    isDropdownItemActive('/intake/create')
                                        ? 'text-primary'
                                        : 'text-gray-600 group-hover:text-sidebar-accent group-hover:scale-110'
                                }`} />
                            </div>
                            
                            <div className="flex-1">
                                <div className="text-sm font-semibold">New Intake</div>
                                <div className={`text-xs transition-all duration-300 ${
                                    isDropdownItemActive('/intake/create')
                                        ? 'text-primary/80'
                                        : 'text-gray-500 group-hover:text-gray-600'
                                }`}>
                                    Patient registration
                                </div>
                            </div>

                            {/* Liquid Glass Shimmer */}
                            <div 
                                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-700 pointer-events-none"
                                style={{
                                    background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%)',
                                    transform: 'translateX(-100%)',
                                    animation: 'shimmer 2s infinite',
                                }}
                            ></div>
                        </Link>
                    </DropdownMenuItem>
                    )}

                    {/* New Appointment - Show only if user has add-new-appointment permission */}
                    {userPerms.includes('add-new-appointment') && (
                    <DropdownMenuItem asChild>
                        <Link 
                            href="/appointments/create" 
                            className={`group relative flex items-center px-4 py-3 rounded-2xl cursor-pointer transition-all duration-500 overflow-hidden ${
                                isDropdownItemActive('/appointments/create') 
                                    ? 'font-medium scale-[1.02]' 
                                    : 'hover:text-gray-800 text-gray-700 hover:scale-[1.01]'
                            }`}
                            style={{
                                background: isDropdownItemActive('/appointments/create') 
                                    ? 'rgba(var(--primary), 0.15)'
                                    : 'transparent',
                                backdropFilter: isDropdownItemActive('/appointments/create') 
                                    ? 'blur(20px) saturate(180%)' 
                                    : 'none',
                                boxShadow: isDropdownItemActive('/appointments/create')
                                    ? '0 4px 20px rgba(var(--primary), 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                                    : 'none',
                                color: isDropdownItemActive('/appointments/create')
                                    ? 'hsl(var(--primary))'
                                    : undefined,
                            }}
                            onMouseEnter={(e) => {
                                if (!isDropdownItemActive('/appointments/create')) {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                    e.currentTarget.style.backdropFilter = 'blur(20px) saturate(180%)';
                                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isDropdownItemActive('/appointments/create')) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.backdropFilter = 'none';
                                    e.currentTarget.style.boxShadow = 'none';
                                }
                            }}
                        >
                            {/* Floating Glass Icon */}
                            <div 
                                className="w-10 h-10 rounded-xl flex items-center justify-center mr-4 transition-all duration-500"
                                style={{
                                    background: isDropdownItemActive('/appointments/create')
                                        ? 'rgba(255, 255, 255, 0.3)'
                                        : 'rgba(255, 255, 255, 0.15)',
                                    backdropFilter: 'blur(10px)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                }}
                            >
                                <Calendar className={`h-5 w-5 transition-all duration-500 ${
                                    isDropdownItemActive('/appointments/create')
                                        ? 'text-primary'
                                        : 'text-gray-600 group-hover:text-sidebar-accent group-hover:scale-110'
                                }`} />
                            </div>
                            
                            <div className="flex-1">
                                <div className="text-sm font-semibold">New Appointment</div>
                                <div className={`text-xs transition-all duration-300 ${
                                    isDropdownItemActive('/appointments/create')
                                        ? 'text-primary/80'
                                        : 'text-gray-500 group-hover:text-gray-600'
                                }`}>
                                    Schedule visit
                                </div>
                            </div>

                            {/* Liquid Glass Shimmer */}
                            <div 
                                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-700 pointer-events-none"
                                style={{
                                    background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%)',
                                    transform: 'translateX(-100%)',
                                    animation: 'shimmer 2s infinite',
                                }}
                            ></div>
                        </Link>
                    </DropdownMenuItem>
                    )}

                    {/* New Notes - Show only if user has add-note permission */}
                    {userPerms.includes('add-note') && (
                    <DropdownMenuItem asChild>
                        <Link 
                            href="/notes/create" 
                            className={`group relative flex items-center px-4 py-3 rounded-2xl cursor-pointer transition-all duration-500 overflow-hidden ${
                                isDropdownItemActive('/notes/create') 
                                    ? 'font-medium scale-[1.02]' 
                                    : 'hover:text-gray-800 text-gray-700 hover:scale-[1.01]'
                            }`}
                            style={{
                                background: isDropdownItemActive('/notes/create') 
                                    ? 'rgba(var(--primary), 0.15)'
                                    : 'transparent',
                                backdropFilter: isDropdownItemActive('/notes/create') 
                                    ? 'blur(20px) saturate(180%)' 
                                    : 'none',
                                boxShadow: isDropdownItemActive('/notes/create')
                                    ? '0 4px 20px rgba(var(--primary), 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                                    : 'none',
                                color: isDropdownItemActive('/notes/create')
                                    ? 'hsl(var(--primary))'
                                    : undefined,
                            }}
                            onMouseEnter={(e) => {
                                if (!isDropdownItemActive('/notes/create')) {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                    e.currentTarget.style.backdropFilter = 'blur(20px) saturate(180%)';
                                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isDropdownItemActive('/notes/create')) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.backdropFilter = 'none';
                                    e.currentTarget.style.boxShadow = 'none';
                                }
                            }}
                        >
                            {/* Floating Glass Icon */}
                            <div 
                                className="w-10 h-10 rounded-xl flex items-center justify-center mr-4 transition-all duration-500"
                                style={{
                                    background: isDropdownItemActive('/notes/create')
                                        ? 'rgba(255, 255, 255, 0.3)'
                                        : 'rgba(255, 255, 255, 0.15)',
                                    backdropFilter: 'blur(10px)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                }}
                            >
                                <FileText className={`h-5 w-5 transition-all duration-500 ${
                                    isDropdownItemActive('/notes/create')
                                        ? 'text-primary'
                                        : 'text-gray-600 group-hover:text-sidebar-accent group-hover:scale-110'
                                }`} />
                            </div>
                            
                            <div className="flex-1">
                                <div className="text-sm font-semibold">New Notes</div>
                                <div className={`text-xs transition-all duration-300 ${
                                    isDropdownItemActive('/notes/create')
                                        ? 'text-primary/80'
                                        : 'text-gray-500 group-hover:text-gray-600'
                                }`}>
                                    Clinical documentation
                                </div>
                            </div>

                            {/* Liquid Glass Shimmer */}
                            <div 
                                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-700 pointer-events-none"
                                style={{
                                    background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%)',
                                    transform: 'translateX(-100%)',
                                    animation: 'shimmer 2s infinite',
                                }}
                            ></div>
                        </Link>
                    </DropdownMenuItem>
                    )}
                </div>
            </div>

            {/* Add custom keyframes for shimmer animation */}
            <style dangerouslySetInnerHTML={{
                __html: `
                    @keyframes shimmer {
                        0% { transform: translateX(-100%); }
                        100% { transform: translateX(100%); }
                    }
                `
            }} />
        </DropdownMenuContent>
    );
} 