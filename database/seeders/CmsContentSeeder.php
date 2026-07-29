<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Page;
use Illuminate\Database\Seeder;

class CmsContentSeeder extends Seeder
{
    public function run(): void
    {
        $pages = [
            [
                'slug' => 'about',
                'title' => ['ru' => 'О компании', 'kk' => 'Компания туралы'],
                'body' => ['ru' => '<p>Paradise — это современная мебель...</p>', 'kk' => '<p>Paradise — бұл заманауи жиһаз...</p>'],
            ],
            [
                'slug' => 'delivery',
                'title' => ['ru' => 'Доставка и оплата', 'kk' => 'Жеткізу және төлеу'],
                'body' => ['ru' => '<p>Информация о доставке...</p>', 'kk' => '<p>Жеткізу туралы ақпарат...</p>'],
            ],
            [
                'slug' => 'contacts',
                'title' => ['ru' => 'Контакты', 'kk' => 'Байланыс'],
                'body' => ['ru' => '<p>Свяжитесь с нами...</p>', 'kk' => '<p>Бізбен байланысыңыз...</p>'],
            ],
            [
                'slug' => 'b2b-conditions',
                'title' => ['ru' => 'Условия для оптовиков (B2B)', 'kk' => 'Көтерме сатушыларға арналған шарттар (B2B)'],
                'body' => ['ru' => '<p>Мы предлагаем выгодные условия...</p>', 'kk' => '<p>Біз тиімді шарттар ұсынамыз...</p>'],
            ]
        ];

        foreach ($pages as $pageData) {
            Page::updateOrCreate(
                ['slug' => $pageData['slug']],
                [
                    'title' => $pageData['title'],
                    'body' => $pageData['body'],
                    'is_active' => true,
                ]
            );
        }
    }
}
