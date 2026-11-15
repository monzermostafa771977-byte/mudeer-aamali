import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const todayDate = now.toISOString().split("T")[0];
    const currentHourMin = now.toTimeString().slice(0, 5);

    // جلب المهام غير المكتملة التي حان وقتها ولم يُرسل لها تذكير بعد
    const { data: dueTasks, error } = await supabase
      .from("tasks")
      .select("id, user_id, title, scheduled_time")
      .eq("task_date", todayDate)
      .eq("is_completed", false)
      .eq("reminder_sent", false)
      .lte("scheduled_time", `${currentHourMin}:59`);

    if (error) throw error;

    const results = [];

    for (const task of dueTasks || []) {
      const { data: subData } = await supabase
        .from("push_subscriptions")
        .select("subscription")
        .eq("user_id", task.user_id)
        .single();

      if (subData?.subscription) {
        // تحديث حالة المهمة لمنع تكرار الإرسال
        await supabase
          .from("tasks")
          .update({ reminder_sent: true })
          .eq("id", task.id);

        results.push({ taskId: task.id, status: "marked_for_push" });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, details: results }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
