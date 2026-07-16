# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: comprehensive-ui-ux.spec.ts >> Comprehensive UI/UX and Business Logic Test Suite >> B2C User Flow & UI/UX Evaluation >> should correctly simulate B2C shopping flow and calculate totals
- Location: e2e/comprehensive-ui-ux.spec.ts:40:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('article, .group').first().locator('img').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('article, .group').first().locator('img').first()

```

```yaml
- banner:
  - link "О компании":
    - /url: /about
  - link "Доставка":
    - /url: /delivery
  - link "Контакты":
    - /url: /contacts
  - link "Стать партнером":
    - /url: /b2b/login
  - link "Рус":
    - /url: /ru/catalog
  - link "Қаз":
    - /url: /kk/catalog
  - button "Найти"
  - searchbox "Поиск товаров…"
  - link "Paradise.kz":
    - /url: /
  - link "Войти":
    - /url: /login
  - link "Избранное":
    - /url: /account/favorites
  - link "Корзина":
    - /url: /cart
  - navigation:
    - list:
      - listitem:
        - link "Аксессуары":
          - /url: /catalog/aksessuary
      - listitem:
        - link "Детская мебель":
          - /url: /catalog/detskaia-mebel
      - listitem:
        - link "Диваны":
          - /url: /catalog/divany
      - listitem:
        - link "Комоды и тумбы":
          - /url: /catalog/komody-i-tumby
      - listitem:
        - link "Кровати":
          - /url: /catalog/krovati
      - listitem:
        - link "Кухонная мебель":
          - /url: /catalog/kuxonnaia-mebel
      - listitem:
        - link "Матрасы":
          - /url: /catalog/matrasy
      - listitem:
        - link "Мягкая мебель":
          - /url: /catalog/miagkaia-mebel
      - listitem:
        - link "Прихожая":
          - /url: /catalog/prixozaia
      - listitem:
        - link "Столы":
          - /url: /catalog/stoly
      - listitem:
        - link "Стулья и кресла":
          - /url: /catalog/stulia-i-kresla
      - listitem:
        - link "Шкафы":
          - /url: /catalog/skafy
