<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Contracts\Catalog\CatalogSource;
use App\Jobs\Catalog\SyncProductFoldersJob;
use App\Jobs\Catalog\SyncProductImagesJob;
use App\Jobs\Catalog\SyncProductsJob;
use App\Jobs\Catalog\SyncProductVariantsJob;
use App\Jobs\Catalog\SyncStockJob;
use App\Jobs\Catalog\SyncStoresJob;
use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Run a full MoySklad sync SYNCHRONOUSLY (no queue required), then populate
 * categories, brands and structured attributes with realistic furniture-shop
 * data based on the imported product names and ERP attributes.
 *
 * Usage:
 *   php artisan catalog:sync-and-populate          # full sync + populate
 *   php artisan catalog:sync-and-populate --no-sync # skip sync, only populate
 *   php artisan catalog:sync-and-populate --no-populate # only sync, no populate
 */
class SyncAndPopulateCatalogCommand extends Command
{
    protected $signature = 'catalog:sync-and-populate
        {--no-sync : Skip MoySklad sync, only populate attributes}
        {--no-populate : Only run sync, skip attribute population}
        {--since= : Y-m-d H:i:s for incremental sync}';

    protected $description = 'Sync products from MoySklad (synchronously) and populate categories, brands, and attributes with realistic data';

    // ─── Furniture-specific reference data ──────────────────────────────

    /** @var array<string, list<string>> Category keyword → subcategories */
    private const CATEGORY_MAP = [
        'Диваны' => ['Прямые диваны', 'Угловые диваны', 'Модульные диваны', 'Диваны-кровати'],
        'Кровати' => ['Двуспальные кровати', 'Односпальные кровати', 'Детские кровати', 'Кровати с подъёмным механизмом'],
        'Шкафы' => ['Шкафы-купе', 'Распашные шкафы', 'Гардеробные системы', 'Книжные шкафы'],
        'Столы' => ['Обеденные столы', 'Журнальные столы', 'Рабочие столы', 'Компьютерные столы'],
        'Стулья и кресла' => ['Обеденные стулья', 'Офисные кресла', 'Кресла для отдыха', 'Барные стулья'],
        'Комоды и тумбы' => ['Комоды', 'Прикроватные тумбы', 'ТВ-тумбы', 'Обувницы'],
        'Мягкая мебель' => ['Пуфы', 'Банкетки', 'Оттоманки', 'Кушетки'],
        'Детская мебель' => ['Детские кровати', 'Детские столы', 'Детские шкафы', 'Комплекты детской мебели'],
        'Кухонная мебель' => ['Кухонные гарнитуры', 'Обеденные группы', 'Буфеты', 'Барные стойки'],
        'Прихожая' => ['Вешалки', 'Обувницы', 'Зеркала', 'Банкетки для прихожей'],
        'Матрасы' => ['Пружинные матрасы', 'Беспружинные матрасы', 'Ортопедические матрасы', 'Топперы'],
        'Аксессуары' => ['Подушки декоративные', 'Пледы', 'Постельное бельё', 'Светильники'],
    ];

    /** @var list<string> */
    private const BRANDS = [
        'Paradise Home', 'Мебельград', 'Askona', 'Hoff', 'DaVita',
        'Rivalli', 'Ormatek', 'Moon Trade', 'Stolplit', 'Lazurit',
        'Шатура', 'Borovichi', 'Первый мебельный', 'Angstrem',
    ];

    /** @var array<string, list<string>> Attribute name → possible values */
    private const ATTRIBUTE_POOL = [
        'Материал каркаса' => ['Массив дуба', 'Массив бука', 'ЛДСП', 'МДФ', 'Металл', 'Фанера берёзовая', 'Массив сосны', 'Массив ясеня'],
        'Материал обивки' => ['Велюр', 'Рогожка', 'Экокожа', 'Натуральная кожа', 'Жаккард', 'Микровелюр', 'Шенилл', 'Флок'],
        'Цвет' => ['Белый', 'Чёрный', 'Серый', 'Бежевый', 'Венге', 'Дуб сонома', 'Орех', 'Графит', 'Слоновая кость', 'Антрацит'],
        'Стиль' => ['Современный', 'Классический', 'Лофт', 'Скандинавский', 'Минимализм', 'Прованс', 'Хай-тек', 'Модерн'],
        'Страна производства' => ['Казахстан', 'Китай', 'Россия', 'Турция', 'Беларусь', 'Италия'],
        'Механизм трансформации' => ['Еврокнижка', 'Аккордеон', 'Дельфин', 'Пума', 'Без механизма', 'Клик-кляк', 'Выкатной'],
        'Тип наполнителя' => ['ППУ', 'Пружинный блок Bonnel', 'Независимый пружинный блок', 'Латекс', 'Кокосовая койра', 'Холлофайбер', 'Пенополиуретан HR'],
        'Жёсткость' => ['Мягкий', 'Средний', 'Жёсткий', 'Средне-жёсткий'],
        'Тип ножек' => ['Деревянные', 'Металлические хромированные', 'Металлические чёрные', 'Пластиковые', 'Без ножек'],
        'Наличие ящика для белья' => ['Да', 'Нет'],
        'Гарантия' => ['12 месяцев', '18 месяцев', '24 месяца', '36 месяцев'],
        'Максимальная нагрузка (кг)' => ['100', '120', '150', '180', '200', '250'],
    ];

