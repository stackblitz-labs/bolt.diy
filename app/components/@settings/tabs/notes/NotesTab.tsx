import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { notesStore, addNote, removeNote } from '~/lib/stores/notes';
import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';

export default function NotesTab() {
  const notes = useStore(notesStore);
  const [noteText, setNoteText] = useState('');

  const handleAdd = () => {
    const text = noteText.trim();

    if (!text) {
      return;
    }

    addNote(text);
    setNoteText('');
  };

  return (
    <div className="space-y-4">
      <div>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          className={classNames(
            'w-full rounded-lg p-2',
            'bg-bolt-elements-background-depth-1',
            'border border-bolt-elements-borderColor',
            'text-bolt-elements-textPrimary',
            'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
            'min-h-[80px] resize-vertical',
          )}
          placeholder="Add a note for the AI"
        />
        <Button className="mt-2" variant="secondary" onClick={handleAdd}>
          Add Note
        </Button>
      </div>
      <div className="space-y-2">
        {notes.map((n) => (
          <div key={n.id} className="flex items-start gap-2 p-2 rounded-lg bg-bolt-elements-background-depth-2">
            <div className="flex-1 whitespace-pre-wrap text-sm text-bolt-elements-textPrimary">{n.text}</div>
            <Button size="sm" variant="ghost" onClick={() => removeNote(n.id)}>
              <div className="i-ph:trash w-4 h-4" />
            </Button>
          </div>
        ))}
        {notes.length === 0 && <p className="text-sm text-bolt-elements-textSecondary">No notes added.</p>}
      </div>
    </div>
  );
}
