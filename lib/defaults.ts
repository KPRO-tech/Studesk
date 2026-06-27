import { db, uid, type ProfileType, type Category, type Subject, type Tag } from './db'

const PALETTE = [
  'oklch(0.6 0.13 250)',
  'oklch(0.6 0.13 150)',
  'oklch(0.62 0.16 25)',
  'oklch(0.7 0.13 70)',
  'oklch(0.58 0.14 320)',
  'oklch(0.6 0.1 195)',
  'oklch(0.5 0.12 40)',
  'oklch(0.55 0.13 290)',
]

const pick = (i: number) => PALETTE[i % PALETTE.length]

interface SeedConfig {
  subjects: string[]
  taskCategories: string[]
  expenseCategories: string[]
  incomeCategories: string[]
  eventCategories: string[]
  tags: string[]
}

const STUDENT: SeedConfig = {
  subjects: ['Mathématiques', 'Histoire', 'Sciences', 'Langues', 'Informatique'],
  taskCategories: ['Devoirs', 'Révisions', 'Projets', 'Administratif'],
  expenseCategories: ['Fournitures', 'Transport', 'Repas', 'Loisirs', 'Logement'],
  incomeCategories: ['Bourse', 'Job étudiant', 'Aide familiale', 'Autre'],
  eventCategories: ['Cours', 'Examen', 'Réunion'],
  tags: ['Urgent', 'Important', 'Facultatif', 'Groupe'],
}

const PERSONAL: SeedConfig = {
  subjects: ['Développement perso', 'Santé', 'Lecture'],
  taskCategories: ['Maison', 'Courses', 'Santé', 'Loisirs'],
  expenseCategories: ['Logement', 'Alimentation', 'Transport', 'Loisirs', 'Santé'],
  incomeCategories: ['Salaire', 'Freelance', 'Remboursement', 'Autre'],
  eventCategories: ['Personnel', 'Rendez-vous', 'Famille'],
  tags: ['Urgent', 'Important', 'Plus tard'],
}

const BUSINESS: SeedConfig = {
  subjects: ['Stratégie', 'Marketing', 'Finance'],
  taskCategories: ['Clients', 'Production', 'Commercial', 'Admin'],
  expenseCategories: ['Salaires', 'Marketing', 'Matériel', 'Logiciels', 'Déplacements'],
  incomeCategories: ['Ventes', 'Prestations', 'Subventions', 'Autre'],
  eventCategories: ['Réunion', 'Présentation', 'Échéance'],
  tags: ['Urgent', 'Prioritaire', 'En attente', 'Client'],
}

const MAP: Record<ProfileType, SeedConfig> = {
  student: STUDENT,
  personal: PERSONAL,
  business: BUSINESS,
}

export async function seedDefaults(userId: string, profiles: ProfileType[]) {
  const now = Date.now()
  const subjects = new Map<string, Subject>()
  const categories: Category[] = []
  const tags = new Map<string, Tag>()
  let ci = 0

  for (const profile of profiles) {
    const cfg = MAP[profile]
    cfg.subjects.forEach((name) => {
      if (!subjects.has(name))
        subjects.set(name, { id: uid(), userId, name, color: pick(ci++), createdAt: now, sync: 'pending' })
    })
    cfg.taskCategories.forEach((name) =>
      categories.push({ id: uid(), userId, kind: 'task', name, color: pick(ci++), createdAt: now, sync: 'pending' }),
    )
    cfg.expenseCategories.forEach((name) =>
      categories.push({ id: uid(), userId, kind: 'expense', name, color: pick(ci++), createdAt: now, sync: 'pending' }),
    )
    cfg.incomeCategories.forEach((name) =>
      categories.push({ id: uid(), userId, kind: 'income', name, color: pick(ci++), createdAt: now, sync: 'pending' }),
    )
    cfg.eventCategories.forEach((name) =>
      categories.push({ id: uid(), userId, kind: 'event', name, color: pick(ci++), createdAt: now, sync: 'pending' }),
    )
    cfg.tags.forEach((name) => {
      if (!tags.has(name))
        tags.set(name, { id: uid(), userId, name, color: pick(ci++), createdAt: now, sync: 'pending' })
    })
  }

  await db.transaction('rw', db.subjects, db.categories, db.tags, async () => {
    await db.subjects.bulkAdd([...subjects.values()])
    await db.categories.bulkAdd(categories)
    await db.tags.bulkAdd([...tags.values()])
  })
}
