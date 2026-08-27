import { NextRequest } from "next/server";
import { getMessagesHandler } from "./lib/getMessages";
import { markAsReadHandler } from "./lib/markAsRead";
import { sendMessageHandler } from "./lib/sendMessage";

export async function GET(request: NextRequest) {
  return getMessagesHandler(request);
}

export async function PATCH(request: NextRequest) {
  return markAsReadHandler(request);
}

export async function POST(request: NextRequest) {
  return sendMessageHandler(request);
}
