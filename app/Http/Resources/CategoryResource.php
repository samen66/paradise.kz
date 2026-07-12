<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\ProductFolder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Flat product-folder payload. `parent_external_id` lets the SPA rebuild the
 * tree client-side without a nested response.
 *
 * @mixin ProductFolder
 */
class CategoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'external_id' => $this->external_id,
            'name' => $this->name,
            'parent_external_id' => $this->parent_external_id,
        ];
    }
}