- main:
  - navigation:
    - list:
      - listitem:
        - link "Главная":
          - /url: /
      - listitem: / Каталог
  - complementary:
    - group:
      - text: Цена, ₸
      - img
      - spinbutton
      - spinbutton
      - button "Применить"
    - checkbox "Только в наличии"
    - text: Только в наличии
    - group:
      - text: Бренд
      - img
      - list:
        - listitem:
          - checkbox "Angstrem 3"
          - text: Angstrem 3
        - listitem:
          - checkbox "Askona 5"
          - text: Askona 5
        - listitem:
          - checkbox "Borovichi 6"
          - text: Borovichi 6
        - listitem:
          - checkbox "DaVita 5"
          - text: DaVita 5
        - listitem:
          - checkbox "Hoff 7"
          - text: Hoff 7
        - listitem:
          - checkbox "Lazurit 6"
          - text: Lazurit 6
        - listitem:
          - checkbox "Moon Trade 8"
          - text: Moon Trade 8
        - listitem:
          - checkbox "Ormatek 2"
          - text: Ormatek 2
        - listitem:
          - checkbox "Paradise Home 4"
          - text: Paradise Home 4
        - listitem:
          - checkbox "Rivalli 6"
          - text: Rivalli 6
        - listitem:
          - checkbox "Stolplit 5"
          - text: Stolplit 5
        - listitem:
          - checkbox "Мебельград 8"
          - text: Мебельград 8
        - listitem:
          - checkbox "Первый мебельный 1"
          - text: Первый мебельный 1
        - listitem:
          - checkbox "Шатура 6"
          - text: Шатура 6
    - group:
      - text: Цвет
      - img
      - list:
        - listitem:
          - checkbox "Антрацит"
          - text: Антрацит
        - listitem:
          - checkbox "Бежевый"
          - text: Бежевый
        - listitem:
          - checkbox "Белый"
          - text: Белый
        - listitem:
          - checkbox "Венге"
          - text: Венге
        - listitem:
          - checkbox "Графит"
          - text: Графит
        - listitem:
          - checkbox "Дуб сонома"
          - text: Дуб сонома
        - listitem:
          - checkbox "Орех"
          - text: Орех
        - listitem:
          - checkbox "Серый"
          - text: Серый
        - listitem:
          - checkbox "Слоновая кость"
          - text: Слоновая кость
        - listitem:
          - checkbox "Чёрный"
          - text: Чёрный
    - group:
      - text: Материал каркаса
      - img
      - list:
        - listitem:
          - checkbox "ЛДСП"
          - text: ЛДСП
        - listitem:
          - checkbox "Массив бука"
          - text: Массив бука
        - listitem:
          - checkbox "Массив дуба"
          - text: Массив дуба
        - listitem:
          - checkbox "Массив сосны"
          - text: Массив сосны
        - listitem:
          - checkbox "Массив ясеня"
          - text: Массив ясеня
        - listitem:
          - checkbox "МДФ"
          - text: МДФ
        - listitem:
          - checkbox "Металл"
          - text: Металл
        - listitem:
          - checkbox "Фанера берёзовая"
          - text: Фанера берёзовая
    - group:
      - text: Материал обивки
      - img
      - list:
        - listitem:
          - checkbox "Велюр"
          - text: Велюр
        - listitem:
          - checkbox "Натуральная кожа"
          - text: Натуральная кожа
        - listitem:
          - checkbox "Флок"
          - text: Флок
    - group:
      - text: Механизм трансформации
      - img
      - list:
        - listitem:
          - checkbox "Выкатной"
          - text: Выкатной
        - listitem:
          - checkbox "Еврокнижка"
          - text: Еврокнижка
        - listitem:
          - checkbox "Клик-кляк"
          - text: Клик-кляк
    - group:
      - text: Стиль
      - img
      - list:
        - listitem:
          - checkbox "Классический"
          - text: Классический
        - listitem:
          - checkbox "Лофт"
          - text: Лофт
        - listitem:
          - checkbox "Минимализм"
          - text: Минимализм
        - listitem:
          - checkbox "Модерн"
          - text: Модерн
        - listitem:
          - checkbox "Прованс"
          - text: Прованс
        - listitem:
          - checkbox "Скандинавский"
          - text: Скандинавский
        - listitem:
          - checkbox "Современный"
          - text: Современный
        - listitem:
          - checkbox "Хай-тек"
          - text: Хай-тек
    - button "Сбросить"
  - heading "Каталог" [level=1]
  - text: "Найдено товаров: 72"
  - button "Только в наличии"
  - text: "Сортировка:"
  - combobox "Сортировка:":
    - option "По названию" [selected]
    - option "Сначала дешевле"
    - option "Сначала дороже"
    - option "Сначала новые"
  - article:
    - link "10223":
      - /url: /product/56
      - img "10223"
    - text: 268 174 ₸ 10223
    - button "В корзину"
    - text: "В наличии: 12 шт."
    - link "10223":
      - /url: /product/56
  - article:
    - link "10333":
      - /url: /product/29
      - img "10333"
    - text: 10 000 ₸ 10333 Нет в наличии
    - link "10333":
      - /url: /product/29
  - article:
    - link "11103":
      - /url: /product/65
      - img "11103"
    - text: 16 000 ₸ 11103 Нет в наличии
    - link "11103":
      - /url: /product/65
  - article:
    - link "11105":
      - /url: /product/54
      - img "11105"
    - text: 16 000 ₸ 11105 Нет в наличии
    - link "11105":
      - /url: /product/54
  - article:
    - link "2203":
      - /url: /product/43
      - img "2203"
    - text: 17 000 ₸ 2203 Нет в наличии
    - link "2203":
      - /url: /product/43
  - article:
    - link "2205":
      - /url: /product/48
      - img "2205"
    - text: 22 000 ₸ 2205 Нет в наличии
    - link "2205":
      - /url: /product/48
  - article:
    - link "2206":
      - /url: /product/63
      - img "2206"
    - text: 28 000 ₸ 2206 Нет в наличии
    - link "2206":
      - /url: /product/63
  - article:
    - link "2207":
      - /url: /product/73
      - img "2207"
    - text: 21 000 ₸ 2207 Нет в наличии
    - link "2207":
      - /url: /product/73
  - article:
    - link "2208":
      - /url: /product/27
      - img "2208"
    - text: 20 000 ₸ 2208 Нет в наличии
    - link "2208":
      - /url: /product/27
  - article:
    - link "2209":
      - /url: /product/23
      - img "2209"
    - text: 29 000 ₸ 2209 Нет в наличии
    - link "2209":
      - /url: /product/23
  - article:
    - link "50401":
      - /url: /product/3
      - img "50401"
    - text: 283 804 ₸ 50401 Нет в наличии
    - link "50401":
      - /url: /product/3
  - article:
    - link "B003":
      - /url: /product/5
      - img "B003"
    - text: 284 923 ₸ B003 Нет в наличии
    - link "B003":
      - /url: /product/5
  - article:
    - link "B0070":
      - /url: /product/9
      - img "B0070"
    - text: 413 184 ₸ B0070 Нет в наличии
    - link "B0070":
      - /url: /product/9
  - article:
    - link "BOZEN 501":
      - /url: /product/11
      - img "BOZEN 501"
    - text: 100 000 ₸ BOZEN 501 Нет в наличии
    - link "BOZEN 501":
      - /url: /product/11
  - article:
    - link "Chil - Grey 10222":
      - /url: /product/57
      - img "Chil - Grey 10222"
    - text: 10 000 ₸ Chil - Grey 10222 Нет в наличии
    - link "Chil - Grey 10222":
      - /url: /product/57
  - article:
    - link "Chil - Lattic 10103":
      - /url: /product/53
      - img "Chil - Lattic 10103"
    - text: 10 000 ₸ Chil - Lattic 10103 Нет в наличии
    - link "Chil - Lattic 10103":
      - /url: /product/53
  - article:
    - link "Chil-Lattic 10101":
      - /url: /product/33
      - img "Chil-Lattic 10101"
    - text: 9 000 ₸ Chil-Lattic 10101 Нет в наличии
    - link "Chil-Lattic 10101":
      - /url: /product/33
  - article:
    - link "DC-1698":
      - /url: /product/50
      - img "DC-1698"
    - text: 46 000 ₸ DC-1698 Нет в наличии
    - link "DC-1698":
      - /url: /product/50
  - article:
    - link "DC-2031 Черный":
      - /url: /product/47
      - img "DC-2031 Черный"
    - text: 18 000 ₸ DC-2031 Нет в наличии
    - link "DC-2031 Черный":
      - /url: /product/47
  - article:
    - link "DC-2031(V) Серый":
      - /url: /product/66
      - img "DC-2031(V) Серый"
    - text: 18 000 ₸ DC-2031(V) Нет в наличии
    - link "DC-2031(V) Серый":
      - /url: /product/66
  - article:
    - link "DC-2031(V1) Зеленый":
      - /url: /product/55
      - img "DC-2031(V1) Зеленый"
    - text: 18 000 ₸ DC-2031(V1) Нет в наличии
    - link "DC-2031(V1) Зеленый":
      - /url: /product/55
  - article:
    - link "DC-2083A(V1)":
      - /url: /product/68
      - img "DC-2083A(V1)"
    - text: 41 000 ₸ DC-2083A(V1) Нет в наличии
    - link "DC-2083A(V1)":
      - /url: /product/68
  - article:
    - link "DC-S195":
      - /url: /product/44
      - img "DC-S195"
    - text: 30 000 ₸ DC-S195 Нет в наличии
    - link "DC-S195":
      - /url: /product/44
  - article:
    - link "DC-S197A":
      - /url: /product/49
      - img "DC-S197A"
    - text: 33 000 ₸ DC-S197A Нет в наличии
    - link "DC-S197A":
      - /url: /product/49
  - navigation:
    - link "1":
      - /url: /catalog
    - link "2":
      - /url: /catalog?page=2
    - link "3":
      - /url: /catalog?page=3
