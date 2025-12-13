import React from 'react';
import PublicPortalLayout from '@/layouts/public-portal-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';

interface OperatingHour {
    id: number;
    day_of_week: string;
    open_time: string;
    close_time: string;
    is_open: boolean;
}

interface Location {
    id: number;
    name: string;
    street_address: string;
    apt_suite_unit?: string;
    city: string;
    province: string;
    postal_zip_code: string;
    phone_number?: string;
    email_address?: string;
    operating_hours?: OperatingHour[];
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
    locations: Location[];
}

export default function PublicPortalLocations({ tenant, appearanceSettings, websiteSettings, locations }: Props) {
    const formatAddress = (location: Location) => {
        let address = location.street_address;
        if (location.apt_suite_unit) {
            address += `, ${location.apt_suite_unit}`;
        }
        address += `, ${location.city}, ${location.province} ${location.postal_zip_code}`;
        return address;
    };

    const formatOperatingHours = (hours?: OperatingHour[]) => {
        if (!hours || hours.length === 0) {
            return ['Hours not available'];
        }

        const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const hoursMap: Record<string, OperatingHour> = {};
        
        hours.forEach(hour => {
            // Capitalize first letter to match our daysOfWeek array
            const capitalizedDay = hour.day_of_week.charAt(0).toUpperCase() + hour.day_of_week.slice(1);
            hoursMap[capitalizedDay] = hour;
        });

        return daysOfWeek.map(day => {
            const dayHours = hoursMap[day];
            if (!dayHours || !dayHours.is_open) {
                return `${day}: Closed`;
            }
            return `${day}: ${dayHours.open_time} - ${dayHours.close_time}`;
        });
    };

    return (
        <PublicPortalLayout 
            title="Locations" 
            tenant={tenant} 
            appearanceSettings={appearanceSettings}
            websiteSettings={websiteSettings}
        >
            <div className="py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="text-center mb-16">
                        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-8 shadow-lg">
                            <MapPin className="h-10 w-10 text-primary" />
                        </div>
                        <h1 className="text-5xl font-bold text-foreground mb-6 tracking-tight">
                            Our Locations
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                            Find our clinic locations, contact information, and operating hours to plan your visit.
                        </p>
                    </div>

                    {/* Locations */}
                    {locations.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground text-lg">
                                No location information is currently available.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {locations.map((location) => (
                                <Card key={location.id} className="hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-0 shadow-md">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center space-x-2 text-lg">
                                            <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                                            <span className="truncate">{location.name}</span>
                                        </CardTitle>
                                    </CardHeader>
                                    
                                    <CardContent className="space-y-4 pt-0">
                                        {/* Address */}
                                        <div>
                                            <h4 className="font-medium text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">Address</h4>
                                            <p className="text-sm text-foreground leading-relaxed">
                                                {formatAddress(location)}
                                            </p>
                                        </div>

                                        {/* Contact Information */}
                                        {(location.phone_number || location.email_address) && (
                                            <div>
                                                <h4 className="font-medium text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">Contact</h4>
                                                <div className="space-y-1.5">
                                                    {location.phone_number && (
                                                        <div className="flex items-center space-x-2">
                                                            <Phone className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                                                            <a 
                                                                href={`tel:${location.phone_number}`}
                                                                className="text-sm text-foreground hover:text-primary transition-colors"
                                                            >
                                                                {location.phone_number}
                                                            </a>
                                                        </div>
                                                    )}
                                                    {location.email_address && (
                                                        <div className="flex items-center space-x-2">
                                                            <Mail className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                                                            <a 
                                                                href={`mailto:${location.email_address}`}
                                                                className="text-sm text-foreground hover:text-primary transition-colors truncate"
                                                            >
                                                                {location.email_address}
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Operating Hours */}
                                        <div>
                                            <h4 className="font-medium text-xs text-muted-foreground mb-1.5 flex items-center space-x-2 uppercase tracking-wide">
                                                <Clock className="h-3.5 w-3.5" />
                                                <span>Hours</span>
                                            </h4>
                                            <div className="space-y-0.5 text-xs">
                                                {formatOperatingHours(location.operating_hours).map((hourString, index) => (
                                                    <p key={index} className="text-foreground leading-relaxed">
                                                        {hourString}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Call to Action */}
                    <div className="text-center mt-20">
                        <Card className="max-w-2xl mx-auto border-0 shadow-xl bg-gradient-to-br from-card to-muted/30">
                            <CardContent className="p-10">
                                <h2 className="text-3xl font-bold text-foreground mb-6">
                                    Need Directions?
                                </h2>
                                <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
                                    If you need help finding us or have questions about parking and accessibility, 
                                    please don't hesitate to contact us.
                                </p>
                                <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
                                    <p className="font-medium">
                                        Note: Hours may vary during holidays and special circumstances. 
                                        Please call ahead to confirm availability.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </PublicPortalLayout>
    );
} 