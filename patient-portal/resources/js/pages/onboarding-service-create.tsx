'use client';

import { useState, useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import { ArrowRight, ArrowLeft, Briefcase, Video, MapPin, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import OnboardingLayout from '@/components/onboarding-layout';
import { useForm } from '@inertiajs/react';
import axios from 'axios';
import { getRequiredSteps, checkCompletion, shouldRedirectToDashboard } from '@/utils/onboarding-completion';

interface OnboardingServiceCreateProps {
    categories?: string[];
    appointmentType?: 'virtual' | 'hybrid' | 'in-person' | null;
    existingServices?: any[];
}

const serviceCategories = [
    'Individual',
    'Couple',
    'Group',
    'Assessment',
    'Family',
    'Specialty',
    'Follow-Up'
];

const presetPrices = ['80', '100', '120', '150', '180', '200', '220', '250'];

export default function OnboardingServiceCreate({ categories = serviceCategories, appointmentType }: OnboardingServiceCreateProps) {
    const pageProps = usePage<any>().props;
    const appointmentTypeFromProps = pageProps.appointmentType || appointmentType;
    
    const [isCustomPrice, setIsCustomPrice] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Determine delivery modes based on appointment type
    const getDefaultDeliveryModes = () => {
        if (appointmentTypeFromProps === 'virtual') {
            return ['virtual'];
        }
        if (appointmentTypeFromProps === 'hybrid') {
            return ['in-person', 'virtual'];
        }
        if (appointmentTypeFromProps === 'in-person') {
            return ['in-person'];
        }
        // Fallback: no pre-selection
        return [];
    };

    const { existingServices } = pageProps;

    const { data, setData, post, put, processing, errors } = useForm({
        name: existingServices?.[0]?.name || '',
        category: existingServices?.[0]?.category || '',
        description: existingServices?.[0]?.description || '',
        delivery_modes: existingServices?.[0]?.delivery_modes || getDefaultDeliveryModes(),
        default_price: existingServices?.[0]?.default_price || '',
        currency: existingServices?.[0]?.currency || 'CAD',
        is_active: true, // Always active, not editable
    });

    const handleDeliveryModeChange = (mode: string, checked: boolean) => {
        // Prevent unchecking virtual if appointment type is virtual only
        if (appointmentTypeFromProps === 'virtual' && mode === 'virtual' && !checked) {
            return;
        }
        
        // Prevent checking in-person if appointment type is virtual only
        if (appointmentTypeFromProps === 'virtual' && mode === 'in-person') {
            return;
        }
        
        if (checked) {
            setData('delivery_modes', [...data.delivery_modes, mode]);
        } else {
            setData('delivery_modes', data.delivery_modes.filter((m: string) => m !== mode));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate required fields
        if (!data.name || !data.category || !data.default_price || data.delivery_modes.length === 0) {
            return;
        }

        setIsSubmitting(true);

        const options = {
            onSuccess: () => {
                // Backend ServiceController handles the redirection to dashboard
                // and marking onboarding as complete.
                console.log('Service created/updated successfully, redirecting...');
            },
            onError: (errors: any) => {
                console.error('Failed to submit service:', errors);
                setIsSubmitting(false);
            },
        };

        if (existingServices && existingServices.length > 0 && existingServices[0].id) {
            // Update existing service
            put(`/services/${existingServices[0].id}`, options);
        } else {
            // Create new service
            post('/services', options);
        }
    };

    const handleBack = () => {
        if (appointmentTypeFromProps === 'virtual') {
            // Virtual practice skips location step, so back goes to questionnaire
            router.visit('/onboarding/questionnaire');
        } else {
            // Standard practice goes back to location step
            router.visit('/onboarding/location/create');
        }
    };


    return (
        <OnboardingLayout title="Add Your First Service" contentClassName="flex items-center justify-center">
            <div className="w-full max-w-2xl">
                {/* Header Section - Outside Card */}
                <div className="mb-3 text-center">
                    <div className="flex items-center justify-center gap-3 mb-1.5">
                        <Briefcase className="h-6 w-6 text-primary" />
                        <h1 className="text-2xl font-bold text-gray-900">
                            Add Your First Service
                        </h1>
                    </div>
                    <p className="text-sm text-gray-600">
                        Create a service to get started
                    </p>
                </div>

                <Card className="border-2 shadow-2xl bg-white">
                    <CardContent className="space-y-4 px-4 pb-4 pt-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Service Name and Category in one row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                        <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                                            Service Name <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="name"
                                            value={data.name}
                                            onChange={(e) => setData('name', e.target.value)}
                                            placeholder="e.g., Initial Consultation"
                                            className="h-9 text-sm"
                                            required
                                        />
                                        {errors.name && (
                                            <p className="text-xs text-red-500">{errors.name}</p>
                                        )}
                                </div>

                                <div className="space-y-2">
                                        <Label htmlFor="category" className="text-sm font-medium text-gray-700">
                                            Category <span className="text-red-500">*</span>
                                        </Label>
                                        <Select
                                            value={data.category}
                                            onValueChange={(value) => setData('category', value)}
                                            required
                                        >
                                            <SelectTrigger className="h-9 text-sm">
                                                <SelectValue placeholder="Select a category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categories.map((cat) => (
                                                    <SelectItem key={cat} value={cat}>
                                                        {cat}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors.category && (
                                            <p className="text-xs text-red-500">{errors.category}</p>
                                        )}
                                </div>
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                    <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                                        Description
                                    </Label>
                                    <Textarea
                                        id="description"
                                        value={data.description}
                                        onChange={(e) => setData('description', e.target.value)}
                                        placeholder="Describe your service..."
                                        className="text-sm min-h-[80px]"
                                        rows={3}
                                    />
                                    {errors.description && (
                                        <p className="text-xs text-red-500">{errors.description}</p>
                                    )}
                            </div>

                            {/* Delivery Modes */}
                            <div className="space-y-3">
                                    <Label className="text-sm font-medium text-gray-700">
                                        Delivery Mode <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleDeliveryModeChange('virtual', !data.delivery_modes.includes('virtual'));
                                            }}
                                            disabled={appointmentTypeFromProps === 'virtual' && data.delivery_modes.includes('virtual')}
                                            className={`p-4 rounded-lg border-2 transition-all text-left ${
                                                data.delivery_modes.includes('virtual')
                                                    ? 'border-primary bg-primary/5 shadow-md'
                                                    : 'border-gray-200 hover:border-primary/50 hover:shadow-sm'
                                            } ${appointmentTypeFromProps === 'virtual' && data.delivery_modes.includes('virtual') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2 rounded-lg ${
                                                    data.delivery_modes.includes('virtual') ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                    <Video className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-gray-900 mb-1">Virtual</h4>
                                                    <p className="text-xs text-gray-600">
                                                        {appointmentTypeFromProps === 'virtual' 
                                                            ? 'Required for virtual-only practice'
                                                            : 'Conduct appointments online'}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleDeliveryModeChange('in-person', !data.delivery_modes.includes('in-person'));
                                            }}
                                            disabled={appointmentTypeFromProps === 'virtual'}
                                            className={`p-4 rounded-lg border-2 transition-all text-left ${
                                                data.delivery_modes.includes('in-person')
                                                    ? 'border-primary bg-primary/5 shadow-md'
                                                    : 'border-gray-200 hover:border-primary/50 hover:shadow-sm'
                                            } ${appointmentTypeFromProps === 'virtual' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2 rounded-lg ${
                                                    data.delivery_modes.includes('in-person') ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                    <MapPin className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-gray-900 mb-1">In-Person</h4>
                                                    <p className="text-xs text-gray-600">
                                                        {appointmentTypeFromProps === 'virtual' 
                                                            ? 'Not available for virtual-only practice'
                                                            : 'Conduct appointments at your location'}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                    {errors.delivery_modes && (
                                        <p className="text-xs text-red-500">{errors.delivery_modes}</p>
                                    )}
                            </div>

                            {/* Price */}
                            <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">
                                        Price (CAD) <span className="text-red-500">*</span>
                                    </Label>
                                    {!isCustomPrice ? (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-4 gap-2">
                                                {presetPrices.map((price) => (
                                                    <button
                                                        key={price}
                                                        type="button"
                                                        onClick={() => {
                                                            setData('default_price', price);
                                                            setIsCustomPrice(false);
                                                        }}
                                                        className={`px-4 py-2.5 rounded-md border transition-all text-sm font-medium ${
                                                            data.default_price === price
                                                                ? 'border-primary bg-primary text-white shadow-sm'
                                                                : 'border-gray-200 hover:border-primary/50 hover:bg-primary/5 bg-white text-gray-700'
                                                        }`}
                                                    >
                                                        ${price}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setIsCustomPrice(true)}
                                                className="w-full px-4 py-2.5 rounded-md border-2 border-dashed border-gray-300 hover:border-primary/50 hover:bg-primary/5 bg-gray-50/50 text-gray-700 text-sm font-medium transition-all flex items-center justify-center gap-2"
                                            >
                                                <DollarSign className="w-4 h-4" />
                                                Enter Custom Amount
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <Input
                                                    type="number"
                                                    value={data.default_price}
                                                    onChange={(e) => {
                                                        setData('default_price', e.target.value);
                                                        setIsCustomPrice(true);
                                                    }}
                                                    placeholder="Enter custom price"
                                                    className="h-9 text-sm pl-10"
                                                    min="0"
                                                    step="0.01"
                                                    required
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setIsCustomPrice(false)}
                                                className="h-9 px-3 text-sm"
                                            >
                                                Use Preset
                                            </Button>
                                        </div>
                                    )}
                                    {errors.default_price && (
                                        <p className="text-xs text-red-500">{errors.default_price}</p>
                                    )}
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleBack}
                                        className="flex-1 h-9 text-sm"
                                    >
                                        <ArrowLeft className="h-3.5 w-3.5 mr-2" />
                                        Back
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={isSubmitting || processing || !data.name || !data.category || !data.default_price || data.delivery_modes.length === 0}
                                        className="flex-1 h-9 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold"
                                    >
                                        {isSubmitting || processing ? 'Creating...' : 'Create Service'}
                                        <ArrowRight className="ml-2 h-3.5 w-3.5" />
                                    </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </OnboardingLayout>
    );
}

