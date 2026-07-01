import axios from 'axios'

// Use environment variable for baseURL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          // Use the same baseURL logic for refresh
          const { data } = await axios.post(`${import.meta.env.VITE_API_URL}/auth/token/refresh/`, { refresh })
          localStorage.setItem('access_token', data.access)
          // Save the rotated refresh token so the next refresh doesn't fail
          if (data.refresh) localStorage.setItem('refresh_token', data.refresh)
          err.config.headers.Authorization = `Bearer ${data.access}`
          return api.request(err.config)
        } catch {
          // Improvement 7: Targeted removal instead of clear()
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/'
        }
      }
    }
    return Promise.reject(err)
  }
)

export default api
