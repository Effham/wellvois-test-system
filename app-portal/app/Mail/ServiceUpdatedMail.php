<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ServiceUpdatedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public $organization;

    public $service;

    public $action; // 'created' | 'updated'

    public $updatedBy;

    public $changedAt;

    public $changes;

    public $serviceUrl;

    public $tenantTheme;

    /**
     * Create a new message instance.
     *
     * @param  mixed  $organization  // expects ['name' => '...'] or model with ->name
     * @param  mixed  $service  // \App\Models\Service or array with service data
     * @param  string  $action  // 'created' or 'updated'
     * @param  mixed|null  $updatedBy  // optional user
     * @param  array  $changes  // optional diff: ['field_key' => ['old' => 'Old', 'new' => 'New'], ...]
     * @param  string|null  $serviceUrl  // optional direct link to service
     * @param  mixed|null  $changedAt  // optional custom timestamp
     */
    public function __construct($organization, $service, string $action, $updatedBy = null, array $changes = [], ?string $serviceUrl = null, $changedAt = null)
    {
        $this->organization = $organization;
        $this->service = $service;
        $this->action = $action;
        $this->updatedBy = $updatedBy;
        $this->changes = $changes;
        $this->serviceUrl = $serviceUrl;
        $this->changedAt = $changedAt ?? now();

        // Pull theme color if you support multi-tenant appearance
        $this->tenantTheme = \App\Models\OrganizationSetting::getValue('appearance_theme_color') ?? '#0d6efd';
    }

    /**
     * Get action config (label + emoji)
     */
    public function getActionConfig(): array
    {
        $map = [
            'created' => ['label' => 'Created', 'icon' => '✨', 'verb' => 'created'],
            'updated' => ['label' => 'Updated', 'icon' => '🔄', 'verb' => 'updated'],
        ];

        return $map[$this->action] ?? ['label' => ucfirst($this->action), 'icon' => '📋', 'verb' => $this->action];
    }

    /**
     * Get category icon
     */
    public function getCategoryIcon(string $category): string
    {
        $icons = [
            'Individual' => '👤',
            'Couple' => '👥',
            'Group' => '👨‍👩‍👧‍👦',
            'Assessment' => '📋',
            'Family' => '👨‍👩‍👧',
            'Specialty' => '⭐',
            'Follow-Up' => '🔁',
        ];

        return $icons[$category] ?? '📌';
    }

    public function envelope(): Envelope
    {
        $orgName = is_object($this->organization) ? ($this->organization->name ?? 'Organization') : ($this->organization['name'] ?? 'Organization');
        $serviceName = is_object($this->service) ? $this->service->name : ($this->service['name'] ?? 'Service');
        $actionConfig = $this->getActionConfig();

        return new Envelope(
            subject: "[{$orgName}] Service {$actionConfig['verb']}: {$serviceName}"
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.service-updated',
            with: [
                'organization' => $this->organization,
                'service' => $this->service,
                'action' => $this->action,
                'actionConfig' => $this->getActionConfig(),
                'updatedBy' => $this->updatedBy,
                'changes' => $this->changes,
                'serviceUrl' => $this->serviceUrl,
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
