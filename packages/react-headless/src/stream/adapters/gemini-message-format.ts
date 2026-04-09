import type { Content, Part } from "@google/genai";
import type {
  AssistantMessage,
  BinaryInputContent,
  InputContent,
  Message,
  ToolCall,
  ToolMessage,
  UserMessage,
} from "../../types";

import type { MessageFormat } from "../../types/messageFormat";

type GeminiMessage = Content;

function toGeminiUserMessage(message: UserMessage): GeminiMessage {
  const parts: Part[] = [];
  if (typeof message.content === "string") {
    parts.push({ text: message.content });
  } else {
    for (const part of message.content ?? []) {
      if (part.type === "text") {
        parts.push({ text: part.text });
      } else if (part.type === "binary") {
        parts.push({
          inlineData: {
            mimeType: part.mimeType,
            data: part.data ?? "",
          },
        });
      }
    }
  }
  return { role: "user", parts };
}

function toGeminiAssistantMessage(message: AssistantMessage): GeminiMessage {
  const parts: Part[] = [];
  if (message.content) {
    parts.push({ text: message.content });
  }
  if (message.toolCalls?.length) {
    for (const tc of message.toolCalls) {
      let args: Record<string, any>;
      try {
        args = typeof tc.function.arguments === "string" 
           ? JSON.parse(tc.function.arguments) 
           : tc.function.arguments;
      } catch {
        args = {};
      }
      parts.push({
        functionCall: {
          name: tc.function.name,
          args,
        },
      });
    }
  }
  return { role: "model", parts };
}

function getToolNameFromId(messages: Message[], id: string): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "assistant") {
      const helper = m as AssistantMessage;
      if (helper.toolCalls) {
        const call = helper.toolCalls.find((tc: ToolCall) => tc.id === id);
        if (call) return call.function.name;
      }
    }
  }
  return id;
}

function groupGeminiToolMessages(
  messages: Message[],
  startIndex: number
): { message: GeminiMessage; consumed: number } {
  const parts: Part[] = [];
  let i = startIndex;

  while (i < messages.length && messages[i]?.role === "tool") {
    const tm = messages[i] as ToolMessage;
    let response: Record<string, unknown>;
    try {
      response = typeof tm.content === "string" ? JSON.parse(tm.content) : tm.content;
    } catch {
      response = { result: tm.content };
    }
    parts.push({
      functionResponse: {
        name: getToolNameFromId(messages, tm.toolCallId),
        response,
      },
    });
    i++;
  }

  return { message: { role: "user", parts }, consumed: i - startIndex };
}

const toGeminiMessages = (messages: Message[]): GeminiMessage[] => {
  const result: GeminiMessage[] = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    switch (msg?.role) {
      case "user":
        result.push(toGeminiUserMessage(msg));
        i++;
        break;
      case "assistant":
        result.push(toGeminiAssistantMessage(msg));
        i++;
        break;
      case "tool": {
        const { message, consumed } = groupGeminiToolMessages(messages, i);
        result.push(message);
        i += consumed;
        break;
      }
      case "system":
      case "developer":
        // Stripped out as decided experimentally, see `.agents.md` mapping notes.
        i++;
        break;
      default:
        i++;
        break;
    }
  }
  return result;
};

const fromGeminiMessage = (msg: GeminiMessage): Message[] => {
  if (msg.role === "user") {
    const isFunctionResponse = msg.parts?.some((p: Part) => !!p.functionResponse);
    if (isFunctionResponse) {
      return msg.parts!
        .filter((p: Part) => !!p.functionResponse)
        .map((p: Part) => {
          const fr = p.functionResponse!;
          return {
            id: crypto.randomUUID(),
            role: "tool",
            toolCallId: fr.name,
            content: typeof fr.response === "string" ? fr.response : JSON.stringify(fr.response),
          } as ToolMessage;
        });
    } else {
      const content: InputContent[] = (msg.parts || []).map((p: Part) => {
        if (p.text) return { type: "text", text: p.text };
        if (p.inlineData) {
          return {
            type: "binary",
            mimeType: p.inlineData.mimeType,
            data: p.inlineData.data,
          } as BinaryInputContent;
        }
        return { type: "text", text: "" };
      });

      if (content.length === 1 && content[0]?.type === "text") {
        return [{ id: crypto.randomUUID(), role: "user", content: (content[0] as { type: "text", text: string }).text }];
      }
      return [{ id: crypto.randomUUID(), role: "user", content }];
    }
  } else if (msg.role === "model") {
    let text = "";
    const toolCalls: ToolCall[] = [];
    for (const part of (msg.parts || [])) {
      if (part.text) {
        text += part.text;
      } else if (part.functionCall) {
        toolCalls.push({
          id: crypto.randomUUID(),
          type: "function",
          function: {
            name: part.functionCall.name || "unknown",
            arguments: typeof part.functionCall.args === "string"
              ? part.functionCall.args
              : JSON.stringify(part.functionCall.args || {}),
          },
        });
      }
    }
    const result: AssistantMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: text || undefined,
    };
    if (toolCalls.length) result.toolCalls = toolCalls;
    return [result];
  }
  return [];
};

/**
 * Converts between AG-UI message format and Gemini `Content` array
 * format, powered natively by @google/genai structures.
 */
export const geminiMessageFormat: MessageFormat = {
  toApi(messages: Message[]): GeminiMessage[] {
    return toGeminiMessages(messages);
  },

  fromApi(data: unknown): Message[] {
    return (data as GeminiMessage[]).flatMap(fromGeminiMessage);
  },
};