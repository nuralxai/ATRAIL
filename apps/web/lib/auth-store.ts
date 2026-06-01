import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type Role = "GOD" | "DEVELOPER" | "SUPER_ADMIN" | "ADMIN" | "ELITE" | "TENANT" | "USER" | "INTERN";

type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  twoFactorEnabled?: boolean;
  externalReminders?: boolean;
  fcmToken?: string;
};

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  setAuth: (accessToken: string, user: AuthUser) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setAuth: (accessToken, user) => set({ accessToken, user }),
      clear: () => set({ accessToken: null, user: null }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
    }
  )
);
