import PracticeQuestionnaire from '@/components/practice-questionnaire';
import { usePage } from '@inertiajs/react';

export default function OnboardingQuestionnaire() {
    const page = usePage<any>();
    const { practiceType, appointmentType, numberOfSeats } = page.props;

    return <PracticeQuestionnaire practiceType={practiceType} appointmentType={appointmentType} numberOfSeats={numberOfSeats} />;
}

