<?php

declare(strict_types=1);

namespace Tests\Feature\Account;

use App\Models\Address;
use App\Models\Order;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AccountApiTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function the_account_area_requires_authentication(): void
    {
        $this->getJson('/api/account/me')->assertUnauthorized();
        $this->getJson('/api/account/orders')->assertUnauthorized();
        $this->getJson('/api/account/favorites')->assertUnauthorized();
    }

    #[Test]
    public function me_returns_the_authenticated_user(): void
    {
        $user = User::factory()->retail()->create(['name' => 'Асем']);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/account/me')
            ->assertOk()
            ->assertJsonPath('user.name', 'Асем')
            ->assertJsonPath('user.type', User::TYPE_RETAIL);
    }

    #[Test]
    public function the_profile_can_be_updated(): void
    {
        $user = User::factory()->retail()->create();

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/account/profile', ['name' => 'Новое имя', 'email' => 'new@example.com'])
            ->assertOk()
            ->assertJsonPath('user.name', 'Новое имя')
            ->assertJsonPath('user.email', 'new@example.com');
    }

    #[Test]
    public function orders_lists_only_own_orders_newest_first(): void
    {
        $user = User::factory()->retail()->create();
        $own = Order::factory()->count(2)->create(['user_id' => $user->id]);
        Order::factory()->create(); // someone else's

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/account/orders')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->assertEqualsCanonicalizing(
            $own->pluck('id')->all(),
            collect($response->json('data'))->pluck('id')->all(),
        );
    }

    #[Test]
    public function orders_carry_the_public_number(): void
    {
        $user = User::factory()->retail()->create();
        $order = Order::factory()->create(['user_id' => $user->id]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/account/orders/'.$order->id)
            ->assertOk()
            ->assertJsonPath('data.number', 'P-'.(100_000 + $order->id));
    }

    #[Test]
    public function the_order_shows_line_photos_and_articles(): void
    {
        Storage::fake(config('media-library.disk_name'));

        $user = User::factory()->retail()->create();
        $order = Order::factory()->create(['user_id' => $user->id]);
        $product = Product::factory()->create(['article' => 'SOFA-01']);
        $product->addMedia(UploadedFile::fake()->image('sofa.jpg'))
            ->toMediaCollection(Product::IMAGE_COLLECTION);
        $order->items()->create([
            'product_id' => $product->id,
            'name' => 'Диван',
            'quantity' => 1,
            'price' => 100_000,
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/account/orders/'.$order->id)
            ->assertOk()
            ->assertJsonPath('data.items.0.article', 'SOFA-01')
            ->assertJsonPath('data.items.0.slug', $product->slug)
            ->assertJsonPath('data.items.0.image', $product->getFirstMedia(Product::IMAGE_COLLECTION)->getUrl('thumb'));
    }

    #[Test]
    public function the_order_list_shows_line_photos(): void
    {
        Storage::fake(config('media-library.disk_name'));

        $user = User::factory()->retail()->create();
        $order = Order::factory()->create(['user_id' => $user->id]);
        $product = Product::factory()->create();
        $product->addMedia(UploadedFile::fake()->image('sofa.jpg'))
            ->toMediaCollection(Product::IMAGE_COLLECTION);
        $order->items()->create([
            'product_id' => $product->id,
            'name' => 'Диван',
            'quantity' => 1,
            'price' => 100_000,
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/account/orders')
            ->assertOk()
            ->assertJsonPath('data.0.items.0.image', $product->getFirstMedia(Product::IMAGE_COLLECTION)->getUrl('thumb'));
    }

    #[Test]
    public function the_order_shows_how_it_is_paid_and_where_to_pick_it_up(): void
    {
        $user = User::factory()->retail()->create();
        $store = Store::factory()->create(['name' => 'Основной склад', 'address' => 'Алматы, Рыскулова 57']);
        $order = Order::factory()->create([
            'user_id' => $user->id,
            'store_id' => $store->id,
            'delivery_method' => Order::DELIVERY_PICKUP,
            'payment_method' => 'kaspi',
            'payment_status' => 'unpaid',
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/account/orders/'.$order->id)
            ->assertOk()
            ->assertJsonPath('data.payment_method', 'kaspi')
            ->assertJsonPath('data.payment_status', 'unpaid')
            ->assertJsonPath('data.store_name', 'Основной склад')
            ->assertJsonPath('data.store_address', 'Алматы, Рыскулова 57');
    }

    #[Test]
    public function a_foreign_order_is_a_404(): void
    {
        $user = User::factory()->retail()->create();
        $foreign = Order::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/account/orders/'.$foreign->id)
            ->assertNotFound();
    }

    #[Test]
    public function a_retail_customer_can_manage_addresses(): void
    {
        $user = User::factory()->retail()->create();

        $created = $this->actingAs($user, 'sanctum')->postJson('/api/account/addresses', [
            'city' => 'Алматы',
            'street' => 'Абая',
            'building' => '10',
            'is_default' => true,
        ])->assertCreated();

        $this->getJson('/api/account/addresses')->assertOk()->assertJsonCount(1, 'data');

        $foreign = Address::factory()->create();
        $this->patchJson('/api/account/addresses/'.$foreign->id, ['city' => 'X', 'street' => 'Y', 'building' => '1'])
            ->assertNotFound();

        $this->deleteJson('/api/account/addresses/'.$created->json('data.id'))->assertNoContent();
    }
}
