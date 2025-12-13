@php
    $themeColor = $tenantTheme ?? '#0d6efd';

    // hex helpers to generate color variations
    $hex = ltrim($themeColor, '#');
    $r = hexdec(substr($hex, 0, 2)); 
    $g = hexdec(substr($hex, 2, 2)); 
    $b = hexdec(substr($hex, 4, 2));
    
    $dark  = sprintf("#%02x%02x%02x", max(0, $r-50), max(0, $g-50), max(0, $b-50));
    $light = sprintf("#%02x%02x%02x", min(255, $r+90), min(255, $g+90), min(255, $b+90));
    $bg    = sprintf("#%02x%02x%02x", min(255, $r+170), min(255, $g+170), min(255, $b+170));
@endphp

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Patient Invitation</title>
    <style>
        body {
            font-family: Arial, Helvetica, sans-serif;
            background-color: #f5f7fb;
            margin: 0;
            padding: 24px;
            color: #2d2d2d;
        }
        .container {
            max-width: 680px;
            margin: 0 auto;
            background-color: #fff;
            border-radius: 12px;
            box-shadow: 0 4px 18px rgba(0, 0, 0, 0.06);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, {{$themeColor}}, {{$dark}});
            color: white;
            padding: 32px 28px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 26px;
            font-weight: 600;
        }
        .content {
            padding: 28px;
        }
        .content h2 {
            color: #333;
            margin-bottom: 18px;
            font-size: 20px;
        }
        .content p {
            line-height: 1.6;
            margin-bottom: 15px;
            color: #555;
        }
        .btn {
            display: inline-block;
            background: {{$themeColor}};
            color: white !important;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 8px;
            font-weight: 600;
            text-align: center;
            margin: 20px 0;
            transition: background 0.2s;
        }
        .btn:hover {
            background: {{$dark}};
        }
        .info-box {
            background-color: {{$bg}};
            border-left: 4px solid {{$themeColor}};
            padding: 18px;
            margin: 20px 0;
            border-radius: 8px;
        }
        .info-box strong {
            color: {{$themeColor}};
            display: block;
            margin-bottom: 10px;
            font-size: 16px;
        }
        .info-box ul {
            margin: 8px 0 0 0;
            padding-left: 20px;
        }
        .info-box li {
            margin-bottom: 8px;
            color: #555;
        }
        .highlight {
            background-color: {{$light}};
            padding: 14px 18px;
            border-radius: 8px;
            margin: 16px 0;
            border: 1px solid {{$themeColor}};
        }
        .highlight strong {
            color: {{$themeColor}};
        }
        .footer {
            background-color: #f5f7fb;
            padding: 22px;
            text-align: center;
            font-size: 13px;
            color: #777;
            border-top: 1px solid #eee;
        }
        .footer p {
            margin: 6px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏥 Patient Invitation</h1>
        </div>
        
        <div class="content">
            <h2>Hello {{ $patient->first_name }} {{ $patient->last_name }},</h2>
            
            <p>You have been invited to join <strong>{{ $tenantName }}</strong> as a patient on the Wellovis platform.</p>
            
            <p>{{ $tenantName }} would like to provide you with access to their patient portal where you can manage your healthcare information, book appointments, and communicate with your care team.</p>
            
            <div class="info-box">
                <strong>What happens next?</strong>
                <ul>
                    <li>Click the accept button below to review the invitation</li>
                    <li>If you don't have a Wellovis account, you'll be able to create one</li>
                    <li>Once registered, you'll have access to {{ $tenantName }}'s patient portal</li>
                    <li>You can then manage your appointments, view health records, and communicate with your care team</li>
                </ul>
            </div>
            
            <div style="text-align: center;">
                <a href="{{ $invitationUrl }}" class="btn">Accept Invitation</a>
            </div>
            
            <div class="highlight">
                <strong>⏰ Important:</strong> This invitation will expire on {{ $expiresAt->format('F j, Y \a\t g:i A') }}.
            </div>
            
            <p>If you have any questions about this invitation, please contact {{ $tenantName }} directly.</p>
            
            <p style="color: #999; font-size: 14px;">If you received this email by mistake, you can safely ignore it.</p>
        </div>
        
        <div class="footer">
            <p>This email was sent by the Wellovis platform on behalf of <strong>{{ $tenantName }}</strong>.</p>
            <p>© {{ date('Y') }} Wellovis. All rights reserved.</p>
        </div>
    </div>
</body>
</html>