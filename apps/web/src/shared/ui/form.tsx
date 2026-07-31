/**
 * Form primitives.
 *
 * Small on purpose: they exist to keep the label / control / error-message
 * wiring accessible in one place, not to abstract forms away. `react-hook-form`
 * spreads `register()` straight onto the controls, so every one of them is a
 * plain element with a forwarded `ref` — React 19 passes `ref` as an ordinary
 * prop, so no `forwardRef` is involved.
 */
import { AlertCircle } from 'lucide-react'
import type { ComponentPropsWithRef, ReactNode } from 'react'

const CONTROL_CLASS =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 ' +
  'focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 ' +
  'aria-[invalid=true]:border-rose-400 aria-[invalid=true]:focus:ring-rose-500/20'

export function Input({ className = '', ...props }: ComponentPropsWithRef<'input'>) {
  return <input className={`${CONTROL_CLASS} ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }: ComponentPropsWithRef<'textarea'>) {
  return <textarea className={`${CONTROL_CLASS} ${className}`} {...props} />
}

export function Select({ className = '', ...props }: ComponentPropsWithRef<'select'>) {
  return <select className={`${CONTROL_CLASS} ${className}`} {...props} />
}

interface FieldProps {
  /** Must match the control's `id`, which is what ties the label to it. */
  id: string
  label: string
  /** Rendered under the control and announced through `aria-describedby`. */
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
}

/**
 * A labelled control with its validation message.
 *
 * The caller wires `aria-invalid` and `aria-describedby` on the control itself
 * (see `describedBy` below) — those belong on the input, not on this wrapper.
 */
export function Field({ id, label, error, hint, required, children }: FieldProps) {
  return (
    <div>
      {/*
       * The asterisk sits outside the label on purpose: anything inside it
       * becomes part of the field's accessible name, and "Title*" is not what
       * a screen reader should announce — nor what a test should have to match.
       */}
      <div className="mb-1 flex items-baseline gap-0.5">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
        {required && (
          <span aria-hidden className="text-rose-500">
            *
          </span>
        )}
      </div>

      {children}

      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}

      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-rose-600">
          {error}
        </p>
      )}
    </div>
  )
}

/** A form-level failure: something the server refused, not a field problem. */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
    >
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-rose-500" />
      <span>{children}</span>
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'danger'

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-600',
  secondary:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-slate-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-600',
}

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={
        'inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm ' +
        'font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ' +
        `disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASS[variant]} ${className}`
      }
      {...props}
    />
  )
}
