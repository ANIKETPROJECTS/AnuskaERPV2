import { createContext, useContext, type ReactNode } from "react";
import type { PublicUser } from "@/auth.server";

type AuthContextValue = {
  user: PublicUser | null;
  setupRequired: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  value,
  children,
}: {
  value: AuthContextValue;
  children: ReactNode;
}) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}

export function canAccess(user: PublicUser | null, section: string): boolean {
  if (user?.role === "master_admin") return true;
  if (section === "user-management") return false;
  return user?.permissions.includes(section as never) === true;
}