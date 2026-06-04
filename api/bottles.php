<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($action === 'upload_photo') {
    if ($method !== 'POST') jsonError('Méthode non autorisée', 405);
    uploadPhoto();
}

switch ($method) {
    case 'GET':    getBottles();    break;
    case 'POST':   createBottle(); break;
    case 'PUT':    updateBottle(); break;
    case 'DELETE': deleteBottle(); break;
    default: jsonError('Méthode non autorisée', 405);
}

function uploadPhoto(): void
{
    authenticate();
    jsonOk(['path' => saveUploadedPhoto('photo')]);
}

function getBottles(): void
{
    $userId = authenticate();
    $db     = getDB();
    $stmt   = $db->prepare('SELECT * FROM bottles WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$userId]);
    jsonOk($stmt->fetchAll());
}

function createBottle(): void
{
    $userId = authenticate();
    $b      = jsonInput();
    if (empty(trim($b['name'] ?? ''))) jsonError('Le nom de la bouteille est requis');
    if (empty(trim($b['type'] ?? ''))) jsonError('Le type est requis');

    $db   = getDB();
    $stmt = $db->prepare('
        INSERT INTO bottles
            (user_id, type, brand, name, price, shop, photo, opened_at, vintage, storage, description, comment, rating, fill_pct)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute(bottleParams($userId, $b));
    $id    = (int) $db->lastInsertId();
    $fetch = $db->prepare('SELECT * FROM bottles WHERE id = ?');
    $fetch->execute([$id]);
    jsonOk($fetch->fetch());
}

function updateBottle(): void
{
    $userId = authenticate();
    $b      = jsonInput();
    if (empty($b['id']))                jsonError('ID manquant');
    if (empty(trim($b['name'] ?? '')))  jsonError('Le nom est requis');
    if (empty(trim($b['type'] ?? '')))  jsonError('Le type est requis');

    $db    = getDB();
    $check = $db->prepare('SELECT photo FROM bottles WHERE id = ? AND user_id = ?');
    $check->execute([$b['id'], $userId]);
    $old   = $check->fetch();
    if (!$old) jsonError('Bouteille introuvable', 404);

    // Delete old photo file if replaced
    $newPhoto = !empty($b['photo']) ? $b['photo'] : null;
    if ($old['photo'] && $newPhoto && $old['photo'] !== $newPhoto) {
        $oldPath = __DIR__ . '/../' . $old['photo'];
        if (file_exists($oldPath)) @unlink($oldPath);
    }

    $stmt = $db->prepare('
        UPDATE bottles
        SET type=?, brand=?, name=?, price=?, shop=?, photo=?, opened_at=?, vintage=?, storage=?, description=?, comment=?, rating=?, fill_pct=?
        WHERE id=? AND user_id=?
    ');
    $params   = bottleParams($userId, $b);
    $params[] = (int) $b['id'];
    $params[] = $userId;
    array_shift($params); // remove user_id at position 0 (not needed in SET)
    // rebuild: type, brand, name, price, shop, photo, opened_at, vintage, storage, description, comment, rating, fill_pct, id, user_id
    $stmt->execute([
        trim($b['type']),
        trim($b['brand'] ?? ''),
        trim($b['name']),
        isset($b['price'])   && $b['price']   !== '' ? (float)$b['price']   : null,
        trim($b['shop'] ?? ''),
        $newPhoto,
        !empty($b['opened_at']) ? $b['opened_at'] : null,
        isset($b['vintage']) && $b['vintage'] !== '' ? (int)$b['vintage']   : null,
        trim($b['storage'] ?? ''),
        trim($b['description'] ?? ''),
        trim($b['comment'] ?? ''),
        isset($b['rating'])  && $b['rating']  !== '' ? (float)$b['rating']  : null,
        max(0, min(100, (int)($b['fill_pct'] ?? 100))),
        (int) $b['id'],
        $userId,
    ]);
    $fetch = $db->prepare('SELECT * FROM bottles WHERE id = ?');
    $fetch->execute([$b['id']]);
    jsonOk($fetch->fetch());
}

function deleteBottle(): void
{
    $userId = authenticate();
    $id     = $_GET['id'] ?? null;
    if (!$id) jsonError('ID manquant');

    $db   = getDB();
    $stmt = $db->prepare('SELECT photo FROM bottles WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $userId]);
    $row  = $stmt->fetch();
    if (!$row) jsonError('Bouteille introuvable', 404);

    if (!empty($row['photo'])) {
        $path = __DIR__ . '/../' . $row['photo'];
        if (file_exists($path)) @unlink($path);
    }
    $db->prepare('DELETE FROM bottles WHERE id = ? AND user_id = ?')->execute([$id, $userId]);
    jsonOk();
}

function bottleParams(int $userId, array $b): array
{
    return [
        $userId,
        trim($b['type']),
        trim($b['brand'] ?? ''),
        trim($b['name']),
        isset($b['price'])   && $b['price']   !== '' ? (float)$b['price']   : null,
        trim($b['shop'] ?? ''),
        !empty($b['photo'])     ? $b['photo']     : null,
        !empty($b['opened_at']) ? $b['opened_at'] : null,
        isset($b['vintage']) && $b['vintage'] !== '' ? (int)$b['vintage']   : null,
        trim($b['storage'] ?? ''),
        trim($b['description'] ?? ''),
        trim($b['comment'] ?? ''),
        isset($b['rating'])  && $b['rating']  !== '' ? (float)$b['rating']  : null,
        max(0, min(100, (int)($b['fill_pct'] ?? 100))),
    ];
}
