'use client';

import { useState, useEffect, useRef } from 'react';
import { router, usePage } from '@inertiajs/react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowLeft, Plus, X, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import OnboardingLayout from '@/components/onboarding-layout';
import { useForm } from '@inertiajs/react';
import axios from 'axios';
import {
    validateEmail,
    validatePhone,
    validatePostalCode,
    formatPhoneNumber,
    formatPostalCode,
} from '@/utils/validation';

interface LocationFormData {
    id?: number;
    formId?: string; // Unique ID for animation
    name: string;
    timezone: string;
    address_lookup: string;
    street_address: string;
    apt_suite_unit: string;
    city: string;
    postal_zip_code: string;
    province: string;
    phone_number: string;
    email_address: string;
    is_active: boolean;
}

const fallbackTimezones = [
    { value: 'America/Toronto', label: 'Eastern Time (GMT-5) - Toronto, Ottawa, Montreal' },
    { value: 'America/New_York', label: 'Eastern Time (GMT-5) - New York' },
    { value: 'America/Chicago', label: 'Central Time (GMT-6) - Winnipeg, Chicago' },
    { value: 'America/Denver', label: 'Mountain Time (GMT-7) - Calgary, Edmonton, Denver' },
    { value: 'America/Vancouver', label: 'Pacific Time (GMT-8) - Vancouver, Seattle' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (GMT-8) - Los Angeles' },
    { value: 'America/Halifax', label: 'Atlantic Time (GMT-4) - Halifax, Moncton' },
    { value: 'America/St_Johns', label: 'Newfoundland Time (GMT-3:30) - St. Johns' },
    { value: 'UTC', label: 'UTC (GMT+0) - Coordinated Universal Time' },
];

const fallbackProvinces = [
    { value: 'ON', label: 'Ontario' },
    { value: 'BC', label: 'British Columbia' },
    { value: 'AB', label: 'Alberta' },
    { value: 'MB', label: 'Manitoba' },
    { value: 'SK', label: 'Saskatchewan' },
    { value: 'QC', label: 'Quebec' },
    { value: 'NB', label: 'New Brunswick' },
    { value: 'PE', label: 'Prince Edward Island' },
    { value: 'NS', label: 'Nova Scotia' },
    { value: 'NL', label: 'Newfoundland and Labrador' },
    { value: 'YT', label: 'Yukon' },
    { value: 'NT', label: 'Northwest Territories' },
    { value: 'NU', label: 'Nunavut' },
];

const fallbackCities: Record<string, string[]> = {
    'AB': ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge'],
    'BC': ['Vancouver', 'Victoria', 'Surrey', 'Burnaby', 'Richmond'],
    'MB': ['Winnipeg', 'Brandon', 'Steinbach'],
    'NB': ['Saint John', 'Moncton', 'Fredericton'],
    'NL': ['St. Johns', 'Mount Pearl', 'Corner Brook'],
    'NS': ['Halifax', 'Sydney', 'Dartmouth'],
    'NT': ['Yellowknife', 'Hay River'],
    'NU': ['Iqaluit', 'Rankin Inlet'],
    'ON': ['Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton', 'London'],
    'PE': ['Charlottetown', 'Summerside'],
    'QC': ['Montreal', 'Quebec City', 'Laval', 'Gatineau'],
    'SK': ['Saskatoon', 'Regina', 'Prince Albert'],
    'YT': ['Whitehorse', 'Dawson City'],
};

export default function OnboardingLocationCreate() {
    const page = usePage();
    const pageProps = page.props as any;
    
    // Get URL params
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    // Check URL param first, then fallback to props from backend
    const hasMultipleLocations = urlParams.get('hasMultipleLocations') === 'true' || pageProps.hasMultipleLocations === true;
    const isOnboarding = urlParams.get('onboarding') === 'true';
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const locationFormRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [timezones, setTimezones] = useState(fallbackTimezones);
    const [provinces, setProvinces] = useState(fallbackProvinces);
    const [cities, setCities] = useState<Record<string, string[]>>(fallbackCities);
    const { existingLocations } = pageProps;

    const [locationForms, setLocationForms] = useState<LocationFormData[]>(() => {
        if (existingLocations && existingLocations.length > 0) {
            return existingLocations.map((loc: any, idx: number) => ({
                id: loc.id, // Keep ID for updates
                formId: `form-${loc.id || `new-${idx}-${Date.now()}`}`, // Unique ID for animation
                name: loc.name || '',
                timezone: loc.timezone || 'America/Toronto',
                address_lookup: loc.address_lookup || '',
                street_address: loc.street_address || '',
                apt_suite_unit: loc.apt_suite_unit || '',
                city: loc.city || '',
                postal_zip_code: loc.postal_zip_code || '',
                province: loc.province || '',
                phone_number: loc.phone_number || '',
                email_address: loc.email_address || '',
                is_active: loc.is_active ?? true,
            }));
        }
        return [{
            formId: `form-new-${Date.now()}`, // Unique ID for animation
            name: '',
            timezone: 'America/Toronto',
            address_lookup: '',
            street_address: '',
            apt_suite_unit: '',
            city: '',
            postal_zip_code: '',
            province: '',
            phone_number: '',
            email_address: '',
            is_active: true,
        }];
    });
    const [formErrors, setFormErrors] = useState<Record<number, Record<string, string>>>({});

    // Fetch timezones, provinces, cities on mount
    useEffect(() => {
        const fetchLocationData = async () => {
            try {
                const response = await axios.get('/locations/create');
                if (response.data.timezones) setTimezones(response.data.timezones);
                if (response.data.provinces) setProvinces(response.data.provinces);
                if (response.data.cities) setCities(response.data.cities);
            } catch (error) {
                console.error('Error fetching location data:', error);
                // Use fallback data
            }
        };
        fetchLocationData();
    }, []);


    const getCitiesForProvince = (provinceCode: string): string[] => {
        if (!provinceCode) return [];
        return cities[provinceCode] || [];
    };

    const addLocationForm = () => {
        const newIndex = locationForms.length;
        setLocationForms([
            ...locationForms,
            {
                id: undefined,
                formId: `form-new-${Date.now()}-${Math.random()}`, // Unique ID for animation
                name: '',
                timezone: 'America/Toronto',
                address_lookup: '',
                street_address: '',
                apt_suite_unit: '',
                city: '',
                postal_zip_code: '',
                province: '',
                phone_number: '',
                email_address: '',
                is_active: true,
            },
        ]);
        
        // Scroll to the newly added location form after it's rendered
        setTimeout(() => {
            const newFormElement = locationFormRefs.current[newIndex];
            if (newFormElement) {
                const elementRect = newFormElement.getBoundingClientRect();
                const absoluteElementTop = elementRect.top + window.pageYOffset;
                const middle = absoluteElementTop - (window.innerHeight / 2) + (elementRect.height / 2);
                window.scrollTo({
                    top: middle,
                    behavior: 'smooth',
                });
            }
        }, 100);
    };

    const removeLocationForm = (index: number) => {
        if (locationForms.length > 1) {
            const newForms = locationForms.filter((_, i) => i !== index);
            setLocationForms(newForms);
            const newErrors = { ...formErrors };
            delete newErrors[index];
            setFormErrors(newErrors);
        }
    };

    const updateLocationForm = (index: number, field: keyof LocationFormData, value: string | boolean) => {
        const newForms = [...locationForms];
        newForms[index] = { ...newForms[index], [field]: value };
        setLocationForms(newForms);
        
        // Clear error for this field
        if (formErrors[index]?.[field]) {
            const newErrors = { ...formErrors };
            if (newErrors[index]) {
                delete newErrors[index][field];
                if (Object.keys(newErrors[index]).length === 0) {
                    delete newErrors[index];
                }
            }
            setFormErrors(newErrors);
        }

        // Clear city if province changes
        if (field === 'province') {
            newForms[index].city = '';
        }
    };

    const validateLocationForm = (form: LocationFormData, index: number): Record<string, string> => {
        const errors: Record<string, string> = {};

        if (!form.name?.trim()) errors.name = 'Location name is required';
        if (!form.timezone?.trim()) errors.timezone = 'Timezone is required';
        if (!form.address_lookup?.trim()) errors.address_lookup = 'Address lookup is required';
        if (!form.street_address?.trim()) errors.street_address = 'Street address is required';
        if (!form.province?.trim()) errors.province = 'Province is required';
        if (!form.city?.trim()) errors.city = 'City is required';
        if (!form.postal_zip_code?.trim()) {
            errors.postal_zip_code = 'Postal/ZIP code is required';
        } else {
            const postalValidation = validatePostalCode(form.postal_zip_code);
            if (!postalValidation.isValid && postalValidation.error) {
                errors.postal_zip_code = postalValidation.error;
            }
        }
        if (!form.phone_number?.trim()) {
            errors.phone_number = 'Phone number is required';
        } else {
            const phoneValidation = validatePhone(form.phone_number);
            if (!phoneValidation.isValid && phoneValidation.error) {
                errors.phone_number = phoneValidation.error;
            }
        }
        if (!form.email_address?.trim()) {
            errors.email_address = 'Email address is required';
        } else {
            const emailValidation = validateEmail(form.email_address);
            if (!emailValidation.isValid && emailValidation.error) {
                errors.email_address = emailValidation.error;
            }
        }

        return errors;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate all forms
        const errors: Record<number, Record<string, string>> = {};
        let hasErrors = false;

        locationForms.forEach((form, index) => {
            const formErrors = validateLocationForm(form, index);
            if (Object.keys(formErrors).length > 0) {
                errors[index] = formErrors;
                hasErrors = true;
            }
        });

        // If there are errors, set them and return
        if (hasErrors) {
            setFormErrors(errors);
            return;
        }

        setIsSubmitting(true);

        const handleError = (errors: any) => {
            console.error('Failed to create location(s):', errors);
            // Handle validation errors from backend
            const backendErrors: Record<number, Record<string, string>> = {};
            
            Object.keys(errors).forEach((key) => {
                // Check for array notation: locations.0.name
                const match = key.match(/locations\.(\d+)\.(.+)/);
                if (match) {
                    const index = parseInt(match[1]);
                    const field = match[2];
                    if (!backendErrors[index]) backendErrors[index] = {};
                    backendErrors[index][field] = errors[key];
                } else if (!key.includes('.')) {
                    // Handle flat errors for single location mode
                    if (locationForms.length === 1) {
                         if (!backendErrors[0]) backendErrors[0] = {};
                         backendErrors[0][key] = errors[key];
                    }
                }
            });
            
            setFormErrors(backendErrors);
            setIsSubmitting(false);
        };

        // If single location, use regular store endpoint (resource route: POST /locations)
        if (locationForms.length === 1) {
            router.post('/locations', locationForms[0] as any, {
                onSuccess: () => {
                    console.log('Location created, backend redirecting...');
                    // No manual redirect needed
                },
                onError: handleError,
                onFinish: () => setIsSubmitting(false),
            });
        } else {
            // Multiple locations - use storeMultiple endpoint
            router.post('/locations/store-multiple', {
                locations: locationForms,
            } as any, {
                onSuccess: () => {
                    console.log('Locations created, backend redirecting...');
                    // No manual redirect needed
                },
                onError: handleError,
                onFinish: () => setIsSubmitting(false),
            });
        }
    };

    const handleBack = () => {
        // Redirect to practice questionnaire (Let's Get Started page)
        router.visit('/onboarding/questionnaire');
    };

    return (
        <OnboardingLayout title={hasMultipleLocations ? 'Add Locations' : 'Add Location'} contentClassName="flex items-center justify-center">
            <div className="w-full max-w-4xl">
                <div className="w-full max-w-4xl relative" style={{ zIndex: 10 }}>
                    {/* Header Section - Outside Card */}
                    <div className="mb-6 text-center">
                        <div className="flex items-center justify-center gap-3 mb-2">
                            <MapPin className="h-6 w-6 text-primary" />
                            <h1 className="text-2xl font-bold text-gray-900">
                                {hasMultipleLocations ? 'Add Your Practice Locations' : 'Add Your Practice Location'}
                            </h1>
                        </div>
                        <p className="text-sm text-gray-600">
                            {hasMultipleLocations 
                                ? 'Tell us where your practice locations are so patients can find you' 
                                : 'Tell us where your practice is located so patients can find you'}
                        </p>
                    </div>

                    <Card className="border-2 shadow-2xl bg-white">
                        <CardContent className="space-y-4 px-4 pb-4 pt-6">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <AnimatePresence>
                                    {locationForms.map((form, index) => (
                                        <motion.div 
                                            key={form.formId || `form-${index}`} 
                                            ref={(el) => { locationFormRefs.current[index] = el; }}
                                            className="space-y-4 p-4 border rounded-lg bg-white"
                                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ 
                                                opacity: 0, 
                                                y: -10,
                                                scale: 0.95,
                                                transition: { duration: 0.25 }
                                            }}
                                            transition={{ 
                                                duration: 0.4, 
                                                ease: [0.25, 0.1, 0.25, 1],
                                                layout: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }
                                            }}
                                            layout
                                        >
                                        {hasMultipleLocations && locationForms.length > 1 && (
                                            <div className="flex items-center justify-between mb-4 pb-4 border-b">
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    Location {index + 1}
                                                </h3>
                                                {locationForms.length > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeLocationForm(index)}
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    >
                                                        <X className="h-4 w-4 mr-1" />
                                                        Remove
                                                    </Button>
                                                )}
                                            </div>
                                        )}

                                        {/* Name and Timezone */}
                                        <div className="grid grid-cols-1 md:grid-cols-[40%_60%] gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor={`name-${index}`} className="text-sm font-medium text-gray-700">
                                                    Location Name <span className="text-red-500">*</span>
                                                </Label>
                                                <Input
                                                    id={`name-${index}`}
                                                    value={form.name}
                                                    onChange={(e) => updateLocationForm(index, 'name', e.target.value)}
                                                    placeholder="e.g., Main Office"
                                                    className="h-9 text-sm"
                                                    required
                                                />
                                                {formErrors[index]?.name && (
                                                    <p className="text-xs text-red-500">{formErrors[index].name}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor={`timezone-${index}`} className="text-sm font-medium text-gray-700">
                                                    Timezone <span className="text-red-500">*</span>
                                                </Label>
                                                <Select
                                                    value={form.timezone}
                                                    onValueChange={(value) => updateLocationForm(index, 'timezone', value)}
                                                    required
                                                >
                                                    <SelectTrigger className="h-9 text-sm">
                                                        <SelectValue placeholder="Select timezone" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {timezones.map((tz) => (
                                                            <SelectItem key={tz.value} value={tz.value}>
                                                                {tz.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {formErrors[index]?.timezone && (
                                                    <p className="text-xs text-red-500">{formErrors[index].timezone}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Address Lookup */}
                                        <div className="space-y-2">
                                            <Label htmlFor={`address_lookup-${index}`} className="text-sm font-medium text-gray-700">
                                                Address Lookup <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id={`address_lookup-${index}`}
                                                value={form.address_lookup}
                                                onChange={(e) => updateLocationForm(index, 'address_lookup', e.target.value)}
                                                placeholder="Search for address..."
                                                className="h-9 text-sm"
                                                required
                                            />
                                            {formErrors[index]?.address_lookup && (
                                                <p className="text-xs text-red-500">{formErrors[index].address_lookup}</p>
                                            )}
                                        </div>

                                        {/* Street Address and Apt/Suite/Unit */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="md:col-span-2 space-y-2">
                                                <Label htmlFor={`street_address-${index}`} className="text-sm font-medium text-gray-700">
                                                    Street Address <span className="text-red-500">*</span>
                                                </Label>
                                                <Input
                                                    id={`street_address-${index}`}
                                                    value={form.street_address}
                                                    onChange={(e) => updateLocationForm(index, 'street_address', e.target.value)}
                                                    placeholder="123 Main Street"
                                                    className="h-9 text-sm"
                                                    required
                                                />
                                                {formErrors[index]?.street_address && (
                                                    <p className="text-xs text-red-500">{formErrors[index].street_address}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor={`apt_suite_unit-${index}`} className="text-sm font-medium text-gray-700">
                                                    Apt/Suite/Unit
                                                </Label>
                                                <Input
                                                    id={`apt_suite_unit-${index}`}
                                                    value={form.apt_suite_unit}
                                                    onChange={(e) => updateLocationForm(index, 'apt_suite_unit', e.target.value)}
                                                    placeholder="Suite 100"
                                                    className="h-9 text-sm"
                                                />
                                            </div>
                                        </div>

                                        {/* Province, City, Postal Code */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor={`province-${index}`} className="text-sm font-medium text-gray-700">
                                                    Province <span className="text-red-500">*</span>
                                                </Label>
                                                <Select
                                                    value={form.province}
                                                    onValueChange={(value) => updateLocationForm(index, 'province', value)}
                                                    required
                                                >
                                                    <SelectTrigger className="h-9 text-sm">
                                                        <SelectValue placeholder="Select province" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {provinces.map((prov) => (
                                                            <SelectItem key={prov.value} value={prov.value}>
                                                                {prov.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {formErrors[index]?.province && (
                                                    <p className="text-xs text-red-500">{formErrors[index].province}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor={`city-${index}`} className="text-sm font-medium text-gray-700">
                                                    City <span className="text-red-500">*</span>
                                                </Label>
                                                <Select
                                                    value={form.city}
                                                    onValueChange={(value) => updateLocationForm(index, 'city', value)}
                                                    disabled={!form.province}
                                                    required
                                                >
                                                    <SelectTrigger className="h-9 text-sm">
                                                        <SelectValue placeholder="Select city" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {getCitiesForProvince(form.province).map((city) => (
                                                            <SelectItem key={city} value={city}>
                                                                {city}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {formErrors[index]?.city && (
                                                    <p className="text-xs text-red-500">{formErrors[index].city}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor={`postal_zip_code-${index}`} className="text-sm font-medium text-gray-700">
                                                    Postal/ZIP Code <span className="text-red-500">*</span>
                                                </Label>
                                                <Input
                                                    id={`postal_zip_code-${index}`}
                                                    value={form.postal_zip_code}
                                                    onChange={(e) => {
                                                        const formatted = formatPostalCode(e.target.value);
                                                        updateLocationForm(index, 'postal_zip_code', formatted);
                                                    }}
                                                    placeholder="A1A 1A1"
                                                    className="h-9 text-sm uppercase"
                                                    maxLength={7}
                                                    required
                                                />
                                                {formErrors[index]?.postal_zip_code && (
                                                    <p className="text-xs text-red-500">{formErrors[index].postal_zip_code}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Phone and Email */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor={`phone_number-${index}`} className="text-sm font-medium text-gray-700">
                                                    Phone Number <span className="text-red-500">*</span>
                                                </Label>
                                                <Input
                                                    id={`phone_number-${index}`}
                                                    value={form.phone_number}
                                                    onChange={(e) => {
                                                        const formatted = formatPhoneNumber(e.target.value);
                                                        updateLocationForm(index, 'phone_number', formatted);
                                                    }}
                                                    placeholder="(555) 123-4567"
                                                    className="h-9 text-sm"
                                                    required
                                                />
                                                {formErrors[index]?.phone_number && (
                                                    <p className="text-xs text-red-500">{formErrors[index].phone_number}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor={`email_address-${index}`} className="text-sm font-medium text-gray-700">
                                                    Email Address <span className="text-red-500">*</span>
                                                </Label>
                                                <Input
                                                    id={`email_address-${index}`}
                                                    type="email"
                                                    value={form.email_address}
                                                    onChange={(e) => updateLocationForm(index, 'email_address', e.target.value.toLowerCase())}
                                                    placeholder="location@example.com"
                                                    className="h-9 text-sm"
                                                    required
                                                />
                                                {formErrors[index]?.email_address && (
                                                    <p className="text-xs text-red-500">{formErrors[index].email_address}</p>
                                                )}
                                            </div>
                                        </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                {/* Add Another Location Button (only if multiple locations mode) */}
                                {hasMultipleLocations && (
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={addLocationForm}
                                            className="w-full h-9 text-sm"
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add Another Location
                                        </Button>
                                        {isOnboarding && (
                                            <p className="text-xs text-gray-500 text-center mt-2">
                                                Don't worry, you can always add more locations later or from the settings menu.
                                            </p>
                                        )}
                                    </>
                                )}

                                {/* Buttons */}
                                <div className="flex gap-3 pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleBack}
                                        className="flex-1 h-9 text-sm"
                                        disabled={isSubmitting}
                                    >
                                        <ArrowLeft className="h-3.5 w-3.5 mr-2" />
                                        Back
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="flex-1 h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? 'Creating...' : 'Continue'}
                                        <ArrowRight className="h-3.5 w-3.5 ml-2" />
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </OnboardingLayout>
    );
}

