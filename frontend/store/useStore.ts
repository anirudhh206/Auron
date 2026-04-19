import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ParsedAction } from "@/lib/claude";
import { SecurityFlag } from "@/lib/security";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface PendingTransaction {
  action: ParsedAction;
  confirmText: string;
  securityFlags: SecurityFlag[];
  requiresSlowdown: boolean;
}

export interface CompletedTransaction {
  id: string;
  action: ParsedAction;
  txHash: string;
  timestamp: number;
  confirmText: string;
}

export interface UserPrefs {
  spendCeiling: number;       // Layer 2: personal instant-send ceiling
  dailyCap: number;           // Layer 6: max daily outbound
  pin: string | null;         // Layer 4: hashed PIN
  hasOnboarded: boolean;
}

// ─── Store ────────────────────────────────────────────────────────────────────
interface AuronStore {
  // Wallet
  address: string | null;
  setAddress: (address: string | null) => void;

  // Chat
  messages: ChatMessage[];
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  clearMessages: () => void;

  // Pending tx (awaiting user confirm)
  pendingTx: PendingTransaction | null;
  setPendingTx: (tx: PendingTransaction | null) => void;

  // Completed txs
  completedTxs: CompletedTransaction[];
  addCompletedTx: (tx: CompletedTransaction) => void;

  // User preferences (persisted)
  prefs: UserPrefs;
  setPrefs: (prefs: Partial<UserPrefs>) => void;

  // Daily spend tracking
  dailySpent: number;
  addDailySpent: (amount: number) => void;
  dailySpentResetAt: number;

  // UI state
  isLoading: boolean;
  setLoading: (v: boolean) => void;
}

export const useStore = create<AuronStore>()(
  persist(
    (set, get) => ({
      // Wallet
      address: null,
      setAddress: (address) => set({ address }),

      // Chat
      messages: [],
      addMessage: (msg) =>
        set((s) => ({
          messages: [
            ...s.messages,
            { ...msg, id: crypto.randomUUID(), timestamp: Date.now() },
          ],
        })),
      clearMessages: () => set({ messages: [] }),

      // Pending tx
      pendingTx: null,
      setPendingTx: (tx) => set({ pendingTx: tx }),

      // Completed txs
      completedTxs: [],
      addCompletedTx: (tx) =>
        set((s) => ({ completedTxs: [tx, ...s.completedTxs].slice(0, 100) })),

      // Prefs
      prefs: {
        spendCeiling: 500,
        dailyCap: 5000,
        pin: null,
        hasOnboarded: false,
      },
      setPrefs: (prefs) =>
        set((s) => ({ prefs: { ...s.prefs, ...prefs } })),

      // Daily cap tracking
      dailySpent: 0,
      dailySpentResetAt: Date.now() + 86_400_000,
      addDailySpent: (amount) => {
        const now = Date.now();
        const s = get();
        if (now > s.dailySpentResetAt) {
          set({ dailySpent: amount, dailySpentResetAt: now + 86_400_000 });
        } else {
          set({ dailySpent: s.dailySpent + amount });
        }
      },

      // UI
      isLoading: false,
      setLoading: (v) => set({ isLoading: v }),
    }),
    {
      name: "auron-store",
      // Only persist prefs and completed txs — not sensitive wallet state
      partialize: (s) => ({
        prefs: s.prefs,
        completedTxs: s.completedTxs,
        dailySpent: s.dailySpent,
        dailySpentResetAt: s.dailySpentResetAt,
      }),
    }
  )
);
