"use client";

import { LoginForm } from "@/components/login-form";
import { NewPasswordForm } from "@/components/new-password-form";
import { useAuth } from "@/contexts/auth-context";
import { Suspense } from "react";

function LoginContent() {
  const { needsPasswordChange } = useAuth();
  return needsPasswordChange ? <NewPasswordForm /> : <LoginForm />;
}

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense fallback={<div>Loading...</div>}>
          <LoginContent />
        </Suspense>
      </div>
    </div>
  );
}
