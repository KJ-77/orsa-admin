"use client";

import { LoginForm } from "@/components/login-form";
import { NewPasswordForm } from "@/components/new-password-form";
import { useAuth } from "@/contexts/auth-context";

export default function Page() {
  const { needsPasswordChange } = useAuth();

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        {needsPasswordChange ? <NewPasswordForm /> : <LoginForm />}
      </div>
    </div>
  );
}
