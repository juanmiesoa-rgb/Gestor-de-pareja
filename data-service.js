/* =============================================================================
   DATA-SERVICE.JS · v7 — Sincronización limpia + normalización de fechas
   -----------------------------------------------------------------------------
   Cambios respecto a v6:
     · normDate / normMonth + normalizeAllDates: convierte ISO 8601 con T/Z
       ("2026-11-01T00:00:00.000Z") que devuelve Sheets en strings limpios
       ("2026-11-01") para que las comparaciones de fecha funcionen.
     · Se aplica ANTES de comparar/escribir en localStorage → evita re-render
       innecesarios por diferencias de serialización.
     · visibilitychange → flush() al pasar a segundo plano (móvil / pestañas).
     · beforeunload sigue como estaba (keepalive).
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

    /* =========================================================
       NORMALIZACIÓN DE FECHAS
       ========================================================= */

    /** Convierte "2026-11-01T00:00:00.000Z" o "2026-11-01 00:00:00" → "2026-11-01". */
    function normDate(v) {
        if (v == null || v === '') return '';
        const s = String(v).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        return s;
    }

    /** Convierte "2026-11-01T00:00:00.000Z" o "2026-11-01" → "2026-11". */
    function normMonth(v) {
        const s = normDate(v);
        return s ? s.slice(0, 7) : '';
    }

    /**
     * Recorre la respuesta del API y normaliza SOLO los campos de fecha conocidos.
     * No toca conceptos/notas (evita romper strings que casualmente parezcan fechas).
     */
    function normalizeAllDates(data) {
        if (!data || typeof data !== 'object') return data;

        /* ---------- app ---------- */
        if (data.app) {
            (data.app.expenses || []).forEach(e => { e.date = normDate(e.date); });

            (data.app.pcCategories || []).forEach(c => {
                c.dueDate   = normDate(c.dueDate);
                c.createdAt = normDate(c.createdAt);
            });
            (data.app.pcSubcategories || []).forEach(s => {
                s.dueDate   = normDate(s.dueDate);
                s.createdAt = normDate(s.createdAt);
            });
            (data.app.pcWeeks || []).forEach(w => {
                w.start  = normDate(w.start);
                w.end    = normDate(w.end);
                w.period = normMonth(w.period);   // ← crítico: "2026-11-01T…" → "2026-11"
            });

            (data.app.calendarEvents || []).forEach(e => { e.date = normDate(e.date); });
            (data.app.transfers      || []).forEach(t => { t.date = normDate(t.date); });
        }

        /* ---------- dinero ---------- */
        if (data.dinero) {
            (data.dinero.commitments || []).forEach(c => {
                c.dueDate = normDate(c.dueDate);
            });

            (data.dinero.wallets || []).forEach(w => {
                (w.movements || []).forEach(m => { m.date = normDate(m.date); });
            });

            (data.dinero.debts || []).forEach(d => {
                d.dueDate = normDate(d.dueDate);
                (d.history || []).forEach(h => { h.date = normDate(h.date); });
            });

            (data.dinero.loans || []).forEach(l => {
                l.nextDate = normDate(l.nextDate);
                (l.payments || []).forEach(p => { p.date = normDate(p.date); });
            });

            (data.dinero.goals || []).forEach(g => {
                g.nextDate = normDate(g.nextDate);
                (g.contributions || []).forEach(c => { c.date = normDate(c.date); });
            });

            (data.dinero.recurring || []).forEach(r => {
                r.nextDate = normDate(r.nextDate);
                (r.history || []).forEach(h => { h.date = normDate(h.date); });
            });

            (data.dinero.movements || []).forEach(m => { m.date = normDate(m.date); });
        }

        /* ---------- ingresos ---------- */
        if (data.ingresos && data.ingresos.profiles) {
            Object.values(data.ingresos.profiles).forEach(p => {
                if (!p) return;
                p.joinDate = normDate(p.joinDate);
                (p.bonuses || []).forEach(b => { b.date = normDate(b.date); });
            });
        }

        /* ---------- viajes ---------- */
        if (data.viajes && Array.isArray(data.viajes.trips)) {
            data.viajes.trips.forEach(t => {
                t.startDate = normDate(t.startDate);
                t.endDate   = normDate(t.endDate);

                (t.categories || []).forEach(cat => {
                    (cat.items || []).forEach(i => {
                        i.dueDate = normDate(i.dueDate);
                        (i.payments || []).forEach(p => { p.date = normDate(p.date); });
                    });
                });

                (t.days || []).forEach(d => { d.date = normDate(d.date); });
                (t.activities || []).forEach(a => { a.day = normDate(a.day); });
            });
        }

        return data;
    }

    /* =========================================================
       INIT / REFRESH
       ========================================================= */
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

            const raw = await fetchAll();
            const data = normalizeAllDates(raw);

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

    /* =========================================================
       STORAGE
       ========================================================= */
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
        // 🔒 EL CANDADO: Si la lectura inicial falló o aún no ha terminado, NO se guarda en local ni en remoto.
        if (!isFirstReadComplete) {
            console.warn('[DataService] 🛑 Guardado bloqueado: la app no ha leído el Sheet correctamente.');
            return;
        }

        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}

        const module = MODULE_BY_KEY[key];
        if (!module) return;

        pending[module] = value;
        clearTimeout(timers[module]);
        timers[module] = setTimeout(() => flushOne(module), CONFIG.debounceMs);
    }

    /* =========================================================
       WRITE
       ========================================================= */
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

    /* =========================================================
       READ
       ========================================================= */
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

    /* =========================================================
       STATUS
       ========================================================= */
    function getStatus() {
        return Object.assign({}, status, { pendingModules: Object.keys(pending) });
    }

    function onStatusChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

    function emit() {
        const s = getStatus();
        listeners.forEach(fn => { try { fn(s); } catch (e) {} });
        if (window.App && typeof App.updateSyncBadge === 'function') App.updateSyncBadge(s);
    }

    /* =========================================================
       EVENTOS DE CICLO DE VIDA
       ========================================================= */

    // Al cerrar / recargar la pestaña: intento rápido con keepalive
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

    // Al pasar a segundo plano (móvil al cambiar de app, pestaña oculta):
    // más fiable que beforeunload y sin el límite de 64 KB del keepalive.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flush().catch(() => {});
        }
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