import React from 'react';
import { router } from '@inertiajs/react';
import PublicPortalLayout from '@/layouts/public-portal-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
    MapPin, 
    Calendar, 
    Globe, 
    Users, 
    DollarSign, 
    Video, 
    Home, 
    Award,
    ChevronLeft,
    Clock
} from 'lucide-react';

interface Service {
    id: number;
    name: string;
    category: string;
    description?: string;
    delivery_modes: string[];
    price: number;
    currency: string;
    duration_minutes?: number;
}

interface Practitioner {
    id: number;
    first_name: string;
    last_name: string;
    slug: string;
    title?: string;
    full_name: string;
    display_name: string;
    short_bio?: string;
    credentials?: string[];
    primary_specialties?: string[];
    therapeutic_modalities?: string[];
    client_types_served?: string[];
    languages_spoken?: string[];
    professional_associations?: string[];
    profile_picture_path?: string;
    profile_picture_url?: string;
    accepting_clients?: boolean;
    hourly_rate_min?: number;
    hourly_rate_max?: number;
    session_types?: string[];
    locations?: string[];
    availability?: Array<{
        day: string;
        time_of_day: string;
    }>;
    services?: Service[];
    approach?: string;
    therapy_experience?: string;
    about_me?: string;
    areas_of_treatment?: string[];
}

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
    practitioner: Practitioner;
}

const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

const getProfilePictureUrl = (practitioner: Practitioner) => {
    // Prefer S3 URL if available (already signed)
    if (practitioner?.profile_picture_url) {
        return practitioner.profile_picture_url;
    }
    // Fallback to legacy storage path
    if (practitioner?.profile_picture_path) {
        return `/storage/${practitioner.profile_picture_path}`;
    }
    return null;
};

