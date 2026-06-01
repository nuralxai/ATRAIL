import { create } from "zustand";
import { ReactNode } from "react";

type ShellState = {
  title:    string;
  subtitle: string;
  right:    ReactNode;
  set: (s: Partial<Omit<ShellState, "set">>) => void;
};

export const useShellStore = create<ShellState>((setState) => ({
  title:    "",
  subtitle: "",
  right:    null,
  set: (s) => setState(s),
}));
