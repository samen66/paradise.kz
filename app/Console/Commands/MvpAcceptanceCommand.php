<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Actions\ApproveClient;
use App\Jobs\SendWhatsAppNotificationJob;
use App\Models\CatalogSetting;
use App\Models\Category;
use App\Models\GoodsReceipt;
use App\Models\Order;
use App\Models\PriceType;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\StockMovement;
use App\Models\Store;
use App\Models\User;
use App\Services\Inventory\GoodsReceiptService;
use Illuminate\Console\Command;
use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Throwable;

/**
 * The five MVP acceptance scenarios of docs/acceptance-checklist.md, run end to
 * end as one command.
 *
 * WHY THE REQUESTS GO THROUGH THE ROUTER. Wherever the checklist clicks through
 * a front-end, this command sends a real request through the full HTTP stack —
 * routing, middleware, form requests, controllers — via the HTTP kernel, with
 * no web server in the way. Calling the services directly instead would prove
 * strictly less than the manual walkthrough does: it would skip the auth,
 * approval and role gates, the validation layer and the JSON shape the
 * front-ends actually consume. `--url` swaps that for real HTTP against a
 * deployed stand (see {@see send()}).
 *
 * WHAT IT WRITES. Everything: a product, a posted goods receipt, orders, stock
 * movements, users. That is the point — the checklist is about data really
 * moving — and it is also why the command refuses to start outside
 * local/testing without `--force`, and why every row it creates is stamped with
 * the ACC- / @acceptance.invalid markers so it can be found again afterwards.
 *
 * WHAT IT CANNOT PROVE. Three known regressions get named explicitly when they
 * come back (steps 10, 18, 23) — see {@see REGRESSIONS}. Everything else is
 * reported as a plain expected/actual mismatch.
 */
class MvpAcceptanceCommand extends Command
{
    protected $signature = 'mvp:acceptance
        {--url= : Бить реальным HTTP по этому адресу (корень API, без /api) вместо внутреннего роутинга}
        {--fresh : Пересоздать базу (migrate:fresh --seed) перед прогоном — рекомендуемый способ запуска}
        {--fixtures= : Записать в JSON то, что осталось после прогона (товар, клиент, заказы) — этим файлом кормятся браузерные тесты. Без значения: storage/app/private/acceptance-fixtures.json}
        {--force : Разрешить запуск вне окружений local/testing}
        {--stop-on-failure : Остановиться на первом провалившемся шаге}';

    protected $description = 'Прогнать пять сценариев приёмки MVP (docs/acceptance-checklist.md) и напечатать отчёт';

    /** Окружения, в которых прогон разрешён без --force. */
    private const SAFE_ENVIRONMENTS = ['local', 'testing'];

    /** Количества стоят в 3 знаках после запятой — сравниваем с полумиллиединичным допуском. */
    private const EPSILON = 0.0005;

    private const RECEIPT_QTY = 10.0;

    private const RETAIL_ORDER_QTY = 3.0;

    private const B2B_ORDER_QTY = 2.0;

    private const ACCOUNT_ORDER_QTY = 1.0;

    /** Цены товара в тенге — их отправляет админка, API переводит в тиын. */
    private const RETAIL_PRICE_MAJOR = 250000;

    private const B2B_PRICE_MAJOR = 200000;

    /** Себестоимость приёмки в тиын. Намеренно отличается от обеих цен продажи — на этом стоит шаг 23. */
    private const RECEIPT_UNIT_COST = 15_000_000;

    /**
     * Товары, которые прогон заводит только под --fixtures — для браузерных
     * тестов. Товар «в наличии» браузер только разглядывает, поэтому его
     * остаток на экране обязан быть ровно этим числом. Товар «для заказа»
     * браузер покупает: остатка хватает на сотню повторных запусков Playwright
     * поверх одного прогона.
     *
     * @var array<string, array{title: string, qty: float}>
     */
    private const BROWSER_PRODUCTS = [
        'in_stock' => ['title' => 'Кресло в наличии', 'qty' => 7.0],
        'checkout' => ['title' => 'Стол для заказа', 'qty' => 500.0],
    ];

    /**
     * Сколько номеров прогон может занять: по одному на B2B-клиента, розничного
     * покупателя, телефон магазина и каждого гостя (у гостевого чекаута своя
     * одноразовая учётка, а users.phone — уникальный).
     */
    private const PHONES_PER_RUN = 10;

    /**
     * Поломки, которые уже чинили. Если шаг падает — отчёт называет, что именно вернулось,
     * а не просто «ожидали X, получили Y».
     *
     * @var array<int, string>
     */
    private const REGRESSIONS = [
        10 => 'вернулся push заказа во внешнюю учётную систему. У гостя нет контрагента, '
            .'поэтому заказ переворачивается в failed через секунды после оформления. '
            .'Смотреть: Api\Public\CheckoutController, App\Services\Local\LocalErpProvider.',
        18 => 'одобрение B2B-клиента снова упирается во внешнюю учётную систему '
            .'(«Внешняя учётная система не подключена»). Смотреть: App\Actions\ApproveClient, '
            .'App\Contracts\Erp\OrderTarget::supportsCounterparties().',
        23 => 'возврат при отмене пишется по цене продажи, а не по себестоимости партии. '
            .'Остаток сойдётся, а маржа поедет молча. '
            .'Смотреть: App\Services\Orders\OrderCancellationService::restoreStock().',
    ];

    /** @var list<array{n: int, title: string, status: string, expected: ?string, actual: ?string, blocked: bool}> */
    private array $results = [];

    /** @var list<string> */
    private array $leftovers = [];

    /** @var list<array{section?: string, title?: string, run?: callable(): mixed, critical?: bool}>|null */
    private ?array $cachedPlan = null;

    private ?int $abortedAt = null;

    private string $abortReason = '';

    private Carbon $startedAt;

    /** Метка прогона: попадает в артикул, имена и e-mail всех созданных строк. */
    private string $runToken;

    private Store $store;

    private User $admin;

    private string $adminToken;

    /** Пароль служебного админа прогона. Случайный, но записываемый: по нему заходят браузерные тесты. */
    private string $adminPassword;

    private Category $category;

    private int $productId;

    private string $productSlug = '';

    private int $phoneBase;

    private int $phonesTaken = 0;

    private string $guestPhone;

    private string $b2bPhone;

    private string $b2bPassword;

    private string $b2bEmail;

    private string $retailPhone;

    private int $retailOrderId;

    private string $retailOrderNumber = '';

    private User $b2bUser;

    private string $b2bToken;

    private int $b2bOrderId;

    private string $retailUserToken;

    private int $accountOrderId;

    /** Заказ на выкуп всего остатка. Единственный, кто остаётся в pending, — на нём браузер гоняет статусы. */
    private int $buyoutOrderId;

    /** @var array<string, int> Товары для браузера по ролям из BROWSER_PRODUCTS => id. */
    private array $browserProductIds = [];

    /** Куда легли фикстуры прогона; печатается в отчёте. */
    private ?string $writtenFixturesPath = null;

    public function handle(): int
    {
        if (! $this->environmentAllowsRun()) {
            return self::FAILURE;
        }

        if ($this->option('fresh') && ! $this->rebuildDatabase()) {
            return self::FAILURE;
        }

        $this->startedAt = Carbon::now();
        $this->prepareRunIdentifiers();
        $this->printHeader();

        // Ничего наружу. Очередь подменяется на фейковую, чтобы прогон не разослал
        // реальные WhatsApp-уведомления и не сбросил кэш боевой витрины; шаг 12
        // читает диспатч из этого же фейка. В режиме --url запросы уходят в чужой
        // процесс, подменять там нечего — очередь остаётся настоящей.
        $originalQueue = $this->laravel->make('queue');
        $originalRequest = $this->laravel->bound('request') ? $this->laravel->make('request') : null;

        if (! $this->isRemote()) {
            Queue::fake();
        }

        try {
            $this->runPlan();
        } finally {
            Queue::swap($originalQueue);
            Auth::forgetGuards();

            if ($originalRequest !== null) {
                $this->laravel->instance('request', $originalRequest);
                Facade::clearResolvedInstance('request');
            }
        }

        $this->writeFixtures();

        return $this->report();
    }

    /**
     * Прогон создаёт и меняет реальные данные в текущей базе, поэтому вне
     * local/testing он по умолчанию отказывается стартовать.
     */
    private function environmentAllowsRun(): bool
    {
        $environment = (string) $this->laravel->environment();

        if (in_array($environment, self::SAFE_ENVIRONMENTS, true) || $this->option('force')) {
            return true;
        }

        $this->newLine();
        $this->error("Окружение «{$environment}» — прогон отменён.");
        $this->line('  Команда заводит товар, проводит приёмку, оформляет и отменяет заказы, двигает');
        $this->line('  остатки. Это нормально на '.implode('/', self::SAFE_ENVIRONMENTS).', и недопустимо на проде:');
        $this->line('  в каталоге останется тестовый товар, в заказах — тестовые заказы, в журнале склада — движения.');
        $this->newLine();
        $this->line('  Если база всё-таки одноразовая — повторите с <options=bold>--force</>.');
        $this->newLine();

        return false;
    }

