import axios from "axios";
import Cookies from "js-cookie";
import { getApiBaseUrl } from "./api-url";

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = Cookies.get("mrh_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== "undefined") {
        Cookies.remove("mrh_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);
