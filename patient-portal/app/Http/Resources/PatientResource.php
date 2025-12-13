<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PatientResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * Full patient details resource - for show/detail pages
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,

            // Personal Information
            'health_number' => $this->health_number,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->first_name.' '.$this->last_name,
            'preferred_name' => $this->preferred_name,
            'display_name' => $this->display_name,
            'email' => $this->email,
            'phone_number' => $this->phone_number,
            'emergency_contact_phone' => $this->emergency_contact_phone,
            'gender' => $this->gender,
            'gender_pronouns' => $this->gender_pronouns,
            'client_type' => $this->client_type,
            'date_of_birth' => $this->date_of_birth?->format('Y-m-d'),

            // Address Information
            'address' => $this->address,
            'address_lookup' => $this->address_lookup,
            'street_address' => $this->street_address,
            'apt_suite_unit' => $this->apt_suite_unit,
            'city' => $this->city,
            'postal_zip_code' => $this->postal_zip_code,
            'province' => $this->province,

            // Health & Clinical History
            'presenting_concern' => $this->presenting_concern,
            'goals_for_therapy' => $this->goals_for_therapy,
            'previous_therapy_experience' => $this->previous_therapy_experience,
            'current_medications' => $this->current_medications,
            'diagnoses' => $this->diagnoses,
            'history_of_hospitalization' => $this->history_of_hospitalization,
            'risk_safety_concerns' => $this->risk_safety_concerns,
            'other_medical_conditions' => $this->other_medical_conditions,
            'cultural_religious_considerations' => $this->cultural_religious_considerations,
            'accessibility_needs' => $this->accessibility_needs,

            // Insurance Information
            'insurance_provider' => $this->insurance_provider,
            'policy_number' => $this->policy_number,
            'coverage_card_path' => $this->coverage_card_path,

            // Consent & Preferences
            'consent_to_treatment' => $this->consent_to_treatment,
            'consent_to_data_storage' => $this->consent_to_data_storage,
            'privacy_policy_acknowledged' => $this->privacy_policy_acknowledged,
            'consent_to_receive_reminders' => $this->consent_to_receive_reminders,
            'language_preferences' => $this->language_preferences,
            'best_time_to_contact' => $this->best_time_to_contact,
            'best_way_to_contact' => $this->best_way_to_contact,

            // Status & Metadata
            'user_id' => $this->user_id,
            'is_registered' => $this->isRegistered(),
            'created_via_public_portal' => $this->created_via_public_portal,
            'is_active' => $this->is_active,
            'email_verified_at' => $this->email_verified_at?->format('Y-m-d H:i:s'),
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at' => $this->updated_at?->format('Y-m-d H:i:s'),

            // Relationships (conditionally loaded)
            'invitation_status' => $this->when(isset($this->invitation_status), $this->invitation_status),
            'tenants' => $this->whenLoaded('tenants'),
            'user' => $this->whenLoaded('user'),
        ];
    }
}
