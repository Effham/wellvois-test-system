<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Appointment Reminder - {{ $clinicName }}</title>
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
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            position: relative;
            z-index: 2;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header-icon {
            font-size: 48px;
            margin-bottom: 10px;
            position: relative;
            z-index: 2;
        }
        .content {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 24px;
            background: linear-gradient(135deg, #10b981, #047857);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 20px;
            font-weight: 600;
            text-align: center;
        }
        .reminder-text {
            color: #666;
            margin-bottom: 30px;
            font-size: 16px;
            text-align: center;
            line-height: 1.7;
        }
        .appointment-card {
            background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
            border-radius: 12px;
            padding: 30px;
            margin: 30px 0;
            border: 2px solid #10b981;
            position: relative;
            box-shadow: 0 4px 16px rgba(16, 185, 129, 0.15);
        }
        .appointment-card::before {
            content: '📅';
            position: absolute;
            top: -20px;
            left: 30px;
            background: #10b981;
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
        .appointment-title {
            color: #047857;
            font-weight: 700;
            margin-bottom: 20px;
            font-size: 20px;
            margin-left: 20px;
        }
        .appointment-detail {
            display: flex;
            margin-bottom: 15px;
            font-size: 15px;
            align-items: center;
        }
        .detail-icon {
            font-size: 18px;
            margin-right: 12px;
            width: 24px;
            text-align: center;
        }
        .detail-label {
            font-weight: 600;
            color: #047857;
            min-width: 100px;
        }
        .detail-value {
            color: #333;
            flex: 1;
        }
        .time-highlight {
            background: #10b981;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            display: inline-block;
            margin-left: 10px;
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
        }
        .virtual-badge {
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: white;
            padding: 6px 12px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: 600;
            display: inline-block;
            margin-left: 10px;
        }
        .preparation-section {
            background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%);
            border-radius: 12px;
            padding: 25px;
            margin: 30px 0;
            border-left: 4px solid #f59e0b;
            position: relative;
            box-shadow: 0 2px 12px rgba(245, 158, 11, 0.15);
        }
        .preparation-section::before {
            content: '📋';
            position: absolute;
            top: -15px;
            left: 25px;
            background: #f59e0b;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        }
        .section-title {
            color: #92400e;
            font-weight: 600;
            margin-bottom: 15px;
            font-size: 16px;
            margin-left: 10px;
        }
        .preparation-list {
            margin: 0;
            padding-left: 20px;
            color: #78350f;
        }
        .preparation-list li {
            margin: 8px 0;
            font-size: 14px;
            line-height: 1.5;
        }
        .preparation-list li::marker {
            color: #f59e0b;
        }
        .contact-section {
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            border-radius: 12px;
            padding: 25px;
            margin: 30px 0;
            text-align: center;
            position: relative;
            box-shadow: 0 2px 12px rgba(59, 130, 246, 0.1);
            border: 1px solid #93c5fd;
        }
        .contact-section::before {
            content: '📞';
            position: absolute;
            top: -15px;
            left: 50%;
            transform: translateX(-50%);
            background: #3b82f6;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        }
        .contact-text {
            color: #1e40af;
            font-size: 15px;
            margin: 10px 0;
            line-height: 1.6;
        }
        .contact-phone {
            color: #1d4ed8;
            font-weight: 600;
            font-size: 18px;
            text-decoration: none;
            border: 2px solid #3b82f6;
            padding: 10px 20px;
            border-radius: 25px;
            display: inline-block;
            margin: 10px 0;
            transition: all 0.3s ease;
        }
        .contact-phone:hover {
            background: #3b82f6;
            color: white;
            text-decoration: none;
        }
        .footer {
            background: linear-gradient(135deg, #f8f6fb 0%, #f2f0f5 100%);
            color: #666;
            padding: 25px;
            text-align: center;
            font-size: 14px;
            border-top: 1px solid #e5e5e5;
        }
        .footer p {
            margin: 5px 0;
        }
        .clinic-name {
            color: #10b981;
            font-weight: 600;
        }
        .reschedule-note {
            background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
            border-left: 3px solid #ef4444;
            padding: 18px;
            margin: 25px 0;
            font-size: 14px;
            border-radius: 0 8px 8px 0;
            color: #7f1d1d;
            box-shadow: 0 2px 8px rgba(239, 68, 68, 0.1);
        }
        .reschedule-note strong {
            color: #dc2626;
        }
        @media (max-width: 600px) {
            .container {
                margin: 10px;
                border-radius: 8px;
            }
            .content {
                padding: 30px 20px;
            }
            .header {
                padding: 30px 20px;
            }
            .appointment-detail {
                flex-direction: column;
                align-items: flex-start;
                margin-bottom: 18px;
            }
            .detail-label {
                margin-bottom: 5px;
                min-width: auto;
            }
            .time-highlight {
                margin-left: 0;
                margin-top: 5px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="header-icon">🩺</div>
            <h1>Appointment Reminder</h1>
        </div>

        <!-- Main Content -->
        <div class="content">
            <h2 class="greeting">Hello {{ $patientDisplayName }}!</h2>

            <p class="reminder-text">
                This is a friendly reminder about your upcoming appointment tomorrow at <strong>{{ $clinicName }}</strong>.
            </p>

            <!-- Appointment Details Card -->
            <div class="appointment-card">
                <div class="appointment-title">Your Appointment Details</div>
                
                <div class="appointment-detail">
                    <span class="detail-icon">📅</span>
                    <span class="detail-label">Date:</span>
                    <span class="detail-value">{{ $appointmentDate }}</span>
                </div>
                
                <div class="appointment-detail">
                    <span class="detail-icon">🕐</span>
                    <span class="detail-label">Time:</span>
                    <span class="detail-value">
                        {{ $appointmentTime }}
                        <span class="time-highlight">{{ $appointmentDuration }}</span>
                    </span>
                </div>
                
                <div class="appointment-detail">
                    <span class="detail-icon">👨‍⚕️</span>
                    <span class="detail-label">With:</span>
                    <span class="detail-value">{{ $practitionerDisplayName }}</span>
                </div>
                
                <div class="appointment-detail">
                    <span class="detail-icon">🏥</span>
                    <span class="detail-label">Service:</span>
                    <span class="detail-value">{{ $serviceName }}</span>
                </div>
                
                <div class="appointment-detail">
                    <span class="detail-icon">📍</span>
                    <span class="detail-label">Location:</span>
                    <span class="detail-value">
                        {{ $locationName }}
                        @if($isVirtual)
                            <span class="virtual-badge">Virtual Appointment</span>
                        @endif
                    </span>
                </div>
                
                <div class="appointment-detail">
                    <span class="detail-icon">🏢</span>
                    <span class="detail-label">Clinic:</span>
                    <span class="detail-value">{{ $clinicName }}</span>
                </div>
            </div>

            <!-- Preparation Section -->
            <div class="preparation-section">
                <div class="section-title">Please Prepare For Your Visit</div>
                <ul class="preparation-list">
                    <li>Arrive 15 minutes early for check-in and paperwork</li>
                    <li>Bring a valid photo ID and insurance card</li>
                    <li>Bring a list of current medications and dosages</li>
                    <li>Prepare any questions or concerns you'd like to discuss</li>
                    @if($isVirtual)
                    <li>Ensure you have a stable internet connection</li>
                    <li>Test your camera and microphone beforehand</li>
                    <li>Find a quiet, well-lit space for the appointment</li>
                    @else
                    <li>Allow extra time for parking and finding the location</li>
                    <li>Wear comfortable, appropriate clothing</li>
                    @endif
                </ul>
            </div>

            <!-- Need to Reschedule -->
            <div class="reschedule-note">
                <strong>⚠️ Need to reschedule?</strong> Please contact us at least 24 hours in advance to avoid cancellation fees.
            </div>

            <!-- Contact Section -->
            <div class="contact-section">
                <div class="section-title">Questions or Need to Reschedule?</div>
                <p class="contact-text">
                    Contact us directly if you have any questions or need to make changes to your appointment.
                </p>
                <!-- You can add actual phone number here -->
                <a href="tel:+1234567890" class="contact-phone">📞 Call Us</a>
            </div>

            <div style="text-align: center; margin-top: 40px; padding: 25px; background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border-radius: 8px; color: #047857;">
                <p>We look forward to seeing you tomorrow!</p>
                <p><strong>{{ $clinicName }} Team</strong> 💚</p>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p><strong class="clinic-name">{{ $clinicName }}</strong></p>
            <p>© {{ date('Y') }} {{ $clinicName }}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>