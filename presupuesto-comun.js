/* =============================================================================
   PRESUPUESTO-COMUN.JS · v9 — Interfaz mejorada, navegación y edición total
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
    
    // 1. Fecha dinámica
    const _now = new Date();
    let currentPeriod = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`;
    
    let containerEl = null;
    let popEl = null;
    let _pcBound = false;

    /* =========================================================
       ESTILOS (Inyectados para no ensuciar styles.css global)
       ========================================================= */
    function moduleCSS() { return `
        /* Lista de semanas */
        .pc-week-list { display: flex; flex-direction: column; width: 100%; }
        .pc-week-row { display: grid; grid-template-columns: 1.5fr 1.5fr 1fr 1fr; gap: 10px; padding: 10px 8px; border-bottom: 1px dashed var(--border-light); align-items: center; cursor: pointer; transition: background .15s; border-radius: 8px; }
        .pc-week-row:hover { background: var(--bg); }
        .pc-week-row:last-child { border-bottom: none; }
        .pc-week-header { font-size: 10.5px; font-weight: 800; color: var(--text-muted); letter-spacing: .5px; border-bottom: 1px solid var(--border); cursor: default; padding-bottom: 8px; }
        .pc-week-header:hover { background: transparent; }
        .pc-week-name-col { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; }
        .pc-week-date-col { font-size: 12px; color: var(--text-secondary); text-align: right; }
        .pc-week-budget-col { font-weight: 700; text-align: right; color: var(--text); }
        .pc-week-spent-col { font-weight: 800; text-align: right; color: var(--success); }
        
        /* 4. Colores fuertes para semanas pasadas */
        .pc-week-row.week-pasada { background: color-mix(in srgb, var(--success) 8%, var(--bg-card)); opacity: 0.85; border-left: 3px solid var(--success); }
        .pc-week-row.week-en-curso { background: color-mix(in srgb, var(--primary) 6%, var(--bg-card)); border-left: 3px solid var(--primary); }
        
        /* 5. Sangría para subcategorías */
        .pc-row-sub td:first-child { padding-left: 55px !important; }
        
        /* 10. Tooltips legibles */
        .pc-info-tip { z-index: 9999; white-space: normal; max-width: 250px; text-align: center; line-height: 1.4; font-size: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
        
        /* 3. Estilos Cuentas */
        .pc-account-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 10px; border-bottom: 1px dashed var(--border-light); cursor: pointer; border-radius: 8px; }
        .pc-account-row:hover { background: var(--bg); }
        .pc-account-icon { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: var(--bg-card); border: 1px solid var(--border); margin-right: 10px; }
        .pc-account-icon img { width: 18px; height: 18px; object-fit: contain; }
        
        /* 8. Préstamos idénticos a subcategorías */
        .pc-td-loan { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; border-radius: 8px; border: 1px solid color-mix(in srgb, #ef4444 22%, transparent); }
    `; }

    /* =========================================================
       ACCESO UNIFICADO Y HELPERS
       ========================================================= */
    function getAccounts() {
        return (window.App && typeof App.getAccounts === 'function') ? App.getAccounts() : (data().accounts || []);
    }
    function getAccountNames() {
        const accs = getAccounts().map(a => a.name);
        return accs.length ? accs : ['Trade Republic', 'MyInvestor', 'BBVA'];
    }
    function pcLoans() {
        return (window.App && typeof App.getLoans === 'function') ? App.getLoans() : [];
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
       SEMANAS (Punto 2)
       ========================================================= */
    function weeksFor(period) { 
        return allWeeks().filter(w => {
            const wp = w.period ? String(w.period) : String(w.start).substring(0, 7);
            return wp === period;
        }); 
    }
    
    function generateMonthWeeks(period, count) {
        const [y, m] = period.split('-').map(Number);
        const firstDayOfMonth = new Date(y, m - 1, 1);
        let start = new Date(firstDayOfMonth);
        
        // Buscar si hay semanas anteriores para enlazar
        const prevWeeks = allWeeks().filter(w => String(w.start).substring(0, 7) < period);
        if (prevWeeks.length > 0) {
            const lastWeek = prevWeeks[prevWeeks.length - 1];
            // La semana empieza el día siguiente al fin de la última semana
            start = new Date(lastWeek.end + 'T00:00:00');
            start.setDate(start.getDate() + 1);
        } else {
            // Si es el primer mes (ej. Noviembre), empezamos el día 1 (o el 2 según tu ejemplo)
            // start = new Date(y, m - 1, 2); // Descomenta si quieres empezar el día 2
        }

        const list = [];
        const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        for (let i = 0; i < count; i++) {
            const s = new Date(start); s.setDate(start.getDate() + (i * 7));
            const e = new Date(s);     e.setDate(s.getDate() + 6);
            list.push({ id: `wk-${period}-${i + 1}`, label: `Semana ${i + 1}`, start: iso(s), end: iso(e), budget: 0, period: period });
        }
        return list;
    }

    function allWeeks()  { return (data().pcWeeks || []).slice().sort((a, b) => String(a.start).localeCompare(String(b.start))); }
    function weekCount(period) { return weeksFor(period).length; }
    function defaultWeekBudget() {
        const c = pcCats().find(x => x.id === 'pc-groceries');
        return (c && c.budget !== null && c.budget !== undefined) ? Number(c.budget) : 0; 
    }

    /* =========================================================
       CATEGORÍAS Y GASTOS
       ========================================================= */
    function pcCats()    { return (data().pcCategories || []).slice().sort((a, b) => (a.order || 99) - (b.order || 99)); }
    function pcSubs(pid) { return (data().pcSubcategories || []).filter(s => s.parentId === pid); }
    function pcWeeks()   { return weeksFor(currentPeriod); }

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
    function findRow(id) {
        if (String(id).startsWith('pcs-')) return (data().pcSubcategories || []).find(s => s.id === id) || null;
        return pcCats().find(c => c.id === id) || null;
    }
    function subBudget(subId) {
        const s = (data().pcSubcategories || []).find(x => x.id === subId);
        return (s && s.budget !== null && s.budget !== undefined) ? Number(s.budget) : null;
    }

    function catBudget(catId) {
        const c = pcCats().find(x => x.id === catId);
        if (!c) return null;

        if (catId === 'pc-loans') {
            const active = pcLoans().filter(l => (l.paidCount || 0) < (l.installments || 0));
            const total = active.reduce((s, l) => s + Number(l.installmentAmount || 0), 0);
            return total > 0 ? total : null;
        }
        if (catId === 'pc-trips') {
            const tripComms = App.getTripCommitments ? App.getTripCommitments() : [];
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
        if (catId === 'pc-loans') return pcLoans().reduce((s, l) => s + (Number(l.paidCount) || 0) * (Number(l.installmentAmount) || 0), 0);
        const subs = pcSubs(catId);
        if (!subs.length) return catSpent(catId);
        return subs.reduce((s, sub) => s + subSpent(sub.id), 0);
    }

    function totalBudgetDefined() { return pcCats().reduce((s, c) => { const b = catBudget(c.id); return s + (b === null ? 0 : b); }, 0); }
    function totalRealSpent() { return sum(pcRealExpenses()); }
    function combinedRealBalance() { return getAccounts().reduce((s, a) => s + Number(a.balance || 0), 0); }

    function recon() {
        if (!data().pcReconciliation) data().pcReconciliation = { initialBalance: 0, weeksClosed: {}, loansPaid: {}, realBalances: {} };
        return data().pcReconciliation;
    }

    /* =========================================================
       UTILIDADES DE FORMATO
       ========================================================= */
    function fmt(n) { return App.formatCurrency(Number(n) || 0); }
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function shortDate(iso) { const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }); }
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
    function muted(txt) { return `<span style="color:var(--text-muted);font-size:12px">${txt}</span>`; }
    function availCls(v) { return v === null ? '' : v >= 0 ? 'pc-pos' : 'pc-neg'; }
    
    function availCell(budget, spent) {
        if (budget === null || budget === undefined) return `<td class="pc-td-num pc-avail-cell">—</td>`;
        const avail = budget - spent;
        const cls = avail < 0 ? 'pc-neg' : (avail === 0 ? '' : 'pc-pos');
        return `<td class="pc-td-num pc-avail-cell ${cls}">${fmt(avail)}</td>`;
    }

    /* =========================================================
       LÓGICA DE MOVIMIENTOS (AJUSTES)
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
                    amount: Math.abs(exp.amount), concept: exp.concept, date: exp.date, accountId: accId, link: movLink
                });
            } catch (err) { }
        }
        App.addHistory('presupuesto-comun', `${opts.action || 'Movimiento'}: ${exp.concept} (${fmt(exp.amount)})`);
        render();
        return id;
    }

    /* =========================================================
       RENDER: CABECERA Y KPIs (Puntos 1 y 6)
       ========================================================= */
    const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    
    function headerHtml() {
        const [cy, cm] = currentPeriod.split('-').map(Number);
        const dateObj = new Date(cy, cm - 1, 1);
        const mLabel = dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        const capLabel = mLabel.charAt(0).toUpperCase() + mLabel.slice(1);

        return `<div class="pc-topbar-v5" style="margin-bottom: 20px;">
            <div class="pc-period-nav" style="display:flex; align-items:center; gap:16px; background:var(--bg-card); padding:6px 12px; border-radius:12px; border:1px solid var(--border); box-shadow:var(--shadow-sm)">
                <button class="btn btn-ghost btn-sm" id="pcPrevMonth" style="padding:4px 8px; font-size:16px;">‹</button>
                <span style="font-weight:800; font-size:15px; min-width:130px; text-align:center;">${capLabel}</span>
                <button class="btn btn-ghost btn-sm" id="pcNextMonth" style="padding:4px 8px; font-size:16px;">›</button>
            </div>
        </div>`;
    }

    function kpisHtml() {
        const presup = totalBudgetDefined();
        const gastos = totalRealSpent();
        const disponible = presup - gastos;
        const saldos = combinedRealBalance();
        const pctGlob = presup ? Math.min((gastos / presup) * 100, 100) : 0;
        const desv = gastos - presup;

        // Punto 6: Quitamos "Aporte Común" y "Gasto Ejecutado"
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
                <div class="pc-kpi-big ${availCls(disponible)}">${fmt(disponible)}</div>
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

    /* =========================================================
       RENDER: SEMANAS (Puntos 4 y 5)
       ========================================================= */
    const WEEK_STATE_META = {
        'en-curso': { label: 'En curso', cls: 'week-en-curso', badge: 'pc-badge-blue' },
        'pasada':   { label: 'Pasada',   cls: 'week-pasada',    badge: 'pc-badge-green' },
        'vacia':    { label: 'Vacía',    cls: 'week-vacia',   badge: 'pc-badge-gray' }
    };

    function weekAutoState(w) {
        const today = new Date().toISOString().slice(0, 10);
        if (!(Number(w.budget) > 0)) return 'vacia';
        if (today >= String(w.start) && today <= String(w.end)) return 'en-curso';
        if (today > String(w.end)) return 'pasada';
        return 'vacia';
    }
    function weekState(w) {
        const auto = weekAutoState(w);
        const man = (recon().weekStates || {})[w.id];
        return (man && man !== 'vacia' && auto !== 'vacia') ? man : auto;
    }

    function weeksPanelHtml() {
        const weeks = pcWeeks();
        const total = weeks.reduce((s, w) => s + Number(w.budget || 0), 0);
        const wkExp = pcRealExpenses().filter(e => String(e.date || '').substring(0, 7) === currentPeriod);
        
        const rows = weeks.map(w => {
            const spent = sum(wkExp.filter(e => e.pcWeekId === w.id));
            const st = weekState(w);
            const meta = WEEK_STATE_META[st] || WEEK_STATE_META['vacia'];
            
            return `<div class="pc-week-row ${meta.cls}" data-week="${w.id}" title="Clic para editar">
                <div class="pc-week-name-col">
                    <span>${esc(w.label)}</span>
                    <span class="pc-badge ${meta.badge}" style="font-size:9.5px;padding:1px 6px">${meta.label}</span>
                </div>
                <div class="pc-week-date-col">${shortDate(w.start)} → ${shortDate(w.end)}</div>
                <div class="pc-week-budget-col pc-num">${fmt(w.budget)}</div>
                <div class="pc-week-spent-col pc-num ${spent > w.budget ? 'pc-neg' : ''}">${fmt(spent)}</div>
            </div>`;
        }).join('');

        return `<div class="pc-panel pc-panel--accent" style="--panel-accent:#10b981; display: flex; flex-direction: column; height: 100%;">
            <div class="pc-panel-title" style="margin-bottom: 12px;">
                <span class="pc-dot"></span>
                <span class="pc-gro-title" id="pcGroTitle" title="Clic para configurar las semanas">🛒 Groceries &amp; Leisure</span>
                <span style="margin-left:auto">${badge('Total ' + fmt(total), 'pc-badge-blue')}</span>
            </div>
            <div class="pc-week-list">
                <div class="pc-week-row pc-week-header">
                    <div class="pc-week-name-col">SEMANA</div>
                    <div class="pc-week-date-col">FECHAS</div>
                    <div class="pc-week-budget-col">PRESUPUESTO</div>
                    <div class="pc-week-spent-col">GASTADO</div>
                </div>
                ${rows || '<div class="pc-empty">Clic en el título para generar semanas</div>'}
            </div>
        </div>`;
    }

    /* =========================================================
       RENDER: ESTADO DE CUENTAS (Punto 3)
       ========================================================= */
    function accountsPanelHtml() {
        const accounts = getAccounts();
        if (!accounts.length) return '';

        const html = accounts.map(a => {
            const realVal = Number(a.balance) || 0;
            // El saldo teórico se puede calcular a partir de los ingresos/gastos fijos, por ahora mostramos el real
            const theoVal = realVal; 
            
            // Si el icono es una URL, lo pintamos como imagen, si no, como emoji
            const isImg = String(a.icon).startsWith('http') || String(a.icon).startsWith('data:');
            const iconHtml = isImg ? `<img src="${esc(a.icon)}" alt="">` : (a.icon || '🏦');

            return `<div class="pc-account-row">
                <div style="display:flex; align-items:center;" onclick="BudgetApp.openEditAccountModal('${a.id}')" title="Editar cuenta">
                    <div class="pc-account-icon">${iconHtml}</div>
                    <div>
                        <b>${esc(a.name)}</b>
                        <div class="pc-week-dates">Tipo: <b>${esc(a.type || 'conjunta')}</b></div>
                    </div>
                </div>
                <div style="text-align:right; cursor:pointer;" onclick="BudgetApp.openUpdateBalanceModal('${a.id}')" title="Actualizar saldo real">
                    <div class="pc-num" style="font-size:15px;font-weight:800;color:var(--text)">${fmt(theoVal)}</div>
                    <div style="font-size:11px;color:var(--text-muted);">Actualizar saldo</div>
                </div>
            </div>`;
        }).join('');

        return `<div class="pc-panel pc-panel--accent" style="--panel-accent:#2563eb; height: 100%;">
            <div class="pc-panel-title"><span class="pc-dot"></span> 🏦 Estado de Cuentas</div>
            ${html}
        </div>`;
    }

    /* =========================================================
       RENDER: TABLA DE CATEGORÍAS (Puntos 5, 7, 8 y 9)
       ========================================================= */
    function titleWithBar(icon, name, spent, budget, accent, opts) {
        const o = opts || {};
        const bpRaw = (budget === null || budget === undefined) ? null : (budget <= 0 ? 100 : (spent / budget) * 100);
        const bp = bpRaw === null ? 0 : Math.min(bpRaw, 100);
        const fillCol = bpRaw === null ? 'var(--border)' : bpRaw > 100 ? 'color-mix(in srgb, var(--pc-neg) 32%, transparent)' : `color-mix(in srgb, ${accent} 30%, transparent)`;
        const pctLabel = bpRaw === null ? '' : `${Math.round(bpRaw)}%`;
        const nameHtml = `<span class="pc-cat-name" ${o.editAttr ? `data-${o.editAttr}="${o.editId}"` : ''}>${esc(name)}</span>`;
        
        // Punto 9: Eliminamos el símbolo Σ de aquí
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
        
        let html = `<div class="pc-table-wrap" style="position:relative;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 18px; border-bottom:1px solid var(--border); background:var(--bg);">
                <h3 style="margin:0; font-size:14px; font-weight:800; color:var(--text);">Categorías de Gasto</h3>
                <button class="btn btn-primary btn-sm" id="pcBtnCat" style="padding:4px 12px; font-size:12px;">＋ Nueva categoría</button>
            </div>
            <table class="pc-table pc-table-compact"><thead><tr>
                <th>CATEGORÍA / SUBCATEGORÍA</th>
                <th class="pc-th-num">PRESUPUESTO</th><th class="pc-th-num">GASTO REAL</th>
                <th class="pc-th-num">DISPONIBLE</th></tr></thead><tbody>`;
        
        cats.forEach(c => {
            const accentColor = c.color || c.accent || (CAT_META[c.id] ? CAT_META[c.id].accent : '#2563eb');
            const subs = pcSubs(c.id);
            const cb = catBudget(c.id), cs = rowSpent(c.id);
            const derived = subs.length > 0 || c.id === 'pc-loans' || c.id === 'pc-trips';
            
            const catSuffix = `${dueBadge(c.dueDate)}`;
            
            html += `<tr class="pc-row-cat" data-moves="${c.id}" style="--cat-accent:${accentColor}">
                <td class="pc-td-cat">${tickBtn(c.id, cb, cs)}${titleWithBar(c.icon || '📁', rowLabel(c), cs, cb, accentColor, { editAttr: 'editcat', editId: c.id, suffixHtml: catSuffix })}</td>
                <td class="pc-td-num">${cb === null ? muted('No definido') : fmt(cb)}</td>
                <td class="pc-td-num"><span class="pc-cell-edit" data-real="${c.id}">✏️ ${fmt(cs)}</span></td>
                <td class="pc-td-num">${availCell(cb, cs).replace(/^<td[^>]*>|<\/td>$/g, '')}</td></tr>`;
            
            subs.forEach(s => {
                const sb = subBudget(s.id);
                const ss = subSpent(s.id);
                const subColor = s.color || s.accent || accentColor;
                const subSuffix = `${dueBadge(s.dueDate)}`;
                
                html += `<tr class="pc-row-sub" data-moves="${s.id}" style="--cat-accent:${subColor}">
                    <td class="pc-td-cat">${tickBtn(s.id, sb, ss)}${titleWithBar(s.icon || '·', s.name, ss, sb, subColor, { editAttr: 'editsub', editId: s.id, isSub: true, suffixHtml: subSuffix })}</td>
                    <td class="pc-td-num">${sb === null ? muted('No definido') : fmt(sb)}</td>
                    <td class="pc-td-num"><span class="pc-cell-edit" data-real="${s.id}">✏️ ${fmt(ss)}</span></td>
                    <td class="pc-td-num">${availCell(sb, ss).replace(/^<td[^>]*>|<\/td>$/g, '')}</td></tr>`;
            });

            // Punto 8: Préstamos con UI idéntica a las subcategorías
            if (c.id === 'pc-loans') {
                pcLoans().forEach(l => {
                    const paid = (l.paidCount || 0) >= (l.installments || 0);
                    const loanSpent = (l.paidCount || 0) * l.installmentAmount;
                    const loanBudget = l.installments * l.installmentAmount;
                    const loanAvailable = loanBudget - loanSpent;
                    
                    html += `<tr class="pc-row-sub" style="--cat-accent:${accentColor}">
                        <td class="pc-td-cat">
                            ${tickBtn(l.id, loanBudget, loanSpent)}
                            <div class="pc-td-loan" style="width:100%;">
                                <span style="font-size:13px;font-weight:600;">${l.emoji || '🏦'} ${esc(l.name)}</span>
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
       MODALES Y LÓGICA DE EDICIÓN
       ========================================================= */
    function closeModal() { const b = document.getElementById('pcBackdrop'); if (b) b.remove(); }

    // Punto 3: Editar cuenta (nombre, icono, tipo)
    function openEditAccountModal(accId) {
        const acc = getAccounts().find(a => a.id === accId);
        if (!acc) return;
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>Editar Cuenta</h3>
            <div class="pc-field"><label>Nombre</label><input id="eaName" value="${esc(acc.name)}"></div>
            <div class="pc-field"><label>Icono (Emoji o URL de SVG)</label><input id="eaIcon" value="${esc(acc.icon || '')}" placeholder="🏦 o https://..."></div>
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
        div.querySelector('#eaCancel').onclick = closeModal;
        
        div.querySelector('#eaSave').onclick = () => {
            acc.name = div.querySelector('#eaName').value.trim() || acc.name;
            acc.icon = div.querySelector('#eaIcon').value.trim() || acc.icon;
            acc.type = div.querySelector('#eaType').value;
            App.saveData(); App.notifyModuleChange('presupuesto-comun', { reason: 'account-updated' });
            closeModal(); render(); App.showToast('Cuenta actualizada', 'success');
        };
        
        div.querySelector('#eaDel').onclick = () => {
            App.showConfirm(`¿Eliminar la cuenta ${acc.name}?`, () => {
                data().accounts = data().accounts.filter(a => a.id !== acc.id);
                App.saveData(); closeModal(); render();
            });
        };
    }

    // Punto 3: Actualizar saldo (Crea movimiento de ajuste)
    function openUpdateBalanceModal(accId) {
        const acc = getAccounts().find(a => a.id === accId);
        if (!acc) return;
        const cur = Number(acc.balance) || 0;
        
        App.goTo('presupuesto-comun', 'openBalanceModal', [accId, cur]);
    }

    function openBalanceModalDirect(accId, cur) {
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>Actualizar Saldo Real · ${esc(accId)}</h3>
            <div class="pc-field"><label>Nuevo saldo en banco (€)</label><input id="eaVal" type="number" step="0.01" value="${cur.toFixed(2)}"></div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="eaCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="eaSave">Ajustar</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        div.querySelector('#eaCancel').onclick = closeModal;
        
        div.querySelector('#eaSave').onclick = () => {
            const newVal = Number(div.querySelector('#eaVal').value);
            const acc = getAccounts().find(a => a.id === accId);
            const diff = newVal - (Number(acc.balance) || 0);
            
            if (diff !== 0) {
                acc.balance = newVal;
                // Registramos ajuste
                App.registerExpenseMovement({
                    amount: Math.abs(diff),
                    concept: `Ajuste cuenta: ${acc.name}`,
                    date: new Date().toISOString().slice(0, 10),
                    accountId: acc.id,
                    link: { kind: 'adjustment', id: 'adj-' + Date.now() },
                    isIncome: diff > 0 // Si diff es positivo, es un ingreso (faltaba dinero)
                });
                App.addHistory('presupuesto-comun', `Ajuste cuenta ${acc.name}: ${fmt(diff)}`);
            }
            
            App.saveData();
            closeModal(); render(); App.showToast('Saldo ajustado correctamente', 'success');
        };
    }

    // Categorías
    function openCatModal(id, isSub) {
        const item = isSub ? (data().pcSubcategories || []).find(s => s.id === id) : pcCats().find(c => c.id === id);
        if (!item) return;
        if (id === 'pc-loans' || id === 'pc-trips') { App.showToast('Esta categoría se gestiona automáticamente', 'info'); return; }
        
        const accOpts = getAccountNames().map(a => `<option ${item.account === a ? 'selected' : ''}>${a}</option>`).join('');
        const subs = !isSub ? pcSubs(id) : [];
        closeModal();
        
        const derivedNote = (!isSub && subs.length) ? `<div class="pc-derived-note" style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">📐 Los importes se calculan como suma de las ${subs.length} subcategorías.</div>` : '';
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
            <div class="pc-modal-actions">
                <button class="pc-btn pc-btn-danger" id="mDelete">🗑 Eliminar</button>
                <button class="pc-btn pc-btn-ghost" id="mCancel">Cancelar</button>
                <button class="pc-btn pc-btn-primary" id="mSave">Guardar</button></div></div>`;
        document.body.appendChild(div);
        
        div.querySelector('#mCancel').onclick = closeModal;
        div.querySelector('#mSave').onclick = () => {
            item.name = div.querySelector('#mName').value.trim() || item.name;
            item.icon = div.querySelector('#mIcon').value.trim() || item.icon;
            if (!derivedNote) item.budget = div.querySelector('#mBudget').value === '' ? null : Number(div.querySelector('#mBudget').value);
            item.account = div.querySelector('#mAcc').value;
            App.saveData();
            
            const sp = div.querySelector('#mSpent');
            closeModal();
            if (sp) {
                const nv = Number(sp.value);
                if (!isNaN(nv) && Math.abs(nv - rowSpent(item.id)) >= 0.005) {
                    const diff = nv - rowSpent(item.id);
                    addMovement(item.id, diff, { concept: 'Ajuste manual', account: item.account });
                    return;
                }
            }
            render(); App.showToast('Guardado', 'success');
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
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>🗂️ Nueva categoría</h3>
            <div class="pc-field"><label>Tipo</label><select id="cType"><option value="cat">Categoría principal</option><option value="sub">Subcategoría</option></select></div>
            <div class="pc-field" id="cParentWrap" style="display:none"><label>Categoría padre</label><select id="cParent">${parents}</select></div>
            <div class="pc-field"><label>Nombre</label><input id="cName" placeholder="Ej. Cenas fuera"></div>
            <div class="pc-field"><label>Icono (emoji)</label><input id="cIcon" value="📦" maxlength="4"></div>
            <div class="pc-field"><label>Presupuesto (€)</label><input id="cBudget" type="number" step="0.01"></div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="cCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="cSave">Crear</button></div></div>`;
        document.body.appendChild(div);
        
        div.querySelector('#cCancel').onclick = closeModal;
        div.querySelector('#cType').onchange = e => { div.querySelector('#cParentWrap').style.display = e.target.value === 'sub' ? '' : 'none'; };
        div.querySelector('#cSave').onclick = () => {
            const name = div.querySelector('#cName').value.trim();
            if (!name) return;
            const isSub = div.querySelector('#cType').value === 'sub';
            const obj = {
                id: (isSub ? 'pcs-' : 'pc-') + Date.now().toString(36),
                name, icon: div.querySelector('#cIcon').value.trim() || '📦',
                budget: div.querySelector('#cBudget').value ? Number(div.querySelector('#cBudget').value) : null,
                account: ''
            };
            if (isSub) { obj.parentId = div.querySelector('#cParent').value; data().pcSubcategories.push(obj); }
            else { obj.order = (pcCats().length + 1) * 10; data().pcCategories.push(obj); }
            App.saveData(); closeModal(); render();
        };
    }

    /* =========================================================
       INIT / API PÚBLICA
       ========================================================= */
    function render() {
        if (!containerEl) return;
        App.injectStylesheet('pc-custom-styles', moduleCSS());
        
        // Punto 1 y 5: Layout en dos columnas equilibradas
        containerEl.innerHTML = headerHtml() + kpisHtml() +
            `<div class="pc-cols2" style="grid-template-columns: 1fr 1fr; margin-bottom:20px;">${weeksPanelHtml()}${accountsPanelHtml()}</div>` +
            tableHtml();
        bind();
    }

    function bind() {
        const $ = sel => containerEl.querySelector(sel);
        
        // Navegación de meses
        $('#pcPrevMonth').onclick = () => {
            let [y, m] = currentPeriod.split('-').map(Number);
            m--; if (m < 1) { m = 12; y--; }
            currentPeriod = `${y}-${String(m).padStart(2,'0')}`;
            render();
        };
        $('#pcNextMonth').onclick = () => {
            let [y, m] = currentPeriod.split('-').map(Number);
            m++; if (m > 12) { m = 1; y++; }
            currentPeriod = `${y}-${String(m).padStart(2,'0')}`;
            render();
        };

        if ($('#pcNewMov')) $('#pcNewMov').style.display = 'none'; // Ocultar según Punto 7
        
        const btnCat = $('#pcBtnCat');
        if (btnCat) btnCat.onclick = openNewCatModal;

        containerEl.querySelectorAll('[data-week]').forEach(card => card.onclick = () => openWeekModal(card.getAttribute('data-week')));
        
        containerEl.querySelectorAll('[data-moves]').forEach(tr => tr.onclick = e => {
            if (e.target.closest('[data-editcat]') || e.target.closest('[data-editsub]') || e.target.closest('[data-real]') || e.target.closest('[data-tick]') || e.target.closest('.pc-info')) return;
            openMovesModal(tr.getAttribute('data-moves'));
        });

        containerEl.querySelectorAll('[data-tick]').forEach(btn => btn.onclick = e => {
            e.stopPropagation();
            const id = btn.getAttribute('data-tick');
            // Si es un préstamo, pagar cuota. Si no, igualar.
            if (id.startsWith('loan-')) {
                App.payLoanInstallment(id);
            } else {
                equalizeRow(id);
            }
        });
        
        containerEl.querySelectorAll('[data-editcat]').forEach(el => el.onclick = e => { e.stopPropagation(); openCatModal(el.getAttribute('data-editcat'), false); });
        containerEl.querySelectorAll('[data-editsub]').forEach(el => el.onclick = e => { e.stopPropagation(); openCatModal(el.getAttribute('data-editsub'), true); });
        containerEl.querySelectorAll('[data-real]').forEach(el => el.onclick = e => {
            e.stopPropagation();
            openQuickPop(el, el.getAttribute('data-real'), rowSpent(el.getAttribute('data-real')));
        });
        
        // Arreglo Tooltips
        document.addEventListener('click', () => containerEl && containerEl.querySelectorAll('.pc-info.pinned').forEach(o => o.classList.remove('pinned')));
    }

    function equalizeRow(rowId) {
        const row = findRow(rowId);
        if (!row) return;
        const budget = String(rowId).startsWith('pcs-') ? subBudget(rowId) : catBudget(rowId);
        const spent = rowSpent(rowId);
        if (budget === null) return;
        const diff = budget - spent;
        if (Math.abs(diff) < 0.005) return;
        addMovement(rowId, diff, { concept: `Ajuste hasta presupuesto · ${row.name}` });
    }

    // Las funciones openMovesModal, openWeekModal, etc., se mantienen del código anterior...
    // [Se han omitido para no hacer el bloque infinito, pero debes conservarlas tal cual estaban]

    return {
        init: (container) => {
            containerEl = container;
            if (!weekCount(currentPeriod)) {
                // Inicializar semanas si no hay
                data().pcWeeks = allWeeks().concat(generateMonthWeeks(currentPeriod, 4));
            }
            render();
        },
        render, 
        openEditAccountModal: (id) => openEditAccountModal(id),
        openUpdateBalanceModal: (id) => openBalanceModalDirect(id, getAccounts().find(a=>a.id===id).balance),
        openMovementModal: () => {},
        openExpenseModal: (expenseId) => {
            const exp = (data().expenses || []).find(e => e.id === expenseId);
            if (exp) openCatModal(exp.categoryId, String(exp.categoryId || '').startsWith('pcs-'));
        },
        setExpenseStatus: (id, st) => {
            const exp = (data().expenses || []).find(e => e.id === id);
            if (exp) { exp.status = st; App.saveData(); render(); }
        },
        getPcSummary: () => {
            const FIXED_IDS = ['pc-rent', 'pc-utilities', 'pc-loans'];
            let fixed = 0, variable = 0;
            pcCats().forEach(c => {
                const b = catBudget(c.id);
                if (b === null) return;
                if (FIXED_IDS.includes(c.id)) fixed += b; else variable += b;
            });
            return { period: currentPeriod, fixed, variable, total: fixed + variable, budgetTotal: totalBudgetDefined() };
        }
    };
})();

window.BudgetApp = BudgetApp;

(function ensureRegistered() {
    if (window.App && typeof App.registerSection === 'function') {
        App.registerSection('presupuesto-comun', BudgetApp);
    }
})();