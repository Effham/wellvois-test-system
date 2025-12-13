import React, { useState, useEffect, ReactNode } from 'react';
import { router } from '@inertiajs/react';
import { Activity, Loader2 } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';

interface PageContentLoaderProps {
    children: ReactNode;
    delay?: number;
    mode?: 'full' | 'minimal'; // 'full' shows centered loader, 'minimal' shows top progress bar
}

/**
 * Page Content Loader Component
 * 
 * This component wraps page content and shows a loading state during Inertia navigation.
 * The layout (sidebar, topbar) stays visible while only the content area shows loading.
 * 
 * How it works:
 * 1. Layout renders immediately (sidebar, topbar are always visible)
 * 2. On navigation start, show loading indicator in content area
 * 3. Inertia fetches only the page-specific data (not the full layout)
 * 4. Once data arrives, render the actual page content
 * 
 * This prevents full page reloads and keeps the UI responsive.
 * 
 * ## Modes:
 * - 'full': Shows a centered loading spinner (default, good for initial page loads)
 * - 'minimal': Shows a subtle top progress bar (good for persistent layouts)
 */
export function PageContentLoader({ children, delay = 150, mode = 'minimal' }: PageContentLoaderProps) {
    const [isNavigating, setIsNavigating] = useState(false);
    const [showLoader, setShowLoader] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        let progressTimer: NodeJS.Timeout;

        const handleStart = () => {
            setIsNavigating(true);
            setProgress(0);
            
            // Only show loader if navigation takes longer than delay
            timer = setTimeout(() => {
                setShowLoader(true);
                
                // Simulate progress for visual feedback
                if (mode === 'minimal') {
                    let currentProgress = 0;
                    progressTimer = setInterval(() => {
                        currentProgress += Math.random() * 15;
                        if (currentProgress > 90) currentProgress = 90; // Cap at 90%
                        setProgress(currentProgress);
                    }, 200);
                }
            }, delay);
        };

        const handleFinish = () => {
            clearTimeout(timer);
            clearInterval(progressTimer);
            
            // Complete the progress bar animation
            if (mode === 'minimal' && showLoader) {
                setProgress(100);
                setTimeout(() => {
                    setIsNavigating(false);
                    setShowLoader(false);
                    setProgress(0);
                }, 200);
            } else {
                setIsNavigating(false);
                setShowLoader(false);
                setProgress(0);
            }
        };

        // Subscribe to Inertia navigation events
        const removeStartListener = router.on('start', handleStart);
        const removeFinishListener = router.on('finish', handleFinish);

        return () => {
            clearTimeout(timer);
            clearInterval(progressTimer);
            removeStartListener();
            removeFinishListener();
        };
    }, [delay, mode, showLoader]);

    // Show loading state if navigation is taking longer than delay
    if (showLoader) {
        if (mode === 'minimal') {
            return (
                <>
                    {/* Subtle top progress bar */}
                    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-transparent">
                        <div 
                            className="h-full bg-primary transition-all duration-200 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    
                    {/* Show content with slight opacity during load */}
                    <div className="animate-pulse opacity-60">
                        {children}
                    </div>
                </>
            );
        }
        
        // Full mode - centered loading spinner
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

                        {/* Center app logo */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <AppLogoIcon 
                                collapsed={true} 
                                className="h-12 w-12 animate-pulse" 
                            />
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

                    {/* Loading text */}
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                        Loading...
                    </p>
                </div>
            </div>
        );
    }

    // Render actual content
    return <>{children}</>;
}

