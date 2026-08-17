"use client";

import { Button } from "@/components/ui";

export function ConfirmForm({
  action,
  message,
  children,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}

export function DeleteButton({
  action,
  id,
  label = "Delete",
  message = "Delete this record? This cannot be undone.",
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  label?: string;
  message?: string;
  className?: string;
}) {
  return (
    <ConfirmForm action={action} message={message} className={className}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="danger" className="!px-3 !py-1.5 text-xs">
        {label}
      </Button>
    </ConfirmForm>
  );
}
