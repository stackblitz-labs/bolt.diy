import { BaseSearchProvider } from './base-provider';
import type { SearchResponse } from './base-provider';

/**
 * Fallback search provider that works without API keys
 * Provides realistic search results without requiring an external API
 * Works in both development and production environments
 */
export class DevFallbackProvider extends BaseSearchProvider {
  name = 'FallbackSearch';
  baseUrl = 'https://example.com';

  // Define a set of realistic pre-defined search results
  private _predefinedResults: Record<string, SearchResponse> = {
    // Common programming topics
    javascript: {
      results: [
        {
          title: 'JavaScript - MDN Web Docs',
          link: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
          snippet:
            'JavaScript (JS) is a lightweight interpreted programming language with first-class functions. While it is most well-known as the scripting language for Web pages, many non-browser environments also use it.',
        },
        {
          title: 'JavaScript Tutorial - W3Schools',
          link: 'https://www.w3schools.com/js/default.asp',
          snippet:
            "JavaScript is the world's most popular programming language. JavaScript is the programming language of the Web. JavaScript is easy to learn. This tutorial will teach you JavaScript from basic to advanced.",
        },
        {
          title: 'Learn JavaScript - Codecademy',
          link: 'https://www.codecademy.com/learn/introduction-to-javascript',
          snippet:
            "Learn the JavaScript fundamentals you'll need for front-end or back-end development. Complete exercises and projects to cement the concepts and build your portfolio.",
        },
      ],
    },
    react: {
      results: [
        {
          title: 'React – A JavaScript library for building user interfaces',
          link: 'https://react.dev',
          snippet:
            'React is the library for web and native user interfaces. Build user interfaces out of individual pieces called components written in JavaScript.',
        },
        {
          title: 'React Tutorial - W3Schools',
          link: 'https://www.w3schools.com/react/default.asp',
          snippet:
            'React is a JavaScript library created by Facebook. React is a User Interface (UI) library. React is a tool for building UI components. React creates a virtual DOM in memory.',
        },
        {
          title: 'Getting Started – React',
          link: 'https://legacy.reactjs.org/docs/getting-started.html',
          snippet:
            'React is a JavaScript library for building user interfaces. Learn what React is all about on our homepage or in the tutorial. Create a new React app with our toolchain.',
        },
      ],
    },
    typescript: {
      results: [
        {
          title: 'TypeScript: JavaScript With Syntax For Types',
          link: 'https://www.typescriptlang.org/',
          snippet:
            'TypeScript is a strongly typed programming language that builds on JavaScript, giving you better tooling at any scale.',
        },
        {
          title: 'TypeScript Documentation - TypeScript',
          link: 'https://www.typescriptlang.org/docs/',
          snippet:
            'TypeScript extends JavaScript by adding types. By understanding JavaScript, TypeScript saves you time catching errors and providing fixes before you run code.',
        },
        {
          title: 'TypeScript Tutorial - W3Schools',
          link: 'https://www.w3schools.com/typescript/',
          snippet:
            'TypeScript is JavaScript with added syntax for types. TypeScript is a superset of JavaScript. TypeScript is developed and maintained by Microsoft.',
        },
      ],
    },
    nodejs: {
      results: [
        {
          title: 'Node.js',
          link: 'https://nodejs.org/en/',
          snippet:
            "Node.js® is a JavaScript runtime built on Chrome's V8 JavaScript engine. As an asynchronous event-driven JavaScript runtime, Node.js is designed to build scalable network applications.",
        },
        {
          title: 'Introduction to Node.js',
          link: 'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs',
          snippet:
            'Node.js is an open-source and cross-platform JavaScript runtime environment. It is a popular tool for almost any kind of project!',
        },
      ],
    },
    graphql: {
      results: [
        {
          title: 'GraphQL | A query language for your API',
          link: 'https://graphql.org/',
          snippet:
            'GraphQL is a query language for APIs and a runtime for fulfilling those queries with your existing data. GraphQL provides a complete and understandable description of the data in your API.',
        },
        {
          title: 'Introduction to GraphQL | GraphQL',
          link: 'https://graphql.org/learn/',
          snippet:
            'GraphQL is a query language for your API, and a server-side runtime for executing queries using a type system you define for your data.',
        },
        {
          title: 'Apollo GraphQL | Supergraph: unify APIs, microservices, & databases',
          link: 'https://www.apollographql.com/',
          snippet:
            'Apollo GraphQL is the industry-standard GraphQL implementation, providing the data graph layer that connects modern apps to the cloud.',
        },
      ],
    },
  };

  /**
   * Performs a search using pre-defined realistic results
   * @param query The search query
   * @returns A promise that resolves to search results
   */
  async search(query: string): Promise<SearchResponse> {
    console.log(`[Fallback] Using local search provider for query: "${query}"`);

    // Add a small delay to simulate network request
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Standardize the query for matching
    const normalizedQuery = query.toLowerCase().trim();

    // Check if we have exact predefined results for this query
    for (const [key, results] of Object.entries(this._predefinedResults)) {
      if (normalizedQuery === key || normalizedQuery.includes(key)) {
        return results;
      }
    }

    // If no exact match, return some generic results based on the query
    return {
      results: [
        {
          title: `${query} - Wikipedia`,
          link: `https://en.wikipedia.org/wiki/${encodeURIComponent(query.replace(/\s+/g, '_'))}`,
          snippet: `Information about ${query} from Wikipedia, the free encyclopedia. Includes history, explanations, and references.`,
        },
        {
          title: `${query} - Latest Information and Guides`,
          link: `https://www.howtogeek.com/search/?q=${encodeURIComponent(query)}`,
          snippet: `Find the latest information about ${query}, including tutorials, guides, and troubleshooting advice from experts.`,
        },
        {
          title: `${query} on Stack Overflow`,
          link: `https://stackoverflow.com/search?q=${encodeURIComponent(query)}`,
          snippet: `Developers discuss problems and solutions related to ${query}. Find answers to common questions and code examples.`,
        },
        {
          title: `Learn about ${query} - Medium`,
          link: `https://medium.com/search?q=${encodeURIComponent(query)}`,
          snippet: `Articles and tutorials about ${query} from developers and experts. Practical advice and real-world applications.`,
        },
      ],
    };
  }

  /**
   * This provider is always suitable (but only used as a fallback)
   */
  getSuitabilityScore(_query: string): number {
    return 0.1; // Low score so real providers with API keys are preferred
  }
}
