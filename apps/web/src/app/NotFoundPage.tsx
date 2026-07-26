import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section className="py-16 text-center">
      <p className="text-sm font-medium text-slate-500">404</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-1 text-sm text-slate-500">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/events"
        className="mt-6 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Go to events
      </Link>
    </section>
  )
}
