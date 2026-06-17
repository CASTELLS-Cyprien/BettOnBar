<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'register':
        if ($method !== 'POST') jsonError('Méthode non autorisée', 405);
        handleRegister();
        break;
    case 'login':
        if ($method !== 'POST') jsonError('Méthode non autorisée', 405);
        handleLogin();
        break;
    case 'logout':
        if ($method !== 'POST') jsonError('Méthode non autorisée', 405);
        handleLogout();
        break;
    case 'check':
        if ($method !== 'GET') jsonError('Méthode non autorisée', 405);
        handleCheck();
        break;
    case 'change_password':
        if ($method !== 'POST') jsonError('Méthode non autorisée', 405);
        handleChangePassword();
        break;
    case 'change_username':
        if ($method !== 'POST') jsonError('Méthode non autorisée', 405);
        handleChangeUsername();
        break;
    case 'delete_account':
        if ($method !== 'POST') jsonError('Méthode non autorisée', 405);
        handleDeleteAccount();
        break;
    case 'users':
        if ($method !== 'GET') jsonError('Méthode non autorisée', 405);
        handleUsers();
        break;
    default:
        jsonError('Action inconnue');
}

function handleRegister(): void
{
    $body = jsonInput();
    $username = trim($body['username'] ?? '');
    $password = $body['password'] ?? '';

    if (strlen($username) < 3) {
        jsonError("L'identifiant doit contenir au moins 3 caractères");
    }
    if (!preg_match('/^[a-zA-Z0-9_\-\.]+$/', $username)) {
        jsonError("L'identifiant ne peut contenir que des lettres, chiffres, _ - .");
    }
    if (strlen($password) < 6) {
        jsonError('Le mot de passe doit contenir au moins 6 caractères');
    }

    $db = getDB();
    $stmt = $db->prepare('SELECT id FROM users WHERE username = ?');
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        jsonError('Cet identifiant est déjà utilisé');
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $db->prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    $stmt->execute([$username, $hash]);
    $userId = (int) $db->lastInsertId();

    $token = createSession($db, $userId);
    jsonOk([
        'token' => $token,
        'user'  => ['id' => $userId, 'username' => $username],
    ]);
}

function handleLogin(): void
{
    $body = jsonInput();
    $username = trim($body['username'] ?? '');
    $password = $body['password'] ?? '';

    if (!$username || !$password) {
        jsonError('Identifiant et mot de passe requis');
    }

    $db = getDB();
    $stmt = $db->prepare('SELECT id, password_hash FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        jsonError('Identifiant ou mot de passe incorrect', 400);
    }

    $userId = (int) $user['id'];
    $token = createSession($db, $userId);
    jsonOk([
        'token' => $token,
        'user'  => ['id' => $userId, 'username' => $username],
    ]);
}

function handleLogout(): void
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        $db = getDB();
        $stmt = $db->prepare('DELETE FROM sessions WHERE token = ?');
        $stmt->execute([$m[1]]);
    }
    jsonOk();
}

function handleCheck(): void
{
    $userId = authenticate();
    $db = getDB();
    $stmt = $db->prepare('SELECT id, username, created_at FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user) {
        jsonError('Utilisateur introuvable', 404);
    }
    jsonOk($user);
}

function handleUsers(): void
{
    $userId = authenticate();
    $db = getDB();
    $stmt = $db->prepare('SELECT id, username FROM users WHERE id != ? ORDER BY username');
    $stmt->execute([$userId]);
    jsonOk($stmt->fetchAll());
}

function handleChangePassword(): void
{
    $userId = authenticate();
    $body   = jsonInput();
    $current = $body['current_password'] ?? '';
    $newPass = $body['new_password']     ?? '';

    if (strlen($newPass) < 6) jsonError('Le nouveau mot de passe doit contenir au moins 6 caractères');

    $db   = getDB();
    $stmt = $db->prepare('SELECT password_hash FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($current, $user['password_hash'])) {
        jsonError('Mot de passe actuel incorrect', 400);
    }

    $db->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        ->execute([password_hash($newPass, PASSWORD_DEFAULT), $userId]);

    // Invalider toutes les autres sessions
    $db->prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?')
        ->execute([$userId, extractToken()]);

    jsonOk();
}

function handleChangeUsername(): void
{
    $userId  = authenticate();
    $body    = jsonInput();
    $newName = trim($body['username'] ?? '');
    $pass    = $body['password']     ?? '';

    if (strlen($newName) < 3) jsonError("L'identifiant doit contenir au moins 3 caractères");
    if (!preg_match('/^[a-zA-Z0-9_\-\.]+$/', $newName)) {
        jsonError("L'identifiant ne peut contenir que des lettres, chiffres, _ - .");
    }

    $db   = getDB();
    $stmt = $db->prepare('SELECT password_hash FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($pass, $user['password_hash'])) {
        jsonError('Mot de passe incorrect', 400);
    }

    $check = $db->prepare('SELECT id FROM users WHERE username = ? AND id != ?');
    $check->execute([$newName, $userId]);
    if ($check->fetch()) jsonError('Cet identifiant est déjà utilisé');

    $db->prepare('UPDATE users SET username = ? WHERE id = ?')->execute([$newName, $userId]);
    jsonOk(['username' => $newName]);
}

function handleDeleteAccount(): void
{
    $userId = authenticate();
    $body   = jsonInput();
    $pass   = $body['password'] ?? '';

    $db   = getDB();
    $stmt = $db->prepare('SELECT password_hash FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($pass, $user['password_hash'])) {
        jsonError('Mot de passe incorrect', 400);
    }

    // Supprimer les fichiers photos (bouteilles + recettes)
    foreach (['bottles', 'recipes'] as $table) {
        $q = $db->prepare("SELECT photo FROM {$table} WHERE user_id = ? AND photo IS NOT NULL");
        $q->execute([$userId]);
        foreach ($q->fetchAll() as $row) {
            $path = __DIR__ . '/../' . $row['photo'];
            if (file_exists($path)) @unlink($path);
        }
    }

    // La suppression en cascade fait le reste (sessions, bottles, recipes, productions…)
    $db->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);
    jsonOk();
}

function extractToken(): string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (empty($header) && function_exists('getallheaders')) {
        $h      = getallheaders();
        $header = $h['Authorization'] ?? $h['authorization'] ?? '';
    }
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $m)) return $m[1];
    return '';
}

function createSession(PDO $db, int $userId): string
{
    $token = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', strtotime('+30 days'));
    $stmt = $db->prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)');
    $stmt->execute([$userId, $token, $expires]);
    return $token;
}
