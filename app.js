// ─── Protection formulaire non sauvegardé ─────────────────────────────────────
var _formDirty = false;
function markFormDirty() { _formDirty = true; }
function resetFormDirty() { _formDirty = false; }
function setupDirtyDetection(formId) {
    _formDirty = false;
    var f = document.getElementById(formId);
    if (f) {
        f.addEventListener('input',  markFormDirty);
        f.addEventListener('change', markFormDirty);
    }
}
function safeBack(view, data) {
    if (_formDirty && !window.confirm('Des modifications non sauvegardées seront perdues.\nQuitter quand même ?')) return;
    _formDirty = false;
    navigate(view, data);
}

// ─── Thème ────────────────────────────────────────────────────────────────────
function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); localStorage.setItem('bettonbar_theme', t); }
function toggleTheme() {
    applyTheme(isDark() ? 'light' : 'dark');
    // Mettre à jour les icônes dans le DOM sans re-render
    document.querySelectorAll('.theme-toggle-ic').forEach(function (el) {
        el.setAttribute('data-lucide', isDark() ? 'sun' : 'moon');
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ─── Globals ─────────────────────────────────────────────────────────────────
var API = 'api';
var token = localStorage.getItem('bettonbar_token') || null;
var currentUser = JSON.parse(localStorage.getItem('bettonbar_user') || 'null');
var state = {};

// ─── API Helpers ──────────────────────────────────────────────────────────────
async function api(ep, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    opts.credentials = 'include'; // <-- LIGNE CRUCIALE : Autorise l'envoi du cookie de sécurité
    
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
            if (state.view !== 'auth') navigate('auth');
            return { error: 'Session expirée, veuillez vous reconnecter' };
        }
        // Dans app.js, au sein de votre fonction api()
        if (res.status === 401) {
            // Ne pas logger en erreur, c'est juste un utilisateur non connecté
            return { error: 'Non authentifié' };
        }
        return await res.json();
    } catch (e) {
        toast('Erreur de connexion au serveur', 'error');
        return { error: 'Erreur réseau' };
    }
}

// ─── Déblocage Anti-Bot Hébergeur ─────────────────────────────────────────────
function unlockAPI() {
    return new Promise(function(resolve) {
        var iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        
        // On charge une route API inoffensive pour forcer l'hébergeur à donner son cookie
        iframe.src = API + '/auth.php?action=check'; 
        
        document.body.appendChild(iframe);
        
        // On attend 4 secondes (le temps que le script AES s'exécute et recharge l'iframe)
        setTimeout(function() {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
            resolve();
        }, 4000);
    });
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
        case 'bottles':          renderBottles();                        break;
        case 'bottle-form':      renderBottleForm(data && data.id);     break;
        case 'ingredient-form':  renderIngredientForm(data && data.id); break;
        case 'recipes':         renderRecipes();                   break;
        case 'recipe-view':     renderRecipeView(data && data.id); break;
        case 'recipe-form':     renderRecipeForm(data && data.id); break;
        case 'suggest':         renderSuggest();                   break;
        case 'personal':        renderPersonal();                  break;
        case 'productions':     renderProductions();               break;
        case 'production-view': renderProductionView(data && data.id); break;
        case 'production-form': renderProductionForm(data && data.id); break;
        case 'settings':        renderSettings();                  break;
        case 'shared-bar':      renderSharedBar(data);             break;
        case 'cook-mode':       renderCookMode(data);              break;
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

// Correspondance noms Feather → noms Lucide (renommages)
var LUCIDE_MAP = {
    'tool':           'wrench',
    'edit-2':         'pencil',
    'alert-triangle': 'triangle-alert',
    'alert-circle':   'circle-alert',
    'check-circle':   'circle-check',
    'x-circle':       'circle-x',
    'plus-circle':    'circle-plus',
    'share-2':        'share-2',
    'trending-up':    'trending-up',
    'refresh-cw':     'refresh-cw',
};

function icon(name, size) {
    size = size || 20;
    var lucideName = LUCIDE_MAP[name] || name;
    // Wrapper span pour un alignement fiable quelle que soit le contexte (flex, inline, texte)
    return '<span class="ic" style="width:' + size + 'px;height:' + size + 'px" aria-hidden="true">' +
               '<i data-lucide="' + lucideName + '"></i>' +
           '</span>';
}

// ─── Navigation bar ───────────────────────────────────────────────────────────
function navBar(active) {
    var items = [
        { id: 'personal',    label: 'Accueil',  ico: 'layout-dashboard' },
        { id: 'bottles',     label: 'Mon Bar',  ico: 'wine'           },
        { id: 'recipes',     label: 'Recettes', ico: 'chef-hat'       },
        { id: 'suggest',     label: 'Idées',    ico: 'lightbulb'      },
        { id: 'productions', label: 'Brassage', ico: 'flask-conical'  },
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
    state = {};                                    // vider tout le cache utilisateur
    localStorage.removeItem('bettonbar_token');
    localStorage.removeItem('bettonbar_user');
    navigate('auth');
}

function renderAuth() {
    var mode = state.authMode || 'login';
    render(
        '<div class="auth-page">' +
            '<div class="auth-brand">' +
                '<div class="auth-logo-icon"><img src="biere.png" alt="BettOnBar" style="width:52px;height:52px;object-fit:contain"></div>' +
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
    state = {};                                    // vider tout cache d'une session précédente
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
    state = {};                                    // nouveau compte = état vierge
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
    navigate('personal');
}

// ─── Tags recettes ────────────────────────────────────────────────────────────
var RECIPE_TAGS = ['Classique','Tropical','Sans alcool','Fête','Rapide','Épicé','Fruité','Crémeux','Estival','Hivernal'];

function parseTags(str) {
    return (str || '').split(',').map(function(t) { return t.trim(); }).filter(Boolean);
}

function toggleRecipeTag(tag) {
    var input = document.getElementById('recipe-tags-hidden');
    if (!input) return;
    var tags = parseTags(input.value);
    var idx  = tags.indexOf(tag);
    if (idx !== -1) tags.splice(idx, 1); else tags.push(tag);
    input.value = tags.join(',');
    var btn = document.querySelector('[data-recipe-tag="' + tag + '"]');
    if (btn) btn.className = 'chip' + (tags.indexOf(tag) !== -1 ? ' chip-primary' : '');
}

function onRecipeTagFilter(tag) {
    state.recipesTagFilter = tag || null;
    refreshRecipesView();
}

// ─── Bottles ──────────────────────────────────────────────────────────────────
var BOTTLE_TYPES = [
    'Armagnac','Bière','Calvados','Champagne','Cidre','Cognac',
    'Eau-de-vie','Gin','Liqueur','Rhum','Téquila',
    'Vin blanc','Vin rosé','Vin rouge','Vodka','Whisky','Autre'
];

function starsHtml(rating) {
    if (rating === null || rating === undefined || rating === '') {
        return '<span class="text-muted" style="font-size:12px">—</span>';
    }
    rating = parseFloat(rating);
    var html = '';
    for (var i = 1; i <= 5; i++) {
        var color = i <= rating ? 'var(--gold)' : 'var(--border)';
        html += '<span style="color:' + color + ';font-size:15px">★</span>';
    }
    return html + '<span style="font-size:11px;color:var(--text-muted);margin-left:2px">' + rating + '</span>';
}

function fillBarHtml(pct) {
    pct = parseInt(pct) || 0;
    var cls = pct <= 15 ? 'fill-low' : (pct <= 40 ? 'fill-medium' : '');
    return '<div class="fill-row">' +
        '<div class="fill-bar"><div class="fill-bar-inner ' + cls + '" style="width:' + pct + '%"></div></div>' +
        '<span class="fill-label">' + pct + '%</span>' +
    '</div>';
}

function ratingStarsStr(val) {
    val = parseFloat(val) || 0;
    var full = Math.floor(val);
    var half = (val - full) >= 0.5 ? 1 : 0;
    var empty = 5 - full - half;
    return '<span style="color:var(--gold);font-size:22px;letter-spacing:1px">' +
        '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty) +
    '</span>';
}

function updateRatingLabel(val) {
    val = parseFloat(val) || 0;
    var lbl = document.getElementById('rating-label');
    var strs = document.getElementById('rating-stars');
    if (lbl)  lbl.textContent = val > 0 ? val + '/5' : '—';
    if (strs) strs.innerHTML  = ratingStarsStr(val);
}

function renderBottles() {
    if (state.barTab         === undefined) state.barTab         = 'bottles';
    if (state.bottlesSearch  === undefined) state.bottlesSearch  = '';
    if (state.bottlesType    === undefined) state.bottlesType    = '';
    var tab = state.barTab;

    render(
        '<div class="page">' +
            '<header class="app-header">' +
                '<h1>' + icon('wine', 20) + ' Mon Bar</h1>' +
            '</header>' +
            '<div class="page-content">' +
                '<div class="tabs" style="margin-bottom:14px">' +
                    '<button class="tab' + (tab === 'bottles'     ? ' active' : '') + '" onclick="onBarTab(\'bottles\')">'     + icon('wine', 13)  + ' Bouteilles</button>' +
                    '<button class="tab' + (tab === 'ingredients' ? ' active' : '') + '" onclick="onBarTab(\'ingredients\')">' + icon('leaf', 13)  + ' Ingrédients</button>' +
                '</div>' +
                (tab === 'bottles' ?
                    '<div class="search-bar">' +
                        '<span class="search-bar-icon">' + icon('search', 16) + '</span>' +
                        '<input class="input" type="search" id="bottles-search" placeholder="Rechercher une bouteille…" ' +
                               'value="' + esc(state.bottlesSearch) + '" oninput="onBottlesSearch(this.value)">' +
                    '</div>' +
                    '<div class="chips-scroll" id="bottles-filters"></div>'
                : '') +
                '<div id="bar-content"><div style="display:flex;justify-content:center;padding:40px"><div class="loading-spinner"></div></div></div>' +
            '</div>' +
            '<button class="fab" onclick="navigate(\'' + (tab === 'bottles' ? 'bottle-form' : 'ingredient-form') + '\')" title="' + (tab === 'bottles' ? 'Ajouter une bouteille' : 'Ajouter un ingrédient') + '">' +
                icon('plus', 24) +
            '</button>' +
            navBar('bottles') +
        '</div>'
    );

    if (tab === 'bottles') {
        (async function () {
            if (!state.bottles) {
                var res = await api('bottles.php');
                if (!res || res.error) {
                    document.getElementById('bar-content').innerHTML =
                        '<div class="empty-state">' + icon('alert-circle', 40) + '<p>' + esc((res && res.error) || 'Erreur') + '</p></div>';
                    return;
                }
                state.bottles = Array.isArray(res) ? res : [];
            }
            refreshBottlesView();
        }());
    } else {
        (async function () {
            if (!state.stockIngredients) {
                var res = await api('stock.php');
                if (!res || res.error) {
                    document.getElementById('bar-content').innerHTML =
                        '<div class="empty-state">' + icon('alert-circle', 40) + '<p>' + esc((res && res.error) || 'Erreur') + '</p></div>';
                    return;
                }
                state.stockIngredients = Array.isArray(res) ? res : [];
            }
            refreshIngredientsView();
        }());
    }
}

function onBarTab(tab) {
    state.barTab = tab;
    renderBottles();
}

function refreshBottlesView() {
    var bottles = state.bottles || [];
    // alias pour compatibilité avec l'ancien id
    var listEl  = document.getElementById('bar-content') || document.getElementById('bottles-list');
    var types = [];
    bottles.forEach(function (b) {
        if (b.type && types.indexOf(b.type) === -1) types.push(b.type);
    });
    types.sort();

    var filtersEl = document.getElementById('bottles-filters');
    if (filtersEl) {
        var fHtml = '<button class="chip' + (!state.bottlesType ? ' active' : '') +
                    '" onclick="onBottlesFilter(\'\')">Tous (' + bottles.length + ')</button>';
        types.forEach(function (t) {
            var cnt = bottles.filter(function (b) { return b.type === t; }).length;
            fHtml += '<button class="chip' + (state.bottlesType === t ? ' active' : '') +
                     '" onclick="onBottlesFilter(\'' + esc(t) + '\')">' + esc(t) + ' (' + cnt + ')</button>';
        });
        filtersEl.innerHTML = fHtml;
    }

    var search = (state.bottlesSearch || '').toLowerCase();
    var typeFilter = state.bottlesType || '';
    var filtered = bottles.filter(function (b) {
        var matchSearch = !search ||
            b.name.toLowerCase().indexOf(search) !== -1 ||
            (b.brand || '').toLowerCase().indexOf(search) !== -1 ||
            b.type.toLowerCase().indexOf(search) !== -1;
        return matchSearch && (!typeFilter || b.type === typeFilter);
    });

    if (!listEl) listEl = document.getElementById('bar-content');
    if (!listEl) return;

    if (!filtered.length) {
        listEl.innerHTML =
            '<div class="empty-state">' + icon('package', 44) +
            '<p>' + (search || typeFilter ? 'Aucun résultat' : 'Votre bar est vide') + '</p>' +
            (!search && !typeFilter ? '<small>Ajoutez votre première bouteille ↓</small>' : '') +
            '</div>';
        return;
    }

    var html = '<div class="card card-flush">';
    filtered.forEach(function (b) {
        var isLow  = parseInt(b.fill_pct) <= 15;
        var pct    = parseInt(b.fill_pct) || 0;
        var fillCls = pct <= 15 ? 'fill-low' : (pct <= 40 ? 'fill-medium' : '');
        html +=
            '<div class="bottle-card" onclick="navigate(\'bottle-form\',{id:' + b.id + '})">' +
                (b.photo
                    ? '<img class="bottle-thumb" src="' + esc(b.photo) + '" alt="" loading="lazy">'
                    : '<div class="bottle-thumb-placeholder">' + icon('wine', 20) + '</div>') +
                '<div class="bottle-info">' +
                    '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px">' +
                        '<div class="bottle-type" style="flex:1;min-width:0">' + esc(b.type) + (b.vintage ? ' · ' + b.vintage : '') + '</div>' +
                        (isLow ? '<span class="chip chip-danger" style="font-size:10px;padding:1px 6px;flex-shrink:0">À racheter</span>' : '') +
                    '</div>' +
                    '<div class="bottle-name">' + esc(b.name) + '</div>' +
                    (b.brand ? '<div class="bottle-brand">' + esc(b.brand) + '</div>' : '') +
                    '<div style="display:flex;align-items:center;gap:8px;margin-top:6px">' +
                        '<div class="fill-bar" style="flex:1"><div class="fill-bar-inner ' + fillCls + '" style="width:' + pct + '%"></div></div>' +
                        '<span style="font-size:11px;color:var(--text-muted);min-width:30px;text-align:right">' + pct + '%</span>' +
                    '</div>' +
                    (b.rating ? '<div style="margin-top:4px;font-size:13px;letter-spacing:1px">' + starsHtml(b.rating) + '</div>' : '') +
                '</div>' +
                '<span style="color:var(--text-muted);flex-shrink:0;margin-left:4px">' + icon('chevron-right', 16) + '</span>' +
            '</div>';
    });
    html += '</div>';
    listEl.innerHTML = html;
}

function onBottlesSearch(val) { state.bottlesSearch = val; refreshBottlesView(); }
function onBottlesFilter(type) { state.bottlesType = type; refreshBottlesView(); }

// ─── Ingrédients stock ────────────────────────────────────────────────────────
var STOCK_UNITS = ['unité', 'cl', 'ml', 'L', 'g', 'kg', 'c.à.s.', 'c.à.c.', 'feuille', 'pincée', 'trait'];

function refreshIngredientsView() {
    var items = state.stockIngredients || [];
    var el    = document.getElementById('bar-content');
    if (!el) return;

    if (!items.length) {
        el.innerHTML = '<div class="empty-state">' + icon('droplet', 44) +
            '<p>Aucun ingrédient en stock</p>' +
            '<small>Ajoutez sirop, jus, épices, fruits…</small></div>';
        return;
    }

    el.innerHTML = items.map(function (item) {
        var qty      = parseFloat(item.quantity) || 0;
        var empty    = qty <= 0;
        var qtyStr   = qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(1);
        var qtyColor = empty ? 'var(--danger)' : 'var(--primary)';
        return ingCardHtml(item, qtyStr, qtyColor, empty);
    }).join('');
}

function ingCardHtml(item, qtyStr, qtyColor, empty) {
    return '<div class="card ing-card">' +
        '<div class="ing-card-left" onclick="navigate(\'ingredient-form\',{id:' + item.id + '})">' +
            '<div class="ing-icon">' + icon('leaf', 20) + '</div>' +
            '<div class="ing-info">' +
                '<div class="ing-name">' + esc(item.name) + '</div>' +
                (item.description ? '<div class="ing-desc">' + esc(item.description) + '</div>' : '') +
            '</div>' +
        '</div>' +
        '<div class="ing-qty-ctrl" onclick="event.stopPropagation()">' +
            '<button class="qty-btn" onclick="doAdjustIngredient(' + item.id + ',-1)" aria-label="Diminuer">−</button>' +
            '<div class="ing-qty-wrap" id="stock-qty-' + item.id + '">' +
                '<span class="ing-qty-val" style="color:' + qtyColor + '">' + qtyStr + '</span>' +
                '<span class="ing-qty-unit">' + (empty ? 'Épuisé' : esc(item.unit)) + '</span>' +
            '</div>' +
            '<button class="qty-btn qty-btn-plus" onclick="doAdjustIngredient(' + item.id + ',1)" aria-label="Augmenter">+</button>' +
        '</div>' +
    '</div>';
}

async function doAdjustIngredient(id, delta) {
    var res = await post('stock.php?action=adjust', { id: id, delta: delta });
    if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }

    var item = (state.stockIngredients || []).find(function (i) { return i.id == id; });
    if (item) item.quantity = res.quantity;
    state.suggestAnalyzed = null;

    var wrap = document.getElementById('stock-qty-' + id);
    if (wrap) {
        var qty   = res.quantity;
        var empty = qty <= 0;
        var qStr  = qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(1);
        wrap.querySelector('.ing-qty-val').textContent  = qStr;
        wrap.querySelector('.ing-qty-val').style.color  = empty ? 'var(--danger)' : 'var(--primary)';
        wrap.querySelector('.ing-qty-unit').textContent = empty ? 'Épuisé' : (item ? item.unit : '');
    }
}

function renderIngredientForm(id) {
    render(
        '<div class="page">' +
            '<header class="app-header">' +
                '<button class="back-btn" onclick="safeBack(\'bottles\')">' + icon('arrow-left', 20) + '</button>' +
                '<h1>' + (id ? 'Modifier l\'ingrédient' : 'Nouvel ingrédient') + '</h1>' +
                (id ? '<button class="icon-btn" style="color:var(--danger)" onclick="confirmDeleteIngredient(' + id + ')">' + icon('trash-2', 20) + '</button>' : '') +
            '</header>' +
            '<div class="page-content page-content-no-nav" id="if-inner">' +
                '<div style="display:flex;justify-content:center;padding:40px"><div class="loading-spinner"></div></div>' +
            '</div>' +
        '</div>'
    );
    (async function () {
        var item = {};
        if (id) {
            if (state.stockIngredients) item = state.stockIngredients.find(function (i) { return i.id == id; }) || {};
            if (!item.id) {
                var res = await api('stock.php');
                if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }
                state.stockIngredients = Array.isArray(res) ? res : [];
                item = state.stockIngredients.find(function (i) { return i.id == id; }) || {};
            }
            if (!item.id) { toast('Ingrédient introuvable', 'error'); navigate('bottles'); return; }
        } else if (state.data && state.data.prefillName) {
            item = { name: state.data.prefillName };
        }
        var el = document.getElementById('if-inner');
        if (el) { el.innerHTML = ingredientFormHtml(item); setupDirtyDetection('if-inner'); }
    }());
}

function ingredientFormHtml(item) {
    var unitOpts = STOCK_UNITS.map(function (u) {
        return '<option value="' + u + '"' + ((item.unit || 'unité') === u ? ' selected' : '') + '>' + u + '</option>';
    }).join('');
    var qty = parseFloat(item.quantity) || 0;

    return '<form onsubmit="doSaveIngredient(event,' + (item.id || 0) + ')">' +
        '<div class="input-group"><label>Nom <span class="required">*</span></label>' +
            '<input class="input" type="text" name="name" placeholder="Ex : Jus de citron, Sirop de sucre…" value="' + esc(item.name || '') + '" required autofocus>' +
        '</div>' +
        '<div class="input-group"><label>Description <span style="color:var(--text-muted);font-size:12px">(optionnelle)</span></label>' +
            '<input class="input" type="text" name="description" placeholder="Ex : Fraîchement pressé, Bio…" value="' + esc(item.description || '') + '">' +
        '</div>' +
        '<div class="input-row">' +
            '<div class="input-group" style="flex:2"><label>Quantité en stock</label>' +
                '<input class="input" type="number" name="quantity" min="0" step="0.1" placeholder="0" value="' + esc(qty || '') + '"></div>' +
            '<div class="input-group" style="flex:1"><label>Unité</label>' +
                '<select class="input" name="unit">' + unitOpts + '</select></div>' +
        '</div>' +
        '<button class="btn btn-primary btn-full" type="submit" id="save-ing-btn">' +
            icon('check', 18) + (item.id ? ' Enregistrer' : ' Ajouter l\'ingrédient') +
        '</button>' +
        (item.id ? '<button class="btn btn-outline-danger btn-full mt-8" type="button" onclick="confirmDeleteIngredient(' + item.id + ')">' + icon('trash-2', 16) + ' Supprimer</button>' : '') +
        '<div style="height:16px"></div>' +
    '</form>';
}

async function doSaveIngredient(e, id) {
    e.preventDefault();
    var form = e.target;
    var btn  = document.getElementById('save-ing-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span> Enregistrement…';

    var data = {
        name:        form.querySelector('[name=name]').value.trim(),
        description: form.querySelector('[name=description]').value.trim(),
        quantity:    parseFloat(form.querySelector('[name=quantity]').value) || 0,
        unit:        form.querySelector('[name=unit]').value,
    };

    var res;
    if (id) { data.id = id; res = await put('stock.php', data); }
    else                     res = await post('stock.php', data);

    if (!res || res.error) {
        toast((res && res.error) || 'Erreur', 'error');
        btn.disabled = false;
        btn.innerHTML = icon('check', 18) + (id ? ' Enregistrer' : ' Ajouter l\'ingrédient');
        return;
    }
    resetFormDirty();
    toast(id ? 'Ingrédient modifié !' : 'Ingrédient ajouté !');
    state.stockIngredients = null;
    state.suggestAnalyzed  = null;
    state.barTab = 'ingredients';
    navigate('bottles');
}

function confirmDeleteIngredient(id) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
        '<div class="modal confirm-dialog">' +
            '<div style="color:var(--danger);margin-bottom:8px">' + icon('trash-2', 36) + '</div>' +
            '<h3>Supprimer l\'ingrédient ?</h3>' +
            '<p>Il ne sera plus pris en compte dans les suggestions.</p>' +
            '<div class="confirm-actions">' +
                '<button class="btn btn-surface" onclick="document.querySelector(\'.modal-overlay\').remove()">Annuler</button>' +
                '<button class="btn btn-danger" onclick="doDeleteIngredient(' + id + ')">Supprimer</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
}

async function doDeleteIngredient(id) {
    var overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();
    var res = await del('stock.php?id=' + id);
    if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }
    toast('Ingrédient supprimé');
    state.stockIngredients = null;
    state.suggestAnalyzed  = null;
    state.barTab = 'ingredients';
    navigate('bottles');
}

function renderBottleForm(id) {
    render(
        '<div class="page">' +
            '<header class="app-header">' +
                '<button class="back-btn" onclick="safeBack(\'bottles\')">' + icon('arrow-left', 20) + '</button>' +
                '<h1>' + (id ? 'Modifier la bouteille' : 'Ajouter une bouteille') + '</h1>' +
                (id ? '<button class="icon-btn" style="color:var(--danger)" onclick="confirmDeleteBottle(' + id + ')" title="Supprimer">' + icon('trash-2', 20) + '</button>' : '') +
            '</header>' +
            '<div class="page-content page-content-no-nav">' +
                '<div id="bottle-form-inner">' +
                    '<div style="display:flex;justify-content:center;padding:40px"><div class="loading-spinner"></div></div>' +
                '</div>' +
            '</div>' +
        '</div>'
    );

    (async function () {
        var bottle = {};
        if (id) {
            if (state.bottles) {
                bottle = state.bottles.find(function (b) { return b.id == id; }) || null;
            }
            if (!bottle) {
                var res = await api('bottles.php');
                if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }
                state.bottles = Array.isArray(res) ? res : [];
                bottle = state.bottles.find(function (b) { return b.id == id; }) || null;
            }
            if (!bottle) { toast('Bouteille introuvable', 'error'); navigate('bottles'); return; }
        } else if (state.data && state.data.prefillName) {
            // Pré-remplissage depuis "Que faire ?" (ingrédient manquant)
            bottle = { name: state.data.prefillName };
        }
        var el = document.getElementById('bottle-form-inner');
        if (el) { el.innerHTML = bottleFormHtml(bottle || {}); setupDirtyDetection('bottle-form-inner'); }
    }());
}

