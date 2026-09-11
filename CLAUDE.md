# Paradise.kz Project Documentation

## Project Overview

Paradise.kz is a furniture shop (showroom + warehouse in Almaty) selling to two
segments: **B2C** retail customers and **B2B** partner stores. The repository is
a monorepo of one Laravel API and three Next.js front-ends:

| App | Dir | What it is | Dev port | Production host |
|---|---|---|---|---|
| API + back-office | `/` (Laravel) | JSON API under `/api/*`, Filament panel at `/admin` | 8000 | `api.paradise.kz` |
| Storefront | `storefront/` | B2C shop, ru/kk (next-intl), SSR | 3000 | `shop.paradise.kz` |
| B2B portal | `b2b-portal/` | Partner-store catalog, quick order, own prices | 3001 | `b2b.paradise.kz` |
| Admin SPA | `admin/` | Manager's day-to-day: orders, products, stock view, B2B client approval | 3002 | `admin.paradise.kz` |

The app runs **standalone, with no external ERP**. It owns its catalog, prices
and stock. The MoySklad integration it used to mirror from has been removed;
`ERP_PROVIDER=local` is the only provider.

## Architecture

### Two admin panels, split by job

- **`admin/` (Next.js)** — operational screens for managers: orders and status
  changes, product list/edit, read-only stock, B2B client approval, categories,
  brands. Calls `/api/admin/*` (`auth:sanctum` + `role:admin|manager`).
- **Filament (`/admin` on the API host)** — back-office: goods receipts,
  warehouses (Stores), suppliers, price types, CMS pages, banners, reviews,
  catalog groups. `admin/` links out to it (`ERP_ADMIN_URL` in `admin/src/lib/api.ts`).

### Stock: the local FIFO ledger is the source of truth

```
Goods receipt (GoodsReceiptService::post) ──> FifoInventoryService::receive()
Order placed  (OrderPlacementService)     ──> FifoInventoryService::issue()
Order cancelled (OrderCancellationService) ─> return movements, original cost

FifoInventoryService writes:
  batches              — FIFO cost layers
  stock_movements      — append-only ledger (the truth)
  product_store_stock  — per-warehouse projection (on-hand + avg cost)
  products.stock       — aggregate over all warehouses (recomputeAggregateStock)
```

- Nothing writes `products.stock` or `product_store_stock` directly — only
  `FifoInventoryService`. Stock is read-only in both admin panels; it changes
  through receipts, orders and cancellations. `php artisan stock:recompute`
  rebuilds the `products.stock` aggregate from the per-warehouse projection.
- The storefront reads stock via `PublicProductPresenter` (per selected store,
  aggregate otherwise).

### Other domain services

- `app/Services/Orders/` — `OrderPlacementService` (`place()` B2B,
  `placeGuest()`, `placeRetail()`): visibility → stock → price checks, price
  snapshot in the order, FIFO issue in one transaction.
  `OrderCancellationService` puts goods back. `OrderObserver` →
  `SendWhatsAppNotificationJob` on status changes.
- `app/Services/Pricing/PricingService.php` — B2B / retail price types, legacy
  `products.b2b_price` / `retail_price`, per-client `client_product_prices`,
  `discount_percent`.
- `app/Services/Catalog/` — `VisibilityService` (catalog groups; public catalog
  = products in no group), `PublicProductPresenter`, `StoreResolver`, `CategoryTree`.
- `app/Services/Auth/OtpService.php` — phone OTP login for the storefront.

### ERP abstraction (dormant)

`app/Contracts/Erp/` (`ErpProvider`, `OrderTarget`, `WebhookHandler`) and
`app/Contracts/Catalog/CatalogSource` stay as the seam for a future import
source. `config/erp.php` maps provider keys to implementations; the only one is
`App\Services\Local\LocalErpProvider`, whose reads return nothing and whose
writes throw. The catalog sync jobs in `app/Jobs/Catalog/` are written against
the contract and are not scheduled. Historical links to external systems
(`product_external_mappings`, `stores.source` / `external_id`,
`order_items.external_product_id`) are kept as data, not used for logic.

### API layout (`routes/api.php`)

