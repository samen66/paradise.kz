<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\SavesTranslations;
use App\Http\Controllers\Api\Admin\Concerns\StoresSingleImage;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\B2bHomeContentRequest;
use App\Models\B2bHomeContent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The "who we are" block of the B2B portal home page (single row).
 */
class B2bHomeContentController extends Controller
{
    use SavesTranslations;
    use StoresSingleImage;

    /**
     * @return array{about_title: array<string, string>, about_text: array<string, string>, image_url: string|null}
     */
    private function present(B2bHomeContent $content): array
    {
        return [
            'about_title' => $content->getTranslations('about_title'),
            'about_text' => $content->getTranslations('about_text'),
            'image_url' => $content->getFirstMediaUrl(B2bHomeContent::ABOUT_IMAGE_COLLECTION, 'wide') ?: null,
        ];
    }

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->present(B2bHomeContent::current())]);
    }

    public function update(B2bHomeContentRequest $request): JsonResponse
    {
        $content = $this->saveWithTranslations(B2bHomeContent::current(), $request->validated());

        return response()->json(['data' => $this->present($content)]);
    }

    public function storeImage(Request $request): JsonResponse
    {
        $content = B2bHomeContent::current();
        $this->replaceImage($request, $content, B2bHomeContent::ABOUT_IMAGE_COLLECTION);

        return response()->json(['data' => $this->present($content->fresh())]);
    }

    public function destroyImage(): JsonResponse
    {
        $content = B2bHomeContent::current();
        $this->removeImage($content, B2bHomeContent::ABOUT_IMAGE_COLLECTION);

        return response()->json(['data' => $this->present($content->fresh())]);
    }
}
