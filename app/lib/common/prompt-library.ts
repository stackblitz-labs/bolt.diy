import { getSystemPrompt } from './prompts/prompts';
import optimized from './prompts/optimized';
import { v4 as uuidv4 } from 'uuid';

export interface PromptOptions {
  cwd: string;
  allowedHtmlElements: string[];
  modificationTagName: string;
}

export interface CustomPrompt {
  id: string;
  label: string;
  description: string;
  content: string;
  category: string;
  isSystem?: boolean;
}

export class PromptLibrary {
  private static readonly STORAGE_KEY = 'bolt_custom_prompts';
  private static readonly DEFAULT_CATEGORIES = [
    'Development',
    'Writing',
    'Business',
    'Education',
    'Code Quality',
    'Project Continuation',
    'Debugging',
    'Refactoring',
    'Code Architecture',
    'Testing',
    'Performance',
    'Custom'
  ];
  
  private static readonly SYSTEM_PROMPTS: CustomPrompt[] = [
    {
      id: 'default',
      label: 'Default Development Assistant',
      description: 'General-purpose development assistant for coding tasks',
      content: 'You are an expert software developer. Help me with coding tasks, debugging, and technical questions.',
      category: 'Development',
      isSystem: true
    },
    {
      id: 'code-review',
      label: 'Code Reviewer',
      description: 'Analyzes code for potential issues and suggests improvements',
      content: 'Review my code for bugs, performance issues, and best practices. Suggest specific improvements.',
      category: 'Code Quality',
      isSystem: true
    },
    {
      id: 'documentation',
      label: 'Documentation Writer',
      description: 'Helps write clear and comprehensive documentation',
      content: 'Help me write clear, concise technical documentation including comments, README files, and API docs.',
      category: 'Writing',
      isSystem: true
    }
  ];

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
  };

  static getList(): CustomPrompt[] {
    return this.SYSTEM_PROMPTS;
  }

  static getCustomPrompts(): CustomPrompt[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return [];
    
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  static getCategories(): string[] {
    const customPrompts = this.getCustomPrompts();
    const customCategories = new Set(customPrompts.map(p => p.category));
    const systemCategories = new Set(this.SYSTEM_PROMPTS.map(p => p.category));
    
    return [...new Set([
      ...this.DEFAULT_CATEGORIES,
      ...customCategories,
      ...systemCategories
    ])].sort();
  }

  static addCustomPrompt(prompt: Omit<CustomPrompt, 'id'>): CustomPrompt {
    const newPrompt: CustomPrompt = {
      ...prompt,
      id: uuidv4()
    };

    const customPrompts = this.getCustomPrompts();
    customPrompts.push(newPrompt);
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(customPrompts));
    return newPrompt;
  }

  static updateCustomPrompt(id: string, updates: Partial<Omit<CustomPrompt, 'id'>>): void {
    const customPrompts = this.getCustomPrompts();
    const index = customPrompts.findIndex(p => p.id === id);
    
    if (index === -1) {
      throw new Error('Prompt not found');
    }

    customPrompts[index] = {
      ...customPrompts[index],
      ...updates
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(customPrompts));
  }

  static deleteCustomPrompt(id: string): void {
    const customPrompts = this.getCustomPrompts();
    const filtered = customPrompts.filter(p => p.id !== id);
    
    if (filtered.length === customPrompts.length) {
      throw new Error('Prompt not found');
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
  }

  static getPropmtFromLibrary(promptId: string, options: PromptOptions) {
    const prompt = this.library[promptId];

    if (!prompt) {
      throw 'Prompt Now Found';
    }

    return this.library[promptId]?.get(options);
  }
}