    private function rebuildDatabase(): bool
    {
        $connection = (string) config('database.default');
        $database = (string) config("database.connections.{$connection}.database");

        if ($this->input->isInteractive()
            && ! $this->confirm("migrate:fresh --seed сотрёт всё в базе «{$database}» (подключение «{$connection}»). Продолжить?", false)) {
            $this->warn('Отменено.');

            return false;
        }

        $this->call('migrate:fresh', ['--seed' => true, '--force' => true]);

        // migrate:fresh пересоздал таблицы ролей под уже прогретым реестром прав.
        $this->laravel->make(PermissionRegistrar::class)->forgetCachedPermissions();

        return true;
    }

    private function prepareRunIdentifiers(): void
    {
        $this->runToken = $this->startedAt->format('ymdHis').'-'.Str::lower(Str::random(4));

        $this->phoneBase = $this->pickFreePhoneBase();
        $this->guestPhone = $this->nextTestPhone();
        $this->b2bPhone = $this->nextTestPhone();
        $this->retailPhone = $this->nextTestPhone();
        $this->b2bPassword = 'acceptance-'.Str::random(12);
        $this->b2bEmail = "acc-b2b-{$this->runToken}@acceptance.invalid";
        $this->adminPassword = 'acceptance-'.Str::random(12);
    }

    private function pickFreePhoneBase(): int
    {
        for ($attempt = 0; $attempt < 20; $attempt++) {
            $base = random_int(0, 99_999 - self::PHONES_PER_RUN);

            $candidates = array_map(
                fn (int $offset): string => $this->testPhone($base + $offset),
                range(0, self::PHONES_PER_RUN - 1),
            );

            if (! User::query()->whereIn('phone', $candidates)->exists()) {
                return $base;
            }
        }

        return random_int(0, 99_999 - self::PHONES_PER_RUN);
    }

    private function nextTestPhone(): string
    {
        return $this->testPhone($this->phoneBase + $this->phonesTaken++);
    }

    /**
     * +7 700 00X XXXX. В Казахстане этот блок не выделен ни одному оператору,
     * так что номер заведомо никому не принадлежит, и при этом устойчив к
     * Phone::normalize (11 цифр с ведущей семёркой нормализуются сами в себя).
     */
    private function testPhone(int $suffix): string
    {
        return '+770000'.str_pad((string) $suffix, 5, '0', STR_PAD_LEFT);
    }

    private function printHeader(): void
    {
        $this->newLine();
        $this->line('  <options=bold>Приёмка MVP</> — docs/acceptance-checklist.md');

        $this->line($this->isRemote()
            ? '  Режим: реальный HTTP -> '.$this->remoteBaseUrl()
            : '  Режим: внутренний роутинг (полный стек middleware, без веб-сервера)');

        $connection = (string) config('database.default');
        $this->line(sprintf('  База: %s (%s)', $connection, (string) config("database.connections.{$connection}.database")));

        if ($this->isRemote()) {
            $this->line('  <comment>Проверки в базе (остатки, движения, целостность) и шаги 5 и 18 идут по ЛОКАЛЬНОМУ</comment>');
            $this->line('  <comment>подключению — оно должно указывать на ту же базу, что и стенд.</comment>');
        }

        if (! $this->option('fresh')) {
            $this->line('  <comment>Без --fresh: прогон идёт поверх текущих данных и оставит после себя тестовые строки.</comment>');
        }

        $this->newLine();
    }

    private function runPlan(): void
    {
        $number = 0;

        foreach ($this->plan() as $item) {
            if (isset($item['section'])) {
                $this->newLine();
                $this->line('  <options=bold>'.$item['section'].'</>');

                continue;
            }

            $number++;
            $outcome = $this->runStep($item['run']);
            $status = $this->record($number, $item['title'], $outcome);

            if ($status !== 'fail') {
                continue;
            }

            if ($item['critical'] ?? false) {
                $this->abortedAt = $number;
                $this->abortReason = 'без него остальные шаги нечего проверять';

                return;
            }

            if ($this->option('stop-on-failure')) {
                $this->abortedAt = $number;
                $this->abortReason = 'передан --stop-on-failure';

                return;
            }
        }
    }

    /**
     * @param  callable(): mixed  $run
     * @return true|array<string, string>
     */
    private function runStep(callable $run): true|array
    {
        try {
            $outcome = $run();
        } catch (Throwable $e) {
            return $this->mismatch('шаг отрабатывает без исключения', $e::class.': '.$e->getMessage());
        }

        return $outcome === true ? true : (array) $outcome;
    }

    /**
     * @param  true|array<string, string>  $outcome
     */
    private function record(int $number, string $title, true|array $outcome): string
    {
        [$status, $expected, $actual] = match (true) {
            $outcome === true => ['pass', null, null],
            isset($outcome['skip']) => ['skip', null, (string) $outcome['skip']],
            default => ['fail', (string) ($outcome['expected'] ?? ''), (string) ($outcome['actual'] ?? '')],
        };

        // Шаг, до проверки которого прогон не добрался, — тоже провал, но
        // называть при нём известный регресс нельзя: проверка не состоялась.
        $blocked = is_array($outcome) && isset($outcome['blocked']);

        $this->results[] = compact('title', 'status', 'expected', 'actual', 'blocked') + ['n' => $number];

        $mark = match ($status) {
            'pass' => '<fg=green>✓</>',
            'skip' => '<fg=yellow>○</>',
            default => '<fg=red>✗</>',
        };

        $this->line(sprintf('  %s %02d. %s', $mark, $number, $title));

        return $status;
    }

    // ------------------------------------------------------------------
    // План: каждый пункт чеклиста — одна строка отчёта
    // ------------------------------------------------------------------

    /**
     * @return list<array{section?: string, title?: string, run?: callable(): mixed, critical?: bool}>
     */
    private function plan(): array
    {
        return $this->cachedPlan ??= [
            ['section' => 'ПОДГОТОВКА'],
            ...$this->preparationSteps(),
            ['section' => 'СЦЕНАРИЙ 1 — товар доезжает до витрины'],
            ...$this->catalogSteps(),
            ['section' => 'СЦЕНАРИЙ 2 — B2C-заказ'],
            ...$this->retailOrderSteps(),
            ['section' => 'СЦЕНАРИЙ 3 — B2B'],
            ...$this->b2bSteps(),
            ['section' => 'СЦЕНАРИЙ 4 — отмена возвращает остаток'],
            ...$this->cancellationSteps(),
            ['section' => 'СЦЕНАРИЙ 5 — распроданный товар'],
            ...$this->soldOutSteps(),
            ...($this->fixturesPath() === null ? [] : [
                ['section' => 'ДЛЯ БРАУЗЕРНЫХ ТЕСТОВ (--fixtures)'],
                ...$this->browserProductSteps(),
            ]),
            ['section' => 'ЦЕЛОСТНОСТЬ'],
            ...$this->integritySteps(),
        ];
    }

    /**
     * @return list<array{title: string, run: callable(): mixed, critical?: bool}>
     */
    private function preparationSteps(): array
    {
        return [
            [
                'title' => 'Активный склад, роли admin/manager/b2b_customer, типы цен retail и b2b',
                'critical' => true,
                'run' => function (): true|array {
                    $problems = [];

                    $store = Store::query()->where('is_active', true)
                        ->orderByDesc('is_default')->orderBy('id')->first();

                    if ($store === null) {
                        $problems[] = 'нет ни одного активного склада';
                    } else {
                        $this->store = $store;
                    }

                    $wantedRoles = ['admin', 'manager', 'b2b_customer'];
                    $missingRoles = array_diff($wantedRoles, Role::query()->whereIn('name', $wantedRoles)->pluck('name')->all());

                    if ($missingRoles !== []) {
                        $problems[] = 'нет ролей: '.implode(', ', $missingRoles);
                    }

                    $wantedTypes = ['retail', 'b2b'];
                    $missingTypes = array_diff($wantedTypes, PriceType::query()->whereIn('code', $wantedTypes)->pluck('code')->all());

                    if ($missingTypes !== []) {
                        $problems[] = 'нет типов цен: '.implode(', ', $missingTypes);
                    }

                    return $problems === []
                        ? true
                        : $this->mismatch(
                            'склад, роли и типы цен на месте',
                            implode('; ', $problems).' — запустите с --fresh или выполните `php artisan db:seed`',
                        );
                },
            ],
        ];
    }

