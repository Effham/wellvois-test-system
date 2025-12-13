import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from '@inertiajs/react';
import { FormEventHandler, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { route } from 'ziggy-js';
import { useFieldValidation } from '@/hooks/useFieldValidation';
import {
    validateEmail,
    validatePhone,
    validatePostalCode,
    capitalizeWords,
    toLowerCase,
    formatPhoneNumber,
    formatPostalCode
} from '@/utils/validation';
import { toast } from 'sonner';

interface BasicInfoProps {
    location?: any;
    timezones: Array<{ value: string; label: string }>;
    provinces: Array<{ value: string; label: string }>;
    cities?: Record<string, string[]>;
    onSave?: (location: any) => void;
    onTabChange?: (tab: string) => void;
}

export default function BasicInfo({ location, timezones, provinces, cities, onSave, onTabChange }: BasicInfoProps) {

    const [loading, setLoading] = useState(false);
    const { fieldErrors, createBlurHandler, clearFieldError, setFieldError, clearAllErrors } = useFieldValidation();

    const getDefaultFormData = () => ({
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
});


const getFormDataFromLocation = (locationData: any) => ({
    name: locationData.name || '',
    timezone: locationData.timezone || 'America/Toronto',
    address_lookup: locationData.address_lookup || '',
    street_address: locationData.street_address || '',
    apt_suite_unit: locationData.apt_suite_unit || '',
    city: locationData.city || '',
    postal_zip_code: locationData.postal_zip_code || '',
    province: locationData.province || '',
    phone_number: locationData.phone_number || '',
    email_address: locationData.email_address || '',
    is_active: locationData.is_active !== undefined ? locationData.is_active : true,
});


    // Fallback timezone options if props are empty
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
        { value: 'Europe/London', label: 'GMT (GMT+0) - London' },
        { value: 'Europe/Paris', label: 'CET (GMT+1) - Paris, Berlin' },
        { value: 'Asia/Tokyo', label: 'JST (GMT+9) - Tokyo' },
        { value: 'Australia/Sydney', label: 'AEST (GMT+10) - Sydney' },
        { value: 'Pacific/Auckland', label: 'NZST (GMT+12) - Auckland' },
    ];

    const availableTimezones = timezones && timezones.length > 0 ? timezones : fallbackTimezones;

    // Fallback province options if props are empty
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

    const availableProvinces = provinces && provinces.length > 0 ? provinces : fallbackProvinces;

    // Fallback cities data if props are empty
    const fallbackCities = {
        'AB': ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'Medicine Hat', 'Grande Prairie', 'Airdrie', 'Spruce Grove', 'Leduc', 'Lloydminster', 'Camrose', 'Fort McMurray', 'Beaumont', 'St. Albert', 'Sherwood Park'],
        'BC': ['Vancouver', 'Victoria', 'Surrey', 'Burnaby', 'Richmond', 'Abbotsford', 'Coquitlam', 'Kelowna', 'Saanich', 'Langley', 'Delta', 'North Vancouver', 'Kamloops', 'Nanaimo', 'Chilliwack', 'Prince George', 'Vernon', 'Courtenay', 'Penticton', 'Campbell River'],
        'MB': ['Winnipeg', 'Brandon', 'Steinbach', 'Portage la Prairie', 'Thompson', 'Winkler', 'Selkirk', 'Morden', 'Dauphin', 'The Pas', 'Flin Flon', 'Swan River', 'Stonewall', 'Beausejour', 'Gimli'],
        'NB': ['Saint John', 'Moncton', 'Fredericton', 'Dieppe', 'Riverview', 'Campbellton', 'Edmundston', 'Bathurst', 'Miramichi', 'Sackville', 'Caraquet', 'Sussex', 'Woodstock', 'Shediac', 'Oromocto'],
        'NL': ['St. Johns', 'Mount Pearl', 'Corner Brook', 'Conception Bay South', 'Grand Falls-Windsor', 'Paradise', 'Happy Valley-Goose Bay', 'Gander', 'Labrador City', 'Stephenville', 'Torbay', 'Bay Roberts', 'Clarenville', 'Deer Lake', 'Carbonear'],
        'NS': ['Halifax', 'Sydney', 'Dartmouth', 'Truro', 'New Glasgow', 'Glace Bay', 'Yarmouth', 'Kentville', 'Amherst', 'Bridgewater', 'Antigonish', 'Wolfville', 'Digby', 'Pictou', 'Shelburne'],
        'NT': ['Yellowknife', 'Hay River', 'Inuvik', 'Fort Smith', 'Behchoko', 'Tuktoyaktuk', 'Norman Wells', 'Fort Simpson', 'Fort Good Hope', 'Fort Providence'],
        'NU': ['Iqaluit', 'Rankin Inlet', 'Arviat', 'Baker Lake', 'Cambridge Bay', 'Igloolik', 'Pangnirtung', 'Pond Inlet', 'Kugluktuk', 'Cape Dorset'],
        'ON': ['Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton', 'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor', 'Richmond Hill', 'Oakville', 'Burlington', 'Oshawa', 'Barrie', 'St. Catharines', 'Cambridge', 'Kingston', 'Guelph', 'Thunder Bay', 'Waterloo', 'Sudbury', 'Sault Ste. Marie', 'Sarnia', 'Peterborough', 'Niagara Falls', 'Brantford', 'Pickering', 'Ajax', 'Whitby'],
        'PE': ['Charlottetown', 'Summerside', 'Stratford', 'Cornwall', 'Montague', 'Kensington', 'Souris', 'Alberton', 'Georgetown', 'Tignish'],
        'QC': ['Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Longueuil', 'Sherbrooke', 'Saguenay', 'Lévis', 'Trois-Rivières', 'Terrebonne', 'Saint-Jean-sur-Richelieu', 'Repentigny', 'Brossard', 'Drummondville', 'Saint-Jérôme', 'Granby', 'Blainville', 'Saint-Hyacinthe', 'Shawinigan', 'Dollard-des-Ormeaux'],
        'SK': ['Saskatoon', 'Regina', 'Prince Albert', 'Moose Jaw', 'Swift Current', 'Yorkton', 'North Battleford', 'Estevan', 'Weyburn', 'Lloydminster', 'Martensville', 'Warman', 'Meadow Lake', 'Kindersley', 'Melfort'],
        'YT': ['Whitehorse', 'Dawson City', 'Watson Lake', 'Haines Junction', 'Mayo', 'Carmacks', 'Faro', 'Teslin', 'Old Crow', 'Beaver Creek']
    };

    const availableCities = (cities && Object.keys(cities).length > 0) ? cities : fallbackCities;



    // Get cities for the currently selected province
    const getCitiesForProvince = (provinceCode: string) => {
        // Handle empty/null/undefined province codes
        if (!provinceCode || provinceCode.trim() === '') {
            return [];
        }

        const citiesData = availableCities as Record<string, string[]>;
        return citiesData[provinceCode] || [];
    };

    const { data, setData, post, put, processing, errors, reset } = useForm(
    location ? getFormDataFromLocation(location) : getDefaultFormData()
);

    const fetchLocationData = useCallback(async () => {
    if (!location?.id) return;
    
    // Check if we already have most of the data to avoid unnecessary API calls
    const hasBasicData = location.name && location.street_address && location.city;
    if (hasBasicData) {
        // We already have the data, no need to fetch
        return;
    }

    setLoading(true);
    try {
        const response = await axios.get(route('locations.show', location.id));
        const locationData = response.data.location;

        if (locationData) {
            setData(getFormDataFromLocation(locationData));
        }
    } catch (error) {
        console.error('Error fetching location data:', error);
    } finally {
        setLoading(false);
    }
}, [location?.id, location?.name, location?.street_address, location?.city, setData]);
    // Clear city when province changes
    const handleProvinceChange = (provinceCode: string) => {
        setData('province', provinceCode);
        // Clear city if the current city is not available in the new province
        const citiesInProvince = getCitiesForProvince(provinceCode);
        if (!citiesInProvince.includes(data.city)) {
            setData('city', '');
        }
    };

    

    useEffect(() => {
    if (location?.id) {
        // For existing locations, populate form and fetch if needed
        setData(getFormDataFromLocation(location));
        fetchLocationData();
    } else if (location && !location.id) {
        // For new locations with pre-filled data
        setData(getFormDataFromLocation(location));
    } else {
        // For completely new locations
        setData(getDefaultFormData());
    }
}, [location?.id]);

    useEffect(() => {
        if (location && !location.id) {
            setData({
                name: location.name || '',
                timezone: location.timezone || 'America/Toronto',
                address_lookup: location.address_lookup || '',
                street_address: location.street_address || '',
                apt_suite_unit: location.apt_suite_unit || '',
                city: location.city || '',
                postal_zip_code: location.postal_zip_code || '',
                province: location.province || '',
                phone_number: location.phone_number || '',
                email_address: location.email_address || '',
                is_active: location.is_active !== undefined ? location.is_active : true,
            });
        }
    }, [location]);

    {loading && (
    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <div className="flex items-center text-blue-700">
            <div className="mr-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
            <span className="text-sm">Updating location data...</span>
        </div>
    </div>
)}

    const validateAllFields = () => {
        const errors: Record<string, string> = {};

        console.log('🔍 [BasicInfo] Validating all fields, current data:', {
            name: data.name,
            timezone: data.timezone,
            province: data.province,
            city: data.city,
            email_address: data.email_address,
            phone_number: data.phone_number
        });

        // Validate required fields
        if (!data.name || data.name.trim() === '') {
            errors.name = 'Location name is required';
        }

        if (!data.timezone || data.timezone.trim() === '') {
            errors.timezone = 'Timezone is required';
        }

        if (!data.address_lookup || data.address_lookup.trim() === '') {
            errors.address_lookup = 'Address lookup is required';
        }

        if (!data.street_address || data.street_address.trim() === '') {
            errors.street_address = 'Street address is required';
        }

        if (!data.province || data.province.trim() === '') {
            console.log('❌ [BasicInfo] Province validation failed, value:', data.province);
            errors.province = 'Province is required';
        }

        if (!data.city || data.city.trim() === '') {
            console.log('❌ [BasicInfo] City validation failed, value:', data.city);
            errors.city = 'City is required';
        }

        if (!data.postal_zip_code || data.postal_zip_code.trim() === '') {
            errors.postal_zip_code = 'Postal/ZIP code is required';
        } else {
            const postalValidation = validatePostalCode(data.postal_zip_code);
            if (!postalValidation.isValid && postalValidation.error) {
                errors.postal_zip_code = postalValidation.error;
            }
        }

        if (!data.phone_number || data.phone_number.trim() === '') {
            errors.phone_number = 'Phone number is required';
        } else {
            const phoneValidation = validatePhone(data.phone_number);
            if (!phoneValidation.isValid && phoneValidation.error) {
                errors.phone_number = phoneValidation.error;
            }
        }

        if (!data.email_address || data.email_address.trim() === '') {
            errors.email_address = 'Email address is required';
        } else {
            const emailValidation = validateEmail(data.email_address);
            if (!emailValidation.isValid && emailValidation.error) {
                errors.email_address = emailValidation.error;
            }
        }

        return errors;
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        console.log('========================================');
        console.log('🔷 [BasicInfo] Form submission started');
        console.log('🔷 [BasicInfo] Form data:', data);
        console.log('🔷 [BasicInfo] Location:', location);
        console.log('🔷 [BasicInfo] Processing:', processing);
        console.log('========================================');

        // Clear all previous validation errors
        clearAllErrors();

        // Validate all fields on submit
        const validationErrors = validateAllFields();

        // If there are validation errors, set them and prevent submission
        if (Object.keys(validationErrors).length > 0) {
            Object.keys(validationErrors).forEach((field) => {
                setFieldError(field, validationErrors[field]);
            });
            console.error('❌ [BasicInfo] Client-side validation failed:', validationErrors);
            return;
        }

        console.log('✅ [BasicInfo] Client-side validation passed');

        if (location?.id) {
            const updateRoute = route('locations.update', location.id);
            console.log('🔷 [BasicInfo] Updating existing location');
            console.log('🔷 [BasicInfo] Update route:', updateRoute);

            put(updateRoute, {
                onBefore: () => {
                    console.log('⏳ [BasicInfo] Update request starting...');
                },
                onStart: () => {
                    console.log('🚀 [BasicInfo] Update request sent');
                },
                onSuccess: (page) => {
                    console.log('✅ [BasicInfo] Update successful');
                    console.log('✅ [BasicInfo] Response:', page);
                    toast.success('Location updated successfully!');
                    if (onSave) onSave(page.props.location);
                    if (onTabChange) {
                        setTimeout(() => {
                            onTabChange('operating-hours');
                        }, 500);
                    }
                },
                onError: (errors) => {
                    console.error('❌ [BasicInfo] Update failed with errors:', errors);
                },
                onFinish: () => {
                    console.log('🏁 [BasicInfo] Update request finished');
                }
            });
        } else {
            const storeRoute = route('locations.store');
            console.log('🔷 [BasicInfo] Creating new location');
            console.log('🔷 [BasicInfo] Store route:', storeRoute);

            // Check if we're in onboarding flow
            const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
            const isOnboarding = urlParams.get('onboarding') === 'true';
            
            // Add onboarding parameter to the route if needed
            const finalRoute = isOnboarding ? `${storeRoute}?onboarding=true` : storeRoute;

            post(finalRoute, {
                onBefore: () => {
                    console.log('⏳ [BasicInfo] Create request starting...');
                },
                onStart: () => {
                    console.log('🚀 [BasicInfo] Create request sent');
                },
                onSuccess: (page) => {
                    console.log('✅ [BasicInfo] Create successful');
                    console.log('✅ [BasicInfo] Response:', page);
                    console.log('✅ [BasicInfo] Flash messages:', page.props.flash);
                    
                    // Only show toast if not in onboarding (redirect will handle it)
                    if (!isOnboarding) {
                        toast.success('Location created successfully!');
                        reset();
                        if (onSave) onSave(page.props.location);
                        if (onTabChange) {
                            setTimeout(() => {
                                onTabChange('operating-hours');
                            }, 500);
                        }
                    }
                    // If onboarding, the redirect will happen automatically
                },
                onError: (errors) => {
                    console.error('❌ [BasicInfo] Create failed with errors:', errors);
                },
                onFinish: () => {
                    console.log('🏁 [BasicInfo] Create request finished');
                }
            });
        }
    };

    return (
        <form onSubmit={submit}>
            <div className="px-6 py-4">
                <div className="space-y-6">
                    {/* Location Name and Timezone Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">
                                Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="name"
                                name="name"
                                type="text"
                                value={data.name}
                                onChange={(e) => {
                                    setData('name', e.target.value);
                                    clearFieldError('name');
                                }}
                                onBlur={(e) => {
                                    const handler = createBlurHandler('name', (value) => ({ isValid: true }), capitalizeWords);
                                    handler(e.target.value, setData);
                                }}
                                placeholder="Enter Location Name"
                                className={fieldErrors.name || errors.name ? 'border-red-500' : ''}
                            />
                            {(fieldErrors.name || errors.name) && (
                                <span className="text-red-500 text-sm">{fieldErrors.name || errors.name}</span>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="timezone">
                                Timezone <span className="text-red-500">*</span>
                            </Label>
                            <Select value={data.timezone} onValueChange={(value) => {
                                setData('timezone', value);
                                clearFieldError('timezone');
                            }}>
                                <SelectTrigger className={fieldErrors.timezone || errors.timezone ? 'border-red-500' : ''}>
                                    <SelectValue placeholder="Select time zone" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableTimezones.map((timezone) => (
                                        <SelectItem key={timezone.value} value={timezone.value}>
                                            {timezone.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {(fieldErrors.timezone || errors.timezone) && (
                                <span className="text-red-500 text-sm">{fieldErrors.timezone || errors.timezone}</span>
                            )}
                        </div>
                    </div>

                    {/* Address Lookup */}
                    <div className="space-y-2">
                        <Label htmlFor="address_lookup">
                            Address Lookup <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="address_lookup"
                            name="address_lookup"
                            type="text"
                            value={data.address_lookup}
                            onChange={(e) => {
                                setData('address_lookup', e.target.value);
                                clearFieldError('address_lookup');
                            }}
                            onBlur={(e) => {
                                const handler = createBlurHandler('address_lookup', (value) => ({ isValid: true }), capitalizeWords);
                                handler(e.target.value, setData);
                            }}
                            placeholder="Enter address lookup"
                            className={fieldErrors.address_lookup || errors.address_lookup ? 'border-red-500' : ''}
                        />
                        {(fieldErrors.address_lookup || errors.address_lookup) && (
                            <span className="text-red-500 text-sm">{fieldErrors.address_lookup || errors.address_lookup}</span>
                        )}
                    </div>

                    {/* Street Address */}
                    <div className="space-y-2">
                        <Label htmlFor="street_address">
                            Street Address <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="street_address"
                            name="street_address"
                            type="text"
                            value={data.street_address}
                            onChange={(e) => {
                                setData('street_address', e.target.value);
                                clearFieldError('street_address');
                            }}
                            onBlur={(e) => {
                                const handler = createBlurHandler('street_address', (value) => ({ isValid: true }), capitalizeWords);
                                handler(e.target.value, setData);
                            }}
                            placeholder="Enter street address"
                            className={fieldErrors.street_address || errors.street_address ? 'border-red-500' : ''}
                        />
                        {(fieldErrors.street_address || errors.street_address) && (
                            <span className="text-red-500 text-sm">{fieldErrors.street_address || errors.street_address}</span>
                        )}
                    </div>

                    {/* Address Details Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="apt_suite_unit">Apt/Suite/Unit No.</Label>
                            <Input
                                id="apt_suite_unit"
                                name="apt_suite_unit"
                                type="text"
                                value={data.apt_suite_unit}
                                onChange={(e) => setData('apt_suite_unit', e.target.value)}
                                placeholder="Enter no."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="province">
                                Province <span className="text-red-500">*</span>
                            </Label>
                            <Select value={data.province} onValueChange={(value) => {
                                handleProvinceChange(value);
                                clearFieldError('province');
                            }}>
                                <SelectTrigger className={fieldErrors.province || errors.province ? 'border-red-500' : ''}>
                                    <SelectValue placeholder="Select province" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableProvinces.map((province) => (
                                        <SelectItem key={province.value} value={province.value}>
                                            {province.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {(fieldErrors.province || errors.province) && (
                                <span className="text-red-500 text-sm">{fieldErrors.province || errors.province}</span>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="city">
                                City <span className="text-red-500">*</span>
                            </Label>
                            <Select value={data.city} onValueChange={(value) => {
                                setData('city', value);
                                clearFieldError('city');
                            }}>
                                <SelectTrigger className={fieldErrors.city || errors.city ? 'border-red-500' : ''}>
                                    <SelectValue placeholder="Select city" />
                                </SelectTrigger>
                                <SelectContent>
                                    {getCitiesForProvince(data.province).map((city) => (
                                        <SelectItem key={city} value={city}>
                                            {city}
                                        </SelectItem>
                                    ))}
                                    {getCitiesForProvince(data.province).length === 0 && (
                                        <SelectItem value="no_province_selected" disabled>
                                            Please select a province first
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            {(fieldErrors.city || errors.city) && (
                                <span className="text-red-500 text-sm">{fieldErrors.city || errors.city}</span>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="postal_zip_code">
                                Postal/ZIP Code <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="postal_zip_code"
                                name="postal_zip_code"
                                type="text"
                                value={data.postal_zip_code}
                                onChange={(e) => {
                                    setData('postal_zip_code', e.target.value);
                                    clearFieldError('postal_zip_code');
                                }}
                                onBlur={(e) => {
                                    const handler = createBlurHandler('postal_zip_code', validatePostalCode, formatPostalCode);
                                    handler(e.target.value, setData);
                                }}
                                placeholder="Postal code"
                                className={fieldErrors.postal_zip_code || errors.postal_zip_code ? 'border-red-500' : ''}
                            />
                            {(fieldErrors.postal_zip_code || errors.postal_zip_code) && (
                                <span className="text-red-500 text-sm">{fieldErrors.postal_zip_code || errors.postal_zip_code}</span>
                            )}
                        </div>
                    </div>

                    {/* Contact Information Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone_number">
                                Phone Number <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="phone_number"
                                name="phone_number"
                                type="tel"
                                value={data.phone_number}
                                onChange={(e) => {
                                    setData('phone_number', e.target.value);
                                    clearFieldError('phone_number');
                                }}
                                onBlur={(e) => {
                                    const handler = createBlurHandler('phone_number', validatePhone, formatPhoneNumber);
                                    handler(e.target.value, setData);
                                }}
                                placeholder="Enter phone number"
                                className={fieldErrors.phone_number || errors.phone_number ? 'border-red-500' : ''}
                            />
                            {(fieldErrors.phone_number || errors.phone_number) && (
                                <span className="text-red-500 text-sm">{fieldErrors.phone_number || errors.phone_number}</span>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email_address">
                                Email Address <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="email_address"
                                name="email_address"
                                type="email"
                                value={data.email_address}
                                onChange={(e) => {
                                    setData('email_address', e.target.value);
                                    clearFieldError('email_address');
                                }}
                                onBlur={(e) => {
                                    const handler = createBlurHandler('email_address', validateEmail, toLowerCase);
                                    handler(e.target.value, setData);
                                }}
                                placeholder="Enter Email address"
                                className={fieldErrors.email_address || errors.email_address ? 'border-red-500' : ''}
                            />
                            {(fieldErrors.email_address || errors.email_address) && (
                                <span className="text-red-500 text-sm">{fieldErrors.email_address || errors.email_address}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-6">
                    <Button
                        type="submit"
                        disabled={processing || loading}
                        size="save"
                        onClick={() => {
                            console.log('🔷 [BasicInfo] Save button clicked');
                            console.log('🔷 [BasicInfo] Button disabled:', processing || loading);
                            console.log('🔷 [BasicInfo] Processing:', processing);
                            console.log('🔷 [BasicInfo] Loading:', loading);
                        }}
                    >
                        {processing ? 'Saving...' : loading ? 'Loading...' : 'Save'}
                    </Button>
                </div>
            </div>
        </form>
    );
} 