import { describe, it, expect } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

describe("POST /api/chat", () => {
  it("should generate a chat payload from Gemini via REST and stream SSE response chunks correctly", async () => {
    // We expect a valid Gemini key to exist locally inside the environment variables
    expect(process.env.GEMINI_API_KEY).toBeDefined();

    const req = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: "Build me a contact form with name, email, topic, and message fields.",
          },
        ],
      }),
    });

    const response = await POST(req);
    
    // Check baseline SSE headers
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let streamText = "";
    let receivedPayload = false;

    // Read the chunked response directly from the real connection
    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      streamText += chunk;

      // Because the LLM response is non-deterministic, we check for structural payload patterns
      if (chunk.includes('"candidates"')) {
        receivedPayload = true;
      }
    }

    console.log("----- RAW SSE PAYLOAD BATCH -----");
    console.log(streamText);
    console.log("---------------------------------");

    expect(receivedPayload).toBe(true);
    expect(streamText).toContain("data: [DONE]"); // Stream ends cleanly once Gemini sends turnComplete
  }, 10000); // Strict 10s timeout exactly per previous instructions!
});