    /**
     * @return list<array{title: string, run: callable(): mixed, critical?: bool}>
     */
    private function catalogSteps(): array
    {
        return [
            [
                'title' => 'POST /api/admin/products заводит товар с категорией и двумя ценами',
                'critical' => true,
                'run' => function (): true|array {
                    $this->createStaffAndCategory();

                    $response = $this->send('POST', '/api/admin/products', [
                        'name' => ['ru' => "ACC Диван приёмки {$this->runToken}"],
                        'category_id' => $this->category->id,
                        'code' => $this->marker(),
                        'article' => $this->marker(),
                        'retail_price' => self::RETAIL_PRICE_MAJOR,
                        'b2b_price' => self::B2B_PRICE_MAJOR,
                        'is_active' => true,
                    ], $this->adminToken);

                    if ($response['status'] !== 201) {
                        return $this->mismatch('HTTP 201', $this->summarize($response));
                    }

                    $id = data_get($response['json'], 'data.id');

                    if (! is_numeric($id)) {
                        return $this->mismatch('в ответе есть data.id', $this->summarize($response));
                    }

                    $this->productId = (int) $id;
                    $this->leftovers[] = "товар #{$this->productId}, артикул {$this->marker()}";

                    $product = Product::query()->find($this->productId);

                    if ($product === null) {
                        return $this->mismatch('товар сохранён в базе', "товара #{$this->productId} нет в products");
                    }

                    $actual = [];

                    if ($product->getTranslation('name', 'ru', false) === '') {
                        $actual[] = 'пустое название (ru)';
                    }

                    if ($product->category_id !== $this->category->id) {
                        $actual[] = 'category_id = '.var_export($product->category_id, true);
                    }

                    if ((int) $product->retail_price !== self::RETAIL_PRICE_MAJOR * 100) {
                        $actual[] = 'retail_price = '.var_export($product->retail_price, true).' тиын';
                    }

                    if ((int) $product->b2b_price !== self::B2B_PRICE_MAJOR * 100) {
                        $actual[] = 'b2b_price = '.var_export($product->b2b_price, true).' тиын';
                    }

                    return $actual === []
                        ? true
                        : $this->mismatch(
                            sprintf(
                                'название, категория #%d, retail %d тиын, b2b %d тиын',
                                $this->category->id,
                                self::RETAIL_PRICE_MAJOR * 100,
                                self::B2B_PRICE_MAJOR * 100,
                            ),
                            implode('; ', $actual),
                        );
                },
            ],
            [
                'title' => 'Product::booted() проставил slug',
                'run' => function (): true|array {
                    $slug = (string) (Product::query()->whereKey($this->productId)->value('slug') ?? '');

                    if ($slug === '') {
                        return $this->mismatch(
                            'непустой products.slug',
                            'slug пуст — без него карточка на витрине не открывается (/product/{slug})',
                        );
                    }

                    $this->productSlug = $slug;

                    return true;
                },
            ],
            [
                'title' => 'GET /api/admin/products помечает товар issue «out_of_stock»',
                'run' => function (): true|array {
                    $response = $this->send('GET', '/api/admin/products?filter[search]='.rawurlencode($this->marker()), null, $this->adminToken);

                    if ($response['status'] !== 200) {
                        return $this->mismatch('HTTP 200', $this->summarize($response));
                    }

                    $row = collect((array) data_get($response['json'], 'data', []))
                        ->first(fn (mixed $item): bool => (int) data_get($item, 'id') === $this->productId);

                    if ($row === null) {
                        return $this->mismatch('товар в выдаче', 'товара нет в ответе админского списка');
                    }

                    $issues = (array) data_get($row, 'issues', []);

                    return in_array('out_of_stock', $issues, true)
                        ? true
                        : $this->mismatch(
                            'issues содержит out_of_stock (бейдж «Нет остатка»)',
                            'issues = '.($issues === [] ? '[]' : implode(', ', $issues)),
                        );
                },
            ],
            [
                'title' => 'Приёмка на 10 шт проведена через GoodsReceiptService',
                'critical' => true,
                'run' => function (): true|array {
                    $receipt = GoodsReceipt::query()->create([
                        'store_id' => $this->store->id,
                        'number' => $this->marker(),
                        'status' => GoodsReceipt::STATUS_DRAFT,
                        'received_at' => now(),
                        'note' => 'Приёмка приёмки MVP',
                        'user_id' => $this->admin->id,
                    ]);

                    $receipt->items()->create([
                        'product_id' => $this->productId,
                        'quantity' => self::RECEIPT_QTY,
                        'unit_cost' => self::RECEIPT_UNIT_COST,
                    ]);

                    $this->leftovers[] = "приёмка #{$receipt->id} (проведена, ".$this->qty(self::RECEIPT_QTY).' шт)';

                    $this->laravel->make(GoodsReceiptService::class)->post($receipt, $this->admin);

                    return $receipt->refresh()->isPosted()
                        ? true
                        : $this->mismatch('приёмка в статусе posted', 'статус = '.(string) $receipt->status);
                },
            ],
            [
                'title' => 'products.stock = 10 и product_store_stock.stock = 10',
                'run' => fn (): true|array => $this->assertStock(self::RECEIPT_QTY),
            ],
            [
                'title' => 'GET /api/public/products отдаёт товар с in_stock: true',
                'run' => fn (): true|array => $this->assertPublicInStock(true),
            ],
            [
                'title' => 'GET /api/public/products/{slug} открывается',
                'run' => function (): true|array {
                    if ($this->productSlug === '') {
                        return $this->mismatch('HTTP 200 по slug', 'slug не проставился — проверять нечего (см. шаг 3)');
                    }

                    $response = $this->send('GET', '/api/public/products/'.rawurlencode($this->productSlug));

                    return $response['status'] === 200
                        ? true
                        : $this->mismatch("HTTP 200 на /api/public/products/{$this->productSlug}", $this->summarize($response));
                },
            ],
        ];
    }

    /**
     * @return list<array{title: string, run: callable(): mixed, critical?: bool}>
     */
    private function retailOrderSteps(): array
    {
        return [
            [
                'title' => 'POST /api/public/checkout на 3 шт -> 201, номер вида P-XXXXXX',
                'run' => function (): true|array {
                    // Уведомление менеджеру (шаг 12) шлётся только если в настройках
                    // каталога есть телефон магазина — на чистой базе он пуст.
                    $this->ensureShopContactPhone();

                    $response = $this->send('POST', '/api/public/checkout', [
                        'name' => "ACC Покупатель {$this->runToken}",
                        'phone' => $this->guestPhone,
                        'email' => "acc-guest-{$this->runToken}@acceptance.invalid",
                        'payment_method' => 'cash',
                        'store_id' => $this->store->id,
                        'items' => [['product_id' => $this->productId, 'quantity' => self::RETAIL_ORDER_QTY]],
                    ]);

                    if ($response['status'] !== 201) {
                        return $this->mismatch('HTTP 201', $this->summarize($response));
                    }

                    $this->retailOrderId = (int) data_get($response['json'], 'data.id');
                    $this->retailOrderNumber = (string) data_get($response['json'], 'data.number');
                    $this->leftovers[] = "B2C-заказ #{$this->retailOrderId} ({$this->retailOrderNumber}), гость {$this->guestPhone}";

                    return preg_match('/^P-\d{6}$/', $this->retailOrderNumber) === 1
                        ? true
                        : $this->mismatch('номер вида P-XXXXXX', 'number = '.($this->retailOrderNumber === '' ? 'null' : $this->retailOrderNumber));
                },
            ],
            [
                'title' => 'Новый заказ в статусе pending (не failed)',
                'run' => function (): true|array {
                    if (! isset($this->retailOrderId)) {
                        return $this->nothingToCheck('status = pending', 'B2C-заказ не оформился (шаг 9)');
                    }

                    $status = (string) (Order::query()->whereKey($this->retailOrderId)->value('status') ?? '');

                    return $status === Order::STATUS_PENDING
                        ? true
                        : $this->mismatch('status = pending', 'status = '.($status === '' ? 'заказ не найден' : $status));
                },
            ],
            [
                'title' => 'Остаток стал 7 и 7',
                'run' => fn (): true|array => $this->assertStock(self::RECEIPT_QTY - self::RETAIL_ORDER_QTY),
            ],
            [
                'title' => 'Менеджеру задиспатчено уведомление о новом заказе',
                'run' => fn (): true|array => isset($this->retailOrderId)
                    ? $this->assertManagerNotified()
                    : $this->nothingToCheck('уведомление менеджеру о новом заказе', 'B2C-заказ не оформился (шаг 9)'),
            ],
            [
                'title' => 'PUT /api/admin/orders/{id}: confirmed -> in_delivery -> completed',
                'run' => function (): true|array {
                    if (! isset($this->retailOrderId)) {
                        return $this->nothingToCheck('цепочка статусов заказа', 'B2C-заказ не оформился (шаг 9)');
                    }

                    foreach ([Order::STATUS_CONFIRMED, Order::STATUS_IN_DELIVERY, Order::STATUS_COMPLETED] as $status) {
                        $response = $this->send('PUT', "/api/admin/orders/{$this->retailOrderId}", ['status' => $status], $this->adminToken);

                        if ($response['status'] !== 200) {
                            return $this->mismatch("HTTP 200 на переводе в {$status}", $this->summarize($response));
                        }

                        $stored = (string) (Order::query()->whereKey($this->retailOrderId)->value('status') ?? '');

                        if ($stored !== $status) {
                            return $this->mismatch("status = {$status}", "status = {$stored}");
                        }
                    }

                    return true;
                },
            ],
            [
                'title' => 'PUT со статусом synced или failed -> 422',
                'run' => function (): true|array {
                    if (! isset($this->retailOrderId)) {
                        return $this->nothingToCheck('отказ на легаси-статусы', 'B2C-заказ не оформился (шаг 9)');
                    }

                    foreach ([Order::STATUS_SYNCED, Order::STATUS_FAILED] as $legacy) {
                        $response = $this->send('PUT', "/api/admin/orders/{$this->retailOrderId}", ['status' => $legacy], $this->adminToken);

                        if ($response['status'] !== 422) {
                            return $this->mismatch(
                                "HTTP 422 на попытке назначить легаси-статус «{$legacy}»",
                                $this->summarize($response),
                            );
                        }
                    }

                    return true;
                },
            ],
            [
                'title' => 'GET /api/public/orders/track находит заказ по номеру и телефону',
                'run' => function (): true|array {
                    if ($this->retailOrderNumber === '') {
                        return $this->nothingToCheck('заказ находится по номеру и телефону', 'B2C-заказ не оформился (шаг 9)');
                    }

                    $response = $this->send('GET', '/api/public/orders/track?'.http_build_query([
                        'number' => $this->retailOrderNumber,
                        'phone' => $this->guestPhone,
                    ]));

                    if ($response['status'] !== 200) {
                        return $this->mismatch('HTTP 200', $this->summarize($response));
                    }

                    $number = (string) data_get($response['json'], 'data.number');

                    return $number === $this->retailOrderNumber
                        ? true
                        : $this->mismatch("найден заказ {$this->retailOrderNumber}", "в ответе number = {$number}");
                },
            ],
        ];
    }

