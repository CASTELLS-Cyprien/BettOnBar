# Prompt de démarrage — Projet BettOnBar

Colle ce prompt dans Claude Code (VSCode) pour démarrer le projet.
Fournis aussi le cahier des charges PDF en pièce jointe si Claude Code le permet.

---

## PROMPT À COLLER

Tu vas développer une application web appelée **BettOnBar** — une app de gestion de bar personnelle (inventaire de bouteilles, recettes de cocktails, alcools faits maison).

Je t'explique tous les choix techniques et fonctionnels déjà arrêtés. Respecte-les sans les remettre en question.

---

## 1. STACK TECHNIQUE — NON NÉGOCIABLE

- **Backend** : PHP 8 pur, pas de framework (pas de Laravel, pas de Symfony)
- **Base de données** : SQLite via PDO (un seul fichier `data/bettonbar.db`)
- **Frontend** : Vanilla JS pur, pas de framework (pas de React, Vue, etc.)
- **CSS** : Vanilla CSS responsive, mobile-first
- **Pattern frontend** : SPA (Single Page Application) — une seule page `index.html`, navigation gérée en JS avec une fonction `navigate(view, data)`
- **Auth** : Token Bearer stocké dans `localStorage`, sessions en base
- **Photos** : Upload et stockage local dans `data/uploads/`
- **Principe fondamental** : AUCUN appel à des APIs ou sources externes. Toutes les données sont saisies manuellement par l'utilisateur.

---

## 2. STRUCTURE DES FICHIERS

Crée exactement cette structure :

```
/
├── index.html
├── app.js
├── style.css
├── favicon.png (vide ou placeholder)
├── api/
│   ├── config.php
│   ├── auth.php
│   ├── bottles.php
│   ├── recipes.php
│   ├── productions.php
│   └── shares.php
└── data/
    ├── .gitkeep
    └── uploads/
        └── .gitkeep
```

---

## 3. BASE DE DONNÉES — SCHÉMA COMPLET

Dans `config.php`, la fonction `initDB()` doit créer ces tables si elles n'existent pas :

```sql
-- Utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions auth
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Partage de bar entre utilisateurs
CREATE TABLE IF NOT EXISTS bar_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    guest_id INTEGER NOT NULL,
    can_write INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (guest_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(owner_id, guest_id)
);

-- Bouteilles (inventaire du bar)
CREATE TABLE IF NOT EXISTS bottles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    brand TEXT DEFAULT '',
    name TEXT NOT NULL,
    price REAL DEFAULT NULL,
    shop TEXT DEFAULT '',
    photo TEXT DEFAULT NULL,
    opened_at DATE DEFAULT NULL,
    vintage INTEGER DEFAULT NULL,
    storage TEXT DEFAULT '',
    description TEXT DEFAULT '',
    comment TEXT DEFAULT '',
    rating REAL DEFAULT NULL,
    fill_pct INTEGER DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Recettes de cocktails
CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    photo TEXT DEFAULT NULL,
    difficulty INTEGER DEFAULT 1,
    prep_time INTEGER DEFAULT NULL,
    servings INTEGER DEFAULT 1,
    notes TEXT DEFAULT '',
    is_favorite INTEGER DEFAULT 0,
    user_rating REAL DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Ingrédients d'une recette
CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT DEFAULT 'cl',
    alcohol_pct REAL DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- Étapes de préparation d'une recette
CREATE TABLE IF NOT EXISTS recipe_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL,
    step_order INTEGER NOT NULL,
    instruction TEXT NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- Productions d'alcools faits maison
CREATE TABLE IF NOT EXISTS productions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    batch_date DATE DEFAULT NULL,
    quantity_ml REAL DEFAULT NULL,
    cost_price REAL DEFAULT NULL,
    sell_price REAL DEFAULT NULL,
    status TEXT DEFAULT 'in_progress',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Étapes de fabrication d'une production
CREATE TABLE IF NOT EXISTS prod_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    production_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    duration_days INTEGER NOT NULL,
    started_at DATE DEFAULT NULL,
    status TEXT DEFAULT 'pending',
    notes TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (production_id) REFERENCES productions(id) ON DELETE CASCADE
);

-- Journal de dégustation / notes d'évolution
CREATE TABLE IF NOT EXISTS prod_journal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    production_id INTEGER NOT NULL,
    note TEXT NOT NULL,
    tasted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (production_id) REFERENCES productions(id) ON DELETE CASCADE
);
```

