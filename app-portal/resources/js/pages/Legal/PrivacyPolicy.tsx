import { Head, Link } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { Card, CardContent } from '@/components/ui/card';

export default function PrivacyPolicy() {
    return (
        <>
            <Head title="Privacy Policy" />
            
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
                            <h1 className="mb-6 text-3xl font-bold">Privacy Policy</h1>
                            
                            <p className="mb-4 text-sm text-gray-600">
                                <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
                            </p>

                            <div className="space-y-6">
                                <section>
                                    <h2 className="text-2xl font-semibold">1. Information Collection</h2>
                                    <p className="mt-2">
                                        We collect information that you provide directly to us when you use our services, including:
                                    </p>
                                    <ul className="ml-6 list-disc">
                                        <li>Personal identification information (name, email, phone number)</li>
                                        <li>Health information and medical records</li>
                                        <li>Account credentials and authentication data</li>
                                        <li>Usage data and technical information</li>
                                    </ul>
                                </section>

                                <section>
                                    <h2 className="text-2xl font-semibold">2. Use of Information</h2>
                                    <p className="mt-2">We use the information we collect to:</p>
                                    <ul className="ml-6 list-disc">
                                        <li>Provide and maintain our healthcare services</li>
                                        <li>Process your requests and facilitate appointments</li>
                                        <li>Communicate with you about your account and services</li>
                                        <li>Improve our platform and develop new features</li>
                                        <li>Comply with legal obligations and regulatory requirements</li>
                                    </ul>
                                </section>

                                <section>
                                    <h2 className="text-2xl font-semibold">3. Data Security</h2>
                                    <p className="mt-2">
                                        We implement industry-standard security measures to protect your information, including:
                                    </p>
                                    <ul className="ml-6 list-disc">
                                        <li>End-to-end encryption (CipherSweet and AWS KMS)</li>
                                        <li>Secure data transmission (HTTPS/TLS)</li>
                                        <li>Access controls and authentication requirements</li>
                                        <li>Regular security audits and monitoring</li>
                                        <li>HIPAA and PIPEDA compliance measures</li>
                                    </ul>
                                </section>

                                <section>
                                    <h2 className="text-2xl font-semibold">4. Information Sharing</h2>
                                    <p className="mt-2">
                                        We may share your information only as necessary for healthcare operations, with authorized 
                                        healthcare providers, or as required by law. We do not sell your personal information to third parties.
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-2xl font-semibold">5. Your Rights</h2>
                                    <p className="mt-2">You have the right to:</p>
                                    <ul className="ml-6 list-disc">
                                        <li>Access and receive a copy of your personal information</li>
                                        <li>Request correction of inaccurate information</li>
                                        <li>Request deletion of your information (subject to legal requirements)</li>
                                        <li>Withdraw consent where applicable</li>
                                        <li>File a complaint with privacy authorities</li>
                                    </ul>
                                </section>

                                <section>
                                    <h2 className="text-2xl font-semibold">6. Data Retention</h2>
                                    <p className="mt-2">
                                        We retain your information only for as long as necessary to provide services, comply with 
                                        legal obligations, or resolve disputes. Health records are retained as required by applicable 
                                        healthcare regulations.
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-2xl font-semibold">7. Updates to Privacy Policy</h2>
                                    <p className="mt-2">
                                        We may update this Privacy Policy from time to time. We will notify you of any changes by 
                                        posting the new policy on this page and updating the "Last Updated" date.
                                    </p>
                                </section>

                                <section>
                                    <h2 className="text-2xl font-semibold">8. Contact Information</h2>
                                    <p className="mt-2">
                                        If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us:
                                    </p>
                                    <p className="mt-2">
                                        Email: privacy@wellovis.com<br />
                                        Address: [Your Company Address]<br />
                                        Phone: [Your Phone Number]
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
                        <Link href="/terms-of-service" className="text-blue-600 hover:underline">
                            Terms of Service
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}

