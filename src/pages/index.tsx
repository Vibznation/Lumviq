import React, { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { brand } from '../lib/brand'
import { useAuth } from '../lib/auth-context'

export default function Home() {
  const router = useRouter()
  const { token, loading } = useAuth()

  useEffect(() => {
    if (!loading && token) {
      router.replace('/dashboard')
    }
  }, [loading, token, router])

  return (
    <div className="min-h-screen bg-white dark:bg-midnight-950 flex flex-col">
      <header className="border-b border-gray-200 dark:border-midnight-800 px-6 py-4 flex items-center justify-between">
        <span className="text-lg font-semibold text-midnight-800 dark:text-white">{brand.name}</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-gray-700 dark:text-gray-300 hover:underline">
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-teal-600 text-white px-3 py-1.5 font-medium hover:bg-teal-700"
          >
            Sign up
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl md:text-5xl font-semibold text-midnight-900 dark:text-white max-w-2xl">
          {brand.tagline}
        </h1>
        <p className="mt-4 max-w-xl text-gray-600 dark:text-gray-400">
          {brand.name} is an AI-native accounting platform for freelancers, small businesses and growing
          organizations &mdash; powerful double-entry accounting underneath, simple guided workflows on the surface.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/register"
            className="rounded-md bg-teal-600 text-white px-5 py-2.5 font-medium hover:bg-teal-700"
          >
            Create your organization
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-gray-300 dark:border-midnight-700 px-5 py-2.5 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-midnight-800"
          >
            Sign in
          </Link>
        </div>
      </main>

      <footer className="px-6 py-4 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} {brand.name}. All figures shown for demo organizations are fictional.
      </footer>
    </div>
  )
}
