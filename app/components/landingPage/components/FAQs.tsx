import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '~/components/ui/ui/accordion';
import { Button } from '~/components/ui/ui/button';
import { cn } from '~/lib/utils';

interface FAQ {
  question: string;
  answer: string | JSX.Element;
}

export default function Faqs() {
  const faqs: FAQ[] = [
    {
      question: 'What makes Replay Builder so good at debugging code?',
      answer: (
        <div className="flex flex-col gap-4 text-balance">
          <p>
            Our secret sauce is Replay, our powerful code debugging tool. Before building Replay Builder, the team at
            Replay built an insanely good deterministic browser-based code debugger that recorded billions of activities
            as your code runs and makes sense of it all to then correct issues.
          </p>
          <p>Replay Builder was built with this core debugging engine inside it.</p>
        </div>
      ),
    },
    {
      question: 'Can I use Replay Builder for free?',
      answer: (
        <p className="text-balance">
          It's the age-old question. Short answer is, yes. All new customers start on the Free plan, where you can build
          one app, from start to finish.
        </p>
      ),
    },
    {
      question: 'Can I cancel my plan?',
      answer: (
        <div className="flex flex-col gap-4 text-balance">
          <p>
            Yes, you can. If you cancel your plan, you can continue using Replay Builder to build your apps until you
            reach the end of the current billing cycle.
          </p>
        </div>
      ),
    },
    {
      question: 'How can I get help or contact support?',
      answer: (
        <div className="flex flex-col gap-4 text-balance">
          <p>We're here to help! You can reach out to our support team through multiple channels:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Join our Discord community for quick help from our team and other users</li>
            <li>Send us an email at support@nut.new for detailed technical questions</li>
            <li>Check out our documentation and tutorials for common questions</li>
          </ul>
          <p>Our team typically responds within 24 hours during business days.</p>
        </div>
      ),
    },
  ];

  const handleStartBuilding = () => {
    window.location.href = '/';
  };

  return (
    <div id="faq" className="w-full py-12 px-4 sm:px-6 lg:px-8 mt-12">
      <div className="w-full">
        {/* Header */}
        <div className="flex flex-col mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            <span className="text-bolt-elements-textHeading">Frequently</span>
            <br />
            <span className="text-bolt-elements-textHeading">asked </span>
            <span className="text-rose-500 dark:text-rose-400">questions</span>
          </h1>
          <p className="text-lg md:text-xl text-bolt-elements-textSecondary max-w-3xl">
            Everything you need to know about Replay Builder
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="w-full flex items-center justify-center">
          <Accordion type="single" collapsible className="w-full max-w-4xl mx-auto mb-12">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className={cn('mb-4 overflow-hidden', 'border-b !border-gray-500/20 dark:!border-gray-400/20')}
              >
                <AccordionTrigger
                  className={cn(
                    'px-6 py-5 text-left hover:no-underline',
                    'text-lg font-semibold text-rose-500 dark:text-rose-400',
                    'hover:text-rose-600 dark:hover:text-rose-300',
                    'transition-colors duration-200',
                    '[&[data-state=open]]:bg-bolt-elements-background-depth-3/50',
                  )}
                >
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent
                  className={cn(
                    'px-6 pb-6 pt-2',
                    'text-bolt-elements-textSecondary',
                    'bg-bolt-elements-background-depth-3/30 dark:bg-bolt-elements-background-depth-3/30',
                  )}
                >
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Bottom CTA Button */}
        <div className="text-center mt-12">
          <Button
            onClick={handleStartBuilding}
            className={cn(
              'px-8 py-4 rounded-lg text-base font-semibold text-white',
              'bg-gradient-to-r from-rose-500 to-pink-500',
              'hover:from-rose-600 hover:to-pink-600',
              'shadow-lg hover:shadow-xl transition-all duration-200',
              'hover:scale-105',
            )}
          >
            Start Building
          </Button>
        </div>
      </div>
    </div>
  );
}
