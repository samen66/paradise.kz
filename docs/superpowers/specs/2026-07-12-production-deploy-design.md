# Production-деплой paradise.kz — дизайн

Дата: 2026-07-12
Статус: утверждён (все секции согласованы в брейншторме)

## Цель

Вывести paradise.kz в production на доменах `shop.paradise.kz` (Next.js storefront:
B2C + B2B на `/b2b`) и `api.paradise.kz` (Laravel: API + Filament-админка на
`/admin`). Полный цикл: провижининг сервера, production-образы, CI/CD с откатом,
SSL, бэкапы, мониторинг, runbook.

## Принятые решения

| Вопрос | Решение |
|---|---|
| Хостинг | KZ VPS сразу (закон РК о хранении ПД; провайдер выбирается по runbook — hoster.kz / serverspace.kz / RuVDS Алматы и т.п.) |
| Способ деплоя | Docker Compose в проде (dev уже на Docker) |
| Домены | `shop` → Next.js; `api` → Laravel; админка на `api.paradise.kz/admin` |
| CI/CD | GitHub Actions: тесты → сборка образов → push в GHCR → SSH-деплой |
| Медиа | Локальный диск (docker volume) + ночные бэкапы; S3 — позже при необходимости |
| Staging | Не сейчас; структура конфигов должна позволять добавить его без переделки |

## Секция 1 — Сервер и топология

- Один VPS в Казахстане: Ubuntu 24.04 LTS, **4 vCPU / 8 GB RAM / NVMe ≥ 80 GB**.
  На одной машине живут MySQL, Redis, PHP-FPM, Next.js SSR и queue-воркеры —
  2 vCPU / 4 GB будет впритык, стартуем сразу с 4/8.
- DNS: A-записи `shop.paradise.kz` и `api.paradise.kz` → IP сервера.
- Хостовая ОС минимальна: Docker Engine + compose-plugin, `ufw` (только 22/80/443),
  `fail2ban`, non-root пользователь `deploy` в группе `docker`, SSH только по ключу,
  root-логин по паролю выключен.
- Всё приложение — один Docker Compose-стек в `/opt/paradise`.
- Nginx работает в контейнере и является единственной точкой входа (публикует
  80/443):
  - vhost `shop.paradise.kz` → proxy на контейнер `storefront` (Node, порт 3000);
  - vhost `api.paradise.kz` → PHP-FPM (`app`); статика Laravel и медиа
    (`storage/app/public`) раздаются nginx напрямую с shared volume;
  - редирект 80 → 443, gzip, security-заголовки, отдельные access/error-логи
    на каждый vhost.

## Секция 2 — Production-образы и compose

Dev-окружение (`docker-compose.yml`, dev `Dockerfile` с bind-mount кода) не
трогаем. Для прода — отдельные артефакты.

### Образ API (`docker/php/Dockerfile.prod`)

Multi-stage:
1. `composer:2` — `composer install --no-dev --optimize-autoloader`;
2. `node:22-alpine` — сборка Vite-ассетов (`npm ci && npm run build`);
3. финальный `php:8.4-fpm`: те же расширения, что в dev-образе, + включённый
   opcache (с `validate_timestamps=0`), код и `vendor/` запечены в образ,
   права `www-data`. Prod-entrypoint выполняет `config:cache`, `route:cache`,
   `view:cache`, `storage:link` на старте.

Тот же образ используется контейнерами `queue` и `scheduler` (меняется только
command).

### Образ storefront (`storefront/Dockerfile`)

1. В `next.config.ts` добавляется `output: "standalone"`.
2. Multi-stage: `node:22-alpine` build (`npm ci && npm run build`) → рантайм
   `node:22-alpine` только со standalone-выводом и статикой. `NEXT_PUBLIC_*`
   передаются как build-args (они инлайнятся при сборке):
   `NEXT_PUBLIC_API_URL=https://api.paradise.kz/api`,
   `NEXT_PUBLIC_SITE_URL=https://shop.paradise.kz`;
   `API_URL_INTERNAL=http://nginx/api` — runtime-переменная (SSR-запросы идут
   по внутренней docker-сети).

### `docker-compose.prod.yml`

Сервисы:
- `nginx` — nginx:alpine, конфиги из `deploy/nginx/`, порты 80/443, volumes:
  сертификаты, webroot для ACME, `public/` и медиа из образа API (shared volume);
- `app` — образ API, php-fpm;
- `queue` — образ API, `php artisan queue:work redis --tries=3 --max-time=3600`,
  `deploy.replicas: 2`, `restart: always`;
- `scheduler` — образ API, `php artisan schedule:work` (MoySklad-синк и прочие
  задачи расписания);
- `storefront` — образ storefront, `node server.js`;
- `mysql` — mysql:8.0, volume `mysql_data`, healthcheck;
- `redis` — redis:7-alpine, volume `redis_data`, `appendonly yes`;
- `certbot` — цикл продления сертификатов (см. Секцию 4).