function bottleFormHtml(b) {
    var typesOpts = '<option value="">— Choisir un type —</option>' +
        BOTTLE_TYPES.map(function (t) {
            return '<option value="' + esc(t) + '"' + (b.type === t ? ' selected' : '') + '>' + esc(t) + '</option>';
        }).join('');

    var fillPct = parseInt(b.fill_pct !== undefined && b.fill_pct !== null ? b.fill_pct : 100);
    var rating  = (b.rating !== null && b.rating !== undefined) ? parseFloat(b.rating) : 0;

    return '<form id="bottle-form" onsubmit="doSaveBottle(event,' + (b.id || 0) + ')">' +

        // Photo
        '<div class="section-header"><span class="section-title">Photo</span></div>' +
        '<div class="photo-upload" id="photo-zone" onclick="document.getElementById(\'photo-input\').click()">' +
            (b.photo
                ? '<img class="photo-preview" id="photo-preview" src="' + esc(b.photo) + '" alt="">'
                : icon('camera', 30) + '<span style="font-size:14px">Ajouter une photo</span>') +
        '</div>' +
        '<input type="file" id="photo-input" accept="image/jpeg,image/png,image/webp,image/gif" style="display:none" onchange="doUploadPhoto(this)">' +
        '<input type="hidden" id="photo-path" value="' + esc(b.photo || '') + '">' +

        // Identité
        '<div class="section-header mt-16"><span class="section-title">Identité</span></div>' +
        '<div class="input-row">' +
            '<div class="input-group" style="flex:2">' +
                '<label>Type <span class="required">*</span></label>' +
                '<select class="input" name="type" required>' + typesOpts + '</select>' +
            '</div>' +
            '<div class="input-group" style="flex:1">' +
                '<label>Millésime</label>' +
                '<input class="input" type="number" name="vintage" min="1800" max="2099" placeholder="2020" value="' + esc(b.vintage || '') + '">' +
            '</div>' +
        '</div>' +
        '<div class="input-group">' +
            '<label>Marque</label>' +
            '<input class="input" type="text" name="brand" placeholder="Ex : Laphroaig" value="' + esc(b.brand || '') + '">' +
        '</div>' +
        '<div class="input-group">' +
            '<label>Nom <span class="required">*</span></label>' +
            '<input class="input" type="text" name="name" placeholder="Ex : 10 ans d\'âge" value="' + esc(b.name || '') + '" required>' +
        '</div>' +

        // Niveau (essentiel — toujours visible)
        '<div class="input-group">' +
            '<label>Niveau de remplissage — <strong id="fill-label">' + fillPct + '%</strong></label>' +
            '<div class="fill-row"><div class="fill-bar" style="flex:1"><div class="fill-bar-inner ' + (fillPct<=15?'fill-low':fillPct<=40?'fill-medium':'') + '" id="bottle-fill-bar-inner" style="width:' + fillPct + '%"></div></div><span class="fill-label">' + fillPct + '%</span></div>' +
            '<input type="range" name="fill_pct" min="0" max="100" step="5" value="' + fillPct + '" ' +
                   'style="width:100%;margin-top:8px" oninput="document.getElementById(\'fill-label\').textContent=this.value+\'%\';document.getElementById(\'bottle-fill-bar-inner\').style.width=this.value+\'%\'">' +
        '</div>' +

        // Note (essentiel — toujours visible)
        '<div class="input-group">' +
            '<label>Note personnelle — <strong id="rating-label">' + (rating > 0 ? rating + '/5' : '—') + '</strong></label>' +
            '<div style="display:flex;align-items:center;gap:12px;margin-top:4px">' +
                '<input type="range" name="rating" min="0" max="5" step="0.5" value="' + rating + '" ' +
                       'style="flex:1" oninput="updateRatingLabel(this.value)">' +
                '<span id="rating-stars">' + ratingStarsStr(rating) + '</span>' +
            '</div>' +
        '</div>' +

        // Détails optionnels (repliables)
        '<details class="bottle-details"' + (b.price || b.shop || b.opened_at || b.storage || b.description || b.comment ? ' open' : '') + '>' +
            '<summary class="bottle-details-summary">' + icon('chevron-right', 14) + ' Détails optionnels</summary>' +
            '<div class="bottle-details-body">' +
                '<div class="section-header mt-8"><span class="section-title">Achat</span></div>' +
                '<div class="input-row">' +
                    '<div class="input-group">' +
                        '<label>Prix (€)</label>' +
                        '<input class="input" type="number" name="price" min="0" step="0.01" placeholder="0.00" value="' + esc(b.price || '') + '">' +
                    '</div>' +
                    '<div class="input-group" style="flex:2">' +
                        '<label>Lieu d\'achat</label>' +
                        '<input class="input" type="text" name="shop" placeholder="Cave Nicolas, Amazon…" value="' + esc(b.shop || '') + '">' +
                    '</div>' +
                '</div>' +
                '<div class="section-header"><span class="section-title">Conservation</span></div>' +
                '<div class="input-row">' +
                    '<div class="input-group">' +
                        '<label>Date d\'ouverture</label>' +
                        '<input class="input" type="date" name="opened_at" value="' + esc(b.opened_at || '') + '">' +
                    '</div>' +
                    '<div class="input-group">' +
                        '<label>Rangement</label>' +
                        '<input class="input" type="text" name="storage" placeholder="Cave, bar, frigo…" value="' + esc(b.storage || '') + '">' +
                    '</div>' +
                '</div>' +
                '<div class="section-header"><span class="section-title">Notes</span></div>' +
                '<div class="input-group">' +
                    '<label>Description</label>' +
                    '<textarea class="input" name="description" rows="2" placeholder="Arômes, caractère…">' + esc(b.description || '') + '</textarea>' +
                '</div>' +
                '<div class="input-group">' +
                    '<label>Commentaire personnel</label>' +
                    '<textarea class="input" name="comment" rows="2" placeholder="Occasion, souvenir…">' + esc(b.comment || '') + '</textarea>' +
                '</div>' +
            '</div>' +
        '</details>' +

        '<div style="height:8px"></div>' +
        '<button class="btn btn-primary btn-full" type="submit" id="save-bottle-btn">' +
            icon('check', 18) + (b.id ? ' Enregistrer les modifications' : ' Ajouter la bouteille') +
        '</button>' +
        (b.id
            ? '<button class="btn btn-outline-danger btn-full mt-8" type="button" onclick="confirmDeleteBottle(' + b.id + ')">' +
                icon('trash-2', 16) + ' Supprimer cette bouteille' +
              '</button>'
            : '') +
        '<div style="height:16px"></div>' +
    '</form>';
}

async function doUploadPhoto(input) {
    var file = input.files[0];
    if (!file || input.dataset.uploading) return;
    input.dataset.uploading = '1';
    var zone = document.getElementById('photo-zone');
    if (zone) zone.innerHTML = '<div class="loading-spinner"></div>';
    var form = new FormData();
    form.append('photo', file);
    try {
        var res = await fetch(API + '/bottles.php?action=upload_photo', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: form
        });
        var data = await res.json();
        if (data.error) {
            toast(data.error, 'error');
            if (zone) zone.innerHTML = icon('camera', 30) + '<span style="font-size:14px">Ajouter une photo</span>';
            return;
        }
        document.getElementById('photo-path').value = data.path;
        if (zone) zone.innerHTML = '<img class="photo-preview" src="' + esc(data.path) + '" alt="">';
    } catch (err) {
        toast('Erreur lors de l\'upload', 'error');
        if (zone) zone.innerHTML = icon('camera', 30) + '<span style="font-size:14px">Ajouter une photo</span>';
    } finally {
        delete input.dataset.uploading;
    }
}

async function doSaveBottle(e, id) {
    e.preventDefault();
    var form = e.target;
    var btn  = document.getElementById('save-bottle-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span> Enregistrement…';

    var data = {
        name:        form.querySelector('[name=name]').value.trim(),
        type:        form.querySelector('[name=type]').value,
        brand:       form.querySelector('[name=brand]').value.trim(),
        price:       form.querySelector('[name=price]').value,
        shop:        form.querySelector('[name=shop]').value.trim(),
        photo:       document.getElementById('photo-path').value || null,
        opened_at:   form.querySelector('[name=opened_at]').value || null,
        vintage:     form.querySelector('[name=vintage]').value  || null,
        storage:     form.querySelector('[name=storage]').value.trim(),
        description: form.querySelector('[name=description]').value.trim(),
        comment:     form.querySelector('[name=comment]').value.trim(),
        rating:      form.querySelector('[name=rating]').value,
        fill_pct:    parseInt(form.querySelector('[name=fill_pct]').value),
    };

    var res;
    if (id) { data.id = id; res = await put('bottles.php', data); }
    else                     res = await post('bottles.php', data);

    if (!res || res.error) {
        toast((res && res.error) || 'Erreur', 'error');
        btn.disabled = false;
        btn.innerHTML = icon('check', 18) + (id ? ' Enregistrer les modifications' : ' Ajouter la bouteille');
        return;
    }

    resetFormDirty();
    toast(id ? 'Bouteille modifiée !' : 'Bouteille ajoutée !');
    state.bottles        = null;
    state.suggestAnalyzed = null;
    navigate('bottles');
}

function confirmDeleteBottle(id) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
        '<div class="modal confirm-dialog">' +
            '<div style="color:var(--danger);margin-bottom:8px">' + icon('trash-2', 36) + '</div>' +
            '<h3>Supprimer cette bouteille ?</h3>' +
            '<p>La photo sera également supprimée. Cette action est irréversible.</p>' +
            '<div class="confirm-actions">' +
                '<button class="btn btn-surface" onclick="document.querySelector(\'.modal-overlay\').remove()">Annuler</button>' +
                '<button class="btn btn-danger" onclick="doDeleteBottle(' + id + ')">Supprimer</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
}

async function doDeleteBottle(id) {
    var overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();
    var res = await del('bottles.php?id=' + id);
    if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }
    toast('Bouteille supprimée');
    state.bottles        = null;
    state.suggestAnalyzed = null;
    navigate('bottles');
}

// ─── Recipes ──────────────────────────────────────────────────────────────────
function findRecipeById(id) {
    if (!state.recipes) return null;
    return state.recipes.find(function (r) { return r.id == id; }) || null;
}

function calcAlcohol(ingredients) {
    var totalVol = 0, totalAlc = 0;
    (ingredients || []).forEach(function (ing) {
        var qty = parseFloat(ing.quantity) || 0;
        totalVol += qty;
        totalAlc += qty * (parseFloat(ing.alcohol_pct) || 0) / 100;
    });
    if (!totalVol) return 0;
    return (totalAlc / totalVol * 100).toFixed(1);
}

function diffDotsHtml(diff) {
    diff = parseInt(diff) || 1;
    var h = '<span style="display:inline-flex;gap:3px;align-items:center">';
    for (var i = 1; i <= 3; i++) {
        h += '<span style="width:7px;height:7px;border-radius:50%;background:' +
             (i <= diff ? 'var(--warning)' : 'var(--border)') + '"></span>';
    }
    return h + '</span>';
}

function setDifficulty(val) {
    document.getElementById('difficulty-val').value = val;
    document.querySelectorAll('.diff-btn').forEach(function (btn) {
        var active = parseInt(btn.getAttribute('data-val')) === val;
        btn.className = 'btn btn-sm diff-btn ' + (active ? 'btn-primary' : 'btn-surface');
    });
}

