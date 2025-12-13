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
    <title>User Invitation</title>
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
        .content p {
            line-height: 1.6;
            margin: 0 0 16px 0;
            font-size: 15px;
        }
        .button-container {
            text-align: center;
            margin: 32px 0;
        }
        .button {
            display: inline-block;
            background-color: {{$themeColor}};
            color: white;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 15px;
            transition: background-color 0.2s;
        }
        .button:hover {
            background-color: {{$dark}};
        }
        .footer {
            background-color: {{$bg}};
            padding: 20px 28px;
            text-align: center;
            font-size: 13px;
            color: #666;
        }
        .info-box {
            background-color: #f8f9fa;
            border-left: 4px solid {{$themeColor}};
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .info-box p {
            margin: 0;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>You're Invited!</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>You have been invited to join <strong>{{ $tenantName }}</strong> as a <strong>{{ $role->name }}</strong>.</p>
            
            <div class="info-box">
                <p><strong>Role:</strong> {{ $role->name }}</p>
                <p><strong>Expires:</strong> {{ $expiresAt->format('F j, Y g:i A') }}</p>
            </div>

            <p>Click the button below to accept your invitation and set up your account:</p>

            <div class="button-container">
                <a href="{{ $invitationUrl }}" class="button">Accept Invitation</a>
            </div>

            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666; font-size: 13px;">{{ $invitationUrl }}</p>

            <p style="margin-top: 24px; font-size: 13px; color: #666;">
                If you did not expect this invitation, you can safely ignore this email.
            </p>
        </div>
        <div class="footer">
            <p>This invitation was sent by {{ $tenantName }}.</p>
        </div>
    </div>
</body>
</html>
