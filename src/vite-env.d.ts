/// <reference types="vite/client" />

export type NoteItem = { id: string; title: string };

declare global {
  interface Window {
    electronAPI?: {
      notes: {
        list: () => Promise<NoteItem[]>;
        read: (filename: string) => Promise<string>;
        save: (filename: string, content: string) => Promise<NoteItem>;
        create: (title: string) => Promise<NoteItem>;
        delete: (filename: string) => Promise<void>;
      };
      ai: {
        improveReadability: (text: string) => Promise<string>;
        polishDeveloperDoc: (text: string) => Promise<string>;
      };
      app: {
        getSettings: () => Promise<{ geminiApiKey?: string }>;
        setGeminiKey: (key: string) => Promise<void>;
      };
    };
  }
}

export {};