Прод-`.env` (только на сервере, в репо — шаблон `.env.production.example`):
`APP_ENV=production`, `APP_DEBUG=false`, `QUEUE_CONNECTION=redis`,
`CACHE_STORE=redis`, `SESSION_DRIVER=redis`, `LOG_CHANNEL=stderr`, реквизиты
MySQL/Redis/MoySklad/почты. Образы параметризованы переменной `TAG` (git sha),
`latest` — по умолчанию.

Volumes: `mysql_data`, `redis_data`, `media` (`storage/app/public`),
`letsencrypt`, `certbot-webroot`.

## Секция 3 — CI/CD и откат

`.github/workflows/deploy.yml`, триггер — push в `main`:

1. **test** — PHPUnit (`php artisan test`) с MySQL-сервисом; сборка storefront
   (`npm ci && npm run build`) как smoke-проверка фронта.
2. **build** — docker buildx собирает оба образа и пушит в GHCR:
   `ghcr.io/samen66/paradise-api:{sha,latest}`,
   `ghcr.io/samen66/paradise-storefront:{sha,latest}`. Аутентификация — встроенный
   `GITHUB_TOKEN`.
3. **deploy** — по SSH на сервер: записать `TAG=<sha>` в `/opt/paradise/.env.deploy`,
   `docker compose pull && docker compose up -d`, затем
   `docker compose exec -T app php artisan migrate --force` и
   `docker compose exec -T app php artisan queue:restart`.

Секреты в GitHub Secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY` (отдельный deploy-ключ).

**Откат** — `.github/workflows/rollback.yml` (workflow_dispatch с input `tag`):
сервер переключается на указанный sha-тег и делает `pull && up -d`. Миграции
forward-only: откат кода не откатывает схему БД; несовместимые изменения схемы
разносим на два релиза (expand → contract).

Ограничение: `docker compose up -d` даёт секунды простоя при пересоздании
контейнеров — приемлемо для MVP, zero-downtime через реплики/blue-green не
усложняем.

## Секция 4 — SSL, бэкапы, мониторинг, runbook

### SSL
- Let's Encrypt через certbot-контейнер, webroot-челлендж (`certbot-webroot`
  volume, nginx отдаёт `/.well-known/acme-challenge/`).
- Оба домена; первичный выпуск — команда в runbook, продление — certbot-контейнер
  в цикле `renew` каждые 12 ч + `nginx -s reload`.

### Бэкапы (`deploy/scripts/backup.sh`, cron на хосте, ежедневно ночью)
- `docker compose exec -T mysql mysqldump` всей БД → gzip;
- tar медиа-volume (`storage/app/public`);
- ротация: 7 дневных + 4 недельных локально в `/opt/paradise/backups`;
- опциональный аплоад через `rclone` в S3-совместимое хранилище (endpoint
  параметризован через env; для соблюдения локализации ПД — хранилище в РК);
  выключен по умолчанию, включается одной переменной;
- в runbook — процедура тестового восстановления (раз в месяц).

### Мониторинг и логи
- UptimeRobot (free) на `https://shop.paradise.kz` и
  `https://api.paradise.kz/up` (Laravel health-роут).
- Docker log-rotation: `max-size: 10m`, `max-file: 5` для всех сервисов;
  Laravel пишет в stderr (`LOG_CHANNEL=stderr`) → `docker logs`.
- Sentry — опционально, вне скоупа этого дизайна.

### Runbook (`deploy/README.md`)
- Первичный провижининг сервера (~10 шагов: пользователь, ufw, fail2ban, Docker,
  клон repo/конфигов, `.env`, первый выпуск сертификатов, первый `up`, миграции,
  сиды/админ);
- обычный деплой (push в `main`) и ручной деплой без CI;
- откат через rollback-workflow;
- где смотреть логи (nginx, app, queue, scheduler, mysql);
- smoke-чеклист после релиза: открывается витрина, логин, создание заказа,
  админка, ручной MoySklad-синк, очередь разгребается.

## Структура новых файлов

```
deploy/
  nginx/
    shop.paradise.kz.conf
    api.paradise.kz.conf
  scripts/
    backup.sh
  README.md            # включает раздел первичного провижининга
docker/
  php/Dockerfile.prod
storefront/Dockerfile
docker-compose.prod.yml
.env.production.example
.github/workflows/deploy.yml
.github/workflows/rollback.yml
```

## Вне скоупа

- Staging-окружение (структура позволяет добавить позже вторым compose-стеком).
- S3 для медиа (Media Library поддерживает переключение диском).
- Zero-downtime/blue-green деплой.
- Sentry и продвинутый мониторинг.
- Выбор конкретного KZ-провайдера (операционное решение; дизайн — под любой
  Ubuntu 24.04 VPS).

## Критерии успеха

1. Push в `main` с зелёными тестами автоматически доезжает до прода.
2. `https://shop.paradise.kz` и `https://api.paradise.kz/admin` работают по HTTPS
   с валидными сертификатами.
3. Откат на предыдущий образ выполняется одним запуском rollback-workflow.
4. Ночной бэкап создаётся, ротируется и восстанавливается на чистой машине.
5. Очередь и планировщик (MoySklad-синк) работают без ручного вмешательства
   после перезагрузки сервера (`restart: always`).