export default function PractitionerDetail({ tenant, appearanceSettings, websiteSettings, practitioner }: Props) {
    const handleBookAppointment = () => {
        console.log('practitioner',practitioner)
        router.visit(`/explore/book-appointment/${practitioner.slug}`);
    };

    const handleBackToStaff = () => {
        router.visit('/explore/staff');
    };

    return (
        <PublicPortalLayout 
            title={practitioner.display_name} 
            tenant={tenant} 
            appearanceSettings={appearanceSettings}
            websiteSettings={websiteSettings}
        >
            <div className="py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Back Button */}
                    <Button
                        variant="ghost"
                        onClick={handleBackToStaff}
                        className="mb-6 text-muted-foreground hover:text-foreground"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Back to Staff
                    </Button>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Sidebar - Profile Info */}
                        <div className="lg:col-span-1">
                            <Card className="sticky top-8">
                                <CardContent className="pt-6">
                                    {/* Profile Picture & Status */}
                                    <div className="text-center mb-6">
                                        <Avatar className="w-32 h-32 mx-auto mb-4 ring-4 ring-primary/10">
                                            <AvatarImage
                                                src={getProfilePictureUrl(practitioner) || undefined}
                                                alt={practitioner.full_name}
                                            />
                                            <AvatarFallback className="text-2xl font-semibold bg-primary/10 text-primary">
                                                {getInitials(practitioner.first_name, practitioner.last_name)}
                                            </AvatarFallback>
                                        </Avatar>

                                        {practitioner.accepting_clients && (
                                            <div className="flex items-center justify-center gap-2 mb-4">
                                                <span className="relative flex h-3 w-3">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                                </span>
                                                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                                    Accepting Clients
                                                </span>
                                            </div>
                                        )}

                                        <h1 className="text-2xl font-bold text-foreground mb-2">
                                            {practitioner.display_name}
                                        </h1>

                                        {practitioner.title && (
                                            <p className="text-sm text-muted-foreground mb-3">
                                                {practitioner.title}
                                            </p>
                                        )}

                                        {/* Credentials */}
                                        {practitioner.credentials && practitioner.credentials.length > 0 && (
                                            <div className="flex flex-wrap justify-center gap-2 mb-4">
                                                {practitioner.credentials.map((credential, index) => (
                                                    <Badge key={index} variant="secondary" className="text-xs">
                                                        {credential}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Session Types & Pricing */}
                                    <div className="space-y-3 mb-6">
                                        {practitioner.session_types && practitioner.session_types.length > 0 && (
                                            <div className="flex items-center gap-2 text-sm">
                                                {practitioner.session_types.includes('Virtual') && (
                                                    <Badge variant="outline" className="flex items-center gap-1">
                                                        <Video className="h-3 w-3" />
                                                        Virtual
                                                    </Badge>
                                                )}
                                                {practitioner.session_types.includes('In-Person') && (
                                                    <Badge variant="outline" className="flex items-center gap-1">
                                                        <Home className="h-3 w-3" />
                                                        In-Person
                                                    </Badge>
                                                )}
                                            </div>
                                        )}

                                        {(practitioner.hourly_rate_min && practitioner.hourly_rate_max) && (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <DollarSign className="h-4 w-4 text-primary" />
                                                <span>
                                                    {practitioner.hourly_rate_min === practitioner.hourly_rate_max 
                                                        ? `$${practitioner.hourly_rate_min}`
                                                        : `$${practitioner.hourly_rate_min} - $${practitioner.hourly_rate_max}`
                                                    }
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Request Appointment Button */}
                                    <Button 
                                        onClick={handleBookAppointment}
                                        className="w-full mb-6"
                                        size="lg"
                                    >
                                        Request an appointment
                                    </Button>

                                    <Separator className="mb-6" />

                                    {/* Locations */}
                                    {practitioner.locations && practitioner.locations.length > 0 && (
                                        <div className="mb-6">
                                            <div className="flex items-center gap-2 mb-3">
                                                <MapPin className="h-4 w-4 text-primary" />
                                                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                                                    Locations
                                                </h3>
                                            </div>
                                            <div className="space-y-1">
                                                {practitioner.locations.map((location, index) => (
                                                    <p key={index} className="text-sm text-muted-foreground">
                                                        {location}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <Separator className="mb-6" />

                                    {/* Availability */}
                                    {practitioner.availability && practitioner.availability.length > 0 && (
                                        <div className="mb-6">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Calendar className="h-4 w-4 text-primary" />
                                                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                                                    Availability
                                                </h3>
                                            </div>
                                            <div className="space-y-2">
                                                {practitioner.availability.map((slot, index) => (
                                                    <div key={index} className="flex items-center justify-between text-sm">
                                                        <span className="font-medium text-foreground">{slot.day}</span>
                                                        <span className="text-muted-foreground">{slot.time_of_day}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <Separator className="mb-6" />

                                    {/* Languages */}
                                    {practitioner.languages_spoken && practitioner.languages_spoken.length > 0 && (
                                        <div className="mb-6">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Globe className="h-4 w-4 text-primary" />
                                                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                                                    Languages
                                                </h3>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {practitioner.languages_spoken.map((language, index) => (
                                                    <Badge key={index} variant="secondary" className="text-xs">
                                                        {language}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {practitioner.client_types_served && practitioner.client_types_served.length > 0 && (
                                        <>
                                            <Separator className="mb-6" />
                                            <div>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Users className="h-4 w-4 text-primary" />
                                                    <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                                                        Population
                                                    </h3>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {practitioner.client_types_served.map((type, index) => (
                                                        <Badge key={index} variant="outline" className="text-xs">
                                                            {type}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Content - Detailed Information */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Services Offered */}
                            {practitioner.services && practitioner.services.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg uppercase tracking-wide">
                                            Services Offered
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {practitioner.services.map((service) => (
                                                <div 
                                                    key={service.id} 
                                                    className="p-4 rounded-lg border bg-card hover:border-primary/50 transition-colors"
                                                >
                                                    <div className="flex items-start justify-between gap-4 mb-2">
                                                        <div>
                                                            <h4 className="font-semibold text-foreground mb-1">
                                                                {service.name}
                                                            </h4>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Badge variant="outline" className="text-xs">
                                                                    {service.category}
                                                                </Badge>
                                                                {service.delivery_modes.map((mode, idx) => (
                                                                    <Badge key={idx} variant="secondary" className="text-xs">
                                                                        {mode === 'in-person' ? (
                                                                            <><Home className="h-3 w-3 mr-1" />In-Person</>
                                                                        ) : (
                                                                            <><Video className="h-3 w-3 mr-1" />Virtual</>
                                                                        )}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-semibold text-foreground">
                                                                ${service.price} {service.currency}
                                                            </div>
                                                            {service.duration_minutes && (
                                                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                                                    <Clock className="h-3 w-3" />
                                                                    {service.duration_minutes} min
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {service.description && (
                                                        <p className="text-sm text-muted-foreground">
                                                            {service.description}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* My Approach */}
                            {practitioner.approach && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg uppercase tracking-wide">
                                            My Approach
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                                            {practitioner.approach}
                                        </p>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Your Therapy Experience */}
                            {practitioner.therapy_experience && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg uppercase tracking-wide">
                                            Your Therapy Experience
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                                            {practitioner.therapy_experience}
                                        </p>
                                    </CardContent>
                                </Card>
                            )}

                            {/* More About Me */}
                            {practitioner.about_me && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg uppercase tracking-wide">
                                            More About Me
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                                            {practitioner.about_me}
                                        </p>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Areas of Treatment */}
                            {practitioner.areas_of_treatment && practitioner.areas_of_treatment.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg uppercase tracking-wide">
                                            Areas of Treatment
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2">
                                            {practitioner.areas_of_treatment.map((area, index) => (
                                                <Badge 
                                                    key={index} 
                                                    variant="secondary"
                                                    className="text-sm px-3 py-1"
                                                >
                                                    {area}
                                                </Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Therapeutic Modalities */}
                            {practitioner.therapeutic_modalities && practitioner.therapeutic_modalities.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg uppercase tracking-wide">
                                            Therapeutic Modalities
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2">
                                            {practitioner.therapeutic_modalities.map((modality, index) => (
                                                <Badge 
                                                    key={index} 
                                                    variant="outline"
                                                    className="text-sm px-3 py-1"
                                                >
                                                    {modality}
                                                </Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Primary Specialties */}
                            {practitioner.primary_specialties && practitioner.primary_specialties.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg uppercase tracking-wide flex items-center gap-2">
                                            <Award className="h-5 w-5 text-primary" />
                                            Primary Specialties
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2">
                                            {practitioner.primary_specialties.map((specialty, index) => (
                                                <Badge 
                                                    key={index} 
                                                    variant="default"
                                                    className="text-sm px-3 py-1"
                                                >
                                                    {specialty}
                                                </Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Professional Associations */}
                            {practitioner.professional_associations && practitioner.professional_associations.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg uppercase tracking-wide">
                                            Professional Associations
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2">
                                            {practitioner.professional_associations.map((association, index) => (
                                                <Badge 
                                                    key={index} 
                                                    variant="secondary"
                                                    className="text-sm px-3 py-1"
                                                >
                                                    {association}
                                                </Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Call to Action at Bottom */}
                            <Card className="bg-primary/5 border-primary/20">
                                <CardContent className="p-6 text-center">
                                    <h3 className="text-xl font-bold text-foreground mb-2">
                                        Ready to Start Your Journey?
                                    </h3>
                                    <p className="text-muted-foreground mb-4">
                                        Book an appointment with {practitioner.display_name} today.
                                    </p>
                                    <Button 
                                        onClick={handleBookAppointment}
                                        size="lg"
                                        className="bg-primary hover:bg-primary/90"
                                    >
                                        Request an appointment
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </PublicPortalLayout>
    );
}

