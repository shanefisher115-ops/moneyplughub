export async function POST(req) {
  const { prompt } = await req.json();

  // Call local Ollama stream endpoint
  const ollamaRes = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3.2",
      prompt: prompt,
      stream: true,
      system: "You are the AI engine for MoneyPlugHub. Respond concisely, clearly, and directly without fluff."
    })
  });

  if (!ollamaRes.body) {
    return new Response("No response stream available", { status: 500 });
  }

  const reader = ollamaRes.body.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter(Boolean);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: parsed.response })}\n\n`));
          }
        } catch (e) {
          // Ignore partial line chunks
        }
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
    }
  });
}
