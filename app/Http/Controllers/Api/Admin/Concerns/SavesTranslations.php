<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;
use Spatie\Translatable\HasTranslations;

/**
 * Spatie's setTranslations() merges, so a locale the manager cleared in the
 * form would survive a plain update(). Every translatable key present in the
 * data replaces its translations wholesale; absent keys stay untouched.
 */
trait SavesTranslations
{
    /**
     * @template TModel of Model
     *
     * @param  TModel  $model  a model using {@see HasTranslations}
     * @param  array<string, mixed>  $data
     * @return TModel
     */
    protected function saveWithTranslations(Model $model, array $data): Model
    {
        $translatable = $model->getTranslatableAttributes();
        $model->fill(Arr::except($data, $translatable));

        foreach (array_intersect($translatable, array_keys($data)) as $key) {
            $model->replaceTranslations($key, (array) ($data[$key] ?? []));
        }

        $model->save();

        return $model;
    }
}
