import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { withAppLayout } from '@/utils/layout';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { AlertCircle, Calendar as CalendarIcon, CheckCircle, Info, Search } from 'lucide-react';
import { useZodValidation } from '@/hooks/useZodValidation';
import { patientSchema } from '@/lib/validations';

function Create({ patient }: any) {
    const { flash }: any = usePage().props;

    const urlParams = new URLSearchParams(window.location.search);
    const prefilledHealthNumber = urlParams.get('health_number') || '';

    const [healthNumberStatus, setHealthNumberStatus] = useState<string | null>(null);
    const [healthNumberMessage, setHealthNumberMessage] = useState<string>('');
    const [patientId, setPatientId] = useState<number | null>(null);
    const [checkingHealthNumber, setCheckingHealthNumber] = useState(false);
    const [showDisclaimerDialog, setShowDisclaimerDialog] = useState(false);
    const [pendingSubmit, setPendingSubmit] = useState(false);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const { validate } = useZodValidation(patientSchema);

    // Check if patient already exists in tenant (disable all fields)
    const patientExistsInTenant = healthNumberStatus === 'exists_in_tenant';

    const { data, setData, post, put, processing, errors } = useForm({
        health_number: patient?.health_number || prefilledHealthNumber || '',
        first_name: patient?.first_name || '',
        last_name: patient?.last_name || '',
        gender: patient?.gender || '',
        phone_number: patient?.phone_number || '',
        email: patient?.email || '',
        address: patient?.address || '',
        date_of_birth: patient?.date_of_birth || '',
        is_active: patient ? patient.is_active === 1 || patient.is_active === true : true,
        notes: patient?.notes || '',
    });

    const checkHealthNumber = async () => {
        if (!data.health_number.trim()) {
            setHealthNumberStatus(null);
            setHealthNumberMessage('');
            return;
        }

        setCheckingHealthNumber(true);

        try {
            const response = await fetch(route('patients.check-health-number'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'X-Requested-With': 'XMLHttpRequest',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    health_number: data.health_number,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            setHealthNumberStatus(result.status);
            setHealthNumberMessage(result.message);
            setPatientId(result.patient_id);
        } catch (error) {
            console.error('Error checking health number:', error);
            setHealthNumberStatus('error');
            setHealthNumberMessage('Error checking health number. Please try again.');
        } finally {
            setCheckingHealthNumber(false);
        }
    };

    // Auto-trigger health number check if health number is provided in URL
    useEffect(() => {
        if (prefilledHealthNumber && prefilledHealthNumber.trim() && !patient) {
            checkHealthNumber();
        }
    }, [prefilledHealthNumber]);


    const handleSubmitClick = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Prevent form submission if patient already exists in tenant
        if (patientExistsInTenant) {
            return;
        }

        // Validate form data
        const result = validate(data);
        if (!result.success) {
            setValidationErrors(result.errors);
            return;
        }

        setValidationErrors({});
        // Show disclaimer dialog before proceeding
        setShowDisclaimerDialog(true);
        setPendingSubmit(true);
    };

    const handleDisclaimerAccept = () => {
        setShowDisclaimerDialog(false);
        
        // Proceed with the actual submission
        if (patient) {
            put(route('patients.update', patient.id));
        } else {
            post(route('patients.store'));
        }
        setPendingSubmit(false);
    };

    const handleDisclaimerCancel = () => {
        setShowDisclaimerDialog(false);
        setPendingSubmit(false);
    };

    const handleGoToPatientList = () => {
        router.visit(route('patients.index'));
    };

    return (
        <>
            <Head title={patient ? 'Edit Patient' : 'Create Patient'} />

            <Card className="shadow-none border-none m-6">
                <CardContent className="p-6">
                    {/* Success Message */}
                    {flash?.success && (
                        <Alert className="mb-6 border-green-400 bg-green-50">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <AlertTitle className="text-green-700">Success</AlertTitle>
                            <AlertDescription className="text-green-600">{flash.success}</AlertDescription>
                        </Alert>
                    )}

                    {/* Error Message */}
                    {flash?.error && (
                        <Alert className="mb-6 border-red-400 bg-red-50">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertTitle className="text-red-700">Error</AlertTitle>
                            <AlertDescription className="text-red-600">{flash.error}</AlertDescription>
                        </Alert>
                    )}

                    {/* General validation errors */}
                    {/* {Object.keys(errors).length > 0 && (
                        <Alert className="mb-6 border-red-400 bg-red-50">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertTitle className="text-red-700">Please fix the following errors:</AlertTitle>
                            <AlertDescription className="text-red-600">
                                <ul className="mt-2 list-inside list-disc space-y-1">
                                    {Object.entries(errors).map(([field, message]) => (
                                        <li key={field}>
                                            <span className="font-medium capitalize">{field.replace('_', ' ')}</span>: {message}
                                        </li>
                                    ))}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )} */}

                    <form onSubmit={handleSubmitClick}>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-6">
                            <div className="">
                                <Label htmlFor="health_number">Health Number *</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="health_number"
                                        type="text"
                                        value={data.health_number}
                                        onChange={(e) => {
                                            setData('health_number', e.target.value);
                                            setHealthNumberStatus(null);
                                            setHealthNumberMessage('');
                                        }}
                                        className={errors.health_number ? 'border-red-500' : ''}
                                        placeholder="Enter health number"
                                        disabled={patientExistsInTenant}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={checkHealthNumber}
                                        disabled={!data.health_number.trim() || checkingHealthNumber || patientExistsInTenant}
                                        className="shrink-0"
                                    >
                                        {checkingHealthNumber ? (
                                            <>Checking...</>
                                        ) : (
                                            <>
                                                <Search className="mr-1 h-4 w-4" />
                                                Check
                                            </>
                                        )}
                                    </Button>
                                </div>
                                {(validationErrors.health_number || errors.health_number) && <p className="mt-1 text-sm text-red-500">{validationErrors.health_number || errors.health_number}</p>}

                                {/* Health Number Status */}
                                {healthNumberStatus && (
                                    <div className="mt-2">
                                        {healthNumberStatus === 'exists_in_tenant' && (
                                            <Alert className="border-green-400 bg-green-50">
                                                <CheckCircle className="h-4 w-4 text-green-600" />
                                                <AlertDescription className="text-green-600">
                                                    {healthNumberMessage} All fields below are disabled as this patient already exists in your system.
                                                </AlertDescription>
                                            </Alert>
                                        )}


                                        {healthNumberStatus === 'not_found' && (
                                            <Alert className="border-blue-400 bg-blue-50">
                                                <CheckCircle className="h-4 w-4 text-blue-600" />
                                                <AlertDescription className="text-blue-600">
                                                    {healthNumberMessage} You can proceed with creating a new patient.
                                                </AlertDescription>
                                            </Alert>
                                        )}

                                        {healthNumberStatus === 'error' && (
                                            <Alert className="border-red-400 bg-red-50">
                                                <AlertCircle className="h-4 w-4 text-red-600" />
                                                <AlertDescription className="text-red-600">{healthNumberMessage}</AlertDescription>
                                            </Alert>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="">
                                <Label htmlFor="first_name">First Name *</Label>
                                <Input
                                    id="first_name"
                                    type="text"
                                    value={data.first_name}
                                    onChange={(e) => setData('first_name', e.target.value)}
                                    className={errors.first_name ? 'border-red-500' : ''}
                                    disabled={patientExistsInTenant}
                                />
                                {(validationErrors.first_name || errors.first_name) && <p className="mt-1 text-sm text-red-500">{validationErrors.first_name || errors.first_name}</p>}
                            </div>
                            <div className="">
                                <Label htmlFor="last_name">Last Name *</Label>
                                <Input
                                    id="last_name"
                                    type="text"
                                    value={data.last_name}
                                    onChange={(e) => setData('last_name', e.target.value)}
                                    className={errors.last_name ? 'border-red-500' : ''}
                                    disabled={patientExistsInTenant}
                                />
                                {(validationErrors.last_name || errors.last_name) && <p className="mt-1 text-sm text-red-500">{validationErrors.last_name || errors.last_name}</p>}
                            </div>
                            <div className="">
                                <Label htmlFor="gender">Gender</Label>
                                <Select value={data.gender} onValueChange={(value) => setData('gender', value)} disabled={patientExistsInTenant}>
                                    <SelectTrigger id="gender" className={`w-full ${errors.gender ? 'border-red-500' : ''}`}>
                                        <SelectValue placeholder="Select gender" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="male">Male</SelectItem>
                                        <SelectItem value="female">Female</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                                {(validationErrors.gender || errors.gender) && <p className="mt-1 text-sm text-red-500">{validationErrors.gender || errors.gender}</p>}
                            </div>
                            <div className="">
                                <Label htmlFor="phone_number">Phone Number</Label>
                                <Input
                                    id="phone_number"
                                    type="text"
                                    value={data.phone_number}
                                    onChange={(e) => setData('phone_number', e.target.value)}
                                    className={errors.phone_number ? 'border-red-500' : ''}
                                    disabled={patientExistsInTenant}
                                />
                                {(validationErrors.phone_number || errors.phone_number) && <p className="mt-1 text-sm text-red-500">{validationErrors.phone_number || errors.phone_number}</p>}
                            </div>
                            <div className="">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    className={errors.email ? 'border-red-500' : ''}
                                    disabled={patientExistsInTenant}
                                />
                                {(validationErrors.email || errors.email) && <p className="mt-1 text-sm text-red-500">{validationErrors.email || errors.email}</p>}
                            </div>
                            <div className="">
                                <Label htmlFor="address">Address</Label>
                                <Textarea
                                    id="address"
                                    value={data.address}
                                    onChange={(e) => setData('address', e.target.value)}
                                    className={errors.address ? 'border-red-500' : ''}
                                    disabled={patientExistsInTenant}
                                />
                                {(validationErrors.address || errors.address) && <p className="mt-1 text-sm text-red-500">{validationErrors.address || errors.address}</p>}
                            </div>
                            <div className="">
                                <Label>Date of Birth</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={`w-full justify-start text-left font-normal ${!data.date_of_birth ? 'text-muted-foreground' : ''} ${errors.date_of_birth ? 'border-red-500' : ''}`}
                                            disabled={patientExistsInTenant}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {data.date_of_birth ? new Date(data.date_of_birth).toDateString() : 'Pick a date'}
                                        </Button>
                                    </PopoverTrigger>
                                    {!patientExistsInTenant && (
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={data.date_of_birth ? new Date(data.date_of_birth) : undefined}
                                                onSelect={(date) => {
                                                    if (date) {
                                                        const formatted = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
                                                        setData('date_of_birth', formatted);
                                                    }
                                                }}
                                            />
                                        </PopoverContent>
                                    )}
                                </Popover>
                                {(validationErrors.date_of_birth || errors.date_of_birth) && <p className="mt-1 text-sm text-red-500">{validationErrors.date_of_birth || errors.date_of_birth}</p>}
                            </div>
                            <div className="">
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea 
                                    id="notes" 
                                    value={data.notes} 
                                    onChange={(e) => setData('notes', e.target.value)} 
                                    disabled={patientExistsInTenant}
                                />
                            </div>
                        </div>
                        <div className="mt-6">
                            <div className="flex items-center space-x-2">
                                <Checkbox 
                                    id="is_active" 
                                    checked={data.is_active} 
                                    onCheckedChange={(value) => setData('is_active', value as boolean)} 
                                    disabled={patientExistsInTenant}
                                />
                                <Label htmlFor="is_active">Is Active</Label>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-4">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => window.history.back()}
                            >
                                {patientExistsInTenant ? 'Go Back' : 'Cancel'}
                            </Button>
                            {patientExistsInTenant ? (
                                <Button type="button" onClick={handleGoToPatientList}>
                                    View Patient List
                                </Button>
                            ) : (
                                <Button type="submit" disabled={processing || pendingSubmit} size="save">
                                    {processing ? 'Saving...' : pendingSubmit ? 'Confirming...' : patient ? 'Update Patient' : 'Create Patient'}
                                </Button>
                            )}
                        </div>
                    </form>

                    {/* Wellovis Network Disclaimer Dialog */}
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
                                    {patient ? (
                                        <>By updating this patient's information, you acknowledge that their public information will be shared throughout the <strong>Wellovis network</strong> to ensure continuity of care across healthcare providers.</>
                                    ) : (
                                        <>By creating this patient record, you acknowledge that the patient's public information will be shared throughout the <strong>Wellovis network</strong> to ensure continuity of care across healthcare providers.</>
                                    )}
                                </p>
                                <div className="bg-blue-50 p-3 rounded-md">
                                    <p className="text-xs text-blue-700">
                                        <strong>Information shared includes:</strong> Name, Health Number, Contact Information, Date of Birth, and other basic demographic data necessary for patient identification and care coordination.
                                    </p>
                                </div>
                                <p className="text-sm text-gray-600">
                                    Do you want to proceed with {patient ? 'updating' : 'creating'} this patient record?
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
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    Yes, Continue
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardContent>
            </Card>
        </>
    );
}

export default withAppLayout(Create, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Patients', href: route('patients.index') },
        { title: 'Create Patient' }
    ]
});