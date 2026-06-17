<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        getProductions();
        break;
    case 'POST':
        switch ($action) {
            case 'next_step':
                nextStep();
                break;
            case 'extend_step':
                extendStep();
                break;
            case 'add_journal':
                addJournal();
                break;
            case 'edit_journal':
                editJournal();
                break;
            case 'finish':
                finishProduction();
                break;
            case 'abandon':
                abandonProduction();
                break;
            default:
                createProduction();
        }
        break;
    case 'PUT':
        updateProduction();
        break;
    case 'DELETE':
        $action === 'delete_journal'
            ? deleteJournal((int)($_GET['id'] ?? 0), authenticate(), getDB())
            : deleteProduction();
        break;
    default:
        jsonError('Méthode non autorisée', 405);
}

// ─── Lecture ──────────────────────────────────────────────────────────────────

function getProductions(): void
{
    $userId = authenticate();
    $id     = $_GET['id'] ?? null;
    $db     = getDB();

    if ($id) {
        $stmt = $db->prepare('SELECT * FROM productions WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        $prod = $stmt->fetch();
        if (!$prod) jsonError('Production introuvable', 404);
        jsonOk(hydrateProd($db, $prod, true));
    }

    $stmt = $db->prepare('SELECT * FROM productions WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$userId]);
    $prods = $stmt->fetchAll();
    foreach ($prods as &$p) {
        $p = hydrateProd($db, $p, false);
    }
    jsonOk($prods);
}

function hydrateProd(PDO $db, array $prod, bool $withJournal = false): array
{
    $id = $prod['id'];

    $s = $db->prepare('SELECT * FROM prod_steps WHERE production_id = ? ORDER BY sort_order, id');
    $s->execute([$id]);
    $prod['steps'] = $s->fetchAll();

    if ($withJournal) {
        $j = $db->prepare('SELECT * FROM prod_journal WHERE production_id = ? ORDER BY tasted_at DESC');
        $j->execute([$id]);
        $prod['journal'] = $j->fetchAll();
    } else {
        $prod['journal'] = [];
    }
    return $prod;
}

// ─── Création ─────────────────────────────────────────────────────────────────

function createProduction(): void
{
    $userId = authenticate();
    $d      = jsonInput();
    if (empty(trim($d['name'] ?? ''))) jsonError('Le nom est requis');

    $db = getDB();
    $db->beginTransaction();
    try {
        $stmt = $db->prepare('
            INSERT INTO productions (user_id, name, batch_date, quantity_ml, cost_price, sell_price, status)
            VALUES (?, ?, ?, ?, ?, ?, \'in_progress\')
        ');
        $stmt->execute([
            $userId,
            trim($d['name']),
            !empty($d['batch_date']) ? $d['batch_date'] : null,
            isset($d['quantity_ml']) && $d['quantity_ml'] !== '' ? (float)$d['quantity_ml'] : null,
            isset($d['cost_price'])  && $d['cost_price']  !== '' ? (float)$d['cost_price']  : null,
            isset($d['sell_price'])  && $d['sell_price']  !== '' ? (float)$d['sell_price']  : null,
        ]);
        $prodId = (int) $db->lastInsertId();

        $sStmt = $db->prepare('INSERT INTO prod_steps (production_id, name, duration_days, sort_order) VALUES (?, ?, ?, ?)');
        foreach ((array)($d['steps'] ?? []) as $i => $step) {
            $name = trim($step['name'] ?? '');
            if (!$name) continue;
            $sStmt->execute([$prodId, $name, max(1, (int)($step['duration_days'] ?? 1)), $i]);
        }

        // Démarrer la première étape automatiquement
        $first = $db->prepare('SELECT id FROM prod_steps WHERE production_id = ? ORDER BY sort_order, id LIMIT 1');
        $first->execute([$prodId]);
        $f = $first->fetch();
        if ($f) {
            $db->prepare("UPDATE prod_steps SET status='in_progress', started_at=? WHERE id=?")
                ->execute([date('Y-m-d'), $f['id']]);
        }

        $db->commit();
    } catch (\Exception $e) {
        $db->rollBack();
        jsonError('Erreur création : ' . $e->getMessage(), 500);
    }

    $fetch = $db->prepare('SELECT * FROM productions WHERE id = ?');
    $fetch->execute([$prodId]);
    jsonOk(hydrateProd($db, $fetch->fetch(), true));
}

// ─── Mise à jour infos ────────────────────────────────────────────────────────

function updateProduction(): void
{
    $userId = authenticate();
    $d      = jsonInput();
    if (empty($d['id']))               jsonError('ID manquant');
    if (empty(trim($d['name'] ?? ''))) jsonError('Le nom est requis');

    $db    = getDB();
    $check = $db->prepare('SELECT id FROM productions WHERE id = ? AND user_id = ?');
    $check->execute([$d['id'], $userId]);
    if (!$check->fetch()) jsonError('Production introuvable', 404);

    $db->prepare('
        UPDATE productions SET name=?, batch_date=?, quantity_ml=?, cost_price=?, sell_price=?
        WHERE id=? AND user_id=?
    ')->execute([
        trim($d['name']),
        !empty($d['batch_date']) ? $d['batch_date'] : null,
        isset($d['quantity_ml']) && $d['quantity_ml'] !== '' ? (float)$d['quantity_ml'] : null,
        isset($d['cost_price'])  && $d['cost_price']  !== '' ? (float)$d['cost_price']  : null,
        isset($d['sell_price'])  && $d['sell_price']  !== '' ? (float)$d['sell_price']  : null,
        (int) $d['id'],
        $userId,
    ]);

    $fetch = $db->prepare('SELECT * FROM productions WHERE id = ?');
    $fetch->execute([$d['id']]);
    jsonOk(hydrateProd($db, $fetch->fetch(), false));
}

// ─── Suppression ──────────────────────────────────────────────────────────────

function deleteProduction(): void
{
    $userId = authenticate();
    $id     = $_GET['id'] ?? null;
    if (!$id) jsonError('ID manquant');

    $db   = getDB();
    $stmt = $db->prepare('SELECT id FROM productions WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $userId]);
    if (!$stmt->fetch()) jsonError('Production introuvable', 404);

    $db->prepare('DELETE FROM productions WHERE id = ? AND user_id = ?')->execute([$id, $userId]);
    jsonOk();
}

// ─── Actions étapes ───────────────────────────────────────────────────────────

function nextStep(): void
{
    $userId = authenticate();
    $id     = $_GET['id'] ?? null;
    if (!$id) jsonError('ID manquant');

    $db    = getDB();
    $check = $db->prepare("SELECT id FROM productions WHERE id = ? AND user_id = ? AND status = 'in_progress'");
    $check->execute([$id, $userId]);
    if (!$check->fetch()) jsonError('Production introuvable ou déjà terminée', 404);

    // Terminer l'étape en cours
    $cur = $db->prepare("SELECT id FROM prod_steps WHERE production_id = ? AND status = 'in_progress' ORDER BY sort_order LIMIT 1");
    $cur->execute([$id]);
    $curStep = $cur->fetch();
    if ($curStep) {
        $db->prepare("UPDATE prod_steps SET status='done' WHERE id=?")->execute([$curStep['id']]);
    }

    // Démarrer la prochaine étape en attente
    $nxt = $db->prepare("SELECT id FROM prod_steps WHERE production_id = ? AND status = 'pending' ORDER BY sort_order, id LIMIT 1");
    $nxt->execute([$id]);
    $nxtStep = $nxt->fetch();
    if ($nxtStep) {
        $db->prepare("UPDATE prod_steps SET status='in_progress', started_at=? WHERE id=?")
            ->execute([date('Y-m-d'), $nxtStep['id']]);
    }

    $fetch = $db->prepare('SELECT * FROM productions WHERE id = ?');
    $fetch->execute([$id]);
    jsonOk(hydrateProd($db, $fetch->fetch(), true));
}

function extendStep(): void
{
    $userId = authenticate();
    $d      = jsonInput();
    if (empty($d['step_id'])) jsonError('step_id manquant');
    $days = max(1, (int)($d['days'] ?? 1));

    $db    = getDB();
    $check = $db->prepare('
        SELECT ps.id FROM prod_steps ps
        JOIN productions p ON ps.production_id = p.id
        WHERE ps.id = ? AND p.user_id = ?
    ');
    $check->execute([$d['step_id'], $userId]);
    if (!$check->fetch()) jsonError('Étape introuvable', 404);

    $db->prepare('UPDATE prod_steps SET duration_days = duration_days + ? WHERE id = ?')
        ->execute([$days, $d['step_id']]);
    jsonOk();
}

// ─── Journal ──────────────────────────────────────────────────────────────────

function addJournal(): void
{
    $userId = authenticate();
    $d      = jsonInput();
    if (empty($d['production_id']))          jsonError('production_id manquant');
    if (empty(trim($d['note'] ?? '')))       jsonError('La note est requise');

    $db    = getDB();
    $check = $db->prepare('SELECT id FROM productions WHERE id = ? AND user_id = ?');
    $check->execute([$d['production_id'], $userId]);
    if (!$check->fetch()) jsonError('Production introuvable', 404);

    $stmt = $db->prepare('INSERT INTO prod_journal (production_id, note) VALUES (?, ?)');
    $stmt->execute([$d['production_id'], trim($d['note'])]);
    $newId = $db->lastInsertId();

    $fetch = $db->prepare('SELECT * FROM prod_journal WHERE id = ?');
    $fetch->execute([$newId]);
    jsonOk($fetch->fetch());
}

// ─── Statut production ────────────────────────────────────────────────────────

function editJournal(): void
{
    $userId = authenticate();
    $d      = jsonInput();
    if (empty($d['id']))                jsonError('ID manquant');
    if (empty(trim($d['note'] ?? ''))) jsonError('La note est requise');

    $db    = getDB();
    $check = $db->prepare('
        SELECT pj.id FROM prod_journal pj
        JOIN productions p ON pj.production_id = p.id
        WHERE pj.id = ? AND p.user_id = ?
    ');
    $check->execute([$d['id'], $userId]);
    if (!$check->fetch()) jsonError('Note introuvable', 404);

    $db->prepare('UPDATE prod_journal SET note = ? WHERE id = ?')
        ->execute([trim($d['note']), (int)$d['id']]);
    jsonOk();
}

function deleteJournal(int $id, int $userId, PDO $db): void
{
    $check = $db->prepare('
        SELECT pj.id FROM prod_journal pj
        JOIN productions p ON pj.production_id = p.id
        WHERE pj.id = ? AND p.user_id = ?
    ');
    $check->execute([$id, $userId]);
    if (!$check->fetch()) jsonError('Note introuvable', 404);
    $db->prepare('DELETE FROM prod_journal WHERE id = ?')->execute([$id]);
    jsonOk();
}

function finishProduction(): void
{
    $userId = authenticate();
    $id     = $_GET['id'] ?? null;
    if (!$id) jsonError('ID manquant');

    $db    = getDB();
    $check = $db->prepare('SELECT id FROM productions WHERE id = ? AND user_id = ?');
    $check->execute([$id, $userId]);
    if (!$check->fetch()) jsonError('Production introuvable', 404);

    $db->prepare("UPDATE productions SET status='finished' WHERE id=?")->execute([$id]);
    $db->prepare("UPDATE prod_steps SET status='done' WHERE production_id=? AND status!='done'")->execute([$id]);
    jsonOk();
}

function abandonProduction(): void
{
    $userId = authenticate();
    $id     = $_GET['id'] ?? null;
    if (!$id) jsonError('ID manquant');

    $db    = getDB();
    $check = $db->prepare('SELECT id FROM productions WHERE id = ? AND user_id = ?');
    $check->execute([$id, $userId]);
    if (!$check->fetch()) jsonError('Production introuvable', 404);

    $db->prepare("UPDATE productions SET status='abandoned' WHERE id=?")->execute([$id]);
    jsonOk();
}
