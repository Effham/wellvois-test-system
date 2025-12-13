'use client';

import { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { User, UserX, Clock, Calendar, ArrowRight, ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import OnboardingLayout from '@/components/onboarding-layout';

interface OnboardingPractitionerQuestionsProps {
    isPractitioner?: boolean | null;
    registerTiming?: string | null;
}

export default function OnboardingPractitionerQuestions({ 
    isPractitioner: initialIsPractitioner, 
    registerTiming: initialRegisterTiming 
}: OnboardingPractitionerQuestionsProps) {
    const [isPractitioner, setIsPractitioner] = useState<boolean | null>(initialIsPractitioner ?? null);
    const [registerTiming, setRegisterTiming] = useState<'now' | 'later' | null>(
        initialRegisterTiming === 'now' || initialRegisterTiming === 'later' ? initialRegisterTiming : null
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Vertical slider state
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    
    // Determine which questions to show based on practitioner answer
    const getQuestions = (): string[] => {
        const questions: string[] = ['practitioner'];
        // Only add timing question if user is a practitioner
        if (isPractitioner === true) {
            questions.push('timing');
        }
        return questions;
    };
    
    const questions = getQuestions();
    
    // Check if all questions are answered
    const isAllQuestionsAnswered = (): boolean => {
        if (isPractitioner === null) {
            return false;
        }
        // If not a practitioner, only one question needed
        if (isPractitioner === false) {
            return true;
        }
        // If practitioner, need timing answer too
        return registerTiming !== null;
    };
    
    // Check if we're on the last question
    const isLastQuestion = (): boolean => {
        const updatedQuestions = getQuestions();
        // For non-practitioner, we're always on the last (and only) question once answered
        if (isPractitioner === false) {
            return true;
        }
        // For practitioner, check if we're on the timing question
        return currentQuestionIndex === updatedQuestions.length - 1;
    };
    
    // Show button only when on last question and all answered
    const shouldShowSubmitButton = isLastQuestion() && isAllQuestionsAnswered();
    
    // Handle practitioner selection - auto-advance slider if "Yes" selected
    const handlePractitionerSelect = (value: boolean) => {
        setIsPractitioner(value);
        setRegisterTiming(null); // Reset timing when changing practitioner answer
        
        if (value === true) {
            // Auto-advance to timing question
            setTimeout(() => {
                const updatedQuestions = ['practitioner', 'timing'];
                const timingIndex = updatedQuestions.indexOf('timing');
                if (timingIndex !== -1) {
                    setCurrentQuestionIndex(timingIndex);
                }
            }, 300);
        } else {
            // User selected "No", submit immediately
            handleSubmit(false, null);
        }
    };
    
    // Handle timing selection
    const handleTimingSelect = (timing: 'now' | 'later') => {
        setRegisterTiming(timing);
    };
    
    // Navigation handlers
    const handlePrevious = () => {
        setCurrentQuestionIndex(prev => Math.max(0, prev - 1));
    };
    
    const handleNext = () => {
        const updatedQuestions = getQuestions();
        // Only allow navigation to timing question if user is a practitioner
        if (currentQuestionIndex === 0 && isPractitioner === true) {
            setCurrentQuestionIndex(1);
        } else {
            setCurrentQuestionIndex(prev => Math.min(updatedQuestions.length - 1, prev + 1));
        }
    };
    
    // Update questions array when practitioner answer changes
    useEffect(() => {
        const updatedQuestions = getQuestions();
        // Reset to first question if current index is out of bounds
        if (currentQuestionIndex >= updatedQuestions.length) {
            setCurrentQuestionIndex(0);
        }
    }, [isPractitioner]);
    
    const handleSubmit = (practitionerValue?: boolean | null, timingValue?: 'now' | 'later' | null) => {
        const finalPractitioner = practitionerValue !== undefined ? practitionerValue : isPractitioner;
        const finalTiming = timingValue !== undefined ? timingValue : registerTiming;
        
        if (finalPractitioner === null) {
            return;
        }
        
        // If practitioner is true, timing must be provided
        if (finalPractitioner === true && finalTiming === null) {
            return; // Don't submit if question not answered
        }
        
        setIsSubmitting(true);
        
        // Prepare submission data
        const submitData: any = {
            is_practitioner: finalPractitioner,
        };
        
        // Only include timing if user is a practitioner
        if (finalPractitioner === true && finalTiming !== null) {
            submitData.register_timing = finalTiming;
        }
        
        router.post('/onboarding/practitioner/questions', submitData, {
            onSuccess: () => {
                // Backend redirects automatically
            },
            onError: (errors) => {
                console.error('Failed to save answers:', errors);
                setIsSubmitting(false);
            },
            preserveState: true,
            preserveScroll: true,
        });
    };
    
    return (
        <OnboardingLayout title="Practitioner Information" contentClassName="flex items-center justify-center">
            <div className="w-full max-w-3xl">
                {/* Header Section - Outside Card */}
                <div className="mb-3 text-center">
                    <div className="flex items-center justify-center gap-3 mb-1.5">
                        <CheckCircle2 className="h-7 w-7 text-primary" />
                        <h1 className="text-3xl font-bold text-gray-900">
                            You're Almost There!
                        </h1>
                    </div>
                    <p className="text-lg text-gray-600">
                        Just a few more questions to complete your setup
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
                                {/* Practitioner Question */}
                                <div className="h-full flex flex-col justify-start space-y-4 pt-2 pb-0 transition-opacity duration-500 ease-in-out">
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        Are you a practitioner yourself?
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        This helps us customize your experience and set up the right features for your role
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={() => handlePractitionerSelect(true)}
                                            disabled={isSubmitting}
                                            className={`p-6 rounded-lg border-2 transition-all text-left ${
                                                isPractitioner === true
                                                    ? 'border-primary bg-primary/5 shadow-md'
                                                    : 'border-gray-200 hover:border-primary/50 hover:shadow-sm'
                                            } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className={`p-3 rounded-lg ${
                                                    isPractitioner === true ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                    <User className="w-6 h-6" />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-gray-900 mb-1">Yes, I am a practitioner</h4>
                                                    <p className="text-sm text-gray-600">
                                                        I provide healthcare services to patients
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handlePractitionerSelect(false)}
                                            disabled={isSubmitting}
                                            className={`p-6 rounded-lg border-2 transition-all text-left ${
                                                isPractitioner === false
                                                    ? 'border-primary bg-primary/5 shadow-md'
                                                    : 'border-gray-200 hover:border-primary/50 hover:shadow-sm'
                                            } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className={`p-3 rounded-lg ${
                                                    isPractitioner === false ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                    <UserX className="w-6 h-6" />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-gray-900 mb-1">No, I'm not a practitioner</h4>
                                                    <p className="text-sm text-gray-600">
                                                        I manage the practice but don't provide services
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {/* Register Timing Question - Only rendered if practitioner is true */}
                                {isPractitioner === true && (
                                    <div className="h-full flex flex-col justify-start space-y-4 pt-2 pb-0 transition-opacity duration-500 ease-in-out">
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            When would you like to register?
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            You can complete your practitioner profile now or finish it later from your dashboard. Either way, you'll have full access to all features.
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <button
                                                type="button"
                                                onClick={() => handleTimingSelect('now')}
                                                disabled={isSubmitting}
                                                className={`p-6 rounded-lg border-2 transition-all text-left ${
                                                    registerTiming === 'now'
                                                        ? 'border-primary bg-primary/5 shadow-md'
                                                        : 'border-gray-200 hover:border-primary/50 hover:shadow-sm'
                                                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className={`p-3 rounded-lg ${
                                                        registerTiming === 'now' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        <Clock className="w-6 h-6" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-semibold text-gray-900 mb-1">Register Now</h4>
                                                        <p className="text-sm text-gray-600">
                                                            Complete your practitioner profile now
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleTimingSelect('later')}
                                                disabled={isSubmitting}
                                                className={`p-6 rounded-lg border-2 transition-all text-left ${
                                                    registerTiming === 'later'
                                                        ? 'border-primary bg-primary/5 shadow-md'
                                                        : 'border-gray-200 hover:border-primary/50 hover:shadow-sm'
                                                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className={`p-3 rounded-lg ${
                                                        registerTiming === 'later' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        <Calendar className="w-6 h-6" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-semibold text-gray-900 mb-1">Register Later</h4>
                                                        <p className="text-sm text-gray-600">
                                                            I'll complete my profile from the dashboard
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Navigation Buttons */}
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
                                <div className="min-w-[100px]" />
                            )}
                            
                            {/* Question Indicators - Show if multiple questions */}
                            {questions.length > 1 ? (
                                <div className="flex gap-2 flex-1 justify-center">
                                    {questions.map((_, index) => {
                                        return (
                                            <button
                                                key={index}
                                                type="button"
                                                onClick={() => {
                                                    // Prevent navigation to timing question if not a practitioner
                                                    if (index === 1 && isPractitioner !== true) {
                                                        return;
                                                    }
                                                    setCurrentQuestionIndex(index);
                                                }}
                                                disabled={index === 1 && isPractitioner !== true}
                                                className={`w-2 h-2 rounded-full transition-all ${
                                                    index === currentQuestionIndex
                                                        ? 'bg-primary w-8'
                                                        : index === 1 && isPractitioner !== true
                                                            ? 'bg-gray-200 cursor-not-allowed'
                                                            : 'bg-gray-300 hover:bg-primary/50'
                                                }`}
                                                aria-label={`Go to question ${index + 1}`}
                                            />
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex-1" />
                            )}
                            
                            {/* Submit button - Only show on last question */}
                            {isLastQuestion() ? (
                                <Button
                                    onClick={() => handleSubmit()}
                                    disabled={isSubmitting || !isAllQuestionsAnswered()}
                                    variant="outline"
                                    className={`flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px] ${shouldShowSubmitButton ? 'animate-fadeInSlideUp' : ''}`}
                                >
                                    {isSubmitting ? (
                                        'Saving...'
                                    ) : (
                                        <>
                                            Continue
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </Button>
                            ) : (
                                <div className="min-w-[100px]" />
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </OnboardingLayout>
    );
}
