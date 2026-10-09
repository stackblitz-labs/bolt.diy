import type { Page } from '@playwright/test';

/**
 * Helper function to select a free OpenRouter model
 * This should be called before sending any messages
 */
export async function selectFreeModel(page: Page) {
  try {
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Look for the model selector button (usually shows current model name)
    const modelButton = page.locator('button').filter({ 
      hasText: /claude|gpt|model|select/i 
    }).first();
    
    // Try to click it
    const buttonVisible = await modelButton.isVisible({ timeout: 5000 });
    
    if (!buttonVisible) {
      console.log('Model selector not found, trying alternative approach');
      return;
    }
    
    await modelButton.click();
    await page.waitForTimeout(1000);
    
    // Look for OpenRouter in provider dropdown
    const openRouterOption = page.locator('text=OpenRouter').first();
    const hasOpenRouter = await openRouterOption.isVisible({ timeout: 2000 });
    
    if (hasOpenRouter) {
      await openRouterOption.click();
      await page.waitForTimeout(2000);
    }
    
    // Look for a free model - try to find one with "free" in the name
    const freeModelOption = page.locator('[role="option"], [role="menuitem"]').filter({ 
      hasText: /free|gratis|0\.00/i 
    }).first();
    
    const hasFreeModel = await freeModelOption.isVisible({ timeout: 2000 });
    
    if (hasFreeModel) {
      await freeModelOption.click();
      await page.waitForTimeout(1000);
    } else {
      // Just select the first available model
      console.log('No free model found, selecting first available');
      const firstModel = page.locator('[role="option"], [role="menuitem"]').first();
      const hasFirstModel = await firstModel.isVisible({ timeout: 2000 });
      
      if (hasFirstModel) {
        await firstModel.click();
        await page.waitForTimeout(1000);
      }
    }
    
    // Close the selector if it's still open
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
  } catch (error) {
    console.log('Could not select model automatically:', error);
    // Continue anyway - model might already be selected
  }
}

/**
 * Simpler approach: Set model via local storage before page loads
 */
export async function setModelInStorage(page: Page) {
  await page.addInitScript(() => {
    // Try to set a default free model in local storage
    const settings = {
      provider: 'OpenRouter',
      model: 'meta-llama/llama-3.2-3b-instruct:free', // A known free model
    };
    
    try {
      localStorage.setItem('bolt_settings_provider', settings.provider);
      localStorage.setItem('bolt_settings_model', settings.model);
    } catch (e) {
      console.log('Could not set model in storage');
    }
  });
}
