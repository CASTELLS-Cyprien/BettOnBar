# BettOnBar

Application web de gestion de bar personnelle pour le client Betton.
Jeu de mots : Betton + Bar + "Bet on bar" (miser sur son bar).

## Stack — aucune exception

- **Backend** : PHP 8 pur, PDO SQLite (`data/bettonbar.db`)
- **Frontend** : Vanilla JS SPA, vanilla CSS mobile-first
- **Auth** : token Bearer dans localStorage (`bettonbar_token`)
- **Photos** : stockage local dans `data/uploads/`
- **Principe** : zéro appel externe, zéro framework, zéro dépendance

## Structure

```
/
├── index.html
├── app.js
├── style.css
├── api/
│   ├── config.php       ← getDB(), initDB(), authenticate(), jsonInput()
│   ├── auth.php         ← register, login, logout, check, users
│   ├── bottles.php      ← CRUD bouteilles + upload photo
│   ├── recipes.php      ← CRUD recettes + ingrédients + étapes
│   ├── productions.php  ← CRUD alcools maison + étapes + journal
│   └── shares.php       ← partage de bar entre utilisateurs
└── data/
    ├── bettonbar.db
    └── uploads/
```

## Tables SQLite

users, sessions, bar_shares, bottles, recipes, ingredients,
recipe_steps, productions, prod_steps, prod_journal

## Vues JS (navigate())

auth, home, bottles, bottle-form, recipes, recipe-view,
recipe-form, suggest, personal, productions, production-view,
production-form, settings

## Logiques métier clés

- Degré alcool cocktail : Σ(volume × pct) / volume_total  (JS, pas en base)
- Portions : quantité × (demandé / base)  (JS, temps réel)
- Alerte bouteille : fill_pct ≤ 15 → badge "À racheter"
- Suggestion bar : matching nom ingrédient ↔ bouteille (case-insensitive)
- Alerte production : started_at + duration_days < aujourd'hui → "À valider"
- Rentabilité : (sell_price - cost_price) / cost_price × 100

## Règles de code

- Requêtes PDO préparées uniquement (jamais de concat SQL)
- Chaque PHP commence par require_once __DIR__ . '/config.php'
- Erreurs → {"error": "message"} — Succès → {"ok": true} ou objet
- Photos : jpg/png/webp/gif, max 5MB, renommées en UUID
- JS : render(), navigate(), toast(), esc(), icon(), post(), put(), del()
- CSS : .card .btn .input .chip .toast .tabs .tab .back-btn .list-item .empty-state
