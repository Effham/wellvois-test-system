# Frontend Validation Implementation Guide

This guide explains the frontend validation system and how to implement it across all forms in the application.

## Files Created

### 1. `/resources/js/utils/validation.ts`
Contains validation functions and formatters for all common input types:
- `validateEmail()` - Email format validation
- `validatePassword()` - Password min length validation
- `validatePasswordConfirmation()` - Password match validation
- `validatePhone()` - Phone number format validation
- `validateUrl()` - URL format validation
- `validatePostalCode()` - Postal/ZIP code validation
- `validateRequired()` - Required field validation
- `capitalizeWords()` - Capitalizes first letter of each word
- `toLowerCase()` - Converts to lowercase
- And more...

### 2. `/resources/js/hooks/useFieldValidation.ts`
Custom hook for managing field-level validation state and handlers.

## How to Use

### Step 1: Import Dependencies
```tsx
import { useFieldValidation } from '@/hooks/useFieldValidation';
import {
    validateEmail,
    validatePassword,
    validatePasswordConfirmation,
    capitalizeWords,
    toLowerCase
} from '@/utils/validation';
```

### Step 2: Initialize Hook
```tsx
export default function MyForm() {
    const { data, setData, post, errors } = useForm({...});
    const { fieldErrors, createBlurHandler } = useFieldValidation();

    // ... rest of component
}
```

### Step 3: Add Validation to Input Fields

#### For Email Fields (with lowercase formatting):
```tsx
<Input
    id="email"
    type="email"
    value={data.email}
    onChange={(e) => setData('email', e.target.value)}
    onBlur={(e) => {
        const handler = createBlurHandler('email', validateEmail, toLowerCase);
        handler(e.target.value, setData);
    }}
    placeholder="email@example.com"
/>
<InputError message={fieldErrors.email || errors.email} />
```

#### For Name Fields (with capitalization):
```tsx
<Input
    id="first_name"
    value={data.first_name}
    onChange={(e) => setData('first_name', e.target.value)}
    onBlur={(e) => {
        const handler = createBlurHandler(
            'first_name',
            (value) => ({ isValid: !!value.trim(), error: value.trim() ? undefined : 'First name is required' }),
            capitalizeWords
        );
        handler(e.target.value, setData);
    }}
    placeholder="First Name"
/>
<InputError message={fieldErrors.first_name || errors.first_name} />
```

#### For Password Fields:
```tsx
<Input
    id="password"
    type="password"
    value={data.password}
    onChange={(e) => setData('password', e.target.value)}
    onBlur={(e) => {
        const handler = createBlurHandler('password', validatePassword);
        handler(e.target.value, setData);
    }}
    placeholder="Password"
/>
<InputError message={fieldErrors.password || errors.password} />
```

#### For Password Confirmation:
```tsx
<Input
    id="password_confirmation"
    type="password"
    value={data.password_confirmation}
    onChange={(e) => setData('password_confirmation', e.target.value)}
    onBlur={(e) => {
        const handler = createBlurHandler(
            'password_confirmation',
            (value) => validatePasswordConfirmation(data.password, value)
        );
        handler(e.target.value, setData);
    }}
    placeholder="Confirm password"
/>
<InputError message={fieldErrors.password_confirmation || errors.password_confirmation} />
```

#### For Phone Fields:
```tsx
import { validatePhone } from '@/utils/validation';

<Input
    id="phone_number"
    value={data.phone_number}
    onChange={(e) => setData('phone_number', e.target.value)}
    onBlur={(e) => {
        const handler = createBlurHandler(
            'phone_number',
            (value) => validatePhone(value, true) // true = required
        );
        handler(e.target.value, setData);
    }}
    placeholder="Phone number"
/>
<InputError message={fieldErrors.phone_number || errors.phone_number} />
```

## Forms Already Updated

✅ **Login** (`/pages/auth/login.tsx`)
- Email validation with lowercase
- Password required validation

✅ **Register** (`/pages/auth/register.tsx`)
- Name validation with capitalization
- Email validation with lowercase
- Password validation (min 8 chars)
- Password confirmation validation

✅ **Forgot Password** (`/pages/auth/forgot-password.tsx`)
- Email validation with lowercase

## Forms That Need Updates

### Patient Management

#### 1. Patient Create (`/pages/Patient/Create.tsx`)
**Fields to validate:**
- `first_name`: Required + capitalize
- `last_name`: Required + capitalize
- `email`: Email format + lowercase (optional)
- `phone_number`: Phone format (optional)
- `health_number`: Required

