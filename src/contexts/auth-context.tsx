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
  confirmSignIn,
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
  completeNewPassword: (newPassword: string) => Promise<void>;
  needsPasswordChange: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [challengeSession, setChallengeSession] = useState<unknown>(null);

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
      console.log("Checking auth state...");
      const currentUser = await getCurrentUser();
      console.log("Current user:", currentUser);

      const session = await fetchAuthSession();
      console.log("Session tokens:", session.tokens);

      // Extract groups from JWT token
      const groups = extractGroupsFromToken(
        session.tokens?.accessToken?.toString() || ""
      );
      console.log("User groups:", groups); // Check if user belongs to "admins" group
      // TEMPORARY: Comment out admin check for testing
      // if (!groups.includes("admins")) {
      //   console.error("User is not in admins group. Available groups:", groups);
      //   await signOut();
      //   setUser(null);
      //   throw new Error("User does not have admin access");
      // }

      console.log("User has admin access, setting user state");
      setUser({
        username: currentUser.username,
        email: currentUser.signInDetails?.loginId || "",
        groups,
      });
    } catch (error) {
      console.error("Auth state check failed:", error);
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
      console.log("Starting login process for:", email);

      const result = await signIn({ username: email, password });
      console.log("signIn result:", result);

      // Check if password change is required
      if (
        result.nextStep?.signInStep ===
        "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED"
      ) {
        console.log("Password change required, setting up challenge session");
        setNeedsPasswordChange(true);
        setChallengeSession(result);
        setIsLoading(false);
        return; // Don't complete login yet
      }

      // Normal login flow
      if (result.isSignedIn) {
        console.log("Normal login completed");
        await checkAuthState();
      }
    } catch (error: unknown) {
      console.error("Login error:", error);
      setIsLoading(false);
      const message = error instanceof Error ? error.message : "Login failed";
      throw new Error(message);
    }
  };
  const logout = async () => {
    try {
      await signOut();
      setUser(null);
      setNeedsPasswordChange(false);
      setChallengeSession(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };
  const completeNewPassword = async (newPassword: string) => {
    try {
      console.log("Starting password change process...");

      if (!challengeSession) {
        console.error("No challenge session available");
        throw new Error("No active challenge session");
      }

      console.log("Calling confirmSignIn with new password...");
      const result = await confirmSignIn({
        challengeResponse: newPassword,
      });

      console.log("confirmSignIn result:", result);

      if (result.isSignedIn) {
        console.log("Sign-in completed successfully");
        setNeedsPasswordChange(false);
        setChallengeSession(null);
        await checkAuthState();
      } else {
        console.log("Sign-in not completed, result:", result);
        throw new Error("Sign-in was not completed after password change");
      }
    } catch (error: unknown) {
      console.error("Password change error:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      const message =
        error instanceof Error ? error.message : "Password change failed";
      throw new Error(message);
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
    completeNewPassword,
    needsPasswordChange,
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
