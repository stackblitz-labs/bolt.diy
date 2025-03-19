import { getSystemPrompt } from './prompts/prompts';
import optimized from './prompts/optimized';

export interface PromptOptions {
  cwd: string;
  allowedHtmlElements: string[];
  modificationTagName: string;
}

// Define a constant for the localStorage key
export const CUSTOM_PROMPT_STORAGE_KEY = 'custom_prompt';

export class PromptLibrary {
  static library: Record<
    string,
    {
      label: string;
      description: string;
      get: (options: PromptOptions) => string;
    }
  > = {
    default: {
      label: 'Default Prompt',
      description: 'This is the battle tested default system Prompt',
      get: (options) => getSystemPrompt(options.cwd),
    },
    optimized: {
      label: 'Optimized Prompt (experimental)',
      description: 'an Experimental version of the prompt for lower token usage',
      get: (options) => optimized(options),
    },
    custom: {
      label: 'Custom Prompt',
      description: 'Your own custom system prompt',
      get: (_options) => {
        // Get the custom prompt from localStorage if available
        if (typeof window !== 'undefined') {
          const customPrompt = localStorage.getItem(CUSTOM_PROMPT_STORAGE_KEY);
          return customPrompt && customPrompt.trim()
            ? customPrompt
            : 'No custom prompt defined. Please set a custom prompt in the settings.';
        }

        return 'Custom prompt not available';
      },
    },
  };
  static getList() {
    return Object.entries(this.library).map(([key, value]) => {
      const { label, description } = value;
      return {
        id: key,
        label,
        description,
      };
    });
  }
  static getPropmtFromLibrary(promptId: string, options: PromptOptions) {
    const prompt = this.library[promptId];

    if (!prompt) {
      throw 'Prompt Not Found';
    }

    return this.library[promptId]?.get(options);
  }

  // Helper method to save a custom prompt to localStorage
  static saveCustomPrompt(promptText: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CUSTOM_PROMPT_STORAGE_KEY, promptText);

      // Dispatch a storage event to notify other tabs/windows
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: CUSTOM_PROMPT_STORAGE_KEY,
          newValue: promptText,
        }),
      );
    }
  }

  // Helper method to get the current custom prompt from localStorage
  static getCustomPrompt(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(CUSTOM_PROMPT_STORAGE_KEY) || '';
    }

    return '';
  }

  // Helper method to check if a custom prompt exists
  static hasCustomPrompt(): boolean {
    if (typeof window !== 'undefined') {
      const prompt = localStorage.getItem(CUSTOM_PROMPT_STORAGE_KEY);
      return !!prompt && prompt.trim().length > 0;
    }

    return false;
  }
}
