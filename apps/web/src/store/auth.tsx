import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi, setAccessToken, getAccessToken } from "../api/client";
import { connectSocket, disconnectSocket } from "../api/socket";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    try {
      const res = await authApi.me();
      if (res.data) {
        setUser(res.data);
        connectSocket();
      }
    } catch {
      try {
        const refreshed = await authApi.refresh();
        if (refreshed.data?.accessToken) {
          setAccessToken(refreshed.data.accessToken);
          const me = await authApi.me();
          if (me.data) {
            setUser(me.data);
            connectSocket();
          }
        }
      } catch {
        setAccessToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    if (!res.data) throw new Error("Login failed");
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    connectSocket();
  }, []);

  const register = useCallback(
    async (data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }) => {
      await authApi.register(data);
      await login(data.email, data.password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      disconnectSocket();
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}