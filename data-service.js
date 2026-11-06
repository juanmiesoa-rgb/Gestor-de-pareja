/* =============================================================================
   DATA-SERVICE.JS · v3 — Sincronización segura (Anti-borrado de Sheet)
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
    
    // 🔒 CANDADO DE SEGURIDAD: Evita que la app guarde datos antes de leer
    let isFirstReadComplete = false; 

    const listeners = [];

    /* -------- API pública -------- */

    async function init() {
        status.phase = 'connecting';
        emit();
        
        // Intentamos la primera lectura de forma estricta
        const success = await refreshFromServer();
        
        if (success) {
            isFirstReadComplete = true; 
            console.log('[DataService] Lectura inicial exitosa. Guardado en Sheet habilitado.');
        } else {
            console.warn('[DataService] ⚠️ Lectura inicial fallida. El guardado en el Sheet está BLOQUEADO para proteger tus datos.');
        }
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
                console.info('[DataService] Datos actualizados desde Sheets');
                document.dispatchEvent(new CustomEvent('app:data-refreshed'));
            }
            return true;
        } catch (e) {
            console.warn('[DataService] refresh falló:', e);
            status.connected = false;
            status.lastError = e.message || String(e);
            status.phase = /sesión|expirada|unauthorized/i.test(e.message || '') ? 'error' : 'disconnected';
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
                    ? Object.assign(clone(defaults), parsed)
                    : parsed;
            }
        } catch (e) {}
        return clone(defaults);
    }

    function saveStored(key, value) {
        // 1 · Escribir en localStorage (siempre, para que la UI responda al instante)
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}

        // 🔒 2 · CANDADO: Si no hemos leído el Sheet, no enviamos nada al servidor
        if (!isFirstReadComplete) {
            console.log('[DataService] Guardado bloqueado: no se ha completado la lectura inicial.');
            return;
        }

        // 3 · Encolar sync a Sheets
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
            if (json.error === 'forbidden') {
                throw new Error('Tu cuenta (' + json.email + ') no tiene acceso a este Sheet.');
            }
            throw new Error(json.error || 'read failed');
        }
        return json.data;
    }

    function getStatus() {
        return Object.assign({}, status, {
            pendingModules: Object.keys(pending)
        });
    }

    function onStatusChange(fn) {
        if (typeof fn === 'function') listeners.push(fn);
    }

    function emit() {
        const s = getStatus();
        listeners.forEach(fn => { try { fn(s); } catch (e) {} });
        if (window.App && typeof App.updateSyncBadge === 'function') {
            App.updateSyncBadge(s);
        }
    }

    // Flush al cerrar pestaña (Corregido el cierre de llaves)
    window.addEventListener('beforeunload', () => {
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

    return {
        init,
        loadStored,
        saveStored,
        flush,
        getStatus,
        onStatusChange,
        forceRefresh: refreshFromServer, 
        config: CONFIG
    };
})();

window.DataService = DataService;