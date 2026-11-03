/* =============================================================
   PRESUPUESTO-COMUN.JS — v6 · Clean & Modern UI (armonizado con el tema)
   Dashboard híbrido de presupuesto compartido (pantalla única):
   · 4 KPIs superiores · Groceries semanal + Estado de Cuentas
   · Tabla acordeón jerárquica perfectamente alineada (tabular-nums)
   · Badges/píldoras estilizadas (Vence: dd/mm, % consumido…)
   · Clic en nombre → modal categoría · clic en Gasto Real → pop-up rápido
   · Movimientos por subcategoría (OTHERS y todas) que recalculan la fila
   · Últimos movimientos + Previsión de cierre
   Sin bloques azul marino estridentes: todo el color se apoya en los
   tokens del tema (claro "Slate Clean" / oscuro #0f172a). API pública
   preservada + nuevos métodos para el puente de App.
   ============================================================= */
const BudgetApp = (function () {
    'use strict';

    const CAT_META = {
        'pc-rent':      { accent: '#6366f1', label: 'RENT' },
        'pc-utilities': { accent: '#f59e0b', label: 'UTILITIES' },
        'pc-groceries': { accent: '#10b981', label: 'GROCERIES & LEISURE' },
        'pc-loans':     { accent: '#ef4444', label: 'LOANS' },
        'pc-savings':   { accent: '#8b5cf6', label: 'SAVINGS' },
        'pc-others':    { accent: '#64748b', label: 'OTHERS' }
    };
    const ACCOUNTS = ['Trade Republic', 'MyInvestor', 'Junta'];

    function rowLabel(row) {
        if (!row) return '';
        return String(row.label || row.name || '').toUpperCase();
    }

    // ===== estado =====
    function data() { return App.data; }
    let currentPeriod = '2026-11';
    let containerEl = null;
    let popEl = null;           // pop-up rápido de gasto real
    let uiState = { catFilter: 'all', movDays: 30, weekFilter: 'all' };

    // Normaliza el nombre de la categoría Groceries (era "Groceries and Liquor")
    function fixGroceriesName() {
        const c = (data().pcCategories || []).find(x => x.id === 'pc-groceries');
        if (c && /liquor/i.test(String(c.name || ''))) {
            c.name = 'Groceries & Leisure'; c.label = 'GROCERIES & LEISURE';
            App.saveData();
        }
    }

    // Elimina las subcategorías duplicadas de LOANS (Sofá/Cama). Los préstamos
    // se gestionan exclusivamente mediante data().pcLoans (fila con toggle por cuota).
    function dedupeLoans() {
        const subs = data().pcSubcategories;
        if (Array.isArray(subs)) {
            const clean = subs.filter(s => s.parentId !== 'pc-loans');
            if (clean.length !== subs.length) { data().pcSubcategories = clean; App.saveData(); }
        }
    }

    // Estado semántico de las semanas (se AUTOMATIZA al renderizar):
    //   · 'vacia'     → mes futuro sin empezar aún, o semana sin presupuesto asignado
    //   · 'en-curso'  → hoy cae dentro del rango de la semana
    //   · 'pasada'    → la semana ya terminó
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
        // El manual solo puede alternar entre En curso ↔ Pasada; "vacía" siempre es automática
        return (man && man !== 'vacia' && auto !== 'vacia') ? man : auto;
    }
    const WEEK_STATE_META = {
        'en-curso': { label: 'En curso', cls: 'st-current', badge: 'pc-badge-blue' },
        'pasada':   { label: 'Pasada',   cls: 'st-past',    badge: 'pc-badge-green' },
        'vacia':    { label: 'Vacía',    cls: 'st-empty',   badge: 'pc-badge-gray' }
    };

    // Semanas definidas para un periodo concreto ('YYYY-MM').
    // OJO: debe leer de allWeeks() (datos crudos), NUNCA de pcWeeks(), porque
    // pcWeeks() se define como weeksFor(currentPeriod) y causaría recursión infinita.
    function weeksFor(period) { return allWeeks().filter(w => String(w.start).substring(0, 7) === period); }

    // Recalcula las semanas de un mes: la semana 1 empieza el LUNLES anterior al día 1
    // (el primer día es siempre lunes) y se generan N semanas consecutivas.
    function generateMonthWeeks(period, count) {
        const [y, m] = period.split('-').map(Number);
        const first = new Date(y, m - 1, 1);
        const dow = (first.getDay() + 6) % 7;            // lunes = 0
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
    // Semanas del MES ACTUAL (el dashboard solo gestiona las semanas del periodo visible)
    function pcWeeks()   { return weeksFor(currentPeriod); }
    // Todas las semanas guardadas (cualquier mes)
    function allWeeks()  { return (data().pcWeeks || []).slice().sort((a, b) => String(a.start).localeCompare(String(b.start))); }
    // Nº de semanas definidas para un mes concreto
    function weekCount(period) { return weeksFor(period).length; }
    // Presupuesto semanal por defecto = el propio de Groceries & Leisure (si está definido)
    function defaultWeekBudget() {
        const c = pcCats().find(x => x.id === 'pc-groceries');
        return (c && c.budget !== null && c.budget !== undefined) ? Number(c.budget) : 160;
    }
    function pcLoans()   { return (data().pcLoans || []).filter(l => l.status !== 'archived'); }
    function pcIncomes() { return data().pcIncomes || []; }
    function recon() {
        if (!data().pcReconciliation) data().pcReconciliation = { initialBalance: 845.15, weeksClosed: {}, loansPaid: {}, realBalances: {} };
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
    function rowSpent(rowId) { return String(rowId).startsWith('pcs-') ? subSpent(rowId) : catSpentDerived(rowId); }
    function rowBudget(rowId) { return String(rowId).startsWith('pcs-') ? subBudget(rowId) : catBudget(rowId); }
    function findRow(id) {
        if (String(id).startsWith('pcs-')) return (data().pcSubcategories || []).find(s => s.id === id) || null;
        return pcCats().find(c => c.id === id) || null;
    }
    // Presupuesto: null = "no definido"; 0 = fijado en 0,00 €
    function subBudget(subId) {
        const s = (data().pcSubcategories || []).find(x => x.id === subId);
        if (!s) return null;
        return (s.budget === null || s.budget === undefined) ? null : Number(s.budget);
    }
    // Con subcategorías → PRESUPUESTO/GASTO/DISPONIBLE de la categoría son la
    // SUMA de las subcategorías. Sin subcategorías → se usa el valor propio.
    function hasOwnRowBudget(catId) {
        const c = pcCats().find(x => x.id === catId);
        return !!(c && c.budget !== null && c.budget !== undefined);
    }
    function catBudget(catId) {
        const c = pcCats().find(x => x.id === catId);
        if (!c) return null;
        const subs = pcSubs(catId);
        if (subs.length) {
            // fila derivada: suma estricta de subcategorías definidas
            let total = null;
            subs.forEach(s => { if (s.budget !== null && s.budget !== undefined) total = (total === null ? 0 : total) + Number(s.budget); });
            return total;
        }
        let total = (c.budget === null || c.budget === undefined) ? null : Number(c.budget);
        if (catId === 'pc-groceries') { const w = pcWeeks().reduce((s, x) => s + Number(x.budget || 0), 0); if (w) total = (total === null ? 0 : total) + w; }
        if (catId === 'pc-loans')     { const l = pcLoans().reduce((s, x) => s + Number(x.amountPerInstallment || 0), 0); if (l) total = (total === null ? 0 : total) + l; }
        return total;
    }
    function catSpentDerived(catId) {
        const subs = pcSubs(catId);
        if (!subs.length) return catSpent(catId);
        return subs.reduce((s, sub) => s + subSpent(sub.id), 0);
    }
    function totalBudgetDefined() {
        return pcCats().reduce((s, c) => { const b = catBudget(c.id); return s + (b === null ? 0 : b); }, 0);
    }
    function totalRealSpent() { return sum(pcRealExpenses()); }
    function pendingPayments() {
        return pcLoans().filter(l => !recon().loansPaid[l.id]).reduce((s, l) => s + Number(l.amountPerInstallment || 0), 0);
    }
    function accountRealBalance(accName) {
        const acc = (data().accounts || []).find(a => (a.name || '').toLowerCase().includes(String(accName || '').toLowerCase().split(' ')[0]));
        return acc ? Number(acc.balance || 0) : 0;
    }
    function combinedRealBalance() {
        // Suma real combinada en bancos/tarjetas (todas las cuentas maestras)
        return (data().accounts || []).reduce((s, a) => s + Number(a.balance || 0), 0);
    }

    // ===== reconciliación Trade Republic =====
    function trExpected() {
        const r = recon();
        // El gasto de las semanas se toma de los MOVIMIENTOS REALES registrados en cada semana
        const wkExp = pcRealExpenses().filter(e => String(e.date || '').substring(0, 7) === currentPeriod);
        const weekSpent = pcWeeks().reduce((s, w) => s + sum(wkExp.filter(e => e.pcWeekId === w.id)), 0);
        const paidLoans = pcLoans().reduce((s, l) => r.loansPaid[l.id] ? s + Number(l.amountPerInstallment || 0) : s, 0);
        return Number(r.initialBalance || 0) - weekSpent - paidLoans;
    }
    function trReal() { return Number(recon().realBalances[currentPeriod] || 0); }
    function miTarget() { return Number(data().pcMyInvestorTarget || 1125); }

    // ===== utilidades de formato =====
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
        const dd = App.formatDate(dueDate).slice(0, 5); // dd/mm
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

    // ===== estado semántico (usa los tokens del tema, claro/oscuro) =====
    function availCls(v) { return v === null ? '' : v >= 0 ? 'pc-pos' : 'pc-neg'; }
    function diffCls(v, invert) { const good = invert ? v <= 0 : v >= 0; return good ? 'pc-pos' : 'pc-neg'; }
    // Escala de colores del DISPONIBLE según % restante:
    //  >20% restante → verde · 0–20% → ámbar · <0% (sobregastado) → rojo
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

    // ===== registro de movimientos =====
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
        data().expenses.push(exp);
        App.saveData();
        App.addHistory('presupuesto-comun', `${opts.action || 'Movimiento'}: ${exp.concept} (${fmt(exp.amount)})`);
        render();
        return id;
    }
    // Sobrescribe el acumulado de una fila ajustando un movimiento de relleno
    function setRowReal(rowId, newValue) {
        newValue = Number(newValue) || 0;
        const cur = rowSpent(rowId);
        const diff = newValue - cur;
        if (Math.abs(diff) < 0.005) { App.showToast('Sin cambios', 'info'); return; }
        const fillers = data().expenses.filter(e => e.categoryId === rowId && e.pcAuto === 'ajuste');
        if (fillers.length >= 1) {
            // mantiene un único movimiento de ajuste: actualiza el primero, archiva el resto
            fillers[0].amount = newValue;
            fillers.slice(1).forEach(f => f.status = 'archivado');
            App.saveData(); App.addHistory('presupuesto-comun', `Ajuste directo «${(findRow(rowId) || {}).name || rowId}»: ${fmt(newValue)}`);
            render(); return;
        }
        addMovement(rowId, newValue, { concept: 'Ajuste de gasto real', account: (findRow(rowId) || {}).account || '', action: 'Ajuste' });
        const last = data().expenses[data().expenses.length - 1];
        if (last && last.concept === 'Ajuste de gasto real') last.pcAuto = 'ajuste';
        App.saveData(); render();
    }

    // ===== render: barra superior (periodo = mes + año por separado) =====
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

    // ===== bloque 1 · KPIs =====
    function kpisHtml() {
        const presup = totalBudgetDefined();
        const gastos = totalRealSpent();
        const disponible = presup - gastos;
        const saldos = combinedRealBalance();
        const pctGlob = presup ? Math.min((gastos / presup) * 100, 100) : 0;
        const desv = gastos - presup;
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
        </div>`;
    }

    // ===== bloque 2 izq · Groceries & Leisure (distribución semanal) =====
    // · Clic en una semana → modal con sus movimientos reales (fecha, importe, descripción) + edición
    // · Clic en el título  → modal para decidir cuántas semanas tiene el mes
    // · Estado automático al renderizar: En curso / Pasada / Vacía (override manual solo E-C ↔ Pasada)
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

    // ===== bloque 2 der · Estado de Cuentas =====
    // Sin bloque inferior de introducción: se edita el saldo REAL pinchando sobre la propia cuenta.
    function accountsPanelHtml() {
        const r = recon();
        const expected = trExpected();
        const real = trReal();
        const rows = [
            { name: 'Trade Republic', icon: '📈', target: expected, realVal: real, key: 'tr' },
            { name: 'MyInvestor', icon: '🏦', target: miTarget(), realVal: accountRealBalance('MyInvestor'), key: 'mi' }
        ];
        const html = rows.map(a => {
            const d = a.realVal - a.target;
            return `<div class="pc-account-row" data-editacc="${a.key}" title="Clic para editar el saldo real de ${esc(a.name)}">
                <div><b>${a.icon} ${esc(a.name)}</b> <span class="pc-acc-hint">✏️</span>
                    <div class="pc-week-dates">Saldo objetivo: <b class="pc-num">${fmt(a.target)}</b></div></div>
                <div style="text-align:right">
                    <div class="pc-num pc-acc-real">${fmt(a.realVal)}</div>
                    ${badge('Desv. ' + (d >= 0 ? '+' : '') + fmt(d), d >= 0 ? 'pc-badge-green' : 'pc-badge-red')}
                </div></div>`;
        }).join('');
        return `<div class="pc-panel pc-panel--accent" style="--panel-accent:#2563eb">
            <div class="pc-panel-title"><span class="pc-dot"></span> 🏦 Estado de Cuentas</div>
            ${html}</div>`;
    }

    // Edición del saldo real de una cuenta (pinchando sobre la fila)
    function openEditAccountModal(key) {
        const isTR = key === 'tr';
        const cur = isTR ? trReal() : accountRealBalance('MyInvestor');
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>${isTR ? '📈 Trade Republic' : '🏦 MyInvestor'} · Saldo real</h3>
            <div class="pc-field"><label>Saldo real en banco (€)</label>
                <input id="eaVal" type="number" step="0.01" value="${Number(cur).toFixed(2)}"></div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="eaCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="eaSave">Guardar</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        div.querySelector('#eaCancel').onclick = closeModal;
        const inp = div.querySelector('#eaVal'); inp.focus(); inp.select();
        const save = () => {
            const v = Number(inp.value || 0);
            if (isTR) recon().realBalances[currentPeriod] = v;
            else {
                const acc = (data().accounts || []).find(x => (x.name || '').toLowerCase().includes('myinvestor'));
                if (acc) acc.balance = v; else data().accounts.push({ id: 'acc-mi', name: 'MyInvestor', balance: v });
            }
            App.saveData(); App.addHistory('presupuesto-comun', `Saldo real ${isTR ? 'Trade Republic' : 'MyInvestor'}: ${fmt(v)}`);
            closeModal(); render(); App.showToast('Saldo actualizado', 'success');
        };
        div.querySelector('#eaSave').onclick = save;
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') closeModal(); });
    }

    function infoBadge(accountText) {
        const acc = String(accountText || '—');
        return `<span class="pc-info" tabindex="0" aria-label="Cuenta asociada">ⓘ<span class="pc-info-tip">Cuenta: <b>${esc(acc)}</b></span></span>`;
    }

    // ===== bloque 3 · Tabla principal (categorías + subcategorías SIEMPRE visibles) =====
    // · Sin columna "CUENTA ASOCIADA": el ⓘ a la derecha del título muestra la cuenta (hover y clic).
    // · Columnas PRESUPUESTO / GASTO REAL / DISPONIBLE equidistantes; barra de % pegada a la derecha.
    // · Sin filas "Sin subcategorías" ni etiquetas "Pendiente".
    function consumptionCell(spent, budget) {
        const pct = budget ? Math.min((spent / budget) * 100, 100) : 0;
        const col = !budget ? 'var(--text-muted)' : spent > budget ? 'var(--pc-neg)' : pct >= 85 ? 'var(--pc-warn)' : 'var(--pc-pos)';
        const bp = budget === null || budget === undefined ? null : (budget === 0 ? 100 : (spent / budget) * 100);
        const badgeCls = bp === null ? 'pc-badge-gray' : bp > 100 ? 'pc-badge-red' : bp >= 85 ? 'pc-badge-amber' : 'pc-badge-green';
        return `<span class="pc-cons">${badge(bp === null ? '—' : `${Math.round(bp)}%`, badgeCls)}</span>`;
    }
    // Título de fila con barra de consumo integrada: el fondo del título se rellena
    // según el % consumido y el porcentaje aparece a la derecha, todo en la misma columna.
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
    function tableHtml() {
        const cats = pcCats();
        let html = `<div class="pc-table-wrap"><table class="pc-table pc-table-compact"><thead><tr>
            <th>CATEGORÍA / SUBCATEGORÍA</th>
            <th class="pc-th-num">PRESUPUESTO</th><th class="pc-th-num">GASTO REAL</th>
            <th class="pc-th-num">DISPONIBLE</th><th class="pc-th-cons">CONSUMO</th></tr></thead><tbody>`;
        cats.forEach(c => {
            const meta = CAT_META[c.id] || { accent: '#2563eb' };
            const subs = pcSubs(c.id);
            const cb = catBudget(c.id), cs = rowSpent(c.id);
            const derived = subs.length > 0;
            const catSuffix = `${infoBadge(c.account)}${dueBadge(c.dueDate)}${derived ? '<span class="pc-derived-tag" title="Importes calculados como suma de sus subcategorías">Σ</span>' : ''}`;
            html += `<tr class="pc-row-cat" data-moves="${c.id}" style="--cat-accent:${meta.accent}">
                <td>${titleWithBar(c.icon || '📁', rowLabel(c), cs, cb, meta.accent, { editAttr: 'editcat', editId: c.id, suffixHtml: catSuffix })}</td>
                <td class="pc-td-num">${cb === null ? muted('No definido') : fmt(cb)}</td>
                <td class="pc-td-num"><span class="pc-cell-edit" data-real="${c.id}" title="Clic para ajustar el gasto real">✏️ ${fmt(cs)}</span></td>
                <td class="pc-td-num">${availCell(cb, cs).replace(/^<td[^>]*>|<\/td>$/g, '')}</td>
                <td class="pc-td-cons">${consumptionCell(cs, cb)}</td></tr>`;
            // Subcategorías siempre visibles (sin filas de relleno ni textos "sin subcategorías")
            subs.forEach(s => {
                const sb = subBudget(s.id);
                const ss = subSpent(s.id);
                const subSuffix = `${infoBadge(s.account || c.account)}${dueBadge(s.dueDate)}`;
                html += `<tr class="pc-row-sub" data-moves="${s.id}" style="--cat-accent:${meta.accent}">
                    <td>${titleWithBar(s.icon || '·', s.name, ss, sb, meta.accent, { editAttr: 'editsub', editId: s.id, isSub: true, suffixHtml: subSuffix })}</td>
                    <td class="pc-td-num">${sb === null ? muted('No definido') : fmt(sb)}</td>
                    <td class="pc-td-num"><span class="pc-cell-edit" data-real="${s.id}" title="Clic para ajustar el gasto real">✏️ ${fmt(ss)}</span></td>
                    <td class="pc-td-num">${availCell(sb, ss).replace(/^<td[^>]*>|<\/td>$/g, '')}</td>
                    <td class="pc-td-cons">${consumptionCell(ss, sb)}</td></tr>`;
            });
            if (c.id === 'pc-loans') pcLoans().forEach(l => {
                const paid = !!recon().loansPaid[l.id];
                html += `<tr class="pc-row-sub" style="--cat-accent:${meta.accent}">
                    <td>💳 ${esc(l.name)} <span class="pc-num" style="color:var(--text-muted)">(${l.paidInstallments}/${l.totalInstallments} cuotas)</span> ${infoBadge(l.account || 'Trade Republic')}</td>
                    <td class="pc-td-num">${fmt(l.amountPerInstallment)}/cuota</td>
                    <td class="pc-td-num">—</td>
                    <td class="pc-td-num">—</td>
                    <td class="pc-td-cons"><span class="pc-toggle"><input type="checkbox" data-loanpaid="${l.id}" ${paid ? 'checked' : ''}><span class="pc-slider"></span></span> ${badge(paid ? 'Pagado' : 'Cuota', paid ? 'pc-badge-green' : 'pc-badge-gray')}</td></tr>`;
            });
        });
        html += '</tbody></table></div>';
        return html;
    }

    // ===== modal de movimientos · SOLO de la categoría/subcategoría elegida =====
    // Líneas con fecha, importe y descripción. Sustituye al panel inferior de movimientos.
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

    // ===== modales =====
    function closeModal() { const b = document.getElementById('pcBackdrop'); if (b) b.remove(); }
    function closePop() { if (popEl) { popEl.remove(); popEl = null; } }

    function openCatModal(id, isSub) {
        const item = isSub ? (data().pcSubcategories || []).find(s => s.id === id) : pcCats().find(c => c.id === id);
        if (!item) return;
        const accOpts = ACCOUNTS.map(a => `<option ${item.account === a ? 'selected' : ''}>${a}</option>`).join('');
        const subs = !isSub ? pcSubs(id) : [];
        closeModal();
        // Con subcategorías: presupuesto/gasto de la categoría son DERIVADOS (suma Σ)
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
        // Categorías sin subcategorías → seleccionables; con subcategorías → cabecera de grupo <optgroup>
        return pcCats().map(c => {
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
            <div class="pc-field"><label>Cuenta</label><select id="nAcc"><option value="">Heredar de la categoría</option>${ACCOUNTS.map(a => `<option>${a}</option>`).join('')}</select></div>
            <div class="pc-field"><label>¿Quién pagó?</label><select id="nWho"><option value="conjunto">Conjunto</option><option value="ana">Nena</option><option value="carlos">Bombón</option></select></div>
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
            const weekSel = div.querySelector('#nWeek');
            const extra = {};
            if (weekSel && weekSel.value) extra.pcWeekId = weekSel.value;
            addMovement(catId, amt, {
                concept: div.querySelector('#nConcept').value.trim() || 'Movimiento',
                date: div.querySelector('#nDate').value, person: div.querySelector('#nWho').value,
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
            <div class="pc-field"><label>Cuenta vinculada</label><select id="cAcc">${ACCOUNTS.map(a => `<option>${a}</option>`).join('')}</select></div>
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

    // ===== modal · semanas del mes (clic en el título de Groceries & Leisure) =====
    // Permite decidir CUÁNTAS semanas tiene el mes. La semana 1 empieza siempre en LUNES
    // (el lunes anterior al día 1, es decir: el primer día es el siguiente al último día
    // del mes anterior si este cae en lunes). Conserva los presupuestos ya asignados.
    function openWeekCountModal() {
        closeModal();
        const cur = weekCount(currentPeriod);
        const def = defaultWeekBudget();
        const opts = [4, 5, 6].map(n => `<option value="${n}" ${n === cur ? 'selected' : ''}>${n} semana${n > 1 ? 's' : ''}</option>`).join('');
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>🗓️ Semanas de ${esc(App.formatPeriod(currentPeriod))}</h3>
            <p style="font-size:12.5px;color:var(--text-secondary);margin-bottom:12px">La primera semana empieza en <b>lunes</b>. Puedes repartir el presupuesto semanal de cada semana en la tarjeta correspondiente.</p>
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

    // ===== modal de SEMANA (clic sobre la tarjeta de una semana) =====
    // Muestra los movimientos reales de esa semana (fecha, importe y descripción),
    // permite editarlos/eliminarlos/añadir, cambiar el presupuesto semanal y
    // forzar manualmente el estado (En curso ↔ Pasada; "Vacía" es siempre automática).
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

    // ===== render principal =====
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
        // Periodo: mes y año por separado
        $('#pcMonth').onchange = e => { currentPeriod = $('#pcYear').value + '-' + e.target.value; render(); };
        $('#pcYear').onchange = e => { currentPeriod = e.target.value + '-' + $('#pcMonth').value; render(); };
        $('#pcNewMov').onclick = () => openNewMovModal();
        $('#pcBtnCat').onclick = openNewCatModal;
        // Groceries & Leisure: clic en el título → nº de semanas del mes · clic en semana → modal de movimientos
        const groTitle = $('#pcGroTitle');
        if (groTitle) groTitle.onclick = openWeekCountModal;
        containerEl.querySelectorAll('[data-week]').forEach(card => card.onclick = () => openWeekModal(card.getAttribute('data-week')));
        // Estado de Cuentas: clic sobre la cuenta → editar su saldo real
        containerEl.querySelectorAll('[data-editacc]').forEach(row => row.onclick = () => openEditAccountModal(row.getAttribute('data-editacc')));
        // Tabla: clic en la fila → modal de movimientos de ESA categoría/subcategoría
        containerEl.querySelectorAll('[data-moves]').forEach(tr => tr.onclick = e => {
            if (e.target.closest('[data-editcat]') || e.target.closest('[data-editsub]') || e.target.closest('[data-real]') || e.target.closest('[data-loanpaid]') || e.target.closest('.pc-info')) return;
            openMovesModal(tr.getAttribute('data-moves'));
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
            recon().loansPaid[id] = ch.checked;
            if (ch.checked) {
                const l = pcLoans().find(x => x.id === id);
                if (l) addMovement('pc-loans', Number(l.amountPerInstallment || 0), { concept: `Cuota ${l.name}`, account: l.account || 'Trade Republic', action: 'Cuota pagada' });
            }
            App.saveData(); render();
        });
        // ⓘ de cuenta: hover muestra el tooltip por CSS; clic lo mantiene visible/lo oculta
        containerEl.querySelectorAll('.pc-info').forEach(el => el.onclick = e => {
            e.stopPropagation();
            containerEl.querySelectorAll('.pc-info.pinned').forEach(o => { if (o !== el) o.classList.remove('pinned'); });
            el.classList.toggle('pinned');
        });
        document.addEventListener('click', () => containerEl && containerEl.querySelectorAll('.pc-info.pinned').forEach(o => o.classList.remove('pinned')));
        containerEl.querySelectorAll('[data-act]').forEach(btn => btn.onclick = () => {
            const act = btn.getAttribute('data-act');
            if (act === 'newMov') openNewMovModal();
            if (act === 'newMovCat') openNewMovModal(btn.getAttribute('data-cat'));
        });
    }

    // Asegura que el mes visible tenga semanas definidas (4 por defecto,
    // o las que tuviera configuradas para ese mes). Se ejecuta en cada init.
    function ensureWeeks() {
        if (!data().pcWeeks) data().pcWeeks = [];
        if (!weekCount(currentPeriod)) {
            const def = defaultWeekBudget();
            const gen = generateMonthWeeks(currentPeriod, 4).map(w => ({ ...w, budget: def }));
            data().pcWeeks = allWeeks().concat(gen);
            App.saveData();
        }
    }

    // ===== API pública =====
    function init(container) { containerEl = container; fixGroceriesName(); dedupeLoans(); ensureWeeks(); render(); }
    function onThemeChange() { render(); }
    function openExpenseModal(expenseId) {
        const exp = (data().expenses || []).find(e => e.id === expenseId);
        if (exp) { openCatModal(exp.categoryId, String(exp.categoryId || '').startsWith('pcs-')); }
        else openNewMovModal();
    }
    function openCategoryModal(catId) { openCatModal(catId, String(catId || '').startsWith('pcs-')); }

    return {
        init, render, onThemeChange,
        openExpenseModal, openCategoryModal,
        // nuevos para el puente de App / otros módulos
        openMovementModal: openNewMovModal,
        quickEditRealSpend: (rowId, value) => { setRowReal(rowId, value); },
        addMovement
    };
})();

// Publicar la referencia en window (igual que App, CalendarApp, DineroApp…)
// y registrar la sección de forma tolerante: si app.js aún no está presente,
// se reintenta en DOMContentLoaded para no dejar la pestaña en blanco.
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
