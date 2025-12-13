import React from 'react';
import { Check, Laptop, Moon, Sun } from 'lucide-react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAppearance } from '@/hooks/use-appearance';

const getIcon = (appearance: string) => {
    switch (appearance) {
        case 'light':
            return Sun;
        default:
            return Sun; // Always use sun icon for light theme
    }
};

export default function AppearanceDropdown({ children }: { children: React.ReactNode }) {
    const { appearance, updateAppearance } = useAppearance();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => updateAppearance('light')}>
                    <Sun className="mr-2 h-4 w-4" />
                    <span>Light</span>
                    {appearance === 'light' && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
