# Zod Validation Rules

This document outlines all the validation rules implemented across the application.

## Common Field Validations

### Name Fields (First Name, Last Name)
- **Required**: Yes
- **Min Length**: 2 characters
- **Max Length**: 50 characters
- **Format Rules**:
  - Must start with a capital letter (e.g., "John", "Mary")
  - Can only contain letters, spaces, hyphens, and apostrophes
  - Examples: "John", "Mary-Ann", "O'Brien", "De La Cruz"
  - Invalid: "john" (lowercase), "John123" (numbers), "John@" (special chars)

### Email Address
- **Required**: Yes (in most forms)
- **Min Length**: 1 character
- **Max Length**: 255 characters
- **Format Rules**:
  - Must be a valid email format (name@domain.com)
  - Examples: "john@example.com", "mary.smith@company.co.uk"
  - Invalid: "notanemail", "missing@domain", "@domain.com"

### Phone Number
- **Required**: Yes
- **Min Length**: 10 digits
- **Max Length**: 20 characters
- **Format Rules**:
  - Must contain at least 10 digits
  - Can contain digits, spaces, dashes, plus signs, and parentheses
  - Examples: "555-123-4567", "(555) 123-4567", "+1 555 123 4567"
  - Invalid: "123" (too short), "abc123" (letters), "555.123.4567" (periods)

### Password
- **Required**: Yes
- **Min Length**: 8 characters
- **Max Length**: 128 characters
- **Format Rules**:
  - At least one uppercase letter (A-Z)
  - At least one lowercase letter (a-z)
  - At least one number (0-9)
  - At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
  - Examples: "MyPass123!", "SecureP@ssw0rd"
  - Invalid: "password" (no uppercase/numbers/special), "PASSWORD123" (no lowercase/special)

### Health Card Number
- **Required**: Yes
- **Min Length**: 5 characters
- **Max Length**: 30 characters
- **Format Rules**:
  - Can only contain letters, numbers, and hyphens
  - Examples: "ABC-12345", "1234567890", "AB1234-CD5678"
  - Invalid: "123" (too short), "ABC 123" (spaces), "ABC@123" (special chars)

### Date of Birth
- **Required**: Yes
- **Format**: YYYY-MM-DD
- **Examples**: "1990-05-15", "2000-12-31"
- **Invalid**: "05/15/1990", "15-05-1990", "1990/05/15"

## Form-Specific Validations

### Patient Form
- All common validations apply
- **Address**: Optional, max 500 characters
- **Notes**: Optional, max 1000 characters
- **Gender**: Must select from dropdown (male/female/other)

### Service Form
- **Service Name**: Required, 3-255 characters
- **Description**: Optional, max 2000 characters
- **Duration**: Optional, 1-1440 minutes (24 hours max)
- **Price**: Optional, $0-$999,999.99

### Location Form
- **Location Name**: Required, 3-255 characters
- **Address**: Required, 5-500 characters
- **City**: Required, 2-100 characters
- **State/Province**: Optional, max 100 characters
- **Postal Code**: Optional, max 20 characters
- **Country**: Required, 2-100 characters

### Public Portal Registration
- All common validations apply
- **Preferred Name**: Optional, max 50 characters
- **Gender/Pronouns**: Required, max 50 characters
- **Client Type**: Must select from dropdown (individual/couple/family/group)
- **Notes**: Optional, max 1000 characters
- **Password Confirmation**: Must match password exactly

## Validation Error Messages

All validation errors are displayed:
1. **Frontend**: Immediately on form submission via Zod
2. **Backend**: Server-side validation errors are also displayed
3. **Combined**: Frontend and backend errors are shown together

## Tips for Users

### Names
- Always capitalize the first letter: "John" not "john"
- Use hyphens for compound names: "Mary-Ann"
- Use apostrophes for names like: "O'Brien"

### Phone Numbers
- Include area code and at least 10 digits
- Use any common format: (555) 123-4567 or 555-123-4567

### Passwords
- Create strong passwords with mixed case, numbers, and symbols
- Example: "MySecure@Pass123"

### Health Cards
- Enter exactly as shown on your card
- Include hyphens if present: "ABC-12345-DEF"

## Validation Bypass

**Important**: These are frontend validations only. Backend validation is always enforced and cannot be bypassed for security reasons.

