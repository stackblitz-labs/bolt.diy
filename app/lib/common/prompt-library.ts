import { getFineTunedPrompt } from './prompts/new-prompt';
import optimized from './prompts/optimized';
import { getProjectToolPrompt } from './prompts/project-tools';
import { getTinyTimPrompt } from './prompts/tiny-tim';
import type { DesignScheme } from '~/types/design-scheme';

export interface PromptOptions {
  cwd: string;
  allowedHtmlElements: string[];
  modificationTagName: string;
  designScheme?: DesignScheme;
  projectTools?: boolean;
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
      description: 'Optimized prompt with improved tool usage and error recovery',
      get: (options) => getFineTunedPrompt(options.cwd, options.supabase, options.designScheme),
    },
    'tiny-tim': {
      label: 'Tiny Tim',
      description: 'Optimized for small models with terse format and modern 2026 standards',
      get: (options) => getTinyTimPrompt(options.cwd, options.supabase, options.designScheme),
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

  /**
   * Resolves a prompt template by id, falling back to the default template.
   *
   * `promptId` is persisted in localStorage and in exported settings, so it
   * outlives the ids that produced it — they have been renamed several times
   * (`og-prompt`, `simple-sal`, `diligent-dan`, …). An unknown id therefore
   * means a stale preference, not a fatal error: throwing here used to abort
   * the whole chat request with a bare string, which surfaced as the baffling
   * "Prompt Now Found" provider error.
   */
  static getPromptFromLibrary(promptId: string, options: PromptOptions): string {
    if (options.projectTools) {
      return getProjectToolPrompt(options);
    }

    const prompt = this.library[promptId] ?? this.library.default;

    if (!prompt) {
      throw new Error(`No prompt template is registered for "${promptId}" and no default exists.`);
    }

    return prompt.get(options);
  }
}
