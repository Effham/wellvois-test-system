/**
 * Utility functions for determining onboarding completion status
 */

export type PracticeType = 'solo' | 'group' | null;
export type AppointmentType = 'virtual' | 'hybrid' | 'in-person' | null;

export interface OnboardingStatus {
    hasLocation: boolean;
    hasService: boolean;
    locationCount: number;
    serviceCount: number;
    practitionerCount?: number;
    isComplete: boolean;
}

export type StepId = 'location' | 'service';

/**
 * Determine which steps are required based on questionnaire answers
 */
export function getRequiredSteps(
    practiceType: PracticeType,
    appointmentType: AppointmentType,
    hasMultipleLocations: boolean | null
): StepId[] {
    const steps: StepId[] = [];

    // Location step: Show if NOT virtual-only
    // Exception: Hide if virtual + single location (location auto-created)
    if (appointmentType !== 'virtual') {
        steps.push('location');
    }

    // Service step: Always required
    steps.push('service');



    return steps;
}

/**
 * Check if all required steps are completed
 */
export function checkCompletion(
    requiredSteps: StepId[],
    onboardingStatus: OnboardingStatus
): boolean {
    for (const step of requiredSteps) {
        switch (step) {
            case 'location':
                if (!onboardingStatus.hasLocation) {
                    return false;
                }
                break;
            case 'service':
                if (!onboardingStatus.hasService) {
                    return false;
                }
                break;

        }
    }
    return true;
}

/**
 * Determine if user should be redirected to dashboard (onboarding complete)
 */
export function shouldRedirectToDashboard(
    requiredSteps: StepId[],
    onboardingStatus: OnboardingStatus,
    practiceType: PracticeType
): boolean {
    return checkCompletion(requiredSteps, onboardingStatus);
}

