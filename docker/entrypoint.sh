#!/bin/sh
set -e

if [ -n "$DB_HOST" ]; then
    echo "Waiting for MySQL at $DB_HOST..."
    until mysqladmin ping -h "$DB_HOST" -u "${DB_USERNAME:-root}" -p"${DB_PASSWORD:-}" --skip-ssl --silent 2>/dev/null; do
        sleep 2
    done
    echo "MySQL is ready."
fi

if [ "$1" = "php-fpm" ]; then
    if [ ! -d vendor ]; then
        composer install --no-interaction --prefer-dist
    fi

    if [ ! -f .env ]; then
        cp .env.example .env
    fi

    if ! grep -q '^APP_KEY=base64:' .env 2>/dev/null; then
        php artisan key:generate --force
    fi

    php artisan migrate --force

    if [ ! -L public/storage ]; then
        php artisan storage:link
    fi

    chown -R www-data:www-data storage bootstrap/cache
fi

exec "$@"
