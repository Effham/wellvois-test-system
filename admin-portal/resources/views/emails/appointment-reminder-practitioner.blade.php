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
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
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
            background: linear-gradient(135deg, #6366f1, #4338ca);
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
        .patient-card {
            background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
            border-radius: 12px;
            padding: 30px;
            margin: 30px 0;
            border: 2px solid #6366f1;
            position: relative;
            box-shadow: 0 4px 16px rgba(99, 102, 241, 0.15);
        }
        .patient-card::before {
            content: '👤';
            position: absolute;
            top: -20px;
            left: 30px;
            background: #6366f1;
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }
        .patient-name {
            color: #4338ca;
            font-weight: 700;
            margin-bottom: 20px;
            font-size: 24px;
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
            color: #4338ca;
            min-width: 100px;
        }
        .detail-value {
            color: #333;
            flex: 1;
        }
        .time-highlight {
            background: #6366f1;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            display: inline-block;
            margin-left: 10px;
            box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
        }
        .virtual-badge {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 6px 12px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: 600;
            display: inline-block;
            margin-left: 10px;
        }
        .prep-notes-section {
            background: linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%);
            border-radius: 12px;
            padding: 25px;
            margin: 30px 0;
            border-left: 4px solid #a855f7;
            position: relative;
            box-shadow: 0 2px 12px rgba(168, 85, 247, 0.15);
        }
        .prep-notes-section::before {
            content: '📝';
            position: absolute;
            top: -15px;
            left: 25px;
            background: #a855f7;
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
            color: #7c3aed;
            font-weight: 600;
            margin-bottom: 15px;
            font-size: 16px;
            margin-left: 10px;
        }
        .prep-list {
            margin: 0;
            padding-left: 20px;
            color: #6b21a8;
        }
        .prep-list li {
            margin: 8px 0;
            font-size: 14px;
            line-height: 1.5;
        }
        .prep-list li::marker {
            color: #a855f7;
        }
        .quick-actions {
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            border-radius: 12px;
            padding: 25px;
            margin: 30px 0;
            text-align: center;
            position: relative;
            box-shadow: 0 2px 12px rgba(16, 185, 129, 0.1);
            border: 1px solid #86efac;
        }
        .quick-actions::before {
            content: '⚡';
            position: absolute;
            top: -15px;
            left: 50%;
            transform: translateX(-50%);
            background: #10b981;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        }
        .action-button {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 25px;
            font-weight: 600;
            display: inline-block;
            margin: 10px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
        .action-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
            text-decoration: none;
            color: white;
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
            color: #6366f1;
            font-weight: 600;
        }
        .urgent-note {
            background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
            border-left: 4px solid #ef4444;
            padding: 20px;
            margin: 25px 0;
            font-size: 15px;
            border-radius: 0 8px 8px 0;
            color: #7f1d1d;
            box-shadow: 0 2px 8px rgba(239, 68, 68, 0.1);
        }
        .urgent-note strong {
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
            .action-button {
                display: block;
                margin: 10px 0;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="header-icon">👨‍⚕️</div>
            <h1>Appointment Reminder</h1>
        </div>

        <!-- Main Content -->
        <div class="content">
            <h2 class="greeting">Hello {{ $practitionerDisplayName }}!</h2>

            <p class="reminder-text">
                You have an upcoming appointment tomorrow with a patient at <strong>{{ $clinicName }}</strong>.
            </p>

            <!-- Patient Details Card -->
            <div class="patient-card">
                <div class="patient-name">{{ $patientDisplayName }}</div>
                
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

            <!-- Pre-appointment Notes -->
            <div class="prep-notes-section">
                <div class="section-title">Pre-Appointment Preparation</div>
                <ul class="prep-list">
                    <li>Review patient's medical history and previous visit notes</li>
                    <li>Prepare necessary examination tools and equipment</li>
                    <li>Check for any recent test results or referrals</li>
                    <li>Review appointment type and expected duration</li>
                    @if($isVirtual)
                    <li>Test video conferencing equipment and connection</li>
                    <li>Ensure secure, private environment for virtual consultation</li>
                    <li>Have backup communication method ready</li>
                    @else
                    <li>Ensure examination room is prepared and sanitized</li>
                    <li>Check that all required medical supplies are available</li>
                    @endif
                </ul>
            </div>

            <!-- Quick Actions -->
            <div class="quick-actions">
                <div class="section-title">Quick Actions</div>
                <p class="contact-text">Access patient information or manage your schedule</p>
                <a href="#" class="action-button">📋 View Patient Records</a>
                <a href="#" class="action-button">📅 Manage Schedule</a>
            </div>

            <!-- Contact Section -->
            <div class="contact-section">
                <div class="section-title">Need Support?</div>
                <p class="contact-text">
                    Contact clinic administration for any scheduling changes or technical support.
                </p>
            </div>

            <!-- Running Late Note -->
            <div class="urgent-note">
                <strong>⚠️ Running Late?</strong> Please notify the clinic staff as soon as possible to inform the patient and minimize wait times.
            </div>

            <div style="text-align: center; margin-top: 40px; padding: 25px; background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); border-radius: 8px; color: #4338ca;">
                <p>Thank you for your dedication to patient care.</p>
                <p><strong>{{ $clinicName }} Team</strong></p>
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