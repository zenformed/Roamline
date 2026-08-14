"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { authenticate, type AuthState } from "@/app/login/actions";

const initialState: AuthState = {};

export function AuthForm({
  mode,
  returnTo,
}: {
  mode: "login" | "signup";
  returnTo: string;
}) {
  const [state, action, pending] = useActionState(authenticate, initialState);
  const isSignup = mode === "signup";
  const alternateHref = `/login?mode=${isSignup ? "login" : "signup"}&returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="returnTo" value={returnTo} />

      {isSignup ? (
        <label>
          <span>Name</span>
          <input
            name="displayName"
            type="text"
            autoComplete="name"
            minLength={1}
            maxLength={80}
            required
          />
        </label>
      ) : null}

      <label>
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={8}
          required
        />
      </label>

      {state.error ? <p className="form-message error" role="alert">{state.error}</p> : null}
      {state.message ? <p className="form-message success" role="status">{state.message}</p> : null}

      <button className="primary-button auth-submit" disabled={pending} type="submit">
        {pending ? <LoaderCircle className="spin" size={17} /> : null}
        {pending ? "Working…" : isSignup ? "Create account" : "Sign in"}
        {!pending ? <ArrowRight size={17} /> : null}
      </button>

      <p className="auth-switch">
        {isSignup ? "Already have an account?" : "New to Roamline?"}{" "}
        <Link href={alternateHref}>{isSignup ? "Sign in" : "Create an account"}</Link>
      </p>
    </form>
  );
}
