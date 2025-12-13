import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import PublicPortalLayout from '@/layouts/public-portal-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Users, User, Globe, Award, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import PractitionerCard from './components/PractitionerCard';

interface Practitioner {
    id: number;
    first_name: string;
    last_name: string;
    title?: string;
    slug?: string;
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
}

interface AvailableFilters {
    specialties: string[];
    modalities: string[];
    client_types: string[];
    languages: string[];
    professional_associations: string[];
}

interface CurrentFilters {
    specialties: string[];
    modalities: string[];
    client_types: string[];
    languages: string[];
    professional_associations: string[];
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
    practitioners: Practitioner[];
    availableFilters: AvailableFilters;
    currentFilters: CurrentFilters;
}

export default function PublicPortalStaff({ tenant, appearanceSettings, websiteSettings, practitioners, availableFilters, currentFilters }: Props) {
    const [filters, setFilters] = useState<CurrentFilters>(currentFilters);
    const [showFilters, setShowFilters] = useState(false);
    const [expandedFilterSections, setExpandedFilterSections] = useState({
        specialties: false,
        modalities: false,
        client_types: false,
        languages: false,
        professional_associations: false,
    });

 

    const toggleFilterSection = (section: keyof typeof expandedFilterSections) => {
        setExpandedFilterSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const handleFilterChange = (filterType: keyof CurrentFilters, value: string, checked: boolean) => {
        setFilters(prev => {
            const newFilters = { ...prev };
            if (checked) {
                if (!newFilters[filterType].includes(value)) {
                    newFilters[filterType] = [...newFilters[filterType], value];
                }
            } else {
                newFilters[filterType] = newFilters[filterType].filter(item => item !== value);
            }
            return newFilters;
        });
    };

    const clearAllFilters = () => {
        setFilters({
            specialties: [],
            modalities: [],
            client_types: [],
            languages: [],
            professional_associations: [],
        });
    };

    const applyFilters = () => {
        const queryParams = new URLSearchParams();
        
        Object.entries(filters).forEach(([key, values]) => {
            if (values.length > 0) {
                values.forEach(value => {
                    queryParams.append(key + '[]', value);
                });
            }
        });

        const newUrl = window.location.pathname + (queryParams.toString() ? '?' + queryParams.toString() : '');
        router.get(newUrl, {}, { preserveScroll: true });
    };

    const removeFilter = (filterType: keyof CurrentFilters, value: string) => {
        handleFilterChange(filterType, value, false);
        // Apply filters immediately when removing individual filters
        setTimeout(() => applyFilters(), 0);
    };

    const hasActiveFilters = Object.values(filters).some(filterArray => filterArray.length > 0);

    const getFilterCounts = () => {
        return {
            specialties: filters.specialties.length,
            modalities: filters.modalities.length,
            client_types: filters.client_types.length,
            languages: filters.languages.length,
            professional_associations: filters.professional_associations.length,
        };
    };

    const filterCounts = getFilterCounts();

    return (
        <PublicPortalLayout 
            title="Staff" 
            tenant={tenant} 
            appearanceSettings={appearanceSettings}
            websiteSettings={websiteSettings}
        >
            <div className="py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-foreground mb-2">
                            Our Healthcare Professionals
                        </h1>
                        <p className="text-muted-foreground">
                            Find the right practitioner for your needs using the filters below.
                        </p>
                    </div>

                    {/* Main Content Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Filter Sidebar - Left Side */}
                        <div className="lg:col-span-1">
                            <Card className="sticky top-8">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Filter className="h-5 w-5 text-primary" />
                                        Filter Practitioners
                                    </CardTitle>
                                    <CardDescription>
                                        Find practitioners that match your needs
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Active Filters Count */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">
                                            Showing {practitioners.length} practitioner{practitioners.length !== 1 ? 's' : ''}
                                        </span>
                                        {hasActiveFilters && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={clearAllFilters}
                                                className="text-muted-foreground hover:text-foreground"
                                            >
                                                Clear all
                                            </Button>
                                        )}
                                    </div>

                                    {/* Active Filters */}
                                    {hasActiveFilters && (
                                        <div>
                                            <Label className="text-sm font-medium mb-2 block">Active Filters:</Label>
                                            <div className="flex flex-wrap gap-2">
                                                {Object.entries(filters).map(([filterType, values]) =>
                                                    values.map(value => (
                                                        <Badge
                                                            key={`${filterType}-${value}`}
                                                            variant="secondary"
                                                            className="flex items-center gap-1 text-xs"
                                                        >
                                                            {value}
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                                                                onClick={() => removeFilter(filterType as keyof CurrentFilters, value)}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </Badge>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Specialties Filter */}
                                    {availableFilters.specialties.length > 0 && (
                                        <div>
                                            <div
                                                className="flex items-center justify-between cursor-pointer mb-3"
                                                onClick={() => toggleFilterSection('specialties')}
                                            >
                                                <Label className="font-semibold flex items-center gap-2">
                                                    <Award className="h-4 w-4 text-primary" />
                                                    Specialties
                                                    {filterCounts.specialties > 0 && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            {filterCounts.specialties}
                                                        </Badge>
                                                    )}
                                                </Label>
                                                {expandedFilterSections.specialties ? (
                                                    <ChevronUp className="h-4 w-4" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4" />
                                                )}
                                            </div>
                                            {expandedFilterSections.specialties && (
                                                <div className="space-y-2 mb-4">
                                                    {availableFilters.specialties.map(specialty => (
                                                        <div key={specialty} className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id={`specialty-${specialty}`}
                                                                checked={filters.specialties.includes(specialty)}
                                                                onCheckedChange={(checked) =>
                                                                    handleFilterChange('specialties', specialty, checked as boolean)
                                                                }
                                                            />
                                                            <Label
                                                                htmlFor={`specialty-${specialty}`}
                                                                className="text-sm font-normal cursor-pointer"
                                                            >
                                                                {specialty}
                                                            </Label>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Therapeutic Modalities Filter */}
                                    {availableFilters.modalities.length > 0 && (
                                        <div>
                                            <Separator />
                                            <div
                                                className="flex items-center justify-between cursor-pointer mb-3 mt-3"
                                                onClick={() => toggleFilterSection('modalities')}
                                            >
                                                <Label className="font-semibold flex items-center gap-2">
                                                    <User className="h-4 w-4 text-primary" />
                                                    Modalities
                                                    {filterCounts.modalities > 0 && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            {filterCounts.modalities}
                                                        </Badge>
                                                    )}
                                                </Label>
                                                {expandedFilterSections.modalities ? (
                                                    <ChevronUp className="h-4 w-4" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4" />
                                                )}
                                            </div>
                                            {expandedFilterSections.modalities && (
                                                <div className="space-y-2 mb-4">
                                                    {availableFilters.modalities.map(modality => (
                                                        <div key={modality} className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id={`modality-${modality}`}
                                                                checked={filters.modalities.includes(modality)}
                                                                onCheckedChange={(checked) =>
                                                                    handleFilterChange('modalities', modality, checked as boolean)
                                                                }
                                                            />
                                                            <Label
                                                                htmlFor={`modality-${modality}`}
                                                                className="text-sm font-normal cursor-pointer"
                                                            >
                                                                {modality}
                                                            </Label>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Client Types Filter */}
                                    {availableFilters.client_types.length > 0 && (
                                        <div>
                                            <Separator />
                                            <div
                                                className="flex items-center justify-between cursor-pointer mb-3 mt-3"
                                                onClick={() => toggleFilterSection('client_types')}
                                            >
                                                <Label className="font-semibold flex items-center gap-2">
                                                    <Users className="h-4 w-4 text-primary" />
                                                    Client Types
                                                    {filterCounts.client_types > 0 && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            {filterCounts.client_types}
                                                        </Badge>
                                                    )}
                                                </Label>
                                                {expandedFilterSections.client_types ? (
                                                    <ChevronUp className="h-4 w-4" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4" />
                                                )}
                                            </div>
                                            {expandedFilterSections.client_types && (
                                                <div className="space-y-2 mb-4">
                                                    {availableFilters.client_types.map(clientType => (
                                                        <div key={clientType} className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id={`client-type-${clientType}`}
                                                                checked={filters.client_types.includes(clientType)}
                                                                onCheckedChange={(checked) =>
                                                                    handleFilterChange('client_types', clientType, checked as boolean)
                                                                }
                                                            />
                                                            <Label
                                                                htmlFor={`client-type-${clientType}`}
                                                                className="text-sm font-normal cursor-pointer"
                                                            >
                                                                {clientType}
                                                            </Label>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Languages Filter */}
                                    {availableFilters.languages.length > 0 && (
                                        <div>
                                            <Separator />
                                            <div
                                                className="flex items-center justify-between cursor-pointer mb-3 mt-3"
                                                onClick={() => toggleFilterSection('languages')}
                                            >
                                                <Label className="font-semibold flex items-center gap-2">
                                                    <Globe className="h-4 w-4 text-primary" />
                                                    Languages
                                                    {filterCounts.languages > 0 && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            {filterCounts.languages}
                                                        </Badge>
                                                    )}
                                                </Label>
                                                {expandedFilterSections.languages ? (
                                                    <ChevronUp className="h-4 w-4" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4" />
                                                )}
                                            </div>
                                            {expandedFilterSections.languages && (
                                                <div className="space-y-2 mb-4">
                                                    {availableFilters.languages.map(language => (
                                                        <div key={language} className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id={`language-${language}`}
                                                                checked={filters.languages.includes(language)}
                                                                onCheckedChange={(checked) =>
                                                                    handleFilterChange('languages', language, checked as boolean)
                                                                }
                                                            />
                                                            <Label
                                                                htmlFor={`language-${language}`}
                                                                className="text-sm font-normal cursor-pointer"
                                                            >
                                                                {language}
                                                            </Label>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Professional Associations Filter */}
                                    {availableFilters.professional_associations.length > 0 && (
                                        <div>
                                            <Separator />
                                            <div
                                                className="flex items-center justify-between cursor-pointer mb-3 mt-3"
                                                onClick={() => toggleFilterSection('professional_associations')}
                                            >
                                                <Label className="font-semibold flex items-center gap-2">
                                                    <Award className="h-4 w-4 text-primary" />
                                                    Associations
                                                    {filterCounts.professional_associations > 0 && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            {filterCounts.professional_associations}
                                                        </Badge>
                                                    )}
                                                </Label>
                                                {expandedFilterSections.professional_associations ? (
                                                    <ChevronUp className="h-4 w-4" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4" />
                                                )}
                                            </div>
                                            {expandedFilterSections.professional_associations && (
                                                <div className="space-y-2 mb-4">
                                                    {availableFilters.professional_associations.map(association => (
                                                        <div key={association} className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id={`association-${association}`}
                                                                checked={filters.professional_associations.includes(association)}
                                                                onCheckedChange={(checked) =>
                                                                    handleFilterChange('professional_associations', association, checked as boolean)
                                                                }
                                                            />
                                                            <Label
                                                                htmlFor={`association-${association}`}
                                                                className="text-sm font-normal cursor-pointer"
                                                            >
                                                                {association}
                                                            </Label>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Apply Filters Button */}
                                    <Button onClick={applyFilters} className="w-full">
                                        Apply Filters
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Practitioners List - Right Side */}
                        <div className="lg:col-span-3">

                            {/* Practitioners */}
                            {practitioners.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-muted-foreground text-lg">
                                        {hasActiveFilters 
                                            ? "No practitioners match your selected criteria. Try adjusting your filters."
                                            : "No staff information is currently available for public viewing."
                                        }
                                    </p>
                                </div>
                            ) : (
                              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
  {practitioners.map((practitioner) => (
    <div key={practitioner.id} className="h-full">
      <PractitionerCard
        practitioner={practitioner}
        onLearnMore={(p) => router.visit(`/explore/staff/${p.slug}`)}
        maxBioChars={160} // tweak if you want
      />
    </div>
  ))}


  {/* {[...practitioners, ...practitioners, ...practitioners, ...practitioners, ...practitioners]
  .slice(0, 10) // just in case it exceeds 10
  .map((practitioner, index) => (
    <div key={`${practitioner.id}-${index}`} className="h-full">
      <PractitionerCard
        practitioner={practitioner}
        onLearnMore={(p) => router.visit(`/explore/staff/${p.slug}`)}
        maxBioChars={160}
      />
    </div>
))} */}

</div>

                            )}

                            {/* Call to Action */}
                            {practitioners.length > 0 && (
                                <div className="text-center mt-12">
                                    <Card>
                                        <CardContent className="p-6">
                                            <h2 className="text-xl font-bold text-foreground mb-3">
                                                Ready to Get Started?
                                            </h2>
                                            <p className="text-muted-foreground mb-4">
                                                Schedule an appointment with one of our qualified professionals.
                                            </p>
                                            <Button size="lg" className="bg-primary hover:bg-primary/90">
                                                Book Appointment
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </PublicPortalLayout>
    );
} 