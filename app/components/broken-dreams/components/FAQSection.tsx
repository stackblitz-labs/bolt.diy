import { useState } from 'react';
import { classNames } from '~/utils/classNames';
import { ChevronDown } from '~/components/ui/Icon';

interface FAQItem {
  question: string;
  answer: string;
}

export const FaqSection = () => {
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  const faqItems: FAQItem[] = [
    {
      question: 'Do I need to create a Replay.Builder account before submitting my app?',
      answer:
        'Yes, it would make things easier if you create an account before filling out the submission form, and be sure to use the same email that is connected to your Replay.Builder account.',
    },
    {
      question: 'What makes Replay.Builder different than other vibecoding tools out there?',
      answer:
        "This is our favorite question to answer. Other vibecoding tools are simply wrappers on an LLM. This is why it's so common that people get into debugging death spirals. The LLMs are just not great at iterating and evolving code. They hallucinate, they lose context, and one small change can lead you down a path of frustration.\n\nReplay.Builder was built from the ground up with a different philosophy that, hey, AI (LLMs) writes buggy code. Accepting that fact, we built Replay.Builder around our already existing code debugging tools. Replay.Builder thoroughly tests your app from top to bottom, front-end to back-end, and instructs the LLM what went wrong and how to fix it.",
    },
    {
      question: 'Am I required to become a paying customer?',
      answer:
        'Nope. You can cancel before the end of your three free months of the Builder Plan, and you will not be charged going forward.',
    },
    {
      question: "What if you can't help me get my app working?",
      answer:
        "Well, we hope that won't be the case, but there are one or two realists on the team that admit that this could be a possibility. The good news is that you wouldn't have wasted money (but I suppose we would have. hmmm).\n\nWe'll be honest though, Replay.Builder can't build everything under the sun. Right now, it's really quite good at building full-stack web apps (CRUD apps as they're called, for Create, Read, Update, Delete).\n\nSo if you want to build a slick iOS app, well, we're not there yet. Also, if you're trying to beat Zuck by building the next version of Facebook to support over a billion daily active users, then we can't help you with that either—yet!",
    },
    {
      question: 'What makes the team confident they can rebuild my broken app, anyway?',
      answer:
        "So glad you asked! Our team has been spending their careers creating code debugging software, and it turns out that vibecoding with AI writes a lot of buggy code (go figure!). We built Replay.Builder around our core deterministic debugging tools, which makes us very very different from all of the other vibecoder tools out there.\n\nWe are NOT just a wrapper on an LLM. Replay.Builder writes code, but it also writes automated tests to verify that the code it wrote actually works. When it doesn't work, we use our baked-in debugging software (Replay) to analyze what happened in your entire code base, and helps the AI fix it.",
    },
  ];

  const toggleExpanded = (index: number) => {
    setExpandedItem(expandedItem === index ? null : index);
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-16">
      <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12 bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">
        Frequently Asked Questions
      </h2>

      <div className="space-y-4">
        {faqItems.map((item, index) => (
          <div
            key={index}
            className="rounded-xl border border-bolt-elements-borderColor overflow-hidden transition-all duration-200 hover:border-bolt-elements-borderColor border-opacity-100 shadow-sm"
          >
            <button
              onClick={() => toggleExpanded(index)}
              className="w-full px-6 py-4 text-left flex items-center justify-between bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-background-depth-2 transition-colors duration-200"
            >
              <span className="text-bolt-elements-textHeading font-medium pr-4">{item.question}</span>
              <div
                className={classNames('flex-shrink-0 transition-transform duration-200', {
                  'rotate-180': expandedItem === index,
                })}
              >
                <ChevronDown className="text-bolt-elements-textSecondary" size={16} />
              </div>
            </button>

            {expandedItem === index && (
              <div className="px-6 pb-4 border-t border-bolt-elements-borderColor border-opacity-30 bg-bolt-elements-background-depth-2">
                <div className="pt-4 text-bolt-elements-textSecondary leading-relaxed whitespace-pre-line">
                  {item.answer}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
