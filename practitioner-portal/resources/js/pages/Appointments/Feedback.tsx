import { useState, useEffect } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { withAppLayout } from '@/utils/layout';
import PageHeader from '@/components/general/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Star, StarHalf, Heart, ThumbsUp, Smile, Meh, Frown, Calendar, Clock, MapPin, User, Stethoscope, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime, getTenantTimezone } from '@/hooks/use-time-locale';
import { smartFormatDateTime } from '@/utils/time-locale-helpers';
import AppointmentTabs from '@/components/appointments/AppointmentTabs';

interface Patient {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
}

interface Service {
    id: number;
    name: string;
}

interface Location {
    id: number;
    name: string;
    street_address?: string;
    city?: string;
    province?: string;
}

interface Appointment {
    id: number;
    status: string;
    appointment_datetime: string;
    appointment_datetime_local?: string;
    service: Service;
    location?: Location;
}

interface Practitioner {
    id: number;
    name: string;
    title?: string;
}

interface Props {
    appointment: Appointment;
    patient: Patient;
    practitioners: Practitioner[];
    existingFeedback?: {
        visit_rating: number;
        visit_led_by_id: number | null;
        call_out_person_id: number | null;
        additional_feedback: string | null;
        submitted_at: string | null;
        last_edited_at: string | null;
    } | null;
    canEdit: boolean;
    feedbackExists: boolean;
}

const getBreadcrumbs = (appointmentId: number) => [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Appointments', href: '/appointments' },
    { title: 'Appointment Details', href: `/appointments/${appointmentId}` },
    { title: 'Feedback', href: '' },
];

