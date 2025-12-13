import { useState, useCallback } from 'react';
import { ValidationResult } from '@/utils/validation';

interface FieldValidationState {
    [key: string]: string;
}

/**
 * Hook for managing field-level validation
 * Provides onBlur handlers and error state management
 */
export function useFieldValidation() {
    const [fieldErrors, setFieldErrors] = useState<FieldValidationState>({});

    /**
     * Clear error for a specific field
     */
    const clearFieldError = useCallback((fieldName: string) => {
        setFieldErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[fieldName];
            return newErrors;
        });
    }, []);

    /**
     * Set error for a specific field
     */
    const setFieldError = useCallback((fieldName: string, error: string) => {
        setFieldErrors(prev => ({
            ...prev,
            [fieldName]: error
        }));
    }, []);

    /**
     * Clear all field errors
     */
    const clearAllErrors = useCallback(() => {
        setFieldErrors({});
    }, []);

    /**
     * Create a validation handler for onBlur event
     * @param fieldName - Name of the field
     * @param validator - Validation function that returns ValidationResult
     * @param formatter - Optional formatter function to transform the value
     */
    const createBlurHandler = useCallback(
        (
            fieldName: string,
            validator: (value: string) => ValidationResult,
            formatter?: (value: string) => string
        ) => {
            return (value: string, setValue: (field: string, value: string) => void) => {
                // Apply formatter if provided
                if (formatter) {
                    const formattedValue = formatter(value);
                    if (formattedValue !== value) {
                        setValue(fieldName, formattedValue);
                    }
                    // Validate the formatted value
                    const result = validator(formattedValue);
                    if (!result.isValid && result.error) {
                        setFieldError(fieldName, result.error);
                    } else {
                        clearFieldError(fieldName);
                    }
                } else {
                    // Just validate without formatting
                    const result = validator(value);
                    if (!result.isValid && result.error) {
                        setFieldError(fieldName, result.error);
                    } else {
                        clearFieldError(fieldName);
                    }
                }
            };
        },
        [setFieldError, clearFieldError]
    );

    /**
     * Validate multiple fields at once
     * Useful for form submission
     */
    const validateFields = useCallback(
        (validations: { fieldName: string; validator: (value: string) => ValidationResult; value: string }[]) => {
            let isValid = true;
            const errors: FieldValidationState = {};

            validations.forEach(({ fieldName, validator, value }) => {
                const result = validator(value);
                if (!result.isValid && result.error) {
                    errors[fieldName] = result.error;
                    isValid = false;
                }
            });

            setFieldErrors(errors);
            return isValid;
        },
        []
    );

    /**
     * Check if there are any field errors
     */
    const hasErrors = useCallback(() => {
        return Object.keys(fieldErrors).length > 0;
    }, [fieldErrors]);

    return {
        fieldErrors,
        clearFieldError,
        setFieldError,
        clearAllErrors,
        createBlurHandler,
        validateFields,
        hasErrors,
    };
}
