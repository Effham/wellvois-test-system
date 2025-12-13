import React from 'react';
import { Laptop, Moon, Sun } from 'lucide-react';

import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';

const appearances = [
    { value: 'light', icon: Sun, label: 'Light' },
];

export default function AppearanceTabs({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    const { appearance, updateAppearance } = useAppearance();

    return (
        <div className={cn('inline-flex gap-1 rounded-lg bg-neutral-100 p-1', className)} {...props}>
            {appearances.map(({ value, icon: Icon, label }) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => updateAppearance(value as any)}
                    className={cn(
                        'flex h-7 flex-1 cursor-pointer items-center gap-2 rounded-md px-2.5 text-xs font-medium transition-colors',
                        appearance === value
                            ? 'bg-white shadow-xs'
                            : 'text-neutral-500 hover:bg-neutral-200/60 hover:text-black',
                    )}
                >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only">{label}</span>
                </button>
            ))}
        </div>
    );
}
