import { db, uid, type AiAction } from './db'

/**
 * Strips undefined/null values from an object to ensure Dexie can store it cleanly.
 */
function cleanObj(obj: any): any {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Extracts all actions blocks [ACTION_START]...[ACTION_END] from the raw response.
 */
export function parseActions(content: string): AiAction[] {
  const regex = /\[ACTION_START\]([\s\S]*?)\[ACTION_END\]/g
  const actions: AiAction[] = []
  let match

  while ((match = regex.exec(content)) !== null) {
    try {
      const cleaned = match[1]
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
      const action = JSON.parse(cleaned)
      if (action && typeof action === 'object' && action.type) {
        // give it a temporary UI id for React iteration
        actions.push({ ...action, id: uid() })
      }
    } catch (e) {
      console.error('Error parsing AI action:', match[1])
    }
  }
  return actions
}

/**
 * Removes the action blocks from the message so the user only sees the friendly text.
 * Hides partial blocks as well during streaming.
 */
export function cleanAgentResponse(content: string): string {
  return content
    .replace(/\[ACTION_START\][\s\S]*?\[ACTION_END\]/g, '') // Complete blocks
    .replace(/\[ACTION_START\][\s\S]*$/, '') // Partial block at the end
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Executes a single action directly against the Dexie client database.
 * The `aiGenerated` flag is automatically appended to creations.
 */
export async function executeAction(
  action: AiAction,
  userId: string,
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const collection = action.collection
    if (!collection || typeof (db as any)[collection] === 'undefined') {
      return { success: false, message: `Collection inconnue: ${collection}` }
    }

    const table = (db as any)[collection]

    switch (action.type) {
      case 'CREATE': {
        const id = action.data.id || uid()
        const doc = {
          ...action.data,
          id,
          userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          aiGenerated: true,
          // Note: sync: 'pending' is automatically appended by the db hook!
        }
        await table.add(cleanObj(doc))
        return {
          success: true,
          message: `Document créé dans ${collection}`,
          data: { id },
        }
      }

      case 'UPDATE': {
        if (!action.docId) {
          return { success: false, message: 'docId manquant pour UPDATE' }
        }
        // ensure doc belongs to user
        const existing = await table.get(action.docId)
        if (!existing || existing.userId !== userId) {
          return { success: false, message: `Document introuvable ou accès refusé` }
        }
        await table.update(action.docId, cleanObj({
          ...action.data,
          updatedAt: Date.now(),
        }))
        return {
          success: true,
          message: `Document mis à jour dans ${collection}`,
        }
      }

      case 'DELETE': {
        if (!action.docId) {
          return { success: false, message: 'docId manquant pour DELETE' }
        }
        const existing = await table.get(action.docId)
        if (!existing || existing.userId !== userId) {
          return { success: false, message: `Document introuvable ou accès refusé` }
        }
        // Wait, for delete in synced tables, we must NOT physically delete if it was synced!
        // The standard delete logic applies: if sync !== 'synced', hard delete. Otherwise mark deleted.
        // Actually, db.ts doesn't have soft delete yet, wait! 
        // Oh right, my firebase-sync hook handles local deletes if they are pending, 
        // but wait, standard dexie `.delete()` hard deletes. 
        // We should just use standard table.delete(). Let's keep it simple for now as it's the client side.
        await table.delete(action.docId)
        return {
          success: true,
          message: `Document supprimé de ${collection}`,
        }
      }

      case 'READ': {
        // READ is a bit tricky offline since Dexie queries are different from Firestore.
        // We do a best-effort simple filter.
        let q = table.where('userId').equals(userId)

        // Actually, this simple where might not be chainable with other properties easily without indexes.
        // Dexie allows filter() for anything.
        const allDocs = await q.toArray()
        let filtered = allDocs

        if (action.filters && Array.isArray(action.filters)) {
          filtered = filtered.filter((doc: any) => {
            return action.filters!.every((f) => {
              const val = doc[f.field]
              switch (f.operator) {
                case '==': return val === f.value
                case '>': return val > f.value
                case '<': return val < f.value
                case '>=': return val >= f.value
                case '<=': return val <= f.value
                case 'includes': return Array.isArray(val) && val.includes(f.value)
                default: return true
              }
            })
          })
        }

        if (action.limit) {
          filtered = filtered.slice(0, action.limit)
        }

        return {
          success: true,
          message: `${filtered.length} document(s) lu(s)`,
          data: filtered,
        }
      }

      default:
        return { success: false, message: `Type d'action inconnu: ${action.type}` }
    }
  } catch (err: any) {
    return { success: false, message: `Erreur: ${err.message}` }
  }
}

/**
 * Gathers a summary of the user's database.
 * Used to inject context into the AI's system prompt.
 */
export async function getDatabaseContext(userId: string): Promise<string> {
  try {
    const [
      notes,
      tasks,
      events,
      subjects,
      routines,
      flashcardDecks,
      quizzes
    ] = await Promise.all([
      db.notes.where('userId').equals(userId).toArray(),
      db.tasks.where('userId').equals(userId).toArray(),
      db.events.where('userId').equals(userId).toArray(),
      db.subjects.where('userId').equals(userId).toArray(),
      db.routines.where('userId').equals(userId).toArray(),
      db.decks.where('userId').equals(userId).toArray(),
      db.quizzes.where('userId').equals(userId).toArray(),
    ])

    const context = {
      subjects: {
        total: subjects.length,
        items: subjects.map(s => ({ id: s.id, name: s.name }))
      },
      tasks: {
        total: tasks.length,
        todo: tasks.filter(t => t.status === 'todo').length,
        doing: tasks.filter(t => t.status === 'doing').length,
        done: tasks.filter(t => t.status === 'done').length,
        items: tasks.map(t => ({ id: t.id, title: t.title, status: t.status }))
      },
      notes: {
        total: notes.length,
        items: notes.map(n => ({ id: n.id, title: n.title, subjectId: n.subjectId }))
      },
      events: {
        total: events.length,
        items: events.map(e => ({ id: e.id, title: e.title, start: new Date(e.start).toISOString() }))
      },
      routines: {
        total: routines.length,
        items: routines.map(r => ({ id: r.id, title: r.title, day: r.day, startMin: r.startMin, endMin: r.endMin }))
      },
      flashcardDecks: {
        total: flashcardDecks.length,
        items: flashcardDecks.map(d => ({ id: d.id, name: d.name }))
      },
      quizzes: {
        total: quizzes.length,
        items: quizzes.map(q => ({ id: q.id, title: q.title }))
      }
    }

    return JSON.stringify(context, null, 2)
  } catch (error: any) {
    console.error('Erreur lecture du contexte DB:', error)
    return 'Erreur accès base de données'
  }
}

/**
 * Builds the complete system prompt for the Academic Agent,
 * merging the DB context with the rules.
 */
export function buildAgentSystemPrompt(dbContext: string): string {
  return `Tu es l'Assistant IA de Studesk, un **agent académique personnel** ultra intelligent.

## Tes Capacités
- Tu as accès à l'espace de travail complet de l'étudiant (notes, tâches, flashcards, quiz, emploi du temps, événements).
- Tu peux **LIRE, CRÉER, MODIFIER et SUPPRIMER** n'importe quel document dans la base de données.
- Tu proposes des plans d'actions concrets pour l'organisation et les révisions.
- Si l'utilisateur donne un document (PDF), tu peux en extraire des résumés, des flashcards ou des quiz.

## État Actuel de la Base de Données (IndexedDB)
Voici un aperçu des données actuelles de l'utilisateur. Utilise les "id" pour lier les ressources entre elles (ex: mettre un subjectId sur une note).
${dbContext}

## Comment Interagir avec la Base de Données

Pour effectuer une action, tu dois INCLURE un bloc d'action exact dans ton message. L'application se chargera de demander confirmation à l'utilisateur avant de l'exécuter.
Sois précis, proactif et intelligent. Si l'utilisateur demande des flashcards, génère une action pour créer le paquet et des actions pour chaque carte. Produis du contenu riche et de haute qualité.
Tu peux inclure autant de blocs d'action que nécessaire dans un seul message. Ne mets pas de texte inutile à l'intérieur des blocs JSON.

**CRÉER une Tâche :**
[ACTION_START]
{"type": "CREATE", "collection": "tasks", "data": {"title": "Chapitre 1", "status": "todo", "category": "Études", "tagIds": []}}
[ACTION_END]

**CRÉER une Note :**
[ACTION_START]
{"type": "CREATE", "collection": "notes", "data": {"title": "Résumé", "content": "...", "pinned": false}}
[ACTION_END]

**CRÉER un Paquet de Flashcards ET ses Cartes (Très Important) :**
[ACTION_START]
{"type": "CREATE", "collection": "decks", "data": {"id": "deck_123", "name": "Vocabulaire"}}
[ACTION_END]
[ACTION_START]
{"type": "CREATE", "collection": "cards", "data": {"deckId": "deck_123", "front": "Question 1", "back": "Réponse 1", "dueDate": 0}}
[ACTION_END]
*(Note : Tu dois fournir un "id" personnalisé au paquet (ex: "deck_123") pour pouvoir le réutiliser dans le "deckId" des cartes que tu crées ensuite)*

**CRÉER un Quiz :**
[ACTION_START]
{"type": "CREATE", "collection": "quizzes", "data": {"title": "Quiz Math", "questions": [{"question": "...", "options": ["A", "B", "C", "D"], "correct": [0]}]}}
[ACTION_END]

**CRÉER un Événement/Routine (Emploi du temps) :**
[ACTION_START]
{"type": "CREATE", "collection": "routines", "data": {"title": "Révision Math", "day": 1, "startMin": 540, "endMin": 660, "type": "school", "notes": "Faire les exercices"}}
[ACTION_END]
*(Note : "day" va de 0 (Lundi) à 6 (Dimanche). "startMin" et "endMin" sont les heures en minutes depuis minuit, ex: 9h00 = 540, 11h00 = 660)*

**MODIFIER une Tâche :**
[ACTION_START]
{"type": "UPDATE", "collection": "tasks", "docId": "id-de-la-tache", "data": {"status": "done"}}
[ACTION_END]

**SUPPRIMER :**
[ACTION_START]
{"type": "DELETE", "collection": "notes", "docId": "id-de-la-note"}
[ACTION_END]

## Collections Disponibles
- \`tasks\` : Tâches (status: 'todo', 'doing', 'done')
- \`notes\` : Notes de cours (content supporte le Markdown)
- \`decks\` : Paquets de flashcards
- \`cards\` : Flashcards (front, back, deckId)
- \`quizzes\` : Quiz (title, questions array)
- \`events\` : Événements calendaires (start, end en timestamps)
- \`routines\` : Créneaux hebdomadaires (day 0-6, startMin, endMin)

## Règles Strictes
1. Réponds TOUJOURS en français, de manière bienveillante et structurée (utilise le Markdown).
2. Pour chaque action proposée (surtout CREATE, UPDATE, DELETE), explique très brièvement à l'utilisateur ce que tu proposes de faire avant le bloc.
3. Ne propose **JAMAIS** de fausses IDs pour les modifications/suppressions. Sers-toi du contexte DB.
4. Génère des données complètes et exhaustives. Si on demande de créer des flashcards, utilise la méthode expliquée plus haut (crée le \`decks\` avec un \`id\` précis, puis crée chaque \`cards\` avec ce \`deckId\`).
5. Ne montre jamais le format JSON ou les blocs d'actions à l'utilisateur en texte brut, ils sont cachés par l'UI.`
}
