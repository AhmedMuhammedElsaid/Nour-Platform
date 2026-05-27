"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { FormField } from "@repo/ui/patterns/form-field";

import { createCategoryAction } from "../actions/create-category.action";
import { updateCategoryAction } from "../actions/update-category.action";
import {
  categoryFormSchema,
  type CategoryFormValues,
} from "../schemas/category-form.schema";

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

/*
 * Derives a URL-safe slug from a name. Must produce output that satisfies
 * the slugSchema regex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
 */
function autoSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

interface CategoryFormProps {
  mode: "create" | "edit";
  categoryId?: string;
  initialValues?: Partial<CategoryFormValues>;
}

export function CategoryForm({
  mode,
  categoryId,
  initialValues,
}: CategoryFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  // Tracks whether the user has manually edited the slug field.
  // While false, typing in the name field auto-derives the slug.
  const slugManuallyEdited = useRef(
    // In edit mode, treat the existing slug as already manually set.
    mode === "edit" && !!initialValues?.slug,
  );

  const form = useForm({
    defaultValues: {
      locale: initialValues?.locale ?? ("ar" as const),
      contentId: initialValues?.contentId ?? "",
      name: initialValues?.name ?? "",
      slug: initialValues?.slug ?? "",
      description: initialValues?.description ?? "",
      coverMediaId: initialValues?.coverMediaId ?? "",
    } satisfies CategoryFormValues,
    validators: { onChange: categoryFormSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);

      const result =
        mode === "create"
          ? await createCategoryAction(value)
          : await updateCategoryAction(categoryId!, value);

      if (result?.error) {
        setServerError(result.error);
        return;
      }

      // createCategoryAction redirects on success; for edit, navigate back.
      if (mode === "edit") router.push("/categories");
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="flex max-w-xl flex-col gap-6"
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

      <form.Field name="locale">
        {(field) => (
          <FormField label="Language" htmlFor="category-locale">
            {mode === "edit" ? (
              <p
                id="category-locale"
                className="text-sm text-muted-foreground"
              >
                {field.state.value === "ar" ? "Arabic (ar)" : "English (en)"}
                <span className="ms-2 text-xs">— language is immutable</span>
              </p>
            ) : (
              <select
                id="category-locale"
                value={field.state.value}
                onChange={(e) =>
                  field.handleChange(
                    e.target.value as CategoryFormValues["locale"],
                  )
                }
                onBlur={field.handleBlur}
                className="flex h-10 w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <option value="ar">Arabic (ar)</option>
                <option value="en">English (en)</option>
              </select>
            )}
          </FormField>
        )}
      </form.Field>

      <form.Field name="name">
        {(field) => (
          <FormField
            label="Name"
            htmlFor="category-name"
            error={
              field.state.meta.isTouched
                ? fieldError(field.state.meta.errors)
                : undefined
            }
          >
            <Input
              id="category-name"
              type="text"
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.target.value);
                // Auto-derive slug while the user hasn't manually edited it.
                if (!slugManuallyEdited.current) {
                  form.setFieldValue("slug", autoSlug(e.target.value));
                }
              }}
              onBlur={field.handleBlur}
              aria-invalid={
                field.state.meta.isTouched &&
                field.state.meta.errors.length > 0
              }
            />
          </FormField>
        )}
      </form.Field>

      <form.Field name="slug">
        {(field) => (
          <FormField
            label="Slug"
            htmlFor="category-slug"
            error={
              field.state.meta.isTouched
                ? fieldError(field.state.meta.errors)
                : undefined
            }
          >
            <Input
              id="category-slug"
              type="text"
              value={field.state.value}
              onChange={(e) => {
                // Once the user edits the slug directly, stop auto-deriving.
                slugManuallyEdited.current = true;
                field.handleChange(e.target.value);
              }}
              onBlur={field.handleBlur}
              aria-invalid={
                field.state.meta.isTouched &&
                field.state.meta.errors.length > 0
              }
            />
          </FormField>
        )}
      </form.Field>

      <form.Field name="description">
        {(field) => (
          <FormField
            label="Description"
            htmlFor="category-description"
            error={
              field.state.meta.isTouched
                ? fieldError(field.state.meta.errors)
                : undefined
            }
          >
            <textarea
              id="category-description"
              rows={4}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              aria-invalid={
                field.state.meta.isTouched &&
                field.state.meta.errors.length > 0
              }
              className="flex w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-destructive resize-none"
            />
          </FormField>
        )}
      </form.Field>

      <form.Field name="coverMediaId">
        {(field) => (
          <FormField
            label="Cover Media ID"
            htmlFor="category-cover-media-id"
            error={
              field.state.meta.isTouched
                ? fieldError(field.state.meta.errors)
                : undefined
            }
          >
            <Input
              id="category-cover-media-id"
              type="text"
              placeholder="24-character ObjectId (optional)"
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

      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "create"
                ? "Creating…"
                : "Saving…"
              : mode === "create"
                ? "Create category"
                : "Save changes"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
