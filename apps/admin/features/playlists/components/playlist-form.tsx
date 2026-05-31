"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { FormField } from "@repo/ui/patterns/form-field";

import { createPlaylistAction } from "../actions/create-playlist.action";
import { updatePlaylistAction } from "../actions/update-playlist.action";
import {
  playlistFormSchema,
  type PlaylistFormValues,
} from "../schemas/playlist-form.schema";

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

interface PlaylistFormProps {
  mode: "create" | "edit";
  defaultValues?: Partial<PlaylistFormValues>;
  playlistId?: string;
  availableCategories: { id: string; name: string }[];
}

export function PlaylistForm({
  mode,
  defaultValues,
  playlistId,
  availableCategories,
}: PlaylistFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      ar: {
        title: defaultValues?.ar?.title ?? "",
        description: defaultValues?.ar?.description ?? "",
      },
      en: {
        title: defaultValues?.en?.title ?? "",
        description: defaultValues?.en?.description ?? "",
      },
      status: defaultValues?.status ?? ("draft" as const),
      categoryIds: defaultValues?.categoryIds ?? [],
    } satisfies PlaylistFormValues,
    validators: { onChange: playlistFormSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const result =
        mode === "create"
          ? await createPlaylistAction(value)
          : await updatePlaylistAction(playlistId!, value);
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      // createPlaylistAction redirects on success; for edit, navigate back.
      if (mode === "edit") router.push("/");
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

      <fieldset className="flex flex-col gap-4 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">Arabic (ar)</legend>

        <form.Field name="ar.title">
          {(field) => (
            <FormField
              label="Title (Arabic)"
              htmlFor="playlist-ar-title"
              error={
                field.state.meta.isTouched
                  ? fieldError(field.state.meta.errors)
                  : undefined
              }
            >
              <Input
                id="playlist-ar-title"
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

        <form.Field name="ar.description">
          {(field) => (
            <FormField
              label="Description (Arabic)"
              htmlFor="playlist-ar-description"
            >
              <textarea
                id="playlist-ar-description"
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

        <form.Field name="en.title">
          {(field) => (
            <FormField
              label="Title (English)"
              htmlFor="playlist-en-title"
              error={
                field.state.meta.isTouched
                  ? fieldError(field.state.meta.errors)
                  : undefined
              }
            >
              <Input
                id="playlist-en-title"
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

        <form.Field name="en.description">
          {(field) => (
            <FormField
              label="Description (English)"
              htmlFor="playlist-en-description"
            >
              <textarea
                id="playlist-en-description"
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

      <form.Field name="status">
        {(field) => (
          <FormField label="Status" htmlFor="playlist-status">
            <select
              id="playlist-status"
              value={field.state.value}
              onChange={(e) =>
                field.handleChange(
                  e.target.value as PlaylistFormValues["status"],
                )
              }
              onBlur={field.handleBlur}
              className="flex h-10 w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </FormField>
        )}
      </form.Field>

      {availableCategories.length > 0 && (
        <form.Field name="categoryIds">
          {(field) => (
            <FormField label="Categories" htmlFor="playlist-categories">
              <div id="playlist-categories" className="flex flex-wrap gap-2">
                {availableCategories.map((cat) => {
                  const checked = field.state.value.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className="flex cursor-pointer items-center gap-1.5 rounded-md border border-input bg-surface px-3 py-1.5 text-sm hover:bg-surface-2"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          field.handleChange(
                            checked
                              ? field.state.value.filter((id) => id !== cat.id)
                              : [...field.state.value, cat.id],
                          );
                        }}
                        className="size-4"
                      />
                      {cat.name}
                    </label>
                  );
                })}
              </div>
            </FormField>
          )}
        </form.Field>
      )}

      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "create"
                ? "Creating…"
                : "Saving…"
              : mode === "create"
                ? "Create playlist"
                : "Save changes"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