**Implementation pattern:**
```tsx
// Add imports
import { useFieldValidation } from '@/hooks/useFieldValidation';
import { validateEmail, validatePhone, validateRequired, capitalizeWords, toLowerCase } from '@/utils/validation';

// In component
const { fieldErrors, createBlurHandler } = useFieldValidation();

// For first_name
onBlur={(e) => {
    const handler = createBlurHandler(
        'first_name',
        (value) => validateRequired(value, 'First name'),
        capitalizeWords
    );
    handler(e.target.value, setData);
}}

// For email
onBlur={(e) => {
    const handler = createBlurHandler('email', validateEmail, toLowerCase);
    handler(e.target.value, setData);
}}

// For phone_number
onBlur={(e) => {
    const handler = createBlurHandler(
        'phone_number',
        (value) => validatePhone(value, false) // false = optional
    );
    handler(e.target.value, setData);
}}

// Update InputError components
<InputError message={fieldErrors.first_name || errors.first_name} />
```

#### 2. Patient Invitation Modal (`/components/patient/PatientInvitationModal.tsx`)
**Fields to validate:**
- `email`: Email format + lowercase + availability check

### Settings Forms

#### 1. Practice Details (`/pages/settings/Organization/PracticeDetails.tsx`)
**Fields to validate:**
- `practice_details_name`: Required + capitalize
- `practice_details_legal_name`: Required + capitalize
- `practice_details_contact_email`: Email + lowercase + required
- `practice_details_phone_number`: Phone + required
- `practice_details_website_url`: URL format (optional)

**Implementation pattern:**
```tsx
import { useFieldValidation } from '@/hooks/useFieldValidation';
import { validateEmail, validatePhone, validateUrl, validateRequired, capitalizeWords, toLowerCase } from '@/utils/validation';

const { fieldErrors, createBlurHandler } = useFieldValidation();

// For practice_details_name
onBlur={(e) => {
    const handler = createBlurHandler(
        'practice_details_name',
        (value) => validateRequired(value, 'Practice name'),
        capitalizeWords
    );
    handler(e.target.value, setData);
}}

// For practice_details_contact_email
onBlur={(e) => {
    const handler = createBlurHandler('practice_details_contact_email', validateEmail, toLowerCase);
    handler(e.target.value, setData);
}}

// For practice_details_website_url
onBlur={(e) => {
    const handler = createBlurHandler(
        'practice_details_website_url',
        (value) => validateUrl(value, false) // false = optional
    );
    handler(e.target.value, setData);
}}
```

#### 2. Location Basic Info (`/pages/settings/Location/BasicInfo.tsx`)
**Fields to validate:**
- `name`: Required + capitalize
- `street_address`: Required + capitalize
- `phone_number`: Phone + required
- `email_address`: Email + lowercase + required
- `postal_zip_code`: Postal code format + required

**Implementation pattern:**
```tsx
import { useFieldValidation } from '@/hooks/useFieldValidation';
import { validateEmail, validatePhone, validatePostalCode, validateRequired, capitalizeWords, toLowerCase } from '@/utils/validation';

const { fieldErrors, createBlurHandler } = useFieldValidation();

// For street_address
onBlur={(e) => {
    const handler = createBlurHandler(
        'street_address',
        (value) => validateRequired(value, 'Street address'),
        capitalizeWords
    );
    handler(e.target.value, setData);
}}

// For postal_zip_code
onBlur={(e) => {
    const handler = createBlurHandler(
        'postal_zip_code',
        (value) => validatePostalCode(value, true) // true = required
    );
    handler(e.target.value, setData);
}}
```

#### 3. Password Settings (`/pages/settings/password.tsx`)
**Fields to validate:**
- `current_password`: Required
- `password`: Min 8 chars
- `password_confirmation`: Match password

**Implementation pattern:**
```tsx
import { useFieldValidation } from '@/hooks/useFieldValidation';
import { validatePassword, validatePasswordConfirmation, validateRequired } from '@/utils/validation';

const { fieldErrors, createBlurHandler } = useFieldValidation();

// For current_password
onBlur={(e) => {
    const handler = createBlurHandler(
        'current_password',
        (value) => validateRequired(value, 'Current password')
    );
    handler(e.target.value, setData);
}}

// For password
onBlur={(e) => {
    const handler = createBlurHandler('password', validatePassword);
    handler(e.target.value, setData);
}}

// For password_confirmation
onBlur={(e) => {
    const handler = createBlurHandler(
        'password_confirmation',
        (value) => validatePasswordConfirmation(data.password, value)
    );
    handler(e.target.value, setData);
}}
```

