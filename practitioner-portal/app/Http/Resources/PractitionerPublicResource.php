<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PractitionerPublicResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * Public-facing practitioner data (bio, credentials only - no PII)
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,

            // Public Identity (name is public for healthcare providers)
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->first_name.' '.$this->last_name,
            'display_name' => $this->display_name,
            'title' => $this->title,

            // Public Professional Information
            'credentials' => $this->credentials,
            'years_of_experience' => $this->years_of_experience,
            'professional_associations' => $this->professional_associations,
            'primary_specialties' => $this->primary_specialties,
            'therapeutic_modalities' => $this->therapeutic_modalities,
            'client_types_served' => $this->client_types_served,
            'languages_spoken' => $this->languages_spoken,

            // Public Profile
            'short_bio' => $this->short_bio,
            'slug' => $this->slug,
            'full_bio' => $this->full_bio,
            'profile_picture_s3_key' => $this->profile_picture_s3_key,
            'profile_picture_url' => $this->profile_picture_url,

            // Note: Email, phone, license number excluded for public view
        ];
    }
}
