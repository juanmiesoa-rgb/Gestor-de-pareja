/* =============================================================
   5_DINERO.JS — Módulo «Dinero» v2 · Single-Page UI (rediseño)
   =============================================================
   Pantalla ÚNICA (sin subpáginas ni pestañas externas):

   COLUMNA IZQUIERDA (≈68%)
     Bloque 1 · Resumen del Dinero        (3 tarjetas KPI superiores)
     Bloque 2 · Monederos Virtuales       (sin límites, modal de gestión)
     Bloque 3 · Deudas y Devoluciones     (a devolver / a cobrar)
     Bloque 4 · Préstamos y Financiaciones (barra de progreso + cuotas)
     Bloque 5 · Objetivos de Ahorro        (barra de progreso + aportaciones)
     Bloque 6 · Pagos Recurrentes          (suscripciones con historial)

   COLUMNA DERECHA (≈32%)
     Bloque 7 · Historial de movimientos filtrable + registro rápido

   REGLAS FINANCIERAS INVIOLABLES:
     1. Saldo Real = dinero bancario real. Monederos/Objetivos son
        distribuciones internas: NO suman dinero adicional.
     2. Los compromisos futuros reducen «Disponible Ahora/Global» pero
        NO descuentan el Saldo Real hasta ejecutarse como movimiento.
     3. Transferencias internas (cuentas propias / monederos) no
        alteran el saldo total global.

   Sin integración activa con Google Sheets: funciona íntegramente
   con MOCK DATA estructurado, listo para futura conexión backend.
   Persistencia local en localStorage ('finanzas_dinero_v2').
   ============================================================= */
