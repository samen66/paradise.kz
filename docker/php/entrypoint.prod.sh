#!/bin/sh
set -e

if [ -n "$DB_HOST" ]; then
    echo "Waiting for MySQL at $DB_HOST..."
    until mysqladmin ping -h "$DB_HOST" -u "${DB_USERNAME:-root}" -p"${DB_PASSWORD:-}" --skip-ssl --silent 2>/dev/null; do
        sleep 2
    done
    echo "MySQL is ready."
fi

# Config is provided via container environment (compose env_file) — cache it
# at startup so every artisan/php-fpm process skips env parsing. Migrations
# are intentionally NOT run here: the deploy job runs `migrate --force` once.
php artisan config:cache
php artisan route:cache
php artisan view:cache

if [ ! -L public/storage ]; then
    php artisan storage:link
fi

chown -R www-data:www-data storage bootstrap/cache

exec "$@"
