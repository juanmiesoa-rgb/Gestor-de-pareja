/* =============================================================================
   AUTH-SERVICE.JS · Google Sign-In (Identity Services) · v4
   ============================================================================= */
const AuthService = (function () {
    'use strict';

    const CONFIG = {
        clientId: 'PEGA_AQUI_TU_CLIENT_ID.apps.googleusercontent.com' 
    };

    const STORAGE_USER_KEY = 'finanzas_auth_user';
    const STORAGE_TOKEN_KEY = 'finanzas_auth_id_token';

    let currentUser = null;
    let currentIdToken = null;
    let tokenExpiresAt = 0;
    let initialized = false;
    const listeners = [];

    function loadScript() {
        return new Promise((resolve, reject) => {
            if (window.google && window.google.accounts && window.google.accounts.id) return resolve();
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
        try { localStorage.setItem(STORAGE_TOKEN_KEY, JSON.stringify({ credential, expiresAt })); } catch (e) {}
    }
    function loadPersistedUser() {
        try {
            const raw = localStorage.getItem(STORAGE_USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }
    function loadPersistedToken() {
        try {
            const raw = localStorage.getItem(STORAGE_TOKEN_KEY);
            if (!raw) return null;
            const p = JSON.parse(raw);
            // Ignorar si caducó o le queda menos de 1 minuto
            if (!p.credential || !p.expiresAt || p.expiresAt < (Date.now() + 60000)) return null;
            return p;
        } catch (e) { return null; }
    }
    function clearStorage() {
        try { localStorage.removeItem(STORAGE_USER_KEY); } catch (e) {}
        try { localStorage.removeItem(STORAGE_TOKEN_KEY); } catch (e) {}
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
        
        console.log('[AuthService] Login correcto. Expira en:', Math.round((claims.exp * 1000 - Date.now()) / 60000), 'minutos');
        
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

        const persistedToken = loadPersistedToken();
        if (persistedToken) {
            currentIdToken = persistedToken.credential;
            tokenExpiresAt = persistedToken.expiresAt;
            currentUser = loadPersistedUser();
            console.log('[AuthService] Sesión restaurada. Expira en:', Math.round((tokenExpiresAt - Date.now()) / 60000), 'minutos');
        }

        google.accounts.id.initialize({
            client_id: CONFIG.clientId,
            callback: handleCredentialResponse,
            auto_select: false, // Desactivado para evitar bloqueos del navegador
            cancel_on_tap_outside: true,
            use_fedcm_for_prompt: false // Desactivado, usamos solo el botón
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
        if (!initialized) return init();
        // Ya no usamos google.accounts.id.prompt() porque el botón ya hace la función
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
        currentUser = null;
        currentIdToken = null;
        tokenExpiresAt = 0;
        clearStorage();
        showError('Tu sesión ha caducado. Por favor, vuelve a entrar.');
        showLogin();
        emit();
    }

    function getIdToken() {
        if (!currentIdToken) return null;
        if (tokenExpiresAt && tokenExpiresAt < Date.now()) {
            return null;
        }
        return currentIdToken;
    }

    function getUser() { return currentUser; }
    function isSignedIn() { return !!getIdToken(); }
    function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }
    function emit() {
        const payload = { user: currentUser, signedIn: isSignedIn() };
        listeners.forEach(fn => { try { fn(payload); } catch (e) {} });
        if (window.App && typeof App.updateAuthUI === 'function') App.updateAuthUI(payload);
    }
    function showLogin() { const el = document.getElementById('authOverlay'); if (el) el.classList.add('active'); }
    function hideLogin() { const el = document.getElementById('authOverlay'); if (el) el.classList.remove('active'); }
    function showError(msg) { const el = document.getElementById('authError'); if (el) el.textContent = msg || ''; }

    return { init, signIn, signOut, requestReauth, getIdToken, getUser, isSignedIn, onChange, showLogin, hideLogin, showError, config: CONFIG };
})();

window.AuthService = AuthService;
