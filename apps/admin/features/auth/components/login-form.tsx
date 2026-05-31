"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";

import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { FormField } from "@repo/ui/patterns/form-field";

import { signInAction } from "../actions/sign-in.action";

const loginSchema = z.object({
  email: z.string().email("Invalid email address."),
  password: z.string().min(1, "Password is required."),
});

// TanStack Form v1 with a Zod schema validator stores ZodIssue objects in
// field.state.meta.errors — not plain strings. Extract the message safely so
// we never try to render the issue object as a React child.
function fieldError(errors: unknown[]): string | undefined {
  const e = errors[0];
  if (!e) return undefined;
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null && "message" in e)
    return (e as { message: string }).message;
  return undefined;
}

interface LoginFormProps {
  from?: string;
}

function LoginForm({ from }: LoginFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    // onMount runs validation immediately so `canSubmit` reflects the empty
    // (invalid) state and the submit button starts disabled; onChange keeps it
    // in sync as the user types. Error *messages* still only show after a field
    // is touched (see the gated `error` props below).
    validators: { onMount: loginSchema, onChange: loginSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const result = await signInAction(value, from);
      if (result?.error) setServerError(result.error);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      {serverError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      )}

      <form.Field name="email">
        {(field) => (
          <FormField
            label="Email"
            htmlFor="login-email"
            error={field.state.meta.isTouched ? fieldError(field.state.meta.errors) : undefined}
          >
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
            />
          </FormField>
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <FormField
            label="Password"
            htmlFor="login-password"
            error={field.state.meta.isTouched ? fieldError(field.state.meta.errors) : undefined}
          >
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
            />
          </FormField>
        )}
      </form.Field>

      <form.Subscribe
        selector={(s) => ({ canSubmit: s.canSubmit, isSubmitting: s.isSubmitting })}
      >
        {({ canSubmit, isSubmitting }) => (
          <Button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="mt-2 w-full"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

export { LoginForm };