### Tenant & User Management

#### 1. Tenant Create (`/pages/Tenants/Create.tsx`)
**Fields to validate:**
- `company_name`: Required + capitalize
- `admin_name`: Required + capitalize
- `admin_email`: Email + lowercase + required
- `admin_password`: Min 8 chars
- `admin_password_confirmation`: Match password

#### 2. User Create (`/pages/Users/Create.tsx`)
**Fields to validate:**
- `name`: Required + capitalize
- `email`: Email + lowercase + required
- `password`: Min 8 chars
- `password_confirmation`: Match password

#### 3. Public Register (`/pages/RegisterPublic.tsx`)
**Fields to validate:**
- First name + Last name (combined as `admin_name`): Required + capitalize
- `admin_email`: Email + lowercase + required
- `company_name`: Required + capitalize
- `admin_password`: Min 8 chars
- `admin_password_confirmation`: Match password

#### 4. Service Create (`/pages/Services/Create.tsx`)
**Fields to validate:**
- `name`: Required + capitalize

### Invitation Forms

#### 1. Patient Invitation (`/pages/auth/patient-invitation.tsx`)
**Fields to validate (registration flow):**
- `password`: Min 8 chars
- `password_confirmation`: Match password

#### 2. Practitioner Invitation (`/pages/auth/practitioner-invitation.tsx`)
**Fields to validate (registration flow):**
- `password`: Min 8 chars
- `password_confirmation`: Match password

## Testing Checklist

For each form, verify:
- [ ] Email fields convert to lowercase on blur
- [ ] Name fields capitalize first letter on blur
- [ ] Validation errors appear on blur (when leaving field)
- [ ] Error messages are clear and helpful
- [ ] Backend validation still works as final check
- [ ] No console errors
- [ ] Form submits correctly when valid
- [ ] Form prevents submission when invalid

## Key Points

1. **Always use `fieldErrors` first, then `errors`**: This ensures frontend validation takes precedence
   ```tsx
   <InputError message={fieldErrors.email || errors.email} />
   ```

2. **Format transformation happens on blur**: Users see formatted text after leaving field

3. **Backend validation is preserved**: Server-side validation still runs on form submission

4. **Validation is progressive**: Each field validates independently

5. **Error clearing**: Errors clear when user fixes the issue and leaves the field again

## Common Patterns

### Pattern 1: Required field with capitalization
```tsx
onBlur={(e) => {
    const handler = createBlurHandler(
        'field_name',
        (value) => validateRequired(value, 'Field Name'),
        capitalizeWords
    );
    handler(e.target.value, setData);
}}
```

### Pattern 2: Optional field with format validation
```tsx
onBlur={(e) => {
    const handler = createBlurHandler(
        'field_name',
        (value) => validatePhone(value, false) // false = optional
    );
    handler(e.target.value, setData);
}}
```

### Pattern 3: Email with lowercase
```tsx
onBlur={(e) => {
    const handler = createBlurHandler('email', validateEmail, toLowerCase);
    handler(e.target.value, setData);
}}
```

### Pattern 4: Password confirmation
```tsx
onBlur={(e) => {
    const handler = createBlurHandler(
        'password_confirmation',
        (value) => validatePasswordConfirmation(data.password, value)
    );
    handler(e.target.value, setData);
}}
```

## Backend Integration

The backend validation rules should match frontend validation. For example:

**Backend (FormRequest):**
```php
public function rules(): array
{
    return [
        'first_name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'email', 'lowercase'],
        'password' => ['required', 'min:8', 'confirmed'],
    ];
}
```

**Frontend validation automatically:**
- Capitalizes first_name
- Lowercases email
- Validates password length
- Checks password confirmation match

## Troubleshooting

**Issue: Formatter not working**
- Check that formatter function is passed as third parameter
- Verify setData is passed to handler

**Issue: Validation not triggering**
- Ensure onBlur is added to Input component
- Check that createBlurHandler is called correctly
- Verify useFieldValidation hook is initialized

**Issue: Backend errors not showing**
- Make sure InputError uses `fieldErrors.field || errors.field`
- Check that server-side validation is still configured

## Next Steps

1. Apply validation to remaining forms following this guide
2. Test each form thoroughly
3. Verify all name fields capitalize properly
4. Verify all email fields convert to lowercase
5. Ensure all validation messages are user-friendly
