import { Head, usePage, router } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { 
    User, 
    Calendar, 
    Phone, 
    Mail, 
    MapPin,
    Heart,
    Shield,
    AlertTriangle,
    Activity,
    FileText,
    Edit,
    Save,
    X,
    Plus,
    Trash2,
    CreditCard,
} from 'lucide-react';
import { withAppLayout } from '@/utils/layout';
import { useState } from 'react';
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface PatientMyDetailsProps {
    patient?: any;
    medicalData?: {
        family_medical_histories: any[];
        patient_medical_histories: any[];
        known_allergies: any[];
    };
    summary?: {
        family_histories_count: number;
        patient_histories_count: number;
        allergies_count: number;
        has_severe_allergies: boolean;
    };
    userRole: string;
    error?: string;
}

function Index() {
    const page = usePage();
    const { patient, medicalData, summary, userRole, error }: PatientMyDetailsProps = page.props as any;
    const { tenancy }: any = page.props;
    
    const [activeTab, setActiveTab] = useState('overview');
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [formData, setFormData] = useState<any>({});
    
    // Determine if we're in central context
    const isCentral = tenancy?.is_central || false;

    // Helper function to get severity badge color
    const getSeverityBadge = (severity: string) => {
        const colors = {
            mild: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            moderate: 'bg-orange-100 text-orange-800 border-orange-200',
            severe: 'bg-red-100 text-red-800 border-red-200'
        };
        return colors[severity as keyof typeof colors] || colors.mild;
    };

    // Handle form submission for medical history updates
    const handleSubmit = (type: string) => {
        // Use different endpoints based on context
        const baseUrl = isCentral ? '/central/my-details' : '/my-details';
        const endpoint = `${baseUrl}/${type}`;
        
        // Convert endpoint type (with hyphens) to backend parameter name (with underscores)
        const parameterName = type.replace(/-/g, '_');
        
        console.log('=== FRONTEND SUBMITTING ===', {
            type,
            parameterName,
            isCentral,
            baseUrl,
            endpoint,
            formData: formData[parameterName] || [],
            tenancy
        });
        
        router.put(endpoint, {
            [parameterName]: formData[parameterName] || [],
        }, {
            preserveScroll: true,
            onStart: () => {
                console.log('=== REQUEST STARTED ===', { endpoint });
            },
            onProgress: (progress) => {
                console.log('=== REQUEST PROGRESS ===', { endpoint, progress });
            },
            onSuccess: (page) => {
                console.log('=== REQUEST SUCCESS ===', { endpoint, page });
                setIsEditing(null);
                setFormData({});
                
                // Show success message based on the medical history type
                const typeMessages = {
                    'family-medical-histories': 'Family medical history updated successfully!',
                    'patient-medical-histories': 'Patient medical history updated successfully!',
                    'known-allergies': 'Known allergies updated successfully!'
                };
                
                const message = typeMessages[type as keyof typeof typeMessages] || 'Medical information updated successfully!';
                toast.success(message, {
                    description: 'Your medical information has been saved.',
                    duration: 4000,
                });
            },
            onError: (errors) => {
                console.log('=== REQUEST ERROR ===', { endpoint, errors });
                
                // Show error message based on the medical history type
                const typeMessages = {
                    'family-medical-histories': 'Failed to update family medical history',
                    'patient-medical-histories': 'Failed to update patient medical history',
                    'known-allergies': 'Failed to update known allergies'
                };
                
                const message = typeMessages[type as keyof typeof typeMessages] || 'Failed to update medical information';
                toast.error(message, {
                    description: 'Please check your information and try again.',
                    duration: 5000,
                });
            },
            onFinish: () => {
                console.log('=== REQUEST FINISHED ===', { endpoint });
            },
        });
    };

    // Handle adding new entries
    const handleAddEntry = (type: string, defaultEntry: any) => {
        const current = formData[type] || (safeMedicalData as any)[type] || [];
        setFormData({
            ...formData,
            [type]: [...current, defaultEntry]
        });
    };

    // Handle removing entries
    const handleRemoveEntry = (type: string, index: number) => {
        const current = formData[type] || (safeMedicalData as any)[type] || [];
        setFormData({
            ...formData,
            [type]: current.filter((_: any, i: number) => i !== index)
        });
    };

    // Start editing a section
    const startEditing = (type: string) => {
        setIsEditing(type);
        setFormData({
            ...formData,
            [type]: (safeMedicalData as any)[type] || []
        });
    };

    // Cancel editing
    const cancelEditing = () => {
        setIsEditing(null);
        setFormData({});
    };

    if (error && !patient) {
        return (
            <>
                <Head title="My Details" />
                <div className="p-4">
                    <Card>
                        <CardContent className="text-center py-12">
                            <AlertTriangle className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load Patient Details</h3>
                            <p className="text-gray-500">{error || 'Patient information could not be found.'}</p>
                        </CardContent>
                    </Card>
                </div>
                <Toaster />
            </>
        );
    }

    // If patient exists but no medical data, show empty forms
    const safePatient = patient || {
        preferred_name: '',
        first_name: 'Unknown',
        last_name: 'Patient',
        health_number: 'N/A',
        email: 'N/A',
        phone_number: 'N/A',
        date_of_birth: 'N/A',
        emergency_contact_phone: 'N/A',
        insurance_provider: '',
        policy_number: '',
        coverage_card_path: ''
    };

    const safeMedicalData = medicalData || {
        family_medical_histories: [],
        patient_medical_histories: [],
        known_allergies: [],
    };

    const safeSummary = summary || {
        family_histories_count: 0,
        patient_histories_count: 0,
        allergies_count: 0,
        has_severe_allergies: false,
    };

    return (
        <>
            <Head title="My Details" />
            <div className="p-4 space-y-6 bg-gradient-to-br from-gray-50 to-white min-h-screen">
                
                {/* Header Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-100 rounded-full">
                                <User className="w-8 h-8 text-blue-600" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                                    {safePatient.preferred_name || safePatient.first_name} {safePatient.last_name}
                                </h1>
                                <p className="text-gray-600 text-sm">
                                    Patient Dashboard • Health #: {safePatient.health_number}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => router.visit('/patient-dashboard')}>
                                <Activity className="w-4 h-4 mr-2" />
                                Dashboard
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6">
                        {[
                            { id: 'overview', label: 'Overview', icon: FileText },
                            { id: 'family-medical', label: 'Family History', icon: Heart },
                            { id: 'patient-medical', label: 'Medical History', icon: Activity },
                            { id: 'allergies', label: 'Allergies', icon: Shield },
                        ].map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                        activeTab === tab.id
                                            ? 'bg-white text-blue-600 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Contents */}
                    <AnimatePresence mode="wait">
                        {activeTab === 'overview' && (
                            <motion.div
                                key="overview"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-6"
                            >
                                {/* Quick Stats */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <Card>
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3">
                                                <Heart className="w-8 h-8 text-pink-500" />
                                                <div>
                                                    <p className="text-2xl font-bold text-gray-900">{safeSummary.family_histories_count}</p>
                                                    <p className="text-sm text-gray-600">Family Histories</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    
                                    <Card>
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3">
                                                <Activity className="w-8 h-8 text-blue-500" />
                                                <div>
                                                    <p className="text-2xl font-bold text-gray-900">{safeSummary.patient_histories_count}</p>
                                                    <p className="text-sm text-gray-600">Medical Histories</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    
                                    <Card>
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3">
                                                <Shield className={`w-8 h-8 ${safeSummary.has_severe_allergies ? 'text-red-500' : 'text-green-500'}`} />
                                                <div>
                                                    <p className="text-2xl font-bold text-gray-900">{safeSummary.allergies_count}</p>
                                                    <p className="text-sm text-gray-600">Known Allergies</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3">
                                                <User className="w-8 h-8 text-purple-500" />
                                                <div>
                                                    <p className="text-2xl font-bold text-gray-900">Active</p>
                                                    <p className="text-sm text-gray-600">Profile Status</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Patient Information */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <User className="w-5 h-5" />
                                            Personal Information
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <div>
                                                    <Label className="text-sm font-medium text-gray-700">Full Name</Label>
                                                    <p className="text-gray-900">{safePatient.first_name} {safePatient.last_name}</p>
                                                </div>
                                                <div>
                                                    <Label className="text-sm font-medium text-gray-700">Email</Label>
                                                    <p className="text-gray-900">{safePatient.email}</p>
                                                </div>
                                                <div>
                                                    <Label className="text-sm font-medium text-gray-700">Phone</Label>
                                                    <p className="text-gray-900">{safePatient.phone_number}</p>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <Label className="text-sm font-medium text-gray-700">Date of Birth</Label>
                                                    <p className="text-gray-900">{safePatient.date_of_birth}</p>
                                                </div>
                                                <div>
                                                    <Label className="text-sm font-medium text-gray-700">Health Number</Label>
                                                    <p className="text-gray-900">{safePatient.health_number}</p>
                                                </div>
                                                <div>
                                                    <Label className="text-sm font-medium text-gray-700">Emergency Contact</Label>
                                                    <p className="text-gray-900">{safePatient.emergency_contact_phone}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Insurance Information */}
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="flex items-center gap-2">
                                                <CreditCard className="w-5 h-5" />
                                                Insurance Information
                                            </CardTitle>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => router.visit(route('central.my-details.health-history'))}
                                            >
                                                <Edit className="w-4 h-4 mr-2" />
                                                Edit Health History
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <Label className="text-sm font-medium text-gray-700">Insurance Provider</Label>
                                                    <p className="text-gray-900">{safePatient.insurance_provider || 'Not provided'}</p>
                                                </div>
                                                <div>
                                                    <Label className="text-sm font-medium text-gray-700">Policy Number</Label>
                                                    <p className="text-gray-900">{safePatient.policy_number || 'Not provided'}</p>
                                                </div>
                                            </div>

                                            {/* Coverage Card */}
                                            {safePatient.coverage_card_path && (
                                                <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                                                    <Label className="text-sm font-medium text-gray-700 mb-2 block">Coverage Card</Label>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={async () => {
                                                            try {
                                                                // Request a signed URL from the API
                                                                const response = await fetch(`/api/storage/signed-url?key=${encodeURIComponent(safePatient.coverage_card_path)}&expires_minutes=60`, {
                                                                    headers: {
                                                                        'Accept': 'application/json',
                                                                        'X-Requested-With': 'XMLHttpRequest',
                                                                    }
                                                                });

                                                                if (!response.ok) throw new Error('Failed to get signed URL');

                                                                const { url } = await response.json();
                                                                window.open(url, '_blank');
                                                            } catch (error) {
                                                                console.error('Error opening coverage card:', error);
                                                                toast.error('Unable to view coverage card');
                                                            }
                                                        }}
                                                        className="text-sidebar-accent"
                                                    >
                                                        View Coverage Card →
                                                    </Button>
                                                </div>
                                            )}

                                            {!safePatient.insurance_provider && !safePatient.policy_number && !safePatient.coverage_card_path && (
                                                <div className="text-center py-8">
                                                    <CreditCard className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                                    <p className="text-gray-500 mb-3">No insurance information on file</p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => router.visit(route('central.my-details.health-history'))}
                                                    >
                                                        Add Insurance Information
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {/* Family Medical History Tab Content */}
                        {activeTab === 'family-medical' && (
                            <motion.div
                                key="family-medical"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.2 }}
                            >
                                <FamilyMedicalHistorySection
                                    data={safeMedicalData.family_medical_histories}
                                    isEditing={isEditing === 'family_medical_histories'}
                                    formData={formData.family_medical_histories || []}
                                    onEdit={() => startEditing('family_medical_histories')}
                                    onCancel={cancelEditing}
                                    onSubmit={() => handleSubmit('family-medical-histories')}
                                    onAddEntry={() => handleAddEntry('family_medical_histories', {
                                        relationship_to_patient: '',
                                        summary: '',
                                        details: '',
                                        diagnosis_date: ''
                                    })}
                                    onRemoveEntry={(index: number) => handleRemoveEntry('family_medical_histories', index)}
                                    onUpdateEntry={(index: number, field: string, value: any) => {
                                        const updated = [...(formData.family_medical_histories || [])];
                                        updated[index] = { ...updated[index], [field]: value };
                                        setFormData({ ...formData, family_medical_histories: updated });
                                    }}
                                />
                            </motion.div>
                        )}

                        {/* Patient Medical History Tab Content */}
                        {activeTab === 'patient-medical' && (
                            <motion.div
                                key="patient-medical"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.2 }}
                            >
                                <PatientMedicalHistorySection
                                    data={safeMedicalData.patient_medical_histories}
                                    isEditing={isEditing === 'patient_medical_histories'}
                                    formData={formData.patient_medical_histories || []}
                                    onEdit={() => startEditing('patient_medical_histories')}
                                    onCancel={cancelEditing}
                                    onSubmit={() => handleSubmit('patient-medical-histories')}
                                    onAddEntry={() => handleAddEntry('patient_medical_histories', {
                                        disease: '',
                                        recent_tests: ''
                                    })}
                                    onRemoveEntry={(index: number) => handleRemoveEntry('patient_medical_histories', index)}
                                    onUpdateEntry={(index: number, field: string, value: any) => {
                                        const updated = [...(formData.patient_medical_histories || [])];
                                        updated[index] = { ...updated[index], [field]: value };
                                        setFormData({ ...formData, patient_medical_histories: updated });
                                    }}
                                />
                            </motion.div>
                        )}

                        {/* Known Allergies Tab Content */}
                        {activeTab === 'allergies' && (
                            <motion.div
                                key="allergies"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.2 }}
                            >
                                <KnownAllergiesSection
                                    data={safeMedicalData.known_allergies}
                                    isEditing={isEditing === 'known_allergies'}
                                    formData={formData.known_allergies || []}
                                    onEdit={() => startEditing('known_allergies')}
                                    onCancel={cancelEditing}
                                    onSubmit={() => handleSubmit('known-allergies')}
                                    onAddEntry={() => handleAddEntry('known_allergies', {
                                        allergens: '',
                                        type: '',
                                        severity: '',
                                        reaction: '',
                                        notes: ''
                                    })}
                                    onRemoveEntry={(index: number) => handleRemoveEntry('known_allergies', index)}
                                    onUpdateEntry={(index: number, field: string, value: any) => {
                                        const updated = [...(formData.known_allergies || [])];
                                        updated[index] = { ...updated[index], [field]: value };
                                        setFormData({ ...formData, known_allergies: updated });
                                    }}
                                    getSeverityBadge={getSeverityBadge}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
            <Toaster />
        </>
    );
}

