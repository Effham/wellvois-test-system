<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Patient Registration Request</title>
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
            background: linear-gradient(135deg, #A100FF, #0500C9);
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
        .info-box {
            background-color: #f8f9fa;
            border-left: 4px solid #A100FF;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .patient-details {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            padding: 20px;
            margin: 20px 0;
            border-radius: 6px;
        }
        .patient-details h3 {
            margin-top: 0;
            color: #A100FF;
            font-size: 18px;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #e9ecef;
        }
        .detail-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }
        .detail-label {
            font-weight: 600;
            color: #666;
        }
        .detail-value {
            color: #333;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 14px;
            color: #666;
        }
        .footer a {
            color: #A100FF;
            text-decoration: none;
        }
        .urgent {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Patient Registration Request</h1>
        </div>
        
        <div class="content">
            <h2>New Patient Registration Request</h2>
            
            <p>A patient has requested to join <strong>{{ $tenantName }}</strong> through your public portal.</p>
            
            <div class="urgent">
                <strong>Action Required:</strong> Please review the patient details below and contact them to complete the registration process.
            </div>
            
            <div class="patient-details">
                <h3>Patient Information</h3>
                <div class="detail-row">
                    <span class="detail-label">Name:</span>
                    <span class="detail-value">{{ $patientName }}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Email:</span>
                    <span class="detail-value">{{ $patientEmail }}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Health Card Number:</span>
                    <span class="detail-value">{{ $healthCardNumber }}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Request Date:</span>
                    <span class="detail-value">{{ $requestDate }}</span>
                </div>
            </div>
            
            <div class="info-box">
                <strong>Next Steps:</strong>
                <ul>
                    <li>Review the patient information provided above</li>
                    <li>Contact the patient at {{ $patientEmail }} to verify their identity</li>
                    <li>If verified, create a patient invitation through your admin portal</li>
                    <li>The patient will receive an invitation email to complete their registration</li>
                </ul>
            </div>
            
            <p><strong>Important:</strong> Please verify the patient's identity before sending an invitation. Ensure the health card number and personal information are accurate.</p>
            
            <p>This request was submitted through your public portal at {{ $tenantName }}. If you have any questions about this request, please contact your system administrator.</p>
        </div>
        
        <div class="footer">
            <p>This email was sent by the Wellovis platform for {{ $tenantName }}.</p>
            <p>© {{ date('Y') }} Wellovis. All rights reserved.</p>
        </div>
    </div>
</body>
</html>