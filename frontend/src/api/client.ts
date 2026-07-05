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

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      try {
        // Refresh token travels via the httpOnly cookie, not the body.
        const { data } = await axios.post(
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
    return Promise.reject(err)
  }
)

export default api
