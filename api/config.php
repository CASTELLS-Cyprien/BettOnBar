<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

define('DB_PATH', __DIR__ . '/../data/bettonbar.db');
define('UPLOADS_DIR', __DIR__ . '/../data/uploads/');
define('UPLOADS_URL', 'data/uploads/');

function getDB(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO('sqlite:' . DB_PATH);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA journal_mode = WAL');
        initDB($pdo);
    }
    return $pdo;
}

function initDB(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

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

        CREATE TABLE IF NOT EXISTS recipe_steps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipe_id INTEGER NOT NULL,
            step_order INTEGER NOT NULL,
            instruction TEXT NOT NULL,
            FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
        );

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

        CREATE TABLE IF NOT EXISTS prod_journal (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            production_id INTEGER NOT NULL,
            note TEXT NOT NULL,
            tasted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (production_id) REFERENCES productions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS stock_ingredients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            quantity REAL DEFAULT 0,
            unit TEXT DEFAULT 'unité',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    ");

    // Migration : colonne tags pour les recettes (ignorée si déjà présente)
    try { $pdo->exec("ALTER TABLE recipes ADD COLUMN tags TEXT DEFAULT ''"); }
    catch (\Exception $e) { /* colonne déjà existante — normal */ }

    // Historique des cocktails préparés
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS cocktail_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            recipe_id INTEGER,
            recipe_name TEXT NOT NULL,
            prepared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    ");
}

function authenticate(): int
{
    // Compatibilité Apache mod_php, FastCGI, WAMP, XAMPP
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (empty($header)) {
        $header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    }
    if (empty($header) && function_exists('getallheaders')) {
        $h      = getallheaders();
        $header = $h['Authorization'] ?? $h['authorization'] ?? '';
    }

    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        http_response_code(401);
        echo json_encode(['error' => 'Token manquant']);
        exit;
    }
    $token = $m[1];
    $db    = getDB();
    $stmt  = $db->prepare(
        "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')"
    );
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row) {
        http_response_code(401);
        echo json_encode(['error' => 'Token invalide ou expiré']);
        exit;
    }
    return (int) $row['user_id'];
}

function jsonInput(): array
{
    $raw = file_get_contents('php://input');
    if (empty($raw)) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function saveUploadedPhoto(string $field = 'photo'): string
{
    if (!isset($_FILES[$field]) || $_FILES[$field]['error'] !== UPLOAD_ERR_OK) {
        jsonError('Aucun fichier reçu');
    }
    $file = $_FILES[$field];
    $ext  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if ($ext === 'jpg') $ext = 'jpeg';
    if (!in_array($ext, ['jpeg', 'png', 'webp', 'gif'])) {
        jsonError('Format non supporté (jpg, png, webp, gif)');
    }
    if ($file['size'] > 5 * 1024 * 1024) {
        jsonError('Fichier trop volumineux (max 5 Mo)');
    }
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime  = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'])) {
        jsonError('Type MIME non autorisé');
    }
    if (!is_dir(UPLOADS_DIR)) mkdir(UPLOADS_DIR, 0755, true);
    $filename = bin2hex(random_bytes(16)) . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], UPLOADS_DIR . $filename)) {
        jsonError("Erreur lors de l'enregistrement du fichier", 500);
    }
    return UPLOADS_URL . $filename;
}

function jsonError(string $msg, int $code = 400): void
{
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

function jsonOk(mixed $data = null): void
{
    echo json_encode($data ?? ['ok' => true]);
    exit;
}
