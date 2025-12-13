<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PractitionerMaskedResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * Privacy-compliant masked practitioner data for search results and lookups
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->first_name.' '.$this->last_name,
            'display_name' => $this->display_name,
            'title' => $this->title,
            'credentials' => $this->credentials,

            // Masked PII
            'email' => $this->maskEmail($this->email),
            'phone_number' => $this->maskPhoneNumber($this->phone_number),
            'license_number' => $this->maskLicenseNumber($this->license_number),

            // Professional info (not sensitive)
            'years_of_experience' => $this->years_of_experience,
            'primary_specialties' => $this->primary_specialties,

            // Profile picture
            'profile_picture_s3_key' => $this->profile_picture_s3_key,
        ];
    }

    /**
     * Mask phone number for privacy (show last 4 digits only)
     */
    private function maskPhoneNumber(?string $phoneNumber): ?string
    {
        if (! $phoneNumber) {
            return null;
        }

        // Remove all non-numeric characters
        $cleaned = preg_replace('/[^0-9]/', '', $phoneNumber);

        if (strlen($cleaned) < 4) {
            return '***';
        }

        // Show last 4 digits only
        $lastFour = substr($cleaned, -4);

        return '***-***-'.$lastFour;
    }

    /**
     * Mask email for privacy (show first 2 chars and domain)
     */
    private function maskEmail(?string $email): ?string
    {
        if (! $email || ! str_contains($email, '@')) {
            return null;
        }

        [$localPart, $domain] = explode('@', $email, 2);

        if (strlen($localPart) <= 2) {
            return substr($localPart, 0, 1).'***@'.$domain;
        }

        return substr($localPart, 0, 2).'***@'.$domain;
    }

    /**
     * Mask license number for privacy (show last 4 characters only)
     */
    private function maskLicenseNumber(?string $licenseNumber): ?string
    {
        if (! $licenseNumber) {
            return null;
        }

        if (strlen($licenseNumber) < 4) {
            return '***';
        }

        // Show last 4 characters only
        $lastFour = substr($licenseNumber, -4);

        return '***'.$lastFour;
    }
}
