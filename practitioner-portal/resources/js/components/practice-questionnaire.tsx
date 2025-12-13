'use client';

import { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Video, Monitor, MapPin, ArrowRight, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import OnboardingLayout from '@/components/onboarding-layout';


interface PracticeQuestionnaireProps {
    practiceType?: 'solo' | 'group' | null;
    appointmentType?: 'virtual' | 'hybrid' | 'in-person' | null;
    numberOfSeats?: number;
}

export default function PracticeQuestionnaire({ practiceType: initialPracticeType, appointmentType: initialAppointmentType }: PracticeQuestionnaireProps) {
    // Practice type comes from props (auto-set by backend based on subscription quantity)
    const practiceType = initialPracticeType;
    
    const [appointmentType, setAppointmentType] = useState<'virtual' | 'hybrid' | 'in-person' | null>(initialAppointmentType || null);
    const [hasMultipleLocations, setHasMultipleLocations] = useState<boolean | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Vertical slider state
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    
    // Determine which questions to show based on appointment type
    const getQuestions = (): string[] => {
        const questions: string[] = ['appointment'];
        // Only add location question if appointment type is hybrid or in-person
        if (appointmentType === 'hybrid' || appointmentType === 'in-person') {
            questions.push('location');
        }
        return questions;
    };
    
    const questions = getQuestions();
    
    // Check if all questions are answered
    const isAllQuestionsAnswered = (): boolean => {
        if (!appointmentType) {
            return false;
        }
        // If virtual, only one question needed
        if (appointmentType === 'virtual') {
            return true;
        }
        // If hybrid or in-person, need location answer too
        return hasMultipleLocations !== null;
    };
    
    // Check if we're on the last question
    const isLastQuestion = (): boolean => {
        const updatedQuestions = getQuestions();
        // For virtual, we're always on the last (and only) question once answered
        if (appointmentType === 'virtual') {
            return true;
        }
        // For hybrid/in-person, check if we're on the location question
        return currentQuestionIndex === updatedQuestions.length - 1;
    };
    
    // Show button only when on last question and all answered
    const shouldShowSubmitButton = isLastQuestion() && isAllQuestionsAnswered();
    
    // Handle appointment type selection - auto-advance slider if location question needed
    const handleAppointmentTypeSelect = (type: 'virtual' | 'hybrid' | 'in-person') => {
        setAppointmentType(type);
        setHasMultipleLocations(null); // Reset when changing appointment type
        
        // Auto-advance to location question if hybrid/in-person
        if (type === 'hybrid' || type === 'in-person') {
            // Wait for state update, then advance
            setTimeout(() => {
                const updatedQuestions = ['appointment', 'location'];
                const locationIndex = updatedQuestions.indexOf('location');
                if (locationIndex !== -1) {
                    setCurrentQuestionIndex(locationIndex);
                }
            }, 300); // Slightly longer delay for smoother transition
        }
    };
    
    // Handle location selection - auto-show button if all answered
    const handleLocationSelect = (value: boolean) => {
        setHasMultipleLocations(value);
    };
    
    // Navigation handlers
    const handlePrevious = () => {
        setCurrentQuestionIndex(prev => Math.max(0, prev - 1));
    };
    
    const handleNext = () => {
        const updatedQuestions = getQuestions();
        // Only allow navigation to location question if appointment type is hybrid or in-person
        if (currentQuestionIndex === 0 && (appointmentType === 'hybrid' || appointmentType === 'in-person')) {
            setCurrentQuestionIndex(1);
        } else {
            setCurrentQuestionIndex(prev => Math.min(updatedQuestions.length - 1, prev + 1));
        }
    };

    // Update questions array when appointment type changes
    useEffect(() => {
        const updatedQuestions = getQuestions();
        // Reset to first question if current index is out of bounds
        if (currentQuestionIndex >= updatedQuestions.length) {
            setCurrentQuestionIndex(0);
        }
    }, [appointmentType]);


    const handleSubmit = () => {
        if (!appointmentType) {
            return;
        }

        // If hybrid or in-person, must have answered the multiple locations question
        if ((appointmentType === 'hybrid' || appointmentType === 'in-person') && hasMultipleLocations === null) {
            return; // Don't submit if question not answered
        }

        setIsSubmitting(true);

        // Save questionnaire answers via backend (practice_type is already set by backend)
        router.post('/practice-questionnaire', {
            appointment_type: appointmentType,
            has_multiple_locations: hasMultipleLocations,
        }, {
            onSuccess: () => {
                // Backend redirects automatically.
                // No need for manual navigation here to avoid double loading.
                console.log('Questionnaire saved, redirecting...');
            },
            onError: (errors) => {
                console.error('Failed to save questionnaire:', errors);
                setIsSubmitting(false);
            },
            preserveState: true,
            preserveScroll: true,
        });
    };

    return (
        <OnboardingLayout title="Practice Setup Questionnaire" contentClassName="flex items-center justify-center">
            <div className="w-full max-w-3xl">
                    {/* Header Section - Outside Card */}
                    <div className="mb-3 text-center">
                        <div className="flex items-center justify-center gap-3 mb-1.5">
                            <Sparkles className="h-7 w-7 text-primary" />
                            <h1 className="text-3xl font-bold text-gray-900">
                                Let's Get Started
                            </h1>
                        </div>
                        <p className="text-lg text-gray-600">
                            Help us customize your experience by answering a few quick questions
                        </p>
                    </div>

                    <Card className="border-2 shadow-2xl bg-white">
                        <CardContent className="space-y-0 pt-6">
                            {/* Vertical Slider Container */}
                            <div className="relative overflow-hidden" style={{ height: '260px' }}>
                                <div 
                                    className="transition-all duration-500 ease-in-out h-full"
                                    style={{
                                        transform: `translateY(-${currentQuestionIndex * 100}%)`,
                                    }}
                                >
                                    {/* Appointment Type Question */}
                                    <div className="h-full flex flex-col justify-start space-y-4 pt-2 pb-0 transition-opacity duration-500 ease-in-out">
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            How do you conduct appointments?
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <button
                                                type="button"
                                                onClick={() => handleAppointmentTypeSelect('in-person')}
                                                className={`p-6 rounded-lg border-2 transition-all text-left ${
                                                    appointmentType === 'in-person'
                                                        ? 'border-primary bg-primary/5 shadow-md'
                                                        : 'border-gray-200 hover:border-primary/50 hover:shadow-sm'
                                                }`}
                                            >
                                                <div className="flex flex-col items-center text-center gap-3">
                                                    <div className={`p-3 rounded-lg ${
                                                        appointmentType === 'in-person' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        <MapPin className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-gray-900 mb-1">In-Person Only</h4>
                                                        <p className="text-sm text-gray-600">
                                                            All appointments are conducted at your location
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleAppointmentTypeSelect('hybrid')}
                                                className={`p-6 rounded-lg border-2 transition-all text-left ${
                                                    appointmentType === 'hybrid'
                                                        ? 'border-primary bg-primary/5 shadow-md'
                                                        : 'border-gray-200 hover:border-primary/50 hover:shadow-sm'
                                                }`}
                                            >
                                                <div className="flex flex-col items-center text-center gap-3">
                                                    <div className={`p-3 rounded-lg ${
                                                        appointmentType === 'hybrid' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        <Monitor className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-gray-900 mb-1">Hybrid</h4>
                                                        <p className="text-sm text-gray-600">
                                                            Mix of virtual and in-person appointments
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleAppointmentTypeSelect('virtual')}
                                                className={`p-6 rounded-lg border-2 transition-all text-left ${
                                                    appointmentType === 'virtual'
                                                        ? 'border-primary bg-primary/5 shadow-md'
                                                        : 'border-gray-200 hover:border-primary/50 hover:shadow-sm'
                                                }`}
                                            >
                                                <div className="flex flex-col items-center text-center gap-3">
                                                    <div className={`p-3 rounded-lg ${
                                                        appointmentType === 'virtual' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        <Video className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-gray-900 mb-1">Virtual Only</h4>
                                                        <p className="text-sm text-gray-600">
                                                            All appointments are conducted online
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Multiple Locations Question - Always rendered */}
                                    <div className="h-full flex flex-col justify-start space-y-4 pt-2 pb-0 transition-opacity duration-500 ease-in-out">
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            Do you operate from multiple locations?
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            {appointmentType === 'hybrid' 
                                                ? 'If you have multiple locations, you\'ll set up operating hours for each location later.'
                                                : appointmentType === 'in-person'
                                                    ? 'If you have multiple locations, you\'ll set up each location separately later.'
                                                    : 'Please select an appointment type first.'}
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <button
                                                type="button"
                                                onClick={() => handleLocationSelect(false)}
                                                disabled={appointmentType !== 'hybrid' && appointmentType !== 'in-person'}
                                                className={`p-6 rounded-lg border-2 transition-all text-left ${
                                                    hasMultipleLocations === false
                                                        ? 'border-primary bg-primary/5 shadow-md'
                                                        : 'border-gray-200 hover:border-primary/50 hover:shadow-sm'
                                                } ${appointmentType !== 'hybrid' && appointmentType !== 'in-person' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className={`p-3 rounded-lg ${
                                                        hasMultipleLocations === false ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        <MapPin className="w-6 h-6" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-semibold text-gray-900 mb-1">Single Location</h4>
                                                        <p className="text-sm text-gray-600">
                                                            I operate from one location
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleLocationSelect(true)}
                                                disabled={appointmentType !== 'hybrid' && appointmentType !== 'in-person'}
                                                className={`p-6 rounded-lg border-2 transition-all text-left ${
                                                    hasMultipleLocations === true
                                                        ? 'border-primary bg-primary/5 shadow-md'
                                                        : 'border-gray-200 hover:border-primary/50 hover:shadow-sm'
                                                } ${appointmentType !== 'hybrid' && appointmentType !== 'in-person' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className={`p-3 rounded-lg ${
                                                        hasMultipleLocations === true ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        <MapPin className="w-6 h-6" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-semibold text-gray-900 mb-1">Multiple Locations</h4>
                                                        <p className="text-sm text-gray-600">
                                                            I operate from multiple locations
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Navigation Buttons - Always show, even for single question */}
                            <div className="flex items-center justify-between pt-2">
                                {/* Previous Button - Only show when not on first step */}
                                {currentQuestionIndex > 0 && questions.length > 1 ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handlePrevious}
                                        className="flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all duration-200 min-w-[100px]"
                                    >
                                        <ChevronUp className="w-4 h-4" />
                                        Previous
                                    </Button>
                                ) : (
                                    <div className="min-w-[100px]" /> // Spacer to keep layout consistent
                                )}
                                
                                {/* Question Indicators - Show if multiple questions */}
                                {questions.length > 1 ? (
                                    <div className="flex gap-2 flex-1 justify-center">
                                        {questions.map((_, index) => {
                                            // Disable location question indicator if appointment type is virtual
                                            const isDisabled = index === 1 && appointmentType === 'virtual';
                                            return (
                                                <button
                                                    key={index}
                                                    type="button"
                                                    onClick={() => {
                                                        // Prevent navigation to location question if virtual
                                                        if (!isDisabled) {
                                                            setCurrentQuestionIndex(index);
                                                        }
                                                    }}
                                                    disabled={isDisabled}
                                                    className={`w-2 h-2 rounded-full transition-all ${
                                                        index === currentQuestionIndex
                                                            ? 'bg-primary w-8'
                                                            : isDisabled
                                                                ? 'bg-gray-200 cursor-not-allowed'
                                                                : 'bg-gray-300 hover:bg-primary/50'
                                                    }`}
                                                    aria-label={`Go to question ${index + 1}`}
                                                />
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex-1" /> // Spacer for single question
                                )}
                                
                                {/* Next button or Continue to Setup button - Always show one */}
                                {!isLastQuestion() ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleNext}
                                        disabled={
                                            currentQuestionIndex >= questions.length - 1 ||
                                            (currentQuestionIndex === 0 && appointmentType === 'virtual')
                                        }
                                        className="flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
                                    >
                                        Next
                                        <ChevronDown className="w-4 h-4" />
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting || !isAllQuestionsAnswered()}
                                        variant="outline"
                                        className={`flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px] ${shouldShowSubmitButton ? 'animate-fadeInSlideUp' : ''}`}
                                    >
                                        {isSubmitting ? (
                                            'Saving...'
                                        ) : (
                                            <>
                                                Continue to Setup
                                                <ArrowRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
            </div>
        </OnboardingLayout>
    );
}

