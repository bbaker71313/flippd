import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_URL = "https://api.resend.com/emails";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  // SEC-004: fail closed — require CRON_SECRET to be configured and matched
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) return new Response(JSON.stringify({ error: "Not configured" }), { status: 503, headers: { "Content-Type": "application/json" } });
  if (req.headers.get("x-cron-secret") !== cronSecret) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  const { userId } = await req.json();
  if (!userId) return new Response(JSON.stringify({ error: "userId required" }), { status: 400, headers: { "Content-Type": "application/json" } });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: items, error } = await supabase
    .from("inventory")
    .select("nickname, sku")
    .eq("user_id", userId)
    .eq("status", "Ready to Export");

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });

  if (!items || items.length === 0) {
    return new Response(JSON.stringify({ sent: false, reason: "no_items" }), { headers: { "Content-Type": "application/json" } });
  }

  const { data: userRow } = await supabase.from("users").select("email").eq("id", userId).single();
  if (!userRow?.email) return new Response(JSON.stringify({ sent: false, reason: "no_email" }), { headers: { "Content-Type": "application/json" } });

  const itemList = items.map((i: { nickname: string; sku?: string }) => `• ${i.nickname}${i.sku ? " (" + i.sku + ")" : ""}`).join("\n");
  const body = `You have ${items.length} item${items.length !== 1 ? "s" : ""} ready to export to eBay:\n\n${itemList}\n\nLog in to export: https://scanforprofit.com/app.html`;

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return new Response(JSON.stringify({ sent: false, reason: "no_resend_key" }), { headers: { "Content-Type": "application/json" } });

  const emailRes = await fetch(RESEND_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "reminders@scanforprofit.com",
      to: [userRow.email],
      subject: `You have ${items.length} item${items.length !== 1 ? "s" : ""} ready to export to eBay`,
      text: body,
    }),
  });

  if (!emailRes.ok) {
    const err = await emailRes.text();
    return new Response(JSON.stringify({ sent: false, reason: err }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ sent: true, count: items.length }), { headers: { "Content-Type": "application/json" } });
});
