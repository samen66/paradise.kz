<?php

declare(strict_types=1);

/**
 * Force the test environment BEFORE the framework boots.
 *
 * Inside the app/queue Docker containers, docker-compose's env_file injects
 * DB_CONNECTION=mysql (and the rest of .env) directly into $_SERVER for every
 * PHP process. PHPUnit's <php><env force="true"> only patches putenv()/$_ENV,
 * not $_SERVER, so it cannot override that — and Laravel's env() resolution
 * picks $_SERVER first. Without this file, RefreshDatabase silently ran
 * migrate:fresh against the live dev MySQL database instead of an isolated
 * sqlite :memory: connection, wiping it. Setting $_SERVER directly here, before
 * vendor/autoload.php (and therefore before Laravel ever boots), is the only
 * reliable fix. Do not remove.
 */
$testEnv = [
    'APP_ENV' => 'testing',
    'APP_MAINTENANCE_DRIVER' => 'file',
    'BCRYPT_ROUNDS' => '4',
    'BROADCAST_CONNECTION' => 'null',
    'CACHE_STORE' => 'array',
    'DB_CONNECTION' => 'sqlite',
    'DB_DATABASE' => ':memory:',
    'DB_URL' => '',
    'MAIL_MAILER' => 'array',
    'QUEUE_CONNECTION' => 'sync',
    'SESSION_DRIVER' => 'array',
    'PULSE_ENABLED' => 'false',
    'TELESCOPE_ENABLED' => 'false',
    'NIGHTWATCH_ENABLED' => 'false',
];

foreach ($testEnv as $key => $value) {
    putenv("{$key}={$value}");
    $_ENV[$key] = $value;
    $_SERVER[$key] = $value;
}

require __DIR__.'/../vendor/autoload.php';
