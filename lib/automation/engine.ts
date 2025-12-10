import { getSupabaseServerClient } from "@/lib/supabase-server";

type EventPayload = {
  type: string; // "card.moved" | "card.created" | ...
  board_id: string;
  card_id: string;
  from_list_id?: string | null;
  to_list_id?: string;
  list_id?: string;
};

type Automation = {
  id: string;
  board_id: string;
  enabled: boolean;
  trigger_type: "event" | "schedule" | "due";
  trigger_config: any;
  actions: any[];
};

export async function dispatchAutomationForEvent(payload: EventPayload) {
  const supabase = getSupabaseServerClient();
  // busca regras do board habilitadas do tipo 'event'
  const { data: autos } = await supabase
    .from("automations")
    .select("*")
    .eq("board_id", payload.board_id)
    .eq("enabled", true)
    .eq("trigger_type", "event");
  const candidates = (autos ?? []).filter((a: any) =>
    matchEvent(a.trigger_config, payload)
  ) as Automation[];
  for (const a of candidates) {
    try {
      await runActions(supabase, a, payload);
      await supabase
        .from("automation_runs")
        .insert({ automation_id: a.id, status: "ok", payload });
    } catch (e: any) {
      await supabase
        .from("automation_runs")
        .insert({
          automation_id: a.id,
          status: "error",
          payload,
          error_text: String(e?.message ?? e),
        });
    }
  }
}

function matchEvent(config: any, payload: EventPayload) {
  if (!config || config.event !== payload.type) return false;
  // suportes comuns
  if (payload.type === "card.moved") {
    if (config.to_list_id && config.to_list_id !== payload.to_list_id)
      return false;
    if (
      config.from_list_id != null &&
      config.from_list_id !== payload.from_list_id
    )
      return false;
  }
  if (payload.type === "card.created") {
    if (config.in_list_id && config.in_list_id !== payload.list_id) return false;
  }
  return true;
}

