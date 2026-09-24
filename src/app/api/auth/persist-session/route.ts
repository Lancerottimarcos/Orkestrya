import { cookies } from "next/headers";
import { decode, encode } from "@auth/core/jwt";
import { auth, SESSION_COOKIE_NAME, REMEMBER_ME_MAX_AGE, SESSION_SHORT_MAX_AGE } from "@/auth";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Sem sessão ativa" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const remember = body?.remember === true;

  const store = await cookies();
  const current = store.get(SESSION_COOKIE_NAME);
  if (!current) {
    return Response.json({ error: "Cookie de sessão não encontrado" }, { status: 400 });
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return Response.json({ error: "Configuração de autenticação ausente" }, { status: 500 });
  }

  // O token nasce sempre com validade de REMEMBER_ME_MAX_AGE no login -
  // desmarcar "Manter-me conectado" não pode só mudar o Max-Age do COOKIE
  // (isso só afeta quando o navegador descarta o cookie, não a validade do
  // token em si, que continuaria utilizável por 30 dias se copiado/roubado
  // fora do navegador). Reemite o token aqui com validade real curta quando
  // remember=false, decodificando e recriptografando com o mesmo segredo e
  // salt (nome do cookie) que o NextAuth já usa internamente.
  const maxAge = remember ? REMEMBER_ME_MAX_AGE : SESSION_SHORT_MAX_AGE;
  const payload = await decode({ token: current.value, secret, salt: SESSION_COOKIE_NAME });
  if (!payload) {
    return Response.json({ error: "Sessão inválida" }, { status: 400 });
  }
  const reissued = await encode({ token: payload, secret, salt: SESSION_COOKIE_NAME, maxAge });

  store.set(SESSION_COOKIE_NAME, reissued, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    // Cookie em si só ganha Max-Age persistente quando "lembrado" - sem
    // marcar, o cookie morre ao fechar o navegador (além do token em si já
    // expirar sozinho em SESSION_SHORT_MAX_AGE de qualquer forma).
    ...(remember ? { maxAge } : {}),
  });

  return Response.json({ ok: true });
}
