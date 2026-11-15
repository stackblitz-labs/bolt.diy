import { useStore } from '@nanostores/react';
import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { DEFAULT_AVATARS, profileStore, updateProfile } from '~/lib/stores/profile';
import { classNames } from '~/utils/classNames';
import { debounce } from '~/utils/debounce';

export default function ProfileTab() {
  const profile = useStore(profileStore);
  const [isUploading, setIsUploading] = useState(false);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  // Create debounced update functions
  const debouncedUpdate = useCallback(
    debounce((field: 'username' | 'bio', value: string) => {
      updateProfile({ [field]: value });
      toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} updated`);
    }, 1000),
    [],
  );

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setIsUploading(true);

      // Convert the file to base64
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          setIsUploading(false);
          toast.error('Failed to update profile picture');

          return;
        }

        const base64String = reader.result;
        updateProfile({ avatar: base64String });
        setIsUploading(false);
        setIsAvatarPickerOpen(false);
        toast.success('Profile picture updated');
      };

      reader.onerror = () => {
        console.error('Error reading file:', reader.error);
        setIsUploading(false);
        toast.error('Failed to update profile picture');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setIsUploading(false);
      toast.error('Failed to update profile picture');
    }
  };

  const handleChooseAvatar = (avatar: string) => {
    updateProfile({ avatar });
    setIsAvatarPickerOpen(false);
    toast.success('Profile avatar updated');
  };

  const handleProfileUpdate = (field: 'username' | 'bio', value: string) => {
    // Update the store immediately for UI responsiveness
    updateProfile({ [field]: value });

    // Debounce the toast notification
    debouncedUpdate(field, value);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-6">
        {/* Personal Information Section */}
        <div>
          {/* Avatar Upload */}
          <div className="flex items-start gap-6 mb-8">
            <button
              type="button"
              aria-label="Change profile avatar"
              aria-expanded={isAvatarPickerOpen}
              onClick={() => setIsAvatarPickerOpen((open) => !open)}
              className={classNames(
                'w-24 h-24 rounded-full overflow-hidden',
                'bg-bolt-elements-background-depth-2',
                'ring-1 ring-bolt-elements-borderColor',
                'relative group transition-all duration-300 ease-out',
                'hover:ring-bolt-elements-borderColorActive hover:shadow-lg',
              )}
            >
              <img
                src={profile.avatar}
                alt=""
                className="h-full w-full object-cover transition-all duration-300 ease-out group-hover:scale-105 group-hover:brightness-90"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                {isUploading ? (
                  <span className="i-ph:spinner-gap h-6 w-6 animate-spin text-white" />
                ) : (
                  <span className="i-ph:camera-plus h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </span>
            </button>

            <div className="flex-1 pt-1">
              <label className="block text-base font-medium text-bolt-elements-textPrimary mb-1">Profile Picture</label>
              <p className="text-sm text-bolt-elements-textSecondary">
                Choose a default avatar or upload one from your computer.
              </p>
            </div>
          </div>

          {isAvatarPickerOpen && (
            <div className="mb-8 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-4">
              <h3 className="mb-3 text-sm font-medium text-bolt-elements-textPrimary">Choose your avatar</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {DEFAULT_AVATARS.map((avatar) => {
                  const selected = profile.avatar === avatar.src;

                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      aria-label={`Use ${avatar.name} avatar`}
                      aria-pressed={selected}
                      onClick={() => handleChooseAvatar(avatar.src)}
                      style={{
                        backgroundColor: 'var(--bolt-elements-bg-depth-2)',
                        color: 'var(--bolt-elements-textPrimary)',
                      }}
                      className={classNames(
                        'flex min-h-28 flex-col items-center justify-center rounded-lg border p-2 transition-colors',
                        selected
                          ? 'border-bolt-elements-borderColorActive bg-bolt-elements-background-depth-2 ring-1 ring-bolt-elements-borderColorActive'
                          : 'border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-2',
                      )}
                    >
                      <img src={avatar.src} alt="" className="h-24 w-24 rounded-full" />
                    </button>
                  );
                })}
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-bolt-elements-borderColor p-3 text-bolt-elements-textSecondary transition-colors hover:bg-bolt-elements-background-depth-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleAvatarUpload}
                    disabled={isUploading}
                  />
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-bolt-elements-background-depth-3">
                    <span className="i-ph-upload-simple h-6 w-6" />
                  </span>
                  <span className="text-xs font-medium">Upload from computer</span>
                </label>
              </div>
            </div>
          )}

          {/* Username Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Username</label>
            <div className="relative group">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                <div className="i-ph:user-circle-fill w-5 h-5 text-gray-400 dark:text-gray-500 transition-colors group-focus-within:text-purple-500" />
              </div>
              <input
                type="text"
                value={profile.username}
                onChange={(e) => handleProfileUpdate('username', e.target.value)}
                className={classNames(
                  'w-full pl-11 pr-4 py-2.5 rounded-xl',
                  'bg-white dark:bg-gray-800/50',
                  'border border-gray-200 dark:border-gray-700/50',
                  'text-gray-900 dark:text-white',
                  'placeholder-gray-400 dark:placeholder-gray-500',
                  'focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50',
                  'transition-all duration-300 ease-out',
                )}
                placeholder="Enter your username"
              />
            </div>
          </div>

          {/* Bio Input */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Bio</label>
            <div className="relative group">
              <div className="absolute left-3.5 top-3">
                <div className="i-ph:text-aa w-5 h-5 text-gray-400 dark:text-gray-500 transition-colors group-focus-within:text-purple-500" />
              </div>
              <textarea
                value={profile.bio}
                onChange={(e) => handleProfileUpdate('bio', e.target.value)}
                className={classNames(
                  'w-full pl-11 pr-4 py-2.5 rounded-xl',
                  'bg-white dark:bg-gray-800/50',
                  'border border-gray-200 dark:border-gray-700/50',
                  'text-gray-900 dark:text-white',
                  'placeholder-gray-400 dark:placeholder-gray-500',
                  'focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50',
                  'transition-all duration-300 ease-out',
                  'resize-none',
                  'h-32',
                )}
                placeholder="Tell us about yourself"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