function renderRecipes() {
    if (state.recipesFilter    === undefined) state.recipesFilter    = 'all';
    if (state.recipesSearch    === undefined) state.recipesSearch    = '';
    if (state.recipesSort      === undefined) state.recipesSort      = 'default';
    if (state.recipesFilters   === undefined) state.recipesFilters   = [];
    if (state.recipesTagFilter === undefined) state.recipesTagFilter = null;

    var activeFilters = state.recipesFilters;

    render(
        '<div class="page">' +
            '<header class="app-header"><h1>' + icon('chef-hat', 20) + ' Mes Recettes</h1></header>' +
            '<div class="page-content">' +
                '<div class="search-bar">' +
                    '<span class="search-bar-icon">' + icon('search', 16) + '</span>' +
                    '<input class="input" type="search" id="recipes-search" placeholder="Rechercher…" ' +
                           'value="' + esc(state.recipesSearch) + '" oninput="onRecipesSearch(this.value)">' +
                '</div>' +
                '<div class="tabs" style="margin-bottom:10px">' +
                    '<button class="tab' + (state.recipesFilter === 'all' ? ' active' : '') +
                            '" id="rtab-all" onclick="onRecipesFilter(\'all\')">Toutes</button>' +
                    '<button class="tab' + (state.recipesFilter === 'favorites' ? ' active' : '') +
                            '" id="rtab-favorites" onclick="onRecipesFilter(\'favorites\')">' + icon('heart', 14) + ' Favoris</button>' +
                '</div>' +
                // Tri + filtres avancés
                '<div class="chips-scroll" style="margin-bottom:14px;align-items:center">' +
                    '<select class="input" id="recipes-sort-sel" style="flex-shrink:0;width:auto;padding:6px 28px 6px 10px;font-size:13px;height:34px" onchange="onRecipesSort(this.value)">' +
                        '<option value="default"'         + (state.recipesSort==='default'         ?' selected':'') + '>Tri : Défaut</option>' +
                        '<option value="difficulty_asc"'  + (state.recipesSort==='difficulty_asc'  ?' selected':'') + '>Difficulté ↑</option>' +
                        '<option value="time_asc"'        + (state.recipesSort==='time_asc'        ?' selected':'') + '>Temps ↑</option>' +
                        '<option value="alc_desc"'        + (state.recipesSort==='alc_desc'        ?' selected':'') + '>Degré alcool ↓</option>' +
                        '<option value="rating_desc"'     + (state.recipesSort==='rating_desc'     ?' selected':'') + '>Note ↓</option>' +
                    '</select>' +
                    '<button class="chip' + (activeFilters.indexOf('quick')  !== -1 ? ' active' : '') + '" id="rf-quick"  onclick="toggleRecipeFilter(\'quick\')">' + icon('zap', 12) + ' Rapide</button>' +
                    '<button class="chip' + (activeFilters.indexOf('no_alc') !== -1 ? ' active' : '') + '" id="rf-no_alc" onclick="toggleRecipeFilter(\'no_alc\')">' + icon('leaf', 12) + ' Sans alcool</button>' +
                    '<button class="chip' + (activeFilters.indexOf('rated')  !== -1 ? ' active' : '') + '" id="rf-rated"  onclick="toggleRecipeFilter(\'rated\')">'  + icon('star', 12) + ' Noté</button>' +
                '</div>' +
                '<div class="chips-scroll" id="recipe-tag-filters" style="display:none;margin-bottom:10px"></div>' +
                '<div id="recipes-list"><div style="display:flex;justify-content:center;padding:40px">' +
                    '<div class="loading-spinner"></div></div></div>' +
            '</div>' +
            '<button class="fab" onclick="navigate(\'recipe-form\')" title="Nouvelle recette">' + icon('plus', 24) + '</button>' +
            navBar('recipes') +
        '</div>'
    );

    (async function () {
        var res = await api('recipes.php');
        if (!res || res.error) {
            document.getElementById('recipes-list').innerHTML =
                '<div class="empty-state">' + icon('alert-circle', 40) + '<p>' + esc((res && res.error) || 'Erreur') + '</p></div>';
            return;
        }
        state.recipes = Array.isArray(res) ? res : [];
        refreshRecipesView();
    }());
}

function refreshRecipesView() {
    var recipes     = state.recipes || [];
    var search      = (state.recipesSearch  || '').toLowerCase();
    var filter      = state.recipesFilter   || 'all';
    var sort        = state.recipesSort     || 'default';
    var extraFilters = state.recipesFilters || [];

    // 1. Filtre recherche + onglet
    var filtered = recipes.filter(function (r) {
        return (!search || r.name.toLowerCase().indexOf(search) !== -1) &&
               (filter === 'all' || (filter === 'favorites' && r.is_favorite));
    });

    // 2. Filtres avancés
    if (extraFilters.indexOf('quick') !== -1) {
        filtered = filtered.filter(function (r) { return r.prep_time && parseInt(r.prep_time) <= 5; });
    }
    if (extraFilters.indexOf('no_alc') !== -1) {
        filtered = filtered.filter(function (r) { return parseFloat(calcAlcohol(r.ingredients)) === 0; });
    }
    if (extraFilters.indexOf('rated') !== -1) {
        filtered = filtered.filter(function (r) { return r.user_rating && parseFloat(r.user_rating) > 0; });
    }

    // 3. Filtre par tag
    if (state.recipesTagFilter) {
        filtered = filtered.filter(function (r) {
            return parseTags(r.tags).indexOf(state.recipesTagFilter) !== -1;
        });
    }

    // 4. Tri
    if (sort === 'difficulty_asc') {
        filtered = filtered.slice().sort(function (a, b) { return parseInt(a.difficulty||1) - parseInt(b.difficulty||1); });
    } else if (sort === 'time_asc') {
        filtered = filtered.slice().sort(function (a, b) { return (parseInt(a.prep_time)||999) - (parseInt(b.prep_time)||999); });
    } else if (sort === 'alc_desc') {
        filtered = filtered.slice().sort(function (a, b) { return parseFloat(calcAlcohol(b.ingredients)) - parseFloat(calcAlcohol(a.ingredients)); });
    } else if (sort === 'rating_desc') {
        filtered = filtered.slice().sort(function (a, b) { return (parseFloat(b.user_rating)||0) - (parseFloat(a.user_rating)||0); });
    }

    // Mise à jour des chips de filtre par tag
    var allTags = [];
    (state.recipes || []).forEach(function (r) {
        parseTags(r.tags).forEach(function (t) {
            if (allTags.indexOf(t) === -1) allTags.push(t);
        });
    });
    allTags.sort();
    var tagEl = document.getElementById('recipe-tag-filters');
    if (tagEl) {
        if (allTags.length) {
            tagEl.style.display = 'flex';
            tagEl.innerHTML =
                '<button class="chip' + (!state.recipesTagFilter ? ' active' : '') + '" onclick="onRecipeTagFilter(null)">' + icon('tag', 11) + ' Tous</button>' +
                allTags.map(function (t) {
                    return '<button class="chip' + (state.recipesTagFilter === t ? ' active' : '') + '" onclick="onRecipeTagFilter(\'' + esc(t) + '\')">' + esc(t) + '</button>';
                }).join('');
        } else {
            tagEl.style.display = 'none';
        }
    }

    var el = document.getElementById('recipes-list');
    if (!el) return;

    if (!filtered.length) {
        var emptyReason = state.recipesTagFilter ? 'Aucune recette avec ce tag' :
                          (search || filter !== 'all') ? 'Aucune recette trouvée' : 'Aucune recette';
        el.innerHTML = '<div class="empty-state">' + icon('chef-hat', 44) +
            '<p>' + emptyReason + '</p>' +
            (!search && filter === 'all' && !state.recipesTagFilter ? '<small>Ajoutez votre première recette ↓</small>' : '') + '</div>';
        return;
    }

    var diffLabels = ['', 'Facile', 'Moyen', 'Difficile'];
    el.innerHTML = filtered.map(function (r) {
        var alc  = parseFloat(calcAlcohol(r.ingredients));
        var tags = parseTags(r.tags);
        return '<div class="card card-flush" style="margin-bottom:10px">' +
            '<div style="display:flex;gap:12px;padding:14px;cursor:pointer" onclick="navigate(\'recipe-view\',{id:' + r.id + '})">' +
                (r.photo
                    ? '<img src="' + esc(r.photo) + '" style="width:72px;height:72px;object-fit:cover;border-radius:8px;flex-shrink:0">'
                    : '<div style="width:72px;height:72px;background:var(--bg);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--text-light)">' + icon('chef-hat', 24) + '</div>') +
                '<div style="flex:1;min-width:0">' +
                    '<div style="font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(r.name) + '</div>' +
                    '<div style="display:flex;gap:8px;margin-top:5px;font-size:13px;color:var(--text-muted);align-items:center;flex-wrap:wrap">' +
                        diffDotsHtml(r.difficulty) + ' <span class="text-xs">' + (diffLabels[r.difficulty] || 'Facile') + '</span>' +
                        (r.prep_time ? ' <span style="display:flex;align-items:center;gap:3px">' + icon('clock', 13) + ' ' + r.prep_time + 'min</span>' : '') +
                        ' <span style="display:flex;align-items:center;gap:3px">' + icon('users', 13) + ' ' + (r.servings || 1) + '</span>' +
                    '</div>' +
                    (alc > 0 ? '<div style="margin-top:5px"><span class="alc-badge">' + icon('droplet', 12) + ' ' + alc + '°</span></div>' : '') +
                    (tags.length ? '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">' +
                        tags.map(function (t) { return '<span class="chip chip-primary" style="font-size:10px;padding:1px 7px">' + esc(t) + '</span>'; }).join('') +
                    '</div>' : '') +
                '</div>' +
                '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0">' +
                    '<button id="fav-' + r.id + '" style="font-size:20px;padding:6px;color:' + (r.is_favorite ? 'var(--danger)' : 'var(--text-muted)') + '" ' +
                           'onclick="toggleFavoriteRecipe(' + r.id + ',event)">' + (r.is_favorite ? '♥' : '♡') + '</button>' +
                    '<span style="color:var(--text-muted)">' + icon('chevron-right', 16) + '</span>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');
}

function onRecipesSearch(val) { state.recipesSearch = val; refreshRecipesView(); }
function onRecipesFilter(val) {
    state.recipesFilter = val;
    var tabAll = document.getElementById('rtab-all');
    var tabFav = document.getElementById('rtab-favorites');
    if (tabAll) tabAll.className = 'tab' + (val === 'all'       ? ' active' : '');
    if (tabFav) tabFav.className = 'tab' + (val === 'favorites' ? ' active' : '');
    refreshRecipesView();
}
function onRecipesSort(val) {
    state.recipesSort = val;
    refreshRecipesView();
}
function toggleRecipeFilter(key) {
    state.recipesFilters = state.recipesFilters || [];
    var idx = state.recipesFilters.indexOf(key);
    if (idx !== -1) state.recipesFilters.splice(idx, 1);
    else            state.recipesFilters.push(key);
    // Mettre à jour chip actif
    var el = document.getElementById('rf-' + key);
    if (el) el.className = 'chip' + (state.recipesFilters.indexOf(key) !== -1 ? ' active' : '');
    refreshRecipesView();
}

async function toggleFavoriteRecipe(id, event) {
    if (event) event.stopPropagation();
    var recipe = findRecipeById(id);
    if (!recipe) return;
    recipe.is_favorite = recipe.is_favorite ? 0 : 1;
    var lb = document.getElementById('fav-' + id);
    if (lb) { lb.textContent = recipe.is_favorite ? '♥' : '♡'; lb.style.color = recipe.is_favorite ? 'var(--danger)' : 'var(--text-muted)'; }
    var hb = document.getElementById('fav-header-btn');
    if (hb) hb.style.color = recipe.is_favorite ? 'var(--danger)' : 'var(--text-muted)';
    var res = await post('recipes.php?action=toggle_favorite&id=' + id, {});
    if (res && res.error) { recipe.is_favorite = recipe.is_favorite ? 0 : 1; toast(res.error, 'error'); }
}

function renderRecipeView(id) {
    render(
        '<div class="page">' +
            '<header class="app-header">' +
                '<button class="back-btn" onclick="navigate(\'recipes\')">' + icon('arrow-left', 20) + '</button>' +
                '<h1 id="rv-title" style="font-size:15px">…</h1>' +
                '<button id="fav-header-btn" class="icon-btn" onclick="toggleFavoriteRecipe(' + id + ',event)">' + icon('heart', 20) + '</button>' +
                '<button class="icon-btn" title="Dupliquer la recette" onclick="duplicateRecipe(' + id + ')">' + icon('copy', 20) + '</button>' +
                '<button class="icon-btn" onclick="navigate(\'recipe-form\',{id:' + id + '})">' + icon('edit-2', 20) + '</button>' +
            '</header>' +
            '<div class="page-content page-content-no-nav" id="rv-content">' +
                '<div style="display:flex;justify-content:center;padding:40px"><div class="loading-spinner"></div></div>' +
            '</div>' +
        '</div>'
    );

    (async function () {
        var recipe = findRecipeById(id);
        if (!recipe || !recipe.ingredients) {
            var res = await api('recipes.php?id=' + id);
            if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }
            recipe = res;
            if (!state.recipes) state.recipes = [];
            var idx = state.recipes.findIndex(function (r) { return r.id == id; });
            if (idx >= 0) state.recipes[idx] = recipe; else state.recipes.push(recipe);
        }
        state.recipePortions = parseInt(recipe.servings) || 1;
        var titleEl = document.getElementById('rv-title');
        if (titleEl) titleEl.textContent = recipe.name;
        var favBtn = document.getElementById('fav-header-btn');
        if (favBtn) favBtn.style.color = recipe.is_favorite ? 'var(--danger)' : 'var(--text-muted)';
        var el = document.getElementById('rv-content');
        if (el) el.innerHTML = recipeViewHtml(recipe);
    }());
}

function recipeViewHtml(recipe) {
    var alc = parseFloat(calcAlcohol(recipe.ingredients || []));
    var basePortion = parseInt(recipe.servings) || 1;
    var portions = state.recipePortions || basePortion;
    var diffLabels = ['', 'Facile', 'Moyen', 'Difficile'];
    var ratio = portions / basePortion;
    var html = '';

    if (recipe.photo) html += '<img src="' + esc(recipe.photo) + '" class="photo-thumb-lg" alt="">';

    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center">' +
        '<span class="chip">' + diffDotsHtml(recipe.difficulty) + ' ' + (diffLabels[recipe.difficulty] || 'Facile') + '</span>' +
        (recipe.prep_time ? '<span class="chip">' + icon('clock', 14) + ' ' + recipe.prep_time + ' min</span>' : '') +
        (alc > 0 ? '<span class="alc-badge">' + icon('droplet', 14) + ' ' + alc + '° alc.</span>' : '') +
    '</div>';

    // Tags
    var recipeTags = parseTags(recipe.tags);
    if (recipeTags.length) {
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' +
            recipeTags.map(function (t) {
                return '<span class="chip chip-primary" style="cursor:pointer" onclick="onRecipeTagFilter(\'' + esc(t) + '\');navigate(\'recipes\')">' +
                    icon('tag', 11) + ' ' + esc(t) + '</span>';
            }).join('') +
        '</div>';
    }

    html += '<div class="card" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
        '<span style="font-weight:500">' + icon('users', 16) + ' Portions</span>' +
        '<div class="portions-control">' +
            '<button type="button" class="portions-btn" onclick="changePortions(' + recipe.id + ',-1)">−</button>' +
            '<span class="portions-value" id="portions-value">' + portions + '</span>' +
            '<button type="button" class="portions-btn" onclick="changePortions(' + recipe.id + ',1)">+</button>' +
        '</div>' +
    '</div>';

    if ((recipe.steps || []).length) {
        html += '<button class="btn btn-accent btn-full" style="margin-bottom:8px" onclick="navigate(\'cook-mode\',{id:' + recipe.id + '})">' +
            icon('play', 18) + ' Mode préparation' +
        '</button>';
    }
    html += '<button class="btn btn-surface btn-full" style="margin-bottom:16px" onclick="doLogPrepared(' + recipe.id + ',this)">' +
        icon('check-circle', 16) + ' J\'ai préparé ce cocktail' +
    '</button>';

    if ((recipe.ingredients || []).length) {
        html += '<div class="section-header"><span class="section-title">Ingrédients</span></div>' +
            '<div class="card card-flush" style="margin-bottom:16px"><div style="padding:0 16px">';
        recipe.ingredients.forEach(function (ing) {
            var qty = (parseFloat(ing.quantity) || 0) * ratio;
            var qtyStr = qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(1);
            html += '<div class="ingredient-row">' +
                '<span class="ingredient-qty" data-base-qty="' + esc(ing.quantity) + '" data-unit="' + esc(ing.unit) + '">' +
                    qtyStr + ' ' + esc(ing.unit) +
                '</span>' +
                '<span class="ingredient-name">' + esc(ing.name) + '</span>' +
                (parseFloat(ing.alcohol_pct) > 0 ? '<span class="ingredient-alc">' + ing.alcohol_pct + '°</span>' : '') +
            '</div>';
        });
        html += '</div></div>';
    }

    if ((recipe.steps || []).length) {
        html += '<div class="section-header"><span class="section-title">Préparation</span></div>' +
            '<div class="card card-flush" style="margin-bottom:16px"><div style="padding:0 16px">';
        recipe.steps.forEach(function (step) {
            html += '<div class="step-item"><div class="step-number">' + step.step_order + '</div>' +
                '<div class="step-text">' + esc(step.instruction) + '</div></div>';
        });
        html += '</div></div>';
    }

    if (recipe.notes) {
        html += '<div class="section-header"><span class="section-title">Notes</span></div>' +
            '<div class="card" style="margin-bottom:16px;font-size:14px;color:var(--text-muted);white-space:pre-wrap">' + esc(recipe.notes) + '</div>';
    }

    var currentRating = parseFloat(recipe.user_rating) || 0;
    html += '<div class="section-header"><span class="section-title">Ma note</span></div>' +
        '<div class="card" style="margin-bottom:24px">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
                '<span style="font-size:14px;font-weight:500">Notez ce cocktail</span>' +
                '<span id="rv-rating-val" style="font-size:13px;color:var(--text-muted)">' +
                    (currentRating > 0 ? currentRating + '/5' : 'Non noté') +
                '</span>' +
            '</div>' +
            '<input type="range" id="rv-rating-slider" min="0" max="5" step="0.5" value="' + currentRating + '" ' +
                   'style="width:100%;margin-bottom:8px" ' +
                   'oninput="onRatingSlide(this.value)" ' +
                   'onchange="doRateRecipe(' + recipe.id + ',this.value)">' +
            '<div id="rv-rating-stars" style="text-align:center">' + ratingStarsStr(currentRating) + '</div>' +
        '</div>';

    return html;
}

function onRatingSlide(val) {
    val = parseFloat(val) || 0;
    var lbl   = document.getElementById('rv-rating-val');
    var stars = document.getElementById('rv-rating-stars');
    if (lbl)   lbl.textContent   = val > 0 ? val + '/5' : 'Non noté';
    if (stars) stars.innerHTML   = ratingStarsStr(val);
}

async function doLogPrepared(recipeId, btn) {
    if (btn) { btn.disabled = true; }
    var res = await post('recipes.php?action=log_prepared&id=' + recipeId, {});
    if (!res || res.error) {
        toast((res && res.error) || 'Erreur', 'error');
        if (btn) btn.disabled = false;
        return;
    }
    toast('Cocktail enregistré dans l\'historique !');
    if (btn) {
        btn.innerHTML = icon('check', 16) + ' Préparé !';
        btn.style.color = 'var(--success)';
        setTimeout(function () {
            btn.disabled = false;
            btn.style.color = '';
            btn.innerHTML = icon('check-circle', 16) + ' J\'ai préparé ce cocktail';
        }, 3000);
    }
    // Invalider le cache historique du dashboard
    state.cocktailHistory = null;
}

