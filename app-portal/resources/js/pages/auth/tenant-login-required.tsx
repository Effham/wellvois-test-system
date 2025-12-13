import { Head } from '@inertiajs/react';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function TenantLoginRequired() {
    return (
        <>
            <Head title="Tenant Login Required" />
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="rounded-full bg-blue-100 p-3">
                                <AlertCircle className="h-6 w-6 text-blue-600" />
                            </div>
                            <CardTitle className="text-2xl">Tenant Login Required</CardTitle>
                            <CardDescription className="text-base">
                                This is a multi-tenant application. Please access your tenant's specific domain to log in.
                            </CardDescription>
                            <Alert className="mt-4">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>How to Access</AlertTitle>
                                <AlertDescription className="mt-2">
                                    Each tenant has its own domain. Please use your tenant's specific domain URL to log in.
                                    <br />
                                    <br />
                                    Example: <code className="text-xs bg-gray-100 px-2 py-1 rounded">your-tenant.app.localhost:8000/login</code>
                                </AlertDescription>
                            </Alert>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

