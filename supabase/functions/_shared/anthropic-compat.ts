// OpenAI-compatible shim around Anthropic Messages API.
// Accepts the same JSON body as Lovable AI Gateway / OpenAI Chat Completions,
// translates to Anthropic, then returns an OpenAI-shaped response (including SSE streaming).

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";

type AnyObj = Record<string, any>;

function normalizeContent(content: any): any {
  // OpenAI content can be string or array of {type:'text'|'image_url', ...}
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content ?? "");
  return content.map((part: any) => {
    if (!part || typeof part !== "object") return { type: "text", text: String(part ?? "") };
    if (part.type === "text") return { type: "text", text: part.text ?? "" };
    if (part.type === "image_url") {
      const url: string = part.image_url?.url ?? part.image_url ?? "";
      // data URL → base64 source
      const m = url.match(/^data:(.+?);base64,(.*)$/);
      if (m) {
        return { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } };
      }
      return { type: "image", source: { type: "url", url } };
    }
    if (part.type === "image") return part; // already anthropic
    return { type: "text", text: JSON.stringify(part) };
  });
}

function openaiToAnthropic(body: AnyObj): AnyObj {
  const messages: any[] = Array.isArray(body.messages) ? body.messages : [];
  const systemParts: string[] = [];
  const out: any[] = [];
  for (const m of messages) {
    if (!m) continue;
    if (m.role === "system") {
      const c = m.content;
      systemParts.push(typeof c === "string" ? c : JSON.stringify(c));
      continue;
    }
    if (m.role === "tool") {
      out.push({
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: m.tool_call_id,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        }],
      });
      continue;
    }
    if (m.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      const blocks: any[] = [];
      if (m.content) {
        const c = normalizeContent(m.content);
        if (typeof c === "string" && c) blocks.push({ type: "text", text: c });
        else if (Array.isArray(c)) blocks.push(...c);
      }
      for (const tc of m.tool_calls) {
        let input: any = {};
        try { input = typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments) : (tc.function?.arguments ?? {}); } catch { input = {}; }
        blocks.push({ type: "tool_use", id: tc.id, name: tc.function?.name, input });
      }
      out.push({ role: "assistant", content: blocks });
      continue;
    }
    out.push({ role: m.role === "assistant" ? "assistant" : "user", content: normalizeContent(m.content) });
  }

  const anth: AnyObj = {
    model: ANTHROPIC_MODEL,
    max_tokens: body.max_tokens ?? body.max_completion_tokens ?? 4096,
    messages: out,
  };
  if (systemParts.length) anth.system = systemParts.join("\n\n");
  if (body.temperature != null) anth.temperature = body.temperature;
  if (body.top_p != null) anth.top_p = body.top_p;
  if (body.stop) anth.stop_sequences = Array.isArray(body.stop) ? body.stop : [body.stop];
  if (body.stream) anth.stream = true;

  // tools translation
  if (Array.isArray(body.tools) && body.tools.length) {
    anth.tools = body.tools.map((t: any) => {
      const fn = t.function ?? t;
      return { name: fn.name, description: fn.description ?? "", input_schema: fn.parameters ?? fn.input_schema ?? { type: "object", properties: {} } };
    });
    if (body.tool_choice) {
      if (body.tool_choice === "auto") anth.tool_choice = { type: "auto" };
      else if (body.tool_choice === "required" || body.tool_choice === "any") anth.tool_choice = { type: "any" };
      else if (body.tool_choice === "none") { /* omit */ }
      else if (typeof body.tool_choice === "object" && body.tool_choice.function?.name) {
        anth.tool_choice = { type: "tool", name: body.tool_choice.function.name };
      }
    }
  }

  // response_format: json_object → instruct via system
  if (body.response_format?.type === "json_object" || body.response_format?.type === "json_schema") {
    anth.system = (anth.system ? anth.system + "\n\n" : "") + "Respond with valid JSON only, no prose.";
  }

  return anth;
}

