/* =============================================================================
   DATA-SERVICE.JS · v6 — Sincronización limpia
   ============================================================================= */
const DataService = (function () {
    'use strict';

    const CONFIG = {
        apiUrl: 'https://script.google.com/macros/s/AKfycbwCFEoAoe6WeShWyWUm-ast-HNuATa0Q7zW7XjYaXQFX3kt19UqB8gSqDLjS-fEspxP/exec',
        debounceMs: 2000
    };

    const MODULE_BY_KEY = {
        'finanzas_data':          'app',
        'finanzas_dinero_v2':     'dinero',
        'finanzas_ingresos_v11':  'ingresos',
        'finanzas_viajes_v2':     'viajes'
    };
    const KEY_BY_MODULE = Object.fromEntries(Object.entries(MODULE_BY_KEY).map(([k, v]) => [v, k]));

    const pending = {};                 
    const timers = {};                  
    const status = { connected: false, lastSync: null, lastError: null, syncing: false, phase: 'idle' };
    let _refreshInFlight = false;
    let isFirstReadComplete = false; // 🔒 CANDADO MAESTRO (solo bloquea escritura)

    const listeners = [];

    async function init() {
        status.phase = 'connecting';
        emit();
        const success = await refreshFromServer();
        if (success) {
            isFirstReadComplete = true; 
            console.log('[DataService] Lectura exitosa. Guardado HABILITADO.');
        } else {
            console.warn('[DataService] ⚠️ Lectura fallida. Guardado BLOQUEADO para proteger datos.');
        }
        return success;
    }

    async function refreshFromServer() {
        if (_refreshInFlight) return false;
        _refreshInFlight = true;
        try {
            status.syncing = true;
            status.phase = 'reading';
            emit();

            const data = await fetchAll();

            let anyChange = false;
            Object.entries(KEY_BY_MODULE).forEach(([mod, key]) => {
                if (!data[mod]) return;
                const incoming = JSON.stringify(data[mod]);
                const local = localStorage.getItem(key);
                if (local !== incoming) {
                    try { localStorage.setItem(key, incoming); } catch (e) {}
                    anyChange = true;
                }
            });

            status.connected = true;
            status.lastSync = Date.now();
            status.lastError = null;
            status.phase = 'connected';

            if (anyChange) {
                document.dispatchEvent(new CustomEvent('app:data-refreshed'));
            }
            return true;
        } catch (e) {
            console.warn('[DataService] refresh falló:', e);
            status.connected = false;
            status.lastError = e.message || String(e);
            status.phase = 'error';
            return false;
        } finally {
            _refreshInFlight = false;
            status.syncing = false;
            emit();
        }
    }

    function loadStored(key, defaults) {
        const clone = o => o ? JSON.parse(JSON.stringify(o)) : o;
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const parsed = JSON.parse(raw);
                return (defaults && typeof defaults === 'object' && !Array.isArray(defaults))
                    ? Object.assign(clone(defaults), parsed) : parsed;
            }
        } catch (e) {}
        return clone(defaults);
    }

    function saveStored(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}

        // 🔒 EL CANDADO: Si la lectura inicial falló, NO se envía nada al Sheet
        if (!isFirstReadComplete) {
            console.warn('[DataService] 🛑 Guardado bloqueado: la app no ha leído el Sheet correctamente.');
            return;
        }

        const module = MODULE_BY_KEY[key];
        if (!module) return;

        pending[module] = value;
        clearTimeout(timers[module]);
        timers[module] = setTimeout(() => flushOne(module), CONFIG.debounceMs);
    }

    async function flushOne(module) {
        if (!pending[module]) return;
        const data = pending[module];
        delete pending[module];

        try {
            status.syncing = true;
            status.phase = 'writing';
            emit();

            const idToken = window.AuthService ? AuthService.getIdToken() : null;
            if (!idToken) {
                pending[module] = data;
                status.connected = false;
                status.lastError = 'Sin sesión';
                status.phase = 'error';
                return;
            }

            const bodyPayload = { action: 'write', module, data, id_token: idToken };
            const response = await fetch(CONFIG.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(bodyPayload)
            });

            const json = await response.json();
            if (!json.ok) {
                if (json.error === 'unauthorized') {
                    if (window.AuthService) AuthService.requestReauth();
                }
                throw new Error(json.error || 'write failed');
            }

            status.connected = true;
            status.lastSync = Date.now();
            status.lastError = null;
            status.phase = 'connected';
        } catch (e) {
            console.warn('[DataService] flushOne falló (' + module + '):', e);
            status.connected = false;
            status.lastError = e.message || String(e);
            status.phase = /sesión|unauthorized/i.test(e.message || '') ? 'error' : 'disconnected';
            pending[module] = data;
        } finally {
            status.syncing = false;
            emit();
        }
    }

    async function flush() {
        if (!isFirstReadComplete) return;
        const modules = Object.keys(pending);
        await Promise.all(modules.map(m => flushOne(m)));
    }

    async function fetchAll() {
        const idToken = window.AuthService ? AuthService.getIdToken() : null;
        if (!idToken) throw new Error('Sesión expirada. Vuelve a iniciar sesión.');

        const payload = { action: 'read', id_token: idToken };
        const r = await fetch(CONFIG.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        
        const json = await r.json();
        if (!json.ok) {
            if (json.error === 'unauthorized') {
                if (window.AuthService) AuthService.requestReauth();
                throw new Error('Sesión expirada');
            }
            if (json.error === 'forbidden') throw new Error('Tu cuenta no tiene acceso.');
            throw new Error(json.error || 'read failed');
        }
        return json.data;
    }

    function getStatus() {
        return Object.assign({}, status, { pendingModules: Object.keys(pending) });
    }

    function onStatusChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

    function emit() {
        const s = getStatus();
        listeners.forEach(fn => { try { fn(s); } catch (e) {} });
        if (window.App && typeof App.updateSyncBadge === 'function') App.updateSyncBadge(s);
    }

    window.addEventListener('beforeunload', () => {
        if (!isFirstReadComplete) return;
        const idToken = window.AuthService ? AuthService.getIdToken() : null;
        if (!idToken) return;
        Object.keys(pending).forEach(m => {
            try {
                fetch(CONFIG.apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ id_token: idToken, action: 'write', module: m, data: pending[m] }),
                    keepalive: true
                });
            } catch (e) {}
        });
    });

    window.addEventListener('online', () => {
        if (status.phase === 'disconnected') {
            status.phase = 'connecting';
            emit();
            refreshFromServer().then(success => {
                if (success && !isFirstReadComplete) isFirstReadComplete = true;
            }).catch(() => {});
        }
    });
    
    window.addEventListener('offline', () => {
        status.connected = false;
        status.lastError = 'Sin conexión a internet';
        status.phase = 'disconnected';
        emit();
    });

    return { init, loadStored, saveStored, flush, getStatus, onStatusChange, forceRefresh: refreshFromServer, config: CONFIG };
})();

window.DataService = DataService;
