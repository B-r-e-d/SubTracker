import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'

export async function loader(_args: LoaderFunctionArgs) {
  return redirect('/', 302)
}

export default function DashboardRedirect(): null {
  return null
}
