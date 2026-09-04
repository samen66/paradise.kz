<?php

return [
    'resources' => [
        'products' => [
            'label' => 'Тауар',
            'plural' => 'Тауарлар',
        ],
        'orders' => [
            'label' => 'Тапсырыс',
            'plural' => 'Тапсырыстар',
        ],
        'categories' => [
            'label' => 'Санат',
            'plural' => 'Санаттар',
        ],
        'brands' => [
            'label' => 'Бренд',
            'plural' => 'Брендтер',
        ],
        'users' => [
            'label' => 'Пайдаланушы',
            'plural' => 'Пайдаланушылар',
        ],
        'attributes' => [
            'label' => 'Атрибут',
            'plural' => 'Атрибуттар',
        ],
        'suppliers' => [
            'label' => 'Жеткізуші',
            'plural' => 'Жеткізушілер',
        ],
        'stores' => [
            'label' => 'Қойма',
            'plural' => 'Қоймалар',
        ],
    ],

    'sections' => [
        'main_info' => 'Негізгі ақпарат',
        'prices_and_stock' => 'Бағалар және қалдықтар',
        'dimensions' => 'Өлшемдері',
        'erp_sync' => 'ERP Синхрондау (МойСклад)',
        'client_and_status' => 'Клиент және статус',
        'delivery' => 'Жеткізу',
        'errors_and_logs' => 'Қателер және логтар',
    ],

    'fields' => [
        'name' => 'Атауы',
        'description' => 'Сипаттамасы',
        'category' => 'Санат',
        'brand' => 'Бренд',
        'is_active' => 'Белсенді (каталогта көрінеді)',
        'retail_price' => 'Бөлшек сауда бағасы',
        'b2b_price' => 'Көтерме баға (B2B)',
        'b2b_min_order_qty' => 'B2B үшін мин. мөлшер',
        'purchase_price' => 'Сатып алу бағасы',
        'min_price' => 'Мин. баға',
        'compare_at_price' => 'Жеңілдікке дейінгі баға',
        'is_new_arrival' => 'Жаңа тауар',
        'stock' => 'Қалдық',
        'uom' => 'Өлшем бірлігі',
        'weight' => 'Салмағы',
        'volume' => 'Көлемі',
        'country' => 'Ел',
        'supplier' => 'Жеткізуші',
        'source' => 'Дереккөз',
        'external_id' => 'Сыртқы ID (МойСклад)',
        'external_folder_id' => 'Қапшық ID (МойСклад)',
        'code' => 'Код',
        'article' => 'Артикул',
        'barcodes' => 'Штрихкодтар',
        'attributes' => 'Атрибуттар / Сипаттамалар',
        'synced_at' => 'Синхрондау күні',

        // Orders
        'user' => 'Клиент',
        'store' => 'Қойма',
        'status' => 'Статус',
        'total' => 'Барлығы',
        'comment' => 'Түсініктеме',
        'external_order_id' => 'Тапсырыс ID (МойСклад)',
        'external_number' => 'Нөмір (МойСклад)',
        'error' => 'Синхрондау қатесі',
        'pushed_at' => 'ERP-ге жүктелді',
        'delivery_method' => 'Алу тәсілі',
        'delivery_cost' => 'Жеткізу құны (тиын)',
        'delivery_city' => 'Қала',
        'delivery_street' => 'Көше',
        'delivery_building' => 'Үй',
        'delivery_apartment' => 'Пәтер/кеңсе',
        'delivery_comment' => 'Жеткізуге түсініктеме',

        // Delivery options
        'delivery_pickup' => 'Алып кету (Самовывоз)',
        'delivery_delivery' => 'Жеткізу',
    ],

    'helpers' => [
        'erp_readonly' => 'Админ-панельде («Тауарлар» бөлімі) өңделеді. Мұнда тек қарау.',
        'stock_readonly' => 'Қалдық қойма журналы бойынша есептеледі. Өзгерту үшін қабылдау немесе түзету жүргізіңіз.',
        'b2b_min_qty' => 'Бос қалдырыңыз — Каталог параметрлеріндегі жаһандық мән қолданылады.',
        'in_kopecks' => 'Тиынмен көрсетіледі.',
        'is_active' => 'Локальді жалауша: бұл тауарды жасыру/көрсету.',
        'compare_at_price' => 'Міндетті емес. Егер көрсетілсе және ағымдағы бағадан жоғары болса, витринада жеңілдік белгісі көрсетіледі.',
        'is_new_arrival' => 'Локальді жалауша: витринада "Жаңа тауар" белгісін көрсету.',
    ],

    'navigation' => [
        'catalog' => 'Каталог',
    ],
];
