<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Virtual Appointment Link</title>
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
        .appointment-details {
            background-color: #f8f9fa;
            border-left: 4px solid #10b981;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .appointment-details h3 {
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
        .room-id-box {
            background-color: #eff6ff;
            border: 2px dashed #3b82f6;
            padding: 15px;
            margin: 20px 0;
            border-radius: 6px;
            text-align: center;
        }
        .room-id-box strong {
            color: #1d4ed8;
            font-size: 18px;
        }
        .important-note {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
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
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🩺 Virtual Appointment Ready</h1>
        </div>
        
        <div class="content">
            <h2>Hello {{ $patient_name }},</h2>
            
            <p>Your virtual appointment is ready! Your healthcare provider has started the video session and is waiting for you to join.</p>
            
            <div class="appointment-details">
                <h3>📅 Appointment Details</h3>
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
                <a href="{{ $appointment_url }}" class="btn">🎥 Join Virtual Appointment</a>
            </div>
            
            <div class="room-id-box">
                <strong>Room ID: {{ $room_id }}</strong>
                <br>
                <small style="color: #6b7280;">Keep this ID handy in case you need technical support</small>
            </div>
            
            <div class="important-note">
                <strong>📋 Before joining:</strong>
                <ul style="margin: 10px 0;">
                    <li>Ensure you have a stable internet connection</li>
                    <li>Test your camera and microphone</li>
                    <li>Find a quiet, private space for your appointment</li>
                    <li>Have your ID and insurance information ready if needed</li>
                </ul>
            </div>
            
            <p><strong>Need help?</strong> If you have any issues accessing the appointment, please contact {{ $clinic_name }} directly.</p>
            
            <p style="color: #6b7280; font-style: italic;">This link will remain active throughout your appointment session. You can rejoin if you experience any connection issues.</p>
        </div>
        
        <div class="footer">
            <p>This email was sent by {{ $clinic_name }} via the Wellovis platform.</p>
            <p>© {{ date('Y') }} Wellovis. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
