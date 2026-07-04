// Access token lives in memory only — never persisted to localStorage — so it
// can't be lifted by an XSS payload. The refresh token lives in an httpOnly
// cookie the browser manages; JS never sees it.
let accessToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}
