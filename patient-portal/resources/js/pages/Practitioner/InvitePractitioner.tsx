import { Head, useForm, router } from '@inertiajs/react';
import { FormEventHandler, useState, useEffect, useRef, useCallback } from 'react';
import { LoaderCircle, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
// import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import InputError from '@/components/input-error';
import { withAppLayout } from '@/utils/layout';
// import { PageProps } from '@/types';

function InvitePractitioner({ auth }: any) {
    // Read query parameters from URL
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const from = urlParams.get('from');
    const onboarding = urlParams.get('onboarding');
    const isFromChecklist = from === 'checklist' && onboarding === 'true';

    const { data, setData, post, processing, errors, reset, setError, clearErrors } = useForm({
        email: '',
        from: from || '',
        onboarding: onboarding || '',
    });

    const [emailCheckInProgress, setEmailCheckInProgress] = useState(false);
    const [emailValidated, setEmailValidated] = useState(false);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('practitioners.invite-by-email'), {
            onSuccess: () => {
                reset();
                setEmailValidated(false);
            },
        });
    };

    const validateEmail = async (email: string) => {
        if (!email || !email.includes('@')) {
            setEmailValidated(false);
            return;
        }

        setEmailCheckInProgress(true);
        clearErrors('email');
        setEmailValidated(false);
        
        try {
            const response = await axios.post(route('practitioners.validate-email'), {
                email: email
            });
            
            if (response.data.existsInTenant) {
                setError('email', response.data.message);
                setEmailValidated(false);
            } else {
                // Email is valid and doesn't exist in tenant
                setEmailValidated(true);
            }
        } catch (error: any) {
            if (error.response?.data?.errors?.email) {
                setError('email', error.response.data.errors.email[0]);
            } else if (error.response?.data?.message) {
                setError('email', error.response.data.message);
            }
            setEmailValidated(false);
        } finally {
            setEmailCheckInProgress(false);
        }
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const email = e.target.value;
        setData('email', email);
        setEmailValidated(false);
        clearErrors('email');

        // Clear existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Set new timer for debounced validation (500ms delay)
        debounceTimerRef.current = setTimeout(() => {
            validateEmail(email);
        }, 500);
    };

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    return (
        <>
            <Head title="Invite Practitioner" />

            <div className="py-12">
                <div className="mx-auto max-w-3xl sm:px-6 lg:px-8">
                    {/* Back Button - Hide during onboarding checklist flow */}
                    {!isFromChecklist && (
                        <Button
                            variant="ghost"
                            className="mb-4"
                            onClick={() => router.visit(route('practitioners.index'))}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Practitioners
                        </Button>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Mail className="h-5 w-5" />
                                Send Practitioner Invitation
                            </CardTitle>
                            <CardDescription>
                                Enter the practitioner's email address. They will receive an invitation to complete their
                                registration and fill in their details.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submit} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="email">
                                        Email Address <span className="text-destructive">*</span>
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="practitioner@example.com"
                                            value={data.email}
                                            onChange={handleEmailChange}
                                            className={errors.email ? 'border-destructive' : emailValidated ? 'border-green-500' : ''}
                                            required
                                            autoFocus
                                            disabled={processing}
                                        />
                                        {emailCheckInProgress && (
                                            <LoaderCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />
                                        )}
                                        {emailValidated && !emailCheckInProgress && (
                                            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                                        )}
                                    </div>
                                    <InputError message={errors.email} className="mt-2" />
                                    {emailValidated && !errors.email && (
                                        <p className="text-sm text-green-600">
                                            ✓ Email is valid and ready to send invitation
                                        </p>
                                    )}
                                    {emailCheckInProgress && (
                                        <p className="text-sm text-muted-foreground">
                                            Validating email...
                                        </p>
                                    )}
                                    <p className="text-sm text-muted-foreground">
                                        The practitioner will receive an email with a secure link to complete their
                                        registration.
                                    </p>
                                </div>

                                <div className="bg-muted p-4 rounded-lg space-y-2">
                                    <h4 className="font-medium text-sm">What happens next?</h4>
                                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                                        <li>Practitioner receives invitation email</li>
                                        <li>They click the link and fill in their personal details</li>
                                        <li>They provide professional information (credentials, license, etc.)</li>
                                        <li>They set a password and complete registration</li>
                                        <li>They're automatically added to your practice</li>
                                    </ol>
                                </div>

                                <div className="flex items-center gap-4">
                                    <Button 
                                        type="submit" 
                                        disabled={processing || emailCheckInProgress || !emailValidated || !!errors.email}
                                    >
                                        {processing ? (
                                            <>
                                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                                Sending Invitation...
                                            </>
                                        ) : (
                                            <>
                                                <Mail className="mr-2 h-4 w-4" />
                                                Send Invitation
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => router.visit(route('practitioners.index'))}
                                        disabled={processing}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}

export default withAppLayout(InvitePractitioner, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Practitioners', href: route('practitioners.index') },
        { title: 'Invite Practitioner' }
    ]
});
