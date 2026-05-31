import { create } from "zustand";

export type TabKey =
  | "dashboard"
  | "site"
  | "rules"
  | "proxies"
  | "connections"
  | "providers"
  | "profiles"
  | "settings";

export interface StoreSettings {
  apiBaseUrl: string;
  secret: string;
  bridgeUrl: string;
  darkMode: boolean;
  particleEnabled: boolean;
  delayTestUrl: string;
  mascotIntensity: "high" | "medium" | "low";
  connectionLimit: number;
}

const DEFAULT_SETTINGS: StoreSettings = {
  apiBaseUrl: "http://127.0.0.1:9090",
  secret: "",
  bridgeUrl: "http://127.0.0.1:33331",
  darkMode: true,
  particleEnabled: true,
  delayTestUrl: "http://www.gstatic.com/generate_204",
  mascotIntensity: "high",
  connectionLimit: 50,
};

interface AppState {
  activeTab: TabKey;
  apiOnline: boolean;
  settings: StoreSettings;
  settingsLoaded: boolean;
  setActiveTab: (tab: TabKey) => void;
  setApiOnline: (online: boolean) => void;
  updateSettings: (partial: Partial<StoreSettings>) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: "dashboard",
  apiOnline: false,
  settings: DEFAULT_SETTINGS,
  settingsLoaded: false,

  setActiveTab: (tab) => {
    set({ activeTab: tab });
    chrome.storage.local.set({ clashflow_active_tab: tab });
  },
  setApiOnline: (online) => set({ apiOnline: online }),

  updateSettings: (partial) => {
    set((s) => ({ settings: { ...s.settings, ...partial } }));
  },

  loadSettings: async () => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.get(["clashflow_settings", "clashflow_active_tab"], (res) => {
        const stored = res.clashflow_settings;
        const storedTab = res.clashflow_active_tab as TabKey | undefined;
        set({
          settings: stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS,
          settingsLoaded: true,
          ...(storedTab ? { activeTab: storedTab } : {}),
        });
        resolve();
      });
    });
  },

  saveSettings: async () => {
    const { settings } = get();
    return new Promise<void>((resolve) => {
      chrome.storage.local.set(
        {
          clashflow_settings: settings,
          clash_verge_bridge: settings.bridgeUrl,
        },
        resolve,
      );
    });
  },
}));
