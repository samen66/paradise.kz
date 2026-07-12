<?php

use App\Providers\AppServiceProvider;
use App\Providers\ErpServiceProvider;
use App\Providers\Filament\AdminPanelProvider;
use App\Providers\SmsServiceProvider;

return [
    AppServiceProvider::class,
    ErpServiceProvider::class,
    SmsServiceProvider::class,
    AdminPanelProvider::class,
];
