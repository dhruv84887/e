import axios from 'axios'

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', withCredentials: true, headers: { 'Content-Type': 'application/json' } })
api.interceptors.response.use((response) => response, (error) => {
  const message = error.response?.data?.message || (error.code === 'ERR_NETWORK' ? 'Unable to reach the store right now.' : 'Something went wrong.')
  return Promise.reject(Object.assign(error, { userMessage: message }))
})
export function messageOf(error: unknown) { return (error as { userMessage?: string })?.userMessage || 'Something went wrong. Please try again.' }
