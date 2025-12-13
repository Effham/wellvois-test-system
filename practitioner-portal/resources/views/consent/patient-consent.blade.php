<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Consent to Treatment - {{ $tenant->company_name }}</title>


    <style>
        :root {
            --primary-color: {{ $branding['appearance_primary_color'] ?? $branding['appearance_theme_color'] ?? '#7c3aed' }};
            --font-family: {{ $branding['appearance_font_family'] ?? "'Inter', sans-serif" }};
        }

        body {
            font-family: var(--font-family);
            background-color: var(--primary-color);
            min-height: 100vh;
            padding: 2rem 1rem;
        }
        
        .consent-card {
            background: white;
            border-radius: 1rem;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .consent-item {
            border: 2px solid #e5e7eb;
            border-radius: 0.5rem;
            padding: 1.5rem;
            margin-bottom: 1rem;
            transition: all 0.3s;
        }
        
        .consent-item.accepted {
            border-color: #10b981;
            background-color: #f0fdf4;
        }
        
        .consent-item:hover {
            border-color: var(--primary-color);
        }
        
        .checkbox-container {
            display: flex;
            align-items: flex-start;
            gap: 1rem;
            cursor: pointer;
        }
        
        .checkbox {
            width: 24px;
            height: 24px;
            border: 2px solid #6b7280;
            border-radius: 4px;
            flex-shrink: 0;
            margin-top: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        
        .checkbox.checked {
            background-color: var(--primary-color);
            border-color: var(--primary-color);
        }
        
        .checkbox.checked::after {
            content: '✓';
            color: white;
            font-weight: bold;
        }
        
        .hidden-checkbox {
            display: none;
        }
        
        .btn-primary {
            background-color: var(--primary-color);
            color: white;
            padding: 0.75rem 2rem;
            border-radius: 0.5rem;
            border: none;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }
        
        .btn-primary:hover {
            transform: translateY(-2px);
        }
        
        .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .loading {
            display: none;
        }
        
        .loading.active {
            display: inline-block;
            margin-left: 0.5rem;
        }
        
        .success-message {
            display: none;
            padding: 1rem;
            background-color: #f0fdf4;
            border: 2px solid #10b981;
            border-radius: 0.5rem;
            margin-bottom: 1rem;
        }
        
        .success-message.active {
            display: block;
        }

        .required-badge {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            background-color: #dc2626;
            color: white;
            border-radius: 0.25rem;
            font-size: 0.75rem;
            font-weight: 600;
            margin-left: 0.5rem;
        }
    </style>
</head>
<body>
    <div class="consent-card">
        @if(!empty($branding['appearance_logo_path']))
        <div class="flex justify-center mb-6">
            <img src="{{ $branding['appearance_logo_path'] }}" alt="{{ $tenant->company_name }}" style="max-height: 80px; max-width: 250px; object-fit: contain;">
        </div>
        @endif

        <div class="mb-6">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">Consent to Treatment</h1>
            <p class="text-gray-600">
                Hello {{ $patient->preferred_name ?: $patient->first_name }},
            </p>
            <p class="text-gray-600">
                Before we proceed with your treatment at <strong>{{ $tenant->company_name }}</strong>, 
                please review and accept the following consents.
            </p>
        </div>
        
        <div id="successMessage" class="success-message">
            <p class="text-green-800 font-semibold">✓ All consents have been accepted successfully!</p>
            <p class="text-green-700 text-sm mt-1">You can close this page.</p>
        </div>
        
        <form id="consentForm">
            @csrf
            <input type="hidden" name="patient_id" value="{{ $patient->id }}">
            
            <div class="mb-6">
                <h2 class="text-xl font-semibold text-gray-900 mb-4">Required Consents</h2>
                
                @if($pendingConsents->isEmpty())
                    <p class="text-gray-600">All required consents have already been accepted.</p>
                @else
                    <!-- Display all consents without individual checkboxes -->
                    @foreach($pendingConsents as $consent)
                        <div class="consent-item" id="consent-{{ $consent->activeVersion->id }}">
                            <div class="flex-1">
                                <h3 class="font-semibold text-gray-900 mb-2">
                                    {{ $consent->title }}
                                    @if($consent->is_required)
                                        <span class="required-badge">Required</span>
                                    @endif
                                </h3>
                                <p class="text-sm text-gray-600 mb-2">
                                    {{ $consent->activeVersion->consent_body['description'] ?? 'Please review and accept this consent.' }}
                                </p>
                                @if(isset($consent->activeVersion->consent_body['content']))
                                    <div class="text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-200 mb-2">
                                        {!! $consent->activeVersion->consent_body['content'] !!}
                                    </div>
                                @endif
                                @if(isset($consent->activeVersion->consent_body['important_notice']))
                                    <p class="text-sm text-amber-700 font-medium">
                                        ⚠️ {{ $consent->activeVersion->consent_body['important_notice'] }}
                                    </p>
                                @endif
                            </div>
                        </div>
                    @endforeach
                    
                    <!-- Single checkbox at bottom -->
                    <div class="single-consent-checkbox mt-6 pt-6 border-t-2 border-gray-200">
                        <label class="checkbox-container">
                            <input 
                                type="checkbox" 
                                class="hidden-checkbox" 
                                id="acceptAllConsents"
                                required
                            >
                            <span class="checkbox" id="checkbox_accept_all"></span>
                            <div class="flex-1">
                                <p class="font-semibold text-gray-900 text-base">
                                    I have read and accept all required consents listed above
                                </p>
                            </div>
                        </label>
                    </div>
                    
                    <!-- Hidden inputs for all consent version IDs -->
                    @foreach($pendingConsents as $consent)
                        <input type="hidden" name="consent_version_ids[]" value="{{ $consent->activeVersion->id }}">
                    @endforeach
                @endif
            </div>
            
            @if($acceptedConsents->isNotEmpty())
                <div class="mb-6">
                    <h2 class="text-xl font-semibold text-gray-900 mb-4">Previously Accepted</h2>
                    @foreach($acceptedConsents as $consent)
                        <div class="consent-item accepted">
                            <div class="flex items-center gap-2">
                                <span class="text-green-600 font-semibold">✓</span>
                                <span class="font-semibold text-gray-900">
                                    {{ $consent->title }}
                                    @if($consent->is_required)
                                        <span class="required-badge">Required</span>
                                    @endif
                                </span>
                            </div>
                        </div>
                    @endforeach
                </div>
            @endif
            
            <div class="flex gap-4">
                <button 
                    type="submit" 
                    class="btn-primary"
                    id="submitBtn"
                    @if($pendingConsents->isEmpty()) disabled @endif
                >
                    Accept All Consents
                    <span class="loading" id="loading">⏳</span>
                </button>
            </div>
        </form>
    </div>
    
    <script>
        // Handle single checkbox click
        const acceptAllCheckbox = document.getElementById('acceptAllConsents');
        const acceptAllCheckboxElement = document.getElementById('checkbox_accept_all');
        
        if (acceptAllCheckbox) {
            acceptAllCheckbox.addEventListener('change', function() {
                if (this.checked) {
                    acceptAllCheckboxElement.classList.add('checked');
                } else {
                    acceptAllCheckboxElement.classList.remove('checked');
                }
            });
        }
        
        // Handle form submission
        document.getElementById('consentForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const loading = document.getElementById('loading');
            const successMessage = document.getElementById('successMessage');
            
            // Check if "Accept All" checkbox is checked
            if (!acceptAllCheckbox.checked) {
                alert('Please accept all required consents to continue.');
                return;
            }
            
            submitBtn.disabled = true;
            loading.classList.add('active');
            
            const formData = new FormData(this);
            
            try {
                const response = await fetch('/consents/accept', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    successMessage.classList.add('active');
                    submitBtn.disabled = true;
                    
                    // Check all checkbox visual elements
                    document.querySelectorAll('.consent-item').forEach(function(item) {
                        item.classList.add('accepted');
                    });
                    
                    // Scroll to top
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    alert('Error: ' + (data.message || 'Failed to accept consents'));
                    submitBtn.disabled = false;
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred. Please try again.');
                submitBtn.disabled = false;
            } finally {
                loading.classList.remove('active');
            }
        });
    </script>
</body>
</html>

