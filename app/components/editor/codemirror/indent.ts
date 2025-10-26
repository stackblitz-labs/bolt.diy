import { indentLess } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { EditorSelection, EditorState, Line, type ChangeSpec } from '@codemirror/state';
import { EditorView, type KeyBinding } from '@codemirror/view';

export const indentKeyBinding: KeyBinding = {
  key: 'Tab',
  run: indentMore,
  shift: indentLess,
};

function indentMore({ state, dispatch }: EditorView) {
  if (state.readOnly) {
    return false;
  }

  dispatch(
    state.update(
      changeBySelectedLine(state, (from, to, changes) => {
        changes.push({ from, to, insert: state.facet(indentUnit) });
      }),
      { userEvent: 'input.indent' },
    ),
  );

  return true;
}

function changeBySelectedLine(
  state: EditorState,
  cb: (from: number, to: number | undefined, changes: ChangeSpec[], line: Line) => void,
) {
  return state.changeByRange((range) => {
    const changes: ChangeSpec[] = [];

    const line = state.doc.lineAt(range.from);

    // just insert single indent unit at the current cursor position
    if (range.from === range.to) {
      cb(range.from, undefined, changes, line);
    }
    // handle the case when multiple characters are selected in a single line
    else if (range.from < range.to && range.to <= line.to) {
      cb(range.from, range.to, changes, line);
    } else {
      let atLine = -1;

      // handle the case when selection spans multiple lines
      for (let pos = range.from; pos <= range.to; ) {
        const line = state.doc.lineAt(pos);

        if (line.number > atLine && (range.empty || range.to > line.from)) {
          cb(line.from, undefined, changes, line);
          atLine = line.number;
        }

        pos = line.to + 1;
      }
    }

    const changeSet = state.changes(changes);

    return {
      changes,
      range: EditorSelection.range(changeSet.mapPos(range.anchor, 1), changeSet.mapPos(range.head, 1)),
    };
  });
}
