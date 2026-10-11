import Cookies from 'js-cookie';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { Button } from '~/components/ui/Button';

export default function TavilyTab() {
  const [apiKey, setApiKey] = useState(() => {
    try {
      return (JSON.parse(Cookies.get('apiKeys') || '{}') as Record<string, string>).TAVILY_API_KEY || '';
    } catch {
      return '';
    }
  });

  const [saved, setSaved] = useState(Boolean(apiKey));

  const saveApiKey = (value = apiKey) => {
    try {
      const apiKeys = JSON.parse(Cookies.get('apiKeys') || '{}') as Record<string, string>;
      const nextApiKeys = { ...apiKeys };
      const normalizedKey = value.trim();

      if (normalizedKey) {
        nextApiKeys.TAVILY_API_KEY = normalizedKey;
      } else {
        delete nextApiKeys.TAVILY_API_KEY;
      }

      Cookies.set('apiKeys', JSON.stringify(nextApiKeys), { expires: 365, sameSite: 'Lax' });
      setApiKey(normalizedKey);
      setSaved(Boolean(normalizedKey));
      toast.success(normalizedKey ? 'Tavily API key saved.' : 'Tavily API key removed.');
    } catch {
      toast.error('Could not save the Tavily API key.');
    }
  };

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h2 className="text-lg font-medium text-bolt-elements-textPrimary">Tavily Web Search</h2>
        <p className="mt-1 text-sm text-bolt-elements-textSecondary">
          Add a Tavily API key to search the web and extract page content for chat context. Your key is stored in your
          browser cookies and sent to this app when you use web search. A server-side <code>TAVILY_API_KEY</code> can be
          used instead.
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="tavily-api-key" className="text-sm font-medium text-bolt-elements-textPrimary">
          API key
        </label>
        <input
          id="tavily-api-key"
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(event) => {
            setApiKey(event.target.value);
            setSaved(false);
          }}
          placeholder="tvly-…"
          className="w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2 text-sm text-bolt-elements-textPrimary placeholder:text-bolt-elements-textSecondary placeholder:opacity-100 focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button className="!bg-purple-600 !text-white hover:!bg-purple-700" onClick={() => saveApiKey()}>
          Save API key
        </Button>
        {saved && (
          <Button
            variant="outline"
            className="!border-bolt-elements-borderColorActive !text-bolt-elements-textPrimary hover:!bg-bolt-elements-background-depth-2"
            onClick={() => {
              saveApiKey('');
            }}
          >
            Remove key
          </Button>
        )}
        {saved && <span className="text-sm text-bolt-elements-textSecondary">Configured</span>}
        <a
          href="https://app.tavily.com/home"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-bolt-elements-item-contentAccent hover:underline"
        >
          Get a Tavily key
        </a>
      </div>
    </div>
  );
}
