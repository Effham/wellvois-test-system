import { useState } from 'react';
import { router } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
    Settings, 
    Calendar, 
    CreditCard, 
    MessageSquare, 
    Plug, 
    CheckCircle2, 
    AlertCircle, 
    Clock,
    RefreshCw,
    ExternalLink,
    Zap
} from 'lucide-react';

interface Integration {
    id: number | null;
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
}

interface IntegrationsTabProps {
    integrations: {
        data: Integration[];
        stats: {
            total: number;
            connected: number;
            calendar: number;
            payment: number;
            communication: number;
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

export default function IntegrationsTab({ integrations }: IntegrationsTabProps) {
    const [connecting, setConnecting] = useState<string | null>(null);
    const [disconnectingIntegration, setDisconnectingIntegration] = useState<Integration | null>(null);

    const handleConnect = (provider: string) => {
        setConnecting(provider);
        
        // For OAuth providers (like Google), use window location to allow proper redirect
        if (provider === 'google') {
            window.location.href = `/organization/integrations/connect/${provider}`;
        } else {
            // For other integrations, use router.post as before
            router.post(`/organization/integrations/connect/${provider}`, {}, {
                onFinish: () => setConnecting(null),
            });
        }
    };

    const handleDisconnect = (integration: Integration) => {
        setDisconnectingIntegration(integration);
    };

    const confirmDisconnect = () => {
        if (disconnectingIntegration?.id) {
            console.log('🔌 Disconnecting organization integration:', {
                integration_id: disconnectingIntegration.id,
                integration_name: disconnectingIntegration.name,
                provider: disconnectingIntegration.provider
            });
            
            router.post(`/organization/integrations/${disconnectingIntegration.id}/disconnect`, {}, {
                onSuccess: () => {
                    console.log('✅ Organization integration disconnected successfully');
                    setDisconnectingIntegration(null);
                },
                onError: (errors) => {
                    console.error('❌ Failed to disconnect organization integration:', errors);
                    setDisconnectingIntegration(null);
                }
            });
        }
    };

    const handleTest = (integration: Integration) => {
        if (integration.id) {
            router.post(`/organization/integrations/${integration.id}/test`);
        }
    };



    const getTypeIcon = (type: string) => {
        const IconComponent = typeIcons[type as keyof typeof typeIcons] || Settings;
        return IconComponent;
    };

    return (
        <>
            <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight">Integrations</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                    Connect your practice with popular services
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Integrations</CardTitle>
                        <Plug className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{integrations.stats.total}</div>
                        <p className="text-xs text-muted-foreground">Available integrations</p>
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
                        <CardTitle className="text-sm font-medium">Payment</CardTitle>
                        <CreditCard className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{integrations.stats.payment}</div>
                        <p className="text-xs text-muted-foreground">Payment processors</p>
                    </CardContent>
                </Card>
            </div>

            {/* Integration Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {integrations.data.map((integration) => {
                    const TypeIcon = getTypeIcon(integration.type);
                    const isConnecting = connecting === integration.provider;
                    
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
                                
                                {integration.last_error && (
                                    <div className="flex items-start space-x-2 p-2 bg-red-50 rounded-md">
                                        <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                        <span className="text-xs text-red-700">{integration.last_error}</span>
                                    </div>
                                )}
                                
                                <div className="flex space-x-2">
                                    {integration.is_active ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDisconnect(integration)}
                                            className="text-red-600 hover:text-red-700 flex-1"
                                        >
                                            Disconnect
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={() => handleConnect(integration.provider)}
                                            disabled={isConnecting}
                                            className="w-full"
                                            style={{ backgroundColor: integration.color }}
                                        >
                                            {isConnecting ? (
                                                <>
                                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                                    Connecting...
                                                </>
                                            ) : (
                                                <>
                                                    <ExternalLink className="h-4 w-4 mr-2" />
                                                    Connect
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

            {/* Help Section */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
                        <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                        <span>Need Help?</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-xs sm:text-sm text-gray-700 mb-3 sm:mb-4">
                        Having trouble setting up an integration? Check our documentation or contact support for assistance.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                        <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                            <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                            <span className="hidden sm:inline">View Documentation</span>
                            <span className="sm:hidden">Docs</span>
                        </Button>
                        <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
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
        </>
    );
} 