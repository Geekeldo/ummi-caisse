import { redirect } from 'next/navigation'

// The middleware already handles auth redirects for "/".
// This component only runs if somehow the middleware didn't redirect
// (e.g. during static generation). Fallback to /login.
export default function Home() {
  redirect('/login')
}
