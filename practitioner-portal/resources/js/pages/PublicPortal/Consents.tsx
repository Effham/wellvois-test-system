import React, { useState, useEffect } from 'react';
import PublicPortalLayout from '@/layouts/public-portal-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Toaster } from '@/components/ui/sonner';
import { FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  tenant: {
    id: string;
    company_name: string;
  };
  appearanceSettings?: {
    appearance_theme_color?: string;
    appearance_logo_path?: string;
    appearance_font_family?: string;
  };
  websiteSettings?: {
    navigation?: any;
    appearance?: any;
  };
}

export default function Consents({ tenant, appearanceSettings, websiteSettings }: Props) {
  const [consents, setConsents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptedAll, setAcceptedAll] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Fetch required consents
    const fetchConsents = async () => {
      try {
        const response = await fetch('/explore/patient-consents', {
          headers: {
            'Accept': 'application/json',
          },
        });
        const data = await response.json();
        if (data.success && data.consents) {
          setConsents(data.consents);
        }
      } catch (error) {
        console.error('Failed to fetch consents:', error);
        toast.error('Failed to load consent forms. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchConsents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptedAll) {
      toast.error('Please accept all required consents to continue.');
      return;
    }

    setProcessing(true);

    try {
      const consentVersionIds = consents.map(c => c.version_id);

      const response = await fetch('/explore/consents/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          consent_version_ids: consentVersionIds,
        }),
        credentials: 'include',
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        toast.success(responseData.message || 'Registration completed successfully!');

        // Redirect to dashboard
        setTimeout(() => {
          const fallbackLogin = responseData.fallback_login_url || '/login';
          window.location.href = responseData.redirect_url || fallbackLogin;
        }, 1000);
      } else {
        toast.error(responseData.message || 'Failed to complete registration. Please try again.');
      }
    } catch (error) {
      console.error('Error accepting consents:', error);
      toast.error('Failed to complete registration. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <PublicPortalLayout
      title="Review Consents"
      tenant={tenant}
      appearanceSettings={appearanceSettings}
      websiteSettings={websiteSettings}
    >
      <div className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Review Required Consents
            </h1>
            <p className="text-muted-foreground">
              Please review and accept all required consent forms to complete your registration with {tenant.company_name}
            </p>
          </div>

          {loading ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex items-center justify-center">
                  <div className="text-muted-foreground">Loading consent forms...</div>
                </div>
              </CardContent>
            </Card>
          ) : consents.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center gap-4">
                  <AlertCircle className="h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">No consent forms available at this time.</p>
                  <Button onClick={() => window.history.back()}>
                    Go Back
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Display all consents */}
              <div className="space-y-4">
                {consents.map((consent) => (
                  <Card key={consent.id} className="border-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        {consent.title}
                        {consent.is_required && (
                          <span className="text-sm text-red-500">(Required)</span>
                        )}
                      </CardTitle>
                      {consent.body?.description && (
                        <CardDescription>{consent.body.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      {consent.body?.content && (
                        <div
                          className="text-sm prose prose-sm max-w-none dark:prose-invert bg-muted/30 p-4 rounded-md max-h-96 overflow-y-auto"
                          dangerouslySetInnerHTML={{ __html: consent.body.content }}
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Single "Accept All" Checkbox */}
              <Card className="border-2 border-primary/50 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="accept-all"
                      checked={acceptedAll}
                      onCheckedChange={(checked) => setAcceptedAll(checked as boolean)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor="accept-all"
                        className="text-base font-semibold cursor-pointer flex items-center gap-2"
                      >
                        {acceptedAll && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                        I have read and accept all required consents
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        By checking this box, you confirm that you have read and agree to all {consents.length} consent form{consents.length !== 1 ? 's' : ''} listed above.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex justify-center pt-4">
                <Button
                  type="submit"
                  disabled={!acceptedAll || processing}
                  size="lg"
                  className="min-w-64"
                >
                  {processing ? 'Completing Registration...' : 'Complete Registration'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      <Toaster position="top-right" />
    </PublicPortalLayout>
  );
}
