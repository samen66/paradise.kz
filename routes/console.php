<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
 * No scheduled work.
 *
 * The catalog is authored in the admin panel and stock comes from the local
 * FIFO ledger, so there is nothing to sync on a timer. The former ERP sync
 * and `catalog:generate-product-slugs` entries existed only to
 * mirror an external ERP and to backfill slugs after its bulk upserts (which
 * bypassed model events); locally created products get their slug from
 * Product::booted().
 */
