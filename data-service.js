/* =============================================================================
   DATA-SERVICE.JS · Sincronización localStorage ↔ Google Sheet vía Apps Script
   -----------------------------------------------------------------------------
   · init()         → lee los 4 módulos del Sheet y los inyecta en localStorage
   · loadStored()   → lectura síncrona desde localStorage (con fallback al defaults)
   · saveStored()   → escritura inmediata en localStorage + sync debounced a Sheets
   · flush()        → fuerza escritura pendiente (antes de cerrar pestaña)
   · getStatus()    → estado de conexión
   ============================================================================= */
const DataService = (function () {
    'use strict';

    const CONFIG = {
        // ⚠️ EDITA ESTOS DOS VALORES con los que obtuviste en el despliegue del Web App
        apiUrl: 'https://script.google.com/macros/s/AKfycbwCFEoAoe6WeShWyWUm-ast-HNuATa0Q7zW7XjYaXQFX3kt19UqB8gSqDLjS-fEspxP/exec',
        token: '15770e57-c8e2-4591-980f-31212777a050-a5fd3bff-e360-49c0-88b4-2a56b8a8d46a',
        debounceMs: 2000
    };

    const MODULE_BY_KEY = {
        'finanzas_data':          'app',
        'finanzas_dinero_v2':     'dinero',
        'finanzas_ingresos_v11':  'ingresos',
        'finanzas_viajes_v2':     'viajes'
    };
    const KEY_BY_MODULE = Object.fromEntries(Object.entries(MODULE_BY_KEY).map(([k, v]) => [v, k]));

    const pending = {};                 // { module: dataJson }
    const timers = {};                  // { module: timeoutId }
    const status = { connected: false, lastSync: null, lastError: null, syncing: false };
    const listeners = [];

    /* -------- API pública -------- */

    async function init() {
        // 1 · FASE CACHE · arrancar con lo que hay en localStorage (instantáneo)
        // (nada que hacer aquí: la app leerá de localStorage al montar)

        // 2 · FASE NETWORK · refresh en background (no bloquea)
        refreshFromServer().catch(e => console.warn('[DataService] background refresh:', e));
    }

    /**
     * Sincroniza desde Sheets. Si detecta cambios, actualiza localStorage
     * y dispara 'app:data-refreshed' para que la UI se re-renderice.
     */
    async function refreshFromServer() {
        try {
            status.syncing = true;
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

            if (anyChange) {
                console.info('[DataService] Datos actualizados desde Sheets');
                document.dispatchEvent(new CustomEvent('app:data-refreshed'));
            }
        } catch (e) {
            console.warn('[DataService] refresh falló:', e);
            status.connected = false;
            status.lastError = e.message || String(e);
        } finally {
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

        // 2 · Encolar sync a Sheets
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
        emit();

        // Enviamos SOLO el token de respaldo
        const bodyPayload = { 
            action: 'write', 
            module, 
            data,
            token: CONFIG.token 
        };

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
    } catch (e) {
        console.warn('[DataService] flushOne falló (' + module + '):', e);
        status.connected = false;
        status.lastError = e.message || String(e);
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
    // Enviamos SOLO el token de respaldo para evitar conflictos con Google
    const payload = { 
        action: 'read',
        token: CONFIG.token 
    };

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

    // Flush al cerrar pestaña
    window.addEventListener('beforeunload', () => {
        // No esperamos respuesta, pero lanzamos las escrituras
        Object.keys(pending).forEach(m => {
            try {
                fetch(CONFIG.apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ token: CONFIG.token, action: 'write', module: m, data: pending[m] }),
                    keepalive: true
                });
            } catch (e) {}
        });
    });

    return {
        init,
        loadStored,
        saveStored,
        flush,
        getStatus,
        onStatusChange,
        config: CONFIG
    };
})();

window.DataService = DataService;
