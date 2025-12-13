import React, { useState } from 'react';
import PublicPortalLayout from '@/layouts/public-portal-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
// RadioGroup component will be added later  
// import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
    ClipboardList, 
    ChevronRight, 
    ChevronLeft,
    Brain,
    Heart,
    Users,
    CheckCircle
} from 'lucide-react';

interface Props {
    tenant: {
        id: string;
        company_name: string;
    };
    appearanceSettings?: {
        appearance_theme_color?: string;
        appearance_logo_path?: string;
        appearance_font_family?: string;
    };
    websiteSettings?: {
        navigation?: {
            items?: Array<{
                id: string;
                label: string;
                enabled: boolean;
                customLabel?: string;
                order: number;
            }>;
        };
        appearance?: any;
    };
}

interface AssessmentData {
    concerns: string[];
    ageGroup: string;
    preferredModalities: string[];
    languages: string[];
    additionalNotes: string;
}

const CONCERNS = [
    'Anxiety & Stress',
    'Depression',
    'Trauma & PTSD',
    'Relationship Issues',
    'Grief & Loss',
    'Addiction',
    'Eating Disorders',
    'ADHD',
    'Anger Management',
    'Life Transitions',
    'Work-related Stress',
    'Family Conflicts'
];

const AGE_GROUPS = [
    { value: 'child', label: 'Child (5-12 years)' },
    { value: 'adolescent', label: 'Adolescent (13-17 years)' },
    { value: 'adult', label: 'Adult (18-64 years)' },
    { value: 'senior', label: 'Senior (65+ years)' }
];

const MODALITIES = [
    'Cognitive Behavioral Therapy (CBT)',
    'Dialectical Behavior Therapy (DBT)',
    'EMDR',
    'Mindfulness-Based Therapy',
    'Psychodynamic Therapy',
    'Art Therapy',
    'Family Therapy',
    'Group Therapy'
];

const LANGUAGES = [
    'English',
    'French',
    'Spanish',
    'Mandarin',
    'Arabic',
    'Hindi',
    'Punjabi'
];

