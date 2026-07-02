# Studesk 🎓
> *L'espace de travail ultime conçu par et pour les étudiants.*

Studesk est une plateforme éducative tout-en-un qui centralise l'ensemble des outils nécessaires à la réussite d'un étudiant. Fini la dispersion entre de multiples applications : de la prise de notes intelligente à la gestion du budget, en passant par la génération de quiz par IA et la collaboration en temps réel, Studesk propose un environnement unifié, ultra-rapide et interconnecté.

Ce document décrit en profondeur toutes les fonctionnalités opérationnelles actuelles du Front-End de la plateforme, illustrant la richesse de l'expérience utilisateur et les innovations techniques (comme l'IA et le mode hors-ligne).

---

## 🎯 1. Pôle "Étudier" (Apprentissage et Révision)

Cet espace regroupe les outils de productivité académique, pensés pour maximiser la rétention d'information grâce à des méthodes scientifiquement prouvées et l'assistance de l'IA.

### 📝 Fiches & Cours (Notes)
Un gestionnaire documentaire de pointe, conçu pour la rapidité.
*   **Éditeur de Texte Riche (Rich Text Editor) :** Permet une mise en page claire avec un enregistrement automatique (auto-save en arrière-plan) à chaque modification pour ne jamais rien perdre.
*   **Organisation par Matières :** Chaque note peut être assignée à une matière (avec code couleur personnalisable) et épinglée pour un accès rapide.
*   **Export PDF Intelligent :** Les fiches peuvent être exportées en PDF en un clic. Le système détecte et nettoie automatiquement les caractères non supportés (comme certains emojis ou caractères de contrôle) pour garantir un export propre.
*   **Partage et Visibilité :** Chaque note dispose d'un statut (Privé/Public) permettant de la rendre visible à la communauté Studesk.

### 🧠 Flashcards (Cartes mémoire)
Un système de révision espacée (façon Anki) intégré nativement.
*   **Algorithme SM-2 :** La plateforme gère intelligemment la fréquence d'apparition des cartes en fonction de vos résultats (À revoir, Difficile, Correct, Facile) pour optimiser la mémorisation à long terme.
*   **Historique Détaillé :** Chaque carte possède son propre journal de révision (dates, heures et scores passés) accessible en un clic.
*   **Organisation en Paquets (Decks) :** Les cartes sont regroupées en paquets assignés à vos matières. L'interface affiche le nombre de cartes dues pour le jour même et permet de lancer des sessions de révision immersives.
*   **Visibilité :** Comme pour les notes, les paquets peuvent être rendus publics pour en faire profiter d'autres étudiants.

### 📋 Quiz
Un puissant générateur de QCM, manuel ou propulsé par l'IA.
*   **Génération par Intelligence Artificielle (Skarlet) :** L'outil le plus innovant de cette section. Vous pouvez générer jusqu'à 20 questions automatiquement de 3 manières différentes :
    *   *Sujet / Texte :* En collant un texte libre ou un prompt.
    *   *Depuis une Fiche :* En sélectionnant directement une note déjà créée dans votre espace Studesk.
    *   *Depuis un PDF :* En uploadant un fichier PDF de cours. L'IA extrait le texte, détecte automatiquement la matière, et génère le quiz correspondant.
*   **Mode Manuel et Édition Post-IA :** Les questions générées ou créées manuellement peuvent être éditées. Vous pouvez définir de multiples bonnes réponses, ajouter jusqu'à 6 propositions, et fournir une explication détaillée qui s'affichera lors de la correction.

---

## 📅 2. Pôle "Organiser" (Productivité et Vie Étudiante)

*   **Planning (Calendrier) :** Une vue interactive pour gérer son emploi du temps, ses échéances de projets et ses dates d'examens.
*   **To-Do (Gestion des tâches) :** Un gestionnaire de tâches clair pour dresser des listes d'objectifs quotidiens, avec gestion des priorités et dates limites.
*   **Portefeuille (Budget) :** Un outil de suivi financier permettant d'enregistrer revenus et dépenses. Des indicateurs visuels renseignent l'étudiant sur son budget restant pour le mois.

---

## 🤝 3. Studesk Hub (Social et Collaboration)

L'apprentissage moderne est collaboratif. Le Hub décloisonne le travail solitaire.

### 👥 Workspaces (Groupes de travail)
Bien plus qu'un simple groupe de discussion, le Workspace est un véritable espace de coworking virtuel.
*   **Messagerie en Temps Réel :** Un chat intégré permet aux membres (invités par lien sécurisé par l'administrateur du groupe) d'échanger et de collaborer.
*   **Partage Natif de Ressources :** C'est ici que la synergie opère. Les membres peuvent envoyer directement dans le chat leurs ressources personnelles (une Note, un Paquet de Flashcards, ou un Quiz). 
*   **Aperçu et Importation :** Lorsqu'une ressource est partagée dans le chat, n'importe quel membre peut l'ouvrir en mode "Aperçu" sans quitter le groupe, puis cliquer sur **Importer**. La ressource (ex: un deck de flashcards complet) est alors instantanément copiée dans l'espace personnel de l'étudiant !
*   **Onglet Ressources :** Toutes les pièces jointes et ressources partagées dans le chat sont automatiquement centralisées dans un onglet dédié "Ressources" pour être retrouvées facilement sans remonter l'historique.

### 🌍 Communauté
L'espace d'échange global où les étudiants peuvent découvrir des ressources publiques, partager des méthodes de travail et s'entraider.

---

## ✨ 4. Outils Transversaux, Synergie et Architecture Technique

### 🤖 Skarlet (Assistant IA)
Intégrée au cœur de la plateforme, l'IA ne se contente pas d'être un simple chatbot. Elle est connectée aux fonctionnalités du site (comme vu dans le générateur de Quiz) pour fournir une aide contextuelle, résumer des cours ou générer du matériel d'apprentissage.

### 🔄 Synchronisation et Mode "Offline-First"
C'est l'une des forces majeures de l'architecture de Studesk :
*   **Bases de Données Locales (Dexie/IndexedDB) :** Toutes vos actions (créer une note, répondre à un quiz, ajouter une tâche) sont enregistrées instantanément sur votre appareil. L'application est donc réactive à 100%, sans aucun temps de chargement.
*   **Synchronisation en Arrière-plan :** Lorsque vous êtes hors ligne, vous pouvez continuer à travailler. Vos modifications sont marquées "En attente de synchronisation" (`sync: 'pending'`). Dès que la connexion revient, les données sont synchronisées de manière transparente avec le serveur distant.

### ⚡ Expérience Utilisateur (SPA via Next.js)
*   **Navigation Fluide :** Grâce à la Sidebar persistante, passer de l'outil Budget à vos Flashcards, puis à votre groupe de travail se fait instantanément, sans aucun rechargement de page.
*   **Composants Interactifs :** L'utilisation intensive de Modales (fenêtres superposées), Popovers, et Tiroirs permet de réaliser des actions complexes (créer un groupe, modifier les paramètres d'une carte, partager une ressource) tout en gardant le contexte visuel de la page en cours.

*Note : Cette présentation se base sur l'architecture fonctionnelle actuelle du Front-End. Elle démontre un écosystème d'outils interconnectés prêts à offrir une expérience étudiante d'exception.*
