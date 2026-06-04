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
        jsonError('Identifiant ou mot de passe incorrect', 401);
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

function createSession(PDO $db, int $userId): string
{
    $token = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', strtotime('+30 days'));
    $stmt = $db->prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)');
    $stmt->execute([$userId, $token, $expires]);
    return $token;
}
