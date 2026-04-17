import type { Role } from '@prisma/client'
import type { DefaultSession } from 'next-auth'

/**
 * Extend the built-in session types so that `session.user` always carries
 * the application-specific `id` and `role` fields.
 *
 * Module augmentation is the recommended NextAuth.js v5 approach:
 * https://authjs.dev/getting-started/typescript#module-augmentation
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
    } & DefaultSession['user']
  }

  interface User {
    id: string
    role: Role
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: Role
  }
}
