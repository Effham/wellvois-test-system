import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';

export function NavMain({ items = [] }: { items: NavItem[] }) {
    const page = usePage();
    
    // Helper function to check if a navigation item is active
    const isActive = (href: string) => {
        // Extract pathname from page.url (removes query parameters)
        const currentPath = page.url.split('?')[0];
        
        // Special case: highlight dashboard menu item when on role-specific dashboards
        if (href === '/dashboard' && (
            currentPath === '/patient-dashboard' || 
            currentPath === '/practitioner-dashboard' ||
            currentPath === '/central/patient-dashboard' ||
            currentPath === '/central/practitioner-dashboard'
        )) {
            return true;
        }
        
        // Special case: highlight Settings menu item when on any settings page
        if (href === '/settings/organization' && currentPath.startsWith('/settings/')) {
            return true;
        }
        
        return currentPath === href || currentPath.startsWith(href + '/');
    };
    
    function convertToId(str: string): string {
  return str.replace(/\//g, '-').replace(/^-/, '');
}
    return (
        <SidebarGroup className="px-2 py-0">
            {/* <SidebarGroupLabel>Main</SidebarGroupLabel> */}
            <SidebarMenu className="gap-1">
                {items.map((item) => {
                    return (
                        <SidebarMenuItem key={item.title} id={convertToId(item.href)}>
                            <SidebarMenuButton
                                asChild
                                isActive={isActive(item.href)}
                                className={`${isActive(item.href) ? '!bg-primary/10 !text-primary font-medium border-0' : ''} hover:!bg-primary/10 hover:!text-primary [&>span:last-child]:!whitespace-nowrap [&>span:last-child]:!overflow-visible [&>span:last-child]:!text-clip data-[active=true]:!bg-primary/10 data-[active=true]:!text-primary`}
                                style={{
                                    height: '36.4px',
                                    borderRadius: '8px'
                                }}
                            >
                                <Link href={item.href} >
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
            
        </SidebarGroup>
    );
}
