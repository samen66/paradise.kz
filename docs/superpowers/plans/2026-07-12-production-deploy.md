# Production Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Production-инфраструктура paradise.kz: три Docker-образа (api, nginx, storefront), prod-compose, CI/CD через GitHub Actions + GHCR с rollback-workflow, SSL, бэкапы и runbook — по спеке `docs/superpowers/specs/2026-07-12-production-deploy-design.md`.

**Architecture:** Один KZ VPS, всё приложение — Docker Compose-стек в `/opt/paradise`. Nginx — отдельный образ с запечёнными статиками Laravel (уточнение спеки №1: вместо shared-volume для `public/` — третий образ-target в том же Dockerfile; это исключает проблему устаревших файлов в volume между релизами). Медиа — shared volume. CI собирает образы и деплоит по SSH. Уточнение спеки №2: переменная `TAG` живёт в основном `/opt/paradise/.env` (а не в отдельном `.env.deploy`) — docker compose автоматически интерполирует только `.env`, один файл проще.

**Tech Stack:** Docker Compose v2, php:8.4-fpm, node:22-alpine, nginx:1.27-alpine, mysql:8.0, redis:7-alpine, certbot, GitHub Actions, GHCR.

## Global Constraints

- Образы: `ghcr.io/samen66/paradise-api`, `ghcr.io/samen66/paradise-nginx`, `ghcr.io/samen66/paradise-storefront`; теги `<git sha>` и `latest`.
- Compose project name: `paradise` (пиновано `name: paradise` — volumes получают префикс `paradise_`).
- Никаких секретов в репозитории: реальный `.env` только на сервере (`/opt/paradise/.env`), в репо — `.env.production.example`.
- PHP-образ: `php:8.4-fpm` (как в dev). Node: `node:22-alpine`.
- Пути: код в контейнерах — `/var/www/html`; на сервере стек — `/opt/paradise`.
- Сервисы compose: `nginx`, `app`, `queue`, `scheduler`, `storefront`, `mysql`, `redis`, `certbot`. FastCGI — `app:9000`, storefront — `storefront:3000`, внутренний HTTP-листенер API для SSR — `nginx:8080` (не публикуется на хост).
- Миграции forward-only; `migrate --force` выполняет deploy-job, НЕ entrypoint.
- Dev-артефакты (`Dockerfile`, `docker-compose.yml`, `docker/entrypoint.sh`, `docker/nginx/default.conf`) не изменяются.
- Существующие тесты (`php artisan test`) работают на sqlite `:memory:` — MySQL-сервис в CI не нужен.
- Локальная верификация docker-сборок обязательна перед коммитом каждого образа.

---

### Task 1: Фиксы production-сборки storefront

Прод-сборка Next.js сейчас падает тремя способами (проверено экспериментально). Чиним и фиксируем зелёную сборку без доступного API.

**Files:**
- Modify: `storefront/package.json` (+ `storefront/package-lock.json` через npm)
- Modify: `storefront/next.config.ts`
- Modify: `storefront/src/app/[locale]/layout.tsx:34-36`

**Interfaces:**
- Produces: `npm run build` в `storefront/` проходит без сетевого доступа к API; `output: "standalone"` — сборка кладёт сервер в `.next/standalone/server.js` (нужно Task 2).

- [ ] **Step 1: Добавить недостающую зависимость dayjs**

`storefront/src/app/b2b/orders/page.tsx` импортирует `dayjs`, которого нет в `package.json` (в dev скрыто ленивой компиляцией маршрутов).

```bash
cd storefront && npm install dayjs
```

Ожидаемо: в `storefront/package.json` в `dependencies` появляется `"dayjs": "^1.x"`.

- [ ] **Step 2: Починить next.config.ts под Next 16 и включить standalone**

