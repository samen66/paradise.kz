<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Http\Controllers\Api\Admin\Concerns\RefusesPostedDocuments;
use App\Models\GoodsReceipt;
use Closure;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\JsonResponse;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Exercises RefusesPostedDocuments::whileDraft() directly: it must re-read
 * the document under a row lock rather than trust the route-bound instance,
 * so a receipt posted concurrently (after the controller resolved its model
 * but before the write ran) is still caught.
 */
class RefusesPostedDocumentsTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function while_draft_runs_the_write_against_a_freshly_locked_document(): void
    {
        $receipt = GoodsReceipt::factory()->create();

        $response = $this->traitHost()->callWhileDraft(
            $receipt,
            fn (GoodsReceipt $locked): JsonResponse => response()->json(['data' => ['id' => $locked->id]]),
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame($receipt->id, $response->getData(true)['data']['id']);
    }

    #[Test]
    public function while_draft_refuses_a_document_posted_after_it_was_loaded_and_never_runs_the_write(): void
    {
        $receipt = GoodsReceipt::factory()->create();
        // Simulate a concurrent `post`: the DB row moves to posted, but the
        // in-memory $receipt instance the controller is holding is stale.
        GoodsReceipt::whereKey($receipt->id)->update(['status' => GoodsReceipt::STATUS_POSTED]);

        $ran = false;

        $response = $this->traitHost()->callWhileDraft(
            $receipt,
            function () use (&$ran): JsonResponse {
                $ran = true;

                return response()->json(['data' => []]);
            },
        );

        $this->assertSame(422, $response->getStatusCode());
        $this->assertSame('Документ проведён — изменить нельзя.', $response->getData(true)['message']);
        $this->assertFalse($ran);
    }

    private function traitHost(): object
    {
        return new class
        {
            use RefusesPostedDocuments;

            public function callWhileDraft(GoodsReceipt $document, Closure $write): JsonResponse
            {
                return $this->whileDraft($document, $write);
            }
        };
    }
}
