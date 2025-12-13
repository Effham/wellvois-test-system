/**
 * Utility functions for onboarding navigation
 */

export type PracticeType = 'solo' | 'group' | null;
export type AppointmentType = 'virtual' | 'hybrid' | 'in-person' | null;

export interface OnboardingStatus {
    hasLocation: boolean;
    hasService: boolean;
}

/**
 * Determine the next onboarding step based on practice type, appointment type, and current status
 * Returns the route path for the next step, or null if onboarding is complete
 */
export function getNextOnboardingStep(
    practiceType: PracticeType,
    appointmentType: AppointmentType,
    onboardingStatus: OnboardingStatus
): string | null {
    // 1. Check if location needed and not completed
    // Location is required for hybrid and in-person appointments
    if (appointmentType !== 'virtual' && !onboardingStatus.hasLocation) {
        return '/onboarding/location/create';
    }
    
    // 2. Check if service needed and not completed
    // Service is always required
    if (!onboardingStatus.hasService) {
        return '/onboarding/service/create';
    }
    
    // 3. All steps complete
    return null; // Complete onboarding
}

/**
 * Get onboarding status from page props
 */
export function getOnboardingStatusFromProps(props: any): OnboardingStatus {
    const onboardingStatus = props.onboardingStatus || {};
    return {
        hasLocation: onboardingStatus.hasLocation || false,
        hasService: onboardingStatus.hasService || false,
    };
}

