/**
 * Audio utility functions for playing sound notifications
 */
import { chatSoundEnabledStore, chatSoundVolumeStore } from '~/lib/stores/settings';

// Available notification sounds
export const NOTIFICATION_SOUNDS = {
  BOLT: '/audio/bolt.wav',

  // 可以添加更多声音选项
};

// Default sound
export const DEFAULT_SOUND = NOTIFICATION_SOUNDS.BOLT;

// Get selected sound from localStorage or use default
export function getSelectedSound(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_SOUND;
  }

  try {
    const selected = localStorage.getItem('chatSoundFile');
    return selected || DEFAULT_SOUND;
  } catch (error) {
    console.error('Failed to get selected sound:', error);
    return DEFAULT_SOUND;
  }
}

// Save selected sound to localStorage
export function setSelectedSound(soundPath: string): void {
  try {
    localStorage.setItem('chatSoundFile', soundPath);
  } catch (error) {
    console.error('Failed to save selected sound:', error);
  }
}

/**
 * Play a notification sound when a chat task is completed
 * Uses the global sound settings from the settings store
 */
export function playChatCompletionSound() {
  // Check if sound is enabled in settings
  const soundEnabled = chatSoundEnabledStore.get();

  if (!soundEnabled) {
    return;
  }

  // Get volume from settings (default to 0.5 if not set)
  const volume = chatSoundVolumeStore.get() ?? 0.5;

  try {
    // Get the selected sound file
    const soundFile = getSelectedSound();

    // Create an audio element to play the sound file
    const audio = new Audio(soundFile);
    audio.volume = volume;

    // Play the sound
    audio.play().catch((error) => {
      console.error('Failed to play chat completion sound:', error);
    });
  } catch (error) {
    console.error('Failed to play chat completion sound:', error);
  }
}

/**
 * Play a test sound with the selected file and volume
 * @param soundFile Optional sound file to test
 * @param volume Optional volume override
 */
export function playTestSound(soundFile?: string, volume?: number) {
  try {
    // Use provided sound file or get the selected one
    const audioFile = soundFile || getSelectedSound();

    // Use provided volume or get from settings
    const audioVolume = volume ?? chatSoundVolumeStore.get() ?? 0.5;

    // Create an audio element to play the sound file
    const audio = new Audio(audioFile);
    audio.volume = audioVolume;

    // Play the sound
    audio.play().catch((error) => {
      console.error('Failed to play test sound:', error);
    });
  } catch (error) {
    console.error('Failed to play test sound:', error);
  }
}
