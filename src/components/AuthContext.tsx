"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { RoleCode } from "@/lib/constants";

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  roleCode: RoleCode;
  roleName: string;
  employeeId: string | null;
  permissions: string[];
  allowedModules: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  canSwitchRoles: boolean;
  loading: boolean;
  refreshUser: () => Promise<void>;
  switchRole: (roleCode: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPerm: (code: string) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  canSwitchRoles: false,
  loading: true,
  refreshUser: async () => {},
  switchRole: async () => {},
  logout: async () => {},
  hasPerm: () => false,
});

/**
 * Provides authenticated user state, RBAC permissions, and session actions across pages.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [canSwitchRoles, setCanSwitchRoles] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setCanSwitchRoles(Boolean(data.canSwitchRoles));
      } else {
        setUser(null);
        setCanSwitchRoles(false);
        if (pathname !== "/login") {
          router.replace("/login");
        }
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const switchRole = async (roleCode: string) => {
    const res = await fetch("/api/auth/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleCode }),
    });
    if (res.ok) {
      await refreshUser();
      router.push("/");
      router.refresh();
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setCanSwitchRoles(false);
    router.replace("/login");
  };

  const hasPerm = useCallback(
    (code: string) => {
      if (!user) return false;
      if (user.roleCode === "SUPER_ADMIN") return true;
      return user.permissions.includes(code);
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, canSwitchRoles, loading, refreshUser, switchRole, logout, hasPerm }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
