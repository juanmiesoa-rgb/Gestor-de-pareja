/* =============================================================
   CALENDARIO.JS
   Sección completa con vistas: Calendario (Mes/Semana/Agenda),
   Próximos movimientos y Configuración.
   Integra eventos de Presupuesto, Viajes, Cuentas y manuales.
   ============================================================= */
const CalendarApp = (function () {
    'use strict';

    // =========================================================
    // ESTILOS ESPECÍFICOS
    // =========================================================
    // CSS del módulo → inyección estandarizada (App.injectStylesheet)
    function moduleCSS() { return `
            /* Sub-navegación */
            .cal-subnav {
                display: flex; gap: 4px;
                border-bottom: 1px solid var(--border);
                margin-bottom: 20px;
                overflow-x: auto;
            }
            .cal-subnav-item {
                padding: 10px 16px;
                background: none; border: none;
                color: var(--text-secondary);
                font-size: 14px; font-weight: 500;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                margin-bottom: -1px;
                transition: all 0.15s;
                white-space: nowrap;
                font-family: inherit;
                display: inline-flex; align-items: center; gap: 6px;
            }
            .cal-subnav-item:hover { color: var(--text); }
            .cal-subnav-item.active { color: var(--primary); border-bottom-color: var(--primary); }

            .cal-subview { display: none; }
            .cal-subview.active { display: block; }

            /* Header del calendario */
            .cal-header {
                display: flex; justify-content: space-between; align-items: center;
                flex-wrap: wrap; gap: 12px; margin-bottom: 20px;
            }
            .cal-nav { display: flex; align-items: center; gap: 8px; }
            .cal-title { font-size: 20px; font-weight: 700; min-width: 200px; text-align: center; }
            .cal-view-selector { display: flex; background: var(--border-light); border-radius: var(--radius-sm); padding: 2px; }
            .cal-view-btn {
                padding: 6px 12px; border: none; background: transparent;
                color: var(--text-secondary); font-size: 13px; font-weight: 500;
                cursor: pointer; border-radius: 4px; font-family: inherit;
            }
            .cal-view-btn.active { background: var(--bg-card); color: var(--text); box-shadow: var(--shadow-sm); }

            /* Resumen financiero */
            .cal-summary {
                display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 12px; margin-bottom: 20px;
            }
            .cal-summary-card {
                background: var(--bg-card); border: 1px solid var(--border);
                border-radius: var(--radius-sm); padding: 12px;
            }
            .cal-summary-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; }
            .cal-summary-value { font-size: 18px; font-weight: 700; }
            .cal-summary-value.income { color: var(--success); }
            .cal-summary-value.expense { color: var(--danger); }

            /* Vista Mensual */
            .cal-month-grid {
                display: grid; grid-template-columns: repeat(7, 1fr);
                gap: 1px; background: var(--border);
                border: 1px solid var(--border); border-radius: var(--radius);
                overflow: hidden;
            }
            .cal-day-header {
                background: var(--bg-card); padding: 8px;
                text-align: center; font-size: 12px; font-weight: 600;
                color: var(--text-secondary); text-transform: uppercase;
            }
            .cal-day {
                background: var(--bg-card); min-height: 100px;
                padding: 6px; cursor: pointer; transition: background 0.15s;
                position: relative;
            }
            .cal-day:hover { background: var(--border-light); }
            .cal-day.other-month { background: var(--border-light); opacity: 0.6; }
            .cal-day.today { background: var(--primary-light); }
            .cal-day-num {
                font-size: 13px; font-weight: 600; margin-bottom: 4px;
                display: flex; justify-content: space-between;
            }
            .cal-day.today .cal-day-num { color: var(--primary); }
            .cal-event-chip {
                font-size: 11px; padding: 2px 6px; border-radius: 4px;
                margin-bottom: 2px; white-space: nowrap; overflow: hidden;
                text-overflow: ellipsis; cursor: pointer;
                display: flex; align-items: center; gap: 4px;
            }
            .cal-event-chip.gasto { background: var(--danger-light); color: var(--danger); }
            .cal-event-chip.ingreso { background: var(--success-light); color: var(--success); }
            .cal-event-chip.viaje { background: var(--info-light); color: var(--info); }
            .cal-event-chip.actividad { background: var(--warning-light); color: var(--warning); }
            .cal-event-chip.pago { background: #fef3c7; color: #d97706; border: 1px solid #fcd34d; }
            .cal-event-chip.transferencia { background: var(--border-light); color: var(--text-secondary); }
            .cal-event-chip.manual { background: #e0e7ff; color: #4338ca; }
            .cal-more { font-size: 10px; color: var(--primary); cursor: pointer; margin-top: 2px; }

            /* Vista Semanal */
            .cal-week-grid {
                display: grid; grid-template-columns: 60px repeat(7, 1fr);
                gap: 1px; background: var(--border);
                border: 1px solid var(--border); border-radius: var(--radius);
                overflow-x: auto;
            }
            .cal-week-header {
                background: var(--bg-card); padding: 8px;
                text-align: center; font-size: 12px; font-weight: 600;
            }
            .cal-week-header.today { color: var(--primary); background: var(--primary-light); }
            .cal-week-col {
                background: var(--bg-card); min-height: 400px;
                padding: 4px; position: relative;
            }
            .cal-week-event {
                font-size: 11px; padding: 4px 6px; border-radius: 4px;
                margin-bottom: 4px; border-left: 3px solid;
                cursor: pointer;
            }

            /* Vista Agenda */
            .cal-agenda-list { display: flex; flex-direction: column; gap: 16px; }
            .cal-agenda-date-group {
                background: var(--bg-card); border: 1px solid var(--border);
                border-radius: var(--radius); overflow: hidden;
            }
            .cal-agenda-date-header {
                padding: 10px 14px; background: var(--border-light);
                font-size: 13px; font-weight: 600; color: var(--text-secondary);
                display: flex; justify-content: space-between;
            }
            .cal-agenda-item {
                padding: 12px 14px; border-bottom: 1px solid var(--border-light);
                display: flex; align-items: center; gap: 12px;
                cursor: pointer; transition: background 0.15s;
            }
            .cal-agenda-item:last-child { border-bottom: none; }
            .cal-agenda-item:hover { background: var(--border-light); }
            .cal-agenda-icon {
                width: 36px; height: 36px; border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                font-size: 14px; flex-shrink: 0;
            }
            .cal-agenda-info { flex: 1; min-width: 0; }
            .cal-agenda-title { font-size: 14px; font-weight: 500; margin-bottom: 2px; }
            .cal-agenda-meta { font-size: 11px; color: var(--text-muted); display: flex; gap: 8px; flex-wrap: wrap; }
            .cal-agenda-amount { font-size: 14px; font-weight: 600; text-align: right; }

            /* Próximos movimientos */
            .cal-upcoming-list { display: flex; flex-direction: column; gap: 12px; }
            .cal-upcoming-card {
                background: var(--bg-card); border: 1px solid var(--border);
                border-radius: var(--radius); padding: 14px;
                display: flex; align-items: center; gap: 14px;
                cursor: pointer; transition: all 0.2s;
            }
            .cal-upcoming-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
            .cal-upcoming-card.urgent { border-left: 3px solid var(--danger); }
            .cal-upcoming-card.warning { border-left: 3px solid var(--warning); }
            .cal-upcoming-card.normal { border-left: 3px solid var(--primary); }

            /* Modal */
            .cal-modal {
                display: none; position: fixed; inset: 0;
                background: rgba(0,0,0,0.5); z-index: 1000;
                align-items: center; justify-content: center; padding: 20px;
            }
            .cal-modal.active { display: flex; }
            .cal-modal-content {
                background: var(--bg-card); border-radius: var(--radius-lg);
                max-width: 600px; width: 100%; max-height: 90vh;
                overflow-y: auto; box-shadow: var(--shadow-md);
            }
            .cal-modal-header {
                padding: 20px; border-bottom: 1px solid var(--border);
                display: flex; justify-content: space-between; align-items: center;
            }
            .cal-modal-title { font-size: 16px; font-weight: 600; }
            .cal-modal-close {
                background: none; border: none; color: var(--text-muted);
                cursor: pointer; font-size: 18px; padding: 4px;
            }
            .cal-modal-body { padding: 20px; }
            .cal-modal-footer {
                padding: 16px 20px; border-top: 1px solid var(--border);
                display: flex; justify-content: flex-end; gap: 8px;
            }

            /* Forms */
            .cal-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
            .cal-form-row.single { grid-template-columns: 1fr; }
            @media (max-width: 768px) { .cal-form-row { grid-template-columns: 1fr; } }
            .cal-form-group { margin-bottom: 14px; }
            .cal-form-label { display: block; font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-bottom: 6px; }
            .cal-form-input, .cal-form-select, .cal-form-textarea {
                width: 100%; padding: 9px 12px; border: 1px solid var(--border);
                border-radius: var(--radius-sm); background: var(--bg-card);
                color: var(--text); font-size: 13px; font-family: inherit;
            }
            .cal-form-input:focus, .cal-form-select:focus { outline: none; border-color: var(--primary); }
            .cal-form-textarea { resize: vertical; min-height: 70px; }

            /* Filtros */
            .cal-filters-bar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
            .cal-filter-select {
                padding: 9px 32px 9px 12px; border: 1px solid var(--border);
                border-radius: var(--radius-sm); background: var(--bg-card);
                color: var(--text); font-size: 13px; cursor: pointer;
                appearance: none; font-family: inherit;
                background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
                background-repeat: no-repeat; background-position: right 10px center;
            }

            /* Mobile */
            @media (max-width: 768px) {
                .cal-month-grid { font-size: 11px; }
                .cal-day { min-height: 70px; padding: 4px; }
                .cal-event-chip { font-size: 9px; padding: 1px 4px; }
                .cal-week-grid { display: none; } /* En móvil, priorizar Agenda */
            }
    `; }

    // =========================================================
    // ESTADO Y DATOS
    // =========================================================
    let currentDate = new Date(2026, 9, 1); // Octubre 2026
    let currentView = 'mes'; // mes, semana, agenda, proximos, configuracion
    let filters = { type: 'all', person: 'all', source: 'all' };
    let containerEl = null;

    function ensureDataStructures() {
        if (!App.data.calendarEvents) App.data.calendarEvents = [];
        if (!App.data.transfers) App.data.transfers = [];
    }

    // =========================================================
    // AGREGACIÓN DE EVENTOS (Single Source of Truth)
    // =========================================================
    function getEventsForRange(startStr, endStr) {
        ensureDataStructures();
        const events = [];

        // 1. Eventos manuales del calendario
        App.data.calendarEvents.forEach(ev => {
            if (ev.date >= startStr && ev.date <= endStr) {
                events.push({ ...ev, source: 'manual', isFinancial: ev.amount !== null && ev.amount !== undefined });
            }
        });

        // 2. Gastos e ingresos (Presupuesto / Mi dinero)
        if (App.data.expenses) {
            App.data.expenses.forEach(exp => {
                if (exp.date >= startStr && exp.date <= endStr) {
                    // Mostrar previstos, pendientes, o registrados futuros
                    if (['previsto', 'pendiente', 'registrado'].includes(exp.status)) {
                        events.push({
                            id: 'exp-' + exp.id,
                            originId: exp.id,
                            source: 'presupuesto',
                            type: exp.amount > 0 ? 'ingreso' : 'gasto',
                            title: exp.concept,
                            date: exp.date,
                            amount: exp.amount,
                            status: exp.status,
                            person: exp.person,
                            categoryId: exp.categoryId,
                            isFinancial: true,
                            originSection: 'presupuesto-comun'
                        });
                    }
                }
            });
        }

        // 3. Viajes (Salidas y regresos)
        if (App.data.trips) {
            App.data.trips.forEach(trip => {
                if (trip.startDate >= startStr && trip.startDate <= endStr && trip.status !== 'cancelado') {
                    events.push({
                        id: 'trip-start-' + trip.id, originId: trip.id, source: 'viajes',
                        type: 'viaje', title: `Salida: ${trip.name}`, date: trip.startDate,
                        tripId: trip.id, isFinancial: false, originSection: 'viajes'
                    });
                }
                if (trip.endDate >= startStr && trip.endDate <= endStr && trip.status !== 'cancelado') {
                    events.push({
                        id: 'trip-end-' + trip.id, originId: trip.id, source: 'viajes',
                        type: 'viaje', title: `Regreso: ${trip.name}`, date: trip.endDate,
                        tripId: trip.id, isFinancial: false, originSection: 'viajes'
                    });
                }
            });
        }

        // 4. Actividades de viaje
        if (App.data.tripActivities) {
            App.data.tripActivities.forEach(act => {
                if (act.date >= startStr && act.date <= endStr) {
                    events.push({
                        id: 'act-' + act.id, originId: act.id, source: 'viajes',
                        type: 'actividad', title: act.title, date: act.date, time: act.time,
                        tripId: act.tripId, amount: act.estimatedCost,
                        isFinancial: act.estimatedCost > 0, originSection: 'viajes'
                    });
                }
            });
        }

        // 5. Reservas de viaje (fechas de pago pendiente)
        if (App.data.tripReservations) {
            App.data.tripReservations.forEach(res => {
                if (res.status !== 'pagado' && res.status !== 'cancelado') {
                    res.paymentDates.forEach(pDate => {
                        if (pDate >= startStr && pDate <= endStr) {
                            events.push({
                                id: 'res-pay-' + res.id + '-' + pDate, originId: res.id,
                                source: 'viajes', type: 'pago', title: `Pago: ${res.concept}`,
                                date: pDate, amount: res.pendingAmount, tripId: res.tripId,
                                isFinancial: true, originSection: 'viajes'
                            });
                        }
                    });
                }
            });
        }

        // 6. Transferencias (Cuentas)
        if (App.data.transfers) {
            App.data.transfers.forEach(tr => {
                if (tr.date >= startStr && tr.date <= endStr && tr.status !== 'cancelado') {
                    events.push({
                        id: 'tr-' + tr.id, originId: tr.id, source: 'cuentas',
                        type: 'transferencia', title: tr.concept, date: tr.date,
                        amount: tr.amount, isFinancial: true, originSection: 'cuentas'
                    });
                }
            });
        }

        // Filtrar y ordenar
        return events.filter(ev => {
            if (filters.type !== 'all' && ev.type !== filters.type) return false;
            if (filters.person !== 'all' && ev.person !== filters.person) return false;
            if (filters.source !== 'all' && ev.source !== filters.source) return false;
            return true;
        }).sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return (a.time || '').localeCompare(b.time || '');
        });
    }

    function getEventsForDay(dateStr) {
        return getEventsForRange(dateStr, dateStr);
    }

    // =========================================================
    // RENDER PRINCIPAL
    // =========================================================
    function render(container) {
        App.injectStylesheet('calendar-styles', moduleCSS());
        containerEl = container;

        container.innerHTML = `
            <div class="cal-subnav">
                <button class="cal-subnav-item active" data-view="calendario"><i class="fas fa-calendar-alt"></i> Calendario</button>
                <button class="cal-subnav-item" data-view="proximos"><i class="fas fa-clock"></i> Próximos movimientos</button>
                <button class="cal-subnav-item" data-view="configuracion"><i class="fas fa-cog"></i> Configuración</button>
            </div>

            <div class="cal-subview active" id="calView-calendario"></div>
            <div class="cal-subview" id="calView-proximos"></div>
            <div class="cal-subview" id="calView-configuracion"></div>

            <!-- Modal Detalle Evento -->
            <div class="cal-modal" id="calDetailModal">
                <div class="cal-modal-content">
                    <div class="cal-modal-header">
                        <h3 class="cal-modal-title" id="calDetailTitle">Detalle del evento</h3>
                        <button class="cal-modal-close" data-close-cal><i class="fas fa-times"></i></button>
                    </div>
                    <div class="cal-modal-body" id="calDetailBody"></div>
                    <div class="cal-modal-footer" id="calDetailFooter"></div>
                </div>
            </div>

            <!-- Modal Crear/Editar Evento Manual -->
            <div class="cal-modal" id="calFormModal">
                <div class="cal-modal-content">
                    <div class="cal-modal-header">
                        <h3 class="cal-modal-title" id="calFormTitle">Nuevo evento</h3>
                        <button class="cal-modal-close" data-close-cal><i class="fas fa-times"></i></button>
                    </div>
                    <div class="cal-modal-body" id="calFormBody"></div>
                    <div class="cal-modal-footer">
                        <button class="btn btn-secondary" data-close-cal>Cancelar</button>
                        <button class="btn btn-primary" id="calSaveEventBtn"><i class="fas fa-save"></i> Guardar</button>
                    </div>
                </div>
            </div>
        `;

        bindGlobalEvents();
        renderCurrentView();
    }

    function bindGlobalEvents() {
        containerEl.querySelectorAll('.cal-subnav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                currentView = view === 'calendario' ? 'mes' : view;
                containerEl.querySelectorAll('.cal-subnav-item').forEach(b => b.classList.toggle('active', b === btn));
                containerEl.querySelectorAll('.cal-subview').forEach(v => {
                    if (view === 'calendario') v.classList.toggle('active', v.id === 'calView-calendario');
                    else v.classList.toggle('active', v.id === `calView-${view}`);
                });
                renderCurrentView();
            });
        });

        containerEl.querySelectorAll('[data-close-cal]').forEach(btn => {
            btn.addEventListener('click', () => btn.closest('.cal-modal').classList.remove('active'));
        });
        containerEl.querySelectorAll('.cal-modal').forEach(modal => {
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
        });

        containerEl.querySelector('#calSaveEventBtn').addEventListener('click', saveManualEvent);
    }

    function renderCurrentView() {
        if (currentView === 'mes' || currentView === 'semana' || currentView === 'agenda') {
            renderCalendarioWrapper();
        } else if (currentView === 'proximos') {
            renderProximos();
        } else if (currentView === 'configuracion') {
            renderConfiguracion();
        }
    }

    // =========================================================
    // VISTA: CALENDARIO (Wrapper)
    // =========================================================
    function renderCalendarioWrapper() {
        const view = containerEl.querySelector('#calView-calendario');
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const monthName = months[currentDate.getMonth()];
        const year = currentDate.getFullYear();

        // Calcular resumen financiero del mes visible
        const startOfMonth = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`;
        const endOfMonth = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${new Date(year, currentDate.getMonth() + 1, 0).getDate()}`;
        const monthEvents = getEventsForRange(startOfMonth, endOfMonth);
        const totalIncome = monthEvents.filter(e => e.isFinancial && e.amount > 0).reduce((s, e) => s + e.amount, 0);
        const totalExpense = monthEvents.filter(e => e.isFinancial && e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);
        const pendingPayments = monthEvents.filter(e => e.type === 'pago' || (e.isFinancial && e.status === 'previsto')).length;

        view.innerHTML = `
            <div class="cal-header">
                <div class="cal-nav">
                    <button class="btn btn-sm btn-secondary" id="calPrev"><i class="fas fa-chevron-left"></i></button>
                    <button class="btn btn-sm btn-secondary" id="calToday">Hoy</button>
                    <button class="btn btn-sm btn-secondary" id="calNext"><i class="fas fa-chevron-right"></i></button>
                    <div class="cal-title">${monthName} ${year}</div>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                    <div class="cal-view-selector">
                        <button class="cal-view-btn ${currentView === 'mes' ? 'active' : ''}" data-cal-view="mes">Mes</button>
                        <button class="cal-view-btn ${currentView === 'semana' ? 'active' : ''}" data-cal-view="semana">Semana</button>
                        <button class="cal-view-btn ${currentView === 'agenda' ? 'active' : ''}" data-cal-view="agenda">Agenda</button>
                    </div>
                    <select class="cal-filter-select" id="calFilterType">
                        <option value="all">Todos los tipos</option>
                        <option value="gasto">Gastos</option>
                        <option value="ingreso">Ingresos</option>
                        <option value="pago">Pagos pendientes</option>
                        <option value="viaje">Viajes</option>
                        <option value="actividad">Actividades</option>
                        <option value="transferencia">Transferencias</option>
                        <option value="manual">Recordatorios</option>
                    </select>
                    <button class="btn btn-sm btn-primary" id="calNewEvent"><i class="fas fa-plus"></i> Crear evento</button>
               9>
            </div>

            <div class="cal-summary">
                <div class="cal-summary-card">
                    <div class="cal-summary-label">Ingresos previstos</div>
                    <div class="cal-summary-value income">${App.formatCurrency(totalIncome)}</div>
                </div>
                <div class="cal-summary-card">
                    <div class="cal-summary-label">Gastos previstos</div>
                    <div class="cal-summary-value expense">${App.formatCurrency(totalExpense)}</div>
                </div>
                <div class="cal-summary-card">
                    <div class="cal-summary-label">Pagos pendientes</div>
                    <div class="cal-summary-value">${pendingPayments} eventos</div>
                </div>
            </div>

            <div id="calGridContainer"></div>
        `;

        // Eventos de navegación
        view.querySelector('#calPrev').addEventListener('click', () => {
            if (currentView === 'mes') currentDate.setMonth(currentDate.getMonth() - 1);
            else currentDate.setDate(currentDate.getDate() - 7);
            renderCalendarioWrapper();
        });
        view.querySelector('#calNext').addEventListener('click', () => {
            if (currentView === 'mes') currentDate.setMonth(currentDate.getMonth() + 1);
            else currentDate.setDate(currentDate.getDate() + 7);
            renderCalendarioWrapper();
        });
        view.querySelector('#calToday').addEventListener('click', () => {
            currentDate = new Date(2026, 9, 1); // Forzado a la fecha demo
            renderCalendarioWrapper();
        });
        view.querySelector('#calNewEvent').addEventListener('click', () => openManualEventForm());
        view.querySelector('#calFilterType').addEventListener('change', (e) => {
            filters.type = e.target.value;
            renderCalendarioWrapper();
        });

        view.querySelectorAll('[data-cal-view]').forEach(btn => {
            btn.addEventListener('click', () => {
                currentView = btn.dataset.calView;
                renderCalendarioWrapper();
            });
        });

        if (currentView === 'mes') renderMonthView();
        else if (currentView === 'semana') renderWeekView();
        else if (currentView === 'agenda') renderAgendaView();
    }

    // =========================================================
    // VISTA: MES
    // =========================================================
    function renderMonthView() {
        const container = containerEl.querySelector('#calGridContainer');
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startOffset = (firstDay.getDay() + 6) % 7; // Lunes = 0
        
        const startDate = new Date(year, month, 1 - startOffset);
        const endDate = new Date(year, month, lastDay.getDate() + (6 - (lastDay.getDay() + 6) % 7));
        
        const startStr = startDate.toISOString().substring(0, 10);
        const endStr = endDate.toISOString().substring(0, 10);
        const events = getEventsForRange(startStr, endStr);

        const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        let html = '<div class="cal-month-grid">';
        dayNames.forEach(d => html += `<div class="cal-day-header">${d}</div>`);

        let current = new Date(startDate);
        while (current <= endDate) {
            const dateStr = current.toISOString().substring(0, 10);
            const isToday = dateStr === '2026-10-30';
            const isOtherMonth = current.getMonth() !== month;
            const dayEvents = events.filter(e => e.date === dateStr);

            html += `<div class="cal-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}" data-date="${dateStr}">`;
            html += `<div class="cal-day-num"><span>${current.getDate()}</span></div>`;
            
            const maxShow = 3;
            dayEvents.slice(0, maxShow).forEach(ev => {
                html += `<div class="cal-event-chip ${ev.type}" data-event-id="${ev.id}">
                    ${ev.time ? `<i class="fas fa-clock" style="font-size: 9px;"></i> ` : ''}
                    ${App.escapeHtml(ev.title)}
                </div>`;
            });
            if (dayEvents.length > maxShow) {
                html += `<div class="cal-more" data-date="${dateStr}">+ ${dayEvents.length - maxShow} más</div>`;
            }
            html += '</div>';
            current.setDate(current.getDate() + 1);
        }
        html += '</div>';
        container.innerHTML = html;

        bindDayEvents();
    }

    function bindDayEvents() {
        containerEl.querySelectorAll('.cal-day').forEach(day => {
            day.addEventListener('click', (e) => {
                if (e.target.closest('.cal-event-chip')) {
                    const eventId = e.target.closest('.cal-event-chip').dataset.eventId;
                    openEventDetail(eventId);
                } else if (e.target.closest('.cal-more')) {
                    currentView = 'agenda';
                    // Filtrar por esa fecha en la vista agenda (simplificado: navegamos a agenda)
                    renderCurrentView();
                } else {
                    openManualEventForm(day.dataset.date);
                }
            });
        });
    }

    // =========================================================
    // VISTA: SEMANA
    // =========================================================
    function renderWeekView() {
        const container = containerEl.querySelector('#calGridContainer');
        const dayOfWeek = currentDate.getDay();
        const diff = currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Lunes
        const startOfWeek = new Date(currentDate.setDate(diff));
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const startStr = startOfWeek.toISOString().substring(0, 10);
        const endStr = endOfWeek.toISOString().substring(0, 10);
        const events = getEventsForRange(startStr, endStr);

        const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        let html = '<div class="cal-week-grid"><div class="cal-week-header"></div>';
        
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            const dateStr = d.toISOString().substring(0, 10);
            const isToday = dateStr === '2026-10-30';
            html += `<div class="cal-week-header ${isToday ? 'today' : ''}">${dayNames[i]} ${d.getDate()}</div>`;
        }

        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            const dateStr = d.toISOString().substring(0, 10);
            const dayEvents = events.filter(e => e.date === dateStr);
            
            html += `<div class="cal-week-col">`;
            dayEvents.forEach(ev => {
                const colorMap = { gasto: 'var(--danger)', ingreso: 'var(--success)', viaje: 'var(--info)', actividad: 'var(--warning)', pago: '#d97706', transferencia: 'var(--text-secondary)', manual: '#4338ca' };
                const borderColor = colorMap[ev.type] || 'var(--primary)';
                html += `
                    <div class="cal-week-event" style="border-left-color: ${borderColor}; background: ${borderColor}15; color: ${borderColor};" data-event-id="${ev.id}">
                        ${ev.time ? `<div style="font-weight: 600;">${ev.time}</div>` : ''}
                        <div>${App.escapeHtml(ev.title)}</div>
                        ${ev.isFinancial && ev.amount ? `<div style="font-weight: 600; margin-top: 2px;">${App.formatCurrency(ev.amount)}</div>` : ''}
                    </div>
                `;
            });
            html += `</div>`;
        }
        html += '</div>';
        container.innerHTML = html;

        container.querySelectorAll('.cal-week-event').forEach(el => {
            el.addEventListener('click', () => openEventDetail(el.dataset.eventId));
        });
    }

    // =========================================================
    // VISTA: AGENDA
    // =========================================================
    function renderAgendaView() {
        const container = containerEl.querySelector('#calGridContainer');
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;
        
        const events = getEventsForRange(startStr, endStr);
        
        // Agrupar por fecha
        const grouped = {};
        events.forEach(ev => {
            if (!grouped[ev.date]) grouped[ev.date] = [];
            grouped[ev.date].push(ev);
        });

        if (Object.keys(grouped).length === 0) {
            container.innerHTML = '<div class="acc-empty"><i class="fas fa-calendar-check"></i><h3>Sin eventos este mes</h3></div>';
            return;
        }

        let html = '<div class="cal-agenda-list">';
        Object.keys(grouped).sort().forEach(date => {
            const d = new Date(date + 'T00:00:00');
            const dayName = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
            
            html += `<div class="cal-agenda-date-group">`;
            html += `<div class="cal-agenda-date-header"><span>${dayName.charAt(0).toUpperCase() + dayName.slice(1)}</span><span>${grouped[date].length} eventos</span></div>`;
            
            grouped[date].forEach(ev => {
                const iconMap = { gasto: 'fa-arrow-up', ingreso: 'fa-arrow-down', viaje: 'fa-plane', actividad: 'fa-map-marked-alt', pago: 'fa-credit-card', transferencia: 'fa-exchange-alt', manual: 'fa-bell' };
                const colorMap = { gasto: 'var(--danger)', ingreso: 'var(--success)', viaje: 'var(--info)', actividad: 'var(--warning)', pago: '#d97706', transferencia: 'var(--text-secondary)', manual: '#4338ca' };
                const icon = iconMap[ev.type] || 'fa-circle';
                const color = colorMap[ev.type] || 'var(--primary)';

                html += `
                    <div class="cal-agenda-item" data-event-id="${ev.id}">
                        <div class="cal-agenda-icon" style="background: ${color}20; color: ${color};">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div class="cal-agenda-info">
                            <div class="cal-agenda-title">${App.escapeHtml(ev.title)}</div>
                            <div class="cal-agenda-meta">
                                ${ev.time ? `<span><i class="fas fa-clock"></i> ${ev.time}</span>` : ''}
                                <span class="badge badge-neutral">${ev.source}</span>
                                ${ev.status ? `<span class="badge badge-info">${ev.status}</span>` : ''}
                            </div>
                        </div>
                        ${ev.isFinancial && ev.amount ? `<div class="cal-agenda-amount" style="color: ${ev.amount > 0 ? 'var(--success)' : 'var(--danger)'};">${App.formatCurrency(ev.amount)}</div>` : ''}
                    </div>
                `;
            });
            html += `</div>`;
        });
        html += '</div>';
        container.innerHTML = html;

        container.querySelectorAll('.cal-agenda-item').forEach(el => {
            el.addEventListener('click', () => openEventDetail(el.dataset.eventId));
        });
    }

    // =========================================================
    // VISTA: PRÓXIMOS MOVIMIENTOS
    // =========================================================
    function renderProximos() {
        const view = containerEl.querySelector('#calView-proximos');
        const today = '2026-10-30';
        const next30 = '2026-11-29';
        const events = getEventsForRange(today, next30).filter(e => e.isFinancial || e.type === 'viaje' || e.type === 'pago');

        view.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Próximos 30 días</div>
                        <div class="card-subtitle">Eventos que requieren tu atención o planificación</div>
                    </div>
                </div>
                ${events.length === 0 ? '<div class="acc-empty"><i class="fas fa-check-circle"></i><h3>Todo bajo control</h3><p>No hay eventos próximos pendientes.</p></div>' : `
                    <div class="cal-upcoming-list">
                        ${events.map(ev => {
                            const daysUntil = Math.ceil((new Date(ev.date + 'T00:00:00') - new Date(today + 'T00:00:00')) / (1000 * 60 * 60 * 24));
                            const urgencyClass = daysUntil <= 3 ? 'urgent' : daysUntil <= 7 ? 'warning' : 'normal';
                            const iconMap = { gasto: 'fa-arrow-up', ingreso: 'fa-arrow-down', viaje: 'fa-plane', pago: 'fa-credit-card', transferencia: 'fa-exchange-alt' };
                            const colorMap = { gasto: 'var(--danger)', ingreso: 'var(--success)', viaje: 'var(--info)', pago: '#d97706', transferencia: 'var(--text-secondary)' };
                            
                            return `
                                <div class="cal-upcoming-card ${urgencyClass}" data-event-id="${ev.id}">
                                    <div style="width: 40px; height: 40px; border-radius: 10px; background: ${colorMap[ev.type] || 'var(--primary)'}20; color: ${colorMap[ev.type] || 'var(--primary)'}; display: flex; align-items: center; justify-content: center; font-size: 16px;">
                                        <i class="fas ${iconMap[ev.type] || 'fa-circle'}"></i>
                                    </div>
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; font-size: 14px; margin-bottom: 2px;">${App.escapeHtml(ev.title)}</div>
                                        <div style="font-size: 12px; color: var(--text-muted);">
                                            ${App.formatDate(ev.date)} · ${daysUntil === 0 ? 'Hoy' : `En ${daysUntil} días`} · ${ev.source}
                                        </div>
                                    </div>
                                    ${ev.isFinancial && ev.amount ? `<div style="font-weight: 700; font-size: 15px; color: ${ev.amount > 0 ? 'var(--success)' : 'var(--danger)'};">${App.formatCurrency(ev.amount)}</div>` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
        `;

        view.querySelectorAll('.cal-upcoming-card').forEach(el => {
            el.addEventListener('click', () => openEventDetail(el.dataset.eventId));
        });
    }

    // =========================================================
    // VISTA: CONFIGURACIÓN
    // =========================================================
    function renderConfiguracion() {
        const view = containerEl.querySelector('#calView-configuracion');
        view.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Configuración del Calendario</div>
                        <div class="card-subtitle">Personaliza la visualización</div>
                    </div>
                </div>
                <div class="acc-config-section">
                    <h3><i class="fas fa-eye"></i> Visualización</h3>
                    <div class="acc-config-row">
                        <span class="label">Vista predeterminada</span>
                        <select class="acc-filter-select" id="cfgCalDefaultView">
                            <option value="mes" selected>Mes</option>
                            <option value="semana">Semana</option>
                            <option value="agenda">Agenda</option>
                        </select>
                    </div>
                    <div class="acc-config-row">
                        <span class="label">Mostrar eventos de viajes</span>
                        <label class="acc-switch"><input type="checkbox" checked><span class="acc-slider"></span></label>
                    </div>
                    <div class="acc-config-row">
                        <span class="label">Mostrar movimientos registrados</span>
                        <label class="acc-switch"><input type="checkbox" checked><span class="acc-slider"></span></label>
                    </div>
                </div>
            </div>
        `;
    }

    // =========================================================
    // MODAL: DETALLE DE EVENTO
    // =========================================================
    function openEventDetail(eventId) {
        // Buscar el evento en todas las fuentes
        let ev = null;
        const allEvents = getEventsForRange('2026-01-01', '2027-12-31');
        ev = allEvents.find(e => e.id === eventId);
        if (!ev) return;

        const modal = containerEl.querySelector('#calDetailModal');
        const body = containerEl.querySelector('#calDetailBody');
        const footer = containerEl.querySelector('#calDetailFooter');
        containerEl.querySelector('#calDetailTitle').textContent = ev.title;

        let originLink = '';
        // Comprobamos si el módulo de origen existe a través del puente de App,
        // sin referencias directas a otros módulos
        const ORIGIN_LABELS = {
            'presupuesto-comun': 'Ver en Presupuesto',
            'viajes': 'Ver en Viajes',
            'cuentas': 'Ver en Cuentas'
        };
        if (ORIGIN_LABELS[ev.originSection]) {
            originLink = `<button class="btn btn-sm btn-secondary" id="btnGoOrigin"><i class="fas fa-external-link-alt"></i> ${ORIGIN_LABELS[ev.originSection]}</button>`;
        }

        body.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                <div>
                    <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Fecha</div>
                    <div style="font-weight: 600;">${App.formatDate(ev.date)} ${ev.time ? `a las ${ev.time}` : ''}</div>
                </div>
                <div>
                    <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Tipo</div>
                    <div style="font-weight: 600;">${ev.type.charAt(0).toUpperCase() + ev.type.slice(1)}</div>
                </div>
                ${ev.isFinancial && ev.amount !== undefined ? `
                <div>
                    <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Importe</div>
                    <div style="font-weight: 700; color: ${ev.amount > 0 ? 'var(--success)' : 'var(--danger)'};">${App.formatCurrency(ev.amount)}</div>
                </div>
                ` : ''}
                <div>
                    <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Origen</div>
                    <div style="font-weight: 600;">${ev.source.charAt(0).toUpperCase() + ev.source.slice(1)}</div>
                </div>
            </div>
            ${ev.person ? `<div style="margin-bottom: 12px; font-size: 13px;"><strong>Persona:</strong> ${App.getProfileName(ev.person)}</div>` : ''}
            ${ev.status ? `<div style="margin-bottom: 12px; font-size: 13px;"><strong>Estado:</strong> ${ev.status}</div>` : ''}
            
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); display: flex; gap: 8px; flex-wrap: wrap;">
                ${originLink}
                ${ev.source === 'manual' ? `<button class="btn btn-sm btn-secondary" id="btnEditManual"><i class="fas fa-edit"></i> Editar</button>` : ''}
            </div>
        `;

        footer.innerHTML = `<button class="btn btn-secondary" data-close-cal>Cerrar</button>`;

        // Bind actions
        const btnOrigin = body.querySelector('#btnGoOrigin');
        if (btnOrigin) {
            btnOrigin.addEventListener('click', () => {
                modal.classList.remove('active');
                // Sin acoplamiento directo: App.goTo navega y pide al módulo
                // destino la acción correspondiente a través del puente de App.
                switch (ev.originSection) {
                    case 'presupuesto-comun':
                        App.goTo('presupuesto-comun', 'openExpenseModal', ev.originId);
                        break;
                    case 'viajes':
                        App.goTo('viajes', 'openTripDetail', [ev.tripId || ev.originId, 'resumen']);
                        break;
                    case 'cuentas':
                        App.navigateTo('mi-dinero');
                        break;
                    default:
                        App.navigateTo(ev.originSection);
                }
            });
        }

        const btnEdit = body.querySelector('#btnEditManual');
        if (btnEdit) {
            btnEdit.addEventListener('click', () => {
                modal.classList.remove('active');
                openManualEventForm(null, ev);
            });
        }

        modal.classList.add('active');
    }

    // =========================================================
    // MODAL: CREAR/EDITAR EVENTO MANUAL
    // =========================================================
    function openManualEventForm(preselectedDate = null, existingEvent = null) {
        const modal = containerEl.querySelector('#calFormModal');
        const body = containerEl.querySelector('#calFormBody');
        containerEl.querySelector('#calFormTitle').textContent = existingEvent ? 'Editar evento' : 'Nuevo evento';

        body.innerHTML = `
            <input type="hidden" id="manualEventId" value="${existingEvent ? existingEvent.id : ''}">
            <div class="cal-form-row single">
                <div class="cal-form-group">
                    <label class="cal-form-label">Título *</label>
                    <input type="text" class="cal-form-input" id="manualTitle" value="${existingEvent ? App.escapeHtml(existingEvent.title) : ''}" required>
                </div>
            </div>
            <div class="cal-form-row">
                <div class="cal-form-group">
                    <label class="cal-form-label">Tipo</label>
                    <select class="cal-form-select" id="manualType">
                        <option value="manual" ${existingEvent && existingEvent.type === 'manual' ? 'selected' : ''}>Recordatorio personal</option>
                        <option value="gasto" ${existingEvent && existingEvent.type === 'gasto' ? 'selected' : ''}>Gasto previsto</option>
                        <option value="ingreso" ${existingEvent && existingEvent.type === 'ingreso' ? 'selected' : ''}>Ingreso previsto</option>
                    </select>
                </div>
                <div class="cal-form-group">
                    <label class="cal-form-label">Persona</label>
                    <select class="cal-form-select" id="manualPerson">
                        <option value="conjunto" ${existingEvent && existingEvent.person === 'conjunto' ? 'selected' : ''}>Conjunto</option>
                        ${App.data.profiles.map(p => `<option value="${p.id}" ${existingEvent && existingEvent.person === p.id ? 'selected' : ''}>${App.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="cal-form-row">
                <div class="cal-form-group">
                    <label class="cal-form-label">Fecha *</label>
                    <input type="date" class="cal-form-input" id="manualDate" value="${existingEvent ? existingEvent.date : (preselectedDate || new Date().toISOString().substring(0, 10))}" required>
                </div>
                <div class="cal-form-group">
                    <label class="cal-form-label">Hora (opcional)</label>
                    <input type="time" class="cal-form-input" id="manualTime" value="${existingEvent ? (existingEvent.time || '') : ''}">
                </div>
            </div>
            <div class="cal-form-row">
                <div class="cal-form-group">
                    <label class="cal-form-label">Importe (€)</label>
                    <input type="number" step="0.01" class="cal-form-input" id="manualAmount" value="${existingEvent && existingEvent.amount ? existingEvent.amount : ''}">
                    <div class="cal-form-hint">Dejar en blanco si no es financiero</div>
                </div>
                <div class="cal-form-group">
                    <label class="cal-form-label">Estado</label>
                    <select class="cal-form-select" id="manualStatus">
                        <option value="programado" ${existingEvent && existingEvent.status === 'programado' ? 'selected' : ''}>Programado</option>
                        <option value="completado" ${existingEvent && existingEvent.status === 'completado' ? 'selected' : ''}>Completado</option>
                        <option value="cancelado" ${existingEvent && existingEvent.status === 'cancelado' ? 'selected' : ''}>Cancelado</option
                    </select>
                </div>
            </div>
            <div class="cal-form-row single">
                <div class="cal-form-group">
                    <label class="cal-form-label">Notas</label>
                    <textarea class="cal-form-textarea" id="manualNotes">${existingEvent ? App.escapeHtml(existingEvent.notes || '') : ''}</textarea>
                </div>
            </div>
        `;

        const saveBtn = containerEl.querySelector('#calSaveEventBtn');
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        newBtn.id = 'calSaveEventBtn';
        newBtn.addEventListener('click', saveManualEvent);

        modal.classList.add('active');
    }

    function saveManualEvent() {
        const body = containerEl.querySelector('#calFormBody');
        const id = body.querySelector('#manualEventId').value;
        const title = body.querySelector('#manualTitle').value.trim();
        const date = body.querySelector('#manualDate').value;

        if (!title || !date) {
            App.showToast('Título y fecha son obligatorios', 'error');
            return;
        }

        const amountVal = body.querySelector('#manualAmount').value;
        const eventData = {
            title,
            type: body.querySelector('#manualType').value,
            date,
            time: body.querySelector('#manualTime').value,
            person: body.querySelector('#manualPerson').value,
            amount: amountVal === '' ? null : parseFloat(amountVal),
            status: body.querySelector('#manualStatus').value,
            notes: body.querySelector('#manualNotes').value.trim()
        };

        if (id) {
            const idx = App.data.calendarEvents.findIndex(e => e.id === id);
            if (idx !== -1) {
                App.data.calendarEvents[idx] = { ...App.data.calendarEvents[idx], ...eventData };
                App.addHistory('calendar_event_updated', title);
            }
        } else {
            eventData.id = App.generateId('cal');
            App.data.calendarEvents.push(eventData);
            App.addHistory('calendar_event_created', title);
        }

        App.saveData();
        containerEl.querySelector('#calFormModal').classList.remove('active');
        App.showToast('Evento guardado');
        renderCurrentView();
    }

    // =========================================================
    // INIT
    // =========================================================
    function init() {}

    return {
        render,
        init
    };
})();

// Registrar sección en la aplicación principal (API directa del módulo)
App.registerSection('calendario', CalendarApp);

window.CalendarApp = CalendarApp;