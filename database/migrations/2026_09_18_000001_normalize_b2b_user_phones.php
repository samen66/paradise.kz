<?php

declare(strict_types=1);

use App\Support\Phone;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    /**
     * SMS login finds B2B clients by the normalized number (+7XXXXXXXXXX),
     * while the old registration form stored the phone as typed. Rewrite
     * those in place; a number whose normalized form already belongs to
     * another row is left for the manager to resolve and reported.
     */
    public function up(): void
    {
        DB::table('users')
            ->where('type', 'b2b')
            ->whereNotNull('phone')
            ->orderBy('id')
            ->each(function (object $user): void {
                $normalized = Phone::normalize((string) $user->phone);

                if ($normalized === '' || $normalized === $user->phone) {
                    return;
                }

                if (DB::table('users')->where('phone', $normalized)->exists()) {
                    $this->reportSkipped((int) $user->id, (string) $user->phone, $normalized);

                    return;
                }

                DB::table('users')->where('id', $user->id)->update(['phone' => $normalized]);
            });
    }

    /**
     * The manager has to merge or fix these by hand, so they must not pass
     * silently: logged always, echoed when the migration runs from artisan.
     */
    private function reportSkipped(int $userId, string $phone, string $normalized): void
    {
        $message = "B2B client #{$userId}: phone \"{$phone}\" left as is, {$normalized} already belongs to another user.";

        Log::warning($message, ['user_id' => $userId, 'phone' => $phone]);

        if (app()->runningInConsole() && ! app()->runningUnitTests()) {
            fwrite(STDOUT, $message.PHP_EOL);
        }
    }

    /**
     * The original spelling is not recoverable, and the normalized one is
     * valid for every code path.
     */
    public function down(): void {}
};
