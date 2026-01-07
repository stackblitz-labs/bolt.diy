// import { Link } from "@remix-run/react"
import {
  NavigationMenu,
  // NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  // NavigationMenuTrigger
} from '~/components/ui/ui/navigation-menu';
import { cn } from '~/lib/utils';

// Getting Started dropdown items
// const gettingStartedItems = [
//   {
//     title: "Quick Start Guide",
//     href: "/getting-started",
//     description: "Learn the basics of building apps with Replay Builder",
//   },
//   {
//     title: "Documentation",
//     href: "/docs",
//     description: "Comprehensive guides and API reference",
//   },
//   {
//     title: "Tutorials",
//     href: "/tutorials",
//     description: "Step-by-step tutorials for common use cases",
//   },
//   {
//     title: "Examples",
//     href: "/examples",
//     description: "Real-world examples and templates",
//   },
// ]

export function NavigationMenuComponent() {
  const handleScrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <NavigationMenu>
      <NavigationMenuList className="gap-1">
        {/* Home */}
        <NavigationMenuItem>
          <NavigationMenuLink
            href="/"
            className={cn(
              'text-gray-950 dark:text-white px-4 py-2 rounded-md transition-colors text-sm font-medium',
              'hover:text-gray-700 dark:hover:text-gray-300',
              'bg-transparent hover:bg-transparent focus:bg-transparent',
            )}
          >
            Home
          </NavigationMenuLink>
        </NavigationMenuItem>

        {/* Getting Started with Replay Builder - Dropdown */}
        {/* <NavigationMenuItem>
          <NavigationMenuTrigger
            className={cn(
              "text-gray-950 dark:text-white bg-transparent",
              "hover:text-gray-700 dark:hover:text-gray-300",
              "data-[state=open]:bg-transparent data-[state=open]:text-gray-950 data-[state=open]:dark:text-white",
              "hover:bg-transparent focus:bg-transparent focus:text-gray-950 dark:focus:text-white",
              "px-4 py-2 text-sm font-medium"
            )}
          >
            Getting Started with Replay Builder
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="w-[400px] p-4 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg shadow-lg">
              <div className="grid gap-3">
                {gettingStartedItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="block p-3 rounded-md hover:bg-bolt-elements-background-depth-2 transition-colors"
                  >
                    <div className="font-medium text-bolt-elements-textHeading text-sm mb-1">
                      {item.title}
                    </div>
                    <div className="text-xs text-bolt-elements-textSecondary">
                      {item.description}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem> */}

        {/* Features */}
        <NavigationMenuItem>
          <button
            onClick={() => handleScrollToSection('features')}
            className={cn(
              'text-gray-950 dark:text-white px-4 py-2 rounded-md transition-colors text-sm font-medium',
              'hover:text-gray-700 dark:hover:text-gray-300',
              'bg-transparent hover:bg-transparent focus:bg-transparent border-none cursor-pointer',
            )}
          >
            Features
          </button>
        </NavigationMenuItem>

        {/* Showcase Gallery */}
        <NavigationMenuItem>
          <button
            onClick={() => handleScrollToSection('showcase-gallery')}
            className={cn(
              'text-gray-950 dark:text-white px-4 py-2 rounded-md transition-colors text-sm font-medium',
              'hover:text-gray-700 dark:hover:text-gray-300',
              'bg-transparent hover:bg-transparent focus:bg-transparent border-none cursor-pointer',
            )}
          >
            Showcase Gallery
          </button>
        </NavigationMenuItem>

        {/* Plans & Pricing */}
        <NavigationMenuItem>
          <button
            onClick={() => handleScrollToSection('pricing')}
            className={cn(
              'text-gray-950 dark:text-white px-4 py-2 rounded-md transition-colors text-sm font-medium',
              'hover:text-gray-700 dark:hover:text-gray-300',
              'bg-transparent hover:bg-transparent focus:bg-transparent border-none cursor-pointer',
            )}
          >
            Plans & Pricing
          </button>
        </NavigationMenuItem>

        {/* FAQ */}
        <NavigationMenuItem>
          <button
            onClick={() => handleScrollToSection('faq')}
            className={cn(
              'text-gray-950 dark:text-white px-4 py-2 rounded-md transition-colors text-sm font-medium',
              'hover:text-gray-700 dark:hover:text-gray-300',
              'bg-transparent hover:bg-transparent focus:bg-transparent border-none cursor-pointer',
            )}
          >
            FAQs
          </button>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
