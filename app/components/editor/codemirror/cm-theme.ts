import { Compartment, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import type { Theme } from '~/types/theme.js';
import type { EditorSettings } from './CodeMirrorEditor.js';

export const darkTheme = EditorView.theme({}, { dark: true });
export const themeSelection = new Compartment();

export function getTheme(theme: Theme, settings: EditorSettings = {}): Extension {
  return [
    getEditorTheme(settings),
    theme === 'dark' ? themeSelection.of([getDarkTheme()]) : themeSelection.of([getLightTheme()]),
  ];
}

export function reconfigureTheme(theme: Theme) {
  return themeSelection.reconfigure(theme === 'dark' ? getDarkTheme() : getLightTheme());
}

function getEditorTheme(settings: EditorSettings) {
  return EditorView.theme({
    '&': {
      fontSize: settings.fontSize ?? '12px',
    },
    '&.cm-editor': {
      height: '100%',
      background: 'var(--cm-backgroundColor)',
      color: 'var(--cm-textColor)',
    },
    '.cm-cursor': {
      borderLeft: 'var(--cm-cursor-width) solid var(--cm-cursor-backgroundColor)',
    },
    '.cm-scroller': {
      lineHeight: '1.5',
      '&:focus-visible': {
        outline: 'none',
      },
    },
    '.cm-line': {
      padding: '0 0 0 4px',
    },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
      backgroundColor: 'var(--cm-selection-backgroundColorFocused) !important',
      opacity: 'var(--cm-selection-backgroundOpacityFocused, 0.3)',
    },
    '&:not(.cm-focused) > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
      backgroundColor: 'var(--cm-selection-backgroundColorBlured)',
      opacity: 'var(--cm-selection-backgroundOpacityBlured, 0.3)',
    },
    '&.cm-focused > .cm-scroller .cm-matchingBracket': {
      backgroundColor: 'var(--cm-matching-bracket)',
    },
    '.cm-activeLine': {
      background: 'var(--cm-activeLineBackgroundColor)',
    },
    '.cm-gutters': {
      background: 'var(--cm-gutter-backgroundColor)',
      borderRight: 0,
      color: 'var(--cm-gutter-textColor)',
    },
    '.cm-gutter': {
      '&.cm-lineNumbers': {
        fontFamily: 'Roboto Mono, monospace',
        fontSize: settings.gutterFontSize ?? settings.fontSize ?? '12px',
        minWidth: '40px',
      },
      '& .cm-activeLineGutter': {
        background: 'transparent',
        color: 'var(--cm-gutter-activeLineTextColor)',
      },
      '&.cm-foldGutter .cm-gutterElement > .fold-icon': {
        cursor: 'pointer',
        color: 'var(--cm-foldGutter-textColor)',
        transform: 'translateY(2px)',
        '&:hover': {
          color: 'var(--cm-foldGutter-textColorHover)',
        },
      },
    },
    '.cm-foldGutter .cm-gutterElement': {
      padding: '0 4px',
    },
    '.cm-tooltip-autocomplete > ul > li': {
      minHeight: '18px',
    },
    '.cm-panel.cm-search label': {
      marginLeft: '2px',
      fontSize: '12px',
    },
    '.cm-panel.cm-search .cm-button': {
      fontSize: '12px',
    },
    '.cm-panel.cm-search .cm-textfield': {
      fontSize: '12px',
    },
    '.cm-panel.cm-search input[type=checkbox]': {
      position: 'relative',
      transform: 'translateY(2px)',
      marginRight: '4px',
    },
    '.cm-panels': {
      borderColor: 'var(--cm-panels-borderColor)',
    },
    '.cm-panels-bottom': {
      borderTop: '1px solid var(--cm-panels-borderColor)',
      backgroundColor: 'transparent',
    },
    '.cm-panel.cm-search': {
      background: 'var(--cm-search-backgroundColor)',
      color: 'var(--cm-search-textColor)',
      padding: '8px',
    },
    '.cm-search .cm-button': {
      background: 'var(--cm-search-button-backgroundColor)',
      borderColor: 'var(--cm-search-button-borderColor)',
      color: 'var(--cm-search-button-textColor)',
      borderRadius: '4px',
      '&:hover': {
        color: 'var(--cm-search-button-textColorHover)',
      },
      '&:focus-visible': {
        outline: 'none',
        borderColor: 'var(--cm-search-button-borderColorFocused)',
      },
      '&:hover:not(:focus-visible)': {
        background: 'var(--cm-search-button-backgroundColorHover)',
        borderColor: 'var(--cm-search-button-borderColorHover)',
      },
      '&:hover:focus-visible': {
        background: 'var(--cm-search-button-backgroundColorHover)',
        borderColor: 'var(--cm-search-button-borderColorFocused)',
      },
    },
    '.cm-panel.cm-search [name=close]': {
      top: '6px',
      right: '6px',
      padding: '0 6px',
      fontSize: '1rem',
      backgroundColor: 'var(--cm-search-closeButton-backgroundColor)',
      color: 'var(--cm-search-closeButton-textColor)',
      '&:hover': {
        'border-radius': '6px',
        color: 'var(--cm-search-closeButton-textColorHover)',
        backgroundColor: 'var(--cm-search-closeButton-backgroundColorHover)',
      },
    },
    '.cm-search input': {
      background: 'var(--cm-search-input-backgroundColor)',
      borderColor: 'var(--cm-search-input-borderColor)',
      color: 'var(--cm-search-input-textColor)',
      outline: 'none',
      borderRadius: '4px',
      '&:focus-visible': {
        borderColor: 'var(--cm-search-input-borderColorFocused)',
      },
    },
    '.cm-tooltip': {
      background: 'var(--cm-tooltip-backgroundColor)',
      border: '1px solid transparent',
      borderColor: 'var(--cm-tooltip-borderColor)',
      color: 'var(--cm-tooltip-textColor)',
    },
    '.cm-tooltip.cm-tooltip-autocomplete ul li[aria-selected]': {
      background: 'var(--cm-tooltip-backgroundColorSelected)',
      color: 'var(--cm-tooltip-textColorSelected)',
    },
    '.cm-searchMatch': {
      backgroundColor: 'var(--cm-searchMatch-backgroundColor)',
    },
    '.cm-tooltip.cm-readonly-tooltip': {
      padding: '4px',
      whiteSpace: 'nowrap',
      backgroundColor: 'var(--bolt-elements-bg-depth-2)',
      borderColor: 'var(--bolt-elements-borderColorActive)',
      '& .cm-tooltip-arrow:before': {
        borderTopColor: 'var(--bolt-elements-borderColorActive)',
      },
      '& .cm-tooltip-arrow:after': {
        borderTopColor: 'transparent',
      },
    },
  });
}

function getLightTheme() {
  return vscodeLight;
}

function getDarkTheme() {
  return vscodeDark;
}
