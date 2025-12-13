import { z } from 'zod';
import { useState, useCallback } from 'react';

type ValidationErrors = Record<string, string>;

export function useEnhancedZodValidation<T extends z.ZodType>(schema: T) {
    const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});

    const validate = useCallback((data: unknown): { success: true } | { success: false; errors: ValidationErrors } => {
        try {
            schema.parse(data);
            return { success: true };
        } catch (error:any) {
            if (error instanceof z.ZodError) {
                const errors: ValidationErrors = {};
                if (error.errors && Array.isArray(error.errors)) {
                    error.errors.forEach((err) => {
                        const path = err.path.join('.');
                        errors[path] = err.message;
                    });
                }
                return { success: false, errors };
            }
            console.error('Validation error:', error);
            return { success: false, errors: { _general: 'An unexpected validation error occurred' } };
        }
    }, [schema]);

const validateField = useCallback((fieldName: string, value: unknown): string | null => {
  if (schema instanceof z.ZodObject) {
    const fieldSchema = (schema as z.ZodObject<any>).shape?.[fieldName];
    

    if (!fieldSchema) return null;

    const result = fieldSchema.safeParse(value);
    // <- this will always run

    if (!result.success) {
   // first message if available
      return result.error.issues[0]?.message ?? 'Invalid value';
    }
    return null;
  }
  
  return null;
}, [schema]);



    const validateFieldOnBlur = useCallback((fieldName: string, value: unknown) => {
        

        const error = validateField(fieldName, value);
        
        setFieldErrors(prev => ({
            ...prev,
            [fieldName]: error || ''
        }));
        return error;
    }, [validateField]);

    const clearFieldError = useCallback((fieldName: string) => {
        setFieldErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[fieldName];
            return newErrors;
        });
    }, []);

    const clearAllErrors = useCallback(() => {
        setFieldErrors({});
    }, []);

    const getFieldError = useCallback((fieldName: string): string | undefined => {
        return fieldErrors[fieldName] || undefined;
    }, [fieldErrors]);

    return {
        validate,
        validateField,
        validateFieldOnBlur,
        clearFieldError,
        clearAllErrors,
        getFieldError,
        fieldErrors,
        setFieldErrors
    };
}
