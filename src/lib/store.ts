// ============================================
// GLOBAL APP STORE (Zustand)
// ============================================

import { create } from 'zustand';
import type { Business, Conversation } from '@/types';

interface AppState {
  // Active business (loaded on mount)
  business: Business | null;
  setBusiness: (business: Business) => void;

  // Selected conversation in inbox
  selectedConversation: Conversation | null;
  setSelectedConversation: (conv: Conversation | null) => void;

  // Sidebar collapsed
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Notification count
  unreadCount: number;
  setUnreadCount: (count: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  business: null,
  setBusiness: (business) => set({ business }),

  selectedConversation: null,
  setSelectedConversation: (conv) => set({ selectedConversation: conv }),

  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),
}));
