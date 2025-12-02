import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { User } from '@supabase/supabase-js';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isAdmin(user: User | null): boolean {
  if (!user?.email) {
    return false;
  }
  return user.email.endsWith('@replay.io');
}
