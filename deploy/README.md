# Paradise.kz — production runbook

## 1. Архитектура

Продакшн-стек описан в `docker-compose.prod.yml` (Compose-проект называется
`paradise`) и живёт на одном VPS в `/opt/paradise`. Внешний трафик на портах
80/443 принимает контейнер `nginx`, который терминирует TLS и разводит запросы
по четырём вертикалям:

- `shop.paradise.kz` — Next.js-витрина (B2C) в контейнере `storefront`,
  слушающем порт 3000 (SSR-запросы storefront делает обратно через nginx на
  внутренний, не публикуемый наружу порт 8080);
- `b2b.paradise.kz` — Next.js-портал для магазинов-партнёров (B2B) в
  контейнере `b2b-portal`, порт 3000; SSR-запросы — так же через nginx:8080;
- `api.paradise.kz` — Laravel-приложение (API + админка Filament) в
  контейнере `app`, PHP-FPM на порту 9000;
- `admin.paradise.kz` — Next.js-админка менеджера (заказы, товары, остатки,
  одобрение B2B-клиентов) в контейнере `admin`, порт 3000. Она целиком
  клиентская: браузер ходит в `https://api.paradise.kz/api` с bearer-токеном,
  поэтому origin `https://admin.paradise.kz` обязан быть в
  `CORS_ALLOWED_ORIGINS` (см. шаг 7).

Помимо `nginx`, `app`, `storefront`, `b2b-portal` и `admin` в стеке есть:

- `mysql` (MySQL 8.0) — основная база данных;
- `redis` (Redis 7) — очереди, кэш, сессии;
- `queue` — тот же образ, что и `app`, но с командой `queue:work`, поднят в
  двух репликах (`deploy.replicas: 2`);
- `scheduler` — тот же образ `app`, но с `schedule:work`, обслуживает cron-задачи
  Laravel;
- `certbot` — фоновый цикл `certbot renew`, обновляет сертификаты Let's
  Encrypt каждые 12 часов; сам `nginx` перечитывает конфигурацию каждые 6
  часов, чтобы подхватить обновлённые сертификаты.

Именованные тома (volumes) Docker:

- `mysql_data` — данные MySQL;
- `redis_data` — данные Redis (append-only файл);
- `media` — файлы Spatie Media Library, общие для `app` и `nginx` (раздача
  `/storage/...` напрямую через nginx, без PHP);
- `letsencrypt` — сертификаты и ключи Let's Encrypt (`/etc/letsencrypt`);
- `certbot-webroot` — webroot для ACME HTTP-01 challenge, общий для `nginx` и
  `certbot`.

Так как Compose-проект называется `paradise`, реальные имена томов на диске —
с префиксом `paradise_`, например `paradise_letsencrypt`, `paradise_media`
(это важно при обращении к тому напрямую через `docker run -v`, см. разделы
2 и 6).

Образы собираются в CI и публикуются в GitHub Container Registry:

- `ghcr.io/samen66/paradise-api:${TAG:-latest}` — используется контейнерами
  `app`, `queue`, `scheduler`;
- `ghcr.io/samen66/paradise-nginx:${TAG:-latest}`;
- `ghcr.io/samen66/paradise-storefront:${TAG:-latest}`;
- `ghcr.io/samen66/paradise-b2b-portal:${TAG:-latest}`;
- `ghcr.io/samen66/paradise-admin:${TAG:-latest}`.

Тег `TAG` — это git sha коммита в `main`, который собрала и задеплоила CI;
по умолчанию (если переменная не задана) используется `latest`. Значение
`TAG` хранится строкой в `/opt/paradise/.env` и переписывается деплой-скриптом
при каждом релизе (см. раздел 3).

## 2. Первичный провижининг (один раз)

1. **VPS.** Ubuntu 24.04, 4 vCPU / 8 GB RAM / NVMe ≥ 80 GB, датацентр в
   Казахстане (для низкой задержки к покупателям и соответствия ожиданиям по
   локации данных).

2. **DNS.** Создать A-записи `shop.paradise.kz`, `b2b.paradise.kz`,
   `api.paradise.kz` и `admin.paradise.kz`, указывающие на IP сервера. Это
   нужно сделать заранее — все домены участвуют в выпуске сертификатов
   Let's Encrypt на шаге 8.

3. **Пользователь для деплоя.**

   ```bash
   adduser deploy && usermod -aG sudo,docker deploy
   ```

   Настроить вход по SSH-ключу для `deploy`, затем отключить вход по паролю и
   вход под root: `PasswordAuthentication no`, `PermitRootLogin no` в
   `/etc/ssh/sshd_config`, после чего перезапустить `sshd`.

