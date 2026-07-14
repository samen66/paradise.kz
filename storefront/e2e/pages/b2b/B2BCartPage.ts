import { expect, type Locator, type Page } from '@playwright/test';

export class B2BCartPage {
  readonly page: Page;
  readonly totalAmount: Locator;

  constructor(page: Page) {
    this.page = page;
    this.totalAmount = page.locator('.total-amount, [data-testid="cart-total"]');
  }

  async goto() {
    await this.page.goto('/b2b/cart');
  }

  async getTotal() {
    const totalText = await this.totalAmount.textContent();
    return parseInt(totalText?.replace(/\D/g, '') || '0', 10);
  }
}
