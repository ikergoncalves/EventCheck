/**
 * The event form, shared by creation and editing.
 *
 * It owns submission rather than just collecting values, because the two
 * interesting failure modes both need `setError`: the contract's `422` carries
 * per-field detail, and that detail is worth nothing rendered as a banner at
 * the top of the page. `error.details.fields` therefore lands on the field it
 * names, and only what cannot be placed becomes a form-level alert.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { describeError } from '../../../shared/api/describe-error'
import { readFieldErrors } from '../../../shared/api/field-errors'
import type { EventCreate } from '../../../shared/api/types'
import { listTimeZones } from '../../../shared/lib/datetime'
import { describedBy } from '../../../shared/ui/field-a11y'
import { Button, Field, FormAlert, Input, Select, Textarea } from '../../../shared/ui/form'
import {
  CAPACITY_MAX,
  CAPACITY_MIN,
  FORM_FIELD_BY_API_FIELD,
  type EventFormValues,
  eventFormSchema,
  toEventPayload,
} from '../event-schema'

interface EventFormProps {
  defaultValues: EventFormValues
  submitLabel: string
  pendingLabel: string
  /** Where the cancel link goes back to. */
  cancelTo: string
  /** Performs the mutation. Rejects with an `ApiError` the form then places. */
  onSubmit: (payload: EventCreate) => Promise<void>
}

export function EventForm({
  defaultValues,
  submitLabel,
  pendingLabel,
  cancelTo,
  onSubmit,
}: EventFormProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const timeZones = useMemo(() => listTimeZones(), [])

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues,
  })

  const submit = handleSubmit(async (values) => {
    setFormError(null)

    try {
      await onSubmit(toEventPayload(values))
    } catch (error) {
      const fieldErrors = readFieldErrors(error)
      const unplaced: string[] = []

      for (const { field, message } of fieldErrors) {
        const formField = FORM_FIELD_BY_API_FIELD[field]
        if (formField) {
          setError(formField, { type: 'server', message })
        } else {
          // A field the contract grew and this form does not render yet.
          unplaced.push(`${field}: ${message}`)
        }
      }

      // Anything that was not a placeable 422 still has to be said out loud.
      if (fieldErrors.length === 0) {
        setFormError(describeError(error))
      } else if (unplaced.length > 0) {
        setFormError(unplaced.join(' — '))
      }
    }
  })

  const hint = {
    times: 'Entered in the event’s time zone and stored in UTC.',
    capacity: `Between ${CAPACITY_MIN} and ${CAPACITY_MAX.toLocaleString('en-US')}.`,
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="max-w-2xl space-y-5">
      {formError && <FormAlert>{formError}</FormAlert>}

      <Field id="title" label="Title" error={errors.title?.message} required>
        <Input
          id="title"
          autoComplete="off"
          placeholder="React Summit Brasil 2026"
          aria-invalid={errors.title !== undefined}
          aria-describedby={describedBy('title', { error: errors.title?.message })}
          {...register('title')}
        />
      </Field>

      <Field id="description" label="Description" error={errors.description?.message}>
        <Textarea
          id="description"
          rows={3}
          placeholder="What the event is about."
          aria-invalid={errors.description !== undefined}
          aria-describedby={describedBy('description', { error: errors.description?.message })}
          {...register('description')}
        />
      </Field>

      <Field
        id="timezone"
        label="Time zone"
        error={errors.timezone?.message}
        hint="The zone the times below are read in."
        required
      >
        <Select
          id="timezone"
          aria-invalid={errors.timezone !== undefined}
          aria-describedby={describedBy('timezone', {
            error: errors.timezone?.message,
            hint: 'The zone the times below are read in.',
          })}
          {...register('timezone')}
        >
          {timeZones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="startsAtLocal"
          label="Starts at"
          error={errors.startsAtLocal?.message}
          hint={hint.times}
          required
        >
          <Input
            id="startsAtLocal"
            type="datetime-local"
            aria-invalid={errors.startsAtLocal !== undefined}
            aria-describedby={describedBy('startsAtLocal', {
              error: errors.startsAtLocal?.message,
              hint: hint.times,
            })}
            {...register('startsAtLocal')}
          />
        </Field>

        <Field
          id="endsAtLocal"
          label="Ends at"
          error={errors.endsAtLocal?.message}
          hint={hint.times}
          required
        >
          <Input
            id="endsAtLocal"
            type="datetime-local"
            aria-invalid={errors.endsAtLocal !== undefined}
            aria-describedby={describedBy('endsAtLocal', {
              error: errors.endsAtLocal?.message,
              hint: hint.times,
            })}
            {...register('endsAtLocal')}
          />
        </Field>
      </div>

      <Field
        id="capacity"
        label="Capacity"
        error={errors.capacity?.message}
        hint={hint.capacity}
        required
      >
        <Input
          id="capacity"
          type="number"
          inputMode="numeric"
          min={CAPACITY_MIN}
          max={CAPACITY_MAX}
          step={1}
          aria-invalid={errors.capacity !== undefined}
          aria-describedby={describedBy('capacity', {
            error: errors.capacity?.message,
            hint: hint.capacity,
          })}
          {...register('capacity', { valueAsNumber: true })}
        />
      </Field>

      <Field id="venueName" label="Venue" error={errors.venueName?.message}>
        <Input
          id="venueName"
          autoComplete="off"
          placeholder="Centro de Convenções Rebouças"
          aria-invalid={errors.venueName !== undefined}
          aria-describedby={describedBy('venueName', { error: errors.venueName?.message })}
          {...register('venueName')}
        />
      </Field>

      <Field id="address" label="Address" error={errors.address?.message}>
        <Input
          id="address"
          autoComplete="off"
          placeholder="Av. Rebouças, 600 — Pinheiros, São Paulo"
          aria-invalid={errors.address !== undefined}
          aria-describedby={describedBy('address', { error: errors.address?.message })}
          {...register('address')}
        />
      </Field>

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {isSubmitting ? pendingLabel : submitLabel}
        </Button>

        <Link to={cancelTo} className="text-sm font-medium text-slate-600 hover:text-slate-900">
          Cancel
        </Link>
      </div>
    </form>
  )
}
