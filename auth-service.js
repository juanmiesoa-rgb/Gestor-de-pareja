/* =============================================================================
   AUTH-SERVICE.JS · Google Sign-In (Identity Services)
   ============================================================================= */
const AuthService = (function () {
    'use strict';

    const CONFIG = {
        // ⚠️ CAMBIA ESTO POR TU CLIENT ID DE GOOGLE CLOUD
        clientId: '183798659982-8ul1bm5sq2lohn4cac9j4udtp7jv65uc.apps.googleusercontent.com' 
    };

    const STORAGE_USER_KEY = 'finanzas_auth_user';
    const SESSION_TOKEN_KEY = 'finanzas_auth_id_token';

    let currentUser = null;
    let currentIdToken = null;
    let tokenExpiresAt = 0;
    let initialized = false;
    const listeners = [];

    function loadScript() {
        return new Promise((resolve, reject) => {
            if (window.google && window.google.accounts && window.google.accounts.id) return resolve();
            const existing = document.getElementById('gis-script');
            if (existing) {
                existing.addEventListener('load', resolve);
                existing.addEventListener('error', reject);
                return;
            }
            const s = document.createElement('script');
            s.id = 'gis-script';
            s.src = 'https://accounts.google.com/gsi/client';
            s.async = true;
            s.defer = true;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    function parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const json = decodeURIComponent(atob(base64).split('').map(c =>
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join(''));
            return JSON.parse(json);
        } catch (e) { return null; }
    }

    function persistUser(u) {
        try { localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(u)); } catch (e) {}
    }
    function persistToken(credential, expiresAt) {
        try { sessionStorage.setItem(SESSION_TOKEN_KEY, JSON.stringify({ credential, expiresAt })); } catch (e) {}
    }
    function loadPersistedUser() {
        try {
            const raw = localStorage.getItem(STORAGE_USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }
    function loadPersistedToken() {
        try {
            const raw = sessionStorage.getItem(SESSION_TOKEN_KEY);
            if (!raw) return null;
            const p = JSON.parse(raw);
            if (!p.credential || !p.expiresAt || p.expiresAt < Date.now()) return null;
            return p;
        } catch (e) { return null; }
    }
    function clearStorage() {
        try { localStorage.removeItem(STORAGE_USER_KEY); } catch (e) {}
        try { sessionStorage.removeItem(SESSION_TOKEN_KEY); } catch (e) {}
    }

    function handleCredentialResponse(response) {
        if (!response || !response.credential) {
            showError('No se recibió credencial de Google.');
            return;
        }
        const claims = parseJwt(response.credential);
        if (!claims || !claims.email) {
            showError('Token de Google inválido.');
            return;
        }
        currentIdToken = response.credential;
        tokenExpiresAt = (Number(claims.exp) || 0) * 1000;
        currentUser = {
            email: claims.email,
            name: claims.name || claims.email,
            picture: claims.picture || '',
            sub: claims.sub || ''
        };
        persistUser(currentUser);
        persistToken(currentIdToken, tokenExpiresAt);
        hideLogin();
        emit();
    }

    async function init() {
        if (initialized) return;
        await loadScript();
        initialized = true;

        const persistedUser = loadPersistedUser();
        if (persistedUser) currentUser = persistedUser;

        const persistedToken = loadPersistedToken();
        if (persistedToken) {
            currentIdToken = persistedToken.credential;
            tokenExpiresAt = persistedToken.expiresAt;
        }

        google.accounts.id.initialize({
            client_id: CONFIG.clientId,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: false,
            use_fedcm_for_prompt: true
        });

        const btn = document.getElementById('gsiButton');
        if (btn) {
            google.accounts.id.renderButton(btn, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                shape: 'pill',
                logo_alignment: 'left',
                width: Math.min(320, window.innerWidth - 96)
            });
        }

        emit();
    }

    function signIn() {
        if (!initialized) return init().then(signIn);
        try {
            google.accounts.id.prompt();
        } catch (e) {
            console.warn('[AuthService] signIn falló:', e);
        }
    }

    function signOut() {
        currentUser = null;
        currentIdToken = null;
        tokenExpiresAt = 0;
        clearStorage();
        if (window.google && google.accounts && google.accounts.id) {
            try { google.accounts.id.disableAutoSelect(); } catch (e) {}
        }
        showLogin();
        emit();
    }

    function requestReauth() {
        currentIdToken = null;
        tokenExpiresAt = 0;
        showError('Tu sesión ha expirado. Vuelve a iniciar sesión.');
        showLogin();
        emit();
    }

    function getIdToken() {
        if (!currentIdToken) return null;
        if (tokenExpiresAt && tokenExpiresAt < Date.now()) {
            currentIdToken = null;
            return null;
        }
        return currentIdToken;
    }

    function getUser() { return currentUser; }
    function isSignedIn() { return !!getIdToken(); }

    function onChange(fn) {
        if (typeof fn === 'function') listeners.push(fn);
    }

    function emit() {
        const payload = { user: currentUser, signedIn: isSignedIn() };
        listeners.forEach(fn => { try { fn(payload); } catch (e) {} });
        if (window.App && typeof App.updateAuthUI === 'function') {
            App.updateAuthUI(payload);
        }
    }

    function showLogin() {
        const el = document.getElementById('authOverlay');
        if (el) el.classList.add('active');
    }
    function hideLogin() {
        const el = document.getElementById('authOverlay');
        if (el) el.classList.remove('active');
    }
    function showError(msg) {
        const el = document.getElementById('authError');
        if (el) el.textContent = msg || '';
    }

    return {
        init, signIn, signOut, requestReauth,
        getIdToken, getUser, isSignedIn, onChange,
        showLogin, hideLogin, showError,
        config: CONFIG
    };
})();

window.AuthService = AuthService;