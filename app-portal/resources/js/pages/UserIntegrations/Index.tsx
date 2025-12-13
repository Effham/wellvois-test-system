import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { toast, Toaster } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Calendar, 
    CreditCard, 
    MessageSquare, 
    Plug, 
    CheckCircle2, 
    AlertCircle, 
    Clock,
    ExternalLink,
    Zap,
    User,
    Settings,
    RefreshCw,
    Shield,
    ToggleLeft,
    ToggleRight
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { PageProps } from '@/types';

interface UserIntegration {
    id: number | null;
    user_id: number;
    name: string;
    type: string;
    provider: string;
    description: string;
    icon_url: string;
    color: string;
    is_active: boolean;
    is_configured: boolean;
    status: string;
    display_status: string;
    status_color: string;
    last_sync_at: string | null;
    last_error: string | null;
    enable_calendar_conflicts?: boolean;
    save_appointments_to_calendar?: boolean;
}

interface UserIntegrationsPageProps extends PageProps {
    integrations: {
        data: UserIntegration[];
        stats: {
            total: number;
            connected: number;
            calendar: number;
            communication: number;
            storage: number;
        };
    };
}

const typeIcons = {
    calendar: Calendar,
    payment: CreditCard,
    communication: MessageSquare,
    storage: Settings,
    analytics: Settings,
};

const statusVariants = {
    green: 'bg-green-100 text-green-800 border-green-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200',
};

