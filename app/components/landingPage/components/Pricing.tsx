import { PricingCard } from '~/components/ui/PricingCard';
import type { PricingFeature } from '~/components/ui/PricingCard';
import { Button } from '~/components/ui/ui/button';
import { cn } from '~/lib/utils';

interface PricingPlan {
  id: 'free' | 'builder' | 'pro';
  title: string;
  description: string;
  price: string;
  pricePeriod: string;
  features: PricingFeature[];
  emphasized: boolean;
  titleColor?: string;
  featuresLabel?: string;
}

export default function Pricing() {
  const pricingPlans: PricingPlan[] = [
    {
      id: 'free',
      title: 'Free',
      description: 'Our free tier to get you started',
      price: '$0',
      pricePeriod: '/month',
      emphasized: false,
      features: [
        { name: 'Create one project', included: true, tooltip: 'Build one project' },
        { name: 'Limited customer support', included: true, tooltip: 'Email support during business hours' },
        { name: 'API connectors', included: false, tooltip: 'Connect to external APIs' },
        { name: 'Download your code', included: false, tooltip: 'Download your project source code' },
        { name: 'Deploy your applications', included: false, tooltip: 'Deploy apps to production' },
      ],
    },
    {
      id: 'builder',
      title: 'Builder',
      description: 'No limits on any features.',
      price: '$49',
      pricePeriod: '/month',
      emphasized: true,
      titleColor: 'text-green-500 dark:text-green-400',
      featuresLabel: 'Everything in Basic, plus:',
      features: [
        { name: 'Unlimited projects', included: true, tooltip: 'Build as many apps as you want' },
        { name: 'Priority Customer Support', included: true, tooltip: 'Priority email and chat support' },
        { name: 'API connectors', included: true, tooltip: 'Connect to external APIs' },
        { name: 'Download your code', included: true, tooltip: 'Download your project source code' },
        { name: 'Deploy your applications', included: true, tooltip: 'Deploy apps to production' },
      ],
    },
    {
      id: 'pro',
      title: 'Pro',
      description: 'Coming soon',
      price: '$199',
      pricePeriod: '/month',
      emphasized: false,
      features: [
        { name: 'Unlimited projects', included: true, tooltip: 'Build as many apps as you want' },
        {
          name: 'VIP Customer Support',
          included: true,
          tooltip: '24/7 priority support with dedicated account manager',
        },
        { name: 'API connectors', included: true, tooltip: 'Connect to external APIs' },
        { name: 'Download your code', included: true, tooltip: 'Download your project source code' },
        { name: 'Deploy your applications', included: true, tooltip: 'Deploy apps to production' },
      ],
    },
  ];

  const handleStartBuilding = () => {
    // Navigate to home or start building flow
    window.location.href = '/';
  };

  return (
    <div id="pricing" className="w-full py-12 px-4 sm:px-6 lg:px-8 mt-12">
      <div className="w-full">
        {/* Header */}
        <div className="flex flex-col mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            <span className="text-bolt-elements-textHeading">Simple,</span>
            <br />
            <span className="text-green-500 dark:text-green-400">transparent</span>{' '}
            <span className="text-bolt-elements-textHeading">pricing</span>
          </h1>
          <p className="text-lg md:text-xl text-bolt-elements-textSecondary max-w-3xl">
            Building software shouldn't feel like a trip to Las Vegas
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="flex flex-col md:flex-row items-center md:items-stretch justify-center gap-6 mb-12 relative">
          {pricingPlans.map((plan) => (
            <PricingCard
              key={plan.id}
              title={plan.title}
              description={plan.description}
              price={plan.price}
              pricePeriod={plan.pricePeriod}
              features={plan.features}
              emphasized={plan.emphasized}
              titleColor={plan.titleColor}
              featuresLabel={plan.featuresLabel}
              className={cn({
                'md:scale-110 z-10': plan.emphasized,
              })}
            />
          ))}
        </div>

        {/* Bottom CTA Button */}
        <div className="text-center">
          <Button
            onClick={handleStartBuilding}
            className={cn(
              'px-8 py-4 rounded-lg text-base font-semibold text-white',
              'bg-gradient-to-r from-green-500 to-emerald-500',
              'hover:from-green-600 hover:to-emerald-600',
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
