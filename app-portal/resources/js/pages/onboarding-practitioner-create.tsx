import { useForm } from '@inertiajs/react';
import { FormEventHandler, useState, useEffect } from 'react';
import { LoaderCircle, UserCheck, Shield, User, Briefcase, EyeOff, Eye } from 'lucide-react';
import { motion } from 'motion/react';
import InputError from '@/components/input-error';
import OnboardingLayout from '@/components/onboarding-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PhoneInput } from '@/components/phone-input';
import { Badge } from '@/components/ui/badge';

// Constants matching Create.tsx
const CREDENTIALS = [
    'MD', 'PhD', 'PsyD', 'MA', 'MS', 'MSW', 'LCSW', 'LMFT', 'LPC', 'LCPC', 'LPCC', 'LMHC', 'RN', 'NP', 'PA', 'Other'
];

const YEARS_OF_EXPERIENCE = [
    '0-1 years', '2-5 years', '6-10 years', '11-15 years', '16-20 years', '20+ years'
];

const SPECIALTIES = [
    'Anxiety Disorders', 'Depression', 'Trauma & PTSD', 'Addiction', 'Eating Disorders',
    'Bipolar Disorder', 'OCD', 'ADHD', 'Autism Spectrum', 'Grief & Loss', 'Relationship Issues',
    'Family Therapy', 'Child & Adolescent', 'Geriatric', 'LGBTQ+ Issues', 'Cultural Issues'
];

const THERAPEUTIC_MODALITIES = [
    'CBT', 'DBT', 'EMDR', 'Psychodynamic', 'Humanistic', 'Mindfulness-Based',
    'Solution-Focused', 'Narrative Therapy', 'Art Therapy', 'Play Therapy', 'Group Therapy'
];

const CLIENT_TYPES = [
    'Children (5-12)', 'Adolescents (13-17)', 'Adults (18-64)', 'Seniors (65+)',
    'Couples', 'Families', 'Groups'
];

const LANGUAGES = [
    'English', 'French', 'Spanish', 'Mandarin', 'Cantonese', 'Arabic', 'Hindi', 'Punjabi', 'Other'
];

const PROFESSIONAL_ASSOCIATIONS = [
    { value: 'APA', label: 'American Psychological Association' },
    { value: 'CPA', label: 'Canadian Psychological Association' },
    { value: 'NASW', label: 'National Association of Social Workers' }
];

type PractitionerRegistrationForm = {
    // Basic Info
    first_name: string;
    last_name: string;
    title: string;
    phone_number: string;
    extension: string;
    gender: string;
    pronoun: string;
    short_bio: string;
    full_bio: string;

    // Professional Details
    credentials: string[];
    years_of_experience: string;
    license_number: string;
    professional_associations: string[];
    primary_specialties: string[];
    therapeutic_modalities: string[];
    client_types_served: string[];
    languages_spoken: string[];

    // Account
    password?: string;
    password_confirmation?: string;
    administrative_consent: boolean;

    // Consents
    consents_accepted: boolean;
};


type ConsentBody = {
    heading: string;
    description: string;
    content: string;
    checkbox_text?: string;
    important_notice?: string;
    legal_principle?: string;
    security_notice?: string;
};

type Consent = {
    id: number;
    title: string;
    key: string;
    is_required: boolean;
    consent_body: ConsentBody | null;
}

interface Props {
    userEmail?: string | null;
    consents: Consent[];
}

