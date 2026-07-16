import axios from 'axios'
import { getAccessToken, setAccessToken } from './tokenStore'

// Use environment variable for baseURL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // send/receive the httpOnly refresh-token cookie
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Render's free-tier backend spins down after inactivity; the first request
// after a cold start can fail with a reset connection before the server
// finishes booting, even though the request itself was fine. One retry after
// a short delay is enough to ride out that window.
const COLD_START_RETRY_DELAY_MS = 3000

function postWithColdStartRetry<T>(url: string, data: unknown, config: object) {
  return axios.post<T>(url, data, config).catch((err) => {
    if (err.response) throw err // real HTTP error, not a network/cold-start failure
    return new Promise((resolve) => setTimeout(resolve, COLD_START_RETRY_DELAY_MS)).then(() =>
      axios.post<T>(url, data, config)
    )
  })
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      try {
        // Refresh token travels via the httpOnly cookie, not the body.
        const { data } = await postWithColdStartRetry<{ access: string }>(
          `${import.meta.env.VITE_API_URL}/auth/token/refresh/`,
          {},
          { withCredentials: true }
        )
        setAccessToken(data.access)
        err.config.headers.Authorization = `Bearer ${data.access}`
        return api.request(err.config)
      } catch {
        setAccessToken(null)
        window.location.href = '/'
      }
    }

    if (!err.response && !err.config?._retriedAfterColdStart) {
      err.config._retriedAfterColdStart = true
      await new Promise((resolve) => setTimeout(resolve, COLD_START_RETRY_DELAY_MS))
      return api.request(err.config)
    }

    return Promise.reject(err)
  }
)

export default api
