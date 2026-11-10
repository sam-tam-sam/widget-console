"use server";

import { redirect } from "next/navigation";
import { clearSession, isAdminMutation, signInWithPassword } from "@/lib/auth";

type FormState = { message?: string; error?: boolean };

const messages: Record<string, string> = {
  invalid: "The username or password is incorrect.",
  throttled: "Too many attempts. Wait a minute and try again.",
  unavailable: "Sign-in is unavailable. Check the deployment settings.",
};

function formMessage(code: string): FormState {
  return { message: messages[code] ?? "Sign-in failed. Try again.", error: true };
}

export async function signInAction(_previous: FormState, form: FormData): Promise<FormState> {
  if (!await isAdminMutation()) return formMessage("unavailable");
  const result = await signInWithPassword(form);
  if (result === "signed-in") redirect("/admin");
  return formMessage(result);
}

export async function signOut() {
  if (!await isAdminMutation()) redirect("/sign-in");
  await clearSession();
  redirect("/sign-in");
}
