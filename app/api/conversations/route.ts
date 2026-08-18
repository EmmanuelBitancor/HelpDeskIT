import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("id, email, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const otherParty = searchParams.get("other_party");

    if (otherParty) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(otherParty)) {
        return NextResponse.json({ error: "Invalid other_party format" }, { status: 400 });
      }
    }

    let query = supabase
      .from("conversations")
      .select("*")
      .or(`created_by.eq.${account.id},created_for.eq.${account.id}`)
      .order("updated_at", { ascending: false });

    if (otherParty) {
      query = query.or(
        `and(created_by.eq.${account.id},created_for.eq.${otherParty}),and(created_by.eq.${otherParty},created_for.eq.${account.id})`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("Conversations query error:", error);
      const message = error.message || "Failed to fetch conversations";
      return NextResponse.json(
        { error: message.includes("does not exist") ? "Chat system not initialized. Please run the database migration." : message },
        { status: 500 }
      );
    }

    return NextResponse.json({ conversations: data || [] });
  } catch (error) {
    console.error("Conversations fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { created_for, staff_email, ticket_id } = body;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("id, email, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    let resolvedStaffId: string | null = null;
    let resolvedStaffRole: string | null = null;

    if (ticket_id) {
      const { data: ticket } = await supabase
        .from("tickets")
        .select("assigned_to")
        .eq("id", ticket_id)
        .maybeSingle();

      if (!ticket?.assigned_to) {
        return NextResponse.json(
          { error: "Ticket has no assigned support" },
          { status: 400 }
        );
      }

      const { data: staffRecord } = await supabase
        .from("support_staff")
        .select("email")
        .eq("id", ticket.assigned_to)
        .maybeSingle();

      if (!staffRecord?.email) {
        return NextResponse.json(
          { error: "Assigned support record not found" },
          { status: 400 }
        );
      }

      const { data: staffAccount } = await supabase
        .from("accounts")
        .select("id, role")
        .eq("email", staffRecord.email)
        .maybeSingle();

      if (!staffAccount) {
        return NextResponse.json(
          { error: "Assigned support account not found" },
          { status: 400 }
        );
      }

      resolvedStaffId = staffAccount.id;
      resolvedStaffRole = staffAccount.role;
    } else if (staff_email) {
      const { data: staffAccount } = await supabase
        .from("accounts")
        .select("id, role")
        .eq("email", staff_email)
        .maybeSingle();

      if (!staffAccount) {
        return NextResponse.json(
          { error: "Support account not found" },
          { status: 400 }
        );
      }

      resolvedStaffId = staffAccount.id;
      resolvedStaffRole = staffAccount.role;
    } else if (created_for) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof created_for !== "string" || !uuidRegex.test(created_for)) {
        return NextResponse.json(
          { error: "Invalid created_for format" },
          { status: 400 }
        );
      }

      const { data: targetAccount } = await supabase
        .from("accounts")
        .select("id, role")
        .eq("id", created_for)
        .maybeSingle();

      if (!targetAccount) {
        return NextResponse.json(
          { error: "Target account not found" },
          { status: 400 }
        );
      }

      if (account.role !== "support" && !["support", "admin"].includes(targetAccount.role)) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }

      resolvedStaffId = targetAccount.id;
      resolvedStaffRole = targetAccount.role;
    } else {
      return NextResponse.json(
        { error: "created_for, staff_email, or ticket_id is required" },
        { status: 400 }
      );
    }

    const { data: existingConversation, error: existingError } = await supabase
      .from("conversations")
      .select("*")
      .limit(1)
      .or(
        `and(created_by.eq.${account.id},created_for.eq.${resolvedStaffId}),and(created_by.eq.${resolvedStaffId},created_for.eq.${account.id})`
      )
      .maybeSingle();

    if (existingError) {
      console.error("Conversation lookup error:", existingError);
      return NextResponse.json(
        { error: "Failed to check existing conversation" },
        { status: 500 }
      );
    }

    if (existingConversation) {
      return NextResponse.json({ conversation: existingConversation }, { status: 200 });
    }

    const conversationId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        id: conversationId,
        created_by: account.id,
        created_for: resolvedStaffId,
        created_by_role: account.role,
        created_for_role: resolvedStaffRole,
      })
      .select()
      .single();

    if (error) {
      console.error("Conversation insert error:", error);
      const message = error.message || "Failed to create conversation";
      return NextResponse.json(
        { error: message.includes("does not exist") ? "Chat system not initialized. Please run the database migration." : message },
        { status: 400 }
      );
    }

    return NextResponse.json({ conversation: data }, { status: 201 });
  } catch (error) {
    console.error("Conversation create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
