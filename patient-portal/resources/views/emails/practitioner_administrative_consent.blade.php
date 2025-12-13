@extends('emails.layouts.consent-base')

@section('content')
    @php
        $subject = 'Administrative Access Consent Required';
        $title = 'Administrative Access Consent Required';
    @endphp

    <h2>Hello {{ $practitioner->first_name }} {{ $practitioner->last_name }},</h2>
    
    <p>Thank you for completing your professional information setup with {{ $tenant->company_name }}. To complete your account setup and gain access to the Wellovis EMR platform, you must accept our Administrative Access Consent.</p>
    
    <div class="highlight">
        <strong>⏰ Important:</strong> This consent is required before you can access the EMR platform. Please review the terms carefully and use the single "Accept All" checkbox to acknowledge your agreement.
    </div>
    
    <div class="info-box">
        <strong>What this consent covers:</strong>
        <ul>
            <li>Limited administrative access to your professional profile and data by Wellovis personnel</li>
            <li>Management of your availability, locations, and appointment metadata for platform maintenance</li>
            <li>Technical support and operational management purposes</li>
            <li>Adherence to "Minimum Necessary" use of health information principles</li>
        </ul>
    </div>
    
    <p>This consent is legally binding and required for your use of the Wellovis EMR platform. By accepting all consents, you acknowledge that you have read, understood, and agree to these terms.</p>
    
    <div style="text-align: center;">
        <a href="{{ $consentUrl }}" class="btn">Review & Accept All Consents</a>
    </div>
    
    <p><strong>Note:</strong> This link will expire in 7 days for security reasons. If you need a new link, please contact your administrator.</p>
    
    <p>If you have any questions about this consent or the Wellovis EMR platform, please contact your administrator at {{ $tenant->company_name }}.</p>
@endsection
