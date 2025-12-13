import { Head } from '@inertiajs/react';
import { withAppLayout } from '@/utils/layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Send } from 'lucide-react';
import { router } from '@inertiajs/react';
import PractitionerIndex from './Index';
import InvitationsTable from './InvitationsTable';

interface InvitationsStandaloneProps {
    invitations?: any;
    filters?: any;
}

function InvitationsStandalone({ 
    invitations, 
    filters 
}: InvitationsStandaloneProps) {
    
    const handleCreateClick = () => {
        router.get(route('practitioners.create'));
    };

    return (
        <>
            <Head title="Practitioners & Invitations" />
            
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>Practitioners</span>
                            <Button 
                                onClick={handleCreateClick}
                                variant="outline"
                                className="bg-white text-sidebar-accent border-sidebar-accent hover:bg-sidebar-accent/10"
                            >
                                Add Practitioner
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="invitations" className="w-full">
                            <div className="pb-4">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger 
                                        value="practitioners" 
                                        className="flex items-center space-x-2"
                                        onClick={() => router.get(route('practitioners.index'))}
                                    >
                                        <Users className="h-4 w-4" />
                                        <span>Practitioners</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="invitations" className="flex items-center space-x-2">
                                        <Send className="h-4 w-4" />
                                        <span>Invitations</span>
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent value="practitioners" className="mt-0">
                                {/* This will never show since we redirect */}
                            </TabsContent>

                            <TabsContent value="invitations" className="mt-0">
                                <InvitationsTable 
                                    standalone={true}
                                    invitations={invitations}
                                    filters={filters}
                                />
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

export default withAppLayout(InvitationsStandalone, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Practitioners', href: route('practitioners.index') },
        { title: 'Invitations' }
    ]
}); 