export default function AssessYourself({ tenant, appearanceSettings, websiteSettings }: Props) {
    const [currentStep, setCurrentStep] = useState(1);
    const [assessmentData, setAssessmentData] = useState<AssessmentData>({
        concerns: [],
        ageGroup: '',
        preferredModalities: [],
        languages: [],
        additionalNotes: ''
    });

    const totalSteps = 5;
    const progress = (currentStep / totalSteps) * 100;

    const handleConcernChange = (concern: string, checked: boolean) => {
        setAssessmentData(prev => ({
            ...prev,
            concerns: checked 
                ? [...prev.concerns, concern]
                : prev.concerns.filter(c => c !== concern)
        }));
    };

    const handleModalityChange = (modality: string, checked: boolean) => {
        setAssessmentData(prev => ({
            ...prev,
            preferredModalities: checked 
                ? [...prev.preferredModalities, modality]
                : prev.preferredModalities.filter(m => m !== modality)
        }));
    };

    const handleLanguageChange = (language: string, checked: boolean) => {
        setAssessmentData(prev => ({
            ...prev,
            languages: checked 
                ? [...prev.languages, language]
                : prev.languages.filter(l => l !== language)
        }));
    };

    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <Brain className="mx-auto h-12 w-12 text-primary mb-4" />
                            <h2 className="text-2xl font-bold mb-2">What brings you here today?</h2>
                            <p className="text-muted-foreground">
                                Select all areas you'd like support with (you can choose multiple)
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {CONCERNS.map(concern => (
                                <div key={concern} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={concern}
                                        checked={assessmentData.concerns.includes(concern)}
                                        onCheckedChange={(checked) => 
                                            handleConcernChange(concern, checked as boolean)
                                        }
                                    />
                                    <Label htmlFor={concern} className="text-sm cursor-pointer">
                                        {concern}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <Users className="mx-auto h-12 w-12 text-primary mb-4" />
                            <h2 className="text-2xl font-bold mb-2">Who is this assessment for?</h2>
                            <p className="text-muted-foreground">
                                This helps us recommend the most suitable practitioners
                            </p>
                        </div>
                        
                        <div className="space-y-3">
                            {AGE_GROUPS.map(group => (
                                <div key={group.value} className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        value={group.value}
                                        id={group.value}
                                        name="ageGroup"
                                        checked={assessmentData.ageGroup === group.value}
                                        onChange={(e) => 
                                            setAssessmentData(prev => ({ ...prev, ageGroup: e.target.value }))
                                        }
                                        className="h-4 w-4 text-primary"
                                    />
                                    <Label htmlFor={group.value} className="cursor-pointer">
                                        {group.label}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <Heart className="mx-auto h-12 w-12 text-primary mb-4" />
                            <h2 className="text-2xl font-bold mb-2">Preferred therapy approaches?</h2>
                            <p className="text-muted-foreground">
                                Select any therapeutic approaches you're interested in (optional)
                            </p>
                        </div>
                        
                        <div className="space-y-3">
                            {MODALITIES.map(modality => (
                                <div key={modality} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={modality}
                                        checked={assessmentData.preferredModalities.includes(modality)}
                                        onCheckedChange={(checked) => 
                                            handleModalityChange(modality, checked as boolean)
                                        }
                                    />
                                    <Label htmlFor={modality} className="text-sm cursor-pointer">
                                        {modality}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <ClipboardList className="mx-auto h-12 w-12 text-primary mb-4" />
                            <h2 className="text-2xl font-bold mb-2">Language preferences</h2>
                            <p className="text-muted-foreground">
                                Select preferred languages for therapy sessions
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {LANGUAGES.map(language => (
                                <div key={language} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={language}
                                        checked={assessmentData.languages.includes(language)}
                                        onCheckedChange={(checked) => 
                                            handleLanguageChange(language, checked as boolean)
                                        }
                                    />
                                    <Label htmlFor={language} className="text-sm cursor-pointer">
                                        {language}
                                    </Label>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8">
                            <Label htmlFor="notes" className="text-sm font-medium mb-2 block">
                                Additional notes (optional)
                            </Label>
                            <Textarea
                                id="notes"
                                placeholder="Is there anything else you'd like us to know when matching you with a practitioner?"
                                value={assessmentData.additionalNotes}
                                onChange={(e) => 
                                    setAssessmentData(prev => ({ 
                                        ...prev, 
                                        additionalNotes: e.target.value 
                                    }))
                                }
                                className="min-h-[100px]"
                            />
                        </div>
                    </div>
                );

            case 5:
                return (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <CheckCircle className="mx-auto h-12 w-12 text-green-600 mb-4" />
                            <h2 className="text-2xl font-bold mb-2">Assessment Complete!</h2>
                            <p className="text-muted-foreground">
                                Based on your responses, here are our recommendations
                            </p>
                        </div>
                        
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold mb-4">Your Assessment Summary:</h3>
                            
                            {assessmentData.concerns.length > 0 && (
                                <div className="mb-4">
                                    <Label className="text-sm font-medium mb-2 block">Areas of Focus:</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {assessmentData.concerns.map(concern => (
                                            <Badge key={concern} variant="secondary">
                                                {concern}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {assessmentData.ageGroup && (
                                <div className="mb-4">
                                    <Label className="text-sm font-medium mb-2 block">Client Type:</Label>
                                    <Badge variant="outline">
                                        {AGE_GROUPS.find(g => g.value === assessmentData.ageGroup)?.label}
                                    </Badge>
                                </div>
                            )}

                            {assessmentData.preferredModalities.length > 0 && (
                                <div className="mb-4">
                                    <Label className="text-sm font-medium mb-2 block">Preferred Approaches:</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {assessmentData.preferredModalities.map(modality => (
                                            <Badge key={modality} variant="outline">
                                                {modality}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {assessmentData.languages.length > 0 && (
                                <div className="mb-4">
                                    <Label className="text-sm font-medium mb-2 block">Language Preferences:</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {assessmentData.languages.map(language => (
                                            <Badge key={language} variant="outline">
                                                {language}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Card>

                        <div className="text-center">
                            <p className="text-muted-foreground mb-4">
                                Ready to connect with a practitioner who matches your needs?
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Button size="lg" className="bg-primary hover:bg-primary/90">
                                    View Recommended Practitioners
                                </Button>
                                <Button variant="outline" size="lg">
                                    Book a Consultation
                                </Button>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <PublicPortalLayout 
            title="Assess Yourself" 
            tenant={tenant} 
            appearanceSettings={appearanceSettings}
            websiteSettings={websiteSettings}
        >
            <div className="py-12">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-foreground mb-4">
                            Find Your Perfect Match
                        </h1>
                        <p className="text-xl text-muted-foreground">
                            Take our quick assessment to get personalized practitioner recommendations
                        </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-8">
                        <div className="flex justify-between text-sm text-muted-foreground mb-2">
                            <span>Step {currentStep} of {totalSteps}</span>
                            <span>{Math.round(progress)}% Complete</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                    </div>

                    {/* Assessment Form */}
                    <Card>
                        <CardContent className="p-8">
                            {renderStep()}
                        </CardContent>
                    </Card>

                    {/* Navigation */}
                    <div className="flex justify-between mt-8">
                        <Button
                            variant="outline"
                            onClick={prevStep}
                            disabled={currentStep === 1}
                        >
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Previous
                        </Button>
                        
                        {currentStep < totalSteps ? (
                            <Button 
                                onClick={nextStep}
                                disabled={
                                    (currentStep === 1 && assessmentData.concerns.length === 0) ||
                                    (currentStep === 2 && !assessmentData.ageGroup)
                                }
                            >
                                Next
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        ) : (
                            <Button onClick={() => setCurrentStep(1)}>
                                Start Over
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </PublicPortalLayout>
    );
} 