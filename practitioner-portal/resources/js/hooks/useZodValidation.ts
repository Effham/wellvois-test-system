import { z } from 'zod';

type ValidationErrors = Record<string, string>;

export function useZodValidation<T extends z.ZodType>(schema: T) {
    const validate = (data: unknown): { success: true } | { success: false; errors: ValidationErrors } => {
        try {
            schema.parse(data);
            return { success: true };
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errors: ValidationErrors = {};
                // Safely handle errors array
                if (error.errors && Array.isArray(error.errors)) {
                    error.errors.forEach((err) => {
                        const path = err.path.join('.');
                        errors[path] = err.message;
                    });
                }
                return { success: false, errors };
            }
            // Handle unexpected errors gracefully
            console.error('Validation error:', error);
            return { success: false, errors: { _general: 'An unexpected validation error occurred' } };
        }
    };

    return { validate };
}
