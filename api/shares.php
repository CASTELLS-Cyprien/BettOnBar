<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        getShares();
        break;
    case 'POST':
        createShare();
        break;
    case 'DELETE':
        deleteShare();
        break;
    default:
        jsonError('Méthode non autorisée', 405);
}

function getShares(): void
{
    $userId = authenticate();
    $db     = getDB();

    // Partages sortants : qui a accès à MON bar
    $out = $db->prepare('
        SELECT bs.id, bs.guest_id, bs.can_write, bs.created_at, u.username AS guest_username
        FROM bar_shares bs
        JOIN users u ON bs.guest_id = u.id
        WHERE bs.owner_id = ?
        ORDER BY bs.created_at DESC
    ');
    $out->execute([$userId]);

    // Partages entrants : bars partagés AVEC moi
    $in = $db->prepare('
        SELECT bs.id, bs.owner_id, bs.can_write, bs.created_at, u.username AS owner_username
        FROM bar_shares bs
        JOIN users u ON bs.owner_id = u.id
        WHERE bs.guest_id = ?
        ORDER BY bs.created_at DESC
    ');
    $in->execute([$userId]);

    jsonOk([
        'outgoing' => $out->fetchAll(),
        'incoming' => $in->fetchAll(),
    ]);
}

function createShare(): void
{
    $userId = authenticate();
    $d      = jsonInput();

    if (empty($d['guest_id']))       jsonError('guest_id manquant');
    if ((int)$d['guest_id'] === $userId) jsonError('Vous ne pouvez pas partager avec vous-même');

    $db = getDB();

    $check = $db->prepare('SELECT id FROM users WHERE id = ?');
    $check->execute([$d['guest_id']]);
    if (!$check->fetch()) jsonError('Utilisateur introuvable', 404);

    $exists = $db->prepare('SELECT id FROM bar_shares WHERE owner_id = ? AND guest_id = ?');
    $exists->execute([$userId, $d['guest_id']]);
    if ($exists->fetch()) jsonError('Cet utilisateur a déjà accès à votre bar');

    $stmt = $db->prepare('INSERT INTO bar_shares (owner_id, guest_id, can_write) VALUES (?, ?, ?)');
    $stmt->execute([$userId, (int)$d['guest_id'], empty($d['can_write']) ? 0 : 1]);

    $id = $db->lastInsertId();
    $fetch = $db->prepare('
        SELECT bs.id, bs.guest_id, bs.can_write, bs.created_at, u.username AS guest_username
        FROM bar_shares bs JOIN users u ON bs.guest_id = u.id
        WHERE bs.id = ?
    ');
    $fetch->execute([$id]);
    jsonOk($fetch->fetch());
}

function deleteShare(): void
{
    $userId = authenticate();
    $id     = $_GET['id'] ?? null;
    if (!$id) jsonError('ID manquant');

    $db    = getDB();
    $check = $db->prepare('SELECT id FROM bar_shares WHERE id = ? AND owner_id = ?');
    $check->execute([$id, $userId]);
    if (!$check->fetch()) jsonError('Partage introuvable', 404);

    $db->prepare('DELETE FROM bar_shares WHERE id = ? AND owner_id = ?')->execute([$id, $userId]);
    jsonOk();
}
