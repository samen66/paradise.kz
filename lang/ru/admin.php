<?php

return [
    'resources' => [
        'products' => [
            'label' => 'Товар',
            'plural' => 'Товары',
        ],
        'orders' => [
            'label' => 'Заказ',
            'plural' => 'Заказы',
        ],
        'categories' => [
            'label' => 'Категория',
            'plural' => 'Категории',
        ],
        'brands' => [
            'label' => 'Бренд',
            'plural' => 'Бренды',
        ],
        'users' => [
            'label' => 'Пользователь',
            'plural' => 'Пользователи',
        ],
        'attributes' => [
            'label' => 'Атрибут',
            'plural' => 'Атрибуты',
        ],
        'suppliers' => [
            'label' => 'Поставщик',
            'plural' => 'Поставщики',
        ],
        'stores' => [
            'label' => 'Склад',
            'plural' => 'Склады',
        ],
    ],

    'sections' => [
        'main_info' => 'Основная информация',
        'prices_and_stock' => 'Цены и остатки',
        'dimensions' => 'Габариты',
        'erp_sync' => 'ERP Синхронизация (МойСклад)',
        'client_and_status' => 'Клиент и статус',
        'delivery' => 'Доставка',
        'errors_and_logs' => 'Ошибки и логи',
    ],

    'fields' => [
        'name' => 'Название',
        'description' => 'Описание',
        'category' => 'Категория',
        'brand' => 'Бренд',
        'is_active' => 'Активен (виден в каталоге)',
        'retail_price' => 'Розничная цена',
        'b2b_price' => 'Оптовая цена (B2B)',
        'b2b_min_order_qty' => 'Мин. кол-во для B2B',
        'purchase_price' => 'Закупочная цена',
        'min_price' => 'Мин. цена',
        'stock' => 'Остаток',
        'uom' => 'Ед. изм.',
        'weight' => 'Вес',
        'volume' => 'Объем',
        'country' => 'Страна',
        'supplier' => 'Поставщик',
        'source' => 'Источник',
        'external_id' => 'Внешний ID (МойСклад)',
        'external_folder_id' => 'ID папки (МойСклад)',
        'code' => 'Код',
        'article' => 'Артикул',
        'barcodes' => 'Штрихкоды',
        'attributes' => 'Атрибуты / Характеристики',
        'synced_at' => 'Дата синхронизации',

        // Orders
        'user' => 'Клиент',
        'store' => 'Склад',
        'status' => 'Статус',
        'total' => 'Итого',
        'comment' => 'Комментарий',
        'external_order_id' => 'ID заказа (МойСклад)',
        'external_number' => 'Номер (МойСклад)',
        'error' => 'Ошибка синхронизации',
        'pushed_at' => 'Выгружен в ERP',
        'delivery_method' => 'Способ получения',
        'delivery_cost' => 'Стоимость доставки (тиын)',
        'delivery_city' => 'Город',
        'delivery_street' => 'Улица',
        'delivery_building' => 'Дом',
        'delivery_apartment' => 'Кв./офис',
        'delivery_comment' => 'Комментарий к доставке',
        
        // Delivery options
        'delivery_pickup' => 'Самовывоз',
        'delivery_delivery' => 'Доставка',
    ],

    'helpers' => [
        'erp_readonly' => 'Синхронизируется из МойСклад. Редактирование недоступно для предотвращения конфликтов.',
        'b2b_min_qty' => 'Оставьте пустым — будет использовано глобальное значение из Настроек каталога.',
        'in_kopecks' => 'Указывается в тиынах.',
        'is_active' => 'Локальный флаг: скрыть/показать этот товар.',
    ],

    'navigation' => [
        'catalog' => 'Каталог',
    ],
];
