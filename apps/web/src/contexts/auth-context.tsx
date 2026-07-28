"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { apiClient } from "@/lib/api-client";

interface User {
  id: string;
  email: string;
  role: "student" | "tutor" | "admin" | "subadmin" | string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  timezone?: string;
  assignedPermissions?: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: "student" | "tutor";
  }) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const PUBLIC_AUTH_ROUTES = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]);

function canonicalAuthPath(pathname: string) {
  const stripped = pathname.replace(/^\/(?:en|ar)(?=\/|$)/, "") || "/";
  if (stripped === "/sign-in") return "/login";
  if (stripped === "/sign-up") return "/register";
  return stripped;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionChecked = useRef(false);

  const fetchUser = useCallback(async () => {
    try {
      const { data } = await apiClient.get("/users/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (PUBLIC_AUTH_ROUTES.has(canonicalAuthPath(pathname))) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    if (sessionChecked.current) return;
    sessionChecked.current = true;
    setIsLoading(true);
    fetchUser();
  }, [fetchUser, pathname]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await apiClient.post("/auth/login", { email, password });
    sessionChecked.current = true;
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role: "student" | "tutor";
    }) => {
      const { data } = await apiClient.post("/auth/register", input);
      sessionChecked.current = false;
      setUser(null);
      return data.user;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Ignore logout API errors
    }
    setUser(null);
    const locale = pathname.match(/^\/(en|ar)(?:\/|$)/)?.[1] ?? "ar";
    window.location.href = `/${locale}/sign-in`;
  }, [pathname]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
