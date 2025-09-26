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
  resetPassword,
  confirmResetPassword,
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
  forgotPassword: (email: string) => Promise<void>;
  resetPasswordConfirm: (
    email: string,
    code: string,
    newPassword: string
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [challengeSession, setChallengeSession] = useState<unknown>(null);
  const [, setSessionTimer] = useState<NodeJS.Timeout | null>(null);

  const extractGroupsFromToken = (token: string): string[] => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload["cognito:groups"] || [];
    } catch {
      return [];
    }
  };
  // Start session timeout timer (1 hour)
  const startSessionTimer = useCallback(() => {
    // Clear any existing timer using ref or state callback
    setSessionTimer((prevTimer) => {
      if (prevTimer) {
        clearTimeout(prevTimer);
      }

      // Set new timer for 1 hour (3600000 ms)
      const timer = setTimeout(async () => {
        await signOut();
        setUser(null);
        setNeedsPasswordChange(false);
        setChallengeSession(null);
        alert("Your session has expired. Please log in again.");
      }, 3600000); // 1 hour in milliseconds

      return timer;
    });
  }, []); // Remove sessionTimer dependency

  // Clear session timer
  const clearSessionTimer = useCallback(() => {
    setSessionTimer((prevTimer) => {
      if (prevTimer) {
        clearTimeout(prevTimer);
      }
      return null;
    });
  }, []); // Remove sessionTimer dependency

  const checkAuthState = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();

      const session = await fetchAuthSession();

      // Extract groups from JWT token
      const groups = extractGroupsFromToken(
        session.tokens?.accessToken?.toString() || ""
      );

      setUser({
        username: currentUser.username,
        email: currentUser.signInDetails?.loginId || "",
        groups,
      }); // Start session timer when user is authenticated
      startSessionTimer();
    } catch {
      setUser(null);
      clearSessionTimer();
    } finally {
      setIsLoading(false);
    }
  }, [startSessionTimer, clearSessionTimer]); // Keep these dependencies but they're now stable

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      clearSessionTimer();
    };
  }, [clearSessionTimer]);
  // Only run checkAuthState once on mount
  useEffect(() => {
    checkAuthState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty to prevent infinite loop - checkAuthState is stable
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);

      const result = await signIn({ username: email, password });

      // Check if password change is required
      if (
        result.nextStep?.signInStep ===
        "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED"
      ) {
        setNeedsPasswordChange(true);
        setChallengeSession(result);
        setIsLoading(false);
        return; // Don't complete login yet
      }

      // Normal login flow
      if (result.isSignedIn) {
        await checkAuthState();
      }
    } catch (error: unknown) {
      setIsLoading(false);
      const message = error instanceof Error ? error.message : "Login failed";
      throw new Error(message);
    }
  };
  const logout = async () => {
    try {
      clearSessionTimer(); // Clear the session timer on logout
      await signOut();
      setUser(null);
      setNeedsPasswordChange(false);
      setChallengeSession(null);
    } catch {
      clearSessionTimer();
    }
  };
  const completeNewPassword = async (newPassword: string) => {
    try {
      if (!challengeSession) {
        throw new Error("No active challenge session");
      }

      const result = await confirmSignIn({
        challengeResponse: newPassword,
      });

      if (result.isSignedIn) {
        setNeedsPasswordChange(false);
        setChallengeSession(null);
        await checkAuthState();
      } else {
        throw new Error("Sign-in was not completed after password change");
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        // Error details for debugging can be logged to server or error tracking service
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

  const forgotPassword = async (email: string) => {
    try {
      await resetPassword({ username: email });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to send reset code";
      throw new Error(message);
    }
  };

  const resetPasswordConfirm = async (
    email: string,
    code: string,
    newPassword: string
  ) => {
    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword: newPassword,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to reset password";
      throw new Error(message);
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
    forgotPassword,
    resetPasswordConfirm,
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
