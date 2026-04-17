import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import type { NextAuthConfig } from 'next-auth'
import type { Role } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

/**
 * NextAuth.js v5 configuration.
 *
 * Exported as `authOptions` for explicit re-use in the route handler and
 * any server-side helpers that need the raw config object.
 */
export const authOptions: NextAuthConfig = {
  // -------------------------------------------------------------------------
  // Session strategy
  // -------------------------------------------------------------------------
  session: {
    strategy: 'jwt',
    // 30-day sliding window (seconds)
    maxAge: 30 * 24 * 60 * 60,
  },

  // -------------------------------------------------------------------------
  // Secret – pulled from NEXTAUTH_SECRET (also accepts AUTH_SECRET in v5)
  // -------------------------------------------------------------------------
  secret: process.env.NEXTAUTH_SECRET,

  // -------------------------------------------------------------------------
  // Custom pages
  // -------------------------------------------------------------------------
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },

  // -------------------------------------------------------------------------
  // Providers
  // -------------------------------------------------------------------------
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Email & Password',

      credentials: {
        email: {
          label: 'Email',
          type: 'email',
          placeholder: 'you@example.com',
        },
        password: {
          label: 'Password',
          type: 'password',
        },
      },

      async authorize(credentials) {
        // --- Input guard ---------------------------------------------------
        if (
          !credentials?.email ||
          typeof credentials.email !== 'string' ||
          !credentials?.password ||
          typeof credentials.password !== 'string'
        ) {
          return null
        }

        const email = credentials.email.toLowerCase().trim()
        const password = credentials.password

        // --- Lookup user ---------------------------------------------------
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            role: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                profilePhoto: true,
              },
            },
          },
        })

        if (!user || !user.passwordHash) {
          // No account found, or account uses a different auth method (e.g. OAuth)
          return null
        }

        // --- Password verification -----------------------------------------
        const isValid = await bcrypt.compare(password, user.passwordHash)
        if (!isValid) {
          return null
        }

        // --- Return the shape expected by the JWT callback -----------------
        // `name` and `image` are standard NextAuth User fields.
        const fullName =
          [user.profile?.firstName, user.profile?.lastName]
            .filter(Boolean)
            .join(' ') || null

        return {
          id: user.id,
          email: user.email,
          name: fullName,
          image: user.profile?.profilePhoto ?? null,
          role: user.role,
        }
      },
    }),
  ],

  // -------------------------------------------------------------------------
  // Callbacks
  // -------------------------------------------------------------------------
  callbacks: {
    /**
     * Runs whenever a JWT is created or updated.
     * Persist the user id and role inside the token so they survive
     * across requests without an additional DB round-trip.
     */
    async jwt({ token, user }) {
      if (user) {
        // `user` is only populated on the first sign-in; copy custom fields.
        token.id = user.id as string
        token.role = user.role as Role
      }
      return token
    },

    /**
     * Runs whenever a session is checked (getServerSession / useSession).
     * Expose `id` and `role` on the client-facing session object.
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
      }
      return session
    },
  },
}

// ---------------------------------------------------------------------------
// Initialise NextAuth and export the v5 handlers + auth helper.
// ---------------------------------------------------------------------------
export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)
