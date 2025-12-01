import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

// No auth needed
// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem("token");
//   if (token) config.headers.Authorization = `Bearer ${token}`;
//   return config;
// });

// GLOBAL 401 HANDLER
// api.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     if (error.response && error.response.status === 401) {
//       console.warn("Session expired. Redirecting to login...");
//       localStorage.removeItem("token");
//       window.location.reload(); // Force to login page
//     }
//     return Promise.reject(error);
//   }
// );

export default api;