    /**
     * @return list<array{title: string, run: callable(): mixed, critical?: bool}>
     */
    private function b2bSteps(): array
    {
        return [
            [
                'title' => 'POST /api/auth/register заводит B2B-клиента',
                'run' => function (): true|array {
                    $response = $this->send('POST', '/api/auth/register', [
                        'company_name' => "ACC Партнёр {$this->runToken}",
                        'company_bin' => '000000000000',
                        'email' => $this->b2bEmail,
                        'phone' => $this->b2bPhone,
                        'password' => $this->b2bPassword,
                        'password_confirmation' => $this->b2bPassword,
                    ]);

                    if ($response['status'] !== 201) {
                        return $this->mismatch('HTTP 201', $this->summarize($response));
                    }

                    $user = User::query()->where('phone', $this->b2bPhone)->first();

                    if ($user === null) {
                        return $this->mismatch('клиент сохранён в users', "пользователя с телефоном {$this->b2bPhone} нет");
                    }

                    $this->b2bUser = $user;
                    $this->b2bToken = (string) data_get($response['json'], 'token');
                    $this->leftovers[] = "B2B-клиент #{$user->id} ({$user->email}, {$this->b2bPhone})";

                    if ($user->is_approved) {
                        return $this->mismatch('клиент создан неодобренным', 'is_approved = true сразу после регистрации');
                    }

                    return $this->b2bToken !== ''
                        ? true
                        : $this->mismatch('в ответе есть token', 'token пуст');
                },
            ],
            [
                'title' => 'Неодобренный клиент получает 403 на GET /api/products',
                'run' => function (): true|array {
                    if (! isset($this->b2bToken)) {
                        return $this->nothingToCheck('HTTP 403 без одобрения', 'B2B-клиент не зарегистрировался (шаг 16)');
                    }

                    $response = $this->send('GET', '/api/products', null, $this->b2bToken);

                    return $response['status'] === 403
                        ? true
                        : $this->mismatch('HTTP 403 (гейт approved)', $this->summarize($response));
                },
            ],
            [
                'title' => 'ApproveClient::handle() одобряет клиента без исключения',
                'run' => function (): true|array {
                    if (! isset($this->b2bUser)) {
                        return $this->nothingToCheck('клиент одобряется без исключения', 'B2B-клиент не зарегистрировался (шаг 16)');
                    }

                    try {
                        $this->laravel->make(ApproveClient::class)->handle($this->b2bUser->refresh());
                    } catch (Throwable $e) {
                        return $this->mismatch('одобрение проходит без исключения', $e::class.': '.$e->getMessage());
                    }

                    return $this->b2bUser->refresh()->is_approved
                        ? true
                        : $this->mismatch('is_approved = true', 'is_approved = false, хотя исключения не было');
                },
            ],
            [
                'title' => 'POST /api/auth/login по телефону выдаёт токен',
                'run' => function (): true|array {
                    $response = $this->send('POST', '/api/auth/login', [
                        'phone' => $this->b2bPhone,
                        'password' => $this->b2bPassword,
                    ]);

                    if ($response['status'] !== 200) {
                        return $this->mismatch('HTTP 200', $this->summarize($response));
                    }

                    $this->b2bToken = (string) data_get($response['json'], 'token');

                    return $this->b2bToken !== ''
                        ? true
                        : $this->mismatch('в ответе есть token', 'token пуст');
                },
            ],
            [
                'title' => 'GET /api/products отдаёт оптовую цену (b2b_price)',
                'run' => function (): true|array {
                    if (! isset($this->b2bToken)) {
                        return $this->nothingToCheck('оптовая цена в каталоге', 'у B2B-клиента нет токена (шаги 16 и 19)');
                    }

                    $response = $this->send('GET', '/api/products?filter[search]='.rawurlencode($this->marker()), null, $this->b2bToken);

                    if ($response['status'] !== 200) {
                        return $this->mismatch('HTTP 200', $this->summarize($response));
                    }

                    $row = collect((array) data_get($response['json'], 'data', []))
                        ->first(fn (mixed $item): bool => (int) data_get($item, 'id') === $this->productId);

                    if ($row === null) {
                        return $this->mismatch('товар в оптовой выдаче', 'товара нет в ответе — проверьте видимость (каталожные группы)');
                    }

                    $price = (float) data_get($row, 'price');

                    if (abs($price - self::B2B_PRICE_MAJOR) > 0.005) {
                        return $this->mismatch(
                            'price = '.self::B2B_PRICE_MAJOR.' ₸ (оптовая)',
                            'price = '.$price.' ₸'.(abs($price - self::RETAIL_PRICE_MAJOR) <= 0.005 ? ' — это розничная цена' : ''),
                        );
                    }

                    return true;
                },
            ],
            [
                'title' => 'POST /api/orders на 2 шт -> 201, остаток стал 5',
                'run' => function (): true|array {
                    if (! isset($this->b2bToken)) {
                        return $this->nothingToCheck('оптовый заказ', 'у B2B-клиента нет токена (шаги 16 и 19)');
                    }

                    $response = $this->send('POST', '/api/orders', [
                        'store_id' => $this->store->id,
                        'items' => [['product_id' => $this->productId, 'quantity' => self::B2B_ORDER_QTY]],
                    ], $this->b2bToken);

                    if ($response['status'] !== 201) {
                        return $this->mismatch('HTTP 201', $this->summarize($response));
                    }

                    $this->b2bOrderId = (int) data_get($response['json'], 'data.id');
                    $this->leftovers[] = "B2B-заказ #{$this->b2bOrderId} (".(string) data_get($response['json'], 'data.number').')';

                    return $this->assertStock(self::RECEIPT_QTY - self::RETAIL_ORDER_QTY - self::B2B_ORDER_QTY);
                },
            ],
        ];
    }

