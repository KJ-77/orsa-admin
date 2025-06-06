"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  getCurrentUser,
  signIn,
  signOut,
  fetchAuthSession,
} from "aws-amplify/auth";

interface User {
  username: string;
  email: string;
  groups: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getAuthToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const extractGroupsFromToken = (token: string): string[] => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload["cognito:groups"] || [];
    } catch {
      return [];
    }
  };

  const checkAuthState = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();

      // Extract groups from JWT token
      const groups = extractGroupsFromToken(
        session.tokens?.accessToken?.toString() || ""
      );

      // Check if user belongs to "admins" group
      if (!groups.includes("admins")) {
        await signOut();
        setUser(null);
        throw new Error("User does not have admin access");
      }

      setUser({
        username: currentUser.username,
        email: currentUser.signInDetails?.loginId || "",
        groups,
      });
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthState();
  }, [checkAuthState]);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      await signIn({ username: email, password });
      await checkAuthState();
    } catch (error: unknown) {
      setIsLoading(false);
      const message = error instanceof Error ? error.message : "Login failed";
      throw new Error(message);
    }
  };

  const logout = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.accessToken?.toString() || null;
    } catch {
      return null;
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    getAuthToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