4. **Firewall и защита от перебора.**

   ```bash
   ufw allow 22,80,443/tcp && ufw enable
   apt install fail2ban
   ```

   Дефолтного джейла `sshd` в fail2ban достаточно, отдельная настройка не
   требуется.

5. **Docker.** Установить через официальный скрипт `get.docker.com` и плагин
   `docker compose` (устанавливается тем же скриптом). Пользователя `deploy`
   уже добавили в группу `docker` на шаге 3.

6. **Каталог приложения.**

   ```bash
   mkdir -p /opt/paradise
   ```

   Скопировать на сервер `docker-compose.prod.yml` и каталог `deploy/`
   (nginx-конфиги, скрипт бэкапов) — через `scp` или `git clone` репозитория.

7. **Переменные окружения.**

   ```bash
   cp .env.production.example /opt/paradise/.env
   ```

   Заполнить в `/opt/paradise/.env`: пароли БД (`DB_PASSWORD`,
   `DB_ROOT_PASSWORD`), `APP_KEY` (сгенерировать командой ниже, стек ещё не
   обязан быть поднят целиком — контейнер `app` можно запустить одноразово)
   и `CORS_ALLOWED_ORIGINS` — список origin'ов фронтендов через запятую
   (шаблон уже содержит shop/b2b/admin). Внешней ERP нет, `ERP_PROVIDER=local`
   менять не нужно.

   ```bash
   docker compose -f docker-compose.prod.yml run --rm app php artisan key:generate --show
   ```

   Полученное значение вставить в `APP_KEY=` в `.env`.

8. **Бутстрап SSL.** Курица-и-яйцо: `nginx` не поднимется без сертификатов в
   томе `letsencrypt`, а Let's Encrypt не выдаст сертификат, пока `nginx` не
   отвечает на HTTP для ACME-challenge. Решение — сначала положить в том
   самоподписанные заглушки, поднять стек на них, а затем заменить их на
   настоящие сертификаты через встроенный `certbot`.

   ```bash
   # 8.1 Self-signed заглушки в volume letsencrypt, чтобы nginx поднялся:
   for d in api.paradise.kz shop.paradise.kz b2b.paradise.kz admin.paradise.kz; do
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
   for d in api.paradise.kz shop.paradise.kz b2b.paradise.kz admin.paradise.kz; do
     docker compose -f docker-compose.prod.yml run --rm --entrypoint certbot certbot certonly \
       --webroot -w /var/www/certbot --force-renewal \
       -d $d --email admin@paradise.kz --agree-tos --no-eff-email
   done

   # 8.4 Перечитать сертификаты:
   docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
   ```

   Шаг 8.1 сначала пробует образ `alpine/openssl` (если он недоступен в среде
   сборки — например, нет сети до нужного тега — команда падает, и срабатывает
   `||`-fallback на обычный `alpine` с ручной установкой `openssl` через
   `apk`). После шага 8.3 в томе `letsencrypt` лежат уже настоящие сертификаты
   от Let's Encrypt, и заглушки больше не используются.

9. **Первый запуск приложения.**

   ```bash
   docker login ghcr.io
   ```

   Понадобится Personal Access Token с правом `read:packages` (либо можно
   пропустить этот шаг и дождаться первого CI-деплоя — тогда сервер уже будет
   аутентифицирован деплой-скриптом из GitHub Actions).

   ```bash
   docker compose -f docker-compose.prod.yml exec -T app php artisan migrate --force
   ```

   Засеять справочники, без которых приложение не работает: роли (`admin`,
   `manager`, `b2b_customer`), типы цен и склад по умолчанию. Все три сидера
   идемпотентны. Общий `DatabaseSeeder` на проде **не запускать** — он
   создаёт фабричного админа с тестовым паролем.

   ```bash
   for s in RolesAndPermissionsSeeder PriceTypesSeeder DefaultStoreSeeder; do
     docker compose -f docker-compose.prod.yml exec -T app php artisan db:seed --class=$s --force
   done
   ```

   Создать первого администратора и выдать ему роль — без роли `admin` или
   `manager` не пустит ни Filament (`User::canAccessPanel`), ни админка
   `admin.paradise.kz` (`/api/admin/*` под `role:admin|manager`). Один и тот
   же email/пароль работает в обеих (в `tinker` подставить email, введённый
   в `make:filament-user`):

   ```bash
   docker compose -f docker-compose.prod.yml exec app php artisan make:filament-user
   docker compose -f docker-compose.prod.yml exec app php artisan tinker --execute \
     'App\Models\User::where("email", "admin@paradise.kz")->firstOrFail()->assignRole("admin");'
   ```