    /** Keywords in product name → which attributes are relevant */
    private const KEYWORD_ATTRIBUTES = [
        'диван' => ['Материал каркаса', 'Материал обивки', 'Цвет', 'Стиль', 'Механизм трансформации', 'Тип наполнителя', 'Наличие ящика для белья', 'Гарантия'],
        'кровать' => ['Материал каркаса', 'Цвет', 'Стиль', 'Тип наполнителя', 'Максимальная нагрузка (кг)', 'Гарантия'],
        'шкаф' => ['Материал каркаса', 'Цвет', 'Стиль', 'Гарантия'],
        'стол' => ['Материал каркаса', 'Цвет', 'Стиль', 'Тип ножек', 'Максимальная нагрузка (кг)', 'Гарантия'],
        'стул' => ['Материал каркаса', 'Материал обивки', 'Цвет', 'Стиль', 'Тип ножек', 'Максимальная нагрузка (кг)', 'Гарантия'],
        'кресло' => ['Материал каркаса', 'Материал обивки', 'Цвет', 'Стиль', 'Механизм трансформации', 'Тип ножек', 'Гарантия'],
        'комод' => ['Материал каркаса', 'Цвет', 'Стиль', 'Тип ножек', 'Гарантия'],
        'тумб' => ['Материал каркаса', 'Цвет', 'Стиль', 'Тип ножек', 'Гарантия'],
        'матрас' => ['Тип наполнителя', 'Жёсткость', 'Максимальная нагрузка (кг)', 'Гарантия'],
        'пуф' => ['Материал обивки', 'Цвет', 'Стиль', 'Максимальная нагрузка (кг)', 'Гарантия'],
        'полк' => ['Материал каркаса', 'Цвет', 'Стиль', 'Гарантия'],
        'зеркал' => ['Материал каркаса', 'Стиль', 'Гарантия'],
    ];

    /** Default attributes for any product that doesn't match keywords */
    private const DEFAULT_ATTRIBUTES = ['Материал каркаса', 'Цвет', 'Стиль', 'Страна производства', 'Гарантия'];

    public function handle(CatalogSource $source): int
    {
        $skipSync = (bool) $this->option('no-sync');
        $skipPopulate = (bool) $this->option('no-populate');

        // ─── Step 1: MoySklad Sync ──────────────────────────────────────
        if (! $skipSync) {
            $this->runSync($source);
        }

        // ─── Step 2: Populate structured data ───────────────────────────
        if (! $skipPopulate) {
            $this->populateCatalog();
        }

        $this->newLine();
        $this->info('✅ Done! Final counts:');
        $this->table(
            ['Table', 'Count'],
            [
                ['products', Product::count()],
                ['categories', Category::count()],
                ['brands', Brand::count()],
                ['attributes', Attribute::count()],
                ['attribute_values', AttributeValue::count()],
            ]
        );

        return self::SUCCESS;
    }

    // ─── Sync ───────────────────────────────────────────────────────────

    private function runSync(CatalogSource $source): void
    {
        /** @var string|null $since */
        $since = $this->option('since');

        $this->info($since === null
            ? '🔄 Starting FULL MoySklad sync (synchronous)...'
            : "🔄 Starting incremental MoySklad sync since {$since}...");

        $steps = [
            'Syncing product folders...' => fn () => (new SyncProductFoldersJob)->handle($source),
            'Syncing products...' => fn () => (new SyncProductsJob($since))->handle($source),
            'Syncing product variants...' => fn () => (new SyncProductVariantsJob($since))->handle($source),
            'Syncing stores...' => fn () => (new SyncStoresJob)->handle($source),
            'Syncing stock...' => fn () => (new SyncStockJob($since))->handle($source),
        ];

        foreach ($steps as $label => $job) {
            $this->line("  → {$label}");
            $job();
            $this->line("    ✓ done");
        }

        // Process image sync jobs that were dispatched to the queue
        // by SyncProductsJob — run them synchronously too.
        $this->line('  → Syncing product images (this may take a while)...');
        $this->processImageJobsSync($source);
        $this->line('    ✓ done');

        $this->info('🔄 MoySklad sync complete!');
        $this->newLine();
    }

