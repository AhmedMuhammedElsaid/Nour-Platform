"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { FormField } from "@repo/ui/patterns/form-field";

import { createCategoryAction } from "../actions/create-category.action";
import { updateCategoryAction } from "../actions/update-category.action";
import {
  categoryFormSchema,
  type CategoryFormValues,
} from "../schemas/category-form.schema";

function fieldError(errors: unknown[]): string | undefined {
  const e = errors[0];
  if (!e) return undefined;
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null && "message" in e)
    return (e as { message: string }).message;
  return undefined;
}

interface CategoryFormProps {
  mode: "create" | "edit";
  categoryId?: string;
  initialValues?: Partial<CategoryFormValues>;
}

export function CategoryForm({ mode, categoryId, initialValues }: CategoryFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      ar: {
        name: initialValues?.ar?.name ?? "",
        description: initialValues?.ar?.description ?? "",
      },
      en: {
        name: initialValues?.en?.name ?? "",
        description: initialValues?.en?.description ?? "",
      },
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
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      )}

      <fieldset className="flex flex-col gap-4 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">Arabic (ar)</legend>

        <form.Field name="ar.name">
          {(field) => (
            <FormField
              label="Name (Arabic)"
              htmlFor="category-ar-name"
              error={field.state.meta.isTouched ? fieldError(field.state.meta.errors) : undefined}
            >
              <Input
                id="category-ar-name"
                dir="rtl"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
              />
            </FormField>
          )}
        </form.Field>

        <form.Field name="ar.description">
          {(field) => (
            <FormField label="Description (Arabic)" htmlFor="category-ar-description">
              <textarea
                id="category-ar-description"
                dir="rtl"
                rows={3}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="flex w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg resize-none"
              />
            </FormField>
          )}
        </form.Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">English (en)</legend>

        <form.Field name="en.name">
          {(field) => (
            <FormField
              label="Name (English)"
              htmlFor="category-en-name"
              error={field.state.meta.isTouched ? fieldError(field.state.meta.errors) : undefined}
            >
              <Input
                id="category-en-name"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
              />
            </FormField>
          )}
        </form.Field>

        <form.Field name="en.description">
          {(field) => (
            <FormField label="Description (English)" htmlFor="category-en-description">
              <textarea
                id="category-en-description"
                rows={3}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="flex w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg resize-none"
              />
            </FormField>
          )}
        </form.Field>
      </fieldset>

      <form.Field name="coverMediaId">
        {(field) => (
          <FormField
            label="Cover Media ID"
            htmlFor="category-cover-media-id"
            error={field.state.meta.isTouched ? fieldError(field.state.meta.errors) : undefined}
          >
            <Input
              id="category-cover-media-id"
              type="text"
              placeholder="24-character ObjectId (optional)"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
            />
          </FormField>
        )}
      </form.Field>

      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "create" ? "Creating…" : "Saving…"
              : mode === "create" ? "Create category" : "Save changes"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
