import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useForm } from '@inertiajs/react';
import { FormEventHandler, useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

interface Practitioner {
    id: number;
    first_name: string;
    last_name: string;
    full_name: string;
    display_name: string;
    title: string;
    email: string;
    is_assigned: boolean;
    profile_picture_url?: string;
}

interface PractitionersTabProps {
    location?: any;
    practitioners?: Practitioner[];
    onSave?: (practitioners: Practitioner[]) => void;
    onTabChange?: (tab: string) => void;
}

export default function PractitionersTab({ location, practitioners = [], onSave, onTabChange }: PractitionersTabProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [specialtyFilter, setSpecialtyFilter] = useState('all_specialties');
    const [statusFilter, setStatusFilter] = useState('all_status');
    const [locationFilter, setLocationFilter] = useState('all_locations');
    const [practitionersData, setPractitionersData] = useState<Practitioner[]>([]);
    const [loading, setLoading] = useState(false);

    const { data, setData, post, processing } = useForm({
        practitioners: practitionersData.map(p => ({
            id: p.id,
            is_assigned: p.is_assigned
        }))
    });

    // Load practitioners when component mounts or location changes
    useEffect(() => {
        loadPractitioners();
    }, [location?.id]);

    const loadPractitioners = async () => {
        setLoading(true);
        try {
            if (location?.id) {
                // Load practitioners for existing location
                const response = await axios.get(route('locations.practitioners.get', location.id));
                setPractitionersData(response.data.practitioners);
            } else {
                // For new locations, load all practitioners with no assignments
                const response = await axios.get(route('locations.practitioners.all'));
                setPractitionersData(response.data.practitioners);
            }
        } catch (error) {
            console.error('Error loading practitioners:', error);
            // Fallback to empty array
            setPractitionersData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setData('practitioners', practitionersData.map(p => ({
            id: p.id,
            is_assigned: p.is_assigned
        })));
    }, [practitionersData]);

    const toggleAssignment = (practitionerId: number) => {
        const practitioner = practitionersData.find(p => p.id === practitionerId);
        const wasAssigned = practitioner?.is_assigned;

        const newPractitioners = practitionersData.map(p =>
            p.id === practitionerId
                ? { ...p, is_assigned: !p.is_assigned }
                : p
        );
        setPractitionersData(newPractitioners);

        // Show success message immediately
        if (wasAssigned) {
            toast.success('Practitioner unassigned successfully!');
        } else {
            toast.success('Practitioner assigned successfully!');
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const filteredPractitioners = practitionersData.filter(practitioner => {
        const matchesSearch = 
            practitioner.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            practitioner.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            practitioner.title.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = !statusFilter || statusFilter === 'all_status' ||
            (statusFilter === 'assigned' && practitioner.is_assigned) ||
            (statusFilter === 'unassigned' && !practitioner.is_assigned);

        return matchesSearch && matchesStatus;
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        console.log('🔷 [PractitionersTab] Submit function called');
        console.log('🔷 [PractitionersTab] Form data:', data);
        console.log('🔷 [PractitionersTab] Practitioners data:', practitionersData);
        console.log('🔷 [PractitionersTab] Location:', location);
        console.log('🔷 [PractitionersTab] Processing state:', processing);

        if (!location?.id) {
            console.warn('⚠️ [PractitionersTab] No location ID - saving practitioners for new location');
            // For new locations, just call onSave with the current practitioners data
            if (onSave) {
                console.log('🔷 [PractitionersTab] Calling onSave callback for new location');
                onSave(practitionersData);
            }
            return;
        }

        const updateRoute = route('locations.practitioners.update', location.id);
        console.log('🔷 [PractitionersTab] Update route:', updateRoute);
        console.log('🔷 [PractitionersTab] Location ID:', location.id);

        post(updateRoute, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: (page) => {
                console.log('✅ [PractitionersTab] Update successful');
                console.log('✅ [PractitionersTab] Response page:', page);
                // Toast will be shown by parent component via flash message
                if (onSave) {
                    console.log('🔷 [PractitionersTab] Calling onSave callback');
                    const updatedPractitioners = (page.props?.practitioners && Array.isArray(page.props.practitioners)) 
                        ? page.props.practitioners 
                        : practitionersData;
                    onSave(updatedPractitioners);
                }
            },
            onError: (errors) => {
                console.error('❌ [PractitionersTab] Update failed');
                console.error('❌ [PractitionersTab] Errors:', errors);
                const errorMessages = Object.values(errors).flat();
                const errorMessage = (Array.isArray(errorMessages) && errorMessages.length > 0) 
                    ? String(errorMessages[0]) 
                    : 'Failed to update practitioners. Please try again.';
                toast.error('Update failed', {
                    description: errorMessage
                });
            }
        });
    };

    return (
        <>
        <form onSubmit={submit}>
            <div className="px-6 py-4">
                {/* Search and Filters */}
                <div className="mb-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                type="text"
                                placeholder="Search"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Specialty" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all_specialties">All Specialties</SelectItem>
                                <SelectItem value="therapist">Therapist</SelectItem>
                                <SelectItem value="psychologist">Psychologist</SelectItem>
                                <SelectItem value="counselor">Counselor</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all_status">All Status</SelectItem>
                                <SelectItem value="assigned">Assigned</SelectItem>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={locationFilter} onValueChange={setLocationFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Location" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all_locations">All Locations</SelectItem>
                                <SelectItem value="downtown">Downtown Clinic</SelectItem>
                                <SelectItem value="virtual">Virtual Practice</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Practitioners Table */}
                <div className="border rounded-lg">
                    <div className="bg-gray-50 px-6 py-3 border-b">
                        <div className="grid gap-4 font-medium text-sm text-gray-700" style={{ gridTemplateColumns: '60px 80px 1fr 120px 2fr 100px' }}>
                            <div>ID</div>
                            <div>Profile</div>
                            <div>Name</div>
                            <div>Title</div>
                            <div>Email Address</div>
                            <div>Assign</div>
                        </div>
                    </div>

                    <div className="divide-y max-h-[500px] overflow-y-auto">
                        {!loading && filteredPractitioners.map((practitioner, index) => (
                            <div key={practitioner.id} className="px-6 py-4">
                                <div className="grid gap-4 items-center" style={{ gridTemplateColumns: '60px 80px 1fr 120px 2fr 100px' }}>
                                    <div className="text-sm text-gray-900">
                                        {practitioner.id}
                                    </div>

                                    <div>
                                        <Avatar className="h-8 w-8">
                                            {practitioner.profile_picture_url && (
                                                <img 
                                                    src={practitioner.profile_picture_url} 
                                                    alt={practitioner.full_name}
                                                    className="h-full w-full object-cover"
                                                />
                                            )}
                                            <AvatarFallback className="bg-gray-200">
                                                {getInitials(practitioner.full_name)}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>

                                    <div className="text-sm text-gray-900">
                                        {practitioner.display_name}
                                    </div>

                                    <div className="text-sm text-gray-900">
                                        {practitioner.title}
                                    </div>

                                    <div className="text-sm text-gray-900">
                                        {practitioner.email}
                                    </div>

                                    <div>
                                        <label className="inline-flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={practitioner.is_assigned}
                                                onChange={() => toggleAssignment(practitioner.id)}
                                                className="sr-only"
                                            />
                                            <div className={`relative inline-block w-10 h-6 rounded-full transition-colors duration-200 ease-in-out ${
                                                practitioner.is_assigned ? 'bg-green-600' : 'bg-gray-300'
                                            }`}>
                                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out ${
                                                    practitioner.is_assigned ? 'transform translate-x-4' : ''
                                                }`} />
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {loading && (
                        <div className="px-6 py-8 text-center text-gray-500">
                            Loading practitioners...
                        </div>
                    )}

                    {!loading && filteredPractitioners.length === 0 && (
                        <div className="px-6 py-8 text-center text-gray-500">
                            No practitioners found matching your criteria.
                        </div>
                    )}
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-6">
                    <Button
                        type="submit"
                        disabled={processing}
                        size="save"
                        onClick={() => {
                            console.log('🔷 [PractitionersTab] Save button clicked');
                            console.log('🔷 [PractitionersTab] Button disabled:', processing);
                            console.log('🔷 [PractitionersTab] Processing:', processing);
                        }}
                    >
                        {processing ? 'Saving...' : 'Save'}
                    </Button>
                </div>
            </div>
        </form>
        <Toaster position="top-right" />
    </>
    );
} 