| Prefix | Auth | Used by |
|---|---|---|
| `/api/public/*` | none (guest checkout, OTP login, catalog, facets, order tracking) | storefront |
| `/api/account/*` | `auth:sanctum` | storefront customer account |
| `/api/auth/*` | login/register public, the rest `auth:sanctum` | b2b-portal, admin SPA |
| `/api/{categories,products,orders,addresses}` | `auth:sanctum` + `approved` + `b2b` | b2b-portal |
| `/api/admin/*` | `auth:sanctum` + `role:admin\|manager` | admin SPA |

All front-ends authenticate with Sanctum **bearer tokens** (no cookie/stateful
auth). Cross-origin access is governed by `CORS_ALLOWED_ORIGINS`
(`config/cors.php`).

## Tech Stack

- **API**: Laravel 13, PHP 8.4 in production images, MySQL 8, Redis (queue,
  cache, sessions), Filament 5, Sanctum 4, Spatie Permission / Media Library /
  Query Builder / Translatable (ru + kk columns).
- **Front-ends**: Next.js 16.x (App Router, TypeScript, `output: "standalone"`),
  Tailwind CSS 4, zustand. Storefront and B2B portal use next-intl.
- **Laravel's own Vite build** (`resources/`) only serves Filament/Blade assets.
- **Tests**: PHPUnit 12 (API only). Front-ends are checked by `tsc --noEmit` +
  `npm run build` in CI.

## Project Structure

```
app/
  Actions/               - ApproveClient (B2B approval)
  Contracts/{Erp,Catalog,Sms}/ - integration seams
  Filament/              - back-office resources (receipts, stores, CMS, …)
  Http/Controllers/Api/  - Public/, Account/, Admin/, Auth/ + B2B controllers
  Jobs/                  - Catalog/ (dormant sync), WhatsApp, storefront revalidation
  Services/              - Inventory/, Orders/, Pricing/, Catalog/, Local/, Auth/, Sms/, WhatsApp/
storefront/  b2b-portal/  admin/   - Next.js apps, each with its own package.json + Dockerfile
deploy/
  nginx/                 - api/shop/admin vhosts, baked into the nginx image
  README.md              - production runbook
docker/php/Dockerfile.prod - API + nginx production images
docker-compose.yml       - local dev stack (+ docker-compose.dev.yml)
docker-compose.prod.yml  - production stack (/opt/paradise on the VPS)
docs/mvp-plan-2026-09.md - current MVP plan and task status
```

## Setup & Development

```bash
composer run setup     # composer install, .env, key, migrate, npm build
composer run dev       # artisan serve + queue:listen + pail + vite
cd storefront && npm run dev   # :3000
cd b2b-portal && npm run dev   # :3001
cd admin && npm run dev -- -p 3002
```

Each Next.js app reads `NEXT_PUBLIC_API_URL` (default `http://localhost:8000/api`)
from its `.env.local`.

## Deployment

Push to `main` → `.github/workflows/deploy.yml` runs the tests, builds and
pushes `paradise-{api,nginx,storefront,admin}` images to GHCR, then SSH-deploys
`docker-compose.prod.yml`. See `deploy/README.md`. `NEXT_PUBLIC_*` values are
baked into the front-end images at build time (build args in `deploy.yml`).

Gap: `b2b-portal` is a service in `docker-compose.prod.yml`, but `deploy.yml`
does not build its image yet and there is no `b2b.paradise.kz` nginx vhost.

## Common Commands

| Command | Purpose |
|---------|---------|
| `php artisan test --compact` | Run the API test suite |
| `vendor/bin/pint --dirty --format agent` | Format changed PHP |
| `php artisan migrate` | Run database migrations |
| `php artisan queue:listen` | Process queued jobs |
| `php artisan pail` | Stream logs |
| `npx tsc --noEmit && npm run build` | Check a Next.js app (run inside its dir) |

## Notes for Claude

- Stock changes go through `FifoInventoryService` only — see "Stock" above and
  `AGENTS.md` rule 1.
- There is no ERP. Do not reintroduce MoySklad calls; new import sources go
  behind `App\Contracts\Erp\ErpProvider` / `CatalogSource`.
