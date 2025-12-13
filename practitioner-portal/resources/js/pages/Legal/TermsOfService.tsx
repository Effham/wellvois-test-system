import { Head, Link } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { Card, CardContent } from '@/components/ui/card';

export default function TermsOfService() {
    return (
        <>
            <Head title="Terms of Service" />
            
            <div className="min-h-screen bg-gray-50 py-12">
                <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="mb-8 flex items-center justify-center">
                        <Link href="/">
                            <AppLogoIcon className="h-12 w-auto" />
                        </Link>
                    </div>

                    <Card>
                        <CardContent className="prose max-w-none py-8 px-6">
                            <h1 className="mb-6 text-3xl font-bold">Terms of Service</h1>
                            
                            <p className="mb-4 text-sm text-gray-600">
                                <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
                            </p>

                            <div className="space-y-6">
                                <section>
                                    <h2 className="text-2xl font-semibold">1. Introduction</h2>
                                    <p className="mt-2">
                                        Welcome to Wellovis. These Terms of Service ("Terms") govern your use of the Wellovis platform 
                                        and services. By accessing or using our services, you agree to be bound by these Terms.
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-2xl font-semibold">2. User Accounts</h2>
                                    <p className="mt-2">
                                        You are responsible for maintaining the confidentiality of your account credentials. You agree to:
                                    </p>
                                    <ul className="ml-6 list-disc">
                                        <li>Keep your password secure and confidential</li>
                                        <li>Immediately notify us of any unauthorized access to your account</li>
                                        <li>Be responsible for all activities under your account</li>
                                        <li>Provide accurate and complete information</li>
                                    </ul>
                                </section>

                                <section>
                                    <h2 className="text-2xl font-semibold">3. Use of Service</h2>
                                    <p className="mt-2">You agree to use our services only for lawful purposes and in accordance with these Terms. You agree not to:</p>
                                    <ul className="ml-6 list-disc">
                                        <li>Violate any applicable laws or regulations</li>
                                        <li>Infringe on the rights of others</li>
                                        <li>Interfere with or disrupt the security or integrity of our services</li>
                                        <li>Attempt to gain unauthorized access to any systems or networks</li>
                                    </ul>
                                </section>

                                <section>
                                    <h2 className="text-2xl font-semibold">4. Intellectual Property</h2>
                                    <p className="mt-2">
                                        All content, features, and functionality of the Wellovis platform are owned by Wellovis and are 
                                        protected by copyright, trademark, and other intellectual property laws.
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-2xl font-semibold">5. Limitation of Liability</h2>
                                    <p className="mt-2">
                                        To the maximum extent permitted by law, Wellovis shall not be liable for any indirect, 
                                        incidental, special, or consequential damages arising from your use of the platform.
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-2xl font-semibold">6. Modifications to Terms</h2>
                                    <p className="mt-2">
                                        We reserve the right to modify these Terms at any time. We will notify you of any changes by 
                                        posting the new Terms on this page. Your continued use of the platform constitutes acceptance 
                                        of any modifications.
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-2xl font-semibold">7. Contact Information</h2>
                                    <p className="mt-2">
                                        If you have any questions about these Terms, please contact us at:
                                    </p>
                                    <p className="mt-2">
                                        Email: legal@wellovis.com<br />
                                        Address: [Your Company Address]
                                    </p>
                                </section>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Footer */}
                    <div className="mt-8 text-center text-sm text-gray-500">
                        <Link href="/" className="text-blue-600 hover:underline">
                            Return to Home
                        </Link>
                        {' | '}
                        <Link href="/privacy-policy" className="text-blue-600 hover:underline">
                            Privacy Policy
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}

