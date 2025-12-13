/**
 * Input masking utilities for Stripe Connect forms
 */

/**
 * Mask postal code based on country
 * Canadian: A1A 1A1
 * US: 12345 or 12345-6789
 */
export function maskPostalCode(value: string, countryCode: string = 'US'): string {
    if (!value) return '';
    
    // Remove all non-alphanumeric characters
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    if (countryCode === 'CA') {
        // Canadian postal code: A1A 1A1 (6 characters)
        if (cleaned.length <= 3) {
            return cleaned;
        }
        if (cleaned.length <= 6) {
            return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
        }
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)}`;
    } else {
        // US ZIP code: 12345 or 12345-6789
        if (cleaned.length <= 5) {
            return cleaned;
        }
        if (cleaned.length <= 9) {
            return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
        }
        return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 9)}`;
    }
}

/**
 * Format phone number (North American format)
 * (XXX) XXX-XXXX
 */
export function maskPhoneNumber(value: string): string {
    if (!value) return '';
    
    // Remove all non-digit characters
    const cleaned = value.replace(/\D/g, '');
    
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 3) return `(${cleaned}`;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    if (cleaned.length <= 10) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    
    // For longer numbers (with country code), just format the last 10 digits
    const last10 = cleaned.slice(-10);
    return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
}

/**
 * Mask Tax ID / EIN (XX-XXXXXXX)
 */
export function maskTaxId(value: string): string {
    if (!value) return '';
    
    // Remove all non-alphanumeric characters
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    if (cleaned.length <= 2) {
        return cleaned;
    }
    if (cleaned.length <= 9) {
        return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
    }
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 9)}`;
}

/**
 * Mask SSN last 4 (XXXX - only digits)
 */
export function maskSSNLast4(value: string): string {
    if (!value) return '';
    
    // Only allow digits, max 4
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    return cleaned;
}

/**
 * Get unmasked value (remove formatting)
 */
export function unmaskValue(value: string): string {
    if (!value) return '';
    // Remove common formatting characters
    return value.replace(/[^A-Za-z0-9]/g, '');
}


