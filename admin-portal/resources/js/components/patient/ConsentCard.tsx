import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { AlertCircle, FileText } from 'lucide-react';
import React from 'react';

interface ConsentCardProps {
    consent: {
        id: number;
        key: string;
        title: string;
        version: number;
        body: {
            heading: string;
            description?: string;
            content: string;
            checkbox_text: string;
            important_notice?: string;
        };
    };
    isChecked: boolean;
    onCheckedChange: (checked: boolean) => void;
}

export default function ConsentCard({ consent, isChecked, onCheckedChange }: ConsentCardProps) {
    const [isExpanded, setIsExpanded] = React.useState(false);

    return (
        <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                        <div className="mt-1">
                            <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <CardTitle className="text-lg">{consent.body.heading}</CardTitle>
                            {consent.body.description && (
                                <CardDescription className="mt-1">
                                    {consent.body.description}
                                </CardDescription>
                            )}
                            <p className="text-xs text-gray-500 mt-1">Version {consent.version}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id={`consent-${consent.id}`}
                            checked={isChecked}
                            onCheckedChange={onCheckedChange}
                        />
                        <Label htmlFor={`consent-${consent.id}`} className="text-sm font-medium">
                            I agree
                        </Label>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                <div className="space-y-3">
                    {consent.body.important_notice && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-amber-800">{consent.body.important_notice}</p>
                        </div>
                    )}

                    <div className="text-sm text-gray-700">
                        {isExpanded ? (
                            <div className="space-y-2">
                                <p>{consent.body.content}</p>
                                <button
                                    onClick={() => setIsExpanded(false)}
                                    className="text-blue-600 hover:underline font-medium"
                                >
                                    Read less
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="line-clamp-3">{consent.body.content}</p>
                                <button
                                    onClick={() => setIsExpanded(true)}
                                    className="text-blue-600 hover:underline font-medium"
                                >
                                    Read full text
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}


