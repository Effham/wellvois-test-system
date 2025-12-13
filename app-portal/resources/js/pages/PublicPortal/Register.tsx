import React, { useState, useEffect } from 'react';
import { useForm } from '@inertiajs/react';
import PublicPortalLayout from '@/layouts/public-portal-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Toaster } from '@/components/ui/sonner';
import { User, Eye, EyeOff, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { publicPortalRegisterSchema, titleCase } from '@/lib/validations';

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
    navigation?: any;
    appearance?: any;
  };
}

export default function Register({ tenant, appearanceSettings, websiteSettings }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [appointmentData, setAppointmentData] = useState<any>(null);

  // client-side field errors (Zod)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const { data, setData, errors: inertiaErrors, clearErrors } = useForm({
    first_name: '',
    last_name: '',
    preferred_name: '',
    email_address: '',
    phone_number: '',
    date_of_birth: '',
    gender_pronouns: '',
    emergency_contact_phone: '',
    client_type: '',
    health_card_number: '',
    notes: '',
    password: '',
    password_confirmation: '',
  });

  // ---------- Helpers for validation/normalization ----------
  // live: strip digits/symbols; allow space/hyphen/apostrophe
  const sanitizeName = (v: string) => v.replace(/[^A-Za-z '-]+/g, '');
  // auto-capitalize first character while typing
  const capFirst = (v: string) => (v ? v[0].toUpperCase() + v.slice(1) : v);
  // health card normalization
  const hcNormalize = (v: string) => v.toUpperCase().replace(/\s+/g, '');

  /** Collect all field errors using Zod */
  const getAllErrors = (formData: typeof data) => {
    const res = publicPortalRegisterSchema.safeParse(formData);
    if (res.success) return {};
    const fieldErrors: Record<string, string> = {};
    for (const issue of res.error.issues) {
      const key = (issue.path?.[0] as string) ?? 'form';
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return fieldErrors;
  };

  /** On-blur validate a single field */
  const validateFieldOnBlur = (field: keyof typeof data) => {
    const all = getAllErrors(data);
    setValidationErrors((prev) => ({ ...prev, [field]: all[field] || '' }));
  };
// validate one field against an explicit next form state (avoids stale `data`)
const validateFieldWithNext = (field: keyof typeof data, nextData: typeof data) => {
  const all = getAllErrors(nextData);
  setValidationErrors((prev) => ({ ...prev, [field]: all[field] || '' }));
};

  /** Clear error for a field onChange */
  const clearFieldError = (field: keyof typeof data) => {
    setValidationErrors((prev) => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
    clearErrors(field as string);
  };

  /** On blur, polish names to Title Case (every word) */
  const onNameBlur = (field: 'first_name' | 'last_name' | 'preferred_name') => {
    const val = data[field];
    if (val) setData(field, titleCase(sanitizeName(val)));
    validateFieldOnBlur(field);
  };

  // Extract appointment data from URL parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const appointmentParams = {
      service_type: urlParams.get('service_type'),
      service_name: urlParams.get('service_name'),
      service_id: urlParams.get('service_id'),
      location_id: urlParams.get('location_id'),
      mode: urlParams.get('mode'),
      date_time_preference: urlParams.get('date_time_preference'),
      practitioner_ids: urlParams.get('practitioner_ids')?.split(',').filter(Boolean) || [],
      // Waiting list parameters
      is_waiting_list: urlParams.get('is_waiting_list') === 'true',
      waiting_list_day: urlParams.get('waiting_list_day'),
      waiting_list_time: urlParams.get('waiting_list_time'),
    };

    if (appointmentParams.service_type && appointmentParams.service_name) {
      setAppointmentData(appointmentParams);
    } else {
      const storedData = localStorage.getItem('appointment_booking_data');
      if (storedData) {
        try {
          const parsed = JSON.parse(storedData);
          setAppointmentData(parsed);
        } catch (e) {
          console.error('Failed to parse stored appointment data:', e);
        }
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Zod full-form validation
    const all = getAllErrors(data);
    setValidationErrors(all);
    if (Object.keys(all).length) {
      toast.error('Please fix the highlighted fields.');
      return;
    }

    setProcessing(true);

    try {
      // Prepare submission data
      const submissionData = {
        ...data,
        from_public_portal: true,
        ...(appointmentData && {
          service_type: appointmentData.service_type,
          service_name: appointmentData.service_name,
          service_id: parseInt(appointmentData.service_id) || 0,
          location_id: appointmentData.location_id ? parseInt(appointmentData.location_id) : null,
          mode: appointmentData.mode,
          date_time_preference: appointmentData.date_time_preference,
          practitioner_ids: appointmentData.practitioner_ids || [],
          ...(appointmentData.is_waiting_list && {
            is_waiting_list: appointmentData.is_waiting_list,
            waiting_list_day: appointmentData.waiting_list_day,
            waiting_list_time: appointmentData.waiting_list_time,
          }),
        }),
      };

      const endpoint = appointmentData ? 'public-portal.register-and-book' : 'public-portal.submit-register';

      const response = await fetch(route(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
          'Accept': 'application/json',
        },
        body: JSON.stringify(submissionData),
        credentials: 'include',
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        toast.success(responseData.message || 'Please review and accept the required consents.');

        // Check if we need to redirect to consents page
        if (responseData.redirect_to_consents) {
          // Redirect to consent page
          setTimeout(() => {
            window.location.href = '/explore/consents';
          }, 1000);
        } else {
          // Old flow or error - shouldn't happen
          toast.error('Unexpected response. Please try again.');
        }
      } else {
        toast.error(responseData.message || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Error registering:', error);
      toast.error('Registration failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <PublicPortalLayout
      title="Register"
      tenant={tenant}
      appearanceSettings={appearanceSettings}
      websiteSettings={websiteSettings}
    >
      <div className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Create Your Account
            </h1>
            <p className="text-muted-foreground">
              {appointmentData
                ? appointmentData.is_waiting_list
                  ? `Complete your registration to join the waiting list with ${tenant.company_name}`
                  : `Complete your registration to book your appointment with ${tenant.company_name}`
                : `Join ${tenant.company_name} and manage your healthcare needs`
              }
            </p>
          </div>

          {/* Appointment Summary */}
          {appointmentData && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {appointmentData.is_waiting_list ? 'Your Waiting List Preferences' : 'Your Appointment Request Details'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground">Service:</span>
                    <p className="mt-1">{appointmentData.service_name}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Mode:</span>
                    <p className="mt-1 capitalize">{appointmentData.mode}</p>
                  </div>
                  {appointmentData.is_waiting_list ? (
                    <>
                      <div>
                        <span className="font-medium text-muted-foreground">Preferred Day:</span>
                        <p className="mt-1 capitalize">{appointmentData.waiting_list_day === 'any' ? 'Any Day' : appointmentData.waiting_list_day}</p>
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">Preferred Time:</span>
                        <p className="mt-1 capitalize">{appointmentData.waiting_list_time === 'any' ? 'Any Time' : appointmentData.waiting_list_time}</p>
                      </div>
                    </>
                  ) : (
                    <div>
                      <span className="font-medium text-muted-foreground">Date & Time:</span>
                      <p className="mt-1">{new Date(appointmentData.date_time_preference).toLocaleString()}</p>
                    </div>
                  )}
                  {appointmentData.location_id && (
                    <div>
                      <span className="font-medium text-muted-foreground">Location:</span>
                      <p className="mt-1">Location ID: {appointmentData.location_id}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Patient Registration Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Patient Registration
                </CardTitle>
                <CardDescription>
                  Please provide your information to create your patient account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="first_name"
                      type="text"
                      value={data.first_name}
                      maxLength={30}
                      onChange={(e) => {
                        clearFieldError('first_name');
                        const raw = e.target.value.slice(0, 30);
                        const cleaned = sanitizeName(raw);
                        setData('first_name', capFirst(cleaned));
                      }}
                      onBlur={() => onNameBlur('first_name')}
                      placeholder="Enter your first name"
                    />
                    {(validationErrors.first_name || inertiaErrors.first_name) && (
                      <p className="text-sm text-red-500">{validationErrors.first_name || inertiaErrors.first_name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="last_name"
                      type="text"
                      value={data.last_name}
                      maxLength={30}
                      onChange={(e) => {
                        clearFieldError('last_name');
                        const raw = e.target.value.slice(0, 30);
                        const cleaned = sanitizeName(raw);
                        setData('last_name', capFirst(cleaned));
                      }}
                      onBlur={() => onNameBlur('last_name')}
                      placeholder="Enter your last name"
                    />
                    {(validationErrors.last_name || inertiaErrors.last_name) && (
                      <p className="text-sm text-red-500">{validationErrors.last_name || inertiaErrors.last_name}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preferred_name">Preferred Name (Optional)</Label>
                  <Input
                    id="preferred_name"
                    type="text"
                    value={data.preferred_name}
                    maxLength={30}
                    onChange={(e) => {
                      clearFieldError('preferred_name');
                      const raw = e.target.value.slice(0, 30);
                      const cleaned = sanitizeName(raw);
                      setData('preferred_name', capFirst(cleaned));
                    }}
                    onBlur={() => onNameBlur('preferred_name')}
                    placeholder="Enter your preferred name"
                  />
                  {(validationErrors.preferred_name || inertiaErrors.preferred_name) && (
                    <p className="text-sm text-red-500">{validationErrors.preferred_name || inertiaErrors.preferred_name}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md-grid-cols-2 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email_address">Email Address <span className="text-red-500">*</span></Label>
                    <Input
                      id="email_address"
                      type="email"
                      value={data.email_address}
                      maxLength={30}
                      onChange={(e) => {
                        clearFieldError('email_address');
                        setData('email_address', e.target.value.slice(0, 30));
                      }}
                      onBlur={() => validateFieldOnBlur('email_address')}
                      placeholder="Enter your email"
                    />
                    {(validationErrors.email_address || inertiaErrors.email_address) && (
                      <p className="text-sm text-red-500">{validationErrors.email_address || inertiaErrors.email_address}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone_number">Phone Number <span className="text-red-500">*</span></Label>
                    <Input
                      id="phone_number"
                      type="tel"
                      value={data.phone_number}
                      maxLength={30}
                      onChange={(e) => {
                        clearFieldError('phone_number');
                        setData('phone_number', e.target.value.slice(0, 30));
                      }}
                      onBlur={() => validateFieldOnBlur('phone_number')}
                      placeholder="Enter your phone number"
                    />
                    {(validationErrors.phone_number || inertiaErrors.phone_number) && (
                      <p className="text-sm text-red-500">{validationErrors.phone_number || inertiaErrors.phone_number}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Date of Birth <span className="text-red-500">*</span></Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={data.date_of_birth}
                      onChange={(e) => {
                        clearFieldError('date_of_birth');
                        setData('date_of_birth', e.target.value);
                      }}
                      onBlur={() => validateFieldOnBlur('date_of_birth')}
                    />
                    {(validationErrors.date_of_birth || inertiaErrors.date_of_birth) && (
                      <p className="text-sm text-red-500">{validationErrors.date_of_birth || inertiaErrors.date_of_birth}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender_pronouns">Gender/Pronouns <span className="text-red-500">*</span></Label>
                    <Input
                      id="gender_pronouns"
                      type="text"
                      value={data.gender_pronouns}
                      maxLength={30}
                      onChange={(e) => {
                        clearFieldError('gender_pronouns');
                        setData('gender_pronouns', e.target.value.slice(0, 30));
                      }}
                      onBlur={() => validateFieldOnBlur('gender_pronouns')}
                      placeholder="e.g., She/Her, He/Him, They/Them"
                    />
                    {(validationErrors.gender_pronouns || inertiaErrors.gender_pronouns) && (
                      <p className="text-sm text-red-500">{validationErrors.gender_pronouns || inertiaErrors.gender_pronouns}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_phone">Emergency Contact Phone <span className="text-red-500">*</span></Label>
                  <Input
                    id="emergency_contact_phone"
                    type="tel"
                    value={data.emergency_contact_phone}
                    maxLength={30}
                    onChange={(e) => {
                      clearFieldError('emergency_contact_phone');
                      setData('emergency_contact_phone', e.target.value.slice(0, 30));
                    }}
                    onBlur={() => validateFieldOnBlur('emergency_contact_phone')}
                    placeholder="Enter emergency contact phone"
                  />
                  {(validationErrors.emergency_contact_phone || inertiaErrors.emergency_contact_phone) && (
                    <p className="text-sm text-red-500">{validationErrors.emergency_contact_phone || inertiaErrors.emergency_contact_phone}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client_type">Client Type <span className="text-red-500">*</span></Label>
                  <Select
  value={data.client_type}
  onValueChange={(value) => {
    clearFieldError('client_type');
    // build next state immediately
    const next = { ...data, client_type: value };
    setData('client_type', value);
    // validate against `next` (no setTimeout needed)
    validateFieldWithNext('client_type', next);
  }}
>
  <SelectTrigger>
    <SelectValue placeholder="Select client type" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="individual">Individual</SelectItem>
    <SelectItem value="couple">Couple</SelectItem>
    <SelectItem value="family">Family</SelectItem>
    <SelectItem value="group">Group</SelectItem>
  </SelectContent>
</Select>

                  {(validationErrors.client_type || inertiaErrors.client_type) && (
                    <p className="text-sm text-red-500">{validationErrors.client_type || inertiaErrors.client_type}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="health_card_number">Health Card Number <span className="text-red-500">*</span></Label>
                  <Input
                    id="health_card_number"
                    type="text"
                    value={data.health_card_number}
                    maxLength={30}
                    onChange={(e) => {
                      clearFieldError('health_card_number');
                      const raw = e.target.value.slice(0, 30);
                      setData('health_card_number', hcNormalize(raw));
                    }}
                    onBlur={() => validateFieldOnBlur('health_card_number')}
                    placeholder="Enter your health card number"
                    required
                  />
                  {(validationErrors.health_card_number || inertiaErrors.health_card_number) && (
                    <p className="text-sm text-red-500">{validationErrors.health_card_number || inertiaErrors.health_card_number}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={data.notes}
                    onChange={(e) => {
                      clearFieldError('notes');
                      setData('notes', e.target.value);
                    }}
                    onBlur={() => validateFieldOnBlur('notes')}
                    placeholder="Any additional information you'd like to share..."
                    className="resize-none"
                    rows={3}
                  />
                  {(validationErrors.notes || inertiaErrors.notes) && (
                    <p className="text-sm text-red-500">{validationErrors.notes || inertiaErrors.notes}</p>
                  )}
                </div>

                {/* Password Fields */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium mb-4">Set Your Password</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password">Password <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={data.password}
                          onChange={(e) => {
                            clearFieldError('password');
                            setData('password', e.target.value);
                          }}
                          onBlur={() => validateFieldOnBlur('password')}
                          placeholder="Enter your password"
                          className="pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {(validationErrors.password || inertiaErrors.password) && (
                        <p className="text-sm text-red-500">{validationErrors.password || inertiaErrors.password}</p>
                      )}
                      <p className="text-xs text-muted-foreground">Password must be at least 8 characters long</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password_confirmation">Confirm Password <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Input
                          id="password_confirmation"
                          type={showConfirmPassword ? "text" : "password"}
                          value={data.password_confirmation}
                          onChange={(e) => {
                            clearFieldError('password_confirmation');
                            setData('password_confirmation', e.target.value);
                          }}
                          onBlur={() => validateFieldOnBlur('password_confirmation')}
                          placeholder="Confirm your password"
                          className="pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {(validationErrors.password_confirmation || inertiaErrors.password_confirmation) && (
                        <p className="text-sm text-red-500">{validationErrors.password_confirmation || inertiaErrors.password_confirmation}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-center pt-6">
                  <Button
                    type="submit"
                    disabled={processing}
                    size="lg"
                    className="min-w-48"
                  >
                    {processing
                      ? (appointmentData ? 'Creating Account & Booking...' : 'Creating Account...')
                      : (appointmentData ? 'Create Account & Book Appointment' : 'Create Account')
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>

          <div className="text-center mt-8">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <a href="#" className="text-primary hover:underline" onClick={() => window.history.back()}>
                Go back to login
              </a>
            </p>
          </div>
        </div>
      </div>

      <Toaster position="top-right" />
    </PublicPortalLayout>
  );
}
