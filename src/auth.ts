import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isRateLimited, clientIp } from "@/lib/rateLimit";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function loginRateLimited(request: Request | undefined, email: string): boolean {
  const ip = request ? clientIp(request) : "unknown";
  // Duas chaves - por IP (contra credential stuffing por várias contas) e
  // por e-mail (contra tentativa de força bruta numa única conta vinda de
  // IPs variados) - basta uma estourar pra bloquear.
  return isRateLimited(`login:ip:${ip}`, 20, LOGIN_WINDOW_MS) || isRateLimited(`login:email:${email}`, 8, LOGIN_WINDOW_MS);
}

export const SESSION_COOKIE_NAME = "orkestrya.session-token";
export const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias - só com "Manter-me conectado"
export const SESSION_SHORT_MAX_AGE = 60 * 60 * 12; // 12h - padrão sem "Manter-me conectado"

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Validade "de fábrica" do token no login continua REMEMBER_ME_MAX_AGE (o
  // caso mais comum é marcar a caixa) - src/app/api/auth/persist-session
  // reemite o token com SESSION_SHORT_MAX_AGE logo em seguida quando o
  // usuário desmarca, então a validade real do JWT (não só o Max-Age do
  // cookie) encolhe de verdade nesse caso.
  session: { strategy: "jwt", maxAge: REMEMBER_ME_MAX_AGE },
  pages: {
    signIn: "/login",
  },
  cookies: {
    sessionToken: {
      name: SESSION_COOKIE_NAME,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        // AUTH_COOKIE_INSECURE=1 permite login em instâncias servidas por HTTP puro (ex: demo por IP:porta)
        secure: process.env.NODE_ENV === "production" && process.env.AUTH_COOKIE_INSECURE !== "1",
      },
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (credentials, request) => {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }
        if (loginRateLimited(request, email.toLowerCase().trim())) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
        });

        if (!user || !user.active) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          userType: "staff",
        };
      },
    }),
    Credentials({
      id: "client-credentials",
      name: "Portal do Cliente",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (credentials, request) => {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }
        const normalizedEmail = email.toLowerCase().trim();
        if (loginRateLimited(request, normalizedEmail)) {
          return null;
        }

        const client = await prisma.client.findUnique({
          where: { portalEmail: normalizedEmail },
        });

        if (client && client.portalEnabled && client.portalPasswordHash) {
          const isValid = await bcrypt.compare(password, client.portalPasswordHash);
          if (isValid) {
            return {
              id: client.id,
              name: client.name,
              email: client.portalEmail!,
              userType: "client",
              clientId: client.id,
              isClientOwner: true,
            };
          }
        }

        // Não achou (ou senha errada) pelo login principal do cliente - tenta
        // como uma das pessoas adicionais cadastradas pra esse cliente.
        const portalUser = await prisma.clientPortalUser.findUnique({
          where: { email: normalizedEmail },
        });

        if (!portalUser || !portalUser.active) {
          return null;
        }

        const isValid = await bcrypt.compare(password, portalUser.passwordHash);
        if (!isValid) {
          return null;
        }

        await prisma.clientPortalUser.update({
          where: { id: portalUser.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: portalUser.id,
          name: portalUser.name,
          email: portalUser.email,
          userType: "client",
          clientId: portalUser.clientId,
          isClientOwner: false,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        token.id = user.id;
        token.userType = user.userType;
        if (user.userType === "client") {
          token.clientId = user.clientId;
          token.isClientOwner = user.isClientOwner;
        } else {
          token.role = user.role;
        }
      }
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
        if (session.email) token.email = session.email;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.userType = token.userType as "staff" | "client";
        if (token.userType === "client") {
          session.user.clientId = token.clientId as string;
          session.user.isClientOwner = token.isClientOwner as boolean;
        } else {
          session.user.role = token.role as "ADMIN" | "MEMBER";
        }
      }
      return session;
    },
  },
});
