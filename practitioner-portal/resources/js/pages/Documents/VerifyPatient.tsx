import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import { FormEventHandler } from 'react';

import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';

interface VerifyPatientProps {
    token: string;
    encounterId: number;
    patientEmail: string;
}

export default function VerifyPatient({ token, encounterId, patientEmail }: VerifyPatientProps) {
    const { data, setData, post, processing, errors } = useForm({
        token,
        first_name: '',
        last_name: '',
        date_of_birth: '',
        health_number: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('documents.verify'));
    };

    return (
        <AuthLayout
            title="Verify Your Identity"
            description="To securely access your documents, please verify your identity by providing the following information."
        >
            <Head title="Verify Identity" />

            <div className="space-y-6">
                {/* Security Notice */}
                <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                    <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            Secure Document Access
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            Your healthcare provider has uploaded documents for you. Please verify your identity to
                            access them securely.
                        </p>
                    </div>
                </div>

                <form onSubmit={submit} noValidate>
                    {/* Show verification error if exists */}
                    {errors.verification && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
                            <p className="text-sm text-red-800 dark:text-red-200">{errors.verification}</p>
                        </div>
                    )}

                    <div className="grid gap-2 mb-3">
                        <Label htmlFor="first_name">First Name</Label>
                        <Input
                            id="first_name"
                            type="text"
                            value={data.first_name}
                            onChange={(e) => setData('first_name', e.target.value)}
                            placeholder="Enter your first name"
                            autoFocus
                            aria-invalid={!!errors.first_name}
                            aria-describedby="first-name-error"
                        />
                        <InputError id="first-name-error" message={errors.first_name} />
                    </div>

                    <div className="grid gap-2 mb-3">
                        <Label htmlFor="last_name">Last Name</Label>
                        <Input
                            id="last_name"
                            type="text"
                            value={data.last_name}
                            onChange={(e) => setData('last_name', e.target.value)}
                            placeholder="Enter your last name"
                            aria-invalid={!!errors.last_name}
                            aria-describedby="last-name-error"
                        />
                        <InputError id="last-name-error" message={errors.last_name} />
                    </div>

                    <div className="grid gap-2 mb-3">
                        <Label htmlFor="date_of_birth">Date of Birth</Label>
                        <Input
                            id="date_of_birth"
                            type="date"
                            value={data.date_of_birth}
                            onChange={(e) => setData('date_of_birth', e.target.value)}
                            aria-invalid={!!errors.date_of_birth}
                            aria-describedby="date-of-birth-error"
                        />
                        <InputError id="date-of-birth-error" message={errors.date_of_birth} />
                    </div>

                    <div className="grid gap-2 mb-3">
                        <Label htmlFor="health_number">Health Card Number</Label>
                        <Input
                            id="health_number"
                            type="text"
                            value={data.health_number}
                            onChange={(e) => setData('health_number', e.target.value)}
                            placeholder="Enter your health card number"
                            aria-invalid={!!errors.health_number}
                            aria-describedby="health-number-error"
                        />
                        <InputError id="health-number-error" message={errors.health_number} />
                    </div>

                    <div className="my-6 flex items-center justify-start">
                        <Button className="w-full" disabled={processing}>
                            {processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                            Verify and Access Documents
                        </Button>
                    </div>
                </form>

                <div className="text-muted-foreground text-center text-xs space-y-1">
                    <p>
                        All information is encrypted and stored securely in compliance with healthcare privacy
                        regulations.
                    </p>
                    <p className="text-muted-foreground/70">
                        If you have any issues accessing your documents, please contact your healthcare provider.
                    </p>
                </div>
            </div>
        </AuthLayout>
    );
}
