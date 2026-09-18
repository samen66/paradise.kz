<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Spatie\MediaLibrary\HasMedia;

/**
 * One-photo slots (banner image, collection cover, "who we are" photo):
 * upload replaces — the media collections are singleFile — and delete clears.
 * Same file rules as product photos (ProductMediaController).
 */
trait StoresSingleImage
{
    protected function replaceImage(Request $request, HasMedia&Model $model, string $collection): void
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:jpeg,png,webp', 'max:10240'],
        ], [
            'file.required' => 'Выберите файл.',
            'file.mimes' => 'Только JPEG, PNG или WebP.',
            'file.max' => 'Файл больше 10 МБ.',
        ]);

        $model->addMediaFromRequest('file')->toMediaCollection($collection);
    }

    protected function removeImage(HasMedia&Model $model, string $collection): void
    {
        $model->clearMediaCollection($collection);
    }
}
