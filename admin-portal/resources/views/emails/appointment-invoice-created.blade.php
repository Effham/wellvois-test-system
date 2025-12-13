<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Appointment Invoice Created</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .email-container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .organization-name {
            font-size: 28px;
            font-weight: bold;
            color: #1e40af;
            margin: 0 0 10px 0;
        }
        .message {
            font-size: 16px;
            color: #374151;
            margin: 20px 0;
        }
        .invoice-info {
            background-color: #f3f4f6;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .info-row:last-child {
            border-bottom: none;
        }
        .info-label {
            font-weight: 600;
            color: #6b7280;
        }
        .info-value {
            color: #374151;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header -->
        <div class="header">
            <h1 class="organization-name">{{ $organization['name'] ?? 'Practice' }}</h1>
            @if(!empty($organization['email']))
                <p style="margin: 5px 0; color: #6b7280;">{{ $organization['email'] }}</p>
            @endif
            @if(!empty($organization['phone']))
                <p style="margin: 5px 0; color: #6b7280;">{{ $organization['phone'] }}</p>
            @endif
        </div>

        <!-- Message -->
        <div class="message">
            <p>An appointment invoice has been created and sent to the patient.</p>
        </div>

        <!-- Invoice Information -->
        <div class="invoice-info">
            <h2 style="margin-top: 0; color: #374151;">Invoice Details</h2>
            
            <div class="info-row">
                <span class="info-label">Invoice Number:</span>
                <span class="info-value">{{ $invoice->invoice_number ?? '#' . $invoice->id }}</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">Patient Name:</span>
                <span class="info-value">{{ $patient['name'] ?? 'N/A' }}</span>
            </div>
            
            @if(!empty($patient['email']))
            <div class="info-row">
                <span class="info-label">Patient Email:</span>
                <span class="info-value">{{ $patient['email'] }}</span>
            </div>
            @endif
            
            <div class="info-row">
                <span class="info-label">Invoice Date:</span>
                <span class="info-value">{{ $invoice->created_at->format('F d, Y') }}</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">Subtotal:</span>
                <span class="info-value">{{ $organization['currency'] ?? 'CAD' }} {{ number_format($invoice->subtotal, 2) }}</span>
            </div>
            
            @if($invoice->tax_total > 0)
            <div class="info-row">
                <span class="info-label">Tax:</span>
                <span class="info-value">{{ $organization['currency'] ?? 'CAD' }} {{ number_format($invoice->tax_total, 2) }}</span>
            </div>
            @endif
            
            <div class="info-row">
                <span class="info-label">Total Amount:</span>
                <span class="info-value" style="font-weight: bold; font-size: 18px; color: #1e40af;">
                    {{ $organization['currency'] ?? 'CAD' }} {{ number_format($invoice->price, 2) }}
                </span>
            </div>
            
            <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value">
                    <span style="text-transform: uppercase; color: #92400e; background-color: #fef3c7; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                        {{ strtoupper($invoice->status ?? 'pending') }}
                    </span>
                </span>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>This is an automated notification. The invoice has been sent to the patient via email.</p>
            <p style="font-size: 12px; color: #9ca3af; margin-top: 10px;">
                Please do not reply directly to this message.
            </p>
        </div>
    </div>
</body>
</html>

