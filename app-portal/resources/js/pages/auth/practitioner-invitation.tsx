import { Head, useForm, Link, router } from '@inertiajs/react';
import { LoaderCircle, UserCheck, Shield, EyeOff, Eye, AlertTriangle } from 'lucide-react';
import { FormEventHandler, useState, useEffect } from 'react';

import InputError from '@/components/input-error';
import AppLogoIcon from '@/components/app-logo-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import RegistrationConsentModal from '@/components/practitioner/RegistrationConsentModal';

type PractitionerInvitationForm = {
    password?: string;
    password_confirmation?: string;
    terms?: boolean;
    administrative_consent?: boolean;
};

type Practitioner = {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    title?: string;
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
    practitioner: Practitioner;
    tenant: Tenant;
    token: string;
    requiresRegistration: boolean;
}

export default function PractitionerInvitation({ 
    invitation, 
    practitioner, 
    tenant, 
    token, 
    requiresRegistration 
}: Props) {
    const { data, setData, post, processing, errors, reset } = useForm<PractitionerInvitationForm>({
        password: '',
        password_confirmation: '',
        terms: false,
        administrative_consent: false,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [showConsentModal, setShowConsentModal] = useState(false);

    // Debug logging
    useEffect(() => {
        console.log('=== Practitioner Invitation Component Mounted ===');
        console.log('requiresRegistration:', requiresRegistration);
        console.log('practitioner:', practitioner);
        console.log('tenant:', tenant);
        console.log('token:', token);
    }, []);

    useEffect(() => {
        console.log('=== Form Data Changed ===', data);
    }, [data]);

  const handleSaveClick: FormEventHandler = (e) => {
    e.preventDefault();

    console.log('=== handleSaveClick Called ===');
    console.log('Full form data:', data);
    console.log('requiresRegistration:', requiresRegistration);

    if (requiresRegistration) {
      // Created practitioner flow - validate password and terms
      console.log('=== NEW USER FLOW - Continue button clicked ===');
      console.log('Validating form data:', {
        password_length: data.password?.length,
        password_confirmation_length: data.password_confirmation?.length,
        passwords_match: data.password === data.password_confirmation,
        terms_accepted: data.terms,
        administrative_consent: data.administrative_consent,
      });
      
      // Validate passwords match
      if (data.password !== data.password_confirmation) {
        console.log('Password validation failed: passwords do not match');
        setData('password_confirmation', '');
        return;
      }
      
      // Validate terms accepted
      if (!data.terms) {
        console.log('Terms validation failed: terms not accepted');
        return;
      }
      
      console.log('All validations passed, showing consent modal');
      
      // Show consent modal instead of submitting directly
      setShowConsentModal(true);
    } else {
      // Linked practitioner flow - only validate terms
      console.log('=== EXISTING USER FLOW - Accept Invitation clicked ===');
      console.log('Validating terms:', {
        terms_accepted: data.terms,
        administrative_consent: data.administrative_consent,
      });
      
      // Validate terms accepted
      if (!data.terms) {
        console.log('Terms validation failed: terms not accepted');
        return;
      }
      
      console.log('Terms accepted, showing consent modal');
      
      // Show consent modal instead of submitting directly
      setShowConsentModal(true);
    }
  };

  const handleConsentAccept = () => {
    console.log('=== handleConsentAccept Called ===');
    console.log('Current form data:', data);

    // Close the modal
    setShowConsentModal(false);

    // Create submission data with administrative_consent set to true
    const submissionData = {
      ...data,
      administrative_consent: true,
    };

    console.log('=== Submission data (with consent) ===', submissionData);
    console.log('Route:', route('practitioner.invitation.accept.submit', token));

    // Use router.post directly to bypass form state management
    router.post(route('practitioner.invitation.accept.submit', token), submissionData, {
      onBefore: () => {
        console.log('=== onBefore: About to submit ===');
        console.log('Data being sent:', submissionData);
      },
      onStart: () => {
        console.log('=== onStart: Request started ===');
      },
      onSuccess: (response) => {
        console.log('=== onSuccess: Request succeeded ===', response);
      },
      onError: (errors) => {
        console.log('=== onError: Request failed ===', errors);
      },
      onFinish: () => {
        console.log('=== onFinish: Request finished ===');
      },
    });
  };

  const handleConsentCancel = () => {
    console.log('Consent cancelled, closing modal');
    setShowConsentModal(false);
  };

    const practitionerName = `${practitioner.first_name} ${practitioner.last_name}`;
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
                            ? `Set up your account to join ${tenant.company_name}`
                            : `Accept invitation to join ${tenant.company_name}`
                        }
                    </p>
                </div>

                {/* Invitation Details Card */}
                <Card className="border-blue-200 bg-blue-50">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-blue-900">
                            <UserCheck className="h-5 w-5" />
                            Practice Invitation
                        </CardTitle>
                        <CardDescription className="text-blue-700">
                            You have been invited to join <strong>{tenant.company_name}</strong>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="space-y-2 text-sm">
                            <div>
                                <span className="font-medium text-blue-900">Practitioner:</span>{' '}
                                <span className="text-blue-800">
                                    {practitionerName} {practitioner.title && `(${practitioner.title})`}
                                </span>
                            </div>
                            <div>
                                <span className="font-medium text-blue-900">Email:</span>{' '}
                                <span className="text-blue-800">{practitioner.email}</span>
                            </div>
                            <div>
                                <span className="font-medium text-blue-900">Expires:</span>{' '}
                                <span className="text-blue-800">{expiresAt}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Action Form */}
                <div className="space-y-6">
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
                                        <div className="relative">
                                                <Input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            required
                                            autoFocus
                                            tabIndex={1}
                                            autoComplete="new-password"
                                            value={data.password || ''}
                                            onChange={(e) => setData('password', e.target.value)}
                                            className={errors.password ? 'border-red-300' : ''}
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
                                        
                                        <InputError message={errors.password} className="mt-2" />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="password_confirmation" className="text-sm font-medium text-gray-700">
                                            Confirm Password <span className="text-red-500">*</span>
                                        </Label>
                                        <div className="relative">
                                                  <Input
                                            id="password_confirmation"
                                            type={showConfirmPassword ? "text" : "password"}
                                            required
                                            tabIndex={2}
                                            autoComplete="new-password"
                                            value={data.password_confirmation || ''}
                                            onChange={(e) => setData('password_confirmation', e.target.value)}
                                            className={errors.password_confirmation ? 'border-red-300' : ''}
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
                                      
                                        <InputError message={errors.password_confirmation} className="mt-2" />
                                    </div>

                                    <div className="flex items-start space-x-2">
                                        <Checkbox
                                            id="terms"
                                            checked={data.terms || false}
                                            onCheckedChange={(checked) => setData('terms', checked as boolean)}
                                            className={errors.terms ? 'border-red-300' : ''}
                                        />
                                        <div className="grid gap-1.5 leading-none">
                                            <Label
                                                htmlFor="terms"
                                                className="text-sm font-normal leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                I accept the{' '}
                                                <Link href={route('terms.show')} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                    Terms of Service
                                                </Link>{' '}
                                                and{' '}
                                                <Link href={route('privacy.show')} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                    Privacy Policy
                                                </Link>
                                                <span className="text-red-500 ml-1">*</span>
                                            </Label>
                                            <InputError message={errors.terms} className="mt-1" />
                                        </div>
                                    </div>

                                </CardContent>
                            </Card>

                            <Button 
                                type="button"
                                onClick={handleSaveClick}
                                disabled={processing || (requiresRegistration && !data.terms)} 
                                className="w-full"
                                size="lg"
                            >
                                {processing ? (
                                    <>
                                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                        Creating Account...
                                    </>
                                ) : (
                                    'Continue'
                                )}
                            </Button>
                        </>
                    ) : (
                        <>
                            {/* Linked Practitioner Acceptance */}
                            <Card>
                                <CardContent className="pt-6 space-y-4">
                                    <div className="text-center space-y-3">
                                        <UserCheck className="h-12 w-12 text-green-600 mx-auto" />
                                        <h3 className="text-lg font-medium text-gray-900">
                                            Ready to Join
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            Accept the invitation to join <strong>{tenant.company_name}</strong>.
                                        </p>
                                    </div>

                                    <div className="flex items-start space-x-2 pt-4">
                                        <Checkbox
                                            id="terms"
                                            checked={data.terms || false}
                                            onCheckedChange={(checked) => setData('terms', checked as boolean)}
                                            className={errors.terms ? 'border-red-300' : ''}
                                        />
                                        <div className="grid gap-1.5 leading-none">
                                            <Label
                                                htmlFor="terms"
                                                className="text-sm font-normal leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                I accept the{' '}
                                                <Link href={route('terms.show')} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                    Terms of Service
                                                </Link>{' '}
                                                and{' '}
                                                <Link href={route('privacy.show')} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                    Privacy Policy
                                                </Link>
                                                <span className="text-red-500 ml-1">*</span>
                                            </Label>
                                            <InputError message={errors.terms} className="mt-1" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Button 
                                type="button"
                                onClick={handleSaveClick}
                                disabled={processing || !data.terms} 
                                className="w-full"
                                size="lg"
                            >
                                {processing ? (
                                    <>
                                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                        Joining Practice...
                                    </>
                                ) : (
                                    'Accept Invitation & Join Practice'
                                )}
                            </Button>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="text-center text-sm text-gray-500">
                    <p>
                        This invitation will expire on <strong>{expiresAt}</strong>
                    </p>
                </div>
            </div>

            {/* Registration Consent Modal */}
            <RegistrationConsentModal
                open={showConsentModal}
                onAccept={handleConsentAccept}
                onCancel={handleConsentCancel}
                practitionerName={practitionerName}
                tenantName={tenant.company_name}
            />
        </div>
    );
} 