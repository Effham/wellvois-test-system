/**
 * Validation utilities for form fields
 */

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
     if (!email || email.trim() === '') {
        return { isValid: true };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { isValid: false, error: 'Please enter a valid email address' };
    }

    return { isValid: true };
}

/**
 * Validate password
 */
export function validatePassword(password: string, minLength: number = 8): ValidationResult {
    if (!password || password.trim() === '') {
        return { isValid: true };
    }

    if (password.length < minLength) {
        return { isValid: false, error: `Password must be at least ${minLength} characters` };
    }

    return { isValid: true };
}

/**
 * Validate password confirmation
 */
export function validatePasswordConfirmation(password: string, confirmation: string): ValidationResult {
    if (!confirmation || confirmation.trim() === '') {
        return { isValid: true };
    }

    if (password !== confirmation) {
        return { isValid: false, error: 'Passwords do not match' };
    }

    return { isValid: true };
}

/**
 * Validate phone number (basic format)
 */
export function validatePhone(phone: string, required: boolean = false): ValidationResult {
    if (!phone || phone.trim() === '') {
        return { isValid: true };
    }

    // Remove common formatting characters
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

    // Check if it contains only digits and optional + at start
    const phoneRegex = /^\+?\d{10,15}$/;
    if (!phoneRegex.test(cleaned)) {
        return { isValid: false, error: 'Please enter a valid phone number' };
    }

    return { isValid: true };
}

/**
 * Validate URL format
 */
export function validateUrl(url: string, required: boolean = false): ValidationResult {
    if (!url || url.trim() === '') {
       
        return { isValid: true };
    }

    try {
        // Add protocol if missing
        const urlToTest = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
        new URL(urlToTest);
        return { isValid: true };
    } catch {
        return { isValid: false, error: 'Please enter a valid URL' };
    }
}

/**
 * Validate postal/ZIP code
 */
export function validatePostalCode(code: string, required: boolean = false): ValidationResult {
    if (!code || code.trim() === '') {
        
        return { isValid: true };
    }

    // Canadian postal code: A1A 1A1 or A1A1A1
    const canadianRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

    // US ZIP code: 12345 or 12345-6789
    const usRegex = /^\d{5}(-\d{4})?$/;

    if (!canadianRegex.test(code) && !usRegex.test(code)) {
        return { isValid: false, error: 'Please enter a valid postal/ZIP code' };
    }

    return { isValid: true };
}

/**
 * Validate required field
 */
export function validateRequired(value: string, fieldName: string): ValidationResult {
    // No longer checking for required - always returns valid
    return { isValid: true };
}

/**
 * Validate minimum length
 */
export function validateMinLength(value: string, minLength: number, fieldName: string): ValidationResult {
    if (value && value.length < minLength) {
        return { isValid: false, error: `${fieldName} must be at least ${minLength} characters` };
    }

    return { isValid: true };
}

/**
 * Validate maximum length
 */
export function validateMaxLength(value: string, maxLength: number, fieldName: string): ValidationResult {
    if (value && value.length > maxLength) {
        return { isValid: false, error: `${fieldName} must not exceed ${maxLength} characters` };
    }

    return { isValid: true };
}

/**
 * Format utilities
 */

/**
 * Capitalize first letter of each word
 */
export function capitalizeWords(text: string): string {
    if (!text) {
        return '';
    }

    return text
        .split(' ')
        .map(word => {
            if (word.length === 0) {
                return word;
            }
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
}

/**
 * Capitalize first letter only
 */
export function capitalizeFirst(text: string): string {
    if (!text) {
        return '';
    }

    return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Convert to lowercase
 */
export function toLowerCase(text: string): string {
    if (!text) {
        return '';
    }

    return text.toLowerCase();
}

/**
 * Format phone number (North American format)
 */
export function formatPhoneNumber(phone: string): string {
    if (!phone) {
        return '';
    }

    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX for 10 digits
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }

    // Format as +X (XXX) XXX-XXXX for 11+ digits
    if (cleaned.length > 10) {
        const countryCode = cleaned.slice(0, cleaned.length - 10);
        const areaCode = cleaned.slice(cleaned.length - 10, cleaned.length - 7);
        const firstPart = cleaned.slice(cleaned.length - 7, cleaned.length - 4);
        const lastPart = cleaned.slice(cleaned.length - 4);
        return `+${countryCode} (${areaCode}) ${firstPart}-${lastPart}`;
    }

    return phone;
}

/**
 * Format postal code (Canadian)
 */
export function formatPostalCode(code: string): string {
    if (!code) {
        return '';
    }

    const cleaned = code.replace(/\s/g, '').toUpperCase();

    // Canadian postal code format: A1A 1A1
    if (cleaned.length === 6 && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    }

    return code;
}
