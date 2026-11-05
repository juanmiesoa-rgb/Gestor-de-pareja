/* =============================================================================
   AUTH-SERVICE.JS · Google Sign-In (Identity Services) · v5
   ============================================================================= */
const AuthService = (function () {
    'use strict';

    const CONFIG = {
        // ⚠️ PON AQUÍ TU CLIENT ID
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

    function handleCredentialResponse(response) {
        console.log('[AuthService] Callback disparado por Google:', response);
        
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
            picture: claims.picture || ''
        };
        
        try { localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(currentUser)); } catch (e) {}
        try { localStorage.setItem(STORAGE_TOKEN_KEY, JSON.stringify({ credential: currentIdToken, expiresAt: tokenExpiresAt })); } catch (e) {}
        
        hideLogin();
        emit();
    }

    async function init() {
        if (initialized) return;
        await loadScript();
        initialized = true;

        // Restaurar sesión si existe
        try {
            const raw = localStorage.getItem(STORAGE_TOKEN_KEY);
            if (raw) {
                const p = JSON.parse(raw);
                if (p.credential && p.expiresAt > Date.now()) {
                    currentIdToken = p.credential;
                    tokenExpiresAt = p.expiresAt;
                    currentUser = JSON.parse(localStorage.getItem(STORAGE_USER_KEY));
                }
            }
        } catch (e) {}

        google.accounts.id.initialize({
            client_id: CONFIG.clientId,
            callback: handleCredentialResponse,
            ux_mode: 'popup', // Forzar ventana emergente clásica
            auto_select: false,
            cancel_on_tap_outside: true
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
                width: 280
            });
        }

        emit();
    }

    function signIn() { init(); }

    function signOut() {
        currentUser = null;
        currentIdToken = null;
        tokenExpiresAt = 0;
        try { localStorage.removeItem(STORAGE_USER_KEY); localStorage.removeItem(STORAGE_TOKEN_KEY); } catch (e) {}
        if (window.google && google.accounts && google.accounts.id) {
            try { google.accounts.id.disableAutoSelect(); } catch (e) {}
        }
        showLogin();
        emit();
    }

    function requestReauth() {
        signOut(); // Forzamos salida limpia
        showError('Sesión caducada. Vuelve a entrar.');
    }

    function getIdToken() {
        if (!currentIdToken) return null;
        if (tokenExpiresAt && tokenExpiresAt < Date.now()) return null;
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
