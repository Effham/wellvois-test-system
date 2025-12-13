<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documents Uploaded by Your Practitioner</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            background-color: #f8f9fa;
            margin: 0;
            padding: 20px;
            color: #333;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #10b981, #3b82f6);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            padding: 30px;
        }
        .content h2 {
            color: #333;
            margin-bottom: 20px;
            font-size: 20px;
        }
        .content p {
            line-height: 1.6;
            margin-bottom: 15px;
        }
        .btn {
            display: inline-block;
            background: linear-gradient(135deg, #10b981, #3b82f6);
            color: white;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-weight: 600;
            text-align: center;
            margin: 20px 0;
            font-size: 16px;
        }
        .btn:hover {
            opacity: 0.9;
        }
        .document-details {
            background-color: #f8f9fa;
            border-left: 4px solid #10b981;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .document-details h3 {
            margin: 0 0 15px 0;
            color: #10b981;
            font-size: 18px;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .detail-label {
            font-weight: 600;
            color: #6b7280;
        }
        .detail-value {
            color: #111827;
            font-weight: 500;
        }
        .important-note {
            background-color: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 14px;
            color: #666;
        }
        .footer a {
            color: #10b981;
            text-decoration: none;
        }
        .document-list {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
        }
        .document-item {
            padding: 10px;
            background-color: white;
            margin-bottom: 10px;
            border-radius: 4px;
            border: 1px solid #e5e7eb;
        }
        .document-item:last-child {
            margin-bottom: 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📄 Documents Uploaded by Your Practitioner</h1>
        </div>

        <div class="content">
            <h2>Hello {{ $patient_name }},</h2>

            <p>Your healthcare provider, <strong>{{ $practitioner_name }}</strong>, has uploaded documents for you to review.</p>

            <div class="document-details">
                <h3>📋 Document Information</h3>
                <div class="detail-row">
                    <span class="detail-label">Uploaded by:</span>
                    <span class="detail-value">{{ $practitioner_name }}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date Uploaded:</span>
                    <span class="detail-value">{{ $upload_date }}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Clinic:</span>
                    <span class="detail-value">{{ $clinic_name }}</span>
                </div>
                @if (!empty($document_title))
                <div class="detail-row">
                    <span class="detail-label">Document Type:</span>
                    <span class="detail-value">{{ $document_title }}</span>
                </div>
                @endif
            </div>

            @if (!empty($documents) && count($documents) > 0)
            <div class="document-list">
                <strong style="display: block; margin-bottom: 10px; color: #374151;">Uploaded Documents:</strong>
                @foreach ($documents as $document)
                <div class="document-item">
                    📄 {{ $document['name'] ?? 'Document' }}
                </div>
                @endforeach
            </div>
            @endif

            <div style="text-align: center;">
                <a href="{{ $access_url }}" class="btn">📄 View Documents</a>
            </div>

            <div class="important-note">
                <strong>🔒 Secure Access:</strong>
                <p style="margin: 10px 0 0 0; line-height: 1.5;">
                    This link is secure and will remain active for 7 days. Click the button above to view and download your documents. You may be asked to verify your identity for security purposes.
                </p>
            </div>

            <p><strong>Need help?</strong> If you have any questions about these documents or need assistance accessing them, please contact {{ $clinic_name }} directly.</p>

            <p style="color: #6b7280; font-style: italic;">This is an automated notification from your healthcare provider. Please do not reply to this email.</p>
        </div>

        <div class="footer">
            <p>This email was sent by {{ $clinic_name }} via the Wellovis platform.</p>
            <p>© {{ date('Y') }} Wellovis. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
