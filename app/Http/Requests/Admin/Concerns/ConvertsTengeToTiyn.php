<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Concerns;

/**
 * Prices cross the admin API in ₸ (at most two decimals) and are stored in
 * integer тиын. The using request lists its money fields in priceFields();
 * the conversion happens here, once, so controllers only ever see тиын.
 */
trait ConvertsTengeToTiyn
{
    /**
     * @return list<string>
     */
    abstract protected function priceFields(): array;

    /**
     * @param  string|null  $key
     * @param  mixed  $default
     */
    public function validated($key = null, $default = null): mixed
    {
        $validated = parent::validated();

        foreach ($this->priceFields() as $field) {
            if (array_key_exists($field, $validated) && $validated[$field] !== null) {
                $validated[$field] = (int) round((float) $validated[$field] * 100);
            }
        }

        return $key === null ? $validated : data_get($validated, $key, $default);
    }
}
