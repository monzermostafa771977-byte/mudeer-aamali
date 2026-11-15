import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { goals, date } = await request.json();
    if (!goals) {
      return NextResponse.json({ error: "Goals text is required" }, { status: 400 });
    }

    // استدعاء دالة Supabase Edge Function لتوليد الخطة بالذكاء الاصطناعي
    const { data: fnData, error: fnError } = await supabase.functions.invoke(
      "generate-plan",
      {
        body: { goals, date },
      }
    );

    if (fnError) {
      throw fnError;
    }

    const generatedTasks = fnData?.tasks || [];

    if (generatedTasks.length > 0) {
      const rowsToInsert = generatedTasks.map((t: any) => ({
        user_id: user.id,
        title: t.title,
        scheduled_time: t.scheduled_time || null,
        priority: t.priority || "medium",
        task_date: date,
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("tasks")
        .insert(rowsToInsert)
        .select();

      if (insertError) throw insertError;

      return NextResponse.json({ tasks: inserted });
    }

    return NextResponse.json({ tasks: [] });
  } catch (error: any) {
    console.error("Error in /api/generate-plan:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
