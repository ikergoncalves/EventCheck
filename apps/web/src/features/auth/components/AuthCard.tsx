import { QrCode } from 'lucide-react'
import type { ReactNode } from 'react'

/** The centered shell both access screens sit in. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <QrCode aria-hidden className="size-6 text-emerald-600" />
          <span className="text-lg font-semibold text-slate-900">EventCheck</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 mb-5 text-sm text-slate-500">{subtitle}</p>}
          <div className={subtitle ? '' : 'mt-5'}>{children}</div>
        </div>

        {footer && <div className="mt-4 text-center text-sm text-slate-600">{footer}</div>}
      </div>
    </div>
  )
}
