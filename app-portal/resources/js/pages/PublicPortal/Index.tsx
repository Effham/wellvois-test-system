import { useEffect, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import PublicPortalLayout from '@/layouts/public-portal-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/sonner';
import { 
    MapPin, 
    Users, 
    Briefcase, 
    Calendar,
    Phone,
    ChevronRight,
    LogIn,
    Mail
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
    tenant: {
        id: string;
        company_name: string;
    };
    appearanceSettings?: {
        appearance_theme_color?: string;
        appearance_logo_path?: string;
        appearance_font_family?: string;
    };
    websiteSettings?: {
        navigation?: {
            items?: Array<{
                id: string;
                label: string;
                enabled: boolean;
                customLabel?: string;
                order: number;
            }>;
        };
        appearance?: any;
    };
    stats: {
        services_count: number;
        locations_count: number;
        practitioners_count: number;
    };
    patientSession?: {
        exists: boolean;
        patient_id?: string;
    };
}


export default function PublicPortalIndex({ tenant, appearanceSettings, websiteSettings, stats, patientSession }: Props) {
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showRoleConflictModal, setShowRoleConflictModal] = useState(false);
    const [roleConflictMessage, setRoleConflictMessage] = useState('');
    const [email, setEmail] = useState('');
    const [processing, setProcessing] = useState(false);

    // Track visit to current domain for cross-tenant detection
    useEffect(() => {
        try {
            const currentDomain = window.location.host;
            const timestamp = Date.now();
            const visitKey = `wellovis_visit_${currentDomain}`;
            
            localStorage.setItem(visitKey, JSON.stringify({
                domain: currentDomain,
                timestamp: timestamp
            }));
            
            console.log('📍 Logged visit to:', currentDomain);
        } catch (error) {
            console.error('Failed to track visit:', error);
        }
    }, []);


    const handleLoginClick = () => {
        // Check if patient session exists for the same patient for that particular tenant
        if (patientSession?.exists && patientSession?.patient_id) {
            // Redirect directly to patient dashboard with cookies
            const expires = new Date();
            expires.setTime(expires.getTime() + (24 * 60 * 60 * 1000)); // 24 hours
            
            document.cookie = `from_public_portal=true; expires=${expires.toUTCString()}; path=/`;
            document.cookie = `patient_id=${patientSession.patient_id}; expires=${expires.toUTCString()}; path=/`;
            
            window.location.href = '/central/patient-dashboard';
            return;
        }
        
        // No session found, open email modal for potential patient login
        setShowLoginModal(true);
    };

    // Handle email submission for patient login
    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        console.log('Form submitted with email:', email.trim());
        
        if (!email.trim()) {
            setRoleConflictMessage('Please enter your email address.');
            setShowRoleConflictModal(true);
            return;
        }

        setProcessing(true);
        console.log('Starting email validation request...');

        try {
            // Step 1: Check if patient exists in this tenant
            const patientCheckResponse = await fetch(route('public-portal.check-patient-exists'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    email: email.trim(),
                    tenant_id: tenant.id,
                }),
                credentials: 'include',
            });

            const patientCheckData = await patientCheckResponse.json();

            if (patientCheckResponse.ok) {
                if (patientCheckData.exists) {
                    // Patient exists - proceed with full validation
                    const formData = new FormData();
                    formData.append('email', email.trim());

                    const validateResponse = await fetch(route('public-portal.validate-email'), {
                        method: 'POST',
                        headers: {
                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                            'Accept': 'application/json',
                        },
                        body: formData,
                        credentials: 'include',
                    });

                    const validateData = await validateResponse.json();

                    console.log('Validate response:', {
                        ok: validateResponse.ok,
                        status: validateResponse.status,
                        data: validateData
                    });

                    if (validateResponse.ok) {
                        if (validateData.action === 'direct_login') {
                            toast.success('Logging you in...');
                            
                            localStorage.setItem('from_public_portal', 'true');
                            localStorage.setItem('patient_logged_in', 'true');
                            localStorage.setItem('patient_id', validateData.patient_id?.toString() || '');
                            localStorage.setItem('login_timestamp', new Date().toISOString());
                            
                            setShowLoginModal(false);
                            setEmail('');
                            
                            setTimeout(() => {
                                const redirectUrl = validateData.redirect_url || '/central/patient-dashboard';
                                window.location.href = redirectUrl;
                            }, 1000);
                            
                        } else {
                            // Handle other actions (session_conflict, role_conflict, etc.)
                            setRoleConflictMessage(validateData.message || 'Unable to process login request.');
                            setShowLoginModal(false);
                            setShowRoleConflictModal(true);
                        }
                    } else {
                        setRoleConflictMessage(validateData.message || 'Failed to validate email. Please try again.');
                        setShowLoginModal(false);
                        setShowRoleConflictModal(true);
                    }
                } else {
                    // Patient doesn't exist in this tenant
                    setRoleConflictMessage('No account found with this email address for this healthcare provider.');
                    setShowLoginModal(false);
                    setShowRoleConflictModal(true);
                }
            } else {
                // Patient check failed
                setRoleConflictMessage(patientCheckData.error || 'Failed to verify patient status. Please try again.');
                setShowLoginModal(false);
                setShowRoleConflictModal(true);
            }
            
        } catch (error) {
            console.error('Error validating email:', error);
            setRoleConflictMessage('An error occurred. Please try again.');
            setShowLoginModal(false);
            setShowRoleConflictModal(true);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <PublicPortalLayout 
            title="Welcome" 
            tenant={tenant} 
            appearanceSettings={appearanceSettings}
            websiteSettings={websiteSettings}
        >
            <div className="py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Hero Section */}
                    <div className="text-center mb-16">
                        <h1 className="text-4xl font-bold text-foreground mb-4">
                            Welcome to {tenant.company_name}
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                            Your trusted healthcare partner providing comprehensive medical services with a focus on quality care and patient satisfaction.
                        </p>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                        <Card className="text-center">
                            <CardHeader className="pb-2">
                                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                                    <Briefcase className="h-6 w-6 text-primary" />
                                </div>
                                <CardTitle className="text-2xl font-bold text-primary">
                                    {stats.services_count}
                                </CardTitle>
                                <CardDescription>Services Offered</CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="text-center">
                            <CardHeader className="pb-2">
                                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                                    <MapPin className="h-6 w-6 text-primary" />
                                </div>
                                <CardTitle className="text-2xl font-bold text-primary">
                                    {stats.locations_count}
                                </CardTitle>
                                <CardDescription>
                                    {stats.locations_count === 1 ? 'Location' : 'Locations'}
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="text-center">
                            <CardHeader className="pb-2">
                                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                                    <Users className="h-6 w-6 text-primary" />
                                </div>
                                <CardTitle className="text-2xl font-bold text-primary">
                                    {stats.practitioners_count}
                                </CardTitle>
                                <CardDescription>
                                    Healthcare {stats.practitioners_count === 1 ? 'Professional' : 'Professionals'}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </div>

                    {/* Quick Links */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="hover:shadow-lg transition-shadow">
                            <CardHeader>
                                <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                                        <Briefcase className="h-4 w-4 text-primary" />
                                    </div>
                                    <CardTitle>Our Services</CardTitle>
                                </div>
                                <CardDescription>
                                    Explore our comprehensive range of healthcare services and treatments.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href={route('public-portal.services')}>
                                    <Button className="w-full group">
                                        View Services
                                        <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-lg transition-shadow">
                            <CardHeader>
                                <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                                        <MapPin className="h-4 w-4 text-primary" />
                                    </div>
                                    <CardTitle>Our Locations</CardTitle>
                                </div>
                                <CardDescription>
                                    Find our clinic locations, hours of operation, and contact information.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href={route('public-portal.locations')}>
                                    <Button className="w-full group">
                                        View Locations
                                        <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-lg transition-shadow">
                            <CardHeader>
                                <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                                        <Users className="h-4 w-4 text-primary" />
                                    </div>
                                    <CardTitle>Our Team</CardTitle>
                                </div>
                                <CardDescription>
                                    Meet our qualified healthcare professionals and specialists.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href={route('public-portal.staff')}>
                                    <Button className="w-full group">
                                        Meet Our Team
                                        <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Call to Action */}
                    <div className="text-center mt-16">
                        <Card className="max-w-2xl mx-auto">
                            <CardContent className="p-8">
                                <h2 className="text-2xl font-bold text-foreground mb-4">
                                    Ready to Get Started?
                                </h2>
                                <p className="text-muted-foreground mb-6">
                                    Contact us today to schedule an appointment or learn more about our services.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                    <Link href={route('public-portal.book-appointment')}>
                                        <Button size="lg" className="group w-full sm:w-auto">
                                            <Calendar className="mr-2 h-4 w-4" />
                                            Book Appointment
                                        </Button>
                                    </Link>
                                    <Button variant="outline" size="lg" className="group">
                                        <Phone className="mr-2 h-4 w-4" />
                                        Contact Us
                                    </Button>
                                    {/* Only show Login button if patient is not already logged in */}
                                    {!(((window as any).sessionStatus?.isLoggedIn && (window as any).sessionStatus?.userType === 'patient')) && (
                                        <Button
                                            variant="secondary"
                                            size="lg"
                                            className="group w-full sm:w-auto"
                                            onClick={handleLoginClick}
                                        >
                                            <LogIn className="mr-2 h-4 w-4" />
                                            Login
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Login Modal */}
            <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5" />
                            Patient Login
                        </DialogTitle>
                        <DialogDescription>
                            Enter your email address to access your patient dashboard.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email address"
                                required
                                disabled={processing}
                            />
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setShowLoginModal(false);
                                    setEmail('');
                                }}
                                disabled={processing}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={processing}>
                                {processing ? 'Checking...' : 'Continue'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Role Conflict Modal */}
            <Dialog open={showRoleConflictModal} onOpenChange={setShowRoleConflictModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LogIn className="h-5 w-5" />
                            Login Error  
                        </DialogTitle>
                        <DialogDescription>
                            {roleConflictMessage}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end pt-4">
                        <Button
                            type="button"
                            onClick={() => {
                                setShowRoleConflictModal(false);
                                setRoleConflictMessage('');
                            }}
                        >
                            OK
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Toaster position="top-right" />
        </PublicPortalLayout>
    );
} 