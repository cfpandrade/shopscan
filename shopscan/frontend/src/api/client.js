import axios from 'axios'

// Use relative path so it works under HA Ingress prefix
const api = axios.create({ baseURL: './api', timeout: 30000 })

export default api
