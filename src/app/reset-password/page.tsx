"use client";

import { ResetPasswordForm } from "@/components/reset-password-form";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { Suspense } from "react";

function ResetPasswordContent() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  // Redirect if already authenticated
  if (isAuthenticated) {
    router.push("/dashboard");
    return null;
  }

  return <ResetPasswordForm />;
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense fallback={<div>Loading...</div>}>
          <ResetPasswordContent />
        </Suspense>
      </div>
    </div>
  );
}