- Use Filament documentation when working with the back-office panel.
- Spatie Permission roles (`RolesAndPermissionsSeeder`): `admin`, `manager`, `b2b_customer`.
  B2C customers have no role.
- Media library supports S3; configure AWS credentials in `.env`.

===

<laravel-boost-guidelines>
=== foundation rules ===

# Laravel Boost Guidelines

The Laravel Boost guidelines are specifically curated by Laravel maintainers for this application. These guidelines should be followed closely to ensure the best experience when building Laravel applications.

## Foundational Context

This application is a Laravel application and its main Laravel ecosystems package & versions are below. You are an expert with them all. Ensure you abide by these specific packages & versions.

- php - 8.5
- filament/filament (FILAMENT) - v5
- laravel/framework (LARAVEL) - v13
- laravel/mcp (MCP) - v0
- laravel/prompts (PROMPTS) - v0
- laravel/sanctum (SANCTUM) - v4
- livewire/livewire (LIVEWIRE) - v4
- laravel/boost (BOOST) - v2
- laravel/pail (PAIL) - v1
- laravel/pint (PINT) - v1
- phpunit/phpunit (PHPUNIT) - v12
- tailwindcss (TAILWINDCSS) - v4

## Skills Activation

This project has domain-specific skills available in `**/skills/**`. You MUST activate the relevant skill whenever you work in that domain—don't wait until you're stuck.

## Conventions

- You must follow all existing code conventions used in this application. When creating or editing a file, check sibling files for the correct structure, approach, and naming.
- Use descriptive names for variables and methods. For example, `isRegisteredForDiscounts`, not `discount()`.
- Check for existing components to reuse before writing a new one.

## Verification Scripts

- Do not create verification scripts or tinker when tests cover that functionality and prove they work. Unit and feature tests are more important.

## Application Structure & Architecture

- Stick to existing directory structure; don't create new base folders without approval.
- Do not change the application's dependencies without approval.

## Frontend Bundling

- If the user doesn't see a frontend change reflected in the UI, it could mean they need to run `npm run build`, `npm run dev`, or `composer run dev`. Ask them.

## Documentation Files

- You must only create documentation files if explicitly requested by the user.

## Replies

- Be concise in your explanations - focus on what's important rather than explaining obvious details.

=== boost rules ===

# Laravel Boost

## Tools

- Laravel Boost is an MCP server with tools designed specifically for this application. Prefer Boost tools over manual alternatives like shell commands or file reads.
- Use `database-query` to run read-only queries against the database instead of writing raw SQL in tinker.
- Use `database-schema` to inspect table structure before writing migrations or models.
- Use `get-absolute-url` to resolve the correct scheme, domain, and port for project URLs. Always use this before sharing a URL with the user.
- Use `browser-logs` to read browser logs, errors, and exceptions. Only recent logs are useful, ignore old entries.

## Searching Documentation (IMPORTANT)

- Always use `search-docs` before making code changes. Do not skip this step. It returns version-specific docs based on installed packages automatically.
- Pass a `packages` array to scope results when you know which packages are relevant.
- Use multiple broad, topic-based queries: `['rate limiting', 'routing rate limiting', 'routing']`. Expect the most relevant results first.
- Do not add package names to queries because package info is already shared. Use `test resource table`, not `filament 4 test resource table`.

### Search Syntax

1. Use words for auto-stemmed AND logic: `rate limit` matches both "rate" AND "limit".
2. Use `"quoted phrases"` for exact position matching: `"infinite scroll"` requires adjacent words in order.
3. Combine words and phrases for mixed queries: `middleware "rate limit"`.
4. Use multiple queries for OR logic: `queries=["authentication", "middleware"]`.

## Artisan

- Run Artisan commands directly via the command line (e.g., `php artisan route:list`). Use `php artisan list` to discover available commands and `php artisan [command] --help` to check parameters.
- Inspect routes with `php artisan route:list`. Filter with: `--method=GET`, `--name=users`, `--path=api`, `--except-vendor`, `--only-vendor`.
- Read configuration values using dot notation: `php artisan config:show app.name`, `php artisan config:show database.default`. Or read config files directly from the `config/` directory.

## Tinker

