export type NotificationPreferences = {
  email?: boolean;
  sms?: boolean;
  browser?: boolean;
  lesson_reminders?: boolean;
  new_messages?: boolean;
  promotions?: boolean;
  payment_updates?: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: true,
  sms: false,
  browser: true,
  lesson_reminders: true,
  new_messages: true,
  promotions: false,
  payment_updates: true,
};

export function mergeNotificationPreferences(
  stored: NotificationPreferences | null | undefined,
): NotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(stored ?? {}),
  };
}
