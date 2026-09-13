import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";
import { prisma } from "./prisma";
import { grantFreeCreditsIfNeeded } from "./credits";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: { prompt: "consent", access_type: "offline", response_type: "code" },
      },
    }),
  ],
  session: {
    strategy: "database",
  },
  callbacks: {
    async session({ session, user }) {
      // Idempotent by construction (see lib/credits.ts) — safe to call on
      // every session read rather than relying solely on a one-time
      // "user created" lifecycle hook, which covers the case where that
      // hook doesn't fire the way a given adapter version expects it to.
      await grantFreeCreditsIfNeeded(user.id);

      if (session.user) {
        (session.user as any).id = user.id;
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        if (dbUser) {
          (session.user as any).creditsRemaining = dbUser.creditsRemaining;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};
