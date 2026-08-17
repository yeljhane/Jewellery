"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export async function loginAction(formData: FormData): Promise<{ error?: string } | void> {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");

  if (!username || !password) {
    return { error: "Enter username and password." };
  }

  try {
    await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Invalid username or password." };
    }
    throw err;
  }
}
