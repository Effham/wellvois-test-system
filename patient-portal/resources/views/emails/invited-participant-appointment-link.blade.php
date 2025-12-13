<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Virtual Appointment Invitation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
        }
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .header p {
            margin: 8px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
        }
        .content {
            padding: 30px;
        }
        .appointment-details {
            background: #f8fafc;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            border-left: 4px solid #3b82f6;
        }
        .appointment-details h3 {
            margin: 0 0 15px 0;
            color: #1e40af;
            font-size: 18px;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .detail-label {
            font-weight: 600;
            color: #374151;
        }
        .detail-value {
            color: #6b7280;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: white;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            margin: 20px 0;
            transition: transform 0.2s ease;
        }
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3);
        }
        .security-note {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            color: #92400e;
        }
        .security-note h4 {
            margin: 0 0 8px 0;
            color: #92400e;
            font-size: 14px;
        }
        .security-note p {
            margin: 0;
            font-size: 13px;
        }
        .footer {
            background: #f8fafc;
            padding: 20px 30px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }
        .footer p {
            margin: 5px 0;
        }
        .link-fallback {
            background: #f3f4f6;
            border-radius: 6px;
            padding: 15px;
            margin: 15px 0;
            font-family: monospace;
            font-size: 12px;
            word-break: break-all;
            color: #374151;
        }
        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            .header, .content, .footer {
                padding: 20px;
            }
            .detail-row {
                flex-direction: column;
                gap: 5px;
            }
            .cta-button {
                display: block;
                width: 100%;
                box-sizing: border-box;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>You're Invited!</h1>
            <p>Join a virtual appointment at {{ $clinic_name }}</p>
        </div>

        <div class="content">
            <p>Hello {{ $participant_name }},</p>
            
            <p>You have been invited to join a virtual appointment session. Please use the secure link below to access the appointment.</p>

            <div class="appointment-details">
                <h3>Appointment Details</h3>
                <div class="detail-row">
                    <span class="detail-label">Date:</span>
                    <span class="detail-value">{{ $appointment_date }}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Time:</span>
                    <span class="detail-value">{{ $appointment_time }}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Clinic:</span>
                    <span class="detail-value">{{ $clinic_name }}</span>
                </div>
            </div>

            <div style="text-align: center;">
                <a href="{{ $appointment_url }}" class="cta-button">
                    Join Virtual Appointment
                </a>
            </div>

            <div class="security-note">
                <h4>🔒 Security Information</h4>
                <p>This is a secure, time-limited link. It will expire in 1 hour for your security. Please do not share this link with others.</p>
            </div>

            <p><strong>If the button doesn't work, copy and paste this link into your browser:</strong></p>
            <div class="link-fallback">{{ $appointment_url }}</div>

            <p>Please ensure you have a stable internet connection and a device with camera and microphone capabilities for the best experience.</p>

            <p>If you have any questions or technical issues, please contact {{ $clinic_name }} directly.</p>
        </div>

        <div class="footer">
            <p><strong>{{ $clinic_name }}</strong></p>
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; {{ date('Y') }} Wellovis. All rights reserved.</p>
        </div>
    </div>
</body>
</html>

