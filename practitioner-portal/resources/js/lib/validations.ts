import { z } from 'zod';

// Common field validations
export const emailSchema = z
    .string()
    .min(1, 'Email is required')
    .transform((val) => val.trim().toLowerCase())
    .pipe(
        z.string()
            .max(255, 'Email must not exceed 255 characters')
            .email('Invalid email address')
    );

export const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

    export const phoneSchema = z
    .string()
    .min(1, "Phone number is required")
    .transform((val) => val.trim())
    .refine(
      (val) => /^[\d\s\-\+\(\)]+$/.test(val),
      "Phone number can only contain digits, spaces, dashes, plus signs, and parentheses"
    )
    .transform((val) => val.replace(/[^\d]/g, "")) // keep only digits
    .refine((val) => val.length >= 10, "Phone number must contain at least 10 digits")
    .refine((val) => val.length <= 20, "Phone number must not exceed 20 digits");

export const nameSchema = z
    .string()
    .min(1, 'Name is required')
    .transform((val) => {
        // Trim whitespace
        const trimmed = val.trim();
        // Capitalize first letter of each word
        return trimmed
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    })
    .pipe(
        z.string()
            .min(2, 'Name must be at least 2 characters')
            .max(50, 'Name must not exceed 50 characters')
            .regex(/^[A-Za-z\s\-\']+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
    );

export const healthNumberSchema = z
    .string()
    .min(1, 'Health number is required')
    .transform((val) => val.trim().toUpperCase())
    .pipe(
        z.string()
            .min(5, 'Health number must be at least 5 characters')
            .max(30, 'Health number must not exceed 30 characters')
            .regex(/^[A-Za-z0-9\-]+$/, 'Health number can only contain letters, numbers, and hyphens')
    );

// Auth schemas
export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required').max(128, 'Password must not exceed 128 characters'),
    remember: z.boolean().optional(),
});

export const registerSchema = z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    password_confirmation: z.string().min(1, 'Password confirmation is required').max(128, 'Password must not exceed 128 characters'),
}).refine((data) => data.password === data.password_confirmation, {
    message: "Passwords don't match",
    path: ['password_confirmation'],
});

export const forgotPasswordSchema = z.object({
    email: emailSchema,
});

export const resetPasswordSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    password_confirmation: z.string().min(1, 'Password confirmation is required').max(128, 'Password must not exceed 128 characters'),
    token: z.string().min(1, 'Token is required').max(255, 'Token must not exceed 255 characters'),
}).refine((data) => data.password === data.password_confirmation, {
    message: "Passwords don't match",
    path: ['password_confirmation'],
});

// Patient schema
export const patientSchema = z.object({
    health_number: healthNumberSchema,
    first_name: nameSchema,
    last_name: nameSchema,
    gender: z.enum(['male', 'female', 'other'], {
        errorMap: () => ({ message: 'Please select a valid gender' }),
    }),
    phone_number: phoneSchema,
    email: z.string().max(255, 'Email must not exceed 255 characters').email('Invalid email address').optional().or(z.literal('')),
    address: z.string().max(500, 'Address must not exceed 500 characters').optional(),
    date_of_birth: z.string().min(1, 'Date of birth is required').regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    is_active: z.boolean().optional(),
    notes: z.string().max(1000, 'Notes must not exceed 1000 characters').optional(),
});

