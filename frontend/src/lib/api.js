import axios from 'axios';

const RAW_API_URL = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net/api';
const API_URL = RAW_API_URL.endsWith('/') ? RAW_API_URL.slice(0, -1) : RAW_API_URL;

const RAW_FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL || '';
const FUNCTIONS_URL = RAW_FUNCTIONS_URL.endsWith('/') ? RAW_FUNCTIONS_URL.slice(0, -1) : RAW_FUNCTIONS_URL;

export const baseUrl = API_URL;
export const functionsUrl = FUNCTIONS_URL;

const client = axios.create({
  baseURL: API_URL,
  timeout: 120000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const http = {
  get: (url, config = {}) => client.get(url, config),
  post: (url, data, config = {}) => client.post(url, data, config),
  patch: (url, data, config = {}) => client.patch(url, data, config),
  delete: (url, config = {}) => client.delete(url, config),
};

export const withBase = (path = '') => {
  if (!path) return API_URL;
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

export const chooseBase = () => (FUNCTIONS_URL ? FUNCTIONS_URL : API_URL);
