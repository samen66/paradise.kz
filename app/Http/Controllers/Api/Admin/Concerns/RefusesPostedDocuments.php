<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin\Concerns;

use App\Models\GoodsReceipt;
use App\Models\WriteOff;
use Illuminate\Http\JsonResponse;

/**
 * A posted document has already moved stock; editing its header or lines
 * afterwards would make the document disagree with the ledger.
 */
trait RefusesPostedDocuments
{
    protected function refuseIfPosted(GoodsReceipt|WriteOff $document): ?JsonResponse
    {
        if (! $document->isPosted()) {
            return null;
        }

        return response()->json(['message' => 'Документ проведён — изменить нельзя.'], 422);
    }
}