async function doRateRecipe(recipeId, val) {
    val = parseFloat(val) || 0;
    var res = await post('recipes.php?action=rate&id=' + recipeId, { user_rating: val });
    if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }
    // Mettre à jour le cache
    var r = findRecipeById(recipeId);
    if (r) r.user_rating = res.user_rating;
    toast(val > 0 ? 'Note enregistrée (' + val + '/5)' : 'Note supprimée');
}

function changePortions(recipeId, delta) {
    var recipe = findRecipeById(recipeId);
    if (!recipe) return;
    var base = parseInt(recipe.servings) || 1;
    state.recipePortions = Math.max(1, Math.min(50, (state.recipePortions || base) + delta));
    var pv = document.getElementById('portions-value');
    if (pv) pv.textContent = state.recipePortions;
    var ratio = state.recipePortions / base;
    document.querySelectorAll('[data-base-qty]').forEach(function (el) {
        var qty = (parseFloat(el.getAttribute('data-base-qty')) || 0) * ratio;
        el.textContent = (qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(1)) + ' ' + el.getAttribute('data-unit');
    });
}

function duplicateRecipe(id) {
    var recipe = findRecipeById(id);
    if (!recipe) { toast('Recette introuvable', 'error'); return; }
    state.recipeDuplicate = recipe;
    navigate('recipe-form'); // sans id = création
}

function renderRecipeForm(id) {
    render(
        '<div class="page">' +
            '<header class="app-header">' +
                '<button class="back-btn" onclick="safeBack(' + (id ? '\'recipe-view\',{id:' + id + '}' : '\'recipes\'') + ')">' + icon('arrow-left', 20) + '</button>' +
                '<h1>' + (id ? 'Modifier la recette' : 'Nouvelle recette') + '</h1>' +
                (id ? '<button class="icon-btn" style="color:var(--danger)" onclick="confirmDeleteRecipe(' + id + ')">' + icon('trash-2', 20) + '</button>' : '') +
            '</header>' +
            '<div class="page-content page-content-no-nav" id="rf-inner">' +
                '<div style="display:flex;justify-content:center;padding:40px"><div class="loading-spinner"></div></div>' +
            '</div>' +
        '</div>'
    );

    (async function () {
        var recipe = {};
        if (id) {
            recipe = findRecipeById(id) || {};
            if (!recipe.id) {
                var res = await api('recipes.php?id=' + id);
                if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }
                recipe = res;
            }
        } else if (state.recipeDuplicate) {
            // Mode duplication : pré-remplir sans id ni photo
            var src = state.recipeDuplicate;
            recipe = {
                name: 'Copie de ' + src.name,
                difficulty: src.difficulty,
                prep_time: src.prep_time,
                servings: src.servings,
                notes: src.notes,
                tags: src.tags || '',
                photo: null,
                ingredients: src.ingredients || [],
                steps: src.steps || [],
            };
            state.recipeDuplicate = null; // consommé
        }
        var el = document.getElementById('rf-inner');
        if (!el) return;
        el.innerHTML = recipeFormStaticHtml(recipe);
        var ings  = (recipe.ingredients && recipe.ingredients.length) ? recipe.ingredients : [{}];
        var steps = (recipe.steps && recipe.steps.length) ? recipe.steps : [{}];
        ings.forEach(function (ing)   { addIngRow(ing);   });
        steps.forEach(function (step) { addStepRow(step); });
        setupDirtyDetection('recipe-form');
    }());
}

function recipeFormStaticHtml(recipe) {
    var diff = parseInt(recipe.difficulty) || 1;
    var diffLabels = {1:'Facile', 2:'Moyen', 3:'Difficile'};
    return '<form id="recipe-form" onsubmit="doSaveRecipe(event,' + (recipe.id || 0) + ')">' +
        '<div class="section-header"><span class="section-title">Photo</span></div>' +
        '<div class="photo-upload" id="recipe-photo-zone" onclick="document.getElementById(\'recipe-photo-input\').click()">' +
            (recipe.photo ? '<img class="photo-preview" src="' + esc(recipe.photo) + '" alt="">' : icon('camera', 28) + '<span style="font-size:14px">Ajouter une photo</span>') +
        '</div>' +
        '<input type="file" id="recipe-photo-input" accept="image/*" style="display:none" onchange="uploadRecipePhoto(this)">' +
        '<input type="hidden" id="recipe-photo-path" value="' + esc(recipe.photo || '') + '">' +
        '<div class="section-header mt-16"><span class="section-title">Informations</span></div>' +
        '<div class="input-group">' +
            '<label>Nom <span class="required">*</span></label>' +
            '<input class="input" type="text" name="name" placeholder="Ex : Mojito, Negroni…" value="' + esc(recipe.name || '') + '" required>' +
        '</div>' +
        '<div class="input-row">' +
            '<div class="input-group"><label>Temps (min)</label><input class="input" type="number" name="prep_time" min="1" placeholder="5" value="' + esc(recipe.prep_time || '') + '"></div>' +
            '<div class="input-group"><label>Portions</label><input class="input" type="number" name="servings" min="1" max="50" placeholder="1" value="' + esc(recipe.servings || 1) + '"></div>' +
        '</div>' +
        '<div class="input-group"><label>Difficulté</label>' +
            '<div style="display:flex;gap:8px">' +
                [1,2,3].map(function (d) {
                    return '<button type="button" class="btn btn-sm diff-btn ' + (d === diff ? 'btn-primary' : 'btn-surface') +
                           '" data-val="' + d + '" onclick="setDifficulty(' + d + ')">' + diffLabels[d] + '</button>';
                }).join('') +
            '</div>' +
            '<input type="hidden" name="difficulty" id="difficulty-val" value="' + diff + '">' +
        '</div>' +
        '<div class="input-group"><label>Tags</label>' +
            '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px">' +
                RECIPE_TAGS.map(function (tag) {
                    var active = parseTags(recipe.tags).indexOf(tag) !== -1;
                    return '<button type="button" class="chip' + (active ? ' chip-primary' : '') + '" ' +
                           'data-recipe-tag="' + esc(tag) + '" onclick="toggleRecipeTag(\'' + esc(tag) + '\')">' + esc(tag) + '</button>';
                }).join('') +
            '</div>' +
            '<input type="hidden" name="tags" id="recipe-tags-hidden" value="' + esc(recipe.tags || '') + '">' +
        '</div>' +
        '<div class="input-group"><label>Note personnelle — <strong id="recipe-rating-label">' + (recipe.user_rating ? recipe.user_rating + '/5' : '—') + '</strong></label>' +
            '<div style="display:flex;align-items:center;gap:12px;margin-top:4px">' +
                '<input type="range" name="user_rating" min="0" max="5" step="0.5" value="' + (recipe.user_rating || 0) + '" style="flex:1" ' +
                       'oninput="document.getElementById(\'recipe-rating-label\').textContent=this.value>0?this.value+\'/5\':\'—\'">' +
                '<span>' + ratingStarsStr(recipe.user_rating || 0) + '</span>' +
            '</div>' +
        '</div>' +
        '<div class="input-group"><label>Notes / conseils</label>' +
            '<textarea class="input" name="notes" rows="2" placeholder="Astuces, variantes…">' + esc(recipe.notes || '') + '</textarea>' +
        '</div>' +
        '<div class="section-header"><span class="section-title">Ingrédients</span>' +
            '<button type="button" class="btn btn-surface btn-sm" onclick="addIngRow({})">' + icon('plus', 14) + ' Ajouter</button>' +
        '</div>' +
        '<div id="ingredients-container"></div>' +
        '<div class="section-header"><span class="section-title">Étapes</span>' +
            '<button type="button" class="btn btn-surface btn-sm" onclick="addStepRow({})">' + icon('plus', 14) + ' Ajouter</button>' +
        '</div>' +
        '<div id="steps-container"></div>' +
        '<div style="height:8px"></div>' +
        '<button class="btn btn-primary btn-full" type="submit" id="save-recipe-btn">' +
            icon('check', 18) + (recipe.id ? ' Enregistrer les modifications' : ' Créer la recette') +
        '</button>' +
        (recipe.id ? '<button class="btn btn-outline-danger btn-full mt-8" type="button" onclick="confirmDeleteRecipe(' + recipe.id + ')">' + icon('trash-2', 16) + ' Supprimer la recette</button>' : '') +
        '<div style="height:16px"></div>' +
    '</form>';
}

function addIngRow(data) {
    var container = document.getElementById('ingredients-container');
    if (!container) return;
    data = data || {};
    var units = ['cl','ml','oz','pièce','c.à.s.','c.à.c.','g','trait','feuille'];
    var div = document.createElement('div');
    div.className = 'ing-row';
    div.style.cssText = 'border:1px solid var(--border);border-radius:9px;padding:10px;margin-bottom:8px';
    div.innerHTML =
        '<div style="display:flex;gap:6px;margin-bottom:8px;align-items:center">' +
            '<div style="display:flex;flex-direction:column;gap:2px;flex-shrink:0">' +
                '<button type="button" class="ing-move-btn" onclick="moveIngRow(this,\'up\')"   title="Monter">'   + icon('chevron-up',   12) + '</button>' +
                '<button type="button" class="ing-move-btn" onclick="moveIngRow(this,\'down\')" title="Descendre">' + icon('chevron-down', 12) + '</button>' +
            '</div>' +
            '<input class="input" type="text" data-field="name" placeholder="Ingrédient *" value="' + esc(data.name || '') + '" style="flex:1">' +
            '<button type="button" class="btn btn-danger btn-sm" style="flex-shrink:0" onclick="this.closest(\'.ing-row\').remove()">' + icon('x', 14) + '</button>' +
        '</div>' +
        '<div style="display:flex;gap:6px">' +
            '<input class="input" type="number" data-field="qty" placeholder="Qté" step="0.01" min="0.01" value="' + esc(data.quantity || '') + '" style="width:72px">' +
            '<select class="input" data-field="unit" style="flex:1">' +
                units.map(function (u) { return '<option value="' + u + '"' + (data.unit === u ? ' selected' : '') + '>' + u + '</option>'; }).join('') +
            '</select>' +
            '<input class="input" type="number" data-field="alc" placeholder="° alc" step="1" min="0" max="100" value="' + esc(data.alcohol_pct || '') + '" style="width:72px">' +
        '</div>';
    container.appendChild(div);
}

function addStepRow(data) {
    var container = document.getElementById('steps-container');
    if (!container) return;
    data = data || {};
    var num = container.querySelectorAll('.step-row').length + 1;
    var div = document.createElement('div');
    div.className = 'step-row';
    div.style.cssText = 'display:flex;gap:8px;align-items:flex-start;margin-bottom:8px';
    div.innerHTML =
        '<div class="step-number" style="flex-shrink:0;margin-top:10px">' + num + '</div>' +
        '<textarea class="input" data-field="instruction" rows="2" placeholder="Description de l\'étape…" style="flex:1">' + esc(data.instruction || '') + '</textarea>' +
        '<button type="button" class="btn btn-danger btn-sm" style="flex-shrink:0;margin-top:2px" onclick="this.closest(\'.step-row\').remove();renumberSteps()">' + icon('x', 14) + '</button>';
    container.appendChild(div);
}

function renumberSteps() {
    document.querySelectorAll('.step-row .step-number').forEach(function (el, i) { el.textContent = i + 1; });
}

function moveIngRow(btn, dir) {
    var row       = btn.closest('.ing-row');
    var container = document.getElementById('ingredients-container');
    if (!row || !container) return;
    var rows = Array.from(container.querySelectorAll('.ing-row'));
    var idx  = rows.indexOf(row);
    if (dir === 'up'   && idx > 0)              container.insertBefore(row, rows[idx - 1]);
    if (dir === 'down' && idx < rows.length - 1) container.insertBefore(rows[idx + 1], row);
}

function getFormIngredients() {
    return Array.from(document.querySelectorAll('.ing-row')).map(function (row, i) {
        return {
            name: row.querySelector('[data-field=name]').value.trim(),
            quantity: parseFloat(row.querySelector('[data-field=qty]').value) || 0,
            unit: row.querySelector('[data-field=unit]').value,
            alcohol_pct: parseFloat(row.querySelector('[data-field=alc]').value) || 0,
            sort_order: i
        };
    }).filter(function (i) { return i.name && i.quantity > 0; });
}

function getFormSteps() {
    return Array.from(document.querySelectorAll('.step-row')).map(function (row, i) {
        return { step_order: i + 1, instruction: row.querySelector('[data-field=instruction]').value.trim() };
    }).filter(function (s) { return s.instruction; });
}

async function uploadRecipePhoto(input) {
    var file = input.files[0];
    if (!file || input.dataset.uploading) return;
    input.dataset.uploading = '1';
    var zone = document.getElementById('recipe-photo-zone');
    if (zone) zone.innerHTML = '<div class="loading-spinner"></div>';
    var form = new FormData();
    form.append('photo', file);
    try {
        var res = await fetch(API + '/recipes.php?action=upload_photo', {
            method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: form
        });
        var data = await res.json();
        if (data.error) { toast(data.error, 'error'); if (zone) zone.innerHTML = icon('camera', 28) + '<span>Ajouter une photo</span>'; return; }
        document.getElementById('recipe-photo-path').value = data.path;
        if (zone) zone.innerHTML = '<img class="photo-preview" src="' + esc(data.path) + '" alt="">';
    } catch (e) {
        toast('Erreur upload', 'error');
        if (zone) zone.innerHTML = icon('camera', 28) + '<span>Ajouter une photo</span>';
    } finally {
        delete input.dataset.uploading;
    }
}

async function doSaveRecipe(e, id) {
    e.preventDefault();
    var ingredients = getFormIngredients();
    if (!ingredients.length) { toast('Ajoutez au moins un ingrédient', 'error'); return; }
    var form = e.target;
    var btn  = document.getElementById('save-recipe-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span> Enregistrement…';

    var ratingVal = parseFloat(form.querySelector('[name=user_rating]').value) || 0;
    var data = {
        name:        form.querySelector('[name=name]').value.trim(),
        photo:       document.getElementById('recipe-photo-path').value || null,
        difficulty:  parseInt(document.getElementById('difficulty-val').value) || 1,
        prep_time:   parseInt(form.querySelector('[name=prep_time]').value) || null,
        servings:    parseInt(form.querySelector('[name=servings]').value) || 1,
        notes:       form.querySelector('[name=notes]').value.trim(),
        user_rating: ratingVal > 0 ? ratingVal : null,
        tags:        (document.getElementById('recipe-tags-hidden') || {}).value || '',
        ingredients: ingredients,
        steps:       getFormSteps(),
    };

    var res;
    if (id) { data.id = id; res = await put('recipes.php', data); }
    else                     res = await post('recipes.php', data);

    if (!res || res.error) {
        toast((res && res.error) || 'Erreur', 'error');
        btn.disabled = false;
        btn.innerHTML = icon('check', 18) + (id ? ' Enregistrer les modifications' : ' Créer la recette');
        return;
    }
    resetFormDirty();
    toast(id ? 'Recette modifiée !' : 'Recette créée !');
    state.recipes         = null;
    state.suggestAnalyzed = null;
    navigate('recipes');
}

function confirmDeleteRecipe(id) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
        '<div class="modal confirm-dialog">' +
            '<div style="color:var(--danger);margin-bottom:8px">' + icon('trash-2', 36) + '</div>' +
            '<h3>Supprimer cette recette ?</h3>' +
            '<p>Les ingrédients et étapes seront supprimés.</p>' +
            '<div class="confirm-actions">' +
                '<button class="btn btn-surface" onclick="document.querySelector(\'.modal-overlay\').remove()">Annuler</button>' +
                '<button class="btn btn-danger" onclick="doDeleteRecipe(' + id + ')">Supprimer</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
}

async function doDeleteRecipe(id) {
    var overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();
    var res = await del('recipes.php?id=' + id);
    if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }
    toast('Recette supprimée');
    state.recipes         = null;
    state.suggestAnalyzed = null;
    navigate('recipes');
}

// ─── Suggest ──────────────────────────────────────────────────────────────────
// ingQty et ingUnit permettent de vérifier si la quantité en stock est suffisante
function ingredientAvailable(ingName, ingQty, ingUnit, bottles, stock) {
    var ing = (ingName || '').toLowerCase().trim();
    if (!ing) return true;

    // Vérifie dans les bouteilles (fill_pct > 0 — on ne peut pas convertir en cl facilement)
    var inBottles = (bottles || []).some(function (b) {
        if (parseInt(b.fill_pct) <= 0) return false;
        var targets = [
            (b.name  || '').toLowerCase(),
            (b.brand || '').toLowerCase(),
            (b.type  || '').toLowerCase()
        ];
        return targets.some(function (t) {
            return t && (t.indexOf(ing) !== -1 || ing.indexOf(t) !== -1);
        });
    });
    if (inBottles) return true;

    // Vérifie dans les ingrédients stock : quantité disponible ≥ quantité requise (si même unité)
    return (stock || []).some(function (s) {
        var stockQty = parseFloat(s.quantity) || 0;
        if (stockQty <= 0) return false;
        var sName = (s.name || '').toLowerCase();
        if (!(sName.indexOf(ing) !== -1 || ing.indexOf(sName) !== -1)) return false;
        // Si même unité et quantité requise connue → vérifier la suffisance
        if (ingQty > 0 && s.unit === ingUnit && stockQty < ingQty) return false;
        return true;
    });
}

function analyzeRecipes(recipes, bottles, stock) {
    return recipes.map(function (r) {
        var missing = (r.ingredients || [])
            .filter(function (ing) {
                return !ingredientAvailable(
                    ing.name,
                    parseFloat(ing.quantity) || 0,
                    ing.unit || 'cl',
                    bottles,
                    stock
                );
            })
            .map(function (ing) { return ing.name; });
        return { recipe: r, missing: missing, canMake: missing.length === 0, almost: missing.length > 0 && missing.length <= 2 };
    }).filter(function (a) { return a.canMake || a.almost; });
}

