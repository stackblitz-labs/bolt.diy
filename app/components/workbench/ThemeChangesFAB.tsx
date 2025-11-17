import { useStore } from '@nanostores/react';
import { themeChangesStore, markThemesSaved, resetThemeChanges } from '~/lib/stores/themeChanges';
import { chatStore } from '~/lib/stores/chat';
import { callNutAPI } from '~/lib/replay/NutAPI';
import { memo, useState } from 'react';
import { toast } from 'react-toastify';
import { Check, RotateCcw } from '~/components/ui/Icon';

export const ThemeChangesFAB = memo(() => {
  const themeChanges = useStore(themeChangesStore);
  const appId = useStore(chatStore.currentAppId);
  const [isSaving, setIsSaving] = useState(false);

  // Calculate total number of changed variables
  const totalChanges =
    Object.keys(themeChanges.lightThemeChanges).length +
    Object.keys(themeChanges.darkThemeChanges).length +
    Object.keys(themeChanges.appSettingsChanges).length;

  // Don't show if there are no changes
  if (!themeChanges.hasChanges || totalChanges === 0) {
    return null;
  }

  const handleSave = async () => {
    if (!appId || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      // Serialize all theme changes into a single object
      const themeVariables: Record<string, string> = {};

      // Add light theme changes (only if value is not empty)
      Object.entries(themeChanges.lightThemeChanges).forEach(([key, change]) => {
        const trimmedValue = change.newValue?.trim() || '';
        if (trimmedValue !== '') {
          themeVariables[key] = trimmedValue;
        }
      });

      // Add dark theme changes (with .dark: separator if both light and dark exist)
      Object.entries(themeChanges.darkThemeChanges).forEach(([key, change]) => {
        const trimmedDarkValue = change.newValue?.trim() || '';
        if (trimmedDarkValue === '') {
          return; // Skip empty dark values
        }

        const lightChange = themeChanges.lightThemeChanges[key];
        const trimmedLightValue = lightChange?.newValue?.trim() || '';
        if (trimmedLightValue !== '') {
          // Both light and dark exist - combine with .dark: separator
          themeVariables[key] = `${trimmedLightValue} .dark: ${trimmedDarkValue}`;
        } else {
          // Only dark exists - use -dark suffix
          themeVariables[`${key}-dark`] = trimmedDarkValue;
        }
      });

      // Add app settings changes (only if value is not empty)
      Object.entries(themeChanges.appSettingsChanges).forEach(([key, change]) => {
        const trimmedValue = change.newValue?.trim() || '';
        if (trimmedValue !== '') {
          themeVariables[key] = trimmedValue;
        }
      });

      console.log('[ThemeChangesFAB] Saving theme variables:', themeVariables);
      console.log('[ThemeChangesFAB] Light changes:', themeChanges.lightThemeChanges);
      console.log('[ThemeChangesFAB] Dark changes:', themeChanges.darkThemeChanges);
      console.log('[ThemeChangesFAB] App settings changes:', themeChanges.appSettingsChanges);

      // Send to server - backend expects theme to be a JSON string
      await callNutAPI('set-app-theme', {
        appId,
        theme: JSON.stringify(themeVariables),
      });

      // Mark as saved
      markThemesSaved();
      toast.success('Theme changes saved successfully');
    } catch (error) {
      console.error('Failed to save theme changes:', error);
      toast.error('Failed to save theme changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    // Reset theme changes store
    resetThemeChanges();

    // Dispatch event to clear design system panel
    window.dispatchEvent(new CustomEvent('theme-reset-requested'));

    // Refresh the iframe to restore original theme state
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (iframe && iframe.src) {
      // Reload the iframe by updating its src with a timestamp to force refresh
      const currentSrc = iframe.src.split('?')[0]; // Remove existing query params
      iframe.src = `${currentSrc}?forceReload=${Date.now()}`;
    } else if (iframe?.contentWindow) {
      // Fallback: try to reload via contentWindow
      iframe.contentWindow.location.reload();
    }

    toast.success('Theme changes reset');
  };

  return (
    <div className="absolute bottom-4 right-4 z-50">
      <div className="flex items-center gap-2 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-full shadow-lg px-2 py-1">
        {/* Changes count badge */}
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-semibold">
            {totalChanges > 99 ? '99+' : totalChanges}
          </div>
          <span className="text-sm font-medium text-bolt-elements-textPrimary">Changes</span>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-bolt-elements-borderColor" />

        {/* Reset button */}
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-bolt-elements-background-depth-2 transition-colors duration-200"
          title="Reset theme changes"
        >
          <RotateCcw size={16} className="text-bolt-elements-textSecondary" />
          <span className="text-sm font-medium text-bolt-elements-textSecondary">Reset</span>
        </button>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={isSaving || !appId}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white rounded-full transition-all duration-200 hover:scale-105"
          title="Save theme changes"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Saving...</span>
            </>
          ) : (
            <>
              <Check size={16} />
              <span className="text-sm font-medium">Save</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
});

ThemeChangesFAB.displayName = 'ThemeChangesFAB';

