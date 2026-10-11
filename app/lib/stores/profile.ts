import { atom } from 'nanostores';

export const DEFAULT_AVATARS = [
  { id: 'default', name: 'Default', src: '/avatars/default-avatar.svg' },
  { id: 'female', name: 'Female', src: '/avatars/female-avatar.svg' },
  { id: 'male', name: 'Male', src: '/avatars/male-avatar.svg' },
] as const;

export const DEFAULT_AVATAR = DEFAULT_AVATARS[0].src;

interface Profile {
  username: string;
  bio: string;
  avatar: string;
}

const storedProfile = typeof window !== 'undefined' ? localStorage.getItem('bolt_profile') : null;

function loadProfile(): Profile {
  if (storedProfile) {
    try {
      const parsed = JSON.parse(storedProfile) as Partial<Profile>;

      return {
        username: parsed.username ?? '',
        bio: parsed.bio ?? '',
        avatar: parsed.avatar?.trim() || DEFAULT_AVATAR,
      };
    } catch (error) {
      console.error('Failed to load saved profile:', error);
    }
  }

  return { username: '', bio: '', avatar: DEFAULT_AVATAR };
}

export const profileStore = atom<Profile>(loadProfile());

export const updateProfile = (updates: Partial<Profile>) => {
  profileStore.set({ ...profileStore.get(), ...updates });

  if (typeof window !== 'undefined') {
    localStorage.setItem('bolt_profile', JSON.stringify(profileStore.get()));
  }
};
