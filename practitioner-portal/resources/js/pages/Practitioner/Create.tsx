import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { router, useForm, usePage } from '@inertiajs/react';
import { AlertCircle, CheckCircle, Info, ArrowLeft, Edit, Plus, Trash2, Search, Users, X, Upload, FileText, Award } from 'lucide-react';
import axios from 'axios';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useS3Upload } from '@/hooks/use-s3-upload';
import { toast } from 'sonner';
import { useEnhancedZodValidation } from '@/hooks/useEnhancedZodValidation';
import { practitionerSchema } from '@/lib/validations';
import { PhoneInput } from '@/components/phone-input';
import { Toaster } from '@/components/ui/sonner';
import { withAppLayout } from '@/utils/layout';
import { route } from 'ziggy-js';

const TABS = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'professional', label: 'Professional Details' },
    { id: 'locations', label: 'Locations' },
    { id: 'pricing', label: 'Pricing' },
];

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

const WEEKDAYS = [
    { id: 'sunday', label: 'Sunday' },
    { id: 'monday', label: 'Monday' },
    { id: 'tuesday', label: 'Tuesday' },
    { id: 'wednesday', label: 'Wednesday' },
    { id: 'thursday', label: 'Thursday' },
    { id: 'friday', label: 'Friday' },
    { id: 'saturday', label: 'Saturday' },
];

interface PractitionerCreateProps {
    practitioner?: any;
    locations?: any;
    services?: any;
    onCancel?: () => void;
    canEditProfessionalDetails?: boolean;
    canEditBasicInfo?: boolean;
    embedded?: boolean; // Add flag for when embedded in settings layout
}

