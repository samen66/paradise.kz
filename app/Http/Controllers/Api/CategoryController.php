<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Models\ProductFolder;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CategoryController extends Controller
{
    /**
     * Flat list of product folders. The SPA rebuilds the tree from
     * `parent_external_id`.
     */
    public function index(): AnonymousResourceCollection
    {
        $folders = ProductFolder::query()
            ->orderBy('name')
            ->get();

        return CategoryResource::collection($folders);
    }
}
