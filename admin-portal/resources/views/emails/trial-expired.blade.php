<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trial Expired - Wellovis</title>
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
            background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
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
        .alert-title {
            font-size: 28px;
            color: #e53e3e;
            margin-bottom: 20px;
            font-weight: 600;
            text-align: center;
        }
        .alert-text {
            color: #666;
            margin-bottom: 35px;
            font-size: 16px;
            text-align: center;
            line-height: 1.7;
        }
        .info-section {
            background: linear-gradient(135deg, #fff5f5 0%, #fef2f2 100%);
            border-radius: 12px;
            padding: 30px;
            margin: 35px 0;
            border-left: 4px solid #e53e3e;
            position: relative;
            box-shadow: 0 2px 12px rgba(229, 62, 62, 0.08);
        }
        .info-section::before {
            content: '⏰';
            position: absolute;
            top: -15px;
            left: 30px;
            background: #e53e3e;
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
            color: #e53e3e;
            font-weight: 600;
            margin-bottom: 18px;
            font-size: 18px;
            margin-left: 10px;
        }
        .info-text {
            color: #666;
            font-size: 15px;
            margin: 0;
            line-height: 1.7;
            margin-left: 10px;
        }
        .payment-button {
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
        .payment-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(139, 90, 159, 0.4);
            text-decoration: none;
            color: white;
        }
        .button-container {
            text-align: center;
            margin: 35px 0;
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
            .alert-title {
                font-size: 24px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="header-icon">⏰</div>
            <h1>WELLOVIS</h1>
        </div>

        <!-- Main Content -->
        <div class="content">
            <h2 class="alert-title">Your Trial Period Has Ended</h2>

            <p class="alert-text">
                Your free trial for <strong>{{ $tenant->company_name }}</strong> ended on {{ $tenant->trial_ends_at?->format('F j, Y') ?? 'recently' }}.
            </p>

            <!-- Info Section -->
            <div class="info-section">
                <div class="section-title">What's Next?</div>
                <p class="info-text">
                    To continue using Wellovis, please subscribe to a plan. Your account is temporarily suspended until payment is completed. Only administrators can manage subscriptions.
                </p>
            </div>

            <div class="button-container">
                <a href="{{ $paymentUrl }}" class="payment-button">
                    Subscribe Now →
                </a>
            </div>

            <p style="text-align: center; color: #666; font-size: 14px; margin-top: 20px;">
                If you have any questions, please contact our support team at <a href="mailto:support@wellovis.com" style="color: oklch(0.49 0.25 289.22);">support@wellovis.com</a>
            </p>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p><strong>WELLOVIS</strong></p>
            <p>© {{ date('Y') }} Wellovis. All rights reserved.</p>
        </div>
    </div>
</body>
</html>

