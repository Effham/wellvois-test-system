<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PatientListResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * Limited fields for patient list views (index, tables)
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'health_number' => $this->health_number,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->first_name.' '.$this->last_name,
            'preferred_name' => $this->preferred_name,
            'display_name' => $this->display_name,
            'email' => $this->email,
            'phone_number' => $this->phone_number,
            'date_of_birth' => $this->date_of_birth?->format('Y-m-d'),
            'gender' => $this->gender,
            'gender_pronouns' => $this->gender_pronouns,

            // Status information
            'user_id' => $this->user_id,
            'is_registered' => $this->isRegistered(),
            'is_active' => $this->is_active,
            'created_via_public_portal' => $this->created_via_public_portal,
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),

            // Conditionally included
            'invitation_status' => $this->when(isset($this->invitation_status), $this->invitation_status),
        ];
    }
}
