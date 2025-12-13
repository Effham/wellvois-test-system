<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Wellovis</title>
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
            background: linear-gradient(135deg, oklch(0.49 0.25 289.22) 0%, oklch(0.45 0.22 295.22) 100%);
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
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 2px;
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
            padding: 50px 40px;
        }
        .welcome-title {
            font-size: 28px;
            background: linear-gradient(135deg, oklch(0.49 0.25 289.22), oklch(0.55 0.28 285.22));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 20px;
            font-weight: 600;
            text-align: center;
        }
        .welcome-text {
            color: #666;
            margin-bottom: 35px;
            font-size: 16px;
            text-align: center;
            line-height: 1.7;
        }
        .credentials-section {
            background: linear-gradient(135deg, #faf9fc 0%, #f5f2f8 100%);
            border-radius: 12px;
            padding: 30px;
            margin: 35px 0;
            border: 1px solid #e8e1f0;
            position: relative;
            box-shadow: 0 4px 16px rgba(139, 90, 159, 0.1);
        }
        .credentials-section::before {
            content: '🔐';
            position: absolute;
            top: -15px;
            left: 30px;
            background: oklch(0.49 0.25 289.22);
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        }
        .credentials-title {
            color: oklch(0.49 0.25 289.22);
            font-weight: 600;
            margin-bottom: 20px;
            font-size: 18px;
            margin-left: 10px;
        }
        .credential-row {
            display: flex;
            margin-bottom: 12px;
            font-size: 15px;
            align-items: center;
        }
        .credential-label {
            font-weight: 600;
            color: #555;
            width: 80px;
            flex-shrink: 0;
        }
        .credential-value {
            color: #333;
            word-break: break-all;
            background: white;
            padding: 8px 12px;
            border-radius: 6px;
            border: 1px solid #e8e1f0;
            flex: 1;
            margin-left: 10px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
            font-size: 14px;
        }
        .login-button {
            display: inline-block;
            background: linear-gradient(135deg, oklch(0.49 0.25 289.22) 0%, oklch(0.45 0.22 295.22) 100%);
            color: white;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-weight: 600;
            margin: 30px 0;
            transition: all 0.3s ease;
            box-shadow: 0 4px 16px rgba(139, 90, 159, 0.3);
            position: relative;
            overflow: hidden;
        }
        .login-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(139, 90, 159, 0.4);
            text-decoration: none;
            color: white;
        }
        .login-button::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left 0.5s ease;
        }
        .login-button:hover::before {
            left: 100%;
        }
        .button-container {
            text-align: center;
            margin: 35px 0;
        }
        .getting-started {
            background: linear-gradient(135deg, #f9f9fc 0%, #f5f5f9 100%);
            border-radius: 12px;
            padding: 30px;
            margin: 35px 0;
            border-left: 4px solid oklch(0.49 0.25 289.22);
            position: relative;
            box-shadow: 0 2px 12px rgba(139, 90, 159, 0.08);
        }
        .getting-started::before {
            content: '🚀';
            position: absolute;
            top: -15px;
            left: 30px;
            background: oklch(0.49 0.25 289.22);
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
            color: oklch(0.49 0.25 289.22);
            font-weight: 600;
            margin-bottom: 18px;
            font-size: 18px;
            margin-left: 10px;
        }
        .getting-started ul {
            margin: 0;
            padding-left: 20px;
            color: #666;
        }
        .getting-started li {
            margin: 12px 0;
            font-size: 15px;
            line-height: 1.6;
            position: relative;
        }
        .getting-started li::marker {
            color: oklch(0.49 0.25 289.22);
        }
        .support-section {
            background: linear-gradient(135deg, #faf9fd 0%, #f8f6fc 100%);
            border-radius: 12px;
            padding: 30px;
            margin: 35px 0;
            border: 1px solid #e8e1f0;
            text-align: center;
            position: relative;
            box-shadow: 0 2px 12px rgba(139, 90, 159, 0.08);
        }
        .support-section::before {
            content: '💬';
            position: absolute;
            top: -15px;
            left: 50%;
            transform: translateX(-50%);
            background: oklch(0.49 0.25 289.22);
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        }
        .support-text {
            color: #666;
            font-size: 15px;
            margin: 0;
            line-height: 1.7;
            margin-top: 10px;
        }
        .support-email {
            color: oklch(0.49 0.25 289.22);
            font-weight: 600;
            text-decoration: none;
        }
        .footer {
            background: linear-gradient(135deg, #f8f6fb 0%, #f2f0f5 100%);
            color: #888;
            padding: 30px;
            text-align: center;
            font-size: 13px;
            border-top: 1px solid #e8e1f0;
        }
        .footer p {
            margin: 5px 0;
        }
        .footer strong {
            color: oklch(0.49 0.25 289.22);
            font-weight: 600;
        }
        .security-note {
            background: linear-gradient(135deg, #fff5f5 0%, #fef2f2 100%);
            border-left: 3px solid #f56565;
            padding: 18px;
            margin: 25px 0;
            font-size: 14px;
            border-radius: 0 8px 8px 0;
            box-shadow: 0 2px 8px rgba(245, 101, 101, 0.1);
        }
        .security-note strong {
            color: #e53e3e;
        }
        .closing-message {
            text-align: center;
            margin-top: 40px;
            padding: 25px;
            background: linear-gradient(135deg, #faf9fc 0%, #f8f6fb 100%);
            border-radius: 8px;
            color: #666;
        }
        @media (max-width: 600px) {
            .container {
                margin: 10px;
                border-radius: 8px;
            }
            .content {
                padding: 40px 25px;
            }
            .header {
                padding: 30px 20px;
            }
            .header h1 {
                font-size: 26px;
            }
            .welcome-title {
                font-size: 24px;
            }
            .credential-row {
                flex-direction: column;
                align-items: flex-start;
            }
            .credential-label {
                width: auto;
                margin-bottom: 5px;
            }
            .credential-value {
                margin-left: 0;
                width: 100%;
                box-sizing: border-box;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="header-icon">✨</div>
            <h1>WELLOVIS</h1>
        </div>

        <!-- Main Content -->
        <div class="content">
            <h2 class="welcome-title">Welcome, {{ $adminName }}!</h2>

            <p class="welcome-text">
                Your account for <strong>{{ $companyName }}</strong> has been successfully created and is ready to use.
            </p>

            <!-- Login Credentials -->
            <div class="credentials-section">
                <div class="credentials-title">Login Details</div>
                
                <div class="credential-row">
                    <div class="credential-label">URL:</div>
                    <div class="credential-value">{{ $loginUrl }}</div>
                </div>
                
                <div class="credential-row">
                    <div class="credential-label">Email:</div>
                    <div class="credential-value">{{ $adminEmail }}</div>
                </div>
                
                @if($tempPassword)
                <div class="credential-row">
                    <div class="credential-label">Password:</div>
                    <div class="credential-value">{{ $tempPassword }}</div>
                </div>
                @endif
            </div>

            @if($tempPassword)
            <div class="security-note">
                <strong>⚠️ Security Notice:</strong> Please change your password after your first login.
            </div>
            @endif

            <div class="button-container">
                <a href="{{ $loginUrl }}" class="login-button">
                    ✨ Access Your Dashboard
                </a>
            </div>

            <!-- Getting Started -->
            <div class="getting-started">
                <div class="section-title">Getting Started</div>
                <ul>
                    <li>Complete your profile and organization settings</li>
                    <li>Add team members and assign roles</li>
                    <li>Configure your workspace preferences</li>
                    <li>Import existing data if needed</li>
                    <li>Explore the dashboard and available features</li>
                </ul>
            </div>

            <!-- Support -->
            <div class="support-section">
                <div class="section-title">Need Help?</div>
                <p class="support-text">
                    Our support team is here to help. Contact us at <a href="mailto:support@wellovis.com" class="support-email">support@wellovis.com</a> or visit our help center for guides and tutorials.
                </p>
            </div>

            <div class="closing-message">
                <p>Thank you for choosing Wellovis.</p>
                <p><strong>The Wellovis Team</strong> 💜</p>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p><strong>WELLOVIS</strong></p>
            <p>© {{ date('Y') }} Wellovis. All rights reserved.</p>
        </div>
    </div>
</body>
</html>