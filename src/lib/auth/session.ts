import { cookies } from "next/headers";

export const USER_COOKIE = "app_user_id";

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const id = store.get(USER_COOKIE)?.value?.trim();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return id;
}

export async function setSessionUserId(userId: string) {
  const store = await cookies();
  store.set(USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.set(USER_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function hasAppSession(): Promise<boolean> {
  return Boolean(await getSessionUserId());
}
