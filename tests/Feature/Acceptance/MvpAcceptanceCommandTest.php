<?php

declare(strict_types=1);

namespace Tests\Feature\Acceptance;

use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Keeps `mvp:acceptance` honest.
 *
 * The command is the automated form of docs/acceptance-checklist.md, so it
 * necessarily reaches across most of the application — catalog, pricing,
 * inventory, orders, auth. That makes it the first thing to rot silently when
 * any of those move. Running it here on a clean sqlite database means a broken
 * acceptance runner fails in CI rather than the next time somebody actually
 * needs it.
 *
 * A green exit code is a strong assertion on its own: the command returns
 * FAILURE if any step fails OR if any step never ran (an abort), so success
 * means all 33 steps executed and passed.
 */
class MvpAcceptanceCommandTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function the_acceptance_run_is_green_end_to_end(): void
    {
        // Roles, price types and the default warehouse — the command's step 1.
        $this->seed();

        $this->artisan('mvp:acceptance')->assertSuccessful();
    }

    #[Test]
    public function it_refuses_to_run_outside_local_and_testing_without_force(): void
    {
        $this->app['env'] = 'production';

        $this->artisan('mvp:acceptance')
            ->expectsOutputToContain('--force')
            ->assertFailed();
    }

    /**
     * --fixtures — мост к браузерным тестам (docs/e2e-runbook.md). Они ищут в
     * базе товар и клиента прогона, а идентификаторы у прогона случайные, так
     * что сломанный или неполный файл фикстур означает молча нерабочий
     * Playwright в трёх приложениях сразу.
     */
    #[Test]
    public function it_writes_fixtures_the_browser_tests_can_act_on(): void
    {
        $this->seed();

        $path = storage_path('framework/testing/acceptance-fixtures.json');

        $this->artisan('mvp:acceptance', ['--fixtures' => $path])->assertSuccessful();

        $this->assertFileExists($path);

        $fixtures = json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);

        @unlink($path);

        $this->assertTrue($fixtures['run_passed']);

        // Товар открывается на витрине по slug и ищется в каталоге по артикулу;
        // к концу прогона он распродан — на этом стоят проверки «нет в наличии».
        $this->assertNotSame('', $fixtures['product']['slug']);
        $this->assertNotSame('', $fixtures['product']['article']);
        $this->assertSame(0.0, (float) $fixtures['product']['stock']);

        // Товары под браузер: «в наличии» разглядывают — число на экране
        // сверяется ровно с 7; «для заказа» покупают тесты оформления.
        foreach (['in_stock_product' => 7.0, 'checkout_product' => 500.0] as $key => $stock) {
            $this->assertSame($stock, (float) $fixtures[$key]['stock'], $key);
            $this->assertSame($stock, (float) $fixtures[$key]['stock_at_store'], $key);

            // Карточку распроданного товара браузер ищет по подстроке артикула —
            // она не должна цеплять заодно эти товары.
            $this->assertStringNotContainsString($fixtures['product']['article'], $fixtures[$key]['article'], $key);

            $this->getJson('/api/public/products/'.$fixtures[$key]['slug'])
                ->assertOk()
                ->assertJsonPath('data.in_stock', true);
        }

        // По номеру и телефону завершённый заказ открывается на «Отследить заказ».
        $this->getJson('/api/public/orders/track?'.http_build_query([
            'number' => $fixtures['orders']['retail']['number'],
            'phone' => $fixtures['orders']['retail']['phone'],
        ]))->assertOk()->assertJsonPath('data.status', 'completed');

        // Заказ на выкуп остатка — единственный, кто остаётся новым: на нём
        // админка гоняет статусы.
        $this->assertSame('pending', $fixtures['orders']['buyout']['status']);

        // Учётки должны именно работать: тесты заходят ими через форму входа.
        $this->assertTrue($fixtures['b2b_client']['is_approved']);

        foreach ([
            ['email' => $fixtures['admin']['email'], 'password' => $fixtures['admin']['password']],
            ['phone' => $fixtures['b2b_client']['phone'], 'password' => $fixtures['b2b_client']['password']],
        ] as $credentials) {
            $this->postJson('/api/auth/login', $credentials)->assertOk()->assertJsonStructure(['token']);
        }
    }
}