export default function OnboardingPractitionerCreate({ userEmail, consents = [] }: Props) {
    const [currentStep, setCurrentStep] = useState(1);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const { data, setData, post, processing, errors, transform } = useForm<PractitionerRegistrationForm>({
        first_name: '',
        last_name: '',
        title: '',
        phone_number: '',
        extension: '',
        gender: '',
        pronoun: '',
        short_bio: '',
        full_bio: '',
        credentials: [],
        years_of_experience: '',
        license_number: '',
        professional_associations: [],
        primary_specialties: [],
        therapeutic_modalities: [],
        client_types_served: [],
        languages_spoken: [],
        password: '',
        password_confirmation: '',
        administrative_consent: false,
        consents_accepted: false,
    });

    // Transform data to exclude password fields if user already exists
    useEffect(() => {
        if (userEmail) {
            transform((data) => {
                const { password, password_confirmation, ...dataWithoutPassword } = data;
                return dataWithoutPassword;
            });
        }
    }, [userEmail, transform]);


    // Helper function to capitalize names (matching Create.tsx)
    const capitalizeName = (value: string): string => {
        if (!value.trim()) return value;
        return value.trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };

    // Helper functions for array fields
    const addArrayItem = (field: keyof PractitionerRegistrationForm, value: string) => {
        const currentArray = data[field] as string[];
        if (value && currentArray && !currentArray.includes(value)) {
            setData(field, [...currentArray, value] as any);
        }
    };

    const removeArrayItem = (field: keyof PractitionerRegistrationForm, index: number) => {
        const currentArray = data[field] as string[];
        if (currentArray) {
            setData(field, currentArray.filter((_, i) => i !== index) as any);
        }
    };

    const canGoToNextStep = () => {
        if (currentStep === 1) {
            return data.first_name && data.last_name && data.phone_number && data.title && data.extension;
        }
        if (currentStep === 2) {
            return data.license_number && data.years_of_experience && data.credentials.length > 0 &&
                   data.professional_associations.length > 0 && data.primary_specialties.length > 0 &&
                   data.therapeutic_modalities.length > 0 && data.client_types_served.length > 0 &&
                   data.languages_spoken.length > 0;
        }
        return true;
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/onboarding/practitioner/create');
    };

    return (
        <OnboardingLayout title="Create Practitioner Profile" className="items-start pt-2 pb-2" contentClassName="max-w-5xl">
                {/* Title Section */}
                <div className="text-center space-y-1 mb-2">
                    <div className="flex items-center justify-center gap-3 mb-1.5">
                        <User className="h-6 w-6 text-primary" />
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                            Create Your Practitioner Profile
                        </h1>
                    </div>
                    <p className="text-gray-600 text-lg font-medium">
                        Complete your registration to get started
                    </p>
                    {userEmail && (
                        <p className="text-sm text-gray-500 font-medium">
                            Registering as: <span className="text-gray-700">{userEmail}</span>
                        </p>
                    )}
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-3 mb-2">
                    <div className={`flex items-center transition-all duration-300 ${currentStep >= 1 ? 'text-primary' : 'text-gray-400'}`}>
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                            currentStep >= 1 
                                ? 'border-primary bg-primary text-white shadow-lg shadow-primary/30' 
                                : 'border-gray-300 bg-white'
                        }`}>
                            <span className="text-sm font-semibold">1</span>
                        </div>
                        <span className="ml-3 text-sm font-semibold hidden sm:inline">Personal Info</span>
                    </div>
                    <div className={`h-1 w-16 rounded-full transition-all duration-300 ${currentStep >= 2 ? 'bg-primary' : 'bg-gray-300'}`} />
                    <div className={`flex items-center transition-all duration-300 ${currentStep >= 2 ? 'text-primary' : 'text-gray-400'}`}>
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                            currentStep >= 2 
                                ? 'border-primary bg-primary text-white shadow-lg shadow-primary/30' 
                                : 'border-gray-300 bg-white'
                        }`}>
                            <span className="text-sm font-semibold">2</span>
                        </div>
                        <span className="ml-3 text-sm font-semibold hidden sm:inline">Professional Details</span>
                    </div>
                    <div className={`h-1 w-16 rounded-full transition-all duration-300 ${currentStep >= 3 ? 'bg-primary' : 'bg-gray-300'}`} />
                    <div className={`flex items-center transition-all duration-300 ${currentStep >= 3 ? 'text-primary' : 'text-gray-400'}`}>
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                            currentStep >= 3 
                                ? 'border-primary bg-primary text-white shadow-lg shadow-primary/30' 
                                : 'border-gray-300 bg-white'
                        }`}>
                            <span className="text-sm font-semibold">3</span>
                        </div>
                        <span className="ml-3 text-sm font-semibold hidden sm:inline">Consents</span>
                    </div>
                </div>

                {/* Registration Form */}
                <Card className="border-2 border-gray-200/50 shadow-2xl bg-white rounded-2xl overflow-hidden">
                    <form onSubmit={submit} className="px-4 pb-4 pt-2 space-y-3">
                        {/* Step 1: Personal Information */}
                        {currentStep === 1 && (
                            <div className="space-y-3">
                                <div className="pb-1">
                                    <div className="flex items-start gap-3">
                                        <div className="p-3 rounded-lg bg-primary/10 flex items-center self-stretch">
                                            <User className="h-6 w-6 text-primary" />
                                        </div>
                                        <div className="flex flex-col">
                                            <CardTitle className="text-2xl font-bold text-gray-900">
                                                Personal Information
                                            </CardTitle>
                                            <CardDescription className="text-sm text-gray-600">
                                                Tell us about yourself
                                            </CardDescription>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="first_name" className="text-sm font-semibold text-gray-700">
                                            First Name <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="first_name"
                                            value={data.first_name}
                                            onChange={(e) => {
                                                // Remove numbers and special characters except spaces, hyphens, apostrophes
                                                let value = e.target.value.replace(/[^A-Za-z\s\-\']/g, '');
                                                value = capitalizeName(value);
                                                setData('first_name', value);
                                            }}
                                            className={errors.first_name ? 'border-destructive' : ''}
                                            maxLength={50}
                                            required
                                        />
                                        <InputError message={errors.first_name} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="last_name" className="text-xs font-semibold text-gray-700">
                                            Last Name <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="last_name"
                                            value={data.last_name}
                                            onChange={(e) => {
                                                // Remove numbers and special characters except spaces, hyphens, apostrophes
                                                let value = e.target.value.replace(/[^A-Za-z\s\-\']/g, '');
                                                value = capitalizeName(value);
                                                setData('last_name', value);
                                            }}
                                            className={errors.last_name ? 'border-destructive' : ''}
                                            maxLength={50}
                                            required
                                        />
                                        <InputError message={errors.last_name} />
                                    </div>
                                </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="title" className="text-sm font-semibold text-gray-700">
                                            Title <span className="text-destructive">*</span>
                                        </Label>
                                        <Select value={data.title} onValueChange={(value) => setData('title', value)}>
                                            <SelectTrigger id="title" className={errors.title ? 'border-destructive' : ''}>
                                                <SelectValue placeholder="Select a title" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Dr.">Dr.</SelectItem>
                                                <SelectItem value="Mr.">Mr.</SelectItem>
                                                <SelectItem value="Ms.">Ms.</SelectItem>
                                                <SelectItem value="Mrs.">Mrs.</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <InputError message={errors.title} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone_number" className="text-sm font-semibold text-gray-700">
                                            Phone Number <span className="text-destructive">*</span>
                                        </Label>
                                        <PhoneInput
                                            id="phone_number"
                                            name="phone_number"
                                            placeholder="Enter phone number"
                                            value={data.phone_number || ""}
                                            onChange={(val) => setData("phone_number", (val as string) || "")}
                                            defaultCountry="CA"
                                            international
                                            countryCallingCodeEditable={false}
                                            className={errors.phone_number ? '[&_input]:border-destructive' : ''}
                                            maxLength={20}
                                        />
                                        <InputError message={errors.phone_number} />
                                    </div>
                                </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="extension" className="text-sm font-semibold text-gray-700">
                                            Extension <span className="text-destructive">*</span>
                                        </Label>
                                        <Select value={data.extension} onValueChange={(value) => setData('extension', value)}>
                                            <SelectTrigger id="extension" className={errors.extension ? 'border-destructive' : ''}>
                                                <SelectValue placeholder="Select Extension" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="101">101</SelectItem>
                                                <SelectItem value="102">102</SelectItem>
                                                <SelectItem value="103">103</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <InputError message={errors.extension} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="gender" className="text-sm font-semibold text-gray-700">
                                            Gender <span className="text-destructive">*</span>
                                        </Label>
                                        <Select value={data.gender} onValueChange={(value) => setData('gender', value)}>
                                            <SelectTrigger id="gender" className={errors.gender ? 'border-destructive' : ''}>
                                                <SelectValue placeholder="Select gender" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="male">Male</SelectItem>
                                                <SelectItem value="female">Female</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <InputError message={errors.gender} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="pronoun" className="text-sm font-semibold text-gray-700">
                                        Pronouns <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="pronoun"
                                        value={data.pronoun}
                                        onChange={(e) => {
                                            // Remove numbers and special characters except spaces, hyphens, apostrophes
                                            let value = e.target.value.replace(/[^A-Za-z\s\-\']/g, '');
                                            value = capitalizeName(value);
                                            setData('pronoun', value);
                                        }}
                                        placeholder="e.g., they/them, she/her, he/him"
                                        className={errors.pronoun ? 'border-destructive' : ''}
                                        maxLength={20}
                                    />
                                    <InputError message={errors.pronoun} />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="short_bio" className="text-sm font-semibold text-gray-700">Short Bio</Label>
                                    <Textarea
                                        id="short_bio"
                                        placeholder="Brief professional summary (e.g., Helping individuals process trauma and reclaim inner calm.)"
                                        value={data.short_bio}
                                        onChange={(e) => setData('short_bio', e.target.value)}
                                        className={errors.short_bio ? 'border-destructive' : ''}
                                        maxLength={255}
                                        rows={3}
                                    />
                                    <div className="flex justify-between items-center">
                                        {errors.short_bio && <InputError message={errors.short_bio} />}
                                        <p className="text-xs text-gray-500 ml-auto">{data.short_bio.length}/255 characters</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="full_bio" className="text-sm font-semibold text-gray-700">Full Bio</Label>
                                    <Textarea
                                        id="full_bio"
                                        placeholder="Comprehensive professional biography including experience, approach, specializations, and personal touch..."
                                        value={data.full_bio}
                                        onChange={(e) => setData('full_bio', e.target.value)}
                                        className={errors.full_bio ? 'border-destructive' : ''}
                                        maxLength={2000}
                                        rows={5}
                                    />
                                    <div className="flex justify-between items-center">
                                        {errors.full_bio && <InputError message={errors.full_bio} />}
                                        <p className="text-xs text-gray-500 ml-auto">{data.full_bio.length}/2000 characters</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                        {/* Step 2: Professional Details */}
                        {currentStep === 2 && (
                            <div className="space-y-3">
                                <div className="pb-1">
                                    <div className="flex items-start gap-3">
                                        <div className="p-3 rounded-lg bg-primary/10 flex items-center self-stretch">
                                            <Briefcase className="h-6 w-6 text-primary" />
                                        </div>
                                        <div className="flex flex-col">
                                            <CardTitle className="text-2xl font-bold text-gray-900">
                                                Professional Details
                                            </CardTitle>
                                            <CardDescription className="text-sm text-gray-600">
                                                Share your professional qualifications
                                            </CardDescription>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Credentials */}
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-gray-700">
                                            Credentials <span className="text-destructive">*</span>
                                        </Label>
                                        <Select onValueChange={(value) => addArrayItem('credentials', value)}>
                                            <SelectTrigger className={errors.credentials ? 'border-destructive' : ''}>
                                                <SelectValue placeholder="Select your credentials" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {CREDENTIALS.map(cred => (
                                                    <SelectItem key={cred} value={cred}>{cred}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="flex flex-wrap gap-2 mt-2 min-h-[32px]">
                                            {data.credentials.map((cred, index) => (
                                                <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 pr-1">
                                                    {cred}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeArrayItem('credentials', index)}
                                                        className="ml-2 text-blue-600 hover:text-blue-800 font-bold"
                                                    >
                                                        ×
                                                    </button>
                                                </Badge>
                                            ))}
                                            {data.credentials.length === 0 && (
                                                <span className="text-xs text-gray-400 py-2">No credentials selected</span>
                                            )}
                                        </div>
                                        <InputError message={errors.credentials} />
                                    </div>

                                    {/* Years of Experience */}
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-gray-700">
                                            Years of Experience <span className="text-destructive">*</span>
                                        </Label>
                                        <Select value={data.years_of_experience} onValueChange={(value) => setData('years_of_experience', value)}>
                                            <SelectTrigger className={errors.years_of_experience ? 'border-destructive' : ''}>
                                                <SelectValue placeholder="Select years of experience" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {YEARS_OF_EXPERIENCE.map(year => (
                                                    <SelectItem key={year} value={year}>{year}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError message={errors.years_of_experience} />
                                    </div>

                                    {/* License Number */}
                                    <div className="space-y-2">
                                        <Label htmlFor="license_number" className="text-sm font-semibold text-gray-700">
                                            License Number / Registration ID <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="license_number"
                                            value={data.license_number}
                                            onChange={(e) => setData('license_number', e.target.value)}
                                            placeholder="Enter license number or registration ID"
                                            className={errors.license_number ? 'border-destructive' : ''}
                                            maxLength={100}
                                            required
                                        />
                                        <InputError message={errors.license_number} />
                                    </div>

                                    {/* Professional Associations */}
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-gray-700">
                                            Professional Associations <span className="text-destructive">*</span>
                                        </Label>
                                        <Select onValueChange={(value) => addArrayItem('professional_associations', value)}>
                                            <SelectTrigger className={errors.professional_associations ? 'border-destructive' : ''}>
                                                <SelectValue placeholder="Select professional association" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {PROFESSIONAL_ASSOCIATIONS.map(assoc => (
                                                    <SelectItem key={assoc.value} value={assoc.value}>{assoc.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="flex flex-wrap gap-2 mt-2 min-h-[32px]">
                                            {data.professional_associations.map((assoc, index) => (
                                                <Badge key={index} variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200 pr-1">
                                                    {assoc}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeArrayItem('professional_associations', index)}
                                                        className="ml-2 text-green-600 hover:text-green-800 font-bold"
                                                    >
                                                        ×
                                                    </button>
                                                </Badge>
                                            ))}
                                            {data.professional_associations.length === 0 && (
                                                <span className="text-xs text-gray-400 py-2">No associations selected</span>
                                            )}
                                        </div>
                                        <InputError message={errors.professional_associations} />
                                    </div>
                                </div>

                                {/* Primary Specialties */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-700">
                                        Primary Specialties <span className="text-destructive">*</span>
                                    </Label>
                                    <Select onValueChange={(value) => addArrayItem('primary_specialties', value)}>
                                        <SelectTrigger className={errors.primary_specialties ? 'border-destructive' : ''}>
                                            <SelectValue placeholder="Select your specialties" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SPECIALTIES.map(spec => (
                                                <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="flex flex-wrap gap-2 mt-2 min-h-[32px]">
                                        {data.primary_specialties.map((spec, index) => (
                                            <Badge key={index} variant="secondary" className="bg-purple-100 text-purple-800 hover:bg-purple-200 pr-1">
                                                {spec}
                                                <button
                                                    type="button"
                                                    onClick={() => removeArrayItem('primary_specialties', index)}
                                                    className="ml-2 text-purple-600 hover:text-purple-800 font-bold"
                                                >
                                                    ×
                                                </button>
                                            </Badge>
                                        ))}
                                        {data.primary_specialties.length === 0 && (
                                            <span className="text-xs text-gray-400 py-2">No specialties selected</span>
                                        )}
                                    </div>
                                    <InputError message={errors.primary_specialties} />
                                </div>

                                {/* Therapeutic Modalities */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-700">
                                        Therapeutic Modalities <span className="text-destructive">*</span>
                                    </Label>
                                    <Select onValueChange={(value) => addArrayItem('therapeutic_modalities', value)}>
                                        <SelectTrigger className={errors.therapeutic_modalities ? 'border-destructive' : ''}>
                                            <SelectValue placeholder="Select your modalities" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {THERAPEUTIC_MODALITIES.map(mod => (
                                                <SelectItem key={mod} value={mod}>{mod}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="flex flex-wrap gap-2 mt-2 min-h-[32px]">
                                        {data.therapeutic_modalities.map((mod, index) => (
                                            <Badge key={index} variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-200 pr-1">
                                                {mod}
                                                <button
                                                    type="button"
                                                    onClick={() => removeArrayItem('therapeutic_modalities', index)}
                                                    className="ml-2 text-orange-600 hover:text-orange-800 font-bold"
                                                >
                                                    ×
                                                </button>
                                            </Badge>
                                        ))}
                                        {data.therapeutic_modalities.length === 0 && (
                                            <span className="text-xs text-gray-400 py-2">No modalities selected</span>
                                        )}
                                    </div>
                                    <InputError message={errors.therapeutic_modalities} />
                                </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Client Types Served */}
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-gray-700">
                                            Client Types Served <span className="text-destructive">*</span>
                                        </Label>
                                        <Select onValueChange={(value) => addArrayItem('client_types_served', value)}>
                                            <SelectTrigger className={errors.client_types_served ? 'border-destructive' : ''}>
                                                <SelectValue placeholder="Select client types" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {CLIENT_TYPES.map(type => (
                                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="flex flex-wrap gap-2 mt-2 min-h-[32px]">
                                            {data.client_types_served.map((type, index) => (
                                                <Badge key={index} variant="secondary" className="bg-pink-100 text-pink-800 hover:bg-pink-200 pr-1">
                                                    {type}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeArrayItem('client_types_served', index)}
                                                        className="ml-2 text-pink-600 hover:text-pink-800 font-bold"
                                                    >
                                                        ×
                                                    </button>
                                                </Badge>
                                            ))}
                                            {data.client_types_served.length === 0 && (
                                                <span className="text-xs text-gray-400 py-2">No client types selected</span>
                                            )}
                                        </div>
                                        <InputError message={errors.client_types_served} />
                                    </div>

                                    {/* Languages Spoken */}
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-gray-700">
                                            Languages Spoken <span className="text-destructive">*</span>
                                        </Label>
                                        <Select onValueChange={(value) => addArrayItem('languages_spoken', value)}>
                                            <SelectTrigger className={errors.languages_spoken ? 'border-destructive' : ''}>
                                                <SelectValue placeholder="Select languages" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {LANGUAGES.map(lang => (
                                                    <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="flex flex-wrap gap-2 mt-2 min-h-[32px]">
                                            {data.languages_spoken.map((lang, index) => (
                                                <Badge key={index} variant="secondary" className="bg-teal-100 text-teal-800 hover:bg-teal-200 pr-1">
                                                    {lang}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeArrayItem('languages_spoken', index)}
                                                        className="ml-2 text-teal-600 hover:text-teal-800 font-bold"
                                                    >
                                                        ×
                                                    </button>
                                                </Badge>
                                            ))}
                                            {data.languages_spoken.length === 0 && (
                                                <span className="text-xs text-gray-400 py-2">No languages selected</span>
                                            )}
                                        </div>
                                        <InputError message={errors.languages_spoken} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                        {/* Step 3: Consents */}
                        {currentStep === 3 && (
                            <div className="space-y-3">
                                <div className="pb-1">
                                    <div className="flex items-start gap-3">
                                        <div className="p-3 rounded-lg bg-primary/10 flex items-center self-stretch">
                                            <Shield className="h-6 w-6 text-primary" />
                                        </div>
                                        <div className="flex flex-col">
                                            <CardTitle className="text-2xl font-bold text-gray-900">
                                                Account Setup & Consents
                                            </CardTitle>
                                            <CardDescription className="text-sm text-gray-600">
                                                {userEmail ? 'Accept required consents to complete your practitioner profile' : 'Create your account password and accept required consents'}
                                            </CardDescription>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                {/* Password fields - only show if user doesn't exist */}
                                {!userEmail && (
                                    <div className="space-y-4 pb-6 border-b border-gray-200">
                                        <h3 className="text-lg font-semibold text-gray-900">Account Password</h3>
                                        <div className="space-y-2">
                                            <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                                                Password <span className="text-destructive">*</span>
                                            </Label>
                                            <div className="relative">
                                                <Input
                                                    id="password"
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={data.password || ''}
                                                    onChange={(e) => setData('password', e.target.value)}
                                                    className={errors.password ? 'border-destructive' : ''}
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                                                >
                                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                                </button>
                                            </div>
                                            <InputError message={errors.password} />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="password_confirmation" className="text-sm font-semibold text-gray-700">
                                                Confirm Password <span className="text-destructive">*</span>
                                            </Label>
                                            <div className="relative">
                                                <Input
                                                    id="password_confirmation"
                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                    value={data.password_confirmation || ''}
                                                    onChange={(e) => setData('password_confirmation', e.target.value)}
                                                    className={errors.password_confirmation ? 'border-destructive' : ''}
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                                                >
                                                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                                </button>
                                            </div>
                                            <InputError message={errors.password_confirmation} />
                                        </div>
                                    </div>
                                )}
                                {/* Dynamic Consents from Database */}
                                {consents.map((consent, index) => (
                                    <div key={consent.id}>
                                        {index > 0 && <div className="border-t border-gray-200" />}
                                        <div className="space-y-3">
                                            <h3 className="text-lg font-semibold text-gray-900">{consent.title}</h3>
                                            {consent.consent_body?.description && (
                                                <p className="text-sm text-gray-600">{consent.consent_body.description}</p>
                                            )}
                                            {consent.consent_body?.content && (
                                                <div className="text-sm text-gray-700 leading-relaxed"
                                                     dangerouslySetInnerHTML={{ __html: consent.consent_body.content }} />
                                            )}
                                            {consent.consent_body?.important_notice && (
                                                <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                                                    <p className="text-sm text-amber-900 font-medium">
                                                        {consent.consent_body.important_notice}
                                                    </p>
                                                </div>
                                            )}
                                            {consent.consent_body?.legal_principle && (
                                                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                                    <p className="text-sm text-blue-900 font-medium">
                                                        {consent.consent_body.legal_principle}
                                                    </p>
                                                </div>
                                            )}
                                            {consent.consent_body?.security_notice && (
                                                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                                                    <p className="text-sm text-red-900 font-medium">
                                                        {consent.consent_body.security_notice}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Practitioner's Oath of Confidentiality */}
                                {/* <div className="space-y-3">
                                    <h3 className="text-lg font-semibold text-gray-900">Practitioner's Oath of Confidentiality</h3>
                                    <p className="text-sm text-gray-600">Required for Dashboard Access</p>
                                    <p className="text-sm text-gray-700 leading-relaxed">
                                        I agree to uphold the Wellovis Practitioner's Oath of Confidentiality. I confirm that I understand my role as a Health Information Custodian (HIC) or Agent thereof, and I commit to maintaining the strictest privacy and security of all patient data (PHI). I will use and disclose patient information only for the purpose of treatment, payment, or as explicitly permitted by applicable Canadian privacy laws (e.g., PIPEDA, PHIPA). I agree to implement all necessary safeguards and immediately report any known or suspected privacy breach.
                                    </p>
                                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                                        <p className="text-sm text-amber-900 font-medium">
                                            As a healthcare practitioner, you will have access to sensitive patient information. This oath is legally binding and required for your access to the Wellovis EMR platform.
                                        </p>
                                    </div>
                                </div> */}

                                <div className="border-t border-gray-200" />


                                {/* Single Acceptance Checkbox */}
                                <div className="flex items-start space-x-2 bg-blue-50 border border-blue-200 rounded-md p-4">
                                    <Checkbox
                                        id="consents_accepted"
                                        checked={data.consents_accepted}
                                        onCheckedChange={(checked) => setData('consents_accepted', checked as boolean)}
                                        className={errors.consents_accepted ? 'border-destructive' : ''}
                                    />
                                    <div className="grid gap-1.5 leading-none">
                                        <Label htmlFor="consents_accepted" className="text-sm font-semibold leading-snug cursor-pointer text-blue-900">
                                            I have read and accept all {consents.length} required consent{consents.length !== 1 ? 's' : ''} listed above.
                                            <span className="text-destructive ml-1">*</span>
                                        </Label>
                                        <InputError message={errors.consents_accepted} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                        {/* Navigation Buttons */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                        {currentStep > 1 && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCurrentStep(currentStep - 1)}
                                disabled={processing}
                                className="px-8 py-2.5 font-semibold transition-all duration-200 hover:bg-gray-50"
                            >
                                Previous
                            </Button>
                        )}
                        {currentStep < 3 ? (
                            <Button
                                type="button"
                                onClick={() => setCurrentStep(currentStep + 1)}
                                disabled={!canGoToNextStep()}
                                className={`ml-auto px-8 py-2.5 font-semibold transition-all duration-200 ${
                                    !canGoToNextStep() 
                                        ? 'opacity-50 cursor-not-allowed' 
                                        : 'hover:shadow-lg hover:scale-105'
                                }`}
                            >
                                Next
                            </Button>
                        ) : (
                            <Button
                                type="submit"
                                disabled={processing || !data.consents_accepted || (!userEmail && (!data.password || !data.password_confirmation))}
                                className={`ml-auto px-8 py-2.5 font-semibold transition-all duration-200 ${
                                    processing || !data.consents_accepted || (!userEmail && (!data.password || !data.password_confirmation))
                                        ? 'opacity-50 cursor-not-allowed' 
                                        : 'hover:shadow-lg hover:scale-105'
                                }`}
                            >
                                {processing ? (
                                    <>
                                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                        Creating Account...
                                    </>
                                ) : (
                                    'Complete Registration'
                                )}
                            </Button>
                        )}
                        </div>
                    </form>
                </Card>
        </OnboardingLayout>
    );
}