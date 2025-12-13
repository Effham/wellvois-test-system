import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Activity, Heart, Stethoscope } from 'lucide-react';

interface GlobalPageLoaderProps {
    children: React.ReactNode;
    delay?: number;
    enabled?: boolean;
}

/**
 * Global Page Loader Component
 * 
 * This component wraps all page content and shows a loading state
 * for a brief moment before rendering the actual page content.
 * 
 * This prevents browser crashes by:
 * 1. Loading the layout (sidebar, topbar) immediately
 * 2. Showing a loading indicator in the content area
 * 3. Rendering the actual page content after a delay
 * 
 * The layout stays in place and only the content area updates.
 */
export function GlobalPageLoader({ 
    children, 
    delay = 800,
    enabled = true 
}: GlobalPageLoaderProps) {
    const [isLoading, setIsLoading] = useState(enabled);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    useEffect(() => {
        // On initial load, show loading for the specified delay
        if (isInitialLoad && enabled) {
            const timer = setTimeout(() => {
                setIsLoading(false);
                setIsInitialLoad(false);
            }, delay);

            return () => clearTimeout(timer);
        }
    }, [isInitialLoad, delay, enabled]);

    // Listen for Inertia navigation events
    useEffect(() => {
        if (!enabled) return;

        const handleStart = () => {
            // Show loading when navigation starts
            setIsLoading(true);
        };

        const handleFinish = () => {
            // Hide loading after delay when navigation finishes
            setTimeout(() => {
                setIsLoading(false);
            }, delay);
        };

        // Subscribe to Inertia events
        const removeStartListener = router.on('start', handleStart);
        const removeFinishListener = router.on('finish', handleFinish);

        return () => {
            removeStartListener();
            removeFinishListener();
        };
    }, [delay, enabled]);

    if (!enabled) {
        return <>{children}</>;
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
                <div className="text-center relative">
                    {/* Premium Loading Animation */}
                    <div className="relative w-20 h-20 mx-auto mb-4">
                        {/* Outer rotating ring */}
                        <div className="absolute inset-0 rounded-full border-3 border-primary/20 dark:border-primary/30"></div>
                        
                        {/* Animated gradient ring */}
                        <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-primary border-r-primary animate-spin"></div>
                        
                        {/* Inner pulsing circle */}
                        <div className="absolute inset-3 rounded-full bg-primary/10 dark:bg-primary/20 animate-pulse"></div>
                        
                        {/* Center medical icon */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Activity className="h-8 w-8 text-primary animate-pulse" strokeWidth={2.5} />
                        </div>
                        
                        {/* Orbiting dots */}
                        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s' }}>
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full"></div>
                        </div>
                        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s', animationDelay: '1s' }}>
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary/60 rounded-full"></div>
                        </div>
                        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s', animationDelay: '2s' }}>
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary/40 rounded-full"></div>
                        </div>
                    </div>

                    {/* Simple loading text */}
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                        Loading...
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