    /**
     * @return list<array{title: string, run: callable(): mixed, critical?: bool}>
     */
    private function cancellationSteps(): array
    {
        $afterReturn = self::RECEIPT_QTY - self::RETAIL_ORDER_QTY;

        return [
            [
                'title' => 'Отмена B2B-заказа вернула остаток на 7 и 7',
                'run' => function () use ($afterReturn): true|array {
                    if (! isset($this->b2bOrderId)) {
                        return $this->nothingToCheck('возврат остатка при отмене', 'оптовый заказ не создался (шаг 21)');
                    }

                    $response = $this->send('PUT', "/api/admin/orders/{$this->b2bOrderId}", [
                        'status' => Order::STATUS_CANCELLED,
                    ], $this->adminToken);

                    if ($response['status'] !== 200) {
                        return $this->mismatch('HTTP 200', $this->summarize($response));
                    }

                    return $this->assertStock($afterReturn);
                },
            ],
            [
                'title' => 'Возврат записан по себестоимости приёмки, а не по цене продажи',
                'run' => function (): true|array {
                    if (! isset($this->b2bOrderId)) {
                        return $this->nothingToCheck('движение type=return по себестоимости', 'оптовый заказ не создался (шаг 21)');
                    }

                    $return = StockMovement::query()
                        ->where('documentable_type', (new Order)->getMorphClass())
                        ->where('documentable_id', $this->b2bOrderId)
                        ->where('type', StockMovement::TYPE_RETURN)
                        ->first();

                    if ($return === null) {
                        return $this->mismatch(
                            'в stock_movements есть строка type=return по этому заказу',
                            'строки нет — отмена не вернула товар в журнал склада',
                        );
                    }

                    $receiptCost = (int) (StockMovement::query()
                        ->where('product_id', $this->productId)
                        ->where('type', StockMovement::TYPE_RECEIPT)
                        ->orderBy('id')
                        ->value('unit_cost') ?? 0);

                    if ((int) $return->unit_cost === $receiptCost) {
                        return true;
                    }

                    $salePrice = self::B2B_PRICE_MAJOR * 100;

                    return $this->mismatch(
                        "unit_cost возврата = {$receiptCost} тиын (себестоимость приёмки)",
                        'unit_cost = '.(int) $return->unit_cost.' тиын'
                            .((int) $return->unit_cost === $salePrice ? ' — это цена продажи' : ''),
                    );
                },
            ],
            [
                'title' => 'Повторная отмена -> 422, остаток не вырос второй раз',
                'run' => function () use ($afterReturn): true|array {
                    if (! isset($this->b2bOrderId)) {
                        return $this->nothingToCheck('отказ на повторной отмене', 'оптовый заказ не создался (шаг 21)');
                    }

                    $response = $this->send('PUT', "/api/admin/orders/{$this->b2bOrderId}", [
                        'status' => Order::STATUS_CANCELLED,
                    ], $this->adminToken);

                    if ($response['status'] !== 422) {
                        return $this->mismatch('HTTP 422 на повторной отмене', $this->summarize($response));
                    }

                    return $this->assertStock($afterReturn);
                },
            ],
            [
                'title' => 'PATCH /api/account/orders/{id}/cancel тоже возвращает остаток',
                'run' => function () use ($afterReturn): true|array {
                    $this->createRetailCustomer();

                    $placed = $this->send('POST', '/api/public/checkout', [
                        'name' => "ACC Розничный {$this->runToken}",
                        'phone' => $this->retailPhone,
                        'payment_method' => 'cash',
                        'store_id' => $this->store->id,
                        'items' => [['product_id' => $this->productId, 'quantity' => self::ACCOUNT_ORDER_QTY]],
                    ], $this->retailUserToken);

                    if ($placed['status'] !== 201) {
                        return $this->mismatch('HTTP 201 на заказе из кабинета', $this->summarize($placed));
                    }

                    $this->accountOrderId = (int) data_get($placed['json'], 'data.id');
                    $this->leftovers[] = "B2C-заказ из кабинета #{$this->accountOrderId} (отменён)";

                    $beforeCancel = $this->assertStock($afterReturn - self::ACCOUNT_ORDER_QTY);

                    if ($beforeCancel !== true) {
                        return $beforeCancel;
                    }

                    $cancelled = $this->send('PATCH', "/api/account/orders/{$this->accountOrderId}/cancel", null, $this->retailUserToken);

                    if ($cancelled['status'] !== 200) {
                        return $this->mismatch('HTTP 200 на отмене из кабинета', $this->summarize($cancelled));
                    }

                    return $this->assertStock($afterReturn);
                },
            ],
        ];
    }

    /**
     * @return list<array{title: string, run: callable(): mixed, critical?: bool}>
     */
    private function soldOutSteps(): array
    {
        return [
            [
                'title' => 'Весь остаток выкуплен — GET /api/public/products даёт in_stock: false',
                'run' => function (): true|array {
                    $remaining = $this->storeStock();

                    if ($remaining <= 0) {
                        return $this->mismatch('на складе есть что выкупать', 'остаток уже '.$this->qty($remaining));
                    }

                    $response = $this->send('POST', '/api/public/checkout', [
                        'name' => "ACC Выкуп {$this->runToken}",
                        'phone' => $this->nextTestPhone(),
                        'payment_method' => 'cash',
                        'store_id' => $this->store->id,
                        'items' => [['product_id' => $this->productId, 'quantity' => $remaining]],
                    ]);

                    if ($response['status'] !== 201) {
                        return $this->mismatch('HTTP 201 на выкупе всего остатка', $this->summarize($response));
                    }

                    $this->buyoutOrderId = (int) data_get($response['json'], 'data.id');
                    $this->leftovers[] = "B2C-заказ #{$this->buyoutOrderId} ("
                        .(string) data_get($response['json'], 'data.number').', выкуплен весь остаток)';

                    $stock = $this->assertStock(0.0);

                    return $stock === true ? $this->assertPublicInStock(false) : $stock;
                },
            ],
            [
                'title' => 'filter[in_stock]=1 не возвращает распроданный товар',
                'run' => function (): true|array {
                    $response = $this->send('GET', '/api/public/products?'.http_build_query([
                        'filter' => ['search' => $this->marker(), 'in_stock' => 1],
                    ]));

                    if ($response['status'] !== 200) {
                        return $this->mismatch('HTTP 200', $this->summarize($response));
                    }

                    $found = collect((array) data_get($response['json'], 'data', []))
                        ->contains(fn (mixed $item): bool => (int) data_get($item, 'id') === $this->productId);

                    return $found
                        ? $this->mismatch('товара нет в выдаче filter[in_stock]=1', 'товар всё ещё в выдаче «только в наличии»')
                        : true;
                },
            ],
            [
                'title' => 'POST /api/public/checkout на него -> 422 с русским сообщением',
                'run' => function (): true|array {
                    $response = $this->send('POST', '/api/public/checkout', [
                        'name' => "ACC Опоздавший {$this->runToken}",
                        'phone' => $this->nextTestPhone(),
                        'payment_method' => 'cash',
                        'store_id' => $this->store->id,
                        'items' => [['product_id' => $this->productId, 'quantity' => 1]],
                    ]);

                    if ($response['status'] !== 422) {
                        return $this->mismatch('HTTP 422', $this->summarize($response));
                    }

                    $messages = implode(' ', array_map(
                        static fn (mixed $group): string => is_array($group) ? implode(' ', array_map(strval(...), $group)) : (string) $group,
                        (array) data_get($response['json'], 'errors', []),
                    ));

                    return preg_match('/[А-Яа-яЁё]/u', $messages) === 1
                        ? true
                        : $this->mismatch('внятное сообщение на русском', 'errors = '.($messages === '' ? '(пусто)' : $messages));
                },
            ],
            [
                'title' => 'Остаток товара нигде не ушёл в минус',
                'run' => function (): true|array {
                    $aggregate = $this->aggregateStock();
                    $perStore = ProductStoreStock::query()->where('product_id', $this->productId)->pluck('stock', 'store_id');
                    $negative = $perStore->filter(static fn (mixed $stock): bool => (float) $stock < 0);

                    if ($aggregate >= 0 && $negative->isEmpty()) {
                        return true;
                    }

                    return $this->mismatch(
                        'остатки >= 0',
                        'products.stock = '.$this->qty($aggregate)
                            .($negative->isEmpty() ? '' : '; отрицательные склады: '.$negative->keys()->implode(', ')),
                    );
                },
            ],
        ];
    }

    /**
     * Не пункты чеклиста, а подготовка к браузерным тестам (docs/e2e-runbook.md):
     * товар прогона к этому моменту распродан, а браузеру нужно ещё и показать
     * остаток в наличии и пройти оформление заказа. Шагами, а не молча — чтобы
     * сломанная подготовка была видна в отчёте и роняла run_passed, а не всплывала
     * потом загадочным пустым каталогом в Playwright.
     *
     * @return list<array{title: string, run: callable(): mixed, critical?: bool}>
     */
    private function browserProductSteps(): array
    {
        return array_values(array_map(
            fn (string $role, array $product): array => [
                'title' => sprintf(
                    'Товар «%s» для браузера: приёмка на %s шт, в каталоге in_stock: true и stock: %s',
                    $product['title'],
                    $this->qty($product['qty']),
                    $this->qty($product['qty']),
                ),
                'run' => fn (): true|array => $this->stockBrowserProduct($role, $product['title'], $product['qty']),
            ],
            array_keys(self::BROWSER_PRODUCTS),
            self::BROWSER_PRODUCTS,
        ));
    }