export default function UserIntegrationsIndex({ integrations }: UserIntegrationsPageProps) {
    const [connecting, setConnecting] = useState<string | null>(null);
    const [disconnectingIntegration, setDisconnectingIntegration] = useState<UserIntegration | null>(null);
    const [showConsentModal, setShowConsentModal] = useState<UserIntegration | null>(null);
    const [resyncing, setResyncing] = useState<string | null>(null);

    const handleConnect = (integration: UserIntegration) => {
        if (integration.provider === 'google') {
            setShowConsentModal(integration);
        } else {
            setConnecting(integration.provider);
            router.post(`/integrations/connect/${integration.provider}`, {}, {
                onFinish: () => setConnecting(null),
            });
        }
    };

    const confirmConnect = (enableCalendarConflicts: boolean) => {
        if (showConsentModal) {
            setConnecting(showConsentModal.provider);
            const params = { enable_calendar_conflicts: enableCalendarConflicts };
            
            if (showConsentModal.provider === 'google') {
                window.location.href = `/integrations/connect/${showConsentModal.provider}?${new URLSearchParams(params).toString()}`;
            } else {
                router.post(`/integrations/connect/${showConsentModal.provider}`, params, {
                    onFinish: () => setConnecting(null),
                });
            }
            setShowConsentModal(null);
        }
    };

    const handleResync = (integration: UserIntegration) => {
        if (integration.id) {
            setResyncing(integration.provider);
            router.post(`/integrations/${integration.id}/resync`, {}, {
                onSuccess: (page) => {
                    setResyncing(null);
                    toast.success('Integration resynced successfully!');
                },
                onError: (errors) => {
                    setResyncing(null);
                    const errorMessage = errors?.resync || 'Failed to resync integration';
                    
                    // Show specific error message
                    toast.error(errorMessage);
                    
                    // If it's a token refresh error, suggest reconnection
                    if (errorMessage.includes('Token refresh failed') || errorMessage.includes('needs to reconnect')) {
                        // Update the integration status to show it needs reconnection
                        setTimeout(() => {
                            toast.error('Your Google Calendar access has expired. Please disconnect and reconnect to restore functionality.', {
                                duration: 8000,
                            });
                        }, 2000);
                    }
                },
            });
        }
    };

    const handleToggleCalendarConflicts = (integration: UserIntegration, enabled: boolean) => {
        if (integration.id) {
            router.post(`/integrations/${integration.id}/toggle-calendar-conflicts`, 
                { enable_calendar_conflicts: enabled }, 
                {
                    onSuccess: (page) => {
                        toast.success(`Calendar conflicts ${enabled ? 'enabled' : 'disabled'}!`);
                    },
                    onError: (errors) => {
                        toast.error('Failed to update calendar conflicts setting');
                    },
                }
            );
        }
    };

    const handleToggleSaveToCalendar = (integration: UserIntegration, enabled: boolean) => {
        if (integration.id) {
            router.post(`/integrations/${integration.id}/toggle-save-appointments`, 
                { save_appointments_to_calendar: enabled }, 
                {
                    onSuccess: (page) => {
                        toast.success(`Save appointments ${enabled ? 'enabled' : 'disabled'}!`);
                    },
                    onError: (errors) => {
                        toast.error('Failed to update save appointments setting');
                    },
                }
            );
        }
    };

    const handleDisconnect = (integration: UserIntegration) => {
        setDisconnectingIntegration(integration);
    };

    const confirmDisconnect = () => {
        if (disconnectingIntegration?.id) {
            console.log('🔌 Disconnecting Google Calendar integration:', {
                integration_id: disconnectingIntegration.id,
                integration_name: disconnectingIntegration.name,
                provider: disconnectingIntegration.provider
            });
            
            router.post(`/integrations/${disconnectingIntegration.id}/disconnect`, {}, {
                onSuccess: () => {
                    console.log('✅ Integration disconnected successfully');
                    setDisconnectingIntegration(null);
                },
                onError: (errors) => {
                    console.error('❌ Failed to disconnect integration:', errors);
                    setDisconnectingIntegration(null);
                }
            });
        }
    };

    const handleTest = (integration: UserIntegration) => {
        if (integration.id) {
            router.post(`/integrations/${integration.id}/test`);
        }
    };



    const getTypeIcon = (type: string) => {
        const IconComponent = typeIcons[type as keyof typeof typeIcons] || Settings;
        return IconComponent;
    };

    return (
        <AppLayout>
            <Head title="My Integrations" />
            <Toaster position="top-right" />
            
            <div className="px-4 py-6 space-y-6">
                {/* Header */}
                <div className="flex items-center space-x-3">
                    <User className="h-8 w-8 text-primary" />
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">My Integrations</h2>
                        <p className="text-muted-foreground">
                            Connect your personal tools and services to enhance your workflow
                        </p>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Available</CardTitle>
                            <Plug className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{integrations.stats.total}</div>
                            <p className="text-xs text-muted-foreground">Personal integrations</p>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Connected</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{integrations.stats.connected}</div>
                            <p className="text-xs text-muted-foreground">Active connections</p>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Calendar</CardTitle>
                            <Calendar className="h-4 w-4 text-blue-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{integrations.stats.calendar}</div>
                            <p className="text-xs text-muted-foreground">Calendar services</p>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Communication</CardTitle>
                            <MessageSquare className="h-4 w-4 text-purple-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{integrations.stats.communication}</div>
                            <p className="text-xs text-muted-foreground">Communication tools</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Info Banner */}
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                    <CardContent className="p-6">
                        <div className="flex items-start space-x-3">
                            <User className="h-5 w-5 text-blue-600 mt-0.5" />
                            <div>
                                <h3 className="font-semibold text-blue-900">Personal Integrations</h3>
                                <p className="text-sm text-blue-700 mt-1">
                                    These integrations are personal to your account and sync with your individual calendars and tools. 
                                    Organization-wide integrations (like payment processing) are managed in the Settings section.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Integration Cards */}
                {integrations.data.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {integrations.data.map((integration) => {
                            const TypeIcon = getTypeIcon(integration.type);
                            const isConnecting = connecting === integration.provider;
                            const isResyncing = resyncing === integration.provider;
                            const hasError = integration.last_error && integration.status !== 'active';
                            
                            // Check if token has expired and needs resync
                            const needsResync = integration.last_error && (
                                integration.last_error.includes('Token refresh failed') ||
                                integration.last_error.includes('needs to reconnect') ||
                                integration.last_error.includes('refresh returned false') ||
                                integration.last_error.includes('invalid_grant') ||
                                integration.last_error.includes('token_expired')
                            );
                            
                            return (
                                <Card key={integration.provider} className="group hover:shadow-lg transition-all duration-200">
                                    <CardHeader className="pb-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center space-x-3">
                                                <div 
                                                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl font-bold"
                                                    style={{ backgroundColor: integration.color }}
                                                >
                                                    <TypeIcon className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-lg">{integration.name}</CardTitle>
                                                    <div className="flex items-center space-x-2 mt-1">
                                                        <Badge 
                                                            variant="outline" 
                                                            className={`text-xs ${statusVariants[integration.status_color as keyof typeof statusVariants]}`}
                                                        >
                                                            {integration.display_status}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground capitalize">
                                                            {integration.type}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {integration.is_active && (
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleTest(integration)}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Zap className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </CardHeader>
                                    
                                    <CardContent className="space-y-4">
                                        <CardDescription className="text-sm">
                                            {integration.description}
                                        </CardDescription>
                                        
                                        {integration.last_sync_at && (
                                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                <span>Last sync: {new Date(integration.last_sync_at).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                        
                                        {integration.last_error && hasError && !needsResync && (
                                            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                                                <div className="flex items-start space-x-2">
                                                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <span className="text-sm text-red-700 font-medium">Connection Error</span>
                                                        <p className="text-xs text-red-600 mt-1">{integration.last_error}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {needsResync && (
                                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                                                <div className="flex items-start space-x-2">
                                                    <RefreshCw className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <span className="text-sm text-amber-700 font-medium">Connection Expired</span>
                                                        <p className="text-xs text-amber-600 mt-1">Your Google Calendar access has expired. Click Resync to restore the connection.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Calendar Conflicts Toggle for Google Calendar */}
                                        {integration.is_active && integration.provider === 'google' && (
                                            <>
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                                                    <div className="flex items-center space-x-2">
                                                        <Shield className="h-4 w-4 text-gray-600" />
                                                        <span className="text-sm text-gray-700 font-medium">Calendar Conflict Detection</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleToggleCalendarConflicts(integration, !integration.enable_calendar_conflicts)}
                                                        className="flex items-center"
                                                    >
                                                        {integration.enable_calendar_conflicts ? (
                                                            <ToggleRight className="h-6 w-6 text-gray-700" />
                                                        ) : (
                                                            <ToggleLeft className="h-6 w-6 text-gray-400" />
                                                        )}
                                                    </button>
                                                </div>
                                                
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                                                    <div className="flex items-center space-x-2">
                                                        <Calendar className="h-4 w-4 text-gray-600" />
                                                        <span className="text-sm text-gray-700 font-medium">Save Appointments to Calendar</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleToggleSaveToCalendar(integration, !integration.save_appointments_to_calendar)}
                                                        className="flex items-center"
                                                    >
                                                        {integration.save_appointments_to_calendar ? (
                                                            <ToggleRight className="h-6 w-6 text-gray-700" />
                                                        ) : (
                                                            <ToggleLeft className="h-6 w-6 text-gray-400" />
                                                        )}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                        
                                        <div className="flex space-x-2">
                                            {integration.is_active ? (
                                                <>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleResync(integration)}
                                                        disabled={isResyncing}
                                                        className="flex-1"
                                                    >
                                                        {isResyncing ? (
                                                            <>
                                                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                                                Syncing...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <RefreshCw className="h-4 w-4 mr-2" />
                                                                ReSync
                                                            </>
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleDisconnect(integration)}
                                                        className="text-red-600 hover:text-red-700"
                                                    >
                                                        Disconnect
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button
                                                    onClick={() => needsResync ? handleResync(integration) : handleConnect(integration)}
                                                    disabled={isConnecting || isResyncing}
                                                    className="w-full"
                                                    style={{ backgroundColor: needsResync ? '#f59e0b' : integration.color }}
                                                >
                                                    {(isConnecting || isResyncing) ? (
                                                        <>
                                                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                                            {needsResync ? 'Resyncing...' : 'Connecting...'}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {needsResync ? (
                                                                <>
                                                                    <RefreshCw className="h-4 w-4 mr-2" />
                                                                    Resync
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <ExternalLink className="h-4 w-4 mr-2" />
                                                                    Connect
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <Card className="text-center py-12">
                        <CardContent>
                            <Plug className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No Personal Integrations Available</h3>
                            <p className="text-muted-foreground">
                                Personal integrations will be available soon. Check back later!
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Help Section */}
                <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                            <Settings className="h-5 w-5 text-purple-600" />
                            <span>Need Help?</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-700 mb-4">
                            Having trouble with your personal integrations? These are different from organization-wide integrations managed in Settings.
                        </p>
                        <div className="flex space-x-3">
                            <Button variant="outline" size="sm">
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Documentation
                            </Button>
                            <Button variant="outline" size="sm">
                                Contact Support
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            {/* Disconnect Confirmation Modal */}
            <Dialog open={disconnectingIntegration !== null} onOpenChange={() => setDisconnectingIntegration(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Disconnect Integration</DialogTitle>
                        <DialogDescription>
                            <div>
                                Are you sure you want to disconnect <strong>{disconnectingIntegration?.name}</strong>?
                            </div>
                            <div className="mt-4">
                                This will:
                                <ul className="list-disc list-inside mt-2 space-y-1">
                                    <li>Remove access to your calendar data</li>
                                    <li>Disable automatic calendar sync</li>
                                    <li>Stop conflict detection for appointments</li>
                                    <li>Revoke all stored credentials</li>
                                </ul>
                            </div>
                            <div className="mt-3">
                                You can reconnect at any time.
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDisconnectingIntegration(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDisconnect}
                        >
                            Disconnect
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Google Integration Consent Modal */}
            <Dialog open={showConsentModal !== null} onOpenChange={() => setShowConsentModal(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center space-x-2">
                            <Shield className="h-5 w-5 text-blue-600" />
                            <span>Connect to Google Calendar</span>
                        </DialogTitle>
                        <DialogDescription>
                            <div className="space-y-4">
                                <p>You're about to connect your Google Calendar. This will allow:</p>
                                <ul className="list-disc list-inside space-y-1 text-sm">
                                    <li>Automatic calendar event creation</li>
                                    <li>Two-way sync with your appointments</li>
                                    <li>Real-time availability checking</li>
                                </ul>
                                
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <div className="flex items-start space-x-3">
                                        <Checkbox 
                                            id="enable-conflicts"
                                            defaultChecked={true}
                                        />
                                        <div>
                                            <label htmlFor="enable-conflicts" className="text-sm font-medium text-blue-900 cursor-pointer">
                                                Enable Calendar Conflict Detection
                                            </label>
                                            <p className="text-xs text-blue-700 mt-1">
                                                When creating appointments, check for conflicts with your existing Google Calendar events and warn about overlapping appointments.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                
                                <p className="text-xs text-gray-600">
                                    You can change this setting anytime after connecting.
                                </p>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowConsentModal(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                const enableConflicts = document.getElementById('enable-conflicts') as HTMLInputElement;
                                confirmConnect(enableConflicts?.checked ?? true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Connect to Google
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
} 