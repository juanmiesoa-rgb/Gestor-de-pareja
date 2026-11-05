/* =============================================================================
   CALENDARIO.JS · v4 — Calendario financiero conectado al puente App
   -----------------------------------------------------------------------------
   · Día actual con badge HOY + círculo azul
   · Vistas: Mes · Semana · Agenda (30 días desde hoy)
   · Toolbar: mes/periodo a la izquierda · conmutador de vista a la derecha
   · Agregación completa desde el puente:
       - App.data.expenses (presupuesto)
       - App.getDineroData() (dinero: commitments, recurring, loans, goals,
         debts, movements)
       - App.getIngresosData() + App.getSalary() + App.getMonthExtras()
         (nóminas, extras, bonus con fecha)
       - App.data.trips + tripActivities + tripReservations (viajes)
       - App.data.transfers
       - App.data.calendarEvents (manuales, solo lectura)
     · Modal de evento con acciones contextuales:
         - Ingresos: "Registrar cobro real" → App.confirmIncomeReceipt
         - Presupuesto: "Marcar pagado" → App.goTo('presupuesto-comun','setExpenseStatus')
         - Dinero/Viajes: "Abrir en …"
     · Listener app:module-changed → re-render automático
   ============================================================================= */
const CalendarApp = (function () {
    'use strict';

    /* =========================== ESTADO =========================== */
    const state = {
        currentDate: new Date(),
        selectedDate: null,
        currentView: 'mes'  // 'mes' | 'semana' | 'agenda'
    };

    let containerEl = null;
    let listenersBound = false;

    /* =========================== UTILIDADES FECHA =========================== */
    const pad = n => String(n).padStart(2, '0');
    const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const fromISO = iso => new Date(iso + 'T00:00:00');
    const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
    const addMonths = (d, n) => {
        const r = new Date(d); const day = r.getDate();
        r.setMonth(r.getMonth() + n);
        if (r.getDate() !== day) r.setDate(0);
        return r;
    };
    const startOfMonth = d => new Date(d.getFullYear(), d.getMonth(), 1);
    const endOfMonth = d => new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const startOfWeek = d => { const r = new Date(d); const wd = (r.getDay() + 6) % 7; return addDays(r, -wd); };
    const todayISO = () => toISO(new Date());

    const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    const fmtMonthYear = d => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    const fmtDayLong = iso => {
        const d = fromISO(iso);
        return `${WEEKDAYS[(d.getDay() + 6) % 7]}, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
    };
    const fmtAmount = n => (n == null || isNaN(n)) ? '—'
        : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
    const fmtAmountShort = n => new Intl.NumberFormat('es-ES', {
        style: 'currency', currency: 'EUR', maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2
    }).format(Math.abs(n));
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    function getPersonName(pid) {
        const p = ((window.App && App.data && App.data.profiles) || []).find(x => x.id === pid);
        return p ? p.name : pid;
    }

    function ensureStructures() {
        if (!App.data) return;
        if (!Array.isArray(App.data.calendarEvents)) App.data.calendarEvents = [];
        if (!Array.isArray(App.data.transfers)) App.data.transfers = [];
    }

    /* =========================== INGRESOS · LECTURA VIA PUENTE =========================== */
    /**
     * Nóminas, pagas extra y bonus con fecha.
     * Usa App.getIngresosData(), App.getSalary() y App.getMonthExtras().
     */
    function getIncomeEvents(startISO, endISO) {
        const ing = (window.App && typeof App.getIngresosData === 'function') ? App.getIngresosData() : null;
        if (!ing || !ing.profiles) return [];

        const events = [];
        const peopleIds = ((window.App && App.data && App.data.profiles) || []).map(p => p.id);

        peopleIds.forEach(pid => {
            const profile = ing.profiles[pid];
            if (!profile || !profile.grossAnnual) return;
            const payDay = String(profile.extraPayDay || 15).padStart(2, '0');

            // Iterar meses del rango
            const start = fromISO(startISO);
            const end = fromISO(endISO);
            let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
            const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

            while (cursor <= endMonth) {
                const mk = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
                const payDate = `${mk}-${payDay}`;

                if (payDate >= startISO && payDate <= endISO) {
                    // Nómina mensual
                    const sal = (window.App && typeof App.getSalary === 'function')
                        ? App.getSalary(pid, mk) : null;
                    if (sal) {
                        const ctrl = ing.monthlyControl && ing.monthlyControl[mk];
                        const isConfirmed = !!(ctrl && ctrl.confirmed && ctrl.confirmed[pid]);
                        events.push({
                            id: `ing-salary-${pid}-${mk}`,
                            source: 'ingresos',
                            type: 'ingreso',
                            title: `Nómina ${MONTHS[cursor.getMonth()]} · ${getPersonName(pid)}`,
                            date: payDate,
                            time: '',
                            person: pid,
                            isFinancial: true,
                            amount: (isConfirmed && sal.real != null) ? sal.real : sal.theoretical,
                            status: isConfirmed ? 'registrado' : 'previsto',
                            originSection: 'ingresos-personales',
                            originId: `salary-${pid}-${mk}`
                        });
                    }

                    // Paga extra (solo si el mes está en extraDates)
                    const monthMM = pad(cursor.getMonth() + 1);
                    const hasExtra = (profile.extraDates || []).includes(monthMM);
                    if (hasExtra && window.App && typeof App.getMonthExtras === 'function') {
                        const items = App.getMonthExtras(pid, mk) || [];
                        const extraItem = items.find(x => x.type === 'extraordinaria');
                        if (extraItem && extraItem.amount > 0) {
                            const confirmedAmt =
                                ing.extraPayments &&
                                ing.extraPayments[mk] &&
                                ing.extraPayments[mk][pid] &&
                                ing.extraPayments[mk][pid].realItems &&
                                ing.extraPayments[mk][pid].realItems[extraItem.id];
                            events.push({
                                id: `ing-extra-${pid}-${mk}`,
                                source: 'ingresos',
                                type: 'ingreso',
                                title: `Paga extra · ${getPersonName(pid)}`,
                                date: payDate,
                                time: '',
                                person: pid,
                                isFinancial: true,
                                amount: confirmedAmt != null ? confirmedAmt : extraItem.amount,
                                status: confirmedAmt != null ? 'registrado' : 'previsto',
                                originSection: 'ingresos-personales',
                                originId: `extra-${pid}-${mk}-${extraItem.id}`
                            });
                        }
                    }
                }
                cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
            }

            // Bonus (fecha exacta · status previsto · se confirma desde Ingresos)
            (profile.bonuses || []).forEach(b => {
                if (!b.date || b.date < startISO || b.date > endISO) return;
                const amount = Math.max(0, Number(b.amount) - Number(b.irpfDiscount || 0));
                if (amount <= 0) return;
                events.push({
                    id: `ing-bonus-${b.id}`,
                    source: 'ingresos',
                    type: 'ingreso',
                    title: `Bonus · ${b.name} (${getPersonName(pid)})`,
                    date: b.date,
                    time: '',
                    person: pid,
                    isFinancial: true,
                    amount,
                    status: 'previsto',
                    originSection: 'ingresos-personales',
                    originId: b.id
                });
            });
        });

        return events;
    }

    /* =========================== AGREGACIÓN GENERAL =========================== */
    function getAllEvents(startISO, endISO) {
        ensureStructures();
        const raw = [];

        /* -- 1 · Manuales -- */
        (App.data.calendarEvents || []).forEach(ev => {
            if (!ev.date || ev.date < startISO || ev.date > endISO) return;
            const isFin = ev.type === 'ingreso' || ev.type === 'gasto';
            raw.push({
                id: ev.id, source: 'manual', type: ev.type || 'manual',
                title: ev.title, date: ev.date, time: ev.time || '',
                person: ev.person, status: ev.status, notes: ev.notes,
                isFinancial: isFin,
                amount: isFin && ev.amount != null
                    ? (ev.type === 'ingreso' ? 1 : -1) * Math.abs(Number(ev.amount))
                    : null,
                originSection: 'manual', originId: ev.id
            });
        });

        /* -- 2 · Presupuesto -- */
        (App.data.expenses || []).forEach(exp => {
            if (!exp.date || exp.date < startISO || exp.date > endISO) return;
            if (exp.status === 'archivado' || exp.status === 'aportacion') return;
            if (!['previsto', 'pendiente', 'registrado'].includes(exp.status)) return;
            raw.push({
                id: 'exp-' + exp.id, source: 'presupuesto', type: 'gasto',
                title: exp.concept || 'Gasto', date: exp.date, time: '',
                person: exp.person, status: exp.status, notes: exp.notes || '',
                categoryId: exp.categoryId,
                isFinancial: true,
                amount: -Math.abs(Number(exp.amount) || 0),
                originSection: 'presupuesto-comun', originId: exp.id
            });
        });

        /* -- 3 · Dinero (encapsulado vía puente) -- */
        const dinero = (window.App && typeof App.getDineroData === 'function')
            ? App.getDineroData()
            : null;
        if (dinero) {
            const inRange = d => d && d >= startISO && d <= endISO;

            (dinero.commitments || []).forEach(c => {
                if (c.executed || !inRange(c.dueDate)) return;
                raw.push({
                    id: 'din-cm-' + c.id, source: 'dinero', type: 'gasto',
                    title: c.name || 'Compromiso', date: c.dueDate, time: '',
                    isFinancial: true, amount: -Math.abs(Number(c.amount) || 0),
                    status: 'previsto', notes: c.note || '',
                    originSection: 'mi-dinero', originId: c.id,
                    entityKind: 'commitment'
                });
            });

            (dinero.recurring || []).forEach(r => {
                if (!r.active || !inRange(r.nextDate)) return;
                raw.push({
                    id: 'din-rc-' + r.id, source: 'dinero', type: 'gasto',
                    title: (r.emoji ? r.emoji + ' ' : '') + (r.name || 'Suscripción'),
                    date: r.nextDate, time: '',
                    isFinancial: true, amount: -Math.abs(Number(r.amount) || 0),
                    status: 'previsto',
                    originSection: 'mi-dinero', originId: r.id,
                    entityKind: 'recurring'
                });
            });

            (dinero.loans || []).forEach(l => {
                if (!l.nextDate || (l.paidCount || 0) >= (l.installments || 0)) return;
                if (!inRange(l.nextDate)) return;
                raw.push({
                    id: 'din-ln-' + l.id, source: 'dinero', type: 'gasto',
                    title: 'Cuota · ' + (l.name || 'Préstamo'), date: l.nextDate, time: '',
                    isFinancial: true, amount: -Math.abs(Number(l.installmentAmount) || 0),
                    status: 'previsto',
                    originSection: 'mi-dinero', originId: l.id,
                    entityKind: 'loan'
                });
            });

            (dinero.goals || []).forEach(g => {
                if (g.id === 'g-trip-fund') return;
                if (!g.nextDate || g.frequency === 'none' || !g.contribution) return;
                if (!inRange(g.nextDate)) return;
                raw.push({
                    id: 'din-gl-' + g.id, source: 'dinero', type: 'gasto',
                    title: 'Aportación · ' + (g.name || 'Objetivo'), date: g.nextDate, time: '',
                    isFinancial: true, amount: -Math.abs(Number(g.contribution) || 0),
                    status: 'previsto',
                    originSection: 'mi-dinero', originId: g.id,
                    entityKind: 'goal'
                });
            });

            (dinero.debts || []).forEach(d => {
                if (!inRange(d.dueDate)) return;
                const remaining = Math.max(0, (d.total || 0) - (d.returned || 0));
                if (remaining <= 0) return;
                const isReceive = d.kind === 'receive';
                raw.push({
                    id: 'din-db-' + d.id, source: 'dinero',
                    type: isReceive ? 'ingreso' : 'gasto',
                    title: (isReceive ? 'Cobrar · ' : 'Devolver · ') + (d.name || 'Deuda'),
                    date: d.dueDate, time: '',
                    isFinancial: true,
                    amount: isReceive ? remaining : -remaining,
                    status: 'previsto',
                    originSection: 'mi-dinero', originId: d.id,
                    entityKind: 'debt'
                });
            });

            // Movimientos reales · evitar duplicar los ya representados por otros orígenes
            (dinero.movements || []).forEach(m => {
                if (!inRange(m.date)) return;
                if (m.type === 'transfer-in' || m.type === 'transfer-out') return;
                if (m.link && (
                    m.link.kind === 'expense' ||
                    m.link.kind === 'salary' ||
                    m.link.kind === 'extra-payment' ||
                    m.link.kind === 'extra-savings-in' ||
                    m.link.kind === 'extra-savings-out' ||
                    m.link.kind === 'trip-payment'
                )) return;
                const amt = Number(m.amount) || 0;
                if (amt === 0) return;
                raw.push({
                    id: 'din-mv-' + m.id, source: 'dinero',
                    type: amt >= 0 ? 'ingreso' : 'gasto',
                    title: m.concept || 'Movimiento', date: m.date, time: '',
                    isFinancial: true, amount: amt,
                    status: 'registrado',
                    originSection: 'mi-dinero', originId: m.id,
                    entityKind: 'movement'
                });
            });
        }

        /* -- 4 · Ingresos (nóminas, extras, bonus) -- */
        raw.push(...getIncomeEvents(startISO, endISO));

        /* -- 5 · Viajes -- */
        (App.data.trips || []).forEach(t => {
            if (t.status === 'cancelado') return;
            if (t.startDate && t.startDate >= startISO && t.startDate <= endISO) {
                raw.push({
                    id: 'trip-start-' + t.id, source: 'viajes', type: 'viaje',
                    title: 'Salida · ' + t.name, date: t.startDate, time: '',
                    isFinancial: false, amount: null,
                    originSection: 'viajes', originId: t.id, tripId: t.id
                });
            }
            if (t.endDate && t.endDate >= startISO && t.endDate <= endISO) {
                raw.push({
                    id: 'trip-end-' + t.id, source: 'viajes', type: 'viaje',
                    title: 'Regreso · ' + t.name, date: t.endDate, time: '',
                    isFinancial: false, amount: null,
                    originSection: 'viajes', originId: t.id, tripId: t.id
                });
            }
        });

        (App.data.tripActivities || []).forEach(a => {
            if (!a.date || a.date < startISO || a.date > endISO) return;
            raw.push({
                id: 'act-' + a.id, source: 'viajes', type: 'actividad',
                title: a.title, date: a.date, time: a.time || '',
                isFinancial: (a.estimatedCost || 0) > 0,
                amount: a.estimatedCost ? -Math.abs(a.estimatedCost) : null,
                originSection: 'viajes', originId: a.id, tripId: a.tripId
            });
        });

        (App.data.tripReservations || []).forEach(r => {
            if (r.status === 'pagado' || r.status === 'cancelado') return;
            (r.paymentDates || []).forEach(pd => {
                if (pd < startISO || pd > endISO) return;
                raw.push({
                    id: 'res-pay-' + r.id + '-' + pd, source: 'viajes', type: 'pago',
                    title: 'Pago · ' + r.concept, date: pd, time: '',
                    isFinancial: true, amount: -Math.abs(Number(r.pendingAmount) || 0),
                    originSection: 'viajes', originId: r.id, tripId: r.tripId
                });
            });
        });

        /* -- 6 · Transferencias -- */
        (App.data.transfers || []).forEach(tr => {
            if (!tr.date || tr.date < startISO || tr.date > endISO || tr.status === 'cancelado') return;
            raw.push({
                id: 'tr-' + tr.id, source: 'cuentas', type: 'transferencia',
                title: tr.concept, date: tr.date, time: '',
                isFinancial: false, amount: null,
                originSection: 'cuentas', originId: tr.id
            });
        });

        return raw.sort((a, b) =>
            a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')
        );
    }

    const getEventsForDay = iso => getAllEvents(iso, iso);
    const groupByDate = list => {
        const out = {};
        list.forEach(ev => (out[ev.date] = out[ev.date] || []).push(ev));
        return out;
    };

    /* =========================== CÁLCULOS =========================== */
    const sumIncome  = evs => evs.filter(e => e.isFinancial && e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const sumExpense = evs => Math.abs(evs.filter(e => e.isFinancial && e.amount < 0).reduce((s, e) => s + e.amount, 0));
    const sumNet     = evs => evs.filter(e => e.isFinancial && typeof e.amount === 'number').reduce((s, e) => s + e.amount, 0);

    const currentBalance = () => {
        const accounts = (window.App && typeof App.getAccounts === 'function')
            ? App.getAccounts()
            : (App.data && App.data.accounts) || [];
        return accounts.reduce((s, a) => s + Number(a.balance || 0), 0);
    };

    /**
     * Balance proyectado al cierre de targetISO.
     *  · Hoy → balance actual
     *  · Futuro → balance + neto(mañana → target)
     *  · Pasado → balance − neto(target+1 → ayer)
     */
    function getProjectedBalance(targetISO) {
        const today = todayISO();
        const base = currentBalance();
        if (targetISO === today) return base;

        if (targetISO > today) {
            const tomorrow = toISO(addDays(new Date(), 1));
            if (targetISO < tomorrow) return base;
            return base + sumNet(getAllEvents(tomorrow, targetISO));
        }

        const yesterday = toISO(addDays(new Date(), -1));
        if (targetISO >= yesterday) return base;
        const afterTarget = toISO(addDays(fromISO(targetISO), 1));
        return base - sumNet(getAllEvents(afterTarget, yesterday));
    }

    /* =========================== RENDER PRINCIPAL =========================== */
    function render(container) {
        if (container) containerEl = container;
        if (!containerEl) return;
        if (!state.selectedDate) state.selectedDate = todayISO();

        containerEl.innerHTML = `
            <div class="cal-wrap">
                ${renderToolbar()}
                <div class="cal-layout">
                    <div class="cal-main" id="calMain">${renderMainView()}</div>
                    <aside class="cal-sidebar" id="calSidebar">${renderSidebarContent()}</aside>
                </div>
            </div>
            ${renderDetailModal()}
        `;
        bind();
    }

    function renderToolbar() {
        const isAgenda = state.currentView === 'agenda';
        const viewBtn = (v, label) =>
            `<button class="cal-view-btn ${state.currentView === v ? 'active' : ''}" data-action="switch-view" data-view="${v}">${label}</button>`;

        return `
            <div class="cal-toolbar cal-toolbar-single">
                <div class="cal-toolbar-left">
                    ${isAgenda
                        ? `<div class="cal-date-title">Próximos 30 días</div>`
                        : `<button class="cal-nav-btn" data-action="nav-prev" aria-label="Anterior">‹</button>
                           <div class="cal-date-title">${fmtMonthYear(state.currentDate)}</div>
                           <button class="cal-nav-btn" data-action="nav-next" aria-label="Siguiente">›</button>
                           <button class="cal-today-btn" data-action="nav-today">Hoy</button>`}
                </div>
                <div class="cal-toolbar-right">
                    <div class="cal-view-switch">
                        ${viewBtn('mes', 'Mes')}${viewBtn('semana', 'Semana')}${viewBtn('agenda', 'Agenda')}
                    </div>
                </div>
            </div>
        `;
    }

    function renderMainView() {
        switch (state.currentView) {
            case 'semana':  return renderWeekView();
            case 'agenda':  return renderAgendaView();
            default:        return renderMonthView();
        }
    }

    /* --- Mes --- */
    function renderMonthView() {
        const d = state.currentDate;
        const first = startOfMonth(d);
        const last = endOfMonth(d);
        const startOffset = (first.getDay() + 6) % 7;
        const gridStart = addDays(first, -startOffset);
        const weeksNeeded = Math.ceil((startOffset + last.getDate()) / 7);
        const gridEnd = addDays(gridStart, weeksNeeded * 7 - 1);

        const events = getAllEvents(toISO(gridStart), toISO(gridEnd));
        const byDay = groupByDate(events);
        const today = todayISO();

        let html = '<div class="cal-month-grid">';
        WEEKDAYS_SHORT.forEach(w => { html += `<div class="cal-weekday">${w}</div>`; });

        let cursor = new Date(gridStart);
        while (cursor <= gridEnd) {
            const iso = toISO(cursor);
            const isOther = cursor.getMonth() !== d.getMonth();
            const isToday = iso === today;
            const isSel = iso === state.selectedDate;
            const dayEvents = byDay[iso] || [];
            const MAX = 3;

            html += `<div class="cal-day-cell ${isOther ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSel ? 'selected' : ''}" data-date="${iso}" role="button" tabindex="0">`;
            html += `<div class="cal-day-num">${cursor.getDate()}</div>`;
            html += `<div class="cal-day-events">`;
            dayEvents.slice(0, MAX).forEach(ev => {
                const sign = ev.amount > 0 ? '+' : '';
                const amtTxt = ev.amount != null ? sign + fmtAmountShort(ev.amount) : '';
                html += `<div class="cal-event-chip type-${ev.type}" data-event-id="${ev.id}" title="${esc(ev.title)}${amtTxt ? ' · ' + amtTxt : ''}">
                    ${amtTxt ? `<span class="cal-chip-amt">${amtTxt}</span>` : ''}
                    <span class="cal-chip-title">${esc(ev.title)}</span>
                </div>`;
            });
            if (dayEvents.length > MAX) {
                html += `<div class="cal-more">+${dayEvents.length - MAX} más</div>`;
            }
            html += `</div></div>`;
            cursor = addDays(cursor, 1);
        }
        html += '</div>';
        return html;
    }

    /* --- Semana --- */
    function renderWeekView() {
        const start = startOfWeek(state.currentDate);
        const end = addDays(start, 6);
        const events = getAllEvents(toISO(start), toISO(end));
        const byDay = groupByDate(events);
        const today = todayISO();

        let html = '<div class="cal-week-grid">';
        for (let i = 0; i < 7; i++) {
            const d = addDays(start, i);
            const iso = toISO(d);
            const isToday = iso === today;
            const isSel = iso === state.selectedDate;
            const dayEvents = byDay[iso] || [];
            html += `<div class="cal-week-col ${isToday ? 'today' : ''} ${isSel ? 'selected' : ''}" data-date="${iso}">
                <div class="cal-week-head">${WEEKDAYS_SHORT[i]}</div>
                <div class="cal-week-daynum">${d.getDate()}</div>
                <div class="cal-week-events">
                    ${dayEvents.map(ev => {
                        const sign = ev.amount > 0 ? '+' : '';
                        const amtTxt = ev.amount != null ? sign + fmtAmountShort(ev.amount) : '';
                        return `<div class="cal-event-chip type-${ev.type}" data-event-id="${ev.id}">
                            ${amtTxt ? `<span class="cal-chip-amt">${amtTxt}</span>` : ''}
                            <span class="cal-chip-title">${esc(ev.title)}</span>
                        </div>`;
                    }).join('') || '<div class="cal-sidebar-empty" style="padding:8px 0;font-size:11px;">Sin eventos</div>'}
                </div>
            </div>`;
        }
        html += '</div>';
        return html;
    }

    /* --- Agenda: fija 30 días desde hoy --- */
    function renderAgendaView() {
        const today = new Date();
        const start = toISO(today);
        const end = toISO(addDays(today, 30));
        const events = getAllEvents(start, end);
        const todayIso = toISO(today);

        if (!events.length) {
            return `<div class="cal-agenda-view">
                <div class="cal-sidebar-empty">No hay movimientos programados en los próximos 30 días.</div>
            </div>`;
        }

        const byDay = groupByDate(events);
        const sortedDays = Object.keys(byDay).sort();

        return `<div class="cal-agenda-view">${sortedDays.map(day => {
            const balance = getProjectedBalance(day);
            const isToday = day === todayIso;
            return `
                <div class="cal-agenda-group ${isToday ? 'today' : ''}">
                    <div class="cal-agenda-header">
                        <span>${fmtDayLong(day)}${isToday ? '<span class="cal-today-pill">HOY</span>' : ''}</span>
                        <span>${byDay[day].length} evento${byDay[day].length === 1 ? '' : 's'} · Saldo: ${fmtAmount(balance)}</span>
                    </div>
                    ${renderEventList(byDay[day])}
                </div>
            `;
        }).join('')}</div>`;
    }

    /* --- Lista de eventos reutilizable --- */
    function renderEventList(events) {
        if (!events.length) return '<div class="cal-sidebar-empty">Sin movimientos este día.</div>';
        return events.map(ev => {
            const isPos = ev.amount > 0;
            const iconBg = ev.isFinancial
                ? (isPos ? 'color-mix(in srgb, var(--success) 15%, transparent)' : 'color-mix(in srgb, var(--danger) 12%, transparent)')
                : 'color-mix(in srgb, var(--primary) 12%, transparent)';
            const iconClr = ev.isFinancial
                ? (isPos ? 'var(--success)' : 'var(--danger)')
                : 'var(--primary)';
            const icon = ev.amount != null ? (isPos ? 'fa-arrow-down' : 'fa-arrow-up') : 'fa-circle';

            return `
                <div class="cal-sidebar-item" data-event-id="${ev.id}">
                    <div class="cal-sidebar-item-icon" style="background:${iconBg};color:${iconClr}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="cal-sidebar-item-info">
                        <div class="cal-sidebar-item-title">${esc(ev.title)}</div>
                        <div class="cal-sidebar-item-meta">
                            ${ev.time ? `<span>⏰ ${esc(ev.time)}</span>` : ''}
                            <span>${ev.source}</span>
                            ${ev.status ? `<span>${ev.status}</span>` : ''}
                        </div>
                    </div>
                    ${ev.amount != null
                        ? `<div class="cal-sidebar-item-amt ${ev.amount > 0 ? 'pos' : 'neg'}">${ev.amount > 0 ? '+' : ''}${fmtAmount(ev.amount)}</div>`
                        : ''}
                </div>`;
        }).join('');
    }

    /* --- Sidebar --- */
    function renderSidebarContent() {
        const iso = state.selectedDate || todayISO();
        const events = getEventsForDay(iso);
        const income = sumIncome(events);
        const expense = sumExpense(events);
        const balance = getProjectedBalance(iso);
        const isToday = iso === todayISO();

        return `
            <div class="cal-sidebar-header ${isToday ? 'is-today' : ''}">
                <div class="cal-sidebar-date">${fmtDayLong(iso)}</div>
                <div class="cal-sidebar-sub">${events.length} movimiento${events.length === 1 ? '' : 's'}${isToday ? ' · <span class="cal-today-pill sm">HOY</span>' : ''}</div>
            </div>
            <div class="cal-sidebar-kpis">
                <div class="cal-sidebar-kpi income">
                    <div class="cal-sidebar-kpi-label">Ingresos</div>
                    <div class="cal-sidebar-kpi-value">${fmtAmount(income)}</div>
                </div>
                <div class="cal-sidebar-kpi expense">
                    <div class="cal-sidebar-kpi-label">Gastos</div>
                    <div class="cal-sidebar-kpi-value">${fmtAmount(expense)}</div>
                </div>
            </div>
            <div class="cal-sidebar-balance">
                <div class="cal-sidebar-balance-box">
                    <div class="cal-sidebar-balance-label">Saldo proyectado al cierre</div>
                    <div class="cal-sidebar-balance-value">${fmtAmount(balance)}</div>
                </div>
            </div>
            <div class="cal-sidebar-list">
                ${renderEventList(events)}
            </div>
        `;
    }

    /* --- Modal de detalle --- */
    function renderDetailModal() {
        return `
            <div class="cal-modal-overlay" id="calDetailModal">
                <div class="cal-modal">
                    <div class="cal-modal-header">
                        <div class="cal-modal-title" id="calDetailTitle">Detalle</div>
                        <button class="cal-modal-close" data-action="close-modal">×</button>
                    </div>
                    <div class="cal-modal-body" id="calDetailBody"></div>
                    <div class="cal-modal-footer" id="calDetailFooter"></div>
                </div>
            </div>
            <div class="cal-modal-overlay" id="calNumberModal">
                <div class="cal-modal" style="max-width:420px">
                    <div class="cal-modal-header">
                        <div class="cal-modal-title" id="calNumberTitle">Introducir importe</div>
                        <button class="cal-modal-close" data-action="close-number-modal">×</button>
                    </div>
                    <div class="cal-modal-body">
                        <label class="cal-form-label" style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);display:block;margin-bottom:6px">Importe (€)</label>
                        <input class="cal-form-input" type="number" step="0.01" id="calNumberInput" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:16px;font-weight:700;font-family:inherit">
                    </div>
                    <div class="cal-modal-footer">
                        <button class="cal-btn-ghost" data-action="close-number-modal">Cancelar</button>
                        <button class="cal-btn-primary" id="calNumberConfirm">Confirmar</button>
                    </div>
                </div>
            </div>
        `;
    }

    /* =========================== EVENTOS =========================== */
    function bind() {
        if (!containerEl) return;
        containerEl.addEventListener('click', onClick);
        if (!listenersBound) {
            document.addEventListener('app:module-changed', onModuleChange);
            listenersBound = true;
        }
    }

    function onModuleChange(e) {
        if (!containerEl || !containerEl.isConnected) return;
        const src = e && e.detail && e.detail.source;
        if (src === 'calendario') return;
        // Re-render si algún módulo del que dependemos cambia
        try { render(containerEl); } catch (err) { /* noop */ }
    }

    function onClick(e) {
        // 1. Chip de evento
        const chip = e.target.closest('[data-event-id]');
        if (chip) { e.stopPropagation(); openEventDetail(chip.dataset.eventId); return; }
        // 2. Acción explícita
        const actionEl = e.target.closest('[data-action]');
        if (actionEl) { handleAction(actionEl.dataset.action, actionEl); return; }
        // 3. Clic en día
        const dayCell = e.target.closest('[data-date]');
        if (dayCell) { selectDay(dayCell.dataset.date); return; }
        // 4. Clic fuera del modal
        if (e.target.classList.contains('cal-modal-overlay')) e.target.classList.remove('active');
    }

    function handleAction(action, el) {
        switch (action) {
            case 'nav-prev': navigate(-1); break;
            case 'nav-next': navigate(+1); break;
            case 'nav-today':
                state.currentDate = new Date();
                state.selectedDate = todayISO();
                render(containerEl);
                break;
            case 'switch-view':
                state.currentView = el.dataset.view;
                render(containerEl);
                break;
            case 'close-modal':
                el.closest('.cal-modal-overlay').classList.remove('active');
                break;
            case 'close-number-modal':
                document.getElementById('calNumberModal').classList.remove('active');
                break;
            case 'go-origin':
                goToOrigin(el.dataset.section, el.dataset.originId, el.dataset.tripId);
                break;
            case 'toggle-status':
                toggleExpenseStatus(el.dataset.originId);
                break;
            case 'confirm-income':
                confirmIncome(el.dataset.originId, el.dataset.person);
                break;
            case 'mark-paid':
                markExpensePaid(el.dataset.originId);
                break;
        }
    }

    function navigate(delta) {
        if (state.currentView === 'agenda') return;
        if (state.currentView === 'semana') {
            state.currentDate = addDays(state.currentDate, delta * 7);
        } else {
            state.currentDate = addMonths(state.currentDate, delta);
        }
        render(containerEl);
    }

    function selectDay(iso) {
        state.selectedDate = iso;
        const sidebar = containerEl.querySelector('#calSidebar');
        if (sidebar) sidebar.innerHTML = renderSidebarContent();
        containerEl.querySelectorAll('[data-date]').forEach(el => {
            el.classList.toggle('selected', el.dataset.date === iso);
        });
    }

    /* =========================== ACCIONES CONTEXTUALES =========================== */

    /** Ingresos · abrir modal de importe y confirmar cobro */
    function confirmIncome(originId, pid) {
        // salary-${pid}-${mk}
        const salaryMatch = String(originId).match(/^salary-(.+)-(\d{4}-\d{2})$/);
        if (salaryMatch) {
            const [, personId, mk] = salaryMatch;
            const sal = (window.App && typeof App.getSalary === 'function') ? App.getSalary(personId, mk) : null;
            const theo = sal ? (sal.real != null ? sal.real : sal.theoretical) : 0;
            openNumberModal(`Cobro real · ${getPersonName(personId)} · ${mk}`, theo, (amount) => {
                if (window.App && typeof App.confirmIncomeReceipt === 'function') {
                    App.confirmIncomeReceipt(personId, mk, amount);
                } else if (window.App) {
                    App.showToast('Confirma el cobro desde Ingresos personales', 'info');
                    App.navigateTo && App.navigateTo('ingresos-personales');
                }
                closeDetailModal();
                render(containerEl);
            });
            return;
        }
        // extra-${pid}-${mk}-${itemId}
        const extraMatch = String(originId).match(/^extra-(.+)-(\d{4}-\d{2})-(.+)$/);
        if (extraMatch) {
            const [, personId, mk, itemId] = extraMatch;
            const items = (window.App && typeof App.getMonthExtras === 'function')
                ? App.getMonthExtras(personId, mk) || []
                : [];
            const item = items.find(x => x.id === itemId);
            const theo = item ? item.amount : 0;
            openNumberModal(`Cobro extra · ${getPersonName(personId)} · ${mk}`, theo, (amount) => {
                if (window.App && typeof App.confirmExtraReceipt === 'function') {
                    App.confirmExtraReceipt(personId, mk, itemId, amount);
                } else if (window.App) {
                    App.showToast('Confirma el cobro desde Ingresos personales', 'info');
                    App.navigateTo && App.navigateTo('ingresos-personales');
                }
                closeDetailModal();
                render(containerEl);
            });
            return;
        }
        // Bonus · no se puede confirmar desde aquí
        if (window.App) App.showToast('Los bonus se confirman desde Ingresos personales', 'info');
    }

    /** Presupuesto · marcar como pagado delegando en el módulo */
    function markExpensePaid(expenseId) {
        if (!expenseId) return;
        if (window.App && typeof App.goTo === 'function') {
            // Invocación sin navegar: llamamos directamente al bridge
            const mod = (App.data && App.data) ? true : true;
            try {
                // Presupuesto expone setExpenseStatus en su API pública
                const pcApi = window.BudgetApp;
                if (pcApi && typeof pcApi.setExpenseStatus === 'function') {
                    pcApi.setExpenseStatus(expenseId, 'registrado');
                } else {
                    // Fallback: mutation directa
                    const exp = (App.data.expenses || []).find(e => e.id === expenseId);
                    if (exp) {
                        exp.status = 'registrado';
                        App.saveData();
                        App.notifyModuleChange && App.notifyModuleChange('presupuesto-comun', { reason: 'expense-status', expenseId });
                    }
                }
                closeDetailModal();
                render(containerEl);
                App.showToast && App.showToast('Gasto marcado como registrado', 'success');
            } catch (err) { /* noop */ }
        }
    }

    function goToOrigin(section, originId, tripId) {
        closeDetailModal();
        if (!section) return;
        if (section === 'presupuesto-comun' && typeof App.goTo === 'function') {
            App.goTo('presupuesto-comun', 'openExpenseModal', [originId]);
        } else if (section === 'viajes' && typeof App.goTo === 'function') {
            App.goTo('viajes', 'openTripDetail', [tripId || originId, 'resumen']);
        } else if (section === 'mi-dinero') {
            App.navigateTo && App.navigateTo('mi-dinero');
        } else if (section === 'ingresos-personales') {
            App.navigateTo && App.navigateTo('ingresos-personales');
        } else if (typeof App.navigateTo === 'function') {
            App.navigateTo(section);
        }
    }

    function toggleExpenseStatus(expenseId) {
        const exp = (App.data.expenses || []).find(x => x.id === expenseId);
        if (!exp) return;
        const cyc = { pendiente: 'registrado', previsto: 'registrado', registrado: 'pendiente' };
        exp.status = cyc[exp.status] || 'registrado';
        App.saveData();
        if (typeof App.addHistory === 'function') {
            App.addHistory('presupuesto-comun', `Estado cambiado a ${exp.status}: ${exp.concept}`);
        }
        if (typeof App.notifyModuleChange === 'function') {
            App.notifyModuleChange('calendario', { reason: 'expense-status' });
        }
        render(containerEl);
        if (App.showToast) App.showToast(`Estado actualizado: ${exp.status}`, 'success');
    }

    /* =========================== MODALES =========================== */
    function closeDetailModal() {
        const m = document.getElementById('calDetailModal');
        if (m) m.classList.remove('active');
    }

    function openNumberModal(label, defaultValue, onSave) {
        const modal = document.getElementById('calNumberModal');
        const title = document.getElementById('calNumberTitle');
        const input = document.getElementById('calNumberInput');
        const btn = document.getElementById('calNumberConfirm');
        title.textContent = label;
        input.value = Number(defaultValue || 0).toFixed(2);

        const close = () => modal.classList.remove('active');
        const confirm = () => {
            const val = parseFloat(input.value);
            if (isNaN(val)) return;
            modal.classList.remove('active');
            onSave(val);
        };
        btn.onclick = confirm;
        input.onkeydown = (e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') close(); };
        modal.classList.add('active');
        setTimeout(() => { input.focus(); input.select(); }, 50);
    }

    function findEventById(id) {
        return getAllEvents('2000-01-01', '2100-12-31').find(e => e.id === id) || null;
    }

    function openEventDetail(eventId) {
        const ev = findEventById(eventId);
        if (!ev) return;

        const modal = document.getElementById('calDetailModal');
        const title = document.getElementById('calDetailTitle');
        const body = document.getElementById('calDetailBody');
        const footer = document.getElementById('calDetailFooter');

        title.textContent = ev.title;

        body.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
                <div>
                    <div class="cal-modal-meta-label">Fecha</div>
                    <div style="font-weight:600">${fmtDayLong(ev.date)}</div>
                </div>
                <div>
                    <div class="cal-modal-meta-label">Tipo</div>
                    <div style="font-weight:600;text-transform:capitalize">${ev.type}</div>
                </div>
                ${ev.amount != null ? `
                <div>
                    <div class="cal-modal-meta-label">Importe</div>
                    <div style="font-weight:800;font-size:17px;color:${ev.amount > 0 ? 'var(--success)' : 'var(--danger)'}">
                        ${ev.amount > 0 ? '+' : ''}${fmtAmount(ev.amount)}
                    </div>
                </div>` : ''}
                <div>
                    <div class="cal-modal-meta-label">Origen</div>
                    <div style="font-weight:600;text-transform:capitalize">${ev.source}</div>
                </div>
            </div>
            ${ev.time ? `<div class="cal-modal-row"><strong>Hora:</strong> ${esc(ev.time)}</div>` : ''}
            ${ev.person ? `<div class="cal-modal-row"><strong>Persona:</strong> ${App.getProfileName(ev.person)}</div>` : ''}
            ${ev.status ? `<div class="cal-modal-row"><strong>Estado:</strong> ${ev.status}</div>` : ''}
            ${ev.notes ? `<div class="cal-modal-row"><strong>Notas:</strong> ${esc(ev.notes)}</div>` : ''}
        `;

        const btns = [];

        if (ev.source === 'ingresos') {
            if (ev.status !== 'registrado' && ev.originId.startsWith('salary-')) {
                btns.push(`<button class="cal-btn-primary" data-action="confirm-income" data-origin-id="${ev.originId}" data-person="${ev.person}">✓ Registrar cobro real</button>`);
            } else if (ev.status !== 'registrado' && ev.originId.startsWith('extra-')) {
                btns.push(`<button class="cal-btn-primary" data-action="confirm-income" data-origin-id="${ev.originId}" data-person="${ev.person}">✓ Registrar cobro extra</button>`);
            }
            btns.push(`<button class="cal-btn-ghost" data-action="go-origin" data-section="ingresos-personales" data-origin-id="${ev.originId}">Abrir en Ingresos</button>`);
        } else if (ev.source === 'presupuesto') {
            if (ev.status !== 'registrado') {
                btns.push(`<button class="cal-btn-primary" data-action="mark-paid" data-origin-id="${ev.originId}">✓ Marcar pagado</button>`);
            } else {
                btns.push(`<button class="cal-btn-ghost" data-action="toggle-status" data-origin-id="${ev.originId}">↺ Marcar pendiente</button>`);
            }
            btns.push(`<button class="cal-btn-ghost" data-action="go-origin" data-section="presupuesto-comun" data-origin-id="${ev.originId}">Abrir en Presupuesto</button>`);
        } else if (ev.source === 'dinero') {
            btns.push(`<button class="cal-btn-primary" data-action="go-origin" data-section="mi-dinero" data-origin-id="${ev.originId}">Abrir en Dinero</button>`);
        } else if (ev.source === 'viajes') {
            btns.push(`<button class="cal-btn-primary" data-action="go-origin" data-section="viajes" data-origin-id="${ev.originId}" data-trip-id="${ev.tripId || ''}">Abrir en Viajes</button>`);
        }
        btns.push(`<button class="cal-btn-ghost" data-action="close-modal">Cerrar</button>`);
        footer.innerHTML = btns.join('');

        modal.classList.add('active');
    }

    /* =========================== INIT / API =========================== */
    function init(container) {
        if (container) containerEl = container;
        ensureStructures();
    }

    return {
        render, init,
        getEventsForDay,
        getProjectedBalance,
        getCurrentBalance: currentBalance,
        getState: () => ({
            currentDate: toISO(state.currentDate),
            selectedDate: state.selectedDate,
            currentView: state.currentView
        })
    };
})();

if (window.App) {
    App.registerSection('calendario', CalendarApp);
    App.registerModule('calendario', CalendarApp);
}
window.CalendarApp = CalendarApp;