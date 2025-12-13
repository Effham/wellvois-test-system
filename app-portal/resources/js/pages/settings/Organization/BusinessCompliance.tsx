import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';

const provinces = [
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

interface Props {
    businessComplianceSettings: Record<string, string>;
}

export default function BusinessCompliance({ businessComplianceSettings }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        business_compliance_registration_number: businessComplianceSettings.business_compliance_registration_number || '',
        business_compliance_tax_number: businessComplianceSettings.business_compliance_tax_number || '',
        business_compliance_regulatory_body: businessComplianceSettings.business_compliance_regulatory_body || '',
        business_compliance_license_expiry_notification: businessComplianceSettings.business_compliance_license_expiry_notification || '',
        business_compliance_address_lookup: businessComplianceSettings.business_compliance_address_lookup || '',
        business_compliance_street_address: businessComplianceSettings.business_compliance_street_address || '',
        business_compliance_apt_suite_unit: businessComplianceSettings.business_compliance_apt_suite_unit || '',
        business_compliance_city: businessComplianceSettings.business_compliance_city || '',
        business_compliance_postal_code: businessComplianceSettings.business_compliance_postal_code || '',
        business_compliance_province: businessComplianceSettings.business_compliance_province || '',
    });

    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    // Client-side validation
    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!data.business_compliance_registration_number.trim()) {
            newErrors.business_compliance_registration_number = 'Business registration number is required.';
        }

        if (!data.business_compliance_tax_number.trim()) {
            newErrors.business_compliance_tax_number = 'Tax ID / HST / GST number is required.';
        }

        if (!data.business_compliance_regulatory_body.trim()) {
            newErrors.business_compliance_regulatory_body = 'Regulatory body is required.';
        }

        if (!data.business_compliance_license_expiry_notification.trim()) {
            newErrors.business_compliance_license_expiry_notification = 'License expiry notification date is required.';
        }

        if (!data.business_compliance_address_lookup.trim()) {
            newErrors.business_compliance_address_lookup = 'Address lookup is required.';
        }

        if (!data.business_compliance_street_address.trim()) {
            newErrors.business_compliance_street_address = 'Street address is required.';
        }

        if (!data.business_compliance_city.trim()) {
            newErrors.business_compliance_city = 'City is required.';
        }

        if (!data.business_compliance_postal_code.trim()) {
            newErrors.business_compliance_postal_code = 'Postal code is required.';
        }

        if (!data.business_compliance_province.trim()) {
            newErrors.business_compliance_province = 'Province is required.';
        }

        setValidationErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        
        // Clear previous validation errors
        setValidationErrors({});
        
        // Validate form before submitting
        if (!validateForm()) {
            return;
        }

        post(route('organization.business-compliance.update'));
    };

    return (
        <form onSubmit={submit}>
            <div className="px-6 py-4 space-y-6">
                {/* First Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="registration-number" className="font-normal">
                            Business Registration Number <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="registration-number"
                            placeholder="Optional; for Canadian or U.S. practices"
                            value={data.business_compliance_registration_number}
                            onChange={(e) => {
                                setData('business_compliance_registration_number', e.target.value);
                                // Clear validation error when user starts typing
                                if (validationErrors.business_compliance_registration_number) {
                                    setValidationErrors(prev => ({
                                        ...prev,
                                        business_compliance_registration_number: ''
                                    }));
                                }
                            }}
                            className={`text-muted-foreground placeholder:text-gray-400 ${(errors.business_compliance_registration_number || validationErrors.business_compliance_registration_number) ? 'border-red-500' : ''}`}
                            required
                        />
                        {(errors.business_compliance_registration_number || validationErrors.business_compliance_registration_number) && (
                            <p className="text-sm text-red-500">
                                {errors.business_compliance_registration_number || validationErrors.business_compliance_registration_number}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="tax-number" className="font-normal">
                            Tax ID / HST / GST Number <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="tax-number"
                            placeholder="For invoices and billing modules"
                            value={data.business_compliance_tax_number}
                            onChange={(e) => {
                                setData('business_compliance_tax_number', e.target.value);
                                // Clear validation error when user starts typing
                                if (validationErrors.business_compliance_tax_number) {
                                    setValidationErrors(prev => ({
                                        ...prev,
                                        business_compliance_tax_number: ''
                                    }));
                                }
                            }}
                            className={`text-muted-foreground placeholder:text-gray-400 ${(errors.business_compliance_tax_number || validationErrors.business_compliance_tax_number) ? 'border-red-500' : ''}`}
                            required
                        />
                        {(errors.business_compliance_tax_number || validationErrors.business_compliance_tax_number) && (
                            <p className="text-sm text-red-500">
                                {errors.business_compliance_tax_number || validationErrors.business_compliance_tax_number}
                            </p>
                        )}
                    </div>
                </div>

                {/* Second Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="regulatory-body" className="font-normal">
                            Regulatory Body <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="regulatory-body"
                            placeholder='e.g. "CRPO," "College of Psychologists of Ontario"'
                            value={data.business_compliance_regulatory_body}
                            onChange={(e) => {
                                setData('business_compliance_regulatory_body', e.target.value);
                                // Clear validation error when user starts typing
                                if (validationErrors.business_compliance_regulatory_body) {
                                    setValidationErrors(prev => ({
                                        ...prev,
                                        business_compliance_regulatory_body: ''
                                    }));
                                }
                            }}
                            className={`text-muted-foreground placeholder:text-gray-400 ${(errors.business_compliance_regulatory_body || validationErrors.business_compliance_regulatory_body) ? 'border-red-500' : ''}`}
                            required
                        />
                        {(errors.business_compliance_regulatory_body || validationErrors.business_compliance_regulatory_body) && (
                            <p className="text-sm text-red-500">
                                {errors.business_compliance_regulatory_body || validationErrors.business_compliance_regulatory_body}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="license-expiry" className="font-normal">
                            License Expiry Notification <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                            <Input
                                id="license-expiry"
                                type="date"
                                placeholder="Enter your clinic or business name"
                                value={data.business_compliance_license_expiry_notification}
                                onChange={(e) => {
                                    setData('business_compliance_license_expiry_notification', e.target.value);
                                    // Clear validation error when user starts typing
                                    if (validationErrors.business_compliance_license_expiry_notification) {
                                        setValidationErrors(prev => ({
                                            ...prev,
                                            business_compliance_license_expiry_notification: ''
                                        }));
                                    }
                                }}
                                className={`text-muted-foreground placeholder:text-gray-400 ${(errors.business_compliance_license_expiry_notification || validationErrors.business_compliance_license_expiry_notification) ? 'border-red-500' : ''}`}
                                required
                            />
                        </div>
                        {(errors.business_compliance_license_expiry_notification || validationErrors.business_compliance_license_expiry_notification) && (
                            <p className="text-sm text-red-500">
                                {errors.business_compliance_license_expiry_notification || validationErrors.business_compliance_license_expiry_notification}
                            </p>
                        )}
                    </div>
                </div>

                {/* Address Lookup */}
                <div className="space-y-2">
                    <Label htmlFor="address-lookup" className="font-normal">
                        Address Lookup <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="address-lookup"
                        placeholder="Enter address lookup"
                        value={data.business_compliance_address_lookup}
                        onChange={(e) => {
                            setData('business_compliance_address_lookup', e.target.value);
                            // Clear validation error when user starts typing
                            if (validationErrors.business_compliance_address_lookup) {
                                setValidationErrors(prev => ({
                                    ...prev,
                                    business_compliance_address_lookup: ''
                                }));
                            }
                        }}
                        className={`text-muted-foreground placeholder:text-gray-400 ${(errors.business_compliance_address_lookup || validationErrors.business_compliance_address_lookup) ? 'border-red-500' : ''}`}
                        required
                    />
                    {(errors.business_compliance_address_lookup || validationErrors.business_compliance_address_lookup) && (
                        <p className="text-sm text-red-500">
                            {errors.business_compliance_address_lookup || validationErrors.business_compliance_address_lookup}
                        </p>
                    )}
                </div>

                {/* Street Address */}
                <div className="space-y-2">
                    <Label htmlFor="street-address" className="font-normal">
                        Street Address <span className="text-red-500">*</span>
                    </Label>
                                            <Input
                            id="street-address"
                            placeholder="Enter street address"
                            value={data.business_compliance_street_address}
                            onChange={(e) => {
                                setData('business_compliance_street_address', e.target.value);
                                // Clear validation error when user starts typing
                                if (validationErrors.business_compliance_street_address) {
                                    setValidationErrors(prev => ({
                                        ...prev,
                                        business_compliance_street_address: ''
                                    }));
                                }
                            }}
                            className={`text-muted-foreground placeholder:text-gray-400 ${(errors.business_compliance_street_address || validationErrors.business_compliance_street_address) ? 'border-red-500' : ''}`}
                            required
                        />
                        {(errors.business_compliance_street_address || validationErrors.business_compliance_street_address) && (
                            <p className="text-sm text-red-500">
                                {errors.business_compliance_street_address || validationErrors.business_compliance_street_address}
                            </p>
                        )}
                </div>

                {/* Bottom Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="apt-unit" className="font-normal">
                            Apt/Suite/Unit No. 
                        </Label>
                        <Input
                            id="apt-unit"
                            placeholder="Enter no."
                            value={data.business_compliance_apt_suite_unit}
                            onChange={(e) => setData('business_compliance_apt_suite_unit', e.target.value)}
                            className={`text-muted-foreground placeholder:text-gray-400 ${errors.business_compliance_apt_suite_unit ? 'border-red-500' : ''}`}
                        />
                        {errors.business_compliance_apt_suite_unit && (
                            <p className="text-sm text-red-500">{errors.business_compliance_apt_suite_unit}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="city" className="font-normal">
                            City <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={data.business_compliance_city}
                            onValueChange={(value) => {
                                setData('business_compliance_city', value);
                                // Clear validation error when user selects a value
                                if (validationErrors.business_compliance_city) {
                                    setValidationErrors(prev => ({
                                        ...prev,
                                        business_compliance_city: ''
                                    }));
                                }
                            }}
                        >
                            <SelectTrigger className={`text-muted-foreground ${(errors.business_compliance_city || validationErrors.business_compliance_city) ? 'border-red-500' : ''}`}>
                                <SelectValue placeholder="Select city" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="toronto">Toronto</SelectItem>
                                <SelectItem value="vancouver">Vancouver</SelectItem>
                                <SelectItem value="montreal">Montreal</SelectItem>
                                <SelectItem value="calgary">Calgary</SelectItem>
                                <SelectItem value="ottawa">Ottawa</SelectItem>
                            </SelectContent>
                        </Select>
                        {(errors.business_compliance_city || validationErrors.business_compliance_city) && (
                            <p className="text-sm text-red-500">
                                {errors.business_compliance_city || validationErrors.business_compliance_city}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="postal-code" className="font-normal">
                            Postal/ZIP Code <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="postal-code"
                            placeholder="Postal Code"
                            value={data.business_compliance_postal_code}
                            onChange={(e) => {
                                setData('business_compliance_postal_code', e.target.value);
                                // Clear validation error when user starts typing
                                if (validationErrors.business_compliance_postal_code) {
                                    setValidationErrors(prev => ({
                                        ...prev,
                                        business_compliance_postal_code: ''
                                    }));
                                }
                            }}
                            className={`text-muted-foreground placeholder:text-gray-400 ${(errors.business_compliance_postal_code || validationErrors.business_compliance_postal_code) ? 'border-red-500' : ''}`}
                            required
                        />
                        {(errors.business_compliance_postal_code || validationErrors.business_compliance_postal_code) && (
                            <p className="text-sm text-red-500">
                                {errors.business_compliance_postal_code || validationErrors.business_compliance_postal_code}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="province" className="font-normal">
                            Province <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={data.business_compliance_province}
                            onValueChange={(value) => {
                                setData('business_compliance_province', value);
                                // Clear validation error when user selects a value
                                if (validationErrors.business_compliance_province) {
                                    setValidationErrors(prev => ({
                                        ...prev,
                                        business_compliance_province: ''
                                    }));
                                }
                            }}
                        >
                            <SelectTrigger className={`text-muted-foreground ${(errors.business_compliance_province || validationErrors.business_compliance_province) ? 'border-red-500' : ''}`}>
                                <SelectValue placeholder="Select province" />
                            </SelectTrigger>
                            <SelectContent>
                                {provinces.map((province) => (
                                    <SelectItem key={province.value} value={province.value}>
                                        {province.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {(errors.business_compliance_province || validationErrors.business_compliance_province) && (
                            <p className="text-sm text-red-500">
                                {errors.business_compliance_province || validationErrors.business_compliance_province}
                            </p>
                        )}
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end mt-8">
                    <Button type="submit" disabled={processing} size="save">
                        {processing ? 'Saving...' : 'Save'}
                    </Button>
                </div>
            </div>
        </form>
    );
}