async function runActions(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  a: Automation,
  payload: EventPayload
) {
  for (const action of a.actions ?? []) {
    const type = action?.type as string;
    if (!type) continue;
    if (type === "add_label") {
      const labelId = action.label_id as string;
      if (!labelId) continue;
      await supabase
        .from("card_labels")
        .insert({ card_id: payload.card_id, label_id: labelId })
        .throwOnError();
    } else if (type === "move_to_list") {
      const listId = action.list_id as string;
      if (!listId) continue;
      // posição no final
      const { data: last } = await supabase
        .from("cards")
        .select("position")
        .eq("list_id", listId)
        .order("position", { ascending: false })
        .limit(1);
      const newPos =
        last && (last as any[]).length ? ((last as any)[0].position ?? 0) + 100 : 100;
      await supabase
        .from("cards")
        .update({ list_id: listId, position: newPos })
        .eq("id", payload.card_id)
        .throwOnError();
    } else if (type === "set_due_in_days") {
      const days = Number(action.days ?? 0);
      const due = new Date(Date.now() + days * 86400000).toISOString();
      await supabase
        .from("cards")
        .update({ due_date: due })
        .eq("id", payload.card_id)
        .throwOnError();
    } else if (type === "shift_due_by_days") {
      const days = Number(action.days ?? 0);
      const { data: c } = await supabase
        .from("cards")
        .select("due_date")
        .eq("id", payload.card_id)
        .single();
      if (!c?.due_date) continue;
      const due = new Date(c.due_date);
      due.setDate(due.getDate() + days);
      await supabase
        .from("cards")
        .update({ due_date: due.toISOString() })
        .eq("id", payload.card_id)
        .throwOnError();
    } else if (type === "set_start_date") {
      const iso =
        typeof action.value === "string" && action.value
          ? new Date(action.value).toISOString()
          : new Date().toISOString();
      await supabase
        .from("cards")
        .update({ start_date: iso })
        .eq("id", payload.card_id)
        .throwOnError();
    } else if (type === "assign_member") {
      const userId = action.user_id as string;
      if (!userId) continue;
      await supabase
        .from("card_members")
        .insert({ card_id: payload.card_id, user_id: userId })
        .throwOnError();
    } else if (type === "remove_member") {
      const userId = action.user_id as string;
      if (!userId) continue;
      await supabase
        .from("card_members")
        .delete()
        .match({ card_id: payload.card_id, user_id: userId })
        .throwOnError();
    } else if (type === "create_checklist") {
      const title = String(action.title ?? "Checklist");
      const { data: cl } = await supabase
        .from("checklists")
        .insert({ card_id: payload.card_id, title })
        .select("*")
        .single();
      if (action.items && Array.isArray(action.items) && cl?.id) {
        let pos = 100;
        for (const it of action.items) {
          await supabase
            .from("checklist_items")
            .insert({
              checklist_id: cl.id,
              title: String(it ?? ""),
              position: pos,
              done: false,
            })
            .throwOnError();
          pos += 100;
        }
      }
    } else if (type === "add_checklist_item") {
      const checklistId = action.checklist_id as string;
      const title = String(action.title ?? "");
      if (!checklistId || !title) continue;
      const { data: last } = await supabase
        .from("checklist_items")
        .select("position")
        .eq("checklist_id", checklistId)
        .order("position", { ascending: false })
        .limit(1);
      const newPos =
        last && (last as any[]).length ? ((last as any)[0].position ?? 0) + 100 : 100;
      await supabase
        .from("checklist_items")
        .insert({ checklist_id: checklistId, title, position: newPos, done: false })
        .throwOnError();
    } else if (type === "complete_checklist_item") {
      const itemId = action.item_id as string;
      if (!itemId) continue;
      await supabase
        .from("checklist_items")
        .update({ done: true })
        .eq("id", itemId)
        .throwOnError();
    } else if (type === "move_to_top" || type === "move_to_bottom") {
      const { data: c } = await supabase
        .from("cards")
        .select("list_id")
        .eq("id", payload.card_id)
        .single();
      if (!c?.list_id) continue;
      if (type === "move_to_top") {
        const { data: first } = await supabase
          .from("cards")
          .select("position")
          .eq("list_id", c.list_id)
          .order("position", { ascending: true })
          .limit(1);
        const newPos =
          first && (first as any[]).length ? ((first as any)[0].position ?? 100) - 50 : 100;
        await supabase
          .from("cards")
          .update({ position: newPos })
          .eq("id", payload.card_id)
          .throwOnError();
      } else {
        const { data: last } = await supabase
          .from("cards")
          .select("position")
          .eq("list_id", c.list_id)
          .order("position", { ascending: false })
          .limit(1);
        const newPos =
          last && (last as any[]).length ? ((last as any)[0].position ?? 0) + 100 : 100;
        await supabase
          .from("cards")
          .update({ position: newPos })
          .eq("id", payload.card_id)
          .throwOnError();
      }
    } else if (type === "comment") {
      const text = String(action.text ?? "").trim();
      if (!text) continue;
      await supabase
        .from("card_comments")
        .insert({ card_id: payload.card_id, content: text })
        .throwOnError();
    } else if (type === "archive_now") {
      const now = new Date().toISOString();
      await supabase
        .from("cards")
        .update({ archived_at: now })
        .eq("id", payload.card_id)
        .throwOnError();
    } else if (type === "assign_member") {
      const userId = action.user_id as string;
      if (!userId) continue;
      await supabase
        .from("card_members")
        .insert({ card_id: payload.card_id, user_id: userId })
        .throwOnError();
    } else if (type === "remove_member") {
      const userId = action.user_id as string;
      if (!userId) continue;
      await supabase
        .from("card_members")
        .delete()
        .match({ card_id: payload.card_id, user_id: userId })
        .throwOnError();
    } else if (type === "set_start_date") {
      const when = action.when as string | undefined; // e.g. "now" | ISO
      const start =
        when === "now" || !when ? new Date().toISOString() : when;
      await supabase
        .from("cards")
        .update({ start_date: start })
        .eq("id", payload.card_id)
        .throwOnError();
    } else if (type === "shift_due_by_days") {
      const days = Number(action.days ?? 0);
      const { data: c } = await supabase
        .from("cards")
        .select("due_date")
        .eq("id", payload.card_id)
        .single();
      const base = c?.due_date ? new Date(c.due_date).getTime() : Date.now();
      const due = new Date(base + days * 86400000).toISOString();
      await supabase
        .from("cards")
        .update({ due_date: due })
        .eq("id", payload.card_id)
        .throwOnError();
    } else if (type === "create_checklist") {
      const title = String(action.title ?? "Checklist").trim();
      const items: string[] = Array.isArray(action.items) ? action.items : [];
      const { data: cl } = await supabase
        .from("checklists")
        .insert({ title, card_id: payload.card_id })
        .select("*")
        .single();
      let pos = 100;
      for (const it of items) {
        await supabase
          .from("checklist_items")
          .insert({ title: it, checklist_id: cl.id, done: false, position: pos });
        pos += 100;
      }
    } else if (type === "move_to_top" || type === "move_to_bottom") {
      // precisa da lista atual
      const { data: c } = await supabase
        .from("cards")
        .select("list_id")
        .eq("id", payload.card_id)
        .single();
      const listId = c?.list_id as string;
      if (!listId) continue;
      if (type === "move_to_top") {
        const { data: first } = await supabase
          .from("cards")
          .select("position")
          .eq("list_id", listId)
          .order("position", { ascending: true })
          .limit(1);
        const newPos =
          first && first.length ? Math.max(0, first[0].position - 100) : 100;
        await supabase
          .from("cards")
          .update({ position: newPos })
          .eq("id", payload.card_id);
      } else {
        const { data: last } = await supabase
          .from("cards")
          .select("position")
          .eq("list_id", listId)
          .order("position", { ascending: false })
          .limit(1);
        const newPos =
          last && last.length ? (last[0] as any).position + 100 : 100;
        await supabase
          .from("cards")
          .update({ position: newPos })
          .eq("id", payload.card_id);
      }
    }
  }
}

// Executa uma automação arbitrária (útil para gatilhos por agendamento/duedate)
export async function executeAutomation(
  automation: Automation,
  payload: EventPayload
) {
  const supabase = getSupabaseServerClient();
  try {
    await runActions(supabase, automation, payload);
    await supabase
      .from("automation_runs")
      .insert({ automation_id: automation.id, status: "ok", payload });
  } catch (e: any) {
    await supabase
      .from("automation_runs")
      .insert({
        automation_id: automation.id,
        status: "error",
        payload,
        error_text: String(e?.message ?? e),
      });
  }
}


