import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Building2, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getMyIdentity } from "@/lib/identity.functions";
import { bootstrapSuperuser } from "@/lib/registration.functions";
import { BRAND } from "@/lib/brand";
import { setRememberFlag } from "@/lib/session-pref";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Captcha } from "@/components/captcha";
import heroImage from "@/assets/auth-hero.jpg";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Wise Cloud Portal" },
      {
        name: "description",
        content: "Sign in to the Wise Cloud enterprise portal by PT Arta Teletama Teknologi. Built with Trust.",
      },
      { property: "og:title", content: "Sign in · Wise Cloud Portal" },
      {
        property: "og:description",
        content: "Sign in to the Wise Cloud enterprise portal by PT Arta Teletama Teknologi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const identityFn = useServerFn(getMyIdentity);
  const bootstrapFn = useServerFn(bootstrapSuperuser);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [captchaOk, setCaptchaOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // One-time owner provisioning; the server fn no-ops once a superuser exists.
    void bootstrapFn().catch(() => undefined);
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !cancelled) {
        try {
          const identity = await identityFn();
          void navigate({
            to: identity.isStaff ? "/backend/dashboard" : "/user/dashboard",
            replace: true,
          });
          return;
        } catch {
          /* fall through to the form */
        }
      }
      if (!cancelled) setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [identityFn, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!captchaOk) {
      toast.error("Please complete the security check.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setSubmitting(false);
      toast.error(
        error.message === "Invalid login credentials"
          ? "Wrong email or password."
          : error.message,
      );
      return;
    }
    try {
      setRememberFlag(remember);
      const identity = await identityFn();
      void navigate({
        to: identity.isStaff ? "/backend/dashboard" : "/user/dashboard",
        replace: true,
      });
    } catch {
      setSubmitting(false);
      toast.error("Signed in, but your profile is still loading. Please refresh.");
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Form panel */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-[46%] lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-3">
            <div className="bg-gradient-brand flex h-11 w-11 items-center justify-center rounded-xl shadow-elevated">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="font-display text-lg font-bold text-foreground">{BRAND.name}</p>
              <p className="text-xs text-muted-foreground">{BRAND.tagline}</p>
            </div>
          </div>

          <h1 className="font-display text-2xl font-bold text-foreground">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {BRAND.legalName} · Enterprise Portal
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Username or email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={remember}
                onCheckedChange={(v) => setRemember(v === true)}
              />
              <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">
                Remember me for 30 days
              </Label>
            </div>

            <Captcha onValidityChange={setCaptchaOk} />

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Sign in securely
            </Button>

            <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              Sessions are protected with rotating tokens
            </p>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            No account yet?{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Register your company
            </Link>
          </p>
        </div>
      </div>

      {/* Brand panel */}
      <div className="relative hidden lg:block lg:w-[54%]">
        <img
          src={heroImage}
          alt="Wise Cloud data center"
          className="absolute inset-0 h-full w-full object-cover"
          width={1024}
          height={1600}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-16 left-16 max-w-md">
          <p className="font-display text-3xl font-bold text-foreground">
            {BRAND.name} Portal
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Colocation, dedicated internet and cloud services — billing, tickets and
            data center operations in one secure portal.
          </p>
          <p className="mt-6 text-xs uppercase tracking-widest text-primary">
            {BRAND.legalName} · {BRAND.tagline}
          </p>
        </div>
      </div>
    </div>
  );
}
