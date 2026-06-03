/**
 * POST /api/spending
 *
 * AI-powered spending intelligence.
 * Queries transaction history from Supabase and asks Claude
 * to analyze and respond conversationally.
 *
 * Used when user asks:
 *   "How much did I spend this week?"
 *   "What did I spend on food last month?"
 *   "Am I on track with my savings?"
 *   "Show me my biggest transactions"
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type Period = "today" | "week" | "month" | "year";

function getPeriodRange(period: Period): { from: string; to: string; label: string } {
  const now = new Date();
  const to = now.toISOString();

  switch (period) {
    case "today": {
      const from = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      return { from, to, label: "today" };
    }
    case "week": {
      const from = new Date(Date.now() - 7 * 86400000).toISOString();
      return { from, to, label: "the last 7 days" };
    }
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      return { from, to, label: "this month" };
    }
    case "year": {
      const from = new Date(now.getFullYear(), 0, 1).toISOString();
      return { from, to, label: "this year" };
    }
  }
}

export async function POST(req: NextRequest) {
  let body: { period?: Period; category?: string; question: string; userId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { period = "month", question, userId } = body;

  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Query transactions
  const { from, to, label } = getPeriodRange(period);

  const { data: txs, error } = await supabase
    .from("transactions")
    .select("action_type, amount_usdc, inr_amount, recipient, merchant_name, note, created_at, tx_hash, status")
    .eq("user_id", userId)
    .gte("created_at", from)
    .lte("created_at", to)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[spending] DB error:", error.message);
    return NextResponse.json({ error: "Failed to load transactions" }, { status: 500 });
  }

  const txList = txs ?? [];

  // Compute summary stats for Claude context
  const totalUSDC = txList.reduce((s, t) => s + (t.amount_usdc ?? 0), 0);
  const totalINR = txList.reduce((s, t) => s + (t.inr_amount ?? 0), 0);
  const transferCount = txList.filter(t => t.action_type?.includes("transfer")).length;
  const upiCount = txList.filter(t => t.action_type === "upi_payment").length;
  const savingsCount = txList.filter(t => t.action_type === "lock_savings").length;

  const txSummary = txList.slice(0, 20).map(t =>
    `• ${t.action_type}: ${t.inr_amount ? `₹${t.inr_amount}` : `${t.amount_usdc} USDC`}${t.merchant_name ? ` to ${t.merchant_name}` : t.recipient ? ` to ${t.recipient.slice(0, 8)}…` : ""} on ${new Date(t.created_at).toLocaleDateString("en-IN")}`
  ).join("\n");

  // Ask Claude to analyze
  const systemPrompt = `You are Auron's financial AI assistant. Analyze the user's transaction history and answer their question conversationally and helpfully.

Be concise (2-4 sentences max). Use ₹ for INR amounts. If the user asks in Hindi or any Indian language, reply in that same language. Be encouraging about savings. Flag if spending seems unusual.`;

  const userMessage = `User question: "${question}"

Transaction summary for ${label}:
- Total spent: ₹${totalINR.toFixed(0)} (${totalUSDC.toFixed(2)} USDC)
- Transfers: ${transferCount}
- UPI payments: ${upiCount}
- Savings locks: ${savingsCount}
- Total transactions: ${txList.length}

Recent transactions:
${txSummary || "No transactions found"}

Answer the user's question based on this data.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } } as Anthropic.Messages.TextBlockParam & { cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }],
    });

    const answer = response.content[0].type === "text" ? response.content[0].text : "Sorry, I couldn't analyze your spending right now.";

    return NextResponse.json({
      answer,
      stats: {
        period: label,
        totalINR: Math.round(totalINR),
        totalUSDC: parseFloat(totalUSDC.toFixed(2)),
        txCount: txList.length,
        transferCount,
        upiCount,
        savingsCount,
      },
    });
  } catch (err) {
    console.error("[spending] Claude error:", err);
    return NextResponse.json({ error: "AI analysis failed" }, { status: 500 });
  }
}
