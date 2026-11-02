/* =============================================================
   PRESUPUESTO-COMUN.JS — v4
   Dashboard híbrido: KPIs, 2 columnas (semanas + cuentas),
   tabla acordeón con edición por clic (modal categoría y
   pop-up rápido de Gasto Real), movimientos + previsión de cierre,
   reconciliación Trade Republic (Esperado vs Real).
   Estilos en index.html (clases pc-*). API pública preservada.
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

    function pcCats()    { return (data().pcCategories || []).slice().sort((a, b) => (a.order || 99) - (b.order || 99)); }
    function pcSubs(pid) { return (data().pcSubcategories || []).filter(s => s.parentId === pid); }
    function pcWeeks()   { return (data().pcWeeks || []).slice().sort((a, b) => String(a.start).localeCompare(String(b.start))); }
    function pcLoans()   { return (data().pcLoans || []).filter(l => l.status !== 'archived'); }
    function pcIncomes() { return data().pcIncomes || []; }
    function recon() {
        if (!data().pcReconciliation) data().pcReconciliation = { initialBalance: 845.15, weeksClosed: {}, loansPaid: {}, realBalances: {} };
        if (!data().pcAccountTargets) data().pcAccountTargets = {};
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
    // Presupuesto: null = "no definido"; 0 = fijado en 0,00 €
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
        // saldo real combinado: busca la cuenta maestra por nombre (editable en Cuentas)
        const acc = (data().accounts || []).find(a => (a.name || '').toLowerCase().includes(accName.toLowerCase().split(' ')[0]));
        return acc ? Number(acc.balance || 0) : 0;
    }

    // ===== reconciliación Trade Republic =====
    function trExpected() {
        const r = recon();
        const closedWeeks = pcWeeks().filter(w => r.weeksClosed[w.id]).reduce((s, w) => s + Number(w.budget || 0), 0);
        const paidLoans = pcLoans().filter(l => r.loansPaid[l.id] || l.account === 'Trade Republic').reduce((s, l) => {
            if (r.loansPaid[l.id]) return s + Number(l.amountPerInstallment || 0);
            return s;
        }, 0);
        return Number(r.initialBalance || 0) - closedWeeks - paidLoans;
    }
    function trReal() { return Number(recon().realBalances[currentPeriod] || 0); }

    function fmt(n) { return App.formatCurrency(Number(n) || 0); }
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function shortDate(iso) { const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }); }
    function badge(text, cls) { return `<span class="pc-badge ${cls}">${text}</span>`; }
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
        return `<span class="pc-mini-bar"><span class="pc-mini-track"><span class="pc-mini-fill" style="width:${pct}%;background:${col}"></span></span>${badge(budget === null ? '—' : `${Math.round((spent / budget) * 100)}%`, budget === null ? 'pc-badge-gray' : spent > budget ? 'pc-badge-red' : (spent / budget) * 100 >= 85 ? 'pc-badge-amber' : 'pc-badge-green')}</span>`;
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
        data().expenses.push(exp);
        App.saveData();
        App.addHistory('presupuesto-comun', `${opts.action || 'Movimiento'}: ${exp.concept} (${fmt(exp.amount)})`);
        render();
        return id;
    }
    // Sobrescribe el acumulado de una fila ajustando un movimiento de relleno
    function setRowReal(rowId, newValue) {
        newValue = Number(newValue) || 0;
        const cur = rowId.startsWith('pcs-') ? subSpent(rowId) : catSpent(rowId);
        const diff = newValue - cur;
        if (Math.abs(diff) < 0.005) { App.showToast('Sin cambios', 'info'); return; }
        const fillers = data().expenses.filter(e => e.categoryId === rowId && e.pcAuto === 'ajuste');
        if (fillers.length === 1 && diff !== 0) {
            fillers[0].amount = newValue;
            App.saveData(); App.addHistory('presupuesto-comun', `Ajuste directo ${rowId}: ${fmt(newValue)}`); render(); return;
        }
        if (fillers.length === 1 && diff === 0) { fillers[0].status = 'archivado'; App.saveData(); render(); return; }
        addMovement(rowId, newValue, { concept: 'Ajuste de presupuesto', account: (pcCats().find(c => c.id === rowId) || pcSubs('').find(s => s.id === rowId) || {}).account || '', action: 'Ajuste' });
        // si se creó como filler, marcarlo
        const last = data().expenses[data().expenses.length - 1];
        if (last && last.concept === 'Ajuste de presupuesto') last.pcAuto = 'ajuste';
        App.saveData(); render();
    }

    // ===== render bloques =====
    function headerHtml() {
        const months = [...new Set((data().expenses || []).map(e => e.aggPeriod || String(e.date || '').substring(0, 7)))].sort();
        if (!months.includes(currentPeriod)) months.push(currentPeriod);
        const opts = months.map(m => `<option value="${m}" ${m === currentPeriod ? 'selected' : ''}>${App.formatPeriod ? App.formatPeriod(m) : m}</option>`).join('');
        return `<div class="page-header" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <div><h1>💍 Presupuesto común</h1><p class="subtitle">Dashboard financiero de la pareja · pantalla única</p></div>
            <div style="display:flex;gap:8px;align-items:center">
                <select id="pcPeriod" class="pc-inline-input" style="width:auto">${opts}</select>
                <button class="btn btn-primary" id="pcNewMov">＋ Nuevo movimiento</button>
            </div></div>`;
    }

    function kpisHtml() {
        const presup = totalBudgetDefined();
        const gastos = totalRealSpent();
        const disponible = presup - gastos;
        const saldos = accountRealBalance('Trade Republic') + accountRealBalance('MyInvestor') + accountRealBalance('conjunta');
        const pctGlob = presup ? Math.min((gastos / presup) * 100, 100) : 0;
        return `<div class="pc-kpis-v4">
            <div class="pc-kpi-card" style="--kpi-accent:#2563eb"><div class="pc-kpi-label">Presupuesto Total</div>
                <div class="pc-kpi-big">${fmt(presup)}</div><div class="pc-kpi-note">Asignaciones del periodo</div></div>
            <div class="pc-kpi-card" style="--kpi-accent:#f59e0b"><div class="pc-kpi-label">Gasto Ejecutado</div>
                <div class="pc-kpi-big">${fmt(gastos)}</div>
                <div class="pc-progress"><div style="width:${pctGlob}%;background:${pctGlob >= 85 ? '#ef4444' : '#f59e0b'}"></div></div>
                <div class="pc-kpi-note">${presup ? pctGlob.toFixed(0) : 0}% del presupuesto</div></div>
            <div class="pc-kpi-card" style="--kpi-accent:${disponible >= 0 ? '#10b981' : '#ef4444'}"><div class="pc-kpi-label">Dinero Disponible</div>
                <div class="pc-kpi-big" style="color:${disponible >= 0 ? '#10b981' : '#ef4444'}">${fmt(disponible)}</div>
                <div class="pc-kpi-note">Desviación: <b style="color:${gastos - presup > 0 ? '#ef4444' : '#10b981'}">${gastos - presup > 0 ? '+' : ''}${fmt(gastos - presup)}</b></div></div>
            <div class="pc-kpi-card" style="--kpi-accent:#8b5cf6"><div class="pc-kpi-label">Saldo Real Cuentas</div>
                <div class="pc-kpi-big">${fmt(saldos)}</div><div class="pc-kpi-note">TR + MyInvestor + Junta</div></div>
        </div>`;
    }

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
        return `<div class="pc-panel"><div class="pc-panel-title">🛒 Groceries & Liquor · distribución semanal
                <span style="margin-left:auto">${badge('Total ' + fmt(total), 'pc-badge-blue')}</span></div>
            <div class="pc-week-cards">${cards || '<div class="pc-kpi-note">Sin semanas definidas</div>'}</div>
            <div style="margin-top:10px"><button class="pc-btn pc-btn-ghost" data-act="editWeeks">✏️ Editar semanas</button></div></div>`;
    }

    function accountsPanelHtml() {
        const r = recon();
        const expected = trExpected();
        const real = trReal();
        const diff = real - expected;
        const rows = [
            { name: 'Trade Republic', icon: '📈', target: expected, realVal: real, key: 'tr' },
            { name: 'MyInvestor', icon: '🏦', target: Number(data().pcMyInvestorTarget || 950 + 175), realVal: accountRealBalance('MyInvestor'), key: 'mi' }
        ];
        const html = rows.map(a => {
            const d = a.realVal - a.target;
            return `<div class="pc-account-row">
                <div><b>${a.icon} ${esc(a.name)}</b><div class="pc-week-dates">Objetivo: ${fmt(a.target)}</div></div>
                <div style="text-align:right">
                    <div class="pc-num" style="font-weight:800">${fmt(a.realVal)}</div>
                    <div>${badge((d >= 0 ? '+' : '') + fmt(d), d >= 0 ? 'pc-badge-green' : 'pc-badge-red')}</div>
                </div></div>`;
        }).join('');
        return `<div class="pc-panel"><div class="pc-panel-title">🏦 Estado de Cuentas
                <span style="margin-left:auto">${badge('Sem. cerradas: ' + Object.values(r.weeksClosed).filter(Boolean).length + '/' + pcWeeks().length, 'pc-badge-gray')}</span></div>
            ${html}
            <div class="pc-field" style="margin-top:12px"><label>Saldo Real Trade Republic (€)</label>
                <input type="number" step="0.01" id="pcTrReal" class="pc-inline-input" value="${real || ''}" placeholder="Ej. 627,17"></div>
            <div class="pc-week-dates">Saldo esperado fin de semana: <b class="pc-num">${fmt(expected)}</b> · Desviación:
                <b style="color:${diff >= 0 ? '#10b981' : '#ef4444'}">${diff >= 0 ? '+' : ''}${fmt(diff)}</b> ${diff >= 0 ? '(gastaste menos de lo previsto)' : '(descuadre negativo)'}</div></div>`;
    }

    function tableHtml() {
        const cats = pcCats();
        let html = `<div class="pc-table-wrap"><table class="pc-table"><thead><tr>
            <th>Categoría / Subcategoría</th><th>Cuenta asociada</th><th>Presupuesto</th>
            <th>Gasto Real</th><th>Disponible</th><th>Consumo / Estado</th></tr></thead><tbody>`;
        cats.forEach(c => {
            const meta = CAT_META[c.id] || { accent: '#2563eb', label: c.name.toUpperCase() };
            const subs = pcSubs(c.id);
            const isOpen = !!openCats[c.id];
            const cb = catBudget(c.id), cs = catSpent(c.id);
            const avail = (cb === null ? null : cb - cs);
            html += `<tr class="pc-row-cat" data-toggle="${c.id}" style="--cat-accent:${meta.accent}">
                <td><span class="pc-caret ${isOpen ? 'open' : ''}">▶</span> ${c.icon} <span class="pc-cat-name" data-editcat="${c.id}" title="Clic para editar">${esc(meta.label)}</span></td>
                <td>${badge(esc(c.account || '—'), 'pc-badge-blue')}</td>
                <td>${cb === null ? '<span class="pc-text-muted">No definido</span>' : fmt(cb)}</td>
                <td><span class="pc-cell-edit" data-real="${c.id}" title="Clic para ajustar">${fmt(cs)}</span></td>
                <td style="color:${avail === null ? 'var(--text-muted)' : avail >= 0 ? '#10b981' : '#ef4444'}">${avail === null ? '—' : fmt(avail)}</td>
                <td>${miniBar(cs, cb, meta.accent)}</td></tr>`;
            if (isOpen) {
                subs.forEach(s => {
                    const sb = (s.budget === null || s.budget === undefined) ? null : Number(s.budget);
                    const ss = subSpent(s.id);
                    const sa = sb === null ? null : sb - ss;
                    html += `<tr class="pc-row-sub" style="--cat-accent:${meta.accent}">
                        <td>${s.icon || '·'} <span class="pc-cat-name" data-editsub="${s.id}" title="Clic para editar">${esc(s.name)}</span></td>
                        <td>${badge(esc(s.account || c.account || '—'), 'pc-badge-gray')}</td>
                        <td>${sb === null ? '<span class="pc-text-muted">No definido</span>' : fmt(sb)}</td>
                        <td><span class="pc-cell-edit" data-real="${s.id}" title="Clic para ajustar">${fmt(ss)}</span></td>
                        <td style="color:${sa === null ? 'var(--text-muted)' : sa >= 0 ? '#10b981' : '#ef4444'}">${sa === null ? '—' : fmt(sa)}</td>
                        <td>${miniBar(ss, sb, meta.accent)}</td></tr>`;
                });
                if (c.id === 'pc-loans') pcLoans().forEach(l => {
                    const paid = !!recon().loansPaid[l.id];
                    html += `<tr class="pc-row-sub" style="--cat-accent:${meta.accent}">
                        <td>💳 ${esc(l.name)} <span class="pc-num" style="color:var(--text-muted)">(${l.paidInstallments}/${l.totalInstallments})</span></td>
                        <td>${badge(esc(l.account || 'Trade Republic'), 'pc-badge-gray')}</td>
                        <td>${fmt(l.amountPerInstallment)}/cuota</td>
                        <td><span class="pc-cell-edit" data-real="pc-loans" title="Gasto acumulado de préstamos">${fmt(catSpent('pc-loans'))}</span></td>
                        <td>—</td>
                        <td><span class="pc-toggle"><input type="checkbox" data-loanpaid="${l.id}" ${paid ? 'checked' : ''}><span class="pc-slider"></span></span> ${badge(paid ? 'Pagado' : 'Pendiente', paid ? 'pc-badge-green' : 'pc-badge-amber')}</td></tr>`;
                });
                if (!subs.length && c.id !== 'pc-loans') {
                    html += `<tr class="pc-row-sub"><td colspan="6" style="text-align:left;color:var(--text-muted)">Sin subcategorías · añade una desde ⚙️</td></tr>`;
                }
            }
        });
        html += '</tbody></table></div>';
        return html;
    }

    function movementsHtml() {
        const movs = pcRealExpenses().slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);
        const presup = totalBudgetDefined(), ejec = totalRealSpent(), pend = pendingPayments();
        const rem = presup - ejec - pend;
        const rows = movs.map(m => {
            const cat = pcCats().find(c => c.id === m.categoryId) || (data().pcSubcategories || []).find(s => s.id === m.categoryId) || {};
            const acc = m.pcAccount || cat.account || '—';
            return `<div class="pc-mov-row">
                <div class="pc-mov-date">${shortDate(m.date)}</div>
                <div><b>${esc(m.concept)}</b><div class="pc-mov-date">${esc(cat.name || '')}</div></div>
                <div>${badge(esc(acc), 'pc-badge-gray')}</div>
                <div class="pc-mov-amt">${fmt(m.amount)}</div></div>`;
        }).join('') || '<div class="pc-kpi-note">Sin movimientos este periodo.</div>';
        return `<div class="pc-bottom">
            <div class="pc-panel"><div class="pc-panel-title">🕘 Últimos movimientos registrados
                <button class="pc-btn pc-btn-ghost" style="margin-left:auto" data-act="newMov">＋ Añadir</button></div>${rows}</div>
            <div class="pc-panel"><div class="pc-panel-title">🔮 Previsión de cierre del periodo</div>
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
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="mCancel">Cancelar</button>
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
    }

    function openQuickPop(anchorEl, rowId, currentValue) {
        closePop();
        popEl = document.createElement('div');
        popEl.className = 'pc-pop';
        popEl.innerHTML = `<div class="pc-kpi-label" style="margin-bottom:8px">Gasto Real (€)</div>
            <input type="number" step="0.01" id="qpVal" class="pc-inline-input" value="${Number(currentValue).toFixed(2)}">
            <div class="pc-modal-actions" style="margin-top:10px">
                <button class="pc-btn pc-btn-ghost" id="qpCancel">×</button>
                <button class="pc-btn pc-btn-primary" id="qpSave">Guardar</button></div>`;
        document.body.appendChild(popEl);
        const rect = anchorEl.getBoundingClientRect();
        popEl.style.left = Math.min(rect.left, window.innerWidth - 260) + 'px';
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

    function openNewMovModal() {
        const options = pcCats().map(c => `<option value="${c.id}">${c.icon} ${esc(c.name)}</option>`)
            .concat((data().pcSubcategories || []).map(s => `<option value="${s.id}">└ ${s.icon || '·'} ${esc(s.name)}</option>`)).join('');
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>📝 Nuevo movimiento</h3>
            <div class="pc-field"><label>Concepto</label><input id="nConcept" placeholder="Ej. Cena imprevista"></div>
            <div class="pc-field"><label>Categoría / Subcategoría</label><select id="nCat">${options}</select></div>
            <div class="pc-field"><label>Importe (€)</label><input id="nAmt" type="number" step="0.01" placeholder="0,00"></div>
            <div class="pc-field"><label>Fecha</label><input id="nDate" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
            <div class="pc-field"><label>¿Quién pagó?</label><select id="nWho"><option value="conjunto">Conjunto</option><option value="ana">Nena</option><option value="carlos">Bombón</option></select></div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="nCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="nSave">Registrar</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        div.querySelector('#nCancel').onclick = closeModal;
        div.querySelector('#nSave').onclick = () => {
            const amt = Number(div.querySelector('#nAmt').value);
            if (!amt || amt <= 0) { App.showToast('Importe no válido', 'error'); return; }
            addMovement(div.querySelector('#nCat').value, amt, {
                concept: div.querySelector('#nConcept').value.trim() || 'Movimiento',
                date: div.querySelector('#nDate').value, person: div.querySelector('#nWho').value
            });
            closeModal(); App.showToast('Movimiento registrado', 'success');
        };
    }

    // ===== render principal =====
    function render() {
        if (!containerEl) return;
        containerEl.innerHTML = headerHtml() + kpisHtml() +
            `<div class="pc-cols2">${weeksPanelHtml()}${accountsPanelHtml()}</div>` +
            tableHtml() + movementsHtml();
        bind();
    }

    function bind() {
        const $ = sel => containerEl.querySelector(sel);
        $('#pcPeriod').onchange = e => { currentPeriod = e.target.value; render(); };
        $('#pcNewMov').onclick = openNewMovModal;
        const trReal = $('#pcTrReal');
        if (trReal) trReal.oninput = e => { recon().realBalances[currentPeriod] = Number(e.target.value || 0); App.saveData();
            // refresco ligero del bloque de cuentas sin perder foco
            const panel = trReal.closest('.pc-panel'); const tmp = document.createElement('div'); tmp.innerHTML = accountsPanelHtml();
            panel.innerHTML = tmp.firstChild.innerHTML; bind(); };
        containerEl.querySelectorAll('[data-toggle]').forEach(tr => tr.onclick = e => {
            if (e.target.closest('[data-editcat]') || e.target.closest('[data-real]') || e.target.closest('[data-loanpaid]')) return;
            const id = tr.getAttribute('data-toggle'); openCats[id] = !openCats[id]; render();
        });
        containerEl.querySelectorAll('[data-editcat]').forEach(el => el.onclick = e => { e.stopPropagation(); openCatModal(el.getAttribute('data-editcat'), false); });
        containerEl.querySelectorAll('[data-editsub]').forEach(el => el.onclick = e => { e.stopPropagation(); openCatModal(el.getAttribute('data-editsub'), true); });
        containerEl.querySelectorAll('[data-real]').forEach(el => el.onclick = e => {
            e.stopPropagation();
            const id = el.getAttribute('data-real');
            const val = id.startsWith('pcs-') ? subSpent(id) : catSpent(id);
            openQuickPop(el, id, val);
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
    }

    function editWeeks() {
        const weeks = pcWeeks();
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal" style="width:min(520px,94vw)"><h3>🗓️ Semanas (Groceries & Leisure)</h3>
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
            closeModal(); editWeeks();
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

    // ===== API pública =====
    function init(container) { containerEl = container; render(); }
    function onThemeChange() { render(); }
    function openExpenseModal(expenseId) {
        const exp = (data().expenses || []).find(e => e.id === expenseId);
        if (exp) { openCatModal(exp.categoryId, String(exp.categoryId || '').startsWith('pcs-')); }
        else openNewMovModal();
    }
    function openCategoryModal(catId) { openCatModal(catId, String(catId || '').startsWith('pcs-')); }

    return { init, render, onThemeChange, openExpenseModal, openCategoryModal };
})();

App.registerSection('presupuesto-comun', BudgetApp);
