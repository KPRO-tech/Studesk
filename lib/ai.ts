/* ------------------------------------------------------------------ */
/* OpenRouter configuration (shared client + server)                   */
/* ------------------------------------------------------------------ */

/**
 * Default free model used when the user has not provided their own
 * OpenRouter API key. Must be one of FREE_MODELS so it works on the
 * shared/default key without incurring cost.
 */
export const DEFAULT_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free'

/** Curated list of free OpenRouter models usable with the default key. */
export const FREE_MODELS: { id: string; label: string }[] = [
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'NVIDIA: Nemotron 3 Super (free)' },
]

export const FREE_MODEL_IDS = new Set(FREE_MODELS.map((m) => m.id))

export const SYSTEM_PROMPT = `Tu es l'Assistant d'étude IA de Studesk, une application d'organisation et de révision.
Tu aides l'utilisateur à apprendre : résumés de cours, fiches de révision structurées, flashcards (question / réponse), quiz, explications de concepts, plans de révision et extraction des points importants.
Réponds toujours en français, de manière claire, structurée et pédagogique. Utilise le Markdown (titres, listes, gras) quand c'est utile.
Quand on te demande des flashcards, propose-les au format "Q: ... / R: ...". Quand on te demande un quiz, numérote les questions et indique les bonnes réponses à la fin.`

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Resolve which model is actually used server-side.
 * - With a personal key, any model is allowed (default to DEFAULT_MODEL).
 * - With the shared/default key, only free models are allowed.
 */
export function resolveModel(requested: string | undefined, hasUserKey: boolean): string {
  const model = requested?.trim()
  if (hasUserKey) return model || DEFAULT_MODEL
  if (model && FREE_MODEL_IDS.has(model)) return model
  return DEFAULT_MODEL
}

/** Quick-action presets surfaced in the AI page. */
export interface AiPreset {
  id: string
  label: string
  description: string
  prompt: string
}

/** Build the prompt that asks the model for a strict-JSON quiz. */
export function buildQuizPrompt(source: string, count = 5): string {
  return `À partir du contenu ci-dessous, génère un quiz de ${count} questions à choix multiples.
Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ni après, sans bloc de code markdown.
Chaque élément doit avoir cette forme exacte :
{"question": "...", "options": ["...", "...", "...", "..."], "correct": [0], "explanation": "..."}
- "options" contient 4 propositions.
- "correct" est un tableau des indices (base 0) des bonnes réponses (une ou plusieurs).
- "explanation" justifie brièvement la bonne réponse.
Rédige en français.

CONTENU :
${source}`
}

export interface ParsedQuestion {
  question: string
  options: string[]
  correct: number[]
  explanation?: string
}

/** Normalize an array of raw question objects into ParsedQuestion[]. */
function parseQuestionArray(data: unknown[]): ParsedQuestion[] {
  const out: ParsedQuestion[] = []
  for (const item of data) {
    if (!item || typeof item !== 'object') continue
    const q = item as Record<string, unknown>
    const question = typeof q.question === 'string' ? q.question : ''
    const options = Array.isArray(q.options) ? q.options.map(String) : []
    let correct: number[] = []
    if (Array.isArray(q.correct)) correct = q.correct.map((n) => Number(n)).filter((n) => !Number.isNaN(n))
    else if (typeof q.correct === 'number') correct = [q.correct]
    const explanation = typeof q.explanation === 'string' ? q.explanation : undefined
    if (question && options.length >= 2 && correct.length > 0) {
      out.push({ question, options, correct, explanation })
    }
  }
  return out
}

/** Best-effort extraction of a JSON quiz array from a model response. */
export function parseQuizJson(raw: string): ParsedQuestion[] {
  let text = raw.trim()
  // Strip markdown code fences if present.
  text = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1) throw new Error('no_json')
  const slice = text.slice(start, end + 1)
  const data = JSON.parse(slice) as unknown
  if (!Array.isArray(data)) throw new Error('not_array')
  const out = parseQuestionArray(data)
  if (out.length === 0) throw new Error('empty')
  return out
}

