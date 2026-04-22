import axios from 'axios';

const API_URL = (import.meta as any).env?.VITE_API_URL || '';

const client = axios.create({
  baseURL: `${API_URL}/api`,
});

// VULN: JWT read from localStorage — accessible to any XSS payload
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // VULN: always sends x-admin-key for admin requests
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (user?.role === 'admin') {
    config.headers['x-admin-key'] = 'admin';
  }
  return config;
});

export default client;
