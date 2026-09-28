<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * attributes.name and attribute_values.value become {ru, kk} JSON, like
 * brands.name. The existing text becomes the ru translation.
 *
 * varchar → text first: `{"ru":"…"}` is longer than the plain string, and
 * MySQL refuses to turn non-JSON text into a json column — so the data is
 * rewritten while the column is plain text, then the type is changed.
 *
 * SQLite has no native ALTER COLUMN TYPE: every ->change() rebuilds the
 * whole table (create a shadow table, copy rows, drop the original, rename
 * the shadow into place). attribute_values.attribute_id is a cascadeOnDelete
 * foreign key onto attributes.id, and inside an already-open transaction
 * (as php artisan test runs each test — see RefreshDatabase) SQLite refuses
 * to toggle `PRAGMA foreign_keys`, so Laravel's usual disable/re-enable
 * around the rebuild is a no-op: dropping the shadowed `attributes` table
 * cascades and silently deletes every attribute_values row. Dropping the FK
 * before touching `attributes` and re-adding it once both tables are done
 * avoids that data loss; on MySQL, which alters columns in place, this is a
 * harmless no-op pair of statements.
 */
return new class extends Migration
{
    /** @var array<string, string> table => column */
    private const COLUMNS = ['attributes' => 'name', 'attribute_values' => 'value'];

    public function up(): void
    {
        Schema::table('attribute_values', fn (Blueprint $blueprint) => $blueprint->dropForeign(['attribute_id']));

        foreach (self::COLUMNS as $table => $column) {
            Schema::table($table, fn (Blueprint $blueprint) => $blueprint->text($column)->change());

            DB::table($table)->lazyById()->each(function (object $row) use ($table, $column): void {
                DB::table($table)->where('id', $row->id)->update([
                    $column => json_encode(['ru' => (string) $row->{$column}], JSON_UNESCAPED_UNICODE),
                ]);
            });

            Schema::table($table, fn (Blueprint $blueprint) => $blueprint->json($column)->change());
        }

        Schema::table('attribute_values', fn (Blueprint $blueprint) => $blueprint->foreign('attribute_id')->references('id')->on('attributes')->cascadeOnDelete());
    }

    public function down(): void
    {
        Schema::table('attribute_values', fn (Blueprint $blueprint) => $blueprint->dropForeign(['attribute_id']));

        foreach (self::COLUMNS as $table => $column) {
            Schema::table($table, fn (Blueprint $blueprint) => $blueprint->text($column)->change());

            DB::table($table)->lazyById()->each(function (object $row) use ($table, $column): void {
                $translations = json_decode((string) $row->{$column}, true);
                $text = is_array($translations) ? (string) ($translations['ru'] ?? '') : (string) $row->{$column};

                DB::table($table)->where('id', $row->id)->update([$column => mb_substr($text, 0, 255)]);
            });

            Schema::table($table, fn (Blueprint $blueprint) => $blueprint->string($column)->change());
        }

        Schema::table('attribute_values', fn (Blueprint $blueprint) => $blueprint->foreign('attribute_id')->references('id')->on('attributes')->cascadeOnDelete());
    }
};
