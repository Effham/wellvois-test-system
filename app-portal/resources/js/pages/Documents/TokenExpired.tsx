import { Head } from '@inertiajs/react';
import { AlertCircle, Clock, Mail } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TokenExpired() {
    return (
        <>
            <Head title="Access Link Expired" />

            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
                <div className="max-w-md w-full">
                    <Card className="border-red-200 dark:border-red-800">
                        <CardHeader className="text-center space-y-4 pb-4">
                            <div className="mx-auto bg-red-100 dark:bg-red-950 rounded-full p-4 w-fit">
                                <Clock className="h-8 w-8 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl text-gray-900 dark:text-white">
                                    Access Link Expired
                                </CardTitle>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                    This document access link is no longer valid
                                </p>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg p-4">
                                <div className="flex gap-3">
                                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-red-900 dark:text-red-100">
                                            Why did this happen?
                                        </p>
                                        <p className="text-sm text-red-800 dark:text-red-200">
                                            Document access links expire after 7 days for security reasons, or the link may
                                            have already been used.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex gap-3 items-start">
                                    <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                                            Need access to your documents?
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Please contact your healthcare provider to request a new access link. They can
                                            send you a fresh link to access your documents securely.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                                    If you believe this is an error, please contact your healthcare provider directly.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="mt-6 text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Secure document access powered by{' '}
                            <span className="font-medium text-gray-700 dark:text-gray-300">Wellovis</span>
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
