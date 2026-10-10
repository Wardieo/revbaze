import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Theme } from "../types/workspace";
type Preferences = {
  theme: Theme;
  collapsed: boolean;
  name: string;
  email: string;
  image: string;
  product_notifications: boolean;
  activity_notifications: boolean;
};
export const usePreferences = create<
  Preferences & { set: (value: Partial<Preferences>) => void }
>()(
  persist(
    (set) => ({
      theme: "light",
      collapsed: false,
      name: "Business owner",
      email: "",
      image: "",
      product_notifications: true,
      activity_notifications: true,
      set: (value) => set(value),
    }),
    { name: "revbaze-preferences-v2" },
  ),
);
