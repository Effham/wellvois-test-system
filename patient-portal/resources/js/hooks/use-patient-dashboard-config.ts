import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    PatientDashboardConfig,
    DashboardSectionConfig,
    DEFAULT_PATIENT_DASHBOARD_CONFIG
} from '@/types/patient-dashboard-config';

interface UseDashboardConfigOptions {
    isCentral?: boolean;
    organizationSettings?: Record<string, any>;
    userPreferences?: Record<string, any>;
}

export function usePatientDashboardConfig(options: UseDashboardConfigOptions = {}) {
    const { isCentral = false, organizationSettings = {}, userPreferences = {} } = options;

    const [config, setConfig] = useState<PatientDashboardConfig>(DEFAULT_PATIENT_DASHBOARD_CONFIG);
    const [isLoading, setIsLoading] = useState(true);

    // Load configuration from various sources
    useEffect(() => {
        const loadConfiguration = () => {
            setIsLoading(true);

            try {
                // Start with default configuration
                let finalConfig = { ...DEFAULT_PATIENT_DASHBOARD_CONFIG };

                // Apply organization-level overrides
                if (organizationSettings?.patient_dashboard_config) {
                    finalConfig = mergeConfigurations(finalConfig, organizationSettings.patient_dashboard_config);
                }

                // Apply user-level preferences
                if (userPreferences?.dashboard_config) {
                    finalConfig = mergeConfigurations(finalConfig, userPreferences.dashboard_config);
                }

                // Apply context-specific modifications
                if (isCentral) {
                    // In central context, enable tenant switcher and clinic filter
                    finalConfig.filters.showTenantSwitcher = true;
                    finalConfig.filters.showClinicFilter = true;
                    finalConfig.filters.defaultView = 'all';
                } else {
                    // In tenant context, hide tenant switcher
                    finalConfig.filters.showTenantSwitcher = false;
                    finalConfig.filters.showClinicFilter = false;
                    finalConfig.filters.defaultView = 'current-tenant';
                }

                setConfig(finalConfig);
            } catch (error) {
                console.error('Failed to load dashboard configuration:', error);
                // Fall back to default configuration
                setConfig(DEFAULT_PATIENT_DASHBOARD_CONFIG);
            } finally {
                setIsLoading(false);
            }
        };

        loadConfiguration();
        // Remove the object dependencies and only depend on isCentral
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCentral]);

    // Get enabled sections in order
    const enabledSections = useMemo(() => {
        return Object.values(config.sections)
            .filter(section => section.enabled)
            .sort((a, b) => a.order - b.order);
    }, [config.sections]);

    // Get enabled widgets for a section
    const getEnabledWidgets = useCallback((sectionId: string) => {
        const section = config.sections[sectionId as keyof typeof config.sections];
        if (!section) return [];

        return section.widgets
            .filter(widget => widget.enabled)
            .sort((a, b) => a.order - b.order);
    }, [config.sections]);

    // Check if a specific section is enabled
    const isSectionEnabled = useCallback((sectionId: string) => {
        const section = config.sections[sectionId as keyof typeof config.sections];
        return section?.enabled ?? false;
    }, [config.sections]);

    // Check if a specific widget is enabled
    const isWidgetEnabled = useCallback((sectionId: string, widgetId: string) => {
        const section = config.sections[sectionId as keyof typeof config.sections];
        if (!section?.enabled) return false;

        const widget = section.widgets.find(w => w.id === widgetId);
        return widget?.enabled ?? false;
    }, [config.sections]);

    // Update configuration (for admin/settings use)
    const updateConfig = useCallback((newConfig: Partial<PatientDashboardConfig>) => {
        setConfig(current => mergeConfigurations(current, newConfig));
    }, []);

    // Toggle section enabled/disabled
    const toggleSection = useCallback((sectionId: string) => {
        setConfig(current => ({
            ...current,
            sections: {
                ...current.sections,
                [sectionId]: {
                    ...current.sections[sectionId as keyof typeof current.sections],
                    enabled: !current.sections[sectionId as keyof typeof current.sections]?.enabled
                }
            }
        }));
    }, []);

    // Toggle widget enabled/disabled
    const toggleWidget = useCallback((sectionId: string, widgetId: string) => {
        setConfig(current => {
            const section = current.sections[sectionId as keyof typeof current.sections];
            if (!section) return current;

            const updatedWidgets = section.widgets.map(widget =>
                widget.id === widgetId
                    ? { ...widget, enabled: !widget.enabled }
                    : widget
            );

            return {
                ...current,
                sections: {
                    ...current.sections,
                    [sectionId]: {
                        ...section,
                        widgets: updatedWidgets
                    }
                }
            };
        });
    }, []);

    return {
        config,
        isLoading,
        enabledSections,
        getEnabledWidgets,
        isSectionEnabled,
        isWidgetEnabled,
        updateConfig,
        toggleSection,
        toggleWidget
    };
}

// Helper function to deep merge configurations
function mergeConfigurations(base: PatientDashboardConfig, override: Partial<PatientDashboardConfig>): PatientDashboardConfig {
    const merged = { ...base };

    if (override.sections) {
        merged.sections = { ...base.sections };
        Object.keys(override.sections).forEach(sectionKey => {
            const key = sectionKey as keyof typeof override.sections;
            if (override.sections[key]) {
                merged.sections[key] = {
                    ...base.sections[key],
                    ...override.sections[key],
                    widgets: override.sections[key]?.widgets || base.sections[key]?.widgets || []
                };
            }
        });
    }

    if (override.layout) {
        merged.layout = { ...base.layout, ...override.layout };
    }

    if (override.filters) {
        merged.filters = { ...base.filters, ...override.filters };
    }

    return merged;
}

// Hook to get section layout properties
export function useSectionLayout(section: DashboardSectionConfig, globalLayout: PatientDashboardConfig['layout']) {
    return useMemo(() => {
        const sectionLayout = section.layout || {};
        const gridSpan = sectionLayout.gridSpan || 1;
        const columns = sectionLayout.columns || globalLayout.gridColumns;

        return {
            gridSpan,
            columns,
            className: `lg:col-span-${gridSpan}`,
            gridColumns: globalLayout.gridColumns,
            compactMode: globalLayout.compactMode
        };
    }, [section.layout, globalLayout]);
}