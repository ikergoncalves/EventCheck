/**
 * A confirmation the organizer has to read.
 *
 * Deliberately not `window.confirm`: it cannot say what the consequence is in
 * more than one unstyled line, it cannot show the failure that follows if the
 * server refuses, it blocks the whole thread, and it is unstyleable and
 * untestable. Cancelling an event revokes every valid ticket for it — that
 * deserves a sentence, not a shrug.
 */
import { AlertTriangle, LoaderCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button, FormAlert } from './form'

interface ConfirmDialogProps {
  open: boolean
  title: string
  /** Spell out what happens. This is the whole reason the dialog exists. */
  description: string
  confirmLabel: string
  pendingLabel: string
  cancelLabel?: string
  isPending?: boolean
  /** A failed attempt, shown in place rather than dismissing the dialog. */
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = 'Keep it',
  isPending = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  // Move focus into the dialog when it opens, and let Escape dismiss it.
  useEffect(() => {
    if (!open) return

    confirmRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !isPending) onCancel()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, isPending, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <h2 id="confirm-dialog-title" className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            <p id="confirm-dialog-description" className="mt-1 text-sm text-slate-600">
              {description}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4">
            <FormAlert>{error}</FormAlert>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant="danger"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
