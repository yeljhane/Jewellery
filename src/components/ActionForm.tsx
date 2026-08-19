"use client";

import { useState, type ComponentPropsWithoutRef, type SubmitEvent as ReactSubmitEvent } from "react";
import { useToast } from "@/components/ToastProvider";

type ServerFormAction = (formData: FormData) => unknown | Promise<unknown>;

type ActionFormProps = Omit<ComponentPropsWithoutRef<"form">, "action" | "onSubmit"> & {
  action: ServerFormAction;
  successMessage?: string;
  successTitle?: string;
  onSubmit?: ComponentPropsWithoutRef<"form">["onSubmit"];
};

function friendlyActionError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const message = raw.replace(/^Error:\s*/i, "").trim();

  if (/P2002|unique constraint|unique key|duplicate|already exists|already taken/i.test(message)) {
    return "This data already exists. Please use a different unique value and try again.";
  }
  if (/foreign key constraint|P2003/i.test(message)) {
    return "This record refers to data that no longer exists. Refresh the page and try again.";
  }
  if (/prisma|sqlite|database constraint|database error/i.test(message)) {
    return "The data could not be saved. Check for duplicate values or missing information, then try again.";
  }
  if (/required|select|must|cannot|not found|invalid|disabled|forbidden|unauthorized/i.test(message)) {
    return message;
  }
  if (!message || /digest|server components render|unexpected response/i.test(message)) {
    return "The data could not be saved. Check for duplicate values or missing information, then try again.";
  }
  return message;
}

export function ActionForm({
  action,
  successMessage = "The data was added successfully.",
  successTitle = "Successfully added",
  onSubmit,
  children,
  ...props
}: ActionFormProps) {
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function submit(event: ReactSubmitEvent<HTMLFormElement>) {
    onSubmit?.(event);
    if (event.defaultPrevented) return;

    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const submitter = event.nativeEvent.submitter as HTMLButtonElement | HTMLInputElement | null;
    if (submitter?.name && !formData.has(submitter.name)) formData.append(submitter.name, submitter.value);

    setPending(true);
    try {
      await action(formData);
      toast({ tone: "success", title: successTitle, message: successMessage });
    } catch (error) {
      if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) {
        throw error;
      }
      toast({ tone: "error", title: "Unable to save", message: friendlyActionError(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <form {...props} onSubmit={submit} aria-busy={pending} data-pending={pending ? "true" : "false"}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
