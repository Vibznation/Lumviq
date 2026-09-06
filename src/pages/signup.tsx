import type { GetServerSideProps } from 'next'

/**
 * Marketing-friendly alias for the existing sign-up page. Preserves any
 * plan/billing/add-on selection made during /checkout by forwarding query
 * params through to /register (and from there, into /onboarding).
 */
export default function SignUp() {
  return null
}

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const search = new URLSearchParams(query as Record<string, string>).toString()
  return {
    redirect: {
      destination: `/register${search ? `?${search}` : ''}`,
      permanent: false,
    },
  }
}
