import { createContext } from 'react';

// Create a context to share the setShowAuthDialog function with child components
export interface RepositoryDialogContextType {
  setShowAuthDialog: React.Dispatch<React.SetStateAction<boolean>>;
}

// Default context value with a no-op function
export const RepositoryDialogContext = createContext<RepositoryDialogContextType>({
  // This is intentionally empty as it will be overridden by the provider
  setShowAuthDialog: () => {
    // No operation
  },
});
