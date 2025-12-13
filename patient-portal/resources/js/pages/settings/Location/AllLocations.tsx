import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronRight, Trash2, Archive } from 'lucide-react';
import { useState, useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import { toast } from 'sonner';

interface Location {
    id: number;
    name: string;
    city: string;
    province: string;
    timezone: string;
    is_active: boolean;
    status: string;
    full_address?: string;
    phone_number?: string;
    email_address?: string;
    practitioners_count?: number;
    operating_hours_count?: number;
}

interface AllLocationsProps {
    locations: Location[];
    onAddLocation: () => void;
    onEditLocation: (location: Location) => void;
    flash?: {
        success?: string;
        error?: string;
    };
}

export default function AllLocations({ locations, onAddLocation, onEditLocation }: AllLocationsProps) {
    const [showArchiveModal, setShowArchiveModal] = useState(false);
    const [locationToArchive, setLocationToArchive] = useState<Location | null>(null);
    const { flash } = usePage().props as { flash?: { success?: string; error?: string } };

    // Show flash messages as toasts
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    const handleArchiveLocation = () => {
        if (locationToArchive) {
            router.delete(route('locations.destroy', locationToArchive.id), {
                preserveState: false,
                onSuccess: () => {
                    setShowArchiveModal(false);
                    setLocationToArchive(null);
                }
            });
        }
    };

    return (
        <div className="p-2 sm:p-4">
            <div className="bg-white rounded-lg w-full">
                <div className="px-3 sm:px-6 py-3 sm:py-4">
                    <div className="space-y-4 sm:space-y-6">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">All Locations</h2>
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                                <Button 
                                    onClick={() => router.get('/locations-archived')}
                                    variant="outline"
                                    className="h-10 sm:h-[44px] text-sm bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                                >
                                    <Archive className="w-4 h-4 sm:mr-2" />
                                    <span className="hidden sm:inline">View Archived</span>
                                </Button>
                                <Button 
                                    onClick={onAddLocation}
                                    variant="outline"
                                    className="h-10 sm:h-[44px] text-sm bg-white text-sidebar-accent border-sidebar-accent hover:bg-sidebar-accent/10"
                                >
                                    <span>Add Location</span>
                                </Button>
                            </div>
                        </div>

                        {/* Locations Table */}
                        <div className="border rounded-lg overflow-hidden">
                            {/* Horizontal scroll container */}
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[700px]">
                                    {/* Table Header */}
                                    <thead>
                                        <tr className="bg-gray-50 border-b">
                                            <th className="px-6 py-3 text-left text-sm font-medium text-gray-700 min-w-[200px]">
                                                Location 
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 min-w-[120px]">
                                                City
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 min-w-[120px]">
                                                Province
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 min-w-[150px]">
                                                Timezone
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 min-w-[120px]">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-right text-sm font-medium text-gray-700 w-[120px]">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>

                                    {/* Table Body */}
                                    <tbody className="divide-y divide-gray-200">
                                        {locations.map((location) => (
                                            <tr key={location.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                    <div className="truncate" title={location.name}>
                                                        {location.name}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4 text-sm text-gray-900">
                                                    <div className="truncate" title={location.city}>
                                                        {location.city}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4 text-sm text-gray-900">
                                                    <div className="truncate" title={location.province}>
                                                        {location.province}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4 text-sm text-gray-900">
                                                    <div className="truncate" title={location.timezone}>
                                                        {location.timezone.replace('America/', '').replace('_', ' ')}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4">
                                                    <Badge 
                                                        variant={location.is_active ? "default" : "secondary"}
                                                        className={location.is_active 
                                                            ? "bg-green-100 text-green-800 hover:bg-green-100" 
                                                            : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                                                        }
                                                    >
                                                        <div className={`w-2 h-2 rounded-full mr-2 ${
                                                            location.is_active ? 'bg-green-600' : 'bg-gray-400'
                                                        }`} />
                                                        {location.status}
                                                    </Badge>
                                                </td>

                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => onEditLocation(location)}
                                                            className="text-gray-400 hover:text-gray-600"
                                                            title="Edit location"
                                                        >
                                                            <ChevronRight className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setLocationToArchive(location);
                                                                setShowArchiveModal(true);
                                                            }}
                                                            title="Archive location"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Empty State */}
                            {locations.length === 0 && (
                                <div className="px-6 py-8 text-center">
                                    <div className="text-gray-500 mb-4">
                                        <div className="mx-auto w-12 h-12 mb-3">
                                            <svg
                                                className="w-full h-full text-gray-300"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={1}
                                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                                />
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={1}
                                                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                                />
                                            </svg>
                                        </div>
                                        <h3 className="text-base font-medium text-gray-900 mb-2">No locations found</h3>
                                        <p className="text-sm text-gray-500">Get started by adding your first location using the button above.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Summary Stats */}
                        {locations.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* <div className="bg-white p-4 rounded-lg border">
                                    <div className="text-sm font-medium text-gray-500">Total Locations</div>
                                    <div className="text-2xl font-bold text-gray-900">{locations.length}</div>
                                </div>
                                <div className="bg-white p-4 rounded-lg border">
                                    <div className="text-sm font-medium text-gray-500">Active Locations</div>
                                    <div className="text-2xl font-bold text-green-600">
                                        {locations.filter(l => l.is_active).length}
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-lg border">
                                    <div className="text-sm font-medium text-gray-500">Total Practitioners</div>
                                    <div className="text-2xl font-bold text-purple-600">
                                        {locations.reduce((sum, l) => sum + (l.practitioners_count || 0), 0)}
                                    </div>
                                </div> */}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Archive Confirmation Modal */}
            <Dialog open={showArchiveModal} onOpenChange={setShowArchiveModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Trash2 className="w-5 h-5 text-orange-600" />
                            Archive Location
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to archive "{locationToArchive?.name}"? This will remove it from the active locations list, but you can restore it later if needed.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowArchiveModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleArchiveLocation} className="bg-orange-600 hover:bg-orange-700">
                            Archive Location
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
} 