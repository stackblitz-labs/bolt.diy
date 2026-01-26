import { atom } from 'nanostores';

export class MessageInputFocusStore {
  focusTrigger = atom<number>(0);

  triggerFocus() {
    this.focusTrigger.set(this.focusTrigger.get() + 1);
  }
}

export const messageInputFocusStore = new MessageInputFocusStore();