    /**
     * SyncProductsJob dispatches SyncProductImagesJob to the queue. Since
     * we want fully synchronous execution, drain those jobs manually.
     */
    private function processImageJobsSync(CatalogSource $source): void
    {
        // Image jobs were dispatched to the database queue. Process them here.
        $processed = 0;
        $bar = null;

        // Count pending image jobs
        $pendingCount = DB::table('jobs')
            ->where('payload', 'like', '%SyncProductImagesJob%')
            ->count();

        if ($pendingCount > 0) {
            $bar = $this->output->createProgressBar($pendingCount);
            $bar->start();

            while (true) {
                $job = DB::table('jobs')
                    ->where('payload', 'like', '%SyncProductImagesJob%')
                    ->orderBy('id')
                    ->first();

                if ($job === null) {
                    break;
                }

                try {
                    $payload = json_decode($job->payload, true);
                    $command = unserialize($payload['data']['command']);

                    if ($command instanceof SyncProductImagesJob) {
                        $command->handle($source);
                    }

                    DB::table('jobs')->where('id', $job->id)->delete();
                    $processed++;
                    $bar?->advance();
                } catch (\Throwable $e) {
                    $this->warn("    ⚠ Image sync error: {$e->getMessage()}");
                    // Move to failed and continue
                    DB::table('jobs')->where('id', $job->id)->delete();
                    $bar?->advance();
                }
            }

            $bar?->finish();
            $this->newLine();
        }

        $this->line("    Processed {$processed} image sync jobs");
    }

    // ─── Populate ───────────────────────────────────────────────────────

