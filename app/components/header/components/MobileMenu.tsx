import { MenuIcon } from 'lucide-react';
import { useRef } from 'react';
import { ClientAuth } from '~/components/auth/ClientAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

interface MobileMenuProps {
  handleScrollToSection: (sectionId: string) => void;
}

export function MobileMenu({ handleScrollToSection }: MobileMenuProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open && buttonRef.current) {
          // Blur the button when menu closes to remove focus highlight
          buttonRef.current.blur();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          ref={buttonRef}
          className="flex items-center justify-center text-bolt-elements-textSecondary bg-bolt-elements-background-depth-2 hover:text-bolt-elements-textPrimary rounded-xl p-2 hover:bg-bolt-elements-background-depth-3 transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 border border-bolt-elements-borderColor focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
          title="Menu"
        >
          <MenuIcon size={20} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 bg-bolt-elements-background-depth-1 border-bolt-elements-borderColor z-[100]"
      >
        <DropdownMenuItem asChild>
          <a href="/" className="cursor-pointer w-full">
            Home
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            handleScrollToSection('features');
          }}
          className="cursor-pointer"
        >
          Features
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            handleScrollToSection('showcase-gallery');
          }}
          className="cursor-pointer"
        >
          Showcase Gallery
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            handleScrollToSection('pricing');
          }}
          className="cursor-pointer"
        >
          Plans & Pricing
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            handleScrollToSection('faq');
          }}
          className="cursor-pointer"
        >
          FAQs
        </DropdownMenuItem>
        <div className="p-2 mt-2 flex justify-center">
          <ClientAuth />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
