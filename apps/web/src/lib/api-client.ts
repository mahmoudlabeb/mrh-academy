import axios, { type InternalAxiosRequestConfig } from "axios";
import { getApiBaseUrl } from "./api-url";

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
});

let csrfPromise: Promise<void> | null = null;
let refreshPromise: Promise<void> | null = null;

function readCookie(name: string) {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  return document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length);
}

async function ensureCsrf() {
  if (readCookie("mrh_csrf")) return;
  csrfPromise ??= axios
    .get(`${getApiBaseUrl()}/auth/csrf`, { withCredentials: true })
    .then(() => undefined)
    .finally(() => {
      csrfPromise = null;
    });
  await csrfPromise;
}

function isStateChanging(config: InternalAxiosRequestConfig) {
  return !["get", "head", "options"].includes(
    (config.method ?? "get").toLowerCase(),
  );
}

apiClient.interceptors.request.use(async (config) => {
  if (isStateChanging(config)) {
    await ensureCsrf();
    const token = readCookie("mrh_csrf");
    if (token) config.headers.set("X-CSRF-Token", token);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & {
          _retry?: boolean;
        })
      | undefined;
    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.url?.includes("/auth/refresh") ||
      typeof window === "undefined"
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    refreshPromise ??= apiClient
      .post("/auth/refresh")
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
    try {
      await refreshPromise;
      return apiClient(originalRequest);
    } catch (refreshError) {
      window.location.assign("/login");
      return Promise.reject(refreshError);
    }
  },
);
