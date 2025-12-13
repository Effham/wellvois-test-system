import React, { useMemo, useState } from "react";
import { Head, useForm, usePage } from "@inertiajs/react";
import {
  CheckCircle,
  TriangleAlert,
  ShieldCheck,
  ShieldOff,
  Lock,
  KeyRound,
  ArrowLeft,
  Copy,
  Shield,
} from "lucide-react";
import { type SharedData } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TwoFactorProps extends SharedData {
  qrCodeImageUrl: string;
  secret: string;
  google2faEnabled: boolean;
  isCentral: boolean; // Indicates if the user is in the central context
  userRole: string; // User's primary role (e.g., 'practitioner', 'patient', 'admin')
}

export default function TwoFactorAuthentication() {
  const { props } = usePage<TwoFactorProps>();
  const { qrCodeImageUrl, secret, google2faEnabled, isCentral, userRole } = props;
  const [showingQrCode, setShowingQrCode] = useState(false);
  const [copied, setCopied] = useState(false);

  // Convert raw SVG XML to data URI for <img>
  const svgDataUri = useMemo(() => {
    if (!qrCodeImageUrl) return "";
    const base64Svg = typeof window !== "undefined" ? btoa(qrCodeImageUrl) : "";
    return `data:image/svg+xml;base64,${base64Svg}`;
  }, [qrCodeImageUrl]);

  const { data, setData, post, processing, errors, reset } = useForm({
    one_time_password: "",
  });

  const enable2FA = (e: React.FormEvent) => {
    e.preventDefault();
    post(route("two-factor-authentication.enable"), {
      onSuccess: () => {
        reset("one_time_password");
        setShowingQrCode(false);
      },
    });
  };

  const disable2FA = (e: React.FormEvent) => {
    e.preventDefault();
    post(route("two-factor-authentication.disable"), {
      onSuccess: () => {
        reset("one_time_password");
        setShowingQrCode(false);
      },
    });
  };

  const handleReturnClick = () => {
    if (isCentral) {
      if (userRole === "practitioner") {
        window.location.href = route("central.practitioner-dashboard");
      } else if (userRole === "patient") {
        window.location.href = route("central.patient-dashboard");
      } else {
        window.location.href = route("dashboard");
      }
    } else {
      // For tenant context, just go to dashboard route
      window.location.href = route("dashboard");
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (_) {}
  };

  return (
    <>
      <Head title="Two-Factor Authentication" />
      
      {/* Full screen centered layout */}
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 p-4 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        {/* Logo at top */}
        <div className="mb-8">
          <img 
            src="/brand/images/mainLogo.png" 
            alt="Application Logo" 
            className="h-12 w-auto object-contain"
          />
        </div>

        {/* Main Card Container */}
        <Card className="w-full max-w-2xl border-2 bg-white/80 shadow-2xl backdrop-blur-sm dark:bg-gray-900/80">
          <CardHeader className="space-y-1 pb-4 text-center">
            <div className="mb-2 flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
              <Shield className="h-5 w-5" />
              <span className="text-xs font-medium uppercase tracking-wider">Account Security</span>
            </div>
            <CardTitle className="bg-gradient-to-r from-purple-700 to-violet-700 bg-clip-text text-3xl font-bold text-transparent dark:from-purple-400 dark:to-violet-400">
              Two-Factor Authentication
            </CardTitle>
            <CardDescription className="pt-2">
              Add an additional layer of security to your account
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Status Alert */}
            {google2faEnabled ? (
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <AlertTitle className="font-semibold">2FA is Enabled</AlertTitle>
                <AlertDescription>
                  Your account is protected with two-factor authentication.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
                <ShieldOff className="h-5 w-5 text-blue-600" />
                <AlertTitle className="font-semibold">2FA is Disabled</AlertTitle>
                <AlertDescription>
                  Enable two-factor authentication to protect against unauthorized access.
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-4">
              {!google2faEnabled ? (
                <>
                  <Button 
                    onClick={() => setShowingQrCode(true)} 
                    className="h-12 w-full gap-2 bg-gradient-to-r from-purple-700 to-violet-700 text-base font-semibold shadow-lg transition-all duration-200 hover:from-purple-800 hover:to-violet-800 hover:shadow-xl dark:from-purple-600 dark:to-violet-600 dark:hover:from-purple-700 dark:hover:to-violet-700"
                  >
                    <ShieldCheck className="h-5 w-5" /> Enable Two-Factor Authentication
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    Works with Google Authenticator, Microsoft Authenticator, Authy, and more
                  </p>
                </>
              ) : (
                <div className="space-y-4 rounded-xl border bg-muted/20 p-5">
                  <form onSubmit={disable2FA} className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      To disable two-factor authentication, enter your current one-time password.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="one_time_password_disable" className="text-sm font-medium">
                        One-Time Password
                      </Label>
                      <Input
                        id="one_time_password_disable"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        name="one_time_password"
                        value={data.one_time_password}
                        onChange={(e) => setData("one_time_password", e.target.value.replace(/\D/g, ""))}
                        className="text-center text-lg font-medium tracking-widest"
                        placeholder="000000"
                        required
                      />
                      {errors.one_time_password && (
                        <p className="text-sm text-red-600">{errors.one_time_password}</p>
                      )}
                    </div>
                    <Button 
                      type="submit" 
                      variant="destructive" 
                      disabled={processing} 
                      className="h-11 w-full gap-2 font-semibold"
                    >
                      <ShieldOff className="h-5 w-5" /> Disable Two-Factor Authentication
                    </Button>
                  </form>
                </div>
              )}
            </div>

            {/* Security Tips */}
            <div className="space-y-3 rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950/30">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-purple-700 dark:text-purple-400" />
                <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                  Security Best Practices
                </h3>
              </div>
              <ul className="space-y-2 text-xs text-purple-800 dark:text-purple-300">
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  <span>Use an authenticator app for the most secure protection</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  <span>Keep backup codes in a secure location</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  <span>Never share your authentication codes with anyone</span>
                </li>
              </ul>
            </div>

            {/* Return Button */}
            <Button
              onClick={handleReturnClick}
              variant="outline"
              className="w-full gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Enable 2FA Dialog (QR Code Modal) */}
      <Dialog open={showingQrCode && !google2faEnabled} onOpenChange={setShowingQrCode}>
        <DialogContent className="min-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <ShieldCheck className="h-6 w-6 text-purple-700 dark:text-purple-400" />
              Enable Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app and enter the verification code
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* QR Code Section */}
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border bg-muted/30 p-6">
                {svgDataUri ? (
                  <img 
                    src={svgDataUri} 
                    alt="Authenticator QR Code" 
                    className="h-64 w-64 rounded-md"
                  />
                ) : (
                  <div className="h-64 w-64 animate-pulse rounded-md bg-muted" />
                )}
                <span className="text-center text-xs text-muted-foreground">
                  Scan this with your authenticator app
                </span>
              </div>

              {/* Setup Instructions & Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Manual Secret Key
                  </Label>
                  <div className="flex items-center gap-2">
                    <code className="inline-flex max-w-full flex-1 items-center truncate rounded-md bg-muted px-3 py-2 font-mono text-sm">
                      {secret}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={copySecret}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  {copied && (
                    <p className="text-xs text-emerald-600">Copied to clipboard!</p>
                  )}
                </div>

                <Separator />

                <form onSubmit={enable2FA} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="one_time_password" className="text-sm font-medium">
                      Verification Code
                    </Label>
                    <Input
                      id="one_time_password"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="Enter 6-digit code"
                      name="one_time_password"
                      value={data.one_time_password}
                      onChange={(e) => setData("one_time_password", e.target.value.replace(/\D/g, ""))}
                      className="text-center text-lg font-medium tracking-widest"
                      required
                      autoFocus
                    />
                    {errors.one_time_password && (
                      <p className="text-sm text-red-600">{errors.one_time_password}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <Button
                      type="submit"
                      disabled={processing}
                      className="h-11 w-full gap-2 bg-gradient-to-r from-purple-700 to-violet-700 font-semibold hover:from-purple-800 hover:to-violet-800 dark:from-purple-600 dark:to-violet-600 dark:hover:from-purple-700 dark:hover:to-violet-700"
                    >
                      <ShieldCheck className="h-5 w-5" />
                      {processing ? "Verifying..." : "Confirm & Enable"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowingQrCode(false)}
                      className="w-full"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            </div>

            {/* Security Notice in Dialog */}
            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
              <Lock className="h-4 w-4" />
              <AlertTitle className="text-sm">Secure Setup</AlertTitle>
              <AlertDescription className="text-xs">
                Your QR code and secret are displayed only once. Make sure to complete the setup before closing this window.
              </AlertDescription>
            </Alert>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
