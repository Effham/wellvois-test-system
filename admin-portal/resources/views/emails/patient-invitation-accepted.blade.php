<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $isNewUser ? 'Welcome' : 'Invitation Accepted' }} - {{ $tenant->company_name }}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #f8f6fb 0%, #fafafa 100%);
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            margin-top: 20px;
            margin-bottom: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: repeating-linear-gradient(
                45deg,
                transparent,
                transparent 10px,
                rgba(255,255,255,0.05) 10px,
                rgba(255,255,255,0.05) 20px
            );
            animation: float 20s ease-in-out infinite;
        }
        @keyframes float {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            50% { transform: translate(-10px, -10px) rotate(5deg); }
        }
        .header-icon {
            font-size: 48px;
            margin-bottom: 15px;
            position: relative;
            z-index: 2;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
            letter-spacing: 1px;
            position: relative;
            z-index: 2;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .content {
            padding: 45px 40px;
        }
        .welcome-title {
            font-size: 26px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 20px;
            font-weight: 600;
            text-align: center;
        }
        .status-badge {
            display: inline-block;
            background-color: #28a745;
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 25px;
            text-align: center;
            width: 100%;
            box-sizing: border-box;
        }
        .confirmation-message {
            background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
            border-left: 4px solid #22c55e;
            border-radius: 0 8px 8px 0;
            padding: 25px;
            margin: 30px 0;
            position: relative;
            box-shadow: 0 2px 12px rgba(34, 197, 94, 0.1);
        }
        .confirmation-message::before {
            content: '✅';
            position: absolute;
            top: -15px;
            left: 20px;
            background: #22c55e;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        }
        .message-text {
            color: #166534;
            font-weight: 600;
            margin-bottom: 10px;
            font-size: 16px;
            margin-left: 10px;
        }
        .patient-info {
            background: linear-gradient(135deg, #faf9fc 0%, #f5f2f8 100%);
            border-radius: 12px;
            padding: 25px;
            margin: 30px 0;
            border: 1px solid #e8e1f0;
            box-shadow: 0 2px 12px rgba(139, 90, 159, 0.08);
        }
        .info-title {
            color: #667eea;
            font-weight: 600;
            margin-bottom: 15px;
            font-size: 16px;
        }
        .info-row {
            display: flex;
            margin-bottom: 12px;
            font-size: 14px;
            border-bottom: 1px solid #e9ecef;
            padding-bottom: 8px;
        }
        .info-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        .info-label {
            font-weight: 600;
            color: #6c757d;
            width: 140px;
            flex-shrink: 0;
        }
        .info-value {
            color: #495057;
        }
        .next-steps {
            background: linear-gradient(135deg, #e7f3ff 0%, #b8daff 100%);
            border-left: 4px solid #0066cc;
            border-radius: 0 8px 8px 0;
            padding: 25px;
            margin: 30px 0;
            position: relative;
            box-shadow: 0 2px 12px rgba(0, 102, 204, 0.1);
        }
        .next-steps::before {
            content: '🚀';
            position: absolute;
            top: -15px;
            left: 20px;
            background: #0066cc;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        }
        .next-steps-title {
            color: #004085;
            font-weight: 600;
            margin-bottom: 15px;
            font-size: 16px;
            margin-left: 10px;
        }
        .next-steps ul {
            margin: 0;
            padding-left: 30px;
            color: #004085;
        }
        .next-steps li {
            margin: 8px 0;
            font-size: 14px;
            line-height: 1.6;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 35px;
            text-decoration: none;
            border-radius: 25px;
            font-weight: 600;
            text-align: center;
            margin: 20px auto;
            display: block;
            max-width: 250px;
            transition: transform 0.2s;
        }
        .cta-button:hover {
            transform: translateY(-2px);
            color: white;
            text-decoration: none;
        }
        .support-info {
            background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
            border: 1px solid #ffeaa7;
            border-radius: 12px;
            padding: 20px;
            margin: 30px 0;
        }
        .support-title {
            margin: 0 0 15px 0;
            color: #856404;
            font-size: 16px;
            font-weight: 600;
        }
        .support-text {
            margin: 0;
            color: #856404;
            font-size: 14px;
            line-height: 1.6;
        }
        .footer {
            background: linear-gradient(135deg, #f8f6fb 0%, #f2f0f5 100%);
            color: #888;
            padding: 25px;
            text-align: center;
            font-size: 12px;
            border-top: 1px solid #e8e1f0;
        }
        .footer p {
            margin: 5px 0;
        }
        .footer strong {
            color: #667eea;
        }
        .closing-message {
            text-align: center;
            margin-top: 35px;
            padding: 20px;
            color: #666;
            line-height: 1.6;
        }
        @media (max-width: 600px) {
            .container {
                margin: 10px;
                border-radius: 8px;
            }
            .content {
                padding: 35px 25px;
            }
            .header {
                padding: 30px 20px;
            }
            .header h1 {
                font-size: 24px;
            }
            .welcome-title {
                font-size: 22px;
            }
            .info-row {
                flex-direction: column;
            }
            .info-label {
                width: auto;
                margin-bottom: 2px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="header-icon">
                @if($isNewUser)
                    🎉
                @else
                    ✅
                @endif
            </div>
            <h1>
                @if($isNewUser)
                    Welcome to Our System!
                @else
                    Invitation Accepted!
                @endif
            </h1>
        </div>

        <!-- Main Content -->
        <div class="content">
            <h2 class="welcome-title">
                Hello 
                @if($patient->preferred_name)
                    {{ $patient->preferred_name }}
                @else
                    {{ $patient->first_name }}
                @endif!
            </h2>

            <div class="status-badge">
                @if($isNewUser)
                    ✓ ACCOUNT CREATED
                @else
                    ✓ INVITATION ACCEPTED
                @endif
            </div>

            <!-- Confirmation Message -->
            <div class="confirmation-message">
                <div class="message-text">
                    @if($isNewUser)
                        Your account has been successfully created and you're now part of our patient care system.
                    @else
                        You have successfully joined our patient care system using your existing account.
                    @endif
                </div>
            </div>

            <!-- Patient Information Summary -->
            <div class="patient-info">
                <div class="info-title">📋 Your Information</div>
                <div class="info-row">
                    <div class="info-label">Patient Name:</div>
                    <div class="info-value">{{ $patient->first_name }} {{ $patient->last_name }}</div>
                </div>
                @if($patient->preferred_name)
                <div class="info-row">
                    <div class="info-label">Preferred Name:</div>
                    <div class="info-value">{{ $patient->preferred_name }}</div>
                </div>
                @endif
                <div class="info-row">
                    <div class="info-label">Health Number:</div>
                    <div class="info-value">{{ $patient->health_number }}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Email:</div>
                    <div class="info-value">{{ $patient->email }}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Healthcare Provider:</div>
                    <div class="info-value">{{ $tenant->company_name }}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Date Joined:</div>
                    <div class="info-value">
                        @if($invitation->accepted_at)
                            {{ $invitation->accepted_at->format('F j, Y g:i A') }}
                        @else
                            {{ now()->format('F j, Y g:i A') }}
                        @endif
                    </div>
                </div>
            </div>

            <!-- Next Steps -->
            <div class="next-steps">
                <div class="next-steps-title">🚀 What's Next?</div>
                <ul>
                    @if($isNewUser)
                        <li>Keep your login credentials safe and secure</li>
                    @endif
                    <li>Log in to your patient portal to view and manage your appointments</li>
                    <li>Complete your profile information if needed</li>
                    <li>Review your upcoming appointments and medical information</li>
                    <li>Contact us if you have any questions or need assistance</li>
                </ul>
            </div>

            <!-- Call to Action -->
            <div style="text-align: center;">
                <a href="{{ url('/patient/dashboard') }}" class="cta-button">
                    Access Your Patient Portal
                </a>
            </div>

            <!-- Support Information -->
            <div class="support-info">
                <h4 class="support-title">Need Help?</h4>
                <p class="support-text">If you have any questions or need assistance, please don't hesitate to contact our support team. We're here to help make your healthcare journey as smooth as possible.</p>
            </div>

            @if($patient->best_time_to_contact || $patient->best_way_to_contact)
            <div class="patient-info">
                <div class="info-title">📞 Your Contact Preferences</div>
                @if($patient->best_time_to_contact)
                <div class="info-row">
                    <div class="info-label">Best Time to Contact:</div>
                    <div class="info-value">{{ ucfirst($patient->best_time_to_contact) }}</div>
                </div>
                @endif
                @if($patient->best_way_to_contact)
                <div class="info-row">
                    <div class="info-label">Preferred Contact Method:</div>
                    <div class="info-value">{{ ucfirst($patient->best_way_to_contact) }}</div>
                </div>
                @endif
            </div>
            @endif

            <div class="closing-message">
                <p>Thank you for choosing {{ $tenant->company_name }} for your healthcare needs. We look forward to providing you with excellent care.</p>
                <p><strong>{{ $tenant->company_name }} Team</strong> 💜</p>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p><strong>{{ $tenant->company_name }}</strong></p>
            <p>This email was sent because you 
                @if($isNewUser)
                    created an account
                @else
                    accepted an invitation
                @endif
                to join our patient care system.
            </p>
            <p>If you did not request this, please contact our support team immediately.</p>
            <p style="margin-top: 15px; color: #adb5bd;">
                © {{ date('Y') }} {{ $tenant->company_name }}. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>