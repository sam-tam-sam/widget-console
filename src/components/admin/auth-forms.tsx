"use client";

import { AdminForm } from "@/components/admin/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction } from "@/lib/auth-actions";
import "./auth.css";

export function SignInForm() {
  return (
    <AdminForm className="auth-form" action={signInAction} label="Sign in">
      <div className="auth-field">
        <Label htmlFor="sign-in-username">Username</Label>
        <Input id="sign-in-username" name="username" autoComplete="username" autoCapitalize="none" maxLength={64} required />
      </div>
      <div className="auth-field">
        <Label htmlFor="sign-in-password">Password</Label>
        <Input id="sign-in-password" name="password" type="password" autoComplete="current-password" maxLength={512} required />
      </div>
    </AdminForm>
  );
}
