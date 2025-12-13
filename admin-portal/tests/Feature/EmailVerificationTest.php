<?php

namespace Tests\Feature;

use App\Models\EmailVerification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class EmailVerificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_send_otp_to_valid_email(): void
    {
        Mail::fake();

        $response = $this->postJson(route('register.send-otp'), [
            'email' => 'test@example.com',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Verification code sent to your email',
            ]);

        $this->assertDatabaseHas('email_verifications', [
            'email' => 'test@example.com',
            'is_verified' => false,
        ]);

        Mail::assertQueued(\App\Mail\OTPVerificationMail::class, function ($mail) {
            return $mail->hasTo('test@example.com');
        });
    }

    public function test_cannot_send_otp_to_invalid_email(): void
    {
        $response = $this->postJson(route('register.send-otp'), [
            'email' => 'invalid-email',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Invalid email address',
            ]);
    }

    public function test_can_verify_valid_otp(): void
    {
        $email = 'test@example.com';
        $otp = '123456';

        EmailVerification::create([
            'email' => $email,
            'otp' => $otp,
            'expires_at' => now()->addMinutes(10),
            'is_verified' => false,
        ]);

        $response = $this->postJson(route('register.verify-otp'), [
            'email' => $email,
            'otp' => $otp,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Email verified successfully',
            ]);

        $this->assertDatabaseHas('email_verifications', [
            'email' => $email,
            'otp' => $otp,
            'is_verified' => true,
        ]);
    }

    public function test_cannot_verify_invalid_otp(): void
    {
        $email = 'test@example.com';

        EmailVerification::create([
            'email' => $email,
            'otp' => '123456',
            'expires_at' => now()->addMinutes(10),
            'is_verified' => false,
        ]);

        $response = $this->postJson(route('register.verify-otp'), [
            'email' => $email,
            'otp' => '999999',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Invalid verification code',
            ]);
    }

    public function test_cannot_verify_expired_otp(): void
    {
        $email = 'test@example.com';
        $otp = '123456';

        EmailVerification::create([
            'email' => $email,
            'otp' => $otp,
            'expires_at' => now()->subMinutes(1),
            'is_verified' => false,
        ]);

        $response = $this->postJson(route('register.verify-otp'), [
            'email' => $email,
            'otp' => $otp,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Verification code has expired. Please request a new one.',
            ]);
    }

    public function test_deletes_old_unverified_otps_when_sending_new_one(): void
    {
        Mail::fake();

        $email = 'test@example.com';

        // Create an old unverified OTP
        EmailVerification::create([
            'email' => $email,
            'otp' => '111111',
            'expires_at' => now()->addMinutes(10),
            'is_verified' => false,
        ]);

        // Send a new OTP
        $response = $this->postJson(route('register.send-otp'), [
            'email' => $email,
        ]);

        $response->assertStatus(200);

        // Should only have one unverified OTP for this email
        $this->assertEquals(1, EmailVerification::where('email', $email)
            ->where('is_verified', false)
            ->count());
    }
}
