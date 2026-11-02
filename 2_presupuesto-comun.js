/* =============================================================
   PRESUPUESTO-COMUN.JS — v5 · Clean & Modern UI
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
        'pc-groceries': { accent: '#10b981', label: 'GROCERIES AND LIQUOR' },
        'pc-loans':     { accent: '#ef4444', label: 'LOANS' },
        'pc-savings':   { accent: '#8b5cf6', label: 'SAVINGS' },
        'pc-others':    { accent: '#64748b', label: 'OTHERS' }
    };
    const ACCOUNTS = ['Trade Republic', 'MyInvestor', 'Junta'];

    // ===== estado =====
    function data() { return App.data; }
    let currentPeriod = '2026-11';
    let containerEl = null;
    let openCats = {};          // acordeón: id -> true/false
    let popEl = null;           // pop-up rápido de gasto real
    let uiState = { catFilter: 'all', movDays: 30, weekFilter: 'all' };

    function pcCats()    { return (data().pcCategories || []).slice().sort((a, b) => (a.order || 99) - (b.order || 99)); }
    function pcSubs(pid) { return (data().pcSubcategories || []).filter(s => s.parentId === pid); }
    function pcWeeks()   { return (data().pcWeeks || []).slice().sort((a, b) => String(a.start).localeCompare(String(b.start))); }
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
    function rowSpent(rowId) { return String(rowId).startsWith('pcs-') ? subSpent(rowId) : catSpent(rowId); }
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
    function catBudget(catId) {
        const c = pcCats().find(x => x.id === catId);
        if (!c) return null;
        let total = (c.budget === null || c.budget === undefined) ? null : Number(c.budget);
        pcSubs(catId).forEach(s => {
            if (s.budget !== null && s.budget !== undefined) total = (total === null ? 0 : total) + Number(s.budget);
        });
        if (catId === 'pc-groceries') { const w = pcWeeks().reduce((s, x) => s + Number(x.budget || 0), 0); if (w) total = (total === null ? 0 : total) + w; }
        if (catId === 'pc-loans')     { const l = pcLoans().reduce((s, x) => s + Number(x.amountPerInstallment || 0), 0); if (l) total = (total === null ? 0 : total) + l; }
        return total;
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
        const closedWeeks = pcWeeks().filter(w => r.weeksClosed[w.id]).reduce((s, w) => s + Number(w.budget || 0), 0);
        const paidLoans = pcLoans().reduce((s, l) => r.loansPaid[l.id] ? s + Number(l.amountPerInstallment || 0) : s, 0);
        return Number(r.initialBalance || 0) - closedWeeks - paidLoans;
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
        const dd = App.formatDate(dueDate).slice(0, 5); // dddd/mm
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
        if (fillers.length === 1 && diff !== 0) {
            fillers[0].amount = newValue;
            App.saveData(); App.addHistory('presupuesto-comun', `Ajuste directo ${rowId}: ${fmt(newValue)}`); render(); return;
        }
        if (fillers.length === 1 && diff === 0) { fillers[0].status = 'archivado'; App.saveData(); render(); return; }
        addMovement(rowId, newValue, { concept: 'Ajuste de presupuesto', account: (findRow(rowId) || {}).account || '', action: 'Ajuste' });
        const last = data().expenses[data().expenses.length - 1];
        if (last && last.concept === 'Ajuste de presupuesto') last.pcAuto = 'ajuste';
        App.saveData(); render();
    }

    // ===== render: barra superior =====
    function headerHtml() {
        const months = [...new Set((data().expenses || []).map(e => e.aggPeriod || String(e.date || '').substring(0, 7)))].sort();
        if (!months.includes(currentPeriod)) months.push(currentPeriod);
        const opts = months.map(m => `<option value="${m}" ${m === currentPeriod ? 'selected' : ''}>${App.formatPeriod(m)}</option>`).join('');
        return `<div class="pc-topbar-v5">
            <div class="pc-period-pill">📆 <select id="pcPeriod" title="Periodo del dashboard">${opts}</select></div>
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
        return `<div class="pc-kpis-v4">
            <div class="pc-kpi-card" style="--kpi-accent:#2563eb"><div class="pc-kpi-label">Presupuesto Total</div>
                <div class="pc-kpi-big">${fmt(presup)}</div><div class="pc-kpi-note">Asignaciones del periodo</div></div>
            <div class="pc-kpi-card" style="--kpi-accent:#f59e0b"><div class="pc-kpi-label">Gasto Ejecutado</div>
                <div class="pc-kpi-big">${fmt(gastos)}</div>
                <div class="pc-progress"><div style="width:${pctGlob}%;background:${pctGlob >= 85 ? '#ef4444' : '#f59e0b'}"></div></div>
                <div class="pc-kpi-note">${presup ? pctGlob.toFixed(0) : 0}% del presupuesto consumido</div></div>
            <div class="pc-kpi-card" style="--kpi-accent:${disponible >= 0 ? '#10b981' : '#ef4444'}"><div class="pc-kpi-label">Dinero Disponible</div>
                <div class="pc-kpi-big" style="color:${disponible >= 0 ? '#10b981' : '#ef4444'}">${fmt(disponible)}</div>
                <div class="pc-kpi-note">Desviación: <b style="color:${gastos - presup > 0 ? '#ef4444' : '#10b981'}">${gastos - presup > 0 ? '+' : ''}${fmt(gastos - presup)}</b></div></div>
            <div class="pc-kpi-card" style="--kpi-accent:#8b5cf6"><div class="pc-kpi-label">Saldo Real Cuentas</div>
                <div class="pc-kpi-big">${fmt(saldos)}</div><div class="pc-kpi-note">Bancos y tarjetas combinados</div></div>
        </div>`;
    }

    // ===== bloque 2 izq · Groceries & Liquor (distribución semanal) =====
    function weeksPanelHtml() {
        const weeks = pcWeeks();
        const total = weeks.reduce((s, w) => s + Number(w.budget || 0), 0);
        const today = new Date().toISOString().slice(0, 10);
        const cards = weeks.map(w => {
            const spent = sum(pcRealExpenses().filter(e => e.pcWeekId === w.id));
            const cur = today >= w.start && today <= w.end;
            return `<div class="pc-week-card ${cur ? 'current' : ''}">
                <div class="pc-week-name">${esc(w.label)} ${cur ? '· actual' : ''}</div>
                <div class="pc-week-dates">${shortDate(w.start)} → ${shortDate(w.end)}</div>
                <div class="pc-week-amt">${fmt(w.budget)}</div>
                <div class="pc-week-dates">Gastado: ${fmt(spent)}</div></div>`;
        }).join('');
        return `<div class="pc-panel pc-panel--accent" style="--panel-accent:#10b981">
            <div class="pc-panel-title"><span class="pc-dot"></span> 🛒 Groceries &amp; Liquor · distribución semanal
                <span style="margin-left:auto">${badge('Total ' + fmt(total), 'pc-badge-blue')}</span></div>
            <div class="pc-week-cards">${cards || '<div class="pc-empty">Sin semanas definidas</div>'}</div>
            <div style="margin-top:10px"><button class="pc-btn pc-btn-ghost" data-act="editWeeks">✏️ Editar semanas</button></div></div>`;
    }

    // ===== bloque 2 der · Estado de Cuentas =====
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
                <span style="margin-left:auto">${badge('Sem. cerradas: ' + Object.values(r.weeksClosed).filter(Boolean).length + '/' + pcWeeks().length, 'pc-badge-gray')}</span></div>
            ${html}
            <div class="pc-field" style="margin-top:12px"><label>Saldo Real Trade Republic (€)</label>
                <input type="number" step="0.01" id="pcTrReal" class="pc-inline-input" value="${real || ''}" placeholder="Ej. 627,17"></div>
            <div class="pc-week-dates">Saldo esperado fin de semana: <b class="pc-num">${fmt(expected)}</b> · Desviación:
                <b style="color:${diff >= 0 ? '#10b981' : '#ef4444'}">${diff >= 0 ? '+' : ''}${fmt(diff)}</b>
                ${diff >= 0 ? '(gastaste menos de lo previsto)' : '(descuadre negativo)'}</div></div>`;
    }

    // ===== bloque 3 · Tabla principal (acordeón jerárquico) =====
    function tableHtml() {
        const cats = pcCats();
        let html = `<div class="pc-table-wrap"><table class="pc-table"><thead><tr>
            <th>CATEGORÍA / SUBCATEGORÍA</th><th>CUENTA ASOCIADA</th>
            <th class="pc-th-num">PRESUPUESTO</th><th class="pc-th-num">GASTO REAL</th>
            <th class="pc-th-num">DISPONIBLE</th><th class="pc-th-num">CONSUMO / ESTADO</th></tr></thead><tbody>`;
        cats.forEach(c => {
            const meta = CAT_META[c.id] || { accent: '#2563eb', label: String(c.name || '').toUpperCase() };
            const subs = pcSubs(c.id);
            const isOpen = !!openCats[c.id];
            const cb = catBudget(c.id), cs = catSpent(c.id);
            const avail = (cb === null ? null : cb - cs);
            html += `<tr class="pc-row-cat" data-toggle="${c.id}" style="--cat-accent:${meta.accent}">
                <td><span class="pc-caret ${isOpen ? 'open' : ''}">▶</span> ${c.icon} <span class="pc-cat-name" data-editcat="${c.id}" title="Clic para editar">${esc(meta.label)}</span> ${dueBadge(c.dueDate)}</td>
                <td>${badge(esc(c.account || '—'), 'pc-badge-blue')}</td>
                <td class="pc-td-num">${cb === null ? muted('No definido') : fmt(cb)}</td>
                <td class="pc-td-num"><span class="pc-cell-edit" data-real="${c.id}" title="Clic para ajustar">${fmt(cs)}</span></td>
                <td class="pc-td-num" style="color:${avail === null ? 'var(--text-muted)' : avail >= 0 ? '#10b981' : '#ef4444'}">${avail === null ? '—' : fmt(avail)}</td>
                <td class="pc-td-num">${miniBar(cs, cb, meta.accent)}</td></tr>`;
            if (isOpen) {
                subs.forEach(s => {
                    const sb = subBudget(s.id);
                    const ss = subSpent(s.id);
                    const sa = sb === null ? null : sb - ss;
                    html += `<tr class="pc-row-sub" style="--cat-accent:${meta.accent}">
                        <td>${s.icon || '·'} <span class="pc-cat-name" data-editsub="${s.id}" title="Clic para editar">${esc(s.name)}</span> ${dueBadge(s.dueDate)}</td>
                        <td>${badge(esc(s.account || c.account || '—'), 'pc-badge-gray')}</td>
                        <td class="pc-td-num">${sb === null ? muted('No definido') : fmt(sb)}</td>
                        <td class="pc-td-num"><span class="pc-cell-edit" data-real="${s.id}" title="Clic para ajustar">${fmt(ss)}</span></td>
                        <td class="pc-td-num" style="color:${sa === null ? 'var(--text-muted)' : sa >= 0 ? '#10b981' : '#ef4444'}">${sa === null ? '—' : fmt(sa)}</td>
                        <td class="pc-td-num">${miniBar(ss, sb, meta.accent)} ${pctBadge(sb, ss)}</td></tr>`;
                });
                if (c.id === 'pc-loans') pcLoans().forEach(l => {
                    const paid = !!recon().loansPaid[l.id];
                    html += `<tr class="pc-row-sub" style="--cat-accent:${meta.accent}">
                        <td>💳 ${esc(l.name)} <span class="pc-num" style="color:var(--text-muted)">(${l.paidInstallments}/${l.totalInstallments})</span></td>
                        <td>${badge(esc(l.account || 'Trade Republic'), 'pc-badge-gray')}</td>
                        <td class="pc-td-num">${fmt(l.amountPerInstallment)}/cuota</td>
                        <td class="pc-td-num"><span class="pc-cell-edit" data-real="pc-loans" title="Gasto acumulado de préstamos">${fmt(catSpent('pc-loans'))}</span></td>
                        <td class="pc-td-num">—</td>
                        <td class="pc-td-num"><span class="pc-toggle"><input type="checkbox" data-loanpaid="${l.id}" ${paid ? 'checked' : ''}><span class="pc-slider"></span></span> ${badge(paid ? 'Pagado' : 'Pendiente', paid ? 'pc-badge-green' : 'pc-badge-amber')}</td></tr>`;
                });
                if (!subs.length && c.id !== 'pc-loans') {
                    html += `<tr class="pc-row-sub"><td colspan="6" style="text-align:left;color:var(--text-muted)">Sin subcategorías · pulsa ⚙️ para añadir o editar</td></tr>`;
                }
            }
        });
        html += '</tbody></table></div>';
        return html;
    }

    // ===== bloque 4 · Movimientos + Previsión de cierre =====
    function movementsHtml() {
        const presup = totalBudgetDefined(), ejec = totalRealSpent(), pend = pendingPayments();
        const rem = presup - ejec - pend;
        const all = pcRealExpenses().slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - uiState.movDays);
        const movs = (uiState.movDays === 0 ? all : all.filter(m => new Date(String(m.date) + 'T00:00:00') >= cutoff)).slice(0, 12);
        const rows = movs.map(m => {
            const cat = findRow(m.categoryId) || {};
            const acc = m.pcAccount || cat.account || '—';
            const st = m.pcAuto === 'ajuste' ? stateDot('#f59e0b', 'Ajuste') : m.status === 'pendiente' ? stateDot('#f59e0b', 'Pendiente') : stateDot('#10b981', 'Registrado');
            return `<div class="pc-mov-row">
                <div class="pc-mov-date">${shortDate(m.date)}</div>
                <div><b>${esc(m.concept)}</b><div class="pc-mov-date">${esc(CAT_META[m.categoryId] ? CAT_META[m.categoryId].label : (cat.name || ''))}</div></div>
                <div>${badge(esc(acc), 'pc-badge-gray')}</div>
                <div class="pc-mov-amt">${fmt(m.amount)}</div>
                <div>${st}</div>
                <div style="text-align:right;display:flex;gap:4px;justify-content:flex-end">
                    <button class="pc-btn pc-btn-ghost" style="padding:4px 8px;font-size:11px" data-editmov="${m.id}" title="Editar movimiento">✏️</button>
                    <button class="pc-btn pc-btn-ghost" style="padding:4px 8px;font-size:11px" data-delmov="${m.id}" title="Eliminar movimiento">×</button>
                </div></div>`;
        }).join('') || '<div class="pc-empty">Sin movimientos en el filtro seleccionado.</div>';
        const filters = [
            chip('Todos', `data-movdays="0" ${uiState.movDays === 0 ? 'style="outline:2px solid var(--primary)"' : ''}`, uiState.movDays === 0 ? 'green' : 'gray'),
            chip('7 días', `data-movdays="7" ${uiState.movDays === 7 ? 'style="outline:2px solid var(--primary)"' : ''}`, uiState.movDays === 7 ? 'green' : 'gray'),
            chip('30 días', `data-movdays="30" ${uiState.movDays === 30 ? 'style="outline:2px solid var(--primary)"' : ''}`, uiState.movDays === 30 ? 'green' : 'gray')
        ].join(' ');
        return `<div class="pc-bottom">
            <div class="pc-panel"><div class="pc-panel-title">🕘 Últimos movimientos registrados
                <span style="margin-left:auto;display:inline-flex;gap:6px">${filters}</span>
                <button class="pc-btn pc-btn-ghost" style="margin-left:8px" data-act="newMov">＋ Añadir</button></div>${rows}</div>
            <div class="pc-panel pc-panel--accent" style="--panel-accent:#8b5cf6"><div class="pc-panel-title"><span class="pc-dot"></span> 🔮 Previsión de cierre del periodo</div>
                <div class="pc-sum-row"><span>Presupuesto asignado</span><b class="pc-num">${fmt(presup)}</b></div>
                <div class="pc-sum-row"><span>Ejecutado real</span><b class="pc-num">${fmt(ejec)}</b></div>
                <div class="pc-sum-row"><span>Pagos pendientes (cuotas)</span><b class="pc-num">${fmt(pend)}</b></div>
                <div class="pc-sum-row"><span>Remanente estimado</span><b class="pc-num" style="color:${rem >= 0 ? '#10b981' : '#ef4444'}">${fmt(rem)}</b></div></div>
        </div>`;
    }

    // ===== modales =====
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
            <div class="pc-field"><label>Presupuesto (€) · vacío = no definido</label><input id="mBudget" type="number" step="0.01" value="${item.budget === null || item.budget === undefined ? '' : item.budget}"></div>
            <div class="pc-field"><label>Cuenta vinculada</label><select id="mAcc">${accOpts}</select></div>
            <div class="pc-field"><label>Fecha de vencimiento</label><input id="mDue" type="date" value="${esc(item.dueDate || '')}"></div>
            <div class="pc-modal-actions">
                <button class="pc-btn pc-btn-danger" id="mDelete">🗑 Eliminar</button>
                <button class="pc-btn pc-btn-ghost" id="mCancel">Cancelar</button>
                <button class="pc-btn pc-btn-primary" id="mSave">Guardar</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        div.querySelector('#mCancel').onclick = closeModal;
        div.querySelector('#mSave').onclick = () => {
            item.name = div.querySelector('#mName').value.trim() || item.name;
            item.icon = div.querySelector('#mIcon').value.trim() || item.icon;
            const bv = div.querySelector('#mBudget').value;
            item.budget = bv === '' ? null : Number(bv);
            item.account = div.querySelector('#mAcc').value;
            item.dueDate = div.querySelector('#mDue').value || null;
            App.saveData(); App.addHistory('presupuesto-comun', `Editada ${isSub ? 'subcategoría' : 'categoría'}: ${item.name}`);
            closeModal(); render(); App.showToast('Guardado', 'success');
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
        popEl.innerHTML = `<div class="pc-pop-head"><span>Gasto Real (€) · ${esc(row ? row.name : rowId)}</span></div>
            <input type="number" step="0.01" id="qpVal" class="pc-inline-input" value="${Number(currentValue).toFixed(2)}">
            <div class="pc-modal-actions" style="margin-top:10px">
                <button class="pc-btn pc-btn-ghost" id="qpCancel">×</button>
                <button class="pc-btn pc-btn-primary" id="qpSave">Guardar</button></div>
            <div class="pc-pop-hint">Enter guarda · Esc cierra</div>`;
        document.body.appendChild(popEl);
        const rect = anchorEl.getBoundingClientRect();
        popEl.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 260)) + 'px';
        popEl.style.top = (rect.bottom + 8) + 'px';
        const inp = popEl.querySelector('#qpVal'); inp.focus(); inp.select();
        const save = () => { setRowReal(rowId, inp.value); closePop(); App.showToast('Gasto real actualizado', 'success'); };
        popEl.querySelector('#qpSave').onclick = save;
        popEl.querySelector('#qpCancel').onclick = closePop;
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') closePop(); });
        setTimeout(() => document.addEventListener('click', function outside(ev) {
            if (popEl && !popEl.contains(ev.target) && ev.target !== anchorEl) { closePop(); document.removeEventListener('click', outside); }
        }), 0);
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
            <div class="pc-field"><label>Concepto</label><input id="nConcept" placeholder="Ej. Cena imprevista"></div>
            <div class="pc-field"><label>Categoría / Subcategoría</label><select id="nCat">${catOptionsHtml(preselectCatId)}</select></div>
            <div class="pc-field"><label>Importe (€)</label><input id="nAmt" type="number" step="0.01" placeholder="0,00"></div>
            <div class="pc-field"><label>Fecha</label><input id="nDate" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
            <div class="pc-field"><label>Cuenta</label><select id="nAcc"><option value="">Heredar de la categoría</option>${ACCOUNTS.map(a => `<option>${a}</option>`).join('')}</select></div>
            <div class="pc-field"><label>¿Quién pagó?</label><select id="nWho"><option value="conjunto">Conjunto</option><option value="ana">Nena</option><option value="carlos">Bombón</option></select></div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="nCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="nSave">Registrar</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        div.querySelector('#nCancel').onclick = closeModal;
        div.querySelector('#nSave').onclick = () => {
            const amt = Number(div.querySelector('#nAmt').value);
            if (!amt || amt <= 0) { App.showToast('Importe no válido', 'error'); return; }
            const catId = div.querySelector('#nCat').value;
            addMovement(catId, amt, {
                concept: div.querySelector('#nConcept').value.trim() || 'Movimiento',
                date: div.querySelector('#nDate').value, person: div.querySelector('#nWho').value,
                account: div.querySelector('#nAcc').value || (findRow(catId) || {}).account || '',
                action: 'Movimiento'
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
            <div class="pc-field"><label>Categoría / Subcategoría</label><select id="eCat">${catOptionsHtml(exp.categoryId)}</select></div>
            <div class="pc-field"><label>Importe (€)</label><input id="eAmt" type="number" step="0.01" value="${Number(exp.amount || 0)}"></div>
            <div class="pc-field"><label>Fecha</label><input id="eDate" type="date" value="${esc(exp.date || '')}"></div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="eCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="eSave">Guardar</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        div.querySelector('#eCancel').onclick = closeModal;
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
            openCats[obj.parentId || obj.id] = true;
            App.saveData(); App.addHistory('presupuesto-comun', `Creada ${isSub ? 'subcategoría' : 'categoría'}: ${name}`);
            closeModal(); render(); App.showToast('Creado correctamente', 'success');
        };
    }

    function editWeeks() {
        const weeks = pcWeeks();
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal" style="width:min(520px,94vw)"><h3>🗓️ Semanas (Groceries & Liquor)</h3>
            ${weeks.map(w => `<div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:end">
                <div class="pc-field" style="margin:0"><label>Inicio</label><input type="date" data-w="${w.id}" data-f="start" value="${w.start}"></div>
                <div class="pc-field" style="margin:0"><label>Fin</label><input type="date" data-w="${w.id}" data-f="end" value="${w.end}"></div>
                <div class="pc-field" style="margin:0"><label>€</label><input type="number" step="1" data-w="${w.id}" data-f="budget" value="${w.budget}"></div>
                <button class="pc-btn pc-btn-ghost" data-delweek="${w.id}">×</button></div>`).join('')}
            <button class="pc-btn pc-btn-ghost" id="addWeek" style="margin-top:6px">＋ Añadir semana</button>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-primary" id="wkSave">Guardar</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        div.querySelector('#addWeek').onclick = () => {
            const last = weeks[weeks.length - 1];
            const start = last ? new Date(new Date(last.end).getTime() + 864e5) : new Date();
            const end = new Date(start.getTime() + 6 * 864e5);
            data().pcWeeks.push({ id: 'wk-' + Date.now(), label: 'Semana ' + (weeks.length + 1), start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), budget: 160 });
            App.saveData(); closeModal(); editWeeks();
        };
        div.querySelectorAll('[data-delweek]').forEach(b => b.onclick = () => {
            const id = b.getAttribute('data-delweek');
            data().pcWeeks = data().pcWeeks.filter(w => w.id !== id);
            App.saveData(); App.addHistory('presupuesto-comun', 'Semana eliminada (historial preservado)');
            closeModal(); render();
        });
        div.querySelector('#wkSave').onclick = () => {
            div.querySelectorAll('[data-w]').forEach(inp => {
                const w = data().pcWeeks.find(x => x.id === inp.getAttribute('data-w'));
                if (w) w[inp.getAttribute('data-f')] = inp.getAttribute('data-f') === 'budget' ? Number(inp.value) : inp.value;
            });
            App.saveData(); closeModal(); render(); App.showToast('Semanas actualizadas', 'success');
        };
    }

    // ===== render principal =====
    function render(c) {
        ensureContainer(c);
        if (!containerEl) return;
        closePop();
        containerEl.innerHTML = headerHtml() + kpisHtml() +
            `<div class="pc-cols2">${weeksPanelHtml()}${accountsPanelHtml()}</div>` +
            tableHtml() + movementsHtml();
        bind();
    }

    function bind() {
        const $ = sel => containerEl.querySelector(sel);
        $('#pcPeriod').onchange = e => { currentPeriod = e.target.value; render(); };
        $('#pcNewMov').onclick = () => openNewMovModal();
        $('#pcBtnCat').onclick = openNewCatModal;
        const trReal = $('#pcTrReal');
        if (trReal) trReal.oninput = e => {
            recon().realBalances[currentPeriod] = Number(e.target.value || 0);
            App.saveData();
            const panel = trReal.closest('.pc-panel'); const tmp = document.createElement('div'); tmp.innerHTML = accountsPanelHtml();
            panel.innerHTML = tmp.firstChild.innerHTML; bind();
        };
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
            App.showConfirm(`¿Eliminar el movimiento «${mv.concept || id}»?`, () => {
                data().expenses = data().expenses.filter(x => x.id !== id);
                App.saveData(); App.addHistory('presupuesto-comun', `Movimiento eliminado: ${mv.concept || id}`);
                render(); App.showToast('Movimiento eliminado', 'success');
            });
        });
    }

    // ===== API pública =====
    // FIX "pantalla en blanco": App.navigateTo() llama render(container) ANTES
    // que init(), por lo que el contenedor debe capturarse también en render().
    // Se toleran además las firmas antiguas init() / render() sin argumento.
    function ensureContainer(c) {
        if (c && typeof c.appendChild === 'function') {
            containerEl = c;
            return true;
        }
        if (!containerEl) containerEl = document.getElementById('sectionContainer');
        return !!containerEl;
    }
    function init(container) {
        if (ensureContainer(container) || !container) render();
    }
    function onThemeChange() { render(); }
    function openExpenseModal(expenseId) {
        const exp = (data().expenses || []).find(e => e.id === expenseId);
        if (exp) { openCatModal(exp.categoryId, String(exp.categoryId || '').startsWith('pcs-')); }
        else openNewMovModal();
    }
    function openCategoryModal(catId) { openCatModal(catId, String(catId || '').startsWith('pcs-')); }

    const api = {
        init, render, onThemeChange,
        openExpenseModal, openCategoryModal,
        // nuevos para el puente de App / otros módulos
        openMovementModal: openNewMovModal,
        quickEditRealSpend: (rowId, value) => { setRowReal(rowId, value); },
        addMovement
    };

    // Exposición explícita: los `const` de un <script> NO viven en window.
    // Sin esto, el bloque inline de index.html (App.registerModule) y otros
    // módulos no pueden referenciar BudgetApp de forma fiable.
    window.BudgetApp = api;

    if (typeof App !== 'undefined' && App && typeof App.registerSection === 'function') {
        App.registerSection('presupuesto-comun', api);
    } else {
        console.error('[presupuesto-comun] App no está disponible: registra el script de 0_app.js ANTES que este módulo.');
    }

    return api;
})();
