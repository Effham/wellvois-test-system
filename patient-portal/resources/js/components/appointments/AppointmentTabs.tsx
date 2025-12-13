import { Link } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { FileText, Brain, Eye, Star, FileAudio } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppointmentTabsProps {
    appointmentId: number;
    encounterId?: number;
    currentTab: 'details' | 'ai-summary' | 'documents' | 'feedback' | 'recordings';
    userRole?: string;
    appointmentStatus?: string;
    showFeedback?: boolean;
}

export default function AppointmentTabs({ 
    appointmentId, 
    encounterId, 
    currentTab, 
    userRole = 'admin',
    appointmentStatus = '',
    showFeedback = false
}: AppointmentTabsProps) {
    const tabs = [
        {
            key: 'details',
            label: 'Appointment Details',
            icon: Eye,
            href: route('appointments.show', appointmentId),
            show: true,
        },
        {
            key: 'ai-summary',
            label: 'AI Summary',
            icon: Brain,
            href: route('appointments.ai-summary', appointmentId),
            show: userRole !== 'patient' && (appointmentStatus === 'completed' || appointmentStatus === 'confirmed'),
        },
        {
            key: 'recordings',
            label: 'Recordings',
            icon: FileAudio,
            href: route('appointments.recordings', appointmentId),
            show: !!encounterId,
        },
        {
            key: 'documents',
            label: 'Documents',
            icon: FileText,
            href: encounterId ? route('encounters.documents.upload', encounterId) : '#',
            show: !!encounterId,
        },
        {
            key: 'feedback',
            label: 'Feedback',
            icon: Star,
            href: route('appointments.feedback', appointmentId),
            show: showFeedback && userRole === 'patient' && appointmentStatus === 'completed',
        },
    ];

    const visibleTabs = tabs.filter(tab => tab.show);

    if (visibleTabs.length <= 1) {
        return null; // Don't show tabs if there's only one or no tabs
    }

    return (
        <div className="border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
            <div className="container mx-auto px-4">
                <nav className="flex space-x-1 overflow-x-auto" aria-label="Appointment Tabs">
                    {visibleTabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = currentTab === tab.key;
                        
                        return (
                            <Link
                                key={tab.key}
                                href={tab.href}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                                    isActive
                                        ? 'border-primary text-primary bg-primary/5'
                                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                <span>{tab.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}

