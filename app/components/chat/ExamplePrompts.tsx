import React from 'react';

const EXAMPLE_PROMPTS = [
  { text: 'Build a modern portfolio website with React and Tailwind' },
  { text: 'Create a real-time chat app with WebSockets' },
  { text: 'Build a task management app with drag and drop' },
  { text: 'Make an AI-powered image gallery with search' },
  { text: 'Create a weather dashboard with API integration' },
  { text: 'Build a markdown blog with dark mode support' },
];

/**
 * Renders a collection of example prompt buttons that users can click to quickly start a conversation.
 *
 * @param sendMessage - Optional callback function to send a message when a prompt is clicked
 * @returns React component displaying example prompt buttons
 */
export function ExamplePrompts(sendMessage?: { (event: React.UIEvent, messageInput?: string): void | undefined }) {
  return (
    <div id="examples" className="relative flex flex-col gap-9 w-full max-w-3xl mx-auto flex justify-center mt-6">
      <div
        className="flex flex-wrap justify-center gap-2"
        style={{
          animation: '.25s ease-out 0s 1 _fade-and-move-in_g2ptj_1 forwards',
        }}
      >
        {EXAMPLE_PROMPTS.map((examplePrompt, index: number) => {
          return (
            <button
              key={index}
              onClick={(event) => {
                sendMessage?.(event, examplePrompt.text);
              }}
              className="border border-bolt-elements-borderColor rounded-full bg-gray-50 hover:bg-gray-100 dark:bg-gray-950 dark:hover:bg-gray-900 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary px-3 py-1 text-xs transition-theme"
            >
              {examplePrompt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
