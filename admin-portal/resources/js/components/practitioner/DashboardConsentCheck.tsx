import React, { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import PractitionerOathModal from './PractitionerOathModal';

interface DashboardConsentCheckProps {
    children: React.ReactNode;
}

export default function DashboardConsentCheck({ children }: DashboardConsentCheckProps) {
    const [showOathModal, setShowOathModal] = useState(false);
    const [oathAccepted, setOathAccepted] = useState(false);
    
    const pageProps = usePage<any>().props;
    const user = pageProps.auth?.user;
    // Check table records instead of roles
    const isPractitioner = user?.is_practitioner || user?.is_tenant_practitioner || false;

    useEffect(() => {
        // Check if practitioner has accepted the oath
        // For now, we'll show it every time for demonstration
        // In a real implementation, this would check localStorage or a database flag
        if (isPractitioner && !oathAccepted) {
            const hasAcceptedOath = localStorage.getItem('practitioner_oath_accepted');
            if (!hasAcceptedOath) {
                setShowOathModal(true);
            }
        }
    }, [isPractitioner, oathAccepted]);

    const handleOathAccept = () => {
        setOathAccepted(true);
        setShowOathModal(false);
        // Store in localStorage for this session
        localStorage.setItem('practitioner_oath_accepted', 'true');
    };

    const handleOathCancel = () => {
        // In a real implementation, this might redirect to a different page
        // or show a message that they cannot access the dashboard without accepting
        setShowOathModal(false);
    };

    return (
        <>
            {children}
            
            {/* Practitioner Oath Modal */}
            <PractitionerOathModal
                open={showOathModal}
                onAccept={handleOathAccept}
                onCancel={handleOathCancel}
            />
        </>
    );
}