---

## 4. PATTERN PHP — config.php

`config.php` doit exporter ces fonctions utilitaires utilisées dans tous les autres fichiers PHP :

```php
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
// ... CORS headers

define('DB_PATH', __DIR__ . '/../data/bettonbar.db');

function getDB(): PDO { ... }       // retourne une instance PDO SQLite avec foreign_keys ON
function initDB(): void { ... }     // crée toutes les tables si elles n'existent pas
function authenticate(): int { ... } // vérifie le token Bearer, retourne user_id ou 401
function jsonInput(): array { ... }  // json_decode(file_get_contents('php://input'))
```

---

## 5. ROUTES PHP PAR FICHIER

### auth.php
- `POST ?action=register` → créer un compte (username + password)
- `POST ?action=login` → connexion, retourne token
- `POST ?action=logout` → invalide le token
- `GET  ?action=check` → vérifie le token, retourne user info
- `GET  ?action=users` → liste tous les utilisateurs (pour le partage)

### bottles.php (authentifié)
- `GET`              → liste les bouteilles de l'utilisateur connecté
- `POST`             → créer une bouteille (multipart/form-data pour la photo)
- `PUT`              → modifier une bouteille
- `DELETE ?id=`      → supprimer une bouteille
- `POST ?action=upload_photo` → upload photo, retourne le chemin

### recipes.php (authentifié)
- `GET`              → liste les recettes (avec leurs ingrédients et étapes)
- `GET ?id=`         → une recette complète
- `POST`             → créer recette + ingrédients + étapes en une seule requête
- `PUT`              → modifier recette + ingrédients + étapes
- `DELETE ?id=`      → supprimer recette

### productions.php (authentifié)
- `GET`              → liste les productions avec leurs étapes
- `GET ?id=`         → une production complète avec étapes + journal
- `POST`             → créer production + étapes
- `PUT`              → modifier production
- `DELETE ?id=`      → supprimer production
- `POST ?action=next_step&id=` → passer à l'étape suivante
- `POST ?action=extend_step`   → rallonger la durée d'une étape (body: step_id, days)
- `POST ?action=add_journal`   → ajouter une note au journal
- `POST ?action=finish&id=`    → marquer la production comme terminée
- `POST ?action=abandon&id=`   → abandonner la production

### shares.php (authentifié)
- `GET`              → liste les bars partagés avec moi + mes partages sortants
- `POST`             → partager mon bar avec un utilisateur (body: guest_id, can_write)
- `DELETE ?id=`      → retirer un accès partagé

---

## 6. PATTERN FRONTEND — app.js

