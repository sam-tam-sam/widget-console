import { Layers3 } from "lucide-react";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/admin/auth-forms";
import { getAdminSession, getSignInAvailability } from "@/lib/auth";

export default async function SignInPage() {
  const session = await getAdminSession();
  if (session) redirect("/admin");
  const available = await getSignInAvailability();

  return (
    <main className="auth-screen">
      <section className="auth-panel" aria-labelledby="sign-in-title">
        <div className="auth-heading">
          <span className="auth-mark"><Layers3 aria-hidden="true" size={21} /></span>
          <h1 id="sign-in-title">Sign in to Widget Console</h1>
          <p>Manage your widget catalog and approved embed links.</p>
        </div>
        {available ? <SignInForm /> : (
          <p className="auth-message" role="status">
            Sign-in is unavailable. Check the deployment settings.
          </p>
        )}
      </section>
    </main>
  );
}
