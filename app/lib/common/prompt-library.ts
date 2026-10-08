import { getFineTunedPrompt } from './prompts/new-prompt';
import optimized from './prompts/optimized';
import { getSystemPrompt } from './prompts/prompts';
import { getSimpleSalPrompt } from './prompts/simple-sal';
import { getTinyTimPrompt } from './prompts/tiny-tim';
import type { DesignScheme } from '~/types/design-scheme';

export interface PromptOptions {
  cwd: string;
  allowedHtmlElements: string[];
  modificationTagName: string;
  designScheme?: DesignScheme;
  supabase?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: {
      anonKey?: string;
      supabaseUrl?: string;
    };
  };
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
      description: 'An fine tuned prompt for better results and less token usage',
      get: (options) => getFineTunedPrompt(options.cwd, options.supabase, options.designScheme),
    },
    'simple-sal': {
      label: 'Simple Sal',
      description: 'Balanced prompt with core Bolt features and no-fluff communication',
      get: (options) => getSimpleSalPrompt(options.cwd, options.supabase, options.designScheme),
    },
    'tiny-tim': {
      label: 'Tiny Tim',
      description: 'Optimized for small models with terse format and modern 2026 standards',
      get: (options) => getTinyTimPrompt(options.cwd, options.supabase, options.designScheme),
    },
    'og-prompt': {
      label: 'OG Prompt',
      description: 'The original battle tested default system prompt',
      get: (options) => getSystemPrompt(options.cwd, options.supabase, options.designScheme),
    },
    'experimental-prompt': {
      label: 'Experimental Prompt',
      description: 'Experimental version of the prompt for lower token usage',
      get: (options) => optimized(options),
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
      throw 'Prompt Now Found';
    }

    return this.library[promptId]?.get(options);
  }
}
