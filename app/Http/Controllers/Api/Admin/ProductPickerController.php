<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\Inventory\ProductPicker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductPickerController extends Controller
{
    /**
     * Товары для строки поиска и «Подбора» документа склада.
     *
     * `store_id` (обязателен) — склад документа; filter[search] (название
     * ru/kk, код, артикул, без регистра), filter[category_id] (с
     * подкатегориями), filter[recent]=1 (принимали на этот склад, новые
     * первыми), filter[in_stock]=1 (остаток на складе > 0). По 30.
     */
    public function index(Request $request, ProductPicker $picker): JsonResponse
    {
        $validated = $request->validate([
            'store_id' => ['required', 'integer', 'exists:stores,id'],
            'filter.search' => ['nullable', 'string', 'max:255'],
            'filter.category_id' => ['nullable', 'integer'],
            'filter.recent' => ['nullable', 'boolean'],
            'filter.in_stock' => ['nullable', 'boolean'],
        ]);

        $filter = $validated['filter'] ?? [];

        $page = $picker->list((int) $validated['store_id'], [
            'search' => $filter['search'] ?? null,
            'category_id' => isset($filter['category_id']) ? (int) $filter['category_id'] : null,
            'recent' => filter_var($filter['recent'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'in_stock' => filter_var($filter['in_stock'] ?? false, FILTER_VALIDATE_BOOLEAN),
        ]);

        return response()->json($page->appends($request->query())->toArray());
    }
}
