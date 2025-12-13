<?php

namespace Tests\Feature;

use App\Mail\BatchConsentNotificationMail;
use App\Models\Tenant;
use App\Models\Tenant\Appointment;
use App\Models\Tenant\Consent;
use App\Models\Tenant\Patient;
use App\Services\ConsentTriggerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AppointmentConsentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Create a tenant and initialize tenancy
        $this->tenant = Tenant::factory()->create();
        tenancy()->initialize($this->tenant);

        // Set up test consents
        $this->setupTestConsents();
    }

    protected function setupTestConsents(): void
    {
        // Create creation consents (9 required consents)
        $creationConsentKeys = [
            'patient_privacy_practices_acknowledgment',
            'patient_consent_for_treatment',
            'patient_consent_phi_use_disclosure',
            'patient_consent_third_party_sharing',
            'patient_consent_receive_communications',
            'patient_consent_data_storage',
            'patient_privacy_policy_acknowledgment',
            'patient_terms_of_service',
            'patient_privacy_policy',
        ];

        foreach ($creationConsentKeys as $key) {
            $consent = Consent::factory()->create([
                'key' => $key,
                'entity_type' => 'PATIENT',
                'is_required' => true,
                'trigger_points' => [
                    'patient' => ['creation'],
                ],
            ]);

            // Create active version for each consent
            $consent->versions()->create([
                'version' => 1,
                'content' => "Test content for {$key}",
                'is_active' => true,
            ]);
        }

        // Create appointment_creation consent (1 required consent)
        $appointmentConsent = Consent::factory()->create([
            'key' => 'patient_consent_session_recording',
            'entity_type' => 'PATIENT',
            'is_required' => true,
            'trigger_points' => [
                'patient' => ['appointment_creation'],
            ],
        ]);

        $appointmentConsent->versions()->create([
            'version' => 1,
            'content' => 'Test content for session recording consent',
            'is_active' => true,
        ]);
    }

    public function test_new_patient_appointment_sends_batch_email_with_all_consents(): void
    {
        Mail::fake();

        // Create a new patient (no consents accepted yet)
        $patient = Patient::factory()->create([
            'email' => 'newpatient@example.com',
        ]);

        // Trigger consents with fallback (simulating appointment creation)
        $service = app(ConsentTriggerService::class);
        $service->triggerConsentsWithFallback('PATIENT', 'appointment_creation', $patient, 'creation');

        // Assert batch email was sent
        Mail::assertSent(BatchConsentNotificationMail::class, function ($mail) use ($patient) {
            // Check email is sent to correct patient
            return $mail->hasTo($patient->email);
        });

        // Get the sent mail to verify content
        $sentMails = Mail::sent(BatchConsentNotificationMail::class);
        $this->assertCount(1, $sentMails, 'Should send exactly one batch email');

        // Verify the batch contains all 10 consents (9 creation + 1 appointment_creation)
        $firstMail = $sentMails->first();
        $consents = $firstMail->consents;
        $this->assertCount(10, $consents, 'Batch email should contain all 10 consents for new patient');

        // Verify it includes both types of consents
        $consentKeys = $consents->pluck('key')->toArray();
        $this->assertContains('patient_consent_session_recording', $consentKeys, 'Should include appointment consent');
        $this->assertContains('patient_privacy_policy', $consentKeys, 'Should include creation consent');
    }

    public function test_existing_patient_appointment_sends_only_appointment_consents(): void
    {
        Mail::fake();

        // Create an existing patient
        $patient = Patient::factory()->create([
            'email' => 'existingpatient@example.com',
        ]);

        // Accept all creation consents (simulating existing patient who already completed onboarding)
        $creationConsents = Consent::where('entity_type', 'PATIENT')
            ->get()
            ->filter(function ($consent) {
                $triggerPoints = $consent->trigger_points;

                return isset($triggerPoints['patient']) &&
                    in_array('creation', $triggerPoints['patient']);
            });

        foreach ($creationConsents as $consent) {
            $patient->acceptConsent($consent->activeVersion->id);
        }

        // Trigger consents with fallback (simulating appointment creation for existing patient)
        $service = app(ConsentTriggerService::class);
        $service->triggerConsentsWithFallback('PATIENT', 'appointment_creation', $patient, 'creation');

        // Assert batch email was sent
        Mail::assertSent(BatchConsentNotificationMail::class, function ($mail) use ($patient) {
            return $mail->hasTo($patient->email);
        });

        // Get the sent mail to verify content
        $sentMails = Mail::sent(BatchConsentNotificationMail::class);
        $this->assertCount(1, $sentMails, 'Should send exactly one batch email');

        // Verify the batch contains only 1 consent (appointment_creation only)
        $firstMail = $sentMails->first();
        $consents = $firstMail->consents;
        $this->assertCount(1, $consents, 'Batch email should contain only appointment consent for existing patient');

        // Verify it's the appointment consent
        $consentKeys = $consents->pluck('key')->toArray();
        $this->assertEquals(['patient_consent_session_recording'], $consentKeys);
    }

    public function test_no_email_sent_when_all_consents_already_accepted(): void
    {
        Mail::fake();

        // Create an existing patient
        $patient = Patient::factory()->create([
            'email' => 'fullyconsentedpatient@example.com',
        ]);

        // Accept ALL consents (both creation and appointment_creation)
        $allConsents = Consent::where('entity_type', 'PATIENT')->get();

        foreach ($allConsents as $consent) {
            if ($consent->activeVersion) {
                $patient->acceptConsent($consent->activeVersion->id);
            }
        }

        // Trigger consents with fallback
        $service = app(ConsentTriggerService::class);
        $service->triggerConsentsWithFallback('PATIENT', 'appointment_creation', $patient, 'creation');

        // Assert NO email was sent (all consents already accepted)
        Mail::assertNotSent(BatchConsentNotificationMail::class);
    }
}
