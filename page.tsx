"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useReminders } from "@/components/ReminderProvider";
import {
  Sparkles,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  Bell,
  LogOut,
  Trash2,
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  scheduled_time: string | null;
  priority: "high" | "medium" | "low";
  is_completed: boolean;
}

export default function TodayPage() {
  const router = useRouter();
  const supabase = createClient();
  const { enablePushNotifications, pushEnabled } = useReminders();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");
  const [brainDump, setBrainDump] = useState("");
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const todayDate = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("task_date", todayDate)
      .order("scheduled_time", { ascending: true, nullsFirst: false });

    if (!error && data) {
      setTasks(data as Task[]);
    }
    setLoading(false);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        title: newTaskTitle.trim(),
        scheduled_time: newTaskTime || null,
        task_date: todayDate,
        priority: "medium",
      })
      .select()
      .single();

    if (!error && data) {
      setTasks((prev) => [...prev, data as Task]);
      setNewTaskTitle("");
      setNewTaskTime("");
    }
  };

  const handleGeneratePlan = async () => {
    if (!brainDump.trim()) return;
    setGenerating(true);

    try {
      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: brainDump, date: todayDate }),
      });

      const result = await response.json();
      if (result.tasks) {
        await fetchTasks();
        setBrainDump("");
      }
    } catch (err) {
      console.error("Failed to generate plan:", err);
    } finally {
      setGenerating(false);
    }
  };

  const toggleTask = async (task: Task) => {
    const updated = !task.is_completed;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, is_completed: updated } : t))
    );

    await supabase
      .from("tasks")
      .update({ is_completed: updated })
      .eq("id", task.id);
  };

  const deleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const completedCount = tasks.filter((t) => t.is_completed).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">مهام اليوم</h1>
            <p className="text-xs text-slate-500">
              {new Date().toLocaleDateString("ar-EG", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!pushEnabled && (
              <button
                onClick={enablePushNotifications}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition"
              >
                <Bell className="w-4 h-4" />
                <span>تفعيل التنبيهات</span>
              </button>
            )}
            <button
              onClick={handleLogout}
              title="تسجيل الخروج"
              className="p-2 text-slate-500 hover:text-red-600 rounded-xl hover:bg-slate-100 transition"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        {/* Progress Bar Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">نسبة إنجاز اليوم</span>
            <span className="text-sm font-bold text-brand-600">{progress}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            أنجزت {completedCount} من أصل {tasks.length} مهام
          </p>
        </div>

        {/* AI Smart Planner Card */}
        <div className="bg-gradient-to-l from-blue-600 to-indigo-700 p-5 rounded-2xl text-white shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <h2 className="font-bold text-base">المخطط الذكي (AI Planner)</h2>
          </div>
          <p className="text-xs text-blue-100 mb-3">
            اكتب أفكارك ومهامك المبعثرة وسأرتبها لك في جدول زمني ذكي لليوم:
          </p>
          <textarea
            rows={2}
            value={brainDump}
            onChange={(e) => setBrainDump(e.target.value)}
            placeholder="مثال: مراجعة تقرير الإنتاج صباحاً، اجتماع الفريق الساعة 12، متابعة البريد الإلكتروني..."
            className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 mb-3"
          />
          <button
            onClick={handleGeneratePlan}
            disabled={generating || !brainDump.trim()}
            className="px-4 py-2 bg-white text-brand-700 font-bold text-sm rounded-xl hover:bg-blue-50 transition disabled:opacity-50 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{generating ? "جاري بناء خطة اليوم..." : "توليد خطة اليوم بالذكاء الاصطناعي"}</span>
          </button>
        </div>

        {/* Add Single Task Form */}
        <form
          onSubmit={handleAddTask}
          className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="أضف مهمة جديدة..."
            className="flex-1 px-3 py-2 text-sm focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={newTaskTime}
              onChange={(e) => setNewTaskTime(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl flex items-center gap-1 transition"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة</span>
            </button>
          </div>
        </form>

        {/* Task List */}
        <div className="space-y-3">
          {loading ? (
            <p className="text-center text-sm text-slate-400 py-8">جاري تحميل المهام...</p>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
              <p className="text-slate-500 text-sm">لا توجد مهام مجدولة لليوم بعد.</p>
              <p className="text-slate-400 text-xs mt-1">أضف مهمة يدوياً أو استخدم المخطط الذكي بالأعلى!</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`bg-white p-4 rounded-2xl border transition flex items-center justify-between ${
                  task.is_completed
                    ? "border-slate-100 opacity-60"
                    : "border-slate-200/80 shadow-sm"
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleTask(task)}
                    className="text-brand-600 hover:scale-110 transition"
                  >
                    {task.is_completed ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <Circle className="w-6 h-6 text-slate-300" />
                    )}
                  </button>
                  <div>
                    <p
                      className={`font-semibold text-sm ${
                        task.is_completed ? "line-through text-slate-400" : "text-slate-800"
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.scheduled_time && (
                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{task.scheduled_time.slice(0, 5)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => deleteTask(task.id)}
                  className="p-2 text-slate-300 hover:text-red-500 transition"
                  title="حذف المهمة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
