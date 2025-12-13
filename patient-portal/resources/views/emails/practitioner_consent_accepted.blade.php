<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Practitioner Consent Accepted</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .container {
            width: 100%;
            max-width: 600px;
            margin: 20px auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: {{ $tenantTheme ?? '#0d6efd' }};
            color: #ffffff;
            padding: 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .header p {
            margin: 5px 0 0 0;
            opacity: 0.9;
        }
        .content {
            padding: 30px;
        }
        .content h2 {
            color: #2c3e50;
            margin-top: 0;
            font-size: 20px;
        }
        .info-box {
            background: #f8f9fa;
            border-left: 4px solid {{ $tenantTheme ?? '#0d6efd' }};
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 4px 4px 0;
        }
        .info-box h3 {
            margin: 0 0 10px 0;
            color: #2c3e50;
            font-size: 16px;
        }
        .info-item {
            margin: 8px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .info-label {
            font-weight: 600;
            color: #555;
        }
        .info-value {
            color: #333;
        }
        .consent-details {
            background: #e8f4fd;
            border: 1px solid #b3d9ff;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
        }
        .consent-details h3 {
            margin: 0 0 15px 0;
            color: #1e40af;
            font-size: 18px;
        }
        .consent-type {
            background: {{ $tenantTheme ?? '#0d6efd' }};
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            display: inline-block;
            font-weight: 600;
            font-size: 14px;
        }
        .audit-info {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
        }
        .audit-info h4 {
            margin: 0 0 10px 0;
            color: #475569;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .audit-item {
            font-size: 13px;
            color: #64748b;
            margin: 4px 0;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }
        .footer p {
            margin: 0;
            color: #6c757d;
            font-size: 14px;
        }
        .button {
            display: inline-block;
            background: {{ $tenantTheme ?? '#0d6efd' }};
            color: #ffffff;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 10px 0;
        }
        .button:hover {
            opacity: 0.9;
        }
        .highlight {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            padding: 12px;
            margin: 15px 0;
        }
        .highlight p {
            margin: 0;
            color: #856404;
            font-size: 14px;
        }
        @media (max-width: 600px) {
            .container {
                margin: 10px;
                border-radius: 0;
            }
            .content {
                padding: 20px;
            }
            .info-item {
                flex-direction: column;
                align-items: flex-start;
            }
            .info-value {
                margin-top: 4px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Practitioner Consent Accepted</h1>
            <p>{{ $tenantName }}</p>
        </div>
        
        <div class="content">
            <h2>New Practitioner Consent Notification</h2>
            
            <p>Dear Administrator,</p>
            
            <p>This is an automated notification to inform you that a practitioner has successfully accepted a required consent for your practice.</p>
            
            <div class="info-box">
                <h3>Practitioner Information</h3>
                <div class="info-item">
                    <span class="info-label">Name:</span>
                    <span class="info-value"><strong>{{ $practitioner->first_name }} {{ $practitioner->last_name }}</strong></span>
                </div>
                <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value">{{ $practitioner->email }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Practice:</span>
                    <span class="info-value">{{ $tenantName }}</span>
                </div>
            </div>
            
            <div class="consent-details">
                <h3>Consent Details</h3>
                <div class="info-item">
                    <span class="info-label">Consent Type:</span>
                    <span class="consent-type">{{ ucwords(str_replace('_', ' ', $consentType)) }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Accepted At:</span>
                    <span class="info-value">{{ \Carbon\Carbon::parse($consentedAt)->format('F j, Y \a\t h:i A T') }}</span>
                </div>
            </div>
            
            <div class="audit-info">
                <h4>Audit Information</h4>
                <div class="audit-item">
                    <strong>IP Address:</strong> {{ $ipAddress }}
                </div>
                <div class="audit-item">
                    <strong>Timestamp:</strong> {{ now()->format('Y-m-d H:i:s T') }}
                </div>
                <div class="audit-item">
                    <strong>Consent ID:</strong> {{ $practitioner->id }}-{{ time() }}
                </div>
            </div>
            
            <div class="highlight">
                <p>
                    <strong>Important:</strong> This consent is now active and the practitioner has access to the practice management system. 
                    You can view their consent history and manage their permissions in the admin dashboard.
                </p>
            </div>
            
            <p>You can view the practitioner's details and their consent history in the dashboard.</p>
            
            <p>Thank you,<br>
            The {{ $tenantName }} Team</p>
        </div>
        
        <div class="footer">
            <p>&copy; {{ date('Y') }} {{ $tenantName }}. All rights reserved.</p>
            <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>