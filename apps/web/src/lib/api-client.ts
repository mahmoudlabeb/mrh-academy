import axios from "axios";
import Cookies from "js-cookie";
import { getApiBaseUrl } from "./api-url";

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

apiClient.interceptors.request.use(
  (config) => {
    config.headers["X-MRH-Client"] = "mrh-web";
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
  async (error) => {
    // Translate error message if available
    if (error.response?.data?.message) {
      const { translateError } = await import('./i18n');
      const lang = (typeof window !== 'undefined' ? localStorage.getItem('lang_pref') : 'ar') || 'ar';
      
      let msg = error.response.data.message;
      if (Array.isArray(msg)) {
        msg = msg.map(m => translateError(m, lang as any)).join(', ');
      } else {
        msg = translateError(msg, lang as any);
      }
      error.response.data.message = msg;
    }

    const originalRequest = error.config;
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      typeof window !== "undefined"
    ) {
      const refreshToken = Cookies.get("mrh_refresh");
      if (!refreshToken) {
        Cookies.remove("mrh_token");
        window.location.href = "/login";
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${getApiBaseUrl()}/auth/refresh`,
          { refreshToken },
          { headers: { "X-MRH-Client": "mrh-web" } },
        );
        Cookies.set("mrh_token", data.accessToken, {
          secure: true,
          sameSite: "strict",
        });
        if (data.refreshToken) {
          Cookies.set("mrh_refresh", data.refreshToken, {
            secure: true,
            sameSite: "strict",
          });
        }
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        Cookies.remove("mrh_token");
        Cookies.remove("mrh_refresh");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);
