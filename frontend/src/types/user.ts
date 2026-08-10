export type ThemePreference = "light" | "dark" | "system";

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  email_verified: boolean;
  theme_preference: ThemePreference;
  created_at: string;
}
