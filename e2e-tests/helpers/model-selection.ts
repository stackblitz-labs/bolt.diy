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
    
    // Try multiple strategies to find and click the model selector
    
    // Strategy 1: Look for button with model name text
    const modelButtons = page.locator('button').filter({ 
      hasText: /claude|sonnet|gpt|model|llama|gemini/i 
    });
    
    const buttonCount = await modelButtons.count();
    console.log(`Found ${buttonCount} potential model selector buttons`);
    
    if (buttonCount > 0) {
      // Click the first one that's visible
      for (let i = 0; i < Math.min(buttonCount, 3); i++) {
        const button = modelButtons.nth(i);
        if (await button.isVisible({ timeout: 2000 })) {
          console.log(`Clicking model button ${i}`);
          await button.click();
          await page.waitForTimeout(1500);
          
          // Look for OpenRouter or free model options
          const openRouterOption = page.locator('text=OpenRouter, [role="option"]').filter({ hasText: /openrouter/i }).first();
          const freeModelOption = page.locator('[role="option"], [role="menuitem"]').filter({ 
            hasText: /free|llama.*free|gratis/i 
          }).first();
          
          // Try to select OpenRouter provider first
          if (await openRouterOption.isVisible({ timeout: 1000 })) {
            console.log('Selecting OpenRouter provider');
            await openRouterOption.click();
            await page.waitForTimeout(2000);
          }
          
          // Try to select a free model
          if (await freeModelOption.isVisible({ timeout: 1000 })) {
            console.log('Selecting free model');
            await freeModelOption.click();
            await page.waitForTimeout(1000);
          }
          
          // Close any open menus
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
          
          console.log('Model selection attempted successfully');
          return;
        }
      }
    }
    
    // Strategy 2: Look for select elements
    const selects = page.locator('select');
    const selectCount = await selects.count();
    
    if (selectCount > 0) {
      console.log(`Found ${selectCount} select elements, trying first one`);
      const firstSelect = selects.first();
      
      // Try to select OpenRouter
      try {
        await firstSelect.selectOption({ label: 'OpenRouter' });
        await page.waitForTimeout(1000);
        console.log('Selected OpenRouter via select element');
      } catch (e) {
        console.log('Could not select OpenRouter via select element');
      }
      
      // Try to select a free model from second select if it exists
      if (selectCount > 1) {
        const modelSelect = selects.nth(1);
        try {
          // Get all options and look for a free one
          const options = await modelSelect.locator('option').all();
          for (const option of options) {
            const text = await option.textContent();
            if (text && /free|llama.*free|gratis/i.test(text)) {
              const value = await option.getAttribute('value');
              if (value) {
                await modelSelect.selectOption(value);
                console.log(`Selected free model: ${text}`);
                await page.waitForTimeout(1000);
                return;
              }
            }
          }
        } catch (e) {
          console.log('Could not select model via select element');
        }
      }
    }
    
    console.log('Model selection complete (may be using default)');
    
  } catch (error) {
    console.log('Model selection failed, continuing with default:', error);
    // Continue anyway - the app will fall back to a default model
  }
}

/**
 * Alternative approach: Set model via localStorage before page loads
 * Call this before navigating to the page
 */
export async function setFreeModelInStorage(page: Page) {
  await page.addInitScript(() => {
    // Set a known free model in local storage
    try {
      localStorage.setItem('bolt_provider', 'OpenRouter');
      localStorage.setItem('bolt_model', 'meta-llama/llama-3.2-3b-instruct:free');
    } catch (e) {
      console.log('Could not set model in storage');
    }
  });
}
