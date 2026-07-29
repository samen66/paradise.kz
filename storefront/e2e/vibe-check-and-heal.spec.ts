import { test, expect } from '@playwright/test';
import { GoogleGenAI, Type } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function fileToGenerativePart(filePath: string, mimeType: string) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
      mimeType
    },
  };
}

test('Vibe Check с эмуляцией корзины и авто-исправлением кода', async ({ page }, testInfo) => {
  // --- ЭТАП 1: ИНТЕРАКТИВНЫЕ ДЕЙСТВИЯ (Клик и открытие корзины) ---
  await page.goto('/catalog', { waitUntil: 'domcontentloaded' });
  // Removed networkidle because Next.js HMR connection prevents network from being idle
  // await page.waitForLoadState('networkidle');

  // Находим первую кнопку добавления в корзину на странице каталога
  const addToCartButton = page.locator('button[aria-label="В корзину"], button:has-text("В корзину"), button[aria-label="Add to cart"], button:has-text("Add to cart")').first();
  await expect(addToCartButton).toBeVisible();
  
  // Кликаем для вызова корзины (сайдбара или модального окна)
  await addToCartButton.click();

  // Ожидаем появление элемента корзины (замените селектор на ваш, например [data-testid="cart-sidebar"])
  const cartSidebar = page.locator('aside, [role="dialog"], .cart-sidebar').first();
  await cartSidebar.waitFor({ state: 'visible', timeout: 5000 });

  // Делаем скриншот открытой корзины поверх каталога
  const screenshotName = `cart-open-${testInfo.project.name}.png`;
  
  // Создаем папку если ее нет
  const vibeReportsDir = path.join(__dirname, `../vibe-reports`);
  if (!fs.existsSync(vibeReportsDir)) {
      fs.mkdirSync(vibeReportsDir, { recursive: true });
  }

  const screenshotPath = path.join(vibeReportsDir, screenshotName);
  await page.screenshot({ path: screenshotPath });

  // --- ЭТАП 2: АНАЛИЗ ЧЕРЕЗ GEMINI С КУРАТОРСТВОМ СТРУКТУРЫ (JSON Schema) ---
  const imagePart = fileToGenerativePart(screenshotPath, "image/png");

  const prompt = `
    Ты — ИИ-агент экосистемы Google Antigravity. Проведи Vibe Check скриншота открытой корзины в Next.js (Tailwind CSS).
    Проверь отступы, наложение элементов, размытие фона (backdrop-blur) и адаптивность.
    
    Если найдены визуальные дефекты, укажи путь к файлу компонента (например, "components/CartSidebar.tsx") 
    и предложи точную замену старого кода на новый код с исправленными классами Tailwind CSS.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [prompt, imagePart],
    config: {
      // Заставляем модель отвечать строго по схеме для автоматического парсинга
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          status: { type: Type.STRING, enum: ["Идеально", "Требует правок"] },
          bugDescription: { type: Type.STRING },
          hasPatch: { type: Type.BOOLEAN },
          patch: {
            type: Type.OBJECT,
            properties: {
              relativeFilePath: { type: Type.STRING, description: "Путь к файлу относительно папки /storefront, например: src/components/CartSidebar.tsx" },
              oldCodeSnippet: { type: Type.STRING, description: "Точный старый фрагмент кода, который нужно заменить" },
              newCodeSnippet: { type: Type.STRING, description: "Новый исправленный фрагмент кода" }
            },
            required: ["relativeFilePath", "oldCodeSnippet", "newCodeSnippet"]
          }
        },
        required: ["status", "bugDescription", "hasPatch"]
      }
    }
  });

  const report = JSON.parse(response.text || "{}");
  console.log(`\n=== РЕЗУЛЬТАТ VIBE CHECK [${testInfo.project.name}] ===\n`, report);

  // --- ЭТАП 3: АВТОНОМНОЕ ИСПРАВЛЕНИЕ (Self-Healing) ---
  if (report.status === "Требует правок" && report.hasPatch && report.patch) {
    const targetFilePath = path.resolve(__dirname, '../../', report.patch.relativeFilePath);

    if (fs.existsSync(targetFilePath)) {
      let fileContent = fs.readFileSync(targetFilePath, 'utf8');

      // Проверяем, существует ли старый кусок кода в файле для безопасной замены
      if (fileContent.includes(report.patch.oldCodeSnippet)) {
        console.log(`[Self-Healing]: Обнаружен баг в ${report.patch.relativeFilePath}. Применяю фикс...`);
        
        // Перезаписываем файл, заменяя старый некорректный UI-код на исправленный от Gemini
        fileContent = fileContent.replace(report.patch.oldCodeSnippet, report.patch.newCodeSnippet);
        fs.writeFileSync(targetFilePath, fileContent, 'utf8');
        
        console.log(`[Self-Healing]: Файл ${report.patch.relativeFilePath} успешно обновлен.`);
      } else {
        console.warn(`[Self-Healing]: Не удалось сопоставить старый код в файле ${report.patch.relativeFilePath} для авто-замены.`);
      }
    } else {
      console.warn(`[Self-Healing]: Файл по пути ${targetFilePath} не найден.`);
    }
  }

  // Падаем в CI/CD тесте, если статус не "Идеально", чтобы запустить повторную пересборку
  expect(report.status).toBe("Идеально");
});
