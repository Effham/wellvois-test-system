import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, Clock, ArrowLeft } from 'lucide-react';

import AppLogoIcon from '@/components/app-logo-icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
    message: string;
}

export default function InvitationExpired({ message }: Props) {
    return (
        <div className="bg-muted min-h-screen flex flex-col items-center justify-center p-6">
            <Head title="Invitation Expired" />
            
            {/* Logo */}
            <Link href={route('home')} className="mb-8">
                <AppLogoIcon className="h-6 w-24 fill-current text-black dark:text-white" />
            </Link>

            {/* Main Content Container */}
            <div className="w-full max-w-lg space-y-6">
                {/* Title Section */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Invitation Expired
                    </h1>
                    <p className="text-gray-600">
                        This invitation link is no longer valid
                    </p>
                </div>

                {/* Error Card */}
                <Card className="border-red-200">
                    <CardHeader className="text-center pb-4">
                        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                            <AlertTriangle className="h-8 w-8 text-red-600" />
                        </div>
                        <CardTitle className="text-red-900">Unable to Process Invitation</CardTitle>
                        <CardDescription className="text-red-700">
                            {message}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert className="border-amber-200 bg-amber-50">
                            <Clock className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-800">
                                <strong>What happened?</strong> Invitation links expire for security reasons. 
                                This helps protect your account and practice information.
                            </AlertDescription>
                        </Alert>

                        <div className="space-y-3 text-sm text-gray-600">
                            <h4 className="font-medium text-gray-900">What you can do:</h4>
                            <ul className="space-y-2 list-disc list-inside">
                                <li>Contact the practice administrator who sent the invitation</li>
                                <li>Request a new invitation to be sent to your email</li>
                                <li>Check your email for any recent invitations</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="space-y-3">
                    <Button 
                        asChild 
                        className="w-full" 
                        size="lg"
                        variant="default"
                    >
                        <Link href={route('home')}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Return to Homepage
                        </Link>
                    </Button>
                    
                    <Button 
                        asChild 
                        variant="outline" 
                        className="w-full"
                        size="lg"
                    >
                        <Link href={route('login')}>
                            Already have an account? Sign In
                        </Link>
                    </Button>
                </div>

                {/* Footer */}
                <div className="text-center text-sm text-gray-500">
                    <p>
                        Need help? Contact the practice that sent you this invitation.
                    </p>
                </div>
            </div>
        </div>
    );
} 