- Execute PHP in app context for debugging and testing code. Do not create models without user approval, prefer tests with factories instead. Prefer existing Artisan commands over custom tinker code.
- Always use single quotes to prevent shell expansion: `php artisan tinker --execute 'Your::code();'`
  - Double quotes for PHP strings inside: `php artisan tinker --execute 'User::where("active", true)->count();'`

=== php rules ===

# PHP

- Always use curly braces for control structures, even for single-line bodies.
- Use PHP 8 constructor property promotion: `public function __construct(public GitHub $github) { }`. Do not leave empty zero-parameter `__construct()` methods unless the constructor is private.
- Use explicit return type declarations and type hints for all method parameters: `function isAccessible(User $user, ?string $path = null): bool`
- Use TitleCase for Enum keys: `FavoritePerson`, `BestLake`, `Monthly`.
- Prefer PHPDoc blocks over inline comments. Only add inline comments for exceptionally complex logic.
- Use array shape type definitions in PHPDoc blocks.

=== deployments rules ===

# Deployment

- Laravel can be deployed using [Laravel Cloud](https://cloud.laravel.com/), which is the fastest way to deploy and scale production Laravel applications.

=== tests rules ===

# Test Enforcement

- Every change must be programmatically tested. Write a new test or update an existing test, then run the affected tests to make sure they pass.
- Run the minimum number of tests needed to ensure code quality and speed. Use `php artisan test --compact` with a specific filename or filter.

=== laravel/core rules ===

# Do Things the Laravel Way

- Use `php artisan make:` commands to create new files (i.e. migrations, controllers, models, etc.). You can list available Artisan commands using `php artisan list` and check their parameters with `php artisan [command] --help`.
- If you're creating a generic PHP class, use `php artisan make:class`.
- Pass `--no-interaction` to all Artisan commands to ensure they work without user input. You should also pass the correct `--options` to ensure correct behavior.

### Model Creation

- When creating new models, create useful factories and seeders for them too. Ask the user if they need any other things, using `php artisan make:model --help` to check the available options.

## APIs & Eloquent Resources

- For APIs, default to using Eloquent API Resources and API versioning unless existing API routes do not, then you should follow existing application convention.

## URL Generation

- When generating links to other pages, prefer named routes and the `route()` function.

## Testing

- When creating models for tests, use the factories for the models. Check if the factory has custom states that can be used before manually setting up the model.
- Faker: Use methods such as `$this->faker->word()` or `fake()->randomDigit()`. Follow existing conventions whether to use `$this->faker` or `fake()`.
- When creating tests, make use of `php artisan make:test [options] {name}` to create a feature test, and pass `--unit` to create a unit test. Most tests should be feature tests.

## Vite Error

- If you receive an "Illuminate\Foundation\ViteException: Unable to locate file in Vite manifest" error, you can run `npm run build` or ask the user to run `npm run dev` or `composer run dev`.

=== pint/core rules ===

# Laravel Pint Code Formatter

- If you have modified any PHP files, you must run `vendor/bin/pint --dirty --format agent` before finalizing changes to ensure your code matches the project's expected style.
- Do not run `vendor/bin/pint --test --format agent`, simply run `vendor/bin/pint --format agent` to fix any formatting issues.

=== phpunit/core rules ===

# PHPUnit

- This application uses PHPUnit for testing. All tests must be written as PHPUnit classes. Use `php artisan make:test --phpunit {name}` to create a new test.
- If you see a test using "Pest", convert it to PHPUnit.
- Every time a test has been updated, run that singular test.
- When the tests relating to your feature are passing, ask the user if they would like to also run the entire test suite to make sure everything is still passing.
- Tests should cover all happy paths, failure paths, and edge cases.
- You must not remove any tests or test files from the tests directory without approval. These are not temporary or helper files; these are core to the application.

## Running Tests

- Run the minimal number of tests, using an appropriate filter, before finalizing.
- To run all tests: `php artisan test --compact`.
- To run all tests in a file: `php artisan test --compact tests/Feature/ExampleTest.php`.
- To filter on a particular test name: `php artisan test --compact --filter=testName` (recommended after making a change to a related file).

=== filament/filament rules ===

## Filament

- Filament is a Laravel UI framework built on Livewire, Alpine.js, and Tailwind CSS. UIs are defined in PHP via fluent, chainable components. Follow existing conventions in this app.
- Use the `search-docs` tool for official documentation on Artisan commands, code examples, testing, relationships, and idiomatic practices. If `search-docs` is unavailable, refer to https://filamentphp.com/docs.

### Artisan

- Always use Filament-specific Artisan commands to create files. Find available commands with the `list-artisan-commands` tool, or run `php artisan --help`.
- Inspect required options before running, and always pass `--no-interaction`.

### Patterns

Always use static `make()` methods to initialize components. Most configuration methods accept a `Closure` for dynamic values.

Use `Get $get` to read other form field values for conditional logic:

<code-snippet name="Conditional form field visibility" lang="php">
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Utilities\Get;

Select::make('type')
    ->options(CompanyType::class)
    ->required()
    ->live(),

TextInput::make('company_name')
    ->required()
    ->visible(fn (Get $get): bool => $get('type') === 'business'),

</code-snippet>

Use `Set $set` inside `->afterStateUpdated()` on a `->live()` field to mutate another field reactively. Prefer `->live(onBlur: true)` on text inputs to avoid per-keystroke updates:

<code-snippet name="Reactive field update" lang="php">
use Filament\Schemas\Components\Utilities\Set;
use Illuminate\Support\Str;

TextInput::make('title')
    ->required()
    ->live(onBlur: true)
    ->afterStateUpdated(fn (Set $set, ?string $state) => $set(
        'slug',
        Str::slug($state ?? ''),
    )),

TextInput::make('slug')
    ->required(),

</code-snippet>

Compose layout by nesting `Section` and `Grid`. Children need explicit `->columnSpan()` or `->columnSpanFull()`:

<code-snippet name="Section and Grid layout" lang="php">
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;

Section::make('Details')
    ->schema([
        Grid::make(2)->schema([
            TextInput::make('first_name')
                ->columnSpan(1),
            TextInput::make('last_name')
                ->columnSpan(1),
            TextInput::make('bio')
                ->columnSpanFull(),
        ]),
    ]),

</code-snippet>

Use `Repeater` for inline `HasMany` management. `->relationship()` with no args binds to the relationship matching the field name:

<code-snippet name="Repeater for HasMany" lang="php">
use Filament\Forms\Components\Repeater;

Repeater::make('qualifications')
    ->relationship()
    ->schema([
        TextInput::make('institution')
            ->required(),
        TextInput::make('qualification')
            ->required(),
    ])
    ->columns(2),

</code-snippet>

Use `state()` with a `Closure` to compute derived column values:

<code-snippet name="Computed table column value" lang="php">
use Filament\Tables\Columns\TextColumn;

TextColumn::make('full_name')
    ->state(fn (User $record): string => "{$record->first_name} {$record->last_name}"),

</code-snippet>

Use `SelectFilter` for enum or relationship filters, and `Filter` with a `->query()` closure for custom logic:

<code-snippet name="Table filters" lang="php">
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Illuminate\Database\Eloquent\Builder;

SelectFilter::make('status')
    ->options(UserStatus::class),

SelectFilter::make('author')
    ->relationship('author', 'name'),

Filter::make('verified')
    ->query(fn (Builder $query) => $query->whereNotNull('email_verified_at')),

</code-snippet>

Actions are buttons that encapsulate optional modal forms and behavior:

<code-snippet name="Action with modal form" lang="php">
use Filament\Actions\Action;

Action::make('updateEmail')
    ->schema([
        TextInput::make('email')
            ->email()
            ->required(),
    ])
    ->action(fn (array $data, User $record) => $record->update($data)),

</code-snippet>

### Testing

Testing setup (requires `pestphp/pest-plugin-livewire` in `composer.json`):

- Always call `$this->actingAs(User::factory()->create())` before testing panel functionality.
- For edit pages, pass `['record' => $user->id]`, use `->call('save')` (not `->call('create')`), and do not assert `->assertRedirect()` (edit pages do not redirect after save).

<code-snippet name="Table test" lang="php">
use function Pest\Livewire\livewire;

livewire(ListUsers::class)
    ->assertCanSeeTableRecords($users)
    ->searchTable($users->first()->name)
    ->assertCanSeeTableRecords($users->take(1))
    ->assertCanNotSeeTableRecords($users->skip(1));

</code-snippet>

<code-snippet name="Create resource test" lang="php">
use function Pest\Laravel\assertDatabaseHas;

livewire(CreateUser::class)
    ->fillForm([
        'name' => 'Test',
        'email' => 'test@example.com',
    ])
    ->call('create')
    ->assertNotified()
    ->assertHasNoFormErrors()
    ->assertRedirect();

assertDatabaseHas(User::class, [
    'name' => 'Test',
    'email' => 'test@example.com',
]);

</code-snippet>

<code-snippet name="Edit resource test" lang="php">
livewire(EditUser::class, ['record' => $user->id])
    ->fillForm(['name' => 'Updated'])
    ->call('save')
    ->assertNotified()
    ->assertHasNoFormErrors();

assertDatabaseHas(User::class, [
    'id' => $user->id,
    'name' => 'Updated',
]);

</code-snippet>

<code-snippet name="Testing validation" lang="php">
livewire(CreateUser::class)
    ->fillForm([
        'name' => null,
        'email' => 'invalid-email',
    ])
    ->call('create')
    ->assertHasFormErrors([
        'name' => 'required',
        'email' => 'email',
    ])
    ->assertNotNotified();

</code-snippet>

Use `->callAction(DeleteAction::class)` for page actions, or `->callAction(TestAction::make('name')->table($record))` for table actions:

<code-snippet name="Calling actions" lang="php">
use Filament\Actions\Testing\TestAction;

livewire(ListUsers::class)
    ->callAction(TestAction::make('promote')->table($user), [
        'role' => 'admin',
    ])
    ->assertNotified();

</code-snippet>

### Correct Namespaces

- Form fields (`TextInput`, `Select`, `Repeater`, etc.): `Filament\Forms\Components\`
- Infolist entries (`TextEntry`, `IconEntry`, etc.): `Filament\Infolists\Components\`
- Layout components (`Grid`, `Section`, `Fieldset`, `Tabs`, `Wizard`, etc.): `Filament\Schemas\Components\`
- Schema utilities (`Get`, `Set`, etc.): `Filament\Schemas\Components\Utilities\`
- Table columns (`TextColumn`, `IconColumn`, etc.): `Filament\Tables\Columns\`
- Table filters (`SelectFilter`, `Filter`, etc.): `Filament\Tables\Filters\`
- Actions (`DeleteAction`, `CreateAction`, etc.): `Filament\Actions\`. Never use `Filament\Tables\Actions\`, `Filament\Forms\Actions\`, or any other sub-namespace for actions.
- Icons: `Filament\Support\Icons\Heroicon` enum (e.g., `Heroicon::PencilSquare`)

### Common Mistakes

- **Never assume public file visibility.** File visibility is `private` by default. Always use `->visibility('public')` when public access is needed.
- **Never assume full-width layout.** `Grid`, `Section`, `Fieldset`, and `Repeater` do not span all columns by default.
- **Use `Select::make('author_id')->relationship('author', 'name')` for BelongsTo fields.** `BelongsToSelect` does not exist in v4.
- **`Repeater` uses `->schema()`, not `->fields()`.**
- **Never add `->dehydrated(false)` to fields that need to be saved.** It strips the value from form state before `->action()` or the save handler runs. Only use it for helper/UI-only fields.
- **Use correct property types when overriding `Page`, `Resource`, and `Widget` properties.** These properties have union types or changed modifiers that must be preserved:
  - `$navigationIcon`: `protected static string | BackedEnum | null` (not `?string`)
  - `$navigationGroup`: `protected static string | UnitEnum | null` (not `?string`)
  - `$view`: `protected string` (not `protected static string`) on `Page` and `Widget` classes

=== spatie/laravel-medialibrary rules ===

## Media Library

- `spatie/laravel-medialibrary` associates files with Eloquent models, with support for collections, conversions, and responsive images.
- Always activate the `medialibrary-development` skill when working with media uploads, conversions, collections, responsive images, or any code that uses the `HasMedia` interface or `InteractsWithMedia` trait.

</laravel-boost-guidelines>
