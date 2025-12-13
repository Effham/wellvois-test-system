<?php

namespace Tests\Feature;

use App\Mail\UserSessionActivityMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class MailQueueTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_session_activity_mail_implements_should_queue(): void
    {
        // Verify the mail class implements ShouldQueue
        $user = User::factory()->create();
        $mail = new UserSessionActivityMail($user, 'login', now());

        $this->assertInstanceOf(\Illuminate\Contracts\Queue\ShouldQueue::class, $mail);
    }

    public function test_mail_is_queued_when_sent(): void
    {
        Queue::fake();
        Mail::fake();

        $user = User::factory()->create();

        // Send the mail
        Mail::to($user->email)->send(new UserSessionActivityMail($user, 'login', now()));

        // Assert that the mail was queued
        Mail::assertQueued(UserSessionActivityMail::class, function ($mail) use ($user) {
            return $mail->user->id === $user->id;
        });
    }

    public function test_mail_has_queueable_trait(): void
    {
        $user = User::factory()->create();
        $mail = new UserSessionActivityMail($user, 'login', now());

        // Verify the mail uses Queueable trait
        $this->assertTrue(
            in_array(\Illuminate\Bus\Queueable::class, class_uses($mail)),
            'Mail class should use Queueable trait'
        );
    }
}
