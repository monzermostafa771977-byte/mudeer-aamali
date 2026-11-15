"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { registerServiceWorkerAndSubscribe } from "@/lib/push";
import { isTimeDue, triggerLocalNotification } from "@/lib/reminders";

interface ReminderContextType {
  pushEnabled: boolean;
  enablePushNotifications: () => Promise<void>;
}

const ReminderContext = createContext<ReminderContextType>({
  pushEnabled: false,
  enablePushNotifications: async () => {},
});

export const useReminders = () => useContext(ReminderContext);

export default function ReminderProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushEnabled(Notification.permission === "granted");
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }
  }, []);

  // فحص دوري للمهام المستحقة كل دقيقة
  useEffect(() => {
    const notifiedIds = new Set<string>();

    const checkReminders = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const todayDate = new Date().toISOString().split("T")[0];
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, scheduled_time, is_completed")
        .eq("task_date", todayDate)
        .eq("is_completed", false);

      if (!tasks) return;

      for (const task of tasks) {
        if (
          task.scheduled_time &&
          !notifiedIds.has(task.id) &&
          isTimeDue(task.scheduled_time, 1)
        ) {
          notifiedIds.add(task.id);
          triggerLocalNotification("تذكير من مدير أعمالي ⏰", task.title);
        }
      }
    };

    const interval = setInterval(checkReminders, 30000);
    return () => clearInterval(interval);
  }, [supabase]);

  const enablePushNotifications = async () => {
    const subscription = await registerServiceWorkerAndSubscribe();
    if (subscription) {
      setPushEnabled(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("push_subscriptions").upsert({
          user_id: user.id,
          subscription: subscription.toJSON(),
        });
      }
    }
  };

  return (
    <ReminderContext.Provider value={{ pushEnabled, enablePushNotifications }}>
      {children}
    </ReminderContext.Provider>
  );
}
