@extends('emails.layouts.consent-base')

@section('content')
    @php
        $subject = 'Consent Required';
        $title = '📋 Consent Required';
    @endphp

    <h2>Hello {{ $patient->first_name }} {{ $patient->last_name }},</h2>
    
    <p>Welcome to <strong>{{ $tenant->company_name }}</strong>! Before you can access your patient portal, we need you to review and accept our required consents.</p>
    
    <div class="info-box">
        <strong>What you need to do:</strong>
        <ul>
            <li>Click the button below to review and accept required consents</li>
            <li>Review each consent carefully</li>
            <li>Accept all required consents to access your patient portal</li>
            <li>Once completed, you'll have full access to your healthcare information</li>
        </ul>
    </div>
    
    <div style="text-align: center;">
        <a href="{{ $consentUrl }}" class="btn">Review & Accept Consents</a>
    </div>
    
    <div class="highlight">
        <strong>⏰ Important:</strong> This consent link is valid for 7 days. Please complete the consent process to ensure uninterrupted access to your patient portal.
    </div>
    
    <p>These consents are required by law (HIPAA and privacy regulations) and ensure that you understand how your health information is used and protected.</p>
    
    <p>If you have any questions about these consents, please contact {{ $tenant->company_name }} directly.</p>
@endsection


