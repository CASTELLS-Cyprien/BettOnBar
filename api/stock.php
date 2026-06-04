<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':    getStock();        break;
    case 'POST':
        $action === 'adjust' ? adjustQty() : createItem();
        break;
    case 'PUT':    updateItem();  break;
    case 'DELETE': deleteItem();  break;
    default: jsonError('Méthode non autorisée', 405);
}

function getStock(): void
{
    $userId = authenticate();
    $db     = getDB();
    $stmt   = $db->prepare('SELECT * FROM stock_ingredients WHERE user_id = ? ORDER BY name COLLATE NOCASE');
    $stmt->execute([$userId]);
    jsonOk($stmt->fetchAll());
}

function createItem(): void
{
    $userId = authenticate();
    $d      = jsonInput();
    if (empty(trim($d['name'] ?? ''))) jsonError('Le nom est requis');

    $db   = getDB();
    $stmt = $db->prepare('INSERT INTO stock_ingredients (user_id, name, description, quantity, unit) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([
        $userId,
        trim($d['name']),
        trim($d['description'] ?? ''),
        max(0, (float)($d['quantity'] ?? 0)),
        $d['unit'] ?? 'unité',
    ]);
    $id    = $db->lastInsertId();
    $fetch = $db->prepare('SELECT * FROM stock_ingredients WHERE id = ?');
    $fetch->execute([$id]);
    jsonOk($fetch->fetch());
}

function updateItem(): void
{
    $userId = authenticate();
    $d      = jsonInput();
    if (empty($d['id']))               jsonError('ID manquant');
    if (empty(trim($d['name'] ?? ''))) jsonError('Le nom est requis');

    $db    = getDB();
    $check = $db->prepare('SELECT id FROM stock_ingredients WHERE id = ? AND user_id = ?');
    $check->execute([$d['id'], $userId]);
    if (!$check->fetch()) jsonError('Ingrédient introuvable', 404);

    $db->prepare('UPDATE stock_ingredients SET name=?, description=?, quantity=?, unit=? WHERE id=? AND user_id=?')
       ->execute([
           trim($d['name']),
           trim($d['description'] ?? ''),
           max(0, (float)($d['quantity'] ?? 0)),
           $d['unit'] ?? 'unité',
           (int) $d['id'],
           $userId,
       ]);
    $fetch = $db->prepare('SELECT * FROM stock_ingredients WHERE id = ?');
    $fetch->execute([$d['id']]);
    jsonOk($fetch->fetch());
}

function deleteItem(): void
{
    $userId = authenticate();
    $id     = $_GET['id'] ?? null;
    if (!$id) jsonError('ID manquant');

    $db    = getDB();
    $check = $db->prepare('SELECT id FROM stock_ingredients WHERE id = ? AND user_id = ?');
    $check->execute([$id, $userId]);
    if (!$check->fetch()) jsonError('Ingrédient introuvable', 404);

    $db->prepare('DELETE FROM stock_ingredients WHERE id = ? AND user_id = ?')->execute([$id, $userId]);
    jsonOk();
}

function adjustQty(): void
{
    $userId = authenticate();
    $d      = jsonInput();
    if (empty($d['id'])) jsonError('ID manquant');
    $delta  = (float)($d['delta'] ?? 0);

    $db    = getDB();
    $check = $db->prepare('SELECT quantity FROM stock_ingredients WHERE id = ? AND user_id = ?');
    $check->execute([$d['id'], $userId]);
    $row   = $check->fetch();
    if (!$row) jsonError('Ingrédient introuvable', 404);

    $newQty = max(0, (float)$row['quantity'] + $delta);
    $db->prepare('UPDATE stock_ingredients SET quantity = ? WHERE id = ? AND user_id = ?')
       ->execute([$newQty, (int)$d['id'], $userId]);
    jsonOk(['quantity' => $newQty]);
}
