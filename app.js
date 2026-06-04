// ─── Globals ─────────────────────────────────────────────────────────────────
var API = 'api';
var token = localStorage.getItem('bettonbar_token') || null;
var currentUser = JSON.parse(localStorage.getItem('bettonbar_user') || 'null');
var state = {};

// ─── API Helpers ──────────────────────────────────────────────────────────────
async function api(ep, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (opts.body && typeof opts.body === 'string') {
        opts.headers['Content-Type'] = 'application/json';
    }
    try {
        var res = await fetch(API + '/' + ep, opts);
        if (res.status === 401) {
            token = null;
            currentUser = null;
            localStorage.removeItem('bettonbar_token');
            localStorage.removeItem('bettonbar_user');
            navigate('auth');
            return { error: 'Session expirée, veuillez vous reconnecter' };
        }
        return await res.json();
    } catch (e) {
        toast('Erreur de connexion au serveur', 'error');
        return { error: 'Erreur réseau' };
    }
}

function post(u, b) { return api(u, { method: 'POST', body: JSON.stringify(b) }); }
function put(u, b)  { return api(u, { method: 'PUT',  body: JSON.stringify(b) }); }
function del(u)     { return api(u, { method: 'DELETE' }); }

// ─── Utils ────────────────────────────────────────────────────────────────────
function render(h) { document.getElementById('app').innerHTML = h; }

function navigate(view, data) {
    state.view = view;
    state.data = data || {};
    window.scrollTo(0, 0);
    switch (view) {
        case 'auth':            renderAuth();                      break;
        case 'home':            renderHome();                      break;
        case 'bottles':         renderBottles();                   break;
        case 'bottle-form':     renderBottleForm(data && data.id); break;
        case 'recipes':         renderRecipes();                   break;
        case 'recipe-view':     renderRecipeView(data && data.id); break;
        case 'recipe-form':     renderRecipeForm(data && data.id); break;
        case 'suggest':         renderSuggest();                   break;
        case 'personal':        renderPersonal();                  break;
        case 'productions':     renderProductions();               break;
        case 'production-view': renderProductionView(data && data.id); break;
        case 'production-form': renderProductionForm(data && data.id); break;
        case 'settings':        renderSettings();                  break;
        default: token ? renderHome() : renderAuth();
    }
}

function toast(msg, type) {
    type = type || 'success';
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML = (type === 'error' ? icon('alert-circle', 16) : icon('check-circle', 16)) +
                   '<span>' + esc(msg) + '</span>';
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add('show'); }, 10);
    setTimeout(function () {
        el.classList.remove('show');
        setTimeout(function () { el.remove(); }, 300);
    }, 3200);
}

