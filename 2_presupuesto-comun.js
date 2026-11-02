/* =============================================================
   PRESUPUESTO-COMUN.JS — v3
   Panel minimalista de tarjetas uniformes + Reconciliación
   Semanal de Trade Republic (Saldo Esperado vs Saldo Real).
   La estética CSS vive en index.html (clases pc-*).
   API pública preservada: render, init, onThemeChange,
   openExpenseModal, openCategoryModal.
   ============================================================= */
const BudgetApp = (function () {
    'use strict';

    // ===== estado y acceso a datos =====
    function data() { return App.data; }
    let currentPeriod = '2026-11';
    let selectedTile = null;
    let containerEl = null;

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
    // Gastos reales (excluye aportaciones de ahorro → sin doble contabilización)
    function pcRealExpenses() { return periodExpenses(currentPeriod).filter(e => e.status !== 'aportacion'); }
    function sum(list) { return list.reduce((s, e) => s + Number(e.amount || 0), 0); }

    // "Cuánto Llevo" por subcategoría = suma de gastos reales vinculados
    function subSpent(subId) { return sum(pcRealExpenses().filter(e => e.categoryId === subId)); }
    // Por categoría = sus propios gastos + los de sus subcategorías
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

    function fmt(n) { return App.formatCurrency(Number(n) || 0); }
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function chip(budget, spent) {
        if (budget === null || budget === undefined) return '<span class="pc-chip gray">No definido</span>';
        if (Number(budget) === 0) return `<span class="pc-chip red">Fijado 0,00 €${spent > 0 ? ' · gasto ' + fmt(spent) : ''}</span>`;
        const pct = (spent / budget) * 100;
        const cls = pct > 100 ? 'red' : pct >= 85 ? 'amber' : 'green';
        return `<span class="pc-chip ${cls}">${pct.toFixed(0)}%</span>`;
    }
    function bar(spent, budget) {
        if (!budget) return '<div class="pc-bar"><div class="ok" style="width:0%"></div></div>';
        const pct = Math.min((spent / budget) * 100, 100);
        const cls = spent > budget ? 'over' : pct >= 85 ? 'warn' : 'ok';
        return `<div class="pc-bar"><div class="${cls}" style="width:${pct}%"></div></div>`;
    }
    function tileMeta(catId) {
        switch (catId) {
            case 'pc-rent':      return { accent: '#6366f1', sub: 'MyInvestor · fijo mensual' };
            case 'pc-utilities': return { accent: '#f59e0b', sub: pcSubs('pc-utilities').length + ' suministros (Luz · Agua · Lowi)' };
            case 'pc-groceries': return { accent: '#10b981', sub: pcWeeks().length + ' semanas · ' + fmt(pcWeeks().reduce((s, w) => s + Number(w.budget || 0), 0)) + '/mes' };
            case 'pc-loans':     return { accent: '#ef4444', sub: pcLoans().map(l => `${l.name} ${l.paidInstallments}/${l.totalInstallments}`).join(' · ') || 'Sin préstamos' };
            case 'pc-savings':   return { accent: '#8b5cf6', sub: 'TradeRepublic · MyInvestor · Ahorro' };
            case 'pc-others':    return { accent: '#64748b', sub: 'Imprevistos y varios' };
            default:             return { accent: '#2563eb', sub: catId };
        }
    }

    // ===== KPIs =====
    function totals() {
        const cats = pcCats();
        const presupuesto = cats.reduce((s, c) => { const b = catBudget(c.id); return b === null ? s : s + b; }, 0);
        const gastos = sum(pcRealExpenses());
        return { presupuesto, gastos, restante: presupuesto - gastos, desviacion: gastos - presupuesto };
    }

    // =========================================================
    // RECONCILIACIÓN TRADE REPUBLIC
    // Saldo Esperado = Inicial − Σ presupuestos de semanas cerradas
    //                − Σ cuotas de préstamos marcados Pagado
    // Diferencia = Saldo Real − Saldo Esperado (verde + / rojo −)
    // =========================================================
    function expectedNow() {
        const r = recon();
        let exp = Number(r.initialBalance || 0);
        pcWeeks().forEach(w => { if (r.weeksClosed[w.id]) exp -= Number(w.budget || 0); });
        pcLoans().forEach(l => { if (r.loansPaid[l.id]) exp -= Number(l.amountPerInstallment || 0); });
        return exp;
    }

    function reconHtml() {
        const r = recon();
        const weeks = pcWeeks();
        const loans = pcLoans();
        const expected = expectedNow();
        const last = weeks[weeks.length - 1];
        const realRaw = last ? r.realBalances[last.id] : undefined;
        const hasReal = realRaw !== undefined && realRaw !== null && realRaw !== '';
        const diff = hasReal ? Number(realRaw) - expected : null;
        const diffCls = diff === null ? '' : diff >= 0 ? 'pc-diff-pos' : 'pc-diff-neg';
        const diffTxt = diff === null ? '—' : (diff >= 0 ? '+' : '−') + fmt(Math.abs(diff));
        const diffMsg = diff === null ? 'Introduce el saldo real para calcular el descuadre'
            : diff >= 0 ? 'Has gastado menos de lo presupuestado 🎉'
            : 'Descuadre negativo: has gastado más de lo esperado';

        return `
        <div class="pc-recon" id="pcRecon">
            <div class="pc-recon-head">
                <div class="pc-recon-title">📊 Reconciliación Semanal · Trade Republic</div>
                <span class="pc-chip gray">Inicial − semanas cerradas − préstamos pagados</span>
            </div>
            <div class="pc-recon-grid">
                <div class="pc-recon-box">
                    <label>Saldo Inicial TR (mes)</label>
                    <input type="number" step="0.01" class="pc-inline-input" id="reconInitial" value="${Number(r.initialBalance || 0).toFixed(2)}">
                </div>
                <div class="pc-recon-box">
                    <label>Saldo Teórico Esperado</label>
                    <div class="pc-recon-val" id="reconExpected">${fmt(expected)}</div>
                    <div class="pc-kpi-sub">${weeks.filter(w => r.weeksClosed[w.id]).length}/${weeks.length} sem. cerradas · ${loans.filter(l => r.loansPaid[l.id]).length} préstamo(s) pagado(s)</div>
                </div>
                <div class="pc-recon-box">
                    <label>Saldo Real en Trade Republic (€)</label>
                    <input type="number" step="0.01" class="pc-inline-input" id="reconReal" placeholder="Ej. 627,17" value="${hasReal ? Number(realRaw).toFixed(2) : ''}">
                    <div class="pc-kpi-sub">Al cierre de ${last ? esc(last.label) : '—'}</div>
                </div>
                <div class="pc-recon-box">
                    <label>Diferencia (Real − Esperado)</label>
                    <div class="pc-recon-val ${diffCls}" id="reconDiff">${diffTxt}</div>
                    <div class="pc-kpi-sub" id="reconMsg">${esc(diffMsg)}</div>
                </div>
            </div>

            <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;">Semanas transcurridas (marcar al cerrar cada semana)</div>
            <div class="pc-week-checks" style="margin-bottom:12px;">
                ${weeks.map(w => `
                    <label class="pc-wchk ${r.weeksClosed[w.id] ? 'on' : ''}">
                        <input type="checkbox" data-recon-week="${w.id}" ${r.weeksClosed[w.id] ? 'checked' : ''}>
                        ${esc(w.label)} · −${fmt(w.budget)}
                    </label>`).join('')}
            </div>

            <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;">Préstamos / fijos asignados a Trade Republic</div>
            ${loans.map(l => `
                <div class="pc-loan-row">
                    <div>
                        <div class="pc-sub-name">${esc(l.name)} <span class="pc-chip gray">${l.paidInstallments}/${l.totalInstallments}</span></div>
                        <div class="pc-sub-meta">Cuota ${fmt(l.amountPerInstallment)} · vence día ${l.dueDay || '—'}</div>
                    </div>
                    <div class="pc-skip"></div>
                    <div class="pc-skip" style="font-size:12px;color:var(--text-secondary);" data-loan-state="${l.id}">${r.loansPaid[l.id] ? '✓ Pagado' : 'Pendiente'}</div>
                    <label class="pc-toggle" title="Pagado / Pendiente">
                        <input type="checkbox" data-recon-loan="${l.id}" ${r.loansPaid[l.id] ? 'checked' : ''}>
                        <span class="pc-slider"></span>
                    </label>
                </div>`).join('')}
        </div>`;
    }

    function updateReconDiff() {
        const root = containerEl;
        const $ = sel => root.querySelector(sel);
        const weeks = pcWeeks(); const last = weeks[weeks.length - 1];
        const inp = $('#reconReal'); if (!inp || !last) return;
        const expected = expectedNow();
        $('#reconExpected').textContent = fmt(expected);
        const v = inp.value;
        const diffEl = $('#reconDiff'), msgEl = $('#reconMsg');
        if (v === '' || isNaN(parseFloat(v))) {
            diffEl.textContent = '—'; diffEl.className = 'pc-recon-val';
            msgEl.textContent = 'Introduce el saldo real para calcular el descuadre';
            return;
        }
        const d = parseFloat(v) - expected;
        diffEl.textContent = (d >= 0 ? '+' : '−') + fmt(Math.abs(d));
        diffEl.className = 'pc-recon-val ' + (d >= 0 ? 'pc-diff-pos' : 'pc-diff-neg');
        msgEl.textContent = d >= 0 ? 'Has gastado menos de lo presupuestado 🎉' : 'Descuadre negativo: has gastado más de lo esperado';
    }

    function bindRecon() {
        const root = containerEl;
        const $ = sel => root.querySelector(sel);
        const refresh = () => { App.saveData(); renderDashboardOnly(); };

        $('#reconInitial')?.addEventListener('change', e => { recon().initialBalance = parseFloat(e.target.value) || 0; refresh(); });
        $('#reconReal')?.addEventListener('input', e => {
            const weeks = pcWeeks(); const last = weeks[weeks.length - 1];
            if (!last) return;
            const v = e.target.value;
            if (v === '') delete recon().realBalances[last.id]; else recon().realBalances[last.id] = parseFloat(v);
            App.saveData();
            updateReconDiff(); // tiempo real, sin re-render completo
        });
        root.querySelectorAll('[data-recon-week]').forEach(cb => cb.addEventListener('change', () => {
            if (cb.checked) recon().weeksClosed[cb.dataset.reconWeek] = true;
            else delete recon().weeksClosed[cb.dataset.reconWeek];
            refresh();
        }));
        root.querySelectorAll('[data-recon-loan]').forEach(cb => cb.addEventListener('change', () => {
            const id = cb.dataset.reconLoan;
            if (cb.checked) recon().loansPaid[id] = true; else delete recon().loansPaid[id];
            const st = root.querySelector(`[data-loan-state="${id}"]`);
            if (st) st.textContent = cb.checked ? '✓ Pagado' : 'Pendiente';
            App.addHistory('tr_loan_toggle', `Préstamo TR ${cb.checked ? 'marcado PAGADO' : 'marcado PENDIENTE'}: ${id}`);
            updateReconDiff();
            App.saveData();
        }));
    }

    // =========================================================
    // RENDER DEL DASHBOARD
    // =========================================================
    function kpisHtml() {
        const t = totals();
        const inc = pcIncomes();
        const totInc = inc.reduce((s, i) => s + Number(i.salary || 0), 0);
        return `
        <div class="pc-kpis">
            <div class="pc-kpi"><div class="pc-kpi-label">💶 Saldo Restante Total</div>
                <div class="pc-kpi-value" style="color:${t.restante >= 0 ? '#10b981' : '#ef4444'}">${fmt(t.restante)}</div>
                <div class="pc-kpi-sub">Presupuesto ${fmt(t.presupuesto)} − Gastos ${fmt(t.gastos)}</div></div>
            <div class="pc-kpi"><div class="pc-kpi-label">📥 Ingresos Totales</div>
                <div class="pc-kpi-value">${fmt(totInc)}</div>
                <div class="pc-kpi-sub">${inc.map(i => `${esc(i.name)} ${totInc ? ((i.salary / totInc) * 100).toFixed(0) : 0}%`).join(' · ')}</div></div>
            <div class="pc-kpi"><div class="pc-kpi-label">📤 Gastos Totales</div>
                <div class="pc-kpi-value">${fmt(t.gastos)}</div>
                <div class="pc-kpi-sub">Desviación: <span style="color:${t.desviacion > 0 ? '#ef4444' : '#10b981'};font-weight:700">${t.desviacion > 0 ? '+' : ''}${fmt(t.desviacion)}</span> ${t.desviacion > 0 ? '(sobrecoste)' : '(margen a favor)'}</div></div>
        </div>`;
    }

    function tilesHtml() {
        return `<div class="pc-grid">${pcCats().map(c => {
            const m = tileMeta(c.id), spent = catSpent(c.id), budget = catBudget(c.id);
            return `
            <div class="pc-tile ${selectedTile === c.id ? 'selected' : ''}" data-tile="${c.id}" style="--tile-accent:${m.accent}" tabindex="0" role="button" aria-pressed="${selectedTile === c.id}">
                <div class="pc-tile-head"><span class="pc-tile-icon">${c.icon}</span>${chip(budget, spent)}</div>
                <div class="pc-tile-name">${esc(c.name)}</div>
                <div class="pc-tile-sub">${esc(m.sub)}</div>
                ${bar(spent, budget)}
                <div class="pc-tile-amounts"><span class="pc-tile-spent">${fmt(spent)}</span><span class="pc-tile-limit">/ ${budget === null ? 'sin lím.' : fmt(budget)}</span></div>
            </div>`;
        }).join('')}</div>`;
    }

    function subRowHtml(s, accent) {
        const spent = subSpent(s.id);
        const isAport = s.destination !== undefined;
        return `
        <div class="pc-sub-row" style="--tile-accent:${accent}">
            <div class="pc-sub-icon">${s.icon || '•'}</div>
            <div>
                <div class="pc-sub-name">${esc(s.name)}</div>
                <div class="pc-sub-meta">${isAport ? 'Aportación (no computa como gasto)' : 'Cuánto llevo: ' + fmt(spent)}${s.account ? ' · ' + esc(s.account) : ''}</div>
                ${bar(spent, s.budget)}
            </div>
            <div class="pc-skip">${chip(s.budget ?? null, spent)}</div>
            <div class="pc-skip">
                <input type="number" min="0" step="0.01" placeholder="Presupuesto €" class="pc-inline-input" data-sub-budget="${s.id}" value="${s.budget ?? ''}">
            </div>
            <div class="pc-add-wrap">
                <input type="number" min="0" step="0.01" placeholder="Importe" class="pc-inline-input" data-sub-add-in="${s.id}">
                <button class="pc-add-btn" data-sub-add="${s.id}" title="Sumar a Cuánto Llevo">+</button>
            </div>
        </div>`;
    }

    function detailFor(catId) {
        if (!catId) return '<div class="pc-detail" id="pcDetail"></div>';
        const c = pcCats().find(x => x.id === catId);
        if (!c) return '<div class="pc-detail" id="pcDetail"></div>';
        const m = tileMeta(catId);
        let body = '';
        if (catId === 'pc-groceries') {
            body = `
            <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin:4px 0 8px;">Desglose semanal (rangos de fechas y presupuesto editables)</div>
            ${pcWeeks().map(w => `
                <div class="pc-sub-row" style="--tile-accent:${m.accent}">
                    <div class="pc-sub-icon">🗓️</div>
                    <div>
                        <div class="pc-sub-name">${esc(w.label)}</div>
                        <div class="pc-sub-meta" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:4px;">
                            <input type="date" class="pc-inline-input" style="width:auto" data-week-f="start" data-week-id="${w.id}" value="${w.start}">
                            <span>→</span>
                            <input type="date" class="pc-inline-input" style="width:auto" data-week-f="end" data-week-id="${w.id}" value="${w.end}">
                        </div>
                    </div>
                    <div class="pc-skip"></div>
                    <div class="pc-skip"><input type="number" min="0" step="1" class="pc-inline-input" data-week-f="budget" data-week-id="${w.id}" value="${w.budget}" placeholder="€/sem"></div>
                    <div class="pc-skip" style="font-size:12px;color:var(--text-secondary);text-align:right;">Presupuesto</div>
                </div>`).join('')}`;
        } else if (catId === 'pc-loans') {
            body = `
            <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin:4px 0 8px;">Cuotas · el toggle «Pagado» de la Reconciliación TR también descuenta del saldo esperado</div>
            ${pcLoans().map(l => `
                <div class="pc-sub-row" style="--tile-accent:${m.accent}">
                    <div class="pc-sub-icon">💳</div>
                    <div>
                        <div class="pc-sub-name">${esc(l.name)} <span class="pc-chip gray">${l.paidInstallments}/${l.totalInstallments}</span></div>
                        <div class="pc-sub-meta">Cuota ${fmt(l.amountPerInstallment)} · venc. día
                            <input type="number" min="1" max="31" class="pc-inline-input" style="width:64px;display:inline-block" data-loan-f="dueDay" data-loan-id="${l.id}" value="${l.dueDay || ''}">
                        </div>
                    </div>
                    <div class="pc-skip"></div>
                    <div class="pc-skip" style="font-size:12px;color:var(--text-secondary)">Restan ${l.totalInstallments - l.paidInstallments}</div>
                    <div class="pc-add-wrap"><button class="btn btn-sm" data-loan-pay="${l.id}">Pagar cuota</button></div>
                </div>`).join('')}`;
        } else if (catId === 'pc-rent') {
            body = `<div class="pc-sub-row" style="--tile-accent:${m.accent}">
                <div class="pc-sub-icon">🏠</div>
                <div>
                    <div class="pc-sub-name">Alquiler mensual</div>
                    <div class="pc-sub-meta">Desde MyInvestor · importe fijo · Cuánto llevo: ${fmt(catSpent('pc-rent'))}</div>
                    ${bar(catSpent('pc-rent'), c.budget)}
                </div>
                <div class="pc-skip">${chip(c.budget ?? null, catSpent('pc-rent'))}</div>
                <div class="pc-skip"><input type="number" min="0" step="1" class="pc-inline-input" data-cat-budget="pc-rent" value="${c.budget ?? ''}" placeholder="€/mes"></div>
                <div class="pc-add-wrap">
                    <input type="number" min="0" step="0.01" placeholder="Importe" class="pc-inline-input" data-cat-add-in="pc-rent">
                    <button class="pc-add-btn" data-cat-add="pc-rent">+</button>
                </div>
            </div>`;
        } else {
            const subs = pcSubs(catId);
            body = subs.length
                ? subs.map(s => subRowHtml(s, m.accent)).join('')
                : `<div class="pc-sub-row" style="--tile-accent:${m.accent}">
                    <div class="pc-sub-icon">${c.icon}</div>
                    <div>
                        <div class="pc-sub-name">${esc(c.name)}</div>
                        <div class="pc-sub-meta">Sin subcategorías · entrada directa de gasto acumulado · Cuánto llevo: ${fmt(catSpent(catId))}</div>
                        ${bar(catSpent(catId), c.budget)}
                    </div>
                    <div class="pc-skip">${chip(c.budget ?? null, catSpent(catId))}</div>
                    <div class="pc-skip"><input type="number" min="0" class="pc-inline-input" data-cat-budget="${catId}" value="${c.budget ?? ''}" placeholder="Presupuesto €"></div>
                    <div class="pc-add-wrap">
                        <input type="number" min="0" step="0.01" placeholder="Importe" class="pc-inline-input" data-cat-add-in="${catId}">
                        <button class="pc-add-btn" data-cat-add="${catId}">+</button>
                    </div>
                   </div>`;
            if (subs.length && catId !== 'pc-savings') {
                body += `<div style="display:flex;gap:8px;margin-top:10px;">
                    <input type="number" min="0" step="0.01" placeholder="Gasto directo a ${esc(c.name)} (sin subcategoría)" class="pc-inline-input" style="max-width:280px" data-cat-add-in="${catId}">
                    <button class="pc-add-btn" data-cat-add="${catId}" style="--tile-accent:${m.accent}">+</button>
                </div>`;
            }
        }
        return `
        <div class="pc-detail open" id="pcDetail">
            <div class="pc-detail-inner" style="border-left:4px solid ${m.accent}">
                <div class="pc-detail-head">
                    <div class="pc-detail-title">${c.icon} ${esc(c.name)} <span class="pc-chip gray">Detalle por categoría secundaria</span></div>
                    <button class="pc-close-btn" id="pcDetailClose" title="Cerrar">✕</button>
                </div>
                ${body}
            </div>
        </div>`;
    }

    function renderDashboardOnly() {
        if (!containerEl) return;
        const scroll = window.scrollY;
        containerEl.innerHTML = `
            <div class="pc-topbar">
                <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                    <select class="pc-inline-input" id="pcPeriod" style="width:auto;">
                        ${['2026-09','2026-10','2026-11','2026-12'].map(p => `<option value="${p}" ${p === currentPeriod ? 'selected' : ''}>${p}</option>`).join('')}
                    </select>
                    <span class="badge badge-info">Gastos de la pareja</span>
                </div>
                <div style="font-size:12px;color:var(--text-muted)">Pulsa una tarjeta para desplegar sus subcategorías</div>
            </div>
            ${kpisHtml()}
            ${tilesHtml()}
            ${detailFor(selectedTile)}
            ${reconHtml()}
        `;
        bindDash();
        window.scrollTo(0, scroll);
    }

    // Registro rápido de gasto acumulativo (entrada directa)
    function addExpense(catId, amount, name) {
        if (!(amount > 0)) { App.showToast('Introduce un importe mayor que 0', 'error'); return false; }
        const c = pcCats().find(x => x.id === catId);
        const sub = (data().pcSubcategories || []).find(s => s.id === catId);
        if (!data().expenses) data().expenses = [];
        data().expenses.push({
            id: App.generateId('exp'), date: new Date().toISOString().slice(0, 10), aggPeriod: currentPeriod,
            description: name || (sub ? sub.name : (c ? c.name : 'Gasto')),
            amount, categoryId: catId, rootCategoryId: sub ? sub.parentId : catId,
            status: 'pagado', payer: 'Conjunto', account: (sub && sub.account) || (c && c.account) || 'TradeRepublic'
        });
        App.saveData();
        App.addHistory('expense_added', `Gasto rápido: ${(name || c?.name || sub?.name || catId)} ${fmt(amount)}`);
        return true;
    }

    function bindDash() {
        const root = containerEl;
        root.querySelector('#pcPeriod')?.addEventListener('change', e => { currentPeriod = e.target.value; renderDashboardOnly(); });

        // Drill-down: clic en tarjeta → panel de subcategorías (transición CSS)
        root.querySelectorAll('[data-tile]').forEach(t => {
            const toggle = () => {
                selectedTile = selectedTile === t.dataset.tile ? null : t.dataset.tile;
                renderDashboardOnly();
                if (selectedTile) document.getElementById('pcDetail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            };
            t.addEventListener('click', toggle);
            t.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
        });
        root.querySelector('#pcDetailClose')?.addEventListener('click', () => { selectedTile = null; renderDashboardOnly(); });

        // [+] entrada directa sobre subcategorías
        root.querySelectorAll('[data-sub-add]').forEach(btn => btn.addEventListener('click', () => {
            const id = btn.dataset.subAdd;
            const inp = root.querySelector(`[data-sub-add-in="${id}"]`);
            const sub = (data().pcSubcategories || []).find(s => s.id === id);
            if (addExpense(id, parseFloat(inp.value), sub ? sub.name : id)) renderDashboardOnly();
        }));
        // Presupuesto inline de subcategoría (null = no definido, 0 = fijado en 0)
        root.querySelectorAll('[data-sub-budget]').forEach(inp => inp.addEventListener('change', () => {
            const sub = (data().pcSubcategories || []).find(s => s.id === inp.dataset.subBudget);
            if (!sub) return;
            sub.budget = inp.value === '' ? null : parseFloat(inp.value) || 0;
            App.saveData(); renderDashboardOnly();
        }));
        // Categoría simple (Renta, Others…)
        root.querySelectorAll('[data-cat-add]').forEach(btn => btn.addEventListener('click', () => {
            const id = btn.dataset.catAdd;
            const inp = root.querySelector(`[data-cat-add-in="${id}"]`);
            if (addExpense(id, parseFloat(inp.value))) renderDashboardOnly();
        }));
        root.querySelectorAll('[data-cat-budget]').forEach(inp => inp.addEventListener('change', () => {
            const c = pcCats().find(x => x.id === inp.dataset.catBudget);
            if (!c) return;
            c.budget = inp.value === '' ? null : parseFloat(inp.value) || 0;
            App.saveData(); renderDashboardOnly();
        }));
        // Semanas: fechas y presupuesto editables
        root.querySelectorAll('[data-week-f]').forEach(inp => inp.addEventListener('change', () => {
            const w = (data().pcWeeks || []).find(x => x.id === inp.dataset.weekId);
            if (!w) return;
            const f = inp.dataset.weekF;
            w[f] = f === 'budget' ? (parseFloat(inp.value) || 0) : inp.value;
            App.saveData(); renderDashboardOnly();
        }));
        // Préstamos: día de vencimiento y pago de cuota
        root.querySelectorAll('[data-loan-f]').forEach(inp => inp.addEventListener('change', () => {
            const l = pcLoans().find(x => x.id === inp.dataset.loanId);
            if (!l) return;
            l[inp.dataset.loanF] = parseInt(inp.value) || null;
            App.saveData(); renderDashboardOnly();
        }));
        root.querySelectorAll('[data-loan-pay]').forEach(btn => btn.addEventListener('click', () => {
            const l = pcLoans().find(x => x.id === btn.dataset.loanPay);
            if (!l || l.paidInstallments >= l.totalInstallments) return;
            l.paidInstallments++;
            addExpense('pc-loans', Number(l.amountPerInstallment), `Cuota ${l.name} ${l.paidInstallments}/${l.totalInstallments}`);
            if (l.paidInstallments >= l.totalInstallments) { l.status = 'paid-off'; App.addHistory('loan_finished', `${l.name} liquidado (${l.totalInstallments}/${l.totalInstallments})`); }
            App.saveData(); renderDashboardOnly();
        }));

        bindRecon();
    }

    // =========================================================
    // API LEGADA PRESERVADA (otros módulos llaman vía App.goTo)
    // =========================================================
    function openExpenseModal(expenseId) {
        const exp = expenseId ? (data().expenses || []).find(e => e.id === expenseId) : null;
        if (exp && exp.rootCategoryId) selectedTile = exp.rootCategoryId;
        else if (exp) selectedTile = exp.categoryId;
        if (containerEl) renderDashboardOnly();
        App.showToast(exp ? `Gasto «${exp.description}» cargado en el panel: edítalo con [+] o desde su tarjeta.` : 'Usa los campos [+] de cada tarjeta para registrar gasto acumulado.', 'info');
    }
    function openCategoryModal(catId) {
        const c = pcCats().find(x => x.id === catId);
        if (c) { selectedTile = catId; if (containerEl) renderDashboardOnly(); }
    }

    // =========================================================
    // RENDER / INIT
    // =========================================================
    function render(container) {
        containerEl = container;
        renderDashboardOnly();
    }
    function init() { /* el estado vive en App.data (localStorage) */ }
    function onThemeChange() { renderDashboardOnly(); }

    return { render, init, onThemeChange, openExpenseModal, openCategoryModal };
})();

// Registrar sección
App.registerSection('presupuesto-comun', {
    render: (container) => BudgetApp.render(container),
    init: () => BudgetApp.init(),
    onThemeChange: () => BudgetApp.onThemeChange()
});

window.BudgetApp = BudgetApp;