    /**
     * Заводит товар тем же путём, что и шаг 2 (админский API), и принимает его
     * на склад через GoodsReceiptService — остаток, как везде, только через
     * FIFO-журнал. Проверяет то, что потом будет разглядывать браузер: публичный
     * каталог отдаёт товар в наличии и с этим самым числом.
     *
     * Артикул намеренно не содержит метку прогона целиком (ACC-IN-STOCK-…, а не
     * ACC-…-IN-STOCK): браузер ищет карточку распроданного товара по его артикулу,
     * и подстрока не должна находить заодно эти.
     *
     * @return true|array<string, string>
     */
    private function stockBrowserProduct(string $role, string $title, float $quantity): true|array
    {
        $article = 'ACC-'.Str::upper(str_replace('_', '-', $role)).'-'.$this->runToken;

        $response = $this->send('POST', '/api/admin/products', [
            'name' => ['ru' => "ACC {$title} {$this->runToken}"],
            'category_id' => $this->category->id,
            'code' => $article,
            'article' => $article,
            'retail_price' => self::RETAIL_PRICE_MAJOR,
            'b2b_price' => self::B2B_PRICE_MAJOR,
            'is_active' => true,
        ], $this->adminToken);

        $id = data_get($response['json'], 'data.id');

        if ($response['status'] !== 201 || ! is_numeric($id)) {
            return $this->mismatch('HTTP 201 с data.id', $this->summarize($response));
        }

        $productId = (int) $id;
        $this->browserProductIds[$role] = $productId;
        $this->leftovers[] = "товар #{$productId} для браузера, артикул {$article}";

        $receipt = GoodsReceipt::query()->create([
            'store_id' => $this->store->id,
            'number' => $article,
            'status' => GoodsReceipt::STATUS_DRAFT,
            'received_at' => now(),
            'note' => 'Приёмка под браузерные тесты',
            'user_id' => $this->admin->id,
        ]);

        $receipt->items()->create([
            'product_id' => $productId,
            'quantity' => $quantity,
            'unit_cost' => self::RECEIPT_UNIT_COST,
        ]);

        $this->leftovers[] = "приёмка #{$receipt->id} (проведена, ".$this->qty($quantity)." шт товара #{$productId})";

        $this->laravel->make(GoodsReceiptService::class)->post($receipt, $this->admin);

        $aggregate = (float) Product::query()->whereKey($productId)->value('stock');
        $atStore = $this->storeStockOf($productId);

        if (abs($aggregate - $quantity) > self::EPSILON || abs($atStore - $quantity) > self::EPSILON) {
            return $this->mismatch(
                'products.stock = '.$this->qty($quantity).' и product_store_stock.stock = '.$this->qty($quantity),
                'агрегат = '.$this->qty($aggregate).', склад = '.$this->qty($atStore),
            );
        }

        $listing = $this->send('GET', '/api/public/products?filter[search]='.rawurlencode($article));

        if ($listing['status'] !== 200) {
            return $this->mismatch('HTTP 200', $this->summarize($listing));
        }

        $row = collect((array) data_get($listing['json'], 'data', []))
            ->first(fn (mixed $item): bool => (int) data_get($item, 'id') === $productId);

        if ($row === null) {
            return $this->mismatch('товар в публичном каталоге', 'товара нет в выдаче /api/public/products');
        }

        $inStock = (bool) data_get($row, 'in_stock');
        $shownStock = data_get($row, 'stock');

        if (! $inStock || ! is_numeric($shownStock) || abs((float) $shownStock - $quantity) > self::EPSILON) {
            return $this->mismatch(
                'in_stock: true, stock: '.$this->qty($quantity),
                'in_stock: '.($inStock ? 'true' : 'false').', stock: '.var_export($shownStock, true)
                    .(is_numeric($shownStock) ? '' : ' (число скрыто — проверьте show_stock_quantity в настройках каталога)'),
            );
        }

        return true;
    }

    /**
     * @return list<array{title: string, run: callable(): mixed, critical?: bool}>
     */
    private function integritySteps(): array
    {
        $legacyHint = $this->option('fresh') ? '' : ' (база не пересоздавалась — возможно, это исторические строки)';

        return [
            [
                'title' => 'products.stock равен сумме product_store_stock по складам',
                'run' => function () use ($legacyHint): true|array {
                    // Допуск вместо строгого <> из чеклиста: на sqlite сумма decimal-колонок
                    // складывается во float, и точное сравнение ловило бы шум округления.
                    $drifted = DB::table('products')
                        ->leftJoin('product_store_stock', 'product_store_stock.product_id', '=', 'products.id')
                        ->groupBy('products.id', 'products.stock')
                        ->havingRaw('abs(products.stock - coalesce(sum(product_store_stock.stock), 0)) > ?', [self::EPSILON])
                        ->pluck('products.id');

                    return $drifted->isEmpty()
                        ? true
                        : $this->mismatch(
                            'ни одного расхождения агрегата и суммы по складам',
                            'разошлись товары: '.$drifted->implode(', ').$legacyHint,
                        );
                },
            ],
            [
                'title' => 'Ни одной строки product_store_stock со stock < 0',
                'run' => function () use ($legacyHint): true|array {
                    $negative = ProductStoreStock::query()->where('stock', '<', 0)->pluck('product_id');

                    return $negative->isEmpty()
                        ? true
                        : $this->mismatch('нет отрицательных складских остатков', 'товары: '.$negative->implode(', ').$legacyHint);
                },
            ],
            [
                'title' => 'Ни одного заказа в статусах synced/failed',
                'run' => function () use ($legacyHint): true|array {
                    $dead = Order::query()
                        ->whereIn('status', [Order::STATUS_SYNCED, Order::STATUS_FAILED])
                        ->pluck('status', 'number');

                    if ($dead->isEmpty()) {
                        return true;
                    }

                    $sample = $dead->take(10)->map(static fn (string $status, string $number): string => "{$number}={$status}")->implode(', ');

                    return $this->mismatch(
                        'нет заказов в мёртвых статусах',
                        'нашлось '.$dead->count().': '.$sample.$legacyHint,
                    );
                },
            ],
            [
                'title' => 'stock:recompute ничего не изменил',
                'run' => function (): true|array {
                    $before = DB::table('products')->orderBy('id')->pluck('stock', 'id')->all();
                    $this->callSilently('stock:recompute');
                    $after = DB::table('products')->orderBy('id')->pluck('stock', 'id')->all();

                    $changed = [];

                    foreach ($before as $id => $stock) {
                        if (abs((float) $stock - (float) ($after[$id] ?? 0)) > self::EPSILON) {
                            $changed[] = "#{$id}: {$stock} -> ".(string) ($after[$id] ?? 'null');
                        }
                    }

                    return $changed === []
                        ? true
                        : $this->mismatch(
                            'агрегаты уже верны, пересчёт ничего не двигает',
                            'пересчёт поправил '.count($changed).' товаров: '.implode('; ', array_slice($changed, 0, 10)),
                        );
                },
            ],
        ];
    }

    // ------------------------------------------------------------------
    // Общие проверки
    // ------------------------------------------------------------------

    /**
     * Остаток совпадает и в агрегате products.stock, и в проекции по складу —
     * расхождение между ними и есть тот баг, который чинили.
     *
     * @return true|array<string, string>
     */
    private function assertStock(float $expected): true|array
    {
        $aggregate = $this->aggregateStock();
        $atStore = $this->storeStock();

        if (abs($aggregate - $expected) <= self::EPSILON && abs($atStore - $expected) <= self::EPSILON) {
            return true;
        }

        return $this->mismatch(
            'products.stock = '.$this->qty($expected).' и product_store_stock.stock = '.$this->qty($expected),
            'агрегат = '.$this->qty($aggregate).', склад = '.$this->qty($atStore),
        );
    }

    /**
     * @return true|array<string, string>
     */
    private function assertPublicInStock(bool $expected): true|array
    {
        $response = $this->send('GET', '/api/public/products?filter[search]='.rawurlencode($this->marker()));

        if ($response['status'] !== 200) {
            return $this->mismatch('HTTP 200', $this->summarize($response));
        }

        $row = collect((array) data_get($response['json'], 'data', []))
            ->first(fn (mixed $item): bool => (int) data_get($item, 'id') === $this->productId);

        if ($row === null) {
            return $this->mismatch(
                'товар в публичном каталоге с in_stock: '.($expected ? 'true' : 'false'),
                'товара нет в выдаче /api/public/products',
            );
        }

        $inStock = (bool) data_get($row, 'in_stock');

        return $inStock === $expected
            ? true
            : $this->mismatch('in_stock: '.($expected ? 'true' : 'false'), 'in_stock: '.($inStock ? 'true' : 'false'));
    }

    /**
     * Уведомление менеджеру о новом заказе (OrderObserver::created).
     *
     * Во внутреннем режиме очередь подменена фейком, и проверка читает именно
     * тот диспатч, что произошёл во время оформления: job должен нести этот
     * заказ и явного получателя (toPhone) — у уведомлений покупателю его нет.
     * В режиме --url диспатч случился в чужом процессе, поэтому единственное,
     * что можно посмотреть, — таблица jobs, и только если очередь database.
     *
     * @return true|array<string, string>
     */
    private function assertManagerNotified(): true|array
    {
        if (! $this->isRemote()) {
            $dispatched = Queue::pushed(
                SendWhatsAppNotificationJob::class,
                fn (SendWhatsAppNotificationJob $job): bool => (int) $job->order->getKey() === $this->retailOrderId
                    && filled($job->toPhone),
            );

            return $dispatched->isNotEmpty()
                ? true
                : $this->mismatch(
                    'SendWhatsAppNotificationJob на заказ '.$this->retailOrderNumber.' с телефоном магазина',
                    'ни одного такого диспатча — менеджеру ничего не придёт, заказ будет лежать в pending. '
                        .'Проверьте OrderObserver::created и contact_phone в настройках каталога',
                );
        }

        if ((string) config('queue.default') !== 'database') {
            return $this->skipped('очередь «'.(string) config('queue.default').'», а не database: '
                .'в режиме --url диспатч происходит в чужом процессе и перехватить его нечем');
        }

        $queued = DB::table('jobs')
            ->where('payload', 'like', '%SendWhatsAppNotificationJob%')
            ->where('payload', 'like', '%'.$this->retailOrderNumber.'%')
            ->exists();

        return $queued
            ? true
            : $this->mismatch(
                'строка в jobs с уведомлением по заказу '.$this->retailOrderNumber,
                'строки нет (учтите: воркер мог её уже разобрать)',
            );
    }

