import ElectronStore from 'electron-store';

export const store = new ElectronStore<any>({ encryptionKey: 'something' });