function renderSuggest() {
    if (state.suggestFilter === undefined) state.suggestFilter = 'all';
    if (state.suggestSearch === undefined) state.suggestSearch = '';

    render(
        '<div class="page">' +
            '<header class="app-header"><h1>' + icon('lightbulb', 20) + ' Idées cocktails</h1></header>' +
            '<div class="page-content">' +
                '<div class="tabs" style="margin-bottom:10px" id="suggest-tabs">' +
                    '<button class="tab' + (state.suggestFilter === 'all'    ? ' active' : '') + '" onclick="onSuggestFilter(\'all\')"    id="stab-all">Tout voir</button>' +
                    '<button class="tab' + (state.suggestFilter === 'can'    ? ' active' : '') + '" onclick="onSuggestFilter(\'can\')"    id="stab-can">' + icon('circle-check', 13) + ' Prêt à faire</button>' +
                    '<button class="tab' + (state.suggestFilter === 'almost' ? ' active' : '') + '" onclick="onSuggestFilter(\'almost\')" id="stab-almost">' + icon('circle-dot', 13) + ' Il manque peu</button>' +
                '</div>' +
                '<div class="search-bar" style="margin-bottom:14px">' +
                    '<span class="search-bar-icon">' + icon('filter', 15) + '</span>' +
                    '<input class="input" type="search" id="suggest-search" placeholder="Filtrer par ingrédient…" ' +
                           'value="' + esc(state.suggestSearch) + '" oninput="onSuggestSearch(this.value)">' +
                '</div>' +
                '<div id="shopping-list-btn" style="display:none;margin-bottom:12px"></div>' +
                '<div id="suggest-list"><div style="display:flex;justify-content:center;padding:40px">' +
                    '<div class="loading-spinner"></div></div></div>' +
            '</div>' +
            navBar('suggest') +
        '</div>'
    );

    (async function () {
        var fetches = [];
        if (!state.bottles)          fetches.push(api('bottles.php')); else fetches.push(Promise.resolve(null));
        if (!state.recipes)          fetches.push(api('recipes.php')); else fetches.push(Promise.resolve(null));
        if (!state.stockIngredients) fetches.push(api('stock.php'));   else fetches.push(Promise.resolve(null));

        var results = await Promise.all(fetches);
        if (results[0] && !results[0].error) state.bottles          = Array.isArray(results[0]) ? results[0] : [];
        if (results[1] && !results[1].error) state.recipes           = Array.isArray(results[1]) ? results[1] : [];
        if (results[2] && !results[2].error) state.stockIngredients  = Array.isArray(results[2]) ? results[2] : [];

        if (!state.bottles || !state.recipes) {
            showSuggestError('Erreur chargement des données');
            return;
        }
        state.suggestAnalyzed = analyzeRecipes(state.recipes, state.bottles, state.stockIngredients || []);
        refreshSuggestView();
    }());
}

function showSuggestError(msg) {
    var el = document.getElementById('suggest-list');
    if (el) el.innerHTML = '<div class="empty-state">' + icon('alert-circle', 40) + '<p>' + esc(msg) + '</p></div>';
}

function refreshSuggestView() {
    var analyzed = state.suggestAnalyzed || [];
    var filter   = state.suggestFilter  || 'all';
    var search   = (state.suggestSearch || '').toLowerCase().trim();

    // Apply availability filter
    var filtered = analyzed.filter(function (a) {
        if (filter === 'can')    return a.canMake;
        if (filter === 'almost') return a.almost;
        return true;
    });

    // Apply ingredient search filter (FAIRE-4)
    if (search) {
        filtered = filtered.filter(function (a) {
            return (a.recipe.ingredients || []).some(function (ing) {
                return (ing.name || '').toLowerCase().indexOf(search) !== -1;
            });
        });
    }

    // Update tab labels with counts
    var all    = analyzed.length;
    var canCnt = analyzed.filter(function (a) { return a.canMake; }).length;
    var almCnt = analyzed.filter(function (a) { return a.almost;  }).length;
    var tabAll = document.getElementById('stab-all');
    var tabCan = document.getElementById('stab-can');
    var tabAlm = document.getElementById('stab-almost');
    if (tabAll) tabAll.innerHTML = 'Tout voir (' + all + ')';
    if (tabCan) tabCan.innerHTML = icon('circle-check', 13) + ' Prêt à faire (' + canCnt + ')';
    if (tabAlm) tabAlm.innerHTML = icon('circle-dot', 13) + ' Il manque peu (' + almCnt + ')';

    // Bouton liste de courses (visible quand il y a des recettes "presque réalisables")
    var shoppingBtn = document.getElementById('shopping-list-btn');
    if (shoppingBtn) {
        shoppingBtn.style.display = almCnt > 0 ? 'block' : 'none';
        shoppingBtn.innerHTML = '<button class="btn btn-surface btn-full" onclick="generateShoppingList()">' +
            icon('shopping-cart', 16) + ' Générer la liste de courses (' + almCnt + ' ingrédient' + (almCnt > 1 ? 's' : '') + ' manquant' + (almCnt > 1 ? 's' : '') + ')' +
        '</button>';
    }

    var el = document.getElementById('suggest-list');
    if (!el) return;

    if (!state.bottles.length && !(state.stockIngredients || []).length) {
        el.innerHTML = '<div class="empty-state">' + icon('wine', 44) +
            '<p>Votre bar est vide</p>' +
            '<small>Ajoutez vos bouteilles et ingrédients dans Mon Bar pour commencer</small>' +
            '<button class="btn btn-primary mt-12" onclick="navigate(\'bottles\')">' + icon('wine', 16) + ' Aller à Mon Bar</button></div>';
        return;
    }
    if (!state.recipes.length) {
        el.innerHTML = '<div class="empty-state">' + icon('chef-hat', 44) +
            '<p>Aucune recette enregistrée</p>' +
            '<small>Créez vos recettes de cocktails pour voir ce que vous pouvez préparer</small>' +
            '<button class="btn btn-primary mt-12" onclick="navigate(\'recipe-form\')">' + icon('plus', 16) + ' Créer une recette</button></div>';
        return;
    }
    if (!filtered.length) {
        var emptyMsg = filter === 'can'    ? 'Aucun cocktail réalisable pour l\'instant' :
                       filter === 'almost' ? 'Aucun cocktail presque réalisable' :
                       search             ? 'Aucune recette contenant cet ingrédient' :
                       'Aucune correspondance';
        var emptyHint = filter === 'can'
            ? '<small>Consultez "Il manque peu" pour voir ce qu\'il vous faut acheter</small>'
            : '';
        el.innerHTML = '<div class="empty-state">' + icon('lightbulb', 44) +
            '<p>' + emptyMsg + '</p>' + emptyHint +
        '</div>';
        return;
    }

    el.innerHTML = filtered.map(function (a) {
        var r   = a.recipe;
        var alc = parseFloat(calcAlcohol(r.ingredients));
        var statusHtml = a.canMake
            ? '<span style="display:flex;align-items:center;gap:4px;color:var(--success);font-size:12px;font-weight:600">' + icon('check-circle', 14) + ' Réalisable</span>'
            : '<span style="display:flex;align-items:center;gap:4px;color:var(--warning);font-size:12px;font-weight:600">' + icon('alert-triangle', 14) + ' ' + a.missing.length + ' manquant' + (a.missing.length > 1 ? 's' : '') + '</span>';

        var missingHtml = '';
        if (a.almost) {
            missingHtml =
                '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' +
                    a.missing.map(function (m) {
                        return '<span class="chip chip-danger" style="font-size:11px;padding:2px 8px;cursor:pointer;display:inline-flex;align-items:center;gap:4px" ' +
                               'onclick="addMissingIngredient(this,event)" data-name="' + esc(m) + '" ' +
                               'title="Ajouter \'' + esc(m) + '\' à mon bar">' +
                               icon('x', 11) + ' ' + esc(m) + ' ' + icon('plus-circle', 11) +
                               '</span>';
                    }).join('') +
                '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);margin-top:5px;display:flex;align-items:center;gap:4px">' +
                    icon('info', 11) + ' Touchez un ingrédient pour l\'ajouter à votre bar' +
                '</div>';
        }

        return '<div class="card card-flush" style="margin-bottom:10px">' +
            '<div style="display:flex;gap:12px;padding:14px;cursor:pointer" onclick="navigate(\'recipe-view\',{id:' + r.id + '})">' +
                (r.photo
                    ? '<img src="' + esc(r.photo) + '" style="width:66px;height:66px;object-fit:cover;border-radius:8px;flex-shrink:0">'
                    : '<div style="width:66px;height:66px;background:var(--bg);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--text-light)">' + icon('chef-hat', 22) + '</div>') +
                '<div style="flex:1;min-width:0">' +
                    '<div style="font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(r.name) + '</div>' +
                    '<div style="margin-top:4px">' + statusHtml + '</div>' +
                    missingHtml +
                    (alc > 0 ? '<div style="margin-top:6px"><span class="alc-badge">' + icon('droplet', 12) + ' ' + alc + '°</span></div>' : '') +
                '</div>' +
                '<span style="color:var(--text-muted);flex-shrink:0;align-self:center">' + icon('chevron-right', 16) + '</span>' +
            '</div>' +
        '</div>';
    }).join('');
}

function onSuggestFilter(val) {
    state.suggestFilter = val;
    // Met à jour les classes des onglets
    ['all','can','almost'].forEach(function (v) {
        var btn = document.getElementById('stab-' + v);
        if (btn) btn.className = 'tab' + (v === val ? ' active' : '');
    });
    refreshSuggestView();
}

function onSuggestSearch(val) {
    state.suggestSearch = val;
    refreshSuggestView();
}

function generateShoppingList() {
    var analyzed = state.suggestAnalyzed || [];
    var almost   = analyzed.filter(function (a) { return a.almost; });
    if (!almost.length) { toast('Aucun ingrédient manquant trouvé', 'error'); return; }

    // Dédupliquer et compter les recettes concernées
    var map = {};
    almost.forEach(function (a) {
        a.missing.forEach(function (ingName) {
            var key = ingName.toLowerCase().trim();
            if (!map[key]) map[key] = { name: ingName, recipes: [] };
            if (map[key].recipes.indexOf(a.recipe.name) === -1) {
                map[key].recipes.push(a.recipe.name);
            }
        });
    });

    var items = Object.keys(map).map(function (k) { return map[k]; });
    items.sort(function (a, b) { return b.recipes.length - a.recipes.length; });

    var textForCopy = items.map(function (i) {
        return '☐ ' + i.name + (i.recipes.length > 1 ? ' (' + i.recipes.length + ' recettes)' : '');
    }).join('\n');

    var listHtml = items.map(function (item) {
        return '<div style="display:flex;align-items:flex-start;gap:12px;padding:11px 0;border-bottom:1px solid var(--border)">' +
            '<input type="checkbox" style="margin-top:2px;flex-shrink:0;width:18px;height:18px;accent-color:var(--primary)">' +
            '<div style="flex:1">' +
                '<div style="font-weight:500">' + esc(item.name) + '</div>' +
                (item.recipes.length > 1
                    ? '<div style="font-size:12px;color:var(--text-muted)">' + item.recipes.length + ' recettes : ' + esc(item.recipes.join(', ')) + '</div>'
                    : '<div style="font-size:12px;color:var(--text-muted)">' + esc(item.recipes[0]) + '</div>') +
            '</div>' +
        '</div>';
    }).join('');

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
        '<div class="modal">' +
            '<div class="modal-handle"></div>' +
            '<h3 class="modal-title">' + icon('shopping-cart', 20) + ' Liste de courses</h3>' +
            '<p style="font-size:13px;color:var(--text-muted);margin-bottom:14px">' +
                items.length + ' ingrédient' + (items.length > 1 ? 's' : '') + ' à acheter pour ' + almost.length + ' recette' + (almost.length > 1 ? 's' : '') +
            '</p>' +
            '<div style="max-height:45vh;overflow-y:auto">' + listHtml + '</div>' +
            '<div class="modal-actions">' +
                '<button class="btn btn-primary btn-full" onclick="copyShoppingList(\'' + encodeURIComponent(textForCopy) + '\')">' +
                    icon('copy', 16) + ' Copier la liste' +
                '</button>' +
                '<button class="btn btn-ghost btn-full" onclick="this.closest(\'.modal-overlay\').remove()">Fermer</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
}

function copyShoppingList(encoded) {
    var text = decodeURIComponent(encoded);
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
            toast('Liste copiée dans le presse-papier !');
        }).catch(function () { fallbackCopy(text); });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('Liste copiée !'); }
    catch (e) { toast('Impossible de copier automatiquement', 'error'); }
    document.body.removeChild(ta);
}

function addMissingIngredient(el, event) {
    event.stopPropagation();
    var name = el.getAttribute('data-name');
    navigate('ingredient-form', { prefillName: name });
}

// ─── Tableau de bord ──────────────────────────────────────────────────────────
function renderPersonal() {

    render(
        '<div class="page">' +
            '<header class="app-header">' +
                '<h1>' + icon('layout-dashboard', 20) + ' Accueil</h1>' +
                '<div class="header-actions">' +
                    '<button class="icon-btn" onclick="toggleTheme()" title="Changer de thème">' +
                        '<i data-lucide="' + (isDark() ? 'sun' : 'moon') + '" class="theme-toggle-ic" style="width:20px;height:20px"></i>' +
                    '</button>' +
                    '<button class="icon-btn" onclick="navigate(\'settings\')">' + icon('settings', 22) + '</button>' +
                '</div>' +
            '</header>' +
            '<div class="page-content" id="dashboard-content">' +
                '<div style="display:flex;justify-content:center;padding:40px"><div class="loading-spinner"></div></div>' +
            '</div>' +
            navBar('personal') +
        '</div>'
    );

    (async function () {
        var results = await Promise.all([
            state.bottles          ? Promise.resolve(null) : api('bottles.php'),
            state.recipes          ? Promise.resolve(null) : api('recipes.php'),
            state.stockIngredients ? Promise.resolve(null) : api('stock.php'),
            state.productions      ? Promise.resolve(null) : api('productions.php'),
            api('recipes.php?action=history&limit=5'),
        ]);
        if (results[0] && !results[0].error) state.bottles          = Array.isArray(results[0]) ? results[0] : [];
        if (results[1] && !results[1].error) state.recipes           = Array.isArray(results[1]) ? results[1] : [];
        if (results[2] && !results[2].error) state.stockIngredients  = Array.isArray(results[2]) ? results[2] : [];
        if (results[3] && !results[3].error) state.productions       = Array.isArray(results[3]) ? results[3] : [];
        if (results[4] && !results[4].error) state.cocktailHistory   = Array.isArray(results[4]) ? results[4] : [];
        renderDashboard();
    }());
}

function renderDashboard() {
    var bottles  = state.bottles          || [];
    var recipes  = state.recipes          || [];
    var stock    = state.stockIngredients || [];
    var prods    = state.productions      || [];
    var el       = document.getElementById('dashboard-content');
    if (!el) return;

    var activeProd   = prods.filter(function (p) { return p.status === 'in_progress'; });
    var lowBottles   = bottles.filter(function (b) { return parseInt(b.fill_pct) <= 15; });
    var overdueProds = activeProd.filter(function (p) {
        return (p.steps || []).some(function (s) { return isStepOverdue(s); });
    });
    var readyProds   = activeProd.filter(function (p) {
        var steps = p.steps || [];
        return steps.length > 0 && steps.every(function (s) { return s.status === 'done'; });
    });
    var hasAlerts = lowBottles.length > 0 || overdueProds.length > 0 || readyProds.length > 0;
    var isEmpty   = bottles.length === 0 && recipes.length === 0 && stock.length === 0 && prods.length === 0;

    var html = '';

    // ── Onboarding premier démarrage ──────────────────────────────────────
    if (isEmpty) {
        html += '<div class="card" style="margin-bottom:20px;border:2px dashed var(--border);background:var(--primary-light)">' +
            '<div style="font-size:17px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:8px">' +
                icon('sparkles', 20) + ' Bienvenue sur BettOnBar !' +
            '</div>' +
            '<div style="font-size:14px;color:var(--text-muted);line-height:2">' +
                '<div style="display:flex;align-items:center;gap:8px">' +
                    '<span style="background:var(--primary);color:#fff;border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">1</span>' +
                    '<span>Ajoutez vos <strong>bouteilles</strong> dans <em>Mon Bar</em></span>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:8px">' +
                    '<span style="background:var(--primary);color:#fff;border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">2</span>' +
                    '<span>Créez vos <strong>recettes</strong> de cocktails</span>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:8px">' +
                    '<span style="background:var(--primary);color:#fff;border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">3</span>' +
                    '<span>Découvrez les <strong>cocktails réalisables</strong> avec votre stock</span>' +
                '</div>' +
            '</div>' +
            '<button class="btn btn-primary mt-12" onclick="navigate(\'bottles\')">' +
                icon('wine', 16) + ' Commencer par Mon Bar' +
            '</button>' +
        '</div>';
    }

    // ── Stats ─────────────────────────────────────────────────────────────
    html += '<div class="dashboard-stats">';
    html += dashStatCard(bottles.length,     'Bouteilles', 'wine',           "navigate('bottles')");
    html += dashStatCard(recipes.length,     'Recettes',   'chef-hat',       "navigate('recipes')");
    html += dashStatCard(stock.length,       'Ingrédients','leaf',           "goToIngredients()");
    html += dashStatCard(activeProd.length,  'Brassages',  'flask-conical',  "navigate('productions')");
    html += '</div>';

    // ── Alertes ───────────────────────────────────────────────────────────
    html += '<div class="section-header"><span class="section-title">' + icon('bell', 14) + ' Alertes</span></div>';

    if (!hasAlerts) {
        html += '<div class="card" style="display:flex;align-items:center;gap:12px;padding:14px 16px;margin-bottom:16px;color:var(--success)">' +
            icon('circle-check', 22) +
            '<div><div style="font-weight:600;color:var(--text)">Tout est en ordre !</div>' +
            '<div style="font-size:13px;color:var(--text-muted)">Aucune action requise pour le moment.</div></div>' +
        '</div>';
    } else {
        if (lowBottles.length) {
            html += '<div class="card card-flush" style="margin-bottom:10px">' +
                '<div style="padding:10px 16px 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--danger);display:flex;align-items:center;gap:6px">' + icon('wine', 13) + ' Bouteilles à racheter</div>';
            lowBottles.forEach(function (b) {
                html += '<div class="list-item" style="padding:10px 16px" onclick="navigate(\'bottle-form\',{id:' + b.id + '})">' +
                    '<div class="list-item-body">' +
                        '<div class="list-item-title">' + esc(b.name) + '</div>' +
                        '<div class="list-item-sub">' + esc(b.type) + (b.brand ? ' — ' + esc(b.brand) : '') + '</div>' +
                    '</div>' +
                    '<span class="chip chip-danger" style="font-size:11px">' + (parseInt(b.fill_pct) || 0) + '%</span>' +
                    '<span style="color:var(--text-muted);margin-left:8px">' + icon('chevron-right', 14) + '</span>' +
                '</div>';
            });
            html += '</div>';
        }

        if (readyProds.length || overdueProds.length) {
            html += '<div class="card card-flush" style="margin-bottom:10px">' +
                '<div style="padding:10px 16px 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--warning);display:flex;align-items:center;gap:6px">' + icon('flask-conical', 13) + ' Brassages</div>';
            readyProds.forEach(function (p) {
                html += '<div class="list-item" style="padding:10px 16px" onclick="navigate(\'production-view\',{id:' + p.id + '})">' +
                    '<div class="list-item-body"><div class="list-item-title">' + esc(p.name) + '</div></div>' +
                    '<span class="chip chip-success" style="font-size:11px">' + icon('star', 11) + ' Prêt !</span>' +
                    '<span style="color:var(--text-muted);margin-left:8px">' + icon('chevron-right', 14) + '</span>' +
                '</div>';
            });
            overdueProds.forEach(function (p) {
                html += '<div class="list-item" style="padding:10px 16px" onclick="navigate(\'production-view\',{id:' + p.id + '})">' +
                    '<div class="list-item-body"><div class="list-item-title">' + esc(p.name) + '</div></div>' +
                    '<span class="chip chip-warning" style="font-size:11px">' + icon('triangle-alert', 11) + ' À valider</span>' +
                    '<span style="color:var(--text-muted);margin-left:8px">' + icon('chevron-right', 14) + '</span>' +
                '</div>';
            });
            html += '</div>';
        }
    }

    // ── Accès rapides ─────────────────────────────────────────────────────
    html += '<div class="section-header"><span class="section-title">' + icon('zap', 14) + ' Accès rapides</span></div>';
    html += '<div class="dashboard-actions">';
    html += dashAction('wine',         'Ajouter une bouteille', "navigate('bottle-form')");
    html += dashAction('chef-hat',     'Nouvelle recette',      "navigate('recipe-form')");
    html += dashAction('lightbulb',    'Idées cocktails',       "navigate('suggest')");
    html += dashAction('flask-conical','Nouveau brassage',      "navigate('production-form')");
    html += '</div>';

    // ── Historique cocktails ───────────────────────────────────────────────
    var history = state.cocktailHistory || [];
    if (history.length) {
        html += '<div class="section-header"><span class="section-title">' + icon('clock', 14) + ' Derniers cocktails préparés</span></div>';
        html += '<div class="card card-flush" style="margin-bottom:16px"><div style="padding:0 16px">';
        history.forEach(function (h) {
            html += '<div class="list-item" style="padding:11px 0" ' +
                (h.recipe_id ? 'onclick="navigate(\'recipe-view\',{id:' + h.recipe_id + '})" ' : '') + '>' +
                '<div class="list-item-body">' +
                    '<div class="list-item-title">' + esc(h.recipe_name) + '</div>' +
                    '<div class="list-item-sub">' + formatDate(h.prepared_at) + '</div>' +
                '</div>' +
                (h.recipe_id ? '<span style="color:var(--text-muted)">' + icon('chevron-right', 14) + '</span>' : '') +
            '</div>';
        });
        html += '</div></div>';
    }

    el.innerHTML = html;
}

