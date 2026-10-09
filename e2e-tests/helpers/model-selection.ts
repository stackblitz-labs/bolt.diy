import type { Page } from '@playwright/test';

/**
 * Helper function to select a free OpenRouter model
 * This should be called before sending any messages to avoid "Model not found" errors
 */
export async function selectFreeModel(page: Page) {
  try {
    console.log('Attempting to select free model...');
    
    // Wait for initial page load
    await page.waitForTimeout(2000);
    
    // Strategy 1: Look for combobox elements (ModelSelector uses div with role="combobox")
    const providerCombo = page.locator('[role="combobox"]').first();
    const modelCombo = page.locator('[role="combobox"]').nth(1);
    
    const providerExists = await providerCombo.count() > 0;
    const modelExists = await modelCombo.count() > 0;
    
    console.log(`Found ${providerExists ? 1 : 0} provider combobox and ${modelExists ? 1 : 0} model combobox`);
    
    if (providerExists && modelExists) {
      try {
        // Click provider combobox
        await providerCombo.click({ timeout: 2000 });
        await page.waitForTimeout(500);
        
        // Look for OpenRouter option
        const openRouterOption = page.locator('[role="option"]').filter({ hasText: /OpenRouter/i }).first();
        
        if (await openRouterOption.isVisible({ timeout: 2000 })) {
          console.log('Selecting OpenRouter provider');
          await openRouterOption.click();
          await page.waitForTimeout(1500);
          
          // Click model combobox
          await modelCombo.click({ timeout: 2000 });
          await page.waitForTimeout(500);
          
          // Look for a free model option
          const freeModelOption = page
            .locator('[role="option"]')
            .filter({ hasText: /free|Free/i })
            .first();
          
          if (await freeModelOption.isVisible({ timeout: 2000 })) {
            console.log('Selecting free model');
            await freeModelOption.click();
            await page.waitForTimeout(1000);
            
            // Verify selection worked
            const providerText = await providerCombo.textContent();
            const modelText = await modelCombo.textContent();
            console.log(`Selected provider: ${providerText}, model: ${modelText}`);
            
            if (!providerText?.includes('OpenRouter')) {
              throw new Error('Provider selection failed');
            }
            
            console.log('Model selection succeeded');
            return;
          }
        }
      } catch (e) {
        console.log('Combobox selection failed:', e);
      }
    }
    
    // Strategy 2: Fall back to searching for any model buttons or selects
    const modelButtons = page.locator('button').filter({ hasText: /model|provider/i });
    const buttonCount = await modelButtons.count();
    
    if (buttonCount > 0) {
      console.log(`Found ${buttonCount} potential model buttons, trying fallback`);
      
      for (let i = 0; i < Math.min(buttonCount, 3); i++) {
        const button = modelButtons.nth(i);
        
        if (await button.isVisible({ timeout: 2000 })) {
          await button.click();
          await page.waitForTimeout(1500);
          
          const openRouterOption = page.locator('text=OpenRouter').first();
          
          if (await openRouterOption.isVisible({ timeout: 1000 })) {
            await openRouterOption.click();
            await page.waitForTimeout(2000);
            console.log('Selected via fallback method');
            return;
          }
        }
      }
    }
    
    // If we get here, model selection failed
    console.error('⚠️  Model selection failed - tests may use wrong model');
    throw new Error('Failed to select free model - no valid selector found');
    
  } catch (error) {
    console.error('❌ Model selection error:', error);
    throw error; // Re-throw to fail the test rather than silently continuing
  }
}

/**
 * Alternative approach: Set model via cookies before page loads
 * Call this before navigating to the page
 * Note: The app reads provider and model from 'selectedProvider' and 'selectedModel' cookies
 */
export async function setFreeModelInStorage(page: Page) {
  await page.context().addCookies([
    {
      name: 'selectedProvider',
      value: 'OpenRouter',
      domain: 'localhost',
      path: '/',
    },
    {
      name: 'selectedModel',
      value: 'meta-llama/llama-3.2-3b-instruct:free',
      domain: 'localhost',
      path: '/',
    },
  ]);
}
