import type { GenerateContentResponse } from "@google/genai";
import { AGUIEvent, EventType, StreamProtocolAdapter } from "../../types/stream";

export const geminiAdapter = (): StreamProtocolAdapter => ({
  async *parse(response: Response): AsyncIterable<AGUIEvent> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    const messageId = crypto.randomUUID();
    let messageStarted = false;
    let toolCallStarted = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") continue;

        try {
          const json = JSON.parse(data) as GenerateContentResponse;
          const candidate = json.candidates?.[0];
          
          if (!candidate) continue;
          
          const parts = candidate.content?.parts;
          if (!parts) continue;

          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part) continue;

            // Emit TEXT_MESSAGE_START on first meaningul part
            if (!messageStarted && (part.text || candidate.content?.role)) {
              yield {
                type: EventType.TEXT_MESSAGE_START,
                messageId,
                role: "assistant",
              };
              messageStarted = true;
            }

            if (part.text) {
              yield {
                type: EventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: part.text,
              };
            }

            if (part.functionCall) {
              const toolCallId = crypto.randomUUID(); // Gemini doesn't always provide toolCall IDs like OpenAI, synthesize one
              yield {
                type: EventType.TOOL_CALL_START,
                toolCallId,
                toolCallName: part.functionCall.name,
              };
              toolCallStarted = true;
              
              if (part.functionCall.args) {
                yield {
                  type: EventType.TOOL_CALL_ARGS,
                  toolCallId,
                  delta: typeof part.functionCall.args === 'string' ? part.functionCall.args : JSON.stringify(part.functionCall.args),
                };
              }

              yield {
                type: EventType.TOOL_CALL_END,
                toolCallId,
              };
            }
          }

          if (candidate.finishReason === "STOP") {
            yield {
              type: EventType.TEXT_MESSAGE_END,
              messageId,
            };
          }
        } catch (e) {
          console.error("Failed to parse Gemini SSE event", e);
        }
      }
    }
  },
});

/**
 * Adapter for streams produced natively with no SSE `data: ` prefix, 
 * yielding standard NDJSON (one JSON object per line).
 */
export const geminiReadableStreamAdapter = (): StreamProtocolAdapter => ({
  async *parse(response: Response): AsyncIterable<AGUIEvent> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    const messageId = crypto.randomUUID();
    let messageStarted = false;
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const data = line.trim();
        if (!data) continue;

        try {
          const json = JSON.parse(data) as GenerateContentResponse;
          const candidate = json.candidates?.[0];
          
          if (!candidate) continue;
          
          const parts = candidate.content?.parts;
          if (!parts) {
            // Still check for finishReason even if parts is empty/missing
            if (candidate.finishReason === "STOP") {
              yield {
                type: EventType.TEXT_MESSAGE_END,
                messageId,
              };
            }
            continue;
          }

          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part) continue;

            if (!messageStarted && (part.text || candidate.content?.role)) {
              yield {
                type: EventType.TEXT_MESSAGE_START,
                messageId,
                role: "assistant",
              };
              messageStarted = true;
            }

            if (part.text) {
              yield {
                type: EventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: part.text,
              };
            }

            if (part.functionCall) {
              const toolCallId = crypto.randomUUID(); 
              yield {
                type: EventType.TOOL_CALL_START,
                toolCallId,
                toolCallName: part.functionCall.name,
              };
              
              if (part.functionCall.args) {
                yield {
                  type: EventType.TOOL_CALL_ARGS,
                  toolCallId,
                  delta: typeof part.functionCall.args === 'string' 
                         ? part.functionCall.args 
                         : JSON.stringify(part.functionCall.args),
                };
              }

              yield {
                type: EventType.TOOL_CALL_END,
                toolCallId,
              };
            }
          }

          if (candidate.finishReason === "STOP") {
            yield {
              type: EventType.TEXT_MESSAGE_END,
              messageId,
            };
          }
        } catch (e) {
          console.error("Failed to parse Gemini NDJSON chunk", e);
        }
      }
    }
  },
});

export const geminiResponsesAdapter = (): StreamProtocolAdapter => ({
  async *parse(response: Response): AsyncIterable<AGUIEvent> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    const messageId = crypto.randomUUID();
    let messageStarted = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") continue;

        try {
          const json = JSON.parse(data) as GenerateContentResponse;
          const candidate = json.candidates?.[0];
          
          if (!candidate) continue;
          
          const parts = candidate.content?.parts;
          if (!parts) continue;

          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part) continue;

            if (!messageStarted && (part.text || candidate.content?.role)) {
              yield {
                type: EventType.TEXT_MESSAGE_START,
                messageId,
                role: "assistant",
              };
              messageStarted = true;
            }

            if (part.text) {
              yield {
                type: EventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: part.text,
              };
            }

            if (part.functionCall) {
              const toolCallId = crypto.randomUUID();
              yield {
                type: EventType.TOOL_CALL_START,
                toolCallId,
                toolCallName: part.functionCall.name,
              };
              
              if (part.functionCall.args) {
                yield {
                  type: EventType.TOOL_CALL_ARGS,
                  toolCallId,
                  delta: typeof part.functionCall.args === 'string' ? part.functionCall.args : JSON.stringify(part.functionCall.args),
                };
              }

              yield {
                type: EventType.TOOL_CALL_END,
                toolCallId,
              };
            }
          }

          if (candidate.finishReason === "STOP") {
            yield {
              type: EventType.TEXT_MESSAGE_END,
              messageId,
            };
          }
        } catch (e) {
          console.error("Failed to parse Gemini SSE event", e);
        }
      }
    }
  },
});
