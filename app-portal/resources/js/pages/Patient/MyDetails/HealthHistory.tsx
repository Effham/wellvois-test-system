import React, { useState, useEffect } from 'react';
import { Head, useForm, usePage, router } from '@inertiajs/react';
import { withAppLayout } from '@/utils/layout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useS3Upload } from '@/hooks/use-s3-upload';

interface HealthHistoryData {
    // Client Information
    health_number: string;
    first_name: string;
    last_name: string;
    preferred_name: string;
    phone_number: string;
    email: string;
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

    // Health & Clinical History
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

    // Insurance
    insurance_provider: string;
    policy_number: string;
    coverage_card: File | null;
    coverage_card_path: string;
}

interface HealthHistoryProps {
    patient: any;
}

function HealthHistory({ patient }: HealthHistoryProps) {
    const [activeTab, setActiveTab] = useState('client-info');
    const { uploadFile } = useS3Upload();
    const [uploadingCoverageCard, setUploadingCoverageCard] = useState(false);
    const [coverageCardFile, setCoverageCardFile] = useState<File | null>(null);
    const [coverageCardPreview, setCoverageCardPreview] = useState<string | null>(null);
    const [existingCardPreview, setExistingCardPreview] = useState<string | null>(null);
    const [loadingExistingCard, setLoadingExistingCard] = useState(false);

    const { data, setData, processing, errors } = useForm<HealthHistoryData>({
        // Client Information
        health_number: patient?.health_number || '',
        first_name: patient?.first_name || '',
        last_name: patient?.last_name || '',
        preferred_name: patient?.preferred_name || '',
        phone_number: patient?.phone_number || '',
        email: patient?.email || '',
        gender_pronouns: patient?.gender_pronouns || '',
        client_type: patient?.client_type || '',
        date_of_birth: patient?.date_of_birth || '',
        emergency_contact_phone: patient?.emergency_contact_phone || '',
        address_lookup: patient?.address_lookup || '',
        street_address: patient?.street_address || '',
        apt_suite_unit: patient?.apt_suite_unit || '',
        city: patient?.city || '',
        postal_zip_code: patient?.postal_zip_code || '',
        province: patient?.province || '',

        // Health & Clinical History
        presenting_concern: patient?.presenting_concern || '',
        goals_for_therapy: patient?.goals_for_therapy || '',
        previous_therapy_experience: patient?.previous_therapy_experience || '',
        current_medications: patient?.current_medications || '',
        diagnoses: patient?.diagnoses || '',
        history_of_hospitalization: patient?.history_of_hospitalization || '',
        risk_safety_concerns: patient?.risk_safety_concerns || '',
        other_medical_conditions: patient?.other_medical_conditions || '',
        cultural_religious_considerations: patient?.cultural_religious_considerations || '',
        accessibility_needs: patient?.accessibility_needs || '',

        // Insurance
        insurance_provider: patient?.insurance_provider || '',
        policy_number: patient?.policy_number || '',
        coverage_card: null,
        coverage_card_path: patient?.coverage_card_path || '',
    });

    // Load existing coverage card preview if it exists
    useEffect(() => {
        const loadExistingCoverageCard = async () => {
            if (data.coverage_card_path && !coverageCardFile) {
                // Check if it's an image file based on the extension
                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(data.coverage_card_path);
                
                if (isImage) {
                    setLoadingExistingCard(true);
                    try {
                        const response = await fetch(`/api/storage/signed-url?key=${encodeURIComponent(data.coverage_card_path)}&expires_minutes=60`, {
                            headers: {
                                'Accept': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest',
                            }
                        });

                        if (response.ok) {
                            const { url } = await response.json();
                            setExistingCardPreview(url);
                        }
                    } catch (error) {
                        console.error('Error loading existing coverage card preview:', error);
                    } finally {
                        setLoadingExistingCard(false);
                    }
                }
            }
        };

        loadExistingCoverageCard();
    }, [data.coverage_card_path]);

    // Handle coverage card file selection
    const handleCoverageCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
            if (!allowedTypes.includes(file.type)) {
                toast.error('Invalid file type', {
                    description: 'Please select a PDF, JPG, or PNG file'
                });
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                toast.error('File too large', {
                    description: 'File size must be less than 5MB'
                });
                return;
            }

            // Clear existing preview when new file is selected
            setExistingCardPreview(null);
            setCoverageCardFile(file);
            setData('coverage_card', file);

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => setCoverageCardPreview(e.target?.result as string);
                reader.readAsDataURL(file);
            } else {
                setCoverageCardPreview(null);
            }

            toast.success('File selected', {
                description: 'Coverage card will be uploaded when you save'
            });
        }
    };

    // Upload coverage card to S3
    const uploadCoverageCardToS3 = async () => {
        if (!coverageCardFile) return true;

        setUploadingCoverageCard(true);
        try {
            const s3Key = `patients/coverage-cards/${Date.now()}_${coverageCardFile.name}`;

            const response = await uploadFile(coverageCardFile, {
                key: s3Key,
                expiresMinutes: 1440,
            });

            setData('coverage_card_path', response.key);
            console.log('[S3 Upload] Coverage card uploaded:', {
                key: response.key,
                signedUrl: response.signed_url
            });
            setUploadingCoverageCard(false);
            return true;
        } catch (error) {
            console.error('[S3 Upload] Coverage card upload failed:', error);
            setUploadingCoverageCard(false);
            toast.error('File Upload Failed', {
                description: `Failed to upload coverage card: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
            return false;
        }
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Upload coverage card to S3 first if file exists
        const uploadSuccess = await uploadCoverageCardToS3();
        if (!uploadSuccess) {
            console.error('[Form Submit] Coverage card upload failed, aborting submission');
            return;
        }

        const uploadedKey = data.coverage_card_path;

        const submissionData = {
            ...data,
            coverage_card_path: uploadedKey
        };

        router.put(route('central.my-details.health-history.update'), submissionData, {
            onSuccess: () => {
                toast.success('Health History Updated', {
                    description: 'Your health information has been updated successfully!'
                });
                setCoverageCardFile(null);
                setCoverageCardPreview(null);
            },
            onError: (errors) => {
                console.error('Health history update errors:', errors);
                toast.error('Update Failed', {
                    description: 'Please check the form for errors and try again.'
                });
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

    const clientTypeOptions = [
        { value: 'individual', label: 'Individual' },
        { value: 'couple', label: 'Couple' },
        { value: 'family', label: 'Family' },
        { value: 'group', label: 'Group' },
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
            <Head title="Health History" />

            <div className="px-4 py-6">
                <div className="w-full">
                    <div className="bg-white rounded-lg p-6 w-full min-h-[600px]">
                        {/* Header */}
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-gray-900">My Health History</h1>
                            <p className="text-sm text-gray-500 mt-1">Update your personal and health information</p>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-3 mb-6">
                                    <TabsTrigger value="client-info">Client Information</TabsTrigger>
                                    <TabsTrigger value="health-clinical">Health & Clinical History</TabsTrigger>
                                    <TabsTrigger value="insurance">Insurance & Legal</TabsTrigger>
                                </TabsList>

                                {/* Client Information Tab */}
                                <TabsContent value="client-info" className="space-y-6">
                                    <div className="space-y-4">
                                        {/* Health Card Number */}
                                        <div className="space-y-2">
                                            <Label htmlFor="health_number">Health Card Number</Label>
                                            <Input
                                                id="health_number"
                                                value={data.health_number}
                                                onChange={(e) => setData('health_number', e.target.value.toUpperCase())}
                                                placeholder="e.g., 1234-567-890"
                                                className="placeholder:text-gray-400"
                                            />
                                            {errors.health_number && (
                                                <p className="text-sm text-red-500">{errors.health_number}</p>
                                            )}
                                        </div>

                                        {/* Name Fields */}
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="first_name">First Name</Label>
                                                <Input
                                                    id="first_name"
                                                    value={data.first_name}
                                                    onChange={(e) => setData('first_name', e.target.value)}
                                                    placeholder="First Name"
                                                    className="placeholder:text-gray-400"
                                                />
                                                {errors.first_name && (
                                                    <p className="text-sm text-red-500">{errors.first_name}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="last_name">Last Name</Label>
                                                <Input
                                                    id="last_name"
                                                    value={data.last_name}
                                                    onChange={(e) => setData('last_name', e.target.value)}
                                                    placeholder="Last Name"
                                                    className="placeholder:text-gray-400"
                                                />
                                                {errors.last_name && (
                                                    <p className="text-sm text-red-500">{errors.last_name}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="preferred_name">Preferred Name (if different)</Label>
                                                <Input
                                                    id="preferred_name"
                                                    value={data.preferred_name}
                                                    onChange={(e) => setData('preferred_name', e.target.value)}
                                                    placeholder="e.g., Alex"
                                                    className="placeholder:text-gray-400"
                                                />
                                                {errors.preferred_name && (
                                                    <p className="text-sm text-red-500">{errors.preferred_name}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Contact Fields */}
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="phone_number">Phone Number</Label>
                                                <Input
                                                    id="phone_number"
                                                    value={data.phone_number}
                                                    onChange={(e) => setData('phone_number', e.target.value)}
                                                    placeholder="Phone Number"
                                                    className="placeholder:text-gray-400"
                                                />
                                                {errors.phone_number && (
                                                    <p className="text-sm text-red-500">{errors.phone_number}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="email">Email Address</Label>
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    value={data.email}
                                                    onChange={(e) => setData('email', e.target.value)}
                                                    placeholder="Email Address"
                                                    className="placeholder:text-gray-400"
                                                />
                                                {errors.email && (
                                                    <p className="text-sm text-red-500">{errors.email}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="gender_pronouns">Gender / Pronouns</Label>
                                                <Input
                                                    id="gender_pronouns"
                                                    value={data.gender_pronouns}
                                                    onChange={(e) => setData('gender_pronouns', e.target.value)}
                                                    placeholder="e.g., She/Her, He/Him, They/Them"
                                                    className="placeholder:text-gray-400"
                                                />
                                                {errors.gender_pronouns && (
                                                    <p className="text-sm text-red-500">{errors.gender_pronouns}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Client Type, DOB, Emergency Contact */}
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="client_type">Client Type</Label>
                                                <Select
                                                    value={data.client_type}
                                                    onValueChange={(value) => setData('client_type', value)}
                                                >
                                                    <SelectTrigger className="placeholder:text-gray-400">
                                                        <SelectValue placeholder="Select type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {clientTypeOptions.map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {errors.client_type && (
                                                    <p className="text-sm text-red-500">{errors.client_type}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="date_of_birth">Date of Birth</Label>
                                                <Input
                                                    id="date_of_birth"
                                                    type="date"
                                                    value={data.date_of_birth}
                                                    onChange={(e) => setData('date_of_birth', e.target.value)}
                                                    className="placeholder:text-gray-400"
                                                    max={new Date().toISOString().split('T')[0]}
                                                />
                                                {errors.date_of_birth && (
                                                    <p className="text-sm text-red-500">{errors.date_of_birth}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
                                                <Input
                                                    id="emergency_contact_phone"
                                                    value={data.emergency_contact_phone}
                                                    onChange={(e) => setData('emergency_contact_phone', e.target.value)}
                                                    placeholder="Emergency Contact"
                                                    className="placeholder:text-gray-400"
                                                />
                                                {errors.emergency_contact_phone && (
                                                    <p className="text-sm text-red-500">{errors.emergency_contact_phone}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Address Fields */}
                                        <div className="space-y-2">
                                            <Label htmlFor="address_lookup">Address Lookup</Label>
                                            <Input
                                                id="address_lookup"
                                                value={data.address_lookup}
                                                onChange={(e) => setData('address_lookup', e.target.value)}
                                                placeholder="Enter address"
                                                className="placeholder:text-gray-400"
                                            />
                                            {errors.address_lookup && (
                                                <p className="text-sm text-red-500">{errors.address_lookup}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="street_address">Street Address</Label>
                                            <Input
                                                id="street_address"
                                                value={data.street_address}
                                                onChange={(e) => setData('street_address', e.target.value)}
                                                placeholder="Street Address"
                                                className="placeholder:text-gray-400"
                                            />
                                            {errors.street_address && (
                                                <p className="text-sm text-red-500">{errors.street_address}</p>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="apt_suite_unit">Apt/Suite/Unit No. (optional)</Label>
                                                <Input
                                                    id="apt_suite_unit"
                                                    value={data.apt_suite_unit}
                                                    onChange={(e) => setData('apt_suite_unit', e.target.value)}
                                                    placeholder="Unit #"
                                                    className="placeholder:text-gray-400"
                                                />
                                                {errors.apt_suite_unit && (
                                                    <p className="text-sm text-red-500">{errors.apt_suite_unit}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="city">City</Label>
                                                <Input
                                                    id="city"
                                                    value={data.city}
                                                    onChange={(e) => setData('city', e.target.value)}
                                                    placeholder="City"
                                                    className="placeholder:text-gray-400"
                                                />
                                                {errors.city && (
                                                    <p className="text-sm text-red-500">{errors.city}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="postal_zip_code">Postal/ZIP Code</Label>
                                                <Input
                                                    id="postal_zip_code"
                                                    value={data.postal_zip_code}
                                                    onChange={(e) => setData('postal_zip_code', e.target.value)}
                                                    placeholder="Postal Code"
                                                    className="placeholder:text-gray-400"
                                                />
                                                {errors.postal_zip_code && (
                                                    <p className="text-sm text-red-500">{errors.postal_zip_code}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="province">Province</Label>
                                                <Select
                                                    value={data.province}
                                                    onValueChange={(value) => setData('province', value)}
                                                >
                                                    <SelectTrigger className="placeholder:text-gray-400">
                                                        <SelectValue placeholder="Select province" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {provinceOptions.map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {errors.province && (
                                                    <p className="text-sm text-red-500">{errors.province}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* Health & Clinical History Tab */}
                                <TabsContent value="health-clinical" className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="presenting_concern">Presenting Concern</Label>
                                            <Textarea
                                                id="presenting_concern"
                                                value={data.presenting_concern}
                                                onChange={(e) => setData('presenting_concern', e.target.value)}
                                                placeholder="What brings you to therapy?"
                                                className="min-h-[100px] placeholder:text-gray-400"
                                                rows={4}
                                            />
                                            {errors.presenting_concern && (
                                                <p className="text-sm text-red-500">{errors.presenting_concern}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="goals_for_therapy">Goals for Therapy</Label>
                                            <Textarea
                                                id="goals_for_therapy"
                                                value={data.goals_for_therapy}
                                                onChange={(e) => setData('goals_for_therapy', e.target.value)}
                                                placeholder="What would you like to achieve?"
                                                className="min-h-[100px] placeholder:text-gray-400"
                                                rows={4}
                                            />
                                            {errors.goals_for_therapy && (
                                                <p className="text-sm text-red-500">{errors.goals_for_therapy}</p>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label htmlFor="previous_therapy_experience">Previous Therapy Experience</Label>
                                                <Select
                                                    value={data.previous_therapy_experience}
                                                    onValueChange={(value) => setData('previous_therapy_experience', value)}
                                                >
                                                    <SelectTrigger className="placeholder:text-gray-400">
                                                        <SelectValue placeholder="Select experience" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {previousTherapyOptions.map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {errors.previous_therapy_experience && (
                                                    <p className="text-sm text-red-500">{errors.previous_therapy_experience}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="current_medications">Current Medications (Optional)</Label>
                                                <Input
                                                    id="current_medications"
                                                    value={data.current_medications}
                                                    onChange={(e) => setData('current_medications', e.target.value)}
                                                    placeholder="e.g., Sertraline 50mg daily"
                                                    className="placeholder:text-gray-400"
                                                />
                                                {errors.current_medications && (
                                                    <p className="text-sm text-red-500">{errors.current_medications}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Two Column Layout for Rest */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Left Column */}
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="diagnoses">Diagnoses (Optional)</Label>
                                                    <Textarea
                                                        id="diagnoses"
                                                        value={data.diagnoses}
                                                        onChange={(e) => setData('diagnoses', e.target.value)}
                                                        placeholder="Any diagnosed conditions"
                                                        className="min-h-[80px] placeholder:text-gray-400"
                                                        rows={3}
                                                    />
                                                    {errors.diagnoses && (
                                                        <p className="text-sm text-red-500">{errors.diagnoses}</p>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="risk_safety_concerns">Risk & Safety Concerns</Label>
                                                    <Textarea
                                                        id="risk_safety_concerns"
                                                        value={data.risk_safety_concerns}
                                                        onChange={(e) => setData('risk_safety_concerns', e.target.value)}
                                                        placeholder="Any safety concerns"
                                                        className="min-h-[80px] placeholder:text-gray-400"
                                                        rows={3}
                                                    />
                                                    {errors.risk_safety_concerns && (
                                                        <p className="text-sm text-red-500">{errors.risk_safety_concerns}</p>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="cultural_religious_considerations">Cultural/Religious Considerations</Label>
                                                    <Textarea
                                                        id="cultural_religious_considerations"
                                                        value={data.cultural_religious_considerations}
                                                        onChange={(e) => setData('cultural_religious_considerations', e.target.value)}
                                                        placeholder="Any considerations"
                                                        className="min-h-[80px] placeholder:text-gray-400"
                                                        rows={3}
                                                    />
                                                    {errors.cultural_religious_considerations && (
                                                        <p className="text-sm text-red-500">{errors.cultural_religious_considerations}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right Column */}
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="history_of_hospitalization">Any History of Hospitalization (Optional)</Label>
                                                    <Textarea
                                                        id="history_of_hospitalization"
                                                        value={data.history_of_hospitalization}
                                                        onChange={(e) => setData('history_of_hospitalization', e.target.value)}
                                                        placeholder="Hospitalization history"
                                                        className="min-h-[80px] placeholder:text-gray-400"
                                                        rows={3}
                                                    />
                                                    {errors.history_of_hospitalization && (
                                                        <p className="text-sm text-red-500">{errors.history_of_hospitalization}</p>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="other_medical_conditions">Other Relevant Medical Conditions</Label>
                                                    <Textarea
                                                        id="other_medical_conditions"
                                                        value={data.other_medical_conditions}
                                                        onChange={(e) => setData('other_medical_conditions', e.target.value)}
                                                        placeholder="Other conditions"
                                                        className="min-h-[80px] placeholder:text-gray-400"
                                                        rows={3}
                                                    />
                                                    {errors.other_medical_conditions && (
                                                        <p className="text-sm text-red-500">{errors.other_medical_conditions}</p>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="accessibility_needs">Accessibility Needs</Label>
                                                    <Textarea
                                                        id="accessibility_needs"
                                                        value={data.accessibility_needs}
                                                        onChange={(e) => setData('accessibility_needs', e.target.value)}
                                                        placeholder="Any accessibility needs"
                                                        className="min-h-[80px] placeholder:text-gray-400"
                                                        rows={3}
                                                    />
                                                    {errors.accessibility_needs && (
                                                        <p className="text-sm text-red-500">{errors.accessibility_needs}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* Insurance & Legal Tab */}
                                <TabsContent value="insurance" className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label htmlFor="insurance_provider">Insurance Provider</Label>
                                                <Select
                                                    value={data.insurance_provider}
                                                    onValueChange={(value) => setData('insurance_provider', value)}
                                                >
                                                    <SelectTrigger className="placeholder:text-gray-400">
                                                        <SelectValue placeholder="Select provider" />
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
                                                {errors.insurance_provider && (
                                                    <p className="text-sm text-red-500">{errors.insurance_provider}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="policy_number">Policy Number</Label>
                                                <Input
                                                    id="policy_number"
                                                    value={data.policy_number}
                                                    onChange={(e) => setData('policy_number', e.target.value)}
                                                    placeholder="e.g., 123456789"
                                                    className="placeholder:text-gray-400"
                                                />
                                                {errors.policy_number && (
                                                    <p className="text-sm text-red-500">{errors.policy_number}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Upload Coverage Card */}
                                        <div className="space-y-2">
                                            <Label>Upload Coverage Card (Optional)</Label>

                                            {/* Existing Coverage Card Preview */}
                                            {!coverageCardFile && existingCardPreview && (
                                                <div className="mb-3 p-4 border border-gray-200 rounded-lg bg-white">
                                                    <div className="space-y-2">
                                                        <p className="text-xs text-gray-500 font-medium uppercase mb-2">Current Coverage Card</p>
                                                        <img
                                                            src={existingCardPreview}
                                                            alt="Current coverage card"
                                                            className="max-w-full h-auto rounded-lg border border-gray-200"
                                                        />
                                                        <div className="flex gap-2 mt-3">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => window.open(existingCardPreview, '_blank')}
                                                                className="text-sidebar-accent flex-1"
                                                            >
                                                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                </svg>
                                                                View Full Size
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Loading State for Existing Card */}
                                            {!coverageCardFile && loadingExistingCard && (
                                                <div className="mb-3 p-4 border border-gray-200 rounded-lg bg-white">
                                                    <div className="flex items-center justify-center py-8">
                                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sidebar-accent"></div>
                                                        <p className="ml-3 text-sm text-gray-600">Loading preview...</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Existing Card (PDF) - No Preview Available */}
                                            {!coverageCardFile && !existingCardPreview && !loadingExistingCard && data.coverage_card_path && (
                                                <div className="mb-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 bg-red-50 rounded flex items-center justify-center">
                                                            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                            </svg>
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-medium text-gray-900">Current Coverage Card (PDF)</p>
                                                            <p className="text-xs text-gray-500">Document on file</p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={async () => {
                                                            try {
                                                                const response = await fetch(`/api/storage/signed-url?key=${encodeURIComponent(data.coverage_card_path)}&expires_minutes=60`, {
                                                                    headers: {
                                                                        'Accept': 'application/json',
                                                                        'X-Requested-With': 'XMLHttpRequest',
                                                                    }
                                                                });

                                                                if (!response.ok) throw new Error('Failed to get signed URL');

                                                                const { url } = await response.json();
                                                                window.open(url, '_blank');
                                                            } catch (error) {
                                                                console.error('Error opening coverage card:', error);
                                                                toast.error('Unable to view coverage card');
                                                            }
                                                        }}
                                                        className="text-sidebar-accent w-full mt-3"
                                                    >
                                                        View Document →
                                                    </Button>
                                                </div>
                                            )}

                                            {/* New File Preview */}
                                            {(coverageCardFile || coverageCardPreview) && (
                                                <div className="mb-3 p-4 border border-green-200 rounded-lg bg-green-50">
                                                    <p className="text-xs text-green-700 font-medium uppercase mb-2">New File Selected</p>
                                                    {coverageCardPreview ? (
                                                        <div className="space-y-2">
                                                            <img
                                                                src={coverageCardPreview}
                                                                alt="Coverage card preview"
                                                                className="max-w-full h-auto rounded-lg border border-green-300"
                                                            />
                                                            <p className="text-sm text-gray-700 text-center font-medium">{coverageCardFile?.name}</p>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 bg-red-100 rounded flex items-center justify-center">
                                                                <svg className="w-6 h-6 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                                </svg>
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="text-sm font-medium text-gray-900">{coverageCardFile?.name}</p>
                                                                <p className="text-xs text-gray-600">PDF Document</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setCoverageCardFile(null);
                                                            setCoverageCardPreview(null);
                                                            setData('coverage_card', null);
                                                            // Reload existing preview if there was one
                                                            if (data.coverage_card_path) {
                                                                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(data.coverage_card_path);
                                                                if (isImage) {
                                                                    setLoadingExistingCard(true);
                                                                    fetch(`/api/storage/signed-url?key=${encodeURIComponent(data.coverage_card_path)}&expires_minutes=60`, {
                                                                        headers: {
                                                                            'Accept': 'application/json',
                                                                            'X-Requested-With': 'XMLHttpRequest',
                                                                        }
                                                                    })
                                                                    .then(response => response.json())
                                                                    .then(({ url }) => {
                                                                        setExistingCardPreview(url);
                                                                        setLoadingExistingCard(false);
                                                                    })
                                                                    .catch(() => setLoadingExistingCard(false));
                                                                }
                                                            }
                                                        }}
                                                        className="mt-3 text-xs text-red-600 hover:text-red-700 font-medium"
                                                    >
                                                        ✕ Remove new file
                                                    </button>
                                                </div>
                                            )}

                                            {/* Upload Zone */}
                                            <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                                                <div className="flex flex-col items-center">
                                                    <div className="w-12 h-12 bg-sidebar-accent/10 rounded-full flex items-center justify-center mb-4">
                                                        <svg className="w-6 h-6 text-sidebar-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                        </svg>
                                                    </div>
                                                    <p className="text-sm text-gray-600 mb-1">
                                                        <span className="text-sidebar-accent underline cursor-pointer">Browse</span> or drag and drop
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        PDF, JPG, PNG accepted (Max 5MB)
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
                                </TabsContent>
                            </Tabs>

                            {/* Action Buttons */}
                            <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-gray-200">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => router.visit(route('central.my-details'))}
                                    disabled={processing || uploadingCoverageCard}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={processing || uploadingCoverageCard}
                                    className="bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground px-8"
                                >
                                    {uploadingCoverageCard ? 'Uploading...' : processing ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
}

export default withAppLayout(HealthHistory, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'My Details', href: route('patient.my-details') },
        { title: 'Health History' }
    ]
});
