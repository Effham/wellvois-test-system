<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OrganizationSettingsUpdatedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    /**
     * Public so Blade can access directly.
     */
    public $organization;   // \App\Models\Organization | array-like (name, id)

    public $sectionKey;     // 'appearance' | 'practice-details' | 'time-locale' | 'business-compliance-details' | 'appointment-settings'

    public $updatedBy;      // \App\Models\User | array-like (name, email)

    public $changedAt;      // \Carbon\Carbon|string

    public $changes;        // array of [field => ['old' => x, 'new' => y]]

    public $settingsUrl;    // string|null

    public $tenantTheme;    // hex color string

    /**
     * Create a new message instance.
     *
     * @param  mixed  $organization  // expects ['name' => '...', 'id' => ...] or model with ->name
     * @param  string  $sectionKey  // see allowed values above
     * @param  mixed|null  $updatedBy  // optional user (for "updated by")
     * @param  array  $changes  // optional diff: ['field_key' => ['old' => 'Old', 'new' => 'New'], ...]
     * @param  string|null  $settingsUrl  // optional direct link to admin settings page
     * @param  mixed|null  $changedAt  // optional custom timestamp, defaults to now()
     */
    public function __construct($organization, string $sectionKey, $updatedBy = null, array $changes = [], ?string $settingsUrl = null, $changedAt = null)
    {
        $this->organization = $organization;
        $this->sectionKey = $sectionKey;
        $this->updatedBy = $updatedBy;
        $this->changes = $changes;
        $this->settingsUrl = $settingsUrl;
        $this->changedAt = $changedAt ?? now();

        // Pull theme color if you support multi-tenant appearance
        $this->tenantTheme = \App\Models\OrganizationSetting::getValue('appearance_theme_color') ?? '#0d6efd';
    }

    /**
     * Map section keys to human labels + emoji.
     */
    public function getSectionConfig(): array
    {
        $map = [
            'appearance' => ['label' => 'Appearance', 'icon' => '🎨'],
            'practice-details' => ['label' => 'Practice Details', 'icon' => '🏢'],
            'time-locale' => ['label' => 'Time & Locale', 'icon' => '⏰'],
            'business-compliance-details' => ['label' => 'Business & Compliance', 'icon' => '🧾'],
            'appointment-settings' => ['label' => 'Appointment Settings', 'icon' => '📅'],
        ];

        return $map[$this->sectionKey] ?? ['label' => ucfirst(str_replace('-', ' ', $this->sectionKey)), 'icon' => '⚙️'];
    }

    public function envelope(): Envelope
    {
        $orgName = is_object($this->organization) ? ($this->organization->name ?? 'Organization') : ($this->organization['name'] ?? 'Organization');
        $section = $this->getSectionConfig()['label'];

        return new Envelope(
            subject: "[{$orgName}] Settings updated: {$section}"
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.organization-settings-updated',
            with: [
                'organization' => $this->organization,
                'sectionKey' => $this->sectionKey,
                'section' => $this->getSectionConfig(),
                'updatedBy' => $this->updatedBy,
                'changes' => $this->changes,
                'settingsUrl' => $this->settingsUrl,
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
