/* =============================================================================
   PRESUPUESTO-COMUN.JS · v24 — Lógica de reparto y lectura robusta
   ============================================================================= */
const BudgetApp = (function () {
    'use strict';

    const FIRST_MONTH = '2026-11'; 
    function data() { return App.data; }
    
    const _now = new Date();
    let currentPeriod = '2026-11'; 
    if (`${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}` > '2026-11') {
        currentPeriod = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`;
    }
    
    let containerEl = null;

    function focusInput(inp) {
        if (!inp) return;
        requestAnimationFrame(() => { inp.focus(); inp.select(); });
    }

    function shortDate(iso) { 
        if (!iso) return '—'; 
        const clean = String(iso).slice(0, 10);
        const d = new Date(clean + 'T00:00:00'); 
        return isNaN(d) ? '—' : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }); 
    }

    function getAccounts() { return (window.App && typeof App.getAccounts === 'function') ? App.getAccounts() : (data().accounts || []); }
    function getAccountNames() { return getAccounts().map(a => a.name); }
    function pcLoans() { return (window.App && typeof App.getLoans === 'function') ? App.getLoans() : []; }
    
    function mapAccountName(name) {
        if (!name) return null;
        const accounts = getAccounts();
        const target = String(name).toLowerCase().trim().replace(/\s+/g, ' ');
        if (!target) return null;
        let acc = accounts.find(a => String(a.name || '').toLowerCase().trim().replace(/\s+/g, ' ') === target);
        if (acc) return acc.id;
        acc = accounts.find(a => String(a.name || '').toLowerCase().trim().startsWith(target));
        if (acc) return acc.id;
        acc = accounts.find(a => target.startsWith(String(a.name || '').toLowerCase().trim()));
        if (acc) return acc.id;
        console.warn('[BudgetApp] mapAccountName: no match para "' + name + '", usando primera cuenta');
        return accounts[0]?.id || null;
    }

    // Detección robusta por nombre o ID
    function isGroceries(c) { 
        if (!c) return false; 
        const str = (String(c.id) + ' ' + String(c.name) + ' ' + String(c.label)).toLowerCase(); 
        return str.includes('groceries') || str.includes('leisure'); 
    }
    function isLoans(c) { 
        if (!c) return false; 
        const str = (String(c.id) + ' ' + String(c.name) + ' ' + String(c.label)).toLowerCase(); 
        return str.includes('préstamo') || str.includes('prestamo') || str.includes('loan'); 
    }

    function getHistoricalBudget(item, period) {
        if (item.createdAt && period < item.createdAt) return null;
        if (item.budgetHistory && item.budgetHistory[period] !== undefined) {
            return item.budgetHistory[period] === null ? null : Number(item.budgetHistory[period]);
        }
        const history = item.budgetHistory || {};
        const pastMonths = Object.keys(history).filter(m => m < period).sort().reverse();
        if (pastMonths.length > 0) {
            const val = history[pastMonths[0]];
            return val === null ? null : Number(val);
        }
        return (item.budget === null || item.budget === undefined) ? null : Number(item.budget);
    }

    /* =========================================================
       SEMANAS
       ========================================================= */
    function allWeeks()  { return (data().pcWeeks || []).slice().sort((a, b) => String(a.start).localeCompare(String(b.start))); }
    function weeksFor(period) { return allWeeks().filter(w => String(w.period) === period); }
    function weekCount(period) { return weeksFor(period).length; }

    function generateMonthWeeks(period, count, baseBudget) {
        const [y, m] = period.split('-').map(Number);
        let start = new Date(y, m - 1, 1);
        
        if (period === FIRST_MONTH) {
            start = new Date(y, m - 1, 2);
        } else {
            const prevWeeks = allWeeks().filter(w => String(w.period) < period);
            if (prevWeeks.length > 0) {
                const lastWeek = prevWeeks[prevWeeks.length - 1];
                start = new Date(String(lastWeek.end).slice(0, 10) + 'T00:00:00');
                start.setDate(start.getDate() + 1);
            }
        }

        const list = [];
        const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        for (let i = 0; i < count; i++) {
            const s = new Date(start); s.setDate(start.getDate() + (i * 7));
            const e = new Date(s);     e.setDate(s.getDate() + 6);
            list.push({ id: `wk-${period}-${i + 1}`, label: `Semana ${i + 1}`, start: iso(s), end: iso(e), budget: baseBudget || 0, period: period });
        }
        return list;
    }

    /* =========================================================
       CATEGORÍAS Y GASTOS
       ========================================================= */
    function pcCats()    { return (data().pcCategories || []).slice().sort((a, b) => (a.order || 99) - (b.order || 99)); }
    function pcSubs(pid) { return (data().pcSubcategories || []).filter(s => s.parentId === pid); }
    function pcWeeks()   { return weeksFor(currentPeriod); }

    function periodExpenses(period) {
        return (data().expenses || []).filter(e => {
            const p = e.aggPeriod || String(e.date || '').substring(0, 7);
            return p === period && e.status !== 'archivado' && e.status !== 'previsto';
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
    function findRow(id) {
        if (String(id).startsWith('pcs-')) return (data().pcSubcategories || []).find(s => s.id === id) || null;
        return pcCats().find(c => c.id === id) || null;
    }
    function subBudget(subId) {
        const s = (data().pcSubcategories || []).find(x => x.id === subId);
        return s ? getHistoricalBudget(s, currentPeriod) : null;
    }

    function catBudget(catId) {
        const c = pcCats().find(x => x.id === catId);
        if (!c) return null;

        if (isLoans(c)) {
            const active = pcLoans().filter(l => (l.paidCount || 0) < (l.installments || 0));
            const total = active.reduce((s, l) => s + Number(l.installmentAmount || 0), 0);
            return total > 0 ? total : null;
        }
        if (isGroceries(c)) {
            const w = pcWeeks().reduce((s, x) => s + Number(x.budget || 0), 0);
            // Si las semanas están a 0 pero la categoría tiene un presupuesto base (como 400€), lo usamos
            if (w === 0) return getHistoricalBudget(c, currentPeriod);
            return w;
        }
        if (String(c.id).includes('trip') || String(c.name).toLowerCase().includes('viaje')) {
            const total = (App.getTripCommitments ? App.getTripCommitments() : []).reduce((s, x) => s + Number(x.amount || 0), 0);
            return total > 0 ? total : null;
        }

        const subs = pcSubs(catId);
        if (subs.length) {
            let total = null;
            subs.forEach(s => { 
                const sb = subBudget(s.id);
                if (sb !== null && sb !== undefined) total = (total === null ? 0 : total) + Number(sb); 
            });
            return total;
        }
        return getHistoricalBudget(c, currentPeriod);
    }

    function catSpentDerived(catId) {
        const c = pcCats().find(x => x.id === catId);
        if (!c) return 0;
        if (isLoans(c)) return pcLoans().reduce((s, l) => s + (Number(l.paidCount) || 0) * (Number(l.installmentAmount) || 0), 0);
        const subs = pcSubs(catId);
        if (!subs.length) return catSpent(catId);
        return subs.reduce((s, sub) => s + subSpent(sub.id), 0);
    }

    function totalBudgetDefined() { return pcCats().reduce((s, c) => { const b = catBudget(c.id); return s + (b === null ? 0 : b); }, 0); }
    function totalRealSpent() { return sum(pcRealExpenses()); }
    function combinedRealBalance() { return getAccounts().reduce((s, a) => s + Number(a.balance || 0), 0); }

    function fmt(n) { return App.formatCurrency(Number(n) || 0); }
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function badge(text, cls) { return `<span class="pc-badge ${cls || 'pc-badge-gray'}">${text}</span>`; }
    function availCell(budget, spent) {
        if (budget === null || budget === undefined) return `<td class="pc-td-num">—</td>`;
        const avail = budget - spent;
        return `<td class="pc-td-num ${avail < 0 ? 'pc-neg' : (avail === 0 ? '' : 'pc-pos')}">${fmt(avail)}</td>`;
    }

    function computeTheoreticalBalance(accId) {
        const account = getAccounts().find(a => a.id === accId);
        if (!account) return 0;
        const accName = String(account.name || '').toLowerCase().trim();
        return pcCats().reduce((s, c) => {
            if (String(c.account || '').toLowerCase().trim() !== accName) return s;
            const b = catBudget(c.id);
            return s + (b === null ? 0 : b);
        }, 0);
    }

    function getGroceriesAccountId() {
        const groceries = pcCats().find(c => isGroceries(c));
        return groceries ? mapAccountName(groceries.account) : null;
    }

    /**
     * Suma de los presupuestos de todas las categorías vinculadas a una cuenta.
     * Sirve como "saldo teórico" inicial de esa cuenta.
     */
    function computeTheoreticalBalance(accId) {
        const account = getAccounts().find(a => a.id === accId);
        if (!account) return 0;
        const accName = String(account.name || '').toLowerCase().trim();
        return pcCats().reduce((s, c) => {
            if (String(c.account || '').toLowerCase().trim() !== accName) return s;
            const b = catBudget(c.id);
            return s + (b === null ? 0 : b);
        }, 0);
    }

    /** Suma los gastos reales de todas las categorías de la cuenta EXCEPTO Groceries */
    function sumOtherExpenses(accId) {
        const account = getAccounts().find(a => a.id === accId);
        if (!account) return 0;
        const accName = String(account.name || '').toLowerCase().trim();
        
        const otherCatIds = pcCats()
            .filter(c => String(c.account || '').toLowerCase().trim() === accName && !isGroceries(c))
            .map(c => c.id);
            
        return (data().expenses || [])
            .filter(e => otherCatIds.includes(e.categoryId) && e.status !== 'archivado')
            .reduce((s, e) => s + Number(e.amount || 0), 0);
    }

    /** Suma el gasto real de la categoría Groceries para esta cuenta */
    function sumGroceriesExpenses(accId) {
        const account = getAccounts().find(a => a.id === accId);
        if (!account) return 0;
        const accName = String(account.name || '').toLowerCase().trim();
        
        const groceriesCat = pcCats().find(c => isGroceries(c) && String(c.account || '').toLowerCase().trim() === accName);
        if (!groceriesCat) return 0;
        
        return (data().expenses || [])
            .filter(e => e.categoryId === groceriesCat.id && e.status !== 'archivado')
            .reduce((s, e) => s + Number(e.amount || 0), 0);
    }

    /**
     * Sincroniza el gasto de Groceries basándose en la diferencia real de la cuenta.
     * Fórmula: Groceries = Teórico - Gastos Otros - Saldo Nuevo
     */
    function syncGroceriesWithAccount(accId, newBalance) {
        const gAccId = getGroceriesAccountId();
        if (!gAccId || accId !== gAccId) return; 
        const acc = getAccounts().find(a => a.id === accId);
        if (!acc) return;

        const theoretical = computeTheoreticalBalance(accId);
        const otherExp = sumOtherExpenses(accId);
        const targetGroceries = theoretical - otherExp - Number(newBalance);
        const currentGroceries = sumGroceriesExpenses(accId);
        
        const delta = targetGroceries - currentGroceries;
        
        if (Math.abs(delta) < 0.005) {
            console.log('[syncGroceries] delta ≈ 0, no hay cambios necesarios');
            return;
        }

        const today = new Date().toISOString().slice(0, 10);
        const weeks = pcWeeks();
        let targetWeek = weeks.find(w => today >= String(w.start).slice(0,10) && today <= String(w.end).slice(0,10));
        if (!targetWeek && weeks.length) {
            const past = weeks.filter(w => String(w.end).slice(0,10) < today);
            targetWeek = past.length ? past[past.length - 1] : weeks[0];
        }
        if (!targetWeek) return;

        const groceriesCat = pcCats().find(x => isGroceries(x));
        if (!groceriesCat) return;

        const existing = data().expenses.find(e => 
            e.pcWeekId === targetWeek.id && 
            e.categoryId === groceriesCat.id && 
            e.pcAuto === 'grocery-balance-sync'
        );

        if (existing) {
            existing.amount = Number(existing.amount) + delta;
            existing.date = today;
            if (Math.abs(existing.amount) < 0.005) {
                data().expenses = data().expenses.filter(e => e.id !== existing.id);
            }
            console.log('[syncGroceries] actualizado existente · nuevo amount=', existing.amount);
        } else {
            const id = 'pc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            data().expenses.push({
                id,
                concept: 'Ajuste Groceries por saldo',
                amount: delta,
                date: today,
                categoryId: groceriesCat.id,
                person: 'conjunto',
                status: 'registrado',
                aggPeriod: currentPeriod,
                pcWeekId: targetWeek.id,
                pcAuto: 'grocery-balance-sync'
            });
            console.log('[syncGroceries] creado movimiento nuevo · amount=', delta);
        }
        App.saveData();
    }

    // @deprecated · el flujo ahora pasa por App.registerExpenseMovement
    function syncAccountWithGroceries(amount) { /* no-op */ }

    /* =========================================================
       RENDER
       ========================================================= */
    function headerHtml() {
        const [cy, cm] = currentPeriod.split('-').map(Number);
        const dateObj = new Date(cy, cm - 1, 1);
        const capLabel = dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());

        return `<div class="pc-topbar-v5" style="margin-bottom: 20px;">
            <div class="pc-period-nav" style="display:flex; align-items:center; gap:16px; background:var(--bg-card); padding:6px 12px; border-radius:12px; border:1px solid var(--border); box-shadow:var(--shadow-sm)">
                <button class="btn btn-ghost btn-sm" id="pcPrevMonth" style="padding:4px 8px; font-size:16px;" ${currentPeriod === FIRST_MONTH ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>‹</button>
                <span style="font-weight:800; font-size:15px; width:150px; text-align:center;">${capLabel}</span>
                <button class="btn btn-ghost btn-sm" id="pcNextMonth" style="padding:4px 8px; font-size:16px;">›</button>
            </div>
        </div>`;
    }

    function kpisHtml() {
        const presup = totalBudgetDefined();
        const gastos = totalRealSpent();
        const disponible = presup - gastos;
        const saldos = combinedRealBalance();
        const desv = gastos - presup;

        return `<div class="pc-kpis-v4" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 20px;">
            <div class="pc-kpi-card" style="--kpi-accent:var(--primary)">
                <span class="pc-kpi-icon">🎯</span>
                <div class="pc-kpi-label">Presupuesto Total</div>
                <div class="pc-kpi-big">${fmt(presup)}</div>
                <div class="pc-kpi-note">Asignaciones de ${esc(App.formatPeriod(currentPeriod))}</div>
            </div>
            <div class="pc-kpi-card" style="--kpi-accent:${disponible >= 0 ? 'var(--success)' : 'var(--danger)'}">
                <span class="pc-kpi-icon">💶</span>
                <div class="pc-kpi-label">Dinero Disponible</div>
                <div class="pc-kpi-big ${disponible >= 0 ? 'pc-pos' : 'pc-neg'}">${fmt(disponible)}</div>
                <div class="pc-kpi-note">Desviación: <b class="pc-num ${desv <= 0 ? 'pc-pos' : 'pc-neg'}">${desv > 0 ? '+' : ''}${fmt(desv)}</b></div>
            </div>
            <div class="pc-kpi-card" style="--kpi-accent:#8b5cf6">
                <span class="pc-kpi-icon">🏦</span>
                <div class="pc-kpi-label">Saldo Real Cuentas</div>
                <div class="pc-kpi-big">${fmt(saldos)}</div>
                <div class="pc-kpi-note">Bancos y tarjetas combinados</div>
            </div>
        </div>`;
    }

    function weeksPanelHtml() {
        const weeks = pcWeeks();
        const total = weeks.reduce((s, w) => s + Number(w.budget || 0), 0);
        const wkExp = pcRealExpenses().filter(e => String(e.date || '').substring(0, 7) === currentPeriod);
        
        // Si las semanas están a 0, intentamos coger el presupuesto de la categoría y repartirlo
        const gCat = pcCats().find(c => isGroceries(c));
        if (total === 0 && gCat && gCat.budget > 0) {
            const perWeek = gCat.budget / weeks.length;
            weeks.forEach(w => { w.budget = perWeek; });
        }

        const rows = weeks.map(w => {
            const spent = sum(wkExp.filter(e => e.pcWeekId === w.id));
            const today = new Date().toISOString().slice(0, 10);
            const startClean = String(w.start).slice(0, 10);
            const endClean = String(w.end).slice(0, 10);
            
            let cls = '';
            if (today >= startClean && today <= endClean) cls = 'week-en-curso';
            else if (today > endClean) cls = 'week-pasada';

            const remaining = w.budget - spent;
            let spentColor = 'pc-pos';
            if (remaining < 0) spentColor = 'pc-neg';
            else if (remaining < w.budget * 0.2) spentColor = 'pc-warn';
            
            return `<div class="pc-week-row ${cls}" data-week="${w.id}">
                <div class="pc-week-name-col"><span>${esc(w.label)}</span></div>
                <div class="pc-week-date-col">${shortDate(w.start)} → ${shortDate(w.end)}</div>
                <div style="display:flex; align-items:center; gap:8px; justify-content:flex-end;">
                    <div class="pc-week-budget-col pc-num" onclick="BudgetApp.editWeekBudget('${w.id}', ${w.budget})" title="Editar presupuesto">${fmt(w.budget)}</div>
                    <button class="pc-tick-btn" onclick="BudgetApp.equalizeWeek('${w.id}')" title="Igualar gasto"><svg viewBox="0 0 16 16"><path d="M3.8 8.6 6.4 11.2 12.2 5.4"/></svg></button>
                </div>
                <div class="pc-week-spent-col pc-num ${spentColor}" onclick="BudgetApp.openWeekSpentModal('${w.id}')" title="Editar/Gestionar gasto">${fmt(spent)}</div>
            </div>`;
        }).join('');

        return `<div class="pc-panel pc-panel--accent" style="--panel-accent:#10b981; display: flex; flex-direction: column;">
            <div class="pc-panel-title" style="margin-bottom: 12px;">
                <span class="pc-dot"></span>
                <span>🛒 Groceries &amp; Leisure</span>
                <button class="btn btn-ghost btn-sm" onclick="BudgetApp.openWeekCountModal()" style="margin-left:auto; padding:2px 6px; font-size:14px;" title="Configurar semanas">⚙️</button>
                <span style="margin-left:8px;">${badge('Total ' + fmt(weeks.reduce((s, w) => s + Number(w.budget || 0), 0)), 'pc-badge-blue')}</span>
            </div>
            <div class="pc-week-list">
                <div class="pc-week-row pc-week-header">
                    <div class="pc-week-name-col">SEMANA</div>
                    <div class="pc-week-date-col">FECHAS</div>
                    <div class="pc-week-budget-col">PRESUPUESTO</div>
                    <div class="pc-week-spent-col" style="color:var(--text-muted); text-decoration:none;">GASTADO</div>
                </div>
                ${rows || '<div class="pc-empty">No hay semanas configuradas.</div>'}
            </div>
        </div>`;
    }

    function accountsPanelHtml() {
        const accounts = getAccounts();
        let html = accounts.map(a => {
            const realVal = Number(a.balance) || 0;
            const isImg = String(a.icon).startsWith('http') || String(a.icon).startsWith('data:');
            const iconHtml = isImg ? `<img src="${esc(a.icon)}" alt="">` : (a.icon || '🏦');

            return `<div class="pc-account-row">
                <div style="display:flex; align-items:center; cursor:pointer;" onclick="BudgetApp.openEditAccountModal('${a.id}')" title="Editar cuenta">
                    <div class="pc-account-icon">${iconHtml}</div>
                    <div><b>${esc(a.name)}</b><div class="pc-week-dates">Tipo: <b>${esc(a.type || 'conjunta')}</b></div></div>
                </div>
                <div style="text-align:right; cursor:pointer;" onclick="BudgetApp.openUpdateBalanceModal('${a.id}')" title="Actualizar saldo">
                    <div class="pc-num" style="font-size:15px;font-weight:800;color:var(--text)">${fmt(realVal)}</div>
                    <div style="font-size:11px;color:var(--text-muted);">Actualizar</div>
                </div>
            </div>`;
        }).join('');

        return `<div class="pc-panel pc-panel--accent" style="--panel-accent:#2563eb;">
            <div class="pc-panel-title" style="justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:8px;"><span class="pc-dot"></span> 🏦 Estado de Cuentas</div>
                <button class="btn btn-ghost btn-sm" onclick="BudgetApp.openNewAccountModal()" style="padding:2px 8px; font-size:11px; border:1px dashed var(--border);">＋ Añadir</button>
            </div>
            ${html || '<div class="pc-empty">Sin cuentas</div>'}
        </div>`;
    }

    function titleWithBar(icon, name, spent, budget, accent, opts) {
        const o = opts || {};
        const bpRaw = (budget === null || budget === undefined) ? null : (budget <= 0 ? 100 : (spent / budget) * 100);
        const bp = bpRaw === null ? 0 : Math.min(bpRaw, 100);
        const fillCol = bpRaw === null ? 'var(--border)' : bpRaw > 100 ? 'color-mix(in srgb, var(--pc-neg) 32%, transparent)' : `color-mix(in srgb, ${accent} 30%, transparent)`;
        const pctLabel = bpRaw === null ? '' : `${Math.round(bpRaw)}%`;
        const nameHtml = `<span class="pc-cat-name" ${o.editAttr ? `data-${o.editAttr}="${o.editId}"` : ''}>${esc(name)}</span>`;
        
        return `<span class="pc-title-bar" style="--fill:${bp}%;--fill-col:${fillCol}; border:none;">` +
            `<span class="pc-title-inner" style="padding:4px 8px; font-size:13px;">${icon} ${nameHtml}${o.suffixHtml || ''}</span>` +
            `<b class="pc-title-pct pc-num">${pctLabel}</b></span>`;
    }

    function tickBtn(rowId, budget, spent) {
        if (budget === null || budget === undefined) return '';
        const diff = budget - spent;
        const done = Math.abs(diff) < 0.005;
        return `<button class="pc-tick-btn ${done ? 'done' : ''}" data-tick="${rowId}"><svg viewBox="0 0 16 16"><path d="M3.8 8.6 6.4 11.2 12.2 5.4"/></svg></button>`;
    }

    function tableHtml() {
        const cats = pcCats();
        if (!cats.find(c => isLoans(c)) && pcLoans().length > 0) {
            cats.push({ id: 'pc-loans-virtual', name: 'Préstamos', icon: '🏦', order: 999, color: '#ef4444' });
        }

        let html = `<div class="pc-table-wrap" style="position:relative;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 18px; border-bottom:1px solid var(--border); background:var(--bg);">
                <h3 style="margin:0; font-size:14px; font-weight:800; color:var(--text);">Categorías</h3>
                <button class="btn btn-primary btn-sm" id="pcBtnCat" style="padding:4px 12px; font-size:12px;">＋ Nueva</button>
            </div>
            <table class="pc-table pc-table-compact"><thead><tr>
                <th>CATEGORÍA / SUBCATEGORÍA</th>
                <th class="pc-th-num">PRESUPUESTO</th><th class="pc-th-num">GASTO REAL</th>
                <th class="pc-th-num">DISPONIBLE</th></tr></thead><tbody>`;
        
        cats.forEach(c => {
            if (c.createdAt && currentPeriod < c.createdAt) return;
            
            const accentColor = c.color || c.accent || '#2563eb';
            const subs = pcSubs(c.id);
            const cb = catBudget(c.id), cs = rowSpent(c.id);
            
            html += `<tr class="pc-row-cat" data-moves="${c.id}" style="--cat-accent:${accentColor}">
                <td class="pc-td-cat">${tickBtn(c.id, cb, cs)}${titleWithBar(c.icon || '📁', (c.label||c.name).toUpperCase(), cs, cb, accentColor, { editAttr: 'editcat', editId: c.id })}</td>
                <td class="pc-td-num">${cb === null ? 'No definido' : fmt(cb)}</td>
                <td class="pc-td-num"><span class="pc-cell-edit" onclick="BudgetApp.openCatSpentModal('${c.id}')">${fmt(cs)}</span></td>
                <td class="pc-td-num">${availCell(cb, cs).replace(/^<td[^>]*>|<\/td>$/g, '')}</td></tr>`;
            
            subs.forEach(s => {
                if (s.createdAt && currentPeriod < s.createdAt) return;

                const sb = subBudget(s.id);
                const ss = subSpent(s.id);
                
                html += `<tr class="pc-row-sub" data-moves="${s.id}" style="--cat-accent:${accentColor}">
                    <td class="pc-td-cat">${tickBtn(s.id, sb, ss)}${titleWithBar(s.icon || '·', s.name, ss, sb, accentColor, { editAttr: 'editsub', editId: s.id, isSub: true })}</td>
                    <td class="pc-td-num">${sb === null ? 'No definido' : fmt(sb)}</td>
                    <td class="pc-td-num"><span class="pc-cell-edit" onclick="BudgetApp.openSubSpentModal('${s.id}')">${fmt(ss)}</span></td>
                    <td class="pc-td-num">${availCell(sb, ss).replace(/^<td[^>]*>|<\/td>$/g, '')}</td></tr>`;
            });

            if (isLoans(c)) {
                pcLoans().forEach(l => {
                    if ((l.paidCount || 0) >= (l.installments || 0)) return;
                    
                    const hasPaidThisMonth = (l.payments || []).some(p => String(p.date).startsWith(currentPeriod));
                    const loanSpent = hasPaidThisMonth ? l.installmentAmount : 0;
                    const loanBudget = l.installmentAmount;
                    
                    html += `<tr class="pc-row-sub" style="--cat-accent:${accentColor}">
                        <td class="pc-td-cat">
                            ${tickBtn(l.id, loanBudget, loanSpent)}
                            <div style="display:flex; align-items:center; gap:8px; font-weight:600; font-size:13px;">
                                <span>${l.emoji || '🏦'} ${esc(l.name)}</span>
                                <span style="font-size:11px;color:var(--text-muted);">(${l.paidCount || 0}/${l.installments || 0} cuotas)</span>
                            </div>
                        </td>
                        <td class="pc-td-num">${fmt(loanBudget)}</td>
                        <td class="pc-td-num"><span class="pc-cell-edit">${fmt(loanSpent)}</span></td>
                        <td class="pc-td-num">${availCell(loanBudget, loanSpent).replace(/^<td[^>]*>|<\/td>$/g, '')}</td>
                    </tr>`;
                });
            }
        });
        html += '</tbody></table></div>';
        return html;
    }

    /* =========================================================
       MODALES (Con lógica de focus y cierre exterior)
       ========================================================= */
    function closeModal() { const b = document.getElementById('pcBackdrop'); if (b) b.remove(); }

    function equalizeWeek(weekId) {
        const w = allWeeks().find(x => x.id === weekId);
        if (!w) return;
        const movs = pcRealExpenses().filter(e => e.pcWeekId === weekId);
        const spent = sum(movs);
        const diff = w.budget - spent;
        if (Math.abs(diff) < 0.005) return;
        addMovement('pc-groceries', diff, { concept: `Ajuste semana: ${w.label}`, pcWeekId: w.id, date: new Date().toISOString().slice(0, 10) });
    }

    function openWeekCountModal() {
        closeModal();
        const cur = weekCount(currentPeriod);
        const firstWeekBudget = pcWeeks().length ? pcWeeks()[0].budget : 0;
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>⚙️ Configurar Semanas</h3>
            <div class="pc-field"><label>Número de semanas</label>
                <select id="wcN">
                    <option value="4" ${cur===4?'selected':''}>4 semanas</option>
                    <option value="5" ${cur===5?'selected':''}>5 semanas</option>
                </select>
            </div>
            <div class="pc-field"><label>Presupuesto por semana (€)</label>
                <input id="wcB" type="number" step="0.01" value="${firstWeekBudget}">
            </div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="wcCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="wcSave">Aplicar</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        focusInput(div.querySelector('#wcB'));
        div.querySelector('#wcCancel').onclick = closeModal;
        div.querySelector('#wcSave').onclick = () => {
            const n = Number(div.querySelector('#wcN').value);
            const b = Number(div.querySelector('#wcB').value);
            const gen = generateMonthWeeks(currentPeriod, n, b);
            data().pcWeeks = allWeeks().filter(w => String(w.period) !== currentPeriod).concat(gen);
            App.saveData(); closeModal(); render();
        };
    }

    function openWeekSpentModal(weekId) {
        const w = allWeeks().find(x => x.id === weekId);
        if (!w) return;
        const movs = pcRealExpenses().filter(e => e.pcWeekId === weekId);
        const spent = sum(movs);
        
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>Gasto · ${w.label}</h3>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <span style="font-weight:800; font-size:24px; color:var(--text)">${fmt(spent)}</span>
            </div>
            
            <div class="pc-field"><label>Ajuste manual de gasto (€)</label><input id="wsVal" type="number" step="0.01" value="${spent.toFixed(2)}"></div>
            
            <div style="display:flex; gap:8px; margin-top:16px;">
                <button class="pc-btn pc-btn-ghost" id="wsList" style="flex:1;">Ver Movimientos</button>
                <button class="pc-btn pc-btn-primary" id="wsAdd" style="flex:1;">＋ Añadir Movimiento</button>
            </div>
            
            <div class="pc-modal-actions" style="margin-top:20px; border-top:1px solid var(--border); padding-top:16px;">
                <button class="pc-btn pc-btn-ghost" id="wsCancel">Cerrar</button>
                <button class="pc-btn pc-btn-primary" id="wsSave">Guardar Ajuste</button>
            </div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        const inp = div.querySelector('#wsVal'); focusInput(inp);
        
        div.querySelector('#wsCancel').onclick = closeModal;
        div.querySelector('#wsList').onclick = () => { closeModal(); openMovementsListModal('pc-groceries', weekId); };
        div.querySelector('#wsAdd').onclick = () => { closeModal(); openAddMovementModal('pc-groceries', weekId); };
        
        const save = () => {
            const newVal = Number(inp.value);
            const diff = newVal - spent;
            if (Math.abs(diff) > 0.005) addMovement('pc-groceries', diff, { concept: 'Ajuste manual semana', pcWeekId: weekId });
            closeModal(); render();
        };
        div.querySelector('#wsSave').onclick = save;
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    }

    function openCatSpentModal(catId) { openGenericSpentModal(catId, null); }
    function openSubSpentModal(subId) { openGenericSpentModal(subId, null); }

    function openGenericSpentModal(rowId, weekId) {
        const row = findRow(rowId);
        if (!row) return;
        const spent = weekId ? sum(pcRealExpenses().filter(e => e.pcWeekId === weekId)) : rowSpent(rowId);
        
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>Gasto · ${esc(row.name)}</h3>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <span style="font-weight:800; font-size:24px; color:var(--text)">${fmt(spent)}</span>
            </div>
            
            <div class="pc-field"><label>Ajuste manual de gasto (€)</label><input id="gsVal" type="number" step="0.01" value="${spent.toFixed(2)}"></div>
            
            <div style="display:flex; gap:8px; margin-top:16px;">
                <button class="pc-btn pc-btn-ghost" id="gsList" style="flex:1;">Ver Movimientos</button>
                <button class="pc-btn pc-btn-primary" id="gsAdd" style="flex:1;">＋ Añadir Movimiento</button>
            </div>
            
            <div class="pc-modal-actions" style="margin-top:20px; border-top:1px solid var(--border); padding-top:16px;">
                <button class="pc-btn pc-btn-ghost" id="gsCancel">Cerrar</button>
                <button class="pc-btn pc-btn-primary" id="gsSave">Guardar Ajuste</button>
            </div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        const inp = div.querySelector('#gsVal'); focusInput(inp);
        
        div.querySelector('#gsCancel').onclick = closeModal;
        div.querySelector('#gsList').onclick = () => { closeModal(); openMovementsListModal(rowId); };
        div.querySelector('#gsAdd').onclick = () => { closeModal(); openAddMovementModal(rowId); };
        
        const save = () => {
            const newVal = Number(inp.value);
            const diff = newVal - spent;
            if (Math.abs(diff) > 0.005) addMovement(rowId, diff, { concept: 'Ajuste manual' });
            closeModal(); render();
        };
        div.querySelector('#gsSave').onclick = save;
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    }

    function openMovementsListModal(rowId, weekId) {
        const movs = pcRealExpenses().filter(e => {
            if (weekId) return e.pcWeekId === weekId;
            return e.categoryId === rowId;
        });
        const row = weekId ? allWeeks().find(x => x.id === weekId) : findRow(rowId);
        
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>Movimientos · ${esc(row ? row.name || row.label : '')}</h3>
            <div style="max-height:300px; overflow-y:auto; margin-top:16px;">
                ${movs.map(m => `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed var(--border-light); font-size:13px;">
                    <div>
                        <div style="font-weight:600;">${esc(m.concept)}</div>
                        <div style="font-size:11px; color:var(--text-muted);">${App.formatDate(m.date)}</div>
                    </div>
                    <b>${fmt(m.amount)}</b>
                </div>`).join('') || '<div style="color:var(--text-muted); text-align:center; padding:20px;">No hay movimientos</div>'}
            </div>
            <div class="pc-modal-actions" style="margin-top:20px;">
                <button class="pc-btn pc-btn-ghost" id="mlClose">Cerrar</button>
            </div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        div.querySelector('#mlClose').onclick = closeModal;
    }

    function openAddMovementModal(rowId, weekId) {
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>Nuevo Movimiento</h3>
            <div class="pc-field"><label>Descripción</label><input id="amDesc" placeholder="Ej. Compra supermercado"></div>
            <div class="pc-field"><label>Cantidad (€)</label><input id="amVal" type="number" step="0.01" value=""></div>
            <div class="pc-modal-actions">
                <button class="pc-btn pc-btn-ghost" id="amCancel">Cancelar</button>
                <button class="pc-btn pc-btn-primary" id="amSave">Añadir</button>
            </div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        focusInput(div.querySelector('#amDesc'));
        
        div.querySelector('#amCancel').onclick = closeModal;
        const save = () => {
            const desc = div.querySelector('#amDesc').value.trim() || 'Gasto';
            const val = Number(div.querySelector('#amVal').value);
            if (!val) return;
            closeModal();
            addMovement(rowId, val, { concept: desc, pcWeekId: weekId });
        };
        div.querySelector('#amSave').onclick = save;
        div.querySelector('#amVal').addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    }

/**
 * Añade un movimiento (gasto / ajuste) a una categoría o subcategoría del presupuesto.
 * Mantiene el saldo de la cuenta vinculada sincronizado con el signo correcto:
 *   · amount > 0  → gasto real → registerExpenseMovement (resta saldo)
 *   · amount < 0  → corrección a la baja → registerIncomeMovement (suma saldo)
 *
 * NO llama a syncGroceriesWithAccount (esa función es exclusiva del modal de
 * "Actualizar saldo" de la cuenta de Groceries). Si el usuario quiere sincronizar
 * gasto ↔ saldo en esa cuenta, debe pasar por ese modal.
 *
 * @param {string} targetId  ID de la categoría / subcategoría (pc-* o pcs-*)
 * @param {number} amount    Importe (positivo = gasto, negativo = corrección)
 * @param {object} opts      Opciones: concept, date, account, pcWeekId, link
 */
function addMovement(targetId, amount, opts) {
    opts = opts || {};
    const amt = Number(amount) || 0;
    if (Math.abs(amt) < 0.005) {
        console.warn('[addMovement] amount≈0, skip');
        return;
    }

    /* ── 1. Construir el objeto expense ─────────────────────────────── */
    const id = 'pc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const exp = {
        id,
        concept: opts.concept || 'Movimiento',
        amount: amt,
        date: opts.date || new Date().toISOString().slice(0, 10),
        categoryId: targetId,
        person: 'conjunto',
        status: 'registrado',
        aggPeriod: currentPeriod,
        pcAccount: opts.account || ''
    };
    if (opts.pcWeekId) exp.pcWeekId = opts.pcWeekId;
    if (opts.link) exp.link = opts.link;
    if (opts.pcAuto) exp.pcAuto = opts.pcAuto;

    data().expenses.push(exp);

    /* ── 2. Determinar cuenta destino ────────────────────────────────── */
    //   Prioridad: cuenta explícita en opts → cuenta de la categoría → cuenta de Groceries
    let accountId = mapAccountName(opts.account);
    if (!accountId) {
        const cat = findRow(targetId);
        if (cat) accountId = mapAccountName(cat.account);
    }
    if (!accountId && String(targetId).includes('groceries')) {
        accountId = getGroceriesAccountId();
    }

    /* ── 3. Registrar en el módulo Dinero con el signo correcto ──────── */
    //   · Gasto (amt > 0) → registerExpenseMovement → acc.balance -= amt
    //   · Corrección (amt < 0) → registerIncomeMovement → acc.balance += |amt|
    if (accountId && window.App) {
        try {
            if (amt > 0 && typeof App.registerExpenseMovement === 'function') {
                App.registerExpenseMovement({
                    amount: amt,
                    concept: exp.concept,
                    date: exp.date,
                    accountId,
                    link: { kind: 'expense', id: exp.id }
                });
            } else if (amt < 0 && typeof App.registerIncomeMovement === 'function') {
                App.registerIncomeMovement({
                    amount: Math.abs(amt),
                    concept: exp.concept,
                    date: exp.date,
                    accountId,
                    link: { kind: 'expense-adjustment', id: exp.id }
                });
            }
        } catch (err) {
            console.warn('[addMovement] fallo al registrar en Dinero:', err);
        }
    }

    /* ── 4. Persistir + historial + re-render ────────────────────────── */
    App.saveData();
    if (typeof App.addHistory === 'function') {
        App.addHistory('presupuesto-comun',
            `Movimiento: ${exp.concept} (${fmt(exp.amount)})${accountId ? ' · ' + accountId : ''}`);
    }
    render();
}

    function openEditAccountModal(accId) {
        const acc = getAccounts().find(a => a.id === accId);
        if (!acc) return;
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>Editar Cuenta</h3>
            <div class="pc-field"><label>Nombre</label><input id="eaName" value="${esc(acc.name)}"></div>
            <div class="pc-field"><label>Icono (Emoji o URL SVG)</label><input id="eaIcon" value="${esc(acc.icon || '')}"></div>
            <div class="pc-field"><label>Tipo</label>
                <select id="eaType">
                    <option value="conjunta" ${acc.type==='conjunta'?'selected':''}>Conjunta</option>
                    <option value="inversion" ${acc.type==='inversion'?'selected':''}>Inversión</option>
                    <option value="banco" ${acc.type==='banco'?'selected':''}>Banco</option>
                    <option value="efectivo" ${acc.type==='efectivo'?'selected':''}>Efectivo</option>
                </select>
            </div>
            <div class="pc-modal-actions">
                <button class="pc-btn pc-btn-danger" id="eaDel" style="margin-right:auto;">Eliminar</button>
                <button class="pc-btn pc-btn-ghost" id="eaCancel">Cancelar</button>
                <button class="pc-btn pc-btn-primary" id="eaSave">Guardar</button>
            </div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        focusInput(div.querySelector('#eaName'));
        
        div.querySelector('#eaCancel').onclick = closeModal;
        div.querySelector('#eaSave').onclick = () => {
            acc.name = div.querySelector('#eaName').value.trim() || acc.name;
            acc.icon = div.querySelector('#eaIcon').value.trim() || acc.icon;
            acc.type = div.querySelector('#eaType').value;
            App.saveData(); App.notifyModuleChange('presupuesto-comun', { reason: 'account-updated' });
            closeModal(); render();
        };
        div.querySelector('#eaDel').onclick = () => {
            App.showConfirm(`¿Eliminar la cuenta ${acc.name}?`, () => {
                data().accounts = data().accounts.filter(a => a.id !== acc.id);
                App.saveData(); closeModal(); render();
            });
        };
    }

    function openNewAccountModal() {
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>Nueva Cuenta</h3>
            <div class="pc-field"><label>Nombre</label><input id="naName" value=""></div>
            <div class="pc-field"><label>Icono (Emoji o URL SVG)</label><input id="naIcon" value="🏦"></div>
            <div class="pc-field"><label>Tipo</label>
                <select id="naType">
                    <option value="conjunta">Conjunta</option>
                    <option value="inversion">Inversión</option>
                    <option value="banco">Banco</option>
                    <option value="efectivo">Efectivo</option>
                </select>
            </div>
            <div class="pc-modal-actions">
                <button class="pc-btn pc-btn-ghost" id="naCancel">Cancelar</button>
                <button class="pc-btn pc-btn-primary" id="naSave">Crear</button>
            </div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        focusInput(div.querySelector('#naName'));
        
        div.querySelector('#naCancel').onclick = closeModal;
        div.querySelector('#naSave').onclick = () => {
            const name = div.querySelector('#naName').value.trim();
            if (!name) return;
            data().accounts.push({
                id: 'acc-' + Date.now().toString(36),
                name: name,
                icon: div.querySelector('#naIcon').value.trim() || '🏦',
                type: div.querySelector('#naType').value,
                balance: 0,
                owners: ['ana', 'carlos'],
                color: '#2563eb'
            });
            App.saveData(); closeModal(); render();
        };
    }

    function openUpdateBalanceModal(accId) {
        const acc = data().accounts.find(a => a.id === accId);
        if (!acc) return;
        const cur = Number(acc.balance) || 0;
        const gAccId = getGroceriesAccountId();
        const isGroceriesAccount = (accId === gAccId);
        const theoretical = computeTheoreticalBalance(accId);

        console.log('[openUpdateBalanceModal] acc=', acc.name, '(id=' + acc.id + ') · gAccId=', gAccId, '· isGroceries=', isGroceriesAccount);

        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>Actualizar Saldo · ${esc(acc.name)}</h3>
            <div class="pc-field"><label>Nuevo saldo en banco (€)</label>
                <input id="eaVal" type="number" step="0.01" value="${cur.toFixed(2)}"></div>
            ${isGroceriesAccount
                ? `<div style="font-size:11.5px;color:var(--text-muted);margin-bottom:8px;">
                       💡 Esta es la cuenta de Groceries. Al cambiar el saldo, la diferencia se suma al <strong>gastado de Groceries de la semana activa</strong>.
                   </div>
                   <div class="pc-field">
                       <button type="button" class="pc-btn pc-btn-ghost" id="eaTheoretical" style="width:100%;font-size:11.5px">
                           📐 Usar saldo teórico (suma de presupuestos): ${fmt(theoretical)}
                       </button>
                   </div>`
                : `<div style="font-size:11.5px;color:var(--text-muted);margin-bottom:8px;">
                       💡 El cambio solo ajusta el saldo real. Los gastos por categoría se registran aparte.
                   </div>`}
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="eaCancel">Cancelar</button>
                <button class="pc-btn pc-btn-primary" id="eaSave">Ajustar</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        const inp = div.querySelector('#eaVal'); focusInput(inp);

        const theoBtn = div.querySelector('#eaTheoretical');
        if (theoBtn) theoBtn.onclick = () => { inp.value = theoretical.toFixed(2); inp.focus(); inp.select(); };

        div.querySelector('#eaCancel').onclick = closeModal;
        const save = () => {
            const newVal = Number(inp.value) || 0;

            // 1) Si es la cuenta de Groceries → ajustar el gasto semanal ANTES de cambiar el saldo
            syncGroceriesWithAccount(acc.id, newVal);

            // 2) Fijar el saldo (sin registerExpenseMovement para evitar doble ajuste)
            const accToUpdate = data().accounts.find(a => a.id === acc.id);
            if (accToUpdate) accToUpdate.balance = newVal;

            App.saveData();
            if (window.App && typeof App.notifyModuleChange === 'function') {
                App.notifyModuleChange('presupuesto-comun', { reason: 'account-balance-updated', accountId: acc.id });
            }
            closeModal();
            render();
        };
        div.querySelector('#eaSave').onclick = save;
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    }

    function openWeekBudgetModal(weekId, currentBudget) {
        const w = allWeeks().find(x => x.id === weekId);
        if (!w) return;
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>Presupuesto · ${w.label}</h3>
            <div class="pc-field"><label>Presupuesto semanal (€)</label><input id="wbVal" type="number" step="0.01" value="${currentBudget}"></div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="wbCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="wbSave">Guardar</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        const inp = div.querySelector('#wbVal'); focusInput(inp);
        
        div.querySelector('#wbCancel').onclick = closeModal;
        const save = () => {
            w.budget = Number(inp.value) || 0;
            App.saveData(); closeModal(); render();
        };
        div.querySelector('#wbSave').onclick = save;
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    }

    function openCatModal(id, isSub) {
        const item = isSub ? (data().pcSubcategories || []).find(s => s.id === id) : pcCats().find(c => c.id === id);
        if (!item) return;
        if (isLoans(item) || (String(item.id).includes('trip') || String(item.name).toLowerCase().includes('viaje'))) { 
            App.showToast('Esta categoría se gestiona automáticamente', 'info'); 
            return; 
        }
        
        const subs = !isSub ? pcSubs(id) : [];
        closeModal();
        
        const derivedNote = (!isSub && subs.length) ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">📐 Calculado sumando las ${subs.length} subcategorías.</div>` : '';
        const currentBudget = getHistoricalBudget(item, currentPeriod);
        const budgetField = derivedNote ? '' : `<div class="pc-field"><label>Presupuesto desde ${currentPeriod} (€)</label><input id="mBudget" type="number" step="0.01" value="${currentBudget === null ? '' : currentBudget}"></div>`;
        
        const accOpts = getAccounts().map(a => `<option value="${esc(a.name)}" ${item.account === a.name ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
        const accField = `<div class="pc-field"><label>Cuenta vinculada</label><select id="mAcc">${accOpts}</select></div>`;

        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>${item.icon || '⚙️'} Editar ${isSub ? 'subcategoría' : 'categoría'}</h3>
            ${derivedNote}
            <div class="pc-field"><label>Nombre</label><input id="mName" value="${esc(item.name)}"></div>
            <div class="pc-field"><label>Icono</label><input id="mIcon" value="${esc(item.icon || '')}" maxlength="4"></div>
            ${budgetField}
            ${accField}
            <div style="display:flex; gap:8px; margin-top:16px;">
                <button class="pc-btn pc-btn-ghost" id="mList" style="flex:1;">Ver Movimientos</button>
                <button class="pc-btn pc-btn-primary" id="mAdd" style="flex:1;">＋ Añadir Movimiento</button>
            </div>
            <div class="pc-modal-actions" style="margin-top:16px; border-top:1px solid var(--border); padding-top:16px;">
                <button class="pc-btn pc-btn-danger" id="mDelete">🗑 Eliminar</button>
                <button class="pc-btn pc-btn-ghost" id="mCancel">Cancelar</button>
                <button class="pc-btn pc-btn-primary" id="mSave">Guardar</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        const inp = div.querySelector('#mBudget') || div.querySelector('#mName'); focusInput(inp);
        
        div.querySelector('#mCancel').onclick = closeModal;
        div.querySelector('#mList').onclick = () => { closeModal(); openMovementsListModal(item.id); };
        div.querySelector('#mAdd').onclick = () => { closeModal(); openAddMovementModal(item.id); };
        
        div.querySelector('#mSave').onclick = () => {
            item.name = div.querySelector('#mName').value.trim() || item.name;
            item.icon = div.querySelector('#mIcon').value.trim() || item.icon;
            item.account = div.querySelector('#mAcc').value;
            
            if (!derivedNote) {
                const bv = div.querySelector('#mBudget').value;
                const newBudget = bv === '' ? null : Number(bv);
                if (!item.budgetHistory) item.budgetHistory = {};
                item.budgetHistory[currentPeriod] = newBudget;
                item.budget = newBudget;
                
                if (isGroceries(item) && newBudget !== null) {
                    const weeks = pcWeeks();
                    if (weeks.length > 0) {
                        const perWeek = newBudget / weeks.length;
                        weeks.forEach(w => { 
                            const rw = allWeeks().find(x => x.id === w.id);
                            if (rw) rw.budget = perWeek;
                        });
                    }
                }
            }
            App.saveData(); closeModal(); render();
        };
        
        div.querySelector('#mDelete').onclick = () => {
            App.showConfirm(`¿Eliminar «${item.name}»?`, () => {
                if (isSub) data().pcSubcategories = data().pcSubcategories.filter(s => s.id !== item.id);
                else {
                    data().pcCategories = data().pcCategories.filter(c => c.id !== item.id);
                    data().pcSubcategories = (data().pcSubcategories || []).filter(s => s.parentId !== item.id);
                }
                App.saveData(); closeModal(); render();
            });
        };
    }

    function openNewCatModal() {
        closeModal();
        const parents = pcCats().map(c => `<option value="${c.id}">${c.icon} ${esc(c.name)}</option>`).join('');
        const accOpts = getAccounts().map(a => `<option value="${esc(a.name)}">${esc(a.name)}</option>`).join('');
        
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>🗂️ Nueva categoría</h3>
            <div class="pc-field"><label>Tipo</label><select id="cType"><option value="cat">Categoría principal</option><option value="sub">Subcategoría</option></select></div>
            <div class="pc-field" id="cParentWrap" style="display:none"><label>Categoría padre</label><select id="cParent">${parents}</select></div>
            <div class="pc-field"><label>Nombre</label><input id="cName" placeholder="Ej. Cenas fuera"></div>
            <div class="pc-field"><label>Icono (emoji)</label><input id="cIcon" value="📦" maxlength="4"></div>
            <div class="pc-field"><label>Presupuesto (€)</label><input id="cBudget" type="number" step="0.01"></div>
            <div class="pc-field"><label>Cuenta vinculada</label><select id="cAcc">${accOpts}</select></div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="cCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="cSave">Crear</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        focusInput(div.querySelector('#cName'));
        
        div.querySelector('#cCancel').onclick = closeModal;
        div.querySelector('#cType').onchange = e => { div.querySelector('#cParentWrap').style.display = e.target.value === 'sub' ? '' : 'none'; };
        div.querySelector('#cSave').onclick = () => {
            const name = div.querySelector('#cName').value.trim();
            if (!name) return;
            const isSub = div.querySelector('#cType').value === 'sub';
            const bv = div.querySelector('#cBudget').value;
            const initialBudget = bv ? Number(bv) : null;
            
            const obj = {
                id: (isSub ? 'pcs-' : 'pc-') + Date.now().toString(36),
                name, icon: div.querySelector('#cIcon').value.trim() || '📦',
                budget: initialBudget,
                account: div.querySelector('#cAcc').value,
                createdAt: currentPeriod,
                budgetHistory: initialBudget !== null ? { [currentPeriod]: initialBudget } : {}
            };
            if (isSub) { obj.parentId = div.querySelector('#cParent').value; data().pcSubcategories.push(obj); }
            else { obj.order = (pcCats().length + 1) * 10; data().pcCategories.push(obj); }
            App.saveData(); closeModal(); render();
        };
    }

    function render() {
        if (!containerEl) return;
        
        containerEl.innerHTML = headerHtml() + kpisHtml() +
            `<div class="pc-layout-grid">
                <div class="pc-col-left">
                    ${accountsPanelHtml()}
                    ${weeksPanelHtml()}
                </div>
                <div class="pc-col-right">
                    ${tableHtml()}
                </div>
            </div>`;
        bind();
    }

    function bind() {
        const $ = sel => containerEl.querySelector(sel);
        
        const btnPrev = $('#pcPrevMonth');
        if (btnPrev) {
            btnPrev.onclick = () => {
                if (currentPeriod <= FIRST_MONTH) return;
                let [y, m] = currentPeriod.split('-').map(Number);
                m--; if (m < 1) { m = 12; y--; }
                currentPeriod = `${y}-${String(m).padStart(2,'0')}`;
                render();
            };
        }
        
        $('#pcNextMonth').onclick = () => {
            let [y, m] = currentPeriod.split('-').map(Number);
            m++; if (m > 12) { m = 1; y++; }
            currentPeriod = `${y}-${String(m).padStart(2,'0')}`;
            render();
        };

        if ($('#pcBtnCat')) $('#pcBtnCat').onclick = openNewCatModal;

        containerEl.querySelectorAll('[data-tick]').forEach(btn => btn.onclick = e => {
            e.stopPropagation();
            const id = btn.getAttribute('data-tick');
            const isLoan = pcLoans().some(l => l.id === id);   // 🔥 lookup por ID, no por prefijo
            if (isLoan) {
                App.payLoanInstallment(id);
                render();
            } else {
                const row = findRow(id);
                if (!row) return;
                const budget = String(id).startsWith('pcs-') ? subBudget(id) : catBudget(id);
                const diff = budget - rowSpent(id);
                if (Math.abs(diff) > 0.005) addMovement(id, diff, { concept: 'Ajuste hasta presupuesto' });
            }
        });
        
        containerEl.querySelectorAll('[data-editcat]').forEach(el => el.onclick = e => { e.stopPropagation(); openCatModal(el.getAttribute('data-editcat'), false); });
        containerEl.querySelectorAll('[data-editsub]').forEach(el => el.onclick = e => { e.stopPropagation(); openCatModal(el.getAttribute('data-editsub'), true); });
    }

    return {
        init: (container) => {
            containerEl = container;
            const hasWeeks = allWeeks().some(w => String(w.period || '').slice(0, 7) === currentPeriod);
            if (!hasWeeks) {
                data().pcWeeks = allWeeks()
                    .filter(w => String(w.period || '').slice(0, 7) !== currentPeriod)
                    .concat(generateMonthWeeks(currentPeriod, 4, 0));
                App.saveData();
            }
        },
        render,
        addMovement,        // ← AÑADE ESTO
        getState: () => ({  // ← Y ESTO
            categories: data().pcCategories || [],
            subcategories: data().pcSubcategories || [],
            weeks: data().pcWeeks || [],
            expenses: data().expenses || [],
            currentPeriod
        }),
        openWeekCountModal,
        editWeekBudget: openWeekBudgetModal,
        openWeekSpentModal,
        openCatSpentModal,
        openSubSpentModal,
        equalizeWeek,
        openEditAccountModal,
        openNewAccountModal,
        openUpdateBalanceModal,
        openExpenseModal: () => {},
        getPcSummary: () => ({ period: currentPeriod, total: totalBudgetDefined() })
    };
})();
window.BudgetApp = BudgetApp;
if (window.App && typeof App.registerSection === 'function') App.registerSection('presupuesto-comun', BudgetApp);