// Practitioner schema (matches the complex Practitioner/Create.tsx form structure)
export const practitionerSchema = z.object({
    practitioner_id: z.number().nullable().optional(),
    current_tab: z.string().optional(),
    first_name: nameSchema,
    last_name: nameSchema,
    title: z.string().min(1, 'Title is required').max(100, 'Title must not exceed 100 characters'),
    // email: emailSchema.or(z.literal('')),
    email: z.string().min(1, 'Email is required').max(100, 'Email must not exceed 100 characters'),
    phone_number: phoneSchema,
    extension: z.string().min(1, 'Extension is required').max(100, 'Extension must not exceed 100 characters'),
    gender: z.string().min(1, 'Gender is required').max(100, 'gender must not exceed 100 characters'),
    pronoun: z.string().min(1, 'Pronoun is required').max(100, 'Pronoun must not exceed 100 characters'),
    is_active: z.boolean().optional(),
    short_bio: z.string().optional(),
    full_bio: z.string().optional(),
    profile_picture: z.any().nullable().optional(),
    profile_picture_s3_key: z.string().optional(),
    profile_picture_url: z.string().optional(),
    
    // Professional details
    credentials: z.array(z.string()).optional(),
    years_of_experience: z.string().optional(),
    license_number: z.string().min(1, 'License number is required').max(100, 'License number must not exceed 100 characters'),
    professional_associations: z.array(z.string()).optional(),
    primary_specialties: z.array(z.string()).optional(),
    therapeutic_modalities: z.array(z.string()).optional(),
    client_types_served: z.array(z.string()).optional(),
    languages_spoken: z.array(z.string()).optional(),
    resume_files: z.array(z.any()).optional(),
    licensing_docs: z.array(z.any()).optional(),
    certificates: z.array(z.any()).optional(),
    
    // Location assignments
    location_assignments: z.array(z.any()).optional(),
    locations: z.array(z.any()).optional(),
});

// Service schema
export const serviceSchema = z.object({
    name: z.string().min(1, 'Service name is required').min(3, 'Service name must be at least 3 characters').max(255, 'Service name must not exceed 255 characters'),
    category: z.string().min(1, 'Service category is required'),
    description: z.string().max(2000, 'Description must not exceed 2000 characters').optional(),
    delivery_modes: z.array(z.string()).min(1, 'At least one delivery mode is required'),
    default_price: z.union([z.string(), z.number()]).refine((val) => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return !isNaN(num) && num > 0;
    }, 'Price is required and must be a positive number'),
    currency: z.string().optional(),
    duration: z.number().min(1, 'Duration must be at least 1 minute').max(1440, 'Duration must not exceed 1440 minutes (24 hours)').optional(),
    price: z.number().min(0, 'Price must be a positive number').max(999999.99, 'Price must not exceed 999,999.99').optional(),
    is_active: z.boolean().optional(),
});

// Appointment schema (matches the complex Appointments/Create.tsx form structure)
export const appointmentSchema = z.object({
    // Client Information
    health_number: z.string().optional(),
    first_name: nameSchema,
    middle_name: z.string().optional(),
    last_name: nameSchema,
    preferred_name: z.string().optional(),
    date_of_birth: z.string().min(1, 'Date of birth is required'),
    gender: z.string().optional(),
    gender_pronouns: z.string().min(1, 'Gender/pronouns is required'),
    phone_number: phoneSchema,
    email_address: emailSchema,
    emergency_contact_name: z.string().optional(),
    emergency_contact_phone: phoneSchema,
    contact_person: z.string().optional(),
    booking_source: z.string().min(1, 'Booking source is required'),
    preferred_language: z.string().optional(),
    client_type: z.string().min(1, 'Client type is required'),
    admin_override: z.string().optional(),
    
    // Appointment Details
    service_type: z.string().min(1, 'Service type is required'),
    service_name: z.string().min(1, 'Service name is required'),
    service_id: z.string().min(1, 'Please select a service'),
    practitioner_ids: z.array(z.number()).min(1, 'Please select at least one practitioner'),
    location_id: z.string().optional(),
    mode: z.string().min(1, 'Please select a mode'),
    date_time_preference: z.string().min(1, 'Date & time preference is required'),
    
    // Trigger & Follow-up
    send_intake_form: z.boolean().optional(),
    send_appointment_confirmation: z.boolean().optional(),
    add_to_calendar: z.boolean().optional(),
    tag_with_referral_source: z.boolean().optional(),
    
    // Advanced Appointment Settings
    advanced_appointment_settings: z.boolean().optional(),
    slot_divisions: z.string().optional(),
});

