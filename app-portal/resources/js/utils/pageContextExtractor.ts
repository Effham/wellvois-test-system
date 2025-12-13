/**
 * Extract page context for AI assistant
 */
export interface PageContext {
    url: string;
    title: string;
    html?: string;
    text: string;
    form_data: FormField[];
}

export interface FormField {
    name: string;
    type: string;
    placeholder: string;
    value: string;
    label?: string;
}

/**
 * Extract current page context for AI consumption
 */
export function extractPageContext(): PageContext {
    const url = window.location.href;
    const title = document.title;

    // Get the main content area (exclude sidebar, header, etc.)
    const mainContent = document.querySelector('main') || document.body;
    
    // Extract visible text content (limited for token efficiency)
    // Remove extra whitespace and normalize
    let bodyText = mainContent.innerText
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/\n\s*\n/g, '\n') // Remove empty lines
        .trim();
    
    // Limit to 1500 characters for token efficiency
    if (bodyText.length > 1500) {
        bodyText = bodyText.substring(0, 1500) + '...';
    }

    // Extract form fields
    const formFields: FormField[] = [];
    const inputs = document.querySelectorAll('input, textarea, select');

    inputs.forEach((input) => {
        if (input instanceof HTMLInputElement || 
            input instanceof HTMLTextAreaElement || 
            input instanceof HTMLSelectElement) {
            
            // Skip certain types
            if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') {
                return;
            }

            const field: FormField = {
                name: input.name || input.id || 'unnamed',
                type: input.type || 'text',
                placeholder: input.placeholder || '',
                value: input.value || '',
            };

            // Try to find associated label
            let label = null;
            if (input.id) {
                const labelEl = document.querySelector(`label[for="${input.id}"]`);
                if (labelEl) {
                    label = labelEl.textContent?.trim();
                }
            }
            
            // Fallback: check parent label
            if (!label) {
                const parentLabel = input.closest('label');
                if (parentLabel) {
                    label = parentLabel.textContent?.trim();
                }
            }

            if (label) {
                field.label = label;
            }

            formFields.push(field);
        }
    });

    return {
        url,
        title,
        text: bodyText,
        form_data: formFields,
    };
}

/**
 * Check if query is likely app-related
 */
export function isAppRelatedQuery(query: string): boolean {
    const appKeywords = [
        'page', 'form', 'button', 'field', 'save', 'create', 'update', 'delete',
        'appointment', 'patient', 'practitioner', 'schedule', 'settings',
        'location', 'service', 'user', 'role', 'permission', 'dashboard',
        'how do i', 'how to', 'where is', 'what is on', 'current page',
        'this page', 'here', 'upload', 'download', 'edit', 'view',
    ];

    const queryLower = query.toLowerCase();
    return appKeywords.some(keyword => queryLower.includes(keyword));
}

/**
 * Generate quick context queries
 */
export function getQuickActions() {
    return [
        {
            label: 'What is on this page?',
            query: 'What is on this page and what can I do here?',
        },
        {
            label: 'How do I use this form?',
            query: 'Can you explain the fields on this form and any constraints I should know about?',
        },
        {
            label: 'What are my next steps?',
            query: 'What are the typical next actions I should take on this page?',
        },
    ];
}

