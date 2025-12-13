import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { router, useForm, usePage } from '@inertiajs/react';
import { AlertCircle, ArrowLeft, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { useFieldValidation } from '@/hooks/useFieldValidation';
import { capitalizeWords, ValidationResult } from '@/utils/validation';

interface CreateProps {
    service?: any;
    categories?: any;
    deliveryModes?: any;
    onCancel?: () => void;
}

export default function Create({ service, categories, deliveryModes, onCancel }: CreateProps) {
    const { flash }: any = usePage().props;
    const { fieldErrors, createBlurHandler, clearFieldError, setFieldError, clearAllErrors } = useFieldValidation();
    
    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    
    // Preset price options
    const presetPrices = ['80', '100', '120', '150', '180', '200', '220', '250'];
    
    // Determine if existing price is custom or preset
    const existingPrice = service?.default_price?.toString() || '';
    const isExistingPriceCustom = existingPrice && !presetPrices.includes(existingPrice);
    
    const [isCustomPrice, setIsCustomPrice] = useState(isExistingPriceCustom);
    const [showErrorModal, setShowErrorModal] = useState(!!flash?.error);

    // Check if we're in onboarding flow
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const isOnboarding = urlParams.get('onboarding') === 'true';

    // Show flash messages as toasts (only if not in onboarding to avoid duplicates)
    useEffect(() => {
        if (!isOnboarding) {
            if (flash?.success) {
                toast.success(flash.success);
            }
            if (flash?.error) {
                toast.error(flash.error);
            }
        }
    }, [flash, isOnboarding]);

    const { data, setData, post, put, processing, errors , reset } = useForm({
        name: service?.name || '',
        category: service?.category || '',
        description: service?.description || '',
        delivery_modes: service?.delivery_modes || [],
        default_price: service?.default_price || '',
        currency: service?.currency || 'CAD',
        is_active: service?.is_active ?? true,
    });

    // Validation functions
    const validateServiceName = (value: string): ValidationResult => {
        if (!value || value.trim() === '') {
            return { isValid: false, error: 'Service name is required' };
        }
        return { isValid: true };
    };

    const validateCategory = (value: string): ValidationResult => {
        if (!value || value.trim() === '') {
            return { isValid: false, error: 'Service category is required' };
        }
        return { isValid: true };
    };

    const validatePrice = (value: string): ValidationResult => {
        if (!value || value.toString().trim() === '') {
            return { isValid: false, error: 'Default price is required' };
        }
        const price = parseFloat(value.toString());
        if (isNaN(price) || price <= 0) {
            return { isValid: false, error: 'Please enter a valid price greater than 0' };
        }
        return { isValid: true };
    };

    const validateDeliveryModes = (modes: string[]): ValidationResult => {
        if (!modes || modes.length === 0) {
            return { isValid: false, error: 'At least one delivery mode is required' };
        }
        return { isValid: true };
    };

    const validateAllFields = () => {
        const validationErrors: Record<string, string> = {};

        console.log('🔍 [Create] Validating all fields, current data:', {
            name: data.name,
            category: data.category,
            delivery_modes: data.delivery_modes,
            default_price: data.default_price
        });

        // Validate service name
        const nameValidation = validateServiceName(data.name);
        if (!nameValidation.isValid && nameValidation.error) {
            validationErrors.name = nameValidation.error;
        }

        // Validate category
        const categoryValidation = validateCategory(data.category);
        if (!categoryValidation.isValid && categoryValidation.error) {
            validationErrors.category = categoryValidation.error;
        }

        // Validate delivery modes
        const deliveryModesValidation = validateDeliveryModes(data.delivery_modes);
        if (!deliveryModesValidation.isValid && deliveryModesValidation.error) {
            validationErrors.delivery_modes = deliveryModesValidation.error;
        }

        // Validate price
        const priceValidation = validatePrice(data.default_price);
        if (!priceValidation.isValid && priceValidation.error) {
            validationErrors.default_price = priceValidation.error;
        }

        return validationErrors;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        console.log('========================================');
        console.log('🔷 [ServiceCreate] Form submission started');
        console.log('🔷 [ServiceCreate] Form data:', data);
        console.log('🔷 [ServiceCreate] Service:', service);
        console.log('🔷 [ServiceCreate] Processing:', processing);
        console.log('========================================');

        clearAllErrors();

        const validationErrors = validateAllFields();

        if (Object.keys(validationErrors).length > 0) {
            Object.keys(validationErrors).forEach((field) => {
                setFieldError(field, validationErrors[field]);
            });
            console.error('❌ [ServiceCreate] Validation errors:', validationErrors);
            return;
        }

        console.log('✅ [ServiceCreate] Client-side validation passed');

        if (service) {
            const updateRoute = route('services.update', service.id);
            console.log('🔷 [ServiceCreate] Updating service');
            console.log('🔷 [ServiceCreate] Update route:', updateRoute);

            put(updateRoute, {
                onBefore: () => console.log('⏳ [ServiceCreate] Update starting...'),
                onStart: () => console.log('🚀 [ServiceCreate] Update sent'),
                onSuccess: (page) => {
                    console.log('✅ [ServiceCreate] Update successful:', page);
                    toast.success('Service updated successfully!');
                },
                onError: (errors) => {
                    console.error('❌ [ServiceCreate] Update failed:', errors);
                },
                onFinish: () => console.log('🏁 [ServiceCreate] Update finished')
            });
        } else {
            const storeRoute = route('services.store');
            console.log('🔷 [ServiceCreate] Creating new service');
            console.log('🔷 [ServiceCreate] Store route:', storeRoute);

            // Add onboarding parameter to the route if needed
            const finalRoute = isOnboarding ? `${storeRoute}?onboarding=true` : storeRoute;

            post(finalRoute, {
                onBefore: () => console.log('⏳ [ServiceCreate] Create starting...'),
                onStart: () => console.log('🚀 [ServiceCreate] Create sent'),
                onSuccess: (page) => {
                    console.log('✅ [ServiceCreate] Create successful:', page);
                    console.log('✅ [ServiceCreate] Flash messages:', page.props.flash);
                    
                    // Only show toast if not in onboarding (redirect will handle it)
                    if (!isOnboarding) {
                        toast.success('Service created successfully!');
                        reset();
                    }
                    // If onboarding, the redirect will happen automatically
                },
                onError: (errors) => {
                    console.error('❌ [ServiceCreate] Create failed:', errors);
                },
                onFinish: () => console.log('🏁 [ServiceCreate] Create finished')
            });
        }
    };

    const handleDeliveryModeChange = (mode: string, checked: boolean) => {
        if (checked) {
            setData('delivery_modes', [...data.delivery_modes, mode]);
        } else {
            setData('delivery_modes', data.delivery_modes.filter((m: string) => m !== mode));
        }
        clearFieldError('delivery_modes');
    };

    return (
        <>
            <Card className='border-none shadow-none'>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCancel ? onCancel() : router.get(route('settings.index', { section: 'services' }))}
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        {service ? 'Edit Service' : 'Add New Service'}
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent>




                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <Label htmlFor="name">Service Name <span className="text-red-500">*</span></Label>
                            <Input
                                id="name"
                                value={data.name}
                                onChange={(e) => {
                                    setData('name', e.target.value);
                                    clearFieldError('name');
                                }}
                                onBlur={(e) => {
                                    const handler = createBlurHandler('name', validateServiceName, capitalizeWords);
                                    handler(e.target.value, setData);
                                }}
                                placeholder="Enter your Service Name"
                                className={fieldErrors.name || errors.name ? 'border-red-500' : ''}
                            />
                            {(fieldErrors.name || errors.name) && (
                                <p className="text-sm text-red-500 mt-1">{fieldErrors.name || errors.name}</p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="category">Service Category <span className="text-red-500">*</span></Label>
                            <Select 
                                value={data.category} 
                                onValueChange={(value) => {
                                    setData('category', value);
                                    clearFieldError('category');
                                }}
                            >
                                <SelectTrigger className={fieldErrors.category || errors.category ? 'border-red-500' : ''}>
                                    <SelectValue placeholder="Therapy, Assessment, Coaching, etc" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(categories || {}).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>{label as string}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {(fieldErrors.category || errors.category) && (
                                <p className="text-sm text-red-500 mt-1">{fieldErrors.category || errors.category}</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            placeholder="Write here..."
                            rows={4}
                            className={errors.description ? 'border-red-500' : ''}
                        />
                        {errors.description && <p className="text-sm text-red-500 mt-1">{errors.description}</p>}
                    </div>

                    <div>
                        <Label>Delivery Mode <span className="text-red-500">*</span></Label>
                        <div className={`flex flex-wrap gap-4 mt-2 p-3 border rounded-lg ${fieldErrors.delivery_modes || errors.delivery_modes ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                            {Object.entries(deliveryModes || {}).map(([key, label]) => (
                                <div key={key} className="flex items-center space-x-2">
                                    <Checkbox
                                        checked={data.delivery_modes.includes(key)}
                                        onCheckedChange={(checked) => handleDeliveryModeChange(key, !!checked)}
                                    />
                                    <Label className="text-sm">{label as string}</Label>
                                </div>
                            ))}
                        </div>
                        {(fieldErrors.delivery_modes || errors.delivery_modes) && (
                            <p className="text-sm text-red-500 mt-1">
                                {fieldErrors.delivery_modes || errors.delivery_modes}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <Label htmlFor="price">Default Price (CAD) <span className="text-red-500">*</span></Label>
                            <Select 
                                value={isCustomPrice ? 'custom' : data.default_price.toString()} 
                                onValueChange={(value) => {
                                    if (value === 'custom') {
                                        setIsCustomPrice(true);
                                        if (!isCustomPrice) {
                                            setData('default_price', ''); // Only clear if switching from preset to custom
                                        }
                                    } else {
                                        setIsCustomPrice(false);
                                        setData('default_price', value);
                                    }
                                    clearFieldError('default_price');
                                }}
                            >
                                <SelectTrigger className={fieldErrors.default_price || errors.default_price ? 'border-red-500' : ''}>
                                    <SelectValue placeholder="Default Price (CAD)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="80">$80</SelectItem>
                                    <SelectItem value="100">$100</SelectItem>
                                    <SelectItem value="120">$120</SelectItem>
                                    <SelectItem value="150">$150</SelectItem>
                                    <SelectItem value="180">$180</SelectItem>
                                    <SelectItem value="200">$200</SelectItem>
                                    <SelectItem value="220">$220</SelectItem>
                                    <SelectItem value="250">$250</SelectItem>
                                    <SelectItem value="custom">Custom Amount</SelectItem>
                                </SelectContent>
                            </Select>
                            
                            {/* Custom price input - only show when custom is selected */}
                            {isCustomPrice && (
                                <div className="mt-2">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={data.default_price}
                                        onChange={(e) => {
                                            setData('default_price', e.target.value);
                                            clearFieldError('default_price');
                                        }}
                                        onBlur={(e) => {
                                            const handler = createBlurHandler('default_price', validatePrice);
                                            handler(e.target.value, setData);
                                        }}
                                        placeholder="Enter custom price"
                                        className={fieldErrors.default_price || errors.default_price ? 'border-red-500' : ''}
                                    />
                                </div>
                            )}
                            {(fieldErrors.default_price || errors.default_price) && (
                                <p className="text-sm text-red-500 mt-1">{fieldErrors.default_price || errors.default_price}</p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="is_active">Service Status</Label>
                            <div className="flex items-center space-x-2 mt-2">
                                <Switch
                                    checked={data.is_active}
                                    onCheckedChange={(checked) => setData('is_active', checked)}
                                />
                                <Label htmlFor="is_active" className="text-sm">
                                    {data.is_active ? 'Active' : 'Inactive'}
                                </Label>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {data.is_active ? 'Service is available for booking' : 'Service is hidden from booking'}
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-4 pt-6">
                        {/* <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onCancel ? onCancel() : router.get(route('settings.index', { section: 'services' }))}
                        >
                            AutoSave
                        </Button> */}
                        <Button
                            type="submit"
                            disabled={processing}
                            size="save"
                        >
                            {processing ? 'Saving...' : service ? 'Update Service' : 'Save'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>

        {/* Error Modal */}
        <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-700">
                        <AlertCircle className="h-5 w-5" />
                        Error
                    </DialogTitle>
                    <DialogDescription className="text-red-600">
                        {flash?.error}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button onClick={() => setShowErrorModal(false)}>
                        OK
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Toaster position="top-right" />
        </>
    );
} 