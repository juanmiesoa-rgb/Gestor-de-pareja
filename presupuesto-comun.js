/* =============================================================================
   PRESUPUESTO-COMUN.JS · v26 — Tablas por módulo, Cuenta Dinámica y Arrastres
   ============================================================================= */
const BudgetApp = (function () {
    'use strict';

    const FIRST_MONTH = '2026-11';

    function data() { return App.data; }

    const _now = new Date();
    let currentPeriod = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`;
    if (currentPeriod < FIRST_MONTH) currentPeriod = FIRST_MONTH;

    let containerEl = null;

    /* =========================================================
       HELPERS BÁSICOS
       ========================================================= */
    function focusInput(inp) {
        if (!inp) return;
        requestAnimationFrame(() => { inp.focus(); inp.select(); });
    }
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function fmt(n) { return App.formatCurrency(Number(n) || 0); }
    function badge(text, cls) { return `<span class="pc-badge ${cls || 'pc-badge-gray'}">${text}</span>`; }
    function shortDate(iso) {
        if (!iso) return '—';
        const clean = String(iso).slice(0, 10);
        const d = new Date(clean + 'T00:00:00');
        return isNaN(d) ? '—' : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    }
    function currentMk() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    function getAccounts() {
        return (window.App && typeof App.getAccounts === 'function') ? App.getAccounts() : (data().accounts || []);
    }
    function renderIcon(icon, size) {
        if (icon == null || icon === '') return '';
        const s = String(icon).trim();
        const sz = size || 16;
        if (/^(https?:|data:|\/)/.test(s)) {
            return `<img src="${esc(s)}" alt="" style="width:${sz}px;height:${sz}px;object-fit:contain;vertical-align:middle;border-radius:4px;display:inline-block">`;
        }
        return esc(s);
    }

    /* =========================================================
       ACCESO A DINERO
       ========================================================= */
    function getDinero() {
        return (window.App && typeof App.getDineroData === 'function') ? App.getDineroData() : null;
    }

    /** Versión efectiva de un item para el mes (herencia) */
    function effectiveVersion(item, mk) {
        mk = mk || currentPeriod;
        if (!item || !item.versions) return { budgetAmount: Number(item?.budgetAmount || 0) };
        if (item.versions[mk]) return item.versions[mk];
        const past = Object.keys(item.versions).filter(m => m < mk).sort().reverse();
        if (past.length) return item.versions[past[0]];
        return { budgetAmount: Number(item.budgetAmount || 0) };
    }

    function effectiveBudget(item, mk) {
        return Number(effectiveVersion(item, mk).budgetAmount || 0);
    }

    /** Gastos reales del mes para un item */
    function spentFor(type, item, mk) {
        mk = mk || currentPeriod;
        if (type === 'wallet') {
            return (item.movements || [])
                .filter(m => m.type === 'out' && String(m.date || '').startsWith(mk))
                .reduce((s, m) => s + Number(m.amount || 0), 0);
        }
        if (type === 'recurring') {
            return (item.history || [])
                .filter(h => String(h.date || '').startsWith(mk))
                .reduce((s, h) => s + Math.abs(Number(h.amount || 0)), 0);
        }
        if (type === 'loan') {
            return (item.payments || [])
                .filter(p => String(p.date || '').startsWith(mk))
                .reduce((s, p) => s + Number(p.amount || 0), 0);
        }
        if (type === 'goal') {
            return (item.contributions || [])
                .filter(c => String(c.date || '').startsWith(mk))
                .reduce((s, c) => s + Number(c.amount || 0), 0);
        }
        if (type === 'debt') {
            return (item.history || [])
                .filter(h => String(h.date || '').startsWith(mk))
                .reduce((s, h) => s + Number(h.amount || 0), 0);
        }
        return 0;
    }

    /** Construye filas por módulo */
    function getMoneyRows() {
        const d = getDinero();
        const empty = { recurring: [], wallets: [], loans: [], goals: [], debts: [] };
        if (!d) return empty;
        const mk = currentPeriod;

        const recurring = (d.recurring || [])
            .filter(r => r.active && r.includeInBudget)
            .filter(r => !r.nextDate || String(r.nextDate).slice(0, 7) <= mk)
            .map(r => ({
                id: r.id, type: 'recurring',
                icon: r.emoji, name: r.name,
                budget: effectiveBudget(r, mk),
                spent: spentFor('recurring', r, mk),
                subcats: r.subcategories || [],
                raw: r
            }));

        const wallets = (d.wallets || [])
            .filter(w => w.includeInBudget)
            .map(w => ({
                id: w.id, type: 'wallet',
                icon: w.emoji, name: w.name,
                budget: effectiveBudget(w, mk),
                spent: spentFor('wallet', w, mk),
                subcats: w.subcategories || [],
                raw: w
            }));

        const loans = (d.loans || [])
            .filter(l => l.includeInBudget && (l.paidCount || 0) < (l.installments || 0))
            .map(l => ({
                id: l.id, type: 'loan',
                icon: l.emoji, name: l.name,
                budget: effectiveBudget(l, mk) || Number(l.installmentAmount || 0),
                spent: spentFor('loan', l, mk),
                subcats: l.subcategories || [],
                raw: l
            }));

        const goals = (d.goals || [])
            .filter(g => g.includeInBudget && (g.target == null || g.saved < g.target))
            .map(g => ({
                id: g.id, type: 'goal',
                icon: g.emoji, name: g.name,
                budget: effectiveBudget(g, mk) || Number(g.contribution || 0),
                spent: spentFor('goal', g, mk),
                subcats: g.subcategories || [],
                raw: g
            }));

        const debts = (d.debts || [])
            .filter(x => x.includeInBudget && Number(x.returned || 0) < Number(x.total || 0))
            .map(x => ({
                id: x.id, type: 'debt',
                icon: x.emoji, name: x.name,
                budget: effectiveBudget(x, mk) || Math.max(0, Number(x.total) - Number(x.returned)),
                spent: spentFor('debt', x, mk),
                subcats: x.subcategories || [],
                raw: x
            }));

        return { recurring, wallets, loans, goals, debts };
    }

    /* =========================================================
       CUENTAS
       ========================================================= */
    function computeAccountBudget(accId) {
        const account = getAccounts().find(a => a.id === accId);
        if (!account) return 0;
        const accName = String(account.name || '').toLowerCase().trim();
        const rows = getMoneyRows();
        let total = 0;
        const allRows = [].concat(rows.recurring, rows.wallets, rows.loans, rows.goals, rows.debts);
        allRows.forEach(r => {
            const item = r.raw;
            if (item.accountId === accId) total += r.budget;
            else if (item.accountName && String(item.accountName).toLowerCase().trim() === accName) total += r.budget;
        });
        return total;
    }

    function accountsPanelHtml() {
        const accounts = getAccounts();
        const html = accounts.map(a => {
            const realVal = Number(a.balance) || 0;
            const budgeted = computeAccountBudget(a.id);
            const available = realVal - budgeted;
            const iconHtml = renderIcon(a.icon || '🏦', 18);

            return `<div class="pc-account-row">
                <div style="display:flex; align-items:center; cursor:pointer;" onclick="BudgetApp.openEditAccountModal('${a.id}')" title="Editar cuenta">
                    <div class="pc-account-icon">${iconHtml}</div>
                    <div><b>${esc(a.name)}</b></div>
                </div>
                <div style="text-align:right; cursor:pointer;" onclick="BudgetApp.openUpdateBalanceModal('${a.id}')" title="Actualizar saldo">
                    <div class="pc-num" style="font-size:15px;font-weight:800;color:var(--text)">${fmt(realVal)}</div>
                    <div style="font-size:11px;color:${available < 0 ? 'var(--pc-neg)' : 'var(--text-muted)'};">
                        Disponible: ${fmt(available)}
                    </div>
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

    /* =========================================================
       SEMANAS · DERIVADAS DE GROCERIES
       ========================================================= */
    function getGroceriesWallet() {
        const d = getDinero();
        if (!d) return null;
        return (d.wallets || []).find(w =>
            w.id === 'w-groceries' ||
            /groceries/i.test(String(w.name || ''))
        ) || null;
    }

    function getWeekCount(mk) {
        mk = mk || currentPeriod;
        const cfg = (data().pcWeekConfig && data().pcWeekConfig[mk]) || {};
        return Math.max(1, Math.min(6, Number(cfg.numWeeks) || 4));
    }

    function setWeekCount(mk, n) {
        if (!data().pcWeekConfig) data().pcWeekConfig = {};
        if (!data().pcWeekConfig[mk]) data().pcWeekConfig[mk] = {};
        data().pcWeekConfig[mk].numWeeks = Math.max(1, Math.min(6, Number(n) || 4));
    }

    function getGroceriesBudget(mk) {
        const gw = getGroceriesWallet();
        if (!gw) return 0;
        return effectiveBudget(gw, mk);
    }

    function getWeekBaseBudget(mk) {
        const gw = getGroceriesBudget(mk);
        const n = getWeekCount(mk);
        return n > 0 ? Math.round((gw / n) * 100) / 100 : 0;
    }

    function getWeekRanges(mk) {
        const [y, m] = mk.split('-').map(Number);
        const n = getWeekCount(mk);
        const totalDays = new Date(y, m, 0).getDate();
        const daysPerWeek = totalDays / n;
        const ranges = [];
        for (let i = 0; i < n; i++) {
            const startDay = Math.floor(i * daysPerWeek) + 1;
            const endDay = Math.floor((i + 1) * daysPerWeek);
            const start = `${y}-${String(m).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
            const end = `${y}-${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
            ranges.push({ idx: i + 1, label: `Semana ${i + 1}`, start, end });
        }
        return ranges;
    }

    function getTransfersForMonth(mk) {
        mk = mk || currentPeriod;
        const list = data().pcWeekTransfers || [];
        return list.filter(t => String(t.period || '').slice(0, 7) === mk);
    }
    function getReleasesForMonth(mk) {
        mk = mk || currentPeriod;
        const list = data().pcReleases || [];
        return list.filter(r => String(r.period || '').slice(0, 7) === mk);
    }

    function getWeekTransferDelta(idx, mk) {
        const transfers = getTransfersForMonth(mk);
        let delta = 0;
        transfers.forEach(t => {
            if (Number(t.fromWeekIdx) === idx) delta -= Number(t.amount || 0);
            if (Number(t.toWeekIdx) === idx)   delta += Number(t.amount || 0);
        });
        const releases = getReleasesForMonth(mk);
        releases.forEach(r => {
            if (Number(r.weekIdx) === idx) delta -= Number(r.amount || 0);
        });
        return delta;
    }

    function getWeekEffectiveBudget(idx, mk) {
        return getWeekBaseBudget(mk) + getWeekTransferDelta(idx, mk);
    }

    function getWeekSpent(idx, mk) {
        const ranges = getWeekRanges(mk);
        const r = ranges.find(x => x.idx === idx);
        if (!r) return 0;
        
        const gw = getGroceriesWallet();
        if (gw && gw.movements) {
            return gw.movements
                .filter(m => String(m.date || '') >= r.start && String(m.date || '') <= r.end)
                .reduce((s, m) => s + (m.type === 'out' ? Number(m.amount || 0) : -Number(m.amount || 0)), 0);
        }
        
        // Fallback por si no hay cartera (compatibilidad)
        return (data().expenses || [])
            .filter(e => {
                if (e.status === 'archivado' || e.status === 'aportacion') return false;
                if (e.pcWeekId && String(e.pcWeekId).startsWith('wk-' + mk)) {
                    const parts = String(e.pcWeekId).split('-');
                    return Number(parts[parts.length - 1]) === idx;
                }
                const d = String(e.date || '').slice(0, 10);
                return d >= r.start && d <= r.end;
            })
            .reduce((s, e) => s + Number(e.amount || 0), 0);
    }

    function addWeekTransfer(fromIdx, toIdx, amount, mk) {
        mk = mk || currentPeriod;
        const amt = Number(amount) || 0;
        if (amt <= 0 || fromIdx === toIdx) return false;

        const fromBudget = getWeekEffectiveBudget(fromIdx, mk);
        if (fromBudget - amt < -0.005) {
            App.showToast(`La semana origen solo tiene ${fmt(fromBudget)}`, 'warning');
            return false;
        }
        if (!Array.isArray(data().pcWeekTransfers)) data().pcWeekTransfers = [];
        data().pcWeekTransfers.push({
            id: 'wt-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            fromWeekIdx: Number(fromIdx),
            toWeekIdx: Number(toIdx),
            amount: amt,
            date: new Date().toISOString().slice(0, 10),
            period: mk
        });
        App.saveData();
        return true;
    }

    function redistributeFromWeek(fromIdx, delta, mk) {
        mk = mk || currentPeriod;
        const n = getWeekCount(mk);
        const others = [];
        for (let i = 1; i <= n; i++) if (i !== fromIdx) others.push(i);
        if (!others.length) return;

        if (delta < 0) {
            const per = Math.round((-delta / others.length) * 100) / 100;
            const remainder = Math.round((-delta - per * others.length) * 100) / 100;
            others.forEach((o, i) => {
                const amt = per + (i === 0 ? remainder : 0);
                if (amt > 0) addWeekTransfer(fromIdx, o, amt, mk);
            });
        } else if (delta > 0) {
            const per = Math.round((delta / others.length) * 100) / 100;
            const remainder = Math.round((delta - per * others.length) * 100) / 100;
            others.forEach((o, i) => {
                const amt = per + (i === 0 ? remainder : 0);
                if (amt > 0) addWeekTransfer(o, fromIdx, amt, mk);
            });
        }
    }

    function releaseFromGroceries(idx, amount, mk) {
        mk = mk || currentPeriod;
        const amt = Number(amount) || 0;
        if (amt <= 0) return false;

        const gw = getGroceriesWallet();
        if (!gw) { App.showToast('No hay cartera Groceries', 'warning'); return false; }

        const currentBudget = effectiveBudget(gw, mk);
        if (amt > currentBudget + 0.005) { App.showToast(`Groceries solo tiene ${fmt(currentBudget)}`, 'warning'); return false; }

        const weekBudget = getWeekEffectiveBudget(idx, mk);
        if (amt > weekBudget + 0.005) { App.showToast(`La semana solo tiene ${fmt(weekBudget)}`, 'warning'); return false; }

        if (!Array.isArray(data().pcReleases)) data().pcReleases = [];
        data().pcReleases.push({
            id: 'rel-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            weekIdx: Number(idx),
            amount: amt,
            date: new Date().toISOString().slice(0, 10),
            period: mk
        });

        if (!gw.versions) gw.versions = {};
        if (!gw.versions[mk]) gw.versions[mk] = { budgetAmount: currentBudget };
        gw.versions[mk].budgetAmount = Math.max(0, Math.round((currentBudget - amt) * 100) / 100);
        if (mk === currentMk()) gw.budgetAmount = gw.versions[mk].budgetAmount;

        const n = getWeekCount(mk);
        const perOther = Math.round((amt / n) * 100) / 100;
        for (let i = 1; i <= n; i++) {
            if (i === idx) continue;
            if (perOther > 0) addWeekTransfer(i, idx, perOther, mk);
        }

        if (window.App && typeof App.registerIncomeMovement === 'function' && gw.accountId) {
            try {
                App.registerIncomeMovement({
                    amount: amt,
                    concept: `Liberado de Groceries · Semana ${idx}`,
                    date: new Date().toISOString().slice(0, 10),
                    accountId: gw.accountId,
                    link: { kind: 'groceries-release', id: 'rel-' + Date.now().toString(36) }
                });
            } catch (err) {}
        }

        App.saveData();
        return true;
    }

    /* =========================================================
       RENDER · KPIs
       ========================================================= */
    function headerHtml() {
        const [cy, cm] = currentPeriod.split('-').map(Number);
        const dateObj = new Date(cy, cm - 1, 1);
        const capLabel = dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
        return `<div class="pc-topbar-v5" style="margin-bottom: 20px;">
            <div class="pc-period-nav" style="display:flex; align-items:center; gap:16px; background:var(--bg-card); padding:6px 12px; border-radius:12px; border:1px solid var(--border); box-shadow:var(--shadow-sm)">
                <button class="btn btn-ghost btn-sm" id="pcPrevMonth" style="padding:4px 8px; font-size:16px;" ${currentPeriod <= FIRST_MONTH ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>‹</button>
                <span style="font-weight:800; font-size:15px; width:150px; text-align:center;">${capLabel}</span>
                <button class="btn btn-ghost btn-sm" id="pcNextMonth" style="padding:4px 8px; font-size:16px;">›</button>
            </div>
        </div>`;
    }

    function kpisHtml() {
        const rows = getMoneyRows();
        const allRows = [].concat(rows.recurring, rows.wallets, rows.loans, rows.goals, rows.debts);
        const presup = allRows.reduce((s, r) => s + r.budget, 0);
        const gastos = allRows.reduce((s, r) => s + r.spent, 0);
        const disponible = presup - gastos;
        const saldos = getAccounts().reduce((s, a) => s + Number(a.balance || 0), 0);
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

    /* =========================================================
       RENDER · PANEL SEMANAS
       ========================================================= */
    function weeksPanelHtml() {
        const mk = currentPeriod;
        const gw = getGroceriesWallet();
        const gBudget = getGroceriesBudget(mk);
        const n = getWeekCount(mk);
        const base = getWeekBaseBudget(mk);
        const ranges = getWeekRanges(mk);
        const today = new Date().toISOString().slice(0, 10);

        const rows = ranges.map(r => {
            const eff = getWeekEffectiveBudget(r.idx, mk);
            const spent = getWeekSpent(r.idx, mk);
            const remaining = eff - spent;
            let spentColor = 'pc-pos';
            if (remaining < 0) spentColor = 'pc-neg';
            else if (eff > 0 && remaining < eff * 0.2) spentColor = 'pc-warn';

            let cls = '';
            if (today >= r.start && today <= r.end) cls = 'week-en-curso';
            else if (today > r.end) cls = 'week-pasada';

            const transferDelta = getWeekTransferDelta(r.idx, mk);
            const badgeDelta = Math.abs(transferDelta) > 0.005
                ? `<span style="font-size:10px;color:${transferDelta > 0 ? 'var(--pc-pos)' : 'var(--pc-neg)'};margin-left:4px">(${transferDelta > 0 ? '+' : ''}${fmt(transferDelta)})</span>`
                : '';

            return `<div class="pc-week-row ${cls}" data-week="${r.idx}" onclick="BudgetApp.openWeekRowModal(${r.idx})">
                <div class="pc-week-name-col"><span>${esc(r.label)}</span></div>
                <div class="pc-week-date-col">${shortDate(r.start)} → ${shortDate(r.end)}</div>
                <div class="pc-week-budget-col pc-num" onclick="event.stopPropagation();BudgetApp.openWeekBudgetModal(${r.idx})" title="Editar presupuesto de esta semana">${fmt(eff)}${badgeDelta}</div>
                <div class="pc-week-spent-col pc-num ${spentColor}" onclick="event.stopPropagation();BudgetApp.openWeekSpentModal(${r.idx})" title="Ver gasto / tickets">${fmt(spent)}</div>
                <div class="pc-week-transfer-col">
                    <button class="pc-transfer-btn" onclick="event.stopPropagation();BudgetApp.openTransferBudgetModal(${r.idx})" title="Mover presupuesto">↪️</button>
                </div>
            </div>`;
        }).join('');

        const totalEffective = ranges.reduce((s, r) => s + getWeekEffectiveBudget(r.idx, mk), 0);

        return `<div class="pc-panel pc-panel--accent" style="--panel-accent:#10b981; display: flex; flex-direction: column;">
            <div class="pc-panel-title" style="margin-bottom: 12px;">
                <span class="pc-dot"></span>
                <span>🛒 Groceries &amp; Leisure</span>
                <button class="btn btn-ghost btn-sm" onclick="BudgetApp.openWeekCountModal()" style="margin-left:auto; padding:2px 6px; font-size:14px;" title="Configurar nº de semanas">⚙️</button>
                <button class="btn btn-ghost btn-sm" onclick="BudgetApp.openMonthTransfersModal()" style="padding:2px 6px; font-size:14px;" title="Ver todos los arrastres del mes">📋</button>
                <span style="margin-left:8px;">${badge('Total ' + fmt(totalEffective), 'pc-badge-blue')}</span>
            </div>
            <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:10px;">
                Presupuesto de Groceries: <b>${fmt(gBudget)}</b> ÷ ${n} semanas = <b>${fmt(base)}</b>/semana
            </div>
            <div class="pc-week-list">
                <div class="pc-week-row pc-week-header">
                    <div class="pc-week-name-col">SEMANA</div>
                    <div class="pc-week-date-col">FECHAS</div>
                    <div class="pc-week-budget-col">PRESUPUESTO</div>
                    <div class="pc-week-spent-col" style="color:var(--text-muted); text-decoration:none;">GASTADO</div>
                    <div class="pc-week-transfer-col"></div>
                </div>
                ${rows || '<div class="pc-empty">Sin semanas configuradas.</div>'}
            </div>
        </div>`;
    }

    /* =========================================================
       RENDER · TABLAS DINERO (Diseño idéntico a la imagen)
       ========================================================= */
    function renderMoneyTable(config) {
        const { icon, title, accent, rows } = config;
        if (!rows || !rows.length) return '';
        const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
        const totalSpent = rows.reduce((s, r) => s + r.spent, 0);

        const rowsHtml = rows.map(r => {
            const pct = r.budget > 0 ? Math.min(100, Math.round(r.spent / r.budget * 100)) : (r.spent > 0 ? 100 : 0);
            const done = r.budget > 0 && Math.abs(r.budget - r.spent) < 0.005;
            const avail = r.budget - r.spent;
            const hasSubcats = (r.subcats || []).length > 0;
            
            // Icono del banco
            const accId = r.raw.accountId || (r.raw.accountName ? (getAccounts().find(a => a.name === r.raw.accountName)||{}).id : null);
            const accIcon = accId ? (getAccounts().find(a => a.id === accId)||{}).icon : '';

            let html = `<tr class="pc-row-cat" style="--cat-accent:${accent}">
                <td class="pc-td-cat">
                    ${hasSubcats ? `<button class="pc-expand-arrow" data-expand="${r.type}-${r.id}">▶</button>` : ''}
                    <button class="pc-tick-btn ${done ? 'done' : ''}" data-mtick="${r.type}::${r.id}" title="Registrar pago"></button>
                    <div class="pc-title-bar" style="--fill:${pct}%;--fill-col:color-mix(in srgb, ${accent} 30%, transparent);border:none">
                        <span class="pc-title-inner" style="padding:4px 8px;font-size:13px; text-transform:uppercase;">
                            ${renderIcon(r.icon, 16)} <span class="pc-cat-name" data-mname="${r.type}::${r.id}">${esc(r.name)}</span>
                        </span>
                        <b class="pc-title-pct pc-num">${pct}%</b>
                    </div>
                </td>
                <td class="pc-td-num"><span class="pc-cell-edit" data-mbudget="${r.type}::${r.id}">${r.budget > 0 ? fmt(r.budget) : '—'}</span></td>
                <td class="pc-td-num"><span class="pc-cell-edit" data-mspent="${r.type}::${r.id}">${fmt(r.spent)}</span></td>
                <td class="pc-td-num ${avail < 0 ? 'pc-neg' : (avail > 0 ? 'pc-pos' : '')}">${fmt(avail)}</td>
                <td class="pc-td-num" style="width:40px;text-align:center;">${renderIcon(accIcon, 16)}</td>
            </tr>`;

            if (hasSubcats) {
                r.subcats.forEach(sub => {
                    const subBudget = Number(effectiveVersion(sub, currentPeriod).budgetAmount || 0);
                    const subSpent = 0;
                    const subPct = subBudget > 0 ? Math.min(100, Math.round((subSpent / subBudget) * 100)) : 0;
                    const subAvail = subBudget - subSpent;
                    html += `<tr class="pc-row-sub" data-parent="${r.type}-${r.id}" style="--cat-accent:${accent};display:none">
                        <td class="pc-td-cat">
                            <button class="pc-tick-btn" style="visibility:hidden"></button>
                            <div class="pc-title-bar" style="--fill:${subPct}%;--fill-col:color-mix(in srgb, ${accent} 20%, transparent);border:none">
                                <span class="pc-title-inner" style="padding:3px 6px;font-size:12px; text-transform:uppercase;">
                                    ${renderIcon(sub.icon || '·', 14)} ${esc(sub.name)}
                                </span>
                                <b class="pc-title-pct pc-num">${subPct}%</b>
                            </div>
                        </td>
                        <td class="pc-td-num">${subBudget > 0 ? fmt(subBudget) : '—'}</td>
                        <td class="pc-td-num">${fmt(subSpent)}</td>
                        <td class="pc-td-num ${subAvail < 0 ? 'pc-neg' : ''}">${fmt(subAvail)}</td>
                        <td class="pc-td-num"></td>
                    </tr>`;
                });
            }
            return html;
        }).join('');

        return `<div class="pc-panel pc-money-table-panel" style="--panel-accent:${accent};padding:0;overflow:hidden;margin-bottom:16px">
            <div class="pc-panel-title" style="margin:0;padding:14px 18px;background:color-mix(in srgb, ${accent} 8%, var(--bg));border-bottom:1px solid var(--border)">
                <span class="pc-dot"></span>
                <span>${icon} ${title}</span>
                <span class="pc-badge pc-badge-blue pc-num" style="margin-left:auto">${fmt(totalSpent)} / ${fmt(totalBudget)}</span>
            </div>
            <div class="pc-table-wrap" style="border:none;box-shadow:none;border-radius:0">
                <table class="pc-table pc-table-compact">
                    <thead><tr>
                        <th>CATEGORÍA / SUBCATEGORÍA</th>
                        <th class="pc-th-num">PRESUPUESTO</th>
                        <th class="pc-th-num">GASTO REAL</th>
                        <th class="pc-th-num">DISPONIBLE</th>
                        <th class="pc-th-num" style="width:40px;"></th>
                    </tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        </div>`;
    }

    function budgetTablesHtml() {
        const rows = getMoneyRows();
        const parts = [
            renderMoneyTable({ icon: '🔄', title: 'Gastos recurrentes', accent: '#0ea5e9', rows: rows.recurring }),
            renderMoneyTable({ icon: '👛', title: 'Wallets',             accent: '#f59e0b', rows: rows.wallets }),
            renderMoneyTable({ icon: '🏦', title: 'Préstamos',           accent: '#8b5cf6', rows: rows.loans }),
            renderMoneyTable({ icon: '🎯', title: 'Objetivos de ahorro', accent: '#10b981', rows: rows.goals }),
            renderMoneyTable({ icon: '🔄', title: 'Deudas',              accent: '#ef4444', rows: rows.debts })
        ].filter(Boolean);
        if (!parts.length) {
            return `<div class="pc-panel" style="padding:24px;text-align:center;color:var(--text-muted);">
                <div style="font-size:36px;margin-bottom:8px;">📋</div>
                <div style="font-weight:700;margin-bottom:4px;">Sin categorías incluidas en presupuesto</div>
                <div style="font-size:12.5px;">Activa el interruptor "Añadir al Presupuesto" en cualquier item de Dinero para verlo aquí.</div>
            </div>`;
        }
        return `<div class="pc-money-tables">${parts.join('')}</div>`;
    }

    /* =========================================================
       RENDER PRINCIPAL
       ========================================================= */
    function render() {
        if (!containerEl) return;
        containerEl.innerHTML = headerHtml() + kpisHtml() +
            `<div class="pc-layout-grid">
                <div class="pc-col-left">
                    ${accountsPanelHtml()}
                    ${weeksPanelHtml()}
                </div>
                <div class="pc-col-right">
                    ${budgetTablesHtml()}
                </div>
            </div>`;
        bind();
    }

    /* =========================================================
       BIND
       ========================================================= */
    function bind() {
        const $ = sel => containerEl.querySelector(sel);

        const btnPrev = $('#pcPrevMonth');
        if (btnPrev) btnPrev.onclick = () => {
            if (currentPeriod <= FIRST_MONTH) return;
            let [y, m] = currentPeriod.split('-').map(Number);
            m--; if (m < 1) { m = 12; y--; }
            currentPeriod = `${y}-${String(m).padStart(2, '0')}`;
            render();
        };
        const btnNext = $('#pcNextMonth');
        if (btnNext) btnNext.onclick = () => {
            let [y, m] = currentPeriod.split('-').map(Number);
            m++; if (m > 12) { m = 1; y++; }
            currentPeriod = `${y}-${String(m).padStart(2, '0')}`;
            render();
        };

        if (!containerEl._moneyBound) {
            containerEl.addEventListener('click', e => {
                const tick = e.target.closest('[data-mtick]');
                if (tick) { e.stopPropagation(); const [t, id] = tick.dataset.mtick.split('::'); payMoneyRow(t, id); return; }
                const bud = e.target.closest('[data-mbudget]');
                if (bud) { e.stopPropagation(); const [t, id] = bud.dataset.mbudget.split('::'); openMoneyBudgetModal(t, id); return; }
                const sp = e.target.closest('[data-mspent]');
                if (sp) { e.stopPropagation(); const [t, id] = sp.dataset.mspent.split('::'); openMoneySpentModal(t, id); return; }
                const nm = e.target.closest('[data-mname]');
                if (nm) { e.stopPropagation(); const [t, id] = nm.dataset.mname.split('::'); openMoneyModal(t, id); return; }
                const exp = e.target.closest('[data-expand]');
                if (exp) {
                    e.stopPropagation();
                    const key = exp.dataset.expand;
                    const subs = containerEl.querySelectorAll(`[data-parent="${key}"]`);
                    const isHidden = subs.length && subs[0].style.display === 'none';
                    subs.forEach(s => s.style.display = isHidden ? 'table-row' : 'none');
                    exp.textContent = isHidden ? '▼' : '▶';
                    return;
                }
            });
            containerEl._moneyBound = true;
        }
    }

    /* =========================================================
       ACCIONES: pagar / editar / ver gasto
       ========================================================= */
    function payMoneyRow(type, id) {
        if (type === 'loan') {
            if (App.payLoanInstallment) App.payLoanInstallment(id);
            return;
        }
        const rows = getMoneyRows();
        const row = [].concat(rows[type === 'recurring' ? 'recurring' : type + 's']).find(r => r.id === id);
        if (!row) return;
        const diff = row.budget - row.spent;
        if (diff > 0.005 && App.payBudgetItem) App.payBudgetItem(id, type, diff);
    }

    function openMoneyBudgetModal(type, id) {
        const rows = getMoneyRows();
        const row = [].concat(rows[type === 'recurring' ? 'recurring' : type + 's']).find(r => r.id === id);
        if (!row) return;
        const cur = row.budget;
        const val = prompt(`Presupuesto ${App.formatPeriod(currentPeriod)} · ${row.name}\n(Deja el valor para mantenerlo)`, cur);
        if (val === null) return;
        const n = parseFloat(val);
        if (isNaN(n) || n < 0) return;
        if (App.updateBudgetItemAmount) App.updateBudgetItemAmount(id, type, n, currentPeriod);
        render();
    }

    function openMoneySpentModal(type, id) {
        // Reutilizamos el modal completo de edición de Dinero para poder ver y añadir movimientos
        openMoneyModal(type, id);
    }

    function openMoneyModal(type, id) {
        // Llamada directa a los modales de Dinero, sin pasar por App.getModule
        if (type === 'wallet' && window.DineroApp) window.DineroApp.openWalletModal(id);
        else if (type === 'debt' && window.DineroApp) window.DineroApp.openDebtModal(id);
        else if (type === 'loan' && window.DineroApp) window.DineroApp.openLoanModal(id);
        else if (type === 'goal' && window.DineroApp) window.DineroApp.openGoalModal(id);
        else if (type === 'recurring' && window.DineroApp) window.DineroApp.openRecurringModal(id);
    }

    /* =========================================================
       MODALES DE SEMANA
       ========================================================= */
    function closeModal() { const b = document.getElementById('pcBackdrop'); if (b) b.remove(); }

    function openWeekCountModal() {
        closeModal();
        const cur = getWeekCount(currentPeriod);
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>⚙️ Configurar Semanas · ${esc(App.formatPeriod(currentPeriod))}</h3>
            <div class="pc-field"><label>Número de semanas</label>
                <select id="wcN">
                    <option value="4" ${cur === 4 ? 'selected' : ''}>4 semanas</option>
                    <option value="5" ${cur === 5 ? 'selected' : ''}>5 semanas</option>
                </select>
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin:8px 0 12px;">
                💡 El presupuesto de Groceries se divide entre el nº de semanas. Los arrastres y ajustes manuales del mes se mantienen.
            </div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="wcCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="wcSave">Aplicar</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        div.querySelector('#wcCancel').onclick = closeModal;
        div.querySelector('#wcSave').onclick = () => {
            const n = Number(div.querySelector('#wcN').value);
            setWeekCount(currentPeriod, n);
            App.saveData(); closeModal(); render();
        };
    }

    function openWeekRowModal(idx) {
        const mk = currentPeriod;
        const range = getWeekRanges(mk).find(r => r.idx === idx);
        if (!range) return;
        const eff = getWeekEffectiveBudget(idx, mk);
        const spent = getWeekSpent(idx, mk);
        
        const gw = getGroceriesWallet();
        const movs = gw && gw.movements ? gw.movements.filter(m => String(m.date) >= range.start && String(m.date) <= range.end) : [];

        const transfers = getTransfersForMonth(mk).filter(t => Number(t.fromWeekIdx) === idx || Number(t.toWeekIdx) === idx);
        const releases = getReleasesForMonth(mk).filter(r => Number(r.weekIdx) === idx);

        const transferHtml = (transfers.length || releases.length)
            ? transfers.map(t => {
                const isIn = Number(t.toWeekIdx) === idx;
                return `<div class="pc-week-transfer-line ${isIn ? 'in' : 'out'}">
                    <span>${isIn ? '⬅️ Recibido de' : '➡️ Enviado a'} Semana ${isIn ? t.fromWeekIdx : t.toWeekIdx}</span>
                    <strong>${isIn ? '+' : '−'}${fmt(t.amount)}</strong>
                    <small>${App.formatDate(t.date)}</small>
                </div>`;
            }).concat(releases.map(r => `
                <div class="pc-week-transfer-line out">
                    <span>💸 Liberado de Groceries</span>
                    <strong>−${fmt(r.amount)}</strong>
                    <small>${App.formatDate(r.date)}</small>
                </div>`)).join('')
            : '<div class="pc-empty" style="padding:10px;font-size:12px;">Sin arrastres ni liberaciones</div>';

        const movsHtml = movs.length
            ? movs.map(m => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--border-light);font-size:13px;">
                <div><div style="font-weight:600;">${esc(m.concept)}</div>
                     <div style="font-size:11px;color:var(--text-muted);">${App.formatDate(m.date)}</div></div>
                <b>${fmt(m.amount)}</b>
            </div>`).join('')
            : '<div class="pc-empty" style="padding:10px;font-size:12px;">Sin tickets registrados</div>';

        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal" style="max-width:520px;">
            <h3>📅 Semana ${idx} · ${shortDate(range.start)} → ${shortDate(range.end)}</h3>

            <div class="pc-week-modal-kpis">
                <div class="pc-wm-kpi"><small>Presupuesto</small><strong>${fmt(eff)}</strong></div>
                <div class="pc-wm-kpi"><small>Gastado</small><strong class="${spent > eff ? 'pc-neg' : 'pc-pos'}">${fmt(spent)}</strong></div>
                <div class="pc-wm-kpi"><small>Disponible</small><strong class="${eff - spent >= 0 ? 'pc-pos' : 'pc-neg'}">${fmt(eff - spent)}</strong></div>
            </div>

            <div class="pc-wm-section">
                <div class="pc-wm-title">🔄 Historial de arrastres y liberaciones</div>
                ${transferHtml}
            </div>

            <div class="pc-wm-section">
                <div class="pc-wm-title">🧾 Tickets / movimientos de esta semana</div>
                ${movsHtml}
            </div>

            <div class="pc-modal-actions" style="margin-top:18px;border-top:1px solid var(--border);padding-top:14px;">
                <button class="pc-btn pc-btn-ghost" id="wrmTransfer">↪️ Mover presupuesto</button>
                <button class="pc-btn pc-btn-ghost" id="wrmCancel">Cerrar</button>
                <button class="pc-btn pc-btn-primary" id="wrmEdit">Editar presupuesto</button>
            </div>
        </div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        div.querySelector('#wrmCancel').onclick = closeModal;
        div.querySelector('#wrmTransfer').onclick = () => { closeModal(); openTransferBudgetModal(idx); };
        div.querySelector('#wrmEdit').onclick = () => { closeModal(); openWeekBudgetModal(idx); };
    }

    function openWeekBudgetModal(idx) {
        const mk = currentPeriod;
        const eff = getWeekEffectiveBudget(idx, mk);
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>Presupuesto · Semana ${idx}</h3>
            <div class="pc-field"><label>Presupuesto semanal (€)</label>
                <input id="wbVal" type="number" step="0.01" value="${eff.toFixed(2)}"></div>
            <div style="font-size:11.5px;color:var(--text-muted);margin-top:6px">
                ⚖️ Al cambiar esta semana, el resto se reajustará equitativamente para que la suma siga coincidiendo con el presupuesto de Groceries.
            </div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="wbCancel">Cancelar</button>
            <button class="pc-btn pc-btn-primary" id="wbSave">Guardar</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        const inp = div.querySelector('#wbVal'); focusInput(inp);
        div.querySelector('#wbCancel').onclick = closeModal;
        const save = () => {
            const newVal = Number(inp.value);
            if (isNaN(newVal) || newVal < 0) return;
            const delta = newVal - eff;
            if (Math.abs(delta) < 0.005) { closeModal(); return; }
            redistributeFromWeek(idx, delta, mk);
            App.saveData();
            closeModal();
            render();
        };
        div.querySelector('#wbSave').onclick = save;
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    }

    function openWeekSpentModal(idx) {
        openWeekRowModal(idx);
    }

    /* =========================================================
       MODAL ↪️ · 3 OPCIONES EN UN SELECTOR
       ========================================================= */
    function openTransferBudgetModal(idx) {
        const mk = currentPeriod;
        const n = getWeekCount(mk);
        const others = [];
        for (let i = 1; i <= n; i++) if (i !== idx) others.push(i);
        const eff = getWeekEffectiveBudget(idx, mk);

        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal" style="max-width:460px">
            <h3>↪️ Gestionar presupuesto · Semana ${idx}</h3>
            <div class="pc-field" style="margin-bottom: 12px;">
                <label>Elige una acción</label>
                <select id="tbAction" style="width:100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border); font-weight: 600;">
                    <option value="next">➡️ Arrastrar a la semana siguiente</option>
                    <option value="custom">🎯 Arrastrar a una semana específica</option>
                    <option value="release">💸 Liberar de Groceries</option>
                </select>
            </div>

            <div id="tbNextFields" style="display: none;">
                <div class="pc-field"><label>Importe a mover (€)</label><input id="tbNextAmt" type="number" step="0.01" min="0" value="10" style="width:100%;"></div>
            </div>

            <div id="tbCustomFields" style="display: none;">
                <div class="pc-field"><label>Semana destino</label>
                    <select id="tbCustomTo" style="width:100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border);">
                        ${others.map(i => `<option value="${i}">Semana ${i}</option>`).join('')}
                    </select></div>
                <div class="pc-field"><label>Importe a mover (€)</label><input id="tbCustomAmt" type="number" step="0.01" min="0" value="10" style="width:100%;"></div>
            </div>

            <div id="tbReleaseFields" style="display: none;">
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">El importe sale de esta semana y vuelve a la cuenta.</div>
                <div class="pc-field"><label>Importe a liberar (€)</label><input id="tbReleaseAmt" type="number" step="0.01" min="0" value="${eff.toFixed(2)}" style="width:100%;"></div>
            </div>

            <div class="pc-modal-actions" style="margin-top:16px">
                <button class="pc-btn pc-btn-ghost" id="tbCancel">Cancelar</button>
                <button class="pc-btn pc-btn-primary" id="tbSave">Aplicar</button>
            </div>
        </div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });

        const sel = div.querySelector('#tbAction');
        const fNext = div.querySelector('#tbNextFields');
        const fCustom = div.querySelector('#tbCustomFields');
        const fRelease = div.querySelector('#tbReleaseFields');
        sel.onchange = () => {
            fNext.style.display = sel.value === 'next' ? 'block' : 'none';
            fCustom.style.display = sel.value === 'custom' ? 'block' : 'none';
            fRelease.style.display = sel.value === 'release' ? 'block' : 'none';
        };
        sel.value = 'next'; sel.onchange();

        div.querySelector('#tbCancel').onclick = closeModal;
        div.querySelector('#tbSave').onclick = () => {
            const action = sel.value;
            if (action === 'next') {
                const amt = Number(div.querySelector('#tbNextAmt').value);
                if (idx < n) { addWeekTransfer(idx, idx + 1, amt, mk); closeModal(); render(); }
                else App.showToast('No hay semana siguiente', 'warning');
            } else if (action === 'custom') {
                const toIdx = Number(div.querySelector('#tbCustomTo').value);
                const amt = Number(div.querySelector('#tbCustomAmt').value);
                addWeekTransfer(idx, toIdx, amt, mk); closeModal(); render();
            } else if (action === 'release') {
                const amt = Number(div.querySelector('#tbReleaseAmt').value);
                releaseFromGroceries(idx, amt, mk); closeModal(); render();
            }
        };
    }

    function openMonthTransfersModal() {
        const mk = currentPeriod;
        const transfers = getTransfersForMonth(mk);
        const releases = getReleasesForMonth(mk);
        const all = transfers.map(t => ({ date: t.date, label: `S${t.fromWeekIdx} → S${t.toWeekIdx}`, amount: t.amount, kind: 'transfer' }))
            .concat(releases.map(r => ({ date: r.date, label: `Liberado de S${r.weekIdx}`, amount: r.amount, kind: 'release' })))
            .sort((a, b) => String(a.date).localeCompare(String(b.date)));

        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal" style="max-width:520px;">
            <h3>📋 Arrastres y liberaciones · ${esc(App.formatPeriod(mk))}</h3>
            <div style="max-height:400px;overflow-y:auto;margin-top:14px;">
                ${all.length ? all.map(t => `
                    <div class="pc-week-transfer-line ${t.kind === 'release' ? 'out' : ''}">
                        <span>${t.kind === 'transfer' ? '🔁' : '💸'} ${esc(t.label)}</span>
                        <strong>${fmt(t.amount)}</strong>
                        <small>${App.formatDate(t.date)}</small>
                    </div>`).join('') : '<div class="pc-empty">Sin arrastres este mes</div>'}
            </div>
            <div class="pc-modal-actions" style="margin-top:16px">
                <button class="pc-btn pc-btn-ghost" id="mtmClose">Cerrar</button>
            </div>
        </div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        div.querySelector('#mtmClose').onclick = closeModal;
    }

    /* =========================================================
       CUENTAS · MODALES (Cuenta Dinámica)
       ========================================================= */
    function openUpdateBalanceModal(accId) {
        const acc = data().accounts.find(a => a.id === accId);
        if (!acc) return;
        const cur = Number(acc.balance) || 0;
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>Actualizar Saldo · ${esc(acc.name)}</h3>
            <div class="pc-field"><label>Nuevo saldo en banco (€)</label>
                <input id="eaVal" type="number" step="0.01" value="${cur.toFixed(2)}"></div>
            <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:8px;">
                💡 El cambio solo ajusta el saldo real. Si es la cuenta de Groceries, la diferencia se aplicará automáticamente a la semana actual.
            </div>
            <div class="pc-modal-actions"><button class="pc-btn pc-btn-ghost" id="eaCancel2">Cancelar</button>
                <button class="pc-btn pc-btn-primary" id="eaSave2">Ajustar</button></div></div>`;
        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) closeModal(); });
        const inp = div.querySelector('#eaVal'); focusInput(inp);
        div.querySelector('#eaCancel2').onclick = closeModal;
        const save = () => {
            const newVal = Number(inp.value) || 0;
            const delta = newVal - cur;
            
            // 1. Cuenta dinámica de Groceries
            if (Math.abs(delta) > 0.005) {
                const gw = getGroceriesWallet();
                if (gw && gw.accountId === acc.id && typeof App.addWalletMovement === 'function') {
                    App.addWalletMovement(gw.id, Math.abs(delta), delta < 0 ? 'out' : 'in', 'Ajuste Groceries (Saldo)', new Date().toISOString().slice(0, 10));
                }
            }

            // 2. Actualizar saldo real
            const accToUpdate = data().accounts.find(a => a.id === acc.id);
            if (accToUpdate) accToUpdate.balance = newVal;
            
            App.saveData();
            if (window.App && typeof App.notifyModuleChange === 'function') {
                App.notifyModuleChange('presupuesto-comun', { reason: 'account-balance-updated', accountId: acc.id });
            }
            closeModal(); render();
        };
        div.querySelector('#eaSave2').onclick = save;
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    }

    function openEditAccountModal(accId) {
        const acc = getAccounts().find(a => a.id === accId);
        if (!acc) return;
        closeModal();
        const div = document.createElement('div');
        div.className = 'pc-modal-backdrop show'; div.id = 'pcBackdrop';
        div.innerHTML = `<div class="pc-modal"><h3>Editar Cuenta</h3>
            <div class="pc-field"><label>Nombre</label><input id="eaName" value="${esc(acc.name)}"></div>
            <div class="pc-field"><label>Icono (Emoji o URL)</label><input id="eaIcon" value="${esc(acc.icon || '')}"></div>
            <div class="pc-field"><label>Tipo</label>
                <select id="eaType">
                    <option value="conjunta" ${acc.type === 'conjunta' ? 'selected' : ''}>Conjunta</option>
                    <option value="inversion" ${acc.type === 'inversion' ? 'selected' : ''}>Inversión</option>
                    <option value="banco" ${acc.type === 'banco' ? 'selected' : ''}>Banco</option>
                    <option value="efectivo" ${acc.type === 'efectivo' ? 'selected' : ''}>Efectivo</option>
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
            <div class="pc-field"><label>Icono (Emoji o URL)</label><input id="naIcon" value="🏦"></div>
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
                name, icon: div.querySelector('#naIcon').value.trim() || '🏦',
                type: div.querySelector('#naType').value,
                balance: 0, owners: ['ana', 'carlos'], color: '#2563eb'
            });
            App.saveData(); closeModal(); render();
        };
    }

    /* =========================================================
       API PÚBLICA
       ========================================================= */
    return {
        init: (container) => {
            containerEl = container;
            if (!Array.isArray(data().pcWeekTransfers)) data().pcWeekTransfers = [];
            if (!Array.isArray(data().pcReleases)) data().pcReleases = [];
            if (!data().pcWeekConfig) data().pcWeekConfig = {};
        },
        render,

        /* Acciones semanas */
        openWeekCountModal,
        openWeekRowModal,
        openWeekBudgetModal,
        openWeekSpentModal,
        openTransferBudgetModal,
        openMonthTransfersModal,

        /* Acciones cuentas */
        openEditAccountModal,
        openNewAccountModal,
        openUpdateBalanceModal,

        /* Acciones filas Dinero */
        payMoneyRow,
        openMoneyBudgetModal,
        openMoneySpentModal,

        /* Compatibilidad con el bridge App */
        getState: () => ({
            currentPeriod,
            weeks: getWeekRanges(currentPeriod),
            weekTransfers: data().pcWeekTransfers || [],
            releases: data().pcReleases || [],
            weekConfig: data().pcWeekConfig || {},
            expenses: data().expenses || []
        }),
        getPcSummary: () => {
            const rows = getMoneyRows();
            const all = [].concat(rows.recurring, rows.wallets, rows.loans, rows.goals, rows.debts);
            return {
                period: currentPeriod,
                total: all.reduce((s, r) => s + r.budget, 0),
                spent: all.reduce((s, r) => s + r.spent, 0)
            };
        },
        /* Stub para compatibilidad */
        openExpenseModal: () => {},
        openCategoryModal: () => {},
        openMovementModal: () => {},
        addMovement: () => {},
        editWeekBudget: openWeekBudgetModal,
        openCatSpentModal: () => {},
        openSubSpentModal: () => {},
        equalizeWeek: () => {}
    };
})();
window.BudgetApp = BudgetApp;
if (window.App && typeof App.registerSection === 'function') App.registerSection('presupuesto-comun', BudgetApp);