function anthropicToOpenAI(anth: AnyObj): AnyObj {
  const blocks: any[] = Array.isArray(anth.content) ? anth.content : [];
  let text = "";
  const toolCalls: any[] = [];
  for (const b of blocks) {
    if (b.type === "text") text += b.text ?? "";
    else if (b.type === "tool_use") {
      toolCalls.push({
        id: b.id,
        type: "function",
        function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
      });
    }
  }
  const message: AnyObj = { role: "assistant", content: text || null };
  if (toolCalls.length) message.tool_calls = toolCalls;
  return {
    id: anth.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: anth.model,
    choices: [{ index: 0, message, finish_reason: anth.stop_reason === "tool_use" ? "tool_calls" : (anth.stop_reason ?? "stop") }],
    usage: anth.usage
      ? { prompt_tokens: anth.usage.input_tokens, completion_tokens: anth.usage.output_tokens, total_tokens: (anth.usage.input_tokens ?? 0) + (anth.usage.output_tokens ?? 0) }
      : undefined,
  };
}

// Translate Anthropic SSE stream → OpenAI-compatible SSE stream.
function translateStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const id = "chatcmpl-" + crypto.randomUUID();
  const created = Math.floor(Date.now() / 1000);

  let buffer = "";
  const toolUses = new Map<number, { id: string; name: string; args: string }>();

  function emit(controller: ReadableStreamDefaultController, delta: AnyObj, finish: string | null = null) {
    const chunk = {
      id, object: "chat.completion.chunk", created, model: ANTHROPIC_MODEL,
      choices: [{ index: 0, delta, finish_reason: finish }],
    };
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
  }

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, nl).replace(/\r$/, "");
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            let evt: AnyObj;
            try { evt = JSON.parse(data); } catch { continue; }

            if (evt.type === "message_start") {
              emit(controller, { role: "assistant", content: "" });
            } else if (evt.type === "content_block_start") {
              const cb = evt.content_block;
              if (cb?.type === "tool_use") {
                toolUses.set(evt.index, { id: cb.id, name: cb.name, args: "" });
                emit(controller, { tool_calls: [{ index: evt.index, id: cb.id, type: "function", function: { name: cb.name, arguments: "" } }] });
              }
            } else if (evt.type === "content_block_delta") {
              const d = evt.delta;
              if (d?.type === "text_delta") {
                emit(controller, { content: d.text ?? "" });
              } else if (d?.type === "input_json_delta") {
                const tu = toolUses.get(evt.index);
                if (tu) tu.args += d.partial_json ?? "";
                emit(controller, { tool_calls: [{ index: evt.index, function: { arguments: d.partial_json ?? "" } }] });
              }
            } else if (evt.type === "message_delta") {
              const stop = evt.delta?.stop_reason;
              if (stop) emit(controller, {}, stop === "tool_use" ? "tool_calls" : "stop");
            } else if (evt.type === "message_stop") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            }
          }
        }
      } catch (e) {
        console.error("stream translate error", e);
      } finally {
        controller.close();
      }
    },
  });
}

/**
 * Drop-in replacement for `fetch("https://ai.gateway.lovable.dev/v1/chat/completions", init)`.
 * Accepts the same OpenAI-style body and returns an OpenAI-shaped Response (incl. SSE).
 */
export async function anthropicCompatFetch(init: RequestInit): Promise<Response> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: { message: "ANTHROPIC_API_KEY not configured" } }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  let body: AnyObj = {};
  try { body = typeof init.body === "string" ? JSON.parse(init.body) : (init.body ?? {}); } catch { body = {}; }
  const stream = !!body.stream;
  const anth = openaiToAnthropic(body);

  const resp = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(anth),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("Anthropic error", resp.status, text);
    return new Response(JSON.stringify({ error: { message: text } }), { status: resp.status, headers: { "Content-Type": "application/json" } });
  }

  if (stream && resp.body) {
    return new Response(translateStream(resp.body), {
      status: 200,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  const json = await resp.json();
  return new Response(JSON.stringify(anthropicToOpenAI(json)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
