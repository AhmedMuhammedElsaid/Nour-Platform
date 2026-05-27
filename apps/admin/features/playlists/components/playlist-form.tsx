"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { FormField } from "@repo/ui/patterns/form-field";

import { createPlaylistAction } from "../actions/create-playlist.action";

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
import { updatePlaylistAction } from "../actions/update-playlist.action";
import {
  playlistFormSchema,
  type PlaylistFormValues,
} from "../schemas/playlist-form.schema";

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
      locale: defaultValues?.locale ?? ("ar" as const),
      contentId: defaultValues?.contentId ?? "",
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
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
      if (mode === "edit") router.push("/playlists");
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
          <FormField label="Language" htmlFor="playlist-locale">
            {mode === "edit" ? (
              <p
                id="playlist-locale"
                className="text-sm text-muted-foreground"
              >
                {field.state.value === "ar" ? "Arabic (ar)" : "English (en)"}
                <span className="ms-2 text-xs">— language is immutable</span>
              </p>
            ) : (
              <select
                id="playlist-locale"
                value={field.state.value}
                onChange={(e) =>
                  field.handleChange(
                    e.target.value as PlaylistFormValues["locale"],
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

      <form.Field name="title">
        {(field) => (
          <FormField
            label="Title"
            htmlFor="playlist-title"
            error={
              field.state.meta.isTouched
                ? fieldError(field.state.meta.errors)
                : undefined
            }
          >
            <Input
              id="playlist-title"
              type="text"
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

      <form.Field name="description">
        {(field) => (
          <FormField
            label="Description"
            htmlFor="playlist-description"
            error={
              field.state.meta.isTouched
                ? fieldError(field.state.meta.errors)
                : undefined
            }
          >
            <textarea
              id="playlist-description"
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
              className="flex h-10 w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
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
            <FormField
              label="Categories"
              error={
                field.state.meta.isTouched
                  ? fieldError(field.state.meta.errors)
                  : undefined
              }
            >
              <div
                role="group"
                aria-label="Categories"
                className="flex flex-col gap-2"
              >
                {availableCategories.map((cat) => {
                  const checked = field.state.value.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                    >
                      <input
                        type="checkbox"
                        value={cat.id}
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? field.state.value.filter((id) => id !== cat.id)
                            : [...field.state.value, cat.id];
                          field.handleChange(next);
                        }}
                        onBlur={field.handleBlur}
                        className="h-4 w-4 rounded border-input accent-primary"
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
