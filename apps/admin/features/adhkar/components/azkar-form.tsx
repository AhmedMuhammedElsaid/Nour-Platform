"use client";

import { useForm } from "@tanstack/react-form";
import { useState } from "react";

import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { FormField } from "@repo/ui/patterns/form-field";

import {
  azkarFormSchema,
  createEmptyDhikrItem,
  type AzkarFormValues,
} from "../schemas/azkar-form.schema";
import { AzkarItemsEditor } from "./azkar-items-editor";

// TanStack Form v1 with a Zod schema validator stores ZodIssue objects in
// field.state.meta.errors — not plain strings. Extract the message safely.
function fieldError(errors: unknown[]): string | undefined {
  const e = errors[0];
  if (!e) return undefined;
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null && "message" in e)
    return (e as { message: string }).message;
  return undefined;
}

const selectClass =
  "flex h-10 w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

interface AzkarFormProps {
  mode: "create" | "edit";
  initialValues?: AzkarFormValues;
  onSubmit: (
    values: AzkarFormValues,
  ) => Promise<{ error: string } | undefined>;
}

export function AzkarForm({ mode, initialValues, onSubmit }: AzkarFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues:
      initialValues ??
      ({
        kind: "morning",
        status: "draft",
        ar: { title: "" },
        en: { title: "" },
        items: [createEmptyDhikrItem()],
      } satisfies AzkarFormValues),
    validators: { onSubmit: azkarFormSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const result = await onSubmit(value);
      if (result?.error) {
        setServerError(result.error);
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="flex max-w-2xl flex-col gap-6"
      noValidate
    >
      {serverError && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {serverError}
        </p>
      )}

      <form.Field name="kind">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(field: any) => (
          <FormField label="Kind" htmlFor="azkar-kind">
            <select
              id="azkar-kind"
              value={field.state.value}
              onChange={(e) =>
                field.handleChange(
                  e.target.value as AzkarFormValues["kind"],
                )
              }
              onBlur={field.handleBlur}
              className={selectClass}
            >
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
              <option value="other">Other</option>
            </select>
          </FormField>
        )}
      </form.Field>

      <form.Field name="status">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(field: any) => (
          <FormField label="Status" htmlFor="azkar-status">
            <select
              id="azkar-status"
              value={field.state.value}
              onChange={(e) =>
                field.handleChange(
                  e.target.value as AzkarFormValues["status"],
                )
              }
              onBlur={field.handleBlur}
              className={selectClass}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </FormField>
        )}
      </form.Field>

      <form.Field name="ar.title">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(field: any) => (
          <FormField
            label="Title (Arabic)"
            htmlFor="azkar-ar-title"
            error={
              field.state.meta.isTouched
                ? fieldError(field.state.meta.errors)
                : undefined
            }
          >
            <Input
              id="azkar-ar-title"
              dir="rtl"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              aria-invalid={
                field.state.meta.isTouched &&
                field.state.meta.errors.length > 0
              }
            />
          </FormField>
        )}
      </form.Field>

      <form.Field name="en.title">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(field: any) => (
          <FormField
            label="Title (English)"
            htmlFor="azkar-en-title"
            error={
              field.state.meta.isTouched
                ? fieldError(field.state.meta.errors)
                : undefined
            }
          >
            <Input
              id="azkar-en-title"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              aria-invalid={
                field.state.meta.isTouched &&
                field.state.meta.errors.length > 0
              }
            />
          </FormField>
        )}
      </form.Field>

      <AzkarItemsEditor form={form} />

      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "create"
                ? "Creating…"
                : "Saving…"
              : mode === "create"
                ? "Create azkar"
                : "Save changes"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
