import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { router } from '@inertiajs/react';
import axios from 'axios';
import React, { useRef, useState } from 'react';
import { route } from 'ziggy-js';

interface PatientInvitationModalProps {
    isInviteModalOpen: boolean;
    setInviteModalOpen: (open: boolean) => void;
    selectedPatient: any;
    setSelectedPatient: (patient: any | null) => void;
}

const PatientInvitationModal: React.FC<PatientInvitationModalProps> = ({
    isInviteModalOpen,
    setInviteModalOpen,
    selectedPatient,
    setSelectedPatient,
}) => {
    const [emailValidationMessage, setEmailValidationMessage] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [emailAvailable, setEmailAvailable] = useState(false);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    const handleInvite = () => {
        if (!inviteEmail || !emailAvailable) return;
        router.post(route('patients.invitations.store'), {
            email: inviteEmail,
            patient_id: selectedPatient?.id,
        }, {
            onSuccess: () => {
                setInviteModalOpen(false);
                setSelectedPatient(null);
                setInviteEmail('');
                setEmailAvailable(false);
                setEmailValidationMessage('');
            },
            onError: (errors) => {
                // Handle validation errors
                if (errors.email) {
                    setEmailValidationMessage(errors.email);
                    setEmailAvailable(false);
                }
                if (errors.patient_id) {
                    setEmailValidationMessage(errors.patient_id);
                    setEmailAvailable(false);
                }
            }
        });
    };

    const isValidEmailFormat = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInviteEmail(value);

        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        debounceTimer.current = setTimeout(() => {
            if (!value) {
                setEmailValidationMessage('');
                setEmailAvailable(false);
                return;
            }

            if (!isValidEmailFormat(value)) {
                setEmailValidationMessage('Please enter a valid email address.');
                setEmailAvailable(false);
                return;
            }

            axios
                .post(route('patients.validate-email'), { email: value })
                .then((response: any) => {
                    if (response.data.available) {
                        setEmailValidationMessage('Email is available.');
                        setEmailAvailable(true);
                    } else {
                        setEmailValidationMessage(response.data.message);
                        setEmailAvailable(false);
                    }
                })
                .catch(() => {
                    setEmailValidationMessage('Error validating email.');
                    setEmailAvailable(false);
                });
        }, 500);
    };

    return (
        <Dialog
            open={isInviteModalOpen}
            onOpenChange={(open) => {
                setInviteModalOpen(open);
                if (!open) {
                    setSelectedPatient(null);
                    setInviteEmail('');
                    setEmailAvailable(false);
                    setEmailValidationMessage('');
                    if (debounceTimer.current) clearTimeout(debounceTimer.current);
                }
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Invite Patient</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <Input type="email" placeholder="Enter patient's email" value={inviteEmail} onChange={handleEmailChange} />
                    <p className={`text-sm ${emailAvailable ? 'text-green-600' : 'text-red-600'}`}>{emailValidationMessage}</p>
                </div>
                <DialogFooter>
                    <Button variant="secondary" onClick={() => setInviteModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleInvite} disabled={!emailAvailable}>
                        Invite
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PatientInvitationModal;