Reprends exactement ce pattern (inspiré de l'app pétanque déjà codée) :

```javascript
// Variables globales
var API = 'api', token = localStorage.getItem('bettonbar_token') || null;
var currentUser = JSON.parse(localStorage.getItem('bettonbar_user') || 'null');
var state = {};

// Helpers de base
async function api(ep, opts) { /* fetch avec Authorization header, gestion 401 */ }
function post(u, b) { return api(u, { method: 'POST', body: JSON.stringify(b) }); }
function put(u, b)  { return api(u, { method: 'PUT',  body: JSON.stringify(b) }); }
function del(u)     { return api(u, { method: 'DELETE' }); }
function render(h)  { document.getElementById('app').innerHTML = h; }
function navigate(view, data) { /* dispatch vers renderXxx() */ }
function toast(msg) { /* notification temporaire en bas */ }
function esc(s)     { /* escape HTML */ }
function icon(name, size) { /* retourne SVG inline Feather icons */ }
```

### Vues à implémenter :
- `renderAuth()` → login / register
- `renderHome()` → page principale avec onglets
- `renderBottles()` → liste des bouteilles avec filtres
- `renderBottleForm(id?)` → formulaire ajout/édition bouteille
- `renderRecipes()` → liste des recettes
- `renderRecipeView(id)` → fiche recette (calcul portions + degré alcool)
- `renderRecipeForm(id?)` → formulaire ajout/édition recette
- `renderSuggest()` → "Que puis-je faire avec mon bar ?"
- `renderPersonal()` → favoris + recettes notées
- `renderProductions()` → liste des productions maison
- `renderProductionView(id)` → suivi étapes + journal
- `renderProductionForm(id?)` → formulaire ajout/édition production
- `renderSettings()` → partage de bar + compte

---

## 7. LOGIQUES MÉTIER IMPORTANTES

### Calcul du degré d'alcool d'un cocktail
```
degré_final = Σ(volume_ingrédient × alcool_pct) / volume_total
```
Calculé côté JS dans `renderRecipeView()`, jamais en base.

### Calcul des portions
Quand l'utilisateur change le nombre de personnes dans la fiche recette :
```
quantité_affichée = quantité_base × (personnes_demandées / servings_base)
```

### Alerte bouteille vide
Dans `renderBottles()`, si `fill_pct <= 15`, afficher un badge rouge "À racheter".

### Module "Que puis-je faire ?"
Pour chaque recette, comparer ses ingrédients avec les bouteilles du bar :
- **Réalisable** : tous les ingrédients ont une bouteille correspondante avec `fill_pct > 0`
- **Presque réalisable** : 1 ou 2 ingrédients manquants
- La correspondance se fait par nom (case-insensitive, correspondance partielle tolérée)

### Alertes productions maison
Dans `renderProductions()`, pour chaque étape `in_progress` :
- Calculer `started_at + duration_days`
- Si la date est dépassée → afficher badge orange "Étape à valider"
- Si toutes les étapes sont terminées → badge vert "Prêt !"

### Rentabilité production
```
profit = sell_price - cost_price
marge_pct = (profit / cost_price) × 100
```
Afficher avec un indicateur visuel (vert si positif, rouge si négatif).

---

## 8. STYLE CSS

- Palette sobre : fond blanc/gris très clair, accent bleu foncé ou vert bouteille
- Même composants que l'app pétanque : `.card`, `.btn`, `.input`, `.chip`, `.toast`, `.avatar`, `.tabs`, `.tab`, `.back-btn`, `.list-item`, `.empty-state`
- Responsive : tout fonctionne sur iPhone (375px) sans scroll horizontal
- Pas de dépendance externe CSS (pas de Bootstrap, pas de Tailwind)

---

## 9. ORDRE DE DÉVELOPPEMENT

Développe dans cet ordre, fichier par fichier, en attendant ma validation entre chaque étape :

1. `config.php` + `initDB()` + schéma complet
2. `auth.php` + vues auth dans `app.js` (login/register)
3. `style.css` complet
4. `bottles.php` + `renderBottles()` + `renderBottleForm()`
5. `recipes.php` + `renderRecipes()` + `renderRecipeView()` + `renderRecipeForm()`
6. Logique "Que puis-je faire ?" dans `renderSuggest()`
7. `productions.php` + vues productions
8. `shares.php` + `renderSettings()`
9. Espace personnel (`renderPersonal()` — favoris + notes)

---

## 10. RÈGLES GÉNÉRALES

- Jamais de framework, jamais de dépendance npm/composer
- Tout le JS dans `app.js`, tout le CSS dans `style.css`
- Chaque fichier PHP commence par `require_once __DIR__ . '/config.php';`
- Les erreurs PHP retournent du JSON : `{"error": "message"}`
- Les succès retournent du JSON : `{"ok": true}` ou l'objet créé
- Upload de photos : vérifier extension (jpg/png/webp/gif), taille max 5MB, renommer en UUID
- Toujours utiliser des requêtes préparées PDO (jamais de concaténation SQL)
- Mobile-first : tester mentalement chaque vue sur un écran de 375px

---

**Commence par l'étape 1 : crée `api/config.php` avec `getDB()`, `initDB()`, `authenticate()`, `jsonInput()` et le schéma SQL complet. Attends ma validation avant de passer à la suite.**
