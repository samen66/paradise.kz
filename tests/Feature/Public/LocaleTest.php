<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class LocaleTest extends TestCase
{
    use RefreshDatabase;

    private function bilingualProduct(): Product
    {
        $product = Product::factory()->create(['name' => 'Диван']);
        $product->setTranslation('name', 'kk', 'Диван (kk)');
        $product->setTranslation('description', 'kk', 'Сипаттама');
        $product->save();

        return $product;
    }

    #[Test]
    public function the_catalog_is_served_in_russian_by_default(): void
    {
        $this->bilingualProduct();

        $this->getJson('/api/public/products')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Диван');
    }

    #[Test]
    public function an_explicit_locale_query_parameter_switches_the_language(): void
    {
        $this->bilingualProduct();

        $this->getJson('/api/public/products?locale=kk')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Диван (kk)');
    }

    #[Test]
    public function the_accept_language_header_switches_the_language(): void
    {
        $this->bilingualProduct();

        $this->getJson('/api/public/products', ['Accept-Language' => 'kk'])
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Диван (kk)');
    }

    #[Test]
    public function a_missing_kk_translation_falls_back_to_russian(): void
    {
        Product::factory()->create(['name' => 'Только по-русски']);

        $this->getJson('/api/public/products?locale=kk')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Только по-русски');
    }

    #[Test]
    public function an_unsupported_locale_silently_falls_back_to_the_default(): void
    {
        $this->bilingualProduct();

        $this->getJson('/api/public/products?locale=fr')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Диван');
    }

    #[Test]
    public function categories_are_localized_too(): void
    {
        $category = Category::factory()->create(['name' => 'Мебель']);
        $category->setTranslation('name', 'kk', 'Жиһаз');
        $category->save();

        $this->getJson('/api/public/categories?locale=kk')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Жиһаз');
    }
}
