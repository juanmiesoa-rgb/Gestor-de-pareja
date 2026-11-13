/* =============================================================================
   DINERO.JS · v4.1 — Módulo con versiones mensuales, subcategorías, filtros
   y reinicio mensual de wallets + Troceo de Deudas/Objetivos + Logs
   ============================================================================= */
const DineroApp = (function () {
    'use strict';

    /* =========================================================
       UTILIDADES DE FECHA
       ========================================================= */
    function todayISO() { return new Date().toISOString().slice(0, 10); }
    function currentMonthKey() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }
    function addDays(iso, n) {
        const d = new Date((iso || todayISO()) + 'T00:00:00');
        d.setDate(d.getDate() + n);
        return toISO(d);
    }
    function toISO(d) {
        const p = x => String(x).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }
    function daysFromToday(iso) {
        if (!iso) return Infinity;
        const a = new Date(todayISO() + 'T00:00:00');
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
    function fmtAmount(n, currency) {
        const cur = currency === 'USD' ? 'USD' : 'EUR';
        return new Intl.NumberFormat(cur === 'USD' ? 'en-US' : 'es-ES', { style: 'currency', currency: cur }).format(n == null ? 0 : n);
    }
    function fmtMonth(mk) {
        if (!mk) return '';
        const [y, m] = String(mk).split('-').map(Number);
        if (!y || !m) return mk;
        const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        return months[m - 1] + ' ' + y;
    }
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function uid(prefix) {
        return prefix + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e4).toString(36);
    }
    function round2(n) { return Math.round(n * 100) / 100; }
    function addMonths(iso, n) {
        const d = new Date(iso + 'T00:00:00');
        d.setMonth(d.getMonth() + n);
        return toISO(d);
    }

    /* Icono: emoji o URL */
    function renderIcon(value, size) {
        if (value == null || value === '') return '';
        const s = String(value).trim();
        const sz = size || 16;
        if (/^(https?:|data:|\/)/.test(s)) {
            return `<img src="${escapeHtml(s)}" alt="" style="width:${sz}px;height:${sz}px;object-fit:contain;vertical-align:middle;border-radius:4px;display:inline-block">`;
        }
        return escapeHtml(s);
    }

    /* =========================================================
       DATOS POR DEFECTO
       ========================================================= */
    const FALLBACK_EUR_USD = 1.16;
    const DEFAULT_MOCK = {
        version: 2,
        settings: { horizonDays: 7 },
        lastWalletResetMonth: '',
        commitments: [],
        wallets: [],
        debts: [],
        loans: [],
        goals: [
            {
                id: 'g-trip-fund', emoji: '✈️', name: 'Fondo Viajes',
                target: 0, saved: 0, frequency: 'none', contribution: 0, nextDate: '',
                contributions: [],
                includeInBudget: false, budgetAmount: 0, versions: {}, subcategories: [], plannedSplits: []
            }
        ],
        recurring: [],
        movements: []
    };

    /* =========================================================
       ESTADO Y PERSISTENCIA
       ========================================================= */
    const clone = o => JSON.parse(JSON.stringify(o));

    function loadData() {
        const parsed = App.loadStored('finanzas_dinero_v2', DEFAULT_MOCK) || {};
        if (!parsed.version) parsed.version = 2;
        if (!parsed.settings) parsed.settings = { horizonDays: 7 };
        if (!parsed.lastWalletResetMonth) parsed.lastWalletResetMonth = '';

        ['commitments','wallets','debts','loans','goals','recurring','movements'].forEach(k => {
            if (!Array.isArray(parsed[k])) parsed[k] = [];
        });

        /* Asegurar versiones y subcategorías en todos los items */
        ['wallets','debts','loans','goals','recurring'].forEach(k => {
            (parsed[k] || []).forEach(item => {
                if (!item.versions || typeof item.versions !== 'object') item.versions = {};
                if (!Array.isArray(item.subcategories)) item.subcategories = [];
                if (!Array.isArray(item.plannedSplits)) item.plannedSplits = [];
                if (typeof item.includeInBudget !== 'boolean') item.includeInBudget = false;
                if (typeof item.budgetAmount !== 'number') item.budgetAmount = 0;
                /* Subcategorías: asegurar versions */
                item.subcategories.forEach(sub => {
                    if (!sub.versions || typeof sub.versions !== 'object') sub.versions = {};
                    if (typeof sub.budgetAmount !== 'number') sub.budgetAmount = 0;
                    if (typeof sub.includeInBudget !== 'boolean') sub.includeInBudget = true;
                });
            });
        });

        if (!parsed.goals.find(g => g.id === 'g-trip-fund')) {
            const src = DEFAULT_MOCK.goals.find(g => g.id === 'g-trip-fund');
            if (src) parsed.goals.unshift(clone(src));
        }

        if ('accounts' in parsed) {
            delete parsed.accounts;
            try { localStorage.setItem('finanzas_dinero_v2', JSON.stringify(parsed)); } catch (e) {}
        }
        return parsed;
    }
    function saveData() { App.saveStored('finanzas_dinero_v2', data); }

    let data = loadData();
    let containerEl = null;
    const expanded = { loans: new Set(), goals: new Set(), recurring: new Set(), wallets: new Set(), debts: new Set() };

    function getAccounts() {
        if (!App.data.accounts) App.data.accounts = [];
        return App.data.accounts;
    }

    /* =========================================================
       FILTROS DE VISTA
       ========================================================= */
    const viewFilters = {
        loanStatus: 'active',
        debtStatus: 'pending',
        recurringStatus: 'active',
        goalStatus: 'dateActive',
        accountId: 'all',
        budgetStatus: 'all',
        expandedSubcats: new Set()
    };

    function passesBudgetFilter(item) {
        if (viewFilters.budgetStatus === 'all') return true;
        if (viewFilters.budgetStatus === 'included') return item.includeInBudget === true;
        if (viewFilters.budgetStatus === 'excluded') return item.includeInBudget !== true;
        return true;
    }
    function passesAccountFilter(item) {
        if (viewFilters.accountId === 'all') return true;
        if (item.accountId === viewFilters.accountId) return true;
        if (item.accountName) {
            const acc = getAccounts().find(a => a.id === viewFilters.accountId);
            if (acc && String(acc.name).toLowerCase() === String(item.accountName).toLowerCase()) return true;
        }
        return false;
    }
    function passesAllFilters(item) {
        return passesBudgetFilter(item) && passesAccountFilter(item);
    }

    function goalIsDateActive(g) {
        if (g.target != null && g.target > 0 && g.saved >= g.target) return false;
        return !!(g.nextDate && g.frequency !== 'none');
    }
    function goalMatchesFilter(g) {
        if (!passesAllFilters(g)) return false;
        const done = g.target != null && g.target > 0 && g.saved >= g.target;
        if (viewFilters.goalStatus === 'dateActive') return goalIsDateActive(g);
        if (viewFilters.goalStatus === 'done') return done;
        return true;
    }
    function recurringMatchesFilter(r) {
        if (!passesAllFilters(r)) return false;
        if (viewFilters.recurringStatus === 'active') return !!r.active;
        if (viewFilters.recurringStatus === 'paused') return !r.active;
        return true;
    }

    /* =========================================================
       TIPO DE CAMBIO
       ========================================================= */
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
                .catch(() => {});
        } catch (e) {}
    }

    /* =========================================================
       VERSIONES MENSUALES
       ========================================================= */
    function getEffectiveVersion(item, mk) {
        mk = mk || currentMonthKey();
        if (!item.versions) item.versions = {};
        if (item.versions[mk]) return item.versions[mk];
        const past = Object.keys(item.versions).filter(m => m < mk).sort().reverse();
        if (past.length) return item.versions[past[0]];
        return {
            budgetAmount: Number(item.budgetAmount || 0),
            subcategories: (item.subcategories || []).map(sub => ({
                id: sub.id, name: sub.name, icon: sub.icon, budgetAmount: Number(sub.budgetAmount || 0)
            }))
        };
    }

    function getEffectiveAmount(item, mk) {
        const v = getEffectiveVersion(item, mk);
        return Number(v.budgetAmount || 0);
    }

    function setVersionBudget(item, mk, amount) {
        if (!item.versions) item.versions = {};
        if (!item.versions[mk]) item.versions[mk] = {};
        item.versions[mk].budgetAmount = round2(Number(amount) || 0);
        if (mk === currentMonthKey()) item.budgetAmount = item.versions[mk].budgetAmount;
    }

    function recalcParentBudget(item) {
        const includedSubs = (item.subcategories || []).filter(s => s.includeInBudget);
        if (includedSubs.length === 0) return;
        const mk = currentMonthKey();
        let sum = 0;
        includedSubs.forEach(sub => {
            const v = getEffectiveVersion(sub, mk);
            sum += Number(v.budgetAmount || 0);
        });
        setVersionBudget(item, mk, sum);
    }

    /* =========================================================
       CÁLCULOS FINANCIEROS
       ========================================================= */
    function realBalance(accountId) {
        if (accountId && accountId !== 'all') {
            const acc = getAccounts().find(a => a.id === accountId);
            return Number(acc ? acc.balance : 0) || 0;
        }
        return getAccounts().reduce((s, a) => s + (Number(a.balance) || 0), 0);
    }
    function pendingCommitments() {
        const list = [];
        const today = new Date().toISOString().slice(0, 10);
        data.commitments.filter(c => !c.executed).forEach(c => list.push({ ...c, source: 'commitment' }));
        data.debts.filter(d => d.returned < d.total && d.includeInBudget !== false).forEach(d =>
            list.push({ id: d.id, name: d.name, amount: d.total - d.returned, dueDate: d.dueDate || '2099-12-31', source: 'debt' })
        );
        data.loans.filter(l => l.paidCount < l.installments).forEach(l =>
            list.push({ id: l.id, name: 'Cuota ' + l.name, amount: l.installmentAmount, dueDate: l.nextDate || '2099-12-31', source: 'loan' })
        );
        data.recurring.filter(r => r.active).forEach(r =>
            list.push({ id: r.id, name: r.name, amount: r.amount, dueDate: r.nextDate || '2099-12-31', source: 'recurring' })
        );
        data.goals.filter(g => g.nextDate && g.frequency !== 'none').forEach(g =>
            list.push({ id: g.id, name: 'Ahorro ' + g.name, amount: g.contribution, dueDate: g.nextDate, source: 'goal' })
        );
        (App.data.expenses || []).filter(e => (e.status === 'previsto' || e.status === 'pendiente') && e.date >= today).forEach(e =>
            list.push({ id: e.id, name: e.concept, amount: e.amount, dueDate: e.date, source: 'budget' })
        );
        return list;
    }
    function commitmentsWithin(days) {
        return pendingCommitments().filter(c => {
            const d = daysFromToday(c.dueDate);
            return d >= 0 && d <= days;
        });
    }
    function availableNow(accountId) {
        let commitments = commitmentsWithin(data.settings.horizonDays);
        if (accountId && accountId !== 'all') {
            commitments = commitments.filter(c => c.accountId === accountId || (c.source === 'commitment' && c.accountId === accountId));
        }
        return realBalance(accountId) - commitments.reduce((s, c) => s + c.amount, 0);
    }
    function availableGlobal(accountId) {
        let commitments = pendingCommitments();
        if (accountId && accountId !== 'all') {
            commitments = commitments.filter(c => c.accountId === accountId);
        }
        return realBalance(accountId) - commitments.reduce((s, c) => s + c.amount, 0);
    }
    function walletBalance(w) {
        return w.movements.reduce((s, m) => s + (m.type === 'out' ? -m.amount : m.amount), 0);
    }
    function debtStatus(d) {
        if (d.returned >= d.total) return 'done';
        if (d.returned > 0) return 'partial';
        return 'pending';
    }
    function loanPending(l) { return (l.installments - l.paidCount) * l.installmentAmount; }
    function goalRemaining(g) { return g.target == null ? null : Math.max(0, g.target - g.saved); }
    function goalFinishDate(g) {
        if (g.target == null || !g.contribution || g.frequency === 'none') return null;
        const remaining = goalRemaining(g);
        if (remaining <= 0) return '¡Objetivo alcanzado! 🎉';
        const stepsPerMonth = g.frequency === 'weekly' ? 4.33 : g.frequency === 'biweekly' ? 2 : 1;
        const months = Math.ceil(remaining / (g.contribution * stepsPerMonth));
        return fmtDate(addMonths(g.nextDate || todayISO(), months - 1));
    }
    function periodLabel(p) {
        return { weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual', quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual' }[p] || p;
    }
    function walletSpentThisMonth(w) {
        const mk = currentMonthKey();
        return (w.movements || []).filter(m => m.type === 'out' && String(m.date || '').startsWith(mk)).reduce((s, m) => s + Number(m.amount || 0), 0);
    }

    const SECTION_COLORS = { summary: '#2563eb', wallets: '#f59e0b', debts: '#ef4444', loans: '#8b5cf6', goals: '#10b981', recurring: '#0ea5e9', history: '#64748b' };

    /* =========================================================
       CSS (Sin cambios)
       ========================================================= */
    function moduleCSS() { return `
        .dv2-wrap { display: grid; grid-template-columns: minmax(0, 68fr) minmax(0, 32fr); gap: 22px; align-items: start; }
        @media (max-width: 1100px) { .dv2-wrap { grid-template-columns: 1fr; } }
        .dv2-col-left { display: flex; flex-direction: column; gap: 26px; min-width: 0; }
        .dv2-col-right { position: sticky; top: 14px; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
        @media (max-width: 1100px) { .dv2-col-right { position: static; } }
        .dv2-section { min-width: 0; }
        .dv2-section-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; padding: 10px 14px; border-radius: 12px; background: color-mix(in srgb, var(--dv2-accent, var(--primary)) 16%, var(--bg-card)); border: 1px solid color-mix(in srgb, var(--dv2-accent, var(--primary)) 35%, transparent); box-shadow: inset 4px 0 0 var(--dv2-accent, var(--primary)); }
        .dv2-section-title { display: inline-flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 800; letter-spacing: .2px; color: var(--dv2-accent, var(--text)); }
        .dv2-badge { width: 30px; height: 30px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; color: #fff; background: var(--dv2-accent, var(--primary)); box-shadow: 0 2px 6px color-mix(in srgb, var(--dv2-accent, var(--primary)) 40%, transparent); }
        .dv2-section-sub { font-size: 11.5px; color: var(--text-muted); font-weight: 500; }
        .dv2-add-btn { border: 1.5px dashed var(--dv2-accent, var(--primary)); color: var(--dv2-accent, var(--primary)); background: var(--bg-card); border-radius: 9px; padding: 7px 12px; font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 6px; transition: all .15s; white-space: nowrap; }
        .dv2-add-btn:hover { background: color-mix(in srgb, var(--dv2-accent, var(--primary)) 12%, transparent); }
        .dv2-filter-chips { display: inline-flex; gap: 6px; align-items: center; }
        .dv2-fchip { border: 1px solid color-mix(in srgb, var(--dv2-accent, var(--primary)) 40%, transparent); background: var(--bg-card); color: var(--text-secondary); border-radius: 999px; padding: 5px 12px; font-size: 11.5px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all .15s; }
        .dv2-fchip.sel { background: var(--dv2-accent, var(--primary)); color: #fff; border-color: var(--dv2-accent, var(--primary)); }
        .dv2-global-filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; margin-bottom: 16px; }
        .dv2-global-filters-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--text-muted); }
        .dv2-filter-pill { border: 1px solid var(--border); background: var(--bg); color: var(--text-secondary); border-radius: 999px; padding: 7px 14px; font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all .15s; display: inline-flex; align-items: center; gap: 6px; }
        .dv2-filter-pill.sel { background: var(--primary); color: #fff; border-color: var(--primary); }
        .dv2-filter-pill:hover:not(.sel) { border-color: var(--primary); color: var(--primary); }
        .dv2-active-account-banner { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: color-mix(in srgb, var(--primary) 10%, var(--bg-card)); border: 1px solid color-mix(in srgb, var(--primary) 35%, transparent); border-radius: 12px; font-size: 13px; margin-bottom: 16px; }
        .dv2-active-account-banner strong { color: var(--primary); }
        .dv2-active-account-banner button { margin-left: auto; background: var(--primary); color: #fff; border: none; border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 700; cursor: pointer; }
        .dv2-kpi-accounts { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border); }
        .dv2-kpi-acc { display: flex; justify-content: space-between; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 6px; font-size: 11.5px; cursor: pointer; transition: background .12s; }
        .dv2-kpi-acc:hover { background: var(--bg); }
        .dv2-kpi-acc.sel { background: color-mix(in srgb, var(--primary) 14%, transparent); font-weight: 800; color: var(--primary); }
        .dv2-kpi-acc-name { display: flex; align-items: center; gap: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dv2-kpi-acc-amt { font-variant-numeric: tabular-nums; flex-shrink: 0; }
        .dv2-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 16px; box-shadow: var(--shadow-sm); position: relative; overflow: hidden; transition: box-shadow .2s, transform .2s; }
        .dv2-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--dv2-accent, var(--primary)); border-radius: 4px 0 0 4px; }
        .dv2-card:hover { box-shadow: var(--shadow-md); }
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
        .dv2-summary-banner { position: relative; overflow: hidden; border-radius: 18px; padding: 18px 18px 20px; margin-bottom: 16px; background: linear-gradient(135deg, color-mix(in srgb, #2563eb 15%, var(--bg-card)) 0%, color-mix(in srgb, #8b5cf6 13%, var(--bg-card)) 55%, color-mix(in srgb, #0ea5e9 11%, var(--bg-card)) 100%); border: 1px solid color-mix(in srgb, #2563eb 30%, var(--border)); box-shadow: var(--shadow-md); }
        .dv2-summary-banner::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(520px 130px at 8% -20%, color-mix(in srgb, #2563eb 22%, transparent), transparent 70%), radial-gradient(420px 120px at 95% 130%, color-mix(in srgb, #8b5cf6 18%, transparent), transparent 70%); }
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
        .dv2-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
        .dv2-grid-wide { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
        .dv2-wallet { cursor: pointer; text-align: left; }
        .dv2-wallet-top { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .dv2-emoji { width: 38px; height: 38px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; font-size: 19px; background: color-mix(in srgb, var(--dv2-accent, var(--primary)) 14%, var(--bg)); flex-shrink: 0; }
        .dv2-wallet-name { font-weight: 700; font-size: 13.5px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dv2-wallet-amt { font-size: 21px; font-weight: 800; }
        .dv2-wallet-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 11px; color: var(--text-muted); }
        .dv2-wallet-detail { margin-top: 12px; border-top: 1px dashed var(--border); padding-top: 10px; display: none; }
        .dv2-wallet.open .dv2-wallet-detail { display: block; }
        .dv2-mov-line { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; padding: 5px 0; border-bottom: 1px solid var(--border-light); }
        .dv2-mov-line:last-child { border-bottom: none; }
        .dv2-mov-date { color: var(--text-muted); font-size: 11px; min-width: 74px; }
        .dv2-pos { color: var(--success); font-weight: 700; }
        .dv2-neg { color: var(--danger); font-weight: 700; }
        .dv2-debt-status { font-size: 10.5px; font-weight: 800; padding: 3px 9px; border-radius: 999px; text-transform: uppercase; letter-spacing: .4px; }
        .dv2-st-pending { background: color-mix(in srgb, var(--warning) 16%, transparent); color: var(--warning); }
        .dv2-st-partial  { background: color-mix(in srgb, var(--info) 16%, transparent); color: var(--info); }
        .dv2-st-done     { background: color-mix(in srgb, var(--success) 16%, transparent); color: var(--success); }
        .dv2-progress { height: 9px; border-radius: 999px; background: var(--border-light); overflow: hidden; margin: 10px 0 6px; }
        .dv2-progress-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--dv2-accent, var(--primary)), color-mix(in srgb, var(--dv2-accent, var(--primary)) 55%, #ffffff)); transition: width .4s ease; }
        .dv2-progress-meta { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); }
        .dv2-expand-arrow { background: none; border: 1px solid var(--border); color: var(--text-secondary); width: 24px; height: 24px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all .2s; flex-shrink: 0; font-size: 10px; }
        .dv2-expand-arrow:hover { border-color: var(--dv2-accent, var(--primary)); color: var(--dv2-accent, var(--primary)); }
        .dv2-expand-arrow.open i { transform: rotate(90deg); }
        .dv2-expand-arrow i { transition: transform .2s; }
        .dv2-subcats { display: none; margin-top: 10px; border-top: 1px dashed var(--border); padding-top: 10px; }
        .dv2-subcats.open { display: block; animation: dv2Fade .22s ease; }
        .dv2-subcat-row { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 8px; font-size: 12.5px; }
        .dv2-subcat-row:hover { background: var(--bg); }
        .dv2-subcat-name { flex: 1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dv2-subcat-amt { font-variant-numeric: tabular-nums; font-weight: 700; color: var(--text-muted); }
        .dv2-subcat-actions { display: inline-flex; gap: 3px; }
        .dv2-history-btn { background: none; border: 1px solid var(--border); color: var(--text-muted); width: 26px; height: 26px; border-radius: 7px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; transition: all .15s; flex-shrink: 0; }
        .dv2-history-btn:hover { border-color: var(--dv2-accent, var(--primary)); color: var(--dv2-accent, var(--primary)); background: color-mix(in srgb, var(--dv2-accent, var(--primary)) 10%, transparent); }
        .dv2-budget-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--success) 14%, transparent); color: var(--success); text-transform: uppercase; letter-spacing: .4px; }
        .dv2-budget-badge.off { background: var(--border-light); color: var(--text-muted); }
        .dv2-vers-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .dv2-vers-table th { text-align: left; padding: 8px 6px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .5px; color: var(--text-muted); border-bottom: 1px solid var(--border); }
        .dv2-vers-table td { padding: 10px 6px; border-bottom: 1px solid var(--border-light); vertical-align: top; }
        .dv2-vers-table tr:hover td { background: var(--bg); }
        .dv2-vers-table .col-month { font-weight: 800; width: 90px; }
        .dv2-vers-table .col-budget { width: 100px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .dv2-vers-table .col-subs { font-size: 11px; color: var(--text-secondary); }
        .dv2-vers-table .col-actions { width: 60px; text-align: right; }
        .dv2-switch { position: relative; width: 40px; height: 22px; flex: none; display: inline-block; }
        .dv2-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
        .dv2-switch-slider { position: absolute; inset: 0; border-radius: 999px; background: rgba(148,163,184,.45); transition: background .15s ease; }
        .dv2-switch-slider::before { content: ""; position: absolute; left: 3px; top: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .15s ease; }
        .dv2-switch input:checked + .dv2-switch-slider { background: var(--success); }
        .dv2-switch input:checked + .dv2-switch-slider::before { transform: translateX(18px); }
        .dv2-budget-block { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin-top: 10px; }
        .dv2-budget-switch-row { display: flex; align-items: center; gap: 10px; cursor: pointer; margin: 0; }
        .dv2-budget-switch-label { font-size: 13px; font-weight: 700; color: var(--text); user-select: none; }
        .dv2-budget-amount-wrap { margin-top: 10px; }
        .dv2-budget-amount-label { display: block; font-size: 10.5px; text-transform: uppercase; letter-spacing: .5px; color: var(--text-muted); margin-bottom: 4px; }
        .dv2-subcat-editor { margin-top: 12px; border-top: 1px dashed var(--border); padding-top: 10px; }
        .dv2-subcat-editor-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .dv2-subcat-editor-head strong { font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--text-muted); }
        .dv2-subcat-editor-row { display: grid; grid-template-columns: 30px 1fr 90px 30px; gap: 6px; align-items: center; margin-bottom: 6px; }
        .dv2-subcat-editor-row input { width: 100%; padding: 6px 8px; font-size: 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); }
        .dv2-subcat-editor-row .icon-prev { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; }
        .dv2-subcat-editor-row .del { background: none; border: none; color: var(--text-muted); cursor: pointer; width: 30px; height: 30px; border-radius: 6px; }
        .dv2-subcat-editor-row .del:hover { color: var(--danger); background: var(--danger-light); }
        .dv2-expand-btn { background: none; border: 1px solid var(--border); color: var(--text-secondary); width: 30px; height: 30px; border-radius: 9px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all .2s; flex-shrink: 0; font-size: 12px; }
        .dv2-expand-btn:hover { border-color: var(--dv2-accent, var(--primary)); color: var(--dv2-accent, var(--primary)); }
        .dv2-hist-filters { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
        .dv2-hist-list { max-height: 460px; overflow-y: auto; display: flex; flex-direction: column; }
        .dv2-hist-row { display: flex; align-items: center; gap: 10px; padding: 9px 2px; border-bottom: 1px solid var(--border-light); }
        .dv2-hist-row:last-child { border-bottom: none; }
        .dv2-hist-icon { width: 30px; height: 30px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; }
        .dv2-hist-main { flex: 1; min-width: 0; }
        .dv2-hist-concept { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dv2-hist-sub { font-size: 10.5px; color: var(--text-muted); }
        .dv2-hist-amt { font-size: 13px; font-weight: 800; white-space: nowrap; }
        .dv2-modal-backdrop { position: fixed; inset: 0; background: rgba(2,6,23,.55); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 1200; opacity: 0; pointer-events: none; transition: opacity .2s; padding: 18px; }
        .dv2-modal-backdrop.show { opacity: 1; pointer-events: auto; }
        .dv2-modal { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; width: min(480px, 94vw); max-height: 88vh; overflow-y: auto; box-shadow: 0 18px 50px rgba(0,0,0,.25); transform: translateY(10px) scale(.98); transition: transform .2s; }
        .dv2-modal-backdrop.show .dv2-modal { transform: none; }
        .dv2-modal.wide { width: min(640px, 96vw); }
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
        .dv2-emoji-opt { width: 34px; height: 34px; border-radius: 9px; border: 1.5px solid var(--border); background: var(--bg); cursor: pointer; font-size: 16px; display: inline-flex; align-items: center; justify-content: center; transition: all .12s; overflow: hidden; }
        .dv2-emoji-opt.sel { border-color: var(--primary); background: var(--primary-light); transform: scale(1.06); }
        .dv2-emoji-opt img { width: 22px; height: 22px; object-fit: contain; }
        .dv2-seg { display: inline-flex; background: var(--bg); border: 1px solid var(--border); border-radius: 9px; padding: 3px; gap: 3px; }
        .dv2-seg button { border: none; background: transparent; color: var(--text-secondary); font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 7px; cursor: pointer; font-family: inherit; }
        .dv2-seg button.sel { background: var(--dv2-accent, var(--primary)); color: #fff; }
        .dv2-danger-link { color: var(--danger); background: none; border: none; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; margin-right: auto; padding: 8px 4px; }
        .dv2-danger-link:hover { text-decoration: underline; }
        .dv2-empty { text-align: center; color: var(--text-muted); font-size: 12.5px; padding: 18px 8px; border: 1.5px dashed var(--border); border-radius: 12px; }
        .dv2-chip { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; color: var(--text-secondary); background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px; }
        .dv2-note-flag { font-size: 10px; color: var(--warning); font-style: italic; }
        @keyframes dv2Fade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    `; }

    /* =========================================================
       REINICIO MENSUAL DE WALLETS
       ========================================================= */
    function checkAndResetWalletsForNewMonth() {
        const mk = currentMonthKey();
        if (!data.lastWalletResetMonth) { data.lastWalletResetMonth = mk; saveData(); return; }
        if (data.lastWalletResetMonth === mk) return;
        if (data.lastWalletResetMonth > mk) return;

        const results = [];
        data.wallets
            .filter(w => w.includeInBudget && w.accountId)
            .forEach(w => {
                const balance = walletBalance(w);
                if (Math.abs(balance) < 0.005) return;

                if (balance > 0) {
                    w.movements.push({
                        id: uid('wm'), date: todayISO(),
                        concept: `Cierre de mes ${data.lastWalletResetMonth}: devolución a cuenta`,
                        amount: balance, type: 'out'
                    });
                    const acc = getAccounts().find(a => a.id === w.accountId);
                    if (acc) {
                        acc.balance = round2(Number(acc.balance || 0) + balance);
                        data.movements.unshift({
                            id: uid('mv'), date: todayISO(),
                            concept: `Cierre de mes: Devolución de sobrante de ${w.name || 'monedero'}`,
                            amount: balance, type: 'in', accountId: w.accountId,
                            module: 'Wallets', category: w.name, // AÑADIDO
                            link: { kind: 'wallet-month-close', id: w.id }
                        });
                    }
                    results.push({ name: w.name, amount: balance, action: 'devuelto' });
                } else {
                    results.push({ name: w.name, amount: balance, action: 'negativo' });
                }
            });

        data.lastWalletResetMonth = mk;
        try { saveData(); App.saveData(); } catch (e) {}

        if (results.length) {
            try {
                results.forEach(r => {
                    if (r.action === 'devuelto') {
                        App.showToast(`${r.name}: devueltos ${fmtMoney(r.amount)} a la cuenta`, 'success');
                        if (typeof App.addHistory === 'function') {
                            App.addHistory('mi-dinero', `Cierre mes: ${r.name} → ${r.amount.toFixed(2)} € devueltos`);
                        }
                    } else {
                        App.showToast(`${r.name}: saldo negativo (${fmtMoney(r.amount)}), revísalo`, 'warning');
                    }
                });
            } catch (e) {}
        }
    }

    /* =========================================================
       RENDER
       ========================================================= */
    function render(container) {
        App.injectStylesheet('dinero-v2-styles', moduleCSS());
        containerEl = container;

        const accountOptions = getAccounts().map(a => {
            const active = viewFilters.accountId === a.id;
            return `<button class="dv2-filter-pill ${active ? 'sel' : ''}" data-account-filter="${a.id}">
                ${renderIcon(a.icon || '🏦', 14)} ${escapeHtml(a.name)}
            </button>`;
        }).join('');

        const budgetOptions = [
            { v: 'all', l: 'Todos' },
            { v: 'included', l: '✓ Incluido en presupuesto' },
            { v: 'excluded', l: '✗ No incluido' }
        ].map(o =>
            `<button class="dv2-filter-pill ${viewFilters.budgetStatus === o.v ? 'sel' : ''}" data-budget-filter="${o.v}">${o.l}</button>`
        ).join('');

        container.innerHTML = `
            <div class="dv2-global-filters">
                <span class="dv2-global-filters-label">Cuenta:</span>
                <button class="dv2-filter-pill ${viewFilters.accountId === 'all' ? 'sel' : ''}" data-account-filter="all">Todas</button>
                ${accountOptions}
                <span class="dv2-global-filters-label" style="margin-left:12px;">Presupuesto:</span>
                ${budgetOptions}
            </div>
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

    const HORIZON_OPTIONS = [
        { v: 1, l: '1 día' }, { v: 3, l: '3 días' }, { v: 7, l: '1 semana' },
        { v: 14, l: '2 semanas' }, { v: 30, l: '1 mes' }
    ];
    function horizonLabel(days) {
        const opt = HORIZON_OPTIONS.find(o => o.v === Number(days));
        return opt ? opt.l : `${days} días`;
    }

    /* --------------------- RESUMEN / KPIs --------------------- */
    function renderKpiAccounts(kpiType) {
        const accounts = getAccounts();
        return accounts.map(a => {
            let val = 0;
            if (kpiType === 'real') val = Number(a.balance || 0);
            else if (kpiType === 'now') val = availableNow(a.id);
            else if (kpiType === 'global') val = availableGlobal(a.id);
            const active = viewFilters.accountId === a.id;
            return `<div class="dv2-kpi-acc ${active ? 'sel' : ''}" data-account-filter="${a.id}">
                <span class="dv2-kpi-acc-name">${renderIcon(a.icon || '🏦', 12)} ${escapeHtml(a.name)}</span>
                <span class="dv2-kpi-acc-amt">${fmtMoney(val)}</span>
            </div>`;
        }).join('');
    }

    function renderSummary() {
        const real = realBalance(viewFilters.accountId);
        const now = availableNow(viewFilters.accountId);
        const glob = availableGlobal(viewFilters.accountId);
        const h = data.settings.horizonDays;
        const horizonOptions = HORIZON_OPTIONS.map(o =>
            `<option value="${o.v}" ${Number(o.v) === Number(h) ? 'selected' : ''}>${o.l}</option>`
        ).join('');

        return `
        <section class="dv2-section dv2-summary-section" style="--dv2-accent:${SECTION_COLORS.summary}">
            <div class="dv2-summary-banner">
                <div class="dv2-summary-head">
                    <div class="dv2-summary-title"><span class="dv2-badge" style="background:linear-gradient(135deg,#2563eb,#8b5cf6)">💶</span> Resumen del dinero</div>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                        <span class="dv2-summary-chip">Indicadores clave</span>
                    </div>
                </div>
                <div class="dv2-kpis-v3">
                    <div class="dv2-kpi3" style="--dv2-accent:#2563eb">
                        <div class="dv2-kpi3-label"><span class="dv2-kpi-dot" style="background:#2563eb"></span> Saldo Real en Cuentas</div>
                        <div class="dv2-kpi3-value">${fmtMoney(real)}</div>
                        <div class="dv2-kpi-accounts" data-kpi="real">${renderKpiAccounts('real')}</div>
                    </div>
                    <div class="dv2-kpi3" style="--dv2-accent:#f59e0b">
                        <div class="dv2-kpi3-label"><span class="dv2-kpi-dot" style="background:#f59e0b"></span> Disponible Ahora</div>
                        <div class="dv2-kpi3-value ${now < 0 ? 'negative' : ''}">${fmtMoney(now)}</div>
                        <div class="dv2-kpi-accounts" data-kpi="now">${renderKpiAccounts('now')}</div>
                        <div class="dv2-kpi-control">
                            <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted)">Horizonte:</span>
                            <select class="dv2-pill-select" id="dv2Horizon" style="--dv2-accent:#f59e0b">${horizonOptions}</select>
                        </div>
                    </div>
                    <div class="dv2-kpi3" style="--dv2-accent:#8b5cf6">
                        <div class="dv2-kpi3-label"><span class="dv2-kpi-dot" style="background:#8b5cf6"></span> Disponible Global</div>
                        <div class="dv2-kpi3-value ${glob < 0 ? 'negative' : ''}">${fmtMoney(glob)}</div>
                        <div class="dv2-kpi-accounts" data-kpi="global">${renderKpiAccounts('global')}</div>
                    </div>
                </div>
            </div>
        </section>`;
    }

    /* --------------------- WALLETS --------------------- */
    function renderSubcatsHTML(item, accent) {
        if (!item.subcategories || !item.subcategories.length) return '';
        const isOpen = viewFilters.expandedSubcats.has(item.id);
        const mk = currentMonthKey();
        const rows = item.subcategories.map(sub => {
            const v = getEffectiveVersion(sub, mk);
            return `<div class="dv2-subcat-row">
                <span style="font-size:14px">${renderIcon(sub.icon || '·', 14)}</span>
                <span class="dv2-subcat-name">${escapeHtml(sub.name)}</span>
                <span class="dv2-subcat-amt">${fmtMoney(v.budgetAmount || 0)}</span>
                <div class="dv2-subcat-actions">
                    <button class="dv2-history-btn" data-subcat-versions="${item.id}::${sub.id}" title="Ver versiones"><i class="fas fa-clock-rotate-left"></i></button>
                </div>
            </div>`;
        }).join('');
        return `<div class="dv2-subcats ${isOpen ? 'open' : ''}" data-subcats="${item.id}">${rows}</div>`;
    }

    function renderWallets() {
        const visible = data.wallets.filter(passesAllFilters);
        const cards = visible.map(w => {
            const balance = walletBalance(w);
            const effVersion = getEffectiveVersion(w, currentMonthKey());
            const budgetAmt = Number(effVersion.budgetAmount || 0);
            const spent = walletSpentThisMonth(w);
            const acc = getAccounts().find(a => a.id === w.accountId);
            const accName = acc ? escapeHtml(acc.name) : 'Sin cuenta';
            const isOpen = viewFilters.expandedSubcats.has(w.id);
            const hasSubcats = (w.subcategories || []).length > 0;
            const progressPct = budgetAmt > 0 ? Math.min(100, Math.round((spent / budgetAmt) * 100)) : 0;

            return `
            <div class="dv2-card dv2-wallet" style="--dv2-accent:${w.color || '#f59e0b'}" data-wallet="${w.id}" title="Clic para ver movimientos y editar">
                <div class="dv2-wallet-top">
                    ${hasSubcats
                        ? `<button class="dv2-expand-arrow ${isOpen ? 'open' : ''}" data-expand-subcats="${w.id}" title="Desglose de subcategorías"><i class="fas fa-caret-right"></i></button>`
                        : `<span style="width:24px"></span>`}
                    <span class="dv2-emoji">${renderIcon(w.emoji || '👛', 19)}</span>
                    <div style="flex:1;min-width:0">
                        <div class="dv2-wallet-name" data-wallet-name="${w.id}">${escapeHtml(w.name)}</div>
                        <div style="font-size:10px;color:var(--text-muted)"><i class="fas fa-link"></i> ${accName}</div>
                    </div>
                    ${w.includeInBudget
                        ? `<span class="dv2-budget-badge" title="Incluido en presupuesto">✓ Presup.</span>`
                        : `<span class="dv2-budget-badge off" title="No incluido en presupuesto">— Presup.</span>`}
                    <button class="dv2-history-btn" data-versions="${w.id}" title="Historial de versiones"><i class="fas fa-clock-rotate-left"></i></button>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px">
                    <div class="dv2-wallet-amt">${fmtMoney(balance)}</div>
                    ${w.includeInBudget && budgetAmt > 0 ? `<span class="dv2-chip">${progressPct}%</span>` : ''}
                </div>
                ${w.includeInBudget && budgetAmt > 0 ? `
                <div class="dv2-progress" style="--dv2-accent:${w.color}"><div class="dv2-progress-fill" style="width:${progressPct}%"></div></div>
                <div class="dv2-progress-meta"><span>Gastado: ${fmtMoney(spent)}</span><span>Presupuesto: ${fmtMoney(budgetAmt)}</span></div>` : ''}
                ${renderSubcatsHTML(w, w.color)}
            </div>`;
        }).join('');

        return `
        <section class="dv2-section" style="--dv2-accent:${SECTION_COLORS.wallets}">
            ${sectionHead('wallets', 'Monederos virtuales', 'Distribución interna del saldo real', '+ Nuevo monedero', 'dv2AddWallet')}
            <div class="dv2-grid">${cards || '<div class="dv2-empty">Crea tu primer monedero</div>'}</div>
        </section>`;
    }

    /* --------------------- DEBTS --------------------- */
    function debtMatchesFilter(d) {
        if (!passesAllFilters(d)) return false;
        const st = debtStatus(d);
        if (viewFilters.debtStatus === 'pending') return st !== 'done';
        if (viewFilters.debtStatus === 'done') return st === 'done';
        return true;
    }
    function renderDebts() {
        const groups = [
            { kind: 'pay', label: 'Dinero a devolver a la cuenta', hint: '(gastado hoy, se repone)' },
            { kind: 'receive', label: 'Dinero a recuperar de la cuenta', hint: '(préstamos o ingresos temporales)' }
        ];
        const card = (d) => {
            const s = debtStatus(d);
            const pct = d.total ? Math.min(100, Math.round(d.returned / d.total * 100)) : 0;
            const col = d.kind === 'pay' ? '#ef4444' : '#0ea5e9';
            const acc = getAccounts().find(a => a.id === d.accountId);
            const accName = acc ? escapeHtml(acc.name) : 'Sin cuenta';
            const isOpen = viewFilters.expandedSubcats.has(d.id);
            const hasSubcats = (d.subcategories || []).length > 0;

            return `
            <div class="dv2-card" style="--dv2-accent:${col};cursor:pointer" data-debt="${d.id}" title="Clic para ver movimientos y editar">
                <div class="dv2-wallet-top">
                    ${hasSubcats
                        ? `<button class="dv2-expand-arrow ${isOpen ? 'open' : ''}" data-expand-subcats="${d.id}"><i class="fas fa-caret-right"></i></button>`
                        : `<span style="width:24px"></span>`}
                    <span class="dv2-emoji">${renderIcon(d.emoji || '🔄', 19)}</span>
                    <div style="flex:1;min-width:0">
                        <div class="dv2-wallet-name">${escapeHtml(d.name)}</div>
                        <div style="font-size:10px;color:var(--text-muted)"><i class="fas fa-link"></i> ${accName}</div>
                    </div>
                    ${d.includeInBudget ? `<span class="dv2-budget-badge">✓ Presup.</span>` : `<span class="dv2-budget-badge off">— Presup.</span>`}
                    <button class="dv2-history-btn" data-versions="${d.id}"><i class="fas fa-clock-rotate-left"></i></button>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:baseline">
                    <div class="dv2-wallet-amt">${fmtMoney(d.total)}</div>
                    <span class="dv2-chip">${pct}%</span>
                </div>
                <div class="dv2-progress" style="--dv2-accent:${col}"><div class="dv2-progress-fill" style="width:${pct}%"></div></div>
                <div class="dv2-progress-meta"><span>Cubierto: ${fmtMoney(d.returned)}</span><span>Restante: ${fmtMoney(Math.max(0, d.total - d.returned))}</span></div>
                ${renderSubcatsHTML(d, col)}
            </div>`;
        };
        const blocks = groups.map(g => {
            const list = data.debts.filter(d => d.kind === g.kind && debtMatchesFilter(d));
            return `
            <div style="margin-bottom:14px">
                <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:${g.kind === 'pay' ? '#ef4444' : '#0ea5e9'};margin-bottom:8px">
                    <i class="fas ${g.kind === 'pay' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i> ${g.label} <span style="color:var(--text-muted);font-weight:500;text-transform:none">${g.hint}</span>
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

    /* --------------------- LOANS --------------------- */
    function loanMatchesFilter(l) {
        if (!passesAllFilters(l)) return false;
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
            const isOpen = viewFilters.expandedSubcats.has(l.id);
            const hasSubcats = (l.subcategories || []).length > 0;
            return `
            <div class="dv2-card" style="--dv2-accent:#8b5cf6;cursor:pointer" data-loan="${l.id}" title="Clic para ver cuotas y editar">
                <div class="dv2-wallet-top">
                    ${hasSubcats ? `<button class="dv2-expand-arrow ${isOpen ? 'open' : ''}" data-expand-subcats="${l.id}"><i class="fas fa-caret-right"></i></button>` : `<span style="width:24px"></span>`}
                    <span class="dv2-emoji">${renderIcon(l.emoji || '🏦', 19)}</span>
                    <div style="flex:1;min-width:0">
                        <div class="dv2-wallet-name">${escapeHtml(l.name)}</div>
                        <div style="font-size:10.5px;color:var(--text-muted)">Financiado: ${fmtMoney(l.financed)} · ${fmtMoney(l.installmentAmount)}/cuota</div>
                    </div>
                    ${l.includeInBudget ? `<span class="dv2-budget-badge">✓ Presup.</span>` : `<span class="dv2-budget-badge off">— Presup.</span>`}
                    <button class="dv2-history-btn" data-versions="${l.id}"><i class="fas fa-clock-rotate-left"></i></button>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px">
                    <div class="dv2-wallet-amt" style="color:${done ? 'var(--success)' : 'var(--danger)'}">${done ? '✅ Completado' : fmtMoney(pending)}</div>
                    <span class="dv2-chip">${pct}%</span>
                </div>
                <div style="font-size:11px;color:var(--text-muted)">${done ? `${l.paidCount}/${l.installments} cuotas pagadas` : 'pendiente por pagar'}</div>
                <div class="dv2-progress" style="--dv2-accent:#8b5cf6"><div class="dv2-progress-fill" style="width:${pct}%"></div></div>
                <div class="dv2-progress-meta"><span>Pagado: ${fmtMoney(l.financed - pending)}</span><span>Cubiertas: ${l.paidCount}/${l.installments}</span></div>
                ${renderSubcatsHTML(l, '#8b5cf6')}
            </div>`;
        }).join('');

        return `
        <section class="dv2-section" style="--dv2-accent:${SECTION_COLORS.loans}">
            ${sectionHead('loans', 'Préstamos y financiaciones', viewFilters.loanStatus === 'completed' ? 'Historial cerrado' : 'Cuotas activas', '+ Nuevo préstamo', 'dv2AddLoan')}
            ${filterRowHtml('loanStatus', [{ v: 'active', l: 'Pendientes' }, { v: 'completed', l: 'Completados' }, { v: 'all', l: 'Todos' }])}
            <div class="dv2-grid dv2-grid-wide">${cards || '<div class="dv2-empty">' + (viewFilters.loanStatus === 'active' ? 'Sin préstamos activos 🎉' : 'Nada con este filtro') + '</div>'}</div>
        </section>`;
    }

    function filterRowHtml(key, opts) {
        return `<div style="margin:-6px 0 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted)">Mostrar:</span>
            <span class="dv2-filter-chips">${opts.map(o =>
                `<button class="dv2-fchip ${viewFilters[key] === o.v ? 'sel' : ''}" data-${key}="${o.v}">${o.l}</button>`).join('')}</span>
        </div>`;
    }

    /* --------------------- GOALS --------------------- */
    function renderGoals() {
        const cards = data.goals.filter(goalMatchesFilter).map(g => {
            const pct = g.target ? Math.min(100, Math.round(g.saved / g.target * 100)) : null;
            const rem = goalRemaining(g);
            const isTripFund = g.id === 'g-trip-fund';
            const isOpen = viewFilters.expandedSubcats.has(g.id);
            const hasSubcats = (g.subcategories || []).length > 0;
            return `
            <div class="dv2-card" style="--dv2-accent:#10b981;cursor:pointer" data-goal="${g.id}" title="Clic para ver aportaciones y editar">
                <div class="dv2-wallet-top">
                    ${hasSubcats ? `<button class="dv2-expand-arrow ${isOpen ? 'open' : ''}" data-expand-subcats="${g.id}"><i class="fas fa-caret-right"></i></button>` : `<span style="width:24px"></span>`}
                    <span class="dv2-emoji">${renderIcon(g.emoji || '🎯', 19)}</span>
                    <div style="flex:1;min-width:0">
                        <div class="dv2-wallet-name">${escapeHtml(g.name)}</div>
                        <div style="font-size:10.5px;color:var(--text-muted)">${g.target != null ? `Meta: ${fmtMoney(g.target)}` : 'Sin meta fija'}${isTripFund ? ' · 🎯 unificado' : ''}</div>
                    </div>
                    ${g.includeInBudget ? `<span class="dv2-budget-badge">✓ Presup.</span>` : `<span class="dv2-budget-badge off">— Presup.</span>`}
                    <button class="dv2-history-btn" data-versions="${g.id}"><i class="fas fa-clock-rotate-left"></i></button>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:baseline">
                    <div class="dv2-wallet-amt" style="color:#10b981">${fmtMoney(g.saved)}</div>
                    ${pct != null ? `<span class="dv2-chip">${pct}%</span>` : ''}
                </div>
                ${g.target != null ? `
                <div class="dv2-progress" style="--dv2-accent:#10b981"><div class="dv2-progress-fill" style="width:${pct}%"></div></div>
                <div class="dv2-progress-meta"><span>Faltan: ${fmtMoney(rem)}</span><span>Fin est.: ${goalFinishDate(g) || '—'}</span></div>` : ''}
                <div class="dv2-wallet-foot" style="margin-top:10px">
                    <span>${g.frequency !== 'none' && g.nextDate ? `<i class="fas fa-clock" style="font-size:10px"></i> Próxima: ${fmtDate(g.nextDate)} · ${fmtMoney(g.contribution)}` : '<span class="dv2-note-flag">Sin aportación programada</span>'}</span>
                    <button class="dv2-mini-btn" data-goalcontrib="${g.id}"><i class="fas fa-plus"></i> Aportar</button>
                </div>
                ${renderSubcatsHTML(g, '#10b981')}
            </div>`;
        }).join('');

        return `
        <section class="dv2-section" style="--dv2-accent:${SECTION_COLORS.goals}">
            ${sectionHead('goals', 'Objetivos de ahorro', 'Metas con seguimiento', '+ Nuevo objetivo', 'dv2AddGoal')}
            ${filterRowHtml('goalStatus', [{ v: 'dateActive', l: '📅 Fecha activa' }, { v: 'done', l: 'Completados' }, { v: 'all', l: 'Todos' }])}
            <div class="dv2-grid dv2-grid-wide">${cards || '<div class="dv2-empty">' + (viewFilters.goalStatus === 'dateActive' ? 'Ningún objetivo con aportación programada' : 'Sin objetivos con este filtro') + '</div>'}</div>
        </section>`;
    }

    /* --------------------- RECURRING --------------------- */
    function renderRecurring() {
        const cards = data.recurring.filter(recurringMatchesFilter).map(r => {
            const isOpen = viewFilters.expandedSubcats.has(r.id);
            const hasSubcats = (r.subcategories || []).length > 0;
            return `
            <div class="dv2-card" style="--dv2-accent:#0ea5e9;cursor:pointer" data-recurring="${r.id}" title="Clic para ver historial y editar">
                <div class="dv2-wallet-top">
                    ${hasSubcats ? `<button class="dv2-expand-arrow ${isOpen ? 'open' : ''}" data-expand-subcats="${r.id}"><i class="fas fa-caret-right"></i></button>` : `<span style="width:24px"></span>`}
                    <span class="dv2-emoji">${renderIcon(r.emoji || '🔁', 19)}</span>
                    <div style="flex:1;min-width:0">
                        <div class="dv2-wallet-name">${escapeHtml(r.name)}</div>
                        <div style="font-size:10.5px;color:var(--text-muted)">${periodLabel(r.period)} · ${escapeHtml(r.accountName || 'Sin cuenta')}</div>
                    </div>
                    ${r.includeInBudget ? `<span class="dv2-budget-badge">✓ Presup.</span>` : `<span class="dv2-budget-badge off">— Presup.</span>`}
                    <button class="dv2-history-btn" data-versions="${r.id}"><i class="fas fa-clock-rotate-left"></i></button>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div class="dv2-wallet-amt">${fmtMoney(r.amount)}</div>
                    <span class="dv2-debt-status ${r.active ? 'dv2-st-done' : 'dv2-st-pending'}" style="${r.active ? '' : 'background:var(--border-light);color:var(--text-muted)'}">${r.active ? 'Activo' : 'Pausado'}</span>
                </div>
                <div class="dv2-wallet-foot" style="margin-top:8px">
                    <span>${r.active && r.nextDate ? `<i class="fas fa-calendar-check" style="font-size:10px"></i> Próximo: ${fmtDate(r.nextDate)}` : r.active ? 'Sin fecha próxima' : '⏸ En pausa'}</span>
                </div>
                ${renderSubcatsHTML(r, '#0ea5e9')}
            </div>`;
        }).join('');

        return `
        <section class="dv2-section" style="--dv2-accent:${SECTION_COLORS.recurring}">
            ${sectionHead('recurring', 'Pagos recurrentes y suscripciones', 'Compromisos periódicos', '+ Nuevo pago', 'dv2AddRecurring')}
            ${filterRowHtml('recurringStatus', [{ v: 'active', l: '🟢 Activo' }, { v: 'paused', l: '⏸ Pausados' }, { v: 'all', l: 'Todos' }])}
            <div class="dv2-grid">${cards || '<div class="dv2-empty">' + (viewFilters.recurringStatus === 'active' ? 'Sin pagos activos con este filtro' : 'Nada con este filtro') + '</div>'}</div>
        </section>`;
    }

    /* --------------------- HISTORIAL --------------------- */
    const histFilter = { account: 'all', type: 'all', from: '', to: '' };

    function renderRight() {
        const right = containerEl.querySelector('#dv2Right');
        const accOpts = ['<option value="all">Todas las cuentas</option>'].concat(
            getAccounts().map(a => `<option value="${a.id}" ${histFilter.account === a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`)
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
                        const acc = getAccounts().find(a => a.id === m.accountId);
                        const isIn = m.amount >= 0;
                        const isTransfer = m.type.startsWith('transfer');
                        const iconBg = isTransfer ? 'var(--border-light)' : isIn ? 'color-mix(in srgb, var(--success) 15%, transparent)' : 'color-mix(in srgb, var(--danger) 12%, transparent)';
                        const iconColor = isTransfer ? 'var(--text-muted)' : isIn ? 'var(--success)' : 'var(--danger)';
                        const icon = isTransfer ? 'fa-right-left' : isIn ? 'fa-arrow-down' : 'fa-arrow-up';
                        return `
                        <div class="dv2-hist-row" data-action="edit-movement" data-id="${m.id}" style="cursor:pointer;">
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
        if (link.kind === 'wallet') { const w = data.wallets.find(x => x.id === link.id); return w ? w.name : ''; }
        if (link.kind === 'goal') { const g = data.goals.find(x => x.id === link.id); return g ? g.name : ''; }
        if (link.kind === 'loan') { const l = data.loans.find(x => x.id === link.id); return l ? l.name : ''; }
        if (link.kind === 'debt') { const d = data.debts.find(x => x.id === link.id); return d ? d.name : ''; }
        if (link.kind === 'recurring') { const r = data.recurring.find(x => x.id === link.id); return r ? r.name : ''; }
        if (link.kind === 'expense') return '🧾 Gasto';
        if (link.kind === 'income') return '💰 Ingreso';
        if (link.kind === 'trip-payment') return '✈️ Viaje';
        if (link.kind === 'trip-savings') return '✈️ Fondo Viajes';
        if (link.kind === 'wallet-month-close') return '🔄 Cierre mes';
        return '';
    }

    function filteredMovements() {
        let list = data.movements;
        if (viewFilters.accountId !== 'all') {
            list = list.filter(m => m.accountId === viewFilters.accountId);
        }
        list = list
            .filter(m => histFilter.account === 'all' || m.accountId === histFilter.account)
            .filter(m => histFilter.type === 'all' || m.type.startsWith(histFilter.type))
            .filter(m => (!histFilter.from || m.date >= histFilter.from) && (!histFilter.to || m.date <= histFilter.to))
            .sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1));
        return list;
    }

    /* =========================================================
       EVENTOS
       ========================================================= */
    let _keyboardBound = false;
    function bindGlobal() {
        const root = containerEl.querySelector('#dv2ModalRoot');
        if (root) root.addEventListener('click', (e) => { if (e.target === root) closeModal(); });
        if (!_keyboardBound) {
            document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
            _keyboardBound = true;
        }
        containerEl.querySelectorAll('[data-account-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                viewFilters.accountId = btn.dataset.accountFilter;
                render();
            });
        });
        containerEl.querySelectorAll('[data-budget-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                viewFilters.budgetStatus = btn.dataset.budgetFilter;
                render();
            });
        });
    }

    function bindLeft(left) {
        left.querySelector('#dv2AddCommitment')?.addEventListener('click', () => openCommitmentModal());
        left.querySelector('#dv2Horizon')?.addEventListener('change', (e) => {
            const v = Math.max(0, Math.min(365, parseInt(e.target.value || '7', 10)));
            data.settings.horizonDays = v;
            saveData(); renderAll();
        });

        left.querySelector('#dv2AddWallet')?.addEventListener('click', () => openWalletModal());
        left.querySelectorAll('[data-wallet]').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('[data-expand-subcats]')) return;
                if (e.target.closest('[data-versions]')) return;
                if (e.target.closest('[data-wallet-name]')) { openWalletModal(el.dataset.wallet); return; }
                openWalletDetailModal(el.dataset.wallet);
            });
        });
        left.querySelectorAll('[data-expand-subcats]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.expandSubcats;
                const subEl = btn.closest('.dv2-card')?.querySelector('[data-subcats="' + id + '"]');
                if (subEl) subEl.classList.toggle('open');
                btn.classList.toggle('open');
                if (viewFilters.expandedSubcats.has(id)) viewFilters.expandedSubcats.delete(id);
                else viewFilters.expandedSubcats.add(id);
            });
        });
        left.querySelectorAll('[data-versions]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openVersionsModal(btn.dataset.versions);
            });
        });
        left.querySelectorAll('[data-subcat-versions]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const [pid, sid] = btn.dataset.subcatVersions.split('::');
                openVersionsModal(pid, sid);
            });
        });

        left.querySelector('#dv2AddDebt')?.addEventListener('click', () => openDebtModal());
        left.querySelectorAll('[data-debt]').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('[data-expand-subcats]')) return;
                if (e.target.closest('[data-versions]')) return;
                openDebtDetailModal(el.dataset.debt);
            });
        });
        left.querySelectorAll('[data-debtstatus]').forEach(el => {
            el.addEventListener('click', () => { viewFilters.debtStatus = el.dataset.debtstatus; renderLeft(); });
        });

        left.querySelector('#dv2AddLoan')?.addEventListener('click', () => openLoanModal());
        left.querySelectorAll('[data-loan]').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('[data-expand-subcats]')) return;
                if (e.target.closest('[data-versions]')) return;
                openLoanDetailModal(el.dataset.loan);
            });
        });
        left.querySelectorAll('[data-loanstatus]').forEach(el => {
            el.addEventListener('click', () => { viewFilters.loanStatus = el.dataset.loanstatus; renderLeft(); });
        });

        left.querySelector('#dv2AddGoal')?.addEventListener('click', () => openGoalModal());
        left.querySelectorAll('[data-goalstatus]').forEach(el => {
            el.addEventListener('click', () => { viewFilters.goalStatus = el.dataset.goalstatus; renderLeft(); });
        });
        left.querySelectorAll('[data-goal]').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('[data-expand-subcats]')) return;
                if (e.target.closest('[data-goalcontrib]')) return;
                if (e.target.closest('[data-versions]')) return;
                openGoalDetailModal(el.dataset.goal);
            });
        });
        left.querySelectorAll('[data-goalcontrib]').forEach(el => {
            el.addEventListener('click', (e) => { e.stopPropagation(); openContributionModal(el.dataset.goalcontrib); });
        });

        left.querySelector('#dv2AddRecurring')?.addEventListener('click', () => openRecurringModal());
        left.querySelectorAll('[data-recurringstatus]').forEach(el => {
            el.addEventListener('click', () => { viewFilters.recurringStatus = el.dataset.recurringstatus; renderLeft(); });
        });
        left.querySelectorAll('[data-recurring]').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('[data-expand-subcats]')) return;
                if (e.target.closest('[data-versions]')) return;
                openRecurringDetailModal(el.dataset.recurring);
            });
        });
    }

    function bindRight(right) {
        right.querySelector('#dv2AddMovement')?.addEventListener('click', () => openMovementModal());
        right.querySelectorAll('[data-action="edit-movement"]').forEach(el => {
            el.addEventListener('click', () => openMovementModal(el.dataset.id));
        });
        right.querySelector('#dv2HFAccount')?.addEventListener('change', (e) => { histFilter.account = e.target.value; renderRight(); });
        right.querySelector('#dv2HFType')?.addEventListener('change', (e) => { histFilter.type = e.target.value; renderRight(); });
        right.querySelector('#dv2HFFrom')?.addEventListener('change', (e) => { histFilter.from = e.target.value; renderRight(); });
        right.querySelector('#dv2HFTo')?.addEventListener('change', (e) => { histFilter.to = e.target.value; renderRight(); });
    }

    /* =========================================================
       NÚCLEO FINANCIERO (MODIFICADO)
       ========================================================= */
    function registerMovement(m) {
        if (m.link && m.link.kind && m.link.id) {
            const exists = data.movements.find(x =>
                x.link && x.link.kind === m.link.kind && x.link.id === m.link.id
            );
            if (exists) return exists;
        }
        const mv = {
            id: uid('mv'), date: m.date || todayISO(),
            concept: m.concept, amount: m.amount, type: m.type,
            accountId: m.accountId || null, 
            module: m.module || '', // AÑADIDO
            category: m.category || '', // AÑADIDO
            link: m.link || null
        };
        if (m.currency === 'USD') {
            mv.currency = 'USD';
            mv.eurEquivalent = round2(m.amount / eurUsdRate);
        }
        data.movements.unshift(mv);
        const acc = getAccounts().find(a => a.id === mv.accountId);
        if (acc && ['in', 'out', 'transfer-in', 'transfer-out'].includes(mv.type)) {
            acc.balance = round2(acc.balance + mv.amount);
            App.saveData();
        }
        saveData();
        renderAll();
        return mv;
    }

    function payLoanInstallment(loanId) {
        const l = data.loans.find(x => x.id === loanId);
        if (!l || l.paidCount >= l.installments) return;

        const already = data.movements.find(m =>
            m.link && m.link.kind === 'loan' && m.link.id === l.id && m.date === todayISO()
        );
        if (already) return;

        const n = l.paidCount + 1;
        l.payments = l.payments || [];
        l.payments.push({ id: uid('lp'), date: todayISO(), amount: l.installmentAmount, n });
        l.paidCount = n;
        l.nextDate = l.paidCount < l.installments ? addMonths(todayISO(), 1) : null;

        const acc = getAccounts().find(a =>
            (a.name || '').toLowerCase().includes(String(l.accountName || '').toLowerCase().split(' ')[0])
        );
        registerMovement({
            date: todayISO(), concept: `Cuota #${n} · ${l.name}`,
            amount: -l.installmentAmount, type: 'out',
            accountId: acc ? acc.id : null,
            module: 'Préstamos', category: l.name, // AÑADIDO
            link: { kind: 'loan', id: l.id }
        });
        App.saveData();
        App.showToast && App.showToast(`Cuota #${n} de ${l.name} pagada`, 'success');
    }

    /* =========================================================
       SISTEMA DE MODALES
       ========================================================= */
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
        (window.requestAnimationFrame || (cb => setTimeout(cb, 16)))(() => root.classList.add('show'));
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

    const EMOJIS = ['👛', '🛒', '🎮', '🚗', '🎁', '🐱', '✈️', '🏠', '💍', '🎓', '🚨', '💡', '📱', '🎸', '⚽', '💄', '🏦', '🎯', '🔄', '🔁', '📦', '💰'];

    function emojiPicker(name, current) {
        const cur = current || '👛';
        const isUrl = /^(https?:|data:|\/)/.test(String(cur));
        return `
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
                <input class="dv2-input" id="${name}_url" placeholder="URL de imagen (opcional)" value="${isUrl ? escapeHtml(cur) : ''}" style="flex:1;">
                <button class="dv2-mini-btn" id="${name}_clear" type="button">Limpiar</button>
            </div>
            <div class="dv2-emoji-picker" id="${name}">
                ${EMOJIS.map(e => `<button type="button" class="dv2-emoji-opt ${e === cur ? 'sel' : ''}" data-emoji="${e}">${e}</button>`).join('')}
            </div>`;
    }
    function bindEmojiPicker(root, name) {
        const picker = root.querySelector('#' + name);
        if (!picker) return;
        const urlInput = root.querySelector('#' + name + '_url');
        const clearBtn = root.querySelector('#' + name + '_clear');

        picker.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-emoji]');
            if (!btn) return;
            picker.querySelectorAll('.dv2-emoji-opt').forEach(b => b.classList.toggle('sel', b === btn));
            if (urlInput) urlInput.value = '';
        });
        urlInput?.addEventListener('input', () => {
            if (urlInput.value.trim()) {
                picker.querySelectorAll('.dv2-emoji-opt').forEach(b => b.classList.remove('sel'));
            }
        });
        clearBtn?.addEventListener('click', () => {
            urlInput.value = '';
            picker.querySelectorAll('.dv2-emoji-opt').forEach(b => b.classList.remove('sel'));
            const first = picker.querySelector('.dv2-emoji-opt');
            if (first) first.classList.add('sel');
        });
    }
    function pickedEmoji(root, name) {
        const urlInput = root.querySelector('#' + name + '_url');
        if (urlInput && urlInput.value.trim()) return urlInput.value.trim();
        const selBtn = root.querySelector('#' + name + ' .dv2-emoji-opt.sel');
        return selBtn ? selBtn.dataset.emoji : '👛';
    }

    /* =========================================================
       MODAL HISTORIAL DE VERSIONES
       ========================================================= */
    function findItemById(id) {
        return data.wallets.find(x => x.id === id)
            || data.debts.find(x => x.id === id)
            || data.loans.find(x => x.id === id)
            || data.goals.find(x => x.id === id)
            || data.recurring.find(x => x.id === id)
            || null;
    }

    function openVersionsModal(parentId, subId) {
        const parent = findItemById(parentId);
        if (!parent) { toast('Item no encontrado', 'error'); return; }

        let target = parent;
        let title = parent.name || 'Versiones';
        if (subId) {
            target = (parent.subcategories || []).find(s => s.id === subId);
            if (!target) { toast('Subcategoría no encontrada', 'error'); return; }
            title = `${parent.name} · ${target.name}`;
        }

        const versions = target.versions || {};
        const keys = Object.keys(versions).sort().reverse();

        const rows = keys.length ? keys.map(mk => {
            const v = versions[mk];
            const subs = v.subcategories || [];
            const subList = subs.length
                ? subs.map(s => `${renderIcon(s.icon || '·', 12)} ${escapeHtml(s.name)}: ${fmtMoney(s.budgetAmount || 0)}`).join(' · ')
                : '—';
            return `<tr>
                <td class="col-month">${fmtMonth(mk)}</td>
                <td class="col-budget">${fmtMoney(v.budgetAmount || 0)}</td>
                <td class="col-subs">${subList}</td>
                <td class="col-actions">
                    <button class="dv2-mini-btn" data-restore-version="${mk}" title="Restaurar esta versión al mes actual"><i class="fas fa-rotate-left"></i></button>
                    <button class="dv2-mini-btn" data-delete-version="${mk}" style="color:var(--danger)" title="Eliminar versión"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px">Sin versiones guardadas</td></tr>';

        const body = openModal(
            `<span class="dv2-badge" style="background:#8b5cf6"><i class="fas fa-clock-rotate-left"></i></span> Historial de versiones · ${escapeHtml(title)}`,
            '#8b5cf6',
            `<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">
                Cada mes que edites este item se guarda como versión independiente. Los meses sin versión propia heredan la última anterior.
            </div>
            <div style="overflow-x:auto;">
                <table class="dv2-vers-table">
                    <thead><tr><th>Mes</th><th>Presupuesto</th><th>Subcategorías</th><th></th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`,
            `<button class="btn btn-secondary" id="dv2VersClose">Cerrar</button>`
        );

        body.parentElement.querySelector('#dv2VersClose').onclick = closeModal;

        body.querySelectorAll('[data-restore-version]').forEach(btn => {
            btn.onclick = () => {
                const mk = btn.dataset.restoreVersion;
                const v = versions[mk];
                if (!v) return;
                if (!confirm(`¿Restaurar la versión de ${fmtMonth(mk)} al mes actual?\n\nSe sobrescribirán los valores actuales.`)) return;
                const currentMk = currentMonthKey();
                if (!target.versions) target.versions = {};
                const backup = JSON.parse(JSON.stringify(v));
                if (backup.subcategories && backup.subcategories.length) {
                    const currentSubs = target.subcategories || [];
                    const nextSubs = backup.subcategories.map(s => {
                        const existing = currentSubs.find(x => x.id === s.id);
                        return existing ? {
                            ...existing,
                            name: s.name || existing.name,
                            icon: s.icon || existing.icon,
                            budgetAmount: Number(s.budgetAmount || 0)
                        } : {
                            id: s.id || uid('sub'),
                            name: s.name || 'Sub',
                            icon: s.icon || '·',
                            includeInBudget: true,
                            budgetAmount: Number(s.budgetAmount || 0),
                            versions: {},
                            budgetHistory: {}
                        };
                    });
                    target.subcategories = nextSubs;
                    target.versions[currentMk] = { budgetAmount: 0, subcategories: backup.subcategories };
                    recalcParentBudget(target);
                } else {
                    target.versions[currentMk] = { budgetAmount: Number(backup.budgetAmount || 0) };
                }
                saveData();
                closeModal();
                renderAll();
                toast(`Versión de ${fmtMonth(mk)} restaurada`, 'success');
            };
        });

        body.querySelectorAll('[data-delete-version]').forEach(btn => {
            btn.onclick = () => {
                const mk = btn.dataset.deleteVersion;
                if (!confirm(`¿Eliminar la versión de ${fmtMonth(mk)}?`)) return;
                delete target.versions[mk];
                saveData();
                closeModal();
                renderAll();
                toast(`Versión de ${fmtMonth(mk)} eliminada`, 'success');
            };
        });
    }

    /* =========================================================
       EDITOR DE SUBCATEGORÍAS (dentro de modales de item)
       ========================================================= */
    function subcatEditorHTML(item) {
        const subs = item.subcategories || [];
        const rows = subs.map((sub, idx) => {
            const v = getEffectiveVersion(sub, currentMonthKey());
            return `
            <div class="dv2-subcat-editor-row" data-subcat-id="${sub.id}">
                <span class="icon-prev">${renderIcon(sub.icon || '·', 16)}</span>
                <input class="sub-name" placeholder="Nombre" value="${escapeHtml(sub.name || '')}">
                <input class="sub-budget" type="number" step="0.01" min="0" placeholder="Presupuesto" value="${Number(v.budgetAmount || 0)}">
                <button type="button" class="del" title="Eliminar"><i class="fas fa-times"></i></button>
            </div>`;
        }).join('');
        return `
        <div class="dv2-subcat-editor">
            <div class="dv2-subcat-editor-head">
                <strong>Subcategorías (${subs.length})</strong>
                <button type="button" class="dv2-mini-btn" id="dv2SubcatAdd"><i class="fas fa-plus"></i> Añadir</button>
            </div>
            <div id="dv2SubcatList">${rows || '<div style="font-size:12px;color:var(--text-muted);padding:6px 0">Sin subcategorías</div>'}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">
                💡 Si añades subcategorías, el presupuesto del padre pasará a ser la suma automáticamente.
            </div>
        </div>`;
    }

    function bindSubcatEditor(body, item) {
        const addBtn = body.querySelector('#dv2SubcatAdd');
        const list = body.querySelector('#dv2SubcatList');
        if (!addBtn || !list) return;

        addBtn.onclick = () => {
            const id = uid('sub');
            const div = document.createElement('div');
            div.className = 'dv2-subcat-editor-row';
            div.dataset.subcatId = id;
            div.innerHTML = `
                <span class="icon-prev">·</span>
                <input class="sub-name" placeholder="Nombre" value="">
                <input class="sub-budget" type="number" step="0.01" min="0" placeholder="Presupuesto" value="0">
                <button type="button" class="del" title="Eliminar"><i class="fas fa-times"></i></button>`;
            const empty = list.querySelector('div[style*="color:var(--text-muted)"]');
            if (empty) empty.remove();
            list.appendChild(div);
            div.querySelector('.sub-name').focus();
        };

        list.addEventListener('click', (e) => {
            const del = e.target.closest('.del');
            if (del) {
                del.closest('.dv2-subcat-editor-row').remove();
            }
        });
    }

    function collectSubcatsFromEditor(body, item) {
        const rows = body.querySelectorAll('.dv2-subcat-editor-row');
        const mk = currentMonthKey();
        const existing = item.subcategories || [];
        const result = [];
        rows.forEach(row => {
            const id = row.dataset.subcatId || uid('sub');
            const name = row.querySelector('.sub-name').value.trim();
            const budget = round2(parseFloat(row.querySelector('.sub-budget').value) || 0);
            if (!name) return;
            const prev = existing.find(x => x.id === id);
            const versions = prev ? (prev.versions || {}) : {};
            versions[mk] = { budgetAmount: budget };
            result.push({
                id, name,
                icon: prev ? prev.icon : '·',
                includeInBudget: true,
                budgetAmount: budget,
                versions,
                budgetHistory: versions
            });
        });
        return result;
    }

    /* =========================================================
       MODALES ESPECÍFICOS
       ========================================================= */
    function openAccountEditor(focusAccId) {
        const rows = getAccounts().map(a => `
            <div class="dv2-mov-line" style="align-items:center;border-bottom:1px solid var(--border-light)">
                <span style="flex:1;font-weight:600;font-size:12.5px">${renderIcon(a.icon || '🏦', 16)} ${escapeHtml(a.name)}</span>
                <input class="dv2-input accBal" data-acc="${a.id}" type="number" step="0.01" value="${a.balance}" style="width:110px;text-align:right">
            </div>`).join('');
        const body = openModal(
            '<span class="dv2-badge" style="--dv2-accent:#2563eb;background:#2563eb">🏦</span> Saldos de cuentas físicas',
            '#2563eb',
            `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">Introduce el saldo real actual de cada cuenta.</div>
            ${rows}`,
            `<button class="btn btn-secondary" id="dv2AccCancel">Cancelar</button><button class="btn btn-primary" id="dv2AccSave"><i class="fas fa-save"></i> Guardar saldos</button>`
        );
        body.querySelector('#dv2AccCancel').onclick = closeModal;
        body.parentElement.querySelector('#dv2AccSave').onclick = () => {
            body.querySelectorAll('.accBal').forEach(i => {
                const acc = getAccounts().find(a => a.id === i.dataset.acc);
                if (acc) acc.balance = round2(parseFloat(i.value) || 0);
            });
            App.saveData();
            closeModal(); renderAll();
            App.notifyModuleChange && App.notifyModuleChange('mi-dinero', { reason: 'accounts-updated' });
            toast('Saldos actualizados');
        };
    }

    function openWalletModal(editId) {
        const w = editId ? data.wallets.find(x => x.id === editId) : null;
        const accOpts = getAccounts().map(a => ({ v: a.id, l: `${a.icon || '🏦'} ${a.name}` }));
        const effVersion = w ? getEffectiveVersion(w, currentMonthKey()) : { budgetAmount: 0 };
        const accIncludes = w && w.includeInBudget;
        const accAmt = w && w.budgetAmount > 0 ? w.budgetAmount : '';

        const body = openModal(
            `<span class="dv2-badge" style="background:#f59e0b">${w ? renderIcon(w.emoji, 16) : '👛'}</span> ${w ? 'Monedero: ' + escapeHtml(w.name) : 'Nuevo monedero'}`,
            '#f59e0b',
            `
            ${f('fw1', 'Icono', emojiPicker('dv2WEmoji', w ? w.emoji : '👛'))}
            ${f('fw2', 'Nombre', inp('dv2WName', { value: w ? w.name : '', placeholder: 'Ej. Comida' }))}
            ${f('fwAcc', 'Cuenta principal', sel('dv2WAcc', [{v:'', l:'— Ninguna —'}].concat(accOpts), w ? w.accountId : ''))}

            <div class="dv2-budget-block">
                <label class="dv2-budget-switch-row">
                    <span class="dv2-switch">
                        <input type="checkbox" id="dv2WInclBudget" ${accIncludes ? 'checked' : ''}>
                        <span class="dv2-switch-slider"></span>
                    </span>
                    <span class="dv2-budget-switch-label">Añadir al Presupuesto</span>
                </label>
                <div class="dv2-budget-amount-wrap" id="dv2WBudgetAmtWrap" style="display:${accIncludes ? 'block' : 'none'};">
                    <label class="dv2-budget-amount-label">Cantidad a añadir (si es diferente a la habitual)</label>
                    <input class="dv2-input" type="number" step="0.01" min="0" id="dv2WBudgetAmt"
                           placeholder="Dejar vacío = importe habitual"
                           value="${accAmt}" style="width:100%">
                </div>
            </div>

            ${subcatEditorHTML(w || { subcategories: [] })}
            `,
            `${w ? '<button class="dv2-danger-link" id="dv2WDel">Eliminar monedero</button>' : ''}<button class="btn btn-secondary" id="dv2WCancel">${w ? 'Cerrar' : 'Cancelar'}</button><button class="btn btn-primary" id="dv2WSave"><i class="fas fa-save"></i> ${w ? 'Guardar cambios' : 'Crear monedero'}</button>`
        );
        bindEmojiPicker(body, 'dv2WEmoji');
        bindSubcatEditor(body, w || { subcategories: [] });

        const wTgl = body.querySelector('#dv2WInclBudget');
        const wWrap = body.querySelector('#dv2WBudgetAmtWrap');
        wTgl.addEventListener('change', () => { wWrap.style.display = wTgl.checked ? 'block' : 'none'; });

        body.parentElement.querySelector('#dv2WCancel').onclick = closeModal;
        body.parentElement.querySelector('#dv2WSave').onclick = () => {
            const name = body.querySelector('#dv2WName').value.trim();
            if (!name) { toast('El monedero necesita un nombre', 'error'); return; }
            const emoji = pickedEmoji(body, 'dv2WEmoji');
            const accId = body.querySelector('#dv2WAcc').value;
            const incl = wTgl.checked;
            const amtRaw = body.querySelector('#dv2WBudgetAmt').value;
            const mk = currentMonthKey();
            const subcats = collectSubcatsFromEditor(body, w || { subcategories: [] });
            let budgetAmount;
            if (subcats.length > 0) {
                budgetAmount = subcats.reduce((s, sc) => s + Number(sc.budgetAmount || 0), 0);
            } else {
                budgetAmount = incl && amtRaw && parseFloat(amtRaw) > 0 ? round2(parseFloat(amtRaw)) : 0;
            }

            if (w) {
                w.name = name; w.emoji = emoji; w.accountId = accId;
                w.includeInBudget = incl;
                w.subcategories = subcats;
                if (!w.versions) w.versions = {};
                if (!w.versions[mk]) w.versions[mk] = {};
                w.versions[mk].budgetAmount = budgetAmount;
                w.versions[mk].subcategories = subcats.map(s => ({ id: s.id, name: s.name, icon: s.icon, budgetAmount: s.budgetAmount }));
                w.budgetAmount = budgetAmount;
                toast('Monedero actualizado');
            } else {
                const versions = {};
                versions[mk] = { budgetAmount, subcategories: subcats.map(s => ({ id: s.id, name: s.name, icon: s.icon, budgetAmount: s.budgetAmount })) };
                data.wallets.push({
                    id: uid('w'), emoji, name, color: '#f59e0b', accountId: accId,
                    includeInBudget: incl, budgetAmount, versions,
                    subcategories: subcats, movements: []
                });
                toast('Monedero creado');
            }
            saveData(); closeModal(); renderAll();
        };

        if (w) {
            body.parentElement.querySelector('#dv2WDel').onclick = () => confirmDelete(`¿Eliminar el monedero «${w.name}»?`, () => {
                data.wallets = data.wallets.filter(x => x.id !== w.id);
                data.movements.forEach(m => { if (m.link && m.link.kind === 'wallet' && m.link.id === w.id) m.link = null; });
                saveData(); closeModal(); renderAll(); toast('Monedero eliminado');
            });
        }
    }

    function openWalletDetailModal(id) {
        const w = data.wallets.find(x => x.id === id); if (!w) return;
        const movs = [...w.movements].sort((a, b) => b.date.localeCompare(a.date));
        const body = openModal(
            `<span class="dv2-badge" style="background:${w.color}">${renderIcon(w.emoji || '👛', 16)}</span> ${escapeHtml(w.name)} · monedero`,
            w.color,
            `
            <div class="dv2-wallet-amt" style="color:${w.color};margin-bottom:8px">${fmtMoney(walletBalance(w))}</div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin:16px 0 8px;">
                <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);">Movimientos (${movs.length})</div>
                <button class="dv2-mini-btn" id="dv2WDAddMov" style="padding:4px 8px;"><i class="fas fa-plus"></i> Añadir</button>
            </div>

            <div style="max-height:300px; overflow-y:auto;">
                ${movs.length ? movs.map(m => `
                    <div class="dv2-mov-line" data-mov-id="${m.id}" style="cursor:pointer; padding:8px 6px; border-radius:6px; transition:background .15s;" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='transparent'">
                        <span class="dv2-mov-date">${fmtDate(m.date)}</span>
                        <span style="flex:1;font-weight:600;">${escapeHtml(m.concept || '—')}</span>
                        <span class="${m.type === 'out' ? 'dv2-neg' : 'dv2-pos'}">${m.type === 'out' ? '−' : '+'}${fmtMoney(Math.abs(m.amount))}</span>
                    </div>`).join('') : '<div class="dv2-empty">Sin movimientos</div>'}
            </div>`,
            `<button class="dv2-danger-link" id="dv2WDDel">Eliminar monedero</button>
             <button class="btn btn-secondary" id="dv2WDClose">Cerrar</button>
             <button class="btn btn-primary" id="dv2WDEdit"><i class="fas fa-pen"></i> Editar monedero</button>`
        );
        
        body.parentElement.querySelector('#dv2WDClose').onclick = closeModal;
        body.parentElement.querySelector('#dv2WDEdit').onclick = () => { closeModal(); openWalletModal(w.id); };
        
        body.parentElement.querySelector('#dv2WDDel').onclick = () => confirmDelete(`¿Eliminar «${w.name}»?`, () => {
            data.wallets = data.wallets.filter(x => x.id !== w.id);
            saveData(); closeModal(); renderAll(); toast('Monedero eliminado');
        });

        // Eventos para los movimientos
        body.querySelector('#dv2WDAddMov').onclick = () => openWalletMovementModal(w.id, null);
        body.querySelectorAll('[data-mov-id]').forEach(el => {
            el.onclick = () => openWalletMovementModal(w.id, el.dataset.movId);
        });
    }

    function openWalletMovementModal(walletId, movId) {
        const w = data.wallets.find(x => x.id === walletId); if (!w) return;
        const mv = movId ? w.movements.find(m => m.id === movId) : null;

        const body = openModal(
            `<span class="dv2-badge" style="background:${w.color}">${renderIcon(w.emoji || '👛', 16)}</span> ${mv ? 'Editar' : 'Nuevo'} movimiento`,
            w.color,
            `
            <div class="dv2-row2">
                ${f('wmv1', 'Concepto', inp('wmvConcept', { value: mv ? mv.concept : '', placeholder: 'Ej. Compra semanal' }))}
                ${f('wmv2', 'Importe (€)', inp('wmvAmt', { type: 'number', step: '0.01', min: '0', value: mv ? Math.abs(mv.amount) : '' }))}
            </div>
            <div class="dv2-row2">
                ${f('wmv3', 'Fecha', inp('wmvDate', { type: 'date', value: mv ? mv.date : todayISO() }))}
                ${f('wmv4', 'Tipo', sel('wmvType', [{v:'out',l:'Gasto'},{v:'in',l:'Ingreso'}], mv ? mv.type : 'out'))}
            </div>`,
            `${mv ? '<button class="dv2-danger-link" id="wmvDel">Eliminar movimiento</button>' : ''}
             <button class="btn btn-secondary" id="wmvCancel">Cancelar</button>
             <button class="btn btn-primary" id="wmvSave">Guardar</button>`
        );

        body.parentElement.querySelector('#wmvCancel').onclick = () => { closeModal(); openWalletDetailModal(walletId); };
        
        body.parentElement.querySelector('#wmvSave').onclick = () => {
            const concept = body.querySelector('#wmvConcept').value.trim() || 'Movimiento manual';
            const amt = round2(parseFloat(body.querySelector('#wmvAmt').value));
            const date = body.querySelector('#wmvDate').value || todayISO();
            const type = body.querySelector('#wmvType').value;
            if (isNaN(amt) || amt <= 0) { toast('Importe no válido', 'error'); return; }

            if (mv) {
                mv.concept = concept; mv.amount = amt; mv.date = date; mv.type = type;
            } else {
                w.movements.push({ id: uid('wm'), concept, amount: amt, date, type });
            }
            saveData();
            closeModal();
            openWalletDetailModal(walletId);
        };

        if (mv) {
            body.parentElement.querySelector('#wmvDel').onclick = () => {
                w.movements = w.movements.filter(m => m.id !== movId);
                saveData();
                closeModal();
                openWalletDetailModal(walletId);
            };
        }
    }

    /* --- DEBT MODAL (MODIFICADO CON TROCEO) --- */
    function openDebtModal(editId) {
        const d = editId ? data.debts.find(x => x.id === editId) : null;
        let kind = d ? d.kind : 'pay';
        const accOpts = getAccounts().map(a => ({ v: a.id, l: `${a.icon || '🏦'} ${a.name}` }));
        const effVersion = d ? getEffectiveVersion(d, currentMonthKey()) : { budgetAmount: 0 };
        let plannedSplits = d && d.plannedSplits ? JSON.parse(JSON.stringify(d.plannedSplits)) : [];

        const body = openModal(
            `<span class="dv2-badge" style="background:${kind === 'pay' ? '#ef4444' : '#0ea5e9'}">${d ? renderIcon(d.emoji, 16) : '🔄'}</span> ${d ? 'Editar deuda' : 'Nueva deuda'}`,
            '#ef4444',
            `
            <div class="dv2-field"><label>Tipo</label>
                <div class="dv2-seg" id="dv2DKind" style="--dv2-accent:#ef4444">
                    <button type="button" data-kind="pay" class="${kind === 'pay' ? 'sel' : ''}">A devolver</button>
                    <button type="button" data-kind="receive" class="${kind === 'receive' ? 'sel' : ''}">A cobrar</button>
                </div>
            </div>
            ${f('fd1', 'Icono', emojiPicker('dv2DEmoji', d ? d.emoji : '💇'))}
            ${f('fd2', 'Nombre', inp('dv2DName', { value: d ? d.name : '' }))}
            <div class="dv2-row2">
                ${f('fd3', 'Importe total (€)', inp('dv2DAmt', { type: 'number', step: '0.01', min: '0', value: d ? d.total : '' }))}
                ${f('fd4', 'Fecha estimada', inp('dv2DDue', { type: 'date', value: d ? d.dueDate || '' : '' }))}
            </div>
            ${f('fdAcc', 'Cuenta', sel('dv2DAcc', [{v:'', l:'— Sin cuenta —'}].concat(accOpts), d ? d.accountId : ''))}

            <div class="dv2-budget-block">
                <label class="dv2-budget-switch-row">
                    <span class="dv2-switch">
                        <input type="checkbox" id="dv2DInclBudget" ${d && d.includeInBudget ? 'checked' : ''}>
                        <span class="dv2-switch-slider"></span>
                    </span>
                    <span class="dv2-budget-switch-label">Añadir al Presupuesto</span>
                </label>
                <div class="dv2-budget-amount-wrap" id="dv2DBudgetAmtWrap" style="display:${d && d.includeInBudget ? 'block' : 'none'};">
                    <label class="dv2-budget-amount-label">Cantidad (vacío = total deuda)</label>
                    <input class="dv2-input" type="number" step="0.01" min="0" id="dv2DBudgetAmt" value="${d && d.budgetAmount > 0 ? d.budgetAmount : ''}" style="width:100%">
                    
                    <div style="margin-top:12px; border-top:1px dashed var(--border); padding-top:12px;">
                        <div style="font-size:11.5px; font-weight:700; color:var(--text-muted); margin-bottom:6px;">TROCEO DEL PAGO (Opcional)</div>
                        <div id="dv2DSplitsList" style="display:flex; flex-direction:column; gap:6px; margin-bottom:8px;">
                            <!-- Se rellena con JS -->
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button type="button" class="dv2-mini-btn" id="dv2DAddSplit"><i class="fas fa-plus"></i> Añadir Mes</button>
                            <button type="button" class="dv2-mini-btn" id="dv2DSplitEven" style="color:var(--primary)">Equidistar</button>
                        </div>
                    </div>
                </div>
            </div>

            ${f('fd5', 'Contraparte', inp('dv2DCounterparty', { value: d ? d.counterparty || '' : '' }))}
            ${f('fd7', 'Nota', inp('dv2DNote', { value: d ? d.note || '' : '' }))}

            ${subcatEditorHTML(d || { subcategories: [] })}
            `,
            `${d ? '<button class="dv2-danger-link" id="dv2DDel">Eliminar</button>' : ''}<button class="btn btn-secondary" id="dv2DCancel">Cancelar</button><button class="btn btn-primary" id="dv2DSave"><i class="fas fa-save"></i> Guardar</button>`
        );
        bindEmojiPicker(body, 'dv2DEmoji');
        bindSubcatEditor(body, d || { subcategories: [] });

        const seg = body.querySelector('#dv2DKind');
        seg.addEventListener('click', (e) => {
            const b = e.target.closest('[data-kind]'); if (!b) return;
            kind = b.dataset.kind;
            seg.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
        });

        const dTgl = body.querySelector('#dv2DInclBudget');
        const dWrap = body.querySelector('#dv2DBudgetAmtWrap');
        dTgl.addEventListener('change', () => { dWrap.style.display = dTgl.checked ? 'block' : 'none'; });

        // Lógica del Troceo
        function renderSplits() {
            const list = body.querySelector('#dv2DSplitsList');
            list.innerHTML = plannedSplits.map((s, i) => `
                <div style="display:flex; gap:6px; align-items:center;">
                    <input type="month" class="dv2-input" style="flex:1;" value="${s.month}" onchange="window.updateSplit(${i}, 'month', this.value)">
                    <input type="number" class="dv2-input" style="width:100px;" value="${s.amount}" onchange="window.updateSplit(${i}, 'amount', this.value)">
                    <button type="button" class="dv2-mini-btn" style="color:var(--danger)" onclick="window.removeSplit(${i})"><i class="fas fa-times"></i></button>
                </div>
            `).join('');
        }
        window.updateSplit = (i, key, val) => { plannedSplits[i][key] = val; };
        window.removeSplit = (i) => { plannedSplits.splice(i, 1); renderSplits(); };

        body.querySelector('#dv2DAddSplit').onclick = () => {
            plannedSplits.push({ month: currentMonthKey(), amount: 0 });
            renderSplits();
        };
        body.querySelector('#dv2DSplitEven').onclick = () => {
            const total = parseFloat(body.querySelector('#dv2DAmt').value) || 0;
            const n = plannedSplits.length || 2;
            const per = round2(total / n);
            plannedSplits.forEach(s => s.amount = per);
            renderSplits();
        };
        renderSplits();

        body.parentElement.querySelector('#dv2DCancel').onclick = closeModal;
        body.parentElement.querySelector('#dv2DSave').onclick = () => {
            const name = body.querySelector('#dv2DName').value.trim();
            const total = round2(parseFloat(body.querySelector('#dv2DAmt').value));
            if (!name || isNaN(total) || total <= 0) { toast('Nombre e importe válidos requeridos', 'error'); return; }
            const incl = dTgl.checked;
            const amtRaw = body.querySelector('#dv2DBudgetAmt').value;
            const mk = currentMonthKey();
            const subcats = collectSubcatsFromEditor(body, d || { subcategories: [] });

            let budgetAmount;
            if (subcats.length > 0) {
                budgetAmount = subcats.reduce((s, sc) => s + Number(sc.budgetAmount || 0), 0);
            } else {
                budgetAmount = incl && amtRaw && parseFloat(amtRaw) > 0 ? round2(parseFloat(amtRaw)) : (incl ? total : 0);
            }

            const versions = d ? (d.versions || {}) : {};
            if (!versions[mk]) versions[mk] = {};
            versions[mk].budgetAmount = budgetAmount;
            versions[mk].subcategories = subcats.map(s => ({ id: s.id, name: s.name, icon: s.icon, budgetAmount: s.budgetAmount }));

            const obj = {
                id: d ? d.id : uid('d'), kind, emoji: pickedEmoji(body, 'dv2DEmoji'),
                name, total, returned: d ? d.returned : 0,
                dueDate: body.querySelector('#dv2DDue').value || '',
                accountId: body.querySelector('#dv2DAcc').value || null,
                includeInBudget: incl, budgetAmount,
                versions, subcategories: subcats,
                plannedSplits: plannedSplits.filter(s => s.amount > 0), // AÑADIDO
                counterparty: body.querySelector('#dv2DCounterparty').value.trim(),
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

    function openDebtDetailModal(id) {
        const d = data.debts.find(x => x.id === id); if (!d) return;
        const col = d.kind === 'pay' ? '#ef4444' : '#0ea5e9';
        const pct = d.total ? Math.min(100, Math.round(d.returned / d.total * 100)) : 0;
        const body = openModal(
            `<span class="dv2-badge" style="background:${col}">${renderIcon(d.emoji, 16)}</span> ${escapeHtml(d.name)}`,
            col,
            `<div class="dv2-wallet-amt" style="color:${col};margin-bottom:6px">${fmtMoney(d.total)}</div>
             <div class="dv2-progress" style="--dv2-accent:${col}"><div class="dv2-progress-fill" style="width:${pct}%"></div></div>
             <div class="dv2-progress-meta"><span>Cubierto: ${fmtMoney(d.returned)} (${pct}%)</span><span>Restante: ${fmtMoney(Math.max(0, d.total - d.returned))}</span></div>`,
            `<button class="btn btn-secondary" id="dv2DClose">Cerrar</button><button class="btn btn-primary" id="dv2DEdit"><i class="fas fa-pen"></i> Editar</button>`
        );
        body.parentElement.querySelector('#dv2DClose').onclick = closeModal;
        body.parentElement.querySelector('#dv2DEdit').onclick = () => { closeModal(); openDebtModal(d.id); };
    }

    /* --- LOAN MODAL --- */
    function openLoanModal(editId) {
        const l = editId ? data.loans.find(x => x.id === editId) : null;
        const accNames = getAccounts().map(a => ({ v: a.name, l: `${a.icon || '🏦'} ${a.name}` }));
        const body = openModal(
            `<span class="dv2-badge" style="background:#8b5cf6">${l ? renderIcon(l.emoji, 16) : '🏦'}</span> ${l ? 'Editar préstamo' : 'Nuevo préstamo'}`,
            '#8b5cf6',
            `
            ${f('fl0', 'Icono', emojiPicker('dv2LEmoji', l ? l.emoji : '🛋️'))}
            ${f('fl1', 'Nombre', inp('dv2LName', { value: l ? l.name : '' }))}
            <div class="dv2-row2">
                ${f('fl2', 'Importe financiado (€)', inp('dv2LAmt', { type: 'number', step: '0.01', min: '0', value: l ? l.financed : '' }))}
                ${f('fl3', 'Nº total de cuotas', inp('dv2LInst', { type: 'number', min: '1', value: l ? l.installments : '' }))}
            </div>
            <div class="dv2-row2">
                ${f('fl4', 'Por cuota (€)', inp('dv2LQi', { type: 'number', step: '0.01', min: '0', value: l ? l.installmentAmount : '' }))}
                ${f('fl5', 'Cuotas pagadas', inp('dv2LPaid', { type: 'number', min: '0', value: l ? l.paidCount : 0 }))}
            </div>
            ${f('fl6', 'Próximo recibo', inp('dv2LNext', { type: 'date', value: l ? l.nextDate || '' : todayISO() }))}
            ${f('fl7', 'Cuenta', sel('dv2LAcc', accNames, l ? l.accountName : (accNames[0] || {}).v))}

            <div class="dv2-budget-block">
                <label class="dv2-budget-switch-row">
                    <span class="dv2-switch">
                        <input type="checkbox" id="dv2LInclBudget" ${l && l.includeInBudget ? 'checked' : ''}>
                        <span class="dv2-switch-slider"></span>
                    </span>
                    <span class="dv2-budget-switch-label">Añadir al Presupuesto</span>
                </label>
                <div class="dv2-budget-amount-wrap" id="dv2LBudgetAmtWrap" style="display:${l && l.includeInBudget ? 'block' : 'none'};">
                    <label class="dv2-budget-amount-label">Cantidad (vacío = cuota del préstamo)</label>
                    <input class="dv2-input" type="number" step="0.01" min="0" id="dv2LBudgetAmt" value="${l && l.budgetAmount > 0 ? l.budgetAmount : ''}" style="width:100%">
                </div>
            </div>

            ${subcatEditorHTML(l || { subcategories: [] })}
            `,
            `${l ? '<button class="dv2-danger-link" id="dv2LDel">Eliminar</button>' : ''}<button class="btn btn-secondary" id="dv2LCancel">Cancelar</button><button class="btn btn-primary" id="dv2LSave"><i class="fas fa-save"></i> Guardar</button>`
        );
        bindEmojiPicker(body, 'dv2LEmoji');
        bindSubcatEditor(body, l || { subcategories: [] });

        const auto = () => {
            const tot = parseFloat(body.querySelector('#dv2LAmt').value);
            const n = parseInt(body.querySelector('#dv2LInst').value);
            if (tot > 0 && n > 0) body.querySelector('#dv2LQi').value = round2(tot / n);
        };
        body.querySelector('#dv2LAmt').addEventListener('input', auto);
        body.querySelector('#dv2LInst').addEventListener('input', auto);

        const lTgl = body.querySelector('#dv2LInclBudget');
        const lWrap = body.querySelector('#dv2LBudgetAmtWrap');
        lTgl.addEventListener('change', () => { lWrap.style.display = lTgl.checked ? 'block' : 'none'; });

        body.parentElement.querySelector('#dv2LCancel').onclick = closeModal;
        body.parentElement.querySelector('#dv2LSave').onclick = () => {
            const name = body.querySelector('#dv2LName').value.trim();
            const financed = round2(parseFloat(body.querySelector('#dv2LAmt').value));
            const installments = parseInt(body.querySelector('#dv2LInst').value);
            const installmentAmount = round2(parseFloat(body.querySelector('#dv2LQi').value));
            const paidCount = Math.max(0, parseInt(body.querySelector('#dv2LPaid').value) || 0);
            if (!name || isNaN(financed) || isNaN(installments) || isNaN(installmentAmount) || installments <= 0) { toast('Revisa los datos', 'error'); return; }
            const incl = lTgl.checked;
            const amtRaw = body.querySelector('#dv2LBudgetAmt').value;
            const mk = currentMonthKey();
            const subcats = collectSubcatsFromEditor(body, l || { subcategories: [] });

            let budgetAmount;
            if (subcats.length > 0) {
                budgetAmount = subcats.reduce((s, sc) => s + Number(sc.budgetAmount || 0), 0);
            } else {
                budgetAmount = incl && amtRaw && parseFloat(amtRaw) > 0 ? round2(parseFloat(amtRaw)) : (incl ? installmentAmount : 0);
            }

            const versions = l ? (l.versions || {}) : {};
            if (!versions[mk]) versions[mk] = {};
            versions[mk].budgetAmount = budgetAmount;
            versions[mk].subcategories = subcats.map(s => ({ id: s.id, name: s.name, icon: s.icon, budgetAmount: s.budgetAmount }));

            const obj = {
                id: l ? l.id : uid('loan'), emoji: pickedEmoji(body, 'dv2LEmoji'),
                name, financed, installments, installmentAmount,
                paidCount: Math.min(paidCount, installments),
                nextDate: body.querySelector('#dv2LNext').value || null,
                accountName: body.querySelector('#dv2LAcc').value,
                includeInBudget: incl, budgetAmount, versions, subcategories: subcats,
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

    function openLoanDetailModal(id) {
        const l = data.loans.find(x => x.id === id); if (!l) return;
        const pending = loanPending(l);
        const done = l.paidCount >= l.installments;
        const pct = l.installments ? Math.round(l.paidCount / l.installments * 100) : 0;
        const movs = [...(l.payments || [])].sort((a, b) => b.date.localeCompare(a.date));
        const body = openModal(
            `<span class="dv2-badge" style="background:#8b5cf6">${renderIcon(l.emoji, 16)}</span> ${escapeHtml(l.name)} · préstamo`,
            '#8b5cf6',
            `
            <div class="dv2-wallet-amt" style="color:${done ? 'var(--success)' : 'var(--danger)'};margin-bottom:6px">${done ? '✅ Completado' : fmtMoney(pending) + ' pendientes'}</div>
            <div class="dv2-progress" style="--dv2-accent:#8b5cf6"><div class="dv2-progress-fill" style="width:${pct}%"></div></div>
            <div class="dv2-progress-meta"><span>Pagado: ${fmtMoney(l.financed - pending)}</span><span>${l.paidCount}/${l.installments} cuotas (${pct}%)</span></div>
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);margin:12px 0 6px">Cuotas (${movs.length})</div>
            ${movs.slice(0, 20).map(p => `
                <div class="dv2-mov-line">
                    <span class="dv2-mov-date">${fmtDate(p.date)}</span>
                    <span style="flex:1">Cuota #${p.n}</span>
                    <span class="dv2-neg">−${fmtMoney(p.amount)}</span>
                </div>`).join('') || '<div class="dv2-empty">Sin cuotas registradas</div>'}`,
            `${!done ? '<button class="btn btn-primary" id="dv2LPay"><i class="fas fa-check"></i> Pagar cuota</button>' : ''}
             <button class="btn btn-secondary" id="dv2LClose">Cerrar</button>
             <button class="btn btn-secondary" id="dv2LEdit"><i class="fas fa-pen"></i> Editar</button>`
        );
        body.parentElement.querySelector('#dv2LClose').onclick = closeModal;
        body.parentElement.querySelector('#dv2LEdit').onclick = () => { closeModal(); openLoanModal(l.id); };
        const payBtn = body.parentElement.querySelector('#dv2LPay');
        if (payBtn) payBtn.onclick = () => {
            payLoanInstallment(l.id);
            App.notifyModuleChange && App.notifyModuleChange('mi-dinero', { reason: 'loan-paid', loanId: l.id });
            closeModal();
        };
    }

    /* --- GOAL MODAL (MODIFICADO CON TROCEO) --- */
    function openGoalModal(editId) {
        const g = editId ? data.goals.find(x => x.id === editId) : null;
        const freqs = [{ v: 'none', l: 'Sin aportación' }, { v: 'weekly', l: 'Semanal' }, { v: 'biweekly', l: 'Quincenal' }, { v: 'monthly', l: 'Mensual' }];
        const isTripFund = g && g.id === 'g-trip-fund';
        let plannedSplits = g && g.plannedSplits ? JSON.parse(JSON.stringify(g.plannedSplits)) : [];

        const body = openModal(
            `<span class="dv2-badge" style="background:#10b981">${g ? renderIcon(g.emoji, 16) : '🎯'}</span> ${g ? 'Editar objetivo' : 'Nuevo objetivo'}`,
            '#10b981',
            `
            ${f('fg0', 'Icono', emojiPicker('dv2GEmoji', g ? g.emoji : '🎯'))}
            ${f('fg1', 'Nombre', inp('dv2GName', { value: g ? g.name : '' }))}
            <div class="dv2-row2">
                ${f('fg2', 'Meta (€)', inp('dv2GTarget', { type: 'number', step: '0.01', min: '0', value: g && g.target != null ? g.target : '' }))}
                ${f('fg3', 'Ahorrado (€)', inp('dv2GSaved', { type: 'number', step: '0.01', min: '0', value: g ? g.saved : 0 }))}
            </div>
            <div class="dv2-row2">
                ${f('fg4', 'Frecuencia', sel('dv2GFreq', freqs, g ? g.frequency : 'monthly'))}
                ${f('fg5', 'Por aportación (€)', inp('dv2GContrib', { type: 'number', step: '0.01', min: '0', value: g ? g.contribution : '' }))}
            </div>
            ${f('fg6', 'Próxima aportación', inp('dv2GNext', { type: 'date', value: g ? g.nextDate || '' : todayISO() }))}

            <div class="dv2-budget-block">
                <label class="dv2-budget-switch-row">
                    <span class="dv2-switch">
                        <input type="checkbox" id="dv2GInclBudget" ${g && g.includeInBudget ? 'checked' : ''}>
                        <span class="dv2-switch-slider"></span>
                    </span>
                    <span class="dv2-budget-switch-label">Añadir al Presupuesto</span>
                </label>
                <div class="dv2-budget-amount-wrap" id="dv2GBudgetAmtWrap" style="display:${g && g.includeInBudget ? 'block' : 'none'};">
                    <label class="dv2-budget-amount-label">Cantidad (vacío = aportación)</label>
                    <input class="dv2-input" type="number" step="0.01" min="0" id="dv2GBudgetAmt" value="${g && g.budgetAmount > 0 ? g.budgetAmount : ''}" style="width:100%">
                    
                    <div style="margin-top:12px; border-top:1px dashed var(--border); padding-top:12px;">
                        <div style="font-size:11.5px; font-weight:700; color:var(--text-muted); margin-bottom:6px;">TROCEO DE APORTACIONES (Opcional)</div>
                        <div id="dv2GSplitsList" style="display:flex; flex-direction:column; gap:6px; margin-bottom:8px;">
                            <!-- Se rellena con JS -->
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button type="button" class="dv2-mini-btn" id="dv2GAddSplit"><i class="fas fa-plus"></i> Añadir Mes</button>
                            <button type="button" class="dv2-mini-btn" id="dv2GSplitEven" style="color:var(--primary)">Equidistar</button>
                        </div>
                    </div>
                </div>
            </div>

            ${subcatEditorHTML(g || { subcategories: [] })}
            `,
            `${g && !isTripFund ? '<button class="dv2-danger-link" id="dv2GDel">Eliminar</button>' : ''}<button class="btn btn-secondary" id="dv2GCancel">Cancelar</button><button class="btn btn-primary" id="dv2GSave"><i class="fas fa-save"></i> Guardar</button>`
        );
        bindEmojiPicker(body, 'dv2GEmoji');
        bindSubcatEditor(body, g || { subcategories: [] });

        const gTgl = body.querySelector('#dv2GInclBudget');
        const gWrap = body.querySelector('#dv2GBudgetAmtWrap');
        gTgl.addEventListener('change', () => { gWrap.style.display = gTgl.checked ? 'block' : 'none'; });

        // Lógica del Troceo
        function renderSplits() {
            const list = body.querySelector('#dv2GSplitsList');
            list.innerHTML = plannedSplits.map((s, i) => `
                <div style="display:flex; gap:6px; align-items:center;">
                    <input type="month" class="dv2-input" style="flex:1;" value="${s.month}" onchange="window.updateGSplit(${i}, 'month', this.value)">
                    <input type="number" class="dv2-input" style="width:100px;" value="${s.amount}" onchange="window.updateGSplit(${i}, 'amount', this.value)">
                    <button type="button" class="dv2-mini-btn" style="color:var(--danger)" onclick="window.removeGSplit(${i})"><i class="fas fa-times"></i></button>
                </div>
            `).join('');
        }
        window.updateGSplit = (i, key, val) => { plannedSplits[i][key] = val; };
        window.removeGSplit = (i) => { plannedSplits.splice(i, 1); renderSplits(); };

        body.querySelector('#dv2GAddSplit').onclick = () => {
            plannedSplits.push({ month: currentMonthKey(), amount: 0 });
            renderSplits();
        };
        body.querySelector('#dv2GSplitEven').onclick = () => {
            const total = parseFloat(body.querySelector('#dv2GTarget').value) || 0;
            const n = plannedSplits.length || 2;
            const per = round2(total / n);
            plannedSplits.forEach(s => s.amount = per);
            renderSplits();
        };
        renderSplits();

        body.parentElement.querySelector('#dv2GCancel').onclick = closeModal;
        body.parentElement.querySelector('#dv2GSave').onclick = () => {
            const name = body.querySelector('#dv2GName').value.trim();
            if (!name) { toast('El objetivo necesita un nombre', 'error'); return; }
            const targetRaw = body.querySelector('#dv2GTarget').value;
            const incl = gTgl.checked;
            const amtRaw = body.querySelector('#dv2GBudgetAmt').value;
            const mk = currentMonthKey();
            const subcats = collectSubcatsFromEditor(body, g || { subcategories: [] });
            const contrib = round2(parseFloat(body.querySelector('#dv2GContrib').value) || 0);

            let budgetAmount;
            if (subcats.length > 0) {
                budgetAmount = subcats.reduce((s, sc) => s + Number(sc.budgetAmount || 0), 0);
            } else {
                budgetAmount = incl && amtRaw && parseFloat(amtRaw) > 0 ? round2(parseFloat(amtRaw)) : (incl ? contrib : 0);
            }

            const versions = g ? (g.versions || {}) : {};
            if (!versions[mk]) versions[mk] = {};
            versions[mk].budgetAmount = budgetAmount;
            versions[mk].subcategories = subcats.map(s => ({ id: s.id, name: s.name, icon: s.icon, budgetAmount: s.budgetAmount }));

            const obj = {
                id: g ? g.id : uid('g'), emoji: pickedEmoji(body, 'dv2GEmoji'), name,
                target: targetRaw === '' ? null : round2(parseFloat(targetRaw)),
                saved: round2(parseFloat(body.querySelector('#dv2GSaved').value) || 0),
                frequency: body.querySelector('#dv2GFreq').value,
                contribution: contrib,
                nextDate: body.querySelector('#dv2GNext').value || '',
                includeInBudget: incl, budgetAmount, versions, subcategories: subcats,
                plannedSplits: plannedSplits.filter(s => s.amount > 0), // AÑADIDO
                contributions: g ? g.contributions : []
            };
            if (g) Object.assign(g, obj); else data.goals.push(obj);
            saveData(); closeModal(); renderAll(); toast(g ? 'Objetivo actualizado' : 'Objetivo creado');
        };
        const delBtn = body.parentElement.querySelector('#dv2GDel');
        if (g && delBtn) delBtn.onclick = () => confirmDelete(`¿Eliminar el objetivo «${g.name}»?`, () => {
            data.goals = data.goals.filter(x => x.id !== g.id);
            saveData(); closeModal(); renderAll();
        });
    }

    function openGoalDetailModal(id) {
        const g = data.goals.find(x => x.id === id); if (!g) return;
        const pct = g.target ? Math.min(100, Math.round(g.saved / g.target * 100)) : null;
        const movs = [...(g.contributions || [])].sort((a, b) => b.date.localeCompare(a.date));
        const body = openModal(
            `<span class="dv2-badge" style="background:#10b981">${renderIcon(g.emoji, 16)}</span> ${escapeHtml(g.name)} · objetivo`,
            '#10b981',
            `
            <div class="dv2-wallet-amt" style="color:#10b981;margin-bottom:6px">${fmtMoney(g.saved)}</div>
            ${g.target != null ? `
                <div class="dv2-progress" style="--dv2-accent:#10b981"><div class="dv2-progress-fill" style="width:${pct}%"></div></div>
                <div class="dv2-progress-meta"><span>Faltan: ${fmtMoney(goalRemaining(g))}</span><span>${pct}%</span></div>` : ''}
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);margin:12px 0 6px">Aportaciones (${movs.length})</div>
            ${movs.slice(0, 20).map(c => `
                <div class="dv2-mov-line">
                    <span class="dv2-mov-date">${fmtDate(c.date)}</span>
                    <span style="flex:1">Aportación</span>
                    <span class="dv2-pos">+${fmtMoney(c.amount)}</span>
                </div>`).join('') || '<div class="dv2-empty">Sin aportaciones</div>'}`,
            `<button class="btn btn-secondary" id="dv2GClose">Cerrar</button>
             <button class="btn btn-primary" id="dv2GContribAdd"><i class="fas fa-plus"></i> Aportar</button>
             <button class="btn btn-secondary" id="dv2GEdit"><i class="fas fa-pen"></i> Editar</button>`
        );
        body.parentElement.querySelector('#dv2GClose').onclick = closeModal;
        body.parentElement.querySelector('#dv2GEdit').onclick = () => { closeModal(); openGoalModal(g.id); };
        body.parentElement.querySelector('#dv2GContribAdd').onclick = () => { closeModal(); openContributionModal(g.id); };
    }

    function openContributionModal(goalId) {
        const gn = data.goals.find(x => x.id === goalId);
        if (!gn) return;
        const body = openModal(
            `<span class="dv2-badge" style="background:#10b981">${renderIcon(gn.emoji, 16)}</span> Aportar a «${escapeHtml(gn.name)}»`,
            '#10b981',
            `
            <div style="font-size:12.5px;color:var(--text-secondary)">${gn.target != null ? `Ahorrado: <strong>${fmtMoney(gn.saved)}</strong> de ${fmtMoney(gn.target)}` : `Ahorro libre: <strong>${fmtMoney(gn.saved)}</strong>`}</div>
            <div class="dv2-row2">
                ${f('fc1', 'Importe (€)', inp('dv2GAmt', { type: 'number', step: '0.01', min: '0', value: gn.contribution || '' }))}
                ${f('fc2', 'Fecha', inp('dv2GDate', { type: 'date', value: todayISO() }))}
            </div>
            ${f('fcAcc', 'Vincular a cuenta (descuenta el saldo real)', sel('dv2GAcc', [{v:'', l:'— Sin efecto en saldo —'}].concat(getAccounts().map(a => ({ v: a.id, l: `${a.icon || '🏦'} ${a.name}` }))), ''))}`,
            `<button class="btn btn-secondary" id="dv2GACancel">Cancelar</button><button class="btn btn-primary" id="dv2GASave"><i class="fas fa-plus"></i> Registrar</button>`
        );
        body.parentElement.querySelector('#dv2GACancel').onclick = closeModal;
        body.parentElement.querySelector('#dv2GASave').onclick = () => {
            const amt = round2(parseFloat(body.querySelector('#dv2GAmt').value));
            if (isNaN(amt) || amt <= 0) { toast('Importe no válido', 'error'); return; }
            const date = body.querySelector('#dv2GDate').value || todayISO();
            gn.saved = round2(gn.saved + amt);
            gn.contributions = gn.contributions || [];
            gn.contributions.push({ id: uid('gc'), date, amount: amt });
            if (gn.nextDate && date >= gn.nextDate) {
                const step = gn.frequency === 'weekly' ? 7 : gn.frequency === 'biweekly' ? 14 : 30;
                let nd = gn.nextDate;
                while (nd <= date) nd = addDays(nd, step);
                gn.nextDate = nd;
            }
            const accId = body.querySelector('#dv2GAcc').value;
            if (accId) registerMovement({ date, concept: `Aportación · ${gn.name}`, amount: -amt, type: 'out', accountId: accId, module: 'Objetivos', category: gn.name, link: { kind: 'goal', id: gn.id } });
            else { saveData(); renderAll(); }
            closeModal(); toast('Aportación registrada');
        };
    }

    /* --- RECURRING MODAL --- */
    function openRecurringModal(editId) {
        const r = editId ? data.recurring.find(x => x.id === editId) : null;
        const periods = [['weekly', 'Semanal'], ['monthly', 'Mensual'], ['quarterly', 'Trimestral'], ['semiannual', 'Semestral'], ['annual', 'Anual']].map(([v, l]) => ({ v, l }));
        const accNames = getAccounts().map(a => ({ v: a.name, l: `${a.icon || '🏦'} ${a.name}` }));
        const body = openModal(
            `<span class="dv2-badge" style="background:#0ea5e9">${r ? renderIcon(r.emoji, 16) : '🔁'}</span> ${r ? 'Editar pago recurrente' : 'Nuevo pago recurrente'}`,
            '#0ea5e9',
            `
            ${f('fr0', 'Icono', emojiPicker('dv2REmoji', r ? r.emoji : '📄'))}
            ${f('fr1', 'Nombre', inp('dv2RName', { value: r ? r.name : '' }))}
            <div class="dv2-row2">
                ${f('fr2', 'Importe (€)', inp('dv2RAmt', { type: 'number', step: '0.01', min: '0', value: r ? r.amount : '' }))}
                ${f('fr3', 'Periodicidad', sel('dv2RPeriod', periods, r ? r.period : 'monthly'))}
            </div>
            <div class="dv2-row2">
                ${f('fr4', 'Próximo cobro', inp('dv2RNext', { type: 'date', value: r ? r.nextDate || '' : todayISO() }))}
                ${f('fr5', 'Cuenta', sel('dv2RAcc', accNames, r ? r.accountName : (accNames[0] || {}).v))}
            </div>
            <div class="dv2-field"><label>Estado</label>
                <div class="dv2-seg" id="dv2RActive" style="--dv2-accent:#0ea5e9">
                    <button type="button" data-active="1" class="${!r || r.active ? 'sel' : ''}">Activo</button>
                    <button type="button" data-active="0" class="${r && !r.active ? 'sel' : ''}">Pausado</button>
                </div>
            </div>

            <div class="dv2-budget-block">
                <label class="dv2-budget-switch-row">
                    <span class="dv2-switch">
                        <input type="checkbox" id="dv2RInclBudget" ${r && r.includeInBudget ? 'checked' : ''}>
                        <span class="dv2-switch-slider"></span>
                    </span>
                    <span class="dv2-budget-switch-label">Añadir al Presupuesto</span>
                </label>
                <div class="dv2-budget-amount-wrap" id="dv2RBudgetAmtWrap" style="display:${r && r.includeInBudget ? 'block' : 'none'};">
                    <label class="dv2-budget-amount-label">Cantidad (vacío = importe del pago)</label>
                    <input class="dv2-input" type="number" step="0.01" min="0" id="dv2RBudgetAmt" value="${r && r.budgetAmount > 0 ? r.budgetAmount : ''}" style="width:100%">
                </div>
            </div>

            ${subcatEditorHTML(r || { subcategories: [] })}
            `,
            `${r ? '<button class="dv2-danger-link" id="dv2RDel">Eliminar</button>' : ''}<button class="btn btn-secondary" id="dv2RCancel">Cancelar</button><button class="btn btn-primary" id="dv2RSave"><i class="fas fa-save"></i> Guardar</button>`
        );
        bindEmojiPicker(body, 'dv2REmoji');
        bindSubcatEditor(body, r || { subcategories: [] });

        let active = r ? r.active : true;
        body.querySelector('#dv2RActive').addEventListener('click', (e) => {
            const b = e.target.closest('[data-active]'); if (!b) return;
            active = b.dataset.active === '1';
            body.querySelectorAll('#dv2RActive button').forEach(x => x.classList.toggle('sel', x === b));
        });

        const rTgl = body.querySelector('#dv2RInclBudget');
        const rWrap = body.querySelector('#dv2RBudgetAmtWrap');
        rTgl.addEventListener('change', () => { rWrap.style.display = rTgl.checked ? 'block' : 'none'; });

        body.parentElement.querySelector('#dv2RCancel').onclick = closeModal;
        body.parentElement.querySelector('#dv2RSave').onclick = () => {
            const name = body.querySelector('#dv2RName').value.trim();
            const amount = round2(parseFloat(body.querySelector('#dv2RAmt').value));
            if (!name || isNaN(amount) || amount <= 0) { toast('Nombre e importe válidos', 'error'); return; }
            const incl = rTgl.checked;
            const amtRaw = body.querySelector('#dv2RBudgetAmt').value;
            const mk = currentMonthKey();
            const subcats = collectSubcatsFromEditor(body, r || { subcategories: [] });

            let budgetAmount;
            if (subcats.length > 0) {
                budgetAmount = subcats.reduce((s, sc) => s + Number(sc.budgetAmount || 0), 0);
            } else {
                budgetAmount = incl && amtRaw && parseFloat(amtRaw) > 0 ? round2(parseFloat(amtRaw)) : (incl ? amount : 0);
            }

            const versions = r ? (r.versions || {}) : {};
            if (!versions[mk]) versions[mk] = {};
            versions[mk].budgetAmount = budgetAmount;
            versions[mk].subcategories = subcats.map(s => ({ id: s.id, name: s.name, icon: s.icon, budgetAmount: s.budgetAmount }));

            const obj = {
                id: r ? r.id : uid('r'), emoji: pickedEmoji(body, 'dv2REmoji'),
                name, amount, period: body.querySelector('#dv2RPeriod').value,
                nextDate: body.querySelector('#dv2RNext').value || null,
                accountName: body.querySelector('#dv2RAcc').value,
                active, includeInBudget: incl, budgetAmount, versions, subcategories: subcats,
                history: r ? r.history : []
            };
            if (r) Object.assign(r, obj); else data.recurring.push(obj);
            saveData(); closeModal(); renderAll(); toast(r ? 'Pago actualizado' : 'Pago creado');
        };
        if (r) body.parentElement.querySelector('#dv2RDel').onclick = () => confirmDelete(`¿Eliminar «${r.name}»?`, () => {
            data.recurring = data.recurring.filter(x => x.id !== r.id);
            saveData(); closeModal(); renderAll();
        });
    }

    function openRecurringDetailModal(id) {
        const r = data.recurring.find(x => x.id === id); if (!r) return;
        const movs = [...(r.history || [])].sort((a, b) => b.date.localeCompare(a.date));
        const body = openModal(
            `<span class="dv2-badge" style="background:#0ea5e9">${renderIcon(r.emoji, 16)}</span> ${escapeHtml(r.name)}`,
            '#0ea5e9',
            `<div class="dv2-wallet-amt" style="color:#0ea5e9;margin-bottom:6px">${fmtMoney(r.amount)} <span style="font-size:13px;color:var(--text-muted)">/ ${String(periodLabel(r.period)).toLowerCase()}</span></div>
             <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);margin:12px 0 6px">Historial (${movs.length})</div>
             ${movs.slice(0, 20).map(h => `<div class="dv2-mov-line"><span class="dv2-mov-date">${fmtDate(h.date)}</span><span style="flex:1">${escapeHtml(h.note || 'Cobro')}</span><span class="dv2-neg">−${fmtMoney(Math.abs(h.amount))}</span></div>`).join('') || '<div class="dv2-empty">Sin historial</div>'}`,
            `<button class="btn btn-secondary" id="dv2RClose">Cerrar</button>
             <button class="btn btn-primary" id="dv2REdit"><i class="fas fa-pen"></i> Editar</button>`
        );
        body.parentElement.querySelector('#dv2RClose').onclick = closeModal;
        body.parentElement.querySelector('#dv2REdit').onclick = () => { closeModal(); openRecurringModal(r.id); };
    }

    /* --- COMMITMENT MODAL (solo interno; sin botón público) --- */
    function openCommitmentModal(editId) {
        const c = editId ? data.commitments.find(x => x.id === editId) : null;
        const accOpts = getAccounts().map(a => ({ v: a.id, l: `${a.icon || '🏦'} ${a.name}` }));
        const body = openModal(
            `<span class="dv2-badge" style="background:#2563eb">📅</span> ${c ? 'Editar compromiso' : 'Nuevo compromiso'}`,
            '#2563eb',
            `
            ${f('f1', 'Nombre', inp('dv2CName', { value: c ? c.name : '' }))}
            <div class="dv2-row2">
                ${f('f2', 'Importe (€)', inp('dv2CAmt', { type: 'number', step: '0.01', min: '0', value: c ? c.amount : '' }))}
                ${f('f3', 'Fecha', inp('dv2CDate', { type: 'date', value: c ? c.dueDate : todayISO() }))}
            </div>
            ${f('f4', 'Cuenta', sel('dv2CAcc', accOpts, c ? c.accountId : (accOpts[0] || {}).v))}
            ${f('f5', 'Nota', inp('dv2CNote', { value: c ? c.note || '' : '' }))}`,
            `${c ? '<button class="dv2-danger-link" id="dv2CDel">Eliminar</button>' : ''}<button class="btn btn-secondary" id="dv2CCancel">Cancelar</button><button class="btn btn-primary" id="dv2CSave"><i class="fas fa-save"></i> Guardar</button>`
        );
        body.parentElement.querySelector('#dv2CCancel').onclick = closeModal;
        body.parentElement.querySelector('#dv2CSave').onclick = () => {
            const name = body.querySelector('#dv2CName').value.trim();
            const amount = round2(parseFloat(body.querySelector('#dv2CAmt').value));
            const dueDate = body.querySelector('#dv2CDate').value;
            if (!name || isNaN(amount) || amount <= 0 || !dueDate) { toast('Completa los campos', 'error'); return; }
            const obj = {
                id: c ? c.id : uid('cm'), name, amount, dueDate,
                accountId: body.querySelector('#dv2CAcc').value,
                executed: c ? c.executed : false,
                note: body.querySelector('#dv2CNote').value.trim()
            };
            if (c) { const idx = data.commitments.findIndex(x => x.id === c.id); data.commitments[idx] = obj; }
            else data.commitments.push(obj);
            saveData(); closeModal(); renderAll(); toast(c ? 'Compromiso actualizado' : 'Compromiso añadido');
        };
        if (c) body.parentElement.querySelector('#dv2CDel').onclick = () => confirmDelete(`¿Eliminar «${c.name}»?`, () => {
            data.commitments = data.commitments.filter(x => x.id !== c.id);
            saveData(); renderAll();
        });
    }

    /* --- MOVEMENT MODAL --- */
    function openMovementModal(editId) {
        const mv = editId ? data.movements.find(x => x.id === editId) : null;
        const types = [['out', 'Salida (gasto)'], ['in', 'Entrada (ingreso)'], ['transfer-out', 'Transferencia (salida)'], ['transfer-in', 'Transferencia (entrada)']].map(([v, l]) => ({ v, l }));
        const accOpts = getAccounts().map(a => ({ v: a.id, l: `${a.icon || '🏦'} ${a.name}` }));
        const body = openModal(
            `<span class="dv2-badge" style="background:#64748b">${mv ? '✏️' : '↕️'}</span> ${mv ? 'Editar movimiento' : 'Nuevo movimiento'}`,
            '#64748b',
            `
            ${f('fm1', 'Concepto', inp('dv2MConcept', { value: mv ? mv.concept : '' }))}
            <div class="dv2-row2">
                ${f('fm2', 'Importe', inp('dv2MAmt', { type: 'number', step: '0.01', min: '0', value: mv ? Math.abs(mv.amount) : '' }))}
                ${f('fm2b', 'Divisa', sel('dv2MCur', [{ v: 'EUR', l: '€ Euro' }, { v: 'USD', l: '$ Dólar' }], mv && mv.currency ? mv.currency : 'EUR'))}
            </div>
            <div class="dv2-row2">
                ${f('fm3', 'Fecha', inp('dv2MDate', { type: 'date', value: mv ? mv.date : todayISO() }))}
                ${f('fm4', 'Tipo', sel('dv2MType', types, mv ? mv.type : 'out'))}
            </div>
            ${f('fm5', 'Cuenta', sel('dv2MAcc', accOpts, mv ? mv.accountId : (accOpts[0] || {}).v))}`,
            `${mv ? '<button class="dv2-danger-link" id="dv2MDelete">Eliminar</button>' : ''}
             <button class="btn btn-secondary" id="dv2MCancel">Cancelar</button>
             <button class="btn btn-primary" id="dv2MSave"><i class="fas fa-save"></i> Guardar</button>`
        );
        body.parentElement.querySelector('#dv2MCancel').onclick = closeModal;
        if (mv) {
            body.parentElement.querySelector('#dv2MDelete').onclick = () => {
                confirmDelete('¿Eliminar este movimiento?', () => {
                    const acc = getAccounts().find(a => a.id === mv.accountId);
                    if (acc) acc.balance = round2(acc.balance - mv.amount);
                    data.movements = data.movements.filter(x => x.id !== mv.id);
                    App.saveData(); saveData(); closeModal(); renderAll();
                });
            };
        }
        body.parentElement.querySelector('#dv2MSave').onclick = () => {
            const concept = body.querySelector('#dv2MConcept').value.trim();
            const rawAmount = round2(parseFloat(body.querySelector('#dv2MAmt').value));
            const type = body.querySelector('#dv2MType').value;
            const accountId = body.querySelector('#dv2MAcc').value;
            if (!concept || isNaN(rawAmount) || rawAmount <= 0) { toast('Datos incompletos', 'error'); return; }
            const amount = type === 'in' || type === 'transfer-in' ? rawAmount : -rawAmount;
            if (mv) {
                const oldAcc = getAccounts().find(a => a.id === mv.accountId);
                if (oldAcc) oldAcc.balance = round2(oldAcc.balance - mv.amount);
                Object.assign(mv, { concept, amount, date: body.querySelector('#dv2MDate').value, type, accountId, currency: body.querySelector('#dv2MCur').value });
            } else {
                data.movements.unshift({ id: uid('mv'), concept, amount, type, date: body.querySelector('#dv2MDate').value, accountId, currency: body.querySelector('#dv2MCur').value });
            }
            const newAcc = getAccounts().find(a => a.id === accountId);
            if (newAcc && ['in', 'out', 'transfer-in', 'transfer-out'].includes(type)) newAcc.balance = round2(newAcc.balance + amount);
            App.saveData(); saveData(); closeModal(); renderAll(); toast('Movimiento guardado');
        };
    }

    function confirmDelete(message, onYes) {
        const body = openModal(
            '<span class="dv2-badge" style="background:#ef4444">⚠️</span> Confirmar',
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

    /* =========================================================
       LISTENER app:module-changed
       ========================================================= */
    let _dineroBound = false;
    function bindModuleChange() {
        if (_dineroBound) return;
        document.addEventListener('app:module-changed', (e) => {
            const src = e.detail && e.detail.source;
            if (!src || src === 'mi-dinero') return;
            if (containerEl && containerEl.isConnected) {
                try { renderAll(); } catch (err) {}
            }
        });
        _dineroBound = true;
    }

    /* =========================================================
       API PÚBLICA
       ========================================================= */
    function init() {
        loadFxRate();
        bindModuleChange();
        try { checkAndResetWalletsForNewMonth(); } catch (e) { console.warn('[DineroApp] init close:', e); }
    }
    function onThemeChange() {}

    function getTripFundGoal() {
        return data.goals.find(g => g.id === 'g-trip-fund' || /fondo viajes/i.test(String(g.name || '')));
    }

    function syncTripGoal(payload) {
        if (!payload || !payload.tripId) return null;
        let g = data.goals.find(x => x.tripId === payload.tripId);
        if (!g) {
            g = {
                id: uid('g'), tripId: payload.tripId,
                emoji: '✈️', name: payload.name || 'Viaje',
                target: payload.target || null, saved: 0,
                frequency: 'none', contribution: 0, nextDate: '',
                contributions: [],
                includeInBudget: false, budgetAmount: 0, versions: {}, subcategories: [], plannedSplits: []
            };
            data.goals.push(g);
        } else {
            if (payload.name) g.name = payload.name;
            if (payload.target != null) g.target = payload.target;
        }
        saveData();
        return g;
    }

    function syncTripCommitments(tripId, pendings) {
        if (!tripId) return;
        data.commitments = data.commitments.filter(c => c.tripId !== tripId);
        (pendings || []).forEach(p => {
            data.commitments.push({
                id: p.id || uid('cm'), name: p.name, amount: Number(p.amount) || 0,
                dueDate: p.dueDate, accountId: p.accountId || null, executed: false,
                note: p.note || '', tripId, itemId: p.itemId || null
            });
        });
        saveData();
    }

    function distributeExtraIncome(payload) {
        const { amount, savingsPct = 0, tripsPct = 0, personalPct = 0, date = todayISO(), concept = 'Reparto de extra', accountId } = payload || {};
        const total = round2(Number(amount) || 0);
        if (total <= 0) return null;
        const accId = accountId || (getAccounts()[0] || {}).id;
        const mv = registerMovement({ date, concept, amount: total, type: 'in', accountId: accId, module: 'Ingresos', category: concept, link: { kind: 'income', id: 'extra-' + uid('x') } });
        const savingsAmt = round2(total * savingsPct / 100);
        if (savingsAmt > 0) {
            const savingsAcc = getAccounts().find(a => a.id === 'acc-tr') || getAccounts().find(a => a.type === 'inversion');
            if (savingsAcc && accId) {
                registerMovement({ date, concept: `${concept} → Ahorro`, amount: -savingsAmt, type: 'transfer-out', accountId: accId, module: 'Ingresos', category: 'Ahorro' });
                registerMovement({ date, concept: `${concept} → Ahorro`, amount: savingsAmt, type: 'transfer-in', accountId: savingsAcc.id, module: 'Ingresos', category: 'Ahorro' });
            }
        }
        const tripsAmt = round2(total * tripsPct / 100);
        if (tripsAmt > 0) {
            const g = getTripFundGoal();
            if (g) {
                g.contributions = g.contributions || [];
                g.contributions.push({ id: uid('sc'), date, amount: tripsAmt, note: `${concept} → Viajes` });
                g.saved = g.contributions.reduce((s, c) => s + c.amount, 0);
            }
        }
        saveData();
        return { income: mv, savings: savingsAmt, trips: tripsAmt, personal: round2(total - savingsAmt - tripsAmt) };
    }

    function registerExternalIncome(payload) {
        const amt = Math.abs(Number(payload.amount) || 0);
        if (!amt) return null;
        const link = payload.link || null;
        if (link && link.kind && link.id) {
            const exists = data.movements.find(m => m.link && m.link.kind === link.kind && m.link.id === link.id);
            if (exists) return exists;
        }
        const accId = payload.accountId || (getAccounts()[0] || {}).id;
        const mv = { id: uid('mv'), date: payload.date || todayISO(), concept: payload.concept || 'Ingreso', amount: amt, type: 'in', accountId: accId, module: payload.module || 'Ingresos', category: payload.category || '', link };
        data.movements.unshift(mv);
        const acc = getAccounts().find(a => a.id === accId);
        if (acc) acc.balance = round2(acc.balance + amt);
        App.saveData(); saveData(); renderAll();
        return mv;
    }

    function registerExternalExpense(payload) {
        const amt = Math.abs(Number(payload.amount) || 0);
        if (!amt) return null;
        const link = payload.link || null;
        if (link && link.kind && link.id) {
            const exists = data.movements.find(m => m.link && m.link.kind === link.kind && m.link.id === link.id);
            if (exists) return exists;
        }
        const accId = payload.accountId || (getAccounts()[0] || {}).id;
        const mv = { id: uid('mv'), date: payload.date || todayISO(), concept: payload.concept || 'Gasto', amount: -amt, type: 'out', accountId: accId, module: payload.module || 'Gastos', category: payload.category || '', link };
        data.movements.unshift(mv);
        const acc = getAccounts().find(a => a.id === accId);
        if (acc) acc.balance = round2(acc.balance - amt);
        App.saveData(); saveData(); renderAll();
        return mv;
    }

    function getTripSavings() {
        const g = getTripFundGoal();
        return g ? {
            goalTotal: g.target,
            saved: g.saved,
            contributions: (g.contributions || []).map(c => ({ id: c.id, date: c.date, amount: c.amount, payer: c.payer || '', note: c.note || '' }))
        } : { goalTotal: 0, saved: 0, contributions: [] };
    }

    function addTripSavingsContribution({ amount, date, payer, note }) {
        const g = getTripFundGoal();
        if (!g) return null;
        const amt = Number(amount) || 0;
        if (amt <= 0) return null;
        g.contributions = g.contributions || [];
        g.contributions.push({ id: uid('sc'), date: date || todayISO(), amount: amt, payer: payer || '', note: note || 'Aportación' });
        g.saved = g.contributions.reduce((s, c) => s + c.amount, 0);
        saveData(); renderAll();
        return g;
    }

    return {
        render, init, onThemeChange,
        reloadFromStorage: () => {
            data = loadData();
            try { checkAndResetWalletsForNewMonth(); } catch (e) {}
        },

        /* Fase 1 */
        getLoans: () => data.loans.filter(l => l.status !== 'archived'),
        payLoanInstallment,
        getTripSavings,
        addTripSavingsContribution,

        /* Fase 2 · API */
        getState: () => JSON.parse(JSON.stringify(data)),

        /* Fase 5 · Integración con Presupuesto Común */
        getBudgetItems: () => {
            const items = [];
            const mk = currentMonthKey();

            data.debts.filter(d => d.includeInBudget && d.returned < d.total).forEach(d => {
                let budgetAmt = 0;
                if (d.plannedSplits && d.plannedSplits.length > 0) {
                    const split = d.plannedSplits.find(s => s.month === mk);
                    if (split) budgetAmt = split.amount;
                    else return; // Si está troceado y este mes no toca, no se incluye
                } else {
                    const natural = Math.max(0, Number(d.total) - Number(d.returned));
                    budgetAmt = getEffectiveAmount(d, mk) || natural;
                }
                const paid = (d.history || []).filter(h => String(h.date).startsWith(mk)).reduce((s, h) => s + Number(h.amount || 0), 0);
                items.push({ id: d.id, type: 'debt', name: d.name, icon: d.emoji, budgetAmount: budgetAmt, spentAmount: paid, includeInBudget: true });
            });

            data.loans.filter(l => l.includeInBudget && l.paidCount < l.installments).forEach(l => {
                const paid = (l.payments || []).filter(p => String(p.date).startsWith(mk)).reduce((s, p) => s + Number(p.amount || 0), 0);
                items.push({ id: l.id, type: 'loan', name: l.name, icon: l.emoji, budgetAmount: getEffectiveAmount(l, mk) || Number(l.installmentAmount || 0), spentAmount: paid, includeInBudget: true });
            });

            data.wallets.filter(w => w.includeInBudget).forEach(w => {
                const paid = (w.movements || []).filter(m => m.type === 'out' && String(m.date).startsWith(mk)).reduce((s, m) => s + Number(m.amount || 0), 0);
                items.push({ id: w.id, type: 'wallet', name: w.name, icon: w.emoji, budgetAmount: getEffectiveAmount(w, mk), spentAmount: paid, includeInBudget: true });
            });

            data.goals.filter(g => g.includeInBudget && (g.target == null || g.saved < g.target)).forEach(g => {
                let budgetAmt = 0;
                if (g.plannedSplits && g.plannedSplits.length > 0) {
                    const split = g.plannedSplits.find(s => s.month === mk);
                    if (split) budgetAmt = split.amount;
                    else return; // Si está troceado y este mes no toca, no se incluye
                } else {
                    budgetAmt = getEffectiveAmount(g, mk) || Number(g.contribution || 0);
                }
                const paid = (g.contributions || []).filter(c => String(c.date).startsWith(mk)).reduce((s, c) => s + Number(c.amount || 0), 0);
                items.push({ id: g.id, type: 'goal', name: g.name, icon: g.emoji, budgetAmount: budgetAmt, spentAmount: paid, includeInBudget: true });
            });

            data.recurring.filter(r => r.active && r.includeInBudget).forEach(r => {
                const paid = (r.history || []).filter(h => String(h.date).startsWith(mk)).reduce((s, h) => s + Math.abs(Number(h.amount || 0)), 0);
                items.push({ id: r.id, type: 'recurring', name: r.name, icon: r.emoji, budgetAmount: getEffectiveAmount(r, mk) || Number(r.amount || 0), spentAmount: paid, includeInBudget: true });
            });

            return items;
        },

        updateBudgetItemAmount: (id, type, newAmount, period) => {
            const mk = period || currentMonthKey();
            let item = null;
            if (type === 'debt') item = data.debts.find(x => x.id === id);
            else if (type === 'loan') item = data.loans.find(x => x.id === id);
            else if (type === 'wallet') item = data.wallets.find(x => x.id === id);
            else if (type === 'goal') item = data.goals.find(x => x.id === id);
            else if (type === 'recurring') item = data.recurring.find(x => x.id === id);
            if (!item) return;
            setVersionBudget(item, mk, newAmount);
            saveData();
        },

        payBudgetItem: (id, type, amount) => {
            const amt = round2(Math.abs(Number(amount) || 0));
            if (type === 'debt') {
                const d = data.debts.find(x => x.id === id);
                if (d) {
                    d.returned = round2(d.returned + amt);
                    d.history = d.history || [];
                    d.history.push({ id: uid('dh'), date: todayISO(), amount: amt, note: 'Pago desde Presupuesto' });
                    if (d.accountId) registerMovement({
                        date: todayISO(), concept: `Deuda: ${d.name}`,
                        amount: d.kind === 'pay' ? -amt : amt,
                        type: d.kind === 'pay' ? 'out' : 'in',
                        accountId: d.accountId, module: 'Deudas', category: d.name, link: { kind: 'debt', id: d.id }
                    });
                }
            } else if (type === 'loan') {
                payLoanInstallment(id);
                return;
            } else if (type === 'wallet') {
                const w = data.wallets.find(x => x.id === id);
                if (w) {
                    w.movements.push({ id: uid('wm'), date: todayISO(), concept: 'Aportación desde Presupuesto', amount: amt, type: 'in' });
                    if (w.accountId) registerMovement({
                        date: todayISO(), concept: `Monedero: ${w.name}`,
                        amount: -amt, type: 'out', accountId: w.accountId,
                        module: 'Wallets', category: w.name, link: { kind: 'wallet', id: w.id }
                    });
                }
            } else if (type === 'goal') {
                const g = data.goals.find(x => x.id === id);
                if (g) {
                    g.saved = round2(g.saved + amt);
                    g.contributions = g.contributions || [];
                    g.contributions.push({ id: uid('gc'), date: todayISO(), amount: amt });
                    if (g.accountId) registerMovement({
                        date: todayISO(), concept: `Objetivo: ${g.name}`,
                        amount: -amt, type: 'out', accountId: g.accountId,
                        module: 'Objetivos', category: g.name, link: { kind: 'goal', id: g.id }
                    });
                }
            } else if (type === 'recurring') {
                const r = data.recurring.find(x => x.id === id);
                if (r && r.active) {
                    r.history = r.history || [];
                    r.history.push({ id: uid('rh'), date: todayISO(), amount: amt, note: 'Pago desde Presupuesto' });
                    const accKey = String(r.accountName || '').toLowerCase().split(' ')[0];
                    const acc = getAccounts().find(a => (a.name || '').toLowerCase().includes(accKey));
                    if (acc) registerMovement({
                        date: todayISO(), concept: r.name,
                        amount: -amt, type: 'out', accountId: acc.id,
                        module: 'Recurrentes', category: r.name, link: { kind: 'recurring', id: r.id }
                    });
                    if (r.nextDate) {
                        const stepDays = r.period === 'weekly' ? 7 : r.period === 'quarterly' ? 91 : r.period === 'semiannual' ? 182 : r.period === 'annual' ? 365 : 30;
                        let nd = r.nextDate;
                        while (nd <= todayISO()) nd = addDays(nd, stepDays);
                        r.nextDate = nd;
                    }
                }
            }
            App.saveData(); saveData(); renderAll();
        },

        registerExternalIncome,
        registerExternalExpense,
        getTripCommitments: () => data.commitments.filter(c => c.tripId && !c.executed),
        syncTripGoal,
        syncTripCommitments,
        distributeExtraIncome,

        getSavings: () => {
            const byGoal = {};
            data.goals.forEach(g => { byGoal[g.name] = g.saved; });
            return { total: data.goals.reduce((s, g) => s + g.saved, 0), byGoal };
        },
        getRealBalance: realBalance,
        getAvailable: () => ({ now: availableNow(viewFilters.accountId), global: availableGlobal(viewFilters.accountId), horizon: data.settings.horizonDays }),
        resetDemo: () => {
            data = clone(DEFAULT_MOCK);
            saveData();
            renderAll();
        },

        /* EXPONER MODALES PARA PRESUPUESTO */
        openWalletModal,
        openDebtModal,
        openLoanModal,
        openGoalModal,
        openRecurringModal,

        addWalletMovement: (walletId, amount, type, concept, date) => {
            const w = data.wallets.find(x => x.id === walletId);
            if (!w) return;
            const wm = { id: uid('wm'), date: date || todayISO(), concept, amount, type };
            w.movements.push(wm);
            const mv = { id: uid('mv'), date: date || todayISO(), concept, amount: type === 'out' ? -amount : amount, type, accountId: w.accountId, module: 'Wallets', category: w.name };
            data.movements.unshift(mv);
            saveData(); renderAll();
        },
    };
})();

if (window.App) {
    App.registerSection('mi-dinero', DineroApp);
    App.registerModule('mi-dinero', DineroApp);
    App.getBudgetItems = () => window.DineroApp.getBudgetItems();
    App.updateBudgetItemAmount = (id, type, amt, period) => window.DineroApp.updateBudgetItemAmount(id, type, amt, period);
    App.payBudgetItem = (id, type, amt) => window.DineroApp.payBudgetItem(id, type, amt);
}
window.DineroApp = DineroApp;