const DineroApp = (function () {
    'use strict';

    // =========================================================
    // UTILIDADES DE FECHA (base fija demo: 02/11/2026)
    // =========================================================
    const TODAY_ISO = '2026-11-02';

    function addDays(iso, n) {
        const d = new Date((iso || TODAY_ISO) + 'T00:00:00');
        d.setDate(d.getDate() + n);
        return toISO(d);
    }
    function toISO(d) {
        const p = (x) => String(x).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }
    function daysFromToday(iso) {
        if (!iso) return Infinity;
        const a = new Date(TODAY_ISO + 'T00:00:00');
        const b = new Date(iso + 'T00:00:00');
        return Math.round((b - a) / 86400000);
    }
    function fmtDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso + 'T00:00:00');
        if (isNaN(d.getTime())) return iso;
        return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
    }
    function fmtMoney(n) {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n == null ? 0 : n);
    }
    // Formato de divisa según moneda (USD con locale en-US para el "$")
    function fmtAmount(n, currency) {
        const cur = currency === 'USD' ? 'USD' : 'EUR';
        return new Intl.NumberFormat(cur === 'USD' ? 'en-US' : 'es-ES', { style: 'currency', currency: cur }).format(n == null ? 0 : n);
    }
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function uid(prefix) {
        return prefix + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e4).toString(36);
    }

    // =========================================================
    // DATOS DEMO (MOCK DATA) — estructurados para futuro backend
    // =========================================================
    // Regla de cálculo obligatoria de la demo:
    //   Saldo Real = 500 € | Pago A = 100 € (mañana) | Pago B = 300 € (en 8 días)
    //   Horizonte 7 días  → Disponible Ahora = 400 € | Disponible Global = 100 €
    // Tipo de cambio EUR→USD de referencia (se actualiza en vivo desde la API
    // open.er-api.com al cargar el módulo; si no hay red se usa este fallback).
    const FALLBACK_EUR_USD = 1.16;

    const DEFAULT_MOCK = {
        version: 2,
        settings: { horizonDays: 7 },

        // --- Cuentas físicas (Saldo Real) ---
        accounts: [
            { id: 'acc-tr1', name: 'Trade Republic 1', icon: '🏦', balance: 300, color: '#10b981' },
            { id: 'acc-mi',  name: 'MyInvestor',       icon: '💶', balance: 120, color: '#f59e0b' },
            { id: 'acc-tr2', name: 'Trade Republic 2', icon: '📈', balance: 80,  color: '#8b5cf6' }
        ],

        // --- Compromisos futuros pendientes (reducen disponibilidad, NO el saldo real) ---
        commitments: [
            { id: 'cm-a', name: 'Pago A · Suscripción gimnasio', amount: 100, dueDate: '2026-11-03', accountId: 'acc-tr1', executed: false, note: 'Demo: mañana' },
            { id: 'cm-b', name: 'Pago B · Seguro del coche',     amount: 300, dueDate: '2026-11-10', accountId: 'acc-mi',  executed: false, note: 'Demo: en 8 días' }
        ],

        // --- Monederos virtuales (sin límites ni porcentajes) ---
        wallets: [
            { id: 'w-food',  emoji: '🛒', name: 'Comida',     color: '#f59e0b', movements: [
                { id: uid('wm'), date: '2026-10-05', concept: 'Aportación inicial', amount: 200, type: 'in' },
                { id: uid('wm'), date: '2026-10-14', concept: 'Compra semanal',     amount: 60,  type: 'out' },
                { id: uid('wm'), date: '2026-10-28', concept: 'Compra semanal',     amount: 50,  type: 'out' }
            ]},
            { id: 'w-ocio',  emoji: '🎮', name: 'Ocio',       color: '#ec4899', movements: [
                { id: uid('wm'), date: '2026-10-08', concept: 'Aportación',         amount: 80,  type: 'in' },
                { id: uid('wm'), date: '2026-10-19', concept: 'Cine y cena',        amount: 35,  type: 'out' }
            ]},
            { id: 'w-coche', emoji: '🚗', name: 'Coche',      color: '#0ea5e9', movements: [
                { id: uid('wm'), date: '2026-10-02', concept: 'Aportación',         amount: 100, type: 'in' },
                { id: uid('wm'), date: '2026-10-22', concept: 'Gasolina',           amount: 45,  type: 'out' }
            ]},
            { id: 'w-reg',   emoji: '🎁', name: 'Regalos',    color: '#a855f7', movements: [
                { id: uid('wm'), date: '2026-10-11', concept: 'Aportación',         amount: 60,  type: 'in' }
            ]},
            { id: 'w-gato',  emoji: '🐱', name: 'Gastos gato',color: '#64748b', movements: [
                { id: uid('wm'), date: '2026-10-06', concept: 'Pienso',             amount: 30,  type: 'in' },
                { id: uid('wm'), date: '2026-10-24', concept: 'Arena y snacks',     amount: 15,  type: 'in' }
            ]}
        ],

        // --- Deudas y devoluciones pendientes ---
        // kind: 'pay' = dinero a devolver (gastado hoy, compromiso de reponer)
        //       'receive' = dinero a cobrar / recuperar
        debts: [
            { id: 'd-1', kind: 'pay',     emoji: '💇', name: 'Pelucan (adelanto familiar)', total: 200, returned: 50, dueDate: '2026-12-15', counterparty: 'Hermano', note: 'Gastado con tarjeta propia', history: [
                { id: uid('dh'), date: '2026-10-20', amount: 50, note: 'Devolución parcial' }
            ]},
            { id: 'd-2', kind: 'pay',     emoji: '🧾', name: 'Restaurante (pagué la cuenta)', total: 40, returned: 0, dueDate: '', counterparty: 'Marta', note: 'Sin fecha estimada', history: [] },
            { id: 'd-3', kind: 'receive', emoji: '🤝', name: 'Préstamo a Laura',              total: 100, returned: 0, dueDate: '2026-11-20', counterparty: 'Laura', note: 'Me presté dinero propio registrado como deuda a cobrar', history: [] },
            { id: 'd-4', kind: 'receive', emoji: '🏠', name: 'Fianza comunidad',              total: 60,  returned: 60, dueDate: '2026-10-01', counterparty: 'Comunidad', note: 'Ya recuperada', history: [
                { id: uid('dh'), date: '2026-10-01', amount: 60, note: 'Devuelto totalmente' }
            ]}
        ],

        // --- Préstamos y financiaciones activas ---
        loans: [
            { id: 'l-sofa', emoji: '🛋️', name: 'Financiación Sofá', financed: 810, installments: 18, installmentAmount: 45, paidCount: 4, nextDate: '2026-11-10', accountName: 'Trade Republic 1', payments: [
                { id: uid('lp'), date: '2026-08-10', amount: 45, n: 1 },
                { id: uid('lp'), date: '2026-09-10', amount: 45, n: 2 },
                { id: uid('lp'), date: '2026-10-10', amount: 45, n: 3 },
                { id: uid('lp'), date: '2026-11-10', amount: 45, n: 4, planned: true }
            ]},
            { id: 'l-bed', emoji: '🛏️', name: 'Financiación Cama', financed: 874, installments: 23, installmentAmount: 38, paidCount: 6, nextDate: '2026-11-15', accountName: 'Trade Republic 2', payments: [
                { id: uid('lp'), date: '2026-06-15', amount: 38, n: 1 },
                { id: uid('lp'), date: '2026-07-15', amount: 38, n: 2 },
                { id: uid('lp'), date: '2026-08-15', amount: 38, n: 3 },
                { id: uid('lp'), date: '2026-09-15', amount: 38, n: 4 },
                { id: uid('lp'), date: '2026-10-15', amount: 38, n: 5 },
                { id: uid('lp'), date: '2026-11-15', amount: 38, n: 6, planned: true }
            ]}
        ],

        // --- Objetivos de ahorro ---
        // frequency: none | weekly | biweekly | monthly ; hasGoal=false → sin meta fija
        goals: [
            { id: 'g-viaje', emoji: '✈️', name: 'Viaje Japón', target: 3000, saved: 1200, frequency: 'monthly', contribution: 250, nextDate: '2026-11-05', contributions: [
                { id: uid('gc'), date: '2026-08-05', amount: 250 },
                { id: uid('gc'), date: '2026-09-05', amount: 250 },
                { id: uid('gc'), date: '2026-10-05', amount: 250 },
                { id: uid('gc'), date: '2026-11-05', amount: 250, planned: true }
            ]},
            { id: 'g-emerg', emoji: '🚨', name: 'Fondo emergencia', target: 5000, saved: 3200, frequency: 'biweekly', contribution: 200, nextDate: '2026-11-07', contributions: [
                { id: uid('gc'), date: '2026-10-10', amount: 200 },
                { id: uid('gc'), date: '2026-10-24', amount: 200 },
                { id: uid('gc'), date: '2026-11-07', amount: 200, planned: true }
            ]},
            { id: 'g-porta', emoji: '💻', name: 'Portátil nuevo', target: 1200, saved: 400, frequency: 'weekly', contribution: 50, nextDate: '2026-11-03', contributions: [
                { id: uid('gc'), date: '2026-10-13', amount: 50 },
                { id: uid('gc'), date: '2026-10-20', amount: 50 },
                { id: uid('gc'), date: '2026-10-27', amount: 50 },
                { id: uid('gc'), date: '2026-11-03', amount: 50, planned: true }
            ]},
            { id: 'g-libre', emoji: '🌱', name: 'Sin meta fija', target: null, saved: 150, frequency: 'none', contribution: 0, nextDate: '', contributions: [
                { id: uid('gc'), date: '2026-10-30', amount: 150 }
            ]}
        ],

        // --- Pagos recurrentes y suscripciones ---
        recurring: [
            { id: 'r-netflix', emoji: '🎬', name: 'Netflix', amount: 12.99, period: 'monthly', nextDate: '2026-11-08', accountName: 'MyInvestor', active: true, history: [
                { id: uid('rh'), date: '2026-08-08', amount: 12.99 },
                { id: uid('rh'), date: '2026-09-08', amount: 12.99 },
                { id: uid('rh'), date: '2026-10-08', amount: 12.99 }
            ]},
            { id: 'r-lowi', emoji: '📶', name: 'Lowi (móvil + fibra)', amount: 50, period: 'monthly', nextDate: '2026-11-10', accountName: 'Trade Republic 1', active: true, history: [
                { id: uid('rh'), date: '2026-08-10', amount: 50 },
                { id: uid('rh'), date: '2026-09-10', amount: 50 },
                { id: uid('rh'), date: '2026-10-10', amount: 50 }
            ]},
            { id: 'r-seguro', emoji: '🛡️', name: 'Seguro hogar', amount: 180, period: 'quarterly', nextDate: '2026-12-01', accountName: 'MyInvestor', active: true, history: [
                { id: uid('rh'), date: '2026-09-01', amount: 180 }
            ]},
            { id: 'r-gym', emoji: '🏋️', name: 'Gimnasio', amount: 100, period: 'monthly', nextDate: '2026-11-03', accountName: 'Trade Republic 1', active: true, history: [
                { id: uid('rh'), date: '2026-09-03', amount: 100 },
                { id: uid('rh'), date: '2026-10-03', amount: 100 }
            ]},
            { id: 'r-spotify', emoji: '🎵', name: 'Spotify Premium', amount: 10.99, period: 'monthly', nextDate: null, accountName: 'Trade Republic 2', active: false, history: [
                { id: uid('rh'), date: '2026-08-12', amount: 10.99 },
                { id: uid('rh'), date: '2026-09-12', amount: 10.99 }
            ]}
        ],

        // --- Historial de movimientos reales (entradas/salidas) ---
        movements: [
            { id: 'mv-1', date: '2026-11-01', concept: 'Nómina octubre',            amount: 500,  type: 'in',  accountId: 'acc-tr1', link: null },
            { id: 'mv-2', date: '2026-10-28', concept: 'Compra semanal',            amount: -50,  type: 'out', accountId: 'acc-mi',  link: { kind: 'wallet', id: 'w-food' } },
            { id: 'mv-3', date: '2026-10-24', concept: 'Gasolina',                  amount: -45,  type: 'out', accountId: 'acc-tr2', link: { kind: 'wallet', id: 'w-coche' } },
            { id: 'mv-4', date: '2026-10-20', concept: 'Devolución parcial Pelucan',amount: 50,   type: 'in',  accountId: 'acc-tr1', link: { kind: 'debt', id: 'd-1' } },
            { id: 'mv-5', date: '2026-10-15', concept: 'Cuota cama #5',             amount: -38,  type: 'out', accountId: 'acc-tr2', link: { kind: 'loan', id: 'l-bed' } },
            { id: 'mv-6', date: '2026-10-10', concept: 'Cuota sofá #3',             amount: -45,  type: 'out', accountId: 'acc-tr1', link: { kind: 'loan', id: 'l-sofa' } },
            { id: 'mv-7', date: '2026-10-08', concept: 'Suscripción Netflix',       amount: -12.99, type: 'out', accountId: 'acc-mi', link: { kind: 'recurring', id: 'r-netflix' } },
            { id: 'mv-8', date: '2026-10-05', concept: 'Aportación viaje Japón',    amount: -250, type: 'out', accountId: 'acc-tr1', link: { kind: 'goal', id: 'g-viaje' } },
            { id: 'mv-9', date: '2026-10-02', concept: 'Transferencia interna TR1→TR2', amount: 80, type: 'transfer-in', accountId: 'acc-tr2', link: null },
            { id: 'mv-10', date: '2026-10-02', concept: 'Transferencia interna TR1→TR2', amount: -80, type: 'transfer-out', accountId: 'acc-tr1', link: null },
            { id: 'mv-11', date: '2026-09-28', concept: 'Alquiler septiembre',       amount: -950, type: 'out', accountId: 'acc-mi', link: null },
            { id: 'mv-12', date: '2026-09-25', concept: 'Cena aniversario',          amount: -58,  type: 'out', accountId: 'acc-tr2', link: { kind: 'wallet', id: 'w-ocio' } }
        ]
    };

    // =========================================================
    // ESTADO Y PERSISTENCIA
    // =========================================================
    let data = loadData();
    let containerEl = null;
    const expanded = { loans: new Set(), goals: new Set(), recurring: new Set(), wallets: new Set() };

    // ---- Filtros de vista (no persisten entre sesiones) ----
    const viewFilters = {
        loanStatus: 'active',   // active (Pendientes, predeterminado) | completed | all
        debtStatus: 'pending',  // pending (Pendientes, predeterminado) | done | all
        recurringStatus: 'active', // active (Activo, predeterminado) | paused | all
        goalStatus: 'dateActive'   // dateActive (Fecha activa, predeterminado) | done | all
    };
    /** Objetivo "activo por fecha": tiene próxima aportación programada y no está completado */
    function goalIsDateActive(g) {
        if (g.target != null && g.target > 0 && g.saved >= g.target) return false; // completado
        return !!(g.nextDate && g.frequency !== 'none');
    }
    function goalMatchesFilter(g) {
        const done = g.target != null && g.target > 0 && g.saved >= g.target;
        if (viewFilters.goalStatus === 'dateActive') return goalIsDateActive(g);
        if (viewFilters.goalStatus === 'done') return done;
        return true;
    }
    function recurringMatchesFilter(r) {
        if (viewFilters.recurringStatus === 'active') return !!r.active;
        if (viewFilters.recurringStatus === 'paused') return !r.active;
        return true;
    }

    // ---- Tipo de cambio EUR→USD (se refresca desde la API al cargar) ----
    let eurUsdRate = FALLBACK_EUR_USD;
    let fxUpdatedAt = null;
    function loadFxRate() {
        try {
            fetch('https://open.er-api.com/v6/latest/EUR')
                .then(r => r.ok ? r.json() : Promise.reject(new Error('http')))
                .then(j => {
                    if (j && j.rates && typeof j.rates.USD === 'number') {
                        eurUsdRate = j.rates.USD;
                        fxUpdatedAt = j.date || toISO(new Date());
                        if (containerEl) renderAll();
                    }
                })
                .catch(() => { /* sin red: se mantiene el fallback */ });
        } catch (e) { /* fetch no disponible: fallback */ }
    }

    // Persistencia local (patrón compartido con la shell App; exige version===2)
    const clone = o => JSON.parse(JSON.stringify(o));
    function loadData() {
        const parsed = App.loadStored('finanzas_dinero_v2', DEFAULT_MOCK);
        return parsed && parsed.version === 2 ? parsed : clone(DEFAULT_MOCK);
    }
    function saveData() { App.saveStored('finanzas_dinero_v2', data); }
    function resetDemo() {
        data = clone(DEFAULT_MOCK);
        saveData();
        renderAll();
    }

    // =========================================================
    // CÁLCULOS FINANCIEROS (reglas inviolables)
    // =========================================================
    function realBalance() {
        return data.accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
    }
    function pendingCommitments() {
        return data.commitments.filter(c => !c.executed);
    }
    function commitmentsWithin(days) {
        return pendingCommitments().filter(c => {
            const d = daysFromToday(c.dueDate);
            return d >= 0 && d <= days;
        });
    }
    /** Disponible Ahora = Saldo Real − compromisos que vencen dentro del horizonte */
    function availableNow() {
        return realBalance() - commitmentsWithin(data.settings.horizonDays).reduce((s, c) => s + c.amount, 0);
    }
    /** Disponible Global = Saldo Real − TODOS los compromisos futuros pendientes */
    function availableGlobal() {
        return realBalance() - pendingCommitments().reduce((s, c) => s + c.amount, 0);
    }
    function walletBalance(w) {
        return w.movements.reduce((s, m) => s + (m.type === 'out' ? -m.amount : m.amount), 0);
    }
    function debtStatus(d) {
        if (d.returned >= d.total) return 'done';
        if (d.returned > 0) return 'partial';
        return 'pending';
    }
    function loanPending(l) {
        return (l.installments - l.paidCount) * l.installmentAmount;
    }
    function loanLastDate(l) {
        // Fecha estimada del último pago: próximo recibo + cuotas restantes
        const remaining = l.installments - l.paidCount;
        if (remaining <= 0) return 'Completado';
        const base = l.nextDate || TODAY_ISO;
        return fmtDate(addMonths(base, remaining - 1));
    }
    function addMonths(iso, n) {
        const d = new Date(iso + 'T00:00:00');
        d.setMonth(d.getMonth() + n);
        return toISO(d);
    }
    function goalRemaining(g) {
        return g.target == null ? null : Math.max(0, g.target - g.saved);
    }
    function goalFinishDate(g) {
        if (g.target == null || !g.contribution || g.frequency === 'none') return null;
        const remaining = goalRemaining(g);
        if (remaining <= 0) return '¡Objetivo alcanzado! 🎉';
        const stepsPerMonth = g.frequency === 'weekly' ? 4.33 : g.frequency === 'biweekly' ? 2 : 1;
        const months = Math.ceil(remaining / (g.contribution * stepsPerMonth));
        return fmtDate(addMonths(g.nextDate || TODAY_ISO, months - 1));
    }
    function periodLabel(p) {
        return { weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual', quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual' }[p] || p;
    }

    // Colores identificativos por sección (títulos con badge + barra lateral)
    const SECTION_COLORS = {
        summary:   '#2563eb',
        wallets:   '#f59e0b',
        debts:     '#ef4444',
        loans:     '#8b5cf6',
        goals:     '#10b981',
        recurring: '#0ea5e9',
        history:   '#64748b'
    };

    // =========================================================
    // ESTILOS
    // =========================================================
    // CSS del módulo → inyección estandarizada (App.injectStylesheet)
    function moduleCSS() { return `
        /* ===== Layout pantalla única, 2 columnas ===== */
        .dv2-wrap { display: grid; grid-template-columns: minmax(0, 68fr) minmax(0, 32fr); gap: 22px; align-items: start; }
        @media (max-width: 1100px) { .dv2-wrap { grid-template-columns: 1fr; } }

        .dv2-col-left { display: flex; flex-direction: column; gap: 26px; min-width: 0; }
        .dv2-col-right { position: sticky; top: 14px; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
        @media (max-width: 1100px) { .dv2-col-right { position: static; } }

        /* ===== Secciones con título en BANDA DE COLOR distintiva (fondo acentuado) ===== */
        .dv2-section { min-width: 0; }
        .dv2-section-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; padding: 10px 14px; border-radius: 12px; background: color-mix(in srgb, var(--dv2-accent, var(--primary)) 16%, var(--bg-card)); border: 1px solid color-mix(in srgb, var(--dv2-accent, var(--primary)) 35%, transparent); box-shadow: inset 4px 0 0 var(--dv2-accent, var(--primary)); }
        .dv2-section-title { display: inline-flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 800; letter-spacing: .2px; color: var(--dv2-accent, var(--text)); }
        .dv2-badge { width: 30px; height: 30px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; color: #fff; background: var(--dv2-accent, var(--primary)); box-shadow: 0 2px 6px color-mix(in srgb, var(--dv2-accent, var(--primary)) 40%, transparent); }
        .dv2-section-sub { font-size: 11.5px; color: var(--text-muted); font-weight: 500; }
        .dv2-add-btn { border: 1.5px dashed var(--dv2-accent, var(--primary)); color: var(--dv2-accent, var(--primary)); background: var(--bg-card); border-radius: 9px; padding: 7px 12px; font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 6px; transition: all .15s; white-space: nowrap; }
        .dv2-add-btn:hover { background: color-mix(in srgb, var(--dv2-accent, var(--primary)) 12%, transparent); }

        /* Chips de filtro por estado (préstamos / deudas) */
        .dv2-filter-chips { display: inline-flex; gap: 6px; align-items: center; }
        .dv2-fchip { border: 1px solid color-mix(in srgb, var(--dv2-accent, var(--primary)) 40%, transparent); background: var(--bg-card); color: var(--text-secondary); border-radius: 999px; padding: 5px 12px; font-size: 11.5px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all .15s; }
        .dv2-fchip.sel { background: var(--dv2-accent, var(--primary)); color: #fff; border-color: var(--dv2-accent, var(--primary)); }

        /* Fila compacta de acciones dentro del modal de detalle */
        .dv2-actions-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .dv2-data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; margin: 10px 0 4px; }
        .dv2-data-item { background: var(--bg); border: 1px solid var(--border-light); border-radius: 10px; padding: 7px 10px; font-size: 12px; }
        .dv2-data-item span { display: block; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; color: var(--text-muted); margin-bottom: 1px; }
        .dv2-data-item strong { font-size: 12.5px; color: var(--text-primary); font-variant-numeric: tabular-nums; }
        .dv2-act-btn { border: 1px solid var(--border); background: var(--bg); color: var(--text-secondary); border-radius: 10px; padding: 9px 10px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; justify-content: center; gap: 7px; transition: all .15s; }
        .dv2-act-btn:hover { border-color: var(--dv2-accent, var(--primary)); color: var(--dv2-accent, var(--primary)); background: color-mix(in srgb, var(--dv2-accent, var(--primary)) 8%, var(--bg)); }
        .dv2-act-btn.pos { color: var(--success); border-color: color-mix(in srgb, var(--success) 45%, var(--border)); }
        .dv2-act-btn.neg { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 45%, var(--border)); }

        /* ===== Tarjetas genéricas ===== */
        .dv2-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 16px; box-shadow: var(--shadow-sm); position: relative; overflow: hidden; transition: box-shadow .2s, transform .2s; }
        .dv2-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--dv2-accent, var(--primary)); border-radius: 4px 0 0 4px; }
        .dv2-card:hover { box-shadow: var(--shadow-md); }

        /* ===== Bloque 1 · KPIs ===== */
        .dv2-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 900px) { .dv2-kpis { grid-template-columns: 1fr; } }
        .dv2-kpi { padding: 18px 18px 16px 20px; }
        .dv2-kpi-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .6px; color: var(--text-muted); display: flex; align-items: center; gap: 7px; margin-bottom: 8px; }
        .dv2-kpi-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--dv2-accent, var(--primary)); }
        .dv2-kpi-value { font-size: 26px; font-weight: 800; line-height: 1.1; margin-bottom: 4px; color: var(--text); }
        .dv2-kpi-value.negative { color: var(--danger); }
        .dv2-kpi-meta { font-size: 11.5px; color: var(--text-secondary); }
        .dv2-kpi-control { margin-top: 12px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .dv2-select, .dv2-input, .dv2-textarea { background: var(--bg); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 7px 9px; font-size: 12.5px; font-family: inherit; outline: none; transition: border-color .15s; min-width: 0; }
        .dv2-select:focus, .dv2-input:focus, .dv2-textarea:focus { border-color: var(--primary); }
        .dv2-textarea { width: 100%; resize: vertical; min-height: 54px; }
        .dv2-mini-btn { border: 1px solid var(--border); background: var(--bg-card); color: var(--text-secondary); border-radius: 8px; padding: 7px 10px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 6px; transition: all .15s; }
        .dv2-mini-btn:hover { border-color: var(--primary); color: var(--primary); }
        .dv2-horizon { display: inline-flex; align-items: center; gap: 6px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 4px 8px; }
        .dv2-horizon input { width: 46px; border: none; background: transparent; color: var(--text); font-weight: 800; font-size: 13px; text-align: center; outline: none; font-family: inherit; }
        .dv2-horizon span { font-size: 11.5px; color: var(--text-muted); font-weight: 600; }

        /* ===== Resumen del dinero (bloque destacado, estilo diferenciado) ===== */
        .dv2-summary-banner { position: relative; overflow: hidden; border-radius: 18px; padding: 18px 18px 20px; margin-bottom: 16px;
            background: linear-gradient(135deg, color-mix(in srgb, #2563eb 15%, var(--bg-card)) 0%, color-mix(in srgb, #8b5cf6 13%, var(--bg-card)) 55%, color-mix(in srgb, #0ea5e9 11%, var(--bg-card)) 100%);
            border: 1px solid color-mix(in srgb, #2563eb 30%, var(--border)); box-shadow: var(--shadow-md); }
        .dv2-summary-banner::before { content: ''; position: absolute; inset: 0; pointer-events: none;
            background: radial-gradient(520px 130px at 8% -20%, color-mix(in srgb, #2563eb 22%, transparent), transparent 70%),
                        radial-gradient(420px 120px at 95% 130%, color-mix(in srgb, #8b5cf6 18%, transparent), transparent 70%); }
        .dv2-summary-head { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
        .dv2-summary-title { display: inline-flex; align-items: center; gap: 10px; font-size: 15.5px; font-weight: 800; letter-spacing: .2px; color: var(--text); }
        .dv2-summary-chip { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .6px; color: #fff; background: linear-gradient(135deg, #2563eb, #8b5cf6); border-radius: 999px; padding: 4px 11px; box-shadow: 0 2px 8px rgba(37,99,235,.35); }
        .dv2-kpis-v3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; position: relative; }
        @media (max-width: 900px) { .dv2-kpis-v3 { grid-template-columns: 1fr; } }
        .dv2-kpi3 { background: color-mix(in srgb, var(--bg-card) 88%, transparent); backdrop-filter: blur(4px); border: 1px solid color-mix(in srgb, var(--dv2-accent, var(--primary)) 28%, var(--border)); border-radius: 14px; padding: 16px 16px 14px; box-shadow: var(--shadow-sm); }
        .dv2-kpi3-label { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .6px; color: var(--dv2-accent, var(--text-muted)); display: flex; align-items: center; gap: 7px; margin-bottom: 8px; }
        .dv2-kpi3-value { font-size: 26px; font-weight: 800; line-height: 1.1; margin-bottom: 4px; color: var(--text); font-variant-numeric: tabular-nums; }
        .dv2-kpi3-value.negative { color: var(--danger); }
        .dv2-pill-select { appearance: none; -webkit-appearance: none; border: 1px solid color-mix(in srgb, var(--dv2-accent, var(--primary)) 45%, var(--border)); background: color-mix(in srgb, var(--dv2-accent, var(--primary)) 10%, var(--bg)); color: var(--dv2-accent, var(--primary)); border-radius: 999px; padding: 6px 12px; font-size: 12px; font-weight: 800; font-family: inherit; cursor: pointer; outline: none; transition: all .15s; }
        .dv2-pill-select:hover { background: color-mix(in srgb, var(--dv2-accent, var(--primary)) 18%, var(--bg)); }

        /* ===== Grids de tarjetas ===== */
        .dv2-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
        .dv2-grid-wide { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }

        /* ===== Monederos ===== */
        .dv2-wallet { cursor: pointer; text-align: left; }
        .dv2-wallet-top { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .dv2-emoji { width: 38px; height: 38px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; font-size: 19px; background: color-mix(in srgb, var(--dv2-accent, var(--primary)) 14%, var(--bg)); flex-shrink: 0; }
        .dv2-wallet-name { font-weight: 700; font-size: 13.5px; }
        .dv2-wallet-amt { font-size: 21px; font-weight: 800; }
        .dv2-wallet-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 11px; color: var(--text-muted); }
        .dv2-wallet-detail { margin-top: 12px; border-top: 1px dashed var(--border); padding-top: 10px; display: none; }
        .dv2-wallet.open .dv2-wallet-detail { display: block; }
        .dv2-mov-line { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; padding: 5px 0; border-bottom: 1px solid var(--border-light); }
        .dv2-mov-line:last-child { border-bottom: none; }
        .dv2-mov-date { color: var(--text-muted); font-size: 11px; min-width: 74px; }
        .dv2-pos { color: var(--success); font-weight: 700; }
        .dv2-neg { color: var(--danger); font-weight: 700; }

        /* ===== Deudas ===== */
        .dv2-debt-status { font-size: 10.5px; font-weight: 800; padding: 3px 9px; border-radius: 999px; text-transform: uppercase; letter-spacing: .4px; }
        .dv2-st-pending { background: color-mix(in srgb, var(--warning) 16%, transparent); color: var(--warning); }
        .dv2-st-partial  { background: color-mix(in srgb, var(--info) 16%, transparent); color: var(--info); }
        .dv2-st-done     { background: color-mix(in srgb, var(--success) 16%, transparent); color: var(--success); }

        /* ===== Barras de progreso ===== */
        .dv2-progress { height: 9px; border-radius: 999px; background: var(--border-light); overflow: hidden; margin: 10px 0 6px; }
        .dv2-progress-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--dv2-accent, var(--primary)), color-mix(in srgb, var(--dv2-accent, var(--primary)) 55%, #ffffff)); transition: width .4s ease; }
        .dv2-progress-meta { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); }

        /* ===== Desplegables (flechita) ===== */
        .dv2-expand-btn { background: none; border: 1px solid var(--border); color: var(--text-secondary); width: 30px; height: 30px; border-radius: 9px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all .2s; flex-shrink: 0; font-size: 12px; }
        .dv2-expand-btn:hover { border-color: var(--dv2-accent, var(--primary)); color: var(--dv2-accent, var(--primary)); }
        .dv2-expand-btn.open i { transform: rotate(180deg); }
        .dv2-expand-btn i { transition: transform .2s; }
        .dv2-collapse { display: none; margin-top: 12px; border-top: 1px dashed var(--border); padding-top: 10px; }
        .dv2-collapse.open { display: block; animation: dv2Fade .25s ease; }
        @keyframes dv2Fade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

        /* ===== Columna derecha: historial ===== */
        .dv2-hist-filters { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
        .dv2-hist-list { max-height: 460px; overflow-y: auto; display: flex; flex-direction: column; }
        .dv2-hist-row { display: flex; align-items: center; gap: 10px; padding: 9px 2px; border-bottom: 1px solid var(--border-light); }
        .dv2-hist-row:last-child { border-bottom: none; }
        .dv2-hist-icon { width: 30px; height: 30px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; }
        .dv2-hist-main { flex: 1; min-width: 0; }
        .dv2-hist-concept { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dv2-hist-sub { font-size: 10.5px; color: var(--text-muted); }
        .dv2-hist-amt { font-size: 13px; font-weight: 800; white-space: nowrap; }

        /* ===== Modal ===== */
        .dv2-modal-backdrop { position: fixed; inset: 0; background: rgba(2,6,23,.55); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 1200; opacity: 0; pointer-events: none; transition: opacity .2s; padding: 18px; }
        .dv2-modal-backdrop.show { opacity: 1; pointer-events: auto; }
        .dv2-modal { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; width: min(480px, 94vw); max-height: 88vh; overflow-y: auto; box-shadow: 0 18px 50px rgba(0,0,0,.25); transform: translateY(10px) scale(.98); transition: transform .2s; }
        .dv2-modal-backdrop.show .dv2-modal { transform: none; }
        .dv2-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--bg-card); z-index: 1; }
        .dv2-modal-title { font-size: 15px; font-weight: 800; display: flex; align-items: center; gap: 9px; }
        .dv2-modal-close { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px; padding: 4px 6px; border-radius: 8px; }
        .dv2-modal-close:hover { background: var(--border-light); color: var(--text); }
        .dv2-modal-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
        .dv2-modal-foot { padding: 14px 18px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; position: sticky; bottom: 0; background: var(--bg-card); }
        .dv2-field label { display: block; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--text-muted); margin-bottom: 5px; }
        .dv2-field .dv2-input, .dv2-field .dv2-select { width: 100%; }
        .dv2-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .dv2-emoji-picker { display: flex; gap: 6px; flex-wrap: wrap; }
        .dv2-emoji-opt { width: 34px; height: 34px; border-radius: 9px; border: 1.5px solid var(--border); background: var(--bg); cursor: pointer; font-size: 16px; display: inline-flex; align-items: center; justify-content: center; transition: all .12s; }
        .dv2-emoji-opt.sel { border-color: var(--primary); background: var(--primary-light); transform: scale(1.06); }
        .dv2-seg { display: inline-flex; background: var(--bg); border: 1px solid var(--border); border-radius: 9px; padding: 3px; gap: 3px; }
        .dv2-seg button { border: none; background: transparent; color: var(--text-secondary); font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 7px; cursor: pointer; font-family: inherit; }
        .dv2-seg button.sel { background: var(--dv2-accent, var(--primary)); color: #fff; }
        .dv2-danger-link { color: var(--danger); background: none; border: none; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; margin-right: auto; padding: 8px 4px; }
        .dv2-danger-link:hover { text-decoration: underline; }
        .dv2-empty { text-align: center; color: var(--text-muted); font-size: 12.5px; padding: 18px 8px; border: 1.5px dashed var(--border); border-radius: 12px; }
        .dv2-chip { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; color: var(--text-secondary); background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px; }
        .dv2-note-flag { font-size: 10px; color: var(--warning); font-style: italic; }
    `; }

    // =========================================================
    // RENDER PRINCIPAL (pantalla única)
    // =========================================================
    function render(container) {
        App.injectStylesheet('dinero-v2-styles', moduleCSS());
        containerEl = container;
        container.innerHTML = `
            <div class="dv2-wrap">
                <div class="dv2-col-left" id="dv2Left"></div>
                <aside class="dv2-col-right" id="dv2Right"></aside>
            </div>
            <div class="dv2-modal-backdrop" id="dv2ModalRoot"></div>
        `;
        bindGlobal();
        renderAll();
    }

    function renderAll() {
        if (!containerEl) return;
        renderLeft();
        renderRight();
    }

    // ---------- Helpers de cabecera de sección ----------
    function sectionHead(key, title, sub, actionLabel, actionId) {
        const c = SECTION_COLORS[key];
        return `
            <div class="dv2-section-head" style="--dv2-accent:${c}">
                <div class="dv2-section-title">
                    <span class="dv2-badge">${sectionIcon(key)}</span>
                    <span>${title}</span>
                    ${sub ? `<span class="dv2-section-sub">· ${sub}</span>` : ''}
                </div>
                ${actionLabel ? `<button class="dv2-add-btn" id="${actionId}" style="--dv2-accent:${c}"><i class="fas fa-plus"></i> ${actionLabel}</button>` : ''}
            </div>`;
    }
    function sectionIcon(key) {
        return { summary: '💶', wallets: '👛', debts: '🔄', loans: '🏦', goals: '🎯', recurring: '🔁', history: '🕘' }[key] || '💠';
    }

    // =========================================================
    // COLUMNA IZQUIERDA
    // =========================================================
    function renderLeft() {
        const left = containerEl.querySelector('#dv2Left');
        left.innerHTML = `
            ${renderSummary()}
            ${renderWallets()}
            ${renderDebts()}
            ${renderLoans()}
            ${renderGoals()}
            ${renderRecurring()}
        `;
        bindLeft(left);
    }

    // ---------- Bloque 1 · Resumen (estilo propio: banner degradado, NO banda de sección) ----------
    const HORIZON_OPTIONS = [
        { v: 1, l: '1 día' },
        { v: 3, l: '3 días' },
        { v: 7, l: '1 semana' },
        { v: 14, l: '2 semanas' },
        { v: 30, l: '1 mes' }
    ];
    function horizonLabel(days) {
        const opt = HORIZON_OPTIONS.find(o => o.v === Number(days));
        return opt ? opt.l : `${days} días`;
    }

    function renderSummary() {
        const real = realBalance();
        const now = availableNow();
        const glob = availableGlobal();
        const h = data.settings.horizonDays;
        const within = commitmentsWithin(h);
        const totalPend = pendingCommitments().reduce((s, c) => s + c.amount, 0);

        const accOptions = data.accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)} · ${fmtMoney(a.balance)}</option>`).join('');
        const horizonOptions = HORIZON_OPTIONS.map(o => `<option value="${o.v}" ${Number(o.v) === Number(h) ? 'selected' : ''}>${o.l}</option>`).join('');

        return `
        <section class="dv2-section dv2-summary-section" style="--dv2-accent:${SECTION_COLORS.summary}">
            <div class="dv2-summary-banner">
                <div class="dv2-summary-head">
                    <div class="dv2-summary-title"><span class="dv2-badge" style="background:linear-gradient(135deg,#2563eb,#8b5cf6)">💶</span> Resumen del dinero</div>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                        <span class="dv2-summary-chip">Indicadores clave</span>
                        <button class="dv2-add-btn" id="dv2AddCommitment" style="--dv2-accent:#2563eb;background:color-mix(in srgb, var(--bg-card) 80%, transparent)"><i class="fas fa-plus"></i> Nuevo compromiso</button>
                    </div>
                </div>
                <div class="dv2-kpis-v3">
                    <div class="dv2-kpi3" style="--dv2-accent:#2563eb">
                        <div class="dv2-kpi3-label"><span class="dv2-kpi-dot" style="background:#2563eb"></span> Saldo Real en Cuentas</div>
                        <div class="dv2-kpi3-value">${fmtMoney(real)}</div>
                        <div class="dv2-kpi-meta">${data.accounts.length} cuentas físicas · dinero bancario real</div>
                        <div class="dv2-kpi-control">
                            <select class="dv2-select" id="dv2AccSelect" style="flex:1"><option value="">Consultar cuenta…</option>${accOptions}</select>
                            <button class="dv2-mini-btn" id="dv2EditAccountsBtn"><i class="fas fa-pen"></i> Editar saldos</button>
                        </div>
                    </div>
                    <div class="dv2-kpi3" style="--dv2-accent:#f59e0b">
                        <div class="dv2-kpi3-label"><span class="dv2-kpi-dot" style="background:#f59e0b"></span> Disponible Ahora</div>
                        <div class="dv2-kpi3-value ${now < 0 ? 'negative' : ''}">${fmtMoney(now)}</div>
                        <div class="dv2-kpi-meta">${fmtMoney(within.reduce((s,c)=>s+c.amount,0))} comprometidos en ${horizonLabel(h)} (${within.length})</div>
                        <div class="dv2-kpi-control">
                            <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted)">Horizonte:</span>
                            <select class="dv2-pill-select" id="dv2Horizon" style="--dv2-accent:#f59e0b" title="Ventana temporal de compromisos">${horizonOptions}</select>
                        </div>
                    </div>
                    <div class="dv2-kpi3" style="--dv2-accent:#8b5cf6">
                        <div class="dv2-kpi3-label"><span class="dv2-kpi-dot" style="background:#8b5cf6"></span> Disponible Global</div>
                        <div class="dv2-kpi3-value ${glob < 0 ? 'negative' : ''}">${fmtMoney(glob)}</div>
                        <div class="dv2-kpi-meta">Tras restar todos los compromisos futuros (${fmtMoney(totalPend)})</div>
                        <div class="dv2-kpi-control">
                            <button class="dv2-mini-btn" id="dv2ShowCommitments"><i class="fas fa-list-check"></i> Ver compromisos (${pendingCommitments().length})</button>
                        </div>
                    </div>
                </div>
            </div>
        </section>`;
    }

    // ---------- Bloque 2 · Monederos (tarjeta limpia: icono, nombre, color y dinero) ----------
    function renderWallets() {
        const cards = data.wallets.map(w => `
            <div class="dv2-card dv2-wallet" style="--dv2-accent:${w.color};cursor:pointer" data-wallet="${w.id}" title="Clic para ver movimientos y editar">
                <div class="dv2-wallet-top">
                    <span class="dv2-emoji">${w.emoji}</span>
                    <div style="flex:1;min-width:0">
                        <div class="dv2-wallet-name">${escapeHtml(w.name)}</div>
                    </div>
                    <span style="width:14px;height:14px;border-radius:5px;background:${w.color};box-shadow:0 0 0 3px color-mix(in srgb, ${w.color} 22%, transparent);flex-shrink:0" title="Color de la subcategoría"></span>
                </div>
                <div class="dv2-wallet-amt">${fmtMoney(walletBalance(w))}</div>
            </div>`).join('');

        return `
        <section class="dv2-section" style="--dv2-accent:${SECTION_COLORS.wallets}">
            ${sectionHead('wallets', 'Monederos virtuales', 'Distribución interna del saldo real', '+ Nuevo monedero', 'dv2AddWallet')}
            <div class="dv2-grid">${cards || '<div class="dv2-empty">Crea tu primer monedero</div>'}</div>
        </section>`;
    }

    // ---------- Bloque 3 · Deudas y devoluciones (tarjeta limpia: icono, subcategoría, color,
    // dinero, barrita de cubierto, restante, % y fecha estimada si la hay) ----------
    function debtMatchesFilter(d) {
        const st = debtStatus(d);
        if (viewFilters.debtStatus === 'pending') return st !== 'done';
        if (viewFilters.debtStatus === 'done') return st === 'done';
        return true;
    }
    function renderDebts() {
        const groups = [
            { kind: 'pay', label: 'Dinero a devolver', hint: 'gastado hoy, se repone' },
            { kind: 'receive', label: 'Dinero a cobrar / recuperar', hint: 'préstamos o ingresos temporales' }
        ];
        const chipRow = (filterKey, opts, accentVar) => `<span class="dv2-filter-chips">${opts.map(o =>
            `<button class="dv2-fchip ${viewFilters[filterKey] === o.v ? 'sel' : ''}" data-${filterKey}="${o.v}">${o.l}</button>`).join('')}</span>`;
        const card = (d) => {
            const s = debtStatus(d);
            const pct = d.total ? Math.min(100, Math.round(d.returned / d.total * 100)) : 0;
            const col = d.kind === 'pay' ? '#ef4444' : '#0ea5e9';
            return `
            <div class="dv2-card" style="--dv2-accent:${col};cursor:pointer" data-debt="${d.id}" title="Clic para ver movimientos y editar">
                <div class="dv2-wallet-top">
                    <span class="dv2-emoji">${d.emoji}</span>
                    <div style="flex:1;min-width:0">
                        <div class="dv2-wallet-name">${escapeHtml(d.name)}</div>
                    </div>
                    <span style="width:14px;height:14px;border-radius:5px;background:${col};box-shadow:0 0 0 3px color-mix(in srgb, ${col} 22%, transparent);flex-shrink:0" title="Color"></span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:baseline">
                    <div class="dv2-wallet-amt">${fmtMoney(d.total)}</div>
                    <span class="dv2-chip">${pct}%</span>
                </div>
                <div class="dv2-progress" style="--dv2-accent:${col}"><div class="dv2-progress-fill" style="width:${pct}%"></div></div>
                <div class="dv2-progress-meta"><span>Cubierto: ${fmtMoney(d.returned)}</span><span>Restante: ${fmtMoney(Math.max(0, d.total - d.returned))}</span></div>
                ${d.dueDate ? `<div class="dv2-wallet-foot" style="margin-top:8px"><span><i class="fas fa-calendar" style="font-size:10px"></i> ${fmtDate(d.dueDate)}</span>${s === 'done' ? '<span class="dv2-debt-status dv2-st-done">Completado</span>' : ''}</div>` : ''}
            </div>`;
        };
        const blocks = groups.map(g => {
            const list = data.debts.filter(d => d.kind === g.kind && debtMatchesFilter(d));
            return `
            <div style="margin-bottom:14px">
                <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:${g.kind === 'pay' ? '#ef4444' : '#0ea5e9'};margin-bottom:8px">
                    <i class="fas ${g.kind === 'pay' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i> ${g.label} <span style="color:var(--text-muted);font-weight:500;text-transform:none">(${g.hint})</span>
                </div>
                <div class="dv2-grid">${list.map(card).join('') || '<div class="dv2-empty">Nada registrado con este filtro</div>'}</div>
            </div>`;
        }).join('');

        return `
        <section class="dv2-section" style="--dv2-accent:${SECTION_COLORS.debts}">
            ${sectionHead('debts', 'Deudas y devoluciones', 'Dinero temporalmente fuera de su sitio', '+ Nueva deuda', 'dv2AddDebt')}
            ${filterRowHtml('debtStatus', [{ v: 'pending', l: 'Pendientes' }, { v: 'done', l: 'Completadas' }, { v: 'all', l: 'Todas' }])}
            ${blocks}
        </section>`;
    }

    // ---------- Bloque 4 · Préstamos (ocultos si completados; filtro activos/completados) ----------
    function loanMatchesFilter(l) {
        const done = l.paidCount >= l.installments;
        if (viewFilters.loanStatus === 'active') return !done;
        if (viewFilters.loanStatus === 'completed') return done;
        return true;
    }
    function renderLoans() {
        const cards = data.loans.filter(loanMatchesFilter).map(l => {
            const pending = loanPending(l);
            const pct = l.installments ? Math.round(l.paidCount / l.installments * 100) : 0;
            const done = l.paidCount >= l.installments;
            return `
            <div class="dv2-card" style="--dv2-accent:#8b5cf6;cursor:pointer" data-loan="${l.id}" title="Clic para ver cuotas y editar">
                <div class="dv2-wallet-top">
                    <span class="dv2-emoji">${l.emoji}</span>
                    <div style="flex:1;min-width:0">
                        <div class="dv2-wallet-name">${escapeHtml(l.name)}</div>
                        <div style="font-size:10.5px;color:var(--text-muted)">Financiado: ${fmtMoney(l.financed)} · ${fmtMoney(l.installmentAmount)}/cuota</div>
                    </div>
                    <span style="width:14px;height:14px;border-radius:5px;background:#8b5cf6;box-shadow:0 0 0 3px color-mix(in srgb, #8b5cf6 22%, transparent);flex-shrink:0" title="Color"></span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px">
                    <div class="dv2-wallet-amt" style="color:${done ? 'var(--success)' : 'var(--danger)'}">${done ? '✅ Completado' : fmtMoney(pending)}</div>
                    <span class="dv2-chip">${pct}%</span>
                </div>
                <div style="font-size:11px;color:var(--text-muted)">${done ? `${l.paidCount}/${l.installments} cuotas pagadas` : 'pendiente por pagar'}</div>
                <div class="dv2-progress" style="--dv2-accent:#8b5cf6"><div class="dv2-progress-fill" style="width:${pct}%"></div></div>
                <div class="dv2-progress-meta"><span>Pagado: ${fmtMoney(l.financed - pending)}</span><span>Cubiertas: ${l.paidCount}/${l.installments}</span></div>
                ${!done && l.nextDate ? `<div class="dv2-wallet-foot" style="margin-top:8px"><span><i class="fas fa-file-invoice-dollar" style="font-size:10px"></i> Próximo recibo: ${fmtDate(l.nextDate)}</span><span style="font-size:10.5px;color:var(--text-muted)">${escapeHtml(l.accountName || '')}</span></div>` : ''}
            </div>`;
        }).join('');

        return `
        <section class="dv2-section" style="--dv2-accent:${SECTION_COLORS.loans}">
            ${sectionHead('loans', 'Préstamos y financiaciones', viewFilters.loanStatus === 'completed' ? 'Historial cerrado' : 'Cuotas activas', '+ Nuevo préstamo', 'dv2AddLoan')}
            ${filterRowHtml('loanStatus', [{ v: 'active', l: 'Pendientes' }, { v: 'completed', l: 'Completados' }, { v: 'all', l: 'Todos' }])}
            <div class="dv2-grid dv2-grid-wide">${cards || '<div class="dv2-empty">' + (viewFilters.loanStatus === 'active' ? 'Sin préstamos activos 🎉' : 'Nada con este filtro') + '</div>'}</div>
        </section>`;
    }

    // ---------- Chips de filtro reutilizables ----------
    function filterRowHtml(key, opts, label) {
        return `<div style="margin:-6px 0 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted)">Mostrar:</span>
            <span class="dv2-filter-chips">${opts.map(o =>
                `<button class="dv2-fchip ${viewFilters[key] === o.v ? 'sel' : ''}" data-${key}="${o.v}">${o.l}</button>`).join('')}</span>
        </div>`;
    }

    // ---------- Bloque 5 · Objetivos de ahorro (tarjeta limpia; clic → modal; se conserva + Aportar) ----------
    function renderGoals() {
        const cards = data.goals.filter(goalMatchesFilter).map(g => {
            const pct = g.target ? Math.min(100, Math.round(g.saved / g.target * 100)) : null;
            const rem = goalRemaining(g);
            return `
            <div class="dv2-card" style="--dv2-accent:#10b981;cursor:pointer" data-goal="${g.id}" title="Clic para ver aportaciones y editar">
                <div class="dv2-wallet-top">
                    <span class="dv2-emoji">${g.emoji}</span>
                    <div style="flex:1;min-width:0">
                        <div class="dv2-wallet-name">${escapeHtml(g.name)}</div>
                        <div style="font-size:10.5px;color:var(--text-muted)">${g.target != null ? `Meta: ${fmtMoney(g.target)}` : 'Sin meta fija'}</div>
                    </div>
                    <span style="width:14px;height:14px;border-radius:5px;background:#10b981;box-shadow:0 0 0 3px color-mix(in srgb, #10b981 22%, transparent);flex-shrink:0" title="Color"></span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:baseline">
                    <div class="dv2-wallet-amt" style="color:#10b981">${fmtMoney(g.saved)}</div>
                    ${pct != null ? `<span class="dv2-chip">${pct}%</span>` : ''}
                </div>
                ${g.target != null ? `
                <div class="dv2-progress" style="--dv2-accent:#10b981"><div class="dv2-progress-fill" style="width:${pct}%"></div></div>
                <div class="dv2-progress-meta"><span>Faltan: ${fmtMoney(rem)}</span><span>Fin est.: ${goalFinishDate(g) || '—'}</span></div>` : `
                <div class="dv2-progress" style="--dv2-accent:#10b981"><div class="dv2-progress-fill" style="width:100%"></div></div>
                <div class="dv2-progress-meta"><span>Ahorro libre</span><span>Fecha fin: —</span></div>`}
                <div class="dv2-wallet-foot" style="margin-top:10px">
                    <span>${g.frequency !== 'none' && g.nextDate ? `<i class="fas fa-clock" style="font-size:10px"></i> Próxima: ${fmtDate(g.nextDate)} · ${fmtMoney(g.contribution)}` : '<span class="dv2-note-flag">Sin aportación programada</span>'}</span>
                    <button class="dv2-mini-btn" data-goalcontrib="${g.id}"><i class="fas fa-plus"></i> Aportar</button>
                </div>
            </div>`;
        }).join('');

        return `
        <section class="dv2-section" style="--dv2-accent:${SECTION_COLORS.goals}">
            ${sectionHead('goals', 'Objetivos de ahorro', 'Metas con seguimiento', '+ Nuevo objetivo', 'dv2AddGoal')}
            ${filterRowHtml('goalStatus', [{ v: 'dateActive', l: '📅 Fecha activa' }, { v: 'done', l: 'Completados' }, { v: 'all', l: 'Todos' }])}
            <div class="dv2-grid dv2-grid-wide">${cards || '<div class="dv2-empty">' + (viewFilters.goalStatus === 'dateActive' ? 'Ningún objetivo con aportación programada (cambia el filtro para ver todos)' : 'Sin objetivos con este filtro') + '</div>'}</div>
        </section>`;
    }

    // ---------- Bloque 6 · Pagos recurrentes (tarjeta limpia; clic → modal) ----------
    function renderRecurring() {
        const cards = data.recurring.filter(recurringMatchesFilter).map(r => `
            <div class="dv2-card" style="--dv2-accent:#0ea5e9;cursor:pointer" data-recurring="${r.id}" title="Clic para ver historial y editar">
                <div class="dv2-wallet-top">
                    <span class="dv2-emoji">${r.emoji}</span>
                    <div style="flex:1;min-width:0">
                        <div class="dv2-wallet-name">${escapeHtml(r.name)}</div>
                        <div style="font-size:10.5px;color:var(--text-muted)">${periodLabel(r.period)} · ${escapeHtml(r.accountName || 'Sin cuenta')}</div>
                    </div>
                    <span style="width:14px;height:14px;border-radius:5px;background:#0ea5e9;box-shadow:0 0 0 3px color-mix(in srgb, #0ea5e9 22%, transparent);flex-shrink:0" title="Color"></span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div class="dv2-wallet-amt">${fmtMoney(r.amount)}</div>
                    <span class="dv2-debt-status ${r.active ? 'dv2-st-done' : 'dv2-st-pending'}" style="${r.active ? '' : 'background:var(--border-light);color:var(--text-muted)'}">${r.active ? 'Activo' : 'Pausado'}</span>
                </div>
                <div class="dv2-wallet-foot" style="margin-top:8px">
                    <span>${r.active && r.nextDate ? `<i class="fas fa-calendar-check" style="font-size:10px"></i> Próximo cobro: ${fmtDate(r.nextDate)}` : r.active ? 'Sin fecha próxima' : '⏸ En pausa'}</span>
                </div>
            </div>`).join('');

        return `
        <section class="dv2-section" style="--dv2-accent:${SECTION_COLORS.recurring}">
            ${sectionHead('recurring', 'Pagos recurrentes y suscripciones', 'Compromisos periódicos', '+ Nuevo pago', 'dv2AddRecurring')}
            ${filterRowHtml('recurringStatus', [{ v: 'active', l: '🟢 Activo' }, { v: 'paused', l: '⏸ Pausados' }, { v: 'all', l: 'Todos' }])}
            <div class="dv2-grid">${cards || '<div class="dv2-empty">' + (viewFilters.recurringStatus === 'active' ? 'Sin pagos activos con este filtro' : 'Nada con este filtro') + '</div>'}</div>
        </section>`;
    }

    // =========================================================
    // COLUMNA DERECHA · Bloque 7 Historial + registro rápido
    // =========================================================
    const histFilter = { account: 'all', type: 'all', from: '', to: '' };

    function renderRight() {
        const right = containerEl.querySelector('#dv2Right');
        const accOpts = ['<option value="all">Todas las cuentas</option>'].concat(
            data.accounts.map(a => `<option value="${a.id}" ${histFilter.account === a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`)
        ).join('');
        const typeOpts = [['all', 'Todos los tipos'], ['in', 'Entradas'], ['out', 'Salidas'], ['transfer', 'Transferencias']]
            .map(([v, l]) => `<option value="${v}" ${histFilter.type === v ? 'selected' : ''}>${l}</option>`).join('');

        const rows = filteredMovements();

        right.innerHTML = `
        <section class="dv2-section" style="--dv2-accent:${SECTION_COLORS.history}">
            ${sectionHead('history', 'Historial de movimientos', `${rows.length}`, '+ Movimiento', 'dv2AddMovement')}
            <div class="dv2-card" style="--dv2-accent:${SECTION_COLORS.history};padding:14px">
                <div class="dv2-hist-filters">
                    <select class="dv2-select" id="dv2HFAccount">${accOpts}</select>
                    <select class="dv2-select" id="dv2HFType">${typeOpts}</select>
                    <div class="dv2-row2">
                        <input class="dv2-input" type="date" id="dv2HFFrom" value="${histFilter.from}" title="Desde">
                        <input class="dv2-input" type="date" id="dv2HFTo" value="${histFilter.to}" title="Hasta">
                    </div>
                </div>
                <div class="dv2-hist-list">
                    ${rows.length ? rows.map(m => {
                        const acc = data.accounts.find(a => a.id === m.accountId);
                        const isIn = m.amount >= 0;
                        const isTransfer = m.type.startsWith('transfer');
                        const iconBg = isTransfer ? 'var(--border-light)' : isIn ? 'color-mix(in srgb, var(--success) 15%, transparent)' : 'color-mix(in srgb, var(--danger) 12%, transparent)';
                        const iconColor = isTransfer ? 'var(--text-muted)' : isIn ? 'var(--success)' : 'var(--danger)';
                        const icon = isTransfer ? 'fa-right-left' : isIn ? 'fa-arrow-down' : 'fa-arrow-up';
                        return `
                        <div class="dv2-hist-row">
                            <span class="dv2-hist-icon" style="background:${iconBg};color:${iconColor}"><i class="fas ${icon}"></i></span>
                            <div class="dv2-hist-main">
                                <div class="dv2-hist-concept">${escapeHtml(m.concept)}</div>
                                <div class="dv2-hist-sub">${fmtDate(m.date)} · ${escapeHtml(acc ? acc.name : 'Sin cuenta')}${linkLabel(m.link) ? ' · ' + linkLabel(m.link) : ''}</div>
                            </div>
                            <span class="dv2-hist-amt" style="color:${isTransfer ? 'var(--text-muted)' : isIn ? 'var(--success)' : 'var(--danger)'}">${isIn ? '+' : '−'}${fmtMoney(Math.abs(m.amount))}</span>
                        </div>`;
                    }).join('') : '<div class="dv2-empty">No hay movimientos con estos filtros</div>'}
                </div>
            </div>
        </section>`;
        bindRight(right);
    }

    function linkLabel(link) {
        if (!link) return '';
        if (link.kind === 'wallet') { const w = data.wallets.find(x => x.id === link.id); return w ? w.emoji + ' ' + w.name : ''; }
        if (link.kind === 'goal') { const g = data.goals.find(x => x.id === link.id); return g ? g.emoji + ' ' + g.name : ''; }
        if (link.kind === 'loan') { const l = data.loans.find(x => x.id === link.id); return l ? l.emoji + ' ' + l.name : ''; }
        if (link.kind === 'debt') { const d = data.debts.find(x => x.id === link.id); return d ? d.emoji + ' ' + d.name : ''; }
        if (link.kind === 'recurring') { const r = data.recurring.find(x => x.id === link.id); return r ? r.emoji + ' ' + r.name : ''; }
        return '';
    }

    function filteredMovements() {
        return data.movements
            .filter(m => histFilter.account === 'all' || m.accountId === histFilter.account)
            .filter(m => histFilter.type === 'all' || m.type.startsWith(histFilter.type))
            .filter(m => (!histFilter.from || m.date >= histFilter.from) && (!histFilter.to || m.date <= histFilter.to))
            .sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1));
    }

    // =========================================================
    // EVENTOS
    // =========================================================
    function bindGlobal() {
        const root = containerEl.querySelector('#dv2ModalRoot');
        root.addEventListener('click', (e) => { if (e.target === root) closeModal(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    }

    function bindLeft(left) {
        // KPIs
        left.querySelector('#dv2AccSelect')?.addEventListener('change', (e) => {
            const acc = data.accounts.find(a => a.id === e.target.value);
            if (acc) openAccountEditor(acc.id);
            e.target.value = '';
        });
        left.querySelector('#dv2EditAccountsBtn')?.addEventListener('click', () => openAccountEditor(null));
        left.querySelector('#dv2AddCommitment')?.addEventListener('click', () => openCommitmentModal());
        left.querySelector('#dv2ShowCommitments')?.addEventListener('click', () => openCommitmentsList());
        left.querySelector('#dv2Horizon')?.addEventListener('change', (e) => {
            const v = Math.max(0, Math.min(365, parseInt(e.target.value || '7', 10)));
            data.settings.horizonDays = v;
            saveData(); renderAll();
        });

        // Monederos: clic en tarjeta → pantalla emergente (movimientos + datos a editar)
        left.querySelector('#dv2AddWallet')?.addEventListener('click', () => openWalletModal());
        left.querySelectorAll('[data-wallet]').forEach(el => {
            el.addEventListener('click', () => openWalletDetailModal(el.dataset.wallet));
        });

        // Deudas: clic en tarjeta → emergente; filtro por estado
        left.querySelector('#dv2AddDebt')?.addEventListener('click', () => openDebtModal());
        left.querySelectorAll('[data-debt]').forEach(el => {
            el.addEventListener('click', () => openDebtDetailModal(el.dataset.debt));
        });
        left.querySelectorAll('[data-debtstatus]').forEach(el => {
            el.addEventListener('click', () => { viewFilters.debtStatus = el.dataset.debtstatus; renderLeft(); });
        });
        // Préstamos: clic en tarjeta → emergente; filtro pendientes/completados
        left.querySelector('#dv2AddLoan')?.addEventListener('click', () => openLoanModal());
        left.querySelectorAll('[data-loan]').forEach(el => {
            el.addEventListener('click', () => openLoanDetailModal(el.dataset.loan));
        });
        left.querySelectorAll('[data-loanstatus]').forEach(el => {
            el.addEventListener('click', () => { viewFilters.loanStatus = el.dataset.loanstatus; renderLeft(); });
        });

        // Objetivos: clic en tarjeta → emergente; se conserva "+ Aportar" directo
        left.querySelector('#dv2AddGoal')?.addEventListener('click', () => openGoalModal());
        left.querySelectorAll('[data-goalstatus]').forEach(el => {
            el.addEventListener('click', () => { viewFilters.goalStatus = el.dataset.goalstatus; renderLeft(); });
        });
        left.querySelectorAll('[data-goal]').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('[data-goalcontrib]')) return;
                openGoalDetailModal(el.dataset.goal);
            });
        });
        left.querySelectorAll('[data-goalcontrib]').forEach(el => {
            el.addEventListener('click', (e) => { e.stopPropagation(); openContributionModal(el.dataset.goalcontrib); });
        });

        // Recurrentes: clic en tarjeta → emergente; filtro activo/pausado
        left.querySelector('#dv2AddRecurring')?.addEventListener('click', () => openRecurringModal());
        left.querySelectorAll('[data-recurringstatus]').forEach(el => {
            el.addEventListener('click', () => { viewFilters.recurringStatus = el.dataset.recurringstatus; renderLeft(); });
        });
        left.querySelectorAll('[data-recurring]').forEach(el => {
            el.addEventListener('click', () => openRecurringDetailModal(el.dataset.recurring));
        });
    }

    function toggleCollapse(btn, setKey, id, collapseId) {
        const set = expanded[setKey];
        set.has(id) ? set.delete(id) : set.add(id);
        btn.classList.toggle('open', set.has(id));
        const col = document.getElementById(collapseId);
        if (col) col.classList.toggle('open', set.has(id));
    }

    function bindRight(right) {
        right.querySelector('#dv2AddMovement')?.addEventListener('click', () => openMovementModal());
        right.querySelector('#dv2HFAccount')?.addEventListener('change', (e) => { histFilter.account = e.target.value; renderRight(); });
        right.querySelector('#dv2HFType')?.addEventListener('change', (e) => { histFilter.type = e.target.value; renderRight(); });
        right.querySelector('#dv2HFFrom')?.addEventListener('change', (e) => { histFilter.from = e.target.value; renderRight(); });
        right.querySelector('#dv2HFTo')?.addEventListener('change', (e) => { histFilter.to = e.target.value; renderRight(); });
    }

    // =========================================================
    // NÚCLEO FINANCIERO: registrar movimiento real
    // Aplica reglas: el saldo real solo cambia con movimientos ejecutados;
    // las transferencias internas entre cuentas propias no alteran el total.
    // =========================================================
    function registerMovement(m) {
        const mv = { id: uid('mv'), date: m.date || TODAY_ISO, concept: m.concept, amount: m.amount, type: m.type, accountId: m.accountId || null, link: m.link || null };
        if (m.currency === 'USD') { mv.currency = 'USD'; mv.eurEquivalent = round2(m.amount / eurUsdRate); }
        data.movements.unshift(mv);
        // Efecto sobre el saldo real (no en transferencias dobles: cada lado ajusta su cuenta)
        const acc = data.accounts.find(a => a.id === mv.accountId);
        if (acc && (mv.type === 'in' || mv.type === 'out' || mv.type === 'transfer-in' || mv.type === 'transfer-out')) {
            acc.balance = round2(acc.balance + mv.amount);
        }
        saveData();
        renderAll();
        return mv;
    }
    function round2(n) { return Math.round(n * 100) / 100; }

    function payLoanInstallment(loanId) {
        const l = data.loans.find(x => x.id === loanId);
        if (!l || l.paidCount >= l.installments) return;
        const n = l.paidCount + 1;
        l.payments.push({ id: uid('lp'), date: TODAY_ISO, amount: l.installmentAmount, n });
        l.paidCount = n;
        l.nextDate = l.paidCount < l.installments ? addMonths(TODAY_ISO, 1) : null;
        const acc = data.accounts.find(a => a.name === l.accountName);
        registerMovement({ date: TODAY_ISO, concept: `Cuota #${n} · ${l.name}`, amount: -l.installmentAmount, type: 'out', accountId: acc ? acc.id : null, link: { kind: 'loan', id: l.id } });
        toast(`Cuota #${n} de ${l.name} pagada`);
    }

    // =========================================================
    // SISTEMA DE MODALES (crear/editar sin recargar pantalla)
    // =========================================================
    let modalPrevFocus = null;
    function openModal(title, iconColor, bodyHtml, footHtml) {
        const root = containerEl.querySelector('#dv2ModalRoot');
        modalPrevFocus = document.activeElement;
        root.innerHTML = `
            <div class="dv2-modal" role="dialog" aria-modal="true">
                <div class="dv2-modal-head">
                    <div class="dv2-modal-title">${title}</div>
                    <button class="dv2-modal-close" id="dv2ModalX"><i class="fas fa-times"></i></button>
                </div>
                <div class="dv2-modal-body">${bodyHtml}</div>
                <div class="dv2-modal-foot">${footHtml}</div>
            </div>`;
        (window.requestAnimationFrame || ((cb) => setTimeout(cb, 16)))(() => root.classList.add("show"));
        root.querySelector('#dv2ModalX').onclick = closeModal;
        return root.querySelector('.dv2-modal-body');
    }
    function closeModal() {
        const root = containerEl && containerEl.querySelector('#dv2ModalRoot');
        if (!root) return;
        root.classList.remove('show');
        setTimeout(() => { if (!root.classList.contains('show')) root.innerHTML = ''; }, 220);
        if (modalPrevFocus && modalPrevFocus.focus) { try { modalPrevFocus.focus(); } catch (e) {} }
    }
    const f = (id, label, inner) => `<div class="dv2-field"><label>${label}</label>${inner}</div>`;
    const inp = (id, opts = {}) => `<input class="dv2-input" id="${id}" ${Object.entries(opts).map(([k, v]) => `${k}="${escapeHtml(v)}"`).join(' ')}>`;
    const sel = (id, options, value) => `<select class="dv2-select" id="${id}">${options.map(o => `<option value="${o.v}" ${String(o.v) === String(value) ? 'selected' : ''}>${o.l}</option>`).join('')}</select>`;

    const EMOJIS = ['👛', '🛒', '🎮', '🚗', '🎁', '🐱', '✈️', '🏠', '💍', '🎓', '🚨', '💡', '📱', '🎸', '⚽', '💄'];
    function emojiPicker(name, current) {
        let chosen = current || '👛';
        const html = `<div class="dv2-emoji-picker" id="${name}">${EMOJIS.map(e => `<button type="button" class="dv2-emoji-opt ${e === chosen ? 'sel' : ''}" data-emoji="${e}">${e}</button>`).join('')}</div>`;
        return html;
    }
    function bindEmojiPicker(root) {
        const picker = root.querySelector('.dv2-emoji-picker');
        if (!picker) return;
        picker.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-emoji]');
            if (!btn) return;
            picker.querySelectorAll('.dv2-emoji-opt').forEach(b => b.classList.toggle('sel', b === btn));
        });
    }
    function pickedEmoji(root) {
        const selBtn = root.querySelector('.dv2-emoji-opt.sel');
        return selBtn ? selBtn.dataset.emoji : '👛';
    }

    // ---------- Cuentas físicas / Saldo Real ----------
    function openAccountEditor(focusAccId) {
        const rows = data.accounts.map(a => `
            <div class="dv2-mov-line" style="align-items:center;border-bottom:1px solid var(--border-light)">
                <span style="flex:1;font-weight:600;font-size:12.5px">${a.icon} ${escapeHtml(a.name)}</span>
                <input class="dv2-input accBal" data-acc="${a.id}" type="number" step="0.01" value="${a.balance}" style="width:110px;text-align:right">
            </div>`).join('');
        const body = openModal(
            '<span class="dv2-badge" style="--dv2-accent:#2563eb;background:#2563eb">🏦</span> Saldos de cuentas físicas',
            '#2563eb',
            `
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">Introduce el saldo real actual de cada cuenta. Estos valores componen el <strong>Saldo Real en Cuentas</strong>.</div>
            ${rows}
            <div style="border-top:1px dashed var(--border);margin-top:10px;padding-top:10px;display:flex;gap:8px">
                ${inp('dv2NewAccName', { placeholder: 'Nueva cuenta (ej. Trade Republic 3)' })}
                <button class="dv2-mini-btn" id="dv2AddAcc"><i class="fas fa-plus"></i></button>
            </div>`,
            `<button class="btn btn-secondary" id="dv2AccCancel">Cancelar</button><button class="btn btn-primary" id="dv2AccSave"><i class="fas fa-save"></i> Guardar saldos</button>`
        );
        body.querySelector('#dv2AccCancel').onclick = closeModal;
        body.parentElement.querySelector('#dv2AccSave').onclick = () => {
            body.querySelectorAll('.accBal').forEach(i => {
                const acc = data.accounts.find(a => a.id === i.dataset.acc);
                if (acc) acc.balance = round2(parseFloat(i.value) || 0);
            });
            saveData(); closeModal(); renderAll(); toast('Saldos actualizados');
        };
        body.querySelector('#dv2AddAcc').onclick = () => {
            const name = body.querySelector('#dv2NewAccName').value.trim();
            if (!name) return;
            data.accounts.push({ id: uid('acc'), name, icon: '🏦', balance: 0, color: '#2563eb' });
            saveData(); closeModal(); renderAll(); openAccountEditor(null);
        };
    }

    // ---------- Compromisos ----------
    function openCommitmentModal(editId) {
        const c = editId ? data.commitments.find(x => x.id === editId) : null;
        const accOpts = data.accounts.map(a => ({ v: a.id, l: `${a.icon} ${a.name}` }));
        const body = openModal(
            `<span class="dv2-badge" style="background:#2563eb">📅</span> ${c ? 'Editar compromiso' : 'Nuevo compromiso futuro'}`,
            '#2563eb',
            `
            ${f('f1', 'Nombre / concepto', inp('dv2CName', { value: c ? c.name : '', placeholder: 'Ej. Recibo de la luz' }))}
            <div class="dv2-row2">
                ${f('f2', 'Importe (€)', inp('dv2CAmt', { type: 'number', step: '0.01', min: '0', value: c ? c.amount : '' }))}
                ${f('f3', 'Fecha de cobro', inp('dv2CDate', { type: 'date', value: c ? c.dueDate : TODAY_ISO }))}
            </div>
            ${f('f4', 'Cuenta asociada', sel('dv2CAcc', accOpts, c ? c.accountId : (accOpts[0] || {}).v))}
            ${f('f5', 'Nota (opcional)', inp('dv2CNote', { value: c ? c.note || '' : '', placeholder: 'Detalles…' }))}
            <div style="font-size:11px;color:var(--text-muted)"><i class="fas fa-circle-info"></i> Los compromisos pendientes reducen <em>Disponible Ahora/Global</em> pero <strong>no</strong> descuentan el Saldo Real hasta que se registren como movimiento ejecutado.</div>`,
            `${c ? '<button class="dv2-danger-link" id="dv2CDel">Eliminar</button>' : ''}<button class="btn btn-secondary" id="dv2CCancel">Cancelar</button><button class="btn btn-primary" id="dv2CSave"><i class="fas fa-save"></i> Guardar</button>`
        );
        body.parentElement.querySelector('#dv2CCancel').onclick = closeModal;
        body.parentElement.querySelector('#dv2CSave').onclick = () => {
            const name = body.querySelector('#dv2CName').value.trim();
            const amount = round2(parseFloat(body.querySelector('#dv2CAmt').value));
            const dueDate = body.querySelector('#dv2CDate').value;
            if (!name || isNaN(amount) || amount <= 0 || !dueDate) { toast('Completa nombre, importe y fecha', 'error'); return; }
            const obj = { id: c ? c.id : uid('cm'), name, amount, dueDate, accountId: body.querySelector('#dv2CAcc').value, executed: c ? c.executed : false, note: body.querySelector('#dv2CNote').value.trim() };
            if (c) { const idx = data.commitments.findIndex(x => x.id === c.id); data.commitments[idx] = obj; }
            else data.commitments.push(obj);
            saveData(); closeModal(); renderAll(); toast(c ? 'Compromiso actualizado' : 'Compromiso añadido');
        };
        if (c) body.parentElement.querySelector('#dv2CDel').onclick = () => confirmDelete(`¿Eliminar el compromiso «${c.name}»?`, () => {
            data.commitments = data.commitments.filter(x => x.id !== c.id);
            saveData(); renderAll();
        });
    }

    function openCommitmentsList() {
        const list = [...pendingCommitments()].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        const body = openModal(
            '<span class="dv2-badge" style="background:#8b5cf6">🗂️</span> Compromisos futuros pendientes',
            '#8b5cf6',
            list.length ? list.map(c => {
                const d = daysFromToday(c.dueDate);
                const inH = d <= data.settings.horizonDays;
                const acc = data.accounts.find(a => a.id === c.accountId);
                return `
                <div class="dv2-mov-line" style="align-items:center;padding:8px 0">
                    <span class="dv2-mov-date">${fmtDate(c.dueDate)}</span>
                    <span style="flex:1;min-width:0">
                        <div style="font-size:12.5px;font-weight:600">${escapeHtml(c.name)}</div>
                        <div style="font-size:10.5px;color:var(--text-muted)">${acc ? escapeHtml(acc.name) : '—'} · ${d < 0 ? 'vencido' : `en ${d} día${d === 1 ? '' : 's'}`} ${inH ? '· dentro del horizonte' : ''}</div>
                    </span>
                    <span style="font-weight:800;color:var(--danger)">${fmtMoney(c.amount)}</span>
                    <button class="dv2-mini-btn" data-cexec="${c.id}" title="Registrar como movimiento ejecutado"><i class="fas fa-check"></i></button>
                    <button class="dv2-mini-btn" data-cedit="${c.id}" title="Editar"><i class="fas fa-pen"></i></button>
                </div>`;
            }).join('') + `<div style="margin-top:10px;font-size:12px;color:var(--text-secondary)">Total comprometido: <strong>${fmtMoney(list.reduce((s, c) => s + c.amount, 0))}</strong></div>`
            : '<div class="dv2-empty">No hay compromisos pendientes 🎉</div>',
            `<button class="dv2-add-btn" id="dv2CAdd" style="--dv2-accent:#8b5cf6"><i class="fas fa-plus"></i> Añadir compromiso</button><button class="btn btn-secondary" id="dv2CClose">Cerrar</button>`
        );
        body.parentElement.querySelector('#dv2CClose').onclick = closeModal;
        body.querySelector('#dv2CAdd').onclick = () => openCommitmentModal();
        body.querySelectorAll('[data-cedit]').forEach(b => b.onclick = () => openCommitmentModal(b.dataset.cedit));
        body.querySelectorAll('[data-cexec]').forEach(b => b.onclick = () => {
            const c = data.commitments.find(x => x.id === b.dataset.cexec);
            if (!c) return;
            c.executed = true;
            registerMovement({ date: TODAY_ISO, concept: c.name, amount: -c.amount, type: 'out', accountId: c.accountId, link: null });
            closeModal(); toast('Compromiso ejecutado y descontado del saldo real');
        });
    }

    // ---------- Helpers para pantallas emergentes de detalle ----------
    function entityActionsRow(items) {
        return `<div class="dv2-actions-row">${items.map(a =>
            `<button class="dv2-act-btn ${a.cls || ''}" data-act="${a.id}"><i class="fas ${a.icon}"></i> ${a.label}</button>`).join('')}</div>`;
    }
    function bindEntityActions(body, handlers) {
        body.querySelectorAll('[data-act]').forEach(btn => {
            const fn = handlers[btn.dataset.act];
            if (fn) btn.addEventListener('click', () => fn(btn));
        });
    }
    function detailMovList(movs, opts = {}) {
        if (!movs.length) return '<div class="dv2-empty">Todavía no hay movimientos registrados</div>';
        return movs.map(m => `
            <div class="dv2-mov-line">
                <span class="dv2-mov-date">${fmtDate(m.date)}</span>
                <span style="flex:1">${escapeHtml(m.concept || m.note || opts.defaultConcept || '—')}${m.planned ? ' <span class="dv2-note-flag">(programada)</span>' : ''}</span>
                <span class="${(m.type === 'out' || (opts.negAll && m.amount > 0)) ? 'dv2-neg' : 'dv2-pos'}">${(m.type === 'out' || (opts.negAll && m.amount > 0)) ? '−' : '+'}${fmtAmount(Math.abs(m.amount), m.currency)}</span>
            </div>`).join('');
    }

    // ---------- Monederos ----------
    function openWalletModal(editId) {
        const w = editId ? data.wallets.find(x => x.id === editId) : null;
        const otherWallets = data.wallets.filter(x => !w || x.id !== w.id).map(x => ({ v: x.id, l: `${x.emoji} ${x.name}` }));
        const body = openModal(
            `<span class="dv2-badge" style="background:#f59e0b">${w ? w.emoji : '👛'}</span> ${w ? 'Monedero: ' + escapeHtml(w.name) : 'Nuevo monedero'}`,
            '#f59e0b',
            `
            ${f('fw1', 'Icono', emojiPicker('dv2WEmoji', w ? w.emoji : '👛'))}
            ${f('fw2', 'Nombre', inp('dv2WName', { value: w ? w.name : '', placeholder: 'Ej. Comida' }))}
            ${w ? `
            <div style="font-size:12px;color:var(--text-secondary)">Cantidad actual: <strong>${fmtMoney(walletBalance(w))}</strong> · sin límites ni porcentajes.</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">
                <button class="dv2-mini-btn" id="dv2WIn" style="justify-content:center;color:var(--success)"><i class="fas fa-plus"></i> Añadir dinero</button>
                <button class="dv2-mini-btn" id="dv2WOut" style="justify-content:center;color:var(--danger)"><i class="fas fa-minus"></i> Retirar dinero</button>
            </div>
            <div class="dv2-row2" style="margin-top:8px">
                ${f('fw3', 'Importe (€)', inp('dv2WAmt', { type: 'number', step: '0.01', min: '0', placeholder: '0.00' }))}
                ${f('fw4', 'Concepto', inp('dv2WConcept', { placeholder: 'Motivo del movimiento' }))}
            </div>
            ${otherWallets.length ? f('fw5', 'Transferir a otro monedero', sel('dv2WTarget', [{ v: '', l: '— No transferir —' }].concat(otherWallets), '')) : ''}` : ''}
            `,
            `${w ? '<button class="dv2-danger-link" id="dv2WDel">Eliminar monedero</button>' : ''}<button class="btn btn-secondary" id="dv2WCancel">${w ? 'Cerrar' : 'Cancelar'}</button><button class="btn btn-primary" id="dv2WSave"><i class="fas fa-save"></i> ${w ? 'Guardar cambios' : 'Crear monedero'}</button>`
        );
        bindEmojiPicker(body);
        body.parentElement.querySelector('#dv2WCancel').onclick = closeModal;
        body.parentElement.querySelector('#dv2WSave').onclick = () => {
            const name = body.querySelector('#dv2WName').value.trim();
            if (!name) { toast('El monedero necesita un nombre', 'error'); return; }
            const emoji = pickedEmoji(body);
            if (w) { w.name = name; w.emoji = emoji; toast('Monedero actualizado'); }
            else { data.wallets.push({ id: uid('w'), emoji, name, color: '#f59e0b', movements: [] }); toast('Monedero creado'); }
            saveData(); closeModal(); renderAll();
        };
        if (w) {
            body.parentElement.querySelector('#dv2WDel').onclick = () => confirmDelete(`¿Eliminar el monedero «${w.name}»? Su contenido vuelve al saldo común.`, () => {
                data.wallets = data.wallets.filter(x => x.id !== w.id);
                data.movements.forEach(m => { if (m.link && m.link.kind === 'wallet' && m.link.id === w.id) m.link = null; });
                saveData(); closeModal(); renderAll(); toast('Monedero eliminado');
            });
            const apply = (type) => {
                const amt = round2(parseFloat(body.querySelector('#dv2WAmt').value));
                const concept = body.querySelector('#dv2WConcept').value.trim() || (type === 'in' ? 'Aportación' : 'Retirada');
                const targetSel = body.querySelector('#dv2WTarget');
                const targetId = targetSel ? targetSel.value : '';
                if (targetId) {
                    // Transferencia interna entre monederos: no altera el saldo global
                    const t = data.wallets.find(x => x.id === targetId);
                    if (!t || isNaN(amt) || amt <= 0) { toast('Importe no válido para transferir', 'error'); return; }
                    w.movements.push({ id: uid('wm'), date: TODAY_ISO, concept: `Transferencia → ${t.name}`, amount: amt, type: 'out' });
                    t.movements.push({ id: uid('wm'), date: TODAY_ISO, concept: `Transferencia ← ${w.name}`, amount: amt, type: 'in' });
                    saveData(); closeModal(); renderAll(); toast('Transferencia interna realizada');
                    return;
                }
                if (isNaN(amt) || amt <= 0) { toast('Introduce un importe válido', 'error'); return; }
                w.movements.push({ id: uid('wm'), date: TODAY_ISO, concept, amount: amt, type });
                saveData(); closeModal(); renderAll(); toast(type === 'in' ? 'Dinero añadido al monedero' : 'Dinero retirado del monedero');
            };
            body.querySelector('#dv2WIn').onclick = () => apply('in');
            body.querySelector('#dv2WOut').onclick = () => apply('out');
        }
    }

    // =========================================================
    // PANTALLAS EMERGENTES DE DETALLE (deudas, préstamos, objetivos, recurrentes)
    // Mismo patrón que openWalletDetailModal: datos editables + movimientos.
    // =========================================================

    // ---------- Deuda / devolución ----------
    function openDebtDetailModal(id) {
        const d = data.debts.find(x => x.id === id); if (!d) return;
        const col = d.kind === 'pay' ? '#ef4444' : '#0ea5e9';
        const st = debtStatus(d);
        const pct = d.total ? Math.min(100, Math.round(d.returned / d.total * 100)) : 0;
        const remaining = Math.max(0, d.total - d.returned);
        const kindLabel = d.kind === 'pay' ? 'a devolver' : 'a cobrar';
        const movs = [...(d.history || [])].sort((a, b) => b.date.localeCompare(a.date));
        const body = openModal(
            `<span class="dv2-badge" style="background:${col}">${d.emoji}</span> ${escapeHtml(d.name)} · deuda ${kindLabel}`,
            col,
            `
            <div class="dv2-wallet-amt" style="color:${col};margin-bottom:6px">${fmtMoney(d.total)}</div>
            <div class="dv2-progress" style="--dv2-accent:${col}"><div class="dv2-progress-fill" style="width:${pct}%"></div></div>
            <div class="dv2-progress-meta"><span>Cubierto: ${fmtMoney(d.returned)} (${pct}%)</span><span>Restante: ${fmtMoney(remaining)}</span></div>
            <div class="dv2-data-grid">
                <div class="dv2-data-item"><span>Tipo</span><strong>${kindLabel}</strong></div>
                <div class="dv2-data-item"><span>Contraparte</span><strong>${escapeHtml(d.counterparty || '—')}</strong></div>
                <div class="dv2-data-item"><span>Fecha estimada</span><strong>${d.dueDate ? fmtDate(d.dueDate) : 'Sin fecha'}</strong></div>
                <div class="dv2-data-item"><span>Estado</span><strong>${st === 'done' ? '✅ Completado' : st === 'partial' ? '🟡 Parcial' : '🔴 Pendiente'}</strong></div>
            </div>
            ${d.note ? `<div style="font-size:12px;color:var(--text-secondary);margin:2px 0 8px">📝 ${escapeHtml(d.note)}</div>` : ''}
            ${entityActionsRow([
                { id: 'pay', icon: 'fa-hand-holding-dollar', label: 'Registrar devolución', cls: remaining > 0 ? '' : '' },
                { id: 'edit', icon: 'fa-pen', label: 'Editar subcategoría' }
            ])}
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);margin:12px 0 6px">Movimientos (${movs.length})</div>
            ${detailMovList(movs.map(h => ({ date: h.date, concept: h.note || 'Devolución', amount: h.amount, type: d.kind === 'pay' ? 'in' : 'out' })), { defaultConcept: 'Devolución' })}`,
            `<button class="dv2-danger-link" id="dv2DDLDel">Eliminar deuda</button><button class="btn btn-secondary" id="dv2DDLClose">Cerrar</button>`
        );
        bindEntityActions(body, {
            pay: () => openDebtPaymentModal(d.id),
            edit: () => openDebtModal(d.id)
        });
        body.parentElement.querySelector('#dv2DDLClose').onclick = closeModal;
        body.parentElement.querySelector('#dv2DDLDel').onclick = () => confirmDelete(`¿Eliminar «${d.name}»? Su historial de devoluciones se borra.`, () => {
            data.debts = data.debts.filter(x => x.id !== d.id);
            saveData(); closeModal(); renderAll(); toast('Deuda eliminada');
        });
    }

    // ---------- Préstamo / financiación ----------
    function openLoanDetailModal(id) {
        const l = data.loans.find(x => x.id === id); if (!l) return;
        const pending = loanPending(l);
        const done = l.paidCount >= l.installments;
        const pct = l.installments ? Math.round(l.paidCount / l.installments * 100) : 0;
        const movs = [...(l.payments || [])].sort((a, b) => b.date.localeCompare(a.date));
        const body = openModal(
            `<span class="dv2-badge" style="background:#8b5cf6">${l.emoji}</span> ${escapeHtml(l.name)} · préstamo`,
            '#8b5cf6',
            `
            <div class="dv2-wallet-amt" style="color:${done ? 'var(--success)' : 'var(--danger)'};margin-bottom:6px">${done ? '✅ Completado' : fmtMoney(pending) + ' pendientes'}</div>
            <div class="dv2-progress" style="--dv2-accent:#8b5cf6"><div class="dv2-progress-fill" style="width:${pct}%"></div></div>
            <div class="dv2-progress-meta"><span>Pagado: ${fmtMoney(l.financed - pending)}</span><span>Cubiertas: ${l.paidCount}/${l.installments} (${pct}%)</span></div>
            <div class="dv2-data-grid">
                <div class="dv2-data-item"><span>Total financiado</span><strong>${fmtMoney(l.financed)}</strong></div>
                <div class="dv2-data-item"><span>Por cuota</span><strong>${fmtMoney(l.installmentAmount)}</strong></div>
                <div class="dv2-data-item"><span>Próximo recibo</span><strong>${l.nextDate && !done ? fmtDate(l.nextDate) : '—'}</strong></div>
                <div class="dv2-data-item"><span>Cuenta asociada</span><strong>${escapeHtml(l.accountName || '—')}</strong></div>
            </div>
            ${entityActionsRow([
                ...(done ? [] : [{ id: 'pay', icon: 'fa-check', label: `Pagar cuota #${l.paidCount + 1} (${fmtMoney(l.installmentAmount)})`, cls: 'neg' }]),
                { id: 'edit', icon: 'fa-pen', label: 'Editar préstamo' }
            ])}
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);margin:12px 0 6px">Cuotas registradas (${movs.length})</div>
            ${detailMovList(movs.map(p => ({ date: p.date, concept: `Cuota #${p.n}`, amount: p.amount, type: 'out', planned: p.planned })), { negAll: true, defaultConcept: 'Cuota' })}`,
            `<button class="dv2-danger-link" id="dv2LDLDel">Eliminar préstamo</button><button class="btn btn-secondary" id="dv2LDLClose">Cerrar</button>`
        );
        bindEntityActions(body, {
            pay: () => { payLoanInstallment(l.id); openLoanDetailModal(l.id); },
            edit: () => openLoanModal(l.id)
        });
        body.parentElement.querySelector('#dv2LDLClose').onclick = closeModal;
        body.parentElement.querySelector('#dv2LDLDel').onclick = () => confirmDelete(`¿Eliminar el préstamo «${l.name}»?`, () => {
            data.loans = data.loans.filter(x => x.id !== l.id);
            saveData(); closeModal(); renderAll(); toast('Préstamo eliminado');
        });
    }

    // ---------- Objetivo de ahorro ----------
    function openGoalDetailModal(id) {
        const g = data.goals.find(x => x.id === id); if (!g) return;
        const pct = g.target ? Math.min(100, Math.round(g.saved / g.target * 100)) : null;
        const rem = goalRemaining(g);
        const movs = [...(g.contributions || [])].sort((a, b) => b.date.localeCompare(a.date));
        const body = openModal(
            `<span class="dv2-badge" style="background:#10b981">${g.emoji}</span> ${escapeHtml(g.name)} · objetivo de ahorro`,
            '#10b981',
            `
            <div class="dv2-wallet-amt" style="color:#10b981;margin-bottom:6px">${fmtMoney(g.saved)}</div>
            ${g.target != null ? `
            <div class="dv2-progress" style="--dv2-accent:#10b981"><div class="dv2-progress-fill" style="width:${pct}%"></div></div>
            <div class="dv2-progress-meta"><span>Faltan: ${fmtMoney(rem)}</span><span>Progreso: ${pct}%</span></div>` : ''}
            <div class="dv2-data-grid">
                <div class="dv2-data-item"><span>Meta</span><strong>${g.target != null ? fmtMoney(g.target) : 'Sin meta fija'}</strong></div>
                <div class="dv2-data-item"><span>Aportación</span><strong>${g.frequency !== 'none' && g.contribution ? `${fmtMoney(g.contribution)} · ${periodLabel(g.frequency)}` : 'Sin programar'}</strong></div>
                <div class="dv2-data-item"><span>Próxima fecha</span><strong>${g.nextDate ? fmtDate(g.nextDate) : '—'}</strong></div>
                <div class="dv2-data-item"><span>Fin estimado</span><strong>${goalFinishDate(g) || '—'}</strong></div>
            </div>
            ${entityActionsRow([
                { id: 'contrib', icon: 'fa-plus', label: 'Aportar', cls: 'pos' },
                { id: 'edit', icon: 'fa-pen', label: 'Editar objetivo' }
            ])}
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);margin:12px 0 6px">Aportaciones (${movs.length})</div>
            ${detailMovList(movs.map(c => ({ date: c.date, concept: 'Aportación', amount: c.amount, type: 'in', planned: c.planned })), { defaultConcept: 'Aportación' })}`,
            `<button class="dv2-danger-link" id="dv2GDLDel">Eliminar objetivo</button><button class="btn btn-secondary" id="dv2GDLClose">Cerrar</button>`
        );
        bindEntityActions(body, {
            contrib: () => openContributionModal(g.id),
            edit: () => openGoalModal(g.id)
        });
        body.parentElement.querySelector('#dv2GDLClose').onclick = closeModal;
        body.parentElement.querySelector('#dv2GDLDel').onclick = () => confirmDelete(`¿Eliminar el objetivo «${g.name}» con ${fmtMoney(g.saved)} ahorrados?`, () => {
            data.goals = data.goals.filter(x => x.id !== g.id);
            saveData(); closeModal(); renderAll(); toast('Objetivo eliminado');
        });
    }

    // ---------- Pago recurrente ----------
    function openRecurringDetailModal(id) {
        const r = data.recurring.find(x => x.id === id); if (!r) return;
        const movs = [...(r.history || [])].sort((a, b) => b.date.localeCompare(a.date));
        const body = openModal(
            `<span class="dv2-badge" style="background:#0ea5e9">${r.emoji}</span> ${escapeHtml(r.name)} · pago recurrente`,
            '#0ea5e9',
            `
            <div class="dv2-wallet-amt" style="color:#0ea5e9;margin-bottom:6px">${fmtMoney(r.amount)} <span style="font-size:13px;color:var(--text-muted)">/ ${String(periodLabel(r.period)).toLowerCase()}</span></div>
            <div class="dv2-data-grid">
                <div class="dv2-data-item"><span>Estado</span><strong>${r.active ? '🟢 Activo' : '⏸ Pausado'}</strong></div>
                <div class="dv2-data-item"><span>Próximo cobro</span><strong>${r.active && r.nextDate ? fmtDate(r.nextDate) : '—'}</strong></div>
                <div class="dv2-data-item"><span>Cuenta asociada</span><strong>${escapeHtml(r.accountName || '—')}</strong></div>
                <div class="dv2-data-item"><span>Total histórico</span><strong>${fmtMoney(movs.reduce((s, m) => s + Math.abs(m.amount), 0))}</strong></div>
            </div>
            ${entityActionsRow([
                ...(r.active && r.nextDate ? [{ id: 'charge', icon: 'fa-bolt', label: `Marcar cobrado hoy (${fmtMoney(r.amount)})`, cls: 'neg' }] : []),
                { id: 'pause', icon: r.active ? 'fa-pause' : 'fa-play', label: r.active ? 'Pausar' : 'Reactivar' },
                { id: 'edit', icon: 'fa-pen', label: 'Editar pago' }
            ])}
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);margin:12px 0 6px">Historial de cobros (${movs.length})</div>
            ${detailMovList(movs.map(h => ({ date: h.date, concept: h.note || `Cobro de ${r.name}`, amount: h.amount, type: 'out' })), { negAll: true, defaultConcept: 'Cobro' })}`,
            `<button class="dv2-danger-link" id="dv2RDLDel">Eliminar pago</button><button class="btn btn-secondary" id="dv2RDLClose">Cerrar</button>`
        );
        bindEntityActions(body, {
            charge: () => {
                r.history.push({ id: uid('rh'), date: TODAY_ISO, amount: r.amount, note: 'Cobro registrado manualmente' });
                const acc = data.accounts.find(a => a.name === r.accountName);
                if (acc) registerMovement({ date: TODAY_ISO, concept: r.name, amount: -r.amount, type: 'out', accountId: acc.id, link: { kind: 'recurring', id: r.id } });
                else { saveData(); renderAll(); }
                if (r.nextDate) {
                    const stepDays = r.period === 'weekly' ? 7 : r.period === 'quarterly' ? 91 : r.period === 'semiannual' ? 182 : r.period === 'annual' ? 365 : 30;
                    let nd = r.nextDate; while (nd <= TODAY_ISO) nd = addDays(nd, stepDays);
                    r.nextDate = nd; saveData();
                }
                toast(`Cobro de ${r.name} registrado`);
                openRecurringDetailModal(r.id);
            },
            pause: () => {
                r.active = !r.active;
                saveData(); renderAll(); toast(r.active ? 'Pago reactivado' : 'Pago en pausa');
                openRecurringDetailModal(r.id);
            },
            edit: () => openRecurringModal(r.id)
        });
        body.parentElement.querySelector('#dv2RDLClose').onclick = closeModal;
        body.parentElement.querySelector('#dv2RDLDel').onclick = () => confirmDelete(`¿Eliminar el pago recurrente «${r.name}»?`, () => {
            data.recurring = data.recurring.filter(x => x.id !== r.id);
            saveData(); closeModal(); renderAll(); toast('Pago eliminado');
        });
    }

    // ---------- Pantalla emergente de detalle (clic en tarjeta) ----------
    function openWalletDetailModal(id) {
        const w = data.wallets.find(x => x.id === id); if (!w) return;
        const movs = [...w.movements].sort((a, b) => b.date.localeCompare(a.date));
        const body = openModal(
            `<span class="dv2-badge" style="background:${w.color}">${w.emoji}</span> ${escapeHtml(w.name)} · monedero virtual`,
            w.color,
            `
            <div class="dv2-wallet-amt" style="color:${w.color};margin-bottom:8px">${fmtMoney(walletBalance(w))}</div>
            ${entityActionsRow([
                { id: 'in', icon: 'fa-plus', label: 'Ingreso', cls: 'pos' },
                { id: 'out', icon: 'fa-minus', label: 'Gasto', cls: 'neg' },
                { id: 'transfer', icon: 'fa-right-left', label: 'Transferir a otro monedero' },
                { id: 'edit', icon: 'fa-pen', label: 'Editar subcategoría' }
            ])}
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);margin:12px 0 6px">Movimientos (${movs.length})</div>
            ${detailMovList(movs)}`,
            `<button class="dv2-danger-link" id="dv2WDDel">Eliminar monedero</button><button class="btn btn-secondary" id="dv2WDClose">Cerrar</button>`
        );
        bindEntityActions(body, {
            in: () => quickWalletMove(w, 'in'),
            out: () => quickWalletMove(w, 'out'),
            transfer: () => openWalletTransferModal(w),
            edit: () => openWalletModal(w.id)
        });
        body.parentElement.querySelector('#dv2WDClose').onclick = closeModal;
        body.parentElement.querySelector('#dv2WDDel').onclick = () => confirmDelete(`¿Eliminar el monedero «${w.name}»? Sus movimientos internos se borran (el saldo real no cambia).`, () => {
            data.wallets = data.wallets.filter(x => x.id !== w.id);
            saveData(); closeModal(); renderAll(); toast('Monedero eliminado');
        });
    }

    function quickWalletMove(w, dir) {
        const isOut = dir === 'out';
        const bal = walletBalance(w);
        const body = openModal(
            `<span class="dv2-badge" style="background:${w.color}">${w.emoji}</span> ${isOut ? 'Gasto' : 'Ingreso'} · ${escapeHtml(w.name)}`,
            w.color,
            `
            ${f('qw1', 'Importe (€)', inp('dv2QWAmt', { type: 'number', step: '0.01', min: '0', placeholder: '0,00' }))}
            ${f('qw2', 'Concepto', inp('dv2QWCon', { placeholder: isOut ? 'Ej. Compra semanal' : 'Ej. Aportación' }))}
            ${f('qw3', 'Fecha', inp('dv2QWDate', { type: 'date', value: TODAY_ISO }))}`,
            `<button class="btn btn-secondary" id="dv2QWCancel">Cancelar</button><button class="btn btn-primary" id="dv2QWSave"><i class="fas fa-check"></i> Registrar</button>`
        );
        body.parentElement.querySelector('#dv2QWCancel').onclick = () => openWalletDetailModal(w.id);
        body.parentElement.querySelector('#dv2QWSave').onclick = () => {
            const amount = round2(parseFloat(body.querySelector('#dv2QWAmt').value));
            const concept = body.querySelector('#dv2QWCon').value.trim() || (isOut ? 'Gasto' : 'Ingreso');
            const date = body.querySelector('#dv2QWDate').value || TODAY_ISO;
            if (isNaN(amount) || amount <= 0) { toast('Importe no válido', 'error'); return; }
            if (isOut && amount > bal) { toast(`El monedero solo tiene ${fmtMoney(bal)}`, 'error'); return; }
            w.movements.push({ id: uid('wm'), date, concept, amount, type: isOut ? 'out' : 'in' });
            saveData();
            toast(isOut ? 'Gasto registrado en el monedero' : 'Ingreso registrado en el monedero');
            openWalletDetailModal(w.id);
        };
    }

    function openWalletTransferModal(fromW) {
        const others = data.wallets.filter(x => x.id !== fromW.id);
        if (!others.length) { toast('No hay otro monedero al que transferir', 'error'); return; }
        const bal = walletBalance(fromW);
        const body = openModal(
            `<span class="dv2-badge" style="background:${fromW.color}">${fromW.emoji}</span> Transferir desde «${escapeHtml(fromW.name)}»`,
            fromW.color,
            `
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">Disponible en el monedero: <strong>${fmtMoney(bal)}</strong></div>
            ${f('wt1', 'Monedero destino', sel('dv2WTTo', others.map(x => ({ v: x.id, l: `${x.emoji} ${x.name}` })), others[0].id))}
            ${f('wt2', 'Importe (€)', inp('dv2WTAmt', { type: 'number', step: '0.01', min: '0', max: bal }))}
            ${f('wt3', 'Nota', inp('dv2WTNote', { placeholder: 'Ej. Redistribución de octubre' }))}`,
            `<button class="btn btn-secondary" id="dv2WTCancel">Cancelar</button><button class="btn btn-primary" id="dv2WTSave"><i class="fas fa-right-left"></i> Transferir</button>`
        );
        body.parentElement.querySelector('#dv2WTCancel').onclick = () => openWalletDetailModal(fromW.id);
        body.parentElement.querySelector('#dv2WTSave').onclick = () => {
            const toId = body.querySelector('#dv2WTTo').value;
            const amt = round2(parseFloat(body.querySelector('#dv2WTAmt').value));
            const note = body.querySelector('#dv2WTNote').value.trim() || 'Transferencia entre monederos';
            if (isNaN(amt) || amt <= 0) { toast('Importe no válido', 'error'); return; }
            if (amt > bal) { toast('No hay suficiente saldo en el monedero origen', 'error'); return; }
            const to = data.wallets.find(x => x.id === toId); if (!to) return;
            fromW.movements.push({ id: uid('wm'), date: TODAY_ISO, concept: `→ ${to.name}: ${note}`, amount: amt, type: 'out' });
            to.movements.push({ id: uid('wm'), date: TODAY_ISO, concept: `← ${fromW.name}: ${note}`, amount: amt, type: 'in' });
            saveData();
            toast(`Transferidos ${fmtMoney(amt)} a ${to.name}`);
            openWalletDetailModal(fromW.id);
        };
    }

    // ---------- Deudas ----------
    function openDebtModal(editId) {
        const d = editId ? data.debts.find(x => x.id === editId) : null;
        let kind = d ? d.kind : 'pay';
        const body = openModal(
            `<span class="dv2-badge" style="background:${kind === 'pay' ? '#ef4444' : '#0ea5e9'}">${d ? d.emoji : '🔄'}</span> ${d ? 'Editar deuda' : 'Nueva deuda / devolución'}`,
            '#ef4444',
            `
            <div class="dv2-field"><label>Tipo</label>
                <div class="dv2-seg" id="dv2DKind" style="--dv2-accent:#ef4444">
                    <button type="button" data-kind="pay" class="${kind === 'pay' ? 'sel' : ''}">Dinero a devolver</button>
                    <button type="button" data-kind="receive" class="${kind === 'receive' ? 'sel' : ''}">Dinero a cobrar</button>
                </div>
            </div>
            ${f('fd1', 'Icono', emojiPicker('dv2DEmoji', d ? d.emoji : '💇'))}
            ${f('fd2', 'Nombre / concepto', inp('dv2DName', { value: d ? d.name : '', placeholder: 'Ej. Adelanto a la familia' }))}
            <div class="dv2-row2">
                ${f('fd3', 'Importe total (€)', inp('dv2DAmt', { type: 'number', step: '0.01', min: '0', value: d ? d.total : '' }))}
                ${f('fd4', 'Fecha estimada (opcional)', inp('dv2DDue', { type: 'date', value: d ? d.dueDate || '' : '' }))}
            </div>
            ${f('fd5', 'Contraparte (opcional)', inp('fv6', { value: d ? d.counterparty || '' : '', placeholder: 'Ej. Hermano, Marta…' }))}
            ${f('fd7', 'Nota', inp('dv2DNote', { value: d ? d.note || '' : '' }))}`,
            `${d ? '<button class="dv2-danger-link" id="dv2DDel">Eliminar</button>' : ''}<button class="btn btn-secondary" id="dv2DCancel">Cancelar</button><button class="btn btn-primary" id="dv2DSave"><i class="fas fa-save"></i> Guardar</button>`
        );
        bindEmojiPicker(body);
        const seg = body.querySelector('#dv2DKind');
        seg.addEventListener('click', (e) => {
            const b = e.target.closest('[data-kind]');
            if (!b) return;
            kind = b.dataset.kind;
            seg.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
        });
        body.parentElement.querySelector('#dv2DCancel').onclick = closeModal;
        body.parentElement.querySelector('#dv2DSave').onclick = () => {
            const name = body.querySelector('#dv2DName').value.trim();
            const total = round2(parseFloat(body.querySelector('#dv2DAmt').value));
            if (!name || isNaN(total) || total <= 0) { toast('Nombre e importe válidos requeridos', 'error'); return; }
            const obj = {
                id: d ? d.id : uid('d'), kind, emoji: pickedEmoji(body), name, total,
                returned: d ? d.returned : 0,
                dueDate: body.querySelector('#dv2DDue').value || '',
                counterparty: body.querySelector('#fv6').value.trim(),
                note: body.querySelector('#dv2DNote').value.trim(),
                history: d ? d.history : []
            };
            if (d) Object.assign(d, obj); else data.debts.push(obj);
            saveData(); closeModal(); renderAll(); toast(d ? 'Deuda actualizada' : 'Deuda registrada');
        };
        if (d) body.parentElement.querySelector('#dv2DDel').onclick = () => confirmDelete(`¿Eliminar «${d.name}»?`, () => {
            data.debts = data.debts.filter(x => x.id !== d.id);
            saveData(); closeModal(); renderAll();
        });
    }

    function openDebtPaymentModal(debtId) {
        const d = data.debts.find(x => x.id === debtId);
        if (!d) return;
        const remaining = Math.max(0, d.total - d.returned);
        const body = openModal(
            `<span class="dv2-badge" style="background:#ef4444">${d.emoji}</span> Devolver «${escapeHtml(d.name)}»`,
            '#ef4444',
            `
            <div style="font-size:12.5px;color:var(--text-secondary)">Total: <strong>${fmtMoney(d.total)}</strong> · Ya cubierto: <strong>${fmtMoney(d.returned)}</strong> · <span style="color:var(--danger)">Restante: <strong>${fmtMoney(remaining)}</strong></span></div>
            <div class="dv2-seg" id="dv2DPMode" style="--dv2-accent:#ef4444;width:max-content">
                <button type="button" data-mode="partial" class="sel">Parcial</button>
                <button type="button" data-mode="full">Total (${fmtMoney(remaining)})</button>
            </div>
            ${f('fp1', 'Importe a registrar (€)', inp('dv2DPAmt', { type: 'number', step: '0.01', min: '0', value: remaining }))}
            ${f('fp2', 'Fecha', inp('dv2DPDate', { type: 'date', value: TODAY_ISO }))}
            ${f('fp3', 'Nota', inp('dv2DPNote', { placeholder: 'Ej. Ingreso en MyInvestor' }))}`,
            `<button class="btn btn-secondary" id="dv2DPCancel">Cancelar</button><button class="btn btn-primary" id="dv2DPSave"><i class="fas fa-check"></i> Confirmar devolución</button>`
        );
        let mode = 'partial';
        const amtInput = body.querySelector('#dv2DPAmt');
        body.querySelector('#dv2DPMode').addEventListener('click', (e) => {
            const b = e.target.closest('[data-mode]'); if (!b) return;
            mode = b.dataset.mode;
            body.querySelectorAll('#dv2DPMode button').forEach(x => x.classList.toggle('sel', x === b));
            amtInput.value = mode === 'full' ? remaining : '';
        });
        body.parentElement.querySelector('#dv2DPCancel').onclick = closeModal;
        body.parentElement.querySelector('#dv2DPSave').onclick = () => {
            const amt = round2(parseFloat(amtInput.value));
            if (isNaN(amt) || amt <= 0) { toast('Importe no válido', 'error'); return; }
            const capped = Math.min(amt, remaining);
            d.returned = round2(d.returned + capped);
            d.history.push({ id: uid('dh'), date: body.querySelector('#dv2DPDate').value || TODAY_ISO, amount: capped, note: body.querySelector('#dv2DPNote').value.trim() });
            saveData(); closeModal(); renderAll();
            toast(d.returned >= d.total ? `«${d.name}» completada ✅` : `Devolución parcial registrada`);
        };
    }

    // ---------- Préstamos ----------
    function openLoanModal(editId) {
        const l = editId ? data.loans.find(x => x.id === editId) : null;
        const body = openModal(
            `<span class="dv2-badge" style="background:#8b5cf6">${l ? l.emoji : '🏦'}</span> ${l ? 'Editar préstamo' : 'Nuevo préstamo / financiación'}`,
            '#8b5cf6',
            `
            ${f('fl0', 'Icono', emojiPicker('dv2LEmoji', l ? l.emoji : '🛋️'))}
            ${f('fl1', 'Nombre', inp('dv2LName', { value: l ? l.name : '', placeholder: 'Ej. Financiación Sofá' }))}
            <div class="dv2-row2">
                ${f('fl2', 'Importe financiado (€)', inp('dv2LAmt', { type: 'number', step: '0.01', min: '0', value: l ? l.financed : '' }))}
                ${f('fl3', 'Nº total de cuotas', inp('dv2LInst', { type: 'number', min: '1', value: l ? l.installments : '' }))}
            </div>
            <div class="dv2-row2">
                ${f('fl4', 'Importe por cuota (€)', inp('dv2LQi', { type: 'number', step: '0.01', min: '0', value: l ? l.installmentAmount : '' }))}
                ${f('fl5', 'Cuotas ya pagadas', inp('dv2LPaid', { type: 'number', min: '0', value: l ? l.paidCount : 0 }))}
            </div>
            ${f('fl6', 'Próximo recibo', inp('dv2LNext', { type: 'date', value: l ? l.nextDate || '' : TODAY_ISO }))}
            ${f('fl7', 'Cuenta asociada', sel('dv2LAcc', data.accounts.map(a => ({ v: a.name, l: `${a.icon} ${a.name}` })), l ? l.accountName : (data.accounts[0] || {}).name))}`,
            `${l ? '<button class="dv2-danger-link" id="dv2LDel">Eliminar</button>' : ''}<button class="btn btn-secondary" id="dv2LCancel">Cancelar</button><button class="btn btn-primary" id="dv2LSave"><i class="fas fa-save"></i> Guardar</button>`
        );
        bindEmojiPicker(body);
        // Auto-cálculo: importe por cuota = financiado / cuotas
        const auto = () => {
            const tot = parseFloat(body.querySelector('#dv2LAmt').value);
            const n = parseInt(body.querySelector('#dv2LInst').value);
            if (tot > 0 && n > 0) body.querySelector('#dv2LQi').value = round2(tot / n);
        };
        body.querySelector('#dv2LAmt').addEventListener('input', auto);
        body.querySelector('#dv2LInst').addEventListener('input', auto);

        body.parentElement.querySelector('#dv2LCancel').onclick = closeModal;
        body.parentElement.querySelector('#dv2LSave').onclick = () => {
            const name = body.querySelector('#dv2LName').value.trim();
            const financed = round2(parseFloat(body.querySelector('#dv2LAmt').value));
            const installments = parseInt(body.querySelector('#dv2LInst').value);
            const installmentAmount = round2(parseFloat(body.querySelector('#dv2LQi').value));
            const paidCount = Math.max(0, parseInt(body.querySelector('#dv2LPaid').value) || 0);
            if (!name || isNaN(financed) || isNaN(installments) || isNaN(installmentAmount) || installments <= 0) { toast('Revisa los datos del préstamo', 'error'); return; }
            const obj = {
                id: l ? l.id : uid('l'), emoji: pickedEmoji(body), name, financed, installments,
                installmentAmount, paidCount: Math.min(paidCount, installments),
                nextDate: body.querySelector('#dv2LNext').value || null,
                accountName: body.querySelector('#dv2LAcc').value,
                payments: l ? l.payments : []
            };
            if (l) Object.assign(l, obj); else data.loans.push(obj);
            saveData(); closeModal(); renderAll(); toast(l ? 'Préstamo actualizado' : 'Préstamo creado');
        };
        if (l) body.parentElement.querySelector('#dv2LDel').onclick = () => confirmDelete(`¿Eliminar el préstamo «${l.name}»?`, () => {
            data.loans = data.loans.filter(x => x.id !== l.id);
            saveData(); closeModal(); renderAll();
        });
    }

    // ---------- Objetivos ----------
    function openGoalModal(editId) {
        const g = editId ? data.goals.find(x => x.id === editId) : null;
        const freqs = [{ v: 'none', l: 'Sin aportación programada' }, { v: 'weekly', l: 'Semanal' }, { v: 'biweekly', l: 'Quincenal' }, { v: 'monthly', l: 'Mensual' }];
        const body = openModal(
            `<span class="dv2-badge" style="background:#10b981">${g ? g.emoji : '🎯'}</span> ${g ? 'Editar objetivo' : 'Nuevo objetivo de ahorro'}`,
            '#10b981',
            `
            ${f('fg0', 'Icono', emojiPicker('dv2GEmoji', g ? g.emoji : '🎯'))}
            ${f('fg1', 'Nombre', inp('dv2GName', { value: g ? g.name : '', placeholder: 'Ej. Viaje Japón' }))}
            <div class="dv2-row2">
                ${f('fg2', 'Cantidad objetivo (€)', inp('dv2GTarget', { type: 'number', step: '0.01', min: '0', value: g && g.target != null ? g.target : '', placeholder: 'Vacío = sin meta' }))}
                ${f('fg3', 'Ahorrado actualmente (€)', inp('dv2GSaved', { type: 'number', step: '0.01', min: '0', value: g ? g.saved : 0 }))}
            </div>
            <div class="dv2-row2">
                ${f('fg4', 'Frecuencia de aportación', sel('dv2GFreq', freqs, g ? g.frequency : 'monthly'))}
                ${f('fg5', 'Importe por aportación (€)', inp('dv2GContrib', { type: 'number', step: '0.01', min: '0', value: g ? g.contribution : '' }))}
            </div>
            ${f('fg6', 'Próxima aportación programada', inp('dv2GNext', { type: 'date', value: g ? g.nextDate || '' : TODAY_ISO }))}`,
            `${g ? '<button class="dv2-danger-link" id="dv2GDel">Eliminar</button>' : ''}<button class="btn btn-secondary" id="dv2GCancel">Cancelar</button><button class="btn btn-primary" id="dv2GSave"><i class="fas fa-save"></i> Guardar</button>`
        );
        bindEmojiPicker(body);
        body.parentElement.querySelector('#dv2GCancel').onclick = closeModal;
        body.parentElement.querySelector('#dv2GSave').onclick = () => {
            const name = body.querySelector('#dv2GName').value.trim();
            if (!name) { toast('El objetivo necesita un nombre', 'error'); return; }
            const targetRaw = body.querySelector('#dv2GTarget').value;
            const obj = {
                id: g ? g.id : uid('g'), emoji: pickedEmoji(body), name,
                target: targetRaw === '' ? null : round2(parseFloat(targetRaw)),
                saved: round2(parseFloat(body.querySelector('#dv2GSaved').value) || 0),
                frequency: body.querySelector('#dv2GFreq').value,
                contribution: round2(parseFloat(body.querySelector('#dv2GContrib').value) || 0),
                nextDate: body.querySelector('#dv2GNext').value || '',
                contributions: g ? g.contributions : []
            };
            if (g) Object.assign(g, obj); else data.goals.push(obj);
            saveData(); closeModal(); renderAll(); toast(g ? 'Objetivo actualizado' : 'Objetivo creado');
        };
        if (g) body.parentElement.querySelector('#dv2GDel').onclick = () => confirmDelete(`¿Eliminar el objetivo «${g.name}»?`, () => {
            data.goals = data.goals.filter(x => x.id !== g.id);
            saveData(); closeModal(); renderAll();
        });
    }

    function openContributionModal(goalId) {
        const gn = data.goals.find(x => x.id === goalId);
        if (!gn) return;
        const body = openModal(
            `<span class="dv2-badge" style="background:#10b981">${gn.emoji}</span> Aportar a «${escapeHtml(gn.name)}»`,
            '#10b981',
            `
            <div style="font-size:12.5px;color:var(--text-secondary)">${gn.target != null ? `Ahorrado: <strong>${fmtMoney(gn.saved)}</strong> de ${fmtMoney(gn.target)} · faltan <strong>${fmtMoney(goalRemaining(gn))}</strong>` : `Ahorro libre: <strong>${fmtMoney(gn.saved)}</strong>`}</div>
            <div class="dv2-row2">
                ${f('fc1', 'Importe (€)', inp('dv2GAmt', { type: 'number', step: '0.01', min: '0', value: gn.contribution || '' }))}
                ${f('fc2', 'Fecha', inp('dv2GDate', { type: 'date', value: TODAY_ISO }))}
            </div>
            <div class="dv2-field"><label>Vincular a cuenta (descuenta el Saldo Real)</label>
                ${sel('dv2GAcc', [{ v: '', l: '— Sin efecto en saldo (solo registro) —' }].concat(data.accounts.map(a => ({ v: a.id, l: `${a.icon} ${a.name}` }))), '')}
            </div>`,
            `<button class="btn btn-secondary" id="dv2GACancel">Cancelar</button><button class="btn btn-primary" id="dv2GASave"><i class="fas fa-plus"></i> Registrar aportación</button>`
        );
        body.parentElement.querySelector('#dv2GACancel').onclick = closeModal;
        body.parentElement.querySelector('#dv2GASave').onclick = () => {
            const amt = round2(parseFloat(body.querySelector('#dv2GAmt').value));
            if (isNaN(amt) || amt <= 0) { toast('Importe no válido', 'error'); return; }
            const date = body.querySelector('#dv2GDate').value || TODAY_ISO;
            gn.saved = round2(gn.saved + amt);
            gn.contributions.push({ id: uid('gc'), date, amount: amt });
            if (gn.nextDate && date >= gn.nextDate) {
                const step = gn.frequency === 'weekly' ? 7 : gn.frequency === 'biweekly' ? 14 : 30;
                let nd = gn.nextDate;
                while (nd <= date) nd = addDays(nd, step);
                gn.nextDate = nd;
            }
            const accId = body.querySelector('#dv2GAcc').value;
            if (accId) registerMovement({ date, concept: `Aportación · ${gn.name}`, amount: -amt, type: 'out', accountId: accId, link: { kind: 'goal', id: gn.id } });
            else { saveData(); renderAll(); }
            closeModal(); toast('Aportación registrada');
        };
    }

    // ---------- Pagos recurrentes ----------
    function openRecurringModal(editId) {
        const r = editId ? data.recurring.find(x => x.id === editId) : null;
        const periods = [['weekly', 'Semanal'], ['monthly', 'Mensual'], ['quarterly', 'Trimestral'], ['semiannual', 'Semestral'], ['annual', 'Anual']].map(([v, l]) => ({ v, l }));
        const body = openModal(
            `<span class="dv2-badge" style="background:#0ea5e9">${r ? r.emoji : '🔁'}</span> ${r ? 'Editar pago recurrente' : 'Nuevo pago recurrente'}`,
            '#0ea5e9',
            `
            ${f('fr0', 'Icono', emojiPicker('dv2REmoji', r ? r.emoji : '📄'))}
            ${f('fr1', 'Nombre / servicio', inp('dv2RName', { value: r ? r.name : '', placeholder: 'Ej. Seguro de hogar' }))}
            <div class="dv2-row2">
                ${f('fr2', 'Importe (€)', inp('dv2RAmt', { type: 'number', step: '0.01', min: '0', value: r ? r.amount : '' }))}
                ${f('fr3', 'Periodicidad', sel('dv2RPeriod', periods, r ? r.period : 'monthly'))}
            </div>
            <div class="dv2-row2">
                ${f('fr4', 'Próximo cobro', inp('dv2RNext', { type: 'date', value: r ? r.nextDate || '' : TODAY_ISO }))}
                ${f('fr5', 'Cuenta asociada', sel('dv2RAcc', data.accounts.map(a => ({ v: a.name, l: `${a.icon} ${a.name}` })), r ? r.accountName : (data.accounts[0] || {}).name))}
            </div>
            <div class="dv2-field"><label>Estado</label>
                <div class="dv2-seg" id="dv2RActive" style="--dv2-accent:#0ea5e9">
                    <button type="button" data-active="1" class="${!r || r.active ? 'sel' : ''}">Activo</button>
                    <button type="button" data-active="0" class="${r && !r.active ? 'sel' : ''}">Pausado</button>
                </div>
            </div>`,
            `${r ? '<button class="dv2-danger-link" id="dv2RDel">Eliminar</button>' : ''}<button class="btn btn-secondary" id="dv2RCancel">Cancelar</button><button class="btn btn-primary" id="dv2RSave"><i class="fas fa-save"></i> Guardar</button>`
        );
        bindEmojiPicker(body);
        let active = r ? r.active : true;
        body.querySelector('#dv2RActive').addEventListener('click', (e) => {
            const b = e.target.closest('[data-active]'); if (!b) return;
            active = b.dataset.active === '1';
            body.querySelectorAll('#dv2RActive button').forEach(x => x.classList.toggle('sel', x === b));
        });
        body.parentElement.querySelector('#dv2RCancel').onclick = closeModal;
        body.parentElement.querySelector('#dv2RSave').onclick = () => {
            const name = body.querySelector('#dv2RName').value.trim();
            const amount = round2(parseFloat(body.querySelector('#dv2RAmt').value));
            if (!name || isNaN(amount) || amount <= 0) { toast('Nombre e importe válidos requeridos', 'error'); return; }
            const obj = {
                id: r ? r.id : uid('r'), emoji: pickedEmoji(body), name, amount,
                period: body.querySelector('#dv2RPeriod').value,
                nextDate: body.querySelector('#dv2RNext').value || null,
                accountName: body.querySelector('#dv2RAcc').value,
                active, history: r ? r.history : []
            };
            if (r) Object.assign(r, obj); else data.recurring.push(obj);
            saveData(); closeModal(); renderAll(); toast(r ? 'Pago actualizado' : 'Pago recurrente creado');
        };
        if (r) body.parentElement.querySelector('#dv2RDel').onclick = () => confirmDelete(`¿Eliminar «${r.name}»?`, () => {
            data.recurring = data.recurring.filter(x => x.id !== r.id);
            saveData(); closeModal(); renderAll();
        });
    }

    // ---------- Movimientos (historial) ----------
    function openMovementModal() {
        const types = [['out', 'Salida (gasto)'], ['in', 'Entrada (ingreso)'], ['transfer-out', 'Transferencia interna (salida)'], ['transfer-in', 'Transferencia interna (entrada)']].map(([v, l]) => ({ v, l }));
        const linkOpts = [
            { v: '', l: '— Sin vinculación —' },
            { v: '__w', l: '▸ Monederos' },
            ...data.wallets.map(w => ({ v: 'wallet:' + w.id, l: `   ${w.emoji} ${w.name}` })),
            { v: '__g', l: '▸ Objetivos' },
            ...data.goals.map(g => ({ v: 'goal:' + g.id, l: `   ${g.emoji} ${g.name}` })),
            { v: '__l', l: '▸ Préstamos' },
            ...data.loans.map(l => ({ v: 'loan:' + l.id, l: `   ${l.emoji} ${l.name}` })),
            { v: '__d', l: '▸ Deudas' },
            ...data.debts.filter(d => debtStatus(d) !== 'done').map(d => ({ v: 'debt:' + d.id, l: `   ${d.emoji} ${d.name}` }))
        ];
        const fxNote = () => `<div id="dv2Mfx" style="font-size:11.5px;color:var(--text-muted);margin-top:-6px">💱 1 USD ≈ ${eurUsdRate.toFixed(4)} EUR${fxUpdatedAt ? ' · actualizado ' + fmtDate(fxUpdatedAt) : ' (valor de referencia)'}</div>`;
        const body = openModal(
            '<span class="dv2-badge" style="background:#64748b">↕️</span> Nuevo movimiento',
            '#64748b',
            `
            ${f('fm1', 'Concepto', inp('dv2MConcept', { placeholder: 'Ej. Compra semanal' }))}
            <div class="dv2-row2">
                ${f('fm2', 'Importe', inp('dv2MAmt', { type: 'number', step: '0.01', min: '0' }))}
                ${f('fm2b', 'Divisa', sel('dv2MCur', [{ v: 'EUR', l: '€ Euro' }, { v: 'USD', l: '$ Dólar (EE. UU.)' }], 'EUR'))}
            </div>
            ${fxNote()}
            <div class="dv2-row2">
                ${f('fm3', 'Fecha', inp('dv2MDate', { type: 'date', value: TODAY_ISO }))}
                ${f('fm4', 'Tipo', sel('dv2MType', types, 'out'))}
            </div>
            ${f('fm5', 'Cuenta', sel('dv2MAcc', data.accounts.map(a => ({ v: a.id, l: `${a.icon} ${a.name}` })), (data.accounts[0] || {}).id))}
            ${f('fm6', 'Vincular a (opcional)', sel('dv2MLink', linkOpts, ''))}`,
            `<button class="btn btn-secondary" id="dv2MCancel">Cancelar</button><button class="btn btn-primary" id="dv2MSave"><i class="fas fa-plus"></i> Registrar</button>`
        );
        // Al elegir USD se muestra la conversión automática con el cambio actual
        body.querySelector('#dv2MCur').addEventListener('change', () => updateFxHint(body));
        body.querySelector('#dv2MAmt').addEventListener('input', () => updateFxHint(body));
        body.parentElement.querySelector('#dv2MCancel').onclick = closeModal;
        body.parentElement.querySelector('#dv2MSave').onclick = () => {
            const concept = body.querySelector('#dv2MConcept').value.trim();
            const rawAmount = round2(parseFloat(body.querySelector('#dv2MAmt').value));
            const type = body.querySelector('#dv2MType').value;
            const currency = body.querySelector('#dv2MCur').value;
            if (!concept || isNaN(rawAmount) || rawAmount <= 0) { toast('Concepto e importe válidos requeridos', 'error'); return; }
            // El núcleo financiero trabaja en EUR: los USD se convierten con el cambio vivo
            const amount = currency === 'USD' ? round2(rawAmount / eurUsdRate) : rawAmount;
            const signed = type === 'in' || type === 'transfer-in' ? amount : -amount;
            const linkVal = body.querySelector('#dv2MLink').value;
            let link = null;
            if (linkVal && linkVal.includes(':')) {
                const [kind, id] = linkVal.split(':');
                link = { kind, id };
                // Sincronizar entidad vinculada
                if (kind === 'wallet') {
                    const w = data.wallets.find(x => x.id === id);
                    if (w) w.movements.push({ id: uid('wm'), date: body.querySelector('#dv2MDate').value, concept, amount, type: type === 'in' || type === 'transfer-in' ? 'in' : 'out' });
                } else if (kind === 'goal') {
                    const g = data.goals.find(x => x.id === id);
                    if (g && signed < 0) { g.saved = round2(g.saved + amount); g.contributions.push({ id: uid('gc'), date: body.querySelector('#dv2MDate').value, amount }); }
                }
            }
            registerMovement({ date: body.querySelector('#dv2MDate').value, concept, amount: signed, type, accountId: body.querySelector('#dv2MAcc').value, link, currency });
            closeModal(); toast(currency === 'USD' ? `Movimiento registrado (${fmtAmount(rawAmount, 'USD')} → ${fmtMoney(amount)})` : 'Movimiento registrado');
        };
    }
    function updateFxHint(body) {
        const hint = body.querySelector('#dv2Mfx');
        const cur = body.querySelector('#dv2MCur').value;
        const amt = parseFloat(body.querySelector('#dv2MAmt').value);
        if (cur === 'USD' && !isNaN(amt) && amt > 0) {
            hint.innerHTML = `💱 ${fmtAmount(amt, 'USD')} ≈ <strong>${fmtMoney(round2(amt / eurUsdRate))}</strong> al cambio actual (1 USD = ${eurUsdRate.toFixed(4)} EUR)`;
        } else if (cur === 'USD') {
            hint.innerHTML = `💱 1 USD ≈ ${eurUsdRate.toFixed(4)} EUR · se convertirá automáticamente al registrar`;
        } else {
            hint.innerHTML = `💱 1 USD ≈ ${eurUsdRate.toFixed(4)} EUR${fxUpdatedAt ? ' · actualizado ' + fmtDate(fxUpdatedAt) : ' (valor de referencia)'}`;
        }
    }

    // ---------- Confirmación / Toast ----------
    function confirmDelete(message, onYes) {
        const body = openModal(
            '<span class="dv2-badge" style="background:#ef4444">⚠️</span> Confirmar eliminación',
            '#ef4444',
            `<div style="font-size:13px">${escapeHtml(message)}</div>`,
            `<button class="btn btn-secondary" id="dv2ConfNo">Cancelar</button><button class="btn" id="dv2ConfYes" style="background:var(--danger);color:#fff;border-color:var(--danger)"><i class="fas fa-trash"></i> Eliminar</button>`
        );
        body.parentElement.querySelector('#dv2ConfNo').onclick = closeModal;
        body.parentElement.querySelector('#dv2ConfYes').onclick = () => { closeModal(); onYes(); };
    }
    function toast(msg, type = 'success') {
        if (window.App && App.showToast) App.showToast(msg, type);
    }

    // =========================================================
    // INIT / API
    // =========================================================
    function init() {
        // Cargar el tipo de cambio EUR→USD en vivo al iniciar la sección
        loadFxRate();
    }
    function onThemeChange() { /* CSS variables: hereda el tema automáticamente */ }

    return {
        render, init, onThemeChange,
        // API para otras secciones / futura integración con Google Sheets
        getSavings: () => {
            const byGoal = {};
            data.goals.forEach(g => { byGoal[g.name] = g.saved; });
            return { total: data.goals.reduce((s, g) => s + g.saved, 0), byGoal };
        },
        getRealBalance: realBalance,
        getAvailable: () => ({ now: availableNow(), global: availableGlobal(), horizon: data.settings.horizonDays }),
        resetDemo
    };
})();

// Registrar sección «mi-dinero» con el rediseño v2 (single-page) — API directa
App.registerSection('mi-dinero', DineroApp);

// Publicar API a través del puente de módulos (única fuente: DineroApp)
App.registerModule('mi-dinero', { getSavings: () => DineroApp.getSavings() });

window.DineroApp = DineroApp;
