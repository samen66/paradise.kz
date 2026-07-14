import { expect, type Locator, type Page } from '@playwright/test';

export class CatalogPage {
  readonly page: Page;
  readonly productCards: Locator;
  readonly addToCartButtons: Locator;

  constructor(page: Page) {
    this.page = page;
    this.productCards = page.locator('article');
    this.addToCartButtons = page.getByRole('button', { name: /В корзину|Добавить/i });
  }

  async goto() {
    await this.page.goto('/ru/catalog');
  }

  async getFirstProductPrice() {
    const priceText = await this.productCards.first().locator('.text-lg').textContent();
    return parseInt(priceText?.replace(/\D/g, '') || '0', 10);
  }

  async addFirstProductToCart() {
    await this.addToCartButtons.first().click();
  }
}
