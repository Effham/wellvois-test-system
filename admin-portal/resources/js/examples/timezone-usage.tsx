/**
 * Example: How to Display Appointment Times with the New Location Timezone System
 *
 * The backend now handles all timezone conversions based on the clinic's location.
 * Frontend components simply display the pre-converted times received from the backend.
 *
 * No more client-side timezone conversion needed!
 */

import React from 'react';
import {
    formatAppointmentDateTime,
    formatAppointmentDate,
    formatAppointmentTime,
    getAppointmentLocationTimezone
} from '@/utils/time-locale-helpers';

// Example appointment object as received from backend
const exampleAppointment = {
    id: 123,
    location_id: 1,

    // UTC times (stored in database)
    appointment_datetime: '2025-09-25T13:00:00Z',
    start_time: '2025-09-25T13:00:00Z',
    end_time: '2025-09-25T14:00:00Z',

    // Pre-converted times for display (provided by backend)
    appointment_datetime_local: '2025-09-25T08:00:00',
    start_time_local: '2025-09-25T08:00:00',
    end_time_local: '2025-09-25T09:00:00',

    // Formatted strings (provided by backend)
    formatted_date: '2025-09-25',
    formatted_time: '08:00',
    formatted_datetime: '2025-09-25 08:00',

    // Location timezone info (provided by backend)
    location_timezone: 'America/New_York',
    location_timezone_abbr: 'EST/EDT',
    stored_timezone: 'America/New_York'
};

// Example component showing different ways to display appointment times
export const AppointmentTimeDisplay: React.FC = () => {
    return (
        <div className="appointment-display">
            <h3>Appointment Time Display Examples</h3>

            {/* Method 1: Use the formatted strings directly */}
            <div className="example">
                <h4>Method 1: Direct formatted display</h4>
                <p>Date: {exampleAppointment.formatted_date}</p>
                <p>Time: {exampleAppointment.formatted_time}</p>
                <p>Date & Time: {exampleAppointment.formatted_datetime}</p>
            </div>

            {/* Method 2: Use the helper functions */}
            <div className="example">
                <h4>Method 2: Helper functions</h4>
                <p>Full DateTime: {formatAppointmentDateTime(exampleAppointment)}</p>
                <p>Date Only: {formatAppointmentDate(exampleAppointment)}</p>
                <p>Time Only: {formatAppointmentTime(exampleAppointment)}</p>
                <p>Timezone: {getAppointmentLocationTimezone(exampleAppointment)}</p>
            </div>

            {/* Method 3: Direct access to timezone abbreviation */}
            <div className="example">
                <h4>Method 3: With timezone abbreviation</h4>
                <p>
                    Appointment: {exampleAppointment.formatted_datetime}
                    ({exampleAppointment.location_timezone_abbr})
                </p>
            </div>
        </div>
    );
};

// Example of how to handle appointment creation form
export const AppointmentCreationExample: React.FC = () => {
    // When creating appointments, you send the local time string
    // along with the location_id to the backend
    const handleSubmit = (formData: any) => {
        const appointmentData = {
            // The user selects these in the clinic's local timezone
            appointment_date: '2025-09-25',
            appointment_time: '08:00',
            location_id: 1, // Important: location determines timezone

            // Other appointment data...
            service_id: formData.service_id,
            practitioner_ids: formData.practitioner_ids,
            // ...
        };

        // Backend will:
        // 1. Get location timezone (e.g., 'America/New_York')
        // 2. Convert '2025-09-25 08:00' from EST to UTC for storage
        // 3. Store UTC time in database

        // Frontend just sends the local time and location_id
        // No timezone conversion needed on the frontend!
        console.log('Sending to backend:', appointmentData);
    };

    return (
        <div>
            <h3>Appointment Creation</h3>
            <p>Frontend sends local time + location_id</p>
            <p>Backend handles timezone conversion to UTC</p>
        </div>
    );
};

// Example of how appointments are displayed in lists/tables
export const AppointmentListExample: React.FC<{appointments: any[]}> = ({ appointments }) => {
    return (
        <table>
            <thead>
                <tr>
                    <th>Patient</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Timezone</th>
                </tr>
            </thead>
            <tbody>
                {appointments.map(appointment => (
                    <tr key={appointment.id}>
                        <td>{appointment.patient_name}</td>
                        <td>{appointment.formatted_date}</td>
                        <td>{appointment.formatted_time}</td>
                        <td>{appointment.location_timezone_abbr}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

// Key Points:
//
// 1. ✅ Backend provides all converted times
// 2. ✅ Frontend displays times directly (no conversion needed)
// 3. ✅ Each appointment shows times in its location's timezone
// 4. ✅ Timezone abbreviation shown for clarity
// 5. ✅ UTC stored in database for consistency
// 6. ✅ Location timezone determines display timezone
// 7. ✅ No more client-side timezone confusion!