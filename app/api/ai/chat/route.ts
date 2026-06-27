import { resolveModel, SYSTEM_PROMPT, type ChatMessage } from '@/lib/ai'

export const runtime = 'edge'
export const maxDuration = 60

interface ChatBody {
  messages?: ChatMessage[]
  /** optional personal OpenRouter API key */
  apiKey?: string
  /** optional model id */
  model?: string
}

export async function POST(req: Request) {
  let body: ChatBody
  try {
    body = (await req.json()) as ChatBody
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }

  const messages = Array.isArray(body.messages) ? body.messages : []
  if (messages.length === 0) {
    return Response.json({ error: 'no_messages' }, { status: 400 })
  }

  const userKey = body.apiKey?.trim()
  // Default shared key — added by the project owner via env vars.
  const apiKey = userKey || process.env.NEXT_PUBLIC_OPENROUTER_DEFAULT_KEY

  if (!apiKey) {
    return Response.json(
      {
        error: 'missing_key',
        message:
          "Aucune clé OpenRouter n'est configurée. Ajoute ta propre clé dans les réglages de l'assistant.",
      },
      { status: 400 },
    )
  }

  const model = resolveModel(body.model, Boolean(userKey))

  // Ensure a system prompt leads the conversation.
  const finalMessages: ChatMessage[] =
    messages[0]?.role === 'system'
      ? messages
      : [{ role: 'system', content: SYSTEM_PROMPT }, ...messages]

  let upstream: Response
  try {
    upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://studesk.vercel.app',
        'X-Title': 'Studesk',
      },
      body: JSON.stringify({ model, messages: finalMessages, stream: true }),
    })
  } catch {
    return Response.json(
      { error: 'network', message: 'Impossible de joindre OpenRouter.' },
      { status: 502 },
    )
  }

  if (!upstream.ok || !upstream.body) {
    let detail = ''
    try {
      detail = await upstream.text()
    } catch {
      /* ignore */
    }
    return Response.json(
      {
        error: 'upstream',
        status: upstream.status,
        message:
          upstream.status === 401
            ? 'Clé OpenRouter invalide.'
            : `OpenRouter a renvoyé une erreur (${upstream.status}).`,
        detail: detail.slice(0, 500),
      },
      { status: 502 },
    )
  }

  // Stream the raw OpenRouter SSE back to the client.
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Model': model,
    },
  })
}
