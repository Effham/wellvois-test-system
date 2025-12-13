import { Head } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, Mail, Phone, Clock } from 'lucide-react';
import { router } from '@inertiajs/react';
import OperatingHours from './OperatingHours';

interface Location {
    id: number;
    name: string;
    full_address: string;
    phone_number?: string;
    email_address?: string;
    timezone: string;
    is_active: boolean;
    operating_hours: Array<{
        day_of_week: string;
        is_enabled: boolean;
        time_slots: Array<{
            start_time: string;
            end_time: string;
        }>;
    }>;
}

interface ShowProps {
    location: Location;
    timezones: string[];
    provinces: Record<string, string[]>;
    cities: Record<string, string[]>;
}

export default function Show({ location, timezones, provinces, cities }: ShowProps) {
    return (
        <AppLayout>
            <Head title={`${location.name} - Operating Hours`} />
            
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => router.visit('/locations')}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Locations
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{location.name}</h1>
                            <p className="text-sm text-gray-600">Manage operating hours and availability</p>
                        </div>
                    </div>
                    <Badge variant={location.is_active ? "default" : "secondary"}>
                        {location.is_active ? "Active" : "Inactive"}
                    </Badge>
                </div>

                {/* Location Info Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <MapPin className="w-5 h-5 mr-2" />
                            Location Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex items-center space-x-2">
                                <MapPin className="w-4 h-4 text-gray-500" />
                                <span className="text-sm">{location.full_address}</span>
                            </div>
                            {location.phone_number && (
                                <div className="flex items-center space-x-2">
                                    <Phone className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm">{location.phone_number}</span>
                                </div>
                            )}
                            {location.email_address && (
                                <div className="flex items-center space-x-2">
                                    <Mail className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm">{location.email_address}</span>
                                </div>
                            )}
                            <div className="flex items-center space-x-2">
                                <Clock className="w-4 h-4 text-gray-500" />
                                <span className="text-sm">{location.timezone}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Operating Hours */}
                <Card>
                    <CardHeader>
                        <CardTitle>Operating Hours</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <OperatingHours location={location} />
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}