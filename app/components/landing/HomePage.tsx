import { useState } from 'react';
import { Link } from '@remix-run/react';

interface HomePageProps {
  onStart: (prompt: string) => void;
}

export function HomePage({ onStart }: HomePageProps) {
  const [searchInput, setSearchInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (searchInput.trim()) {
      onStart(searchInput);
    }
  };

  const handlePromptClick = (text: string) => {
    onStart(text);
  };

  const examplePrompts = [
    "Post tonight's special",
    'Add a 15% happy hour discount',
    'Change closing time to 10pm',
    'Our website needs a new look',
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 overflow-x-hidden transition-colors font-sans">
      {/* Header */}
      <header className="absolute top-0 left-0 w-full z-50 px-4 h-[var(--header-height)] flex items-center transition-all duration-300">
        <div className="w-full flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src="/huskIT.svg" alt="HuskIT" className="w-[90px] inline-block" />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span className="text-lg">🇺🇸</span>
              <span className="font-medium">English</span>
            </div>
            <Link
              to="/auth/login"
              className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 text-sm font-semibold rounded-full shadow-sm transition-all"
            >
              Login
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative w-full min-h-screen flex flex-col items-center justify-center pt-24 pb-20 px-4">
        {/* Background blur effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-200/30 dark:bg-purple-900/10 rounded-full blur-[150px]" />
          <div className="absolute top-[10%] right-[-10%] w-[50%] h-[60%] bg-pink-200/30 dark:bg-pink-900/10 rounded-full blur-[150px]" />
        </div>

        <div className="max-w-4xl w-full text-center z-10 flex flex-col items-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50 text-blue-600 dark:text-blue-400 text-xs font-bold tracking-wider uppercase mb-8 backdrop-blur-sm">
            <span className="i-ph:sparkle-fill text-sm" />
            THE FUTURE OF HOSPITALITY
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-gray-900 dark:text-white mb-4 leading-[1.1]">
            Serve your guests.
          </h1>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 leading-[1.1]">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600">
              Prompt the rest.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-12 max-w-3xl leading-relaxed">
            No dashboards. No passwords. Just prompt what you need changed,
            <br className="hidden md:block" />
            and our AI executes it instantly—everywhere.
          </p>

          {/* Search Input */}
          <form onSubmit={handleSubmit} className="w-full max-w-2xl mb-8">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-xl group-hover:blur-2xl transition-all opacity-0 group-hover:opacity-100" />
              <div className="relative flex items-center bg-white dark:bg-gray-800 rounded-full shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <span className="pl-6 pr-3 text-gray-400">
                  <div className="i-ph:chat-text text-xl" />
                </span>
                <input
                  type="text"
                  className="flex-1 py-5 pr-4 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400 text-base"
                  placeholder="Enter restaurant name & address to start..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="m-2 w-12 h-12 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 rounded-full flex items-center justify-center text-white dark:text-gray-900 transition-all hover:scale-105 active:scale-95 shadow-lg"
                >
                  <div className="i-ph:arrow-right-bold text-xl" />
                </button>
              </div>
            </div>
          </form>

          {/* Example Prompts */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-16">
            {examplePrompts.map((prompt, index) => (
              <button
                key={index}
                onClick={() => handlePromptClick(prompt)}
                className="px-4 py-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md transition-all hover:scale-105 active:scale-95"
              >
                "{prompt}"
              </button>
            ))}
          </div>

          {/* Pilot Program Section */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center -space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white dark:border-gray-900 shadow-lg" />
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 border-2 border-white dark:border-gray-900 shadow-lg" />
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 border-2 border-white dark:border-gray-900 shadow-lg" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                JOIN THE PILOT PROGRAM
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Limited to 20 pilot partners this month</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full py-8 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/huskIT.svg" alt="HuskIT" className="w-[90px] inline-block" />
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            © 2024 huskIT Inc. All rights reserved.{' '}
            <a href="#" className="hover:text-blue-600 ml-2">
              Privacy Policy
            </a>
            <span className="mx-2">·</span>
            <a href="#" className="hover:text-blue-600">
              Terms of Service
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
