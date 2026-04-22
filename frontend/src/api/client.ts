import axios from 'axios';

const API_URL = (import.meta as any).env?.VITE_API_URL || '';

const client = axios.create({
  baseURL: `${API_URL}/api`,
});

// VULN: JWT read from localStorage — accessible to any XSS payload
client.interceptors.request.use((config) => {
  // Admin routes use a separate admin token stored in localStorage
  const isAdminRoute = config.url?.startsWith('/admin/') && !config.url?.endsWith('/login');
  const adminToken = localStorage.getItem('admin-jwt');
  const userToken  = localStorage.getItem('jwt');

  if (isAdminRoute && adminToken) {
    config.headers.Authorization = `Bearer ${adminToken}`;
  } else if (userToken) {
    config.headers.Authorization = `Bearer ${userToken}`;
  }
  return config;
});

export default client;
