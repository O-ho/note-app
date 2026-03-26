import { contextBridge, ipcRenderer } from 'electron';

export type NoteItem = { id: string; title: string };
export type TransformOption = 'balanced' | 'strong' | 'concise';

contextBridge.exposeInMainWorld('electronAPI', {
  notes: {
    list: (): Promise<NoteItem[]> => ipcRenderer.invoke('notes:list'),
    read: (filename: string): Promise<string> => ipcRenderer.invoke('notes:read', filename),
    save: (filename: string, content: string): Promise<NoteItem> =>
      ipcRenderer.invoke('notes:save', filename, content),
    create: (title: string): Promise<NoteItem> => ipcRenderer.invoke('notes:create', title),
    delete: (filename: string): Promise<void> => ipcRenderer.invoke('notes:delete', filename),
  },
  ai: {
    improveReadability: (text: string, option: TransformOption = 'balanced'): Promise<string> =>
      ipcRenderer.invoke('ai:improveReadability', text, option),
    polishDeveloperDoc: (text: string, option: TransformOption = 'balanced'): Promise<string> =>
      ipcRenderer.invoke('ai:polishDeveloperDoc', text, option),
  },
  app: {
    getSettings: (): Promise<{ geminiApiKey?: string }> => ipcRenderer.invoke('app:getSettings'),
    setGeminiKey: (key: string): Promise<void> => ipcRenderer.invoke('app:setGeminiKey', key),
  },
});
