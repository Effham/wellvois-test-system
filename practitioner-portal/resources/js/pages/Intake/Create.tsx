import React, { useState, useEffect, useRef } from 'react';
import { Head, useForm, usePage, router } from '@inertiajs/react';
import { withAppLayout } from '@/utils/layout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Search, Users, Info, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import axios from 'axios';
import { useS3Upload } from '@/hooks/use-s3-upload';
import { useEnhancedZodValidation } from '@/hooks/useEnhancedZodValidation';
import {  intakeSchema } from '@/lib/validations';
import { PhoneInput } from '@/components/phone-input';


interface IntakeFormData {
    // Client Information fields
    health_number: string;
    first_name: string;
    last_name: string;
    preferred_name: string;
    phone_number: string;
    email_address: string;
    gender_pronouns: string;
    client_type: string;
    date_of_birth: string;
    emergency_contact_phone: string;
    address_lookup: string;
    street_address: string;
    apt_suite_unit: string;
    city: string;
    postal_zip_code: string;
    province: string;
    // Health & Clinical History fields
    presenting_concern: string;
    goals_for_therapy: string;
    previous_therapy_experience: string;
    current_medications: string;
    diagnoses: string;
    history_of_hospitalization: string;
    risk_safety_concerns: string;
    other_medical_conditions: string;
    cultural_religious_considerations: string;
    accessibility_needs: string;
    // Insurance & Legal fields
    insurance_provider: string;
    policy_number: string;
    coverage_card_path: string;
    consent_to_treatment: boolean;
    consent_to_data_storage: boolean;
    privacy_policy_acknowledged: boolean;
    // Preferences fields
    language_preferences: string;
    best_time_to_contact: string;
    best_way_to_contact: string;
    consent_to_receive_reminders: boolean;
    // Family Medical History fields
    family_medical_histories: Array<{
        relationship_to_patient: string;
        summary: string;
        details: string;
        diagnosis_date: string;
    }>;
    // Patient Medical History fields
    patient_medical_histories: Array<{
        disease: string;
        recent_tests: string;
    }>;
    // Known Allergies fields
    known_allergies: Array<{
        allergens: string;
        type: string;
        severity: string;
        reaction: string;
        notes: string;
    }>;
    // Redirect source field
    redirect_source: string;
    // Index signature for FormDataType compatibility
    [key: string]: string | boolean | File | null | Array<any>;
}

