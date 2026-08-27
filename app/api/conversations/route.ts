import { NextRequest } from "next/server";
import { listConversationsHandler } from "./lib/listConversations";
import { createConversationHandler } from "./lib/createConversation";

export async function GET(request: NextRequest) {
  return listConversationsHandler(request);
}

export async function POST(request: NextRequest) {
  return createConversationHandler(request);
}
