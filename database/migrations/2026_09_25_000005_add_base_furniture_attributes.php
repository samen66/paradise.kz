<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Base furniture attributes (beds, sofas, wardrobes, tables, chairs) so a
 * manager picks them in the product form instead of typing each one.
 *
 * Attributes are one shared list, not tied to categories; values stay free
 * text per product. An attribute is skipped when its slug or its ru name is
 * already taken — a manager may have created «Цвет» by hand, and a second
 * «Цвет» would split the storefront filter in two. Nothing existing is
 * rewritten. Width, depth and height are not filterable: the filter matches
 * exact text, so every size would become its own checkbox.
 *
 * Raw queries, not the Attribute model: a data migration must keep working
 * after the model changes.
 *
 * Skipped under PHPUnit: every test starts from the migrated schema, and the
 * suite expects an empty attribute list (tests make their own «color»).
 * BaseFurnitureAttributesMigrationTest calls up() with $force.
 */
return new class extends Migration
{
    /**
     * slug => [ru, kk, is_filterable]
     *
     * @var array<string, array{0: string, 1: string, 2: bool}>
     */
    public const ATTRIBUTES = [
        // Common
        'color' => ['Цвет', 'Түсі', true],
        'body-material' => ['Материал корпуса', 'Корпус материалы', true],
        'facade-material' => ['Материал фасада', 'Қасбет материалы', false],
        'width' => ['Ширина, см', 'Ені, см', false],
        'depth' => ['Глубина, см', 'Тереңдігі, см', false],
        'height' => ['Высота, см', 'Биіктігі, см', false],
        'warranty' => ['Гарантия', 'Кепілдік', false],
        // Sofas
        'transformation-mechanism' => ['Механизм трансформации', 'Трансформация механизмі', true],
        'upholstery' => ['Материал обивки', 'Қаптама материалы', true],
        'filling' => ['Наполнитель', 'Толтырғыш', false],
        'shape' => ['Форма', 'Пішіні', true],
        // Beds and sofas
        'sleeping-area' => ['Спальное место, см', 'Ұйықтайтын орын, см', true],
        // Beds
        'lift-mechanism' => ['Подъёмный механизм', 'Көтеру механизмі', true],
        'linen-box' => ['Ящик для белья', 'Төсек-орын жәшігі', false],
        'bed-base' => ['Основание', 'Негізі', false],
        'headboard' => ['Изголовье', 'Бас жағы', false],
        // Wardrobes
        'door-type' => ['Тип дверей', 'Есік түрі', true],
        'door-count' => ['Количество дверей', 'Есіктер саны', false],
        'mirror' => ['Зеркало', 'Айна', false],
        // Tables
        'tabletop-shape' => ['Форма столешницы', 'Үстел бетінің пішіні', true],
        'tabletop-material' => ['Материал столешницы', 'Үстел бетінің материалы', false],
        'extendable' => ['Раздвижной', 'Жиылмалы', true],
        'seats' => ['Количество мест', 'Орын саны', false],
        // Chairs
        'frame-material' => ['Материал каркаса', 'Қаңқа материалы', false],
        'soft-seat' => ['Мягкое сиденье', 'Жұмсақ отырғыш', false],
        'max-load' => ['Макс. нагрузка, кг', 'Ең жоғары жүктеме, кг', false],
    ];

    public function up(bool $force = false): void
    {
        if (app()->runningUnitTests() && ! $force) {
            return;
        }

        $takenSlugs = DB::table('attributes')->pluck('slug')->all();
        $takenNames = DB::table('attributes')->pluck('name')
            ->map(fn (?string $name): string => $this->normalise($this->ruName($name)))
            ->all();

        $now = now();

        foreach (self::ATTRIBUTES as $slug => [$ru, $kk, $isFilterable]) {
            if (in_array($slug, $takenSlugs, true) || in_array($this->normalise($ru), $takenNames, true)) {
                continue;
            }

            DB::table('attributes')->insert([
                'name' => json_encode(['ru' => $ru, 'kk' => $kk], JSON_UNESCAPED_UNICODE),
                'slug' => $slug,
                'is_filterable' => $isFilterable,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    /**
     * Removes only the base attributes nobody uses yet: deleting one with
     * values would cascade away product and variant characteristics.
     */
    public function down(): void
    {
        DB::table('attributes')
            ->whereIn('slug', array_keys(self::ATTRIBUTES))
            ->whereNotExists(fn ($query) => $query->select(DB::raw(1))->from('attribute_values')->whereColumn('attribute_values.attribute_id', 'attributes.id'))
            ->whereNotExists(fn ($query) => $query->select(DB::raw(1))->from('product_variant_attribute_values')->whereColumn('product_variant_attribute_values.attribute_id', 'attributes.id'))
            ->delete();
    }

    /** ru text of a stored name: {ru, kk} JSON, or plain text from before translations. */
    private function ruName(?string $name): string
    {
        $translations = json_decode((string) $name, true);

        return is_array($translations) ? (string) ($translations['ru'] ?? '') : (string) $name;
    }

    private function normalise(string $name): string
    {
        return mb_strtolower(trim($name));
    }
};
