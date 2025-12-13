import { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { route } from 'ziggy-js';

export interface FoundPatient {
    id: number;
    health_number: string;
    first_name: string;
    middle_name?: string;
    last_name: string;
    preferred_name?: string;
    date_of_birth?: string;
    gender?: string;
    gender_pronouns?: string;
    phone_number?: string;
    email?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    contact_person?: string;
    preferred_language?: string;
    client_type?: string;
}

export interface PatientSummary {
    id: number;
    health_number: string;
    first_name: string;
    last_name: string;
    email?: string;
    date_of_birth?: string;
}

export type SearchMethod = 'health_card' | 'email' | 'name' | null;

interface UsePatientSearchReturn {
    searching: boolean;
    foundPatient: FoundPatient | null;
    multipleMatches: PatientSummary[];
    searchMethod: SearchMethod;
    hasConflict: boolean;
    conflictingPatient: PatientSummary | null;
    clearFoundPatient: () => void;
    clearAll: () => void;
    searchByHealthNumber: (healthNumber: string) => Promise<void>;
    searchByEmail: (email: string) => Promise<void>;
    searchByName: (firstName: string, lastName: string) => Promise<void>;
    selectFromMultiple: (patientId: number) => Promise<void>;
}

/**
 * Hook for searching existing patients by health card number, email, or name
 * Provides debounced search, auto-fill capabilities, and conflict detection
 */
export function usePatientSearch(): UsePatientSearchReturn {
    const [searching, setSearching] = useState(false);
    const [foundPatient, setFoundPatient] = useState<FoundPatient | null>(null);
    const [multipleMatches, setMultipleMatches] = useState<PatientSummary[]>([]);
    const [searchMethod, setSearchMethod] = useState<SearchMethod>(null);
    const [hasConflict, setHasConflict] = useState(false);
    const [conflictingPatient, setConflictingPatient] = useState<PatientSummary | null>(null);

    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastFoundPatientIdRef = useRef<number | null>(null);
    const lastSearchMethodRef = useRef<SearchMethod>(null);

    /**
     * Clear the found patient state
     */
    const clearFoundPatient = useCallback(() => {
        setFoundPatient(null);
        setMultipleMatches([]);
        setHasConflict(false);
        setConflictingPatient(null);
        setSearchMethod(null);
        lastFoundPatientIdRef.current = null;
        lastSearchMethodRef.current = null;
    }, []);

    /**
     * Clear all state
     */
    const clearAll = useCallback(() => {
        clearFoundPatient();
        setSearching(false);
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
    }, [clearFoundPatient]);

    /**
     * Detect conflicts when different search methods find different patients
     */
    const detectConflict = useCallback((newPatientId: number, newSearchMethod: SearchMethod, newPatientSummary: PatientSummary) => {
        if (lastFoundPatientIdRef.current && lastSearchMethodRef.current &&
            lastFoundPatientIdRef.current !== newPatientId &&
            lastSearchMethodRef.current !== newSearchMethod) {
            setHasConflict(true);
            setConflictingPatient(newPatientSummary);
            return true;
        }
        return false;
    }, []);

    /**
     * Search for a patient by health card number with debouncing
     * @param healthNumber - The health card number to search for
     */
    const searchByHealthNumber = useCallback(async (healthNumber: string) => {
        // Clear any existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Clear found patient if health number is empty or too short
        if (!healthNumber || healthNumber.length < 3) {
            clearFoundPatient();
            return;
        }

        // Set up debounced search (500ms delay)
        debounceTimerRef.current = setTimeout(async () => {
            setSearching(true);

            try {
                // First, check if health number exists
                const checkResponse = await axios.post(route('patients.check-health-number'), {
                    health_number: healthNumber,
                });

                if (checkResponse.data.status === 'exists_in_tenant' && checkResponse.data.patient_id) {
                    // Fetch full patient details for auto-fill
                    const detailsResponse = await axios.post(route('patients.get-for-autofill'), {
                        patient_id: checkResponse.data.patient_id,
                    });

                    if (detailsResponse.data.patient) {
                        const patient = detailsResponse.data.patient;
                        const patientSummary: PatientSummary = {
                            id: patient.id,
                            health_number: patient.health_number,
                            first_name: patient.first_name,
                            last_name: patient.last_name,
                            email: patient.email,
                            date_of_birth: patient.date_of_birth,
                        };

                        // Check for conflict
                        if (!detectConflict(patient.id, 'health_card', patientSummary)) {
                            setFoundPatient(patient);
                            setSearchMethod('health_card');
                            setMultipleMatches([]);
                            lastFoundPatientIdRef.current = patient.id;
                            lastSearchMethodRef.current = 'health_card';
                        }
                    } else {
                        clearFoundPatient();
                    }
                } else {
                    clearFoundPatient();
                }
            } catch (error) {
                console.error('Error searching for patient by health number:', error);
                clearFoundPatient();
            } finally {
                setSearching(false);
            }
        }, 500);
    }, [clearFoundPatient, detectConflict]);

    /**
     * Search for a patient by email with debouncing
     * @param email - The email address to search for
     */
    const searchByEmail = useCallback(async (email: string) => {
        // Clear any existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Clear found patient if email is empty or too short
        if (!email || email.length < 3) {
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return;
        }

        // Set up debounced search (500ms delay)
        debounceTimerRef.current = setTimeout(async () => {
            setSearching(true);

            try {
                const response = await axios.post(route('patients.search-by-email'), {
                    email: email,
                });

                if (response.data.status === 'found' && response.data.patient) {
                    const patientSummary = response.data.patient;

                    // Check for conflict
                    if (!detectConflict(patientSummary.id, 'email', patientSummary)) {
                        // Fetch full patient details for auto-fill
                        const detailsResponse = await axios.post(route('patients.get-for-autofill'), {
                            patient_id: patientSummary.id,
                        });

                        if (detailsResponse.data.patient) {
                            setFoundPatient(detailsResponse.data.patient);
                            setSearchMethod('email');
                            setMultipleMatches([]);
                            lastFoundPatientIdRef.current = patientSummary.id;
                            lastSearchMethodRef.current = 'email';
                        }
                    }
                }
            } catch (error) {
                console.error('Error searching for patient by email:', error);
            } finally {
                setSearching(false);
            }
        }, 500);
    }, [detectConflict]);

    /**
     * Search for patients by first name and last name with debouncing
     * @param firstName - The first name to search for
     * @param lastName - The last name to search for
     */
    const searchByName = useCallback(async (firstName: string, lastName: string) => {
        // Clear any existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Clear found patient if either name is empty or too short
        if (!firstName || firstName.length < 2 || !lastName || lastName.length < 2) {
            return;
        }

        // Set up debounced search (500ms delay)
        debounceTimerRef.current = setTimeout(async () => {
            setSearching(true);

            try {
                const response = await axios.post(route('patients.search-by-name'), {
                    first_name: firstName,
                    last_name: lastName,
                });

                if (response.data.status === 'found' && response.data.patients) {
                    const patients = response.data.patients;

                    if (patients.length === 1) {
                        // Single match - fetch full details
                        const patientSummary = patients[0];

                        // Check for conflict
                        if (!detectConflict(patientSummary.id, 'name', patientSummary)) {
                            const detailsResponse = await axios.post(route('patients.get-for-autofill'), {
                                patient_id: patientSummary.id,
                            });

                            if (detailsResponse.data.patient) {
                                setFoundPatient(detailsResponse.data.patient);
                                setSearchMethod('name');
                                setMultipleMatches([]);
                                lastFoundPatientIdRef.current = patientSummary.id;
                                lastSearchMethodRef.current = 'name';
                            }
                        }
                    } else if (patients.length > 1) {
                        // Multiple matches - show selection UI
                        setMultipleMatches(patients);
                        setFoundPatient(null);
                        setSearchMethod('name');
                    }
                }
            } catch (error) {
                console.error('Error searching for patient by name:', error);
            } finally {
                setSearching(false);
            }
        }, 500);
    }, [detectConflict]);

    /**
     * Select a specific patient from multiple matches
     * @param patientId - The ID of the patient to select
     */
    const selectFromMultiple = useCallback(async (patientId: number) => {
        setSearching(true);

        try {
            const detailsResponse = await axios.post(route('patients.get-for-autofill'), {
                patient_id: patientId,
            });

            if (detailsResponse.data.patient) {
                setFoundPatient(detailsResponse.data.patient);
                setMultipleMatches([]);
                lastFoundPatientIdRef.current = patientId;
                lastSearchMethodRef.current = searchMethod;
            }
        } catch (error) {
            console.error('Error fetching selected patient:', error);
        } finally {
            setSearching(false);
        }
    }, [searchMethod]);

    return {
        searching,
        foundPatient,
        multipleMatches,
        searchMethod,
        hasConflict,
        conflictingPatient,
        clearFoundPatient,
        clearAll,
        searchByHealthNumber,
        searchByEmail,
        searchByName,
        selectFromMultiple,
    };
}
