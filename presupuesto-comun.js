/* =============================================================================
   PRESUPUESTO-COMUN.JS · v8 — Limpieza de datos demo y lectura total del Sheet
   ============================================================================= */
const BudgetApp = (function () {
    'use strict';

    const CAT_META = {
        'pc-rent':      { accent: '#6366f1', label: 'RENT' },
        'pc-utilities': { accent: '#f59e0b', label: 'UTILITIES' },
        'pc-groceries': { accent: '#10b981', label: 'GROCERIES & LEISURE' },
        'pc-loans':     { accent: '#ef4444', label: 'LOANS' },
        'pc-savings':   { accent: '#8b5cf6', label: 'SAVINGS' },
        'pc-trips':     { accent: '#0ea5e9', label: 'TRIPS' },
        'pc-others':    { accent: '#64748b', label: 'OTHERS' }
    };

    function rowLabel(row) {
        if (!row) return '';
        return String(row.label || row.name || '').toUpperCase();
    }

    function data() { return App.data; }
    
    // 1. Fecha dinámica del mes actual (eliminado el '2026-11')
    const _now = new Date();
    let currentPeriod = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`;
    
    let containerEl = null;
    let popEl = null;
    let uiState = { catFilter: 'all', movDays: 30, weekFilter: 'all' };
    let _pcBound = false;

    /* =========================================================
       FASE 1 · ACCESO UNIFICADO
       ========================================================= */

    function getAccounts() {
        return (window.App && typeof App.getAccounts === 'function')
            ? App.getAccounts()
            : (data().accounts || []);
    }

    // 2. Cuentas dinámicas (eliminado el array hardcodeado por defecto)
    function getAccountNames() {
        const accs = getAccounts().map(a => a.name);
        return accs.length ? accs : ['Trade Republic', 'Trade Republic 2', 'MyInvestor', 'Junta'];
    }

    function pcLoans() {
        if (window.App && typeof App.getLoans === 'function') return App.getLoans();
        return [];
    }

    function mapAccountName(name) {
        if (!name) return null;
        const accounts = getAccounts();
        const lower = String(name).toLowerCase().trim();
        let acc = accounts.find(a => String(a.name).toLowerCase() === lower);
        if (acc) return acc.id;
        acc = accounts.find(a => lower.includes(String(a.name).toLowerCase().split(' ')[0]));
        return acc ? acc.id : null;
    }

    /* =========================================================
       NORMALIZACIÓN DE DATOS
       ========================================================= */
    function fixGroceriesName() {
        const c = (data().pcCategories || []).find(x => x.id === 'pc-groceries');
        if (c && /liquor/i.test(String(c.name || ''))) {
            c.name = 'Groceries & Leisure'; c.label = 'GROCERIES & LEISURE';
            App.saveData();
        }
    }
    function dedupeLoans() {
        const subs = data().pcSubcategories;
        if (Array.isArray(subs)) {
            const clean = subs.filter(s => s.parentId !== 'pc-loans');
            if (clean.length !== subs.length) { data().pcSubcategories = clean; App.saveData(); }
        }
    }
    function removeOthersGenSub() {
        const subs = data().pcSubcategories;
        if (!Array.isArray(subs)) return;
        const clean = subs.filter(s => s.id !== 'pcs-others-gen' && !(s.parentId === 'pc-others' && /gastos varios/i.test(String(s.name || ''))));
        if (clean.length !== subs.length) { data().pcSubcategories = clean; App.saveData(); }
    }

    /* =========================================================
       SEMANAS
       ========================================================= */
    function weekAutoState(w) {
        const today = new Date().toISOString().slice(0, 10);
        if (!(Number(w.budget) > 0)) return 'vacia';
        if (String(w.start) > currentPeriod + '-31') return 'vacia';
        if (today >= String(w.start) && today <= String(w.end)) return 'en-curso';
        if (today > String(w.end)) return 'pasada';
        return 'vacia';
    }
    function weekState(w) {
        const auto = weekAutoState(w);
        const man = (recon().weekStates || {})[w.id];
        return (man && man !== 'vacia' && auto !== 'vacia') ? man : auto;
    }
    const WEEK_STATE_META = {
        'en-curso': { label: 'En curso', cls: 'st-current', badge: 'pc-badge-blue' },
        'pasada':   { label: 'Pasada',   cls: 'st-past',    badge: 'pc-badge-green' },
        'vacia':    { label: 'Vacía',    cls: 'st-empty',   badge: 'pc-badge-gray' }
    };

    function weeksFor(period) { return allWeeks().filter(w => String(w.start).substring(0, 7) === period); }
    function generateMonthWeeks(period, count) {
        const [y, m] = period.split('-').map(Number);
        const first = new Date(y, m - 1, 1);
        const dow = (first.getDay() + 6) % 7;
        const start = new Date(first); start.setDate(first.getDate() - dow);
        const list = [];
        for (let i = 0; i < count; i++) {
            const s = new Date(start); s.setDate(start.getDate() + i * 7);
            const e = new Date(s);     e.setDate(s.getDate() + 6);
            const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            list.push({ id: `wk-${period}-${i + 1}`, label: `Semana ${i + 1}`, start: iso(s), end: iso(e), budget: 0 });
        }
        return list;
    }

    function pcCats()    { return (data().pcCategories || []).slice().sort((a, b) => (a.order || 99) - (b.order || 99)); }
    function pcSubs(pid) { return (data().pcSubcategories || []).filter(s => s.parentId === pid); }
    function pcWeeks()   { return weeksFor(currentPeriod); }
    function allWeeks()  { return (data().pcWeeks || []).slice().sort((a, b) => String(a.start).localeCompare(String(b.start))); }
    function weekCount(period) { return weeksFor(period).length; }
    
    // 3. Presupuesto semanal por defecto a 0 (eliminado el 160)
    function defaultWeekBudget() {
        const c = pcCats().find(x => x.id === 'pc-groceries');
        return (c && c.budget !== null && c.budget !== undefined) ? Number(c.budget) : 0; 
    }

    // 4. Reconciliación a 0 (eliminado el 845.15)
    function recon() {
        if (!data().pcReconciliation) {
            data().pcReconciliation = { 
                initialBalance: 0, 
                weeksClosed: {}, 
                loansPaid: {}, 
                realBalances: {} 
            };
        }
        return data().pcReconciliation;
    }

    function periodExpenses(period, includePlanned) {
        return (data().expenses || []).filter(e => {
            const p = e.aggPeriod || String(e.date || '').substring(0, 7);
            if (p !== period) return false;
            if (e.status === 'archivado') return false;
            if (!includePlanned && e.status === 'previsto') return false;
            return true;
        });
    }
    function pcRealExpenses() { return periodExpenses(currentPeriod).filter(e => e.status !== 'aportacion'); }
    function sum(list) { return list.reduce((s, e) => s + Number(e.amount || 0), 0); }

    function subSpent(subId) { return sum(pcRealExpenses().filter(e => e.categoryId === subId)); }

    function catSpent(catId) {
        const ids = [catId].concat(pcSubs(catId).map(s => s.id));
        return sum(pcRealExpenses().filter(e => ids.includes(e.categoryId)));
    }

    function rowSpent(rowId) {
        return String(rowId).startsWith('pcs-') ? subSpent(rowId) : catSpentDerived(rowId);
    }
    function rowBudget(rowId) {
        return String(rowId).startsWith('pcs-') ? subBudget(rowId) : catBudget(rowId);
    }
    function findRow(id) {
        if (String(id).startsWith('pcs-')) return (data().pcSubcategories || []).find(s => s.id === id) || null;
        return pcCats().find(c => c.id === id) || null;
    }
    function subBudget(subId) {
        const s = (data().pcSubcategories || []).find(x => x.id === subId);
        if (!s) return null;
        return (s.budget === null || s.budget === undefined) ? null : Number(s.budget);
    }

    /* =========================================================
       PRESUPUESTOS DERIVADOS
       ========================================================= */
    function catBudget(catId) {
        const c = pcCats().find(x => x.id === catId);
        if (!c) return null;

        if (catId === 'pc-loans') {
            const active = pcLoans().filter(l => (l.paidCount || 0) < (l.installments || 0));
            const total = active.reduce((s, l) => s + Number(l.installmentAmount || 0), 0);
            return total > 0 ? total : null;
        }

        if (catId === 'pc-trips') {
            const tripComms = (window.App && typeof App.getTripCommitments === 'function')
                ? App.getTripCommitments() : [];
            const total = tripComms.reduce((s, x) => s + Number(x.amount || 0), 0);
            return total > 0 ? total : null;
        }

        const subs = pcSubs(catId);
        if (subs.length) {
            let total = null;
            subs.forEach(s => { if (s.budget !== null && s.budget !== undefined) total = (total === null ? 0 : total) + Number(s.budget); });
            return total;
        }

        let total = (c.budget === null || c.budget === undefined) ? null : Number(c.budget);
        if (catId === 'pc-groceries') {
            const w = pcWeeks().reduce((s, x) => s + Number(x.budget || 0), 0);
            if (w) total = (total === null ? 0 : total) + w;
        }
        return total;
    }

    function catSpentDerived(catId) {
        if (catId === 'pc-loans') {
            return pcLoans().reduce(
                (s, l) => s + (Number(l.paidCount) || 0) * (Number(l.installmentAmount) || 0), 0
            );
        }
        const subs = pcSubs(catId);
        if (!subs.length) return catSpent(catId);
        return subs.reduce((s, sub) => s + subSpent(sub.id), 0);
    }

    function totalBudgetDefined() {
        return pcCats().reduce((s, c) => { const b = catBudget(c.id); return s + (b === null ? 0 : b); }, 0);
    }
    function totalRealSpent() { return sum(pcRealExpenses()); }
    function pendingPayments() {
        return pcLoans().filter(l => !recon().loansPaid[l.id]).reduce((s, l) => s + Number(l.installmentAmount || 0), 0);
    }
    function accountRealBalance(accName) {
        const acc = getAccounts().find(a => (a.name || '').toLowerCase().includes(String(accName || '').toLowerCase().split(' ')[0]));
        return acc ? Number(acc.balance || 0) : 0;
    }
    function combinedRealBalance() {
        return getAccounts().reduce((s, a) => s + Number(a.balance || 0), 0);
    }

    /* =========================================================
       RECONCILIACIÓN TR
       ========================================================= */
    function trExpected() {
        const r = recon();
        const wkExp = pcRealExpenses().filter(e => String(e.date || '').substring(0, 7) === currentPeriod);
        const weekSpent = pcWeeks().reduce((s, w) => s + sum(wkExp.filter(e => e.pcWeekId === w.id)), 0);
        const paidLoans = pcLoans().reduce((s, l) => r.loansPaid[l.id] ? s + Number(l.installmentAmount || 0) : s, 0);
        return Number(r.initialBalance || 0) - weekSpent - paidLoans;
    }
    function trReal() { return Number(recon().realBalances[currentPeriod] || 0); }
    
    // 5. Objetivo MyInvestor a 0 (eliminado el 1125)
    function miTarget() { 
        return Number(data().pcMyInvestorTarget || 0); 
    }

    /* =========================================================
       UTILIDADES DE FORMATO
       ========================================================= */
    function fmt(n) { return App.formatCurrency(Number(n) || 0); }
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function shortDate(iso) { const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }); }
    function numCell(txt, extraCls) { return `<td class="pc-td-num ${extraCls || ''}">${txt}</td>`; }
    function badge(text, cls) { return `<span class="pc-badge ${cls || 'pc-badge-gray'}">${text}</span>`; }
    function dueBadge(dueDate) {
        if (!dueDate) return '';
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const d = new Date(dueDate + 'T00:00:00');
        if (isNaN(d)) return '';
        const dd = App.formatDate(dueDate).slice(0, 5);
        const days = Math.round((d - today) / 864e5);
        const cls = days < 0 ? 'over' : days <= 7 ? 'soon' : '';
        return `<span class="pc-due ${cls}" title="Vencimiento">📅 Vence: ${esc(dd)}</span>`;
    }
    function pctBadge(budget, spent) {
        if (budget === null || budget === undefined) return badge('No definido', 'pc-badge-gray');
        if (Number(budget) === 0) return badge(spent > 0 ? `Fijado 0 € · gasto ${fmt(spent)}` : 'Fijado 0,00 €', 'pc-badge-red');
        const pct = (spent / budget) * 100;
        const cls = pct > 100 ? 'pc-badge-red' : pct >= 85 ? 'pc-badge-amber' : 'pc-badge-green';
        return badge(`${pct.toFixed(0)}% consumido`, cls);
    }
    function miniBar(spent, budget, accent) {
        const pct = budget ? Math.min((spent / budget) * 100, 100) : 0;
        const col = !budget ? accent : spent > budget ? '#ef4444' : pct >= 85 ? '#f59e0b' : '#10b981';
        const bp = budget === null ? null : (budget === 0 ? 100 : (spent / budget) * 100);
        return `<span class="pc-mini-bar"><span class="pc-mini-track"><span class="pc-mini-fill" style="width:${pct}%;background:${col}"></span></span>${badge(bp === null ? '—' : `${Math.round(bp)}%`, bp === null ? 'pc-badge-gray' : bp > 100 ? 'pc-badge-red' : bp >= 85 ? 'pc-badge-amber' : 'pc-badge-green')}</span>`;
    }
    function stateDot(color, text) { return `<span class="pc-state" style="--state-color:${color}">${esc(text)}</span>`; }
    function chip(label, val, cls) { return `<button class="pc-chip ${cls || 'gray'}" ${val}>${label}</button>`; }
    function muted(txt) { return `<span style="color:var(--text-muted);font-size:12px">${txt}</span>`; }
    function availCls(v) { return v === null ? '' : v >= 0 ? 'pc-pos' : 'pc-neg'; }
    function diffCls(v, invert) { const good = invert ? v <= 0 : v >= 0; return good ? 'pc-pos' : 'pc-neg'; }
    function availScaleCls(avail, budget) {
        if (avail === null || budget === null || budget === undefined || budget <= 0) return '';
        const pctLeft = (avail / budget) * 100;
        if (pctLeft < 0) return 'pc-av-red';
        if (pctLeft < 20) return 'pc-av-amber';
        return 'pc-av-green';
    }
    function availCell(budget, spent) {
        if (budget === null || budget === undefined) return `<td class="pc-td-num pc-avail-cell">—</td>`;
        const avail = budget - spent;
        return `<td class="pc-td-num pc-avail-cell ${availScaleCls(avail, budget)}">${fmt(avail)}</td>`;
    }

    /* =========================================================
       MOVIMIENTOS
       ========================================================= */
    function addMovement(targetId, amount, opts) {
        opts = opts || {};
        const id = 'pc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const exp = {
            id, concept: opts.concept || 'Movimiento', amount: Number(amount) || 0,
            date: opts.date || new Date().toISOString().slice(0, 10),
            categoryId: targetId, person: opts.person || 'conjunto',
            status: opts.status || 'registrado', type: 'individual', notes: opts.notes || '',
            aggPeriod: currentPeriod, pcAccount: opts.account || ''
        };
        if (opts.pcWeekId) exp.pcWeekId = opts.pcWeekId;
        if (opts.link) exp.link = opts.link;

        data().expenses.push(exp);
        App.saveData();

        if (exp.status === 'registrado' && window.App && typeof App.registerExpenseMovement === 'function') {
            const row = findRow(targetId);
            const accName = opts.account || (row && row.account) || '';
            const accId = mapAccountName(accName);
            const movLink = opts.link || { kind: 'expense', id: exp.id };
            try {
                App.registerExpenseMovement({
                    amount: Math.abs(exp.amount),
                    concept: exp.concept,
                    date: exp.date,
                    accountId: accId,
                    link: movLink
                });
            } catch (err) { /* noop */ }
        }

        App.addHistory('presupuesto-comun', `${opts.action || 'Movimiento'}: ${exp.concept} (${fmt(exp.amount)})`);
        render();
        return id;
    }

    function setRowReal(rowId, newValue) {
        newValue = Number(newValue) || 0;
        const cur = rowSpent(rowId);
        const diff = newValue - cur;
        if (Math.abs(diff) < 0.005) { App.showToast('Sin cambios', 'info'); return; }
        const fillers = data().expenses.filter(e => e.categoryId === rowId && e.pcAuto === 'ajuste');
        if (fillers.length >= 1) {
            fillers[0].amount = newValue;
            fillers.slice(1).forEach(f => f.status = 'archivado');
            App.saveData();
            App.addHistory('presupuesto-comun', `Ajuste directo «${(findRow(rowId) || {}).name || rowId}»: ${fmt(newValue)}`);
            render(); return;
        }
        addMovement(rowId, newValue, { concept: 'Ajuste de gasto real', account: (findRow(rowId) || {}).account || '', action: 'Ajuste' });
        const last = data().expenses[data().expenses.length - 1];
        if (last && last.concept === 'Ajuste de gasto real') last.pcAuto = 'ajuste';
        App.saveData(); render();
    }

    function setExpenseStatus(expenseId, newStatus) {
        const exp = (data().expenses || []).find(e => e.id === expenseId);
        if (!exp) return;
        const was = exp.status;
        exp.status = newStatus;
        App.saveData();

        if (was !== 'registrado' && newStatus === 'registrado') {
            const row = findRow(exp.categoryId);
            const accName = exp.pcAccount || (row && row.account) || '';
            const accId = mapAccountName(accName);
            if (window.App && typeof App.registerExpenseMovement === 'function') {
                try {
                    App.registerExpenseMovement({
                        amount: Math.abs(exp.amount),
                        concept: exp.concept,
                        date: exp.date,
                        accountId: accId,
                        link: { kind: 'expense', id: exp.id }
                    });
                } catch (err) { /* noop */ }
            }
        }
        App.addHistory('presupuesto-comun', `Estado cambiado a ${newStatus}: ${exp.concept}`);
        App.notifyModuleChange('presupuesto-comun', { reason: 'expense-status', expenseId });
        render();
    }

    /* =========================================================
       RENDER
       ========================================================= */
    const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    function headerHtml() {
        const [cy, cm] = currentPeriod.split('-');
        const thisYear = new Date().getFullYear();
        const years = []; for (let y = thisYear - 3; y <= thisYear + 3; y++) years.push(y);
        if (!years.includes(Number(cy))) years.push(Number(cy));
        years.sort();
        const mSel = MONTH_NAMES.map((n, i) => `<option value="${String(i + 1).padStart(2, '0')}" ${String(i + 1).padStart(2, '0') === cm ? 'selected' : ''}>${n}</option>`).join('');
        const ySel = years.map(y => `<option ${String(y) === cy ? 'selected' : ''}>${y}</option>`).join('');
        return `<div class="pc-topbar-v5">
            <div class="pc-period-pill">📆
                <select id="pcMonth" title="Mes del dashboard">${mSel}</select>
                <select id="pcYear" title="Año del dashboard">${ySel}</select>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-sm" id="pcBtnCat">＋ Nueva categoría</button>
                <button class="btn btn-primary btn-sm" id="pcNewMov">＋ Nuevo movimiento</button>
            </div></div>`;
    }

    function kpisHtml() {
        const presup = totalBudgetDefined();
        const gastos = totalRealSpent();
        const disponible = presup - gastos;
        const saldos = combinedRealBalance();
        const pctGlob = presup ? Math.min((gastos / presup) * 100, 100) : 0;
        const desv = gastos - presup;

        let sharedTotal = null, coveragePct = null, coverageCls = '', coverageNote = 'Aporte del hogar sin reglas configuradas';
        try {
            const rules = (window.App && typeof App.getSharedContributionRules === 'function') ? App.getSharedContributionRules() : null;
            if (rules && typeof rules.total === 'number') {
                sharedTotal = Number(rules.total) || 0;
                if (presup > 0) {
                    coveragePct = Math.round((sharedTotal / presup) * 100);
                    if (coveragePct >= 100) coverageCls = 'pc-pos';
                    else if (coveragePct >= 80) coverageCls = 'pc-warn';
                    else coverageCls = 'pc-neg';
                    coverageNote = `${fmt(sharedTotal)} aportados / ${fmt(presup)} necesarios`;
                } else {
                    coverageNote = `${fmt(sharedTotal)} aportados · sin presupuesto definido`;
                }
            }
        } catch (e) {}

        const perPersonTooltip = (() => {
            try {
                const rules = window.App && typeof App.getSharedContributionRules === 'function' ? App.getSharedContributionRules() : null;
                if (!rules) return '';
                return Object.keys(rules).filter(k => k !== 'total' && rules[k] && typeof rules[k] === 'object')
                    .map(k => `${k}: ${fmt(rules[k].amount)} (${Math.round(rules[k].pct)}%)`)
                    .join(' · ');
            } catch (e) { return ''; }
        })();

        return `<div class="pc-kpis-v4">
            <div class="pc-kpi-card" style="--kpi-accent:var(--primary)">
                <span class="pc-kpi-icon">🎯</span>
                <div class="pc-kpi-label">Presupuesto Total</div>
                <div class="pc-kpi-big">${fmt(presup)}</div>
                <div class="pc-kpi-note">Asignaciones del periodo ${esc(App.formatPeriod(currentPeriod))}</div></div>

            <div class="pc-kpi-card" style="--kpi-accent:var(--warning)">
                <span class="pc-kpi-icon">💸</span>
                <div class="pc-kpi-label">Gasto Ejecutado</div>
                <div class="pc-kpi-big">${fmt(gastos)}</div>
                <div class="pc-progress"><div style="width:${pctGlob}%;background:${pctGlob >= 100 ? 'var(--danger)' : 'var(--warning)'}"></div></div>
                <div class="pc-kpi-note pc-num">${presup ? pctGlob.toFixed(0) : 0}% del presupuesto consumido</div></div>

            <div class="pc-kpi-card" style="--kpi-accent:${disponible >= 0 ? 'var(--success)' : 'var(--danger)'}">
                <span class="pc-kpi-icon">💶</span>
                <div class="pc-kpi-label">Dinero Disponible</div>
                <div class="pc-kpi-big ${availCls(disponible)}">${fmt(disponible)}</div>
                <div class="pc-kpi-note">Desviación: <b class="pc-num ${diffCls(-desv)}">${desv > 0 ? '+' : ''}${fmt(desv)}</b></div></div>

            <div class="pc-kpi-card" style="--kpi-accent:#8b5cf6">
                <span class="pc-kpi-icon">🏦</span>
                <div class="pc-kpi-label">Saldo Real Cuentas</div>
                <div class="pc-kpi-big">${fmt(saldos)}</div>
                <div class="pc-kpi-note">Bancos y tarjetas combinados</div></div>

            <div class="pc-kpi-card" style="--kpi-accent:${coverageCls === 'pc-neg' ? 'var(--danger)' : coverageCls === 'pc-warn' ? 'var(--warning)' : 'var(--success)'}">
                <span class="pc-kpi-icon">🤝</span>
                <div class="pc-kpi-label">
                    Aporte Común
                    ${perPersonTooltip ? `<span class="pc-info" tabindex="0" aria-label="Reparto por persona">ⓘ<span class="pc-info-tip">${esc(perPersonTooltip)}</span></span>` : ''}
                </div>
                <div class="pc-kpi-big ${coverageCls}">
                    ${sharedTotal != null ? fmt(sharedTotal) : '—'}
                    ${coveragePct != null ? `<span style="font-size:13px;font-weight:700;opacity:.75;margin-left:6px">${coveragePct}%</span>` : ''}
                </div>
                ${coveragePct != null
                    ? `<div class="pc-progress"><div style="width:${Math.min(coveragePct, 100)}%;background:${coveragePct >= 100 ? 'var(--success)' : coveragePct >= 80 ? 'var(--warning)' : 'var(--danger)'}"></div></div>`
                    : ''}
                <div class="pc-kpi-note">${coverageNote}</div></div>
        </div>`;
    }

    function weeksPanelHtml() {
        const weeks = pcWeeks();
        const total = weeks.reduce((s, w) => s + Number(w.budget || 0), 0);
        const wkExp = pcRealExpenses().filter(e => String(e.date || '').substring(0, 7) === currentPeriod);
        const cards = weeks.map(w => {
            const spent = sum(wkExp.filter(e => e.pcWeekId === w.id));
            const st = weekState(w);
            const meta = WEEK_STATE_META[st];
            return `<div class="pc-week-card week-${st} ${meta.cls}" data-week="${w.id}" title="Clic para ver/editar los movimientos de esta semana">
                <div class="pc-week-head"><span class="pc-week-name">${esc(w.label)}</span><span class="pc-badge ${meta.badge}">${meta.label}</span></div>
                <div class="pc-week-dates">${shortDate(w.start)} → ${shortDate(w.end)}</div>
                <div class="pc-week-amt pc-num">${fmt(w.budget)}</div>
                <div class="pc-week-spent">Gastado: <b class="pc-num ${spent > w.budget ? 'pc-neg' : ''}">${fmt(spent)}</b></div>
            </div>`;
        }).join('');
        return `<div class="pc-panel pc-panel--accent" style="--panel-accent:#10b981">
            <div class="pc-panel-title"><span class="pc-dot"></span>
                <span class="pc-gro-title" id="pcGroTitle" title="Clic para decidir cuántas semanas tiene este mes">🛒 Groceries &amp; Leisure · distribución semanal</span>
                <span style="margin-left:auto">${badge('Total ' + fmt(total), 'pc-badge-blue')}</span></div>
            <div class="pc-week-cards">${cards || '<div class="pc-empty">Mes sin semanas definidas · clic en el título para crearlas</div>'}</div>
        </div>`;
    }

    function accountsPanelHtml() {
        const accounts = getAccounts();
        if (!accounts.length) {
            return `<div class="pc-panel pc-panel--accent" style="--panel-accent:#2563eb">
                <div class="pc-panel-title"><span class="pc-dot"></span> 🏦 Estado de Cuentas</div>
                <div class="pc-empty">No hay cuentas configuradas. Añádelas en el módulo de Dinero.</div>
            </div>`;
        }

        const html = accounts.map(a => {
            // Usamos el saldo real de la cuenta
            const realVal = Number(a.balance) || 0;
            return `<div class="pc-account-row" data-editacc="${a.id}" title="Clic para editar el saldo real de ${esc(a.name)}">
                <div><b>${a.icon || '🏦'} ${esc(a.name)}</b> <span class="pc-acc-hint">✏️</span>
                    <div class="pc-week-dates">Tipo: <b>${esc(a.type || 'conjunta')}</b></div></div>
                <div style="text-align:right">
                    <div class="pc-num pc-acc-real">${fmt(realVal)}</div>
                </div></div>`;
        }).join('');

        return `<div class="pc-panel pc-panel--accent" style="--panel-accent:#2563eb">
            <div class="pc-panel-title"><span class="pc-dot"></span> 🏦 Estado de Cuentas</div>
            ${html}</div>`;
    }

    function openEditAccountModal(accId) {
        const acc = getAccounts().find(a => a.id === accId);
        if (!acc) return;

        const cur = Number(acc.balance) || 0;
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>${acc.icon || '🏦'} ${esc(acc.name)} · Saldo real</h3>
            <div class="pc-field"><label>Saldo real en banco (€)</label>
                <input id="eaVal" type="number" step="0.01" value="${cur.toFixed(2)}"></div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="eaCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="eaSave">Guardar</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        div.querySelector('#eaCancel').onclick = closeModal;
        const inp = div.querySelector('#eaVal'); inp.focus(); inp.select();
        
        const save = () => {
            const v = Number(inp.value || 0);
            acc.balance = v;
            App.saveData();
            App.notifyModuleChange('presupuesto-comun', { reason: 'account-updated' });
            App.addHistory('presupuesto-comun', `Saldo real ${acc.name}: ${fmt(v)}`);
            closeModal(); render(); App.showToast('Saldo actualizado', 'success');
        };
        
        div.querySelector('#eaSave').onclick = save;
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') closeModal(); });
    }

    function infoBadge(accountText) {
        const acc = String(accountText || '—');
        return `<span class="pc-info" tabindex="0" aria-label="Cuenta asociada">ⓘ<span class="pc-info-tip">Cuenta: <b>${esc(acc)}</b></span></span>`;
    }

    function titleWithBar(icon, name, spent, budget, accent, opts) {
        const o = opts || {};
        const bpRaw = (budget === null || budget === undefined) ? null : (budget <= 0 ? 100 : (spent / budget) * 100);
        const bp = bpRaw === null ? 0 : Math.min(bpRaw, 100);
        const fillCol = bpRaw === null ? 'var(--border)'
            : bpRaw > 100 ? 'color-mix(in srgb, var(--pc-neg) 32%, transparent)'
            : `color-mix(in srgb, ${accent} 30%, transparent)`;
        const pctLabel = bpRaw === null ? '' : `${Math.round(bpRaw)}%`;
        const nameHtml = `<span class="pc-cat-name" ${o.editAttr ? `data-${o.editAttr}="${o.editId}" title="Clic para editar${o.isSub ? ' subcategoría' : ' categoría'}"` : ''}>${esc(name)}</span>`;
        return `<span class="pc-title-bar" style="--fill:${bp}%;--fill-col:${fillCol}">` +
            `<span class="pc-title-inner">${icon} ${nameHtml}${o.suffixHtml || ''}</span>` +
            `<b class="pc-title-pct pc-num">${pctLabel}</b></span>`;
    }

    function tickBtn(rowId, budget, spent) {
        if (budget === null || budget === undefined) return '';
        const diff = budget - spent;
        const done = Math.abs(diff) < 0.005;
        return `<button class="pc-tick-btn ${done ? 'done' : ''}" data-tick="${rowId}"
            title="${done ? 'Gasto real = presupuesto' : `Igualar gasto real al presupuesto (+${fmt(diff)})`}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.8 8.6 6.4 11.2 12.2 5.4"/></svg></button>`;
    }

    function equalizeRow(rowId) {
        const row = findRow(rowId);
        if (!row) return;
        if (rowId === 'pc-loans' || rowId === 'pc-trips') {
            App.showToast('Esta categoría se calcula automáticamente desde otros módulos', 'info');
            return;
        }
        const budget = String(rowId).startsWith('pcs-') ? subBudget(rowId) : catBudget(rowId);
        const spent = rowSpent(rowId);
        if (budget === null || budget === undefined) { App.showToast('Esta fila no tiene presupuesto definido', 'warn'); return; }
        const diff = budget - spent;
        if (Math.abs(diff) < 0.005) { App.showToast('Ya está igualado ✓', 'success'); return; }
        addMovement(rowId, diff, {
            concept: `Ajuste hasta presupuesto · ${row.name || rowId}`,
            account: row.account || '', action: 'Igualación'
        });
        App.showToast(`Gasto real igualado al presupuesto (${diff > 0 ? '+' : ''}${fmt(diff)})`, 'success');
    }

    function tableHtml() {
        const cats = pcCats();
        let html = `<div class="pc-table-wrap"><table class="pc-table pc-table-compact"><thead><tr>
            <th>CATEGORÍA / SUBCATEGORÍA</th>
            <th class="pc-th-num">PRESUPUESTO</th><th class="pc-th-num">GASTO REAL</th>
            <th class="pc-th-num">DISPONIBLE</th></tr></thead><tbody>`;
        cats.forEach(c => {
            // 🔄 LEE EL COLOR DEL SHEET (c.color o c.accent). Si no existe, usa CAT_META por defecto.
            const accentColor = c.color || c.accent || (CAT_META[c.id] ? CAT_META[c.id].accent : '#2563eb');
            const subs = pcSubs(c.id);
            const cb = catBudget(c.id), cs = rowSpent(c.id);
            const derived = subs.length > 0 || c.id === 'pc-loans' || c.id === 'pc-trips';
            const catSuffix = `${infoBadge(c.account)}${dueBadge(c.dueDate)}${derived ? '<span class="pc-derived-tag" title="Importes calculados como suma de sus subcategorías">Σ</span>' : ''}`;
            
            html += `<tr class="pc-row-cat" data-moves="${c.id}" style="--cat-accent:${accentColor}">
                <td class="pc-td-cat">${tickBtn(c.id, cb, cs)}${titleWithBar(c.icon || '📁', rowLabel(c), cs, cb, accentColor, { editAttr: 'editcat', editId: c.id, suffixHtml: catSuffix })}</td>
                <td class="pc-td-num">${cb === null ? muted('No definido') : fmt(cb)}</td>
                <td class="pc-td-num"><span class="pc-cell-edit" data-real="${c.id}" title="Clic para ajustar el gasto real">✏️ ${fmt(cs)}</span></td>
                <td class="pc-td-num">${availCell(cb, cs).replace(/^<td[^>]*>|<\/td>$/g, '')}</td></tr>`;
            
            subs.forEach(s => {
                const sb = subBudget(s.id);
                const ss = subSpent(s.id);
                // 🔄 Las subcategorías heredan el color de la subcategoría o de su padre
                const subColor = s.color || s.accent || accentColor;
                const subSuffix = `${infoBadge(s.account || c.account)}${dueBadge(s.dueDate)}`;
                
                html += `<tr class="pc-row-sub" data-moves="${s.id}" style="--cat-accent:${subColor}">
                    <td class="pc-td-cat">${tickBtn(s.id, sb, ss)}${titleWithBar(s.icon || '·', s.name, ss, sb, subColor, { editAttr: 'editsub', editId: s.id, isSub: true, suffixHtml: subSuffix })}</td>
                    <td class="pc-td-num">${sb === null ? muted('No definido') : fmt(sb)}</td>
                    <td class="pc-td-num"><span class="pc-cell-edit" data-real="${s.id}" title="Clic para ajustar el gasto real">✏️ ${fmt(ss)}</span></td>
                    <td class="pc-td-num">${availCell(sb, ss).replace(/^<td[^>]*>|<\/td>$/g, '')}</td></tr>`;
            });
            
            if (c.id === 'pc-loans') pcLoans().forEach(l => {
                const paid = (l.paidCount || 0) >= (l.installments || 0);
                html += `<tr class="pc-row-sub" style="--cat-accent:${accentColor}">
                    <td>💳 ${esc(l.name)} <span class="pc-num" style="color:var(--text-muted)">(${l.paidCount || 0}/${l.installments || 0} cuotas)</span> ${infoBadge(l.accountName || 'Trade Republic')}</td>
                    <td class="pc-td-num">${fmt(l.installmentAmount)}/cuota</td>
                    <td class="pc-td-num">—</td>
                    <td class="pc-td-num"><span class="pc-toggle"><input type="checkbox" data-loanpaid="${l.id}" ${paid ? 'checked' : ''}><span class="pc-slider"></span></span> ${badge(paid ? 'Pagado' : 'Cuota', paid ? 'pc-badge-green' : 'pc-badge-gray')}</td></tr>`;
            });
        });
        html += '</tbody></table></div>';
        return html;
    }

    function openMovesModal(rowId) {
        const row = findRow(rowId);
        if (!row) return;
        const isSub = String(rowId).startsWith('pcs-');
        const ids = isSub ? [rowId] : [rowId].concat(pcSubs(rowId).map(s => s.id));
        const parentName = isSub ? ((pcCats().find(x => x.id === row.parentId) || {}).name || '') : '';
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal pc-modal-wide">
            <h3>🧾 Movimientos · ${esc(row.name)} ${isSub && parentName ? `<span style="font-weight:500;color:var(--text-muted);font-size:12px">(${esc(parentName)})</span>` : ''}
                <button class="pc-btn pc-btn-primary" id="mvAdd" style="margin-left:auto;padding:6px 12px;font-size:12px">＋ Añadir</button></h3>
            <div id="mvList"></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        const renderList = () => {
            const movs = pcRealExpenses().filter(e => ids.includes(e.categoryId))
                .slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
            const list = div.querySelector('#mvList');
            if (!movs.length) { list.innerHTML = '<div class="pc-empty">Todavía no hay movimientos en esta ' + (isSub ? 'subcategoría' : 'categoría') + '.</div>'; return; }
            list.innerHTML = `<div class="pc-mov-head"><span>FECHA</span><span>DESCRIPCIÓN</span><span>IMPORTE</span><span></span></div>` +
                movs.map(m => {
                    const sub = findRow(m.categoryId) || {};
                    const desc = m.concept + (isSub ? '' : (sub.name ? ` · ${sub.name}` : ''));
                    return `<div class="pc-mov-line">
                        <span class="pc-mov-date">${shortDate(m.date)}</span>
                        <span class="pc-mov-desc">${esc(desc)}</span>
                        <b class="pc-mov-amt">${fmt(m.amount)}</b>
                        <span class="pc-mov-acts">
                            <button class="pc-btn pc-btn-ghost" style="padding:4px 8px;font-size:11px" data-editmov="${m.id}" title="Editar movimiento">✏️</button>
                            <button class="pc-btn pc-btn-ghost" style="padding:4px 8px;font-size:11px" data-delmov="${m.id}" title="Eliminar movimiento">×</button>
                        </span></div>`;
                }).join('') +
                `<div class="pc-sum-row" style="margin-top:8px"><span>Total del periodo</span><b class="pc-num">${fmt(sum(movs))}</b></div>`;
            bindMoveButtons(list);
        };
        const bindMoveButtons = (scope) => {
            scope.querySelectorAll('[data-editmov]').forEach(b => b.onclick = () => { openEditMovModal(b.getAttribute('data-editmov'), rowId); });
            scope.querySelectorAll('[data-delmov]').forEach(b => b.onclick = () => {
                const id = b.getAttribute('data-delmov');
                const mv = (data().expenses || []).find(x => x.id === id) || {};
                App.showConfirm(`¿Eliminar el movimiento «${mv.concept || id}»?`, () => {
                    data().expenses = data().expenses.filter(x => x.id !== id);
                    App.saveData(); App.addHistory('presupuesto-comun', `Movimiento eliminado: ${mv.concept || id}`);
                    renderList(); render();
                });
            });
        };
        div.querySelector('#mvAdd').onclick = () => { closeModal(); openNewMovModal(rowId); };
        renderList();
    }

    /* =========================================================
       MODALES
       ========================================================= */
    function closeModal() { const b = document.getElementById('pcBackdrop'); if (b) b.remove(); }
    function closePop() { if (popEl) { popEl.remove(); popEl = null; } }

    function openCatModal(id, isSub) {
        const item = isSub ? (data().pcSubcategories || []).find(s => s.id === id) : pcCats().find(c => c.id === id);
        if (!item) return;
        if (id === 'pc-loans' || id === 'pc-trips') {
            App.showToast('Esta categoría se gestiona desde otros módulos', 'info');
            return;
        }
        
        const accOpts = getAccountNames().map(a => `<option ${item.account === a ? 'selected' : ''}>${a}</option>`).join('');
        const subs = !isSub ? pcSubs(id) : [];
        closeModal();
        const derivedNote = (!isSub && subs.length)
            ? `<div class="pc-derived-note">📐 Los importes de esta categoría se calculan como <b>suma de sus ${subs.length} subcategorías</b>. Edita presupuesto y gasto real en cada subcategoría.</div>` : '';
        const budgetField = derivedNote ? '' : `<div class="pc-field"><label>Presupuesto (€) · vacío = no definido</label><input id="mBudget" type="number" step="0.01" value="${item.budget === null || item.budget === undefined ? '' : item.budget}"></div>`;
        const spentField = derivedNote ? '' : `<div class="pc-field"><label>Gasto real (€) · ajuste directo</label><input id="mSpent" type="number" step="0.01" value="${Number(rowSpent(item.id)).toFixed(2)}"></div>`;
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>${item.icon || '⚙️'} Editar ${isSub ? 'subcategoría' : 'categoría'}</h3>
            ${derivedNote}
            <div class="pc-field"><label>Nombre</label><input id="mName" value="${esc(item.name)}"></div>
            <div class="pc-field"><label>Icono</label><input id="mIcon" value="${esc(item.icon || '')}" maxlength="4"></div>
            ${budgetField}${spentField}
            <div class="pc-field"><label>Cuenta vinculada</label><select id="mAcc">${accOpts}</select></div>
            <div class="pc-field"><label>Fecha de vencimiento</label><input id="mDue" type="date" value="${esc(item.dueDate || '')}"></div>
            <div class="pc-modal-actions">
                <button class="pc-btn pc-btn-danger" id="mDelete">🗑 Eliminar</button>
                <button class="pc-btn pc-btn-ghost" id="mMoves" title="Ver los movimientos de esta categoría">🧾 Movimientos</button>
                <button class="pc-btn pc-btn-ghost" id="mCancel">Cancelar</button>
                <button class="pc-btn pc-btn-primary" id="mSave">Guardar</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        div.querySelector('#mCancel').onclick = closeModal;
        div.querySelector('#mMoves').onclick = () => { closeModal(); openMovesModal(item.id); };
        div.querySelector('#mSave').onclick = () => {
            item.name = div.querySelector('#mName').value.trim() || item.name;
            item.icon = div.querySelector('#mIcon').value.trim() || item.icon;
            if (!derivedNote) {
                const bv = div.querySelector('#mBudget').value;
                item.budget = bv === '' ? null : Number(bv);
            }
            item.account = div.querySelector('#mAcc').value;
            item.dueDate = div.querySelector('#mDue').value || null;
            App.saveData(); App.addHistory('presupuesto-comun', `Editada ${isSub ? 'subcategoría' : 'categoría'}: ${item.name}`);
            const sp = div.querySelector('#mSpent');
            closeModal();
            if (sp) {
                const nv = Number(sp.value);
                if (!isNaN(nv) && Math.abs(nv - rowSpent(item.id)) >= 0.005) { setRowReal(item.id, nv); return; }
            }
            render(); App.showToast('Guardado', 'success');
        };
        div.querySelector('#mDelete').onclick = () => {
            App.showConfirm(`¿Eliminar «${item.name}»? Sus movimientos quedarán archivados.`, () => {
                if (isSub) {
                    data().pcSubcategories = data().pcSubcategories.filter(s => s.id !== item.id);
                } else {
                    data().pcCategories = data().pcCategories.filter(c => c.id !== item.id);
                    data().pcSubcategories = (data().pcSubcategories || []).filter(s => s.parentId !== item.id);
                }
                data().expenses.forEach(e => { if (e.categoryId === item.id) e.status = 'archivado'; });
                App.saveData(); App.addHistory('presupuesto-comun', `Eliminada ${isSub ? 'subcategoría' : 'categoría'}: ${item.name}`);
                closeModal(); render(); App.showToast('Elemento eliminado', 'success');
            });
        };
    }

    function openQuickPop(anchorEl, rowId, currentValue) {
        closePop();
        const row = findRow(rowId);
        popEl = document.createElement('div');
        popEl.className = 'pc-pop';
        const items = pcRealExpenses().filter(e => e.categoryId === rowId);
        const listHtml = items.length
            ? items.slice(-4).reverse().map(m => `<div class="pc-sum-row" style="padding:5px 0;font-size:11.5px"><span>${shortDate(m.date)} · ${esc(m.concept)}</span><b class="pc-num">${fmt(m.amount)}</b></div>`).join('')
            : '<div class="pc-pop-hint" style="margin:4px 0 0">Sin movimientos registrados todavía</div>';
        popEl.innerHTML = `<div class="pc-pop-head"><span>Gasto Real (€) · ${esc((row ? (row.label || row.name) : rowId))}</span><button class="pc-btn pc-btn-ghost" id="qpMore" title="Registrar un movimiento" style="padding:2px 8px;font-size:11px">＋ mov.</button></div>
            <input type="number" step="0.01" id="qpVal" class="pc-inline-input" value="${Number(currentValue).toFixed(2)}">
            ${listHtml}
            <div class="pc-pop-actions">
                <button class="pc-btn pc-btn-ghost" id="qpCancel" title="Cerrar (Esc)">×</button>
                <button class="pc-btn pc-btn-primary" id="qpSave">💾 Guardar</button></div>
            <div class="pc-pop-hint">Enter guarda · Esc cierra</div>`;
        document.body.appendChild(popEl);
        const rect = anchorEl.getBoundingClientRect();
        popEl.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 260)) + 'px';
        popEl.style.top = (rect.bottom + 8) + 'px';
        const inp = popEl.querySelector('#qpVal'); inp.focus(); inp.select();
        const save = () => { setRowReal(rowId, inp.value); closePop(); App.showToast('Gasto real actualizado', 'success'); };
        popEl.querySelector('#qpSave').onclick = save;
        popEl.querySelector('#qpCancel').onclick = closePop;
        popEl.querySelector('#qpMore').onclick = (ev) => { ev.stopPropagation(); closePop(); openNewMovModal(rowId); };
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') closePop(); });
        setTimeout(() => document.addEventListener('click', function outside(ev) {
            if (popEl && !popEl.contains(ev.target) && ev.target !== anchorEl) { closePop(); document.removeEventListener('click', outside); }
        }), 0);
    }

    function catOptionsHtml(selectedId) {
        return pcCats().map(c => {
            if (c.id === 'pc-loans' || c.id === 'pc-trips') return '';
            const subs = pcSubs(c.id);
            const label = esc((c.icon || '📁') + ' ' + (CAT_META[c.id] ? CAT_META[c.id].label : c.name));
            if (!subs.length) return `<option value="${c.id}" ${selectedId === c.id ? 'selected' : ''}>${label}</option>`;
            const opts = subs.map(s => `<option value="${s.id}" ${selectedId === s.id ? 'selected' : ''}>${s.icon || '·'} ${esc(s.name)}</option>`).join('');
            return `<optgroup label="${label}">${opts}</optgroup>`;
        }).join('');
    }

    function openNewMovModal(preselectCatId, preWeekId) {
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>📝 Nuevo movimiento</h3>
            <div class="pc-field"><label>Concepto</label><input id="nConcept" placeholder="Ej. Cena imprevista"></div>
            <div class="pc-field"><label>Categoría / Subcategoría</label><select id="nCat">${catOptionsHtml(preselectCatId)}</select></div>
            <div class="pc-field"><label>Importe (€)</label><input id="nAmt" type="number" step="0.01" placeholder="0,00"></div>
            <div class="pc-field"><label>Fecha</label><input id="nDate" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
            <div class="pc-field"><label>Cuenta</label><select id="nAcc"><option value="">Heredar de la categoría</option>${getAccountNames().map(a => `<option>${a}</option>`).join('')}</select></div>
            <div class="pc-field"><label>¿Quién pagó?</label><select id="nWho"><option value="conjunto">Conjunto</option>${(App.data.profiles || []).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
            <div class="pc-field"><label>Estado</label><select id="nStatus"><option value="registrado">Registrado (descuenta saldo)</option><option value="previsto">Previsto</option><option value="pendiente">Pendiente</option></select></div>
            <div class="pc-field" id="nWeekWrap"><label>Semana (Groceries & Leisure)</label><select id="nWeek"><option value="">— sin asignar —</option>${pcWeeks().map(w => `<option value="${w.id}" ${preWeekId === w.id ? 'selected' : ''}>${esc(w.label)} (${shortDate(w.start)}→${shortDate(w.end)})</option>`).join('')}</select></div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="nCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="nSave">Registrar</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        const nCatSel = div.querySelector('#nCat'), nWeekWrap = div.querySelector('#nWeekWrap');
        const syncWeek = () => { nWeekWrap.style.display = String(nCatSel.value).startsWith('pc-groceries') || String(nCatSel.value).startsWith('pcs-gl') ? '' : 'none'; };
        nCatSel.onchange = syncWeek; syncWeek();
        div.querySelector('#nCancel').onclick = closeModal;
        div.querySelector('#nSave').onclick = () => {
            const amt = Number(div.querySelector('#nAmt').value);
            if (!amt || amt <= 0) { App.showToast('Importe no válido', 'error'); return; }
            const catId = div.querySelector('#nCat').value;
            if (!catId) { App.showToast('Selecciona una categoría', 'error'); return; }
            const weekSel = div.querySelector('#nWeek');
            const extra = {};
            if (weekSel && weekSel.value) extra.pcWeekId = weekSel.value;
            addMovement(catId, amt, {
                concept: div.querySelector('#nConcept').value.trim() || 'Movimiento',
                date: div.querySelector('#nDate').value,
                person: div.querySelector('#nWho').value,
                status: div.querySelector('#nStatus').value,
                account: div.querySelector('#nAcc').value || (findRow(catId) || {}).account || '',
                action: 'Movimiento', ...extra
            });
            closeModal(); App.showToast('Movimiento registrado', 'success');
        };
    }

    function openEditMovModal(movId, backToRowId) {
        const exp = (data().expenses || []).find(e => e.id === movId);
        if (!exp) return;
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>✏️ Editar movimiento</h3>
            <div class="pc-field"><label>Concepto</label><input id="eConcept" value="${esc(exp.concept)}"></div>
            <div class="pc-field"><label>Categoría / Subcategoría</label><select id="eCat">${catOptionsHtml(exp.categoryId)}</select></div>
            <div class="pc-field"><label>Importe (€)</label><input id="eAmt" type="number" step="0.01" value="${Number(exp.amount || 0)}"></div>
            <div class="pc-field"><label>Fecha</label><input id="eDate" type="date" value="${esc(exp.date || '')}"></div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="eCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="eSave">Guardar</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        div.querySelector('#eCancel').onclick = () => { closeModal(); if (backToRowId) openMovesModal(backToRowId); };
        div.querySelector('#eSave').onclick = () => {
            const amt = Number(div.querySelector('#eAmt').value);
            if (isNaN(amt) || amt <= 0) { App.showToast('Importe no válido', 'error'); return; }
            exp.concept = div.querySelector('#eConcept').value.trim() || exp.concept;
            exp.categoryId = div.querySelector('#eCat').value;
            exp.amount = amt;
            exp.date = div.querySelector('#eDate').value || exp.date;
            exp.aggPeriod = String(exp.date).substring(0, 7);
            App.saveData(); App.addHistory('presupuesto-comun', `Movimiento editado: ${exp.concept}`);
            closeModal(); render(); App.showToast('Movimiento actualizado', 'success');
            if (backToRowId) setTimeout(() => openMovesModal(backToRowId), 80);
        };
    }

    function openNewCatModal() {
        closeModal();
        const parents = pcCats().map(c => `<option value="${c.id}">${c.icon} ${esc(c.name)}</option>`).join('');
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>🗂️ Nueva categoría / subcategoría</h3>
            <div class="pc-field"><label>Tipo</label><select id="cType"><option value="cat">Categoría principal</option><option value="sub">Subcategoría</option></select></div>
            <div class="pc-field" id="cParentWrap" style="display:none"><label>Categoría padre</label><select id="cParent">${parents}</select></div>
            <div class="pc-field"><label>Nombre</label><input id="cName" placeholder="Ej. Cenas fuera"></div>
            <div class="pc-field"><label>Icono (emoji)</label><input id="cIcon" value="📦" maxlength="4"></div>
            <div class="pc-field"><label>Presupuesto (€) · vacío = no definido</label><input id="cBudget" type="number" step="0.01"></div>
            <div class="pc-field"><label>Cuenta vinculada</label><select id="cAcc">${getAccountNames().map(a => `<option>${a}</option>`).join('')}</select></div>
            <div class="pc-field"><label>Fecha de vencimiento (opcional)</label><input id="cDue" type="date"></div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="cCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="cSave">Crear</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        div.querySelector('#cCancel').onclick = closeModal;
        div.querySelector('#cType').onchange = e => { div.querySelector('#cParentWrap').style.display = e.target.value === 'sub' ? '' : 'none'; };
        div.querySelector('#cSave').onclick = () => {
            const name = div.querySelector('#cName').value.trim();
            if (!name) { App.showToast('El nombre es obligatorio', 'error'); return; }
            const bv = div.querySelector('#cBudget').value;
            const isSub = div.querySelector('#cType').value === 'sub';
            const obj = {
                id: (isSub ? 'pcs-' : 'pc-') + Date.now().toString(36),
                name, icon: div.querySelector('#cIcon').value.trim() || '📦',
                budget: bv === '' ? null : Number(bv),
                account: div.querySelector('#cAcc').value,
                dueDate: div.querySelector('#cDue').value || null
            };
            if (isSub) { obj.parentId = div.querySelector('#cParent').value; data().pcSubcategories.push(obj); }
            else { obj.order = (pcCats().length + 1) * 10; data().pcCategories.push(obj); }
            App.saveData(); App.addHistory('presupuesto-comun', `Creada ${isSub ? 'subcategoría' : 'categoría'}: ${name}`);
            closeModal(); render(); App.showToast('Creado correctamente', 'success');
        };
    }

    function openWeekCountModal() {
        closeModal();
        const cur = weekCount(currentPeriod);
        const def = defaultWeekBudget();
        const opts = [4, 5, 6].map(n => `<option value="${n}" ${n === cur ? 'selected' : ''}>${n} semana${n > 1 ? 's' : ''}</option>`).join('');
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>🗓️ Semanas de ${esc(App.formatPeriod(currentPeriod))}</h3>
            <p style="font-size:12.5px;color:var(--text-secondary);margin-bottom:12px">La primera semana empieza en <b>lunes</b>.</p>
            <div class="pc-field"><label>Número de semanas del mes</label><select id="wcN">${opts}</select></div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="wcCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="wcSave">Aplicar</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        div.querySelector('#wcCancel').onclick = closeModal;
        div.querySelector('#wcSave').onclick = () => {
            const n = Number(div.querySelector('#wcN').value);
            const old = weeksFor(currentPeriod);
            const byIdx = {};
            old.forEach((w, i) => { byIdx[i] = w; });
            const gen = generateMonthWeeks(currentPeriod, n);
            const rebuilt = gen.map((w, i) => ({ ...w, budget: byIdx[i] ? byIdx[i].budget : def }));
            data().pcWeeks = allWeeks().filter(w => String(w.start).substring(0, 7) !== currentPeriod).concat(rebuilt);
            App.saveData(); App.addHistory('presupuesto-comun', `Mes ${currentPeriod}: ${n} semanas`);
            closeModal(); render(); App.showToast(`${n} semanas configuradas`, 'success');
        };
    }

    function openWeekModal(weekId) {
        const getW = () => (data().pcWeeks || []).find(x => x.id === weekId);
        const w = getW();
        if (!w) return;
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal pc-modal-wide pc-week-modal">
            <div class="pc-wk-hero" style="--wk-accent:#10b981">
                <div class="pc-wk-hero-top">
                    <span class="pc-wk-kicker">🛒 Groceries &amp; Leisure</span>
                    <button class="pc-btn pc-btn-ghost pc-wk-x" id="wkX" title="Cerrar">×</button>
                </div>
                <h3>${esc(w.label)}</h3>
                <p class="pc-wk-range">📅 ${shortDate(w.start)} → ${shortDate(w.end)}</p>
            </div>
            <div id="wkBody"></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        div.querySelector('#wkX').onclick = closeModal;
        const wkExpOf = () => pcRealExpenses().filter(e => e.pcWeekId === weekId);
        const renderBody = () => {
            const ww = getW(); if (!ww) { closeModal(); return; }
            const movs = wkExpOf().slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
            const spent = sum(movs);
            const st = weekState(ww);
            const meta = WEEK_STATE_META[st];
            const auto = weekAutoState(ww);
            const listRows = movs.length ? movs.map(m => `<div class="pc-mov-line">
                    <span class="pc-mov-date">${shortDate(m.date)}</span>
                    <span class="pc-mov-desc">${esc(m.concept)}</span>
                    <b class="pc-mov-amt">${fmt(m.amount)}</b>
                    <span class="pc-mov-acts">
                        <button class="pc-btn pc-btn-ghost" style="padding:4px 8px;font-size:11px" data-wedit="${m.id}" title="Editar movimiento">✏️</button>
                        <button class="pc-btn pc-btn-ghost" style="padding:4px 8px;font-size:11px" data-wdel="${m.id}" title="Quitar de la semana">×</button>
                    </span></div>`).join('')
                : '<div class="pc-empty">Sin movimientos registrados en esta semana.</div>';
            div.querySelector('#wkBody').innerHTML = `
                <div class="pc-week-grid">
                    <div class="pc-field" style="margin:0"><label>Presupuesto semanal (€)</label>
                        <input type="number" step="0.01" id="wkBudget" value="${Number(ww.budget || 0)}"></div>
                    <div class="pc-field" style="margin:0"><label>Estado <span style="text-transform:none;font-weight:500">(automático: ${WEEK_STATE_META[auto].label})</span></label>
                        <select id="wkState" ${auto === 'vacia' ? 'disabled' : ''}>
                            <option value="auto" ${!(recon().weekStates || {})[weekId] ? 'selected' : ''}>Automático (${WEEK_STATE_META[auto].label})</option>
                            <option value="en-curso" ${(recon().weekStates || {})[weekId] === 'en-curso' ? 'selected' : ''} ${auto === 'vacia' ? 'disabled' : ''}>En curso</option>
                            <option value="pasada" ${(recon().weekStates || {})[weekId] === 'pasada' ? 'selected' : ''} ${auto === 'vacia' ? 'disabled' : ''}>Pasada</option>
                        </select></div>
                    <div class="pc-week-state-pill"><span class="pc-badge ${meta.badge}">${meta.label}</span></div>
                </div>
                <div class="pc-week-summary">Presupuesto <b class="pc-num">${fmt(ww.budget)}</b> · Gastado <b class="pc-num ${spent > ww.budget ? 'pc-neg' : ''}">${fmt(spent)}</b> · Disponible <b class="pc-num ${spent > ww.budget ? 'pc-neg' : 'pc-pos'}">${fmt(ww.budget - spent)}</b></div>
                <div class="pc-mov-head"><span>FECHA</span><span>DESCRIPCIÓN</span><span>IMPORTE</span><span></span></div>
                ${listRows}
                <div style="display:flex;gap:8px;margin-top:12px">
                    <button class="pc-btn pc-btn-primary" id="wkAdd" style="flex:1">＋ Añadir gasto a esta semana</button>
                    <button class="pc-btn pc-btn-ghost" id="wkClose">Cerrar</button>
                </div>`;
            div.querySelector('#wkBudget').onchange = e => { ww.budget = Number(e.target.value || 0); App.saveData(); render(); };
            div.querySelector('#wkState').onchange = e => {
                if (!recon().weekStates) recon().weekStates = {};
                if (e.target.value === 'auto') delete recon().weekStates[weekId];
                else recon().weekStates[weekId] = e.target.value;
                App.saveData(); renderBody(); render();
            };
            div.querySelector('#wkClose').onclick = closeModal;
            div.querySelector('#wkAdd').onclick = () => { closeModal(); openNewMovModal(null, weekId); };
            div.querySelectorAll('[data-wedit]').forEach(b => b.onclick = () => openEditMovModal(b.getAttribute('data-wedit')));
            div.querySelectorAll('[data-wdel]').forEach(b => b.onclick = () => {
                const id = b.getAttribute('data-wdel');
                const mv = (data().expenses || []).find(x => x.id === id) || {};
                App.showConfirm(`¿Eliminar «${mv.concept || 'movimiento'}» de esta semana?`, () => {
                    data().expenses = data().expenses.filter(x => x.id !== id);
                    App.saveData(); App.addHistory('presupuesto-comun', `Movimiento eliminado de ${ww.label}: ${mv.concept || id}`);
                    renderBody(); render();
                });
            });
        };
        renderBody();
    }

    /* =========================================================
       RENDER PRINCIPAL
       ========================================================= */
    function render() {
        if (!containerEl) return;
        closePop();
        containerEl.innerHTML = headerHtml() + kpisHtml() +
            `<div class="pc-cols2">${weeksPanelHtml()}${accountsPanelHtml()}</div>` +
            tableHtml();
        bind();
    }

    function bind() {
        const $ = sel => containerEl.querySelector(sel);
        $('#pcMonth').onchange = e => { currentPeriod = $('#pcYear').value + '-' + e.target.value; render(); };
        $('#pcYear').onchange = e => { currentPeriod = e.target.value + '-' + $('#pcMonth').value; render(); };
        $('#pcNewMov').onclick = () => openNewMovModal();
        $('#pcBtnCat').onclick = openNewCatModal;
        const groTitle = $('#pcGroTitle');
        if (groTitle) groTitle.onclick = openWeekCountModal;
        containerEl.querySelectorAll('[data-week]').forEach(card => card.onclick = () => openWeekModal(card.getAttribute('data-week')));
        containerEl.querySelectorAll('[data-editacc]').forEach(row => row.onclick = () => openEditAccountModal(row.getAttribute('data-editacc')));

        containerEl.querySelectorAll('[data-moves]').forEach(tr => tr.onclick = e => {
            if (e.target.closest('[data-editcat]') || e.target.closest('[data-editsub]') || e.target.closest('[data-real]') || e.target.closest('[data-loanpaid]') || e.target.closest('[data-tick]') || e.target.closest('.pc-info')) return;
            openMovesModal(tr.getAttribute('data-moves'));
        });

        containerEl.querySelectorAll('[data-tick]').forEach(btn => btn.onclick = e => {
            e.stopPropagation();
            equalizeRow(btn.getAttribute('data-tick'));
        });
        containerEl.querySelectorAll('[data-editcat]').forEach(el => el.onclick = e => { e.stopPropagation(); openCatModal(el.getAttribute('data-editcat'), false); });
        containerEl.querySelectorAll('[data-editsub]').forEach(el => el.onclick = e => { e.stopPropagation(); openCatModal(el.getAttribute('data-editsub'), true); });
        containerEl.querySelectorAll('[data-real]').forEach(el => el.onclick = e => {
            e.stopPropagation();
            openQuickPop(el, el.getAttribute('data-real'), rowSpent(el.getAttribute('data-real')));
        });

        containerEl.querySelectorAll('[data-loanpaid]').forEach(ch => ch.onclick = e => {
            e.stopPropagation();
            const id = ch.getAttribute('data-loanpaid');
            if (ch.checked) {
                recon().loansPaid[id] = true;
                App.saveData();
                if (window.App && typeof App.payLoanInstallment === 'function') {
                    App.payLoanInstallment(id);
                }
            } else {
                recon().loansPaid[id] = false;
                App.saveData();
                render();
                App.showToast('Reversión de cuota no soportada todavía · solo se limpia el flag TR', 'info');
            }
        });

        containerEl.querySelectorAll('.pc-info').forEach(el => el.onclick = e => {
            e.stopPropagation();
            containerEl.querySelectorAll('.pc-info.pinned').forEach(o => { if (o !== el) o.classList.remove('pinned'); });
            el.classList.toggle('pinned');
        });
        document.addEventListener('click', () => containerEl && containerEl.querySelectorAll('.pc-info.pinned').forEach(o => o.classList.remove('pinned')));
    }

    // 6. Quitado App.saveData() para no sobreescribir el Sheet al arrancar
    function ensureWeeks() {
        if (!data().pcWeeks) data().pcWeeks = [];
        if (!weekCount(currentPeriod)) {
            const def = defaultWeekBudget();
            const gen = generateMonthWeeks(currentPeriod, 4).map(w => ({ ...w, budget: def }));
            data().pcWeeks = allWeeks().concat(gen);
            // App.saveData(); // ELIMINADO PARA EVITAR BORRADO DE DATOS
        }
    }

    /* =========================================================
       LISTENER DE CAMBIOS EXTERNOS
       ========================================================= */
    function bindModuleChange() {
        if (_pcBound) return;
        document.addEventListener('app:module-changed', (e) => {
            const src = e.detail && e.detail.source;
            if (!src || src === 'presupuesto-comun') return;
            if (containerEl && containerEl.isConnected) {
                try { render(); } catch (err) {}
            }
        });
        _pcBound = true;
    }

    /* =========================================================
       INIT / API PÚBLICA
       ========================================================= */
    function init(container) {
        containerEl = container;
        fixGroceriesName();
        dedupeLoans();
        removeOthersGenSub();
        ensureWeeks();
        bindModuleChange();
        render();
    }
    function onThemeChange() { render(); }

    function getPcSummary(period) {
        const p = period || currentPeriod;
        const FIXED_IDS = ['pc-rent', 'pc-utilities', 'pc-loans'];
        let fixed = 0, variable = 0;
        pcCats().forEach(c => {
            const b = catBudget(c.id);
            if (b === null) return;
            if (FIXED_IDS.includes(c.id)) fixed += b; else variable += b;
        });
        const planned = sum((data().expenses || []).filter(e => {
            const ep = e.aggPeriod || String(e.date || '').substring(0, 7);
            return ep === p && e.status !== 'archivado' && e.status !== 'aportacion';
        }));
        return {
            period: p,
            fixed: Math.round(fixed * 100) / 100,
            variable: Math.round(variable * 100) / 100,
            total: Math.round((fixed + variable) * 100) / 100,
            planned: Math.round(planned * 100) / 100,
            budgetTotal: Math.round(totalBudgetDefined() * 100) / 100
        };
    }

    function openExpenseModal(expenseId) {
        const exp = (data().expenses || []).find(e => e.id === expenseId);
        if (exp) { openCatModal(exp.categoryId, String(exp.categoryId || '').startsWith('pcs-')); }
        else openNewMovModal();
    }
    function openCategoryModal(catId) { openCatModal(catId, String(catId || '').startsWith('pcs-')); }

    return {
        init, render, onThemeChange,
        openExpenseModal, openCategoryModal,
        openMovementModal: openNewMovModal,
        quickEditRealSpend: (rowId, value) => { setRowReal(rowId, value); },
        addMovement,
        setExpenseStatus,
        getPcSummary,
        getState: () => ({
            period: currentPeriod,
            categories: JSON.parse(JSON.stringify(data().pcCategories || [])),
            subcategories: JSON.parse(JSON.stringify(data().pcSubcategories || [])),
            weeks: JSON.parse(JSON.stringify(data().pcWeeks || [])),
            expenses: JSON.parse(JSON.stringify(data().expenses || []))
        })
    };
})();

window.BudgetApp = BudgetApp;

(function ensureRegistered() {
    const register = () => {
        if (typeof App !== 'undefined' && App && typeof App.registerSection === 'function') {
            App.registerSection('presupuesto-comun', BudgetApp);
            return true;
        }
        return false;
    };
    if (!register()) {
        document.addEventListener('DOMContentLoaded', () => {
            if (!register()) console.error('No se pudo registrar la sección presupuesto-comun: falta window.App');
        });
    }
})();