function CreateIntake() {
    const { flash, activeTab: backendActiveTab, initialHealthNumber, redirectSource, existingData }: any = usePage().props;
    const [activeTab, setActiveTab] = useState(backendActiveTab || 'client-info');
    const [completedTabs, setCompletedTabs] = useState<string[]>([]);
    const [readonlyTabs, setReadonlyTabs] = useState<string[]>([]);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const { validate, validateFieldOnBlur, clearFieldError, getFieldError: getZodFieldError } = useEnhancedZodValidation(intakeSchema);
    const hasLoadedData = useRef(false);

    // Fetch data using partial reload when existingData is null
    useEffect(() => {
        // Prevent infinite loop: only load once and only if we have URL params
        if (existingData === null && !hasLoadedData.current) {
            const urlParams = new URLSearchParams(window.location.search);
            const hasParams = urlParams.toString().length > 0;

            // Only trigger if we have URL params (like patient_id) to load
            if (hasParams) {
                hasLoadedData.current = true;
                const params: any = {};
                urlParams.forEach((value, key) => {
                    params[key] = value;
                });

                router.reload({
                    only: ['existingData'],
                    data: params,
                    onError: (errors) => {
                        console.error('Failed to load intake data:', errors);
                        toast.error('Failed to load intake data', {
                            description: 'Please refresh the page to try again.',
                        });
                        hasLoadedData.current = false; // Reset on error to allow retry
                    },
                });
            } else {
                // No params, mark as loaded to prevent re-triggering
                hasLoadedData.current = true;
            }
        }
    }, [existingData]);
    

    const { uploadFile } = useS3Upload();
    const [uploadingCoverageCard, setUploadingCoverageCard] = useState(false);
    const [coverageCardFile, setCoverageCardFile] = useState<File | null>(null);
    const [coverageCardPreview, setCoverageCardPreview] = useState<string | null>(null);

    const { data, setData, post, processing, errors, reset } = useForm<Record<string, any>>({
        // Client Information fields
        health_number: initialHealthNumber || '',
        first_name: '',
        last_name: '',
        preferred_name: '',
        phone_number: '',
        email_address: '',
        gender_pronouns: '',
        client_type: '',
        date_of_birth: '',
        emergency_contact_phone: '',
        address_lookup: '',
        street_address: '',
        apt_suite_unit: '',
        city: '',
        postal_zip_code: '',
        province: '',
        // Health & Clinical History fields
        presenting_concern: '',
        goals_for_therapy: '',
        previous_therapy_experience: '',
        current_medications: '',
        diagnoses: '',
        history_of_hospitalization: '',
        risk_safety_concerns: '',
        other_medical_conditions: '',
        cultural_religious_considerations: '',
        accessibility_needs: '',
        // Insurance & Legal fields
        insurance_provider: '',
        policy_number: '',
        coverage_card_path: '',
        consent_to_treatment: false,
        consent_to_data_storage: false,
        privacy_policy_acknowledged: false,
        // Preferences fields
        language_preferences: '',
        best_time_to_contact: '',
        best_way_to_contact: '',
        consent_to_receive_reminders: false,
        // Family Medical History fields
        family_medical_histories: [],
        // Patient Medical History fields
        patient_medical_histories: [],
        // Known Allergies fields
        known_allergies: [],
        // Redirect source
        redirect_source: redirectSource || '',
    });

    // Switch to error tab if there are validation errors
    useEffect(() => {
        if (backendActiveTab && Object.keys(errors).length > 0) {
            setActiveTab(backendActiveTab);
        }
    }, [backendActiveTab, errors]);

    // Helper to get error message for a field (combines zod and backend errors)
    const getFieldError = (fieldName: string): string | undefined => {
        return getZodFieldError(fieldName) || errors[fieldName as keyof typeof errors];
    };

    // Helper function to capitalize names automatically
    const capitalizeName = (value: string): string => {
        if (!value.trim()) return value;
        return value.trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };

    // Helper function to handle field changes with automatic capitalization for name fields
    const handleFieldChange = (fieldName: string, value: string) => {
        let processedValue = value;
        
        // Apply automatic capitalization for name fields
        if (['first_name', 'last_name', 'preferred_name'].includes(fieldName)) {
            // Remove numbers and special characters except spaces, hyphens, and apostrophes
            processedValue = value.replace(/[^A-Za-z\s\-\']/g, '');
            processedValue = capitalizeName(processedValue);
        }
        
        setData(fieldName, processedValue);
        
        // Clear field error when user starts typing
        if (getFieldError(fieldName)) {
            clearFieldError(fieldName);
        }
    };

    // Helper function to handle onBlur validation
    const handleFieldBlur = (fieldName: string, value: string) => {
        validateFieldOnBlur(fieldName, value);
    };

    // Tab to field mapping for validation
    const tabFieldMapping = {
        'client-info': [
            'health_number', 'first_name', 'last_name', 'preferred_name',
            'phone_number', 'email_address', 'gender_pronouns', 'client_type',
            'date_of_birth', 'emergency_contact_phone', 'address_lookup',
            'street_address', 'apt_suite_unit', 'city', 'postal_zip_code', 'province'
        ],
        'health-clinical': [
            'presenting_concern', 'goals_for_therapy', 'previous_therapy_experience',
            'current_medications', 'diagnoses', 'history_of_hospitalization',
            'risk_safety_concerns', 'other_medical_conditions',
            'cultural_religious_considerations', 'accessibility_needs'
        ],
        'insurance-legal': [
            'insurance_provider', 'policy_number', 'coverage_card',
            'consent_to_treatment', 'consent_to_data_storage', 'privacy_policy_acknowledged'
        ],
        'preferences': [
            'language_preferences', 'best_time_to_contact', 'best_way_to_contact',
            'consent_to_receive_reminders'
        ],
        'family-medical': [
            'family_medical_histories'
        ],
        'patient-medical': [
            'patient_medical_histories'
        ],
        'known-allergies': [
            'known_allergies'
        ]
    };

    // Helper function to check if a tab has errors
    const getTabErrors = (tabName: string) => {
        const fields = tabFieldMapping[tabName as keyof typeof tabFieldMapping] || [];
        return fields.some(field => errors[field as keyof typeof errors]);
    };


    // Validation functions for each tab


    const validateTabWithZod = (tabName: string): boolean => {
    const fieldsToValidate = tabFieldMapping[tabName as keyof typeof tabFieldMapping] || [];
    
    if (fieldsToValidate.length === 0) return true;
    
    // Extract data for this tab's fields
    const tabData = Object.fromEntries(
        fieldsToValidate.map(field => [field, data[field as keyof typeof data]])
    );
    
    // Use Zod validation to check if fields are valid
    try {
        const validationResult = intakeSchema.pick(
            Object.fromEntries(fieldsToValidate.map(f => [f, true]))
        ).safeParse(tabData);
        
        // Also check for any existing validation errors from backend or Zod
        const hasValidationErrors = fieldsToValidate.some(field => getFieldError(field));
        
        return validationResult.success && !hasValidationErrors;
    } catch (error) {
        console.error('[Intake Form] Zod validation error:', error);
        return false;
    }
};

const validateClientInfo = () => {
    const requiredFields = [
        'health_number', 'first_name', 'last_name', 'phone_number', 
        'email_address', 'client_type', 'date_of_birth', 'emergency_contact_phone', 
        'street_address', 'city', 'postal_zip_code', 'province'
    ];
    
    // Check if all required fields have values
    const allFieldsFilled = requiredFields.every(field => {
        const value = data[field as keyof typeof data];
        return value && String(value).trim() !== '';
    });

    if (!allFieldsFilled) return false;

    // Validate through Zod schema
    return validateTabWithZod('client-info');
};

const validateHealthClinical = () => {
    // Health & Clinical tab is optional but validate if filled
    // return validateTabWithZod('health-clinical');
    return true;
};

const validateInsuranceLegal = () => {
    // Insurance fields are optional but validate if filled
    // return validateTabWithZod('insurance-legal');
    return true;

};

const validatePreferences = () => {
    // Preferences tab - validate through Zod
    // return validateTabWithZod('preferences');
    return true;

};

const validateFamilyMedical = () => {
    // Family medical history is optional - return true if empty or if all entries have required fields
    if (data.family_medical_histories.length === 0) return true;
    
    const allEntriesValid = data.family_medical_histories.every((history: any) => 
        history.relationship_to_patient?.trim() !== '' && history.summary?.trim() !== ''
    );
    
    if (!allEntriesValid) return false;
    
    return validateTabWithZod('family-medical');
};

const validatePatientMedical = () => {
    // Patient medical history is optional - return true if empty or if all entries have required fields
    if (data.patient_medical_histories.length === 0) return true;
    
    const allEntriesValid = data.patient_medical_histories.every((history: any) => 
        history.disease?.trim() !== ''
    );
    
    if (!allEntriesValid) return false;
    
    return validateTabWithZod('patient-medical');
};

   const validateKnownAllergies = () => {
    // Known allergies is optional - return true if empty or if all entries have required fields
    if (data.known_allergies.length === 0) return true;
    
    const allEntriesValid = data.known_allergies.every((allergy: any) => 
        allergy.allergens?.trim() !== '' && 
        allergy.type?.trim() !== '' && 
        allergy.severity?.trim() !== ''
    );
    
    if (!allEntriesValid) return false;
    
    return validateTabWithZod('known-allergies');
};

    // Check if all tabs are valid
    const isFormComplete = () => {
        return validateClientInfo() && validateHealthClinical() && validateInsuranceLegal() && 
               validatePreferences() && validateFamilyMedical() && validatePatientMedical() && validateKnownAllergies();
    };

    // Handle tab change with validation
    const handleTabChange = (newTab: string) => {
        console.log('[Intake Form] handleTabChange called:', {
            currentTab: activeTab,
            newTab: newTab,
            readonlyTabs: readonlyTabs
        });

        // Don't allow navigation away from readonly tabs
        if (readonlyTabs.includes(activeTab)) {
            console.log('[Intake Form] Navigation blocked - current tab is readonly');
            return;
        }

        // Get fields for current tab
        const fieldsToValidate = tabFieldMapping[activeTab as keyof typeof tabFieldMapping] || [];

        // Skip validation if no fields to validate
        if (fieldsToValidate.length === 0) {
            setActiveTab(newTab);
            return;
        }

        // Skip Zod validation during tab navigation
        // The schema expects ALL required fields, but we're only validating one tab at a time
        // This causes false validation failures. Instead, rely on simple field validation.
        // Zod validation will run on final form submission (handleSubmit)
        console.log('[Intake Form] Skipping Zod validation during tab navigation (will validate on submit)');

        // Clear field errors for this tab
        fieldsToValidate.forEach(field => {
            clearFieldError(field);
        });

        // Mark current tab as completed
        if (!completedTabs.includes(activeTab)) {
            setCompletedTabs(prev => [...prev, activeTab]);
        }

        // Mark certain tabs as readonly after completion
        if (['family-medical', 'patient-medical', 'known-allergies'].includes(activeTab)) {
            if (!readonlyTabs.includes(activeTab)) {
                setReadonlyTabs(prev => [...prev, activeTab]);
            }
        }


        // Allow navigation
        console.log('[Intake Form] Setting active tab to:', newTab);
        setActiveTab(newTab);
    };

    // Get current tab validation status
    const getCurrentTabValidation = () => {
    let result = false;
    switch (activeTab) {
        case 'client-info':
            result = validateClientInfo();
            break;
        case 'health-clinical':
            result = validateHealthClinical();
            break;
        case 'insurance-legal':
            result = validateInsuranceLegal();
            break;
        case 'preferences':
            result = validatePreferences();
            break;
        case 'family-medical':
            result = validateFamilyMedical();
            break;
        case 'patient-medical':
            result = validatePatientMedical();
            break;
        case 'known-allergies':
            result = validateKnownAllergies();
            break;
        default:
            result = false;
    }

    console.log('[Intake Form] Zod validation for', activeTab, '=', result);
    return result;
};

    // Get next tab
    const getNextTab = () => {
        const tabs = ['client-info', 'health-clinical', 'insurance-legal', 'family-medical', 'patient-medical', 'known-allergies', 'preferences'];
        const currentIndex = tabs.indexOf(activeTab);
        return currentIndex < tabs.length - 1 ? tabs[currentIndex + 1] : null;
    };

    // Get previous tab
    const getPreviousTab = () => {
        const tabs = ['client-info', 'health-clinical', 'insurance-legal', 'family-medical', 'patient-medical', 'known-allergies', 'preferences'];
        const currentIndex = tabs.indexOf(activeTab);
        return currentIndex > 0 ? tabs[currentIndex - 1] : null;
    };

    // Keys you want to validate (ONLY these)
const SELECTED_FIELDS = [
  'province',
  'postal_zip_code',
  'city',
  'apt_suite_unit',
  'street_address',
  'address_lookup',
  'emergency_contact_phone',
  'date_of_birth',
  'client_type',
  'gender_pronouns',
  'email_address',
  'phone_number',
  'preferred_name',
  'last_name',
  'first_name',
  'health_number',
] as const;

type SelectedField = typeof SELECTED_FIELDS[number];


/**
 * Validate ONLY the selected fields.
 * - Runs each field's blur validation
 * - Returns true if all selected fields are valid
 * - Optionally clears errors for all *other* fields if clearOthers=true
 */


// --- Example usage ---
// const isCoreInfoValid = validateOnlySelectedFields(data);
// if (!isCoreInfoValid) { /* show a toast, scroll to first error, etc. */ }

    function validateOnlySelectedFields(
  data: Record<string, unknown>,
  options?: { clearOthers?: boolean }
): boolean {
  // 1) Validate each selected field using your existing blur validator
  for (const key of SELECTED_FIELDS) {
    const value = data?.[key];
    // cast to string if your blur validator expects string input; tweak as needed
    validateFieldOnBlur(key, (value ?? '') as string);
  }

  // 2) Optionally clear non-selected field errors
  if (options?.clearOthers) {
    Object.keys(data || {}).forEach((k) => {
      if (!SELECTED_FIELDS.includes(k as SelectedField)) {
        clearFieldError(k);
      }
    });
  }

  // 3) Determine validity for ONLY the selected fields
  const allValid = SELECTED_FIELDS.every((key) => !getZodFieldError(key));
  return allValid;
}


// Keep your existing hook + helper from before
// const { validateFieldOnBlur, clearFieldError, getFieldError: getZodFieldError } = useEnhancedZodValidation(intakeSchema);
// const getFieldError = (field: string) => getZodFieldError(field);

// same SELECTED_FIELDS & validateOnlySelectedFields(...) as provided earlier

// Optional: order to check/focus when invalid
const FIELD_ORDER: SelectedField[] = [
  'first_name',
  'last_name',
  'preferred_name',
  'email_address',
  'phone_number',
  'gender_pronouns',
  'client_type',
  'date_of_birth',
  'health_number',
  'street_address',
  'apt_suite_unit',
  'city',
  'province',
  'postal_zip_code',
  'address_lookup',
  'emergency_contact_phone',
];

// Click handler for your Next button
const handleValidateThenNext = () => {
  const isValid = validateOnlySelectedFields(data);
  if (isValid) {
    handleNext();
    return;
  }

  // OPTIONAL: focus & scroll to the first invalid field
  const firstInvalid = FIELD_ORDER.find((f) => getFieldError(f));
  if (firstInvalid) {
    const el = document.getElementById(firstInvalid);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el as HTMLElement).focus?.();
    }
  }
};

    // Handle next button click
    const handleNext = () => {
        const nextTab = getNextTab();
        const validationResult = getCurrentTabValidation();

        console.log('[Intake Form] Next button clicked:', {
            currentTab: activeTab,
            nextTab: nextTab,
            validationResult: validationResult,
            hasNextTab: !!nextTab
        });

        if (nextTab && validationResult) {
            console.log('[Intake Form] Navigating to:', nextTab);
            handleTabChange(nextTab);
        } else {
            console.log('[Intake Form] Navigation blocked:', {
                reason: !nextTab ? 'No next tab' : 'Validation failed'
            });
        }
    };

    // Handle previous button click
    const handlePrevious = () => {
        const previousTab = getPreviousTab();
        if (previousTab) {
            handleTabChange(previousTab);
        }
    };

    // Handle coverage card file selection
    const handleCoverageCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
            if (!allowedTypes.includes(file.type)) {
                toast.error('Invalid file type', {
                    description: 'Please select a PDF, JPG, or PNG file'
                });
                return;
            }

            // Validate file size (5MB limit)
            if (file.size > 5 * 1024 * 1024) {
                toast.error('File too large', {
                    description: 'File size must be less than 5MB'
                });
                return;
            }

            setCoverageCardFile(file);
            setData('coverage_card', file);

            // Create preview for images
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => setCoverageCardPreview(e.target?.result as string);
                reader.readAsDataURL(file);
            } else {
                // For PDFs, show file name
                setCoverageCardPreview(null);
            }

            toast.success('File selected', {
                description: 'Coverage card will be uploaded when you submit'
            });
        }
    };

    // Upload coverage card to S3
    const uploadCoverageCardToS3 = async (): Promise<string | null> => {
        if (!coverageCardFile) return null;

        setUploadingCoverageCard(true);
        try {
            const s3Key = `patients/coverage-cards/${Date.now()}_${coverageCardFile.name}`;

            const response = await uploadFile(coverageCardFile, {
                key: s3Key,
                expiresMinutes: 1440,
            });

            // Store the S3 key - will be used when submitting form
            setData('coverage_card_path', response.key);
            console.log('[S3 Upload] Coverage card uploaded:', {
                key: response.key,
                signedUrl: response.signed_url
            });
            setUploadingCoverageCard(false);
            return response.key; // Return the key for immediate use
        } catch (error) {
            console.error('[S3 Upload] Coverage card upload failed:', error);
            setUploadingCoverageCard(false);
            toast.error('File Upload Failed', {
                description: `Failed to upload coverage card: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
            return null;
        }
    };

    // Show confirmation dialog before submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isFormComplete()) {
            alert('Please complete all required fields in all tabs before submitting.');
            return;
        }

        // Upload coverage card to S3 first if file exists
        const uploadedKey = await uploadCoverageCardToS3();
        if (coverageCardFile && !uploadedKey) {
            console.error('[Form Submit] Coverage card upload failed, aborting submission');
            return;
        }

        // Prepare submission data with S3 key
        const submissionData = {
            ...data,
            coverage_card_path: uploadedKey || data.coverage_card_path
        };

        console.log('[Form Submit] Preparing submission:', {
            uploadedKey: uploadedKey,
            data_coverage_card_path: data.coverage_card_path,
            final_coverage_card_path: submissionData.coverage_card_path,
            has_insurance: !!data.insurance_provider,
            timestamp: new Date().toISOString()
        });

        router.post(route('intake.store'), submissionData, {
            onSuccess: () => {
                // Show success toast
                toast.success('Patient intake completed successfully!', {
                    description: 'Patient has been added to your organization.'
                });

                // Reload the page to reset everything
                setTimeout(() => {
                    window.location.reload();
                }, 1000); // Small delay to show the toast
            },
            onError: (errors) => {
                console.error('Intake submission errors:', errors);

                // Handle errors gracefully with toast
                if (errors.message) {
                    toast.error('Unable to create patient', {
                        description: errors.message
                    });
                } else {
                    toast.error('Unable to create patient', {
                        description: 'Please check the form for errors and try again.'
                    });
                }
            }
        });
    };

    const previousTherapyOptions = [
        { value: 'none', label: 'No previous therapy' },
        { value: 'individual', label: 'Individual therapy' },
        { value: 'group', label: 'Group therapy' },
        { value: 'couples', label: 'Couples therapy' },
        { value: 'family', label: 'Family therapy' },
        { value: 'other', label: 'Other' },
    ];

    const languageOptions = [
        { value: 'english', label: 'English' },
        { value: 'french', label: 'French' },
        { value: 'spanish', label: 'Spanish' },
        { value: 'mandarin', label: 'Mandarin' },
        { value: 'other', label: 'Other' },
    ];

    const bestTimeOptions = [
        { value: 'morning', label: 'Morning (9AM - 12PM)' },
        { value: 'afternoon', label: 'Afternoon (12PM - 5PM)' },
        { value: 'evening', label: 'Evening (5PM - 8PM)' },
        { value: 'weekends', label: 'Weekends' },
    ];

    const bestWayOptions = [
        { value: 'phone', label: 'Phone Call' },
        { value: 'email', label: 'Email' },
        { value: 'sms', label: 'SMS/Text' },
        { value: 'patient-portal', label: 'Patient Portal' },
    ];

    const clientTypeOptions = [
        { value: 'individual', label: 'Individual' },
        { value: 'couple', label: 'Couple' },
        { value: 'family', label: 'Family' },
        { value: 'group', label: 'Group' },
    ];

    const cityOptions = [
        { value: 'toronto', label: 'Toronto' },
        { value: 'vancouver', label: 'Vancouver' },
        { value: 'montreal', label: 'Montreal' },
        { value: 'calgary', label: 'Calgary' },
        { value: 'ottawa', label: 'Ottawa' },
        { value: 'other', label: 'Other' },
    ];

    const provinceOptions = [
        { value: 'on', label: 'Ontario' },
        { value: 'bc', label: 'British Columbia' },
        { value: 'ab', label: 'Alberta' },
        { value: 'qc', label: 'Quebec' },
        { value: 'ns', label: 'Nova Scotia' },
        { value: 'nb', label: 'New Brunswick' },
        { value: 'mb', label: 'Manitoba' },
        { value: 'sk', label: 'Saskatchewan' },
        { value: 'pe', label: 'Prince Edward Island' },
        { value: 'nl', label: 'Newfoundland and Labrador' },
        { value: 'nt', label: 'Northwest Territories' },
        { value: 'nu', label: 'Nunavut' },
        { value: 'yt', label: 'Yukon' },
    ];

    return (
        <>
            <Head title="New Intake" />
            
            <div className="px-4 py-6">
                <div className="w-full">
                    {/* Container with proper responsive height */}
                    <div 
                        className="bg-white rounded-lg p-6 w-full min-h-[600px]"
                    >
                        {/* Header */}
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-gray-900">New Intake</h1>
                        </div>

                        {/* Success/Error Messages */}
                        {flash?.success && (
                            <Alert className="border-green-400 bg-green-50 mb-6">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <AlertTitle className="text-green-700">Success</AlertTitle>
                                <AlertDescription className="text-green-600">
                                    {flash.success}
                                </AlertDescription>
                            </Alert>
                        )}

                        {flash?.error && (
                            <Alert className="border-red-400 bg-red-50 mb-6">
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <AlertTitle className="text-red-700">Error</AlertTitle>
                                <AlertDescription className="text-red-600">{flash.error}</AlertDescription>
                            </Alert>
                        )}

                        {/* Tabs */}
                        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col">
                            <TabsList className="mb-6 grid grid-cols-7 w-full">
                                <TabsTrigger 
                                    value="client-info" 
                                    className={
                                        getTabErrors('client-info') ? 'bg-red-100 text-red-800 border-red-300' :
                                        completedTabs.includes('client-info') ? 'bg-green-100 text-green-800' : ''
                                    }
                                >
                                    Client Information {getTabErrors('client-info') ? '⚠️' : completedTabs.includes('client-info') ? '✓' : ''}
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="health-clinical"
                                    className={
                                        getTabErrors('health-clinical') ? 'bg-red-100 text-red-800 border-red-300' :
                                        completedTabs.includes('health-clinical') ? 'bg-green-100 text-green-800' : ''
                                    }
                                >
                                    Health & Clinical History {getTabErrors('health-clinical') ? '⚠️' : completedTabs.includes('health-clinical') ? '✓' : ''}
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="insurance-legal" 
                                    className={
                                        getTabErrors('insurance-legal') ? 'bg-red-100 text-red-800 border-red-300' :
                                        completedTabs.includes('insurance-legal') ? 'bg-green-100 text-green-800' : ''
                                    }
                                >
                                    Insurance & Legal {getTabErrors('insurance-legal') ? '⚠️' : completedTabs.includes('insurance-legal') ? '✓' : ''}
                                </TabsTrigger>
                                
                                <TabsTrigger 
                                    value="family-medical" 
                                    className={
                                        getTabErrors('family-medical') ? 'bg-red-100 text-red-800 border-red-300' :
                                        completedTabs.includes('family-medical') ? (readonlyTabs.includes('family-medical') ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800') : ''
                                    }
                                >
                                    Family Medical History {getTabErrors('family-medical') ? '⚠️' : completedTabs.includes('family-medical') ? (readonlyTabs.includes('family-medical') ? '🔒' : '✓') : ''}
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="patient-medical" 
                                    className={
                                        getTabErrors('patient-medical') ? 'bg-red-100 text-red-800 border-red-300' :
                                        completedTabs.includes('patient-medical') ? (readonlyTabs.includes('patient-medical') ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800') : ''
                                    }
                                >
                                    Patient Medical History {getTabErrors('patient-medical') ? '⚠️' : completedTabs.includes('patient-medical') ? (readonlyTabs.includes('patient-medical') ? '🔒' : '✓') : ''}
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="known-allergies" 
                                    className={
                                        getTabErrors('known-allergies') ? 'bg-red-100 text-red-800 border-red-300' :
                                        completedTabs.includes('known-allergies') ? (readonlyTabs.includes('known-allergies') ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800') : ''
                                    }
                                >
                                    Known Allergies {getTabErrors('known-allergies') ? '⚠️' : completedTabs.includes('known-allergies') ? (readonlyTabs.includes('known-allergies') ? '🔒' : '✓') : ''}
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="preferences" 
                                    className={
                                        getTabErrors('preferences') ? 'bg-red-100 text-red-800 border-red-300' :
                                        completedTabs.includes('preferences') ? 'bg-green-100 text-green-800' : ''
                                    }
                                >
                                    Preferences {getTabErrors('preferences') ? '⚠️' : completedTabs.includes('preferences') ? '✓' : ''}
                                </TabsTrigger>
                            </TabsList>

                             {/* Client Information Tab */}
                             <TabsContent value="client-info" className="space-y-6">
                                    <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-4">
                                        {/* Health Number Row */}
                                        <div>
                                             <Label htmlFor="health_number">
                                                 Health Card Number <span className="text-red-500">*</span>
                                             </Label>
                                             <Input
                                                 id="health_number"
                                                 value={data.health_number}
                                                 onChange={(e) => setData('health_number', e.target.value.toUpperCase())}
                                                 onBlur={(e) => handleFieldBlur('health_number', e.target.value)}
                                                 placeholder="e.g., 1234-567-890 (Ontario OHIP)"
                                                 className="placeholder:text-gray-400"
                                                 maxLength={30}
                                             />
                                             {getFieldError('health_number') && (
                                                 <p className="text-sm text-red-500 mt-1">{getFieldError('health_number')}</p>
                                             )}
                                         </div>
                                         
                                         {/* First Name, Last Name, and Preferred Name Row */}
                                         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                             {/* First Name */}
                                             <div>
                                                 <Label htmlFor="first_name">
                                                     First Name <span className="text-red-500">*</span>
                                                 </Label>
                                                 <Input
                                                     id="first_name"
                                                     value={data.first_name}
                                                     onChange={(e) => handleFieldChange('first_name', e.target.value)}
                                                     onBlur={(e) => handleFieldBlur('first_name', e.target.value)}
                                                     placeholder="Enter your First Name"
                                                     className="placeholder:text-gray-400"
                                                     maxLength={50}
                                                 />
                                                 {getFieldError('first_name') && (
                                                     <p className="text-sm text-red-500 mt-1">{getFieldError('first_name')}</p>
                                                 )}
                                             </div>

                                             {/* Last Name */}
                                             <div className="space-y-2">
                                                 <Label htmlFor="last_name">
                                                     Last Name <span className="text-red-500">*</span>
                                                 </Label>
                                                 <Input
                                                     id="last_name"
                                                     value={data.last_name}
                                                     onChange={(e) => handleFieldChange('last_name', e.target.value)}
                                                     onBlur={(e) => handleFieldBlur('last_name', e.target.value)}
                                                     placeholder="Enter your Last Name"
                                                     className="placeholder:text-gray-400"
                                                     maxLength={50}
                                                 />
                                                 {getFieldError('last_name') && (
                                                     <p className="text-sm text-red-500">{getFieldError('last_name')}</p>
                                                 )}
                                             </div>

                                             {/* Preferred Name */}
                                             <div className="space-y-2">
                                                 <Label htmlFor="preferred_name">
                                                     Preferred Name (if different)
                                                 </Label>
                                                 <Input
                                                     id="preferred_name"
                                                     value={data.preferred_name}
                                                     onChange={(e) => handleFieldChange('preferred_name', e.target.value)}
                                                     onBlur={(e) => handleFieldBlur('preferred_name', e.target.value)}
                                                     placeholder="e.g., Jess"
                                                     className="placeholder:text-gray-400"
                                                     maxLength={50}
                                                 />
                                                 {getFieldError('preferred_name') && (
                                                     <p className="text-sm text-red-500">{getFieldError('preferred_name')}</p>
                                                 )}
                                             </div>
                                         </div>

                                         {/* Phone Number, Email Address, and Gender/Pronouns Row */}
                                         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                             {/* Phone Number */}
                                             <div className="space-y-2">
                                                 <Label htmlFor="phone_number">
                                                     Phone Number <span className="text-red-500">*</span>
                                                 </Label>


                                                <PhoneInput
                                                    id="phone_number"
                                                    name="phone_number"
                                                    placeholder="Enter your Phone Number"
                                                    value={data.phone_number || ""}
                                                    onChange={(val) => setData("phone_number", (val as string) || "")}
                                                    onBlur={() => handleFieldBlur("phone_number", data.phone_number || "")}
                                                    //   disabled={patientExistsInTenant}
                                                    defaultCountry="CA" // 🇨🇦 Ontario, Canada
                                                    international
                                                    countryCallingCodeEditable={false}
                                                    className={`w-full placeholder:text-gray-400 ${
                                                        errors.phone_number ? "[&_input]:border-red-500 [&_input]:focus-visible:ring-red-500" : ""
                                                    }`}
                                                    maxLength={20}
                                                />
                                                 {/* <Input
                                                     id="phone_number"
                                                     value={data.phone_number}
                                                     onChange={(e) => setData('phone_number', e.target.value)}
                                                     onBlur={(e) => handleFieldBlur('phone_number', e.target.value)}
                                                     placeholder="Enter your Phone Number"
                                                     className="placeholder:text-gray-400"
                                                     maxLength={20}
                                                 /> */}
                                                 {getFieldError('phone_number') && (
                                                     <p className="text-sm text-red-500">{getFieldError('phone_number')}</p>
                                                 )}
                                             </div>

                                             {/* Email Address */}
                                             <div className="space-y-2">
                                                 <Label htmlFor="email_address">
                                                     Email Address <span className="text-red-500">*</span>
                                                 </Label>
                                                 <Input
                                                     id="email_address"
                                                     type="email"
                                                     value={data.email_address}
                                                     onChange={(e) => setData('email_address', e.target.value)}
                                                     onBlur={(e) => handleFieldBlur('email_address', e.target.value)}
                                                     placeholder="Enter your Email Address"
                                                     className="placeholder:text-gray-400"
                                                     maxLength={50}
                                                 />
                                                 {getFieldError('email_address') && (
                                                     <p className="text-sm text-red-500">{getFieldError('email_address')}</p>
                                                 )}
                                             </div>

                                             {/* Gender / Pronouns */}
                                             <div className="space-y-2">
                                                 <Label htmlFor="gender_pronouns">
                                                     Gender / Pronouns <span className="text-red-500">*</span>
                                                 </Label>
                                                 <Input
                                                     id="gender_pronouns"
                                                     value={data.gender_pronouns}
                                                     onChange={(e) => setData('gender_pronouns', e.target.value)}
                                                     onBlur={(e) => handleFieldBlur('gender_pronouns', e.target.value)}
                                                     placeholder="Enter your Gender / Pronouns"
                                                     className="placeholder:text-gray-400"
                                                     maxLength={20}
                                                 />
                                                 {getFieldError('gender_pronouns') && (
                                                     <p className="text-sm text-red-500">{getFieldError('gender_pronouns')}</p>
                                                 )}
                                             </div>
                                         </div>

                                         {/* Client Type, Date of Birth, and Emergency Contact Phone Row */}
                                         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                             {/* Client Type */}
                                             <div className="space-y-2">
                                                 <Label htmlFor="client_type">
                                                     Client Type <span className="text-red-500">*</span>
                                                 </Label>
                                                 <Select
                                                     value={data.client_type}
                                                     onValueChange={(value) => setData('client_type', value)}
                                                 >
                                                     <SelectTrigger 
                                                         className={`placeholder:text-gray-400 ${errors.client_type ? 'border-red-500' : ''}`}
                                                     >
                                                         <SelectValue placeholder="Client Type" className="placeholder:text-gray-400" />
                                                     </SelectTrigger>
                                                     <SelectContent>
                                                         {clientTypeOptions.map((option) => (
                                                             <SelectItem key={option.value} value={option.value}>
                                                                 {option.label}
                                                             </SelectItem>
                                                         ))}
                                                     </SelectContent>
                                                 </Select>
                                                 {getFieldError('client_type') && (
                                                     <p className="text-sm text-red-500">{getFieldError('client_type')}</p>
                                                 )}
                                             </div>

                                             {/* Date of Birth */}
                                             <div className="space-y-2">
                                                 <Label htmlFor="date_of_birth">
                                                     Date of Birth <span className="text-red-500">*</span>
                                                 </Label>
                                                 <Input
                                                     id="date_of_birth"
                                                     type="date"
                                                     value={data.date_of_birth}
                                                     onChange={(e) => setData('date_of_birth', e.target.value)}
                                                     onBlur={(e) => handleFieldBlur('date_of_birth', e.target.value)}
                                                     placeholder="Enter your Date of Birth"
                                                     className="placeholder:text-gray-400"
                                                     max={new Date(Date.now()).toISOString().split('T')[0]} // one day before today
 
                                                 />
                                                 {getFieldError('date_of_birth') && (
                                                     <p className="text-sm text-red-500">{getFieldError('date_of_birth')}</p>
                                                 )}
                                             </div>

                                             {/* Emergency Contact Phone */}
                                             <div className="space-y-2">
                                                 <Label htmlFor="emergency_contact_phone">
                                                     Emergency Contact Phone <span className="text-red-500">*</span>
                                                 </Label>
                                                 <PhoneInput
                                                            id="emergency_contact_phone"
                                                            name="emergency_contact_phone"
                                                            placeholder="Enter Emergency Contact Phone"
                                                            value={data.emergency_contact_phone || ""}
                                                            onChange={(val) => setData("emergency_contact_phone", (val as string) || "")}
                                                            onBlur={() =>
                                                                handleFieldBlur("emergency_contact_phone", data.emergency_contact_phone || "")
                                                            }
                                                            //   disabled={patientExistsInTenant}
                                                            defaultCountry="CA" // 🇨🇦 Ontario, Canada
                                                            international
                                                            countryCallingCodeEditable={false}
                                                            className={`w-full placeholder:text-gray-400 ${
                                                                errors.emergency_contact_phone
                                                                ? "[&_input]:border-red-500 [&_input]:focus-visible:ring-red-500"
                                                                : ""
                                                            }`}
                                                            maxLength={20}
                                                    />
                                                 {/* <Input
                                                     id="emergency_contact_phone"
                                                     value={data.emergency_contact_phone}
                                                     onChange={(e) => setData('emergency_contact_phone', e.target.value)}
                                                     onBlur={(e) => handleFieldBlur('emergency_contact_phone', e.target.value)}
                                                     placeholder="Enter Emergency Contact Phone"
                                                     className="placeholder:text-gray-400"
                                                     maxLength={20}
                                                 /> */}
                                                 {getFieldError('emergency_contact_phone') && (
                                                     <p className="text-sm text-red-500">{getFieldError('emergency_contact_phone')}</p>
                                                 )}
                                             </div>
                                         </div>

                                         {/* Address Lookup */}
                                         <div className="space-y-2">
                                             <Label htmlFor="address_lookup">
                                                 Address Lookup
                                             </Label>
                                             <Input
                                                 id="address_lookup"
                                                 value={data.address_lookup}
                                                 onChange={(e) => setData('address_lookup', e.target.value)}
                                                 onBlur={(e) => handleFieldBlur('address_lookup', e.target.value)}
                                                 placeholder="Enter address lookup"
                                                 className="placeholder:text-gray-400"
                                                 maxLength={200}
                                             />
                                             {getFieldError('address_lookup') && (
                                                 <p className="text-sm text-red-500">{getFieldError('address_lookup')}</p>
                                             )}
                                         </div>

                                         {/* Street Address */}
                                         <div className="space-y-2">
                                             <Label htmlFor="street_address">
                                                 Street Address <span className="text-red-500">*</span>
                                             </Label>
                                             <Input
                                                 id="street_address"
                                                 value={data.street_address}
                                                 onChange={(e) => setData('street_address', e.target.value)}
                                                 onBlur={(e) => handleFieldBlur('street_address', e.target.value)}
                                                 placeholder="Enter street address"
                                                 className="placeholder:text-gray-400"
                                                 maxLength={200}
                                             />
                                             {getFieldError('street_address') && (
                                                 <p className="text-sm text-red-500">{getFieldError('street_address')}</p>
                                             )}
                                         </div>

                                         {/* Apt/Suite/Unit No., City, Postal/ZIP Code, and Province Row */}
                                         <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                             {/* Apt/Suite/Unit No. */}
                                             <div className="space-y-2">
                                                 <Label htmlFor="apt_suite_unit">
                                                     Apt/Suite/Unit No. <span className="text-gray-500">(optional)</span>
                                                 </Label>
                                                 <Input
                                                     id="apt_suite_unit"
                                                     value={data.apt_suite_unit}
                                                     onChange={(e) => setData('apt_suite_unit', e.target.value)}
                                                     onBlur={(e) => handleFieldBlur('apt_suite_unit', e.target.value)}
                                                     placeholder="Enter no."
                                                     className="placeholder:text-gray-400"
                                                     maxLength={20}
                                                 />
                                                 {getFieldError('apt_suite_unit') && (
                                                     <p className="text-sm text-red-500">{getFieldError('apt_suite_unit')}</p>
                                                 )}
                                             </div>

                                             {/* City */}
                                             <div className="space-y-2">
                                                 <Label htmlFor="city">
                                                     City <span className="text-red-500">*</span>
                                                 </Label>
                                                 <Select
                                                     value={data.city}
                                                     onValueChange={(value) => setData('city', value)}
                                                 >
                                                     <SelectTrigger 
                                                         className={`placeholder:text-gray-400 ${errors.city ? 'border-red-500' : ''}`}
                                                     >
                                                         <SelectValue placeholder="Select city" className="placeholder:text-gray-400" />
                                                     </SelectTrigger>
                                                     <SelectContent>
                                                         {cityOptions.map((option) => (
                                                             <SelectItem key={option.value} value={option.value}>
                                                                 {option.label}
                                                             </SelectItem>
                                                         ))}
                                                     </SelectContent>
                                                 </Select>
                                                 {getFieldError('city') && (
                                                     <p className="text-sm text-red-500">{getFieldError('city')}</p>
                                                 )}
                                             </div>

                                             {/* Postal/ZIP Code */}
                                             <div className="space-y-2">
                                                 <Label htmlFor="postal_zip_code">
                                                     Postal/ZIP Code <span className="text-red-500">*</span>
                                                 </Label>
                                                 <Input
                                                     id="postal_zip_code"
                                                     value={data.postal_zip_code}
                                                     onChange={(e) => setData('postal_zip_code', e.target.value.toUpperCase())}
                                                     onBlur={(e) => handleFieldBlur('postal_zip_code', e.target.value)}
                                                     placeholder="Postal Code"
                                                     className="placeholder:text-gray-400"
                                                     maxLength={10}
                                                 />
                                                 {getFieldError('postal_zip_code') && (
                                                     <p className="text-sm text-red-500">{getFieldError('postal_zip_code')}</p>
                                                 )}
                                             </div>

                                             {/* Province */}
                                             <div className="space-y-2">
                                                 <Label htmlFor="province">
                                                     Province <span className="text-red-500">*</span>
                                                 </Label>
                                                 <Select
                                                     value={data.province}
                                                     onValueChange={(value) => setData('province', value)}
                                                 >
                                                     <SelectTrigger 
                                                         className={`placeholder:text-gray-400 ${errors.province ? 'border-red-500' : ''}`}
                                                     >
                                                         <SelectValue placeholder="Select province" className="placeholder:text-gray-400" />
                                                     </SelectTrigger>
                                                     <SelectContent>
                                                         {provinceOptions.map((option) => (
                                                             <SelectItem key={option.value} value={option.value}>
                                                                 {option.label}
                                                             </SelectItem>
                                                         ))}
                                                     </SelectContent>
                                                 </Select>
                                                 {getFieldError('province') && (
                                                     <p className="text-sm text-red-500">{getFieldError('province')}</p>
                                                 )}
                                             </div>
                                         </div>
                                     </div>

                                     {/* Tab Navigation Buttons */}
                                     <div className="flex justify-between items-center pt-6 border-t border-gray-100">
                                         <div>
                                             {getPreviousTab() && (
                                                 <Button 
                                                     type="button"
                                                     variant="outline"
                                                     onClick={handlePrevious}
                                                     className="px-6"
                                                 >
                                                     Previous
                                                 </Button>
                                             )}
                                         </div>
                                         <div>
                                             {getNextTab() && (
                                                 <Button 
                                                     type="button"
                                                     onClick={handleValidateThenNext}
                                                    //  disabled={!getCurrentTabValidation()}   
                                                     className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-white px-6"
                                                 >
                                                     Next
                                                 </Button>
                                             )}
                                         </div>
                                     </div>

                                 </form>
                             </TabsContent>

                            {/* Health & Clinical History Tab */}
                            <TabsContent value="health-clinical" className="space-y-6">
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-4">
                                        {/* Presenting Concern */}
                                        <div className="space-y-2">
                                            <Label htmlFor="presenting_concern">Presenting Concern</Label>
                                            <Textarea
                                                id="presenting_concern"
                                                value={data.presenting_concern}
                                                onChange={(e) => setData('presenting_concern', e.target.value)}
                                                onBlur={(e) => handleFieldBlur('presenting_concern', e.target.value)}
                                                placeholder="Anxiety, stress at work, sleep issues"
                                                className="placeholder:text-gray-400 w-full"
                                                style={{ height: '88.5px' }}
                                                rows={3}
                                                maxLength={2000}
                                            />
                                            {getFieldError('presenting_concern') && (
                                                <p className="text-sm text-red-500">{getFieldError('presenting_concern')}</p>
                                            )}
                                        </div>

                                        {/* Goals for Therapy */}
                                        <div className="space-y-2">
                                            <Label htmlFor="goals_for_therapy">Goals for Therapy</Label>
                                            <Textarea
                                                id="goals_for_therapy"
                                                value={data.goals_for_therapy}
                                                onChange={(e) => setData('goals_for_therapy', e.target.value)}
                                                onBlur={(e) => handleFieldBlur('goals_for_therapy', e.target.value)}
                                                placeholder="Learn coping skills, reduce anxiety"
                                                className="placeholder:text-gray-400 w-full"
                                                style={{ height: '88.5px' }}
                                                rows={3}
                                                maxLength={2000}
                                            />
                                            {getFieldError('goals_for_therapy') && (
                                                <p className="text-sm text-red-500">{getFieldError('goals_for_therapy')}</p>
                                            )}
                                        </div>

                                                                                 {/* Previous Therapy Experience and Current Medications Row */}
                                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                             {/* Previous Therapy Experience */}
                                             <div className="space-y-2">
                                                 <Label htmlFor="previous_therapy_experience">
                                                     Previous Therapy Experience <span className="text-red-500">*</span>
                                                 </Label>
                                                 <Select
                                                     value={data.previous_therapy_experience}
                                                     onValueChange={(value) => setData('previous_therapy_experience', value)}
                                                 >
                                                     <SelectTrigger 
                                                         className={`placeholder:text-gray-400 ${errors.previous_therapy_experience ? 'border-red-500' : ''}`}
                                                     >
                                                         <SelectValue placeholder="Previous Therapy Experience" className="placeholder:text-gray-400" />
                                                     </SelectTrigger>
                                                     <SelectContent>
                                                         {previousTherapyOptions.map((option) => (
                                                             <SelectItem key={option.value} value={option.value}>
                                                                 {option.label}
                                                             </SelectItem>
                                                         ))}
                                                     </SelectContent>
                                                 </Select>
                                                 {getFieldError('previous_therapy_experience') && (
                                                     <p className="text-sm text-red-500">{getFieldError('previous_therapy_experience')}</p>
                                                 )}
                                             </div>
 
                                             {/* Current Medications */}
                                             <div className="space-y-2">
                                                 <Label htmlFor="current_medications">Current Medications (Optional)</Label>
                                                 <Input
                                                     id="current_medications"
                                                     value={data.current_medications}
                                                     onChange={(e) => setData('current_medications', e.target.value)}
                                                     onBlur={(e) => handleFieldBlur('current_medications', e.target.value)}
                                                     placeholder="e.g., Sertraline 50mg daily"
                                                     className="placeholder:text-gray-400"
                                                     maxLength={1000}
                                                 />
                                                 {getFieldError('current_medications') && (
                                                     <p className="text-sm text-red-500">{getFieldError('current_medications')}</p>
                                                 )}
                                             </div>
                                         </div>

                                        {/* Rest of the fields in original layout */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                                            {/* Left Column */}
                                            <div className="space-y-4">
                                                {/* Diagnoses */}
                                                <div className="space-y-2">
                                                    <Label htmlFor="diagnoses">Diagnoses (Optional)</Label>
                                                    <Textarea
                                                        id="diagnoses"
                                                        value={data.diagnoses}
                                                        onChange={(e) => setData('diagnoses', e.target.value)}
                                                        onBlur={(e) => handleFieldBlur('diagnoses', e.target.value)}
                                                        placeholder="e.g., Generalized Anxiety Disorder (GAD)"
                                                        className="min-h-[80px] placeholder:text-gray-400"
                                                        rows={3}
                                                        maxLength={1000}
                                                    />
                                                    {getFieldError('diagnoses') && (
                                                        <p className="text-sm text-red-500">{getFieldError('diagnoses')}</p>
                                                    )}
                                                </div>

                                                {/* Risk/Safety Concerns */}
                                                <div className="space-y-2">
                                                    <Label htmlFor="risk_safety_concerns">Risk/Safety Concerns</Label>
                                                    <Textarea
                                                        id="risk_safety_concerns"
                                                        value={data.risk_safety_concerns}
                                                        onChange={(e) => setData('risk_safety_concerns', e.target.value)}
                                                        onBlur={(e) => handleFieldBlur('risk_safety_concerns', e.target.value)}
                                                        placeholder="None / Recent self-harm / Suicidal ideation"
                                                        className="min-h-[80px] placeholder:text-gray-400"
                                                        rows={3}
                                                        maxLength={2000}
                                                    />
                                                    {getFieldError('risk_safety_concerns') && (
                                                        <p className="text-sm text-red-500">{getFieldError('risk_safety_concerns')}</p>
                                                    )}
                                                </div>

                                                {/* Cultural/Religious Considerations */}
                                                <div className="space-y-2">
                                                    <Label htmlFor="cultural_religious_considerations">Cultural/Religious Considerations</Label>
                                                    <Textarea
                                                        id="cultural_religious_considerations"
                                                        value={data.cultural_religious_considerations}
                                                        onChange={(e) => setData('cultural_religious_considerations', e.target.value)}
                                                        onBlur={(e) => handleFieldBlur('cultural_religious_considerations', e.target.value)}
                                                        placeholder="e.g. Prefer culturally-sensitive care"
                                                        className="min-h-[80px] placeholder:text-gray-400"
                                                        rows={3}
                                                        maxLength={2000}
                                                    />
                                                    {getFieldError('cultural_religious_considerations') && (
                                                        <p className="text-sm text-red-500">{getFieldError('cultural_religious_considerations')}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right Column */}
                                            <div className="space-y-4">
                                                {/* Any History of Hospitalization */}
                                                <div className="space-y-2">
                                                    <Label htmlFor="history_of_hospitalization">Any History of Hospitalization (Optional)</Label>
                                                    <Textarea
                                                        id="history_of_hospitalization"
                                                        value={data.history_of_hospitalization}
                                                        onChange={(e) => setData('history_of_hospitalization', e.target.value)}
                                                        onBlur={(e) => handleFieldBlur('history_of_hospitalization', e.target.value)}
                                                        placeholder="Yes – in 2021 for anxiety"
                                                        className="min-h-[80px] placeholder:text-gray-400"
                                                        rows={3}
                                                        maxLength={1000}
                                                    />
                                                    {getFieldError('history_of_hospitalization') && (
                                                        <p className="text-sm text-red-500">{getFieldError('history_of_hospitalization')}</p>
                                                    )}
                                                </div>

                                                {/* Other Relevant Medical Conditions */}
                                                <div className="space-y-2">
                                                    <Label htmlFor="other_medical_conditions">Other Relevant Medical Conditions</Label>
                                                    <Textarea
                                                        id="other_medical_conditions"
                                                        value={data.other_medical_conditions}
                                                        onChange={(e) => setData('other_medical_conditions', e.target.value)}
                                                        onBlur={(e) => handleFieldBlur('other_medical_conditions', e.target.value)}
                                                        placeholder="e.g., Diabetes, migraines, ADHD"
                                                        className="min-h-[80px] placeholder:text-gray-400"
                                                        rows={3}
                                                        maxLength={1000}
                                                    />
                                                    {getFieldError('other_medical_conditions') && (
                                                        <p className="text-sm text-red-500">{getFieldError('other_medical_conditions')}</p>
                                                    )}
                                                </div>

                                                {/* Accessibility Needs */}
                                                <div className="space-y-2">
                                                    <Label htmlFor="accessibility_needs">Accessibility Needs</Label>
                                                    <Textarea
                                                        id="accessibility_needs"
                                                        value={data.accessibility_needs}
                                                        onChange={(e) => setData('accessibility_needs', e.target.value)}
                                                        onBlur={(e) => handleFieldBlur('accessibility_needs', e.target.value)}
                                                        placeholder="e.g. Require captions, mobility assistance"
                                                        className="min-h-[80px] placeholder:text-gray-400"
                                                        rows={3}
                                                        maxLength={2000}
                                                    />
                                                    {getFieldError('accessibility_needs') && (
                                                        <p className="text-sm text-red-500">{getFieldError('accessibility_needs')}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tab Navigation Buttons */}
                                    <div className="flex justify-between items-center pt-6 border-t border-gray-100">
                                        <div>
                                            {getPreviousTab() && (
                                                <Button 
                                                    type="button"
                                                    variant="outline"
                                                    onClick={handlePrevious}
                                                    className="px-6"
                                                >
                                                    Previous
                                                </Button>
                                            )}
                                        </div>
                                        <div>
                                            {getNextTab() && (
                                                <Button 
                                                    type="button"
                                                    onClick={handleNext}
                                                    disabled={!getCurrentTabValidation()}
                                                    className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-white px-6"
                                                >
                                                    Next
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                </form>
                            </TabsContent>

                            {/* Insurance & Legal Tab */}
                            <TabsContent value="insurance-legal" className="space-y-6">
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-6">
                                        {/* Insurance Provider, Policy Number, and Upload Coverage Card Row */}
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                           {/* Insurance Provider */}
                                           <div className="space-y-2">
                                               <Label htmlFor="insurance_provider">Insurance Provider</Label>
                                               <Select
                                                   value={data.insurance_provider}
                                                   onValueChange={(value) => setData('insurance_provider', value)}
                                               >
                                                   <SelectTrigger className="placeholder:text-gray-400">
                                                       <SelectValue placeholder="e.g., John Martin" />
                                                   </SelectTrigger>
                                                   <SelectContent>
                                                       <SelectItem value="blue-cross">Blue Cross</SelectItem>
                                                       <SelectItem value="sunlife">Sun Life</SelectItem>
                                                       <SelectItem value="manulife">Manulife</SelectItem>
                                                       <SelectItem value="great-west">Great-West Life</SelectItem>
                                                       <SelectItem value="desjardins">Desjardins</SelectItem>
                                                       <SelectItem value="other">Other</SelectItem>
                                                   </SelectContent>
                                               </Select>
                                               {getFieldError('insurance_provider') && (
                                                   <p className="text-sm text-red-500">{getFieldError('insurance_provider')}</p>
                                               )}
                                           </div>

                                           {/* Policy Number */}
                                           <div className="space-y-2">
                                               <Label htmlFor="policy_number">Policy Number</Label>
                                               <Input
                                                   id="policy_number"
                                                   value={data.policy_number}
                                                   onChange={(e) => setData('policy_number', e.target.value)}
                                                   onBlur={(e) => handleFieldBlur('policy_number', e.target.value)}
                                                   placeholder="e.g., 123456789"
                                                   className="placeholder:text-gray-400"
                                                   maxLength={50}
                                               />
                                               {getFieldError('policy_number') && (
                                                   <p className="text-sm text-red-500">{getFieldError('policy_number')}</p>
                                               )}
                                           </div>

                                           {/* Upload Coverage Card */}
                                           <div className="space-y-2">
                                               <Label>Upload Coverage Card (Optional)</Label>

                                               {/* File Preview */}
                                               {(coverageCardFile || coverageCardPreview) && (
                                                   <div className="mb-3 p-4 border border-gray-200 rounded-lg bg-white">
                                                       {coverageCardPreview ? (
                                                           <div className="space-y-2">
                                                               <img
                                                                   src={coverageCardPreview}
                                                                   alt="Coverage card preview"
                                                                   className="max-w-full h-auto rounded-lg"
                                                               />
                                                               <p className="text-sm text-gray-600 text-center">{coverageCardFile?.name}</p>
                                                           </div>
                                                       ) : (
                                                           <div className="flex items-center gap-3">
                                                               <div className="w-12 h-12 bg-red-50 rounded flex items-center justify-center">
                                                                   <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                                   </svg>
                                                               </div>
                                                               <div className="flex-1">
                                                                   <p className="text-sm font-medium text-gray-900">{coverageCardFile?.name}</p>
                                                                   <p className="text-xs text-gray-500">PDF Document</p>
                                                               </div>
                                                           </div>
                                                       )}
                                                       <button
                                                           type="button"
                                                           onClick={() => {
                                                               setCoverageCardFile(null);
                                                               setCoverageCardPreview(null);
                                                               setData('coverage_card', null);
                                                               setData('coverage_card_path', '');
                                                           }}
                                                           className="mt-2 text-xs text-red-600 hover:text-red-700"
                                                       >
                                                           Remove file
                                                       </button>
                                                   </div>
                                               )}

                                               <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                                                   <div className="flex flex-col items-center">
                                                       <div className="w-10 h-10 bg-sidebar-accent/10 rounded-full flex items-center justify-center mb-3">
                                                           <svg className="w-5 h-5 text-sidebar-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                           </svg>
                                                       </div>
                                                       <p className="text-sm text-gray-600 mb-1">
                                                           <span className="text-sidebar-accent underline cursor-pointer">Browse</span>
                                                       </p>
                                                       <p className="text-xs text-gray-500">
                                                           PDF, JPG, PNG accepted
                                                       </p>
                                                   </div>
                                                   <input
                                                       type="file"
                                                       accept=".pdf,.jpg,.jpeg,.png"
                                                       onChange={handleCoverageCardChange}
                                                       className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                       disabled={uploadingCoverageCard || processing}
                                                   />
                                               </div>
                                               {errors.coverage_card && (
                                                   <p className="text-sm text-red-500">{errors.coverage_card}</p>
                                               )}
                                           </div>
                                       </div>

                                       {/* Consent Sections */}
                                         <div className="space-y-4">
                                           {/* Consent to Treatment */}
                                             <div className="space-y-2">
                                                 <Label className="text-base font-medium">Consent to Treatment</Label>
                                                 <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                                                   <Checkbox
                                                       id="consent_to_treatment"
                                                       checked={data.consent_to_treatment}
                                                       onCheckedChange={(checked) => setData('consent_to_treatment', !!checked)}
                                                       className="mt-0.5"
                                                   />
                                                   <label htmlFor="consent_to_treatment" className="text-sm text-gray-700 cursor-pointer">
                                                       I consent to psychotherapy as described by my provider.
                                                   </label>
                                               </div>
                                               {errors.consent_to_treatment && (
                                                   <p className="text-sm text-red-500">{errors.consent_to_treatment}</p>
                                               )}
                                           </div>

                                           {/* Consent to Store My Data Securely */}
                                             <div className="space-y-2">
                                                 <Label className="text-base font-medium">Consent to Store My Data Securely</Label>
                                                 <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                                                   <Checkbox
                                                       id="consent_to_data_storage"
                                                       checked={data.consent_to_data_storage}
                                                       onCheckedChange={(checked) => setData('consent_to_data_storage', !!checked)}
                                                       className="mt-0.5"
                                                   />
                                                   <label htmlFor="consent_to_data_storage" className="text-sm text-gray-700 cursor-pointer">
                                                       I understand my data is stored under PHIPA/PIPEDA standards.
                                                   </label>
                                               </div>
                                               {errors.consent_to_data_storage && (
                                                   <p className="text-sm text-red-500">{errors.consent_to_data_storage}</p>
                                               )}
                                           </div>

                                           {/* Privacy Policy Acknowledgement */}
                                             <div className="space-y-2">
                                                 <Label className="text-base font-medium">Privacy Policy Acknowledgement</Label>
                                                 <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                                                   <Checkbox
                                                       id="privacy_policy_acknowledged"
                                                       checked={data.privacy_policy_acknowledged}
                                                       onCheckedChange={(checked) => setData('privacy_policy_acknowledged', !!checked)}
                                                       className="mt-0.5"
                                                   />
                                                   <label htmlFor="privacy_policy_acknowledged" className="text-sm text-gray-700 cursor-pointer">
                                                       I have read and understood the privacy policy.
                                                   </label>
                                               </div>
                                               {errors.privacy_policy_acknowledged && (
                                                   <p className="text-sm text-red-500">{errors.privacy_policy_acknowledged}</p>
                                               )}
                                           </div>
                                       </div>
                                   </div>

                                   {/* Tab Navigation Buttons */}
                                   <div className="flex justify-between items-center pt-6 border-t border-gray-100">
                                       <div>
                                           {getPreviousTab() && (
                                               <Button 
                                                   type="button"
                                                   variant="outline"
                                                   onClick={handlePrevious}
                                                   className="px-6"
                                               >
                                                   Previous
                                               </Button>
                                           )}
                                       </div>
                                       <div>
                                           {getNextTab() && (
                                               <Button 
                                                   type="button"
                                                   onClick={handleNext}
                                                   disabled={!getCurrentTabValidation()}
                                                   className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-white px-6"
                                               >
                                                   Next
                                               </Button>
                                           )}
                                       </div>
                                   </div>

                               </form>
                           </TabsContent>

                                                        {/* Preferences Tab */}
                             <TabsContent value="preferences" className="flex-1 flex flex-col">
                                 <form onSubmit={handleSubmit} className="h-full flex flex-col">
                                     <div className="flex-1">
                                         <div className="space-y-4">
                                             {/* Language Preferences, Best Time to Contact, and Best Way to Contact Row */}
                                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                 {/* Language Preferences */}
                                                 <div className="space-y-2">
                                                     <Label htmlFor="language_preferences">
                                                         Language Preferences <span className="text-red-500">*</span>
                                                     </Label>
                                                     <Select
                                                         value={data.language_preferences}
                                                         onValueChange={(value) => setData('language_preferences', value)}
                                                     >
                                                         <SelectTrigger 
                                                             className={`placeholder:text-gray-400 h-[52px] ${getFieldError('language_preferences') ? 'border-red-500' : ''}`}
                                                         >
                                                             <SelectValue placeholder="Session Language" className="placeholder:text-gray-400" />
                                                         </SelectTrigger>
                                                         <SelectContent>
                                                             {languageOptions.map((option) => (
                                                                 <SelectItem key={option.value} value={option.value}>
                                                                     {option.label}
                                                                 </SelectItem>
                                                             ))}
                                                         </SelectContent>
                                                     </Select>
                                                     {getFieldError('language_preferences') && (
                                                         <p className="text-sm text-red-500">{getFieldError('language_preferences')}</p>
                                                     )}
                                                 </div>

                                                 {/* Best Time to Contact */}
                                                 <div className="space-y-2">
                                                     <Label htmlFor="best_time_to_contact">
                                                         Best Time to Contact <span className="text-red-500">*</span>
                                                     </Label>
                                                     <Select
                                                         value={data.best_time_to_contact}
                                                         onValueChange={(value) => setData('best_time_to_contact', value)}
                                                     >
                                                         <SelectTrigger 
                                                             className={`placeholder:text-gray-400 h-[52px] ${getFieldError('best_time_to_contact') ? 'border-red-500' : ''}`}
                                                         >
                                                             <SelectValue placeholder="Best Time to Contact" className="placeholder:text-gray-400" />
                                                         </SelectTrigger>
                                                         <SelectContent>
                                                             {bestTimeOptions.map((option) => (
                                                                 <SelectItem key={option.value} value={option.value}>
                                                                     {option.label}
                                                                 </SelectItem>
                                                             ))}
                                                         </SelectContent>
                                                     </Select>
                                                     {getFieldError('best_time_to_contact') && (
                                                         <p className="text-sm text-red-500">{getFieldError('best_time_to_contact')}</p>
                                                     )}
                                                 </div>

                                                 {/* Best Way to Contact */}
                                                 <div className="space-y-2">
                                                     <Label htmlFor="best_way_to_contact">
                                                         Best Way to Contact <span className="text-red-500">*</span>
                                                     </Label>
                                                     <Select
                                                         value={data.best_way_to_contact}
                                                         onValueChange={(value) => setData('best_way_to_contact', value)}
                                                     >
                                                         <SelectTrigger 
                                                             className={`placeholder:text-gray-400 h-[52px] ${getFieldError('best_way_to_contact') ? 'border-red-500' : ''}`}
                                                         >
                                                             <SelectValue placeholder="Best Way to Contact" className="placeholder:text-gray-400" />
                                                         </SelectTrigger>
                                                         <SelectContent>
                                                             {bestWayOptions.map((option) => (
                                                                 <SelectItem key={option.value} value={option.value}>
                                                                     {option.label}
                                                                 </SelectItem>
                                                             ))}
                                                         </SelectContent>
                                                     </Select>
                                                     {getFieldError('best_way_to_contact') && (
                                                         <p className="text-sm text-red-500">{getFieldError('best_way_to_contact')}</p>
                                                     )}
                                                 </div>
                                             </div>

                                             {/* Consent to Receive Reminders */}
                                             <div className="space-y-2 mt-6">
                                                 <Label className="text-base font-medium">Consent to Receive Reminders</Label>
                                                 <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                                                     <Checkbox
                                                         id="consent_to_receive_reminders"
                                                         checked={data.consent_to_receive_reminders}
                                                         onCheckedChange={(checked) => setData('consent_to_receive_reminders', !!checked)}
                                                         className="mt-0.5"
                                                     />
                                                     <label htmlFor="consent_to_receive_reminders" className="text-sm text-gray-700 cursor-pointer">
                                                         I agree to receive SMS/email reminders.
                                                     </label>
                                                 </div>
                                                 {errors.consent_to_receive_reminders && (
                                                     <p className="text-sm text-red-500">{errors.consent_to_receive_reminders}</p>
                                                 )}
                                             </div>
                                         </div>
                                     </div>

                                     {/* Tab Navigation Buttons - Only Previous for last tab */}
                                     <div className="flex justify-start items-center pt-6 border-t border-gray-100">
                                         {getPreviousTab() && (
                                             <Button 
                                                 type="button"
                                                 variant="outline"
                                                 onClick={handlePrevious}
                                                 className="px-6"
                                             >
                                                 Previous
                                             </Button>
                                         )}
                                     </div>

                                 </form>
                             </TabsContent>

                            {/* Family Medical History Tab */}
                            <TabsContent value="family-medical" className="space-y-6">
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-6">
                                        {readonlyTabs.includes('family-medical') ? (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                                <div className="flex items-center gap-2 text-blue-700">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                    </svg>
                                                    <span className="font-medium">This section has been completed and is now read-only</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                                                <div className="flex items-start gap-3">
                                                    <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <div>
                                                        <p className="font-medium text-green-800">Family Medical History</p>
                                                        <p className="text-sm text-green-700 mt-1">
                                                            Add information about your family's medical history. This helps healthcare providers better understand potential genetic factors.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-lg font-medium text-gray-900">Family Medical History</h3>
                                                {!readonlyTabs.includes('family-medical') && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            const newHistory = {
                                                                relationship_to_patient: '',
                                                                summary: '',
                                                                details: '',
                                                                diagnosis_date: ''
                                                            };
                                                            setData('family_medical_histories', [...data.family_medical_histories, newHistory]);
                                                        }}
                                                        className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                                    >
                                                        + Add Family History
                                                    </Button>
                                                )}
                                            </div>

                                            {data.family_medical_histories.length === 0 ? (
                                                <div className="text-center py-12 text-gray-500">
                                                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                    </svg>
                                                    <p className="text-lg">No family medical history added yet</p>
                                                    <p className="text-sm">Click "Add Family History" to get started</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {data.family_medical_histories.map((history:any, index:any) => (
                                                        <div key={index} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                                                            <div className="flex justify-between items-start mb-4">
                                                                <h4 className="font-medium text-gray-900">Family History #{index + 1}</h4>
                                                                {!readonlyTabs.includes('family-medical') && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            const updatedHistories = data.family_medical_histories.filter((_, i) => i !== index);
                                                                            setData('family_medical_histories', updatedHistories);
                                                                        }}
                                                                        className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                                                    >
                                                                        Remove
                                                                    </Button>
                                                                )}
                                                            </div>

                                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                                <div className="space-y-2">
                                                                    <Label htmlFor={`family_relationship_${index}`}>
                                                                        Relationship to Patient <span className="text-red-500">*</span>
                                                                    </Label>
                                                                    <Select
                                                                        value={history.relationship_to_patient}
                                                                        onValueChange={(value) => {
                                                                            const updatedHistories = [...data.family_medical_histories];
                                                                            updatedHistories[index].relationship_to_patient = value;
                                                                            setData('family_medical_histories', updatedHistories);
                                                                        }}
                                                                        disabled={readonlyTabs.includes('family-medical')}
                                                                    >
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder="Select relationship" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="mother">Mother</SelectItem>
                                                                            <SelectItem value="father">Father</SelectItem>
                                                                            <SelectItem value="sibling">Sibling</SelectItem>
                                                                            <SelectItem value="grandparent">Grandparent</SelectItem>
                                                                            <SelectItem value="aunt_uncle">Aunt/Uncle</SelectItem>
                                                                            <SelectItem value="cousin">Cousin</SelectItem>
                                                                            <SelectItem value="other">Other</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    <Label htmlFor={`family_diagnosis_date_${index}`}>
                                                                        Diagnosis Date
                                                                    </Label>
                                                                    <Input
                                                                        id={`family_diagnosis_date_${index}`}
                                                                        type="date"
                                                                        value={history.diagnosis_date}
                                                                        onChange={(e) => {
                                                                            const updatedHistories = [...data.family_medical_histories];
                                                                            updatedHistories[index].diagnosis_date = e.target.value;
                                                                            setData('family_medical_histories', updatedHistories);
                                                                        }}
                                                                        disabled={readonlyTabs.includes('family-medical')}
                                                                        className="placeholder:text-gray-400"
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 gap-4 mt-4">
                                                                <div className="space-y-2">
                                                                    <Label htmlFor={`family_summary_${index}`}>
                                                                        Condition/Summary <span className="text-red-500">*</span>
                                                                    </Label>
                                                                    <Input
                                                                        id={`family_summary_${index}`}
                                                                        value={history.summary}
                                                                        onChange={(e) => {
                                                                            const updatedHistories = [...data.family_medical_histories];
                                                                            updatedHistories[index].summary = e.target.value;
                                                                            setData('family_medical_histories', updatedHistories);
                                                                        }}
                                                                        placeholder="e.g., Diabetes Type 2"
                                                                        disabled={readonlyTabs.includes('family-medical')}
                                                                        className="placeholder:text-gray-400"
                                                                        maxLength={200}
                                                                    />
                                                                </div>

                                                                <div className="space-y-2">
                                                                    <Label htmlFor={`family_details_${index}`}>
                                                                        Additional Details
                                                                    </Label>
                                                                    <Textarea
                                                                        id={`family_details_${index}`}
                                                                        value={history.details}
                                                                        onChange={(e) => {
                                                                            const updatedHistories = [...data.family_medical_histories];
                                                                            updatedHistories[index].details = e.target.value;
                                                                            setData('family_medical_histories', updatedHistories);
                                                                        }}
                                                                        placeholder="Additional details about the condition..."
                                                                        disabled={readonlyTabs.includes('family-medical')}
                                                                        className="min-h-[80px] placeholder:text-gray-400"
                                                                        rows={3}
                                                                        maxLength={500}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tab Navigation Buttons */}
                                    <div className="flex justify-between items-center pt-6 border-t border-gray-100">
                                        <div>
                                            {getPreviousTab() && (
                                                <Button 
                                                    type="button"
                                                    variant="outline"
                                                    onClick={handlePrevious}
                                                    className="px-6"
                                                >
                                                    Previous
                                                </Button>
                                            )}
                                        </div>
                                        <div>
                                            {getNextTab() && (
                                                <Button 
                                                    type="button"
                                                    onClick={handleNext}
                                                    disabled={!getCurrentTabValidation()}
                                                    className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-white px-6"
                                                >
                                                    Next
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </form>
                            </TabsContent>

                            {/* Patient Medical History Tab */}
                            <TabsContent value="patient-medical" className="space-y-6">
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-6">
                                        {readonlyTabs.includes('patient-medical') ? (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                                <div className="flex items-center gap-2 text-blue-700">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                    </svg>
                                                    <span className="font-medium">This section has been completed and is now read-only</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                                                <div className="flex items-start gap-3">
                                                    <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <div>
                                                        <p className="font-medium text-amber-800">Note about Patient Medical History</p>
                                                        <p className="text-sm text-amber-700 mt-1">
                                                            Once you complete and move away from this tab, it will become read-only and cannot be edited.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-lg font-medium text-gray-900">Patient Medical History</h3>
                                                {!readonlyTabs.includes('patient-medical') && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            const newHistory = {
                                                                disease: '',
                                                                recent_tests: ''
                                                            };
                                                            setData('patient_medical_histories', [...data.patient_medical_histories, newHistory]);
                                                        }}
                                                        className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                                    >
                                                        + Add Medical History
                                                    </Button>
                                                )}
                                            </div>

                                            {data.patient_medical_histories.length === 0 ? (
                                                <div className="text-center py-12 text-gray-500">
                                                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    <p className="text-lg">No medical history added yet</p>
                                                    <p className="text-sm">Click "Add Medical History" to get started</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {data.patient_medical_histories.map((history:any, index:any) => (
                                                        <div key={index} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                                                            <div className="flex justify-between items-start mb-4">
                                                                <h4 className="font-medium text-gray-900">Medical History #{index + 1}</h4>
                                                                {!readonlyTabs.includes('patient-medical') && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            const updatedHistories = data.patient_medical_histories.filter((_, i) => i !== index);
                                                                            setData('patient_medical_histories', updatedHistories);
                                                                        }}
                                                                        className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                                                    >
                                                                        Remove
                                                                    </Button>
                                                                )}
                                                            </div>

                                                            <div className="grid grid-cols-1 gap-4">
                                                                <div className="space-y-2">
                                                                    <Label htmlFor={`patient_disease_${index}`}>
                                                                        Disease/Condition <span className="text-red-500">*</span>
                                                                    </Label>
                                                                    <Input
                                                                        id={`patient_disease_${index}`}
                                                                        value={history.disease}
                                                                        onChange={(e) => {
                                                                            const updatedHistories = [...data.patient_medical_histories];
                                                                            updatedHistories[index].disease = e.target.value;
                                                                            setData('patient_medical_histories', updatedHistories);
                                                                        }}
                                                                        placeholder="e.g., Hypertension, Asthma, Depression"
                                                                        disabled={readonlyTabs.includes('patient-medical')}
                                                                        className="placeholder:text-gray-400"
                                                                        maxLength={200}
                                                                    />
                                                                </div>

                                                                <div className="space-y-2">
                                                                    <Label htmlFor={`patient_recent_tests_${index}`}>
                                                                        Recent Tests/Results
                                                                    </Label>
                                                                    <Textarea
                                                                        id={`patient_recent_tests_${index}`}
                                                                        value={history.recent_tests}
                                                                        onChange={(e) => {
                                                                            const updatedHistories = [...data.patient_medical_histories];
                                                                            updatedHistories[index].recent_tests = e.target.value;
                                                                            setData('patient_medical_histories', updatedHistories);
                                                                        }}
                                                                        placeholder="Recent test results, lab values, imaging studies..."
                                                                        disabled={readonlyTabs.includes('patient-medical')}
                                                                        className="min-h-[80px] placeholder:text-gray-400"
                                                                        rows={3}
                                                                        maxLength={500}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tab Navigation Buttons */}
                                    <div className="flex justify-between items-center pt-6 border-t border-gray-100">
                                        <div>
                                            {getPreviousTab() && (
                                                <Button 
                                                    type="button"
                                                    variant="outline"
                                                    onClick={handlePrevious}
                                                    className="px-6"
                                                >
                                                    Previous
                                                </Button>
                                            )}
                                        </div>
                                        <div>
                                            {getNextTab() && (
                                                <Button 
                                                    type="button"
                                                    onClick={handleNext}
                                                    disabled={!getCurrentTabValidation()}
                                                    className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-white px-6"
                                                >
                                                    Next
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </form>
                            </TabsContent>

                            {/* Known Allergies Tab */}
                            <TabsContent value="known-allergies" className="space-y-6">
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-6">
                                        {readonlyTabs.includes('known-allergies') ? (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                                <div className="flex items-center gap-2 text-blue-700">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                    </svg>
                                                    <span className="font-medium">This section has been completed and is now read-only</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                                                <div className="flex items-start gap-3">
                                                    <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <div>
                                                        <p className="font-medium text-amber-800">Note about Known Allergies</p>
                                                        <p className="text-sm text-amber-700 mt-1">
                                                            Once you complete and move away from this tab, it will become read-only and cannot be edited.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-lg font-medium text-gray-900">Known Allergies</h3>
                                                {!readonlyTabs.includes('known-allergies') && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            const newAllergy = {
                                                                allergens: '',
                                                                type: '',
                                                                severity: '',
                                                                reaction: '',
                                                                notes: ''
                                                            };
                                                            setData('known_allergies', [...data.known_allergies, newAllergy]);
                                                        }}
                                                        className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                                    >
                                                        + Add Allergy
                                                    </Button>
                                                )}
                                            </div>

                                            {data.known_allergies.length === 0 ? (
                                                <div className="text-center py-12 text-gray-500">
                                                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <p className="text-lg">No allergies recorded yet</p>
                                                    <p className="text-sm">Click "Add Allergy" to record known allergies</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {data.known_allergies.map((allergy:any, index:any) => (
                                                        <div key={index} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                                                            <div className="flex justify-between items-start mb-4">
                                                                <h4 className="font-medium text-gray-900">Allergy #{index + 1}</h4>
                                                                {!readonlyTabs.includes('known-allergies') && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            const updatedAllergies = data.known_allergies.filter((_, i) => i !== index);
                                                                            setData('known_allergies', updatedAllergies);
                                                                        }}
                                                                        className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                                                    >
                                                                        Remove
                                                                    </Button>
                                                                )}
                                                            </div>

                                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                                                                <div className="space-y-2">
                                                                    <Label htmlFor={`allergy_allergens_${index}`}>
                                                                        Allergen <span className="text-red-500">*</span>
                                                                    </Label>
                                                                    <Input
                                                                        id={`allergy_allergens_${index}`}
                                                                        value={allergy.allergens}
                                                                        onChange={(e) => {
                                                                            const updatedAllergies = [...data.known_allergies];
                                                                            updatedAllergies[index].allergens = e.target.value;
                                                                            setData('known_allergies', updatedAllergies);
                                                                        }}
                                                                        placeholder="e.g., Peanuts, Penicillin"
                                                                        disabled={readonlyTabs.includes('known-allergies')}
                                                                        className="placeholder:text-gray-400"
                                                                        maxLength={100}
                                                                    />
                                                                </div>

                                                                <div className="space-y-2">
                                                                    <Label htmlFor={`allergy_type_${index}`}>
                                                                        Type <span className="text-red-500">*</span>
                                                                    </Label>
                                                                    <Select
                                                                        value={allergy.type}
                                                                        onValueChange={(value) => {
                                                                            const updatedAllergies = [...data.known_allergies];
                                                                            updatedAllergies[index].type = value;
                                                                            setData('known_allergies', updatedAllergies);
                                                                        }}
                                                                        disabled={readonlyTabs.includes('known-allergies')}
                                                                    >
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder="Select type" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="food">Food</SelectItem>
                                                                            <SelectItem value="medication">Medication</SelectItem>
                                                                            <SelectItem value="environmental">Environmental</SelectItem>
                                                                            <SelectItem value="contact">Contact</SelectItem>
                                                                            <SelectItem value="other">Other</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    <Label htmlFor={`allergy_severity_${index}`}>
                                                                        Severity <span className="text-red-500">*</span>
                                                                    </Label>
                                                                    <Select
                                                                        value={allergy.severity}
                                                                        onValueChange={(value) => {
                                                                            const updatedAllergies = [...data.known_allergies];
                                                                            updatedAllergies[index].severity = value;
                                                                            setData('known_allergies', updatedAllergies);
                                                                        }}
                                                                        disabled={readonlyTabs.includes('known-allergies')}
                                                                    >
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder="Select severity" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="mild">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                                                                    Mild
                                                                                </div>
                                                                            </SelectItem>
                                                                            <SelectItem value="moderate">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                                                                                    Moderate
                                                                                </div>
                                                                            </SelectItem>
                                                                            <SelectItem value="severe">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                                                                    Severe
                                                                                </div>
                                                                            </SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 gap-4">
                                                                <div className="space-y-2">
                                                                    <Label htmlFor={`allergy_reaction_${index}`}>
                                                                        Reaction
                                                                    </Label>
                                                                    <Input
                                                                        id={`allergy_reaction_${index}`}
                                                                        value={allergy.reaction}
                                                                        onChange={(e) => {
                                                                            const updatedAllergies = [...data.known_allergies];
                                                                            updatedAllergies[index].reaction = e.target.value;
                                                                            setData('known_allergies', updatedAllergies);
                                                                        }}
                                                                        placeholder="e.g., Hives, Swelling, Anaphylaxis"
                                                                        disabled={readonlyTabs.includes('known-allergies')}
                                                                        className="placeholder:text-gray-400"
                                                                        maxLength={200}
                                                                    />
                                                                </div>

                                                                <div className="space-y-2">
                                                                    <Label htmlFor={`allergy_notes_${index}`}>
                                                                        Additional Notes
                                                                    </Label>
                                                                    <Textarea
                                                                        id={`allergy_notes_${index}`}
                                                                        value={allergy.notes}
                                                                        onChange={(e) => {
                                                                            const updatedAllergies = [...data.known_allergies];
                                                                            updatedAllergies[index].notes = e.target.value;
                                                                            setData('known_allergies', updatedAllergies);
                                                                        }}
                                                                        placeholder="Additional information about this allergy..."
                                                                        disabled={readonlyTabs.includes('known-allergies')}
                                                                        className="min-h-[80px] placeholder:text-gray-400"
                                                                        rows={3}
                                                                        maxLength={500}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tab Navigation Buttons */}
                                    <div className="flex justify-between items-center pt-6 border-t border-gray-100">
                                        <div>
                                            {getPreviousTab() && (
                                                <Button 
                                                    type="button"
                                                    variant="outline"
                                                    onClick={handlePrevious}
                                                    className="px-6"
                                                >
                                                    Previous
                                                </Button>
                                            )}
                                        </div>
                                        <div>
                                            {getNextTab() && (
                                                <Button 
                                                    type="button"
                                                    onClick={handleNext}
                                                    // disabled={!getCurrentTabValidation()}
                                                    className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-white px-6"
                                                >
                                                    Next
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </form>
                            </TabsContent>
                       </Tabs>

                       {/* Final Submit Button - Outside of all tabs */}
                       <form onSubmit={handleSubmit} className="mt-8">
                           <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                               <div className="text-sm text-gray-600">
                                   {isFormComplete() ? (
                                       <span className="text-green-600 font-medium">✓ All sections complete - Ready to submit</span>
                                   ) : (
                                       <span>Please complete all required fields in all tabs</span>
                                   )}
                               </div>
                               <Button 
                                   type="submit" 
                                   disabled={processing || !isFormComplete()}
                                   size="lg"
                                   className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-white font-semibold px-8 py-3"
                               >
                                   {processing ? 'Creating Patient Record...' : 'Complete Intake'}
                               </Button>
                           </div>
                                               </form>
                    </div>
                 </div>
            </div>
        </>
    );
}

export default withAppLayout(CreateIntake, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'New Intake' }
    ]
}); 