    private function populateCatalog(): void
    {
        $this->info('📦 Populating categories, brands, and attributes...');

        $products = Product::all();

        if ($products->isEmpty()) {
            $this->warn('  No products found. Skipping populate.');
            return;
        }

        $this->line("  Found {$products->count()} products to process");

        // 1) Create categories based on product names
        $categories = $this->createCategories($products);

        // 2) Create brands
        $brands = $this->createBrands();

        // 3) Create attributes
        $attributes = $this->createAttributes();

        // 4) Assign categories, brands, and attribute values to each product
        $bar = $this->output->createProgressBar($products->count());
        $bar->start();

        foreach ($products as $product) {
            $this->populateProduct($product, $categories, $brands, $attributes);
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info('📦 Catalog population complete!');
    }

    /**
     * Create categories from the CATEGORY_MAP. Returns keyed by name.
     *
     * @return array<string, Category>
     */
    private function createCategories($products): array
    {
        $this->line('  → Creating categories...');
        $result = [];

        foreach (self::CATEGORY_MAP as $parentName => $children) {
            $parent = Category::query()->firstOrCreate(
                ['slug' => Str::slug($parentName)],
                [
                    'name' => json_encode(['ru' => $parentName], JSON_UNESCAPED_UNICODE),
                    'slug' => Str::slug($parentName),
                    'is_active' => true,
                    'sort_order' => 0,
                ]
            );
            $result[$parentName] = $parent;

            foreach ($children as $i => $childName) {
                $child = Category::query()->firstOrCreate(
                    ['slug' => Str::slug($childName)],
                    [
                        'parent_id' => $parent->id,
                        'name' => json_encode(['ru' => $childName], JSON_UNESCAPED_UNICODE),
                        'slug' => Str::slug($childName),
                        'is_active' => true,
                        'sort_order' => $i,
                    ]
                );
                $result[$childName] = $child;
            }
        }

        $this->line('    ✓ ' . count($result) . ' categories created');
        return $result;
    }

    /**
     * @return array<string, Brand>
     */
    private function createBrands(): array
    {
        $this->line('  → Creating brands...');
        $result = [];

        foreach (self::BRANDS as $brandName) {
            $brand = Brand::query()->firstOrCreate(
                ['slug' => Str::slug($brandName)],
                [
                    'name' => json_encode(['ru' => $brandName], JSON_UNESCAPED_UNICODE),
                    'slug' => Str::slug($brandName),
                    'is_active' => true,
                ]
            );
            $result[$brandName] = $brand;
        }

        $this->line('    ✓ ' . count($result) . ' brands created');
        return $result;
    }

    /**
     * @return array<string, Attribute>
     */
    private function createAttributes(): array
    {
        $this->line('  → Creating attributes...');
        $result = [];

        foreach (self::ATTRIBUTE_POOL as $name => $values) {
            $attr = Attribute::query()->firstOrCreate(
                ['slug' => Str::slug($name)],
                [
                    'name' => $name,
                    'slug' => Str::slug($name),
                    'is_filterable' => in_array($name, [
                        'Цвет', 'Материал каркаса', 'Материал обивки',
                        'Стиль', 'Жёсткость', 'Механизм трансформации',
                    ]),
                ]
            );
            $result[$name] = $attr;
        }

        $this->line('    ✓ ' . count($result) . ' attributes created');
        return $result;
    }

    /**
     * @param  array<string, Category>  $categories
     * @param  array<string, Brand>     $brands
     * @param  array<string, Attribute> $attributes
     */
    private function populateProduct(
        Product $product,
        array $categories,
        array $brands,
        array $attributes,
    ): void {
        $name = mb_strtolower($product->getTranslation('name', 'ru', false) ?: ($product->name ?? ''));

        // ─── Assign category ────────────────────────────────────────
        if ($product->category_id === null) {
            $category = $this->matchCategory($name, $categories);
            if ($category !== null) {
                $product->category_id = $category->id;
            }
        }

        // ─── Assign brand ───────────────────────────────────────────
        if ($product->brand_id === null) {
            $brand = $this->matchBrand($name, $brands);
            $product->brand_id = $brand->id;
        }

        // ─── Populate structured attributes ─────────────────────────
        $relevantAttrs = $this->getRelevantAttributes($name);
        $erpAttributes = $product->attributes ?? [];

        foreach ($relevantAttrs as $attrName) {
            if (! isset($attributes[$attrName])) {
                continue;
            }

            $attr = $attributes[$attrName];

            // Skip if already has a value for this attribute
            $exists = AttributeValue::query()
                ->where('product_id', $product->id)
                ->where('attribute_id', $attr->id)
                ->exists();

            if ($exists) {
                continue;
            }

            // Try to use the ERP attribute if it matches
            $value = $this->resolveAttributeValue($attrName, $erpAttributes, $name, $product);

            if ($value !== null) {
                AttributeValue::query()->create([
                    'product_id' => $product->id,
                    'attribute_id' => $attr->id,
                    'value' => $value,
                ]);
            }
        }

        // ─── Fill missing prices if needed ──────────────────────────
        if ($product->retail_price === null || $product->retail_price === 0) {
            $product->retail_price = $this->generateRealisticPrice($name);
        }

        $product->saveQuietly();
    }

    /**
     * @param  array<string, Category>  $categories
     */
    private function matchCategory(string $name, array $categories): ?Category
    {
        // Try to match by keywords in the product name
        $keywords = [
            'диван' => 'Диваны',
            'софа' => 'Диваны',
            'кровать' => 'Кровати',
            'кроват' => 'Кровати',
            'шкаф' => 'Шкафы',
            'гардероб' => 'Шкафы',
            'стол' => 'Столы',
            'парта' => 'Столы',
            'стул' => 'Стулья и кресла',
            'кресло' => 'Стулья и кресла',
            'табурет' => 'Стулья и кресла',
            'комод' => 'Комоды и тумбы',
            'тумб' => 'Комоды и тумбы',
            'пуф' => 'Мягкая мебель',
            'банкетк' => 'Мягкая мебель',
            'кушетк' => 'Мягкая мебель',
            'детск' => 'Детская мебель',
            'кухн' => 'Кухонная мебель',
            'вешалк' => 'Прихожая',
            'обувниц' => 'Прихожая',
            'зеркал' => 'Прихожая',
            'матрас' => 'Матрасы',
            'топпер' => 'Матрасы',
            'подушк' => 'Аксессуары',
            'плед' => 'Аксессуары',
            'светильник' => 'Аксессуары',
            'полк' => 'Шкафы',
            'стеллаж' => 'Шкафы',
        ];

        foreach ($keywords as $keyword => $categoryName) {
            if (mb_strpos($name, $keyword) !== false) {
                // Try to find a matching subcategory first
                $subCategories = self::CATEGORY_MAP[$categoryName] ?? [];
                foreach ($subCategories as $subName) {
                    $subKey = mb_strtolower($subName);
                    foreach (explode(' ', $subKey) as $word) {
                        if (mb_strlen($word) > 3 && mb_strpos($name, $word) !== false) {
                            return $categories[$subName] ?? $categories[$categoryName] ?? null;
                        }
                    }
                }
                return $categories[$categoryName] ?? null;
            }
        }

        // Fallback: assign to first available category
        $keys = array_keys(self::CATEGORY_MAP);
        $randomParent = $keys[array_rand($keys)];
        return $categories[$randomParent] ?? null;
    }

    /**
     * @param  array<string, Brand>  $brands
     */
    private function matchBrand(string $name, array $brands): Brand
    {
        // Check if brand name appears in product name
        foreach ($brands as $brandName => $brand) {
            if (mb_stripos($name, mb_strtolower($brandName)) !== false) {
                return $brand;
            }
        }

        // Use a deterministic but varied brand assignment based on product name hash
        $brandList = array_values($brands);
        $index = crc32($name) % count($brandList);
        return $brandList[abs($index)];
    }

    /**
     * Get the list of relevant attribute names for a product based on its name.
     *
     * @return list<string>
     */
    private function getRelevantAttributes(string $name): array
    {
        foreach (self::KEYWORD_ATTRIBUTES as $keyword => $attrs) {
            if (mb_strpos($name, $keyword) !== false) {
                // Always add country
                return array_unique([...$attrs, 'Страна производства']);
            }
        }

        return self::DEFAULT_ATTRIBUTES;
    }

    /**
     * Resolve the value for an attribute, either from ERP data or by
     * generating a realistic value.
     *
     * @param  array<string, scalar|null>  $erpAttributes
     */
    private function resolveAttributeValue(
        string $attrName,
        array $erpAttributes,
        string $productName,
        Product $product,
    ): ?string {
        // 1) Try exact match from ERP attributes
        if (isset($erpAttributes[$attrName]) && $erpAttributes[$attrName] !== null) {
            return (string) $erpAttributes[$attrName];
        }

        // 2) Try fuzzy match from ERP attributes
        foreach ($erpAttributes as $erpName => $erpValue) {
            if ($erpValue === null) {
                continue;
            }
            // e.g., "Цвет корпуса" matches "Цвет"
            if (mb_stripos($erpName, mb_substr($attrName, 0, 4)) !== false) {
                return (string) $erpValue;
            }
        }

        // 3) Special cases: derive from product data
        if ($attrName === 'Страна производства' && $product->country !== null) {
            return $product->country;
        }

        // 4) Generate realistic value deterministically
        $pool = self::ATTRIBUTE_POOL[$attrName] ?? null;
        if ($pool === null || $pool === []) {
            return null;
        }

        // Use product name + attribute name as seed for deterministic randomness
        $seed = crc32($productName . $attrName);
        $index = abs($seed) % count($pool);

        return $pool[$index];
    }

    /**
     * Generate a realistic price in kopecks based on the product type.
     * (Only used as fallback when MoySklad doesn't provide a price.)
     */
    private function generateRealisticPrice(string $name): int
    {
        $ranges = [
            'диван' => [15_000_000, 85_000_000],   // 150,000 – 850,000 тг
            'кровать' => [12_000_000, 65_000_000],  // 120,000 – 650,000 тг
            'шкаф' => [10_000_000, 55_000_000],     // 100,000 – 550,000 тг
            'стол' => [5_000_000, 35_000_000],      // 50,000 – 350,000 тг
            'стул' => [3_000_000, 15_000_000],      // 30,000 – 150,000 тг
            'кресло' => [8_000_000, 45_000_000],    // 80,000 – 450,000 тг
            'комод' => [8_000_000, 35_000_000],     // 80,000 – 350,000 тг
            'тумб' => [4_000_000, 18_000_000],      // 40,000 – 180,000 тг
            'матрас' => [10_000_000, 55_000_000],   // 100,000 – 550,000 тг
            'пуф' => [3_000_000, 12_000_000],       // 30,000 – 120,000 тг
        ];

        foreach ($ranges as $keyword => [$min, $max]) {
            if (mb_strpos($name, $keyword) !== false) {
                $seed = crc32($name);
                return $min + abs($seed) % ($max - $min);
            }
        }

        // Default range for unrecognized items
        $seed = crc32($name);
        return 5_000_000 + abs($seed) % 40_000_000; // 50,000 – 450,000 тг
    }
}