function esc(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function icon(name, size) {
    size = size || 20;
    var icons = {
        'user':           '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>',
        'lock':           '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
        'eye':            '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
        'eye-off':        '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
        'log-in':         '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>',
        'log-out':        '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
        'home':           '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
        'package':        '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
        'book-open':      '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
        'zap':            '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
        'heart':          '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
        'tool':           '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
        'settings':       '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
        'plus':           '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
        'plus-circle':    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
        'edit-2':         '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
        'trash-2':        '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
        'arrow-left':     '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
        'check':          '<polyline points="20 6 9 11 4 16"/>',
        'check-circle':   '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
        'x':              '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
        'x-circle':       '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
        'alert-triangle': '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
        'alert-circle':   '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
        'star':           '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
        'camera':         '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
        'image':          '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
        'search':         '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
        'filter':         '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
        'chevron-right':  '<polyline points="9 18 15 12 9 6"/>',
        'chevron-down':   '<polyline points="6 9 12 15 18 9"/>',
        'chevron-left':   '<polyline points="15 18 9 12 15 6"/>',
        'clock':          '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        'dollar-sign':    '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
        'percent':        '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
        'droplet':        '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
        'share-2':        '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
        'users':          '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        'info':           '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
        'trending-up':    '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
        'refresh-cw':     '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    };
    var d = icons[name] || '';
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
}

// ─── Navigation bar ───────────────────────────────────────────────────────────
function navBar(active) {
    var items = [
        { id: 'bottles',     label: 'Bar',      ico: 'package'   },
        { id: 'recipes',     label: 'Recettes', ico: 'book-open' },
        { id: 'suggest',     label: 'Faire ?',  ico: 'zap'       },
        { id: 'productions', label: 'Maison',   ico: 'tool'      },
        { id: 'personal',    label: 'Perso',    ico: 'heart'     },
    ];
    return '<nav class="bottom-nav">' +
        items.map(function (i) {
            return '<button class="nav-item' + (active === i.id ? ' active' : '') +
                   '" onclick="navigate(\'' + i.id + '\')">' +
                   icon(i.ico, 22) + '<span>' + i.label + '</span></button>';
        }).join('') +
    '</nav>';
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function logout() {
    if (token) {
        await post('auth.php?action=logout', {});
    }
    token = null;
    currentUser = null;
    localStorage.removeItem('bettonbar_token');
    localStorage.removeItem('bettonbar_user');
    navigate('auth');
}

function renderAuth() {
    var mode = state.authMode || 'login';
    render(
        '<div class="auth-page">' +
            '<div class="auth-brand">' +
                '<div class="auth-logo-icon">' + icon('droplet', 52) + '</div>' +
                '<h1 class="auth-title">BettOnBar</h1>' +
                '<p class="auth-subtitle">Gérez votre bar personnel</p>' +
            '</div>' +
            '<div class="auth-card card">' +
                '<div class="tabs">' +
                    '<button class="tab' + (mode === 'login' ? ' active' : '') +
                        '" onclick="state.authMode=\'login\';renderAuth()">Connexion</button>' +
                    '<button class="tab' + (mode === 'register' ? ' active' : '') +
                        '" onclick="state.authMode=\'register\';renderAuth()">Inscription</button>' +
                '</div>' +
                '<div id="auth-error" class="auth-error" style="display:none"></div>' +
                (mode === 'login' ? renderLoginForm() : renderRegisterForm()) +
            '</div>' +
        '</div>'
    );
}

function renderLoginForm() {
    return '<form onsubmit="doLogin(event)" autocomplete="on">' +
        '<div class="input-group">' +
            '<label for="login-user">Identifiant</label>' +
            '<div class="input-icon-wrap">' +
                '<span class="input-icon">' + icon('user', 16) + '</span>' +
                '<input class="input" type="text" id="login-user" ' +
                       'placeholder="Votre identifiant" autocomplete="username" required>' +
            '</div>' +
        '</div>' +
        '<div class="input-group">' +
            '<label for="login-pass">Mot de passe</label>' +
            '<div class="input-icon-wrap">' +
                '<span class="input-icon">' + icon('lock', 16) + '</span>' +
                '<input class="input" type="password" id="login-pass" ' +
                       'placeholder="Votre mot de passe" autocomplete="current-password" required>' +
            '</div>' +
        '</div>' +
        '<button class="btn btn-primary btn-full" type="submit" id="login-btn">' +
            icon('log-in', 18) + ' Se connecter' +
        '</button>' +
    '</form>';
}

function renderRegisterForm() {
    return '<form onsubmit="doRegister(event)" autocomplete="on">' +
        '<div class="input-group">' +
            '<label for="reg-user">Identifiant</label>' +
            '<div class="input-icon-wrap">' +
                '<span class="input-icon">' + icon('user', 16) + '</span>' +
                '<input class="input" type="text" id="reg-user" ' +
                       'placeholder="Lettres, chiffres, _ - . (min. 3)" autocomplete="username" required>' +
            '</div>' +
        '</div>' +
        '<div class="input-group">' +
            '<label for="reg-pass">Mot de passe</label>' +
            '<div class="input-icon-wrap">' +
                '<span class="input-icon">' + icon('lock', 16) + '</span>' +
                '<input class="input" type="password" id="reg-pass" ' +
                       'placeholder="Minimum 6 caractères" autocomplete="new-password" required>' +
            '</div>' +
        '</div>' +
        '<div class="input-group">' +
            '<label for="reg-pass2">Confirmer le mot de passe</label>' +
            '<div class="input-icon-wrap">' +
                '<span class="input-icon">' + icon('lock', 16) + '</span>' +
                '<input class="input" type="password" id="reg-pass2" ' +
                       'placeholder="Répétez le mot de passe" autocomplete="new-password" required>' +
            '</div>' +
        '</div>' +
        '<button class="btn btn-primary btn-full" type="submit" id="reg-btn">' +
            icon('user', 18) + ' Créer un compte' +
        '</button>' +
    '</form>';
}

async function doLogin(e) {
    e.preventDefault();
    var btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span> Connexion…';
    hideAuthError();

    var username = document.getElementById('login-user').value.trim();
    var password = document.getElementById('login-pass').value;
    var res = await post('auth.php?action=login', { username: username, password: password });

    if (!res || res.error) {
        showAuthError(res ? res.error : 'Erreur de connexion');
        btn.disabled = false;
        btn.innerHTML = icon('log-in', 18) + ' Se connecter';
        return;
    }
    token = res.token;
    currentUser = res.user;
    localStorage.setItem('bettonbar_token', token);
    localStorage.setItem('bettonbar_user', JSON.stringify(currentUser));
    navigate('home');
}

async function doRegister(e) {
    e.preventDefault();
    var btn = document.getElementById('reg-btn');
    var pass  = document.getElementById('reg-pass').value;
    var pass2 = document.getElementById('reg-pass2').value;

    if (pass !== pass2) {
        showAuthError('Les mots de passe ne correspondent pas');
        return;
    }
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span> Création…';
    hideAuthError();

    var username = document.getElementById('reg-user').value.trim();
    var res = await post('auth.php?action=register', { username: username, password: pass });

    if (!res || res.error) {
        showAuthError(res ? res.error : 'Erreur de connexion');
        btn.disabled = false;
        btn.innerHTML = icon('user', 18) + ' Créer un compte';
        return;
    }
    token = res.token;
    currentUser = res.user;
    localStorage.setItem('bettonbar_token', token);
    localStorage.setItem('bettonbar_user', JSON.stringify(currentUser));
    toast('Compte créé avec succès !');
    navigate('home');
}

function showAuthError(msg) {
    var el = document.getElementById('auth-error');
    if (el) { el.innerHTML = icon('alert-circle', 16) + ' ' + esc(msg); el.style.display = 'flex'; }
}

function hideAuthError() {
    var el = document.getElementById('auth-error');
    if (el) el.style.display = 'none';
}

// ─── Home ─────────────────────────────────────────────────────────────────────
function renderHome() {
    navigate('bottles');
}

// ─── Bottles (stub) ───────────────────────────────────────────────────────────
function renderBottles() {
    render(
        '<div class="page">' +
            '<header class="app-header">' +
                '<h1>' + icon('package', 22) + ' Mon Bar</h1>' +
                '<button class="icon-btn" onclick="navigate(\'settings\')">' + icon('settings', 22) + '</button>' +
            '</header>' +
            '<div class="page-content">' +
                '<div class="empty-state">' +
                    icon('package', 48) +
                    '<p>Module bouteilles</p>' +
                    '<small>Disponible à l\'étape 4</small>' +
                '</div>' +
            '</div>' +
            navBar('bottles') +
        '</div>'
    );
}

function renderBottleForm(id) {
    render(
        '<div class="page">' +
            '<header class="app-header">' +
                '<button class="back-btn" onclick="navigate(\'bottles\')">' + icon('arrow-left', 20) + '</button>' +
                '<h1>' + (id ? 'Modifier' : 'Ajouter') + ' une bouteille</h1>' +
            '</header>' +
            '<div class="page-content"><div class="empty-state"><p>Formulaire — étape 4</p></div></div>' +
        '</div>'
    );
}

// ─── Recipes (stub) ───────────────────────────────────────────────────────────
function renderRecipes() {
    render(
        '<div class="page">' +
            '<header class="app-header">' +
                '<h1>' + icon('book-open', 22) + ' Recettes</h1>' +
            '</header>' +
            '<div class="page-content">' +
                '<div class="empty-state">' + icon('book-open', 48) + '<p>Disponible à l\'étape 5</p></div>' +
            '</div>' +
            navBar('recipes') +
        '</div>'
    );
}

function renderRecipeView(id) {
    render(
        '<div class="page">' +
            '<header class="app-header">' +
                '<button class="back-btn" onclick="navigate(\'recipes\')">' + icon('arrow-left', 20) + '</button>' +
                '<h1>Recette</h1>' +
            '</header>' +
            '<div class="page-content"><div class="empty-state"><p>Étape 5</p></div></div>' +
        '</div>'
    );
}

function renderRecipeForm(id) {
    render(
        '<div class="page">' +
            '<header class="app-header">' +
                '<button class="back-btn" onclick="navigate(\'recipes\')">' + icon('arrow-left', 20) + '</button>' +
                '<h1>' + (id ? 'Modifier' : 'Nouvelle') + ' recette</h1>' +
            '</header>' +
            '<div class="page-content"><div class="empty-state"><p>Étape 5</p></div></div>' +
        '</div>'
    );
}

// ─── Suggest (stub) ───────────────────────────────────────────────────────────
function renderSuggest() {
    render(
        '<div class="page">' +
            '<header class="app-header"><h1>' + icon('zap', 22) + ' Que faire ?</h1></header>' +
            '<div class="page-content">' +
                '<div class="empty-state">' + icon('zap', 48) + '<p>Disponible à l\'étape 6</p></div>' +
            '</div>' +
            navBar('suggest') +
        '</div>'
    );
}

// ─── Personal (stub) ──────────────────────────────────────────────────────────
function renderPersonal() {
    render(
        '<div class="page">' +
            '<header class="app-header"><h1>' + icon('heart', 22) + ' Espace perso</h1></header>' +
            '<div class="page-content">' +
                '<div class="empty-state">' + icon('heart', 48) + '<p>Disponible à l\'étape 9</p></div>' +
            '</div>' +
            navBar('personal') +
        '</div>'
    );
}

// ─── Productions (stub) ───────────────────────────────────────────────────────
function renderProductions() {
    render(
        '<div class="page">' +
            '<header class="app-header"><h1>' + icon('tool', 22) + ' Maison</h1></header>' +
            '<div class="page-content">' +
                '<div class="empty-state">' + icon('tool', 48) + '<p>Disponible à l\'étape 7</p></div>' +
            '</div>' +
            navBar('productions') +
        '</div>'
    );
}

function renderProductionView(id) {
    render(
        '<div class="page">' +
            '<header class="app-header">' +
                '<button class="back-btn" onclick="navigate(\'productions\')">' + icon('arrow-left', 20) + '</button>' +
                '<h1>Production</h1>' +
            '</header>' +
            '<div class="page-content"><div class="empty-state"><p>Étape 7</p></div></div>' +
        '</div>'
    );
}

function renderProductionForm(id) {
    render(
        '<div class="page">' +
            '<header class="app-header">' +
                '<button class="back-btn" onclick="navigate(\'productions\')">' + icon('arrow-left', 20) + '</button>' +
                '<h1>' + (id ? 'Modifier' : 'Nouvelle') + ' production</h1>' +
            '</header>' +
            '<div class="page-content"><div class="empty-state"><p>Étape 7</p></div></div>' +
        '</div>'
    );
}

// ─── Settings (stub) ──────────────────────────────────────────────────────────
function renderSettings() {
    render(
        '<div class="page">' +
            '<header class="app-header">' +
                '<button class="back-btn" onclick="navigate(\'bottles\')">' + icon('arrow-left', 20) + '</button>' +
                '<h1>' + icon('settings', 22) + ' Réglages</h1>' +
            '</header>' +
            '<div class="page-content">' +
                '<div class="card" style="margin-bottom:12px;padding:16px">' +
                    '<div style="display:flex;align-items:center;gap:12px">' +
                        '<div class="avatar">' + esc(currentUser && currentUser.username ? currentUser.username[0].toUpperCase() : '?') + '</div>' +
                        '<div>' +
                            '<div style="font-weight:600">' + esc(currentUser && currentUser.username) + '</div>' +
                            '<div style="font-size:13px;color:var(--text-muted)">Connecté</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<button class="btn btn-outline btn-full" onclick="logout()">' +
                    icon('log-out', 18) + ' Se déconnecter' +
                '</button>' +
                '<div class="empty-state" style="margin-top:24px">' +
                    icon('share-2', 36) + '<p>Partage de bar — étape 8</p>' +
                '</div>' +
            '</div>' +
        '</div>'
    );
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
    if (token) {
        var res = await api('auth.php?action=check');
        if (res && res.id) {
            currentUser = { id: res.id, username: res.username };
            localStorage.setItem('bettonbar_user', JSON.stringify(currentUser));
            navigate('home');
        } else {
            token = null;
            currentUser = null;
            localStorage.removeItem('bettonbar_token');
            localStorage.removeItem('bettonbar_user');
            navigate('auth');
        }
    } else {
        navigate('auth');
    }
});