function dashStatCard(count, label, ico, onclick) {
    return '<div class="stat-card" onclick="' + onclick + '">' +
        '<span style="color:var(--primary)">' + icon(ico, 22) + '</span>' +
        '<div class="stat-val">' + count + '</div>' +
        '<div class="stat-lbl">' + label + '</div>' +
    '</div>';
}

function dashAction(ico, label, onclick) {
    return '<button class="quick-action" onclick="' + onclick + '">' +
        icon(ico, 24) +
        '<span>' + label + '</span>' +
    '</button>';
}

function goToIngredients() {
    state.barTab = 'ingredients';
    navigate('bottles');
}

// ─── Productions ──────────────────────────────────────────────────────────────
function isStepOverdue(step) {
    if (step.status !== 'in_progress' || !step.started_at) return false;
    var end = new Date(step.started_at);
    end.setDate(end.getDate() + parseInt(step.duration_days || 0));
    end.setHours(0, 0, 0, 0);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    return end < today;
}

function getDaysRemaining(step) {
    if (!step.started_at) return null;
    var end = new Date(step.started_at);
    end.setDate(end.getDate() + parseInt(step.duration_days || 0));
    end.setHours(0, 0, 0, 0);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((end - today) / 86400000);
}

function formatDate(s) {
    if (!s) return '';
    try { return new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return s; }
}

function findProductionById(id) {
    if (!state.productions) return null;
    return state.productions.find(function (p) { return p.id == id; }) || null;
}

function renderProductions() {
    if (state.productionsFilter === undefined) state.productionsFilter = 'active';
    var f = state.productionsFilter;

    render(
        '<div class="page">' +
            '<header class="app-header"><h1>' + icon('flask-conical', 20) + ' Mes Brassages</h1></header>' +
            '<div class="page-content">' +
                '<div class="tabs" style="margin-bottom:14px">' +
                    '<button class="tab' + (f === 'active' ? ' active' : '') + '" id="ptab-active"  onclick="onProdsFilter(\'active\')">En cours</button>' +
                    '<button class="tab' + (f === 'done'   ? ' active' : '') + '" id="ptab-done"   onclick="onProdsFilter(\'done\')"  >Terminées</button>' +
                    '<button class="tab' + (f === 'all'    ? ' active' : '') + '" id="ptab-all"    onclick="onProdsFilter(\'all\')"  >Toutes</button>' +
                '</div>' +
                '<div id="prod-list"><div style="display:flex;justify-content:center;padding:40px"><div class="loading-spinner"></div></div></div>' +
            '</div>' +
            '<button class="fab" onclick="navigate(\'production-form\')" title="Nouvelle production">' + icon('plus', 24) + '</button>' +
            navBar('productions') +
        '</div>'
    );
    (async function () {
        if (!state.productions) {
            var res = await api('productions.php');
            if (!res || res.error) {
                document.getElementById('prod-list').innerHTML =
                    '<div class="empty-state">' + icon('alert-circle', 40) + '<p>' + esc((res && res.error) || 'Erreur') + '</p></div>';
                return;
            }
            state.productions = Array.isArray(res) ? res : [];
        }
        refreshProductionsView();
    }());
}

function onProdsFilter(val) {
    state.productionsFilter = val;
    ['active','done','all'].forEach(function (v) {
        var b = document.getElementById('ptab-' + v);
        if (b) b.className = 'tab' + (v === val ? ' active' : '');
    });
    refreshProductionsView();
}

function refreshProductionsView() {
    var all   = state.productions || [];
    var f     = state.productionsFilter || 'active';
    var prods = f === 'active' ? all.filter(function (p) { return p.status === 'in_progress'; }) :
                f === 'done'   ? all.filter(function (p) { return p.status !== 'in_progress'; }) :
                all;
    var el = document.getElementById('prod-list');
    if (!el) return;
    if (!prods.length) {
        var emptyMsg  = f === 'active' ? 'Aucun brassage en cours'   :
                        f === 'done'   ? 'Aucun brassage terminé'     : 'Aucune production';
        var emptyHint = f === 'active' ? 'Créez votre premier brassage avec le bouton +' :
                        f === 'done'   ? 'Les brassages terminés et abandonnés s\'affichent ici' : '';
        el.innerHTML = '<div class="empty-state">' + icon('flask-conical', 44) +
            '<p>' + emptyMsg + '</p><small>' + emptyHint + '</small></div>';
        return;
    }
    el.innerHTML = prods.map(function (p) {
        var steps = p.steps || [];
        var done  = steps.filter(function (s) { return s.status === 'done'; }).length;
        var total = steps.length;
        var cur   = steps.find(function (s)   { return s.status === 'in_progress'; });
        var overdue   = cur && isStepOverdue(cur);
        var allDone   = total > 0 && done === total;
        var isReady   = p.status === 'in_progress' && allDone;
        var isFin     = p.status === 'finished';
        var isAban    = p.status === 'abandoned';
        var pct = total > 0 ? Math.round(done / total * 100) : 0;

        var badge = isFin    ? '<span class="chip chip-success">'  + icon('check-circle', 12) + ' Terminé</span>'  :
                    isAban   ? '<span class="chip">'                + icon('x-circle', 12)     + ' Abandonné</span>':
                    isReady  ? '<span class="chip chip-success">'  + icon('star', 12)          + ' Prêt !</span>'   :
                    overdue  ? '<span class="chip chip-warning">'  + icon('alert-triangle',12) + ' À valider</span>':
                               '<span class="chip chip-primary">'  + icon('refresh-cw', 12)   + ' En cours</span>';

        return '<div class="production-card card" style="margin-bottom:10px" onclick="navigate(\'production-view\',{id:' + p.id + '})">' +
            '<div class="production-header">' +
                '<div>' +
                    '<div class="production-name">' + esc(p.name) + '</div>' +
                    '<div class="production-date">' + (p.batch_date ? 'Fournée : ' + formatDate(p.batch_date) : 'Sans date de fournée') + '</div>' +
                '</div>' +
                badge +
            '</div>' +
            (cur ? '<div class="text-sm text-muted" style="margin-bottom:8px">' + icon('chevron-right', 13) + ' ' + esc(cur.name) + '</div>' : '') +
            (total > 0 ?
                '<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-muted)">' +
                    '<div class="progress-bar" style="flex:1"><div class="progress-bar-inner ' + (isFin ? 'pb-success' : '') + '" style="width:' + pct + '%"></div></div>' +
                    done + '/' + total + ' étape' + (total > 1 ? 's' : '') +
                '</div>'
            : '') +
        '</div>';
    }).join('');
}

function renderProductionView(id) {
    render(
        '<div class="page">' +
            '<header class="app-header">' +
                '<button class="back-btn" onclick="navigate(\'productions\')">' + icon('arrow-left', 20) + '</button>' +
                '<h1 id="pv-title" style="font-size:15px">…</h1>' +
                '<button class="icon-btn" id="pv-edit-btn" onclick="navigate(\'production-form\',{id:' + id + '})" style="display:none">' + icon('edit-2', 20) + '</button>' +
                '<button class="icon-btn" style="color:var(--danger)" onclick="confirmDeleteProduction(' + id + ')">' + icon('trash-2', 20) + '</button>' +
            '</header>' +
            '<div class="page-content page-content-no-nav" id="pv-content">' +
                '<div style="display:flex;justify-content:center;padding:40px"><div class="loading-spinner"></div></div>' +
            '</div>' +
        '</div>'
    );
    (async function () {
        var res = await api('productions.php?id=' + id);
        if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }
        var prod = res;
        // Sync cache
        if (!state.productions) state.productions = [];
        var idx = state.productions.findIndex(function (p) { return p.id == id; });
        if (idx >= 0) state.productions[idx] = prod; else state.productions.push(prod);

        var titleEl = document.getElementById('pv-title');
        if (titleEl) titleEl.textContent = prod.name;
        var editBtn = document.getElementById('pv-edit-btn');
        if (editBtn && prod.status === 'in_progress') editBtn.style.display = 'flex';

        var el = document.getElementById('pv-content');
        if (el) el.innerHTML = productionViewHtml(prod);
    }());
}

function productionViewHtml(prod) {
    var steps = prod.steps || [];
    var isFin  = prod.status === 'finished';
    var isAban = prod.status === 'abandoned';
    var allDone = steps.length > 0 && steps.every(function (s) { return s.status === 'done'; });
    var html = '';

    // Status + date
    var badge = isFin  ? '<span class="chip chip-success">'  + icon('check-circle', 14) + ' Terminé</span>'  :
                isAban ? '<span class="chip">'                + icon('x-circle', 14)     + ' Abandonné</span>':
                allDone? '<span class="chip chip-success">'  + icon('star', 14)          + ' Prêt à finir</span>' :
                         '<span class="chip chip-primary">'  + icon('refresh-cw', 14)   + ' En cours</span>';

    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
        badge +
        (prod.batch_date ? '<span class="text-sm text-muted">' + formatDate(prod.batch_date) + '</span>' : '') +
    '</div>';

    // Info card
    var hasInfo = prod.quantity_ml || prod.batch_date;
    var hasPrices = prod.cost_price || prod.sell_price;
    if (hasInfo || hasPrices) {
        html += '<div class="card" style="margin-bottom:16px">';
        if (prod.quantity_ml) html += '<div class="info-row"><span class="info-row-label">Quantité</span><span class="info-row-value">' + prod.quantity_ml + ' ml</span></div>';
        if (hasPrices) {
            if (prod.cost_price) html += '<div class="info-row"><span class="info-row-label">Prix de revient</span><span class="info-row-value">' + parseFloat(prod.cost_price).toFixed(2) + ' €</span></div>';
            if (prod.sell_price) html += '<div class="info-row"><span class="info-row-label">Prix de vente envisagé</span><span class="info-row-value">' + parseFloat(prod.sell_price).toFixed(2) + ' €</span></div>';
            if (prod.cost_price && prod.sell_price) {
                var profit = parseFloat(prod.sell_price) - parseFloat(prod.cost_price);
                var margin = prod.cost_price > 0 ? (profit / prod.cost_price * 100).toFixed(0) : 0;
                var color  = profit >= 0 ? 'var(--success)' : 'var(--danger)';
                var sign   = profit >= 0 ? '+' : '';
                html += '<div class="info-row" style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px">' +
                    '<span class="info-row-label" style="font-weight:600">Bénéfice</span>' +
                    '<span class="info-row-value" style="color:' + color + ';font-weight:700">' + sign + parseFloat(profit).toFixed(2) + ' € (' + sign + margin + '%)</span>' +
                '</div>';
            }
        }
        html += '</div>';
    }

    // Étapes
    html += '<div class="section-header"><span class="section-title">Étapes</span></div>';
    if (!steps.length) {
        html += '<div class="empty-state" style="padding:24px">' + icon('list', 32) + '<p>Aucune étape définie</p></div>';
    } else {
        html += '<div class="card card-flush" style="margin-bottom:16px"><div style="padding:8px 16px">';
        html += '<div class="step-timeline">';
        steps.forEach(function (step) {
            var overdue   = isStepOverdue(step);
            var remaining = getDaysRemaining(step);
            var cls = step.status === 'done' ? 'ts-done' :
                      step.status === 'in_progress' ? (overdue ? 'ts-overdue' : 'ts-active') : '';

            var info = step.status === 'done'
                ? '<span style="color:var(--success);font-size:12px">' + icon('check', 11) + ' Terminé</span>'
                : step.status === 'in_progress'
                    ? (overdue
                        ? '<span style="color:var(--danger);font-size:12px">' + icon('alert-triangle', 11) + ' Dépassé de ' + Math.abs(remaining) + ' j</span>'
                        : '<span style="color:var(--primary);font-size:12px">' + icon('clock', 11) + ' ' + (remaining === 0 ? 'Fin aujourd\'hui' : remaining + ' j restant(s)') + '</span>')
                    : '<span style="color:var(--text-muted);font-size:12px">' + step.duration_days + ' jour(s)</span>';

            html += '<div class="timeline-step ' + cls + '">' +
                '<div class="timeline-step-name">' + esc(step.name) + '</div>' +
                '<div class="timeline-step-info">' + info + '</div>';

            // Boutons d'action pour l'étape en cours
            if (step.status === 'in_progress' && prod.status === 'in_progress') {
                html += '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
                    '<button class="btn btn-accent btn-sm" onclick="doNextStep(' + prod.id + ')">' + icon('check', 14) + ' Étape suivante</button>' +
                    '<button class="btn btn-surface btn-sm" onclick="showExtendStep(' + step.id + ',' + step.duration_days + ')">' + icon('plus', 14) + ' Rallonger</button>' +
                '</div>';
            }
            html += '</div>';
        });
        html += '</div></div></div>';
    }

    // Boutons de clôture
    if (prod.status === 'in_progress') {
        html += '<div style="display:flex;gap:10px;margin-bottom:20px">' +
            '<button class="btn btn-accent" style="flex:1" onclick="confirmFinishProduction(' + prod.id + ')">' + icon('check-circle', 16) + ' Terminer</button>' +
            '<button class="btn btn-outline-danger" style="flex:1" onclick="confirmAbandonProduction(' + prod.id + ')">' + icon('x-circle', 16) + ' Abandonner</button>' +
        '</div>';
    }

    // Journal
    html += '<div class="section-header"><span class="section-title">Journal de dégustation</span></div>';
    var journal = prod.journal || [];
    html += '<div class="card card-flush" style="margin-bottom:16px">';
    if (!journal.length) {
        html += '<div style="padding:16px;color:var(--text-muted);font-size:14px;text-align:center">Aucune note</div>';
    } else {
        html += '<div style="padding:0 16px">';
        journal.forEach(function (e) {
            html += '<div class="journal-entry">' +
                '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">' +
                    '<div class="journal-date">' + formatDate(e.tasted_at) + '</div>' +
                    '<div style="display:flex;gap:4px">' +
                        '<button class="icon-btn" style="width:28px;height:28px" title="Modifier" onclick="showEditJournalModal(' + e.id + ',\'' + esc(e.note).replace(/'/g,'\\\'') + '\',' + prod.id + ')">' + icon('pencil', 13) + '</button>' +
                        '<button class="icon-btn" style="width:28px;height:28px;color:var(--danger)" title="Supprimer" onclick="confirmDeleteJournal(' + e.id + ',' + prod.id + ')">' + icon('trash-2', 13) + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="journal-text">' + esc(e.note) + '</div>' +
            '</div>';
        });
        html += '</div>';
    }
    html += '</div>';

    if (!isAban) {
        html += '<div class="card" style="margin-bottom:24px">' +
            '<div class="input-group" style="margin-bottom:10px">' +
                '<label>Ajouter une note</label>' +
                '<textarea class="input" id="journal-note" rows="3" placeholder="Goût, couleur, évolution…"></textarea>' +
            '</div>' +
            '<button class="btn btn-primary" onclick="doAddJournal(' + prod.id + ')">' + icon('plus', 16) + ' Ajouter</button>' +
        '</div>';
    }

    return html;
}

function renderProductionForm(id) {
    render(
        '<div class="page">' +
            '<header class="app-header">' +
                '<button class="back-btn" onclick="safeBack(' + (id ? '\'production-view\',{id:' + id + '}' : '\'productions\'') + ')">' + icon('arrow-left', 20) + '</button>' +
                '<h1>' + (id ? 'Modifier la production' : 'Nouvelle production') + '</h1>' +
                (id ? '<button class="icon-btn" style="color:var(--danger)" onclick="confirmDeleteProduction(' + id + ')">' + icon('trash-2', 20) + '</button>' : '') +
            '</header>' +
            '<div class="page-content page-content-no-nav" id="pf-inner">' +
                '<div style="display:flex;justify-content:center;padding:40px"><div class="loading-spinner"></div></div>' +
            '</div>' +
        '</div>'
    );
    (async function () {
        var prod = {};
        if (id) {
            prod = findProductionById(id) || {};
            if (!prod.id) {
                var res = await api('productions.php?id=' + id);
                if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }
                prod = res;
            }
        }
        var el = document.getElementById('pf-inner');
        if (!el) return;
        el.innerHTML = productionFormHtml(prod);
        if (!id) { addProdStepRow({}); }
        setupDirtyDetection('prod-form');
    }());
}

