export interface ReminderItem {
  id: string;
  title: string;
  scheduled_time: string;
}

export function isTimeDue(scheduledTime: string, windowMinutes = 1): boolean {
  if (!scheduledTime) return false;

  const now = new Date();
  const [hours, minutes] = scheduledTime.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return false;

  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  const diffMs = target.getTime() - now.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  return diffMinutes >= 0 && diffMinutes <= windowMinutes;
}

export function triggerLocalNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  if (Notification.permission === "granted") {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          dir: "rtl",
          lang: "ar",
        });
      });
    } else {
      new Notification(title, { body });
    }
  }
}
