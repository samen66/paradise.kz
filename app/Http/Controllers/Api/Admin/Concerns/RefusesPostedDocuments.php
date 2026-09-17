<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin\Concerns;

use App\Models\GoodsReceipt;
use App\Models\WriteOff;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * A posted document has already moved stock; editing its header or lines
 * afterwards would make the document disagree with the ledger.
 */
trait RefusesPostedDocuments
{
    protected function refuseIfPosted(GoodsReceipt|WriteOff $document): ?JsonResponse
    {
        return $document->isPosted() ? $this->postedResponse() : null;
    }

    /**
     * Runs a write against a freshly row-locked read of the document, inside
     * a transaction, so a concurrent `post` cannot slip in between the
     * controller's status check and the write. Without this, the route-bound
     * `$document` instance is checked once and then written to separately —
     * a `post` racing in that gap can lock the row, issue the stock and
     * commit before this write lands, leaving a line with no stock movement
     * under a document the ledger already considers closed.
     *
     * @param  Closure(GoodsReceipt|WriteOff): JsonResponse  $write
     */
    protected function whileDraft(GoodsReceipt|WriteOff $document, Closure $write): JsonResponse
    {
        return DB::transaction(function () use ($document, $write): JsonResponse {
            $locked = $document::query()->lockForUpdate()->findOrFail($document->getKey());

            if ($locked->isPosted()) {
                return $this->postedResponse();
            }

            return $write($locked);
        });
    }

    private function postedResponse(): JsonResponse
    {
        return response()->json(['message' => 'Документ проведён — изменить нельзя.'], 422);
    }
}
