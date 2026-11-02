/* =============================================================
   PRESUPUESTO-COMUN.JS — v7 · Módulo Completo de Presupuesto de Pareja
   Dashboard de Presupuesto Compartido con:
   - Filas de Categoría Principal en tono oscuro (#1e293b) para alto contraste.
   - Desglose semanal ultra-compacto para Groceries and Liquor.
   - Cálculo en tiempo real de Saldos Objetivo vs Saldos Reales y Desviación Bancaria.
   - Registro ágil de movimientos, modal de saldos reales y visor Apps Script.
   ============================================================= */
const BudgetApp = (function () {
    'use strict';

    // Metadata de categorías principales (colores de acento y etiquetas)
    const CAT_META = {
        'pc-rent':      { accent: '#6366f1', label: 'RENT' },
        'pc-utilities': { accent: '#f59e0b', label: 'UTILITIES' },
        'pc-groceries': { accent: '#10b981', label: 'GROCERIES AND LIQUOR' },
        'pc-loans':     { accent: '#ef4444', label: 'LOANS' },
        'pc-savings':   { accent: '#8b5cf6', label: 'SAVINGS' },
        'pc-others':    { accent: '#64748b', label: 'OTHERS' }
    };

    const ACCOUNTS = ['Trade Republic', 'MyInvestor', 'Junta'];

    function rowLabel(row) {
        if (!row) return '';
        return String(row.label || row.name || '').toUpperCase();
    }

    // ===== Estado global del módulo =====
    function data() { return App.data; }
    let currentPeriod = '2026-11';
    let containerEl = null;
    let openCats = {};          // Acordeón: id -> boolean
    let popEl = null;           // Pop-up flotante de edición rápida
    let uiState = { catFilter: 'all', movDays: 30, weekFilter: 'all' };

    // Queries de datos maestros
    function pcCats()    { return (data().pcCategories || []).slice().sort((a, b) => (a.order || 99) - (b.order || 99)); }
    function pcSubs(pid) { return (data().pcSubcategories || []).filter(s => s.parentId === pid); }
    function pcWeeks()   { return (data().pcWeeks || []).slice().sort((a, b) => String(a.start).localeCompare(String(b.start))); }
    function pcLoans()   { return (data().pcLoans || []).filter(l => l.status !== 'archived'); }
    function pcIncomes() { return data().pcIncomes || []; }
    function recon() {
        if (!data().pcReconciliation) {
            data().pcReconciliation = { initialBalance: 845.15, weeksClosed: {}, loansPaid: {}, realBalances: {} };
        }
        return data().pcReconciliation;
    }

    // Filtrado de gastos por periodo y estado
    function periodExpenses(period, includePlanned) {
        return (data().expenses || []).filter(e => {
            const p = e.aggPeriod || String(e.date || '').substring(0, 7);
            if (p !== period) return false;
            if (e.status === 'archivado') return false;
            if (!includePlanned && e.status === 'previsto') return false;
            return true;
        });
    }

    function pcRealExpenses() {
        return periodExpenses(currentPeriod).filter(e => e.status !== 'aportacion');
    }

    function sum(list) {
        return list.reduce((s, e) => s + Number(e.amount || 0), 0);
    }

    // Cálculos de gasto por subcategoría y categoría
    function subSpent(subId) { return sum(pcRealExpenses().filter(e => e.categoryId === subId)); }
    function catSpent(catId) {
        const ids = [catId].concat(pcSubs(catId).map(s => s.id));
        return sum(pcRealExpenses().filter(e => ids.includes(e.categoryId)));
    }
    function rowSpent(rowId) {
        return String(rowId).startsWith('pcs-') ? subSpent(rowId) : catSpent(rowId);
    }

    function findRow(id) {
        if (String(id).startsWith('pcs-')) return (data().pcSubcategories || []).find(s => s.id === id) || null;
        return pcCats().find(c => c.id === id) || null;
    }

    // Cálculos de presupuesto
    function subBudget(subId) {
        const s = (data().pcSubcategories || []).find(x => x.id === subId);
        if (!s) return null;
        return (s.budget === null || s.budget === undefined) ? null : Number(s.budget);
    }

    function catBudget(catId) {
        const c = pcCats().find(x => x.id === catId);
        if (!c) return null;
        let total = (c.budget === null || c.budget === undefined) ? null : Number(c.budget);
        
        pcSubs(catId).forEach(s => {
            if (s.budget !== null && s.budget !== undefined) {
                total = (total === null ? 0 : total) + Number(s.budget);
            }
        });

        if (catId === 'pc-groceries') {
            const w = pcWeeks().reduce((s, x) => s + Number(x.budget || 0), 0);
            if (w) total = (total === null ? 0 : total) + w;
        }

        if (catId === 'pc-loans') {
            const l = pcLoans().reduce((s, x) => s + Number(x.amountPerInstallment || 0), 0);
            if (l) total = (total === null ? 0 : total) + l;
        }

        return total;
    }

    function totalBudgetDefined() {
        return pcCats().reduce((s, c) => {
            const b = catBudget(c.id);
            return s + (b === null ? 0 : b);
        }, 0);
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
        return (data().accounts || []).reduce((s, a) => s + Number(a.balance || 0), 0);
    }

    // Reconciliación bancaria (Saldo Objetivo Trade Republic)
    function trExpected() {
        const r = recon();
        const closedWeeks = pcWeeks().filter(w => r.weeksClosed[w.id]).reduce((s, w) => s + Number(w.budget || 0), 0);
        const paidLoans = pcLoans().reduce((s, l) => r.loansPaid[l.id] ? s + Number(l.amountPerInstallment || 0) : s, 0);
        return Number(r.initialBalance || 0) - closedWeeks - paidLoans;
    }

    function trReal() { return Number(recon().realBalances[currentPeriod] || 0); }
    function miTarget() { return Number(data().pcMyInvestorTarget || 1125); }

    // Utilidades de formato visual
    function fmt(n) { return App.formatCurrency(Number(n) || 0); }
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function shortDate(iso) {
        const d = new Date(iso + 'T00:00:00');
        return isNaN(d) ? '' : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    }

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

    // ===== Registro de movimientos y ajustes directos =====
    function addMovement(targetId, amount, opts) {
        opts = opts || {};
        const id = 'pc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const exp = {
            id,
            concept: opts.concept || 'Movimiento',
            amount: Number(amount) || 0,
            date: opts.date || new Date().toISOString().slice(0, 10),
            categoryId: targetId,
            person: opts.person || 'conjunto',
            status: opts.status || 'registrado',
            type: 'individual',
            notes: opts.notes || '',
            aggPeriod: currentPeriod,
            pcAccount: opts.account || ''
        };
        if (opts.pcWeekId) exp.pcWeekId = opts.pcWeekId;
        data().expenses.push(exp);
        App.saveData();
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
            render();
            return;
        }

        addMovement(rowId, newValue, {
            concept: 'Ajuste de gasto real',
            account: (findRow(rowId) || {}).account || '',
            action: 'Ajuste'
        });
        const last = data().expenses[data().expenses.length - 1];
        if (last && last.concept === 'Ajuste de gasto real') last.pcAuto = 'ajuste';
        App.saveData();
        render();
    }

    // ===== Componente 1: Barra Superior =====
    function headerHtml() {
        const months = [...new Set((data().expenses || []).map(e => e.aggPeriod || String(e.date || '').substring(0, 7)))].sort();
        if (!months.includes(currentPeriod)) months.push(currentPeriod);
        const opts = months.map(m => `<option value="${m}" ${m === currentPeriod ? 'selected' : ''}>${App.formatPeriod(m)}</option>`).join('');

        return `<div class="pc-topbar-v5">
            <div class="pc-period-pill">📆 <select id="pcPeriod" title="Periodo del dashboard">${opts}</select></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <button class="btn btn-sm" id="pcBtnUpdateBalances">🏦 Actualizar Saldos</button>
                <button class="btn btn-sm" id="pcBtnCat">＋ Nueva categoría</button>
                <button class="btn btn-primary btn-sm" id="pcNewMov">＋ Nuevo movimiento</button>
                <button class="btn btn-sm btn-ghost" id="pcBtnBackend" title="Ver código Google Apps Script">⚡ Apps Script</button>
            </div></div>`;
    }

    // ===== Componente 2:Tarjetas de KPIs Superiores =====
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
                <div class="pc-kpi-note">Asignaciones de ${esc(App.formatPeriod(currentPeriod))}</div></div>
            <div class="pc-kpi-card" style="--kpi-accent:var(--warning)">
                <span class="pc-kpi-icon">💸</span>
                <div class="pc-kpi-label">Gasto Ejecutado</div>
                <div class="pc-kpi-big">${fmt(gastos)}</div>
                <div class="pc-progress"><div style="width:${pctGlob}%;background:${pctGlob >= 100 ? 'var(--danger)' : 'var(--warning)'}"></div></div>
                <div class="pc-kpi-note pc-num">${presup ? pctGlob.toFixed(0) : 0}% consumido</div></div>
            <div class="pc-kpi-card" style="--kpi-accent:${disponible >= 0 ? 'var(--success)' : 'var(--danger)'}">
                <span class="pc-kpi-icon">💶</span>
                <div class="pc-kpi-label">Dinero Disponible</div>
                <div class="pc-kpi-big ${availCls(disponible)}">${fmt(disponible)}</div>
                <div class="pc-kpi-note">Diferencia: <b class="pc-num ${diffCls(-desv)}">${desv > 0 ? '+' : ''}${fmt(desv)}</b></div></div>
            <div class="pc-kpi-card" style="--kpi-accent:#8b5cf6">
                <span class="pc-kpi-icon">🏦</span>
                <div class="pc-kpi-label">Saldo Real Cuentas</div>
                <div class="pc-kpi-big">${fmt(saldos)}</div>
                <div class="pc-kpi-note">Bancos y tarjetas combinados</div></div>
        </div>`;
    }

    // ===== Componente 3: Groceries & Liquor (Desglose semanal compacto) =====
    function weeksPanelHtml() {
        const weeks = pcWeeks();
        const total = weeks.reduce((s, w) => s + Number(w.budget || 0), 0);
        const today = new Date().toISOString().slice(0, 10);

        const cards = weeks.map(w => {
            const cur = today >= w.start && today <= w.end;
            return `<div class="pc-week-card ${cur ? 'current' : ''}" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px">
                <div>
                    <span class="pc-week-name" style="display:block">${esc(w.label)} ${cur ? '· actual' : ''}</span>
                    <span class="pc-week-dates" style="display:block;margin:0">${shortDate(w.start)} → ${shortDate(w.end)}</span>
                </div>
                <span class="pc-week-amt pc-num" style="background:var(--bg-card);padding:4px 8px;border-radius:6px;border:1px solid var(--border)">${fmt(w.budget)}</span>
            </div>`;
        }).join('');

        return `<div class="pc-panel pc-panel--accent" style="--panel-accent:#10b981">
            <div class="pc-panel-title" style="justify-content:space-between">
                <span style="display:flex;align-items:center;gap:8px"><span class="pc-dot"></span> 🛒 Groceries and Liquor — Semanas</span>
                <div style="display:flex;align-items:center;gap:8px">
                    ${badge('Total ' + fmt(total), 'pc-badge-green')}
                    <button class="pc-btn pc-btn-ghost" style="padding:2px 8px;font-size:11px" data-act="editWeeks">✏️ Editar</button>
                </div>
            </div>
            <div class="pc-week-cards" style="margin-top:8px">${cards || '<div class="pc-empty">Sin semanas definidas</div>'}</div></div>`;
    }

    // ===== Componente 4: Estado de Cuentas y Saldos Objetivo =====
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
            return `<div class="pc-account-row">
                <div><b>${a.icon} ${esc(a.name)}</b>
                    <div class="pc-week-dates">Saldo objetivo: <b class="pc-num">${fmt(a.target)}</b></div></div>
                <div style="text-align:right">
                    <div class="pc-num" style="font-weight:800">${fmt(a.realVal)}</div>
                    <div class="pc-week-dates" style="margin:2px 0 4px">Saldo real banco</div>
                    ${badge('Desv. ' + (d >= 0 ? '+' : '') + fmt(d), d >= 0 ? 'pc-badge-green' : 'pc-badge-red')}
                </div></div>`;
        }).join('');

        const diff = real - expected;

        return `<div class="pc-panel pc-panel--accent" style="--panel-accent:#2563eb">
            <div class="pc-panel-title"><span class="pc-dot"></span> 🏦 Estado de Cuentas
                <span style="margin-left:auto"><button class="pc-btn pc-btn-ghost" style="padding:2px 8px;font-size:11px" id="pcQuickUpdateBalances">Ajustar</button></span></div>
            ${html}
            <div class="pc-week-dates" style="margin-top:8px">Saldo esperado a cierre: <b class="pc-num">${fmt(expected)}</b> · Desviación:
                <b class="pc-num ${diffCls(diff)}">${diff >= 0 ? '+' : ''}${fmt(diff)}</b></div></div>`;
    }

    // ===== Componente 5: Tabla Principal (Filas Oscuras para Categorías) =====
    function tableHtml() {
        const cats = pcCats();
        let html = `<div class="pc-table-wrap"><table class="pc-table"><thead><tr>
            <th>CATEGORÍA / SUBCATEGORÍA</th><th>CUENTA ASOCIADA</th>
            <th class="pc-th-num">PRESUPUESTO</th><th class="pc-th-num">GASTO REAL</th>
            <th class="pc-th-num">DISPONIBLE</th><th class="pc-th-num">CONSUMO / ESTADO</th></tr></thead><tbody>`;

        cats.forEach(c => {
            const meta = CAT_META[c.id] || { accent: '#2563eb' };
            const subs = pcSubs(c.id);
            const isOpen = !openCats[c.id]; // Desplegado por defecto para mayor agilidad
            const cb = catBudget(c.id), cs = catSpent(c.id);
            const avail = (cb === null ? null : cb - cs);

            // Fila de Categoría Principal con Estilo Oscuro Elegante
            html += `<tr class="pc-row-cat bg-slate-800 text-white" data-toggle="${c.id}" style="--cat-accent:${meta.accent}; background-color:#1e293b; color:#ffffff;">
                <td><span class="pc-caret ${isOpen ? 'open' : ''}" style="color:#94a3b8">▶</span> ${c.icon || '📁'} <span class="pc-cat-name font-bold text-white" data-editcat="${c.id}" title="Editar categoría">${esc(rowLabel(c))}</span> ${dueBadge(c.dueDate)}</td>
                <td>${badge(esc(c.account || '—'), 'pc-badge-gray')}</td>
                <td class="pc-td-num font-bold text-emerald-400" style="color:#34d399">${cb === null ? muted('No definido') : fmt(cb)}</td>
                <td class="pc-td-num text-slate-200"><span class="pc-cell-edit" data-real="${c.id}" title="Clic para ajustar gasto real">✏️ ${fmt(cs)}</span></td>
                <td class="pc-td-num font-bold ${avail !== null && avail < 0 ? 'text-red-400' : 'text-emerald-400'}" style="color:${avail !== null && avail < 0 ? '#f87171' : '#34d399'}">${avail === null ? '—' : fmt(avail)}</td>
                <td class="pc-td-num">${miniBar(cs, cb, meta.accent)}</td></tr>`;

            if (isOpen) {
                subs.forEach(s => {
                    const sb = subBudget(s.id);
                    const ss = subSpent(s.id);
                    const sa = sb === null ? null : sb - ss;
                    html += `<tr class="pc-row-sub" style="--cat-accent:${meta.accent}">
                        <td>${s.icon || '·'} <span class="pc-cat-name" data-editsub="${s.id}" title="Editar subcategoría">${esc(s.name)}</span> ${dueBadge(s.dueDate)}</td>
                        <td>${badge(esc(s.account || c.account || '—'), 'pc-badge-gray')}</td>
                        <td class="pc-td-num">${sb === null ? muted('No definido') : fmt(sb)}</td>
                        <td class="pc-td-num"><span class="pc-cell-edit" data-real="${s.id}" title="Ajustar gasto real">✏️ ${fmt(ss)}</span></td>
                        <td class="pc-td-num ${availCls(sa)}">${sa === null ? '—' : fmt(sa)}</td>
                        <td class="pc-td-num">${miniBar(ss, sb, meta.accent)} ${pctBadge(sb, ss)}</td></tr>`;
                });

                if (c.id === 'pc-loans') pcLoans().forEach(l => {
                    const paid = !!recon().loansPaid[l.id];
                    html += `<tr class="pc-row-sub" style="--cat-accent:${meta.accent}">
                        <td>💳 ${esc(l.name)} <span class="pc-num" style="color:var(--text-muted)">(${l.paidInstallments}/${l.totalInstallments} cuotas)</span></td>
                        <td>${badge(esc(l.account || 'Trade Republic'), 'pc-badge-gray')}</td>
                        <td class="pc-td-num">${fmt(l.amountPerInstallment)}/cuota</td>
                        <td class="pc-td-num"><span class="pc-cell-edit" data-real="pc-loans" title="Gasto cuotas">✏️ ${fmt(catSpent('pc-loans'))}</span></td>
                        <td class="pc-td-num">—</td>
                        <td class="pc-td-num"><span class="pc-toggle"><input type="checkbox" data-loanpaid="${l.id}" ${paid ? 'checked' : ''}><span class="pc-slider"></span></span> ${badge(paid ? 'Pagado' : 'Pendiente', paid ? 'pc-badge-green' : 'pc-badge-amber')}</td></tr>`;
                });
            }
        });

        html += '</tbody></table></div>';
        return html;
    }

    // ===== Componente 6: Movimientos Recientes & Previsión =====
    function movementsHtml() {
        const presup = totalBudgetDefined(), ejec = totalRealSpent(), pend = pendingPayments();
        const rem = presup - ejec - pend;
        const all = pcRealExpenses().slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - uiState.movDays);
        const movs = (uiState.movDays === 0 ? all : all.filter(m => new Date(String(m.date) + 'T00:00:00') >= cutoff)).slice(0, 10);

        const rows = movs.map(m => {
            const cat = findRow(m.categoryId) || {};
            const acc = m.pcAccount || cat.account || '—';
            const st = m.pcAuto === 'ajuste' ? stateDot('var(--warning)', 'Ajuste') : m.status === 'pendiente' ? stateDot('var(--warning)', 'Pendiente') : stateDot('var(--success)', 'Registrado');
            
            return `<div class="pc-mov-row">
                <div class="pc-mov-date">${shortDate(m.date)}</div>
                <div><b>${esc(m.concept)}</b><div class="pc-mov-date">${esc(rowLabel(cat) || CAT_META[m.categoryId]?.label || 'Sin categoría')}</div></div>
                <div>${badge(esc(acc), 'pc-badge-gray')}</div>
                <div class="pc-mov-amt">${m.status === 'pendiente' ? '<s style="color:var(--text-muted)">' + fmt(m.amount) + '</s>' : fmt(m.amount)}</div>
                <div>${st}</div>
                <div style="text-align:right;display:flex;gap:4px;justify-content:flex-end">
                    <button class="pc-btn pc-btn-ghost" style="padding:4px 8px;font-size:11px" data-editmov="${m.id}" title="Editar">✏️</button>
                    <button class="pc-btn pc-btn-ghost" style="padding:4px 8px;font-size:11px" data-delmov="${m.id}" title="Eliminar">×</button>
                </div></div>`;
        }).join('') || '<div class="pc-empty">Sin movimientos registrados.</div>';

        const filters = [
            chip('Todos', `data-movdays="0" ${uiState.movDays === 0 ? 'style="outline:2px solid var(--primary)"' : ''}`, uiState.movDays === 0 ? 'green' : 'gray'),
            chip('7 días', `data-movdays="7" ${uiState.movDays === 7 ? 'style="outline:2px solid var(--primary)"' : ''}`, uiState.movDays === 7 ? 'green' : 'gray'),
            chip('30 días', `data-movdays="30" ${uiState.movDays === 30 ? 'style="outline:2px solid var(--primary)"' : ''}`, uiState.movDays === 30 ? 'green' : 'gray')
        ].join(' ');

        return `<div class="pc-bottom">
            <div class="pc-panel"><div class="pc-panel-title">🕘 Últimos movimientos
                <span style="margin-left:auto;display:inline-flex;gap:6px">${filters}</span>
                <button class="pc-btn pc-btn-ghost" style="margin-left:8px" data-act="newMov">＋ Añadir</button></div>${rows}</div>
            <div class="pc-panel pc-panel--accent" style="--panel-accent:#8b5cf6"><div class="pc-panel-title"><span class="pc-dot"></span> 🔮 Previsión de cierre del periodo</div>
                <div class="pc-sum-row"><span>Presupuesto asignado</span><b class="pc-num">${fmt(presup)}</b></div>
                <div class="pc-sum-row"><span>Ejecutado real</span><b class="pc-num">${fmt(ejec)}</b></div>
                <div class="pc-sum-row"><span>Pagos pendientes (cuotas)</span><b class="pc-num">${fmt(pend)}</b></div>
                <div class="pc-sum-row"><span>Remanente estimado</span><b class="pc-num ${availCls(rem)}">${fmt(rem)}</b></div>
                <div class="pc-week-dates" style="margin-top:8px">${rem >= 0 ? 'Cierre proyectado positivo.' : 'Atención: proyección con descuadre negativo.'}</div></div>
        </div>`;
    }

    // ===== Modales y Pop-ups =====
    function closeModal() { const b = document.getElementById('pcBackdrop'); if (b) b.remove(); }
    function closePop() { if (popEl) { popEl.remove(); popEl = null; } }

    function openCatModal(id, isSub) {
        const item = isSub ? (data().pcSubcategories || []).find(s => s.id === id) : pcCats().find(c => c.id === id);
        if (!item) return;
        const accOpts = ACCOUNTS.map(a => `<option ${item.account === a ? 'selected' : ''}>${a}</option>`).join('');
        closeModal();

        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>${item.icon || '⚙️'} Editar ${isSub ? 'subcategoría' : 'categoría'}</h3>
            <div class="pc-field"><label>Nombre</label><input id="mName" value="${esc(item.name)}"></div>
            <div class="pc-field"><label>Icono</label><input id="mIcon" value="${esc(item.icon || '')}" maxlength="4"></div>
            <div class="pc-field"><label>Presupuesto (€)</label><input id="mBudget" type="number" step="0.01" value="${item.budget === null || item.budget === undefined ? '' : item.budget}"></div>
            <div class="pc-field"><label>Cuenta vinculada</label><select id="mAcc">${accOpts}</select></div>
            <div class="pc-field"><label>Fecha de vencimiento</label><input id="mDue" type="date" value="${esc(item.dueDate || '')}"></div>
            <div class="pc-modal-actions">
                <button class="pc-btn pc-btn-danger" id="mDelete">🗑 Eliminar</button>
                <button class="pc-btn pc-btn-ghost" id="mCancel">Cancelar</button>
                <button class="pc-btn pc-btn-primary" id="mSave">Guardar</button></div></div>`;
        document.body.appendChild(div);
        
        div.querySelector('#mCancel').onclick = closeModal;
        div.querySelector('#mSave').onclick = () => {
            item.name = div.querySelector('#mName').value.trim() || item.name;
            item.icon = div.querySelector('#mIcon').value.trim() || item.icon;
            const bv = div.querySelector('#mBudget').value;
            item.budget = bv === '' ? null : Number(bv);
            item.account = div.querySelector('#mAcc').value;
            item.dueDate = div.querySelector('#mDue').value || null;
            App.saveData(); App.addHistory('presupuesto-comun', `Editado: ${item.name}`);
            closeModal(); render(); App.showToast('Cambios guardados', 'success');
        };
        div.querySelector('#mDelete').onclick = () => {
            App.showConfirm(`¿Eliminar «${item.name}»?`, () => {
                if (isSub) {
                    data().pcSubcategories = data().pcSubcategories.filter(s => s.id !== item.id);
                } else {
                    data().pcCategories = data().pcCategories.filter(c => c.id !== item.id);
                }
                App.saveData(); closeModal(); render(); App.showToast('Eliminado', 'success');
            });
        };
    }

    function openQuickPop(anchorEl, rowId, currentValue) {
        closePop();
        const row = findRow(rowId);
        popEl = document.createElement('div');
        popEl.className = 'pc-pop';
        popEl.innerHTML = `<div class="pc-pop-head"><span>Ajuste Gasto Real (€)</span></div>
            <input type="number" step="0.01" id="qpVal" class="pc-inline-input" value="${Number(currentValue).toFixed(2)}">
            <div class="pc-pop-actions">
                <button class="pc-btn pc-btn-ghost" id="qpCancel">×</button>
                <button class="pc-btn pc-btn-primary" id="qpSave">Guardar</button></div>`;
        document.body.appendChild(popEl);
        
        const rect = anchorEl.getBoundingClientRect();
        popEl.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 260)) + 'px';
        popEl.style.top = (rect.bottom + 8) + 'px';
        
        const inp = popEl.querySelector('#qpVal'); inp.focus(); inp.select();
        const save = () => { setRowReal(rowId, inp.value); closePop(); App.showToast('Gasto real actualizado', 'success'); };
        popEl.querySelector('#qpSave').onclick = save;
        popEl.querySelector('#qpCancel').onclick = closePop;
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') closePop(); });
    }

    function catOptionsHtml(selectedId) {
        return pcCats().map(c => `<option value="${c.id}" ${selectedId === c.id ? 'selected' : ''}>${c.icon} ${esc(CAT_META[c.id] ? CAT_META[c.id].label : c.name)}</option>`)
            .concat((data().pcSubcategories || []).map(s => `<option value="${s.id}" ${selectedId === s.id ? 'selected' : ''}>└ ${s.icon || '·'} ${esc(s.name)}</option>`)).join('');
    }

    function openNewMovModal(preselectCatId) {
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>📝 Nuevo movimiento</h3>
            <div class="pc-field"><label>Concepto</label><input id="nConcept" placeholder="Ej. Compra semanal"></div>
            <div class="pc-field"><label>Categoría</label><select id="nCat">${catOptionsHtml(preselectCatId)}</select></div>
            <div class="pc-field"><label>Importe (€)</label><input id="nAmt" type="number" step="0.01" placeholder="0,00"></div>
            <div class="pc-field"><label>Fecha</label><input id="nDate" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
            <div class="pc-field"><label>Cuenta</label><select id="nAcc">${ACCOUNTS.map(a => `<option>${a}</option>`).join('')}</select></div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="nCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="nSave">Registrar</button></div></div>`;
        document.body.appendChild(div);

        div.querySelector('#nCancel').onclick = closeModal;
        div.querySelector('#nSave').onclick = () => {
            const amt = Number(div.querySelector('#nAmt').value);
            if (!amt || amt <= 0) { App.showToast('Importe no válido', 'error'); return; }
            addMovement(div.querySelector('#nCat').value, amt, {
                concept: div.querySelector('#nConcept').value.trim() || 'Movimiento',
                date: div.querySelector('#nDate').value,
                account: div.querySelector('#nAcc').value
            });
            closeModal(); App.showToast('Movimiento registrado', 'success');
        };
    }

    function openEditMovModal(movId) {
        const exp = (data().expenses || []).find(e => e.id === movId);
        if (!exp) return;
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>✏️ Editar movimiento</h3>
            <div class="pc-field"><label>Concepto</label><input id="eConcept" value="${esc(exp.concept)}"></div>
            <div class="pc-field"><label>Importe (€)</label><input id="eAmt" type="number" step="0.01" value="${Number(exp.amount || 0)}"></div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="eCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="eSave">Guardar</button></div></div>`;
        document.body.appendChild(div);

        div.querySelector('#eCancel').onclick = closeModal;
        div.querySelector('#eSave').onclick = () => {
            const amt = Number(div.querySelector('#eAmt').value);
            if (isNaN(amt) || amt <= 0) { App.showToast('Importe no válido', 'error'); return; }
            exp.concept = div.querySelector('#eConcept').value.trim() || exp.concept;
            exp.amount = amt;
            App.saveData(); closeModal(); render(); App.showToast('Movimiento actualizado', 'success');
        };
    }

    function openNewCatModal() {
        closeModal();
        const parents = pcCats().map(c => `<option value="${c.id}">${c.icon} ${esc(c.name)}</option>`).join('');
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>🗂️ Nueva categoría</h3>
            <div class="pc-field"><label>Tipo</label><select id="cType"><option value="cat">Categoría principal</option><option value="sub">Subcategoría</option></select></div>
            <div class="pc-field" id="cParentWrap" style="display:none"><label>Categoría padre</label><select id="cParent">${parents}</select></div>
            <div class="pc-field"><label>Nombre</label><input id="cName" placeholder="Ej. Restaurantes"></div>
            <div class="pc-field"><label>Presupuesto (€)</label><input id="cBudget" type="number" step="0.01"></div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="cCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="cSave">Crear</button></div></div>`;
        document.body.appendChild(div);

        div.querySelector('#cType').onchange = e => { div.querySelector('#cParentWrap').style.display = e.target.value === 'sub' ? '' : 'none'; };
        div.querySelector('#cCancel').onclick = closeModal;
        div.querySelector('#cSave').onclick = () => {
            const name = div.querySelector('#cName').value.trim();
            if (!name) { App.showToast('Nombre obligatorio', 'error'); return; }
            const isSub = div.querySelector('#cType').value === 'sub';
            const bv = div.querySelector('#cBudget').value;
            const obj = { id: (isSub ? 'pcs-' : 'pc-') + Date.now().toString(36), name, budget: bv === '' ? null : Number(bv) };
            
            if (isSub) { obj.parentId = div.querySelector('#cParent').value; data().pcSubcategories.push(obj); }
            else { obj.order = (pcCats().length + 1) * 10; data().pcCategories.push(obj); }
            
            App.saveData(); closeModal(); render(); App.showToast('Categoría creada', 'success');
        };
    }

    function editWeeks() {
        const weeks = pcWeeks();
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal" style="width:min(520px,94vw)"><h3>🗓️ Editar Semanas (Groceries)</h3>
            ${weeks.map(w => `<div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;margin-bottom:8px">
                <input type="date" data-w="${w.id}" data-f="start" value="${w.start}">
                <input type="date" data-w="${w.id}" data-f="end" value="${w.end}">
                <input type="number" step="1" data-w="${w.id}" data-f="budget" value="${w.budget}">
                <button class="pc-btn pc-btn-ghost" data-delweek="${w.id}">×</button></div>`).join('')}
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-primary" id="wkSave">Guardar</button></div></div>`;
        document.body.appendChild(div);

        div.querySelector('#wkSave').onclick = () => {
            div.querySelectorAll('[data-w]').forEach(inp => {
                const w = data().pcWeeks.find(x => x.id === inp.getAttribute('data-w'));
                if (w) w[inp.getAttribute('data-f')] = inp.getAttribute('data-f') === 'budget' ? Number(inp.value) : inp.value;
            });
            App.saveData(); closeModal(); render(); App.showToast('Semanas guardadas', 'success');
        };
    }

    function openUpdateBalancesModal() {
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        const realTR = trReal();
        const realMI = accountRealBalance('MyInvestor');

        div.innerHTML = `<div class="pc-modal"><h3>🏦 Actualizar Saldos Reales</h3>
            <div class="pc-field"><label>Trade Republic (€)</label><input id="bTR" type="number" step="0.01" value="${realTR || ''}"></div>
            <div class="pc-field"><label>MyInvestor (€)</label><input id="bMI" type="number" step="0.01" value="${realMI || ''}"></div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="bCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="bSave">Guardar Saldos</button></div></div>`;
        document.body.appendChild(div);

        div.querySelector('#bCancel').onclick = closeModal;
        div.querySelector('#bSave').onclick = () => {
            const vTR = Number(div.querySelector('#bTR').value) || 0;
            const vMI = Number(div.querySelector('#bMI').value) || 0;
            recon().realBalances[currentPeriod] = vTR;
            const accMI = (data().accounts || []).find(a => (a.name || '').toLowerCase().includes('myinvestor'));
            if (accMI) accMI.balance = vMI;

            App.saveData(); App.addHistory('presupuesto-comun', 'Saldos reales actualizados');
            closeModal(); render(); App.showToast('Saldos bancarios actualizados', 'success');
        };
    }

    function openBackendCodeModal() {
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal" style="width:min(640px,94vw)"><h3>⚡ Integración Google Apps Script & Sheets</h3>
            <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Estructura backend integrada lista para el despliegue:</p>
            <pre style="background:#0f172a;color:#34d399;padding:12px;border-radius:10px;font-size:11px;overflow-x:auto;max-height:220px">
function doGet(e) { 
  return HtmlService.createHtmlOutputFromFile('index').setTitle('Presupuesto Pareja'); 
}
function getInitialData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return { 
    accounts: readSheetData(ss.getSheetByName('Accounts')), 
    transactions: readSheetData(ss.getSheetByName('Transactions')) 
  };
}</pre>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-primary" id="cClose">Cerrar</button></div></div>`;
        document.body.appendChild(div);
        div.querySelector('#cClose').onclick = closeModal;
    }

    // ===== Render Principal & Bindings =====
    function render(targetContainer) {
        if (targetContainer) containerEl = targetContainer;
        if (!containerEl) containerEl = document.getElementById('sectionContainer');
        if (!containerEl) return;
        
        closePop();
        containerEl.innerHTML = headerHtml() + kpisHtml() +
            `<div class="pc-cols2">${weeksPanelHtml()}${accountsPanelHtml()}</div>` +
            tableHtml() + movementsHtml();
        bind();
    }

    function bind() {
        const $ = sel => containerEl.querySelector(sel);
        if ($('#pcPeriod')) $('#pcPeriod').onchange = e => { currentPeriod = e.target.value; render(); };
        if ($('#pcNewMov')) $('#pcNewMov').onclick = () => openNewMovModal();
        if ($('#pcBtnCat')) $('#pcBtnCat').onclick = openNewCatModal;
        if ($('#pcBtnUpdateBalances')) $('#pcBtnUpdateBalances').onclick = openUpdateBalancesModal;
        if ($('#pcQuickUpdateBalances')) $('#pcQuickUpdateBalances').onclick = openUpdateBalancesModal;
        if ($('#pcBtnBackend')) $('#pcBtnBackend').onclick = openBackendCodeModal;

        containerEl.querySelectorAll('[data-toggle]').forEach(tr => tr.onclick = e => {
            if (e.target.closest('[data-editcat]') || e.target.closest('[data-real]') || e.target.closest('[data-loanpaid]')) return;
            const id = tr.getAttribute('data-toggle'); openCats[id] = !openCats[id]; render();
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
        containerEl.querySelectorAll('[data-act]').forEach(btn => btn.onclick = () => {
            const act = btn.getAttribute('data-act');
            if (act === 'newMov') openNewMovModal();
            if (act === 'editWeeks') editWeeks();
        });
        containerEl.querySelectorAll('[data-movdays]').forEach(ch => ch.onclick = () => {
            uiState.movDays = Number(ch.getAttribute('data-movdays')); render();
        });
        containerEl.querySelectorAll('[data-editmov]').forEach(b => b.onclick = e => { e.stopPropagation(); openEditMovModal(b.getAttribute('data-editmov')); });
        containerEl.querySelectorAll('[data-delmov]').forEach(b => b.onclick = e => {
            e.stopPropagation();
            const id = b.getAttribute('data-delmov');
            const mv = (data().expenses || []).find(x => x.id === id) || {};
            App.showConfirm(`¿Eliminar movimiento «${mv.concept || id}»?`, () => {
                data().expenses = data().expenses.filter(x => x.id !== id);
                App.saveData(); App.addHistory('presupuesto-comun', `Movimiento eliminado: ${mv.concept || id}`);
                render(); App.showToast('Movimiento eliminado', 'success');
            });
        });
    }

    // ===== API Pública =====
    function init(container) {
        if (container) containerEl = container;
        if (!containerEl) containerEl = document.getElementById('sectionContainer');
        render();
    }
    function onThemeChange() { render(); }
    function openExpenseModal(expenseId) {
        const exp = (data().expenses || []).find(e => e.id === expenseId);
        if (exp) openCatModal(exp.categoryId, String(exp.categoryId || '').startsWith('pcs-'));
        else openNewMovModal();
    }
    function openCategoryModal(catId) { openCatModal(catId, String(catId || '').startsWith('pcs-')); }

    return {
        init, render, onThemeChange,
        openExpenseModal, openCategoryModal,
        openMovementModal: openNewMovModal,
        quickEditRealSpend: (rowId, value) => { setRowReal(rowId, value); },
        addMovement
    };
})();

// Registro global
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
            if (!register()) console.error('No se pudo registrar presupuesto-comun: falta window.App');
        });
    }
})();