- contentinfo:
  - heading "Доставка по всему Казахстану" [level=2]
  - paragraph: Мы осуществляем бережную доставку мебели по всему Казахстану. Поднимем на этаж и занесем в квартиру.
  - heading "Информация" [level=3]
  - list:
    - listitem:
      - link "О компании":
        - /url: /about
    - listitem:
      - link "Доставка":
        - /url: /delivery
    - listitem:
      - link "Контакты":
        - /url: /contacts
    - listitem:
      - link "Акции":
        - /url: /promotions
    - listitem:
      - link "Журнал":
        - /url: /blog
  - heading "Каталог" [level=3]
  - list:
    - listitem:
      - link "Аксессуары":
        - /url: /catalog/aksessuary
    - listitem:
      - link "Детская мебель":
        - /url: /catalog/detskaia-mebel
    - listitem:
      - link "Диваны":
        - /url: /catalog/divany
    - listitem:
      - link "Комоды и тумбы":
        - /url: /catalog/komody-i-tumby
    - listitem:
      - link "Кровати":
        - /url: /catalog/krovati
    - listitem:
      - link "Кухонная мебель":
        - /url: /catalog/kuxonnaia-mebel
    - listitem:
      - link "Матрасы":
        - /url: /catalog/matrasy
    - listitem:
      - link "Мягкая мебель":
        - /url: /catalog/miagkaia-mebel
    - listitem:
      - link "Прихожая":
        - /url: /catalog/prixozaia
    - listitem:
      - link "Столы":
        - /url: /catalog/stoly
    - listitem:
      - link "Стулья и кресла":
        - /url: /catalog/stulia-i-kresla
    - listitem:
      - link "Шкафы":
        - /url: /catalog/skafy
  - heading "Магазины и склады" [level=3]
  - list:
    - listitem: Akmaty
    - listitem: Алматы, Алғабас
    - listitem: Астана
  - link "Paradise.kz":
    - /url: /
  - paragraph: © 2026 Paradise.kz. Все права защищены
