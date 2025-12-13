import React from "react";
import { Award, ChevronRight } from "lucide-react";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

// ---- Types (adjust as needed for your app) ----
export type Practitioner = {
  id: string | number;
  slug?: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  profile_picture_url?: string | null;
  profile_picture_path?: string | null;
  credentials?: string[];
  short_bio?: string | null;
  primary_specialties?: string[];
};

// ---- External helpers expected in the environment ----
const getInitials = (firstName: string, lastName: string) => {
  return `${firstName?.charAt(0) ?? ''}${lastName?.charAt(0) ?? ''}`.toUpperCase();
};

const getProfilePictureUrl = (practitioner: Practitioner) => {
  if (practitioner?.profile_picture_url) return practitioner.profile_picture_url;
  if (practitioner?.profile_picture_path) return `/storage/${practitioner.profile_picture_path}`;
  return null;
};

// Local helper: character-based truncation with ellipsis
const truncate = (text: string | null | undefined, max = 160) => {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
};

/**
 * A refined practitioner card with equal height and truncated bio.
 * - Uses flex layout so all cards can be the same height when placed in a grid.
 * - `Card` is made `flex h-full flex-col` and `CardContent` grows with `flex-1`.
 * - Bio is truncated to a fixed character length (configurable via prop).
 */
export default function PractitionerCard({
  practitioner,
  onLearnMore,
  maxBioChars = 160,
}: {
  practitioner: Practitioner;
  onLearnMore?: (p: Practitioner) => void;
  /** Character limit for the bio before adding an ellipsis */
  maxBioChars?: number;
}) {
  return (
    <div className="group relative h-full">{/* ensures wrapper can stretch */}
      {/* Accent border + subtle hover glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-100" />

      <Card
        key={practitioner.id}
        className="relative overflow-hidden rounded-2xl border bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 flex h-full flex-col"
      >
        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

        <CardHeader className="text-center">
          {/* Profile Picture */}
          <div className="mx-auto mb-4">
            <div className="relative">
              <Avatar className="w-24 h-24 ring-2 ring-primary/20 shadow-sm">
                <AvatarImage
                  src={getProfilePictureUrl(practitioner) || undefined}
                  alt={practitioner.full_name || `${practitioner.first_name} ${practitioner.last_name}`}
                />
                <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                  {getInitials(practitioner.first_name, practitioner.last_name)}
                </AvatarFallback>
              </Avatar>
              {/* Small decorative dot */}
              <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-primary/90 ring-4 ring-background" />
            </div>
          </div>

          {/* Name and Title */}
          <CardTitle className="text-xl tracking-tight flex items-center justify-center gap-2">
            <span className="line-clamp-1">{practitioner.first_name} {practitioner.last_name}</span>
          </CardTitle>

          {/* Credentials */}
          {practitioner.credentials && practitioner.credentials.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1 mt-2">
              {practitioner.credentials.map((credential, index) => (
                <Badge key={index} variant="secondary" className="text-[11px]">
                  {credential}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>

        {/* Make the content area consume remaining height so footer pins to bottom */}
        <CardContent className="space-y-5 flex-1">
          {/* Bio (truncated by characters and line-clamped as a backstop) */}
          {practitioner.short_bio && (
            <div>
              <p
                className="text-sm text-muted-foreground leading-relaxed line-clamp-3"
                title={practitioner.short_bio || undefined}
                aria-label={practitioner.short_bio || undefined}
              >
                {truncate(practitioner.short_bio, maxBioChars)}
              </p>
            </div>
          )}

          {/* Specialties */}
          {practitioner.primary_specialties && practitioner.primary_specialties.length > 0 && (
            <InfoRow label="Specialties" icon={<Award className="h-4 w-4" />}> 
              {practitioner.primary_specialties.map((specialty, index) => (
                <Badge key={index} variant="outline" className="text-[11px]">
                  {specialty}
                </Badge>
              ))}
            </InfoRow>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-center gap-3 pt-2 mt-auto">
          <Button
            className="gap-1 group/btn"
            onClick={() => onLearnMore?.(practitioner)}
          >
            Learn more
            <ChevronRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function InfoRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-muted-foreground">
        <span className="text-primary/90">{icon}</span>
        <span className="text-sm font-medium">{label}:</span>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/*
USAGE EXAMPLE
-------------

<GridExample practitioners={practitioners} />

function GridExample({ practitioners }: { practitioners: Practitioner[] }) {
  // Use items-stretch so children can be h-full. Each card has flex h-full flex-col.
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
      {practitioners.map((practitioner) => (
        <div key={practitioner.id} className="h-full">
          <PractitionerCard
            practitioner={practitioner}
            onLearnMore={(p) => router.visit(`/explore/staff/${p.slug}`)}
            maxBioChars={160}
          />
        </div>
      ))}
    </div>
  );
}
*/
