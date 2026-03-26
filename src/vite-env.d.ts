/// <reference types="vite/client" />

export type NoteItem = { id: string; title: string };
export type TransformOption = 'balanced' | 'strong' | 'concise';

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
        improveReadability: (text: string, option?: TransformOption) => Promise<string>;
        polishDeveloperDoc: (text: string, option?: TransformOption) => Promise<string>;
      };
      app: {
        getSettings: () => Promise<{ geminiApiKey?: string }>;
        setGeminiKey: (key: string) => Promise<void>;
      };
    };
  }
}

export {};
