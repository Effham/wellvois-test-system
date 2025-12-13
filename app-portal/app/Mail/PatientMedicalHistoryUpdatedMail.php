<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PatientMedicalHistoryUpdatedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public $organization;

    public $patient;

    public $historyType; // 'medical_history' | 'known_allergies' | 'family_medical_history'

    public $updatedBy;

    public $changedAt;

    public $records; // The actual records that were updated

    public $patientUrl;

    public $tenantTheme;

    /**
     * Create a new message instance.
     *
     * @param  mixed  $organization  // expects ['name' => '...'] or model with ->name
     * @param  mixed  $patient  // \App\Models\Patient or array with patient data
     * @param  string  $historyType  // 'medical_history', 'known_allergies', or 'family_medical_history'
     * @param  mixed|null  $updatedBy  // optional user who made the update
     * @param  array  $records  // the records that were saved/updated
     * @param  string|null  $patientUrl  // optional direct link to patient profile
     * @param  mixed|null  $changedAt  // optional custom timestamp
     */
    public function __construct($organization, $patient, string $historyType, $updatedBy = null, array $records = [], ?string $patientUrl = null, $changedAt = null)
    {
        $this->organization = $organization;
        $this->patient = $patient;
        $this->historyType = $historyType;
        $this->updatedBy = $updatedBy;
        $this->records = $records;
        $this->patientUrl = $patientUrl;
        $this->changedAt = $changedAt ?? now();

        // Pull theme color if you support multi-tenant appearance
        $this->tenantTheme = \App\Models\OrganizationSetting::getValue('appearance_theme_color') ?? '#0d6efd';
    }

    /**
     * Get history type configuration (label + emoji)
     */
    public function getHistoryTypeConfig(): array
    {
        $map = [
            'medical_history' => [
                'label' => 'Medical History',
                'icon' => '🏥',
                'verb' => 'updated',
                'description' => 'Patient medical history records',
            ],
            'known_allergies' => [
                'label' => 'Known Allergies',
                'icon' => '⚠️',
                'verb' => 'updated',
                'description' => 'Patient allergy information',
            ],
            'family_medical_history' => [
                'label' => 'Family Medical History',
                'icon' => '👨‍👩‍👧',
                'verb' => 'updated',
                'description' => 'Family medical history records',
            ],
        ];

        return $map[$this->historyType] ?? [
            'label' => ucwords(str_replace('_', ' ', $this->historyType)),
            'icon' => '📋',
            'verb' => 'updated',
            'description' => 'Medical records',
        ];
    }

    /**
     * Get severity badge color
     */
    public function getSeverityColor(string $severity): string
    {
        $colors = [
            'mild' => '#28a745',
            'moderate' => '#ffc107',
            'severe' => '#dc3545',
        ];

        return $colors[strtolower($severity)] ?? '#6c757d';
    }

    /**
     * Get allergy type icon
     */
    public function getAllergyTypeIcon(string $type): string
    {
        $icons = [
            'food' => '🍽️',
            'medication' => '💊',
            'environmental' => '🌿',
            'contact' => '🤚',
            'other' => '📌',
        ];

        return $icons[strtolower($type)] ?? '📌';
    }

    public function envelope(): Envelope
    {
        $orgName = is_object($this->organization) ? ($this->organization->name ?? 'Organization') : ($this->organization['name'] ?? 'Organization');
        $patientName = is_object($this->patient) ? ($this->patient->name ?? 'Patient') : ($this->patient['name'] ?? 'Patient');
        $typeConfig = $this->getHistoryTypeConfig();

        return new Envelope(
            subject: "[{$orgName}] {$typeConfig['icon']} Patient {$typeConfig['label']} Updated: {$patientName}"
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.patient-medical-history-updated',
            with: [
                'organization' => $this->organization,
                'patient' => $this->patient,
                'historyType' => $this->historyType,
                'typeConfig' => $this->getHistoryTypeConfig(),
                'updatedBy' => $this->updatedBy,
                'records' => $this->records,
                'patientUrl' => $this->patientUrl,
                'changedAt' => $this->changedAt,
                'tenantTheme' => $this->tenantTheme,
            ]
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
