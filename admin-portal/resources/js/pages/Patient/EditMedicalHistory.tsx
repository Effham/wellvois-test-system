import { Head, usePage, router } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { 
    User, 
    Heart,
    Shield,
    AlertTriangle,
    Activity,
    Edit,
    Save,
    X,
    Plus,
    Trash2,
    ArrowLeft,
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

interface PatientEditMedicalHistoryProps {
    patient: any;
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
    error?: string;
}

function EditMedicalHistory() {
    const page = usePage();
    const { patient, medicalData, summary, error }: PatientEditMedicalHistoryProps = page.props as any;
    
    const [activeTab, setActiveTab] = useState('family-medical');
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [formData, setFormData] = useState<any>({});

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
    const handleSubmit = async (type: string) => {
        const parameterName = type.replace(/-/g, '_');
        
        try {
            // Call the API directly to update the patient's medical history in central database
            const response = await fetch(`/api/patients/${patient.id}/medical-history/${type}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    [parameterName]: formData[parameterName] || [],
                }),
            });

            if (response.ok) {
                setIsEditing(null);
                setFormData({});
                
                const typeMessages = {
                    'family-medical-histories': 'Family medical history updated successfully!',
                    'patient-medical-histories': 'Patient medical history updated successfully!',
                    'known-allergies': 'Known allergies updated successfully!'
                };
                
                const message = typeMessages[type as keyof typeof typeMessages] || 'Medical information updated successfully!';
                toast.success(message);
                
                // Reload the page to refresh data
                router.reload({ only: ['medicalData', 'summary'] });
            } else {
                const errorData = await response.json();
                console.error('Update errors:', errorData);
                throw new Error(errorData.message || 'Failed to update');
            }
        } catch (error: any) {
            console.error('Update error:', error);
            const typeMessages = {
                'family-medical-histories': 'Failed to update family medical history',
                'patient-medical-histories': 'Failed to update patient medical history',
                'known-allergies': 'Failed to update known allergies'
            };
            
            const message = typeMessages[type as keyof typeof typeMessages] || 'Failed to update medical information';
            toast.error(message + ': ' + (error.message || 'Unknown error'));
        }
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
                <Head title="Edit Medical History" />
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

    const safePatient = patient || {
        preferred_name: '',
        first_name: 'Unknown',
        last_name: 'Patient',
        health_number: 'N/A',
        email: 'N/A',
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
            <Head title={`Edit Medical History - ${safePatient.first_name} ${safePatient.last_name}`} />
            <div className="p-4 sm:p-6 space-y-6">
                
                {/* Header Section */}
                <Card>
                    <CardContent className="p-6">
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
                                        Edit Medical History • Health #: {safePatient.health_number}
                                    </p>
                                </div>
                            </div>
                            <Button variant="outline" onClick={() => router.visit(route('patients.index'))}>
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Patients
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                </div>

                {/* Tab Navigation & Content */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6">
                            {[
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
                            {/* Family Medical History Tab */}
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
                                            const updated = [...(formData.family_medical_histories || safeMedicalData.family_medical_histories)];
                                            updated[index] = { ...updated[index], [field]: value };
                                            setFormData({ ...formData, family_medical_histories: updated });
                                        }}
                                    />
                                </motion.div>
                            )}

                            {/* Patient Medical History Tab */}
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
                                            const updated = [...(formData.patient_medical_histories || safeMedicalData.patient_medical_histories)];
                                            updated[index] = { ...updated[index], [field]: value };
                                            setFormData({ ...formData, patient_medical_histories: updated });
                                        }}
                                    />
                                </motion.div>
                            )}

                            {/* Known Allergies Tab */}
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
                                            const updated = [...(formData.known_allergies || safeMedicalData.known_allergies)];
                                            updated[index] = { ...updated[index], [field]: value };
                                            setFormData({ ...formData, known_allergies: updated });
                                        }}
                                        getSeverityBadge={getSeverityBadge}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </CardContent>
                </Card>
            </div>
            <Toaster />
        </>
    );
}

export default withAppLayout(EditMedicalHistory, {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Patients', href: '/patients' },
        { title: 'Edit Medical History' }
    ]
});

// Family Medical History Section Component (reused from MyDetails)
function FamilyMedicalHistorySection({ data, isEditing, formData, onEdit, onCancel, onSubmit, onAddEntry, onRemoveEntry, onUpdateEntry }: any) {
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    <Heart className="w-5 h-5 text-pink-500" />
                    <h3 className="text-lg font-semibold">Family Medical History</h3>
                </div>
                {!isEditing && (
                    <Button variant="outline" size="sm" onClick={onEdit}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                    </Button>
                )}
            </div>
            
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
        </div>
    );
}

// Patient Medical History Section Component (reused from MyDetails)
function PatientMedicalHistorySection({ data, isEditing, formData, onEdit, onCancel, onSubmit, onAddEntry, onRemoveEntry, onUpdateEntry }: any) {
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-500" />
                    <h3 className="text-lg font-semibold">Patient Medical History</h3>
                </div>
                {!isEditing && (
                    <Button variant="outline" size="sm" onClick={onEdit}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                    </Button>
                )}
            </div>
            
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
        </div>
    );
}

// Known Allergies Section Component (reused from MyDetails)
function KnownAllergiesSection({ data, isEditing, formData, onEdit, onCancel, onSubmit, onAddEntry, onRemoveEntry, onUpdateEntry, getSeverityBadge }: any) {
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-red-500" />
                    <h3 className="text-lg font-semibold">Known Allergies</h3>
                </div>
                {!isEditing && (
                    <Button variant="outline" size="sm" onClick={onEdit}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                    </Button>
                )}
            </div>
            
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
        </div>
    );
}

