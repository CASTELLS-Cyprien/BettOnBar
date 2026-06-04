<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        getRecipes();
        break;
    case 'POST':
        switch ($action) {
            case 'upload_photo':    uploadRecipePhoto();  break;
            case 'toggle_favorite': toggleFavorite();     break;
            default:                createRecipe();
        }
        break;
    case 'PUT':    updateRecipe(); break;
    case 'DELETE': deleteRecipe(); break;
    default: jsonError('Méthode non autorisée', 405);
}

function uploadRecipePhoto(): void
{
    authenticate();
    jsonOk(['path' => saveUploadedPhoto('photo')]);
}

function getRecipes(): void
{
    $userId = authenticate();
    $db     = getDB();
    $id     = $_GET['id'] ?? null;

    if ($id) {
        $stmt = $db->prepare('SELECT * FROM recipes WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        $recipe = $stmt->fetch();
        if (!$recipe) jsonError('Recette introuvable', 404);
        jsonOk(hydrateRecipe($db, $recipe));
    }

    $stmt = $db->prepare('SELECT * FROM recipes WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$userId]);
    $recipes = $stmt->fetchAll();
    foreach ($recipes as &$r) {
        $r = hydrateRecipe($db, $r);
    }
    jsonOk($recipes);
}

function hydrateRecipe(PDO $db, array $recipe): array
{
    $id = $recipe['id'];

    $ing = $db->prepare('SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY sort_order, id');
    $ing->execute([$id]);
    $recipe['ingredients'] = $ing->fetchAll();

    $stp = $db->prepare('SELECT * FROM recipe_steps WHERE recipe_id = ? ORDER BY step_order');
    $stp->execute([$id]);
    $recipe['steps'] = $stp->fetchAll();

    return $recipe;
}

function createRecipe(): void
{
    $userId = authenticate();
    $d      = jsonInput();
    if (empty(trim($d['name'] ?? ''))) jsonError('Le nom de la recette est requis');

    $db = getDB();
    $db->beginTransaction();
    try {
        $stmt = $db->prepare('
            INSERT INTO recipes (user_id, name, photo, difficulty, prep_time, servings, notes, user_rating)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $userId,
            trim($d['name']),
            !empty($d['photo'])     ? $d['photo']        : null,
            max(1, min(3, (int)($d['difficulty'] ?? 1))),
            isset($d['prep_time'])  && $d['prep_time']  !== '' ? (int)$d['prep_time']  : null,
            max(1, (int)($d['servings'] ?? 1)),
            trim($d['notes'] ?? ''),
            isset($d['user_rating']) && (float)$d['user_rating'] > 0 ? (float)$d['user_rating'] : null,
        ]);
        $recipeId = (int) $db->lastInsertId();
        insertIngredientsAndSteps($db, $recipeId, $d);
        $db->commit();
    } catch (\Exception $e) {
        $db->rollBack();
        jsonError('Erreur lors de la création : ' . $e->getMessage(), 500);
    }

    $fetch = $db->prepare('SELECT * FROM recipes WHERE id = ?');
    $fetch->execute([$recipeId]);
    jsonOk(hydrateRecipe($db, $fetch->fetch()));
}

function updateRecipe(): void
{
    $userId = authenticate();
    $d      = jsonInput();
    if (empty($d['id']))               jsonError('ID manquant');
    if (empty(trim($d['name'] ?? ''))) jsonError('Le nom est requis');

    $db    = getDB();
    $check = $db->prepare('SELECT photo FROM recipes WHERE id = ? AND user_id = ?');
    $check->execute([$d['id'], $userId]);
    $old   = $check->fetch();
    if (!$old) jsonError('Recette introuvable', 404);

    // Clean up old photo if replaced
    $newPhoto = !empty($d['photo']) ? $d['photo'] : null;
    if ($old['photo'] && $newPhoto && $old['photo'] !== $newPhoto) {
        $p = __DIR__ . '/../' . $old['photo'];
        if (file_exists($p)) @unlink($p);
    }

    $db->beginTransaction();
    try {
        $stmt = $db->prepare('
            UPDATE recipes
            SET name=?, photo=?, difficulty=?, prep_time=?, servings=?, notes=?, user_rating=?
            WHERE id=? AND user_id=?
        ');
        $stmt->execute([
            trim($d['name']),
            $newPhoto,
            max(1, min(3, (int)($d['difficulty'] ?? 1))),
            isset($d['prep_time']) && $d['prep_time'] !== '' ? (int)$d['prep_time'] : null,
            max(1, (int)($d['servings'] ?? 1)),
            trim($d['notes'] ?? ''),
            isset($d['user_rating']) && (float)$d['user_rating'] > 0 ? (float)$d['user_rating'] : null,
            (int) $d['id'],
            $userId,
        ]);
        // Replace ingredients and steps
        $db->prepare('DELETE FROM ingredients  WHERE recipe_id = ?')->execute([$d['id']]);
        $db->prepare('DELETE FROM recipe_steps WHERE recipe_id = ?')->execute([$d['id']]);
        insertIngredientsAndSteps($db, (int) $d['id'], $d);
        $db->commit();
    } catch (\Exception $e) {
        $db->rollBack();
        jsonError('Erreur lors de la mise à jour : ' . $e->getMessage(), 500);
    }

    $fetch = $db->prepare('SELECT * FROM recipes WHERE id = ?');
    $fetch->execute([$d['id']]);
    jsonOk(hydrateRecipe($db, $fetch->fetch()));
}

function deleteRecipe(): void
{
    $userId = authenticate();
    $id     = $_GET['id'] ?? null;
    if (!$id) jsonError('ID manquant');

    $db   = getDB();
    $stmt = $db->prepare('SELECT photo FROM recipes WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $userId]);
    $row  = $stmt->fetch();
    if (!$row) jsonError('Recette introuvable', 404);

    if (!empty($row['photo'])) {
        $p = __DIR__ . '/../' . $row['photo'];
        if (file_exists($p)) @unlink($p);
    }
    $db->prepare('DELETE FROM recipes WHERE id = ? AND user_id = ?')->execute([$id, $userId]);
    jsonOk();
}

function toggleFavorite(): void
{
    $userId = authenticate();
    $id     = $_GET['id'] ?? null;
    if (!$id) jsonError('ID manquant');

    $db   = getDB();
    $stmt = $db->prepare('SELECT is_favorite FROM recipes WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $userId]);
    $row  = $stmt->fetch();
    if (!$row) jsonError('Recette introuvable', 404);

    $newVal = $row['is_favorite'] ? 0 : 1;
    $db->prepare('UPDATE recipes SET is_favorite=? WHERE id=? AND user_id=?')
       ->execute([$newVal, $id, $userId]);
    jsonOk(['is_favorite' => $newVal]);
}

function insertIngredientsAndSteps(PDO $db, int $recipeId, array $d): void
{
    $ingStmt = $db->prepare('
        INSERT INTO ingredients (recipe_id, name, quantity, unit, alcohol_pct, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
    ');
    foreach ((array)($d['ingredients'] ?? []) as $i => $ing) {
        $name = trim($ing['name'] ?? '');
        if (!$name) continue;
        $ingStmt->execute([
            $recipeId,
            $name,
            max(0, (float)($ing['quantity'] ?? 0)),
            $ing['unit'] ?? 'cl',
            max(0, min(100, (float)($ing['alcohol_pct'] ?? 0))),
            (int) $i,
        ]);
    }

    $stepStmt = $db->prepare('
        INSERT INTO recipe_steps (recipe_id, step_order, instruction)
        VALUES (?, ?, ?)
    ');
    foreach ((array)($d['steps'] ?? []) as $i => $step) {
        $instruction = trim($step['instruction'] ?? '');
        if (!$instruction) continue;
        $stepStmt->execute([$recipeId, $i + 1, $instruction]);
    }
}
