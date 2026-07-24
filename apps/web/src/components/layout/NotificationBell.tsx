"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";

type Notification = {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export default function NotificationBell() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data } = await apiClient.get<Notification[]>("/notifications");
      return data || [];
    },
    enabled: Boolean(user),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const unreadCount = useMemo(
    () =>
      notifications.reduce(
        (count, notification) => count + (notification.isRead ? 0 : 1),
        0,
      ),
    [notifications],
  );

  useEffect(() => {
    if (!bellOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [bellOpen]);

  const markRead = async (id: string) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      queryClient.setQueryData<Notification[]>(
        ["notifications", user?.id],
        (current = []) =>
          current.map((notification) =>
            notification.id === id
              ? { ...notification, isRead: true }
              : notification,
          ),
      );
    } catch {
      // silent
    }
  };

  const markAllRead = async () => {
    try {
      await apiClient.post("/notifications/read-all");
      queryClient.setQueryData<Notification[]>(
        ["notifications", user?.id],
        (current = []) =>
          current.map((notification) => ({ ...notification, isRead: true })),
      );
    } catch {
      // silent
    }
  };

  if (!user) return null;

  return (
    <div ref={bellRef} className="notification-bell">
      <button
        type="button"
        onClick={() => setBellOpen((prev) => !prev)}
        className="notification-bell-trigger"
        aria-label={isAr ? "الإشعارات" : "Notifications"}
        aria-expanded={bellOpen}
        aria-haspopup="dialog"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-bell-count">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {bellOpen && (
        <div
          className="notification-popover"
          role="dialog"
          aria-label={isAr ? "الإشعارات" : "Notifications"}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: "var(--border-color)" }}
          >
            <span
              className="font-semibold text-sm"
              style={{ color: "var(--text-main)" }}
            >
              {isAr ? "الإشعارات" : "Notifications"}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs"
                style={{ color: "#D4A353" }}
              >
                {isAr ? "تحديد الكل كمقروء" : "Mark all read"}
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div
              className="px-4 py-8 text-center text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              {isAr ? "لا توجد إشعارات" : "No notifications"}
            </div>
          ) : (
            <div>
              {notifications.slice(0, 10).map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => {
                    if (!notification.isRead) markRead(notification.id);
                  }}
                  className="px-4 py-3 border-b cursor-pointer transition-colors hover:bg-[rgba(212,163,83,0.05)]"
                  style={{
                    borderColor: "var(--border-color)",
                    background: notification.isRead
                      ? "transparent"
                      : "rgba(212, 163, 83, 0.08)",
                    borderRight: notification.isRead
                      ? "none"
                      : "3px solid #D4A353",
                  }}
                >
                  <p className="text-sm" style={{ color: "var(--text-main)" }}>
                    {notification.message}
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {new Date(notification.createdAt).toLocaleString(
                      isAr ? "ar-EG" : "en-US",
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