10. **Cron бэкапов.** Добавить в crontab пользователя root:

    ```
    30 3 * * * /opt/paradise/deploy/scripts/backup.sh >> /var/log/paradise-backup.log 2>&1
    ```

    Подробности о том, что делает скрипт и на что обратить внимание при его
    настройке — в разделе 6.

11. **GitHub Secrets.** В настройках репозитория (Settings → Secrets and
    variables → Actions) добавить: `SSH_HOST` (IP или хостнейм сервера),
    `SSH_USER=deploy`, `SSH_KEY` (приватный ключ отдельной SSH-пары,
    сгенерированной специально для CI, публичная часть — в
    `~deploy/.ssh/authorized_keys` на сервере). Эти секреты использует
    workflow `.github/workflows/deploy.yml` и `.github/workflows/rollback.yml`
    для подключения по SSH.

12. **Внешний мониторинг.** Настроить в UptimeRobot (или аналоге) проверки
    доступности `https://shop.paradise.kz`, `https://b2b.paradise.kz`,
    `https://admin.paradise.kz` и `https://api.paradise.kz/up`.

## 3. Обычный деплой

Штатный путь — просто запушить в `main`: workflow `.github/workflows/deploy.yml`
сам прогоняет тесты (`test-api`, `test-storefront`), собирает и пушит пять
образов в GHCR (api, nginx, storefront, b2b-portal, admin) с тегами `${{ github.sha }}` и `latest`, затем по SSH
подключается к серверу и выполняет деплой (обновляет `TAG` в `.env`,
подтягивает образы, пересоздаёт контейнеры, накатывает миграции и
перезапускает очереди).

Если нужно задеплоить вручную, в обход CI (например, CI недоступен, либо
нужно откатиться на конкретный локально собранный образ), на сервере
выполняются те же шаги, которые делает деплой-скрипт в workflow — команды
должны выполняться дословно в указанном порядке:

```bash
cd /opt/paradise
sed -i "s/^TAG=.*/TAG=<git-sha-или-latest>/" .env
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans
docker compose -f docker-compose.prod.yml exec -T app php artisan migrate --force
docker compose -f docker-compose.prod.yml exec -T app php artisan queue:restart
```

`<git-sha-или-latest>` — это полный git sha коммита, чей образ нужно
задеплоить, либо `latest`, если нужно раскатить самую свежую собранную
версию. `docker compose ... pull` подтянет образы с этим тегом из GHCR,
`up -d --remove-orphans` пересоздаст изменившиеся контейнеры (несколько
секунд простоя при пересоздании — это ожидаемо, zero-downtime деплой
сознательно не делается), `migrate --force` применит новые миграции без
интерактивного подтверждения, `queue:restart` попросит воркеры `queue`
мягко завершить текущие джобы и перезапуститься с новым кодом.

## 4. Откат

Откат делается через workflow `.github/workflows/rollback.yml`
(`workflow_dispatch`, вход только вручную): GitHub → Actions → **Rollback** →
**Run workflow** → в поле `tag` указать git sha предыдущего успешного
деплоя (его можно найти в истории запусков workflow **Deploy** — по тегу,
который был записан в `TAG` на момент того релиза, либо просто взять sha
нужного коммита из истории `main`).

Workflow переключает `TAG` в `/opt/paradise/.env` на указанный тег,
подтягивает соответствующие образы и пересоздаёт контейнеры, после чего
перезапускает очереди (`queue:restart`). **Миграции при откате намеренно не
откатываются** — они считаются форвард-онли (forward-only): если релиз, с
которого откатываемся, добавил несовместимую миграцию, откат кода её не
отменит, и нужно будет разбираться руками (написать компенсирующую миграцию
или восстановить БД из бэкапа, см. раздел 6).

## 5. Логи

Логи контейнеров стека:

```bash
docker compose -f docker-compose.prod.yml logs -f app|queue|scheduler|nginx|mysql|storefront|b2b-portal|admin
```

(указать конкретный сервис вместо `app|queue|...` — это перечисление
доступных имён, не литеральный синтаксис команды).

Nginx также пишет по-vhost'но access/error логи внутри контейнера — например,
для API:

```bash
docker compose -f docker-compose.prod.yml exec nginx tail -f /var/log/nginx/api.error.log
```

Аналогично доступны `api.access.log`, `shop.error.log`, `shop.access.log`,
`b2b.error.log`, `b2b.access.log`, `admin.error.log`, `admin.access.log`
(см. конфиги в `deploy/nginx/`).

## 6. Бэкапы и восстановление

Бэкапы делает `deploy/scripts/backup.sh`, запускаемый по cron из раздела 2
(шаг 10). Каждую ночь скрипт:

