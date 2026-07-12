<?php

declare(strict_types=1);

namespace Tests\Unit\MoySklad;

use App\Services\MoySklad\Exceptions\MoySkladApiException;
use App\Services\MoySklad\MoySkladClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class MoySkladClientTest extends TestCase
{
    private function client(int $pageLimit = 1000): MoySkladClient
    {
        return new MoySkladClient(
            baseUrl: 'https://api.moysklad.ru/api/remap/1.2',
            token: 'test-token',
            timeout: 5,
            maxRetries: 2,
            pageLimit: $pageLimit,
        );
    }

    #[Test]
    public function it_sends_auth_and_gzip_headers(): void
    {
        Http::fake([
            '*' => Http::response(['rows' => []], 200),
        ]);

        $this->client()->get('/entity/product');

        Http::assertSent(function (Request $request): bool {
            return $request->hasHeader('Authorization', 'Bearer test-token')
                && $request->hasHeader('Accept-Encoding', 'gzip');
        });
    }

    #[Test]
    public function it_throws_a_typed_exception_with_parsed_errors(): void
    {
        Http::fake([
            '*' => Http::response(['errors' => [['error' => 'Bad request', 'code' => 1000]]], 412),
        ]);

        try {
            $this->client()->get('/entity/product');
            $this->fail('Expected MoySkladApiException.');
        } catch (MoySkladApiException $e) {
            $this->assertSame(412, $e->status);
            $this->assertSame('Bad request', $e->getMessage());
            $this->assertSame(1000, $e->errors[0]['code']);
        }
    }

    #[Test]
    public function it_throws_when_token_is_missing(): void
    {
        $client = new MoySkladClient('https://example.test', token: null);

        $this->expectException(MoySkladApiException::class);

        $client->get('/entity/product');
    }

    #[Test]
    public function it_retries_on_429_then_succeeds(): void
    {
        Http::fakeSequence()
            ->push('rate limited', 429, ['X-Lognex-Retry-After' => '1'])
            ->push(['rows' => [['id' => 'ok']]], 200);

        $result = $this->client()->get('/entity/product');

        $this->assertSame('ok', $result['rows'][0]['id']);
        Http::assertSentCount(2);
    }

    #[Test]
    public function it_paginates_until_a_short_page(): void
    {
        $full = ['rows' => array_fill(0, 2, ['id' => 'x'])]; // page size == limit
        $last = ['rows' => [['id' => 'last']]];              // short page ends paging

        Http::fakeSequence()
            ->push($full, 200)
            ->push($last, 200);

        $rows = iterator_to_array($this->client(pageLimit: 2)->paginate('/entity/product'));

        $this->assertCount(3, $rows);
        $this->assertSame('last', $rows[2]['id']);
        Http::assertSentCount(2);
    }
}
