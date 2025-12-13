<?php

namespace Database\Seeders;

use App\Models\Tenant\Consent;
use App\Models\Tenant\ConsentVersion;
use Illuminate\Database\Seeder;

class DefaultConsentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $consents = [
            // Practitioner consents
            [
                'key' => 'practitioner_oath_confidentiality',
                'title' => "Practitioner's Oath of Confidentiality",
                'entity_type' => 'PRACTITIONER',
                'is_required' => true,
                'trigger_points' => ['practitioner' => ['creation']],
                'body' => [
                    'heading' => "Practitioner's Oath of Confidentiality",
                    'description' => 'Required for Dashboard Access',
                    'content' => 'I agree to uphold the Wellovis Practitioner\'s Oath of Confidentiality. I confirm that I understand my role as a Health Information Custodian (HIC) or Agent thereof, and I commit to maintaining the strictest privacy and security of all patient data (PHI). I will use and disclose patient information only for the purpose of treatment, payment, or as explicitly permitted by applicable Canadian privacy laws (e.g., PIPEDA, PHIPA). I agree to implement all necessary safeguards and immediately report any known or suspected privacy breach.',
                    'checkbox_text' => 'I agree to uphold the Wellovis Practitioner\'s Oath of Confidentiality.',
                    'important_notice' => 'As a healthcare practitioner, you will have access to sensitive patient information. This oath is legally binding and required for your access to the Wellovis EMR platform.',
                ],
            ],
            [
                'key' => 'administrative_access_consent',
                'title' => 'Administrative Access Consent',
                'entity_type' => 'PRACTITIONER',
                'is_required' => true,
                'trigger_points' => ['practitioner' => ['creation']],
                'body' => [
                    'heading' => 'Administrative Access Consent',
                    'description' => 'Required for EMR Platform Access',
                    'content' => 'I consent to the limited, necessary administrative access to my professional profile and data by Wellovis personnel. By checking this box, I acknowledge and agree that authorized administrative staff of Wellovis may view and manage my availability, locations, and appointment metadata (date, time, service) for the exclusive purposes of platform maintenance, technical support, and operational management. This access adheres to the legal principle of "Minimum Necessary" use of health information and is required for my use of the Wellovis EMR platform.',
                    'checkbox_text' => 'I consent to the limited, necessary administrative access to my professional profile and data by Wellovis personnel.',
                    'legal_principle' => 'This access adheres to the legal principle of "Minimum Necessary" use of health information and is required for my use of the Wellovis EMR platform.',
                ],
            ],
            [
                'key' => 'document_security_consent',
                'title' => 'Document Security Consent',
                'entity_type' => 'PRACTITIONER',
                'is_required' => true,
                'trigger_points' => ['practitioner' => ['creation']],
                'body' => [
                    'heading' => 'Document Security Consent',
                    'description' => 'Required before uploading documents',
                    'content' => 'I acknowledge that when I download my Personal Health Information (PHI) from the secure Wellovis EMR to my personal device, the security and privacy of those files become my sole responsibility. I understand that Wellovis and my Practitioner cannot control or protect the downloaded files and will not be liable for any unauthorized access that occurs once the files have left the secure platform.',
                    'checkbox_text' => 'I confirm I understand the security risks of downloading my health documents from Wellovis.',
                    'security_notice' => 'This document will be accessible to the patient and may be downloaded to their personal device.',
                ],
            ],
            // Patient consents
            [
                'key' => 'patient_privacy_practices_acknowledgment',
                'title' => 'Notice of Privacy Practices Acknowledgment',
                'entity_type' => 'PATIENT',
                'is_required' => true,
                'trigger_points' => ['patient' => ['creation']],
                'body' => [
                    'heading' => 'Notice of Privacy Practices Acknowledgment',
                    'description' => 'Required for HIPAA compliance - Patient Portal Access',
                    'content' => 'I acknowledge that I have received and reviewed a copy of Wellovis\'s Notice of Privacy Practices. This notice describes how my health information may be used and disclosed, and how I can access and control my health information. I understand my rights regarding my Protected Health Information (PHI) as required by the Health Insurance Portability and Accountability Act (HIPAA). I understand that I may request a paper copy of this notice at any time.',
                    'checkbox_text' => 'I acknowledge that I have received and reviewed the Notice of Privacy Practices.',
                    'important_notice' => 'This acknowledgment is required by law for access to healthcare services through the Wellovis platform.',
                ],
            ],
            [
                'key' => 'patient_consent_for_treatment',
                'title' => 'Consent for Treatment',
                'entity_type' => 'PATIENT',
                'is_required' => true,
                'trigger_points' => ['patient' => ['creation']],
                'body' => [
                    'heading' => 'Consents',
                    'description' => 'Required for receiving healthcare services',
                    'content' => 'I consent to receive medical, therapeutic, and healthcare services from my healthcare providers through the Wellovis platform. I understand that these services may include consultations, assessments, treatment planning, therapy sessions, and other healthcare-related services. I acknowledge that I have the right to ask questions about my treatment, to refuse treatment, and to terminate treatment at any time. I understand that my consent to treatment is voluntary and that I may withdraw this consent at any time.',
                    'checkbox_text' => 'I consent to receive medical and therapeutic services from my healthcare providers.',
                    'important_notice' => 'Your care team will work with you to develop a treatment plan that aligns with your goals and needs.',
                ],
            ],
            [
                'key' => 'patient_consent_phi_use_disclosure',
                'title' => 'Consent for Use & Disclosure of PHI',
                'entity_type' => 'PATIENT',
                'is_required' => true,
                'trigger_points' => ['patient' => ['creation']],
                'body' => [
                    'heading' => 'Consent for Use & Disclosure of Protected Health Information',
                    'description' => 'Required for HIPAA compliance',
                    'content' => 'I consent to the use and disclosure of my Protected Health Information (PHI) for treatment, payment, and healthcare operations as described in the Notice of Privacy Practices. I understand that this includes sharing my health information with healthcare providers involved in my care, health insurance plans for payment purposes, and for internal operations such as quality improvement and care coordination. This consent is in accordance with HIPAA regulations and my rights are protected as described in the Notice of Privacy Practices.',
                    'checkbox_text' => 'I consent to the use and disclosure of my health information for treatment, payment, and healthcare operations.',
                    'important_notice' => 'Your health information will be used and disclosed only as necessary for your care and as permitted by law.',
                ],
            ],
            [
                'key' => 'patient_consent_third_party_sharing',
                'title' => 'Consent to Share Information with Third Parties (AI Summary Generation)',
                'entity_type' => 'PATIENT',
                'is_required' => true,
                'trigger_points' => ['patient' => ['creation']],
                'body' => [
                    'heading' => 'Consent to Share Information with Third Parties for AI-Assisted Services',
                    'description' => 'Required for AI summary generation and related services',
                    'content' => 'I consent to the sharing of my health information with third-party artificial intelligence (AI) services, specifically for the purpose of generating clinical summaries, treatment plan summaries, and other AI-assisted healthcare documentation. I understand that this data will be processed securely and in compliance with applicable privacy laws. The AI services may analyze my health information to generate summaries and insights that assist my healthcare providers in delivering more efficient and effective care. I understand that I may opt out of AI-assisted services at any time and that this will not affect the quality of my care.',
                    'checkbox_text' => 'I consent to share my health information with third-party AI services for summary generation and related services.',
                    'important_notice' => 'AI-assisted services are designed to improve care quality and efficiency while maintaining strict security and privacy standards.',
                ],
            ],
            [
                'key' => 'patient_consent_receive_communications',
                'title' => 'Consent to Receive Communications',
                'entity_type' => 'PATIENT',
                'is_required' => true,
                'trigger_points' => ['patient' => ['creation']],
                'body' => [
                    'heading' => 'Consent to Receive Communications',
                    'description' => 'Required for appointment reminders and care communications',
                    'content' => 'I consent to receive communications from Wellovis and my healthcare providers via email, SMS text messages, and phone calls. These communications may include appointment reminders, treatment updates, care plan information, health tips, and administrative notifications. I understand that I may receive appointment confirmations and reminders, follow-up care instructions, and other important healthcare-related communications. I acknowledge that I may opt out of non-essential communications at any time while continuing to receive critical care-related communications as legally required.',
                    'checkbox_text' => 'I consent to receive communications including appointment reminders and care-related messages.',
                    'important_notice' => 'You can update your communication preferences in your account settings at any time.',
                ],
            ],
            [
                'key' => 'patient_consent_data_storage',
                'title' => 'Consent for Electronic Data Storage',
                'entity_type' => 'PATIENT',
                'is_required' => true,
                'trigger_points' => ['patient' => ['creation']],
                'body' => [
                    'heading' => 'Consent for Electronic Data Storage and Security',
                    'description' => 'Required for storing health information electronically',
                    'content' => 'I consent to the electronic storage of my health information on the Wellovis platform. I understand that my health information will be stored securely using industry-standard encryption and security measures compliant with HIPAA regulations. I acknowledge that electronic storage allows for improved access to my health records, better care coordination among providers, and enhanced healthcare delivery. I understand that Wellovis uses multi-layer encryption (CipherSweet and AWS KMS) to protect my sensitive health information.',
                    'checkbox_text' => 'I consent to the secure electronic storage of my health information.',
                    'important_notice' => 'Your health information is encrypted using industry-leading security measures to ensure the highest level of privacy and protection.',
                ],
            ],
            [
                'key' => 'patient_privacy_policy_acknowledgment',
                'title' => 'Privacy Policy Acknowledgment',
                'entity_type' => 'PATIENT',
                'is_required' => true,
                'trigger_points' => ['patient' => ['creation']],
                'body' => [
                    'heading' => 'Privacy Policy Acknowledgment',
                    'description' => 'Required for platform access',
                    'content' => 'I acknowledge that I have read and understood the Wellovis Privacy Policy. I understand how my personal information and health data are collected, used, stored, and protected. I understand that Wellovis is committed to protecting my privacy and maintaining the confidentiality of my health information in accordance with applicable privacy laws including HIPAA and Canadian privacy regulations (PIPEDA, PHIPA). I acknowledge my rights regarding access to, correction of, and deletion of my information as described in the Privacy Policy.',
                    'checkbox_text' => 'I acknowledge that I have read and understood the Privacy Policy.',
                    'important_notice' => 'Your privacy is our priority. We are committed to protecting your personal health information.',
                ],
            ],
            [
                'key' => 'patient_terms_of_service',
                'title' => 'Terms of Service',
                'entity_type' => 'PATIENT',
                'is_required' => true,
                'trigger_points' => ['patient' => ['creation']],
                'body' => [
                    'heading' => 'Terms of Service',
                    'description' => 'Required for account creation and platform access',
                    'content' => 'These Terms of Service govern your use of the Wellovis platform. By accepting these terms, you agree to comply with all applicable laws and regulations. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Wellovis reserves the right to modify these terms at any time, and continued use of the platform constitutes acceptance of any such modifications.',
                    'checkbox_text' => 'I agree to the Terms of Service.',
                    'important_notice' => 'Please review these terms carefully before creating your account.',
                ],
            ],
            [
                'key' => 'patient_privacy_policy',
                'title' => 'Privacy Policy',
                'entity_type' => 'PATIENT',
                'is_required' => true,
                'trigger_points' => ['patient' => ['creation']],
                'body' => [
                    'heading' => 'Privacy Policy',
                    'description' => 'Required for account creation and platform access',
                    'content' => 'This Privacy Policy describes how Wellovis collects, uses, stores, and protects your personal health information (PHI). We are committed to maintaining the confidentiality and security of your information in accordance with HIPAA and applicable Canadian privacy laws (PIPEDA, PHIPA). We collect information necessary to provide healthcare services, process payments, and improve our services. Your health information will only be shared with authorized healthcare providers and in compliance with legal requirements.',
                    'checkbox_text' => 'I have read and agree to the Privacy Policy.',
                    'important_notice' => 'Your privacy and security are our top priorities.',
                ],
            ],
            // Practitioner legal consents
            [
                'key' => 'practitioner_terms_of_service',
                'title' => 'Terms of Service',
                'entity_type' => 'PRACTITIONER',
                'is_required' => true,
                'trigger_points' => ['practitioner' => ['creation']],
                'body' => [
                    'heading' => 'Terms of Service',
                    'description' => 'Required for account creation and platform access',
                    'content' => 'These Terms of Service govern your use of the Wellovis EMR platform as a healthcare practitioner. By accepting these terms, you agree to comply with all applicable laws and regulations, maintain professional standards, and protect patient confidentiality. You are responsible for maintaining the security of your account credentials and for all activities that occur under your account. Wellovis reserves the right to modify these terms at any time, and continued use of the platform constitutes acceptance of any such modifications.',
                    'checkbox_text' => 'I agree to the Terms of Service.',
                    'important_notice' => 'Please review these terms carefully before creating your account.',
                ],
            ],
            [
                'key' => 'practitioner_privacy_policy',
                'title' => 'Privacy Policy',
                'entity_type' => 'PRACTITIONER',
                'is_required' => true,
                'trigger_points' => ['practitioner' => ['creation']],
                'body' => [
                    'heading' => 'Privacy Policy',
                    'description' => 'Required for account creation and platform access',
                    'content' => 'This Privacy Policy describes how Wellovis collects, uses, stores, and protects information on the EMR platform. As a healthcare practitioner, you will have access to patient health information and are required to maintain strict confidentiality in accordance with HIPAA and applicable Canadian privacy laws (PIPEDA, PHIPA). We collect information necessary to provide healthcare services, maintain records, and ensure platform security. All data is protected using industry-standard encryption and security measures.',
                    'checkbox_text' => 'I have read and agree to the Privacy Policy.',
                    'important_notice' => 'Patient confidentiality and data security are paramount to our operations.',
                ],
            ],
            // Patient session recording consent
            [
                'key' => 'patient_consent_session_recording',
                'title' => 'Consent for Session Audio Recording',
                'entity_type' => 'PATIENT',
                'is_required' => true,
                'trigger_points' => ['patient' => ['appointment_creation']],
                'body' => [
                    'heading' => 'Consent for Session Audio Recording',
                    'description' => 'Required for recording audio during your healthcare session',
                    'content' => 'I consent to the audio recording of this healthcare session. I understand that this recording will be used for documentation purposes, quality assurance, and to maintain an accurate record of my care. The recording will be stored securely and will only be accessible to authorized healthcare providers involved in my care. I understand that I can revoke this consent at any time, though recordings made prior to revocation will be retained as part of my medical record.',
                    'checkbox_text' => 'I consent to audio recording of this session.',
                    'important_notice' => 'Audio recordings are stored securely and only used for your healthcare documentation and quality of care.',
                ],
            ],
        ];

        foreach ($consents as $consentData) {
            // Check if consent already exists
            $consent = Consent::where('key', $consentData['key'])->first();

            if ($consent) {
                // Update existing consent
                $updateData = [
                    'title' => $consentData['title'],
                    'entity_type' => $consentData['entity_type'],
                ];

                // Only update is_required if current value is false and new value is true
                if (! $consent->is_required && ($consentData['is_required'] ?? false)) {
                    $updateData['is_required'] = true;
                }

                // Always update trigger_points if provided
                if (isset($consentData['trigger_points'])) {
                    $updateData['trigger_points'] = $consentData['trigger_points'];
                }

                $consent->update($updateData);

                if ($this->command) {
                    $wasUpdated = isset($updateData['is_required']) ? ' (is_required updated to true)' : '';
                    $this->command->info("Updated consent: {$consentData['title']}{$wasUpdated}");
                }
            } else {
                // Create new consent
                $consent = Consent::create([
                    'key' => $consentData['key'],
                    'title' => $consentData['title'],
                    'entity_type' => $consentData['entity_type'],
                    'is_required' => $consentData['is_required'] ?? false,
                    'trigger_points' => $consentData['trigger_points'] ?? null,
                ]);

                // Create the first version
                ConsentVersion::create([
                    'consent_id' => $consent->id,
                    'version' => 1,
                    'consent_body' => $consentData['body'],
                    'status' => 'ACTIVE',
                ]);

                if ($this->command) {
                    $this->command->info("Created consent: {$consentData['title']}");
                }
            }
        }
    }
}
