import { Head, useForm, Link } from '@inertiajs/react';
import { LoaderCircle, UserCheck, Shield, EyeOff, Eye } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

import InputError from '@/components/input-error';
import AppLogoIcon from '@/components/app-logo-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type PatientInvitationForm = {
    password?: string;
    password_confirmation?: string;
    terms?: boolean;
};

type Patient = {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    health_number?: string;
};

type Tenant = {
    id: string;
    company_name: string;
};

type Invitation = {
    id: number;
    expires_at: string;
    status: string;
};

interface Props {
    invitation: Invitation;
    patient: Patient;
    tenant: Tenant;
    token: string;
    requiresRegistration: boolean;
}

export default function PatientInvitation({ 
    invitation, 
    patient, 
    tenant, 
    token, 
    requiresRegistration 
}: Props) {
    const { data, setData, post, processing, errors, reset } = useForm<PatientInvitationForm>({
        password: '',
        password_confirmation: '',
        terms: false,
    });
        const [showPassword, setShowPassword] = useState(false);
        const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('patient.invitation.accept.submit', token), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    const patientName = `${patient.first_name} ${patient.last_name}`;
    const expiresAt = new Date(invitation.expires_at).toLocaleDateString();

    return (
        <div className="bg-muted min-h-screen flex flex-col items-center justify-center p-6">
            <Head title={requiresRegistration ? "Complete Registration" : "Accept Invitation"} />
            
            {/* Logo */}
            <Link href={route('home')} className="mb-8">
                <AppLogoIcon className="h-6 w-24 fill-current text-black dark:text-white" />
            </Link>

            {/* Main Content Container */}
            <div className="w-full max-w-2xl space-y-6">
                {/* Title Section */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-gray-900">
                        {requiresRegistration ? "Complete Your Registration" : "Join Practice"}
                    </h1>
                    <p className="text-gray-600 text-lg">
                        {requiresRegistration 
                            ? `Set up your account to access ${tenant.company_name}`
                            : `Accept invitation to access ${tenant.company_name}`
                        }
                    </p>
                </div>

                {/* Invitation Details Card */}
                <Card className="border-green-200 bg-green-50">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-green-900">
                            <UserCheck className="h-5 w-5" />
                            Patient Portal Invitation
                        </CardTitle>
                        <CardDescription className="text-green-700">
                            You have been invited to access the patient portal for <strong>{tenant.company_name}</strong>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="space-y-2 text-sm">
                            <div>
                                <span className="font-medium text-green-900">Patient:</span>{' '}
                                <span className="text-green-800">
                                    {patientName} {patient.health_number && `(Health #: ${patient.health_number})`}
                                </span>
                            </div>
                            <div>
                                <span className="font-medium text-green-900">Email:</span>{' '}
                                <span className="text-green-800">{patient.email}</span>
                            </div>
                            <div>
                                <span className="font-medium text-green-900">Expires:</span>{' '}
                                <span className="text-green-800">{expiresAt}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Action Form */}
                <form className="space-y-6" onSubmit={submit}>
                    {requiresRegistration ? (
                        <>
                            {/* Registration Form */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Shield className="h-5 w-5" />
                                        Set Your Password
                                    </CardTitle>
                                    <CardDescription>
                                        Create a secure password to complete your account setup
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                                            Password <span className="text-red-500">*</span>
                                        </Label>
                                        <div className='relative'>
                                                  <Input
                                            id="password"
                                           type={showPassword ? "text" : "password"}
                                            required
                                            autoFocus
                                            tabIndex={1}
                                            autoComplete="new-password"
                                            value={data.password}
                                            onChange={(e) => setData('password', e.target.value)}
                                            className="h-11"
                                            placeholder="Enter a secure password (min. 8 characters)"
                                        />
                                               <button
                                                                type="button"
                                                                onClick={() => setShowPassword(!showPassword)}
                                                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 focus:outline-none"
                                                            >
                                                                {showPassword ? (
                                                                    <EyeOff className="h-5 w-5" />
                                                                ) : (
                                                                    <Eye className="h-5 w-5" />
                                                                )}
                                                            </button>
                                        </div>
                                      
                                        <InputError message={errors.password} className="mt-1" />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="password_confirmation" className="text-sm font-medium text-gray-700">
                                            Confirm Password <span className="text-red-500">*</span>
                                        </Label>
                                        <div className='relative'>
                                                                <Input
                                            id="password_confirmation"
                                            type={showConfirmPassword ? "text" : "password"}
                                            required
                                            tabIndex={2}
                                            autoComplete="new-password"
                                            value={data.password_confirmation}
                                            onChange={(e) => setData('password_confirmation', e.target.value)}
                                            className="h-11"
                                            placeholder="Confirm your password"
                                        />
                                         <button
                                                                type="button"
                                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 focus:outline-none"
                                                            >
                                                                {showConfirmPassword ? (
                                                                    <EyeOff className="h-5 w-5" />
                                                                ) : (
                                                                    <Eye className="h-5 w-5" />
                                                                )}
                                                            </button>

                                        </div>
                                        
                                        <InputError message={errors.password_confirmation} className="mt-1" />
                                    </div>

                                    {/* Terms and Conditions */}
                                    <div className="flex items-start space-x-2 pt-2">
                                        <Checkbox 
                                            id="terms"
                                            required
                                            tabIndex={3}
                                            checked={data.terms}
                                            onCheckedChange={(checked) => setData('terms', checked as boolean)}
                                        />
                                        <div className="grid gap-1.5 leading-none">
                                            <Label htmlFor="terms" className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                I agree to the{' '}
                                                <Link href={route('terms.show')} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                                                    Terms of Service
                                                </Link>{' '}
                                                and{' '}
                                                <Link href={route('privacy.show')} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                                                    Privacy Policy
                                                </Link>
                                                <span className="text-red-500 ml-1">*</span>
                                            </Label>
                                        </div>
                                    </div>
                                    <InputError message={errors.terms} className="mt-1" />
                                </CardContent>
                            </Card>

                            <Button
                                type="submit"
                                className="w-full h-11 text-base font-medium"
                                disabled={processing || !data.terms || !data.password || !data.password_confirmation}
                                tabIndex={4}
                            >
                                {processing ? (
                                    <>
                                        <LoaderCircle className="animate-spin mr-2 h-4 w-4" />
                                        Creating Account...
                                    </>
                                ) : (
                                    'Complete Registration & Access Portal'
                                )}
                            </Button>
                        </>
                    ) : (
                        <>
                            {/* Simple Accept Invitation */}
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="text-center">
                                        <p className="text-gray-600 mb-4">
                                            You already have an account. Click below to access the patient portal for <strong>{tenant.company_name}</strong>.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Button
                                type="submit"
                                className="w-full h-11 text-base font-medium"
                                disabled={processing}
                                tabIndex={1}
                            >
                                {processing ? (
                                    <>
                                        <LoaderCircle className="animate-spin mr-2 h-4 w-4" />
                                        Accepting Invitation...
                                    </>
                                ) : (
                                    'Accept Invitation & Access Portal'
                                )}
                            </Button>
                        </>
                    )}
                </form>

                {/* Error Display */}
                {Object.keys(errors).length > 0 && (
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="pt-6">
                            <div className="text-red-800">
                                <h4 className="font-medium mb-2">Please fix the following errors:</h4>
                                <ul className="list-disc list-inside space-y-1 text-sm">
                                    {Object.values(errors).map((error, index) => (
                                        <li key={index}>{error}</li>
                                    ))}
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Footer */}
                <div className="text-center text-sm text-gray-500 pt-8">
                    <p>
                        Need help?{' '}
                        <Link href="#" className="text-blue-600 hover:text-blue-800 underline">
                            Contact Support
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
} 