"use client";

import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  // Redirect if already authenticated
  if (isAuthenticated) {
    router.push("/dashboard");
    return null;
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