// Enhanced name schema with automatic capitalization
export const enhancedNameSchema = z
    .string()
    .min(1, 'Name is required')
    .transform((val) => {
        // Trim whitespace
        const trimmed = val.trim();
        // Capitalize first letter of each word
        return trimmed
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    })
    .pipe(
        z.string()
            .min(2, 'Name must be at least 2 characters')
            .max(50, 'Name must not exceed 50 characters')
            .regex(/^[A-Za-z\s\-\']+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
    );

// Enhanced text field schema for longer text inputs
export const textFieldSchema = z
    .string()
    .transform((val) => val.trim())
    .pipe(
        z.string()
            .max(1000, 'Text must not exceed 1000 characters')
    );

// Enhanced textarea schema for longer text areas
export const textareaSchema = z
    .string()
    .transform((val) => val.trim())
    .pipe(
        z.string()
            .max(2000, 'Text must not exceed 2000 characters')
    );

// Enhanced postal code schema
export const postalCodeSchema = z
    .string()
    .transform((val) => val.trim().toUpperCase())
    .pipe(
        z.string()
            .min(3, 'Postal code must be at least 3 characters')
            .max(10, 'Postal code must not exceed 10 characters')
            .regex(/^[A-Za-z0-9\s\-]+$/, 'Postal code can only contain letters, numbers, spaces, and hyphens')
    );

// Enhanced date schema
export const dateSchema = z
    .string()
    .min(1, 'Date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine((date) => {
        const inputDate = new Date(date);
        const today = new Date();
        return inputDate <= today;
    }, 'Date cannot be in the future');

// Enhanced gender pronouns schema
export const genderPronounsSchema = z
    .string()
    .min(1, 'Gender/pronouns is required')
    .max(50, 'Gender/pronouns must not exceed 50 characters')
    .regex(/^[A-Za-z\s\/\-\']+$/, 'Gender/pronouns can only contain letters, spaces, slashes, hyphens, and apostrophes');

// Enhanced address schema
export const addressSchema = z
    .string()
    .transform((val) => val.trim())
    .pipe(
        z.string()
            .min(5, 'Address must be at least 5 characters')
            .max(200, 'Address must not exceed 200 characters')
            .regex(/^[A-Za-z0-9\s\-\#\.\,]+$/, 'Address can only contain letters, numbers, spaces, hyphens, hash, periods, and commas')
    );

// Enhanced city schema
export const citySchema = z
    .string()
    .transform((val) => val.trim())
    .pipe(
        z.string()
            .min(2, 'City must be at least 2 characters')
            .max(100, 'City must not exceed 100 characters')
            .regex(/^[A-Za-z\s\-\']+$/, 'City can only contain letters, spaces, hyphens, and apostrophes')
    );

// Enhanced province schema
export const provinceSchema = z
    .string()
    .min(2, 'Province must be at least 2 characters')
    .max(50, 'Province must not exceed 50 characters');

// Enhanced insurance provider schema
export const insuranceProviderSchema = z
    .string()
    .transform((val) => val.trim())
    .pipe(
        z.string()
            .max(100, 'Insurance provider must not exceed 100 characters')
            .regex(/^[A-Za-z0-9\s\-\&\.]+$/, 'Insurance provider can only contain letters, numbers, spaces, hyphens, ampersands, and periods')
    );

// Enhanced policy number schema
export const policyNumberSchema = z
    .string()
    .transform((val) => val.trim().toUpperCase())
    .pipe(
        z.string()
            .max(50, 'Policy number must not exceed 50 characters')
            .regex(/^[A-Za-z0-9\-\s]+$/, 'Policy number can only contain letters, numbers, hyphens, and spaces')
    );

// Family medical history schema
export const familyMedicalHistorySchema = z.object({
    relationship_to_patient: z.string().min(1, 'Relationship is required').max(50, 'Relationship must not exceed 50 characters'),
    summary: z.string().min(1, 'Summary is required').max(200, 'Summary must not exceed 200 characters'),
    details: z.string().max(500, 'Details must not exceed 500 characters').optional(),
    diagnosis_date: z.string().optional(),
});

// Patient medical history schema
export const patientMedicalHistorySchema = z.object({
    disease: z.string().min(1, 'Disease/condition is required').max(200, 'Disease/condition must not exceed 200 characters'),
    recent_tests: z.string().max(500, 'Recent tests must not exceed 500 characters').optional(),
});

// Known allergies schema
export const knownAllergiesSchema = z.object({
    allergens: z.string().min(1, 'Allergen is required').max(100, 'Allergen must not exceed 100 characters'),
    type: z.string().min(1, 'Type is required').max(50, 'Type must not exceed 50 characters'),
    severity: z.string().min(1, 'Severity is required').max(50, 'Severity must not exceed 50 characters'),
    reaction: z.string().max(200, 'Reaction must not exceed 200 characters').optional(),
    notes: z.string().max(500, 'Notes must not exceed 500 characters').optional(),
});

// Intake schema (matches the complex Intake/Create.tsx form structure)
export const intakeSchema = z.object({
    // Client Information fields
    health_number: healthNumberSchema,
    first_name: enhancedNameSchema,
    last_name: enhancedNameSchema,
    preferred_name: z.string()
        .transform((val) => {
            if (!val.trim()) return val;
            return val.trim()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        })
        .pipe(
            z.string()
                .max(50, 'Preferred name must not exceed 50 characters')
                .regex(/^[A-Za-z\s\-\']*$/, 'Preferred name can only contain letters, spaces, hyphens, and apostrophes')
        )
        .optional(),
    phone_number: phoneSchema,
    email_address: emailSchema.or(z.literal('')),
    gender_pronouns: genderPronounsSchema,
    client_type: z.enum(['individual', 'couple', 'family', 'group'], {
        errorMap: () => ({ message: 'Please select a valid client type' }),
    }),
    date_of_birth: dateSchema,
    emergency_contact_phone: phoneSchema,
    address_lookup: z.string().max(200, 'Address lookup must not exceed 200 characters'),
    street_address: addressSchema,
    apt_suite_unit: z.string()
        .transform((val) => val.trim())
        .pipe(
            z.string()
                .max(20, 'Apt/Suite/Unit must not exceed 20 characters')
                .regex(/^[A-Za-z0-9\s\-\#]*$/, 'Apt/Suite/Unit can only contain letters, numbers, spaces, hyphens, and hash')
        )
        .optional(),
    city: citySchema,
    postal_zip_code: postalCodeSchema,
    province: provinceSchema,
    
    // Health & Clinical History fields
    presenting_concern: textareaSchema.optional(),
    goals_for_therapy: textareaSchema.optional(),
    previous_therapy_experience: z.string().max(100, 'Previous therapy experience must not exceed 100 characters').optional(),
    current_medications: textFieldSchema.optional(),
    diagnoses: textFieldSchema.optional(),
    history_of_hospitalization: textFieldSchema.optional(),
    risk_safety_concerns: textareaSchema.optional(),
    other_medical_conditions: textFieldSchema.optional(),
    cultural_religious_considerations: textareaSchema.optional(),
    accessibility_needs: textareaSchema.optional(),
    
    // Insurance & Legal fields
    insurance_provider: insuranceProviderSchema.optional(),
    policy_number: policyNumberSchema.optional(),
    coverage_card_path: z.string().optional(),
    consent_to_treatment: z.boolean().optional(),
    consent_to_data_storage: z.boolean().optional(),
    privacy_policy_acknowledged: z.boolean().optional(),
    
    // Preferences fields
    language_preferences: z.string().max(50, 'Language preferences must not exceed 50 characters').optional(),
    best_time_to_contact: z.string().max(50, 'Best time to contact must not exceed 50 characters').optional(),
    best_way_to_contact: z.string().max(50, 'Best way to contact must not exceed 50 characters').optional(),
    consent_to_receive_reminders: z.boolean().optional(),
    
    // Complex array fields with proper validation
    family_medical_histories: z.array(familyMedicalHistorySchema).optional(),
    patient_medical_histories: z.array(patientMedicalHistorySchema).optional(),
    known_allergies: z.array(knownAllergiesSchema).optional(),
    
    // Redirect source field
    redirect_source: z.string().optional(),
});

// Location schema
export const locationSchema = z.object({
    name: z.string().min(1, 'Location name is required').min(3, 'Location name must be at least 3 characters').max(255, 'Location name must not exceed 255 characters'),
    address: z.string().min(1, 'Address is required').min(5, 'Address must be at least 5 characters').max(500, 'Address must not exceed 500 characters'),
    city: z.string().min(1, 'City is required').min(2, 'City must be at least 2 characters').max(100, 'City must not exceed 100 characters'),
    state: z.string().max(100, 'State must not exceed 100 characters').optional(),
    postal_code: z.string().max(20, 'Postal code must not exceed 20 characters').optional(),
    country: z.string().min(1, 'Country is required').min(2, 'Country must be at least 2 characters').max(100, 'Country must not exceed 100 characters'),
    phone: phoneSchema,
    email: z.string().max(255, 'Email must not exceed 255 characters').email('Invalid email address').optional().or(z.literal('')),
    is_active: z.boolean().optional(),
});

// Public Portal Registration schema
export const publicPortalRegisterSchema = z.object({
    first_name: nameSchema,
    last_name: nameSchema,
    preferred_name: z.string().max(50, 'Preferred name must not exceed 50 characters').optional(),
    email_address: emailSchema,
    phone_number: phoneSchema,
    date_of_birth: z.string().min(1, 'Date of birth is required').regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    gender_pronouns: z.string().min(1, 'Gender/pronouns is required').max(50, 'Gender/pronouns must not exceed 50 characters'),
    emergency_contact_phone: phoneSchema,
    client_type: z.enum(['individual', 'couple', 'family', 'group'], {
        errorMap: () => ({ message: 'Please select a valid client type' }),
    }),
    health_card_number: healthNumberSchema,
    notes: z.string().max(1000, 'Notes must not exceed 1000 characters').optional(),
    password: passwordSchema,
    password_confirmation: z.string().min(1, 'Password confirmation is required').max(128, 'Password must not exceed 128 characters'),
}).refine((data) => data.password === data.password_confirmation, {
    message: "Passwords don't match",
    path: ['password_confirmation'],
});

// Public Portal Login schema (for booking)
export const publicPortalLoginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required').max(128, 'Password must not exceed 128 characters'),
});

// Public Portal Request to Join schema
export const publicPortalRequestToJoinSchema = z.object({
    name: nameSchema,
    email: emailSchema,
    healthCardNumber: healthNumberSchema,
});

// Public Portal Waiting List schema
export const publicPortalWaitingListSchema = z.object({
    day: z.string().min(1, 'Please select a preferred day').max(50, 'Day must not exceed 50 characters'),
    time: z.string().min(1, 'Please select a preferred time').max(50, 'Time must not exceed 50 characters'),
});


// Public Portal 
export const titleCase = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase());



// Type exports for TypeScript inference
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type PatientFormData = z.infer<typeof patientSchema>;
export type PractitionerFormData = z.infer<typeof practitionerSchema>;
export type ServiceFormData = z.infer<typeof serviceSchema>;
export type AppointmentFormData = z.infer<typeof appointmentSchema>;
export type IntakeFormData = z.infer<typeof intakeSchema>;
export type LocationFormData = z.infer<typeof locationSchema>;
export type PublicPortalRegisterFormData = z.infer<typeof publicPortalRegisterSchema>;
export type PublicPortalLoginFormData = z.infer<typeof publicPortalLoginSchema>;
export type PublicPortalRequestToJoinFormData = z.infer<typeof publicPortalRequestToJoinSchema>;
export type PublicPortalWaitingListFormData = z.infer<typeof publicPortalWaitingListSchema>;
