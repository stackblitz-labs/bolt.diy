import { Brain, ShieldCheck, Rocket, Box } from 'lucide-react';
import { Button } from '~/components/ui/ui/button';
import { cn } from '~/lib/utils';

interface Feature {
  icon: React.ComponentType<{ className?: string; size?: number | string }>;
  title: string;
  description: string;
}

export default function Explanation() {
  const features: Feature[] = [
    {
      icon: Brain,
      title: 'Your thought partner',
      description: 'Come with your rough idea and Replay Builder will help you sharpen it into a bullet-proof prompt',
    },
    {
      icon: ShieldCheck,
      title: 'Code that tests itself',
      description:
        'All AIs write code with bugs, but Replay Builder is the only one that fixes it before you even know it broke',
    },
    {
      icon: Rocket,
      title: 'One-Click Publish',
      description: "We'll set us your database, and your server, because, who really wants to do that stuff?",
    },
    {
      icon: Box,
      title: 'Your code. Your data.',
      description: 'Download your full code and database at any time',
    },
  ];

  const handleStartBuilding = () => {
    window.location.href = '/';
  };

  return (
    <div id="features" className="w-full py-12 px-4 sm:px-6 lg:px-8 mt-12">
      <div className="w-full">
        {/* Header */}
        <div className="flex flex-col mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            <span className="text-bolt-elements-textHeading">With you,</span>
            <br />
            <span className="text-rose-500 dark:text-rose-400">every step of the way.</span>
          </h1>
          <p className="text-lg md:text-xl text-bolt-elements-textSecondary max-w-3xl">
            Its like having a team of designers and engineers that never sleep.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div key={index} className="flex flex-col items-start">
                {/* Icon */}
                <div className="mb-4 p-3 rounded-lg border-2 border-rose-500/50 bg-bolt-elements-background-depth-2">
                  <IconComponent className="text-rose-500 dark:text-rose-400" size={32} />
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-bolt-elements-textHeading mb-3">{feature.title}</h3>

                {/* Description */}
                <p className="text-bolt-elements-textSecondary leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
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
