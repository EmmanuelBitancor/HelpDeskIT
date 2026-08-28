import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toHistoryEntry } from "../../../types/mappers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const ticketId = id;

    // Verify the ticket exists and user has access (optional - for now just fetch)
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("id")
      .eq("id", ticketId)
      .single();

    if (ticketError) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Fetch ticket history
    const { data, error } = await supabase
      .from("ticket_history")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("at", { ascending: true });

    if (error) {
      console.error("Failed to fetch ticket history:", error);
      return NextResponse.json(
        { error: "Failed to fetch ticket history" },
        { status: 500 }
      );
    }

    const historyEntries = (data ?? []).map(toHistoryEntry);

    return NextResponse.json({
      entries: historyEntries
    });
  } catch (error) {
    console.error("Ticket history API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}