/**
 * Build a prompt that asks for both the detected subject and the quiz, useful
 * when generating from a PDF whose subject is unknown.
 */
export function buildQuizPromptWithSubject(
  source: string,
  count = 5,
  extra?: string,
): string {
  return `À partir du contenu ci-dessous, génère un quiz de ${count} questions à choix multiples.
${extra?.trim() ? `Consigne supplémentaire de l'utilisateur : ${extra.trim()}\n` : ''}Déduis aussi la matière scolaire principale du contenu (ex. « Histoire », « Mathématiques », « Biologie »).
Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans bloc de code markdown, de cette forme exacte :
{"subject": "...", "questions": [{"question": "...", "options": ["...", "...", "...", "..."], "correct": [0], "explanation": "..."}]}
- "subject" est le nom court de la matière.
- "options" contient 4 propositions.
- "correct" est un tableau des indices (base 0) des bonnes réponses (une ou plusieurs).
- "explanation" justifie brièvement la bonne réponse.
Rédige en français.

CONTENU :
${source}`
}

/** Parse a {subject, questions} JSON object from a model response. */
export function parseQuizWithSubject(raw: string): {
  subject?: string
  questions: ParsedQuestion[]
} {
  let text = raw.trim()
  text = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('no_json')
  const data = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
  const subject =
    typeof data.subject === 'string' && data.subject.trim()
      ? data.subject.trim()
      : undefined
  const arr = Array.isArray(data.questions) ? data.questions : []
  const questions = parseQuestionArray(arr)
  if (questions.length === 0) throw new Error('empty')
  return { subject, questions }
}

/**
 * Call the streaming chat endpoint and accumulate the full text response.
 * Used for one-shot generations (e.g. quiz creation) rather than live chat.
 */
export async function completeChat(
  messages: ChatMessage[],
  opts: { apiKey?: string; model?: string } = {},
): Promise<string> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, apiKey: opts.apiKey, model: opts.model }),
  })
  if (!res.ok || !res.body) {
    let message = 'Erreur de génération.'
    try {
      const j = await res.json()
      message = j.message || message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content
        if (typeof delta === 'string') full += delta
      } catch {
        /* ignore partial */
      }
    }
  }
  return full
}

export const AI_PRESETS: AiPreset[] = [
  {
    id: 'summary',
    label: 'Résumé de cours',
    description: 'Synthétise un texte ou un cours',
    prompt:
      'Résume le cours suivant en points clairs et hiérarchisés, en gardant les notions essentielles :\n\n',
  },
  {
    id: 'sheet',
    label: 'Fiche de révision',
    description: 'Transforme des notes en fiche structurée',
    prompt:
      'Transforme les notes suivantes en une fiche de révision structurée (titres, définitions, points à retenir) :\n\n',
  },
  {
    id: 'flashcards',
    label: 'Flashcards',
    description: 'Génère des cartes question / réponse',
    prompt:
      'Crée une série de flashcards au format "Q: ... / R: ..." à partir du contenu suivant :\n\n',
  },
  {
    id: 'quiz',
    label: 'Quiz',
    description: 'Crée un QCM avec corrigé',
    prompt:
      'Crée un quiz (QCM) de 5 questions avec 4 propositions chacune à partir du contenu suivant, puis donne les bonnes réponses à la fin :\n\n',
  },
  {
    id: 'explain',
    label: 'Expliquer un concept',
    description: 'Explication simple et pédagogique',
    prompt: 'Explique-moi simplement le concept suivant, avec un exemple concret :\n\n',
  },
  {
    id: 'plan',
    label: 'Plan de révision',
    description: 'Organise tes révisions',
    prompt:
      'Propose-moi un plan de révision détaillé jour par jour pour le sujet et l\'échéance suivants :\n\n',
  },
]
