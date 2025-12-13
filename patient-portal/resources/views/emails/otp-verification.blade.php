<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>🔐 Verify Your Email - Wellovis</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style>
  body{font-family:Arial,Helvetica,sans-serif;background:#f5f7fb;color:#2d2d2d;margin:0;padding:24px}
  .card{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.06);overflow:hidden}
  .header{padding:24px 28px;border-bottom:4px solid #A100FF;text-align:center}
  .title{margin:0;color:#A100FF;font-size:22px}
  .subtitle{margin:6px 0 0 0;color:#666}
  .section{padding:28px 32px;text-align:center}
  .greeting{font-size:24px;font-weight:700;color:#222;margin:0 0 16px 0}
  .message{color:#555;font-size:15px;line-height:1.6;margin:16px 0}
  .otp-container{background:linear-gradient(135deg, #faf5ff 0%, #e0e7ff 100%);border-radius:12px;padding:32px;margin:28px 0;border:2px solid #e0e7ff}
  .otp-label{font-size:14px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
  .otp-code{font-size:42px;font-weight:700;color:#A100FF;letter-spacing:8px;font-family:monospace;margin:12px 0}
  .expiry-notice{background:#fff3cd;border:1px solid #ffc107;border-left:4px solid #ffc107;border-radius:8px;padding:14px 16px;margin:24px 0;color:#856404;text-align:left}
  .expiry-notice strong{color:#856404}
  .security-tips{background:#f8f9fa;border-radius:8px;padding:20px;margin:24px 0;text-align:left}
  .security-title{font-size:16px;font-weight:700;color:#222;margin:0 0 12px 0}
  .security-list{margin:8px 0;padding-left:20px}
  .security-list li{margin:8px 0;color:#555;font-size:14px;line-height:1.6}
  .footer{padding:18px 28px;border-top:1px solid #eee;color:#777;font-size:13px;text-align:center}
  .footer strong{color:#A100FF}
  @media (max-width:600px){
    body{padding:12px}
    .card{border-radius:8px}
    .section{padding:20px 24px}
    .header{padding:20px 20px}
    .greeting{font-size:20px}
    .otp-code{font-size:36px;letter-spacing:6px}
    .otp-container{padding:24px 16px}
  }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">🔐 Email Verification</h1>
      <p class="subtitle">
        Complete your registration with Wellovis
      </p>
    </div>

    <div class="section">
      <h2 class="greeting">Verify Your Email Address</h2>
      
      <p class="message">
        Thank you for registering with Wellovis! To complete your registration, please use the verification code below:
      </p>

      <div class="otp-container">
        <div class="otp-label">Your Verification Code</div>
        <div class="otp-code">{{ $otp }}</div>
      </div>

      <div class="expiry-notice">
        <strong>⏰ Important:</strong> This verification code will expire in <strong>10 minutes</strong>. Please complete your registration before it expires.
      </div>

      <div class="security-tips">
        <div class="security-title">🛡️ Security Tips</div>
        <ul class="security-list">
          <li>Never share this code with anyone</li>
          <li>Wellovis staff will never ask for your verification code</li>
          <li>If you didn't request this code, please ignore this email</li>
          <li>This code is single-use only</li>
        </ul>
      </div>

      <p class="message" style="margin-top:24px;color:#666">
        If you're having trouble completing your registration, please contact our support team.
      </p>
    </div>

    <div class="footer">
      <p><strong>Wellovis</strong></p>
      <p>AI-Powered EMR Platform</p>
      <p>© {{ date('Y') }} All rights reserved.</p>
    </div>
  </div>
</body>
</html>

