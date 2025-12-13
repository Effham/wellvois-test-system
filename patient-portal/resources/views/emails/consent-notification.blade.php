@extends('emails.layouts.consent-base')

@section('content')
    <h2>Hello {{ $entity->first_name ?? 'there' }} {{ $entity->last_name ?? '' }},</h2>

    @if($consent->is_required)
        <p>We need your attention regarding a <strong>required consent</strong> for <strong>{{ $tenant->company_name }}</strong>.</p>

        <div class="info-box" style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
            <strong>📋 Required Consent:</strong>
            <h3 style="margin: 10px 0;">{{ $consent->title }}</h3>
            <p style="margin: 10px 0;">This consent is required to continue using our services.</p>
        </div>
    @else
        <p>A new <strong>optional consent</strong> is available for your review at <strong>{{ $tenant->company_name }}</strong>.</p>

        <div class="info-box" style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
            <strong>📋 New Consent Available:</strong>
            <h3 style="margin: 10px 0;">{{ $consent->title }}</h3>
            <p style="margin: 10px 0;">This is an optional consent that you may review and accept at your convenience.</p>
        </div>
    @endif

    <div class="info-box" style="background-color: #f9fafb; border-left: 4px solid #6b7280; padding: 15px; margin: 20px 0;">
        <strong>What you need to do:</strong>
        <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Click the button below to review the consent</li>
            <li>Read through the consent details carefully</li>
            @if($consent->is_required)
                <li>Accept the consent to continue using our services</li>
            @else
                <li>Accept the consent if you agree with the terms</li>
            @endif
        </ul>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <a href="{{ $consentUrl }}" class="btn">
            Review Consent
        </a>
    </div>

    @if($consent->is_required)
        <div class="highlight" style="background-color: #fef3c7; border: 1px solid #fbbf24; padding: 15px; margin: 20px 0; border-radius: 6px;">
            <strong>⚠️ Action Required:</strong> This is a required consent. Please review and accept it to ensure uninterrupted access to our services.
        </div>
    @endif

    <p style="color: #6b7280; font-size: 14px;">
        These consents ensure compliance with applicable laws and regulations, including HIPAA and privacy requirements. They help us protect your information and clarify how we use and handle your data.
    </p>

    <p style="color: #6b7280; font-size: 14px;">
        If you have any questions about this consent, please contact <strong>{{ $tenant->company_name }}</strong> directly.
    </p>
@endsection
