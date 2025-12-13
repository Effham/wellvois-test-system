'use client';

import { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import * as React from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import { shouldShowCentralTour } from '@/utils/role-detection';

const steps: Step[] = [
  {
    target: '#platform-hub-12',
    content: '🏠 Welcome to your Clinic Hub! From here, you can easily switch between clinics you\'re a part of.',
    placement: 'bottom',
    disableBeacon: true,
    spotlightPadding: 10,
  },
  {
    target: '#central-appointments',
    content: '📅 Manage your appointments in one place — view, schedule, and conduct sessions directly from here.',
    placement: 'bottom',
    disableBeacon: true,
    spotlightPadding: 10,
  },
  {
    target: '#central-calendar',
    content: '🗓 Keep track of your schedule effortlessly — your calendar shows all upcoming bookings and availability at a glance.',
    placement: 'bottom',
    disableBeacon: true,
    spotlightPadding: 10,
  },
  {
    target: '#central-my-details',
    content: '👤 Your Personal Profile is here. Click to view and manage your personal details, professional information, and account settings.',
    placement: 'bottom',
    disableBeacon: true,
    spotlightPadding: 10,
  },
  {
    target: '#central-personal-information',
    content: '✏️ Update your personal and contact details here anytime to keep your information accurate and up to date.',
    placement: 'bottom',
    disableBeacon: true,
    spotlightPadding: 10,
  },
  {
    target: '#integrations',
    content: '🔗 Connect your tools here — integrate with Google Calendar and other services to sync your schedule automatically.',
    placement: 'bottom',
    disableBeacon: true,
    spotlightPadding: 10,
  },
];

export default function JoyrideTour() {
  const [run, setRun] = React.useState(false);
  const { auth } = usePage<SharedData>().props;

  React.useEffect(() => {
    // Don't show tour on central dashboards
    const isCentral = auth?.user?.tenancy?.is_central || false;
    if (isCentral) {
      return;
    }

    // Check localStorage to see if tour has already been shown
    const tourShown = localStorage.getItem(`tour_shown_central_${auth?.user?.id}`);

    // Check if user should see the central tour (practitioners/patients only)
    const shouldShow = shouldShowCentralTour(auth);

    // Show tour if: user should see it, hasn't seen it before, and onboarding flag is set
    const shouldShowTour = shouldShow && !tourShown && auth?.user?.is_onboarding;

    console.log('[CENTRAL TOUR DEBUG]', {
      shouldShow,
      tourShown,
      isOnboarding: auth?.user?.is_onboarding,
      willStartTour: shouldShowTour,
      userId: auth?.user?.id,
    });

    if (shouldShowTour) {
      // Add delay to ensure DOM is ready, especially after redirects
      const checkAndStartTour = () => {
        const firstTarget = document.querySelector(steps[0].target as string);
        if (firstTarget || steps[0].target === 'body') {
          console.log('[CENTRAL TOUR] Starting tour now!');
          setRun(true);
        } else {
          // Retry after a short delay if target not found
          console.log('[CENTRAL TOUR] Target not ready, retrying...');
          setTimeout(checkAndStartTour, 200);
        }
      };

      setTimeout(checkAndStartTour, 1000);
    }
  }, [auth?.user?.id, auth?.user?.is_onboarding, auth?.user?.tenancy?.is_central]);

  const handleCallback = ({ status }: CallBackProps) => {
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      console.log('[CENTRAL TOUR] Tour completed:', status);

      // Mark tour as shown in localStorage
      if (auth?.user?.id) {
        localStorage.setItem(`tour_shown_central_${auth.user.id}`, 'true');
      }

      // Update backend onboarding flag
      updateOnboarding(auth?.user?.id, false);

      setRun(false);
    }
  };

  const updateOnboarding = async (userId: any, isOnboarding: boolean) => {
    try {
      const response = await fetch('/api/update-onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
        body: JSON.stringify({
          user_id: userId,
          is_onboarding: isOnboarding ? 1 : 0,
        }),
      });

      const data = await response.json();
      if (data.success) {
        console.log('[CENTRAL TOUR] Onboarding flag updated successfully!');
      } else {
        console.error('[CENTRAL TOUR] Failed to update onboarding:', data.message || 'Unknown error');
      }
    } catch (error) {
      console.error('[CENTRAL TOUR] Error updating onboarding:', error);
    }
  };

  return (
    <Joyride
      run={run}
      steps={steps}
      continuous
      showSkipButton={false}
      disableScrolling
      showProgress={false}
      scrollToFirstStep={false}
      callback={handleCallback}
      styles={{
        options: {
          zIndex: 99999,
          primaryColor: 'hsl(var(--primary))',
          textColor: '#fff',
          backgroundColor: 'rgba(20, 20, 25, 0.95)',
          arrowColor: 'rgba(20, 20, 25, 0.95)',
          overlayColor: 'rgba(0, 0, 0, 0.65)',
        },
        spotlight: {
          borderRadius: 10,
          boxShadow:
            '0 0 0 3px rgba(255,255,255,0.3), 0 0 0 8px rgba(255,255,255,0.15), 0 0 40px rgba(0,0,0,0.4)',
        },
        tooltip: {
          borderRadius: 12,
          padding: '14px 18px',
          background:
            'linear-gradient(145deg, rgba(30,30,35,0.95), rgba(18,18,22,0.95))',
          color: '#fff',
          boxShadow:
            '0 10px 30px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
        },
        tooltipContainer: {
          fontSize: '0.95rem',
          fontWeight: 500,
        },
        buttonNext: {
          background: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
          borderRadius: 8,
          padding: '6px 14px',
          fontWeight: 600,
          fontSize: '0.875rem',
        },
        buttonBack: {
          background: 'transparent',
          color: '#ccc',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: 8,
          padding: '6px 14px',
          fontSize: '0.875rem',
          fontWeight: 500,
          marginRight: '0.5rem',
        },
        buttonSkip: { display: 'none' },
      }}
      locale={{
        back: 'Back',
        next: 'Next',
        last: 'Got it',
        close: 'Close',
      }}
    />
  );
}
