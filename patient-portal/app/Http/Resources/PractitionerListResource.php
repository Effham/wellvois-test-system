<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PractitionerListResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * Limited fields for practitioner list views (index, tables)
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,

            // Personal Information
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->first_name.' '.$this->last_name,
            'display_name' => $this->display_name,
            'title' => $this->title,
            'email' => $this->email,
            'phone_number' => $this->phone_number,
            'gender' => $this->gender,

            // Professional Details (summary)
            'credentials' => $this->credentials,
            'primary_specialties' => $this->primary_specialties,
            'license_number' => $this->license_number,

            // Profile
            'profile_picture_s3_key' => $this->profile_picture_s3_key,
            'profile_picture_url' => $this->when(isset($this->profile_picture_url), $this->profile_picture_url),
            'short_bio' => $this->short_bio,

            // Status
            'user_id' => $this->user_id,
            'is_active' => $this->is_active,
            'is_registered' => $this->isRegistered(),
            'invitation_status' => $this->when(isset($this->invitation_status), $this->invitation_status),
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
        ];
    }
}