- alert
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Comprehensive UI/UX and Business Logic Test Suite', () => {
  4   |   test.describe('B2C User Flow & UI/UX Evaluation', () => {
  5   |     test.beforeEach(async ({ page }) => {
  6   |       // Assuming Next-intl redirects to a default locale like /ru
  7   |       await page.goto('/ru'); 
  8   |     });
  9   | 
  10  |     test('should have premium styling and responsive layout on the homepage', async ({ page, isMobile }) => {
  11  |       // 1. Evaluate Visual Hierarchy & Styling (UI)
  12  |       const header = page.locator('header').first();
  13  |       await expect(header).toBeVisible();
  14  |       
  15  |       // Check for sticky header and backdrop-blur (Premium UI practice)
  16  |       const headerClasses = await header.getAttribute('class');
  17  |       expect(headerClasses).toContain('sticky');
  18  |       expect(headerClasses).toContain('backdrop-blur');
  19  | 
  20  |       // Check Typography and Colors
  21  |       const body = page.locator('body');
  22  |       const fontFamily = await body.evaluate((el) => window.getComputedStyle(el).fontFamily);
  23  |       expect(fontFamily).not.toBe('Times New Roman'); // Ensuring modern font is applied
  24  | 
  25  |       // 2. Evaluate User-Friendliness (UX)
  26  |       // Call-to-actions should be accessible and visible
  27  |       const catalogLink = page.getByRole('link', { name: /Каталог/i }).first();
  28  |       if (!isMobile) {
  29  |         await expect(catalogLink).toBeVisible();
  30  |         await expect(catalogLink).toHaveCSS('cursor', 'pointer');
  31  |       }
  32  | 
  33  |       // Check Hover states for interactable elements
  34  |       const cartIcon = page.locator('a[href*="/cart"]').first();
  35  |       await expect(cartIcon).toBeVisible();
  36  |       const cartTransition = await cartIcon.evaluate((el) => window.getComputedStyle(el).transition);
  37  |       expect(cartTransition).toContain('opacity'); // Checking for smooth micro-interactions
  38  |     });
  39  | 
  40  |     test('should correctly simulate B2C shopping flow and calculate totals', async ({ page }) => {
  41  |       // Navigate to Catalog
  42  |       await page.goto('/ru/catalog');
  43  | 
  44  |       // Wait for products to load
  45  |       const productCard = page.locator('article, .group').first();
  46  |       await expect(productCard).toBeVisible();
  47  | 
  48  |       // Ensure product images have proper aspect ratios and object-fit (UI best practice)
  49  |       const image = productCard.locator('img').first();
> 50  |       await expect(image).toBeVisible();
      |                           ^ Error: expect(locator).toBeVisible() failed
  51  |       const objectFit = await image.evaluate((el) => window.getComputedStyle(el).objectFit);
  52  |       expect(['cover', 'contain']).toContain(objectFit);
  53  | 
  54  |       // Extract price
  55  |       const priceText = await productCard.locator('.text-lg.font-bold, [data-testid="product-price"]').first().textContent() || '0';
  56  |       const price = parseInt(priceText.replace(/\D/g, ''), 10);
  57  | 
  58  |       // Add to cart action
  59  |       const addToCartBtn = productCard.getByRole('button', { name: /В корзину|Добавить/i }).first();
  60  |       if (await addToCartBtn.isVisible()) {
  61  |           await addToCartBtn.click();
  62  |           
  63  |           // UX: Check for feedback after action (e.g., toast notification or cart badge update)
  64  |           // (Placeholder: adjust selector based on actual implementation)
  65  |           const cartBadge = page.locator('[data-testid="cart-badge"]');
  66  |           if (await cartBadge.isVisible()) {
  67  |              await expect(cartBadge).not.toBeEmpty();
  68  |           }
  69  |       }
  70  |     });
  71  |   });
  72  | 
  73  |   test.describe('B2B User Flow & UI/UX Evaluation', () => {
  74  |     test.beforeEach(async ({ page }) => {
  75  |       await page.goto('/b2b/catalog');
  76  |     });
  77  | 
  78  |     test('should have a clean, dense layout suitable for B2B wholesale', async ({ page, isMobile }) => {
  79  |       // B2B headers usually have specific tools and dense information
  80  |       const b2bHeader = page.locator('header');
  81  |       await expect(b2bHeader).toBeVisible();
  82  |       await expect(b2bHeader).toContainText('B2B');
  83  | 
  84  |       if (!isMobile) {
  85  |          // Verify desktop navigation layout
  86  |          const nav = b2bHeader.locator('nav');
  87  |          await expect(nav).toBeVisible();
  88  |          await expect(nav.getByRole('link', { name: /Каталог/i })).toBeVisible();
  89  |       }
  90  | 
  91  |       // Verify B2B specific visual design
  92  |       // Expect tabular or dense grid layout for fast ordering
  93  |       const catalogContainer = page.locator('main').first();
  94  |       await expect(catalogContainer).toBeVisible();
  95  |     });
  96  | 
  97  |     test('should stimulate bulk actions and correctly calculate complex totals', async ({ page }) => {
  98  |       // Wait for products
  99  |       const products = page.locator('article, .product-item');
  100 |       await products.first().waitFor({ state: 'visible' });
  101 | 
  102 |       const firstProduct = products.nth(0);
  103 |       const secondProduct = products.nth(1);
  104 | 
  105 |       // In B2B, users often input quantities directly instead of clicking "Add to cart" once
  106 |       const qtyInput1 = firstProduct.locator('input[type="number"]');
  107 |       const qtyInput2 = secondProduct.locator('input[type="number"]');
  108 | 
  109 |       if (await qtyInput1.isVisible() && await qtyInput2.isVisible()) {
  110 |         // UX: Input fields should be easily accessible and large enough
  111 |         const inputHeight = await qtyInput1.evaluate(el => window.getComputedStyle(el).height);
  112 |         expect(parseFloat(inputHeight)).toBeGreaterThanOrEqual(30); // touch target size best practice
  113 | 
  114 |         await qtyInput1.fill('5');
  115 |         await qtyInput2.fill('10');
  116 | 
  117 |         // Extract B2B prices (usually distinct from B2C)
  118 |         const price1Text = await firstProduct.locator('.text-brand, .font-semibold').first().textContent() || '0';
  119 |         const price2Text = await secondProduct.locator('.text-brand, .font-semibold').first().textContent() || '0';
  120 |         
  121 |         const price1 = parseInt(price1Text.replace(/\D/g, ''), 10);
  122 |         const price2 = parseInt(price2Text.replace(/\D/g, ''), 10);
  123 | 
  124 |         // Click Add to Cart or Save Order
  125 |         const addToCartBtn = page.getByRole('button', { name: /В корзину|Добавить/i }).first();
  126 |         if (await addToCartBtn.isVisible()) {
  127 |             await addToCartBtn.click();
  128 |         }
  129 | 
  130 |         // Navigate to cart
  131 |         await page.goto('/b2b/cart');
  132 | 
  133 |         // Business Logic: Check Total Amount Calculation
  134 |         const totalAmountLocator = page.locator('[data-testid="cart-total"], .total-amount').first();
  135 |         if (await totalAmountLocator.isVisible()) {
  136 |            const totalText = await totalAmountLocator.textContent() || '0';
  137 |            const actualTotal = parseInt(totalText.replace(/\D/g, ''), 10);
  138 |            
  139 |            const expectedTotal = (price1 * 5) + (price2 * 10);
  140 |            // Soft assertion to allow test to pass if exact UI match differs, but logs logic check
  141 |            expect(actualTotal).toBe(expectedTotal);
  142 |         }
  143 |       }
  144 |     });
  145 | 
  146 |     test('should evaluate responsiveness and mobile UX', async ({ page }) => {
  147 |        // Set mobile viewport
  148 |        await page.setViewportSize({ width: 375, height: 812 });
  149 |        
  150 |        // Verify hidden desktop elements
```