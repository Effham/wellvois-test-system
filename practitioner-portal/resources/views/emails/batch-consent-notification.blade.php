@extends('emails.layouts.consent-base')

@section('content')
    <h2>Hello {{ $entity->first_name ?? 'there' }} {{ $entity->last_name ?? '' }},</h2>

    @php
        $requiredCount = $consents->where('is_required', true)->count();
        $optionalCount = $consents->count() - $requiredCount;
    @endphp

    @if($requiredCount > 0)
        <p>You have <strong>{{ $requiredCount }} required consent{{ $requiredCount > 1 ? 's' : '' }}</strong>
        @if($optionalCount > 0)
            and <strong>{{ $optionalCount }} optional consent{{ $optionalCount > 1 ? 's' : '' }}</strong>
        @endif
        to review for <strong>{{ $tenant->company_name }}</strong>.</p>
    @else
        <p>You have <strong>{{ $consents->count() }} new consent{{ $consents->count() > 1 ? 's' : '' }}</strong> available for review at <strong>{{ $tenant->company_name }}</strong>.</p>
    @endif

    <div style="margin: 20px 0;">
        <h3 style="color: #374151; margin-bottom: 15px;">Consents to Review:</h3>

        @foreach($consents as $consent)
            <div class="info-box" style="background-color: {{ $consent->is_required ? '#fef2f2' : '#f9fafb' }}; border-left: 4px solid {{ $consent->is_required ? '#ef4444' : '#6b7280' }}; padding: 15px; margin: 15px 0;">
                <div style="display: flex; align-items: start; justify-content: space-between;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 5px 0; color: #111827;">{{ $consent->title }}</h4>
                        @if($consent->activeVersion && isset($consent->activeVersion->consent_body['description']))
                            <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">{{ $consent->activeVersion->consent_body['description'] }}</p>
                        @endif
                    </div>
                    @if($consent->is_required)
                        <span style="background-color: #ef4444; color: #ffffff; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; white-space: nowrap; margin-left: 10px;">
                            REQUIRED
                        </span>
                    @endif
                </div>
            </div>
        @endforeach
    </div>

    <div class="info-box" style="background-color: #f9fafb; border-left: 4px solid #6b7280; padding: 15px; margin: 20px 0;">
        <strong>What you need to do:</strong>
        <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Click the button below to review all consents</li>
            <li>Read through each consent carefully</li>
            @if($requiredCount > 0)
                <li>Accept all required consents to continue using our services</li>
            @else
                <li>Accept the consents if you agree with the terms</li>
            @endif
        </ul>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <a href="{{ $consentUrl }}" class="btn">
            Review All Consents
        </a>
    </div>

    @if($requiredCount > 0)
        <div class="highlight" style="background-color: #fef3c7; border: 1px solid #fbbf24; padding: 15px; margin: 20px 0; border-radius: 6px;">
            <strong>⚠️ Action Required:</strong> {{ $requiredCount }} of these consent{{ $requiredCount > 1 ? 's are' : ' is' }} required. Please review and accept {{ $requiredCount > 1 ? 'them' : 'it' }} to ensure uninterrupted access to our services.
        </div>
    @endif

    <p style="color: #6b7280; font-size: 14px;">
        These consents ensure compliance with applicable laws and regulations, including HIPAA and privacy requirements. They help us protect your information and clarify how we use and handle your data.
    </p>

    <p style="color: #6b7280; font-size: 14px;">
        If you have any questions about these consents, please contact <strong>{{ $tenant->company_name }}</strong> directly.
    </p>
@endsection
