import { useState, useEffect, useCallback } from 'react';
import { router } from '@inertiajs/react';

interface DashboardData {
    upcomingAppointments: Array<{
        id: string;
        date: string;
        time: string;
        practitioner: string;
        service: string;
        location: string;
        mode: string;
        tenant_id?: string;
    }>;
    currentMedications: Array<{
        id: string;
        name: string;
        dosage: string;
        frequency: string;
        purpose: string;
        prescribing_doctor: string;
        tenant_id?: string;
    }>;
    recentVisits: Array<{
        id: string;
        date: string;
        practitioner: string;
        service: string;
        status: string;
        summary: string;
        follow_up?: string;
        tenant_id?: string;
    }>;
    quickStats: {
        nextAppointment?: string;
        activeMedications: number;
        visitsThisYear: number;
    };
    patientInfo: {
        name: string;
        email: string;
        tenant_count?: number;
        current_tenant?: string;
    };
}

interface UseDashboardDataOptions {
    isCentral?: boolean;
}

export function useDashboardData(options: UseDashboardDataOptions = {}) {
    const { isCentral = false } = options;
    const [data, setData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // Determine the correct API endpoint based on context
                const endpoint = isCentral
                    ? '/api/patient-dashboard/data'  // Central endpoint
                    : '/api/patient-dashboard/data'; // Tenant endpoint

                const response = await fetch(endpoint, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    },
                    credentials: 'same-origin',
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const responseData = await response.json();
                setData(responseData);
            } catch (err) {
                console.error('Failed to fetch dashboard data:', err);
                setError(err instanceof Error ? err.message : 'Failed to load dashboard data');

                // Fallback to mock data in case of error
                setData({
                    upcomingAppointments: [],
                    currentMedications: [],
                    recentVisits: [],
                    quickStats: {
                        activeMedications: 0,
                        visitsThisYear: 0
                    },
                    patientInfo: {
                        name: 'Unknown Patient',
                        email: 'unknown@example.com'
                    }
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [isCentral]);

    // Function to refresh data
    const refreshData = useCallback(() => {
        setIsLoading(true);
        setError(null);

        // Re-trigger the effect by updating a dependency
        const fetchDashboardData = async () => {
            try {
                const endpoint = isCentral
                    ? '/api/patient-dashboard/data'
                    : '/api/patient-dashboard/data';

                const response = await fetch(endpoint, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    },
                    credentials: 'same-origin',
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const responseData = await response.json();
                setData(responseData);
            } catch (err) {
                console.error('Failed to refresh dashboard data:', err);
                setError(err instanceof Error ? err.message : 'Failed to refresh dashboard data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [isCentral]);

    return {
        data,
        isLoading,
        error,
        refreshData
    };
}