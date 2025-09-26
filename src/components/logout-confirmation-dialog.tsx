"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface LogoutConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function LogoutConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: LogoutConfirmationDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Confirm Logout</DialogTitle>
          <DialogDescription>
            Are you sure you want to log out? You will need to sign in again to
            access your account.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "Logging out..." : "Yes, log out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useLogoutConfirmation() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [onConfirmAction, setOnConfirmAction] = useState<(() => void) | null>(
    null
  );

  const showConfirmation = (onConfirm: () => void) => {
    setOnConfirmAction(() => onConfirm);
    setIsOpen(true);
  };

  const handleConfirm = async () => {
    if (onConfirmAction) {
      setIsLoading(true);
      try {
        await onConfirmAction();
      } finally {
        setIsLoading(false);
        setIsOpen(false);
        setOnConfirmAction(null);
      }
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setIsOpen(false);
      setOnConfirmAction(null);
    }
  };

  return {
    isOpen,
    isLoading,
    showConfirmation,
    LogoutConfirmationDialog: () => (
      <LogoutConfirmationDialog
        isOpen={isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        isLoading={isLoading}
      />
    ),
  };
}
