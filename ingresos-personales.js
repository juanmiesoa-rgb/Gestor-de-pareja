/* =============================================================================
   INGRESOS-PERSONALES.JS · v12 — Puente App completo
   -----------------------------------------------------------------------------
   Cambios clave respecto a v11:
     · getSalary(pid, mk), getIncomeForMonth(mk), getIndividualExpenses(pid, mk)
       expuestos para el puente
     · getSharedContributionRules() ampliado con salary y netMonthly por persona
     · Botón "Confirmar cobro mensual" → App.registerIncomeMovement()
     · Botón "Confirmar cobro extra/bonus" → App.registerIncomeMovement() +
       distribución automática (ahorro → cuenta savings, viajes → fondo viajes)
     · Listener app:module-changed → re-render automático
   ============================================================================= */
const IngresosModulo = (function () {
    'use strict';

    const STORAGE_KEY = 'finanzas_ingresos_v11';
    const MODULE = 'ingresos-personales';

    /* ========================== UTILIDADES ========================== */
    const num = (v, d = 0) => {
        if (v === null || v === undefined || v === '') return d;
        const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
        return Number.isFinite(n) ? n : d;
    };
    const int = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
    const div0 = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && Math.abs(b) > 1e-9) ? a / b : 0;
    const clamp = (v, mn, mx) => Math.min(mx, Math.max(mn, num(v, mn)));
    const round2 = n => Math.round(num(n, 0) * 100) / 100;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const todayISO = () => new Date().toISOString().slice(0, 10);
    const monthKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const fmtEur = n => num(n, 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
    const fmtPct = n => `${round2(num(n, 0))}%`;
    const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    function monthLabel(mk, short = false) {
        const [y, m] = String(mk).split('-').map(Number);
        if (!y || !m) return mk;
        return short ? `${MONTHS[m - 1]} ${String(y).slice(2)}` : `${MONTHS[m - 1]} ${y}`;
    }
    function addMonths(mk, delta) {
        const [y, m] = String(mk).split('-').map(Number);
        return monthKey(new Date(y, m - 1 + delta, 1));
    }
    function uid(p) { return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

    /* ========================== PERSONAS ========================== */
    function people() {
        const ids = ((window.App && App.data && App.data.profiles) || []).map(p => p.id);
        return ids.length ? ids : ['ana', 'carlos'];
    }
    function getPerson(id) {
        const list = (window.App && App.data && App.data.profiles) || [];
        return list.find(p => p.id === id) || { id, name: id, initial: '?', color: '#64748b' };
    }

    /** FASE 3 · Cuenta por defecto según persona (para nóminas) */
    function defaultAccountFor(pid) {
        const map = { ana: 'acc-2', carlos: 'acc-3' };
        const accId = map[pid];
        const accounts = (window.App && typeof App.getAccounts === 'function') ? App.getAccounts() : [];
        if (accounts.find(a => a.id === accId)) return accId;
        return (accounts[0] || {}).id || null;
    }

    /* ========================== ESTADO Y PERSISTENCIA ========================== */
    function defaultProfile() {
        return {
            grossAnnual: 0, paysPerYear: 12, accrualPeriod: 'annual', joinDate: '2020-01-01',
            extraDates: [], bonuses: [], socialSecurityPct: 6.5, irpfMode: 'auto', irpfPercent: 15, deductions: [],
            extraPayDay: 15
        };
    }
    function defaultState() {
        const profiles = {}, distribution = {};
        people().forEach(id => {
            profiles[id] = defaultProfile();
            distribution[id] = { savingsPct: 20 };
        });
        return {
            version: 11, profiles, distribution,
            extraDistribution: { savings: 50, trips: 20 },
            monthlyControl: {}, individualExpenses: {}, extraPayments: {},
            drafts: []
        };
    }

    let state = null;
    function ensureState() { if (!state) state = loadState(); return state; }
    function loadState() {
        try {
            const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            const def = defaultState();
            if (!raw || typeof raw !== 'object' || raw.version !== 11) return def;
            return Object.assign(def, raw);
        } catch (e) { return defaultState(); }
    }
    function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {} }
    function notify(detail) {
        save();
        if (window.App && typeof App.notifyModuleChange === 'function') App.notifyModuleChange(MODULE, detail || {});
        else document.dispatchEvent(new CustomEvent('app:module-changed', { detail: Object.assign({ source: MODULE }, detail || {}) }));
    }

    /* ========================== CÁLCULOS ========================== */
    const IRPF_MINIMO_EXENTO = 5550;
    const IRPF_BRACKETS = [
        { limit: 12450, pct: 19 }, { limit: 20200, pct: 24 },
        { limit: 35200, pct: 30 }, { limit: 60000, pct: 37 },
        { limit: 300000, pct: 45 }, { limit: Infinity, pct: 47 }
    ];
    function estimateIrpf(gross) {
        const g = Math.max(0, num(gross, 0));
        if (g <= IRPF_MINIMO_EXENTO) return 0;
        let taxable = g - IRPF_MINIMO_EXENTO;
        let tax = 0, prev = 0;
        for (const b of IRPF_BRACKETS) {
            const lim = Math.min(b.limit, taxable);
            if (lim > prev) { tax += (lim - prev) * b.pct / 100; prev = lim; }
            if (prev >= taxable) break;
        }
        return round2(tax);
    }
    function getMaxPays() {
        const vals = people().map(id => int(state.profiles[id] && state.profiles[id].paysPerYear, 0)).filter(v => v > 0);
        return Math.max(12, ...vals);
    }

    function computeSalary(profile) {
        profile = profile || defaultProfile();
        const grossAnnual = Math.max(0, num(profile.grossAnnual, 0));
        const pays = Math.max(12, int(profile.paysPerYear, 12));
        const ssPct = clamp(profile.socialSecurityPct, 0, 100);

        const ssAnnual = round2(grossAnnual * ssPct / 100);
        const ssPerPay = round2(div0(ssAnnual, 12));

        let irpfAnnual, irpfEffPct;
        if ((profile.irpfMode || 'auto') === 'auto') {
            irpfAnnual = estimateIrpf(grossAnnual);
            irpfEffPct = round2(div0(irpfAnnual, grossAnnual) * 100);
        } else {
            irpfAnnual = round2(grossAnnual * clamp(profile.irpfPercent, 0, 100) / 100);
            irpfEffPct = clamp(profile.irpfPercent, 0, 100);
        }
        irpfAnnual = Math.min(Math.max(0, irpfAnnual), grossAnnual);
        const irpfPerPay = round2(div0(irpfAnnual, pays));

        const deds = Array.isArray(profile.deductions) ? profile.deductions : [];
        const dedAnnual = deds.filter(d => d.kind !== 'complement').reduce((s, d) => s + (d.freq === 'annual' ? num(d.amount, 0) : num(d.amount, 0) * 12), 0);
        const compAnnual = deds.filter(d => d.kind === 'complement').reduce((s, d) => s + (d.freq === 'annual' ? num(d.amount, 0) : num(d.amount, 0) * 12), 0);

        const netAnnual = Math.max(0, round2(grossAnnual - ssAnnual - irpfAnnual - dedAnnual + compAnnual));
        const netPerPay = round2(div0(netAnnual, pays));

        const grossPerPay = round2(div0(grossAnnual, pays));
        const dedPerPay = round2(div0(dedAnnual, pays));
        const compPerPay = round2(div0(compAnnual, pays));
        const monthlyNet = round2(grossPerPay - ssPerPay - irpfPerPay - dedPerPay + compPerPay);

        const refPays = getMaxPays();
        const normalizedMonthly = round2(div0(netAnnual, refPays));
        const proratedExtra = pays < refPays ? round2(Math.max(0, netPerPay - normalizedMonthly)) : 0;

        const numExtras = Math.max(0, pays - 12);
        const grossPerExtra = numExtras > 0 ? round2(grossAnnual / pays) : 0;
        const netPerExtra = round2(grossPerExtra * (1 - irpfEffPct / 100));

        return {
            grossAnnual, pays, ssPct, ssAnnual, ssPerPay,
            irpfAnnual, irpfPerPay, irpfEffPct, dedAnnual, compAnnual,
            netAnnual, monthlyNet, netPerPay, normalizedMonthly, proratedExtra, refPays,
            numExtras, grossPerExtra, netPerExtra
        };
    }

    function getExtraDistribution() {
        const d = state.extraDistribution || { savings: 50, trips: 20 };
        const s = clamp(d.savings, 0, 100), t = clamp(d.trips, 0, 100);
        return { savings: s, trips: t, personal: round2(Math.max(0, 100 - s - t)) };
    }

    function getMonthExtras(pid, mk) {
        const p = state.profiles[pid] || defaultProfile();
        const bd = computeSalary(p);
        const list = [];

        if (bd.proratedExtra > 0) {
            list.push({ id: 'eq', type: 'equiparacion', label: 'Equiparación mensual', amount: bd.proratedExtra });
        }

        const isExtraMonth = p.extraDates.some(d => mk.endsWith(d.slice(0, 2)));
        if (isExtraMonth) {
            const [cy, cm] = mk.split('-').map(Number);
            const joinDate = new Date(p.joinDate + 'T00:00:00');
            const payDate = new Date(cy, cm - 1, 1);

            const diffTime = payDate.getTime() - joinDate.getTime();
            const diasTrabajados = Math.max(0, Math.floor(diffTime / 86400000));
            const diasDevengo = p.accrualPeriod === 'semiannual' ? 182 : 365;
            const factor = Math.min(1, diasTrabajados / diasDevengo);

            const grossExtraFull = round2(bd.grossAnnual / bd.pays);
            const irpf = round2(grossExtraFull * (bd.irpfEffPct / 100));
            const netExtraFull = round2(grossExtraFull - irpf);
            const netExtraFinal = round2(netExtraFull * factor);

            if (netExtraFinal > 0) {
                list.push({ id: 'ex', type: 'extraordinaria', label: 'Extraordinaria', amount: netExtraFinal });
            }
        }

        (p.bonuses || []).forEach(b => {
            if (b.date.startsWith(mk)) {
                const net = num(b.amount) - num(b.irpfDiscount);
                if (net > 0) list.push({ id: b.id, type: 'bonus', label: `Bonus: ${b.name}`, amount: net });
            }
        });

        return list;
    }

    function normalizeMonthly(amount, freq) {
        const a = Math.max(0, num(amount, 0));
        return ({ quarterly: a / 3, semiannual: a / 6, annual: a / 12 }[freq]) || a;
    }
    function getIndividualExpenses(pid, mk) {
        mk = mk || ui.month;
        const keys = Object.keys(state.individualExpenses || {}).filter(k => k <= mk).sort().reverse();
        if (!keys.length) return [];
        return state.individualExpenses[keys[0]][pid] || [];
    }
    function individualExpensesTotal(pid, mk) {
        return round2(getIndividualExpenses(pid, mk).filter(e => e.active !== false).reduce((s, e) => s + normalizeMonthly(e.amount, e.frequency), 0));
    }

    function monthlyIncome(pid, mk) {
        mk = mk || ui.month;
        const c = state.monthlyControl[mk];
        if (c && c.real && c.real[pid] != null) return round2(num(c.real[pid], 0));
        const keys = Object.keys(state.monthlyControl || {}).filter(k => k < mk).sort().reverse();
        for (const k of keys) {
            const cc = state.monthlyControl[k];
            if (cc && cc.real && cc.real[pid] != null) return round2(num(cc.real[pid], 0));
        }
        return computeSalary(state.profiles[pid] || defaultProfile()).normalizedMonthly;
    }
    function theoreticalMonthly(pid, mk) {
        return computeSalary(state.profiles[pid] || defaultProfile()).normalizedMonthly;
    }

    function getEquity() {
        const ids = people(), rem = {};
        ids.forEach(id => { rem[id] = round2(monthlyIncome(id) - individualExpensesTotal(id)); });
        const positive = ids.reduce((s, id) => s + Math.max(0, rem[id]), 0);
        const shares = {};
        if (positive <= 1e-9) {
            const even = round2(div0(100, ids.length || 1));
            ids.forEach(id => { shares[id] = { pct: even, remaining: rem[id] }; });
        } else {
            ids.forEach(id => { shares[id] = { pct: round2(Math.max(0, rem[id]) / positive * 100), remaining: rem[id] }; });
        }
        const totalRemaining = round2(ids.reduce((s, id) => s + rem[id], 0));
        return { shares, totalRemaining };
    }

    function getPcNeeds() {
        try {
            const pc = (window.App && typeof App.pcSummary === 'function') ? App.pcSummary() : null;
            if (!pc) return null;
            return { total: round2(num(pc.fixed, 0) + num(pc.variable, 0)) };
        } catch (e) { return null; }
    }

    function getDistributionAmounts(pid) {
        const remaining = round2(monthlyIncome(pid) - individualExpensesTotal(pid));
        const eq = getEquity();
        const share = eq.shares[pid] ? eq.shares[pid].pct : 50;
        const savingsPct = state.distribution[pid] ? clamp(state.distribution[pid].savingsPct, 0, 100) : 20;
        const pc = getPcNeeds();
        const shared = pc && pc.total > 0 ? round2(pc.total * share / 100) : round2(remaining * share / 100);
        const savings = round2(remaining * savingsPct / 100);
        const free = round2(remaining - shared - savings);
        return { remaining, share, shared, sharedPct: remaining > 0 ? round2(shared / remaining * 100) : 0, savings, savingsPct, free, freePct: remaining > 0 ? round2(free / remaining * 100) : 0 };
    }

    /** FASE 2 · Ampliado con salary y netMonthly */
    function getSharedContributionRules() {
        const eq = getEquity(), out = {};
        people().forEach(id => {
            const a = getDistributionAmounts(id);
            const bd = computeSalary(state.profiles[id] || defaultProfile());
            out[id] = {
                pct: eq.shares[id] ? eq.shares[id].pct : 50,
                amount: a.shared,
                remaining: a.remaining,
                salary: bd.normalizedMonthly,
                netMonthly: bd.monthlyNet
            };
        });
        out.total = round2(people().reduce((s, id) => s + out[id].amount, 0));
        return out;
    }

    /* ========================== FASE 2 · API DEL PUENTE ========================== */

    /** Salario de una persona en un mes: teórico + real (si existe) */
    function getSalary(pid, mk) {
        mk = mk || ui.month;
        const profile = state.profiles[pid] || defaultProfile();
        const bd = computeSalary(profile);
        const ctrl = state.monthlyControl[mk];
        const real = ctrl && ctrl.real && ctrl.real[pid] != null ? round2(num(ctrl.real[pid], 0)) : null;
        return {
            theoretical: bd.normalizedMonthly,
            real,
            netMonthly: bd.monthlyNet,
            netPerPay: bd.netPerPay,
            grossAnnual: bd.grossAnnual,
            irpfEffPct: bd.irpfEffPct,
            ssPerPay: bd.ssPerPay,
            irpfPerPay: bd.irpfPerPay,
            pays: bd.pays,
            refPays: bd.refPays
        };
    }

    /** Ingreso total del hogar para un mes */
    function getIncomeForMonth(mk) {
        mk = mk || ui.month;
        let total = 0;
        people().forEach(pid => {
            const sal = getSalary(pid, mk);
            total += sal.real != null ? sal.real : sal.theoretical;
        });
        return round2(total);
    }

    /* ========================== HISTÓRICO ========================== */
    function getHistoryYears() {
        const now = new Date();
        return [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];
    }

    function generateHistoryData() {
        const now = new Date();
        const historyData = {};
        people().forEach(pid => { historyData[pid] = []; });

        for (let i = 23; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mk = monthKey(d);
            const ex = getExtraDistribution();

            people().forEach((pid, index) => {
                const p = state.profiles[pid] || defaultProfile();
                const isCurrent = i === 0;

                let equiparacion = 0, extraordinaria = 0, bonus = 0;
                if (isCurrent) {
                    getMonthExtras(pid, mk).forEach(e => {
                        if (e.type === 'equiparacion') equiparacion += e.amount;
                        if (e.type === 'extraordinaria') extraordinaria += e.amount;
                        if (e.type === 'bonus') bonus += e.amount;
                    });
                } else {
                    const base = index === 0 ? 48000 : 30800;
                    const bdMock = computeSalary({ grossAnnual: base, paysPerYear: 14, socialSecurityPct: 6.5, irpfMode: 'auto' });
                    equiparacion = bdMock.proratedExtra;
                    if (p.extraDates.includes(mk.slice(5))) extraordinaria = bdMock.netPerExtra;
                }

                const total = equiparacion + extraordinaria + bonus;
                historyData[pid].push({
                    mk,
                    equiparacion, extraordinaria, bonus,
                    savings: round2(total * ex.savings / 100),
                    trips: round2(total * ex.trips / 100),
                    personal: round2(total * ex.personal / 100),
                    monthly: computeSalary(p).netPerPay
                });
            });
        }
        return historyData;
    }

    /* ========================== UI STATE ========================== */
    const ui = {
        tab: 'base',
        month: monthKey(new Date()),
        expCol: 'extra',
        showExtraExpanded: false,
        expandedRows: new Set(),
        histFilterPerson: 'both',
        histFilterYear: 'all',
        selectedChartMonth: null
    };

    /* ========================== HELPERS ========================== */
    function infoBtn(formula) {
        return `<span class="pc-info" tabindex="0">ⓘ<span class="pc-info-tip">${esc(formula)}</span></span>`;
    }
    function numericField(label, value, opts) {
        opts = opts || {};
        const display = opts.format ? opts.format(value) : (value != null && value !== '' ? fmtEur(value) : '—');
        return `<div class="ip-numeric" data-action="edit-number"
                    data-field="${opts.field}" data-person="${opts.person || ''}"
                    data-label="${esc(label)}" data-value="${value != null ? value : ''}"
                    data-formula="${esc(opts.formula || '')}" tabindex="0" role="button">
            <span class="ip-numeric-label">${esc(label)} ${opts.formula ? infoBtn(opts.formula) : ''}</span>
            <span class="ip-numeric-value">${display}</span>
        </div>`;
    }

    /* ========================== TABS ========================== */
    const TABS = [
        { key: 'base', num: 1, icon: '📄', label: 'Base de Nómina' },
        { key: 'dist', num: 2, icon: '⚖️', label: 'Gastos y Distribución' },
        { key: 'extras', num: 3, icon: '💶', label: 'Pagas Extras' },
        { key: 'sim', num: 4, icon: '🔮', label: 'Simulador' }
    ];
    function renderTabs() {
        return `<div class="ip-tabs">${TABS.map(t =>
            `<button class="ip-tab ${ui.tab === t.key ? 'active' : ''}" data-action="switch-tab" data-tab="${t.key}">
                <span class="ip-tab-num">${t.num}</span>${t.icon} ${t.label}
            </button>`).join('')}</div>`;
    }

    /* ========================== TAB 1 · BASE ========================== */
    function renderBase() {
        return `<div class="ip-duo">${people().map(renderBasePerson).join('')}</div>
        <div class="ip-duo" style="margin-top:16px">
            ${people().map(renderExtraInfoCard).join('')}
        </div>`;
    }

    function renderBasePerson(pid) {
        const p = state.profiles[pid] || defaultProfile();
        const bd = computeSalary(p);
        const person = getPerson(pid);
        const color = person.color || '#2563eb';

        const kpis = `<div class="ip-kpis">
            <div class="ip-kpi ip-kpi-main" style="--pc:${color}">
                <div class="ip-kpi-label">Sueldo Neto (Mensual) ${infoBtn('(Bruto mensual - SS - IRPF - deducciones)')}</div>
                <div class="ip-kpi-value">${fmtEur(bd.monthlyNet)}</div>
                <div class="ip-kpi-sub">Calculado con ${bd.pays} pagas totales</div>
            </div>
            <div class="ip-kpi" style="display:flex; flex-direction:column; justify-content:center;">
                <div class="ip-kpi-label">Neto en ${bd.refPays} pagas</div>
                <div class="ip-kpi-value" style="font-size:18px;color:var(--text-secondary)">${fmtEur(bd.normalizedMonthly)}</div>
                <div class="ip-kpi-sub">normalizado a la pareja</div>
            </div>
        </div>`;

        const inputs = `
            ${numericField('Salario Bruto Anual', p.grossAnnual, { field: 'grossAnnual', person: pid })}
            <div class="ip-fields-grid">
                <div class="ip-field"><label>Nº de Pagas</label>
                    <select data-action="change-field" data-field="paysPerYear" data-person="${pid}">
                        ${[12, 14, 15, 16].map(n => `<option value="${n}" ${int(p.paysPerYear, 12) === n ? 'selected' : ''}>${n} pagas</option>`).join('')}
                    </select></div>
                <div class="ip-field"><label>Modo IRPF</label>
                    <select data-action="change-field" data-field="irpfMode" data-person="${pid}">
                        <option value="auto" ${(p.irpfMode || 'auto') === 'auto' ? 'selected' : ''}>Automático</option>
                        <option value="manual" ${p.irpfMode === 'manual' ? 'selected' : ''}>Manual (%)</option>
                    </select></div>
            </div>
            <div class="ip-row-split">
                <div class="ip-half">
                    <div class="ip-numeric" data-action="edit-number" data-field="socialSecurityPct" data-person="${pid}" data-label="SS (%)" data-value="${p.socialSecurityPct}">
                        <span class="ip-numeric-label">Seg. Social ${infoBtn('Cotización aplicada al bruto anual. Solo sobre 12 pagas.')}</span>
                        <span class="ip-numeric-value">${fmtPct(p.socialSecurityPct)}</span>
                    </div>
                    <div class="ip-sub-kpi">Descuento: ${fmtEur(bd.ssPerPay)} / paga</div>
                </div>
                <div class="ip-half">
                    <div class="ip-numeric" data-action="edit-number" data-field="irpfPercent" data-person="${pid}" data-label="IRPF (%)" data-value="${p.irpfMode === 'manual' ? p.irpfPercent : bd.irpfEffPct}">
                        <span class="ip-numeric-label">IRPF ${infoBtn('Retención aplicada sobre el bruto anual.')}</span>
                        <span class="ip-numeric-value">${fmtPct(p.irpfMode === 'manual' ? p.irpfPercent : bd.irpfEffPct)}</span>
                    </div>
                    <div class="ip-sub-kpi">Retención: ${fmtEur(bd.irpfPerPay)} / paga</div>
                </div>
            </div>`;

        const dedList = (p.deductions || []).map(d => `
            <div class="ip-ded-line" data-action="edit-ded" data-person="${pid}" data-id="${d.id}">
                <div class="ip-ded-line-name">${esc(d.name)}</div>
                <div class="ip-ded-line-amt ${d.kind === 'complement' ? 'ip-pos' : 'ip-neg'}">
                    ${d.kind === 'complement' ? '+' : '−'}${fmtEur(d.amount)}<span class="ip-ded-freq">/${d.freq === 'annual' ? 'año' : 'mes'}</span>
                </div>
            </div>`).join('');

        return `<section class="ip-person" style="--pc:${color}">
            <header class="ip-person-head">
                <span class="ip-avatar" style="background:${color}">${esc(person.initial || '?')}</span>
                <span class="ip-person-name">${esc(person.name)}</span>
            </header>
            <div class="ip-person-body">
                ${kpis} ${inputs}
                <div class="ip-ded-section">
                    <div class="ip-ded-head">
                        <strong>Deducciones</strong>
                        <button class="ip-add-btn" data-action="add-ded" data-person="${pid}">+ Añadir</button>
                    </div>
                    ${dedList || '<div class="ip-empty">Sin registros</div>'}
                </div>
            </div>
        </section>`;
    }

    function renderExtraInfoCard(pid) {
        const p = state.profiles[pid] || defaultProfile();
        const person = getPerson(pid);
        const bd = computeSalary(p);

        const grossPerPay = round2(bd.grossAnnual / bd.pays);
        const irpf = round2(grossPerPay * (bd.irpfEffPct / 100));
        const nominaBase = round2(grossPerPay - irpf);

        const today = new Date();
        const upcoming = [];

        for (let i = 0; i < 12; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
            const mk = monthKey(d);
            const isExtraMonth = p.extraDates.some(ed => mk.endsWith(ed.slice(0, 2)));

            if (isExtraMonth) {
                const [cy, cm] = mk.split('-').map(Number);
                const day = p.extraPayDay || '15';
                const joinDate = new Date(p.joinDate + 'T00:00:00');
                const payDate = new Date(cy, cm - 1, 1);

                const diffTime = payDate.getTime() - joinDate.getTime();
                const diasTrabajados = Math.max(0, Math.floor(diffTime / 86400000));
                const diasDevengo = p.accrualPeriod === 'semiannual' ? 182 : 365;

                const factor = Math.min(1, diasTrabajados / diasDevengo);
                const netExtraFinal = round2(nominaBase * factor);

                if (netExtraFinal > 0) {
                    upcoming.push({ date: `${mk}-${day}`, label: `Extraordinaria`, amount: netExtraFinal, icon: '💶' });
                }
            }
        }
        upcoming.sort((a, b) => a.date.localeCompare(b.date));

        return `<div class="ip-extra-card" style="--pc:${person.color}">
            <div class="ip-extra-header">
                <div class="ip-extra-title">Pagas Extraordinarias · ${esc(person.name)}</div>
                <button class="ip-add-btn" data-action="edit-extra-config" data-person="${pid}">⚙️ Configurar</button>
            </div>
            <div class="ip-extra-grid" style="grid-template-columns: 1fr;">
                <div class="ip-extra-stat">
                    <div class="ip-kpi-label">Paga Base (Normal)</div>
                    <div class="ip-kpi-value">${fmtEur(nominaBase)}</div>
                </div>
            </div>
            <div class="ip-ded-head" style="margin-top:12px; border-top:1px dashed var(--border); padding-top:10px">
                <strong>Próximas Pagas Extraordinarias</strong>
            </div>
            <div class="ip-upcoming-list">
                ${upcoming.map(u => `
                    <div class="ip-upcoming-row">
                        <span class="ip-upcoming-date">${u.date}</span>
                        <span class="ip-upcoming-label">${u.icon} ${esc(u.label)}</span>
                        <strong class="ip-upcoming-amt">${fmtEur(u.amount)}</strong>
                    </div>
                `).join('') || '<div class="ip-empty">Sin pagas extra previstas</div>'}
            </div>
            <div class="ip-ded-head" style="margin-top:12px; border-top:1px dashed var(--border); padding-top:10px">
                <strong>Bonus Configurados</strong>
                <button class="ip-add-btn" data-action="add-bonus" data-person="${pid}">+ Añadir Bonus</button>
            </div>
            ${(p.bonuses || []).map(b => `
                <div class="ip-ded-line" data-action="edit-bonus" data-person="${pid}" data-id="${b.id}">
                    <div class="ip-ded-line-name">🎁 ${esc(b.name)}</div>
                    <div class="ip-ded-line-amt ip-pos">
                        +${fmtEur(b.amount - b.irpfDiscount)}<span class="ip-ded-freq"> / ${b.date}</span>
                    </div>
                </div>`).join('') || '<div class="ip-empty">Sin bonus registrados</div>'}
        </div>`;
    }

    /* ========================== TAB 2 · DISTRIBUCIÓN ========================== */
    function renderDist() {
        const eq = getEquity();
        const rules = getSharedContributionRules();
        const aportePct = eq.totalRemaining > 0 ? round2((rules.total / eq.totalRemaining) * 100) : 0;

        const cuentasDesglose = {};
        const accounts = (window.App && typeof App.getAccounts === 'function') ? App.getAccounts() : [];
        const budgetItems = (window.App && typeof window.DineroApp?.getBudgetItems === 'function') ? window.DineroApp.getBudgetItems() : [];
        
        accounts.forEach(acc => {
            let totalAcc = 0;
            budgetItems.forEach(item => {
                if (item.accountId === acc.id) totalAcc += item.budgetAmount;
            });
            if (totalAcc > 0) cuentasDesglose[acc.name] = totalAcc;
        });
        
        const desgloseTexto = Object.keys(cuentasDesglose).length > 0 
            ? Object.entries(cuentasDesglose).map(([name, amount]) => `${name}: ${fmtEur(amount)}`).join(' · ')
            : 'Sin asignación por cuentas';

        return `
        <div class="ip-period-bar">
            <button class="ip-nav-btn" data-action="prev-month">‹</button>
            <div class="ip-period-label">${monthLabel(ui.month)}</div>
            <button class="ip-nav-btn" data-action="next-month">›</button>
        </div>

        <div class="ip-kpis-row">
            <div class="ip-kpi ip-kpi-main" style="--pc:var(--primary); display: flex; align-items: center; justify-content: space-between; text-align: left;">
                <div>
                    <div class="ip-kpi-label">Aporte Común</div>
                    <div class="ip-kpi-value">${fmtEur(rules.total)}</div>
                    <div class="ip-kpi-sub">${fmtPct(aportePct)} del remanente</div>
                </div>
                <div style="text-align: right; border-left: 1px dashed var(--border); padding-left: 16px; margin-left: 16px;">
                    <div style="font-size:10px; text-transform:uppercase; color:var(--text-muted); font-weight:800; margin-bottom:4px;">Reparto por Cuentas</div>
                    <div style="font-size:12px; color:var(--primary); font-weight:700;">
                        ${desgloseTexto}
                    </div>
                </div>
            </div>
            <div class="ip-kpi ip-kpi-main" style="--pc:var(--success)">
                <div class="ip-kpi-label">Remanente Total</div>
                <div class="ip-kpi-value">${fmtEur(eq.totalRemaining)}</div>
                <div class="ip-kpi-sub">Ingresos − Gastos Ind.</div>
            </div>
        </div>

        ${renderControlTable()}

        <div class="ip-duo">${people().map(renderDistPerson).join('')}</div>
        `;
    }

    function renderControlTable() {
        const ids = people();
        const ctrl = state.monthlyControl[ui.month] || { theoretical: {}, real: {}, confirmed: {} };
        return `<div class="ip-control-card">
            <div class="ip-ded-head"><strong>Control del Mes · ${monthLabel(ui.month)}</strong></div>
            <div class="ip-control-grid-2">
                ${ids.map(pid => {
                    const person = getPerson(pid);
                    const theo = ctrl.theoretical[pid] != null ? ctrl.theoretical[pid] : theoreticalMonthly(pid, ui.month);
                    const realVal = ctrl.real[pid] != null ? ctrl.real[pid] : null;
                    const confirmed = !!ctrl.confirmed[pid];
                    return `<div class="ip-control-row" style="--pc:${person.color}">
                        <div class="ip-control-name">
                            <span class="ip-avatar sm" style="background:${person.color}">${esc(person.initial || '?')}</span>
                            ${esc(person.name)}
                        </div>
                        <div class="ip-control-theo">
                            <div class="ip-kpi-label">Teórica</div>
                            <strong>${fmtEur(theo)}</strong>
                        </div>
                        <button class="ip-tick-btn ${confirmed ? 'done' : ''}" data-action="tick-month" data-person="${pid}" title="Confirmar cobro y registrar en Dinero">✔</button>
                        <div class="ip-control-real" data-action="edit-number" data-field="monthlyReal" data-person="${pid}" data-label="Cobro Real" data-value="${realVal != null ? realVal : ''}">
                            <div class="ip-kpi-label">Real</div>
                            <span class="ip-numeric-value">${realVal != null ? fmtEur(realVal) : '—'}</span>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }

    function renderDistPerson(pid) {
        const person = getPerson(pid);
        const color = person.color || '#2563eb';
        const income = monthlyIncome(pid);
        const expenses = individualExpensesTotal(pid);
        const netAfterExpenses = round2(income - expenses);
        const a = getDistributionAmounts(pid);

        const expList = getIndividualExpenses(pid).map(e => `
            <div class="ip-exp-row" data-action="edit-exp" data-person="${pid}" data-id="${e.id}">
                <span>${esc(e.name) || 'Gasto'}</span>
                <span class="ip-exp-amt">${fmtEur(normalizeMonthly(e.amount, e.frequency))}</span>
                <span class="ip-ded-del">✏️</span>
            </div>`).join('');

        return `<section class="ip-person" style="--pc:${color}">
            <header class="ip-person-head">
                <span class="ip-avatar" style="background:${color}">${esc(person.initial || '?')}</span>
                <span class="ip-person-name">${esc(person.name)}</span>
                <span class="ip-equity-badge">${fmtPct(a.share)} equidad</span>
            </header>
            <div class="ip-person-body">
                <div class="ip-pay-row-double">
                    <div class="ip-pay-box">
                        <div class="ip-kpi-label">Ingreso Real</div>
                        <div class="ip-kpi-value">${fmtEur(income)}</div>
                    </div>
                    <div class="ip-pay-box ip-pay-box-minus">
                        <div class="ip-kpi-label">Restando Gastos Ind.</div>
                        <div class="ip-kpi-value">${fmtEur(netAfterExpenses)}</div>
                    </div>
                </div>
                <div class="ip-dist-blocks">
                    <div class="ip-dist-block">
                        <div class="ip-dist-top">
                            <span class="ip-dist-pct">${fmtPct(a.sharedPct)}</span>
                            <span class="ip-dist-name">Gastos Compartidos</span>
                            <span class="ip-dist-amt">${fmtEur(a.shared)}</span>
                        </div>
                        <div class="ip-bar"><div style="width:${Math.min(100, a.sharedPct)}%;background:var(--primary)"></div></div>
                    </div>
                    <div class="ip-dist-block">
                        <div class="ip-dist-top">
                            <button class="ip-pct-btn" data-action="edit-number" data-field="savingsPct" data-person="${pid}" data-label="% Ahorro Personal" data-value="${a.savingsPct}" data-suffix="%">${fmtPct(a.savingsPct)}</button>
                            <span class="ip-dist-name">Ahorro Personal</span>
                            <span class="ip-dist-amt">${fmtEur(a.savings)}</span>
                        </div>
                        <div class="ip-bar"><div style="width:${Math.min(100, a.savingsPct)}%;background:var(--success)"></div></div>
                    </div>
                    <div class="ip-dist-block ${a.free < 0 ? 'ip-dist-warn' : ''}">
                        <div class="ip-dist-top">
                            <span class="ip-dist-pct">${fmtPct(a.freePct)}</span>
                            <span class="ip-dist-name">Dinero Libre</span>
                            <span class="ip-dist-amt">${fmtEur(a.free)}</span>
                        </div>
                        <div class="ip-bar"><div style="width:${Math.max(0, Math.min(100, a.freePct))}%;background:${a.free < 0 ? 'var(--danger)' : 'var(--warning)'}"></div></div>
                    </div>
                </div>
                <div class="ip-exp-section">
                    <div class="ip-ded-head">
                        <strong>Gastos Individuales</strong>
                        <button class="ip-add-btn" data-action="add-exp" data-person="${pid}">+ Añadir</button>
                    </div>
                    ${expList || '<div class="ip-empty">Sin gastos</div>'}
                </div>
            </div>
        </section>`;
    }

    /* ========================== TAB 3 · EXTRAS ========================== */
    function renderExtras() {
        const ex = getExtraDistribution();
        const ids = people();

        const monthExtras = ids.map(pid => ({ pid, items: getMonthExtras(pid, ui.month) }));
        const hasAnyExtraThisMonth = monthExtras.some(me => me.items.length > 0);

        return `
        <div class="ip-period-bar">
            <button class="ip-nav-btn" data-action="prev-month">‹</button>
            <div class="ip-period-label">${monthLabel(ui.month)}</div>
            <button class="ip-nav-btn" data-action="next-month">›</button>
        </div>

        <div class="ip-card">
            <div class="ip-ded-head"><strong>Reparto Global de Extras</strong></div>
            <div class="ip-extra-dist">
                <div class="ip-extra-item"><span>% Ahorro</span><button class="ip-pct-btn" data-action="edit-number" data-field="extraSavings" data-value="${ex.savings}" data-suffix="%">${fmtPct(ex.savings)}</button></div>
                <div class="ip-extra-item"><span>% Viajes</span><button class="ip-pct-btn" data-action="edit-number" data-field="extraTrips" data-value="${ex.trips}" data-suffix="%">${fmtPct(ex.trips)}</button></div>
                <div class="ip-extra-item"><span>% Personal</span><div class="ip-pct-static">${fmtPct(ex.personal)}</div></div>
            </div>
        </div>

        ${hasAnyExtraThisMonth ? `
        <div class="ip-card">
            <div class="ip-ded-head"><strong>Confirmación de Cobros</strong></div>
            <div class="ip-control-grid-2">
                ${monthExtras.map(({ pid, items }) => {
                    const person = getPerson(pid);
                    const totalTeorico = items.reduce((s,e)=>s+e.amount,0);
                    const totalForBars = totalTeorico;

                    const s = round2(totalForBars * ex.savings / 100);
                    const t = round2(totalForBars * ex.trips / 100);
                    const p = round2(totalForBars * ex.personal / 100);

                    const rows = items.filter(e => e.type !== 'equiparacion').map(e => {
                        const ov = (state.extraPayments[ui.month]?.[pid]?.realItems || {})[e.id];
                        return `<div class="ip-confirm-row">
                            <div class="ip-confirm-label">${esc(e.label)}</div>
                            <div class="ip-confirm-theo">${fmtEur(e.amount)}</div>
                            <button class="ip-tick-btn sm ${ov != null ? 'done' : ''}" data-action="tick-extra-item" data-person="${pid}" data-item="${e.id}" data-theo="${e.amount}" title="Confirmar cobro y distribuir">✔</button>
                            <div class="ip-confirm-real" data-action="edit-extra-item-real" data-person="${pid}" data-item="${e.id}" data-real="${ov != null ? ov : ''}">
                                ${ov != null ? fmtEur(ov) : '—'}
                            </div>
                        </div>`;
                    }).join('') || '<div style="font-size:11px;color:var(--text-muted)">Sin cobros extra</div>';

                    return `<div class="ip-control-row" style="--pc:${person.color}; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start;">
                        <div>
                            <div class="ip-control-name" style="margin-bottom:8px">
                                <span class="ip-avatar sm" style="background:${person.color}">${esc(person.initial || '?')}</span>
                                ${esc(person.name)}
                            </div>
                            ${rows}
                        </div>
                        <div style="text-align:right; border-left:1px dashed var(--border); padding-left:12px">
                            <div class="ip-mini-bars">
                                <div class="ip-mini-bar"><span>Ahorro</span><div style="width:${ex.savings}%;background:var(--success)"></div><b>${fmtEur(s)}</b></div>
                                <div class="ip-mini-bar"><span>Viajes</span><div style="width:${ex.trips}%;background:var(--info)"></div><b>${fmtEur(t)}</b></div>
                                <div class="ip-mini-bar"><span>Personal</span><div style="width:${ex.personal}%;background:var(--warning)"></div><b>${fmtEur(p)}</b></div>
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>` : `<div class="ip-card"><div class="ip-empty">No hay pagas extras ni bonus en ${monthLabel(ui.month)}</div></div>`}

        <div class="ip-card">
            <div class="ip-ded-head">
                <strong>Proyección Anual</strong>
                ${(ui.showExtraExpanded || ui.expCol !== 'extra') ? `<button class="ip-btn ghost" data-action="reset-col">← Volver a vista general</button>` : ''}
            </div>
            ${renderTable(ids, ex)}
        </div>

        <div class="ip-card">
            <div class="ip-ded-head" style="flex-wrap: wrap;">
                <strong style="flex: none;">Histórico</strong>
                <div class="ip-hist-filters" style="margin-left: auto; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                    <select class="ip-select-sm" data-action="hist-year">
                        <option value="all" ${ui.histFilterYear === 'all' ? 'selected' : ''}>Todos los años</option>
                        ${getHistoryYears().map(y => `<option value="${y}" ${ui.histFilterYear == y ? 'selected' : ''}>${y}</option>`).join('')}
                    </select>
                    <div class="ip-hist-chips" style="display: flex; gap: 4px;">
                        <button class="ip-fchip ${ui.histFilterPerson === 'both' ? 'sel' : ''}" data-action="set-hist-person" data-val="both">Ambos</button>
                        ${ids.map(id => `<button class="ip-fchip ${ui.histFilterPerson === id ? 'sel' : ''}" data-action="set-hist-person" data-val="${id}">${esc(getPerson(id).name)}</button>`).join('')}
                    </div>
                </div>
            </div>
            ${renderChart()}
        </div>`;
    }

    function renderTable(ids, ex) {
        const isExpanded = ui.expCol !== 'extra';
        const isExtraExpanded = ui.showExtraExpanded;

        let expName = '';
        if (isExpanded) expName = { savings: 'Ahorro', trips: 'Viajes', personal: 'Personal' }[ui.expCol];
        if (isExtraExpanded) expName = 'Paga Extra';

        const now = new Date();
        const monthsData = [];
        for (let i = 0; i < 12; i++) {
            const mk = addMonths(monthKey(now), i);
            const rowData = { month: mk, theoretical: {}, real: {}, savings: {}, trips: {}, personal: {}, breakdown: {} };
            let hasAny = false;

            ids.forEach(pid => {
                const items = getMonthExtras(pid, mk);
                if (items.length) hasAny = true;

                const totalTeorico = items.reduce((s,e)=>s+e.amount,0);
                const overrides = state.extraPayments[mk]?.[pid] || {};
                const realVal = overrides.realTotal != null ? overrides.realTotal : null;
                const valFinal = realVal != null ? realVal : totalTeorico;

                rowData.theoretical[pid] = totalTeorico;
                rowData.real[pid] = realVal;
                rowData.savings[pid] = round2(valFinal * ex.savings / 100);
                rowData.trips[pid] = round2(valFinal * ex.trips / 100);
                rowData.personal[pid] = round2(valFinal * ex.personal / 100);
                rowData.breakdown[pid] = items;
            });
            if (hasAny) monthsData.push(rowData);
        }

        const sum = (f, id) => monthsData.reduce((s, r) => s + (r[f][id] || 0), 0);
        const sumAll = f => ids.reduce((s, id) => s + sum(f, id), 0);

        let headHtml = '';
        if (!isExpanded && !isExtraExpanded) {
            headHtml = `
            <tr>
                <th rowspan="2" style="text-align:left;padding-left:12px">Mes</th>
                <th rowspan="2" class="ip-th-clickable" data-action="expand-extra-col">Paga Extra ↕</th>
                <th rowspan="2" class="ip-th-clickable" data-action="expand-col" data-col="savings">Ahorro ↕</th>
                <th rowspan="2" class="ip-th-clickable" data-action="expand-col" data-col="trips">Viajes ↕</th>
                <th rowspan="2" class="ip-th-clickable" data-action="expand-col" data-col="personal">Personal ↕</th>
            </tr>`;
        } else {
            headHtml = `
            <tr>
                <th style="text-align:left;padding-left:12px">Mes</th>
                <th>${esc(getPerson(ids[0]).name)}</th>
                <th>${esc(getPerson(ids[1]).name)}</th>
                <th class="ip-td-total">Total ${expName}</th>
            </tr>`;
        }

        return `<div class="ip-table-scroll">
            <table class="ip-proj-table">
                <thead>${headHtml}</thead>
                <tbody>
                    ${monthsData.map(row => {
                        const isExpandedRow = ui.expandedRows.has(row.month);
                        const hasMultiple = ids.some(id => (row.breakdown[id] || []).length > 1);

                        let html = `<tr class="${isExpandedRow ? 'ip-row-expanded' : ''}">
                            <td class="ip-td-month">
                                ${monthLabel(row.month)}
                                ${hasMultiple ? `<button class="ip-expand-row" data-action="toggle-row" data-month="${row.month}">${isExpandedRow ? '▲' : '▼'}</button>` : ''}
                            </td>`;

                        if (!isExpanded && !isExtraExpanded) {
                            html += `
                                <td class="ip-td-total">${fmtEur(ids.reduce((s,id)=>s+(row.real[id]!=null?row.real[id]:row.theoretical[id]),0))}</td>
                                <td>${fmtEur(ids.reduce((s,id)=>s+row.savings[id],0))}</td>
                                <td>${fmtEur(ids.reduce((s,id)=>s+row.trips[id],0))}</td>
                                <td>${fmtEur(ids.reduce((s,id)=>s+row.personal[id],0))}</td>
                            `;
                        } else {
                            let colKey = isExtraExpanded ? 'extra' : ui.expCol;
                            ids.forEach(id => {
                                let val = 0;
                                if (colKey === 'extra') val = row.real[id] != null ? row.real[id] : row.theoretical[id];
                                else val = row[colKey][id];
                                html += `<td>${fmtEur(val)}</td>`;
                            });

                            let totalVal = 0;
                            if (colKey === 'extra') totalVal = ids.reduce((s,id)=>s+(row.real[id]!=null?row.real[id]:row.theoretical[id]),0);
                            else totalVal = ids.reduce((s,id)=>s+row[colKey][id],0);

                            html += `<td class="ip-td-total">${fmtEur(totalVal)}</td>`;
                        }

                        html += `</tr>`;

                        if (isExpandedRow) {
                            const labels = new Set();
                            ids.forEach(id => {
                                (row.breakdown[id] || []).forEach(b => labels.add(b.label));
                            });

                            labels.forEach(label => {
                                html += `<tr class="ip-row-sub">
                                    <td style="text-align:right; color:var(--text-secondary); font-style:italic;">${esc(label)}</td>`;

                                if (!isExpanded && !isExtraExpanded) {
                                    let totalVal = 0;
                                    ids.forEach(id => {
                                        const b = (row.breakdown[id] || []).find(x => x.label === label);
                                        if (b) {
                                            const isReal = row.real[id] != null;
                                            totalVal += isReal ? (b.amount / (row.theoretical[id]||1)) * row.real[id] : b.amount;
                                        }
                                    });
                                    html += `
                                        <td>${fmtEur(totalVal)}</td>
                                        <td>${fmtEur(totalVal * ex.savings / 100)}</td>
                                        <td>${fmtEur(totalVal * ex.trips / 100)}</td>
                                        <td>${fmtEur(totalVal * ex.personal / 100)}</td>
                                    `;
                                } else {
                                    let totalVal = 0;
                                    let colKey = isExtraExpanded ? 'extra' : ui.expCol;

                                    ids.forEach(id => {
                                        const b = (row.breakdown[id] || []).find(x => x.label === label);
                                        let val = 0;
                                        if (b) {
                                            const isReal = row.real[id] != null;
                                            const rawVal = isReal ? (b.amount / (row.theoretical[id]||1)) * row.real[id] : b.amount;
                                            if (colKey === 'extra') val = rawVal;
                                            else val = round2(rawVal * ex[colKey] / 100);
                                        }
                                        html += `<td>${val > 0 ? fmtEur(val) : '—'}</td>`;
                                        totalVal += val;
                                    });
                                    html += `<td class="ip-td-total">${fmtEur(totalVal)}</td>`;
                                }
                                html += `</tr>`;
                            });
                        }
                        return html;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr class="ip-proj-totals">
                        <td>TOTALES</td>
                        ${!isExpanded && !isExtraExpanded ? `
                        <td>${fmtEur(sumAll('real') || sumAll('theoretical'))}</td>
                        <td>${fmtEur(sumAll('savings'))}</td>
                        <td>${fmtEur(sumAll('trips'))}</td>
                        <td>${fmtEur(sumAll('personal'))}</td>
                        ` : `
                        ${ids.map(id => {
                            if (isExtraExpanded) return `<td>${fmtEur(sum('real', id) || sum('theoretical', id))}</td>`;
                            return `<td>${fmtEur(sum(ui.expCol, id))}</td>`;
                        }).join('')}
                        <td>${fmtEur(isExtraExpanded ? (sumAll('real') || sumAll('theoretical')) : sumAll(ui.expCol))}</td>
                        `}
                    </tr>
                </tfoot>
            </table>
        </div>`;
    }

    function renderChart() {
        const hist = generateHistoryData();
        const ids = ui.histFilterPerson === 'both' ? people() : [ui.histFilterPerson];
        const targetYear = ui.histFilterYear;

        const chartData = hist[people()[0]].map((_, i) => {
            const mk = hist[people()[0]][i].mk;
            if (targetYear !== 'all' && !mk.startsWith(targetYear)) return null;

            const row = { mk, savings: 0, trips: 0, personal: 0, monthly: 0, totalExtra: 0, eq: 0, ex: 0, bo: 0 };
            ids.forEach(pid => {
                row.savings += hist[pid][i].savings;
                row.trips += hist[pid][i].trips;
                row.personal += hist[pid][i].personal;
                row.monthly += hist[pid][i].monthly;
                row.eq += hist[pid][i].equiparacion;
                row.ex += hist[pid][i].extraordinaria;
                row.bo += hist[pid][i].bonus;
            });
            row.totalExtra = row.eq + row.ex + row.bo;
            return row;
        }).filter(Boolean);

        if (!chartData.length) return '<div class="ip-empty">Sin datos para el filtro seleccionado.</div>';

        if (!ui.selectedChartMonth || !chartData.some(d => d.mk === ui.selectedChartMonth)) {
            ui.selectedChartMonth = chartData[chartData.length - 1].mk;
        }

        const selectedData = chartData.find(d => d.mk === ui.selectedChartMonth);
        const maxVal = Math.max(...chartData.map(d => Math.max(d.savings + d.trips + d.personal, d.monthly)), 100);
        const max = maxVal * 1.1;

        const w = chartData.length * 55;
        let svgPath = '';
        let svgCircles = '';

        chartData.forEach((d, i) => {
            const x = i * 55 + 20;
            const y = 200 - (d.monthly / max) * 200;
            if (i === 0) svgPath += `M ${x} ${y} `;
            else svgPath += `L ${x} ${y} `;
            svgCircles += `<circle cx="${x}" cy="${y}" r="3" fill="var(--bg-card)" stroke="var(--text-muted)" stroke-width="2"/>`;
        });

        setTimeout(() => {
            const container = document.querySelector('.ip-chart-scroll');
            if (container) container.scrollLeft = container.scrollWidth;
        }, 100);

        return `<div class="ip-chart-layout">
            <div class="ip-chart-main">
                <div class="ip-chart-scroll">
                    <div class="ip-chart-container" style="min-width: ${w + 100}px;">
                        <div class="ip-chart-y-axis">
                            <span>${fmtEur(max)}</span>
                            <span>${fmtEur(max/2)}</span>
                            <span>0</span>
                        </div>
                        <div class="ip-chart-area">
                            <svg class="ip-chart-line-svg" height="200" width="${w}" style="position:absolute; bottom:0; left:0; pointer-events:none; z-index:1;">
                                <path d="${svgPath}" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-dasharray="4 4" />
                                ${svgCircles}
                            </svg>
                            ${chartData.map(d => {
                                const hS = (d.savings / max) * 100;
                                const hT = (d.trips / max) * 100;
                                const hP = (d.personal / max) * 100;
                                const isSelected = d.mk === ui.selectedChartMonth;
                                return `<div class="ip-chart-col ${isSelected ? 'selected' : ''}" data-action="select-chart-month" data-month="${d.mk}">
                                    <div class="ip-chart-bars">
                                        <div class="ip-chart-bar" style="height:${hS}%;background:var(--success)"></div>
                                        <div class="ip-chart-bar" style="height:${hT}%;background:var(--info)"></div>
                                        <div class="ip-chart-bar" style="height:${hP}%;background:var(--warning)"></div>
                                    </div>
                                    <div class="ip-chart-label">${monthLabel(d.mk, true)}</div>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
                <div class="ip-chart-legend">
                    <span><i style="background:var(--success)"></i> Ahorro</span>
                    <span><i style="background:var(--info)"></i> Viajes</span>
                    <span><i style="background:var(--warning)"></i> Personal</span>
                    <span><i style="background:var(--text-muted);height:2px;width:12px;border-radius:0;border-top:2px dashed var(--text-muted)"></i> Nómina mensual</span>
                </div>
            </div>
            <div class="ip-chart-panel">
                <div class="ip-ded-head" style="margin-bottom:12px; font-size:14px; font-weight:800; color:var(--primary);">
                    ${monthLabel(ui.selectedChartMonth)}
                </div>
                <div class="ip-panel-row"><span>Nómina mensual</span><b>${fmtEur(selectedData.monthly)}</b></div>
                <div class="ip-panel-row" style="margin-top:8px; border-top:1px dashed var(--border); padding-top:8px;">
                    <span>Total Paga Extra</span><b>${fmtEur(selectedData.totalExtra)}</b>
                </div>
                <div class="ip-panel-sub">
                    <div><span>Equiparación:</span><b>${fmtEur(selectedData.eq)}</b></div>
                    <div><span>Extraordinaria:</span><b>${fmtEur(selectedData.ex)}</b></div>
                    <div><span>Bonus:</span><b>${fmtEur(selectedData.bo)}</b></div>
                </div>
                <div class="ip-panel-row" style="margin-top:8px; border-top:1px dashed var(--border); padding-top:8px;">
                    <span>Ahorro</span><b style="color:var(--success)">${fmtEur(selectedData.savings)}</b>
                </div>
                <div class="ip-panel-row">
                    <span>Viajes</span><b style="color:var(--info)">${fmtEur(selectedData.trips)}</b>
                </div>
                <div class="ip-panel-row">
                    <span>Personal</span><b style="color:var(--warning)">${fmtEur(selectedData.personal)}</b>
                </div>
            </div>
        </div>`;
    }

    /* ========================== TAB 4 · SIMULADOR ========================== */
    function renderSim() {
        return `<div class="ip-duo">${people().map(renderSimPerson).join('')}</div>`;
    }

    function renderSimPerson(pid) {
        const person = getPerson(pid);
        const drafts = (state.drafts || []).filter(d => d.personId === pid);

        return `<section class="ip-person" style="--pc:${person.color}">
            <header class="ip-person-head">
                <span class="ip-avatar" style="background:${person.color}">${esc(person.initial || '?')}</span>
                <span class="ip-person-name">${esc(person.name)}</span>
                <button class="ip-add-btn" data-action="new-draft" data-person="${pid}">+ Nuevo escenario</button>
            </header>
            <div class="ip-person-body">
                ${drafts.map(d => {
                    const pv = previewDraft(d);
                    return `<div class="ip-draft ${d.applied ? 'applied' : ''}">
                        <div class="ip-draft-head">
                            <strong>${esc(d.label)}</strong>
                            ${d.applied ? '<span class="ip-badge ok">Aplicado</span>' : '<span class="ip-badge pending">Simulación</span>'}
                        </div>
                        <div class="ip-sim-hero">
                            <div class="ip-sim-col">
                                <div class="ip-kpi-label">Sueldo Neto (${pv.profile.paysPerYear} pagas)</div>
                                <div class="ip-kpi-value">${fmtEur(pv.netPerPay)}</div>
                            </div>
                            <div class="ip-sim-col">
                                <div class="ip-kpi-label">Normalizado (${pv.refPays} pagas)</div>
                                <div class="ip-kpi-value" style="color:var(--primary)">${fmtEur(pv.normalizedMonthly)}</div>
                            </div>
                        </div>
                        <div class="ip-sim-comparison">
                            <div class="ip-sim-bar-wrap">
                                <div class="ip-sim-bar-label">Actual: ${fmtEur(previewDraft({personId: pid, profile: {}}).netPerPay)}</div>
                                <div class="ip-bar-h"><div style="width:${(previewDraft({personId: pid, profile: {}}).netPerPay / Math.max(pv.netPerPay, previewDraft({personId: pid, profile: {}}).netPerPay)) * 100}%;background:var(--text-muted)"></div></div>
                            </div>
                            <div class="ip-sim-bar-wrap">
                                <div class="ip-sim-bar-label" style="color:var(--primary)">Simulado: ${fmtEur(pv.netPerPay)}</div>
                                <div class="ip-bar-h"><div style="width:${(pv.netPerPay / Math.max(pv.netPerPay, previewDraft({personId: pid, profile: {}}).netPerPay)) * 100}%;background:var(--primary)"></div></div>
                            </div>
                        </div>
                        <div class="ip-sim-breakdown">
                            <div class="ip-sim-data"><span>Inicio:</span> <b>${esc(d.startDate)}</b></div>
                            <div class="ip-sim-data"><span>SS:</span> <b>${fmtEur(pv.bd.ssPerPay)}</b></div>
                            <div class="ip-sim-data"><span>IRPF:</span> <b>${fmtPct(pv.bd.irpfEffPct)}</b></div>
                            <div class="ip-sim-data"><span>Paga Extra:</span> <b>${fmtEur(pv.bd.netPerExtra)}</b></div>
                        </div>
                        ${pv.proration.days != null ? `
                        <div class="ip-sim-proration">
                            <b>Primer mes:</b> ${pv.proration.days}/${pv.proration.totalDays} días → <b>${fmtEur(pv.firstMonth)}</b>
                        </div>` : ''}
                        <div class="ip-draft-actions">
                            <button class="ip-btn ghost" data-action="edit-draft" data-id="${d.id}">✏️ Editar</button>
                            <button class="ip-btn danger" data-action="del-draft" data-id="${d.id}">🗑️ Borrar</button>
                            ${d.applied
                                ? `<button class="ip-btn warn" data-action="revert-draft" data-id="${d.id}">↩ Revertir</button>`
                                : `<button class="ip-btn success" data-action="apply-draft" data-id="${d.id}">▶ Aplicar</button>`}
                        </div>
                    </div>`;
                }).join('') || '<div class="ip-empty">Crea un escenario para simular un cambio laboral.</div>'}
            </div>
        </section>`;
    }

    function previewDraft(d) {
        const profile = Object.assign({}, state.profiles[d.personId] || defaultProfile(), d.profile || {});
        const bd = computeSalary(profile);
        const pr = firstMonthProration(d.startDate || todayISO());
        return {
            netPerPay: bd.netPerPay,
            normalizedMonthly: bd.normalizedMonthly,
            refPays: bd.refPays,
            bd: bd,
            proration: pr,
            firstMonth: round2(bd.netPerPay * pr.factor),
            profile
        };
    }
    function firstMonthProration(startDate) {
        const d = new Date(String(startDate) + 'T00:00:00');
        if (isNaN(d.getTime())) return { days: null, totalDays: null, factor: 1 };
        const totalDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const days = Math.max(1, totalDays - d.getDate() + 1);
        return { days, totalDays, factor: div0(days, totalDays) };
    }

    /* ========================== MODALES ========================== */
    let modalRoot = null;
    function closeModal() { if (modalRoot) { modalRoot.remove(); modalRoot = null; } }

    function openNumberModal(opts) {
        closeModal();
        let done = false;
        const commit = () => {
            if (done) return; done = true;
            const input = modalRoot && modalRoot.querySelector('#ipNumInput');
            if (input && opts.onSave) opts.onSave(num(input.value, 0));
            closeModal();
        };
        modalRoot = document.createElement('div');
        modalRoot.className = 'ip-modal-overlay active';
        modalRoot.innerHTML = `<div class="ip-modal">
            <div class="ip-modal-header"><h3 class="ip-modal-title">✏️ ${esc(opts.label || 'Editar')}</h3><button class="ip-modal-close" data-action="close-modal">×</button></div>
            <div class="ip-modal-body">
                <div class="ip-input-group">
                    <label class="ip-input-label">Valor${opts.suffix === '%' ? ' (%)' : ''}</label>
                    <input class="ip-input" id="ipNumInput" type="number" step="${opts.step || '0.01'}" value="${num(opts.value, 0)}">
                </div>
            </div>
            <div class="ip-modal-footer">
                <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
                <button class="btn btn-primary" data-action="confirm-number">Confirmar</button>
            </div>
        </div>`;
        document.body.appendChild(modalRoot);
        const input = modalRoot.querySelector('#ipNumInput');
        setTimeout(() => { input.focus(); input.select(); }, 50);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') closeModal(); });
        modalRoot.addEventListener('click', e => {
            if (e.target === modalRoot) return closeModal();
            if (e.target.closest('[data-action="close-modal"]')) return closeModal();
            if (e.target.closest('[data-action="confirm-number"]')) return commit();
        });
    }

    function openExpenseModal(pid, expId) {
        const existing = expId ? getIndividualExpenses(pid).find(x => x.id === expId) : null;
        closeModal();
        modalRoot = document.createElement('div');
        modalRoot.className = 'ip-modal-overlay active';
        modalRoot.innerHTML = `<div class="ip-modal">
            <div class="ip-modal-header"><h3 class="ip-modal-title">${existing ? 'Editar' : 'Nuevo'} Gasto</h3><button class="ip-modal-close" data-action="close-modal">×</button></div>
            <div class="ip-modal-body">
                <div class="ip-input-group"><label class="ip-input-label">Concepto</label><input class="ip-input" id="eName" value="${existing ? esc(existing.name) : ''}"></div>
                <div class="ip-input-group"><label class="ip-input-label">Importe (€)</label><input class="ip-input" id="eAmount" type="number" step="0.01" value="${existing ? existing.amount : ''}"></div>
                <div class="ip-input-group"><label class="ip-input-label">Frecuencia</label>
                    <select class="ip-input" id="eFreq"><option value="monthly" ${existing && existing.frequency === 'monthly' ? 'selected' : ''}>Mensual</option><option value="annual" ${existing && existing.frequency === 'annual' ? 'selected' : ''}>Anual</option></select></div>
            </div>
            <div class="ip-modal-footer">
                ${existing ? `<button class="btn btn-secondary" style="margin-right:auto; color:var(--danger)" data-action="del-exp-modal">🗑️ Eliminar</button>` : ''}
                <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
                <button class="btn btn-primary" data-action="save-exp" data-id="${existing ? existing.id : ''}" data-person="${pid}">Guardar</button>
            </div>
        </div>`;
        document.body.appendChild(modalRoot);
        modalRoot.addEventListener('click', e => {
            if (e.target === modalRoot || e.target.closest('[data-action="close-modal"]')) closeModal();
            if (e.target.closest('[data-action="del-exp-modal"]')) {
                const exp = getIndividualExpenses(pid).find(x => x.id === expId);
                if (exp) { exp.active = false; saveIndividualExpense(pid, exp); closeModal(); render(); }
            }
            if (e.target.closest('[data-action="save-exp"]')) {
                const exp = existing || { id: null, active: true };
                exp.name = modalRoot.querySelector('#eName').value.trim() || 'Gasto';
                exp.amount = Math.max(0, num(modalRoot.querySelector('#eAmount').value));
                exp.frequency = modalRoot.querySelector('#eFreq').value;
                saveIndividualExpense(pid, exp); closeModal(); render();
            }
        });
    }

    function saveIndividualExpense(pid, exp) {
        if (!state.individualExpenses[ui.month]) state.individualExpenses[ui.month] = {};
        if (!state.individualExpenses[ui.month][pid]) state.individualExpenses[ui.month][pid] = [];
        const list = state.individualExpenses[ui.month][pid];
        if (exp.id) {
            const idx = list.findIndex(x => x.id === exp.id);
            if (idx !== -1) list[idx] = exp;
            else list.push(exp);
        } else {
            exp.id = uid('exp');
            list.push(exp);
        }
        notify({ reason: 'expense-saved' });
    }

    function openDeductionModal(pid, dedId) {
        const p = state.profiles[pid] || defaultProfile();
        const existing = dedId ? (p.deductions || []).find(d => d.id === dedId) : null;
        closeModal();
        modalRoot = document.createElement('div');
        modalRoot.className = 'ip-modal-overlay active';
        modalRoot.innerHTML = `<div class="ip-modal">
            <div class="ip-modal-header"><h3 class="ip-modal-title">${existing ? 'Editar' : 'Nueva'} Deducción</h3><button class="ip-modal-close" data-action="close-modal">×</button></div>
            <div class="ip-modal-body">
                <div class="ip-input-group"><label class="ip-input-label">Concepto</label><input class="ip-input" id="dName" value="${existing ? esc(existing.name) : ''}"></div>
                <div class="ip-input-group"><label class="ip-input-label">Importe (€)</label><input class="ip-input" id="dAmount" type="number" step="0.01" value="${existing ? existing.amount : ''}"></div>
                <div class="ip-input-group"><label class="ip-input-label">Tipo</label>
                    <select class="ip-input" id="dKind"><option value="deduction" ${existing && existing.kind === 'deduction' ? 'selected' : ''}>Deducción</option><option value="complement" ${existing && existing.kind === 'complement' ? 'selected' : ''}>Complemento</option></select></div>
                <div class="ip-input-group"><label class="ip-input-label">Frecuencia</label>
                    <select class="ip-input" id="dFreq"><option value="monthly" ${existing && existing.freq === 'monthly' ? 'selected' : ''}>Mensual</option><option value="annual" ${existing && existing.freq === 'annual' ? 'selected' : ''}>Anual</option></select></div>
            </div>
            <div class="ip-modal-footer">
                ${existing ? `<button class="btn btn-secondary" style="margin-right:auto; color:var(--danger)" data-action="del-ded-modal">🗑️ Eliminar</button>` : ''}
                <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
                <button class="btn btn-primary" data-action="save-ded" data-id="${existing ? existing.id : ''}" data-person="${pid}">Guardar</button>
            </div>
        </div>`;
        document.body.appendChild(modalRoot);
        modalRoot.addEventListener('click', e => {
            if (e.target === modalRoot || e.target.closest('[data-action="close-modal"]')) closeModal();
            if (e.target.closest('[data-action="del-ded-modal"]')) {
                state.profiles[pid].deductions = (state.profiles[pid].deductions || []).filter(d => d.id !== dedId);
                closeModal(); notify({ reason: 'ded-removed' }); render();
            }
            if (e.target.closest('[data-action="save-ded"]')) {
                const name = modalRoot.querySelector('#dName').value.trim() || 'Deducción';
                const amount = Math.max(0, num(modalRoot.querySelector('#dAmount').value));
                const kind = modalRoot.querySelector('#dKind').value;
                const freq = modalRoot.querySelector('#dFreq').value;
                if (existing) { existing.name = name; existing.amount = amount; existing.kind = kind; existing.freq = freq; }
                else { p.deductions = p.deductions || []; p.deductions.push({ id: uid('ded'), name, amount, kind, freq }); }
                closeModal(); notify({ reason: 'ded-saved' }); render();
            }
        });
    }

    function openExtraConfigModal(pid) {
        const p = state.profiles[pid] || defaultProfile();
        const datesStr = (p.extraDates || []).join(', ');
        closeModal();
        modalRoot = document.createElement('div');
        modalRoot.className = 'ip-modal-overlay active';
        modalRoot.innerHTML = `<div class="ip-modal">
            <div class="ip-modal-header"><h3 class="ip-modal-title">Configurar Pagas Extra</h3><button class="ip-modal-close" data-action="close-modal">×</button></div>
            <div class="ip-modal-body">
                <div class="ip-input-group"><label class="ip-input-label">Fechas de Cobro (Mes)</label>
                    <input class="ip-input" id="exDates" value="${datesStr}" placeholder="Ej. 03, 06, 12"></div>
                <div class="ip-input-group"><label class="ip-input-label">Día de pago habitual</label>
                    <input class="ip-input" id="exPayDay" type="number" min="1" max="31" value="${p.extraPayDay || 15}"></div>
                <div class="ip-input-group"><label class="ip-input-label">Fecha de entrada a la empresa</label>
                    <input class="ip-input" id="exJoinDate" type="date" value="${p.joinDate || '2020-01-01'}"></div>
                <div class="ip-input-group"><label class="ip-input-label">Periodo de Devengo</label>
                    <select class="ip-input" id="exAccrual"><option value="annual" ${p.accrualPeriod === 'annual' ? 'selected' : ''}>Anual</option><option value="semiannual" ${p.accrualPeriod === 'semiannual' ? 'selected' : ''}>Semestral</option></select></div>
            </div>
            <div class="ip-modal-footer">
                <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
                <button class="btn btn-primary" data-action="save-extra-config" data-person="${pid}">Guardar</button>
            </div>
        </div>`;
        document.body.appendChild(modalRoot);
        modalRoot.addEventListener('click', e => {
            if (e.target === modalRoot || e.target.closest('[data-action="close-modal"]')) closeModal();
            if (e.target.closest('[data-action="save-extra-config"]')) {
                const str = modalRoot.querySelector('#exDates').value;
                p.extraDates = str.split(',').map(s => s.trim().padStart(2, '0')).filter(s => /^\d{2}$/.test(s));
                p.accrualPeriod = modalRoot.querySelector('#exAccrual').value;
                p.extraPayDay = Math.max(1, Math.min(31, int(modalRoot.querySelector('#exPayDay').value, 15)));
                p.joinDate = modalRoot.querySelector('#exJoinDate').value || '2020-01-01';
                closeModal(); notify({ reason: 'extra-config' }); render();
            }
        });
    }

    function openBonusModal(pid, bonusId) {
        const p = state.profiles[pid] || defaultProfile();
        const existing = bonusId ? (p.bonuses || []).find(b => b.id === bonusId) : null;
        closeModal();
        modalRoot = document.createElement('div');
        modalRoot.className = 'ip-modal-overlay active';
        modalRoot.innerHTML = `<div class="ip-modal">
            <div class="ip-modal-header"><h3 class="ip-modal-title">${existing ? 'Editar' : 'Añadir'} Bonus</h3><button class="ip-modal-close" data-action="close-modal">×</button></div>
            <div class="ip-modal-body">
                <div class="ip-input-group"><label class="ip-input-label">Concepto</label><input class="ip-input" id="bName" value="${existing ? esc(existing.name) : ''}" placeholder="Ej. Bonus anual"></div>
                <div class="ip-input-group"><label class="ip-input-label">Fecha de pago aprox.</label><input class="ip-input" id="bDate" type="date" value="${existing ? existing.date : todayISO()}"></div>
                <div class="ip-input-group"><label class="ip-input-label">Importe Bruto (€)</label><input class="ip-input" id="bAmount" type="number" step="0.01" value="${existing ? existing.amount : ''}"></div>
                <div class="ip-input-group"><label class="ip-input-label">IRPF a descontar (€) <span style="font-weight:normal;font-size:10px;color:var(--text-muted)">Dejar en 0 si la empresa ya lo retiene</span></label><input class="ip-input" id="bIrpf" type="number" step="0.01" value="${existing ? existing.irpfDiscount : '0'}"></div>
            </div>
            <div class="ip-modal-footer">
                ${existing ? `<button class="btn btn-secondary" style="margin-right:auto; color:var(--danger)" data-action="del-bonus-modal">🗑️ Eliminar</button>` : ''}
                <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
                <button class="btn btn-primary" data-action="save-bonus" data-id="${existing ? existing.id : ''}" data-person="${pid}">Guardar</button>
            </div>
        </div>`;
        document.body.appendChild(modalRoot);
        modalRoot.addEventListener('click', e => {
            if (e.target === modalRoot || e.target.closest('[data-action="close-modal"]')) closeModal();
            if (e.target.closest('[data-action="del-bonus-modal"]')) {
                p.bonuses = (p.bonuses || []).filter(b => b.id !== bonusId);
                closeModal(); notify({ reason: 'bonus-removed' }); render();
            }
            if (e.target.closest('[data-action="save-bonus"]')) {
                const name = modalRoot.querySelector('#bName').value.trim() || 'Bonus';
                const date = modalRoot.querySelector('#bDate').value;
                const amount = Math.max(0, num(modalRoot.querySelector('#bAmount').value));
                const irpfDiscount = Math.max(0, num(modalRoot.querySelector('#bIrpf').value));
                if (existing) { existing.name = name; existing.date = date; existing.amount = amount; existing.irpfDiscount = irpfDiscount; }
                else { p.bonuses = p.bonuses || []; p.bonuses.push({ id: uid('bon'), name, date, amount, irpfDiscount }); }
                closeModal(); notify({ reason: 'bonus-saved' }); render();
            }
        });
    }

    function openDraftModal(pid, draftId) {
        const existing = draftId ? (state.drafts || []).find(d => d.id === draftId) : null;
        const base = existing ? Object.assign({}, state.profiles[pid] || defaultProfile(), existing.profile || {}) : (state.profiles[pid] || defaultProfile());
        const defDate = existing ? existing.startDate : (addMonths(monthKey(new Date()), 1) + '-01');
        closeModal();
        modalRoot = document.createElement('div');
        modalRoot.className = 'ip-modal-overlay active';
        modalRoot.innerHTML = `<div class="ip-modal ip-modal-wide">
            <div class="ip-modal-header"><h3 class="ip-modal-title">${existing ? 'Modificar' : 'Nuevo'} Escenario</h3><button class="ip-modal-close" data-action="close-modal">×</button></div>
            <div class="ip-modal-body">
                <div class="ip-input-group"><label class="ip-input-label">Etiqueta</label><input class="ip-input" id="dLabel" value="${esc(existing ? existing.label : '')}" placeholder="Ej. Nuevo trabajo"></div>
                <div class="ip-input-group"><label class="ip-input-label">Fecha de inicio</label><input class="ip-input" id="dStart" type="date" value="${defDate}" min="${todayISO()}"></div>
                <div class="ip-fields-grid">
                    <div class="ip-input-group"><label class="ip-input-label">Bruto anual (€)</label><input class="ip-input" id="dGross" type="number" value="${num(base.grossAnnual)}" step="100"></div>
                    <div class="ip-input-group"><label class="ip-input-label">Nº pagas</label><select class="ip-input" id="dPays">${[12, 14, 15, 16].map(n => `<option value="${n}" ${int(base.paysPerYear, 12) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
                    <div class="ip-input-group"><label class="ip-input-label">SS %</label><input class="ip-input" id="dSS" type="number" value="${num(base.socialSecurityPct, 6.5)}" step="0.01"></div>
                    <div class="ip-input-group"><label class="ip-input-label">IRPF %</label><input class="ip-input" id="dIrpf" type="number" value="${num(base.irpfPercent, 15)}" step="0.1"></div>
                </div>
            </div>
            <div class="ip-modal-footer">
                <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
                <button class="btn btn-primary" data-action="save-draft" data-person="${pid}" data-id="${existing ? existing.id : ''}">💾 Guardar</button>
            </div>
        </div>`;
        document.body.appendChild(modalRoot);
        modalRoot.addEventListener('click', e => {
            if (e.target === modalRoot || e.target.closest('[data-action="close-modal"]')) closeModal();
            const btn = e.target.closest('[data-action="save-draft"]');
            if (btn) {
                const label = modalRoot.querySelector('#dLabel').value.trim();
                const startDate = modalRoot.querySelector('#dStart').value;
                if (!label || !startDate) return;
                const profile = {
                    grossAnnual: Math.max(0, num(modalRoot.querySelector('#dGross').value)),
                    paysPerYear: int(modalRoot.querySelector('#dPays').value, 12),
                    socialSecurityPct: clamp(modalRoot.querySelector('#dSS').value, 0, 100),
                    irpfPercent: clamp(modalRoot.querySelector('#dIrpf').value, 0, 100),
                    irpfMode: 'manual'
                };
                if (existing) { existing.label = label; existing.startDate = startDate; existing.profile = profile; }
                else { state.drafts.push({ id: uid('dr'), personId: pid, label, startDate, profile, applied: false }); }
                closeModal(); notify({ reason: 'draft-saved' }); render();
            }
        });
    }

    /* ========================== RENDER PRINCIPAL ========================== */
    let containerEl = null;
    function render(container) {
        if (container) containerEl = container;
        if (!containerEl) return;
        ensureState();
        let body = '';
        switch (ui.tab) {
            case 'base': body = renderBase(); break;
            case 'dist': body = renderDist(); break;
            case 'extras': body = renderExtras(); break;
            case 'sim': body = renderSim(); break;
        }
        containerEl.innerHTML = `<div class="ip-wrap">${renderTabs()}<div class="ip-tab-body">${body}</div></div>`;
        bindEvents();
    }

    /* ========================== EVENTOS ========================== */
    function bindEvents() {
        if (!containerEl || containerEl._ipBound) return;
        containerEl._ipBound = true;
        containerEl.addEventListener('click', onClick);
        containerEl.addEventListener('change', onChange);
    }

    function onClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        const pid = target.dataset.person;
        const id = target.dataset.id;

        switch (action) {
            case 'switch-tab':
                ui.tab = target.dataset.tab;
                render();
                break;
            case 'prev-month':
                ui.month = addMonths(ui.month, -1);
                render();
                break;
            case 'next-month':
                ui.month = addMonths(ui.month, 1);
                render();
                break;
            case 'edit-number':
                e.stopPropagation();
                openNumberModal({
                    label: target.dataset.label,
                    value: target.dataset.value,
                    suffix: target.dataset.suffix || '',
                    onSave: val => applyNumericField(target.dataset.field, pid, val)
                });
                break;
            case 'add-ded':
                openDeductionModal(pid);
                break;
            case 'edit-ded':
                openDeductionModal(pid, id);
                break;
            case 'add-exp':
                openExpenseModal(pid);
                break;
            case 'edit-exp':
                openExpenseModal(pid, id);
                break;
            case 'select-chart-month':
                ui.selectedChartMonth = target.dataset.month;
                render();
                break;

            /* FASE 3 · Confirmar cobro mensual → registra en Dinero */
            case 'tick-month': {
                const theo = theoreticalMonthly(pid, ui.month);
                if (!state.monthlyControl[ui.month]) state.monthlyControl[ui.month] = { theoretical: {}, real: {}, confirmed: {} };
                state.monthlyControl[ui.month].theoretical[pid] = theo;
                state.monthlyControl[ui.month].real[pid] = theo;
                state.monthlyControl[ui.month].confirmed[pid] = true;

                if (window.App && typeof App.registerIncomeMovement === 'function') {
                    const profile = state.profiles[pid] || defaultProfile();
                    const day = String(profile.extraPayDay || 15).padStart(2, '0');
                    const person = getPerson(pid);
                    try {
                        App.registerIncomeMovement({
                            amount: theo,
                            date: `${ui.month}-${day}`,
                            concept: `Nómina ${monthLabel(ui.month)} · ${person.name}`,
                            accountId: defaultAccountFor(pid),
                            link: { kind: 'salary', id: `salary-${pid}-${ui.month}` }
                        });
                    } catch (err) { /* noop */ }
                }

                notify({ reason: 'month-tick' });
                render();
                break;
            }

            /* FASE 3 · Confirmar extra/bonus → ingreso + distribución automática */
            case 'tick-extra-item': {
                const itemId = target.dataset.item;
                const theo = num(target.dataset.theo);
                if (!state.extraPayments[ui.month]) state.extraPayments[ui.month] = {};
                if (!state.extraPayments[ui.month][pid]) state.extraPayments[ui.month][pid] = { realItems: {} };
                if (!state.extraPayments[ui.month][pid].realItems) state.extraPayments[ui.month][pid].realItems = {};
                state.extraPayments[ui.month][pid].realItems[itemId] = theo;

                if (window.App && typeof App.registerIncomeMovement === 'function') {
                    const profile = state.profiles[pid] || defaultProfile();
                    const day = String(profile.extraPayDay || 15).padStart(2, '0');
                    const person = getPerson(pid);
                    const date = `${ui.month}-${day}`;
                    const items = getMonthExtras(pid, ui.month);
                    const item = items.find(x => x.id === itemId);
                    const linkId = `extra-${pid}-${ui.month}-${itemId}`;

                    if (item) {
                        // 1. Ingreso principal (toda la paga extra en cuenta del titular)
                        try {
                            App.registerIncomeMovement({
                                amount: theo,
                                date,
                                concept: `${item.label} · ${person.name}`,
                                accountId: defaultAccountFor(pid),
                                link: { kind: 'extra-payment', id: linkId }
                            });
                        } catch (err) { /* noop */ }

                        // 2. Distribución según reparto configurado
                        const ex = getExtraDistribution();
                        const savingsAmt = round2(theo * ex.savings / 100);
                        const tripsAmt = round2(theo * ex.trips / 100);

                        // 2a. Ahorro: transferencia interna a cuenta de inversión
                        if (savingsAmt > 0 && typeof App.registerExpenseMovement === 'function') {
                            const savingsAccId = 'acc-tr';
                            const accounts = (window.App && typeof App.getAccounts === 'function') ? App.getAccounts() : [];
                            if (accounts.find(a => a.id === savingsAccId)) {
                                try {
                                    App.registerExpenseMovement({
                                        amount: savingsAmt,
                                        date,
                                        concept: `${item.label} → Ahorro (salida)`,
                                        accountId: defaultAccountFor(pid),
                                        link: { kind: 'extra-savings-out', id: linkId }
                                    });
                                    App.registerIncomeMovement({
                                        amount: savingsAmt,
                                        date,
                                        concept: `${item.label} → Ahorro (entrada)`,
                                        accountId: savingsAccId,
                                        link: { kind: 'extra-savings-in', id: linkId }
                                    });
                                } catch (err) { /* noop */ }
                            }
                        }

                        // 2b. Viajes: aportación al fondo de viajes (goal g-trip-fund)
                        if (tripsAmt > 0 && typeof App.addTripSavingsContribution === 'function') {
                            try {
                                App.addTripSavingsContribution({
                                    amount: tripsAmt,
                                    date,
                                    note: `${item.label} · Viajes`,
                                    payer: person.name
                                });
                            } catch (err) { /* noop */ }
                        }
                    }
                }

                notify({ reason: 'extra-item-tick' });
                render();
                break;
            }

            case 'edit-extra-item-real': {
                const itemId = target.dataset.item;
                openNumberModal({
                    label: `Real ${getPerson(pid).name}`,
                    value: target.dataset.real || 0,
                    onSave: val => {
                        if (!state.extraPayments[ui.month]) state.extraPayments[ui.month] = {};
                        if (!state.extraPayments[ui.month][pid]) state.extraPayments[ui.month][pid] = { realItems: {} };
                        if (!state.extraPayments[ui.month][pid].realItems) state.extraPayments[ui.month][pid].realItems = {};
                        state.extraPayments[ui.month][pid].realItems[itemId] = val;
                        notify({ reason: 'extra-item-real' });
                        render();
                    }
                });
                break;
            }

            case 'expand-col':
                ui.expCol = target.dataset.col;
                ui.showExtraExpanded = false;
                render();
                break;
            case 'reset-col':
                ui.expCol = 'extra';
                ui.showExtraExpanded = false;
                render();
                break;
            case 'expand-extra-col':
                ui.showExtraExpanded = true;
                ui.expCol = 'extra';
                render();
                break;
            case 'reset-extra-col':
                ui.showExtraExpanded = false;
                render();
                break;
            case 'toggle-row': {
                const mk = target.dataset.month;
                if (ui.expandedRows.has(mk)) ui.expandedRows.delete(mk);
                else ui.expandedRows.add(mk);
                render();
                break;
            }
            case 'set-hist-person':
                ui.histFilterPerson = target.dataset.val;
                render();
                break;
            case 'new-draft':
                openDraftModal(pid);
                break;
            case 'edit-draft':
                openDraftModal(pid, id);
                break;
            case 'del-draft':
                if (confirm('¿Eliminar escenario?')) {
                    state.drafts = state.drafts.filter(d => d.id !== id);
                    notify({ reason: 'draft-del' });
                    render();
                }
                break;
            case 'apply-draft': {
                const d = state.drafts.find(x => x.id === id);
                if (d && confirm('¿Aplicar?')) {
                    if (!d.beforeProfile) d.beforeProfile = JSON.parse(JSON.stringify(state.profiles[d.personId] || {}));
                    Object.assign(state.profiles[d.personId], d.profile);
                    d.applied = true;
                    notify({ reason: 'draft-applied' });
                    render();
                }
                break;
            }
            case 'revert-draft': {
                const d = state.drafts.find(x => x.id === id);
                if (d && d.beforeProfile && confirm('¿Revertir?')) {
                    state.profiles[d.personId] = d.beforeProfile;
                    d.applied = false;
                    delete d.beforeProfile;
                    notify({ reason: 'draft-reverted' });
                    render();
                }
                break;
            }
            case 'edit-extra-config':
                openExtraConfigModal(pid);
                break;
            case 'add-bonus':
                openBonusModal(pid);
                break;
            case 'edit-bonus':
                openBonusModal(pid, id);
                break;
        }
    }

    function onChange(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        if (target.dataset.action === 'change-field') {
            const pid = target.dataset.person, field = target.dataset.field;
            const p = state.profiles[pid];
            if (!p) return;
            let val = target.value;
            if (field === 'paysPerYear') val = int(val, 12);
            p[field] = val;
            notify({ reason: 'profile-changed' });
            render();
        } else if (target.dataset.action === 'hist-year') {
            ui.histFilterYear = target.value;
            render();
        }
    }

    function applyNumericField(field, pid, val) {
        ensureState();
        switch (field) {
            case 'grossAnnual': state.profiles[pid].grossAnnual = Math.max(0, num(val)); break;
            case 'socialSecurityPct': state.profiles[pid].socialSecurityPct = clamp(val, 0, 100); break;
            case 'irpfPercent': state.profiles[pid].irpfMode = 'manual'; state.profiles[pid].irpfPercent = clamp(val, 0, 100); break;
            case 'savingsPct': state.distribution[pid].savingsPct = clamp(val, 0, 100); break;
            case 'monthlyReal': {
                const mk = ui.month;
                if (!state.monthlyControl[mk]) state.monthlyControl[mk] = { theoretical: {}, real: {}, confirmed: {} };
                state.monthlyControl[mk].real[pid] = Math.max(0, num(val));
                break;
            }
            case 'extraSavings': {
                state.extraDistribution.savings = clamp(val, 0, 100);
                if (state.extraDistribution.savings + state.extraDistribution.trips > 100) state.extraDistribution.trips = 100 - state.extraDistribution.savings;
                break;
            }
            case 'extraTrips': {
                state.extraDistribution.trips = clamp(val, 0, 100);
                if (state.extraDistribution.savings + state.extraDistribution.trips > 100) state.extraDistribution.savings = 100 - state.extraDistribution.trips;
                break;
            }
        }
        notify({ reason: 'numeric-updated' });
        render();
    }

    /* ========================== LISTENER app:module-changed ========================== */
    let _ingresosBound = false;
    function bindModuleChange() {
        if (_ingresosBound) return;
        document.addEventListener('app:module-changed', (e) => {
            const src = e.detail && e.detail.source;
            if (!src || src === MODULE) return;
            const cont = document.querySelector('#sec-ingresos-personales');
            if (cont && cont.isConnected && cont.innerHTML.trim()) {
                try { render(cont); } catch (err) { /* noop */ }
            }
        });
        _ingresosBound = true;
    }

    function init(container) {
        if (container) containerEl = container;
        state = ensureState();
        save();
        bindModuleChange();
    }
    function onThemeChange() {}

        return {
        render, init, onThemeChange,
        reloadFromStorage: () => { state = loadState(); },
        computeSalary, estimateIrpf, getMaxPays,
        getEquity, getDistributionAmounts, getSharedContributionRules, getPcNeeds,
        getState: () => { ensureState(); return JSON.parse(JSON.stringify(state)); },

        /* ============ FASE 2 · API del puente ============ */
        getSalary,
        getIncomeForMonth,
        getIndividualExpenses,

        /* ============ FASE 3 · Confirmación desde el calendario ============ */
        getMonthExtras: (pid, mk) => getMonthExtras(pid, mk || ui.month),

        confirmIncomeReceipt: (pid, mk, amount) => {
            const val = Math.max(0, num(amount));
            if (!state.monthlyControl[mk]) state.monthlyControl[mk] = { theoretical: {}, real: {}, confirmed: {} };
            state.monthlyControl[mk].theoretical[pid] = theoreticalMonthly(pid, mk);
            state.monthlyControl[mk].real[pid] = val;
            state.monthlyControl[mk].confirmed[pid] = true;

            const profile = state.profiles[pid] || defaultProfile();
            const day = String(profile.extraPayDay || 15).padStart(2, '0');
            const person = getPerson(pid);

            if (window.App && typeof App.registerIncomeMovement === 'function') {
                try {
                    App.registerIncomeMovement({
                        amount: val,
                        date: `${mk}-${day}`,
                        concept: `Nómina ${monthLabel(mk)} · ${person.name}`,
                        accountId: defaultAccountFor(pid),
                        link: { kind: 'salary', id: `salary-${pid}-${mk}` }
                    });
                } catch (err) { /* noop */ }
            }
            save();
            return true;
        },

        confirmExtraReceipt: (pid, mk, itemId, amount) => {
            const val = Math.max(0, num(amount));
            if (!state.extraPayments[mk]) state.extraPayments[mk] = {};
            if (!state.extraPayments[mk][pid]) state.extraPayments[mk][pid] = { realItems: {} };
            if (!state.extraPayments[mk][pid].realItems) state.extraPayments[mk][pid].realItems = {};
            state.extraPayments[mk][pid].realItems[itemId] = val;

            const profile = state.profiles[pid] || defaultProfile();
            const day = String(profile.extraPayDay || 15).padStart(2, '0');
            const person = getPerson(pid);
            const items = getMonthExtras(pid, mk);
            const item = items.find(x => x.id === itemId);
            const date = `${mk}-${day}`;
            const linkId = `extra-${pid}-${mk}-${itemId}`;

            if (item && window.App && typeof App.registerIncomeMovement === 'function') {
                // 1 · Ingreso principal
                try {
                    App.registerIncomeMovement({
                        amount: val,
                        date,
                        concept: `${item.label} · ${person.name}`,
                        accountId: defaultAccountFor(pid),
                        link: { kind: 'extra-payment', id: linkId }
                    });
                } catch (err) { /* noop */ }

                // 2 · Distribución: ahorro (transferencia) + viajes (fondo)
                const ex = getExtraDistribution();
                const savingsAmt = round2(val * ex.savings / 100);
                const tripsAmt = round2(val * ex.trips / 100);

                if (savingsAmt > 0 && typeof App.registerExpenseMovement === 'function') {
                    const accounts = (window.App && typeof App.getAccounts === 'function') ? App.getAccounts() : [];
                    if (accounts.find(a => a.id === 'acc-tr')) {
                        try {
                            App.registerExpenseMovement({
                                amount: savingsAmt, date,
                                concept: `${item.label} → Ahorro (salida)`,
                                accountId: defaultAccountFor(pid),
                                link: { kind: 'extra-savings-out', id: linkId }
                            });
                            App.registerIncomeMovement({
                                amount: savingsAmt, date,
                                concept: `${item.label} → Ahorro (entrada)`,
                                accountId: 'acc-tr',
                                link: { kind: 'extra-savings-in', id: linkId }
                            });
                        } catch (err) { /* noop */ }
                    }
                }
                if (tripsAmt > 0 && typeof App.addTripSavingsContribution === 'function') {
                    try {
                        App.addTripSavingsContribution({
                            amount: tripsAmt, date,
                            note: `${item.label} · Viajes`,
                            payer: person.name
                        });
                    } catch (err) { /* noop */ }
                }
            }
            save();
            return true;
        }
    };
})();

window.IngresosModulo = IngresosModulo;
if (window.App) {
    if (typeof App.registerSection === 'function') App.registerSection('ingresos-personales', IngresosModulo);
    if (typeof App.registerModule === 'function') App.registerModule('ingresos-personales', IngresosModulo);
}