import { describe, it, expect } from "vitest";
import { geminiMessageFormat } from "../gemini-message-format";

describe("geminiMessageFormat", () => {
  describe("toApi", () => {
    it("should format a basic user message correctly", () => {
      const input = [
        {
          id: "4c2e3829-8711-49dd-a16d-cd9ac6227368",
          role: "user" as const,
          content: "Build me a contact form with name, email, topic, and message fields.",
        },
      ];

      const expected = [
        {
          role: "user",
          parts: [
            {
              text: "Build me a contact form with name, email, topic, and message fields.",
            },
          ],
        },
      ];

      const result = geminiMessageFormat.toApi(input);
      console.log("THE RESULT:", JSON.stringify(result, null, 2));
      expect(result).toEqual(expected);
    }, 10000);
  });
});

