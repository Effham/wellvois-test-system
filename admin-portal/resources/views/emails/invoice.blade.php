<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice {{ $invoice->invoice_number ?? '#' . $invoice->id }}</title>
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
        .invoice-title {
            font-size: 24px;
            font-weight: bold;
            color: #374151;
            margin: 20px 0 10px 0;
        }
        .invoice-number {
            font-size: 18px;
            color: #6b7280;
        }
        .info-section {
            display: flex;
            justify-content: space-between;
            margin: 30px 0;
            gap: 20px;
        }
        .info-block {
            flex: 1;
        }
        .info-block h3 {
            font-size: 14px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            margin: 0 0 10px 0;
        }
        .info-block p {
            margin: 5px 0;
            color: #374151;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 30px 0;
        }
        thead {
            background-color: #f3f4f6;
        }
        th {
            text-align: left;
            padding: 12px;
            font-weight: 600;
            color: #374151;
            border-bottom: 2px solid #e5e7eb;
        }
        th.text-right {
            text-align: right;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
            color: #374151;
        }
        td.text-right {
            text-align: right;
        }
        .totals-section {
            margin-top: 20px;
            display: flex;
            justify-content: flex-end;
        }
        .totals-table {
            width: 300px;
        }
        .totals-table tr td {
            padding: 8px 12px;
            border: none;
        }
        .totals-table tr:last-child {
            font-weight: bold;
            font-size: 18px;
            border-top: 2px solid #3b82f6;
        }
        .totals-table tr:last-child td {
            padding-top: 12px;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .status-pending {
            background-color: #fef3c7;
            color: #92400e;
        }
        .status-paid {
            background-color: #d1fae5;
            color: #065f46;
        }
        .status-partial {
            background-color: #dbeafe;
            color: #1e40af;
        }
        @media print {
            body {
                background-color: #ffffff;
            }
            .email-container {
                box-shadow: none;
            }
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

        <!-- Invoice Title -->
        <div>
            <h2 class="invoice-title">INVOICE</h2>
            <p class="invoice-number">{{ $invoice->invoice_number ?? '#' . $invoice->id }}</p>
            <p style="color: #6b7280; margin: 5px 0;">
                Date: {{ $invoice->created_at->format('F d, Y') }}
            </p>
            <span class="status-badge status-{{ $invoice->status ?? 'pending' }}">
                {{ strtoupper($invoice->status ?? 'pending') }}
            </span>
        </div>

        <!-- Bill To Section -->
        <div class="info-section">
            <div class="info-block">
                <h3>Bill To:</h3>
                <p><strong>{{ $customer['name'] }}</strong></p>
                @if(!empty($customer['email']))
                    <p>{{ $customer['email'] }}</p>
                @endif
                @if(!empty($customer['type']))
                    <p style="text-transform: capitalize; color: #6b7280;">{{ $customer['type'] }}</p>
                @endif
            </div>
        </div>

        <!-- Items Table -->
        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th class="text-right">Qty</th>
                    <th class="text-right">Unit Price</th>
                    <th class="text-right">Tax Rate</th>
                    <th class="text-right">Amount</th>
                </tr>
            </thead>
            <tbody>
                @foreach($invoiceData['lines'] as $line)
                    <tr>
                        <td>{{ $line['desc'] }}</td>
                        <td class="text-right">{{ $line['qty'] }}</td>
                        <td class="text-right">{{ $organization['currency'] ?? 'CAD' }} {{ number_format($line['unit_price'], 2) }}</td>
                        <td class="text-right">{{ number_format($line['tax_rate'], 2) }}%</td>
                        <td class="text-right">{{ $organization['currency'] ?? 'CAD' }} {{ number_format($line['line_subtotal'] + $line['tax_amount'], 2) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>

        <!-- Totals Section -->
        <div class="totals-section">
            <table class="totals-table">
                <tr>
                    <td>Subtotal:</td>
                    <td class="text-right">{{ $organization['currency'] ?? 'CAD' }} {{ number_format($invoice->subtotal, 2) }}</td>
                </tr>
                <tr>
                    <td>Tax:</td>
                    <td class="text-right">{{ $organization['currency'] ?? 'CAD' }} {{ number_format($invoice->tax_total, 2) }}</td>
                </tr>
                <tr>
                    <td>Total:</td>
                    <td class="text-right">{{ $organization['currency'] ?? 'CAD' }} {{ number_format($invoice->price, 2) }}</td>
                </tr>
            </table>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>Thank you for your business!</p>
            <p style="font-size: 12px; color: #9ca3af; margin-top: 10px;">
                This is an automated email. Please do not reply directly to this message.
            </p>
        </div>
    </div>
</body>
</html>