function productionFormHtml(prod) {
    var isEdit = !!prod.id;
    return '<form id="prod-form" onsubmit="doSaveProduction(event,' + (prod.id || 0) + ')">' +
        '<div class="section-header"><span class="section-title">Informations</span></div>' +
        '<div class="input-group"><label>Nom <span class="required">*</span></label>' +
            '<input class="input" type="text" name="name" placeholder="Ex : Limoncello maison, Bière brune…" value="' + esc(prod.name || '') + '" required>' +
        '</div>' +
        '<div class="input-row">' +
            '<div class="input-group"><label>Date de fournée</label>' +
                '<input class="input" type="date" name="batch_date" value="' + esc(prod.batch_date || '') + '"></div>' +
            '<div class="input-group"><label>Quantité (ml)</label>' +
                '<input class="input" type="number" name="quantity_ml" min="0" step="100" placeholder="750" value="' + esc(prod.quantity_ml || '') + '"></div>' +
        '</div>' +
        '<div class="section-header"><span class="section-title">Économies</span></div>' +
        '<div class="input-row">' +
            '<div class="input-group"><label>Prix de revient (€)</label>' +
                '<input class="input" type="number" name="cost_price" min="0" step="0.01" placeholder="0.00" value="' + esc(prod.cost_price || '') + '"></div>' +
            '<div class="input-group"><label>Prix de vente (€)</label>' +
                '<input class="input" type="number" name="sell_price" min="0" step="0.01" placeholder="0.00" value="' + esc(prod.sell_price || '') + '"></div>' +
        '</div>' +
        (!isEdit ?
            '<div class="section-header"><span class="section-title">Étapes de fabrication</span>' +
                '<button type="button" class="btn btn-surface btn-sm" onclick="addProdStepRow({})">' + icon('plus', 14) + ' Ajouter</button>' +
            '</div>' +
            '<div id="prod-steps-container"></div>' +
            '<p class="input-hint" style="margin-bottom:16px">La première étape démarre automatiquement à la création.</p>'
        :
            '<div class="card" style="margin-bottom:16px;background:var(--bg)">' +
                '<div style="display:flex;gap:10px;align-items:center;color:var(--text-muted);font-size:13px">' +
                    icon('info', 16) +
                    '<span>Les étapes ne sont pas modifiables. Utilisez les boutons dans la fiche production pour avancer ou rallonger.</span>' +
                '</div>' +
            '</div>'
        ) +
        '<button class="btn btn-primary btn-full" type="submit" id="save-prod-btn">' +
            icon('check', 18) + (isEdit ? ' Enregistrer' : ' Créer la production') +
        '</button>' +
        '<div style="height:16px"></div>' +
    '</form>';
}

function addProdStepRow(data) {
    var container = document.getElementById('prod-steps-container');
    if (!container) return;
    data = data || {};
    var num = container.querySelectorAll('.prod-step-row').length + 1;
    var div = document.createElement('div');
    div.className = 'prod-step-row';
    div.style.cssText = 'display:flex;gap:8px;align-items:flex-start;margin-bottom:8px';
    div.innerHTML =
        '<div class="step-number" style="flex-shrink:0;margin-top:10px">' + num + '</div>' +
        '<input class="input" type="text" data-field="name" placeholder="Nom de l\'étape *" value="' + esc(data.name || '') + '" style="flex:2">' +
        '<div style="display:flex;gap:4px;align-items:center;flex-shrink:0">' +
            '<input class="input" type="number" data-field="days" placeholder="Durée" min="1" max="999" value="' + esc(data.duration_days || '') + '" style="width:72px">' +
            '<span style="font-size:13px;color:var(--text-muted)">j</span>' +
        '</div>' +
        '<button type="button" class="btn btn-danger btn-sm" style="flex-shrink:0;margin-top:2px" ' +
               'onclick="this.closest(\'.prod-step-row\').remove();renumberProdSteps()">' + icon('x', 14) + '</button>';
    container.appendChild(div);
}

function renumberProdSteps() {
    document.querySelectorAll('.prod-step-row .step-number').forEach(function (el, i) { el.textContent = i + 1; });
}

function getProdFormSteps() {
    return Array.from(document.querySelectorAll('.prod-step-row')).map(function (row, i) {
        return { name: row.querySelector('[data-field=name]').value.trim(), duration_days: parseInt(row.querySelector('[data-field=days]').value) || 1, sort_order: i };
    }).filter(function (s) { return s.name; });
}

async function doSaveProduction(e, id) {
    e.preventDefault();
    var form = e.target;
    var btn  = document.getElementById('save-prod-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span> Enregistrement…';

    var data = {
        name:        form.querySelector('[name=name]').value.trim(),
        batch_date:  form.querySelector('[name=batch_date]').value || null,
        quantity_ml: form.querySelector('[name=quantity_ml]').value || null,
        cost_price:  form.querySelector('[name=cost_price]').value  || null,
        sell_price:  form.querySelector('[name=sell_price]').value  || null,
    };

    if (!id) {
        var steps = getProdFormSteps();
        if (!steps.length) { toast('Ajoutez au moins une étape', 'error'); btn.disabled = false; btn.innerHTML = icon('check', 18) + ' Créer la production'; return; }
        data.steps = steps;
    }

    var res;
    if (id) { data.id = id; res = await put('productions.php', data); }
    else                     res = await post('productions.php', data);

    if (!res || res.error) {
        toast((res && res.error) || 'Erreur', 'error');
        btn.disabled = false;
        btn.innerHTML = icon('check', 18) + (id ? ' Enregistrer' : ' Créer la production');
        return;
    }
    resetFormDirty();
    toast(id ? 'Production modifiée !' : 'Production créée !');
    state.productions = null;
    if (id) navigate('production-view', { id: id });
    else    navigate('productions');
}

function showExtendStep(stepId, currentDays) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
        '<div class="modal confirm-dialog">' +
            '<div style="margin-bottom:8px;color:var(--primary)">' + icon('clock', 32) + '</div>' +
            '<h3>Rallonger l\'étape</h3>' +
            '<p>Durée actuelle : ' + currentDays + ' jour(s)</p>' +
            '<div class="input-group" style="margin:12px 0;text-align:left">' +
                '<label>Jours à ajouter</label>' +
                '<input class="input" type="number" id="extend-days-input" min="1" max="365" value="7">' +
            '</div>' +
            '<div class="confirm-actions">' +
                '<button class="btn btn-surface" onclick="document.querySelector(\'.modal-overlay\').remove()">Annuler</button>' +
                '<button class="btn btn-primary" onclick="doExtendStep(' + stepId + ')">Confirmer</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
}

async function doNextStep(prodId) {
    var res = await post('productions.php?action=next_step&id=' + prodId, {});
    if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }
    toast('Étape validée !');
    state.productions = null;
    navigate('production-view', { id: prodId });
}

async function doExtendStep(stepId) {
    var overlay = document.querySelector('.modal-overlay');
    var days    = parseInt(document.getElementById('extend-days-input').value) || 7;
    if (overlay) overlay.remove();
    var res = await post('productions.php?action=extend_step', { step_id: stepId, days: days });
    if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }
    toast('Durée rallongée de ' + days + ' jour(s)');
    // Récupérer le prodId AVANT de vider le cache (state.data contient les params de navigate courant)
    var prodId = state.data && state.data.id;
    state.productions = null;
    if (prodId) navigate('production-view', { id: prodId });
    else        navigate('productions');
}

async function doAddJournal(prodId) {
    var note = (document.getElementById('journal-note') || {}).value || '';
    if (!note.trim()) { toast('Écrivez une note avant d\'ajouter', 'error'); return; }
    var res = await post('productions.php?action=add_journal', { production_id: prodId, note: note.trim() });
    if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }
    toast('Note ajoutée !');
    state.productions = null;
    navigate('production-view', { id: prodId });
}

function showEditJournalModal(journalId, currentNote, prodId) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
        '<div class="modal">' +
            '<div class="modal-handle"></div>' +
            '<h3 class="modal-title">' + icon('pencil', 18) + ' Modifier la note</h3>' +
            '<div class="input-group">' +
                '<textarea class="input" id="edit-journal-text" rows="4">' + esc(currentNote) + '</textarea>' +
            '</div>' +
            '<div id="edit-journal-error" class="auth-error" style="display:none"></div>' +
            '<div class="modal-actions">' +
                '<button class="btn btn-primary btn-full" onclick="doEditJournal(' + journalId + ',' + prodId + ')">Enregistrer</button>' +
                '<button class="btn btn-ghost btn-full" onclick="this.closest(\'.modal-overlay\').remove()">Annuler</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    setTimeout(function () { var t = document.getElementById('edit-journal-text'); if (t) t.focus(); }, 50);
}

async function doEditJournal(journalId, prodId) {
    var note = (document.getElementById('edit-journal-text') || {}).value || '';
    if (!note.trim()) {
        var errEl = document.getElementById('edit-journal-error');
        if (errEl) { errEl.innerHTML = icon('alert-circle', 14) + ' La note ne peut pas être vide'; errEl.style.display = 'flex'; }
        return;
    }
    var res = await post('productions.php?action=edit_journal', { id: journalId, note: note.trim() });
    if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }
    var overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();
    toast('Note modifiée');
    state.productions = null;
    navigate('production-view', { id: prodId });
}

function confirmDeleteJournal(journalId, prodId) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
        '<div class="modal confirm-dialog">' +
            '<div style="color:var(--danger);margin-bottom:8px">' + icon('trash-2', 32) + '</div>' +
            '<h3>Supprimer cette note ?</h3>' +
            '<p>La note de dégustation sera supprimée définitivement.</p>' +
            '<div class="confirm-actions">' +
                '<button class="btn btn-surface" onclick="document.querySelector(\'.modal-overlay\').remove()">Annuler</button>' +
                '<button class="btn btn-danger" onclick="doDeleteJournal(' + journalId + ',' + prodId + ')">Supprimer</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
}

async function doDeleteJournal(journalId, prodId) {
    var overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();
    var res = await del('productions.php?action=delete_journal&id=' + journalId);
    if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }
    toast('Note supprimée');
    state.productions = null;
    navigate('production-view', { id: prodId });
}

function confirmFinishProduction(id) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
        '<div class="modal confirm-dialog">' +
            '<div style="color:var(--success);margin-bottom:8px">' + icon('check-circle', 36) + '</div>' +
            '<h3>Terminer la production ?</h3>' +
            '<p>La production sera marquée comme terminée.</p>' +
            '<div class="confirm-actions">' +
                '<button class="btn btn-surface" onclick="document.querySelector(\'.modal-overlay\').remove()">Annuler</button>' +
                '<button class="btn btn-accent" onclick="doFinishProduction(' + id + ')">Terminer</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
}

async function doFinishProduction(id) {
    var overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();
    var res = await post('productions.php?action=finish&id=' + id, {});
    if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }
    toast('Production terminée !');
    state.productions = null;
    navigate('production-view', { id: id });
}

function confirmAbandonProduction(id) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
        '<div class="modal confirm-dialog">' +
            '<div style="color:var(--danger);margin-bottom:8px">' + icon('x-circle', 36) + '</div>' +
            '<h3>Abandonner la production ?</h3>' +
            '<p>Cette action est irréversible. La production sera marquée comme abandonnée.</p>' +
            '<div class="confirm-actions">' +
                '<button class="btn btn-surface" onclick="document.querySelector(\'.modal-overlay\').remove()">Annuler</button>' +
                '<button class="btn btn-danger" onclick="doAbandonProduction(' + id + ')">Abandonner</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
}

async function doAbandonProduction(id) {
    var overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();
    var res = await post('productions.php?action=abandon&id=' + id, {});
    if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }
    toast('Production abandonnée');
    state.productions = null;
    navigate('productions');
}

function confirmDeleteProduction(id) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
        '<div class="modal confirm-dialog">' +
            '<div style="color:var(--danger);margin-bottom:8px">' + icon('trash-2', 36) + '</div>' +
            '<h3>Supprimer la production ?</h3>' +
            '<p>Le journal et toutes les étapes seront supprimés.</p>' +
            '<div class="confirm-actions">' +
                '<button class="btn btn-surface" onclick="document.querySelector(\'.modal-overlay\').remove()">Annuler</button>' +
                '<button class="btn btn-danger" onclick="doDeleteProduction(' + id + ')">Supprimer</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
}

async function doDeleteProduction(id) {
    var overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();
    var res = await del('productions.php?id=' + id);
    if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }
    toast('Production supprimée');
    state.productions = null;
    navigate('productions');
}

// ─── Mode préparation plein écran ─────────────────────────────────────────────
var _wakeLock = null;

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try { _wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* non supporté */ }
    }
}
function releaseWakeLock() {
    if (_wakeLock) { try { _wakeLock.release(); } catch(e){} _wakeLock = null; }
}

function renderCookMode(data) {
    var id = data && data.id;
    if (!id) { navigate('recipes'); return; }
    var recipe = findRecipeById(id);
    if (!recipe) { toast('Recette introuvable', 'error'); navigate('recipe-view', { id: id }); return; }
    if (!(recipe.steps || []).length) {
        toast('Aucune étape définie pour cette recette', 'error');
        navigate('recipe-view', { id: id });
        return;
    }
    state.cookRecipeId = id;
    state.cookStep     = 0;
    requestWakeLock();
    renderCookStep();
}

function renderCookStep() {
    var recipe = findRecipeById(state.cookRecipeId);
    if (!recipe) { exitCookMode(); return; }
    var steps = recipe.steps || [];
    var idx   = state.cookStep;
    var total = steps.length;
    var step  = steps[idx];
    if (!step) { exitCookMode(); return; }

    var dots = steps.map(function (_, j) {
        var cls = j < idx ? 'cook-dot done' : j === idx ? 'cook-dot current' : 'cook-dot';
        return '<span class="' + cls + '"></span>';
    }).join('');

    var ings = recipe.ingredients || [];
    var ingsHtml = ings.length
        ? '<details class="cook-ing-details">' +
              '<summary class="cook-ing-summary">' + icon('list', 14) + ' Voir les ingrédients (' + ings.length + ')</summary>' +
              '<div class="cook-ing-list">' +
                  ings.map(function (ing) {
                      return '<div class="cook-ing-row">' +
                          '<span class="cook-ing-qty">' + ing.quantity + ' ' + esc(ing.unit) + '</span>' +
                          '<span>' + esc(ing.name) + '</span>' +
                      '</div>';
                  }).join('') +
              '</div>' +
          '</details>'
        : '';

    render(
        '<div class="cook-page">' +
            '<div class="cook-header">' +
                '<button class="cook-exit" onclick="exitCookMode()">' + icon('x', 18) + '</button>' +
                '<div class="cook-recipe-name">' + esc(recipe.name) + '</div>' +
                '<div class="cook-dots">' + dots + '</div>' +
            '</div>' +
            '<div class="cook-counter">Étape ' + (idx + 1) + ' sur ' + total + '</div>' +
            '<div class="cook-body">' +
                '<div class="cook-instruction">' + esc(step.instruction) + '</div>' +
            '</div>' +
            ingsHtml +
            '<div class="cook-footer">' +
                '<button class="cook-btn cook-prev" onclick="cookPrev()" ' + (idx === 0 ? 'disabled' : '') + '>' +
                    icon('chevron-left', 22) + ' Précédent' +
                '</button>' +
                (idx < total - 1
                    ? '<button class="cook-btn cook-next" onclick="cookNext()">Suivant ' + icon('chevron-right', 22) + '</button>'
                    : '<button class="cook-btn cook-done" onclick="exitCookMode()">' + icon('check', 22) + ' Terminé !</button>'
                ) +
            '</div>' +
        '</div>'
    );
}

function cookNext() {
    var recipe = findRecipeById(state.cookRecipeId);
    if (recipe && state.cookStep < (recipe.steps || []).length - 1) {
        state.cookStep++;
        renderCookStep();
    }
}
function cookPrev() {
    if (state.cookStep > 0) { state.cookStep--; renderCookStep(); }
}
function exitCookMode() {
    releaseWakeLock();
    navigate('recipe-view', { id: state.cookRecipeId });
}

// ─── Bar partagé (lecture) ────────────────────────────────────────────────────
function renderSharedBar(data) {
    var ownerId   = data && data.ownerId;
    var ownerName = data && data.ownerName ? data.ownerName : 'Inconnu';
    if (!ownerId) { navigate('settings'); return; }

    render(
        '<div class="page">' +
            '<header class="app-header">' +
                '<button class="back-btn" onclick="navigate(\'settings\')">' + icon('arrow-left', 20) + '</button>' +
                '<h1 style="font-size:15px">' + icon('wine', 18) + ' Bar de ' + esc(ownerName) + '</h1>' +
                '<span class="chip" style="font-size:11px">' + icon('eye', 12) + ' Lecture</span>' +
            '</header>' +
            '<div class="page-content page-content-no-nav">' +
                '<div class="search-bar">' +
                    '<span class="search-bar-icon">' + icon('search', 16) + '</span>' +
                    '<input class="input" type="search" id="sb-search" placeholder="Rechercher…" oninput="filterSharedBottles(this.value)">' +
                '</div>' +
                '<div id="shared-bottles-list"><div style="display:flex;justify-content:center;padding:40px"><div class="loading-spinner"></div></div></div>' +
            '</div>' +
        '</div>'
    );

    (async function () {
        var res = await api('bottles.php?owner_id=' + ownerId);
        if (!res || res.error) {
            document.getElementById('shared-bottles-list').innerHTML =
                '<div class="empty-state">' + icon('circle-alert', 40) +
                '<p>' + esc((res && res.error) || 'Erreur') + '</p></div>';
            return;
        }
        state.sharedBottles     = Array.isArray(res) ? res : [];
        state.sharedBottlesSearch = '';
        renderSharedBottlesList();
    }());
}

function filterSharedBottles(val) {
    state.sharedBottlesSearch = val;
    renderSharedBottlesList();
}