function Create({ practitioner, locations, services, onCancel, canEditProfessionalDetails = true, canEditBasicInfo = true, embedded = false }: PractitionerCreateProps) {
    const { flash }: any = usePage().props;
    const [emailValidation, setEmailValidation] = useState<{ available: boolean; message: string } | null>(null);
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [showDisclaimerDialog, setShowDisclaimerDialog] = useState(false);
    const [pendingSubmit, setPendingSubmit] = useState(false);
    const [uploadingToS3, setUploadingToS3] = useState(false);

    const [activeTab, setActiveTab] = useState(flash?.activeTab || 'basic');
    const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
    const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<any>(null);
    const [availabilityData, setAvailabilityData] = useState<any>({});


    // Handle tab change with validation (no validation on tab change, only on save)
    const handleTabChange = (newTab: string) => {
        // Simply allow tab navigation without validation
        // Validation will be performed on save
        setActiveTab(newTab);
        setData('current_tab', newTab);
    };

    // 🚀 MODIFIED: Initial state now checks for existing practitioner ID from props
    // or a flash message from a new creation.
    const [basicInfoSaved, setBasicInfoSaved] = useState(!!practitioner?.id || !!flash?.practitioner_id);

    // Add state to track if basic info and professional details are locked (read-only)
    // For tenant-level editing, these should default to false (editable)
    const [basicInfoLocked, setBasicInfoLocked] = useState(!!flash?.basic_info_locked || !canEditBasicInfo);
    const [professionalDetailsLocked, setProfessionalDetailsLocked] = useState(!!flash?.professional_details_locked || !canEditProfessionalDetails);
    
    const [locationsData, setLocationsData] = useState<any[]>([]);
    const [loadingLocations, setLoadingLocations] = useState(false);
    
    // Practitioner lookup state
    const [showLookupForm, setShowLookupForm] = useState(!practitioner?.id);
    const [lookupFirstName, setLookupFirstName] = useState('');
    const [lookupLastName, setLookupLastName] = useState('');
    const [lookupLicenseNumber, setLookupLicenseNumber] = useState('');
    const [lookupResults, setLookupResults] = useState<any[]>([]);
    const [searchingLookup, setSearchingLookup] = useState(false);
    const [linkingPractitioner, setLinkingPractitioner] = useState(false);
    const [lookupPerformed, setLookupPerformed] = useState(false);
    const [lookupErrors, setLookupErrors] = useState<any>(null);
    
    const [locationOperatingHours, setLocationOperatingHours] = useState<any[]>([]);
    
    const [showLinkConfirmation, setShowLinkConfirmation] = useState(false);
    const [selectedPractitionerToLink, setSelectedPractitionerToLink] = useState<any>(null);
    
    const [lookupFieldsLocked, setLookupFieldsLocked] = useState(false);
    
    // New states for linking vs creating behavior
    const [isLinkingExisting, setIsLinkingExisting] = useState(false);
    const [lookupUsedLicenseNumber, setLookupUsedLicenseNumber] = useState(false);
    
    const [practitionerServices, setPractitionerServices] = useState<any[]>([]);
    const [loadingServices, setLoadingServices] = useState(false);
    const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
    const [editingPrice, setEditingPrice] = useState<string>('');
    const [originalPrice, setOriginalPrice] = useState<string>('');
    
    
    // S3 upload hook
    const { uploadFile, uploading: s3Uploading, progress, error: s3Error, uploadedFile, reset: resetS3 } = useS3Upload();

    const [uploadedFiles, setUploadedFiles] = useState<{
        profile_picture?: File;
        resume_files: File[];
        licensing_docs: File[];
        certificates: File[];
    }>({
        resume_files: [],
        licensing_docs: [],
        certificates: [],
    });

    const [s3Files, setS3Files] = useState<{
        profile_picture_s3_key?: string;
        profile_picture_url?: string;
        document_s3_keys: Record<string, string[]>;
    }>({
        document_s3_keys: {}
    });

    const { data, setData, post, processing, errors } = useForm({
        // 🚀 MODIFIED: Use practitioner ID from props or flash to correctly link data
        practitioner_id: practitioner?.id || flash?.practitioner_id || null,
        current_tab: 'basic',
        first_name: practitioner?.first_name || '',
        last_name: practitioner?.last_name || '',
        title: practitioner?.title || '',
        email: practitioner?.email || '',
        phone_number: practitioner?.phone_number || '',
        extension: practitioner?.extension || '',
        gender: practitioner?.gender || '',
        pronoun: practitioner?.pronoun || '',
        is_active: practitioner?.is_active ?? true,
        short_bio: practitioner?.short_bio || '',
        full_bio: practitioner?.full_bio || '',
        profile_picture: null as File | null,
        profile_picture_s3_key: practitioner?.profile_picture_s3_key || '',
        profile_picture_url: practitioner?.profile_picture_url || '',
        
        credentials: practitioner?.credentials || [],
        years_of_experience: practitioner?.years_of_experience || '',
        license_number: practitioner?.license_number || '',
        professional_associations: practitioner?.professional_associations || [],
        primary_specialties: practitioner?.primary_specialties || [],
        therapeutic_modalities: practitioner?.therapeutic_modalities || [],
        client_types_served: practitioner?.client_types_served || [],
        languages_spoken: practitioner?.languages_spoken || [],
        resume_files: practitioner?.resume_files || [],
        licensing_docs: practitioner?.licensing_docs || [],
        certificates: practitioner?.certificates || [],
        
        location_assignments: practitioner?.location_assignments || [],
        locations: [] as any[],
    });

    // Enhanced Zod validation
    const { validateFieldOnBlur, getFieldError: getZodFieldError, clearFieldError } = useEnhancedZodValidation(practitionerSchema);

    // Helper function to capitalize names
    const capitalizeName = (value: string): string => {
        if (!value.trim()) return value;
        return value.trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };

    // Enhanced field change handler with validation
    const handleFieldChange = (fieldName: string, value: string) => {
        let processedValue = value;
        
        // Apply automatic capitalization and number restrictions for name fields
        if (['first_name', 'last_name', 'pronoun'].includes(fieldName)) {
            // Remove numbers and special characters except spaces, hyphens, and apostrophes
            processedValue = value.replace(/[^A-Za-z\s\-\']/g, '');
            processedValue = capitalizeName(processedValue);
        }
        
        setData(fieldName as any, processedValue);
        
        // Clear field error when user starts typing
        if (getFieldError(fieldName)) {
            clearFieldError(fieldName);
        }
    };

    // Enhanced field blur handler
    const handleFieldBlur = (fieldName: string, value: string) => {
        validateFieldOnBlur(fieldName, value);
    };

    // Get field error (prioritizes Zod validation over backend errors)
    const getFieldError = (fieldName: string): string | undefined => {
        return getZodFieldError(fieldName) || (errors as any)[fieldName];
    };

    // 🚀 MODIFIED: This useEffect is the key to managing tab state
    useEffect(() => {
        // If a practitioner ID exists (either from initial props or from a recent save)
        if (practitioner?.id || flash?.practitioner_id) {
            // Set the form's practitioner_id to the correct value
            const practitionerId = practitioner?.id || flash.practitioner_id;
            setData('practitioner_id', practitionerId);
            
            // Set basic info as saved to enable other tabs
            setBasicInfoSaved(true);
            
            // If the server returned a new activeTab in the flash message, switch to it
            if (flash?.activeTab) {
                setActiveTab(flash.activeTab);
            }

            // Set locked states from flash messages or props
            // Allow unlocking if canEdit props are true
            setBasicInfoLocked(!!flash?.basic_info_locked || !canEditBasicInfo);
            setProfessionalDetailsLocked(!!flash?.professional_details_locked || !canEditProfessionalDetails);
        }
    }, [practitioner, flash, canEditBasicInfo, canEditProfessionalDetails]); // Dependency array: run this effect whenever practitioner, flash, or edit permissions change

    React.useEffect(() => {
        if (activeTab === 'pricing' && data.practitioner_id) {
            loadPractitionerServices();
        }
    }, [activeTab, data.practitioner_id]);

    // Display flash messages as toast notifications
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
        if (flash?.info) {
            toast.info(flash.info);
        }
    }, [flash]);

    const loadPractitionerServices = async () => {
        if (!data.practitioner_id) return;
        
        setLoadingServices(true);
        try {
            const response = await fetch(route('practitioners.services.get', data.practitioner_id));
            const result = await response.json();
            setPractitionerServices(result.services || []);
        } catch (error) {
            console.error('Error loading practitioner services:', error);
            toast.error('Unable to load services', {
                description: 'Failed to load practitioner services. Please refresh the page and try again.'
            });
        } finally {
            setLoadingServices(false);
        }
    };

    const performPractitionerLookup = async () => {
        // Clear previous errors
        setLookupErrors(null);
        
        if (!lookupFirstName.trim() || !lookupLastName.trim()) {
            const errors: any = {};
            if (!lookupFirstName.trim()) {
                errors.first_name = ['First name is required.'];
            }
            if (!lookupLastName.trim()) {
                errors.last_name = ['Last name is required.'];
            }
            setLookupErrors(errors);
            return;
        }

        setSearchingLookup(true);
        setLookupPerformed(true);
        setLookupUsedLicenseNumber(!!lookupLicenseNumber.trim()); // Track if license was used
        try {
            const response = await axios.post(route('practitioners.search'), {
                first_name: lookupFirstName.trim(),
                last_name: lookupLastName.trim(),
                license_number: lookupLicenseNumber.trim() || null
            });

            setLookupResults(response.data.practitioners || []);
            setLookupErrors(null); // Clear errors on success
        } catch (error: any) {
            console.error('Error searching practitioners:', error);
            setLookupResults([]);

            if (error.response?.status === 422) {
                // Validation errors
                try {
                    setLookupErrors(error.response.data.errors || {});
                } catch (dataError) {
                    console.error('Error processing validation response:', dataError);
                    // If we can't parse validation response, just clear errors
                    setLookupErrors(null);
                }
            } else if (error.response) {
                // Other HTTP errors - log and clear errors to prevent confusion
                console.error('HTTP error during lookup:', error.response.status, error.response.statusText);
                setLookupErrors(null);
            } else if (error.request) {
                // Network error - log and clear errors
                console.error('Network error during lookup:', error.request);
                setLookupErrors(null);
            } else {
                // Other errors - log and clear errors
                console.error('Unexpected error during lookup:', error.message);
                setLookupErrors(null);
            }
        } finally {
            setSearchingLookup(false);
        }
    };

    const selectPractitionerFromLookup = (practitioner: any) => {
        setSelectedPractitionerToLink(practitioner);
        setShowLinkConfirmation(true);
    };

    const fillFormFromLookup = () => {
        // Auto-fill the form with lookup data if no practitioner was found
        setData('first_name', lookupFirstName);
        setData('last_name', lookupLastName);
        
        // If license number was provided in lookup, pre-fill it (it will be locked)
        if (lookupLicenseNumber.trim()) {
            setData('license_number', lookupLicenseNumber.trim());
        }
        
        setShowLookupForm(false);
        setLookupFieldsLocked(true); // Lock first_name and last_name
        setIsLinkingExisting(false); // Mark as creating new practitioner
        setLookupUsedLicenseNumber(!!lookupLicenseNumber.trim()); // Track if license was used
    };

    const resetLookup = () => {
        setLookupFirstName('');
        setLookupLastName('');
        setLookupLicenseNumber('');
        setLookupResults([]);
        setLookupPerformed(false);
        setLookupErrors(null);
        setShowLookupForm(true);
        setLookupFieldsLocked(false); // Unlock fields when lookup is reset
    };

    const linkExistingPractitioner = (practitioner: any) => {
        setLinkingPractitioner(true);

        router.post(route('practitioners.link'), {
            practitioner_id: practitioner.id
        }, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                setLinkingPractitioner(false);
                setIsLinkingExisting(true); // Mark as linking existing practitioner
                // Backend will redirect back with flash message
                // Navigate to practitioners list after successful link
                router.get(route('practitioners.list'));
            },
            onError: (errors: any) => {
                setLinkingPractitioner(false);
                console.error('Error linking practitioner:', errors);

                // Handle errors gracefully with toast
                if (errors.error) {
                    toast.error('Unable to link practitioner', {
                        description: errors.error
                    });
                } else if (errors.message) {
                    toast.error('Unable to link practitioner', {
                        description: errors.message
                    });
                } else {
                    toast.error('Unable to link practitioner', {
                        description: 'An unexpected error occurred. Please try again.'
                    });
                }
            }
        });
    };

    const confirmLinkPractitioner = () => {
        if (selectedPractitionerToLink) {
            // Note: Don't auto-fill form with masked data, just link directly
            linkExistingPractitioner(selectedPractitionerToLink);
            
            setShowLinkConfirmation(false);
            setSelectedPractitionerToLink(null);
        }
    };

    const cancelLinkPractitioner = () => {
        setShowLinkConfirmation(false);
        setSelectedPractitionerToLink(null);
        // Reset to basic tab when canceling dialog
        setActiveTab('basic');
    };

    React.useEffect(() => {
        if (data.practitioner_id) {
            loadLocations();
        }
    }, [data.practitioner_id]);

    const loadLocations = async () => {
        if (!data.practitioner_id) return;
        
        setLoadingLocations(true);
        try {
            const response = await fetch(route('practitioners.locations.get', data.practitioner_id), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'X-Requested-With': 'XMLHttpRequest',
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            setLocationsData(result.locations || []);
        } catch (error) {
            console.error('Error loading locations:', error);
            setLocationsData([]);
            toast.error('Unable to load locations', {
                description: 'Failed to load location data. Please refresh the page and try again.'
            });
        } finally {
            setLoadingLocations(false);
        }
    };

    const validateEmail = async () => {
        if (!data.email.trim()) {
            setEmailValidation(null);
            return;
        }

        setCheckingEmail(true);

        try {
            const response = await fetch(route('practitioners.validate-email'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'X-Requested-With': 'XMLHttpRequest',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    email: data.email,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            setEmailValidation(result);
        } catch (error) {
            console.error('Error validating email:', error);
            setEmailValidation({
                available: false,
                message: 'Error validating email. Please try again.',
            });
            toast.error('Email validation failed', {
                description: 'Unable to validate email address. Please try again.'
            });
        } finally {
            setCheckingEmail(false);
        }
    };
    const SELECTED_FIELDS = [
  'first_name',
  'last_name',
  'title',
  'email',
  'phone_number',
  'extension',
  'gender',
  'pronoun',
  'short_bio',
  'full_bio',
] as const;

type SelectedField = typeof SELECTED_FIELDS[number];

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
  'title',
  'email',
  'phone_number',
  'extension',
  'gender',
  'pronoun',
  'short_bio',
  'full_bio',
];

// Click handler for your Next button
// const handleValidateThenNext = () => {
//   const isValid = validateOnlySelectedFields(data);
//   if (isValid) {
//     handleNext();
//     return;
//   }

//   // OPTIONAL: focus & scroll to the first invalid field
//   const firstInvalid = FIELD_ORDER.find((f) => getFieldError(f));
//   if (firstInvalid) {
//     const el = document.getElementById(firstInvalid);
//     if (el) {
//       el.scrollIntoView({ behavior: 'smooth', block: 'center' });
//       (el as HTMLElement).focus?.();
//     }
//   }
// };



    const handleSubmitClick = async (e: React.FormEvent) => {
        e.preventDefault();

        if (activeTab === 'basic') {
            // Check if basic info is complete first
              const isValid = validateOnlySelectedFields(data);
            if (!isValid) {
                // handleNext();
                console.log('Basic info invalid, proceeding to next tab');
                return;
            }
            if (!isBasicInfoComplete()) {
                toast.error('Incomplete Information', {
                    description: 'Please fill in all required fields: first name, last name, email, and phone number.'
                });
                return;
            }

            // Validate that lookup was performed before proceeding
            if (showLookupForm && !lookupPerformed) {
                toast.error('Lookup Required', {
                    description: 'Please search for existing practitioners before proceeding.'
                });
                return;
            }
            // For basic tab, just move to next tab without saving
            setActiveTab('professional');
            setData('current_tab', 'professional');
            return;
        }

        // Check if professional details are locked (already saved)
        if (activeTab === 'professional' && professionalDetailsLocked) {
            // If locked, just move to next tab
            setActiveTab('locations');
            setData('current_tab', 'locations');
            return;
        }

        if (activeTab === 'pricing') {
            setPendingSubmit(true);
            const success = await savePractitionerServices();
            setPendingSubmit(false);
            return;
        }

        setShowDisclaimerDialog(true);
        setPendingSubmit(true);
    };

    const getSubmitRoute = () => {
        const routeMap = {
            'basic': 'practitioners.store-basic-info',
            'professional': 'practitioners.store-combined-details', // New combined route
            'locations': 'practitioners.store-locations',
            'pricing': 'practitioners.store-pricing'
        };
        return routeMap[activeTab as keyof typeof routeMap] || 'practitioners.store-basic-info';
    };

    const handleDisclaimerAccept = async () => {
        setShowDisclaimerDialog(false);

        console.log('[Form Submit] Starting submission process');

        // Upload all files to S3 first
        const uploadSuccess = await uploadAllFilesToS3();

        if (!uploadSuccess) {
            console.error('[Form Submit] File upload failed, aborting submission');
            setPendingSubmit(false);
            return;
        }

        console.log('[Form Submit] Files uploaded successfully, proceeding with form submission');
        console.log('[Form Submit] S3 data ready for submission:', {
            activeTab,
            s3Files: {
                profile_picture_s3_key: s3Files.profile_picture_s3_key,
                profile_picture_url: s3Files.profile_picture_url,
                document_s3_keys: s3Files.document_s3_keys
            },
            formData: {
                profile_picture_s3_key: data.profile_picture_s3_key,
                profile_picture_url: data.profile_picture_url,
                practitioner_id: data.practitioner_id
            },
            timestamp: new Date().toISOString()
        });

        setData('current_tab', activeTab);

        if (practitioner?.id) {
            setData('practitioner_id', practitioner.id);
        }

        const options = {
            onSuccess: (page: any) => {
                setPendingSubmit(false);
                // If we just saved basic info for a new practitioner, enable other tabs
                if (activeTab === 'basic' && !data.practitioner_id) {
                    // Check for practitioner data in flash or page props
                    const newPractitionerId = page.props?.flash?.practitioner_id || page.props?.practitioner?.id;
                    if (newPractitionerId) {
                        setBasicInfoSaved(true);
                        setData('practitioner_id', newPractitionerId);
                        
                        // Auto-switch to professional details tab if specified in flash
                        if (page.props?.flash?.activeTab) {
                            setActiveTab(page.props.flash.activeTab);
                        }
                    }
                }
                // Inertia will handle the prop updates and the useEffect hook will handle the tab transition.
            },
            onError: (errors: any) => {
                if (hasBasicInfoErrors()) setActiveTab('basic');
                if (hasProfessionalDetailsErrors()) setActiveTab('professional');
                setPendingSubmit(false);
            },
            forceFormData: true,
            transform: (data: any) => {
                const formData = new FormData();
                
                Object.keys(data).forEach(key => {
                    if (!['profile_picture', 'resume_files', 'licensing_docs', 'certificates'].includes(key)) {
                        if (Array.isArray(data[key])) {
                            data[key].forEach((item: any, index: number) => {
                                formData.append(`${key}[${index}]`, item);
                            });
                        } else if (data[key] !== null && data[key] !== undefined) {
                            formData.append(key, data[key]);
                        }
                    }
                });

                // Add S3 profile picture data instead of file
                if (data.profile_picture_s3_key) {
                    console.log('[Form Submit] Adding profile S3 keys to FormData:', {
                        profile_picture_s3_key: data.profile_picture_s3_key,
                        profile_picture_s3_url: data.profile_picture_url,
                        timestamp: new Date().toISOString()
                    });
                    formData.append('profile_picture_s3_key', data.profile_picture_s3_key);
                    formData.append('profile_picture_s3_url', data.profile_picture_url);
                } else if (data.profile_picture) {
                    console.log('[Form Submit] No S3 key, falling back to file upload');
                    // Fallback to file upload if S3 key not available
                    formData.append('profile_picture', data.profile_picture);
                }

                // Add S3 document data instead of files
                if (s3Files.document_s3_keys.resume_files?.length > 0) {
                    console.log('[Form Submit] Adding resume_files S3 keys to FormData:', {
                        fileType: 'resume_files',
                        keys: s3Files.document_s3_keys.resume_files,
                        count: s3Files.document_s3_keys.resume_files.length,
                        timestamp: new Date().toISOString()
                    });
                    s3Files.document_s3_keys.resume_files.forEach((s3Key, index) => {
                        formData.append(`resume_files_s3_keys[${index}]`, s3Key);
                    });
                } else {
                    console.log('[Form Submit] No S3 keys for resume_files, using file upload');
                    uploadedFiles.resume_files.forEach((file, index) => {
                        formData.append(`resume_files[${index}]`, file);
                    });
                }

                if (s3Files.document_s3_keys.licensing_docs?.length > 0) {
                    console.log('[Form Submit] Adding licensing_docs S3 keys to FormData:', {
                        fileType: 'licensing_docs',
                        keys: s3Files.document_s3_keys.licensing_docs,
                        count: s3Files.document_s3_keys.licensing_docs.length,
                        timestamp: new Date().toISOString()
                    });
                    s3Files.document_s3_keys.licensing_docs.forEach((s3Key, index) => {
                        formData.append(`licensing_docs_s3_keys[${index}]`, s3Key);
                    });
                } else {
                    console.log('[Form Submit] No S3 keys for licensing_docs, using file upload');
                    uploadedFiles.licensing_docs.forEach((file, index) => {
                        formData.append(`licensing_docs[${index}]`, file);
                    });
                }

                if (s3Files.document_s3_keys.certificates?.length > 0) {
                    console.log('[Form Submit] Adding certificates S3 keys to FormData:', {
                        fileType: 'certificates',
                        keys: s3Files.document_s3_keys.certificates,
                        count: s3Files.document_s3_keys.certificates.length,
                        timestamp: new Date().toISOString()
                    });
                    s3Files.document_s3_keys.certificates.forEach((s3Key, index) => {
                        formData.append(`certificates_s3_keys[${index}]`, s3Key);
                    });
                } else {
                    console.log('[Form Submit] No S3 keys for certificates, using file upload');
                    uploadedFiles.certificates.forEach((file, index) => {
                        formData.append(`certificates[${index}]`, file);
                    });
                }
                
                return formData;
            }
        };

        setTimeout(() => {
            post(route(getSubmitRoute()), options);
        }, 50);
    };

    const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Use the S3 upload function for profile pictures
            await handleFileUpload('profile_picture', e.target.files);
        }
    };

    const handleFileUpload = async (fileType: 'profile_picture' | 'resume_files' | 'licensing_docs' | 'certificates', files: FileList | null) => {
        if (!files) return;

        console.log('PractitionerCreate: handleFileUpload called (storing locally)', { fileType, filesCount: files.length });

        if (fileType === 'profile_picture') {
            const file = files[0];

            console.log('[File Selection] Profile picture selected:', {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                timestamp: new Date().toISOString()
            });

            // Validate file
            if (!file.type.startsWith('image/')) {
                console.error('[File Selection] Validation failed: Not an image file');
                toast.error('Please select an image file.');
                return;
            }

            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                console.error('[File Selection] Validation failed: File too large', { fileSize: file.size });
                toast.error('File size must be less than 5MB.');
                return;
            }

            console.log('[File Selection] File validation passed, storing locally');

            // Create preview immediately
            const reader = new FileReader();
            reader.onload = (e) => setProfilePicturePreview(e.target?.result as string);
            reader.readAsDataURL(file);

            // Store file locally - will be uploaded to S3 on form submission
            setUploadedFiles(prev => ({ ...prev, profile_picture: file }));
            setData('profile_picture', file);

            toast.success('Profile Picture Selected', {
                description: 'Profile picture will be uploaded when you save.'
            });

        } else {
            // For document uploads, store locally
            const filesToUpload = Array.from(files);

            console.log('[File Selection] Documents selected (storing locally):', {
                fileType,
                numberOfFiles: filesToUpload.length,
                fileNames: filesToUpload.map(f => f.name),
                fileSizes: filesToUpload.map(f => f.size),
                timestamp: new Date().toISOString()
            });

            // Store the files locally for form submission
            setUploadedFiles(prev => ({
                ...prev,
                [fileType]: [...prev[fileType], ...filesToUpload]
            }));

            setData(fileType, [...uploadedFiles[fileType], ...filesToUpload] as any);

            toast.success('Files Selected', {
                description: `${filesToUpload.length} file(s) will be uploaded when you save.`
            });
        }
    };

    // Upload all files to S3 before form submission
    const uploadAllFilesToS3 = async () => {
        console.log('[S3 Batch Upload] Starting batch upload for all files');

        setUploadingToS3(true);

        try {
            const practitionerId = data.practitioner_id || 'new';

            // Upload profile picture if exists
            if (uploadedFiles.profile_picture) {
                console.log('[S3 Batch Upload] Uploading profile picture');
                const file = uploadedFiles.profile_picture;
                const s3Key = `practitioners/${practitionerId}/profile/avatar.${file.name.split('.').pop()}`;

                const response = await uploadFile(file, {
                    key: s3Key,
                    expiresMinutes: 1440,
                });

                console.log('[S3 Batch Upload] Profile picture uploaded:', {
                    key: response.key,
                    signedUrl: response.signed_url,
                });

                // Store S3 information
                setS3Files(prev => ({
                    ...prev,
                    profile_picture_s3_key: response.key,
                    profile_picture_url: response.signed_url
                }));

                setData('profile_picture_s3_key', response.key);
                setData('profile_picture_url', response.signed_url);
            }

            // Upload documents (resume_files, licensing_docs, certificates)
            const documentTypes = ['resume_files', 'licensing_docs', 'certificates'] as const;

            for (const fileType of documentTypes) {
                const files = uploadedFiles[fileType];

                if (files.length > 0) {
                    console.log(`[S3 Batch Upload] Uploading ${files.length} ${fileType} files`);

                    const uploadPromises = files.map(async (file, index) => {
                        const s3Key = `practitioners/${practitionerId}/${fileType}/${Date.now()}_${file.name}`;

                        console.log(`[S3 Batch Upload] Uploading ${fileType} file ${index + 1}/${files.length}`, {
                            fileName: file.name,
                            s3Key,
                        });

                        return await uploadFile(file, {
                            key: s3Key,
                            expiresMinutes: 1440
                        });
                    });

                    const responses = await Promise.all(uploadPromises);

                    console.log(`[S3 Batch Upload] ${fileType} uploaded successfully`, {
                        count: responses.length,
                        keys: responses.map(r => r.key),
                    });

                    // Store S3 keys for documents
                    setS3Files(prev => {
                        const newKeys = responses.map(r => r.key);
                        const previousKeys = prev.document_s3_keys[fileType] || [];
                        const mergedKeys = [...previousKeys, ...newKeys];

                        return {
                            ...prev,
                            document_s3_keys: {
                                ...prev.document_s3_keys,
                                [fileType]: mergedKeys
                            }
                        };
                    });
                }
            }

            console.log('[S3 Batch Upload] All files uploaded successfully');
            setUploadingToS3(false);
            return true;
        } catch (error) {
            console.error('[S3 Batch Upload] Upload failed', { error });
            setUploadingToS3(false);
            toast.error('File Upload Failed', {
                description: `Failed to upload files: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
            return false;
        }
    };

    const removeFile = (fileType: 'profile_picture' | 'resume_files' | 'licensing_docs' | 'certificates', index?: number) => {
        if (fileType === 'profile_picture') {
            setUploadedFiles(prev => ({ ...prev, profile_picture: undefined }));
            setData('profile_picture', null);
            setProfilePicturePreview(null);
            // Clear S3 keys
            setS3Files(prev => ({
                ...prev,
                profile_picture_s3_key: '',
                profile_picture_url: ''
            }));
            setData('profile_picture_s3_key', '');
            setData('profile_picture_url', '');
        } else {
            const newFiles = uploadedFiles[fileType].filter((_, i) => i !== index);
            setUploadedFiles(prev => ({ ...prev, [fileType]: newFiles }));
            setData(fileType, newFiles as any);
            // Clear S3 keys for this file type
            setS3Files(prev => ({
                ...prev,
                document_s3_keys: {
                    ...prev.document_s3_keys,
                    [fileType]: []
                }
            }));
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent, fileType: 'resume_files' | 'licensing_docs' | 'certificates') => {
        e.preventDefault();
        e.stopPropagation();
        const files = e.dataTransfer.files;
        handleFileUpload(fileType, files);
    };

    const handleDisclaimerCancel = () => {
        setShowDisclaimerDialog(false);
        setPendingSubmit(false);
    };

    const addArrayItem = (field: keyof typeof data, value: string) => {
        const currentArray = data[field] as string[];
        if (value && currentArray && !currentArray.includes(value)) {
            setData(field, [...currentArray, value] as any);
        }
    };

    const removeArrayItem = (field: keyof typeof data, index: number) => {
        const currentArray = data[field] as string[];
        if (currentArray) {
            setData(field, currentArray.filter((_, i) => i !== index) as any);
        }
    };

    const toggleService = async (serviceId: number, isOffered: boolean) => {
        console.log('🔄 toggleService called:', { serviceId, isOffered });

        // Create updated services array with the new toggle state
        const updatedServices = practitionerServices.map(service =>
            service.id === serviceId
                ? { ...service, pivot: { ...service.pivot, is_offered: isOffered } }
                : service
        );

        // Update local state immediately for responsive UI
        setPractitionerServices(updatedServices);

        // Auto-save to backend with the updated data
        console.log('💾 Auto-saving service toggle...');

        const success = await savePractitionerServices(updatedServices);
        if (!success) {
            // Revert on failure
            console.error('❌ Failed to save service toggle, reverting...');
            setPractitionerServices(practitionerServices);
        }
    };

    const updateServicePrice = (serviceId: number, customPrice: string) => {
        console.log('🔧 updateServicePrice called:', { serviceId, customPrice });

        setPractitionerServices(prev => {
            const updated = prev.map(service =>
                service.id === serviceId
                    ? {
                        ...service,
                        pivot: {
                            ...service.pivot,
                            custom_price: customPrice,
                            is_offered: true  // Ensure service is marked as offered when price is updated
                        }
                    }
                    : service
            );

            const updatedService = updated.find(s => s.id === serviceId);
            console.log('✅ Updated service state:', updatedService);

            return updated;
        });
    };

    const startEditingPrice = (serviceId: number, currentPrice: string) => {
        setEditingServiceId(serviceId);
        setEditingPrice(currentPrice);
        setOriginalPrice(currentPrice); // Store original for comparison
    };

    const cancelEditingPrice = () => {
        setEditingServiceId(null);
        setEditingPrice('');
        setOriginalPrice('');
    };

    const saveEditingPrice = async (serviceId: number) => {
        console.log('💾 saveEditingPrice called:', { serviceId, editingPrice, originalPrice });

        // Check if price actually changed
        if (editingPrice === originalPrice) {
            console.log('⚠️ Price unchanged, skipping save');
            setEditingServiceId(null);
            setEditingPrice('');
            setOriginalPrice('');
            return;
        }

        console.log('🔄 Updating local state with new price...');

        // Set loading state
        setLoadingServices(true);

        // Update state and save in one operation to prevent race condition
        setPractitionerServices(prev => {
            const updatedServices = prev.map(service =>
                service.id === serviceId
                    ? {
                        ...service,
                        pivot: {
                            ...service.pivot,
                            custom_price: editingPrice,
                            is_offered: true
                        }
                    }
                    : service
            );

            const updatedService = updatedServices.find(s => s.id === serviceId);
            console.log('✅ Updated service state:', updatedService);
            console.log('📤 Calling savePractitionerServices with updated data...');

            // Save with the updated data
            (async () => {
                try {
                    const payload = { services: updatedServices };
                    console.log('📨 Request payload:', JSON.stringify(payload, null, 2));

                    const url = route('practitioners.services.store', data.practitioner_id);
                    console.log('🌐 POST URL:', url);

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                        },
                        body: JSON.stringify(payload)
                    });

                    console.log('📥 Response status:', response.status, response.statusText);

                    if (response.ok) {
                        const responseData = await response.json();
                        console.log('✅ Response data:', responseData);
                        console.log('✅ Save successful!');

                        // Clear editing state only on success
                        setEditingServiceId(null);
                        setEditingPrice('');
                        setOriginalPrice('');

                        toast.success('Price Updated', {
                            description: 'Custom price has been saved successfully.'
                        });

                        // Reload services to get fresh data from database
                        await loadPractitionerServices();
                    } else {
                        const errorData = await response.json();
                        console.error('❌ Failed to save services:', errorData);
                        console.log('❌ Save failed, reverting changes');

                        // Revert to original price on failure
                        setEditingPrice(originalPrice);
                        setPractitionerServices(prev =>
                            prev.map(s =>
                                s.id === serviceId
                                    ? { ...s, pivot: { ...s.pivot, custom_price: originalPrice } }
                                    : s
                            )
                        );

                        toast.error('Save Failed', {
                            description: 'Failed to save custom price. Please try again.'
                        });
                    }
                } catch (error) {
                    console.error('💥 Error saving services:', error);

                    // Revert on error
                    setEditingPrice(originalPrice);
                    setPractitionerServices(prev =>
                        prev.map(s =>
                            s.id === serviceId
                                ? { ...s, pivot: { ...s.pivot, custom_price: originalPrice } }
                                : s
                        )
                    );

                    toast.error('Error saving services', {
                        description: 'An unexpected error occurred while saving services. Please try again.'
                    });
                } finally {
                    setLoadingServices(false);
                }
            })();

            return updatedServices;
        });
    };

    const isPriceChanged = () => {
        return editingPrice !== originalPrice && editingPrice.trim() !== '';
    };

    const savePractitionerServices = async (servicesToSave?: any[]) => {
        if (!data.practitioner_id) {
            console.error('❌ No practitioner_id found!');
            return false;
        }

        const services = servicesToSave || practitionerServices;

        console.log('🚀 savePractitionerServices - Preparing to send data...');
        console.log('👤 Practitioner ID:', data.practitioner_id);
        console.log('📦 Services to save:', services);

        const payload = {
            services: services
        };
        console.log('📨 Request payload:', JSON.stringify(payload, null, 2));

        try {
            const url = route('practitioners.services.store', data.practitioner_id);
            console.log('🌐 POST URL:', url);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify(payload)
            });

            console.log('📥 Response status:', response.status, response.statusText);

            if (response.ok) {
                const responseData = await response.json();
                console.log('✅ Response data:', responseData);

                toast.success('Services Updated', {
                    description: 'Practitioner services updated successfully!'
                });
                return true;
            } else {
                const errorData = await response.json();
                console.error('❌ Failed to save services:', errorData);
                console.error('Response status:', response.status);

                toast.error('Failed to save services', {
                    description: 'Unable to save practitioner services. Please try again.'
                });
                return false;
            }
        } catch (error) {
            console.error('💥 Error saving services:', error);
            toast.error('Error saving services', {
                description: 'An unexpected error occurred while saving services. Please try again.'
            });
            return false;
        }
    };

    const openAvailabilityModal = (location: any) => {
        setSelectedLocation(location);
        setShowAvailabilityModal(true);
        setLocationOperatingHours([]); // No operating hours constraints

        if (data.practitioner_id) {
            fetch(route('practitioners.locations.availability.get', {
                practitioner: data.practitioner_id,
                location: location.id
            }))
            .then(response => response.json())
            .then(data => {
                setAvailabilityData(data.availability || {});
            })
            .catch(error => {
                console.error('Error loading availability:', error);
                toast.error('Unable to load availability', {
                    description: 'Failed to load practitioner availability. Please try again.'
                });
            });
        }
    };

    const saveAvailability = async () => {
        if (!data.practitioner_id || !selectedLocation) return;

        try {
            const response = await fetch(route('practitioners.locations.availability.store', {
                practitioner: data.practitioner_id,
                location: selectedLocation.id
            }), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    availability_schedule: availabilityData
                })
            });

            if (response.ok) {
                setShowAvailabilityModal(false);
                setSelectedLocation(null);
                toast.success('Availability saved successfully');
            } else {
                // Parse error message from backend
                const errorData = await response.json();
                const errorMessage = errorData.message || errorData.error || 'Unable to save practitioner availability';

                console.error('Failed to save availability:', errorData);
                toast.error('Failed to save availability', {
                    description: errorMessage
                });
            }
        } catch (error) {
            console.error('Error saving availability:', error);
            toast.error('Error saving availability', {
                description: 'An unexpected error occurred while saving availability. Please try again.'
            });
        }
    };

    const updateDayAvailability = (day: string, hours: any) => {
        setAvailabilityData((prev: any) => ({
            ...prev,
            [day]: hours
        }));
    };

    const addTimeSlot = (day: string) => {
        const currentData = (availabilityData as any)[day] || [];
        const earliestStart = getEarliestStartTime(day);
        const latestEnd = getLatestEndTime(day);
        const newTimeSlot = { start: earliestStart, end: latestEnd };
        updateDayAvailability(day, [...currentData, newTimeSlot]);
    };

    const removeTimeSlot = (day: string, slotIndex: number) => {
        const currentData = (availabilityData as any)[day] || [];
        const updated = currentData.filter((_: any, index: number) => index !== slotIndex);
        updateDayAvailability(day, updated);
    };

    const updateTimeSlot = (day: string, slotIndex: number, field: 'start' | 'end', value: string) => {
        const currentData = [...((availabilityData as any)[day] || [])];
        if (currentData[slotIndex]) {
            const earliestStart = getEarliestStartTime(day);
            const latestEnd = getLatestEndTime(day);

            if (value < earliestStart) {
                value = earliestStart;
            }
            if (value > latestEnd) {
                value = latestEnd;
            }

            if (field === 'start') {
                currentData[slotIndex].start = value;
                if (currentData[slotIndex].end && value >= currentData[slotIndex].end) {
                    const startTime = new Date(`2000-01-01T${value}:00`);
                    const minEndTime = new Date(startTime.getTime() + 30 * 60000);
                    const maxEndTime = new Date(`2000-01-01T${latestEnd}:00`);

                    const newEndTime = minEndTime <= maxEndTime ? minEndTime : maxEndTime;
                    currentData[slotIndex].end = newEndTime.toTimeString().slice(0, 5);
                }
            } else {
                currentData[slotIndex].end = value;
                if (currentData[slotIndex].start && value <= currentData[slotIndex].start) {
                    const endTime = new Date(`2000-01-01T${value}:00`);
                    const maxStartTime = new Date(endTime.getTime() - 30 * 60000);
                    const minStartTime = new Date(`2000-01-01T${earliestStart}:00`);

                    const newStartTime = maxStartTime >= minStartTime ? maxStartTime : minStartTime;
                    currentData[slotIndex].start = newStartTime.toTimeString().slice(0, 5);
                }
            }

            updateDayAvailability(day, currentData);
        }
    };

    const getOperatingHoursForDay = (dayId: string) => {
        return null; // No operating hours constraints
    };

    const isDayOperational = (dayId: string) => {
        return true; // All days are operational - no restrictions
    };

    const getEarliestStartTime = (dayId: string) => {
        return '00:00'; // No restrictions
    };

    const getLatestEndTime = (dayId: string) => {
        return '23:59'; // No restrictions
    };

    const isTimeSlotValid = (dayId: string, startTime: string, endTime: string) => {
        if (!startTime || !endTime) return false;

        // Just check that end time is after start time - no operating hours constraints
        const start = new Date(`2000-01-01T${startTime}:00`);
        const end = new Date(`2000-01-01T${endTime}:00`);

        return start < end;
    };

    const isSlotOverlapping = (dayId: string, slotIndex: number, startTime: string, endTime: string) => {
        if (!startTime || !endTime) return false;

        const dayData = (availabilityData as any)[dayId] || [];

        const currentStart = new Date(`2000-01-01T${startTime}:00`);
        const currentEnd = new Date(`2000-01-01T${endTime}:00`);

        for (let i = 0; i < dayData.length; i++) {
            if (i === slotIndex) continue;

            const otherSlot = dayData[i];
            if (!otherSlot.start || !otherSlot.end) continue;

            const otherStart = new Date(`2000-01-01T${otherSlot.start}:00`);
            const otherEnd = new Date(`2000-01-01T${otherSlot.end}:00`);

            if (currentStart < otherEnd && currentEnd > otherStart) {
                return true;
            }
        }
        return false;
    };

    const hasAnyOverlap = () => {
        for (const [dayId, slots] of Object.entries(availabilityData as Record<string, any[]>)) {
            if (!Array.isArray(slots)) continue;
            for (let i = 0; i < slots.length; i++) {
                const slot = slots[i];
                if (isSlotOverlapping(dayId, i, slot.start, slot.end)) {
                    return true;
                }
            }
        }
        return false;
    };

    const hasBasicInfoErrors = () => {
        const basicInfoFields = ['first_name', 'last_name', 'title', 'email', 'phone_number', 'extension', 'gender', 'pronoun', 'short_bio', 'full_bio', 'profile_picture'];
        return basicInfoFields.some(field => (errors as any)[field]) || (errors as any)['basic_info'];
    };

    const hasProfessionalDetailsErrors = () => {
        const professionalFields = ['credentials', 'years_of_experience', 'license_number', 'professional_associations', 'primary_specialties', 'therapeutic_modalities', 'client_types_served', 'languages_spoken', 'resume_files', 'licensing_docs', 'certificates'];
        return professionalFields.some(field => (errors as any)[field]) || (errors as any)['professional_details'];
    };

    const hasLocationErrors = () => {
        const locationFields = ['locations'];
        return locationFields.some(field => (errors as any)[field]);
    };

    const hasPricingErrors = () => {
        const pricingFields = ['pricing', 'services'];
        return pricingFields.some(field => (errors as any)[field]);
    };

    const isBasicInfoComplete = () => {
        return (
            data.first_name.trim() !== '' &&
            data.last_name.trim() !== '' &&
            data.email.trim() !== '' &&
            data.phone_number.trim() !== ''
        );
    };

    const renderLookupSection = () => (
        <div className="space-y-6">
            <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                    <CardTitle className="text-blue-800 flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Practitioner Lookup
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-blue-700 text-sm">
                        Search for existing practitioners before creating a new profile. Enter the practitioner's details to check if they're already in the system.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                        <div>
                            <Label htmlFor="lookup_first_name">First Name</Label>
                            <Input
                                id="lookup_first_name"
                                value={lookupFirstName}
                                onChange={(e) => {
                                    setLookupFirstName(e.target.value);
                                    // Reset search state when input changes (prevents bypass vulnerability)
                                    setLookupPerformed(false);
                                    setLookupResults([]);
                                    // Clear errors when user starts typing
                                    if (lookupErrors?.first_name) {
                                        setLookupErrors((prev: any) => prev ? { ...prev, first_name: null } : null);
                                    }
                                }}
                                placeholder="Enter first name"
                                disabled={searchingLookup}
                                className={lookupErrors?.first_name ? 'border-red-500' : ''}
                                maxLength={50}
                            />
                            <div className="h-5 mt-1">
                                {lookupErrors?.first_name && (
                                    <p className="text-sm text-red-600">{lookupErrors.first_name[0]}</p>
                                )}
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="lookup_last_name">Last Name</Label>
                            <Input
                                id="lookup_last_name"
                                value={lookupLastName}
                                onChange={(e) => {
                                    setLookupLastName(e.target.value);
                                    // Reset search state when input changes (prevents bypass vulnerability)
                                    setLookupPerformed(false);
                                    setLookupResults([]);
                                    // Clear errors when user starts typing
                                    if (lookupErrors?.last_name) {
                                        setLookupErrors((prev: any) => prev ? { ...prev, last_name: null } : null);
                                    }
                                }}
                                placeholder="Enter last name"
                                disabled={searchingLookup}
                                className={lookupErrors?.last_name ? 'border-red-500' : ''}
                                maxLength={50}

                            />
                            <div className="h-5 mt-1">
                                {lookupErrors?.last_name && (
                                    <p className="text-sm text-red-600">{lookupErrors.last_name[0]}</p>
                                )}
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="lookup_license_number">License Number (Optional)</Label>
                            <Input
                                id="lookup_license_number"
                                value={lookupLicenseNumber}
                                onChange={(e) => {
                                    setLookupLicenseNumber(e.target.value);
                                    // Reset search state when input changes (prevents bypass vulnerability)
                                    setLookupPerformed(false);
                                    setLookupResults([]);
                                    // Clear errors when user starts typing
                                    if (lookupErrors?.license_number) {
                                        setLookupErrors((prev: any) => prev ? { ...prev, license_number: null } : null);
                                    }
                                }}
                                placeholder="Enter license number"
                                disabled={searchingLookup}
                                maxLength={30}

                                className={lookupErrors?.license_number ? 'border-red-500' : ''}
                            />
                            <div className="h-5 mt-1">
                                {lookupErrors?.license_number && (
                                    <p className="text-sm text-red-600">{lookupErrors.license_number[0]}</p>
                                )}
                            </div>
                        </div>
                            <div className="flex gap-2 mt-6">
                            <Button
                                onClick={performPractitionerLookup}
                                disabled={searchingLookup || !lookupFirstName.trim() || !lookupLastName.trim()}
                                className="w-auto"
                            >
                                {searchingLookup ? (
                                <>
                                    <Search className="h-4 w-4 mr-2 animate-spin" />
                                    Searching...
                                </>
                                ) : (
                                <>
                                    <Search className="h-4 w-4 mr-2" />
                                    Search
                                </>
                                )}
                            </Button>

                            {lookupPerformed && (
                                <Button variant="outline" onClick={resetLookup}>
                                Reset
                                </Button>
                            )}
                            </div>

                    </div>


                    {/* Lookup Results */}
                    {lookupPerformed && (
                        <div className="mt-6">
                            {searchingLookup ? (
                                /* Loading State */
                                <div className="text-center py-8">
                                    <div className="flex flex-col items-center space-y-3">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                        <div className="text-gray-600">
                                            Searching for practitioners...
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            Looking for "{lookupFirstName} {lookupLastName}"
                                            {lookupLicenseNumber && ` with license number "${lookupLicenseNumber}"`}
                                        </div>
                                    </div>
                                </div>
                            ) : lookupResults.length > 0 ? (
                                <div className="space-y-3">
                                    <h4 className="font-medium text-gray-900">Found {lookupResults.length} matching practitioner(s):</h4>
                                    <div className="space-y-2">
                                        {lookupResults.map((practitioner) => (
                                            <div
                                                key={practitioner.id}
                                                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                                            >
                                                <div className="flex-1">
                                                    <div className="font-medium text-gray-900">
                                                        {practitioner.display_name}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {practitioner.title && `${practitioner.title} • `}
                                                        {practitioner.email}
                                                        {practitioner.license_number && (
                                                            <div className="text-xs text-gray-400 mt-1">
                                                                License: {practitioner.license_number}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-blue-600 font-medium mt-1">
                                                        Information masked for privacy
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    onClick={() => selectPractitionerFromLookup(practitioner)}
                                                    disabled={linkingPractitioner}
                                                >
                                                    Link Existing
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <div className="text-gray-500 mb-4">
                                        No existing practitioner found with the provided details
                                        {lookupLicenseNumber && ` and license number "${lookupLicenseNumber}"`}
                                    </div>
                                    <Button onClick={fillFormFromLookup} variant="outline">
                                        Create New Practitioner
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );

    const renderBasicInfo = () => (
        <div className="space-y-6">
            {showLookupForm && !practitioner?.id && (
                <>
                    {renderLookupSection()}
                    <div className="border-t pt-6">
                        <p className="text-gray-600 text-sm mb-4">
                            Complete the lookup above before proceeding with practitioner creation.
                        </p>
                    </div>
                </>
            )}

            {(!showLookupForm || practitioner?.id) && (
                <>
                    {basicInfoLocked && (
                        <Alert className="border-blue-200 bg-blue-50">
                            <Info className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-700">
                                Basic information has been saved and is now read-only. You can continue to the next steps.
                            </AlertDescription>
                        </Alert>
                    )}
                    {lookupFieldsLocked && !basicInfoLocked && (
                        <Alert className="border-blue-200 bg-blue-50">
                            <Info className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-700">
                                First Name and Last Name were auto-filled from practitioner lookup and cannot be changed.
                            </AlertDescription>
                        </Alert>
                    )}
            
            <div className="flex flex-col items-center space-y-4">
                <div className="relative m-3">
                    <Avatar className="w-24 h-24">
                        <AvatarImage
                            src={profilePicturePreview || practitioner?.profile_picture_path || "/placeholder-avatar.jpg"}
                            alt="Profile"
                        />
                        <AvatarFallback className="text-lg">
                            {data.first_name?.[0]}{data.last_name?.[0]}
                        </AvatarFallback>
                    </Avatar>
                    <label
                        htmlFor="profile-picture-upload"
                        className={`absolute -bottom-0 -right-1 rounded-full w-6 h-6 p-0 bg-white border flex items-center justify-center cursor-pointer hover:bg-gray-50 ${
                            getFieldError('profile_picture') ? 'border-red-500' : 'border-gray-300'
                        }`}
                    >
                        <Edit className="w-4 h-4" />
                    </label>
                    <input
                        id="profile-picture-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleProfilePictureChange}
                        className="hidden"
                    />
                </div>

                {/* S3 Upload Progress */}
                {s3Uploading && (
                    <div className="space-y-2 w-full max-w-xs">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-blue-600">Uploading...</span>
                            <span className="text-blue-600">{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                {/* Success Message */}
                {uploadedFile && !s3Uploading && (
                    <div className="text-green-600 text-sm flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Uploaded Successfully
                    </div>
                )}


                {getFieldError('profile_picture') && (
                    <p className="text-sm text-red-500 text-center">{getFieldError('profile_picture')}</p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="first_name" className="text-sm font-medium text-gray-700">
                        First Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="first_name"
                        value={data.first_name}
                        onChange={(e) => handleFieldChange('first_name', e.target.value)}
                        onBlur={(e) => handleFieldBlur('first_name', e.target.value)}
                        placeholder="Enter first name"
                        disabled={lookupFieldsLocked}
                        className={`h-10 placeholder-gray-400 ${(getFieldError('first_name')) ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'} ${lookupFieldsLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        maxLength={50}
                    />
                    {getFieldError('first_name') && <p className="text-sm text-red-500 mt-1">{getFieldError('first_name')}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="last_name" className="text-sm font-medium text-gray-700">
                        Last Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="last_name"
                        value={data.last_name}
                        onChange={(e) => handleFieldChange('last_name', e.target.value)}
                        onBlur={(e) => handleFieldBlur('last_name', e.target.value)}
                        placeholder="Enter last name"
                        disabled={lookupFieldsLocked}
                        className={`h-10 placeholder-gray-400 ${(getFieldError('last_name')) ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'} ${lookupFieldsLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        maxLength={50}
                    />
                    {getFieldError('last_name') && <p className="text-sm text-red-500 mt-1">{getFieldError('last_name')}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="title" className="text-sm font-medium text-gray-700">
                        Title <span className="text-red-500">*</span>
                    </Label>
                    <Select value={data.title} onValueChange={(value) => setData('title', value)}>
                        <SelectTrigger className={`h-10 ${getFieldError('title') ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`}>
                            <SelectValue placeholder="Select a title" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Dr.">Dr.</SelectItem>
                            <SelectItem value="Mr.">Mr.</SelectItem>
                            <SelectItem value="Ms.">Ms.</SelectItem>
                            <SelectItem value="Mrs.">Mrs.</SelectItem>
                        </SelectContent>
                    </Select>
                    {getFieldError('title') && <p className="text-sm text-red-500 mt-1">{getFieldError('title')}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                        Email Address <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-3">
                        <Input
                            id="email"
                            type="email"
                            value={data.email}
                            onChange={(e) => {
                                setData('email', e.target.value);
                                setEmailValidation(null);
                                if (getFieldError('email')) {
                                    clearFieldError('email');
                                }
                            }}
                            onBlur={(e) => handleFieldBlur('email', e.target.value)}
                            placeholder="Enter email address"
                            className={`h-10 flex-1 placeholder-gray-400 ${(getFieldError('email')) ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`}
                            maxLength={255}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={validateEmail}
                            disabled={!data.email.trim() || checkingEmail}
                            className="h-10 px-4 whitespace-nowrap"
                        >
                            {checkingEmail ? 'Checking...' : 'Validate'}
                        </Button>
                    </div>
                    {getFieldError('email') && <p className="text-sm text-red-500 mt-1">{getFieldError('email')}</p>}
                    {emailValidation && (
                        <div className="mt-2">
                            {emailValidation.available ? (
                                <Alert className="border-green-400 bg-green-50 py-2">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    <AlertDescription className="text-green-600 text-sm">
                                        {emailValidation.message}
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <Alert className="border-red-400 bg-red-50 py-2">
                                    <AlertCircle className="h-4 w-4 text-red-600" />
                                    <AlertDescription className="text-red-600 text-sm">
                                        {emailValidation.message}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="phone_number" className="text-sm font-medium text-gray-700">
                        Phone Number <span className="text-red-500">*</span>
                    </Label>
                    <PhoneInput
                        id="phone_number"
                        name="phone_number"
                        placeholder="Enter phone number"
                        value={data.phone_number || ""}
                        onChange={(val) => {
                            setData("phone_number", (val as string) || "");
                            if (getFieldError("phone_number")) {
                            clearFieldError("phone_number");
                            }
                        }}
                        onBlur={() => handleFieldBlur("phone_number", data.phone_number || "")}
                        defaultCountry="CA" // 🇨🇦 Ontario, Canada
                        international
                        countryCallingCodeEditable={false}
                        className={`h-10 w-full placeholder-gray-400 
                            ${getFieldError("phone_number")
                            ? "[&_input]:border-red-500 [&_input]:focus-visible:ring-red-500"
                            : "[&_input]:border-gray-300 [&_input]:focus-visible:ring-blue-500"}`
                        }
                        maxLength={20}
                        />
                    {getFieldError('phone_number') && <p className="text-sm text-red-500 mt-1">{getFieldError('phone_number')}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="extension" className="text-sm font-medium text-gray-700">
                        Extension <span className="text-red-500">*</span>
                    </Label>
                    <Select value={data.extension} onValueChange={(value) => setData('extension', value)}>
                        <SelectTrigger className={`h-10 ${getFieldError('extension') ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`}>
                            <SelectValue placeholder="Select Extension" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="101">101</SelectItem>
                            <SelectItem value="102">102</SelectItem>
                            <SelectItem value="103">103</SelectItem>
                        </SelectContent>
                    </Select>
                    {getFieldError('extension') && <p className="text-sm text-red-500 mt-1">{getFieldError('extension')}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="gender" className="text-sm font-medium text-gray-700">
                        Gender <span className="text-red-500">*</span>
                    </Label>
                    <Select value={data.gender} onValueChange={(value) => setData('gender', value)}>
                        <SelectTrigger className={`h-10 ${getFieldError('gender') ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`}>
                            <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                            <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                        </SelectContent>
                    </Select>
                    {getFieldError('gender') && <p className="text-sm text-red-500 mt-1">{getFieldError('gender')}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="pronoun" className="text-sm font-medium text-gray-700">
                        Pronouns <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="pronoun"
                        value={data.pronoun}
                        onChange={(e) => handleFieldChange('pronoun', e.target.value)}
                        onBlur={(e) => handleFieldBlur('pronoun', e.target.value)}
                        placeholder="e.g., they/them, she/her, he/him"
                        className={`h-10 placeholder-gray-400 ${getFieldError('pronoun') ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`}
                        maxLength={20}
                    />
                    {getFieldError('pronoun') && <p className="text-sm text-red-500 mt-1">{getFieldError('pronoun')}</p>}
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between p-4 my-4 border border-gray-300 rounded-lg bg-gray-50">
                    <div>
                        <Label className="text-sm font-medium text-gray-700">Active Status</Label>
                        <p className="text-xs text-gray-500 mt-1">Toggle practitioner availability for appointments</p>
                    </div>
                    <Switch
                        checked={data.is_active}
                        onCheckedChange={(checked) => setData('is_active', checked)}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="short_bio" className="text-sm font-medium text-gray-700">
                    Short Bio
                </Label>
                <Textarea
                    id="short_bio"
                    value={data.short_bio}
                    onChange={(e) => {
                        setData('short_bio', e.target.value);
                        if (getFieldError('short_bio')) {
                            clearFieldError('short_bio');
                        }
                    }}
                    onBlur={(e) => handleFieldBlur('short_bio', e.target.value)}
                    placeholder="Brief professional summary (e.g., Helping individuals process trauma and reclaim inner calm.)"
                    className={`min-h-[80px] placeholder-gray-400 resize-none ${getFieldError('short_bio') ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`}
                    maxLength={255}
                />
                <div className="flex justify-between items-center">
                    {getFieldError('short_bio') && <p className="text-sm text-red-500">{getFieldError('short_bio')}</p>}
                    <p className="text-xs text-gray-500 ml-auto">{data.short_bio.length}/255 characters</p>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="full_bio" className="text-sm font-medium text-gray-700">
                    Full Bio
                </Label>
                <Textarea
                    id="full_bio"
                    value={data.full_bio}
                    onChange={(e) => {
                        setData('full_bio', e.target.value);
                        if (getFieldError('full_bio')) {
                            clearFieldError('full_bio');
                        }
                    }}
                    onBlur={(e) => handleFieldBlur('full_bio', e.target.value)}
                    placeholder="Comprehensive professional biography including experience, approach, specializations, and personal touch..."
                    className={`min-h-[120px] placeholder-gray-400 resize-none ${getFieldError('full_bio') ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`}
                    maxLength={2000}
                />
                <div className="flex justify-between items-center">
                    {getFieldError('full_bio') && <p className="text-sm text-red-500">{getFieldError('full_bio')}</p>}
                    <p className="text-xs text-gray-500 ml-auto">{data.full_bio.length} characters</p>
                </div>
            </div>
                </>
            )}
        </div>
    );

    const renderProfessionalDetails = () => (
        <div className="space-y-6">
            {professionalDetailsLocked && (
                <Alert className="border-blue-200 bg-blue-50">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-700">
                        Professional details have been saved and are now read-only. You can continue to the next steps.
                    </AlertDescription>
                </Alert>
            )}
            {(lookupFieldsLocked || isLinkingExisting) && !professionalDetailsLocked && (
                <Alert className="border-blue-200 bg-blue-50">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-700">
                        {isLinkingExisting
                            ? "Practitioner information was auto-filled and all basic info fields are now read-only."
                            : lookupUsedLicenseNumber
                              ? "First name, last name, and license number were auto-filled from lookup and are read-only."
                              : "First name and last name were auto-filled from lookup and are read-only."}
                    </AlertDescription>
                </Alert>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                        Credentials <span className="text-red-500">*</span>
                    </Label>
                    <Select onValueChange={(value) => {
                        addArrayItem('credentials', value);
                        if (getFieldError('credentials')) {
                            clearFieldError('credentials');
                        }
                        // Trigger validation immediately after selection
                        setTimeout(() => {
                            validateFieldOnBlur('credentials', [...data.credentials, value]);
                        }, 0);
                    }}>
                        <SelectTrigger 
                            className={`h-10 ${getFieldError('credentials') ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`}
                            onBlur={() => validateFieldOnBlur('credentials', data.credentials)}
                        >
                            <SelectValue placeholder="Select your credentials" />
                        </SelectTrigger>
                        <SelectContent>
                            {CREDENTIALS.map(cred => (
                                <SelectItem key={cred} value={cred}>{cred}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2 mt-2 min-h-[32px]">
                        {(Array.isArray(data.credentials) ? data.credentials : []).map((cred: any, index: number) => (
                            <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 pr-1">
                                {cred}
                                <button type='button'
                                    onClick={() => removeArrayItem('credentials', index)}
                                    className="ml-2 text-blue-600 hover:text-blue-800 font-bold"
                                    disabled={professionalDetailsLocked}
                                >
                                    ×
                                </button>
                            </Badge>
                        ))}
                        {data.credentials.length === 0 && (
                            <span className="text-xs text-gray-400 py-2">No credentials selected</span>
                        )}
                    </div>
                    {getFieldError('credentials') && <p className="text-sm text-red-500 mt-1">{getFieldError('credentials')}</p>}
                </div>

                <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                        Years of Experience <span className="text-red-500">*</span>
                    </Label>
                    <Select value={data.years_of_experience} onValueChange={(value) => {
                        setData('years_of_experience', value);
                        if (getFieldError('years_of_experience')) {
                            clearFieldError('years_of_experience');
                        }
                        // Trigger validation immediately after selection
                        setTimeout(() => {
                            validateFieldOnBlur('years_of_experience', value);
                        }, 0);
                    }}>
                        <SelectTrigger 
                            className={`h-10 ${getFieldError('years_of_experience') ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`}
                            onBlur={() => validateFieldOnBlur('years_of_experience', data.years_of_experience)}
                        >
                            <SelectValue placeholder="Select years of experience" />
                        </SelectTrigger>
                        <SelectContent>
                            {YEARS_OF_EXPERIENCE.map(year => (
                                <SelectItem key={year} value={year}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {getFieldError('years_of_experience') && <p className="text-sm text-red-500 mt-1">{getFieldError('years_of_experience')}</p>}
                </div>

                <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                        License Number / Registration ID <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        value={data.license_number}
                        onChange={(e) => {
                            setData('license_number', e.target.value);
                            if (getFieldError('license_number')) {
                                clearFieldError('license_number');
                            }
                        }}
                        onBlur={(e) => handleFieldBlur('license_number', e.target.value)}
                        placeholder="Enter license number or registration ID"
                        disabled={isLinkingExisting || (lookupFieldsLocked && lookupUsedLicenseNumber)}
                        className={`h-10 placeholder-gray-400 ${getFieldError('license_number') ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'} ${(isLinkingExisting || (lookupFieldsLocked && lookupUsedLicenseNumber)) ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        maxLength={100}
                    />
                    {getFieldError('license_number') && <p className="text-sm text-red-500 mt-1">{getFieldError('license_number')}</p>}
                </div>

                <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                        Professional Associations <span className="text-red-500">*</span>
                    </Label>
                    <Select onValueChange={(value) => {
                        addArrayItem('professional_associations', value);
                        if (getFieldError('professional_associations')) {
                            clearFieldError('professional_associations');
                        }
                        // Trigger validation immediately after selection
                        setTimeout(() => {
                            validateFieldOnBlur('professional_associations', [...data.professional_associations, value]);
                        }, 0);
                    }}>
                        <SelectTrigger 
                            className={`h-10 ${getFieldError('professional_associations') ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`}
                            onBlur={() => validateFieldOnBlur('professional_associations', data.professional_associations)}
                        >
                            <SelectValue placeholder="Select professional association" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="APA">American Psychological Association</SelectItem>
                            <SelectItem value="CPA">Canadian Psychological Association</SelectItem>
                            <SelectItem value="NASW">National Association of Social Workers</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2 mt-2 min-h-[32px]">
                        {(Array.isArray(data.professional_associations) ? data.professional_associations : []).map((assoc: any, index: number) => (
                            <Badge key={index} variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200 pr-1">
                                {assoc}
                                <button type='button'
                                    onClick={() => removeArrayItem('professional_associations', index)}
                                    className="ml-2 text-green-600 hover:text-green-800 font-bold"
                                    disabled={professionalDetailsLocked}
                                >
                                    ×
                                </button>
                            </Badge>
                        ))}
                        {data.professional_associations.length === 0 && (
                            <span className="text-xs text-gray-400 py-2">No associations selected</span>
                        )}
                    </div>
                    {getFieldError('professional_associations') && <p className="text-sm text-red-500 mt-1">{getFieldError('professional_associations')}</p>}
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                    Primary Specialties <span className="text-red-500">*</span>
                </Label>
                <Select onValueChange={(value) => {
                    addArrayItem('primary_specialties', value);
                    if (getFieldError('primary_specialties')) {
                        clearFieldError('primary_specialties');
                    }
                    // Trigger validation immediately after selection
                    setTimeout(() => {
                        validateFieldOnBlur('primary_specialties', [...data.primary_specialties, value]);
                    }, 0);
                }} disabled={professionalDetailsLocked}>
                    <SelectTrigger 
                        className={`h-10 ${getFieldError('primary_specialties') ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`}
                        onBlur={() => validateFieldOnBlur('primary_specialties', data.primary_specialties)}
                    >
                        <SelectValue placeholder="Select your specialties" />
                    </SelectTrigger>
                    <SelectContent>
                        {SPECIALTIES.map(spec => (
                            <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2 min-h-[32px]">
                    {(Array.isArray(data.primary_specialties) ? data.primary_specialties : []).map((spec: any, index: number) => (
                        <Badge key={index} variant="secondary" className="bg-purple-100 text-purple-800 hover:bg-purple-200 pr-1">
                            {spec}
                            <button type='button'
                                onClick={() => removeArrayItem('primary_specialties', index)}
                                className="ml-2 text-purple-600 hover:text-purple-800 font-bold"
                                disabled={professionalDetailsLocked}
                            >
                                ×
                            </button>
                        </Badge>
                    ))}
                    {data.primary_specialties.length === 0 && (
                        <span className="text-xs text-gray-400 py-2">No specialties selected</span>
                    )}
                </div>
                {getFieldError('primary_specialties') && <p className="text-sm text-red-500 mt-1">{getFieldError('primary_specialties')}</p>}
            </div>

            <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                    Therapeutic Modalities <span className="text-red-500">*</span>
                </Label>
                <Select onValueChange={(value) => {
                    addArrayItem('therapeutic_modalities', value);
                    if (getFieldError('therapeutic_modalities')) {
                        clearFieldError('therapeutic_modalities');
                    }
                    // Trigger validation immediately after selection
                    setTimeout(() => {
                        validateFieldOnBlur('therapeutic_modalities', [...data.therapeutic_modalities, value]);
                    }, 0);
                }} disabled={professionalDetailsLocked}>
                    <SelectTrigger 
                        className={`h-10 ${getFieldError('therapeutic_modalities') ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`}
                        onBlur={() => validateFieldOnBlur('therapeutic_modalities', data.therapeutic_modalities)}
                    >
                        <SelectValue placeholder="Select your modalities" />
                    </SelectTrigger>
                    <SelectContent>
                        {THERAPEUTIC_MODALITIES.map(mod => (
                            <SelectItem key={mod} value={mod}>{mod}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2 min-h-[32px]">
                    {(Array.isArray(data.therapeutic_modalities) ? data.therapeutic_modalities : []).map((mod: any, index: number) => (
                        <Badge key={index} variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-200 pr-1">
                            {mod}
                            <button type='button'
                                onClick={() => removeArrayItem('therapeutic_modalities', index)}
                                className="ml-2 text-orange-600 hover:text-orange-800 font-bold"
                                disabled={professionalDetailsLocked}
                            >
                                ×
                            </button>
                        </Badge>
                    ))}
                    {data.therapeutic_modalities.length === 0 && (
                        <span className="text-xs text-gray-400 py-2">No modalities selected</span>
                    )}
                </div>
                {getFieldError('therapeutic_modalities') && <p className="text-sm text-red-500 mt-1">{getFieldError('therapeutic_modalities')}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                        Client Types Served <span className="text-red-500">*</span>
                    </Label>
                    <Select onValueChange={(value) => {
                        addArrayItem('client_types_served', value);
                        if (getFieldError('client_types_served')) {
                            clearFieldError('client_types_served');
                        }
                        // Trigger validation immediately after selection
                        setTimeout(() => {
                            validateFieldOnBlur('client_types_served', [...data.client_types_served, value]);
                        }, 0);
                    }}>
                        <SelectTrigger 
                            className={`h-10 ${getFieldError('client_types_served') ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`}
                            onBlur={() => validateFieldOnBlur('client_types_served', data.client_types_served)}
                        >
                            <SelectValue placeholder="Select client types" />
                        </SelectTrigger>
                        <SelectContent>
                            {CLIENT_TYPES.map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2 mt-2 min-h-[32px]">
                        {(Array.isArray(data.client_types_served) ? data.client_types_served : []).map((type: any, index: number) => (
                            <Badge key={index} variant="secondary" className="bg-pink-100 text-pink-800 hover:bg-pink-200 pr-1">
                                {type}
                                <button type='button'
                                    onClick={() => removeArrayItem('client_types_served', index)}
                                    className="ml-2 text-pink-600 hover:text-pink-800 font-bold"
                                    disabled={professionalDetailsLocked}
                                >
                                    ×
                                </button>
                            </Badge>
                        ))}
                        {data.client_types_served.length === 0 && (
                            <span className="text-xs text-gray-400 py-2">No client types selected</span>
                        )}
                    </div>
                    {getFieldError('client_types_served') && <p className="text-sm text-red-500 mt-1">{getFieldError('client_types_served')}</p>}
                </div>

                <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                        Languages Spoken <span className="text-red-500">*</span>
                    </Label>
                    <Select onValueChange={(value) => {
                        addArrayItem('languages_spoken', value);
                        if (getFieldError('languages_spoken')) {
                            clearFieldError('languages_spoken');
                        }
                        // Trigger validation immediately after selection
                        setTimeout(() => {
                            validateFieldOnBlur('languages_spoken', [...data.languages_spoken, value]);
                        }, 0);
                    }}>
                        <SelectTrigger 
                            className={`h-10 ${getFieldError('languages_spoken') ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`}
                            onBlur={() => validateFieldOnBlur('languages_spoken', data.languages_spoken)}
                        >
                            <SelectValue placeholder="Select languages" />
                        </SelectTrigger>
                        <SelectContent>
                            {LANGUAGES.map(lang => (
                                <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2 mt-2 min-h-[32px]">
                        {(Array.isArray(data.languages_spoken) ? data.languages_spoken : []).map((lang: any, index: number) => (
                            <Badge key={index} variant="secondary" className="bg-teal-100 text-teal-800 hover:bg-teal-200 pr-1">
                                {lang}
                                <button type='button'   
                                    onClick={() => removeArrayItem('languages_spoken', index)}
                                    className="ml-2 text-teal-600 hover:text-teal-800 font-bold"
                                    disabled={professionalDetailsLocked}
                                >
                                    ×
                                </button>
                            </Badge>
                        ))}
                        {data.languages_spoken.length === 0 && (
                            <span className="text-xs text-gray-400 py-2">No languages selected</span>
                        )}
                    </div>
                    {getFieldError('languages_spoken') && <p className="text-sm text-red-500 mt-1">{getFieldError('languages_spoken')}</p>}
                </div>
            </div>

            <div className="space-y-6">
                <div className="space-y-4">
                    <Label className="text-sm font-medium text-gray-700 flex items-center">
                        <FileText className="w-4 h-4 mr-2 text-green-600" />
                        Resume <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <div
                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                            professionalDetailsLocked 
                                ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                                : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'
                        }`}
                        onDragOver={professionalDetailsLocked ? undefined : handleDragOver}
                        onDrop={professionalDetailsLocked ? undefined : (e) => handleDrop(e, 'resume_files')}
                        onClick={professionalDetailsLocked ? undefined : () => document.getElementById('resume-files-input')?.click()}
                    >
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                <Upload className="w-6 h-6 text-green-600" />
                            </div>
                            <p className="text-sm text-gray-700 mb-1">
                                {professionalDetailsLocked ? 'Upload disabled' : (
                                    <>Drag & drop files or <span className="text-green-600 underline cursor-pointer">Browse</span></>
                                )}
                            </p>
                            <p className="text-xs text-gray-500">
                                Supported: PDF, DOC, DOCX (Max 5MB each)
                            </p>
                        </div>
                    </div>
                    <input
                        id="resume-files-input"
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => handleFileUpload('resume_files', e.target.files)}
                        className="hidden"
                        disabled={professionalDetailsLocked}
                    />
                    {uploadedFiles.resume_files.length > 0 && (
                        <div className="space-y-2">
                            {uploadedFiles.resume_files.map((file, index) => (
                                <div key={index} className="flex items-center justify-between bg-green-50 p-3 rounded-lg border border-green-200">
                                    <div className="flex items-center">
                                        <FileText className="w-4 h-4 mr-3 text-green-600" />
                                        <div>
                                            <span className="text-sm font-medium text-gray-700">{file.name}</span>
                                            <span className="text-xs text-gray-500 ml-2">({formatFileSize(file.size)})</span>
                                        </div>
                                    </div>
                                    {!professionalDetailsLocked && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeFile('resume_files', index);
                                            }}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    {errors.resume_files && <p className="text-sm text-red-500">{errors.resume_files}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <Label className="text-sm font-medium text-gray-700 flex items-center">
                            <Award className="w-4 h-4 mr-2 text-yellow-600" />
                            Licensing Documents <span className="text-red-500 ml-1">*</span>
                        </Label>
                        <div
                            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                                professionalDetailsLocked 
                                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                                    : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'
                            }`}
                            onDragOver={professionalDetailsLocked ? undefined : handleDragOver}
                            onDrop={professionalDetailsLocked ? undefined : (e) => handleDrop(e, 'licensing_docs')}
                            onClick={professionalDetailsLocked ? undefined : () => document.getElementById('licensing-docs-input')?.click()}
                        >
                            <div className="flex flex-col items-center">
                                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                                    <Upload className="w-6 h-6 text-yellow-600" />
                                </div>
                                <p className="text-sm text-gray-700 mb-1">
                                    {professionalDetailsLocked ? 'Upload disabled' : (
                                        <>Drag & drop files or <span className="text-yellow-600 underline cursor-pointer">Browse</span></>
                                    )}
                                </p>
                                <p className="text-xs text-gray-500">
                                    Supported: PDF, DOC, DOCX, JPG, PNG (Max 5MB each)
                                </p>
                            </div>
                        </div>
                        <input
                            id="licensing-docs-input"
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileUpload('licensing_docs', e.target.files)}
                            className="hidden"
                            disabled={professionalDetailsLocked}
                        />
                        {uploadedFiles.licensing_docs.length > 0 && (
                            <div className="space-y-2">
                                {uploadedFiles.licensing_docs.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                        <div className="flex items-center">
                                            <Award className="w-4 h-4 mr-3 text-yellow-600" />
                                            <div>
                                                <span className="text-sm font-medium text-gray-700">{file.name}</span>
                                                <span className="text-xs text-gray-500 ml-2">({formatFileSize(file.size)})</span>
                                            </div>
                                        </div>
                                        {!professionalDetailsLocked && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeFile('licensing_docs', index);
                                                }}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {errors.licensing_docs && <p className="text-sm text-red-500">{errors.licensing_docs}</p>}
                    </div>

                    <div className="space-y-4">
                        <Label className="text-sm font-medium text-gray-700 flex items-center">
                            <Award className="w-4 h-4 mr-2 text-purple-600" />
                            Certificates <span className="text-red-500 ml-1">*</span>
                        </Label>
                        <div
                            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                                professionalDetailsLocked 
                                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                                    : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'
                            }`}
                            onDragOver={professionalDetailsLocked ? undefined : handleDragOver}
                            onDrop={professionalDetailsLocked ? undefined : (e) => handleDrop(e, 'certificates')}
                            onClick={professionalDetailsLocked ? undefined : () => document.getElementById('certificates-input')?.click()}
                        >
                            <div className="flex flex-col items-center">
                                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                                    <Upload className="w-6 h-6 text-purple-600" />
                                </div>
                                <p className="text-sm text-gray-700 mb-1">
                                    {professionalDetailsLocked ? 'Upload disabled' : (
                                        <>Drag & drop files or <span className="text-purple-600 underline cursor-pointer">Browse</span></>
                                    )}
                                </p>
                                <p className="text-xs text-gray-500">
                                    Supported: PDF, DOC, DOCX, JPG, PNG (Max 5MB each)
                                </p>
                            </div>
                        </div>
                        <input
                            id="certificates-input"
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileUpload('certificates', e.target.files)}
                            className="hidden"
                            disabled={professionalDetailsLocked}
                        />
                        {uploadedFiles.certificates.length > 0 && (
                            <div className="space-y-2">
                                {uploadedFiles.certificates.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between bg-purple-50 p-3 rounded-lg border border-purple-200">
                                        <div className="flex items-center">
                                            <Award className="w-4 h-4 mr-3 text-purple-600" />
                                            <div>
                                                <span className="text-sm font-medium text-gray-700">{file.name}</span>
                                                <span className="text-xs text-gray-500 ml-2">({formatFileSize(file.size)})</span>
                                            </div>
                                        </div>
                                        {!professionalDetailsLocked && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeFile('certificates', index);
                                                }}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {errors.certificates && <p className="text-sm text-red-500">{errors.certificates}</p>}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderLocations = () => {
        if (loadingLocations) {
            return (
                <div className="space-y-6">
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-gray-600">Loading locations...</span>
                    </div>
                </div>
            );
        }

        if (!data.practitioner_id) {
            return (
                <div className="space-y-6">
                    <div className="text-center py-8">
                        <Info className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                        <p className="text-gray-600">Please save basic information first to manage location assignments.</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <div className="flex items-start">
                        <Info className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                        <div>
                            <p className="text-sm text-blue-700">
                                <strong>Location Availability:</strong> Set availability schedules for locations where this practitioner is assigned.
                                Location assignments are managed in the <strong>Locations</strong> module.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px]">
                            <thead>
                                <tr className="bg-gray-50 border-b">
                                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 min-w-[200px]">
                                        Name
                                    </th>
                                    <th className="px-4 py-4 text-left text-sm font-bold text-gray-700 min-w-[200px]">
                                        Address
                                    </th>
                                    <th className="px-4 py-4 text-left text-sm font-bold text-gray-700 min-w-[150px]">
                                        Contact
                                    </th>
                                    <th className="px-4 py-4 text-left text-sm font-bold text-gray-700 min-w-[120px]">
                                        Status
                                    </th>
                                    <th className="px-6 py-4 text-center text-sm font-bold text-gray-700 w-[160px]">
                                        Availability
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {locationsData.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                            No locations available. Please create locations first.
                                        </td>
                                    </tr>
                                ) : (
                                    locationsData.map((location) => (
                                        <tr key={location.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{location.name}</div>
                                                <div className="text-sm text-gray-500">
                                                    {location.city}, {location.province}
                                                </div>
                                            </td>

                                            <td className="px-4 py-4">
                                                <div className="text-sm text-gray-900">{location.full_address}</div>
                                            </td>

                                            <td className="px-4 py-4">
                                                <div className="text-sm text-gray-900">{location.phone_number}</div>
                                                <div className="text-sm text-gray-500">{location.email_address}</div>
                                            </td>

                                            <td className="px-4 py-4">
                                                <div className="flex items-center">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                        location.status === 'Active'
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        <div className={`w-2 h-2 rounded-full mr-2 ${
                                                            location.status === 'Active' ? 'bg-green-600' : 'bg-gray-400'
                                                        }`}></div>
                                                        {location.status}
                                                    </span>
                                                    {location.is_assigned && (
                                                        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                            <div className="w-2 h-2 rounded-full mr-2 bg-blue-600"></div>
                                                            Assigned
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 text-center">
                                                {location.is_assigned ? (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openAvailabilityModal(location)}
                                                        className="text-xs px-3 py-1 h-8 border-primary-600 text-primary-600 hover:bg-primary-50"
                                                    >
                                                        Set Hours
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-gray-400">Not assigned</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {locationsData.some(loc => loc.is_assigned) && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-4">
                        <div className="flex items-start">
                            <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5" />
                            <div>
                                <p className="text-sm text-green-700">
                                    <strong>This practitioner is assigned to {locationsData.filter(loc => loc.is_assigned).length} location(s):</strong>{' '}
                                    {locationsData.filter(loc => loc.is_assigned).map(loc => loc.name).join(', ')}
                                </p>
                                <p className="text-xs text-green-600 mt-1">
                                    Use the "Set Hours" button to configure availability schedules for each assigned location.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderPricing = () => {
        if (!data.practitioner_id) {
            return (
                <div className="space-y-6">
                    <div className="text-center py-8">
                        <Info className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                        <p className="text-gray-600">Please save basic information first to manage service pricing.</p>
                    </div>
                </div>
            );
        }

        if (loadingServices) {
            return (
                <div className="space-y-6">
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-gray-600">Loading services...</span>
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-6">

                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <div className="flex items-start">
                        <Info className="h-5 w-5 text-blue-500 mr-3 flex-shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm text-blue-700 leading-5">
                                <strong>Service Pricing:</strong> Toggle services this practitioner offers and customize pricing.
                                Default pricing from the service will be used unless customized.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px]">
                            <thead>
                                <tr className="bg-gray-50 border-b">
                                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 min-w-[200px]">Service Name</th>
                                    <th className="px-4 py-4 text-left text-sm font-bold text-gray-700 min-w-[120px]">Category</th>
                                    <th className="px-4 py-4 text-left text-sm font-bold text-gray-700 min-w-[150px]">Fee</th>
                                    <th className="px-6 py-4 text-center text-sm font-bold text-gray-700 min-w-[140px]">Offer Service</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {practitionerServices.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                            No services available. Please create services first in the Services tab.
                                        </td>
                                    </tr>
                                ) : (
                                    practitionerServices.map((service) => {
                                        const isOffered = service.pivot?.is_offered || false;
                                        const customPrice = service.pivot?.custom_price || '';
                                        const displayPrice = customPrice || service.default_price;
                                        const isEditing = editingServiceId === service.id;
                                        
                                        return (
                                            <tr key={service.id} className={`hover:bg-gray-50 ${!service.is_active ? 'opacity-50' : ''}`}>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-gray-900">{service.name}</div>
                                                    {service.description && (
                                                        <div className="text-sm text-gray-500 mt-1">{service.description}</div>
                                                    )}
                                                    {!service.is_active && (
                                                        <div className="text-xs text-red-500 mt-1">(Inactive Service)</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-sm text-gray-600">{service.category}</td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center space-x-2">
                                                        {isEditing ? (
                                                            <div className="flex items-center space-x-2">
                                                                <span className="text-sm text-gray-500">$</span>
                                                                <Input
                                                                    type="number"
                                                                    value={editingPrice}
                                                                    onChange={(e) => setEditingPrice(e.target.value)}
                                                                    className="w-20 text-sm"
                                                                    min="0"
                                                                    step="0.01"
                                                                    placeholder={service.default_price.toString()}
                                                                />
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => saveEditingPrice(service.id)}
                                                                    className="h-6 w-6 p-0"
                                                                    disabled={!isPriceChanged() || loadingServices}
                                                                >
                                                                    {loadingServices ? (
                                                                        <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                                                                    ) : '✓'}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={cancelEditingPrice}
                                                                    className="h-6 w-6 p-0"
                                                                    disabled={loadingServices}
                                                                >
                                                                    ✕
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center space-x-2">
                                                                <span className={`text-sm font-medium ${isOffered ? 'text-gray-900' : 'text-gray-500'}`}>
                                                                    ${displayPrice}
                                                                    {customPrice && (
                                                                        <span className="text-xs text-blue-600 ml-1">(Custom)</span>
                                                                    )}
                                                                </span>
                                                                {isOffered && (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => startEditingPrice(service.id, displayPrice.toString())}
                                                                        className="h-6 w-6 p-0"
                                                                    >
                                                                        <Edit className="w-3 h-3" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <Switch
                                                        checked={isOffered}
                                                        onCheckedChange={(checked) => toggleService(service.id, checked)}
                                                        disabled={!service.is_active}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>


            </div>
        );
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'basic':
                return renderBasicInfo();
            case 'professional':
                return renderProfessionalDetails();
            case 'locations':
                return renderLocations();
            case 'pricing':
                return renderPricing();
            default:
                return renderBasicInfo();
        }
    };

    // Embedded mode - return form content directly without Card wrapper
    if (embedded) {
        return (
            <div className="space-y-6">
                {/* Header for embedded mode */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div className="flex items-center space-x-4">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onCancel}
                            className="text-gray-600 hover:text-gray-800"
                        >
                            ← Back 
                        </Button>
                        <div>
                            <h3 className="text-lg font-semibold">
                                {practitioner ? 'Edit Practitioner' : 'Add New Practitioner'}
                            </h3>
                            <p className="text-sm text-gray-500">
                                {practitioner ? 'Update practitioner information and settings' : 'Create a new practitioner for your organization'}
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="px-6">
                <form onSubmit={handleSubmitClick}>
                    <Tabs defaultValue={activeTab} value={activeTab} className="w-full" onValueChange={handleTabChange}>
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="basic">Basic Info</TabsTrigger>

                            <TabsTrigger 
                                value="professional" 
                                disabled={(showLookupForm && !practitioner?.id) || showLinkConfirmation}
                                className={(showLookupForm && !practitioner?.id) || showLinkConfirmation ? 'opacity-50 cursor-not-allowed' : ''}
                            >
                                Professional Details
                            </TabsTrigger>

                            <TabsTrigger 
                                value="locations" 
                                disabled={(showLookupForm && !practitioner?.id) || showLinkConfirmation}
                                className={(showLookupForm && !practitioner?.id) || showLinkConfirmation ? 'opacity-50 cursor-not-allowed' : ''}
                            >
                                Locations
                            </TabsTrigger>

                            <TabsTrigger 
                                value="pricing" 
                                disabled={(showLookupForm && !practitioner?.id) || showLinkConfirmation}
                                className={(showLookupForm && !practitioner?.id) || showLinkConfirmation ? 'opacity-50 cursor-not-allowed' : ''}
                            >
                                Pricing
                            </TabsTrigger>
                        </TabsList>



                        <TabsContent value="basic" className="mt-6 space-y-6">
                            {(errors as any).basic_info && (
                                <Alert className="border-red-200 bg-red-50">
                                    <AlertCircle className="h-4 w-4 text-red-600" />
                                    <AlertDescription className="text-red-700">
                                        {(errors as any).basic_info}
                                    </AlertDescription>
                                </Alert>
                            )}
                            {renderBasicInfo()}
                        </TabsContent>

                        <TabsContent value="professional" className="mt-6 space-y-6">
                            {(errors as any).professional_details && (
                                <Alert className="border-red-200 bg-red-50">
                                    <AlertCircle className="h-4 w-4 text-red-600" />
                                    <AlertDescription className="text-red-700">
                                        {(errors as any).professional_details}
                                    </AlertDescription>
                                </Alert>
                            )}
                            {renderProfessionalDetails()}
                        </TabsContent>

                        <TabsContent value="locations" className="mt-6 space-y-6">
                            {renderLocations()}
                        </TabsContent>

                        <TabsContent value="pricing" className="mt-6 space-y-6">
                            {renderPricing()}
                        </TabsContent>
                    </Tabs>

                    <div className="flex justify-end items-center gap-4 mt-8">
                        {/* {activeTab !== 'basic' && activeTab !== 'pricing' && (
                            <span className="text-gray-400 text-sm">
                                AutoSave
                            </span>
                        )} */}

                        {/* Show Next/Save button for all tabs except pricing */}
                        {activeTab !== 'pricing' && (
                            <Button
                                type="submit"
                                disabled={processing || pendingSubmit || uploadingToS3 || (activeTab === 'basic' && (!isBasicInfoComplete() || (showLookupForm && !lookupPerformed)))}
                                className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground shadow-lg transition-all duration-200 w-[145px] h-[48px]"
                            >
                                {activeTab === 'basic'
                                    ? 'Next'
                                    : (activeTab === 'professional' && professionalDetailsLocked)
                                        ? 'Next'
                                        : (uploadingToS3 || processing || pendingSubmit)
                                            ? 'Saving...'
                                            : 'Save'
                                }
                            </Button>
                        )}

                        {/* Show Done button on pricing tab */}
                        {activeTab === 'pricing' && (
                            <Button
                                type="button"
                                onClick={() => router.get(route('practitioners.list'))}
                                className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground shadow-lg transition-all duration-200"
                            >
                                Done
                            </Button>
                        )}
                    </div>
                </form>

                <Dialog open={showDisclaimerDialog} onOpenChange={setShowDisclaimerDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center">
                                <Info className="mr-2 h-5 w-5 text-blue-600" />
                                Wellovis Network Information Sharing
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                {practitioner ? (
                                    <>By updating this practitioner's information, you acknowledge that their professional information will be shared throughout the <strong>Wellovis network</strong> to enable collaboration and facilitate healthcare provider discovery across the network.</>
                                ) : (
                                    <>By creating this practitioner record, you acknowledge that the practitioner's professional information will be shared throughout the <strong>Wellovis network</strong> to enable collaboration and facilitate healthcare provider discovery across the network.</>
                                )}
                            </p>
                            <div className="bg-blue-50 p-3 rounded-md">
                                <p className="text-xs text-blue-700">
                                    <strong>Information shared includes:</strong> Name, Title, Professional Contact Information, Bio, and other professional credentials necessary for provider identification and healthcare collaboration.
                                </p>
                            </div>
                            <p className="text-sm text-gray-600">
                                Do you want to proceed with {practitioner ? 'updating' : 'creating'} this practitioner record?
                            </p>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleDisclaimerCancel}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleDisclaimerAccept}
                                className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground"
                            >
                                Yes, Continue
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={showAvailabilityModal} onOpenChange={setShowAvailabilityModal}>
                    <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
                        <DialogHeader className="flex-shrink-0">
                            <DialogTitle className="flex items-center">
                                Set Availability for {selectedLocation?.name}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="flex-1 overflow-y-auto space-y-4 px-1">
                            <p className="text-sm text-gray-600">
                                Configure when this practitioner is available at this location.
                            </p>

                            <div className="space-y-3">
                                {WEEKDAYS.map((day) => {
                                    const dayData = (availabilityData as any)[day.id] || [];
                                    const isEnabled = dayData.length > 0;
                                    const earliestStart = getEarliestStartTime(day.id);
                                    const latestEnd = getLatestEndTime(day.id);

                                    return (
                                        <div key={day.id} className="p-3 border rounded-md">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center space-x-3">
                                                    <Checkbox
                                                        checked={isEnabled}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                updateDayAvailability(day.id, [{ start: earliestStart, end: latestEnd }]);
                                                            } else {
                                                                updateDayAvailability(day.id, []);
                                                            }
                                                        }}
                                                    />
                                                    <Label className="w-20 font-medium">{day.label}</Label>
                                                    <span className="text-xs text-gray-500">
                                                        ({earliestStart} - {latestEnd})
                                                    </span>
                                                </div>
                                                
                                                {isEnabled && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => addTimeSlot(day.id)}
                                                        className="text-xs px-2 py-1 h-7"
                                                    >
                                                        Add Time
                                                    </Button>
                                                )}
                                            </div>
                                            
                                            {isEnabled && (
                                                <div className="space-y-2">
                                                    {dayData.map((slot: any, slotIndex: number) => {
                                                        const startTime = slot.start || earliestStart;
                                                        const endTime = slot.end || latestEnd;
                                                        const isValidSlot = isTimeSlotValid(day.id, startTime, endTime);
                                                        const hasOverlap = isSlotOverlapping(day.id, slotIndex, startTime, endTime);

                                                        const startMin = earliestStart;
                                                        const startMax = endTime > latestEnd ? latestEnd :
                                                                         new Date(`2000-01-01T${endTime}:00`).getTime() > new Date(`2000-01-01T${latestEnd}:00`).getTime() ? latestEnd : endTime;

                                                        const endMin = startTime < earliestStart ? earliestStart : startTime;
                                                        const endMax = latestEnd;

                                                        return (
                                                            <div key={slotIndex} className="flex items-center space-x-2">
                                                                <div className="flex flex-col">
                                                                    <Input
                                                                        type="time"
                                                                        value={startTime}
                                                                        min={startMin}
                                                                        max={startMax}
                                                                        onChange={(e) => updateTimeSlot(day.id, slotIndex, 'start', e.target.value)}
                                                                        className={`w-24 text-sm ${!isValidSlot || hasOverlap ? 'border-red-300 bg-red-50' : ''}`}
                                                                        title={`Start time must be between ${startMin} and ${startMax}`}
                                                                    />
                                                                    <span className="text-xs text-gray-400 mt-1">Start</span>
                                                                </div>
                                                                <span className="text-gray-400 text-sm">—</span>
                                                                <div className="flex flex-col">
                                                                    <Input
                                                                        type="time"
                                                                        value={endTime}
                                                                        min={endMin}
                                                                        max={endMax}
                                                                        onChange={(e) => updateTimeSlot(day.id, slotIndex, 'end', e.target.value)}
                                                                        className={`w-24 text-sm ${!isValidSlot || hasOverlap ? 'border-red-300 bg-red-50' : ''}`}
                                                                        title={`End time must be between ${endMin} and ${endMax}`}
                                                                    />
                                                                    <span className="text-xs text-gray-400 mt-1">End</span>
                                                                </div>
                                                                {dayData.length > 1 && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => removeTimeSlot(day.id, slotIndex)}
                                                                        className="text-red-500 hover:text-red-700 p-1 h-auto"
                                                                    >
                                                                        ×
                                                                    </Button>
                                                                )}
                                                                {(!isValidSlot || hasOverlap) && (
                                                                    <div className="flex flex-col">
                                                                        {!isValidSlot && (
                                                                            <>
                                                                                <span className="text-xs text-red-500">Invalid time range</span>
                                                                                <span className="text-xs text-gray-400">
                                                                                    Must be within {earliestStart}-{latestEnd}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                        {hasOverlap && (
                                                                            <span className="text-xs text-red-500">Overlaps with another time slot</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <DialogFooter className="flex-shrink-0 border-t pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowAvailabilityModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={saveAvailability}
                                disabled={hasAnyOverlap()}
                                className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground"
                            >
                                Save Availability
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={showLinkConfirmation} onOpenChange={setShowLinkConfirmation}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-blue-600" />
                                Link Existing Practitioner
                            </DialogTitle>
                        </DialogHeader>
                        {selectedPractitionerToLink && (
                            <div className="space-y-4">
                                <p className="text-gray-600">
                                    Are you sure you want to link this existing practitioner to your organization?
                                </p>
                                
                                <div className="bg-gray-50 rounded-lg p-4 border">
                                    <div className="flex items-center space-x-3">
                                        <Avatar className="h-12 w-12">
                                            <AvatarFallback className="bg-gray-200 text-gray-600">
                                                {selectedPractitionerToLink.display_name?.[0] || '?'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="font-medium text-gray-900">
                                                {selectedPractitionerToLink.display_name}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {selectedPractitionerToLink.title && `${selectedPractitionerToLink.title} • `}
                                                {selectedPractitionerToLink.email}
                                            </div>
                                            <div className="text-xs text-blue-600 font-medium mt-1">
                                                Information masked for privacy
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                    <div className="flex items-start">
                                        <Info className="h-4 w-4 text-blue-500 mr-2 mt-0.5" />
                                        <div className="text-sm text-blue-700">
                                            <strong>Note:</strong> This will link the existing practitioner to your organization.
                                            You'll be able to manage their location assignments and availability, but their
                                            professional details may be locked for editing.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <DialogFooter>
                            <Button
                                variant="secondary"
                                onClick={cancelLinkPractitioner}
                                disabled={linkingPractitioner}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={confirmLinkPractitioner}
                                disabled={linkingPractitioner}
                                className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground"
                            >
                                {linkingPractitioner ? 'Linking...' : 'Yes, Link Practitioner'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                </div>
            </div>
        );
    }

    // Standalone mode - return form wrapped in Card with proper spacing
    // When not embedded, wrap in container with padding like other pages
    return (
        <div className="p-6 md:p-6 page-content-mobile">
            <Card className="shadow-none">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-3">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => onCancel ? onCancel() : router.get(route('practitioners.list'))}
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            {practitioner ? 'Edit Practitioner' : 'Add New Practitioner'}
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                <form onSubmit={handleSubmitClick}>
                    <Tabs defaultValue={activeTab} value={activeTab} className="w-full" onValueChange={handleTabChange}>
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="basic">Basic Info</TabsTrigger>
                            <TabsTrigger 
                                value="professional" 
                                disabled={(showLookupForm && !practitioner?.id) || showLinkConfirmation}
                                className={(showLookupForm && !practitioner?.id) || showLinkConfirmation ? 'opacity-50 cursor-not-allowed' : ''}
                            >
                                Professional Details
                            </TabsTrigger>
                            <TabsTrigger 
                                value="locations" 
                                disabled={(showLookupForm && !practitioner?.id) || showLinkConfirmation}
                                className={(showLookupForm && !practitioner?.id) || showLinkConfirmation ? 'opacity-50 cursor-not-allowed' : ''}
                            >
                                Locations
                            </TabsTrigger>
                            <TabsTrigger 
                                value="pricing" 
                                disabled={(showLookupForm && !practitioner?.id) || showLinkConfirmation}
                                className={(showLookupForm && !practitioner?.id) || showLinkConfirmation ? 'opacity-50 cursor-not-allowed' : ''}
                            >
                                Pricing
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="basic" className="mt-6 space-y-6">
                            {(errors as any).basic_info && (
                                <Alert className="border-red-200 bg-red-50">
                                    <AlertCircle className="h-4 w-4 text-red-600" />
                                    <AlertDescription className="text-red-700">
                                        {(errors as any).basic_info}
                                    </AlertDescription>
                                </Alert>
                            )}
                            {renderBasicInfo()}
                        </TabsContent>

                        <TabsContent value="professional" className="mt-6 space-y-6">
                            {(errors as any).professional_details && (
                                <Alert className="border-red-200 bg-red-50">
                                    <AlertCircle className="h-4 w-4 text-red-600" />
                                    <AlertDescription className="text-red-700">
                                        {(errors as any).professional_details}
                                    </AlertDescription>
                                </Alert>
                            )}
                            {renderProfessionalDetails()}
                        </TabsContent>

                        <TabsContent value="locations" className="mt-6 space-y-6">
                            {renderLocations()}
                        </TabsContent>

                        <TabsContent value="pricing" className="mt-6 space-y-6">
                            {renderPricing()}
                        </TabsContent>
                    </Tabs>

                    <div className="flex justify-end items-center gap-4 mt-8">
                        {activeTab !== 'basic' && activeTab !== 'pricing' && (
                            <span className="text-gray-400 text-sm">AutoSave</span>
                        )}

                        {/* Show Next/Save button for all tabs except pricing */}
                        {activeTab !== 'pricing' && (
                            <Button
                                type="submit"
                                disabled={processing || pendingSubmit || uploadingToS3}
                                className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground shadow-lg transition-all duration-200 w-[145px] h-[48px]"
                            >
                                {activeTab === 'basic'
                                    ? 'Next'
                                    : (activeTab === 'professional' && professionalDetailsLocked)
                                        ? 'Next'
                                        : (uploadingToS3 || processing || pendingSubmit)
                                            ? 'Saving...'
                                            : 'Save'
                                }
                            </Button>
                        )}

                        {/* Show Done button on pricing tab */}
                        {activeTab === 'pricing' && (
                            <Button
                                type="button"
                                onClick={() => router.get(route('practitioners.list'))}
                                className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground shadow-lg transition-all duration-200"
                            >
                                Done
                            </Button>
                        )}
                    </div>
                </form>

                {/* Dialogs for standalone mode */}
                <Dialog open={showDisclaimerDialog} onOpenChange={setShowDisclaimerDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center">
                                <Info className="mr-2 h-5 w-5 text-blue-600" />
                                Wellovis Network Information Sharing
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                {practitioner ? (
                                    <>By updating this practitioner's information, you acknowledge that their professional information will be shared throughout the <strong>Wellovis network</strong> to enable collaboration and facilitate healthcare provider discovery across the network.</>
                                ) : (
                                    <>By creating this practitioner record, you acknowledge that the practitioner's professional information will be shared throughout the <strong>Wellovis network</strong> to enable collaboration and facilitate healthcare provider discovery across the network.</>
                                )}
                            </p>
                            <div className="bg-blue-50 p-3 rounded-md">
                                <p className="text-xs text-blue-700">
                                    <strong>Information shared includes:</strong> Name, Title, Professional Contact Information, Bio, and other professional credentials necessary for provider identification and healthcare collaboration.
                                </p>
                            </div>
                            <p className="text-sm text-gray-600">
                                Do you want to proceed with {practitioner ? 'updating' : 'creating'} this practitioner record?
                            </p>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleDisclaimerCancel}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleDisclaimerAccept}
                                className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground"
                            >
                                Yes, Continue
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={showLinkConfirmation} onOpenChange={setShowLinkConfirmation}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-blue-600" />
                                Link Existing Practitioner
                            </DialogTitle>
                        </DialogHeader>
                        {selectedPractitionerToLink && (
                            <div className="space-y-4">
                                <p className="text-gray-600">
                                    Are you sure you want to link this existing practitioner to your organization?
                                </p>
                                
                                <div className="bg-gray-50 rounded-lg p-4 border">
                                    <div className="flex items-center space-x-3">
                                        <Avatar className="h-12 w-12">
                                            <AvatarFallback className="bg-gray-200 text-gray-600">
                                                {selectedPractitionerToLink.display_name?.[0] || '?'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="font-medium text-gray-900">
                                                {selectedPractitionerToLink.display_name}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {selectedPractitionerToLink.title && `${selectedPractitionerToLink.title} • `}
                                                {selectedPractitionerToLink.email}
                                            </div>
                                            {selectedPractitionerToLink.license_number && (
                                                <div className="text-sm text-gray-500">
                                                    License: {selectedPractitionerToLink.license_number}
                                                </div>
                                            )}
                                            <div className="text-xs text-blue-600 font-medium mt-1">
                                                Information masked for privacy
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                    <div className="flex items-start">
                                        <Info className="h-4 w-4 text-blue-500 mr-2 mt-0.5" />
                                        <div className="text-sm text-blue-700">
                                            <strong>Note:</strong> This will link the existing practitioner to your organization.
                                            You'll be able to manage their location assignments and availability, but their
                                            professional details may be locked for editing.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <DialogFooter>
                            <Button
                                variant="secondary"
                                onClick={cancelLinkPractitioner}
                                disabled={linkingPractitioner}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={confirmLinkPractitioner}
                                disabled={linkingPractitioner}
                                className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground"
                            >
                                {linkingPractitioner ? 'Linking...' : 'Yes, Link Practitioner'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Availability Modal for standalone mode */}
                <Dialog open={showAvailabilityModal} onOpenChange={setShowAvailabilityModal}>
                    <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
                        <DialogHeader className="flex-shrink-0">
                            <DialogTitle className="flex items-center">
                                Set Availability for {selectedLocation?.name}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="flex-1 overflow-y-auto space-y-4 px-1">
                            <p className="text-sm text-gray-600">
                                Configure when this practitioner is available at this location.
                            </p>

                            <div className="space-y-3">
                                {WEEKDAYS.map((day) => {
                                    const dayData = (availabilityData as any)[day.id] || [];
                                    const isEnabled = dayData.length > 0;
                                    const earliestStart = getEarliestStartTime(day.id);
                                    const latestEnd = getLatestEndTime(day.id);

                                    return (
                                        <div key={day.id} className="p-3 border rounded-md">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center space-x-3">
                                                    <Checkbox
                                                        checked={isEnabled}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                updateDayAvailability(day.id, [{ start: earliestStart, end: latestEnd }]);
                                                            } else {
                                                                updateDayAvailability(day.id, []);
                                                            }
                                                        }}
                                                    />
                                                    <Label className="w-20 font-medium">{day.label}</Label>
                                                    <span className="text-xs text-gray-500">
                                                        ({earliestStart} - {latestEnd})
                                                    </span>
                                                </div>
                                                
                                                {isEnabled && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => addTimeSlot(day.id)}
                                                        className="text-xs px-2 py-1 h-7"
                                                    >
                                                        Add Time
                                                    </Button>
                                                )}
                                            </div>
                                            
                                            {isEnabled && (
                                                <div className="space-y-2">
                                                    {dayData.map((slot: any, slotIndex: number) => {
                                                        const startTime = slot.start || earliestStart;
                                                        const endTime = slot.end || latestEnd;
                                                        const isValidSlot = isTimeSlotValid(day.id, startTime, endTime);
                                                        const hasOverlap = isSlotOverlapping(day.id, slotIndex, startTime, endTime);

                                                        const startMin = earliestStart;
                                                        const startMax = endTime > latestEnd ? latestEnd :
                                                                         new Date(`2000-01-01T${endTime}:00`).getTime() > new Date(`2000-01-01T${latestEnd}:00`).getTime() ? latestEnd : endTime;

                                                        const endMin = startTime < earliestStart ? earliestStart : startTime;
                                                        const endMax = latestEnd;

                                                        return (
                                                            <div key={slotIndex} className="flex items-center space-x-2">
                                                                <div className="flex flex-col">
                                                                    <Input
                                                                        type="time"
                                                                        value={startTime}
                                                                        min={startMin}
                                                                        max={startMax}
                                                                        onChange={(e) => updateTimeSlot(day.id, slotIndex, 'start', e.target.value)}
                                                                        className={`w-24 text-sm ${!isValidSlot || hasOverlap ? 'border-red-300 bg-red-50' : ''}`}
                                                                        title={`Start time must be between ${startMin} and ${startMax}`}
                                                                    />
                                                                    <span className="text-xs text-gray-400 mt-1">Start</span>
                                                                </div>
                                                                <span className="text-gray-400 text-sm">—</span>
                                                                <div className="flex flex-col">
                                                                    <Input
                                                                        type="time"
                                                                        value={endTime}
                                                                        min={endMin}
                                                                        max={endMax}
                                                                        onChange={(e) => updateTimeSlot(day.id, slotIndex, 'end', e.target.value)}
                                                                        className={`w-24 text-sm ${!isValidSlot || hasOverlap ? 'border-red-300 bg-red-50' : ''}`}
                                                                        title={`End time must be between ${endMin} and ${endMax}`}
                                                                    />
                                                                    <span className="text-xs text-gray-400 mt-1">End</span>
                                                                </div>
                                                                {dayData.length > 1 && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => removeTimeSlot(day.id, slotIndex)}
                                                                        className="text-red-500 hover:text-red-700 p-1 h-auto"
                                                                    >
                                                                        ×
                                                                    </Button>
                                                                )}
                                                                {(!isValidSlot || hasOverlap) && (
                                                                    <div className="flex flex-col">
                                                                        {!isValidSlot && (
                                                                            <>
                                                                                <span className="text-xs text-red-500">Invalid time range</span>
                                                                                <span className="text-xs text-gray-400">
                                                                                    Must be within {earliestStart}-{latestEnd}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                        {hasOverlap && (
                                                                            <span className="text-xs text-red-500">Overlaps with another time slot</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <DialogFooter className="flex-shrink-0 border-t pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowAvailabilityModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={saveAvailability}
                                disabled={hasAnyOverlap()}
                                className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground"
                            >
                                Save Availability
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                </CardContent>
                <Toaster position="top-right" />
            </Card>
        </div>
    );
}

// Apply AppLayout for standalone mode (when not embedded)
// When embedded=true, the component is used within SettingsLayout
// Inertia will use the layout from the page props if available, otherwise use this default
const CreateWithLayout = withAppLayout(Create, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Practitioners', href: route('practitioners.list') },
        { title: 'Practitioner', href: '#' },
    ]
});

export default CreateWithLayout;