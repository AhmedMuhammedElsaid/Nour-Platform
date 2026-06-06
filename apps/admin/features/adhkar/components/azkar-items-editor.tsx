"use client";

import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { FormField } from "@repo/ui/patterns/form-field";

import { createEmptyDhikrItem } from "../schemas/azkar-form.schema";

const textareaClass =
  "flex w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg resize-none";

interface AzkarItemsEditorProps {
  // The TanStack Form instance from azkar-form.tsx. The form's generic
  // parameters are wide and impractical to name at this boundary, so the
  // render-prop field args below are typed `any` (the one acceptable `any`
  // in this repo — the library's render-prop generics are hard to name).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
}

export function AzkarItemsEditor({ form }: AzkarItemsEditorProps) {
  return (
    <form.Field name="items" mode="array">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(itemsField: any) => (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium">Dhikr items</p>

          {(itemsField.state.value as Array<{ id: string }>).map(
            (row, index: number) => (
              <fieldset
                key={row.id}
                data-testid="dhikr-row"
                className="flex flex-col gap-4 rounded-md border border-border p-4"
              >
                <legend className="px-1 text-sm font-medium">
                  Dhikr #{index + 1}
                </legend>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => itemsField.moveValue(index, index - 1)}
                  >
                    Move up
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label="Move down"
                    disabled={index === itemsField.state.value.length - 1}
                    onClick={() => itemsField.moveValue(index, index + 1)}
                  >
                    Move down
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    aria-label="Remove dhikr"
                    onClick={() => itemsField.removeValue(index)}
                  >
                    Remove dhikr
                  </Button>
                </div>

                <form.Field name={`items[${index}].ar`}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(field: any) => (
                    <FormField
                      label="Arabic text"
                      htmlFor={`dhikr-${index}-ar`}
                    >
                      <textarea
                        id={`dhikr-${index}-ar`}
                        dir="rtl"
                        rows={3}
                        required
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        aria-invalid={
                          field.state.meta.isTouched &&
                          field.state.meta.errors.length > 0
                        }
                        className={textareaClass}
                      />
                    </FormField>
                  )}
                </form.Field>

                <form.Field name={`items[${index}].en`}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(field: any) => (
                    <FormField
                      label="English text"
                      htmlFor={`dhikr-${index}-en`}
                    >
                      <textarea
                        id={`dhikr-${index}-en`}
                        rows={3}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        className={textareaClass}
                      />
                    </FormField>
                  )}
                </form.Field>

                <form.Field name={`items[${index}].transliteration`}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(field: any) => (
                    <FormField
                      label="Transliteration"
                      htmlFor={`dhikr-${index}-translit`}
                    >
                      <Input
                        id={`dhikr-${index}-translit`}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    </FormField>
                  )}
                </form.Field>

                <form.Field name={`items[${index}].repeat`}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(field: any) => (
                    <FormField
                      label="Repeat count"
                      htmlFor={`dhikr-${index}-repeat`}
                    >
                      <Input
                        id={`dhikr-${index}-repeat`}
                        type="number"
                        min={1}
                        value={field.state.value}
                        onChange={(e) =>
                          field.handleChange(e.target.valueAsNumber)
                        }
                        onBlur={field.handleBlur}
                      />
                    </FormField>
                  )}
                </form.Field>

                <div className="flex flex-col gap-4 sm:flex-row">
                  <form.Field name={`items[${index}].virtue.ar`}>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(field: any) => (
                      <FormField
                        label="Virtue (Arabic)"
                        htmlFor={`dhikr-${index}-virtue-ar`}
                        className="flex-1"
                      >
                        <Input
                          id={`dhikr-${index}-virtue-ar`}
                          dir="rtl"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                      </FormField>
                    )}
                  </form.Field>

                  <form.Field name={`items[${index}].virtue.en`}>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(field: any) => (
                      <FormField
                        label="Virtue (English)"
                        htmlFor={`dhikr-${index}-virtue-en`}
                        className="flex-1"
                      >
                        <Input
                          id={`dhikr-${index}-virtue-en`}
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                      </FormField>
                    )}
                  </form.Field>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                  <form.Field name={`items[${index}].source.ar`}>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(field: any) => (
                      <FormField
                        label="Source (Arabic)"
                        htmlFor={`dhikr-${index}-source-ar`}
                        className="flex-1"
                      >
                        <Input
                          id={`dhikr-${index}-source-ar`}
                          dir="rtl"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                      </FormField>
                    )}
                  </form.Field>

                  <form.Field name={`items[${index}].source.en`}>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(field: any) => (
                      <FormField
                        label="Source (English)"
                        htmlFor={`dhikr-${index}-source-en`}
                        className="flex-1"
                      >
                        <Input
                          id={`dhikr-${index}-source-en`}
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                      </FormField>
                    )}
                  </form.Field>
                </div>

                {/* CONCERN: audio is a plain text input bound to audioMediaId.
                    Full R2 upload UI (use-track-upload) is deferred to a
                    follow-up to keep this task focused. */}
                <form.Field name={`items[${index}].audioMediaId`}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(field: any) => (
                    <FormField
                      label="Audio media ID (optional)"
                      htmlFor={`dhikr-${index}-audio`}
                    >
                      <Input
                        id={`dhikr-${index}-audio`}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    </FormField>
                  )}
                </form.Field>
              </fieldset>
            ),
          )}

          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => itemsField.pushValue(createEmptyDhikrItem())}
            >
              Add dhikr
            </Button>
          </div>
        </div>
      )}
    </form.Field>
  );
}
