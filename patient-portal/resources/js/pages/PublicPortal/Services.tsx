import React from 'react';
import PublicPortalLayout from '@/layouts/public-portal-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Briefcase, DollarSign, Clock } from 'lucide-react';

interface Service {
    id: number;
    name: string;
    category: string;
    description: string;
    delivery_modes: string[];
    default_price: number;
    currency: string;
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
    services: Record<string, Service[]>;
}

export default function PublicPortalServices({ tenant, appearanceSettings, websiteSettings, services }: Props) {
    const formatPrice = (price: number, currency: string) => {
        if (price <= 0) return 'Contact for pricing';
        
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        
        return formatter.format(price);
    };

    const formatDeliveryModes = (modes: string[]) => {
        if (!modes || modes.length === 0) return [];
        return modes;
    };

    return (
        <PublicPortalLayout 
            title="Services" 
            tenant={tenant} 
            appearanceSettings={appearanceSettings}
            websiteSettings={websiteSettings}
        >
            <div className="py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="text-center mb-16">
                        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-8 shadow-lg">
                            <Briefcase className="h-10 w-10 text-primary" />
                        </div>
                        <h1 className="text-5xl font-bold text-foreground mb-6 tracking-tight">
                            Our Services
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                            We offer a comprehensive range of healthcare services designed to meet your health and wellness needs.
                        </p>
                    </div>

                    {/* Services by Category */}
                    {Object.keys(services).length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground text-lg">
                                No services are currently available for public viewing.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-12">
                            {Object.entries(services).map(([category, categoryServices]) => (
                                <div key={category}>
                                    <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                                        {category || 'General Services'}
                                    </h2>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {categoryServices.map((service) => (
                                            <Card key={service.id} className="hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-0 shadow-md">
                                                <CardHeader className="pb-3">
                                                    <CardTitle className="text-base leading-tight">{service.name}</CardTitle>
                                                    {service.description && (
                                                        <CardDescription className="text-xs mt-1 line-clamp-2">
                                                            {service.description}
                                                        </CardDescription>
                                                    )}
                                                </CardHeader>
                                                
                                                <CardContent className="space-y-3 pt-0">
                                                    {/* Pricing */}
                                                    <div className="flex items-center space-x-2">
                                                        <DollarSign className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                                                        <span className="font-semibold text-primary text-sm">
                                                            {formatPrice(service.default_price, service.currency)}
                                                        </span>
                                                    </div>

                                                    {/* Delivery Modes */}
                                                    {formatDeliveryModes(service.delivery_modes).length > 0 && (
                                                        <div>
                                                            <div className="flex items-center space-x-2 mb-1.5">
                                                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                                                <span className="text-xs font-medium text-muted-foreground">
                                                                    Options:
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {formatDeliveryModes(service.delivery_modes).map((mode, index) => (
                                                                    <Badge key={index} variant="secondary" className="text-xs py-0.5 px-2">
                                                                        {mode}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Call to Action */}
                    <div className="text-center mt-20">
                        <Card className="max-w-2xl mx-auto border-0 shadow-xl bg-gradient-to-br from-card to-muted/30">
                            <CardContent className="p-10">
                                <h2 className="text-3xl font-bold text-foreground mb-6">
                                    Interested in Our Services?
                                </h2>
                                <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
                                    Contact us to learn more about our services or to schedule a consultation.
                                </p>
                                <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 space-y-2">
                                    <p className="font-medium">
                                        Note: Prices may vary depending on individual needs and consultation requirements.
                                    </p>
                                    <p>
                                        Please contact us for the most current pricing and availability.
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