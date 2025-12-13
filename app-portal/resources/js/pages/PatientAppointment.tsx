import React, { useEffect } from "react";
import { Head } from "@inertiajs/react";
import { Separator } from "@/components/ui/separator";

interface PatientAppointmentProps {
  roomId: string;
  antMediaUrl: string; // base URL like "https://example.com/player/"
  tenant: {
    id: string;
    company_name: string;
  };
  patient?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  appointmentId?: string | null;
  appearanceSettings?: {
    appearance_theme_color?: string;
    appearance_logo_path?: string;
    appearance_font_family?: string;
  };
}

export default function PatientAppointment({
  roomId,
  antMediaUrl,
  tenant,
  patient,
  appointmentId,
  appearanceSettings,
}: PatientAppointmentProps) {
  // Lightweight theming (optional)
  useEffect(() => {
    const root = document.documentElement;

    if (appearanceSettings?.appearance_theme_color) {
      root.style.setProperty("--primary", appearanceSettings.appearance_theme_color);
    }
    if (appearanceSettings?.appearance_font_family) {
      root.style.setProperty("--font-family", appearanceSettings.appearance_font_family);
      document.body.style.fontFamily = appearanceSettings.appearance_font_family;
    }

    return () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--font-family");
    };
  }, [appearanceSettings]);

  // Helper function to convert text to Title Case
  const toTitleCase = (str: string) => {
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Build iframe URL with patient name parameters
const buildIframeUrl = () => {
  if (!antMediaUrl) return '';

  const baseUrl = joinUrl(antMediaUrl, roomId);
  const queryParams = [];

  // Add patient name if available
  if (patient?.first_name && patient?.last_name) {
    const patientName = toTitleCase(`${patient.first_name} ${patient.last_name}`.trim());
    queryParams.push(`name=${encodeURIComponent(patientName)}`);
    queryParams.push(`patient=yes`);
  }

  // Add appointment ID if available
  if (appointmentId) {
    queryParams.push(`appointmentId=${encodeURIComponent(appointmentId)}`);
  }

  // Build final URL
  const url = queryParams.length > 0
    ? `${baseUrl}?${queryParams.join('&')}`
    : baseUrl;

  return url;
};


  const iframeSrc = buildIframeUrl();

  return (
    <>
      <Head title={`${tenant.company_name} - Virtual Appointment`} />

      {/* Page grid: header / content (iframe) / footer */}
      <div className="h-screen w-screen flex flex-col bg-white text-gray-900">
        {/* Header */}
        <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200 flex-shrink-0">
          {/* Slim gradient accent */}
          <div className="h-0.5 w-full bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500 opacity-60" />
          <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between gap-4">
            {/* Branding */}
            <div className="flex items-center gap-3">
              {appearanceSettings?.appearance_logo_path ? (
                <img
                  src={appearanceSettings.appearance_logo_path}
                  alt={`${tenant.company_name} logo`}
                  className="h-8 w-auto max-w-[140px] object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                  style={{
                    backgroundColor: appearanceSettings?.appearance_theme_color || "#3b82f6",
                  }}
                >
                  {tenant.company_name?.charAt(0)?.toUpperCase() || "T"}
                </div>
              )}
              <div className="leading-tight">
                <h1 className="text-base font-semibold">{tenant.company_name}</h1>
                <p className="text-xs text-gray-500">Virtual Appointment</p>
              </div>
            </div>

            {/* Compact session pill */}
            <div className="hidden sm:flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-gray-600 bg-white/70">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Secure session
            </div>
          </div>
        </header>

        {/* Content (full-bleed iframe) - takes up most of the screen */}
        <main className="flex-1 w-full">
          <iframe
            title="Virtual Appointment"
            src={iframeSrc}
            className="block w-full h-full border-0"
            // Permissions commonly needed by video apps inside iframes:
            allow="camera; microphone; fullscreen; display-capture; clipboard-write; autoplay"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        </main>

        {/* Footer */}
        <footer className="bg-white/95 backdrop-blur-sm border-t border-gray-200 flex-shrink-0">
          <Separator className="opacity-50" />
          <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="whitespace-nowrap">Powered by</span>
              <img
                src="/brand/images/mainLogo.png"
                alt="Wellovis"
                className="h-4 w-auto object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div className="flex items-center gap-4 text-[11px] text-gray-400">
              <span>&copy; {new Date().getFullYear()} Wellovis</span>
              <span className="hidden sm:inline">All rights reserved</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

/** Joins a base URL and a path fragment without duplicating or losing slashes. */
function joinUrl(base: string, path: string) {
  const trimmedBase = (base || "").replace(/\/+$/, "");
  const trimmedPath = (path || "").replace(/^\/+/, "");
  // If your room IDs can include characters needing encoding, encode only the last segment:
  return `${trimmedBase}/${encodeURIComponent(trimmedPath)}`;
}