    // ------------------------------------------------------------------
    // Фикстуры прогона
    // ------------------------------------------------------------------

    private function createStaffAndCategory(): void
    {
        $this->admin = User::query()->create([
            'name' => "ACC Админ {$this->runToken}",
            'email' => "acc-admin-{$this->runToken}@acceptance.invalid",
            'password' => $this->adminPassword,
            'is_approved' => true,
        ]);

        $this->admin->assignRole('admin');
        $this->adminToken = $this->admin->createToken('acceptance')->plainTextToken;
        $this->leftovers[] = "админ #{$this->admin->id} ({$this->admin->email})";

        $this->category = Category::query()->create([
            'name' => ['ru' => "ACC Категория {$this->runToken}"],
            'slug' => 'acc-'.$this->runToken,
            'is_active' => true,
        ]);

        $this->leftovers[] = "категория #{$this->category->id} (slug {$this->category->slug})";
    }

    /**
     * Розничный покупатель с токеном: чекаут под его токеном уходит в
     * placeRetail (а не placeGuest), и заказ можно отменить из кабинета.
     * В чеклисте он заходит по SMS-коду — здесь OTP не при чём, проверяется отмена.
     */
    private function createRetailCustomer(): void
    {
        $customer = User::query()->create([
            'name' => "ACC Розничный {$this->runToken}",
            'email' => "acc-retail-{$this->runToken}@acceptance.invalid",
            'phone' => $this->retailPhone,
            'password' => Str::random(32),
            'type' => User::TYPE_RETAIL,
            'is_approved' => true,
            'is_guest' => false,
        ]);

        $this->retailUserToken = $customer->createToken('acceptance')->plainTextToken;
        $this->leftovers[] = "розничный покупатель #{$customer->id} ({$customer->email})";
    }

    private function ensureShopContactPhone(): void
    {
        $settings = CatalogSetting::current();

        if (filled($settings->contact_phone)) {
            return;
        }

        $settings->forceFill(['contact_phone' => $this->nextTestPhone()])->save();
        $this->leftovers[] = 'настройки каталога: проставлен contact_phone (был пуст) — без него уведомление менеджеру не шлётся';
    }

    // ------------------------------------------------------------------
    // Транспорт
    // ------------------------------------------------------------------

    private function isRemote(): bool
    {
        return $this->remoteBaseUrl() !== '';
    }

    private function remoteBaseUrl(): string
    {
        return rtrim((string) ($this->option('url') ?? ''), '/');
    }

    /**
     * Один запрос к приложению.
     *
     * По умолчанию — через HTTP-ядро: тот же роутинг, те же middleware, те же
     * form request'ы, что и у настоящего запроса, только без веб-сервера.
     * Гварды сбрасываются вокруг каждого вызова: в одном процессе RequestGuard
     * закэшировал бы пользователя первого токена и отдавал бы его дальше.
     *
     * @param  array<string, mixed>|null  $payload
     * @return array{status: int, json: array<mixed>, body: string}
     */
    private function send(string $method, string $uri, ?array $payload = null, ?string $token = null): array
    {
        return $this->isRemote()
            ? $this->sendOverHttp($method, $uri, $payload, $token)
            : $this->sendThroughKernel($method, $uri, $payload, $token);
    }

    /**
     * @param  array<string, mixed>|null  $payload
     * @return array{status: int, json: array<mixed>, body: string}
     */
    private function sendThroughKernel(string $method, string $uri, ?array $payload, ?string $token): array
    {
        $server = ['HTTP_ACCEPT' => 'application/json'];

        if ($token !== null) {
            $server['HTTP_AUTHORIZATION'] = 'Bearer '.$token;
        }

        $content = null;

        if ($payload !== null) {
            $server['CONTENT_TYPE'] = 'application/json';
            $content = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        }

        Auth::forgetGuards();

        // Намеренно без terminate(): терминируемых middleware на api-роутах нет,
        // а Application::terminate() в консольном процессе трогать незачем.
        $response = $this->laravel->make(HttpKernel::class)
            ->handle(Request::create($uri, $method, [], [], [], $server, $content));

        Auth::forgetGuards();

        return $this->decode($response->getStatusCode(), (string) $response->getContent());
    }

    /**
     * @param  array<string, mixed>|null  $payload
     * @return array{status: int, json: array<mixed>, body: string}
     */
    private function sendOverHttp(string $method, string $uri, ?array $payload, ?string $token): array
    {
        $request = Http::acceptJson()->timeout(30);

        if ($token !== null) {
            $request = $request->withToken($token);
        }

        try {
            $response = $request->send($method, $this->remoteBaseUrl().$uri, $payload === null ? [] : ['json' => $payload]);
        } catch (ConnectionException $e) {
            return ['status' => 0, 'json' => [], 'body' => 'соединение не установлено: '.$e->getMessage()];
        }

        return $this->decode($response->status(), $response->body());
    }

    /**
     * @return array{status: int, json: array<mixed>, body: string}
     */
    private function decode(int $status, string $body): array
    {
        $json = json_decode($body, true);

        return ['status' => $status, 'json' => is_array($json) ? $json : [], 'body' => $body];
    }

