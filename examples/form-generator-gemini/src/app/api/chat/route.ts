import { readFileSync } from "fs";
import { NextRequest } from "next/server";
import { join } from "path";
import { geminiMessageFormat } from "@openuidev/react-headless/src/stream/adapters/gemini-message-format";

const systemPrompt = readFileSync(join(process.cwd(), "src/generated/system-prompt.txt"), "utf-8");

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  const geminiMessages = geminiMessageFormat.toApi(messages) as any;

  const encoder = new TextEncoder();
  let controllerClosed = false;

  const readable = new ReadableStream({
    async start(controller) {
      const enqueue = (data: Uint8Array) => {
        if (controllerClosed) return;
        try { controller.enqueue(data); } catch { /* already closed */ }
      };
      const close = () => {
        if (controllerClosed) return;
        controllerClosed = true;
        try { controller.close(); } catch { /* already closed */ }
      };

      try {
        const apiKey = process.env.GEMINI_API_KEY;
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey });

        const responseStream = await ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          contents: geminiMessages,
          config: {
            systemInstruction: systemPrompt,
          }
        });

        for await (const chunk of responseStream) {
          if (controllerClosed) break;
          // generateContentStream chunks exactly map to GenerateContentResponse,
          // matching our adapter's core structures seamlessly.
          enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }

        enqueue(encoder.encode("data: [DONE]\n\n"));
        close();

      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream error";
        console.error("Chat route error:", msg);
        enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
