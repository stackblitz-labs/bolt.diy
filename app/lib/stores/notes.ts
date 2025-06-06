import { atom } from 'nanostores';

export interface Note {
  id: string;
  text: string;
  createdAt: number;
}

const NOTES_KEY = 'bolt_notes';

function loadNotes(): Note[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const json = localStorage.getItem(NOTES_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

function saveNotes(notes: Note[]) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch {}
}

export const notesStore = atom<Note[]>(loadNotes());

export function addNote(text: string) {
  const notes = [...notesStore.get(), { id: crypto.randomUUID(), text, createdAt: Date.now() }];
  notesStore.set(notes);
  saveNotes(notes);
}

export function removeNote(id: string) {
  const notes = notesStore.get().filter((n) => n.id !== id);
  notesStore.set(notes);
  saveNotes(notes);
}

export function updateNote(id: string, text: string) {
  const notes = notesStore.get().map((n) => (n.id === id ? { ...n, text } : n));
  notesStore.set(notes);
  saveNotes(notes);
}