function renderSharedBottlesList() {
    var bottles = state.sharedBottles || [];
    var search  = (state.sharedBottlesSearch || '').toLowerCase();
    var filtered = search
        ? bottles.filter(function (b) {
            return b.name.toLowerCase().indexOf(search) !== -1 ||
                   (b.brand || '').toLowerCase().indexOf(search) !== -1 ||
                   b.type.toLowerCase().indexOf(search) !== -1;
          })
        : bottles;

    var el = document.getElementById('shared-bottles-list');
    if (!el) return;

    if (!filtered.length) {
        el.innerHTML = '<div class="empty-state">' + icon('wine', 44) +
            '<p>' + (search ? 'Aucun résultat' : 'Ce bar est vide') + '</p></div>';
        return;
    }

    var html = '<div class="card card-flush">';
    filtered.forEach(function (b) {
        var pct     = parseInt(b.fill_pct) || 0;
        var fillCls = pct <= 15 ? 'fill-low' : (pct <= 40 ? 'fill-medium' : '');
        var isLow   = pct <= 15;
        html +=
            '<div class="bottle-card" style="cursor:default">' +
                (b.photo
                    ? '<img class="bottle-thumb" src="' + esc(b.photo) + '" alt="" loading="lazy">'
                    : '<div class="bottle-thumb-placeholder">' + icon('wine', 20) + '</div>') +
                '<div class="bottle-info">' +
                    '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px">' +
                        '<div class="bottle-type" style="flex:1;min-width:0">' + esc(b.type) + (b.vintage ? ' · ' + b.vintage : '') + '</div>' +
                        (isLow ? '<span class="chip chip-danger" style="font-size:10px;padding:1px 6px;flex-shrink:0">Presque vide</span>' : '') +
                    '</div>' +
                    '<div class="bottle-name">' + esc(b.name) + '</div>' +
                    (b.brand ? '<div class="bottle-brand">' + esc(b.brand) + '</div>' : '') +
                    '<div style="display:flex;align-items:center;gap:8px;margin-top:6px">' +
                        '<div class="fill-bar" style="flex:1"><div class="fill-bar-inner ' + fillCls + '" style="width:' + pct + '%"></div></div>' +
                        '<span style="font-size:11px;color:var(--text-muted);min-width:30px;text-align:right">' + pct + '%</span>' +
                    '</div>' +
                    (b.rating ? '<div style="margin-top:4px">' + starsHtml(b.rating) + '</div>' : '') +
                '</div>' +
            '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function renderSettings() {
    render(
        '<div class="page">' +
            '<header class="app-header">' +
                '<button class="back-btn" onclick="navigate(\'personal\')">' + icon('arrow-left', 20) + '</button>' +
                '<h1>' + icon('settings', 20) + ' Réglages</h1>' +
            '</header>' +
            '<div class="page-content page-content-no-nav" id="settings-content">' +
                '<div style="display:flex;justify-content:center;padding:40px"><div class="loading-spinner"></div></div>' +
            '</div>' +
        '</div>'
    );

    (async function () {
        var results = await Promise.all([api('shares.php'), api('auth.php?action=users')]);
        var sharesRes = results[0];
        var usersRes  = results[1];

        var shares = (sharesRes && !sharesRes.error) ? sharesRes : { outgoing: [], incoming: [] };
        var users  = Array.isArray(usersRes) ? usersRes : [];

        var el = document.getElementById('settings-content');
        if (el) el.innerHTML = settingsHtml(shares, users);
    }());
}

function settingsHtml(shares, users) {
    var outgoing = shares.outgoing || [];
    var incoming = shares.incoming || [];
    var uname    = (currentUser && currentUser.username) || '?';
    var html     = '';

    // ── Compte ──────────────────────────────────────────────────────────────
    html += '<div class="section-header"><span class="section-title">Mon compte</span></div>';
    html += '<div class="card" style="margin-bottom:16px">' +
        '<div style="display:flex;align-items:center;gap:14px">' +
            '<div class="avatar avatar-lg">' + esc(uname[0].toUpperCase()) + '</div>' +
            '<div><div style="font-weight:600;font-size:17px">' + esc(uname) + '</div>' +
                '<div class="text-sm text-muted">Connecté</div></div>' +
        '</div>' +
    '</div>';

    // ── Apparence ─────────────────────────────────────────────────────────────
    html += '<div class="section-header"><span class="section-title">Apparence</span></div>';
    html += '<div class="card card-flush" style="margin-bottom:16px"><div style="padding:0 16px">' +
        '<div class="settings-row">' +
            '<div class="settings-row-icon">' + icon(isDark() ? 'sun' : 'moon', 18) + '</div>' +
            '<div class="settings-row-body">' +
                '<div class="settings-row-title">Mode sombre</div>' +
                '<div class="settings-row-sub">Interface pour les ambiances tamisées</div>' +
            '</div>' +
            '<label class="toggle">' +
                '<input type="checkbox" ' + (isDark() ? 'checked' : '') + ' onchange="toggleTheme()">' +
                '<span class="toggle-track"></span>' +
            '</label>' +
        '</div>' +
    '</div></div>';

    // ── Explication du partage ────────────────────────────────────────────────
    html += '<div class="card" style="margin-bottom:16px;background:var(--primary-light);border:1px solid var(--accent-light)">' +
        '<div style="display:flex;gap:10px;align-items:flex-start">' +
            '<span style="color:var(--primary);flex-shrink:0;margin-top:2px">' + icon('info', 18) + '</span>' +
            '<div style="font-size:13px;color:var(--text)">' +
                '<strong>Comment fonctionne le partage ?</strong><br>' +
                'Partagez votre bar avec un autre utilisateur de l\'application. ' +
                'Il pourra consulter vos bouteilles. ' +
                'Les bars partagés <em>avec vous</em> sont accessibles via le bouton ' +
                '<strong>Voir le bar</strong> ci-dessous.' +
            '</div>' +
        '</div>' +
    '</div>';

    // ── Accès à mon bar (partages sortants) ──────────────────────────────────
    html += '<div class="section-header">' +
        '<span class="section-title">Accès à mon bar</span>' +
        '<span class="chip">' + outgoing.length + ' personne' + (outgoing.length > 1 ? 's' : '') + '</span>' +
    '</div>';
    html += '<div class="card card-flush" style="margin-bottom:12px">';
    if (!outgoing.length) {
        html += '<div style="padding:16px;color:var(--text-muted);font-size:14px;text-align:center">Aucun accès partagé pour l\'instant</div>';
    } else {
        html += '<div style="padding:0 16px">';
        outgoing.forEach(function (s) {
            html += '<div class="share-item">' +
                '<div class="avatar avatar-sm">' + esc(s.guest_username[0].toUpperCase()) + '</div>' +
                '<div style="flex:1">' +
                    '<div class="share-item-name">' + esc(s.guest_username) + '</div>' +
                    '<div class="share-item-perm">' + (s.can_write ? icon('edit-2', 12) + ' Lecture + écriture' : icon('eye', 12) + ' Lecture seule') + '</div>' +
                '</div>' +
                '<button class="btn btn-outline-danger btn-sm" onclick="confirmRevokeShare(' + s.id + ',\'' + esc(s.guest_username) + '\')">' + icon('x', 13) + ' Retirer</button>' +
            '</div>';
        });
        html += '</div>';
    }
    html += '</div>';

    // ── Formulaire d'ajout ────────────────────────────────────────────────────
    // Filtrer les utilisateurs déjà partagés
    var availableUsers = users.filter(function (u) {
        return !outgoing.some(function (s) { return s.guest_id == u.id; });
    });

    html += '<div class="card" style="margin-bottom:20px">';
    html += '<div class="section-header" style="margin-top:0"><span class="section-title">Partager avec quelqu\'un</span></div>';
    if (!users.length) {
        html += '<div style="display:flex;gap:10px;align-items:center;color:var(--text-muted);font-size:13px">' +
            icon('info', 16) +
            '<span>Aucun autre compte enregistré sur cette instance.</span></div>';
    } else if (!availableUsers.length) {
        html += '<div style="display:flex;gap:10px;align-items:center;color:var(--text-muted);font-size:13px">' +
            icon('check-circle', 16) +
            '<span>Tous les utilisateurs ont déjà accès à votre bar.</span></div>';
    } else {
        var opts = '<option value="">— Choisir un utilisateur —</option>' +
            availableUsers.map(function (u) {
                return '<option value="' + u.id + '">' + esc(u.username) + '</option>';
            }).join('');
        html += '<div class="input-group">' +
            '<label>Utilisateur</label>' +
            '<select class="input" id="share-guest-select">' + opts + '</select>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
            '<span style="font-size:14px;font-weight:500">Autoriser les modifications</span>' +
            '<label class="toggle">' +
                '<input type="checkbox" id="share-can-write">' +
                '<span class="toggle-track"></span>' +
            '</label>' +
        '</div>' +
        '<button class="btn btn-primary btn-full" onclick="doAddShare()">' + icon('share-2', 16) + ' Partager mon bar</button>';
    }
    html += '</div>';

    // ── Bars partagés avec moi (partages entrants) ────────────────────────────
    html += '<div class="section-header"><span class="section-title">Bars partagés avec moi</span></div>';
    if (!incoming.length) {
        html += '<div class="card" style="margin-bottom:16px;padding:14px 16px;color:var(--text-muted);font-size:14px">' +
            icon('share-2', 16) + ' Aucun bar partagé avec vous pour l\'instant.' +
        '</div>';
    } else {
        html += '<div class="card card-flush" style="margin-bottom:20px"><div style="padding:0 16px">';
        incoming.forEach(function (s) {
            html += '<div class="share-item">' +
                '<div class="avatar avatar-sm">' + esc(s.owner_username[0].toUpperCase()) + '</div>' +
                '<div style="flex:1">' +
                    '<div class="share-item-name">Bar de <strong>' + esc(s.owner_username) + '</strong></div>' +
                    '<div class="share-item-perm">' + (s.can_write ? icon('pencil', 12) + ' Lecture + écriture' : icon('eye', 12) + ' Lecture seule') + '</div>' +
                '</div>' +
                '<button class="btn btn-primary btn-sm" ' +
                    'onclick="navigate(\'shared-bar\',{ownerId:' + s.owner_id + ',ownerName:\'' + esc(s.owner_username) + '\'})">' +
                    icon('wine', 14) + ' Voir le bar' +
                '</button>' +
            '</div>';
        });
        html += '</div></div>';
    }

    // ── Gestion du compte ─────────────────────────────────────────────────────
    html += '<div class="section-header"><span class="section-title">Gestion du compte</span></div>';
    html += '<div class="card card-flush" style="margin-bottom:16px">';

    var accountRows = [
        { ico: 'edit-2',   label: "Changer l'identifiant",   sub: 'Modifier votre nom d\'utilisateur', fn: 'showChangeUsernameModal()', danger: false },
        { ico: 'lock',     label: 'Changer le mot de passe',  sub: 'Exige le mot de passe actuel',      fn: 'showChangePasswordModal()', danger: false },
        { ico: 'trash-2',  label: 'Supprimer le compte',      sub: 'Efface toutes vos données',         fn: 'showDeleteAccountModal()',  danger: true  },
    ];
    html += '<div style="padding:0 16px">';
    accountRows.forEach(function (row) {
        html += '<div class="settings-row" style="cursor:pointer" onclick="' + row.fn + '">' +
            '<div class="settings-row-icon" style="' + (row.danger ? 'background:var(--danger-light);color:var(--danger)' : '') + '">' +
                icon(row.ico, 18) +
            '</div>' +
            '<div class="settings-row-body">' +
                '<div class="settings-row-title" style="' + (row.danger ? 'color:var(--danger)' : '') + '">' + row.label + '</div>' +
                '<div class="settings-row-sub">' + row.sub + '</div>' +
            '</div>' +
            '<span style="color:var(--text-muted)">' + icon('chevron-right', 16) + '</span>' +
        '</div>';
    });
    html += '</div></div>';

    // ── Session ───────────────────────────────────────────────────────────────
    html += '<div class="section-header"><span class="section-title">Session</span></div>';
    html += '<button class="btn btn-outline-danger btn-full" onclick="logout()">' + icon('log-out', 16) + ' Se déconnecter</button>';
    html += '<div style="height:24px"></div>';

    return html;
}

// ── Modales gestion de compte ──────────────────────────────────────────────────

function showChangeUsernameModal() {
    var uname = (currentUser && currentUser.username) || '';
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
        '<div class="modal">' +
            '<div class="modal-handle"></div>' +
            '<h3 class="modal-title">' + icon('edit-2', 20) + ' Changer l\'identifiant</h3>' +
            '<div class="input-group">' +
                '<label>Nouvel identifiant</label>' +
                '<input class="input" type="text" id="new-username-input" value="' + esc(uname) + '" autocomplete="username">' +
            '</div>' +
            '<div class="input-group">' +
                '<label>Mot de passe actuel (confirmation)</label>' +
                '<input class="input" type="password" id="confirm-pass-username" placeholder="Votre mot de passe" autocomplete="current-password">' +
            '</div>' +
            '<div id="modal-error-username" class="auth-error" style="display:none"></div>' +
            '<div class="modal-actions">' +
                '<button class="btn btn-primary btn-full" onclick="doChangeUsername()">Enregistrer</button>' +
                '<button class="btn btn-ghost btn-full" onclick="this.closest(\'.modal-overlay\').remove()">Annuler</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    setTimeout(function () { var el = document.getElementById('new-username-input'); if (el) { el.focus(); el.select(); } }, 50);
}

function showChangePasswordModal() {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
        '<div class="modal">' +
            '<div class="modal-handle"></div>' +
            '<h3 class="modal-title">' + icon('lock', 20) + ' Changer le mot de passe</h3>' +
            '<div class="input-group">' +
                '<label>Mot de passe actuel</label>' +
                '<input class="input" type="password" id="old-pass-input" autocomplete="current-password">' +
            '</div>' +
            '<div class="input-group">' +
                '<label>Nouveau mot de passe <span style="color:var(--text-muted);font-size:12px">(min. 6 caractères)</span></label>' +
                '<input class="input" type="password" id="new-pass-input" autocomplete="new-password">' +
            '</div>' +
            '<div class="input-group">' +
                '<label>Confirmer le nouveau mot de passe</label>' +
                '<input class="input" type="password" id="new-pass-confirm-input" autocomplete="new-password">' +
            '</div>' +
            '<div id="modal-error-pass" class="auth-error" style="display:none"></div>' +
            '<div class="modal-actions">' +
                '<button class="btn btn-primary btn-full" onclick="doChangePassword()">Enregistrer</button>' +
                '<button class="btn btn-ghost btn-full" onclick="this.closest(\'.modal-overlay\').remove()">Annuler</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
}

function showDeleteAccountModal() {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
        '<div class="modal">' +
            '<div class="modal-handle"></div>' +
            '<div style="color:var(--danger);text-align:center;margin-bottom:8px">' + icon('trash-2', 40) + '</div>' +
            '<h3 class="modal-title" style="color:var(--danger);text-align:center">Supprimer le compte</h3>' +
            '<p style="font-size:14px;color:var(--text-muted);margin-bottom:16px;text-align:center">' +
                'Cette action est <strong>irréversible</strong>. Toutes vos bouteilles, recettes, productions et photos seront supprimées définitivement.' +
            '</p>' +
            '<div class="input-group">' +
                '<label>Confirmez avec votre mot de passe</label>' +
                '<input class="input" type="password" id="delete-pass-input" placeholder="Votre mot de passe" autocomplete="current-password">' +
            '</div>' +
            '<div id="modal-error-delete" class="auth-error" style="display:none"></div>' +
            '<div class="modal-actions">' +
                '<button class="btn btn-danger btn-full" onclick="doDeleteAccount()">Supprimer définitivement</button>' +
                '<button class="btn btn-ghost btn-full" onclick="this.closest(\'.modal-overlay\').remove()">Annuler</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
}

function showModalError(elId, msg) {
    var el = document.getElementById(elId);
    if (el) { el.innerHTML = icon('alert-circle', 14) + ' ' + esc(msg); el.style.display = 'flex'; }
}

async function doChangeUsername() {
    var newName = (document.getElementById('new-username-input') || {}).value || '';
    var pass    = (document.getElementById('confirm-pass-username') || {}).value || '';
    if (!newName.trim()) { showModalError('modal-error-username', 'Saisissez un identifiant'); return; }
    if (!pass)           { showModalError('modal-error-username', 'Saisissez votre mot de passe'); return; }

    var res = await post('auth.php?action=change_username', { username: newName.trim(), password: pass });
    if (!res || res.error) { showModalError('modal-error-username', res ? res.error : 'Erreur'); return; }

    currentUser.username = res.username;
    localStorage.setItem('bettonbar_user', JSON.stringify(currentUser));
    document.querySelector('.modal-overlay').remove();
    toast('Identifiant modifié !');
    navigate('settings');
}

async function doChangePassword() {
    var oldPass  = (document.getElementById('old-pass-input')         || {}).value || '';
    var newPass  = (document.getElementById('new-pass-input')         || {}).value || '';
    var confirm  = (document.getElementById('new-pass-confirm-input') || {}).value || '';
    if (!oldPass) { showModalError('modal-error-pass', 'Saisissez votre mot de passe actuel'); return; }
    if (newPass.length < 6) { showModalError('modal-error-pass', 'Le nouveau mot de passe doit contenir au moins 6 caractères'); return; }
    if (newPass !== confirm) { showModalError('modal-error-pass', 'Les mots de passe ne correspondent pas'); return; }

    var res = await post('auth.php?action=change_password', { current_password: oldPass, new_password: newPass });
    if (!res || res.error) { showModalError('modal-error-pass', res ? res.error : 'Erreur'); return; }

    document.querySelector('.modal-overlay').remove();
    toast('Mot de passe modifié !');
}

async function doDeleteAccount() {
    var pass = (document.getElementById('delete-pass-input') || {}).value || '';
    if (!pass) { showModalError('modal-error-delete', 'Saisissez votre mot de passe pour confirmer'); return; }

    var res = await post('auth.php?action=delete_account', { password: pass });
    if (!res || res.error) { showModalError('modal-error-delete', res ? res.error : 'Erreur'); return; }

    // Nettoyage local complet
    token = null; currentUser = null;
    state = {};
    localStorage.removeItem('bettonbar_token');
    localStorage.removeItem('bettonbar_user');
    document.querySelector('.modal-overlay').remove();
    toast('Compte supprimé');
    navigate('auth');
}

async function doAddShare() {
    var guestId  = (document.getElementById('share-guest-select') || {}).value;
    var canWrite = (document.getElementById('share-can-write') || {}).checked ? 1 : 0;
    if (!guestId) { toast('Sélectionnez un utilisateur', 'error'); return; }

    var btn = document.querySelector('#settings-content .btn-primary');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="btn-spinner"></span> Partage…'; }

    var res = await post('shares.php', { guest_id: parseInt(guestId), can_write: canWrite });
    if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); navigate('settings'); return; }
    toast('Bar partagé !');
    navigate('settings');
}

function confirmRevokeShare(id, username) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
        '<div class="modal confirm-dialog">' +
            '<div style="color:var(--danger);margin-bottom:8px">' + icon('share-2', 32) + '</div>' +
            '<h3>Retirer l\'accès ?</h3>' +
            '<p><strong>' + esc(username) + '</strong> ne pourra plus consulter votre bar.</p>' +
            '<div class="confirm-actions">' +
                '<button class="btn btn-surface" onclick="document.querySelector(\'.modal-overlay\').remove()">Annuler</button>' +
                '<button class="btn btn-danger" onclick="doRevokeShare(' + id + ')">Retirer</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
}

async function doRevokeShare(id) {
    var overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();
    var res = await del('shares.php?id=' + id);
    if (!res || res.error) { toast((res && res.error) || 'Erreur', 'error'); return; }
    toast('Accès retiré');
    navigate('settings');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
    // MutationObserver : traite automatiquement les icônes Lucide à chaque modification du DOM
    if (typeof lucide !== 'undefined') {
        new MutationObserver(function (mutations) {
            var hasIcons = mutations.some(function (m) {
                return Array.from(m.addedNodes).some(function (node) {
                    if (node.nodeType !== 1) return false;
                    return (node.tagName === 'I' && node.hasAttribute('data-lucide')) ||
                           (node.querySelector && !!node.querySelector('[data-lucide]'));
                });
            });
            if (hasIcons) lucide.createIcons();
        }).observe(document.body, { childList: true, subtree: true });
    }

    // 1. DÉBLOCAGE SILENCIEUX DE L'HÉBERGEUR
    // L'écran de chargement (spinner) est visible pendant ces 4 secondes
    await unlockAPI();

    // 2. SUITE LOGIQUE DE L'APPLICATION
    if (token) {
        state.view = 'checking';
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