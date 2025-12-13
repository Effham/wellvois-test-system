// Original public-portal-layout.tsx
// For now, this imports and uses the v2 layout while preserving the original interface
// The original complex logic is preserved in git history and can be restored when needed

import React from 'react';
import PublicPortalLayoutV2 from './public-portal-layout-v2';

interface Props {
    children: React.ReactNode;
    title?: string;
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
        navigation?: {
            items?: Array<{
                id: string;
                label: string;
                enabled: boolean;
                customLabel?: string;
                order: number;
            }>;
        };
        appearance?: {
            colors?: {
                use_custom: boolean;
                primary: string;
                accent: string;
            };
            typography?: {
                use_custom: boolean;
                heading_font: string;
                body_font: string;
            };
            footer?: {
                enabled: boolean;
                copyright: string;
                links: Array<{ label: string; url: string }>;
            };
        };
    };
    requireLogout?: boolean;
    redirectAfterLogout?: string;
}

// Temporary wrapper that uses v2 layout but maintains original route compatibility
export default function PublicPortalLayout(props: Props) {
    // Simply wrap the v2 layout component
    // This preserves the original interface while using the new v2 logic
    return <PublicPortalLayoutV2 {...props} />;
}