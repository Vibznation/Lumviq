import type { GetServerSideProps } from 'next'

/**
 * Marketing-friendly alias for the existing sign-in page. Keeps auth logic
 * in one place (src/pages/login.tsx) instead of duplicating it here.
 */
export default function SignIn() {
  return null
}

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const search = new URLSearchParams(query as Record<string, string>).toString()
  return {
    redirect: {
      destination: `/login${search ? `?${search}` : ''}`,
      permanent: false,
    },
  }
}
