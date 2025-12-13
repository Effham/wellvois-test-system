<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PatientDashboardResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * Dashboard-specific patient data (profile info, no sensitive medical details)
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
            'preferred_name' => $this->preferred_name,
            'display_name' => $this->display_name,
            'email' => $this->email,
            'phone_number' => $this->phone_number,
            'emergency_contact_phone' => $this->emergency_contact_phone,
            'date_of_birth' => $this->date_of_birth?->format('Y-m-d'),
            'gender' => $this->gender,
            'gender_pronouns' => $this->gender_pronouns,

            // Address Information (for contact purposes)
            'city' => $this->city,
            'province' => $this->province,

            // Preferences & Communication
            'language_preferences' => $this->language_preferences,
            'best_time_to_contact' => $this->best_time_to_contact,
            'best_way_to_contact' => $this->best_way_to_contact,
            'consent_to_receive_reminders' => $this->consent_to_receive_reminders,

            // Account Status
            'user_id' => $this->user_id,
            'is_registered' => $this->isRegistered(),
            'is_active' => $this->is_active,
            'created_via_public_portal' => $this->created_via_public_portal,
            'email_verified_at' => $this->email_verified_at?->format('Y-m-d H:i:s'),

            // Metadata
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),

            // Note: Sensitive medical details excluded for dashboard view
            // Medical history should be loaded separately when needed
        ];
    }
}
