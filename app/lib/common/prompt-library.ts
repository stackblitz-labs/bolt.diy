import { getSystemPrompt } from './prompts/prompts';
import optimized from './prompts/optimized';
import { getAdvancedPrompt } from './prompts/advanced-prompts';

export interface PromptOptions {
  cwd: string;
  allowedHtmlElements: string[];
  modificationTagName: string;
}

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
      description: 'This is the battle-tested default system prompt',
      get: (options) => getSystemPrompt(options.cwd),
    },
    optimized: {
      label: 'Optimized Prompt (experimental)',
      description: 'An experimental version of the prompt for lower token usage',
      get: (options) => optimized(options),
    },
    advanced: {
      label: 'Advanced Prompt',
      description: 'A more sophisticated prompt for enhanced AI assistance',
      get: (options) => getAdvancedPrompt(options),
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
}