    /**
     * @param  array{status: int, json: array<mixed>, body: string}  $response
     */
    private function summarize(array $response): string
    {
        $parts = ['HTTP '.$response['status']];

        $message = data_get($response['json'], 'message');

        if (is_string($message) && $message !== '') {
            $parts[] = $message;
        }

        $errors = data_get($response['json'], 'errors');

        if (is_array($errors) && $errors !== []) {
            $parts[] = (string) json_encode($errors, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        if (count($parts) === 1) {
            $parts[] = Str::limit(trim($response['body']), 200);
        }

        return implode(' — ', $parts);
    }

    // ------------------------------------------------------------------
    // Мелочи
    // ------------------------------------------------------------------

    private function marker(): string
    {
        return 'ACC-'.$this->runToken;
    }

    private function aggregateStock(): float
    {
        return (float) (Product::query()->whereKey($this->productId)->value('stock') ?? 0);
    }

    private function storeStock(): float
    {
        return $this->storeStockOf($this->productId);
    }

    private function storeStockOf(int $productId): float
    {
        return (float) (ProductStoreStock::query()
            ->where('product_id', $productId)
            ->where('store_id', $this->store->id)
            ->value('stock') ?? 0);
    }

    private function qty(float $value): string
    {
        return rtrim(rtrim(number_format($value, 3, '.', ''), '0'), '.') ?: '0';
    }

    /**
     * @return array{expected: string, actual: string}
     */
    private function mismatch(string $expected, string $actual): array
    {
        return ['expected' => $expected, 'actual' => $actual];
    }

    /**
     * Шаг опирается на то, чего предыдущий шаг не дал. Это провал (проверка не
     * состоялась), но не повод прерывать прогон: остальные сценарии и проверки
     * целостности всё ещё имеют смысл.
     *
     * @return array{expected: string, actual: string, blocked: string}
     */
    private function nothingToCheck(string $expected, string $missing): array
    {
        return $this->mismatch($expected, "нечего проверять: {$missing}") + ['blocked' => $missing];
    }

    /**
     * @return array{skip: string}
     */
    private function skipped(string $reason): array
    {
        return ['skip' => $reason];
    }

    // ------------------------------------------------------------------
    // Фикстуры для браузерных тестов
    // ------------------------------------------------------------------

    /**
     * Куда писать фикстуры: null, если --fixtures не передан.
     *
     * `--fixtures` без значения — стандартный путь, `--fixtures=путь` — свой.
     * Различить «не передан» и «передан пустым» по option() нельзя (в обоих
     * случаях null), поэтому присутствие флага спрашивается у самого ввода.
     */
    private function fixturesPath(): ?string
    {
        if (! $this->input->hasParameterOption(['--fixtures'], true)) {
            return null;
        }

        $value = trim((string) ($this->option('fixtures') ?? ''));

        return $value !== '' ? $value : storage_path('app/private/acceptance-fixtures.json');
    }

    /**
     * Что осталось в базе после прогона — машинно читаемым JSON.
     *
     * Все идентификаторы прогона намеренно случайные: артикул, slug, телефоны,
     * пароли. Иначе два прогона подряд дрались бы за уникальные колонки, а
     * товар одного прогона путался бы с товаром другого. Браузерным тестам при
     * этом нужно точно знать, какой товар открывать и каким клиентом заходить,
     * — этот файл и есть мост между прогоном и ними: сидера для них нет и не
     * нужно, состояние делает сам прогон.
     *
     * Пишется даже после провалов — с тем, что успело получиться, и с
     * `run_passed: false`. Тогда тест падает с внятным «прогон был красным»,
     * а не с загадочным пустым селектором.
     */
    private function writeFixtures(): void
    {
        $path = $this->fixturesPath();

        if ($path === null) {
            return;
        }

        $payload = [
            'version' => 2,
            'generated_at' => Carbon::now()->toIso8601String(),
            'run_token' => $this->runToken,
            'marker' => $this->marker(),
            'fresh' => (bool) $this->option('fresh'),
            'run_passed' => $this->countByStatus('fail') === 0 && $this->abortedAt === null,
            'store' => isset($this->store)
                ? ['id' => $this->store->id, 'name' => $this->store->name]
                : null,
            // Служебный админ прогона, а не посеянный admin@paradise.kz: у него
            // роль admin и он существует независимо от того, был ли --fresh.
            'admin' => isset($this->admin)
                ? ['email' => $this->admin->email, 'password' => $this->adminPassword]
                : null,
            'b2b_client' => isset($this->b2bUser)
                ? [
                    'id' => $this->b2bUser->id,
                    'phone' => $this->b2bPhone,
                    'password' => $this->b2bPassword,
                    'email' => $this->b2bEmail,
                    'company_name' => $this->b2bUser->company_name,
                    'is_approved' => (bool) $this->b2bUser->refresh()->is_approved,
                ]
                : null,
            // Товар прогона: к концу распродан — образец «нет в наличии».
            'product' => $this->productFixture($this->productId ?? null),
            // Два товара под браузер (BROWSER_PRODUCTS): «в наличии» не покупают,
            // «для заказа» покупают тесты оформления.
            'in_stock_product' => $this->productFixture($this->browserProductIds['in_stock'] ?? null),
            'checkout_product' => $this->productFixture($this->browserProductIds['checkout'] ?? null),
            'orders' => array_filter([
                'retail' => $this->orderFixture($this->retailOrderId ?? null, $this->guestPhone),
                'b2b' => $this->orderFixture($this->b2bOrderId ?? null, $this->b2bPhone),
                'account' => $this->orderFixture($this->accountOrderId ?? null, $this->retailPhone),
                'buyout' => $this->orderFixture($this->buyoutOrderId ?? null, null),
            ], static fn (?array $order): bool => $order !== null),
        ];

        $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        if ($json === false) {
            $this->warn('Не удалось сериализовать фикстуры прогона.');

            return;
        }

        $directory = dirname($path);

        if (! is_dir($directory) && ! mkdir($directory, 0o755, true) && ! is_dir($directory)) {
            $this->warn("Не удалось создать каталог для фикстур: {$directory}");

            return;
        }

        if (file_put_contents($path, $json.PHP_EOL) === false) {
            $this->warn("Не удалось записать фикстуры: {$path}");

            return;
        }

        $this->writtenFixturesPath = $path;
    }

    /**
     * Цены — константы прогона в тенге: все его товары заводятся с ними.
     *
     * @return array{id: int, slug: string, article: string, name: string, retail_price: int, b2b_price: int, stock: float, stock_at_store: float|null}|null
     */
    private function productFixture(?int $id): ?array
    {
        $product = $id === null ? null : Product::query()->find($id);

        return $product === null ? null : [
            'id' => $product->id,
            'slug' => (string) $product->slug,
            'article' => (string) $product->article,
            'name' => $product->getTranslation('name', 'ru', false),
            'retail_price' => self::RETAIL_PRICE_MAJOR,
            'b2b_price' => self::B2B_PRICE_MAJOR,
            'stock' => (float) $product->stock,
            'stock_at_store' => isset($this->store) ? $this->storeStockOf($product->id) : null,
        ];
    }

    /**
     * Телефон — тот, с которым заказ оформляли: по номеру и телефону заказ
     * ищется на странице «Отследить заказ». У выкупа он одноразовый и не
     * запоминается — там null.
     *
     * @return array{id: int, number: string, status: string, phone: string|null}|null
     */
    private function orderFixture(?int $id, ?string $phone): ?array
    {
        if ($id === null) {
            return null;
        }

        $order = Order::query()->find($id);

        return $order === null ? null : [
            'id' => $order->id,
            'number' => (string) $order->number,
            'status' => (string) $order->status,
            'phone' => $phone,
        ];
    }

    // ------------------------------------------------------------------
    // Отчёт
    // ------------------------------------------------------------------

    private function report(): int
    {
        $total = count(array_filter($this->plan(), static fn (array $item): bool => isset($item['title'])));

        $passed = $this->countByStatus('pass');
        $failed = $this->countByStatus('fail');
        $skippedCount = $this->countByStatus('skip');
        $notRun = $total - count($this->results);

        $this->newLine();
        $this->line('  '.str_repeat('-', 60));

        $summary = "  {$total} ".$this->plural($total, 'шаг', 'шага', 'шагов')
            .": пройдено {$passed}, провалено {$failed}";

        if ($skippedCount > 0) {
            $summary .= ", пропущено {$skippedCount}";
        }

        if ($notRun > 0) {
            $summary .= ", не выполнено {$notRun}";
        }

        $this->line($failed === 0 && $notRun === 0 ? "<fg=green>{$summary}</>" : "<fg=red>{$summary}</>");

        if ($this->abortedAt !== null) {
            $this->line("  Прогон прерван на шаге {$this->abortedAt}: {$this->abortReason}.");
        }

        $this->printFailures();
        $this->printSkips();
        $this->printLeftovers();
        $this->printFixtures();
        $this->newLine();

        return $failed === 0 && $notRun === 0 ? self::SUCCESS : self::FAILURE;
    }

    private function printFailures(): void
    {
        $failures = array_filter($this->results, static fn (array $r): bool => $r['status'] === 'fail');

        if ($failures === []) {
            return;
        }

        $this->newLine();
        $this->line('  <options=bold>ПРОВАЛЫ</>');

        foreach ($failures as $failure) {
            $this->newLine();
            $this->line(sprintf('  <fg=red>%02d.</> %s', $failure['n'], $failure['title']));
            $this->line('  -- ожидали:  '.$failure['expected']);
            $this->line('  -- получили: '.$failure['actual']);

            if (! $failure['blocked'] && isset(self::REGRESSIONS[$failure['n']])) {
                $this->line('  -- <fg=yellow;options=bold>ИЗВЕСТНЫЙ РЕГРЕСС:</> <fg=yellow>'.self::REGRESSIONS[$failure['n']].'</>');
            }
        }
    }

    private function printSkips(): void
    {
        $skips = array_filter($this->results, static fn (array $r): bool => $r['status'] === 'skip');

        if ($skips === []) {
            return;
        }

        $this->newLine();
        $this->line('  <options=bold>ПРОПУЩЕНО</>');

        foreach ($skips as $skip) {
            $this->line(sprintf('  <fg=yellow>%02d.</> %s', $skip['n'], $skip['title']));
            $this->line('  -- '.$skip['actual']);
        }
    }

    private function printLeftovers(): void
    {
        if ($this->leftovers === []) {
            return;
        }

        $movements = StockMovement::query()->where('product_id', $this->productId ?? 0)->count();

        $this->newLine();

        if ($this->option('fresh')) {
            $this->line('  <options=bold>ПОСЛЕ ПРОГОНА</> — база пересоздана (--fresh), в ней остались только строки этого прогона:');
        } else {
            $this->line('  <fg=yellow;options=bold>ПОСЛЕ ПРОГОНА</> <fg=yellow>— прогон шёл поверх текущих данных и оставил в базе тестовые строки:</>');
        }

        foreach ($this->leftovers as $leftover) {
            $this->line('    • '.$leftover);
        }

        if ($movements > 0) {
            $this->line("    • движений по складу: {$movements}");
        }

        $this->line('  Найти их можно по метке <options=bold>'.$this->marker().'</> и по домену <options=bold>@acceptance.invalid</>.');
    }

    private function printFixtures(): void
    {
        if ($this->writtenFixturesPath === null) {
            return;
        }

        $this->newLine();
        $this->line('  <options=bold>ФИКСТУРЫ</> — что осталось в базе, машинно читаемым (этим кормятся браузерные тесты):');
        $this->line('    '.$this->writtenFixturesPath);
    }

    private function countByStatus(string $status): int
    {
        return count(array_filter($this->results, static fn (array $result): bool => $result['status'] === $status));
    }

    private function plural(int $count, string $one, string $few, string $many): string
    {
        $mod100 = $count % 100;
        $mod10 = $count % 10;

        return match (true) {
            $mod100 >= 11 && $mod100 <= 14 => $many,
            $mod10 === 1 => $one,
            $mod10 >= 2 && $mod10 <= 4 => $few,
            default => $many,
        };
    }
}