export default withAppLayout(Index, {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'My Details', href: '/patient/my-details' }
    ]
});

// Family Medical History Section Component
function FamilyMedicalHistorySection({ data, isEditing, formData, onEdit, onCancel, onSubmit, onAddEntry, onRemoveEntry, onUpdateEntry }: any) {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <Heart className="w-5 h-5 text-pink-500" />
                        Family Medical History
                    </CardTitle>
                    {!isEditing && (
                        <Button variant="outline" size="sm" onClick={onEdit}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {isEditing ? (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-medium">Edit Family Medical History</h4>
                            <Button variant="outline" size="sm" onClick={onAddEntry}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Entry
                            </Button>
                        </div>
                        
                        {formData.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No family medical history entries. Click "Add Entry" to get started.</p>
                        ) : (
                            <div className="space-y-4">
                                {formData.map((entry: any, index: number) => (
                                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                        <div className="flex justify-between items-start mb-4">
                                            <h5 className="font-medium">Family History #{index + 1}</h5>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onRemoveEntry(index)}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Relationship to Patient *</Label>
                                                <Select
                                                    value={entry.relationship_to_patient}
                                                    onValueChange={(value) => onUpdateEntry(index, 'relationship_to_patient', value)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select relationship" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="mother">Mother</SelectItem>
                                                        <SelectItem value="father">Father</SelectItem>
                                                        <SelectItem value="sibling">Sibling</SelectItem>
                                                        <SelectItem value="grandparent">Grandparent</SelectItem>
                                                        <SelectItem value="aunt_uncle">Aunt/Uncle</SelectItem>
                                                        <SelectItem value="cousin">Cousin</SelectItem>
                                                        <SelectItem value="other">Other</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Diagnosis Date</Label>
                                                <Input
                                                    type="date"
                                                    value={entry.diagnosis_date}
                                                    onChange={(e) => onUpdateEntry(index, 'diagnosis_date', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2 lg:col-span-2">
                                                <Label>Condition/Summary *</Label>
                                                <Input
                                                    value={entry.summary}
                                                    onChange={(e) => onUpdateEntry(index, 'summary', e.target.value)}
                                                    placeholder="e.g., Diabetes Type 2"
                                                />
                                            </div>
                                            <div className="space-y-2 lg:col-span-2">
                                                <Label>Additional Details</Label>
                                                <Textarea
                                                    value={entry.details}
                                                    onChange={(e) => onUpdateEntry(index, 'details', e.target.value)}
                                                    placeholder="Additional details about the condition..."
                                                    rows={3}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button variant="outline" onClick={onCancel}>
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                            </Button>
                            <Button onClick={onSubmit}>
                                <Save className="w-4 h-4 mr-2" />
                                Save Changes
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div>
                        {data.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No family medical history recorded.</p>
                        ) : (
                            <div className="space-y-4">
                                {data.map((entry: any, index: number) => (
                                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                            <div>
                                                <Label className="text-sm font-medium text-gray-700">Relationship</Label>
                                                <p className="text-gray-900 capitalize">{entry.relationship_to_patient.replace('_', ' ')}</p>
                                            </div>
                                            <div>
                                                <Label className="text-sm font-medium text-gray-700">Condition</Label>
                                                <p className="text-gray-900">{entry.summary}</p>
                                            </div>
                                            <div>
                                                <Label className="text-sm font-medium text-gray-700">Diagnosis Date</Label>
                                                <p className="text-gray-900">{entry.diagnosis_date || 'Not specified'}</p>
                                            </div>
                                            {entry.details && (
                                                <div className="lg:col-span-3">
                                                    <Label className="text-sm font-medium text-gray-700">Details</Label>
                                                    <p className="text-gray-900">{entry.details}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Patient Medical History Section Component  
function PatientMedicalHistorySection({ data, isEditing, formData, onEdit, onCancel, onSubmit, onAddEntry, onRemoveEntry, onUpdateEntry }: any) {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-500" />
                        Patient Medical History
                    </CardTitle>
                    {!isEditing && (
                        <Button variant="outline" size="sm" onClick={onEdit}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {isEditing ? (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-medium">Edit Medical History</h4>
                            <Button variant="outline" size="sm" onClick={onAddEntry}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Entry
                            </Button>
                        </div>
                        
                        {formData.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No medical history entries. Click "Add Entry" to get started.</p>
                        ) : (
                            <div className="space-y-4">
                                {formData.map((entry: any, index: number) => (
                                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                        <div className="flex justify-between items-start mb-4">
                                            <h5 className="font-medium">Medical History #{index + 1}</h5>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onRemoveEntry(index)}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Disease/Condition *</Label>
                                                <Input
                                                    value={entry.disease}
                                                    onChange={(e) => onUpdateEntry(index, 'disease', e.target.value)}
                                                    placeholder="e.g., Hypertension, Asthma, Depression"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Recent Tests/Results</Label>
                                                <Textarea
                                                    value={entry.recent_tests}
                                                    onChange={(e) => onUpdateEntry(index, 'recent_tests', e.target.value)}
                                                    placeholder="Recent test results, lab values, imaging studies..."
                                                    rows={3}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button variant="outline" onClick={onCancel}>
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                            </Button>
                            <Button onClick={onSubmit}>
                                <Save className="w-4 h-4 mr-2" />
                                Save Changes
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div>
                        {data.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No medical history recorded.</p>
                        ) : (
                            <div className="space-y-4">
                                {data.map((entry: any, index: number) => (
                                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                        <div className="space-y-2">
                                            <div>
                                                <Label className="text-sm font-medium text-gray-700">Condition</Label>
                                                <p className="text-gray-900">{entry.disease}</p>
                                            </div>
                                            {entry.recent_tests && (
                                                <div>
                                                    <Label className="text-sm font-medium text-gray-700">Recent Tests/Results</Label>
                                                    <p className="text-gray-900">{entry.recent_tests}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Known Allergies Section Component
function KnownAllergiesSection({ data, isEditing, formData, onEdit, onCancel, onSubmit, onAddEntry, onRemoveEntry, onUpdateEntry, getSeverityBadge }: any) {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-red-500" />
                        Known Allergies
                    </CardTitle>
                    {!isEditing && (
                        <Button variant="outline" size="sm" onClick={onEdit}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {isEditing ? (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-medium">Edit Known Allergies</h4>
                            <Button variant="outline" size="sm" onClick={onAddEntry}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Allergy
                            </Button>
                        </div>
                        
                        {formData.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No allergies recorded. Click "Add Allergy" to get started.</p>
                        ) : (
                            <div className="space-y-4">
                                {formData.map((entry: any, index: number) => (
                                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                        <div className="flex justify-between items-start mb-4">
                                            <h5 className="font-medium">Allergy #{index + 1}</h5>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onRemoveEntry(index)}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                                            <div className="space-y-2">
                                                <Label>Allergen *</Label>
                                                <Input
                                                    value={entry.allergens}
                                                    onChange={(e) => onUpdateEntry(index, 'allergens', e.target.value)}
                                                    placeholder="e.g., Peanuts, Penicillin"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Type *</Label>
                                                <Select
                                                    value={entry.type}
                                                    onValueChange={(value) => onUpdateEntry(index, 'type', value)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="food">Food</SelectItem>
                                                        <SelectItem value="medication">Medication</SelectItem>
                                                        <SelectItem value="environmental">Environmental</SelectItem>
                                                        <SelectItem value="contact">Contact</SelectItem>
                                                        <SelectItem value="other">Other</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Severity *</Label>
                                                <Select
                                                    value={entry.severity}
                                                    onValueChange={(value) => onUpdateEntry(index, 'severity', value)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select severity" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="mild">Mild</SelectItem>
                                                        <SelectItem value="moderate">Moderate</SelectItem>
                                                        <SelectItem value="severe">Severe</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Reaction</Label>
                                                <Input
                                                    value={entry.reaction}
                                                    onChange={(e) => onUpdateEntry(index, 'reaction', e.target.value)}
                                                    placeholder="e.g., Hives, Swelling, Anaphylaxis"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Additional Notes</Label>
                                                <Textarea
                                                    value={entry.notes}
                                                    onChange={(e) => onUpdateEntry(index, 'notes', e.target.value)}
                                                    placeholder="Additional information about this allergy..."
                                                    rows={3}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button variant="outline" onClick={onCancel}>
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                            </Button>
                            <Button onClick={onSubmit}>
                                <Save className="w-4 h-4 mr-2" />
                                Save Changes
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div>
                        {data.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No known allergies recorded.</p>
                        ) : (
                            <div className="space-y-4">
                                {data.map((entry: any, index: number) => (
                                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <Badge className={`${getSeverityBadge(entry.severity)} text-xs font-medium px-2 py-1`}>
                                                    {entry.severity.charAt(0).toUpperCase() + entry.severity.slice(1)}
                                                </Badge>
                                                <Badge variant="secondary" className="text-xs">
                                                    {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                                                </Badge>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <div>
                                                <Label className="text-sm font-medium text-gray-700">Allergen</Label>
                                                <p className="text-gray-900 font-medium">{entry.allergens}</p>
                                            </div>
                                            {entry.reaction && (
                                                <div>
                                                    <Label className="text-sm font-medium text-gray-700">Reaction</Label>
                                                    <p className="text-gray-900">{entry.reaction}</p>
                                                </div>
                                            )}
                                            {entry.notes && (
                                                <div>
                                                    <Label className="text-sm font-medium text-gray-700">Notes</Label>
                                                    <p className="text-gray-900">{entry.notes}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}