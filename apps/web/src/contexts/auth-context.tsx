"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import Cookies from "js-cookie";
import { apiClient } from "@/lib/api-client";

export interface User {
  id: string;
  email: string;
  role: "student" | "tutor" | "admin" | "subadmin" | string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
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
    role: "student";
  }) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = Cookies.get("mrh_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const { data } = await apiClient.get("/users/me");
      setUser(data);
    } catch {
      Cookies.remove("mrh_token");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await apiClient.post("/auth/login", { email, password });
    Cookies.set("mrh_token", data.accessToken, { secure: true, sameSite: "strict" });
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
      Cookies.set("mrh_token", data.accessToken, { secure: true, sameSite: "strict" });
      setUser(data.user);
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
    Cookies.remove("mrh_token");
    setUser(null);
    window.location.href = "/login";
  }, []);

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
