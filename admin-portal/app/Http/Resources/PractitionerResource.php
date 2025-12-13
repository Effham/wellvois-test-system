<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PractitionerResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * Full practitioner details resource - for show/detail pages
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,

            // Personal & Contact Information (Encrypted)
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->first_name.' '.$this->last_name,
            'display_name' => $this->display_name,
            'title' => $this->title,
            'email' => $this->email,
            'phone_number' => $this->phone_number,
            'extension' => $this->extension,
            'gender' => $this->gender,
            'pronoun' => $this->pronoun,

            // Professional Details
            'credentials' => $this->credentials,
            'years_of_experience' => $this->years_of_experience,
            'license_number' => $this->license_number,
            'professional_associations' => $this->professional_associations,
            'primary_specialties' => $this->primary_specialties,
            'therapeutic_modalities' => $this->therapeutic_modalities,
            'client_types_served' => $this->client_types_served,
            'languages_spoken' => $this->languages_spoken,
            'available_days' => $this->available_days,

            // Bio & Profile
            'short_bio' => $this->short_bio,
            'full_bio' => $this->full_bio,
            'profile_picture_path' => $this->profile_picture_path,
            'profile_picture_s3_key' => $this->profile_picture_s3_key,
            'profile_picture_url' => $this->profile_picture_url,

            // Documents (S3 keys)
            'resume_files' => $this->resume_files,
            'resume_s3_key' => $this->resume_s3_key,
            'licensing_docs' => $this->licensing_docs,
            'licensing_documents' => $this->licensing_documents,
            'licensing_documents_s3_key' => $this->licensing_documents_s3_key,
            'certificates' => $this->certificates,
            'certificates_s3_key' => $this->certificates_s3_key,

            // Assignments & Pricing
            'location_assignments' => $this->location_assignments,
            'availability_schedule' => $this->availability_schedule,
            'service_pricing' => $this->service_pricing,

            // Status & Metadata
            'user_id' => $this->user_id,
            'is_active' => $this->is_active,
            'is_registered' => $this->isRegistered(),
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at' => $this->updated_at?->format('Y-m-d H:i:s'),

            // Relationships (conditionally loaded)
            'user' => $this->whenLoaded('user'),
            'locations' => $this->whenLoaded('locations'),
            'services' => $this->whenLoaded('services'),
            'tenants' => $this->whenLoaded('tenants'),
        ];
    }
}
