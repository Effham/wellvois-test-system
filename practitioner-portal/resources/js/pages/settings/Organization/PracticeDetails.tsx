import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

const industries = [
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'medical-practice', label: 'Medical Practice' },
    { value: 'dental', label: 'Dental' },
    { value: 'mental-health', label: 'Mental Health' },
    { value: 'physical-therapy', label: 'Physical Therapy' },
    { value: 'other', label: 'Other' },
];

interface Props {
    practiceDetailsSettings: Record<string, string>;
    tenantName: string;
}

export default function PracticeDetails({ practiceDetailsSettings, tenantName }: Props) {
    const { data, setData, post, processing, errors, reset } = useForm({
        practice_details_name: practiceDetailsSettings.practice_details_name || tenantName || '',
        practice_details_legal_name: practiceDetailsSettings.practice_details_legal_name || tenantName || '',
        practice_details_industry_type: practiceDetailsSettings.practice_details_industry_type || '',
        practice_details_contact_email: practiceDetailsSettings.practice_details_contact_email || '',
        practice_details_phone_number: practiceDetailsSettings.practice_details_phone_number || '',
        practice_details_website_url: practiceDetailsSettings.practice_details_website_url || '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('organization.practice-details.update'));
    };

    return (
        <form onSubmit={submit}>
            <div className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column */}
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="practice-name" className="font-normal">
                                Practice Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="practice-name"
                                placeholder="Enter your clinic or business name"
                                value={data.practice_details_name}
                                onChange={(e) => setData('practice_details_name', e.target.value)}
                                className={`text-muted-foreground placeholder:text-gray-400 ${errors.practice_details_name ? 'border-red-500' : ''}`}
                            />
                            {errors.practice_details_name && (
                                <p className="text-sm text-red-500">{errors.practice_details_name}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="industry" className="font-normal">
                                Industry/Practice Type <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                value={data.practice_details_industry_type}
                                onValueChange={(value) => setData('practice_details_industry_type', value)}
                            >
                                <SelectTrigger className={`text-muted-foreground ${errors.practice_details_industry_type ? 'border-red-500' : ''}`}>
                                    <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    {industries.map((industry) => (
                                        <SelectItem key={industry.value} value={industry.value}>
                                            {industry.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.practice_details_industry_type && (
                                <p className="text-sm text-red-500">{errors.practice_details_industry_type}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="primary-phone" className="font-normal">
                                Primary Phone Number <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="primary-phone"
                                type="tel"
                                placeholder="Enter your phone number"
                                value={data.practice_details_phone_number}
                                onChange={(e) => setData('practice_details_phone_number', e.target.value)}
                                className={`text-muted-foreground placeholder:text-gray-400 ${errors.practice_details_phone_number ? 'border-red-500' : ''}`}
                            />
                            {errors.practice_details_phone_number && (
                                <p className="text-sm text-red-500">{errors.practice_details_phone_number}</p>
                            )}
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="legal-name" className="font-normal">
                                Practice Legal Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="legal-name"
                                placeholder="Enter your practice legal name"
                                value={data.practice_details_legal_name}
                                onChange={(e) => setData('practice_details_legal_name', e.target.value)}
                                className={`text-muted-foreground placeholder:text-gray-400 ${errors.practice_details_legal_name ? 'border-red-500' : ''}`}
                            />
                            {errors.practice_details_legal_name && (
                                <p className="text-sm text-red-500">{errors.practice_details_legal_name}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contact-email" className="font-normal">
                                Primary Contact Email <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="contact-email"
                                type="email"
                                placeholder="Enter your contact email"
                                value={data.practice_details_contact_email}
                                onChange={(e) => setData('practice_details_contact_email', e.target.value)}
                                className={`text-muted-foreground placeholder:text-gray-400 ${errors.practice_details_contact_email ? 'border-red-500' : ''}`}
                            />
                            {errors.practice_details_contact_email && (
                                <p className="text-sm text-red-500">{errors.practice_details_contact_email}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="website-url" className="font-normal">Website URL</Label>
                            <Input
                                id="website-url"
                                type="url"
                                placeholder="Enter website URL"
                                value={data.practice_details_website_url}
                                onChange={(e) => setData('practice_details_website_url', e.target.value)}
                                className={`text-muted-foreground placeholder:text-gray-400 ${errors.practice_details_website_url ? 'border-red-500' : ''}`}
                            />
                            {errors.practice_details_website_url && (
                                <p className="text-sm text-red-500">{errors.practice_details_website_url}</p>
                            )}
                        </div>
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