function AppointmentFeedback({ 
    appointment, 
    patient, 
    practitioners, 
    existingFeedback, 
    canEdit, 
    feedbackExists 
}: Props) {
    const [formData, setFormData] = useState({
        visit_rating: existingFeedback?.visit_rating || 0,
        visit_led_by_id: existingFeedback?.visit_led_by_id || null,
        call_out_person_id: existingFeedback?.call_out_person_id || null,
        additional_feedback: existingFeedback?.additional_feedback || '',
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const { flash }: any = usePage().props;

    // Use only real practitioners from the appointment (no static ones)  
    const allPractitioners = practitioners;

    // Update form data when existing feedback changes (for when data loads after component mounts)
    useEffect(() => {
        if (existingFeedback) {
            setFormData({
                visit_rating: existingFeedback.visit_rating || 0,
                visit_led_by_id: existingFeedback.visit_led_by_id || null,
                call_out_person_id: existingFeedback.call_out_person_id || null,
                additional_feedback: existingFeedback.additional_feedback || '',
            });
        }
    }, [existingFeedback]);

    // Handle flash messages from the server (but only error messages, not success ones from redirects)
    useEffect(() => {
        if (flash?.error) {
            toast.error(flash.error, {
                duration: 5000,
            });
        }
        // Don't show success messages here as they might be from previous actions
    }, [flash]);

    const handleRatingClick = (rating: number) => {
        if (!canEdit) return;
        setFormData(prev => ({ ...prev, visit_rating: rating }));
    };

    const handlePractitionerSelect = (practitionerId: number | null, field: 'visit_led_by_id' | 'call_out_person_id') => {
        if (!canEdit) return;
        setFormData(prev => ({ ...prev, [field]: practitionerId }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!canEdit) {
            toast.error('This feedback can no longer be edited. The 24-hour editing window has expired.');
            return;
        }
        
        if (formData.visit_rating === 0) {
            toast.error('Please provide a rating for your visit');
            return;
        }

        setIsSubmitting(true);

        try {
            await router.post(`/appointments/${appointment.id}/feedback`, formData, {
                onSuccess: () => {
                    const message = feedbackExists 
                        ? 'Your feedback has been updated successfully!' 
                        : 'Thank you for your feedback! Your response has been recorded.';
                    toast.success(message);
                    
                    // Refresh the page to show updated feedback data
                    router.reload({ only: ['existingFeedback', 'canEdit', 'feedbackExists'] });
                },
                onError: (errors) => {
                    toast.error('Failed to submit feedback. Please try again.');
                    console.error(errors);
                },
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderStarRating = () => {
        const emojis = [
            { icon: Frown, color: 'text-red-500', label: 'Very Dissatisfied' },
            { icon: Meh, color: 'text-orange-500', label: 'Dissatisfied' },
            { icon: Meh, color: 'text-yellow-500', label: 'Neutral' },
            { icon: Smile, color: 'text-blue-500', label: 'Satisfied' },
            { icon: Heart, color: 'text-green-500', label: 'Very Satisfied' },
        ];

        return (
            <div className="space-y-4">
                <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => {
                        const EmojiIcon = emojis[rating - 1].icon;
                        const isSelected = formData.visit_rating >= rating;
                        return (
                            <button
                                key={rating}
                                type="button"
                                onClick={() => handleRatingClick(rating)}
                                disabled={!canEdit}
                                className={`p-3 rounded-full transition-all duration-200 ${
                                    canEdit ? 'hover:scale-110' : 'cursor-not-allowed opacity-60'
                                } ${
                                    isSelected 
                                        ? `${emojis[rating - 1].color} bg-gray-100 shadow-md` 
                                        : 'text-gray-300 hover:text-gray-400'
                                }`}
                            >
                                <EmojiIcon className="w-8 h-8" />
                            </button>
                        );
                    })}
                </div>
                {formData.visit_rating > 0 && (
                    <p className="text-center text-sm font-medium text-gray-600">
                        {emojis[formData.visit_rating - 1].label}
                    </p>
                )}
            </div>
        );
    };

    const renderPractitionerChips = (field: 'visit_led_by_id' | 'call_out_person_id') => {
        return (
            <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                    {allPractitioners.map((practitioner) => (
                        <button
                            key={`${field}-${practitioner.id}`}
                            type="button"
                            onClick={() => handlePractitionerSelect(practitioner.id, field)}
                            disabled={!canEdit}
                            className={`px-3 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                                !canEdit ? 'cursor-not-allowed opacity-60' : ''
                            } ${
                                formData[field] === practitioner.id
                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                        >
                            {practitioner.name}
                            {practitioner.title && (
                                <span className="text-xs opacity-80 ml-1">({practitioner.title})</span>
                            )}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => handlePractitionerSelect(null, field)}
                        disabled={!canEdit}
                        className={`px-3 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                            !canEdit ? 'cursor-not-allowed opacity-60' : ''
                        } ${
                            formData[field] === null
                                ? 'bg-gray-200 text-gray-700 border-gray-400'
                                : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                        }`}
                    >
                        None
                    </button>
                </div>
            </div>
        );
    };

    return (
        <>
            <Head title="Appointment Feedback" />

            {/* Tabs Navigation */}
            <AppointmentTabs 
                appointmentId={appointment.id}
                encounterId={undefined}
                currentTab="feedback"
                userRole="patient"
                appointmentStatus={appointment.status}
                showFeedback={true}
            />
            
            <div className="max-w-4xl mx-auto p-6 space-y-6">
                {/* Back Button */}
                <div className="flex items-center gap-4">
                    <Link href={route('appointments.show', appointment.id)}>
                        <Button variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Appointment Details
                        </Button>
                    </Link>
                </div>

                <PageHeader
                    title="Rate Your Appointment"
                    description="We'd love to hear about your experience"
                />

                {/* Feedback Status */}
                {feedbackExists && (
                    <Card className={`border-l-4 ${canEdit ? 'border-l-blue-500 bg-blue-50' : 'border-l-amber-500 bg-amber-50'}`}>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                {canEdit ? (
                                    <>
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                            <Star className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-blue-900">You can edit your feedback</p>
                                            <p className="text-sm text-blue-700">
                                                Submitted {existingFeedback?.submitted_at ? new Date(existingFeedback.submitted_at).toLocaleDateString() : ''}
                                                {existingFeedback?.last_edited_at && existingFeedback.last_edited_at !== existingFeedback.submitted_at && 
                                                    ` • Last edited ${new Date(existingFeedback.last_edited_at).toLocaleDateString()}`
                                                }
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                                            <Clock className="w-4 h-4 text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-amber-900">Feedback editing window expired</p>
                                            <p className="text-sm text-amber-700">
                                                You can view your feedback but cannot make changes after 24 hours.
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Appointment Summary */}
                <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-primary" />
                            </div>
                            Appointment Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-3">
                                <Clock className="w-4 h-4 text-gray-500" />
                                <div>
                                    <p className="font-medium">{smartFormatDateTime(appointment)}</p>
                                    <p className="text-sm text-gray-500">{getTenantTimezone().split('/').pop()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Stethoscope className="w-4 h-4 text-gray-500" />
                                <div>
                                    <p className="font-medium">{appointment.service.name}</p>
                                    <p className="text-sm text-gray-500">Service</p>
                                </div>
                            </div>
                            {appointment.location && (
                                <div className="flex items-center gap-3">
                                    <MapPin className="w-4 h-4 text-gray-500" />
                                    <div>
                                        <p className="font-medium">{appointment.location.name}</p>
                                        <p className="text-sm text-gray-500">Location</p>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <User className="w-4 h-4 text-gray-500" />
                                <div>
                                    <p className="font-medium">{patient.first_name} {patient.last_name}</p>
                                    <p className="text-sm text-gray-500">Patient</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Feedback Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Question 1: Rating */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">1. How was your visit today?</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {renderStarRating()}
                        </CardContent>
                    </Card>

                    {/* Question 2: Who led your visit */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">2. Who led your visit?</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {renderPractitionerChips('visit_led_by_id')}
                        </CardContent>
                    </Card>

                    {/* Question 3: Anyone to call out */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">3. Anyone to call out?</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {renderPractitionerChips('call_out_person_id')}
                        </CardContent>
                    </Card>

                    {/* Question 4: Additional feedback */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">4. Anything you'd like us to know? (Optional)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                placeholder="Please share any additional thoughts about your appointment..."
                                value={formData.additional_feedback}
                                onChange={(e) => canEdit && setFormData(prev => ({ ...prev, additional_feedback: e.target.value }))}
                                disabled={!canEdit}
                                className={`min-h-[100px] resize-none ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                                maxLength={1000}
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                {formData.additional_feedback.length}/1000 characters
                            </p>
                        </CardContent>
                    </Card>

                    {/* Submit Button */}
                    <div className="flex justify-end gap-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.visit('/appointments')}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || formData.visit_rating === 0 || !canEdit}
                            className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                    {feedbackExists ? 'Updating...' : 'Submitting...'}
                                </>
                            ) : !canEdit ? (
                                <>
                                    <Clock className="w-4 h-4 mr-2" />
                                    Editing Expired
                                </>
                            ) : (
                                <>
                                    <ThumbsUp className="w-4 h-4 mr-2" />
                                    {feedbackExists ? 'Update Feedback' : 'Submit Feedback'}
                                </>
                            )}
                        </Button>
                    </div>
                </form>

                {/* Footer Note */}
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-6 space-y-3">
                        <p className="text-sm text-blue-800 text-center">
                            <Heart className="w-4 h-4 inline mr-1" />
                            Your feedback helps us improve our care and service quality. Thank you for taking the time to share your experience!
                        </p>
                        {practitioners.length > 1 && (
                            <div className="text-xs text-blue-700 bg-blue-100 p-3 rounded-lg">
                                <p className="font-medium mb-1">Rating Distribution:</p>
                                <p>Your rating will be distributed among all {practitioners.length} practitioners involved in your appointment. 
                                   The practitioner who led your visit will receive bonus points, and anyone you call out for recognition will also receive additional points.</p>
                            </div>
                        )}
                        {feedbackExists && canEdit && (
                            <p className="text-xs text-blue-600 text-center">
                                You can edit your feedback within 24 hours of submission.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

export default withAppLayout(AppointmentFeedback, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Appointments', href: route('appointments.index') },
        { title: 'Feedback' }
    ]
});