Заменить содержимое `storefront/next.config.ts` на:

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Self-contained server bundle for the production Docker image.
  output: "standalone",
  devIndicators: false,
  images: {
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
    // Product images come from the Laravel media library (local disk in dev,
    // S3 in production) — allow both.
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8000" },
      { protocol: "http", hostname: "127.0.0.1", port: "8000" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default withNextIntl(nextConfig);
```

(`devIndicators.appIsrStatus`/`buildActivity` удалены в Next 16 — сборка падает на type-check.)

- [ ] **Step 3: Пустой generateStaticParams — рендер по требованию**

В `storefront/src/app/[locale]/layout.tsx` заменить:

```ts
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
```

на:

```ts
export function generateStaticParams() {
  // Intentionally empty: pages render on demand (on-demand ISR) so the
  // production image can be built without a reachable API. fetch-level
  // `revalidate` still caches data after the first request.
  return [];
}
```

- [ ] **Step 4: Проверить сборку без API (это и есть тест задачи)**

```bash
cd storefront && API_URL_INTERNAL=http://127.0.0.1:59999/api \
  NEXT_PUBLIC_API_URL=http://127.0.0.1:59999/api npm run build
```

Ожидаемо: `✓ Compiled successfully`, таблица маршрутов, exit code 0. Ни одной ошибки `ECONNREFUSED` (проверено: с пустым `generateStaticParams` пререндер страниц `[locale]` не выполняется).

- [ ] **Step 5: Проверить, что dev-режим не сломан**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/ru
```

Ожидаемо: `200` (dev-стек в docker compose должен быть запущен; если не запущен — пропустить с пометкой в отчёте).

- [ ] **Step 6: Commit**

```bash
git add storefront/package.json storefront/package-lock.json storefront/next.config.ts "storefront/src/app/[locale]/layout.tsx"
git commit -m "fix(storefront): make production build pass without a reachable API"
```

---

### Task 2: Production-образ storefront

**Files:**
- Create: `storefront/Dockerfile`
- Create: `storefront/.dockerignore`

**Interfaces:**
- Consumes: `output: "standalone"` из Task 1.
- Produces: образ `paradise-storefront`; слушает `:3000`; build-args `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`; runtime-env `API_URL_INTERNAL`. Используется в Task 5 (compose) и Task 7 (CI).

- [ ] **Step 1: Создать `storefront/.dockerignore`**

```
node_modules
.next
.env*
npm-debug.log*
tsconfig.tsbuildinfo
```

- [ ] **Step 2: Создать `storefront/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* are inlined at build time.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 3: Собрать образ локально**

```bash
cd storefront && docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.paradise.kz/api \
  --build-arg NEXT_PUBLIC_SITE_URL=https://shop.paradise.kz \
  -t paradise-storefront:test .
```

Ожидаемо: успешная сборка (build-стадия не требует доступного API — гарантировано Task 1).

- [ ] **Step 4: Смоук-тест контейнера**

```bash
docker run -d --rm --name sf-test -p 3100:3000 \
  -e API_URL_INTERNAL=http://127.0.0.1:59999/api paradise-storefront:test
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/ru
docker stop sf-test
```

Ожидаемо: HTTP-код `200` или `500` (страница может показать ошибку данных без API), но НЕ connection refused — сервер поднялся и отвечает.

- [ ] **Step 5: Commit**

```bash
git add storefront/Dockerfile storefront/.dockerignore
git commit -m "feat(deploy): add production Dockerfile for the Next.js storefront"
```

---

### Task 3: Production-образ API (php-fpm)

**Files:**
- Create: `docker/php/Dockerfile.prod`
- Create: `docker/php/opcache.ini`
- Create: `docker/php/entrypoint.prod.sh`
- Create: `.dockerignore` (корень репо)

**Interfaces:**
- Produces: образ `paradise-api` (target `app`): код + vendor + Vite-ассеты запечены, entrypoint кеширует config/route/view и делает `storage:link`, php-fpm на `:9000`. Стадия `app` также источник `public/` для nginx-target (Task 4 дополняет ЭТОТ ЖЕ Dockerfile стадией `nginx`). Task 5/7 используют образ.

- [ ] **Step 1: Создать корневой `.dockerignore`**

```
.git
.github
.idea
.vscode
node_modules
vendor
storefront
frontend
docs
tests
storage/app/public/*
storage/framework/cache/*
storage/framework/sessions/*
storage/framework/views/*
storage/logs/*
.env
.env.*
!.env.example
public/build
public/storage
database/database.sqlite
*.md
!README.md
.agents
.ai
.claude
.junie
boost.json
```

(Не влияет на dev: dev-`Dockerfile` копирует только `docker/entrypoint.sh`.)

- [ ] **Step 2: Создать `docker/php/opcache.ini`**

```ini
opcache.enable=1
opcache.enable_cli=1
opcache.memory_consumption=192
opcache.interned_strings_buffer=16
opcache.max_accelerated_files=20000
; Code is baked into the image — never re-stat files on disk.
opcache.validate_timestamps=0
```

- [ ] **Step 3: Создать `docker/php/entrypoint.prod.sh`**

```sh
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
```

- [ ] **Step 4: Создать `docker/php/Dockerfile.prod`**

```dockerfile
# syntax=docker/dockerfile:1

# ---- Stage 1: Vite assets (public/build) --------------------------------
FROM node:22-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json vite.config.js ./
RUN npm ci --ignore-scripts
COPY resources/ resources/
RUN mkdir -p public && npm run build

# ---- Stage 2: Composer dependencies (no scripts: no PHP runtime needed) --
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist \
    --no-autoloader --no-scripts --ignore-platform-reqs

# ---- Stage 3: Application image ------------------------------------------
FROM php:8.4-fpm AS app

RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libjpeg62-turbo-dev \
    libwebp-dev \
    libfreetype6-dev \
    libzip-dev \
    libonig-dev \
    libicu-dev \
    default-mysql-client \
    && docker-php-ext-configure gd --with-jpeg --with-webp --with-freetype \
    && docker-php-ext-install \
        pdo_mysql \
        mbstring \
        bcmath \
        pcntl \
        zip \
        exif \
        intl \
        gd \
        opcache \
    && pecl install redis && docker-php-ext-enable redis \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY docker/php/opcache.ini /usr/local/etc/php/conf.d/zz-opcache.ini
RUN echo "memory_limit=512M" > /usr/local/etc/php/conf.d/zz-app.ini

WORKDIR /var/www/html

COPY --from=vendor /app/vendor vendor/
COPY . .
COPY --from=assets /app/public/build public/build

# post-autoload-dump runs artisan (package:discover, filament:upgrade) — it
# needs a bootable app, so give it a throwaway .env and drop it afterwards.
RUN cp .env.example .env \
    && php artisan key:generate --force \
    && composer dump-autoload --optimize --no-dev \
    && rm .env \
    && chown -R www-data:www-data storage bootstrap/cache

COPY docker/php/entrypoint.prod.sh /usr/local/bin/entrypoint.prod.sh
RUN chmod +x /usr/local/bin/entrypoint.prod.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.prod.sh"]
CMD ["php-fpm"]
```

Примечание: `REDIS_CLIENT=phpredis` в `.env.example` требует расширение `redis` — dev-образ его не ставит (dev на database-драйверах), prod ставит через pecl.

- [ ] **Step 5: Собрать и проверить образ**

```bash
docker build -f docker/php/Dockerfile.prod --target app -t paradise-api:test .
docker run --rm paradise-api:test php -m | grep -E "redis|opcache|intl|gd"
docker run --rm --entrypoint php paradise-api:test artisan --version
```

Ожидаемо: сборка успешна; в списке модулей есть `redis`, `Zend OPcache`, `intl`, `gd`; artisan печатает версию Laravel (entrypoint обойдён — без БД он бы ждал MySQL).

- [ ] **Step 6: Commit**

```bash
git add .dockerignore docker/php/Dockerfile.prod docker/php/opcache.ini docker/php/entrypoint.prod.sh
git commit -m "feat(deploy): add production php-fpm image for the Laravel API"
```

---

### Task 4: Nginx-конфиги и nginx-образ

**Files:**
- Create: `deploy/nginx/api.paradise.kz.conf`
- Create: `deploy/nginx/shop.paradise.kz.conf`
- Modify: `docker/php/Dockerfile.prod` (добавить стадию `nginx` в конец)

**Interfaces:**
- Consumes: стадию `app` из Task 3 (источник `/var/www/html/public`).
- Produces: образ `paradise-nginx` (target `nginx`): vhosts 443 для обоих доменов, ACME-webroot `/var/www/certbot`, сертификаты в `/etc/letsencrypt`, внутренний листенер `:8080` для SSR, медиа-alias на volume-путь `/var/www/html/storage/app/public`. Используется в Task 5/7.

- [ ] **Step 1: Создать `deploy/nginx/api.paradise.kz.conf`**

```nginx
# HTTP: ACME challenge + redirect to HTTPS.
server {
    listen 80;
    server_name api.paradise.kz;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# Internal-only listener for SSR requests from the storefront container.
# Port 8080 is not published on the host.
server {
    listen 8080;
    server_name _;
    root /var/www/html/public;
    index index.php;
    client_max_body_size 25M;

    location /storage/ {
        alias /var/www/html/storage/app/public/;
        expires 7d;
        access_log off;
    }

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass app:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
}

# Public HTTPS API + Filament admin.
server {
    listen 443 ssl;
    http2 on;
    server_name api.paradise.kz;
    root /var/www/html/public;
    index index.php;
    client_max_body_size 25M;

    ssl_certificate /etc/letsencrypt/live/api.paradise.kz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.paradise.kz/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    access_log /var/log/nginx/api.access.log;
    error_log /var/log/nginx/api.error.log;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Media library files (shared docker volume).
    location /storage/ {
        alias /var/www/html/storage/app/public/;
        expires 7d;
        access_log off;
    }

    # Vite-built assets are content-hashed — cache forever.
    location /build/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass app:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        # Laravel must see the request as HTTPS (signed URLs, asset(), redirects).
        fastcgi_param HTTPS on;
        include fastcgi_params;
        fastcgi_read_timeout 120s;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

- [ ] **Step 2: Создать `deploy/nginx/shop.paradise.kz.conf`**

```nginx
# HTTP: ACME challenge + redirect to HTTPS.
server {
    listen 80;
    server_name shop.paradise.kz;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# Next.js storefront (B2C + B2B under /b2b).
server {
    listen 443 ssl;
    http2 on;
    server_name shop.paradise.kz;

    ssl_certificate /etc/letsencrypt/live/shop.paradise.kz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shop.paradise.kz/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    access_log /var/log/nginx/shop.access.log;
    error_log /var/log/nginx/shop.error.log;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://storefront:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }
}
```

- [ ] **Step 3: Добавить стадию `nginx` в конец `docker/php/Dockerfile.prod`**

```dockerfile
# ---- Stage 4: Nginx with baked Laravel public/ ---------------------------
FROM nginx:1.27-alpine AS nginx
COPY deploy/nginx/api.paradise.kz.conf /etc/nginx/conf.d/api.paradise.kz.conf
COPY deploy/nginx/shop.paradise.kz.conf /etc/nginx/conf.d/shop.paradise.kz.conf
RUN rm -f /etc/nginx/conf.d/default.conf
COPY --from=app /var/www/html/public /var/www/html/public
```

- [ ] **Step 4: Собрать nginx-образ и проверить конфиг с dummy-сертификатами**

```bash
docker build -f docker/php/Dockerfile.prod --target nginx -t paradise-nginx:test .

CERTS=/private/tmp/claude-502/-Users-samenuatkhan-PhpstormProjects-paradise-kz/c6228a02-ac16-4a90-bebd-c4fde7c29ddf/scratchpad/nginx-test-certs
for d in api.paradise.kz shop.paradise.kz; do
  mkdir -p "$CERTS/live/$d"
  openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=$d" \
    -keyout "$CERTS/live/$d/privkey.pem" -out "$CERTS/live/$d/fullchain.pem" 2>/dev/null
done

docker run --rm \
  --add-host app:127.0.0.1 --add-host storefront:127.0.0.1 \
  -v "$CERTS:/etc/letsencrypt:ro" \
  paradise-nginx:test nginx -t
```

Ожидаемо: `syntax is ok` и `test is successful`. (`--add-host` нужен, потому что nginx резолвит `app`/`storefront` при проверке конфига.)

- [ ] **Step 5: Commit**

```bash
git add deploy/nginx/api.paradise.kz.conf deploy/nginx/shop.paradise.kz.conf docker/php/Dockerfile.prod
git commit -m "feat(deploy): add production nginx vhosts and nginx image stage"
```

---

### Task 5: docker-compose.prod.yml и .env.production.example

**Files:**
- Create: `docker-compose.prod.yml`
- Create: `.env.production.example`

**Interfaces:**
- Consumes: образы из Task 2–4 (`paradise-api`, `paradise-nginx`, `paradise-storefront`), внутренний листенер `nginx:8080`.
- Produces: сервисы/volumes для Task 6 (backup: volume `paradise_media`, контейнер `mysql` с `MYSQL_ROOT_PASSWORD`) и Task 7/8 (deploy: `docker compose -f docker-compose.prod.yml ...`, переменная `TAG` в `/opt/paradise/.env`).

- [ ] **Step 1: Создать `docker-compose.prod.yml`**

```yaml
# Production stack. Lives on the server at /opt/paradise together with a real
# .env (see .env.production.example). Images are built by CI and pulled from
# GHCR; TAG is set by the deploy workflow (git sha) and defaults to latest.
name: paradise

x-logging: &default-logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"

x-app-image: &app-image
  image: ghcr.io/samen66/paradise-api:${TAG:-latest}
  restart: always
  env_file: .env
  volumes:
    - media:/var/www/html/storage/app/public
  depends_on:
    mysql:
      condition: service_healthy
    redis:
      condition: service_started
  logging: *default-logging

services:
  nginx:
    image: ghcr.io/samen66/paradise-nginx:${TAG:-latest}
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - media:/var/www/html/storage/app/public:ro
      - letsencrypt:/etc/letsencrypt:ro
      - certbot-webroot:/var/www/certbot:ro
    depends_on:
      - app
      - storefront
    logging: *default-logging
    # Reload every 6h so renewed certificates get picked up.
    command: ["/bin/sh", "-c", "while :; do sleep 6h & wait $${!}; nginx -s reload; done & exec nginx -g 'daemon off;'"]

  app:
    <<: *app-image

  queue:
    <<: *app-image
    command: ["php", "artisan", "queue:work", "redis", "--tries=3", "--max-time=3600"]
    deploy:
      replicas: 2

  scheduler:
    <<: *app-image
    command: ["php", "artisan", "schedule:work"]

  storefront:
    image: ghcr.io/samen66/paradise-storefront:${TAG:-latest}
    restart: always
    environment:
      # SSR requests go over the docker network through nginx's internal
      # listener (port 8080, not published on the host).
      API_URL_INTERNAL: http://nginx:8080/api
    logging: *default-logging

  mysql:
    image: mysql:8.0
    restart: always
    environment:
      MYSQL_DATABASE: ${DB_DATABASE}
      MYSQL_USER: ${DB_USERNAME}
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 10
    logging: *default-logging

  redis:
    image: redis:7-alpine
    restart: always
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redis_data:/data
    logging: *default-logging

  certbot:
    image: certbot/certbot
    restart: always
    volumes:
      - letsencrypt:/etc/letsencrypt
      - certbot-webroot:/var/www/certbot
    # Renew loop; nginx reloads itself every 6h (see nginx command).
    entrypoint: ["/bin/sh", "-c", "trap exit TERM; while :; do certbot renew --webroot -w /var/www/certbot --quiet; sleep 12h & wait $${!}; done"]
    logging: *default-logging

volumes:
  mysql_data:
  redis_data:
  media:
  letsencrypt:
  certbot-webroot:
```

- [ ] **Step 2: Создать `.env.production.example`**

```bash
# Production environment template. Copy to /opt/paradise/.env on the server
# and fill in real values. This same file feeds both Laravel (env_file) and
# docker compose variable interpolation (TAG, DB_*).

# --- Deploy ---------------------------------------------------------------
# Image tag to run; the deploy workflow rewrites this line with the git sha.
TAG=latest

APP_NAME=Paradise
APP_ENV=production
# Generate on the server: docker compose -f docker-compose.prod.yml run --rm app php artisan key:generate --show
APP_KEY=
APP_DEBUG=false
APP_URL=https://api.paradise.kz

APP_LOCALE=ru
APP_FALLBACK_LOCALE=ru
APP_FAKER_LOCALE=en_US

APP_MAINTENANCE_DRIVER=file
BCRYPT_ROUNDS=12

LOG_CHANNEL=stderr
LOG_LEVEL=warning

DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=paradise
DB_USERNAME=paradise
DB_PASSWORD=
# Used only by the mysql container and backup script.
DB_ROOT_PASSWORD=

SESSION_DRIVER=redis
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null
SESSION_SECURE_COOKIE=true

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=redis
CACHE_STORE=redis

# Disk that mirrored MoySklad product images are stored on.
MEDIA_DISK=public

REDIS_CLIENT=phpredis
REDIS_HOST=redis
REDIS_PASSWORD=null
REDIS_PORT=6379

MAIL_MAILER=log
MAIL_FROM_ADDRESS="hello@paradise.kz"
MAIL_FROM_NAME="${APP_NAME}"

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_USE_PATH_STYLE_ENDPOINT=false

# --- ERP / MoySklad --------------------------------------------------------
ERP_PROVIDER=moysklad
MOYSKLAD_BASE_URL=https://api.moysklad.ru/api/remap/1.2
MOYSKLAD_TOKEN=
MOYSKLAD_LOGIN=
MOYSKLAD_PASSWORD=
MOYSKLAD_ORGANIZATION_HREF=
MOYSKLAD_B2B_PRICE_TYPE_ID=
MOYSKLAD_VAT_PERCENT=12
MOYSKLAD_WEBHOOK_SECRET=

# --- Backups (optional off-site upload via rclone) --------------------------
# Leave empty to keep backups local-only. Example: "kzs3:paradise-backups"
BACKUP_RCLONE_REMOTE=
```

- [ ] **Step 3: Проверить compose-файл**

```bash
SCRATCH=/private/tmp/claude-502/-Users-samenuatkhan-PhpstormProjects-paradise-kz/c6228a02-ac16-4a90-bebd-c4fde7c29ddf/scratchpad/compose-check
mkdir -p "$SCRATCH" && cp docker-compose.prod.yml "$SCRATCH/" && cp .env.production.example "$SCRATCH/.env"
sed -i '' 's/^DB_PASSWORD=$/DB_PASSWORD=x/; s/^DB_ROOT_PASSWORD=$/DB_ROOT_PASSWORD=x/' "$SCRATCH/.env"
docker compose -f "$SCRATCH/docker-compose.prod.yml" --project-directory "$SCRATCH" config >/dev/null && echo COMPOSE_OK
```

Ожидаемо: `COMPOSE_OK` без ворнингов об отсутствующих переменных.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.prod.yml .env.production.example
git commit -m "feat(deploy): add production compose stack and env template"
```

---

### Task 6: Скрипт бэкапов

**Files:**
- Create: `deploy/scripts/backup.sh`

**Interfaces:**
- Consumes: сервис `mysql` (env `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE` внутри контейнера), volume `paradise_media`, `/opt/paradise/.env` (ключ `BACKUP_RCLONE_REMOTE`).
- Produces: файлы `/opt/paradise/backups/daily/{db,media}-YYYY-MM-DD.{sql.gz,tar.gz}` и `weekly/`. Запускается host-cron'ом (строка — в Task 9 runbook).

- [ ] **Step 1: Создать `deploy/scripts/backup.sh`**

```bash
#!/usr/bin/env bash
# Nightly backup: MySQL dump + media volume tarball.
# Retention: 7 daily + 4 weekly (copied on Sundays). Optional off-site upload
# via rclone when BACKUP_RCLONE_REMOTE is set in /opt/paradise/.env.
# Cron (root): 30 3 * * * /opt/paradise/deploy/scripts/backup.sh >> /var/log/paradise-backup.log 2>&1
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/paradise}"
BACKUP_DIR="$APP_DIR/backups"
COMPOSE=(docker compose -f "$APP_DIR/docker-compose.prod.yml" --project-directory "$APP_DIR")
STAMP="$(date +%F)"

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"

# --- MySQL dump (credentials come from the container's own environment) ----
"${COMPOSE[@]}" exec -T mysql sh -c \
  'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --quick --routines --triggers "$MYSQL_DATABASE"' \
  | gzip > "$BACKUP_DIR/daily/db-$STAMP.sql.gz"

# --- Media volume -----------------------------------------------------------
docker run --rm \
  -v paradise_media:/data:ro \
  -v "$BACKUP_DIR/daily":/backup \
  alpine tar czf "/backup/media-$STAMP.tar.gz" -C /data .

# --- Weekly copies (Sundays) ------------------------------------------------
if [ "$(date +%u)" = "7" ]; then
    cp "$BACKUP_DIR/daily/db-$STAMP.sql.gz" "$BACKUP_DIR/weekly/"
    cp "$BACKUP_DIR/daily/media-$STAMP.tar.gz" "$BACKUP_DIR/weekly/"
fi

# --- Retention ---------------------------------------------------------------
find "$BACKUP_DIR/daily" -type f -mtime +7 -delete
find "$BACKUP_DIR/weekly" -type f -mtime +28 -delete

# --- Optional off-site upload (S3-compatible storage in Kazakhstan) ----------
RCLONE_REMOTE="$(grep -E '^BACKUP_RCLONE_REMOTE=' "$APP_DIR/.env" | cut -d= -f2- || true)"
if [ -n "$RCLONE_REMOTE" ] && command -v rclone >/dev/null; then
    rclone copy "$BACKUP_DIR/daily/db-$STAMP.sql.gz" "$RCLONE_REMOTE/daily/"
    rclone copy "$BACKUP_DIR/daily/media-$STAMP.tar.gz" "$RCLONE_REMOTE/daily/"
fi

echo "[$(date -Is)] backup complete: db-$STAMP.sql.gz, media-$STAMP.tar.gz"
```

- [ ] **Step 2: Проверить синтаксис и сделать исполняемым**

```bash
chmod +x deploy/scripts/backup.sh
bash -n deploy/scripts/backup.sh && echo SYNTAX_OK
command -v shellcheck >/dev/null && shellcheck deploy/scripts/backup.sh || echo "shellcheck not installed — skipped"
```

Ожидаемо: `SYNTAX_OK`; shellcheck (если установлен) без ошибок уровня error.

- [ ] **Step 3: Commit**

```bash
git add deploy/scripts/backup.sh
git commit -m "feat(deploy): add nightly db+media backup script with retention"
```

---

### Task 7: CI/CD workflow (deploy.yml)

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: Dockerfile'ы из Task 2–4; compose-файл и переменную `TAG` из Task 5.
- Produces: на push в `main` — тесты → образы в GHCR (`:sha` + `:latest`) → SSH-деплой (`sed TAG` → `pull` → `up -d` → `migrate --force` → `queue:restart`). GitHub Secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY`.

- [ ] **Step 1: Создать `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]

concurrency:
  group: production-deploy
  cancel-in-progress: false

env:
  REGISTRY: ghcr.io
  API_IMAGE: ghcr.io/samen66/paradise-api
  NGINX_IMAGE: ghcr.io/samen66/paradise-nginx
  STOREFRONT_IMAGE: ghcr.io/samen66/paradise-storefront

jobs:
  test-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with:
          php-version: "8.4"
          extensions: mbstring, bcmath, intl, gd, zip, exif, pcntl, pdo_sqlite
          coverage: none
      - run: composer install --no-interaction --prefer-dist
      - run: cp .env.example .env && php artisan key:generate
      - run: php artisan test --compact

  test-storefront:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: storefront
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: storefront/package-lock.json
      - run: npm ci
      # The build must succeed with no reachable API (empty
      # generateStaticParams — pages render on demand).
      - run: npm run build
        env:
          API_URL_INTERNAL: http://127.0.0.1:1/api
          NEXT_PUBLIC_API_URL: https://api.paradise.kz/api
          NEXT_PUBLIC_SITE_URL: https://shop.paradise.kz

  build:
    runs-on: ubuntu-latest
    needs: [test-api, test-storefront]
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build & push API image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: docker/php/Dockerfile.prod
          target: app
          push: true
          tags: |
            ${{ env.API_IMAGE }}:${{ github.sha }}
            ${{ env.API_IMAGE }}:latest
          cache-from: type=gha,scope=api
          cache-to: type=gha,scope=api,mode=max

      - name: Build & push nginx image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: docker/php/Dockerfile.prod
          target: nginx
          push: true
          tags: |
            ${{ env.NGINX_IMAGE }}:${{ github.sha }}
            ${{ env.NGINX_IMAGE }}:latest
          cache-from: type=gha,scope=api
          cache-to: type=gha,scope=api,mode=max

      - name: Build & push storefront image
        uses: docker/build-push-action@v6
        with:
          context: storefront
          push: true
          build-args: |
            NEXT_PUBLIC_API_URL=https://api.paradise.kz/api
            NEXT_PUBLIC_SITE_URL=https://shop.paradise.kz
          tags: |
            ${{ env.STOREFRONT_IMAGE }}:${{ github.sha }}
            ${{ env.STOREFRONT_IMAGE }}:latest
          cache-from: type=gha,scope=storefront
          cache-to: type=gha,scope=storefront,mode=max

  deploy:
    runs-on: ubuntu-latest
    needs: build
    permissions:
      contents: read
      packages: read
    steps:
      - name: Deploy over SSH
        uses: appleboy/ssh-action@v1
        env:
          GHCR_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GHCR_USER: ${{ github.actor }}
          GIT_SHA: ${{ github.sha }}
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          envs: GHCR_TOKEN,GHCR_USER,GIT_SHA
          script: |
            set -e
            cd /opt/paradise
            echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
            sed -i "s/^TAG=.*/TAG=$GIT_SHA/" .env
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d --remove-orphans
            docker compose -f docker-compose.prod.yml exec -T app php artisan migrate --force
            docker compose -f docker-compose.prod.yml exec -T app php artisan queue:restart
            docker image prune -f
```

- [ ] **Step 2: Проверить workflow линтером**

```bash
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest -color .github/workflows/deploy.yml \
  || python3 -c "import yaml,sys;yaml.safe_load(open('.github/workflows/deploy.yml'));print('YAML_OK')"
```

Ожидаемо: actionlint без ошибок (или, если образ недоступен офлайн, `YAML_OK` от парсера).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add test/build/deploy pipeline to GHCR and production server"
```

---

### Task 8: Rollback workflow

**Files:**
- Create: `.github/workflows/rollback.yml`

**Interfaces:**
- Consumes: серверный стек из Task 5 (`TAG` в `/opt/paradise/.env`), образы в GHCR из Task 7.
- Produces: ручной workflow с input `tag` (git sha предыдущего релиза), переключающий прод на этот тег. Без миграций (схема forward-only).

- [ ] **Step 1: Создать `.github/workflows/rollback.yml`**

```yaml
name: Rollback

on:
  workflow_dispatch:
    inputs:
      tag:
        description: "Image tag to roll back to (git sha of a previous deploy)"
        required: true

concurrency:
  group: production-deploy
  cancel-in-progress: false

jobs:
  rollback:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: read
    steps:
      - name: Switch production to the given tag
        uses: appleboy/ssh-action@v1
        env:
          GHCR_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GHCR_USER: ${{ github.actor }}
          TARGET_TAG: ${{ inputs.tag }}
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          envs: GHCR_TOKEN,GHCR_USER,TARGET_TAG
          script: |
            set -e
            cd /opt/paradise
            echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
            sed -i "s/^TAG=.*/TAG=$TARGET_TAG/" .env
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d --remove-orphans
            docker compose -f docker-compose.prod.yml exec -T app php artisan queue:restart
            # Migrations are forward-only by convention — intentionally not run here.
```

- [ ] **Step 2: Проверить линтером**

```bash
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest -color .github/workflows/rollback.yml \
  || python3 -c "import yaml,sys;yaml.safe_load(open('.github/workflows/rollback.yml'));print('YAML_OK')"
```

Ожидаемо: без ошибок / `YAML_OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/rollback.yml
git commit -m "ci: add manual rollback workflow (switch prod to a previous image tag)"
```

---

### Task 9: Runbook (deploy/README.md)

**Files:**
- Create: `deploy/README.md`

**Interfaces:**
- Consumes: всё из Task 1–8 (имена файлов, сервисов, секретов — использовать точно такими же).
- Produces: единственный операционный документ для провижининга и эксплуатации.

- [ ] **Step 1: Создать `deploy/README.md`**

Документ обязан содержать разделы ниже (писать полноценным текстом, команды — точными, из этого плана; это не заглушки, а содержание):

```markdown
# Paradise.kz — production runbook

## 1. Архитектура
[Диаграмма стека: nginx (80/443) → storefront:3000 / app:9000; mysql, redis,
queue ×2, scheduler, certbot; volumes: mysql_data, redis_data, media,
letsencrypt, certbot-webroot. Образы из ghcr.io/samen66/*, тег = git sha.]

## 2. Первичный провижининг (один раз)
1. VPS: Ubuntu 24.04, 4 vCPU / 8 GB / NVMe ≥ 80 GB, KZ-датацентр.
2. DNS: A-записи shop.paradise.kz и api.paradise.kz → IP сервера.
3. Пользователь: adduser deploy && usermod -aG sudo,docker deploy;
   SSH-ключи, PasswordAuthentication no, PermitRootLogin no.
4. Firewall: ufw allow 22,80,443/tcp && ufw enable. fail2ban: apt install
   fail2ban (дефолтный sshd-джейл достаточен).
5. Docker: официальный get.docker.com скрипт + docker compose plugin.
6. mkdir -p /opt/paradise && скопировать docker-compose.prod.yml, deploy/
   на сервер (scp или git clone).
7. cp .env.production.example → /opt/paradise/.env, заполнить: пароли БД,
   APP_KEY (docker compose -f docker-compose.prod.yml run --rm app php
   artisan key:generate --show), MOYSKLAD_*.
8. Бутстрап SSL (курица-и-яйцо: nginx не стартует без сертификатов).
   Точные команды, которые должны попасть в README:

   ```bash
   # 8.1 Self-signed заглушки в volume letsencrypt, чтобы nginx поднялся:
   for d in api.paradise.kz shop.paradise.kz; do
     docker run --rm -v paradise_letsencrypt:/etc/letsencrypt alpine/openssl req \
       -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=$d" \
       -keyout /etc/letsencrypt/live/$d/privkey.pem \
       -out /etc/letsencrypt/live/$d/fullchain.pem 2>/dev/null || {
         docker run --rm -v paradise_letsencrypt:/etc/letsencrypt alpine sh -c \
           "mkdir -p /etc/letsencrypt/live/$d && apk add -q openssl && openssl req \
            -x509 -newkey rsa:2048 -nodes -days 1 -subj '/CN=$d' \
            -keyout /etc/letsencrypt/live/$d/privkey.pem \
            -out /etc/letsencrypt/live/$d/fullchain.pem"
       }
   done

   # 8.2 Поднять весь стек (nginx стартует на заглушках):
   docker compose -f docker-compose.prod.yml up -d

   # 8.3 Выпустить настоящие сертификаты (DNS уже должен указывать на сервер):
   for d in api.paradise.kz shop.paradise.kz; do
     docker compose -f docker-compose.prod.yml run --rm certbot certonly \
       --webroot -w /var/www/certbot --force-renewal \
       -d $d --email admin@paradise.kz --agree-tos --no-eff-email
   done

   # 8.4 Перечитать сертификаты:
   docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
   ```
9. Первый запуск приложения: docker login ghcr.io (PAT c read:packages либо
   дождаться первого CI-деплоя),
   docker compose -f docker-compose.prod.yml exec -T app php artisan migrate --force,
   создать админа Filament:
   docker compose -f docker-compose.prod.yml exec app php artisan make:filament-user.
10. Cron бэкапов (root): 30 3 * * * /opt/paradise/deploy/scripts/backup.sh
    >> /var/log/paradise-backup.log 2>&1
11. GitHub Secrets: SSH_HOST, SSH_USER=deploy, SSH_KEY (отдельный ключ).
12. UptimeRobot: https://shop.paradise.kz и https://api.paradise.kz/up.

## 3. Обычный деплой
Push в main → CI сам тестирует, собирает, деплоит. Ручной деплой без CI
(README должен содержать эти команды дословно):

```bash
cd /opt/paradise
sed -i "s/^TAG=.*/TAG=<git-sha-или-latest>/" .env
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans
docker compose -f docker-compose.prod.yml exec -T app php artisan migrate --force
docker compose -f docker-compose.prod.yml exec -T app php artisan queue:restart
```

## 4. Откат
GitHub → Actions → Rollback → Run workflow → указать sha предыдущего
успешного деплоя (виден в истории Deploy-ранов). Миграции не откатываются.

## 5. Логи
docker compose -f docker-compose.prod.yml logs -f app|queue|scheduler|nginx|mysql
Nginx per-vhost: docker compose exec nginx tail -f /var/log/nginx/api.error.log

## 6. Бэкапы и восстановление
Где лежат, как восстановить БД (gunzip | docker compose exec -T mysql mysql
-uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE") и медиа (tar xzf в volume
через docker run). Ежемесячный тест восстановления — чеклист.

## 7. Smoke-чеклист после релиза
- [ ] https://shop.paradise.kz/ru открывается, каталог грузится
- [ ] Логин покупателя (OTP) работает
- [ ] Создание заказа проходит
- [ ] https://api.paradise.kz/admin — вход в Filament
- [ ] Ручной MoySklad-синк из админки / artisan
- [ ] docker compose logs queue — джобы разгребаются, без ошибок
- [ ] https://api.paradise.kz/up → 200
```

- [ ] **Step 2: Вычитка перекрёстных ссылок**

Проверить, что каждое имя файла/сервиса/секрета в README дословно совпадает с Task 1–8 (сервисы `app|queue|scheduler|nginx|mysql|redis|certbot|storefront`, секреты `SSH_HOST|SSH_USER|SSH_KEY`, путь `/opt/paradise`, cron-строка из Task 6).

- [ ] **Step 3: Commit**

```bash
git add deploy/README.md
git commit -m "docs(deploy): add production runbook"
```

---

## Порядок и зависимости

```
Task 1 → Task 2 ─┐
Task 3 → Task 4 ─┼→ Task 5 → Task 6 → Task 7 → Task 8 → Task 9
```

Task 1–2 и Task 3–4 — независимые пары (можно параллельно), дальше строго последовательно.

## Что сознательно НЕ делаем (из спеки)

Staging, S3 для медиа, zero-downtime/blue-green, Sentry, выбор конкретного KZ-провайдера. `docker compose up -d` даёт секунды простоя при пересоздании контейнеров — принято.
