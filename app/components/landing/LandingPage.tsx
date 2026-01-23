import { useState } from 'react';
import { Link } from '@remix-run/react';

interface LandingPageProps {
  onStart: (prompt: string) => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (inputValue.trim()) {
      onStart(inputValue);
    }
  };

  const handlePromptClick = (text: string) => {
    setInputValue(text);

    /*
     * Optional: auto-submit or just set value? Let's just set value for user to review or click arrow.
     * Or maybe we want to submit immediately? The UI suggests "chip" might fill the input or execute.
     * "Prompt the rest" implies execution. Let's start with filling the input.
     */
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950 overflow-x-hidden transition-colors font-sans selection:bg-purple-100 selection:text-purple-900">
      <header className="absolute top-0 left-0 w-full z-50 px-6 h-24 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Logo could go here or be hidden as per new design cleanliness, but keeping for Nav */}
          {/* <img src="/huskIT.svg" alt="HuskIT" className="w-[90px] inline-block" /> */}
        </div>
        {/* Keeping Nav for Login access */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            to="/auth/login"
            className="text-sm font-bold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            Log In
          </Link>
          <Link
            to="/auth/signup"
            className="px-6 py-2.5 bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black text-sm font-bold rounded-full transition-all"
          >
            Get Started
          </Link>
        </div>
      </header>

      <div className="relative w-full min-h-screen flex flex-col items-center justify-center px-4">
        {/* Badge */}
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-gray-900 border border-blue-100 dark:border-gray-800 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[11px] font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">
              The Future of Hospitality
            </span>
          </div>
        </div>

        {/* Headline */}
        <div className="text-center mb-6 max-w-4xl animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight text-gray-900 dark:text-white leading-[0.95]">
            Serve your guests.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400">
              Prompt the rest.
            </span>
          </h1>
        </div>

        {/* Subhead */}
        <p className="text-lg md:text-xl text-gray-500 dark:text-gray-400 text-center max-w-2xl mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          No dashboards. No passwords. Just prompt what you need changed,
          <br className="hidden md:block" />
          and our AI executes it instantly—everywhere.
        </p>

        {/* Input Field */}
        <div className="w-full max-w-2xl mb-8 relative z-20 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
          <form onSubmit={handleSubmit} className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-orange-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center p-2 bg-white dark:bg-gray-900 rounded-full shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-gray-100 dark:border-gray-800 focus-within:border-purple-300 focus-within:ring-4 focus-within:ring-purple-100 dark:focus-within:ring-purple-900/30 transition-all">
              <div className="pl-6 text-gray-400">
                <div className="i-ph-chat-circle-dots-bold text-2xl" />
              </div>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter restaurant name & address to start..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-lg py-4 px-4 text-gray-900 dark:text-white placeholder:text-gray-400 font-medium"
              />
              <button
                type="submit"
                className="p-3 bg-[#1a1b26] hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black rounded-full transition-transform active:scale-95 flex items-center justify-center"
              >
                <div className="i-ph-arrow-right-bold text-xl" />
              </button>
            </div>
          </form>
        </div>

        {/* Example Pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-20 animate-in fade-in slide-in-from-bottom-12 duration-700 delay-400">
          {[
            "Post tonight's special",
            'Add a 15% happy hour discount',
            'Change closing time to 10pm',
            'Our website needs a new look',
          ].map((text, i) => (
            <button
              key={i}
              onClick={() => handlePromptClick(text)}
              className="px-5 py-2.5 rounded-full bg-gray-50 hover:bg-white border border-gray-100 hover:border-purple-200 hover:shadow-sm text-sm font-bold text-gray-600 hover:text-purple-600 transition-all active:scale-95"
            >
              "{text}"
            </button>
          ))}
        </div>

        {/* Footer / Pilot Program */}
        <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-700 delay-500">
          <div className="flex -space-x-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-950 overflow-hidden bg-gray-200"
              >
                <img
                  src={`https://i.pravatar.cc/100?img=${i + 10}`}
                  alt="User"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          <div className="text-center">
            <div className="text-[10px] font-black tracking-widest text-gray-900 dark:text-white uppercase mb-0.5">
              Join the pilot program
            </div>
            <div className="text-[10px] font-medium text-gray-400">Limited to 20 pilot partners this month.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
