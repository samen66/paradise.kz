<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Fallback full sync; webhooks keep the mirror fresh in between (see docs).
Schedule::command('moysklad:sync')
    ->everyFifteenMinutes()
    ->withoutOverlapping();

// Sync upserts bypass model events, so new ERP products get their storefront
// slug here shortly after each sync window.
Schedule::command('catalog:generate-product-slugs')
    ->everyFifteenMinutes()
    ->withoutOverlapping();
