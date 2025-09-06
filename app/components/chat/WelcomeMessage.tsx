import React from 'react';
import { useStore } from '@nanostores/react';
import { authStore } from '~/lib/stores/auth';
import { motion } from 'framer-motion';

const EXAMPLE_PROMPTS = [
  { text: 'Create a mobile app about bolt.diy' },
  { text: 'Build a todo app in React using Tailwind' },
  { text: 'Build a simple blog using Astro' },
  { text: 'Create a cookie consent form using Material UI' },
  { text: 'Make a space invaders game' },
  { text: 'Make a Tic Tac Toe game in html, css and js only' },
];

interface WelcomeMessageProps {
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
}

export function WelcomeMessage({ sendMessage }: WelcomeMessageProps) {
  const authState = useStore(authStore);
  const timeOfDay = new Date().getHours();

  const getGreeting = () => {
    if (timeOfDay < 12) {
      return 'Good morning';
    }

    if (timeOfDay < 17) {
      return 'Good afternoon';
    }

    return 'Good evening';
  };

  return (
    <div className="relative flex flex-col gap-6 w-full max-w-3xl mx-auto mt-8">
      {/* Personalized Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <h1 className="text-3xl font-bold text-bolt-elements-textPrimary mb-2">
          {getGreeting()}, {authState.user?.firstName || 'Developer'}!
        </h1>
        <p className="text-lg text-bolt-elements-textSecondary">What would you like to build today?</p>
      </motion.div>

      {/* Example Prompts */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex flex-col gap-3"
      >
        <p className="text-sm text-bolt-elements-textTertiary text-center">Try one of these examples to get started:</p>
        <div className="flex flex-wrap justify-center gap-2">
          {EXAMPLE_PROMPTS.map((examplePrompt, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.3 + index * 0.05 }}
              onClick={(event) => sendMessage?.(event, examplePrompt.text)}
              className="border border-bolt-elements-borderColor rounded-full bg-gray-50 hover:bg-gray-100 dark:bg-gray-950 dark:hover:bg-gray-900 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary px-3 py-1 text-xs transition-all hover:scale-105"
            >
              {examplePrompt.text}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* User Stats */}
      {authState.user && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-center text-xs text-bolt-elements-textTertiary"
        >
          <p>
            Logged in as{' '}
            <span className="text-bolt-elements-textSecondary font-medium">@{authState.user.username}</span>
          </p>
        </motion.div>
      )}
    </div>
  );
}