1. Снимает дамп MySQL (`mysqldump --single-transaction --quick --routines
   --triggers`) внутри контейнера `mysql` и сохраняет его сжатым
   (`db-<дата>.sql.gz`) в `/opt/paradise/backups/daily`.
2. Архивирует том с медиафайлами (`paradise_media`) в
   `media-<дата>.tar.gz` там же, через одноразовый контейнер `alpine`,
   монтирующий том на чтение.
3. По воскресеньям (`date +%u` = 7) копирует свежие дневные бэкапы в
   `/opt/paradise/backups/weekly`.
4. Чистит по retention: дневные бэкапы старше 7 дней, недельные — старше 28.
5. Опционально выгружает дневные бэкапы во внешнее S3-совместимое хранилище
   через `rclone`, если в `/opt/paradise/.env` задана переменная
   `BACKUP_RCLONE_REMOTE`.

Файлы пишутся атомарно (сначала `.tmp`, затем `mv`), поэтому упавший на
середине бэкап не оставит на диске повреждённый файл с "финальным" именем.
`PATH` внутри скрипта захардкожен (`/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`),
так как root-овый cron запускает задачи с минимальным `PATH`, где `docker`
и `rclone` могут быть не видны без явного указания.

**Операторские заметки:**

- Значение `BACKUP_RCLONE_REMOTE` в `/opt/paradise/.env` нужно писать **без
  кавычек** (например `BACKUP_RCLONE_REMOTE=kzs3:paradise-backups`, а не
  `BACKUP_RCLONE_REMOTE="kzs3:paradise-backups"`). Скрипт вытаскивает
  значение через `grep`/`cut` по символу `=`, и кавычки, если их поставить,
  попадут в значение буквально и сломают путь до rclone-remote.
- Скрипт **не берёт лок** против параллельного запуска — если по какой-то
  причине два запуска пересекутся по времени, результат не гарантирован. При
  текущем масштабе (один ночной запуск в сутки) пересечения не происходит,
  но **не стоит ставить бэкап в cron чаще одного раза в день**, не добавив
  перед этим блокировку (например, `flock`).

### Восстановление БД

```bash
gunzip -c /opt/paradise/backups/daily/db-<дата>.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T mysql \
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"
```

`$MYSQL_ROOT_PASSWORD` и `$MYSQL_DATABASE` — значения из `/opt/paradise/.env`
(`DB_ROOT_PASSWORD` и `DB_DATABASE` соответственно); их нужно подставить
явно или экспортировать перед выполнением команды.

### Восстановление медиафайлов

```bash
docker run --rm \
  -v paradise_media:/data \
  -v /opt/paradise/backups/daily:/backup \
  alpine:3.20 tar xzf /backup/media-<дата>.tar.gz -C /data
```

Перед восстановлением на "живой" стек рекомендуется остановить `app`,
`queue` и `scheduler` (`docker compose ... stop app queue scheduler`), чтобы
не писать поверх восстанавливаемых данных, и поднять их обратно после
завершения `tar`.

### Чеклист ежемесячного теста восстановления

- [ ] Развернуть последний дневной (или недельный) бэкап БД на отдельном
      тестовом MySQL-контейнере (не на продакшн-базе) и убедиться, что дамп
      применяется без ошибок.
- [ ] Распаковать последний архив медиафайлов во временный каталог и
      выборочно свериться, что файлы читаются (например, открыть несколько
      изображений товаров).
- [ ] Свериться, что в `/opt/paradise/backups/weekly` есть свежая (не старше
      7 дней) недельная копия.
- [ ] Если настроен `BACKUP_RCLONE_REMOTE` — проверить, что во внешнем
      хранилище действительно появляются свежие файлы (`rclone ls`).
- [ ] Зафиксировать результат теста (дата, кто проверял, что нашли).

## 7. Smoke-чеклист после релиза

- [ ] https://shop.paradise.kz/ru открывается, каталог грузится
- [ ] Логин покупателя (OTP) работает
- [ ] Создание заказа проходит
- [ ] https://b2b.paradise.kz — вход одобренного B2B-клиента, каталог с оптовыми ценами
- [ ] https://api.paradise.kz/admin — вход в Filament
- [ ] https://admin.paradise.kz — вход менеджера, список заказов грузится
      (ошибка CORS в консоли браузера = нет origin'а в `CORS_ALLOWED_ORIGINS`)
- [ ] `docker compose -f docker-compose.prod.yml logs queue` — джобы разгребаются, без ошибок
- [ ] https://api.paradise.kz/up → 200 (встроенный health-check Laravel,
      настроен в `bootstrap/app.php` через `health: '/up'`)
