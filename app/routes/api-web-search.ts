import { json } from '@remix-run/node';
import type { ActionFunctionArgs } from '@remix-run/node';

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const url = formData.get('url') as string;

    if (!url) {
      return json({ error: 'URL is required' }, { status: 400 });
    }

    // Add proper headers to handle CORS and content type
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');

    if (!contentType?.includes('text/html')) {
      throw new Error('URL must point to an HTML page');
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'No title found';

    // Extract meta description
    const descriptionMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';

    // Extract main content
    const mainContent = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract code blocks
    const codeBlocks = html.match(/<pre[^>]*>[\s\S]*?<\/pre>|<code[^>]*>[\s\S]*?<\/code>/gi) || [];
    const formattedCodeBlocks = codeBlocks.map((block) => {
      return block
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();
    });

    // Extract links
    const links = html.match(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi) || [];
    const formattedLinks = links.map((link) => {
      const hrefMatch = link.match(/href="([^"]*)"/i);
      const textMatch = link.match(/>([^<]*)</i);

      return {
        url: hrefMatch ? hrefMatch[1] : '',
        text: textMatch ? textMatch[1].trim() : '',
      };
    });

    // Structure the content for code generation
    const structuredContent = {
      title,
      description,
      mainContent: mainContent.slice(0, 1000) + '...',
      codeBlocks: formattedCodeBlocks,
      relevantLinks: formattedLinks.filter(
        (link) => link.url && !link.url.startsWith('#') && !link.url.startsWith('javascript:') && link.text.trim(),
      ),
      sourceUrl: url,
    };

    return json({
      success: true,
      data: structuredContent,
    });
  } catch (error) {
    console.error('Web search error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error occurred' }, { status: 500 });
  }
}
