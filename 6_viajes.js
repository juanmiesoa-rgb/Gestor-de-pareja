/* =============================================================
   VIAJES.JS
   Sección completa con 5 vistas:
   - Resumen (indicadores, próximos viajes, gráficos, alertas)
   - Mis viajes (listado con filtros, búsqueda, ordenación)
   - Detalle de viaje (resumen, presupuesto, gastos, reservas,
     itinerario, calendario diario)
   - Planificación (formulario crear/editar viaje)
   - Configuración
   ============================================================= */
const TripsApp = (function () {
    'use strict';

    // =========================================================
    // ESTILOS ESPECÍFICOS
    // =========================================================
    function injectStyles() {
        if (document.getElementById('trips-styles')) return;
        const style = document.createElement('style');
        style.id = 'trips-styles';
        style.textContent = `
            /* Sub-navegación */
            .trips-subnav {
                display: flex; gap: 4px;
                border-bottom: 1px solid var(--border);
                margin-bottom: 24px;
                overflow-x: auto;
            }
            .trips-subnav-item {
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
            .trips-subnav-item:hover { color: var(--text); }
            .trips-subnav-item.active { color: var(--primary); border-bottom-color: var(--primary); }

            .trips-subview { display: none; }
            .trips-subview.active { display: block; }

            /* Stats */
            .trips-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 20px; }
            @media (max-width: 1200px) { .trips-stats { grid-template-columns: repeat(3, 1fr); } }
            @media (max-width: 768px) { .trips-stats { grid-template-columns: repeat(2, 1fr); } }
            @media (max-width: 480px) { .trips-stats { grid-template-columns: 1fr; } }

            .trips-stat {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 16px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .trips-stat:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
            .trips-stat-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
            .trips-stat-icon {
                width: 34px; height: 34px; border-radius: 10px;
                display: flex; align-items: center; justify-content: center;
                font-size: 15px;
            }
            .trips-stat-label { font-size: 11px; color: var(--text-secondary); font-weight: 500; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.3px; }
            .trips-stat-value { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
            .trips-stat-meta { font-size: 11px; color: var(--text-muted); }

            /* Trip cards */
            .trips-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }

            .trip-card {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                overflow: hidden;
                transition: all 0.2s;
                cursor: pointer;
                position: relative;
            }
            .trip-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
            .trip-card-banner {
                height: 80px;
                background: linear-gradient(135deg, var(--trip-color, var(--primary)), var(--trip-color-end, #7c3aed));
                position: relative;
                display: flex;
                align-items: flex-end;
                padding: 12px;
            }
            .trip-card-banner::before {
                content: ''; position: absolute; inset: 0;
                background: linear-gradient(to top, rgba(0,0,0,0.4), transparent);
            }
            .trip-card-destination {
                position: relative; z-index: 1;
                color: white; font-size: 18px; font-weight: 700;
                text-shadow: 0 1px 2px rgba(0,0,0,0.3);
            }
            .trip-card-status {
                position: absolute; top: 10px; right: 10px;
                z-index: 1;
                padding: 3px 10px;
                border-radius: 12px;
                font-size: 10px;
                font-weight: 600;
                text-transform: uppercase;
                background: rgba(255,255,255,0.95);
                color: var(--text);
            }
            .trip-card-body { padding: 14px; }
            .trip-card-title { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
            .trip-card-dates { font-size: 12px; color: var(--text-secondary); margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
            .trip-card-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
            .trip-card-metric {
                padding: 8px;
                background: var(--border-light);
                border-radius: var(--radius-sm);
            }
            .trip-card-metric-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; }
            .trip-card-metric-value { font-size: 14px; font-weight: 600; margin-top: 2px; }
            .trip-card-progress { margin-top: 8px; }
            .trip-card-actions {
                display: flex; gap: 6px; margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid var(--border-light);
            }
            .trip-card-actions .btn { flex: 1; justify-content: center; font-size: 11px; padding: 6px 8px; }

            /* Progress */
            .trips-progress { width: 100%; height: 6px; background: var(--border-light); border-radius: 3px; overflow: hidden; }
            .trips-progress-bar { height: 100%; background: var(--primary); border-radius: 3px; transition: width 0.3s; }
            .trips-progress-bar.warning { background: var(--warning); }
            .trips-progress-bar.danger { background: var(--danger); }
            .trips-progress-bar.success { background: var(--success); }

            /* Tables */
            .trips-table-wrap { overflow-x: auto; }
            .trips-table { width: 100%; border-collapse: collapse; font-size: 13px; }
            .trips-table th {
                text-align: left; padding: 10px 12px;
                font-size: 11px; font-weight: 600;
                color: var(--text-muted);
                text-transform: uppercase; letter-spacing: 0.5px;
                border-bottom: 1px solid var(--border);
                background: var(--bg-card);
                cursor: pointer; user-select: none;
            }
            .trips-table th:hover { color: var(--text); }
            .trips-table td {
                padding: 12px;
                border-bottom: 1px solid var(--border-light);
                vertical-align: middle;
            }
            .trips-table tr:hover td { background: var(--border-light); }
            .trips-table .amount { font-weight: 600; font-variant-numeric: tabular-nums; }
            .trips-table .amount.negative { color: var(--danger); }
            .trips-table .amount.positive { color: var(--success); }

            /* Filters */
            .trips-filters-bar {
                display: flex; gap: 8px; margin-bottom: 16px;
                flex-wrap: wrap; align-items: center;
            }
            .trips-search-box { position: relative; flex: 1; min-width: 200px; max-width: 320px; }
            .trips-search-box i {
                position: absolute; left: 12px; top: 50%;
                transform: translateY(-50%);
                color: var(--text-muted); font-size: 13px;
            }
            .trips-search-box input {
                width: 100%; padding: 9px 12px 9px 36px;
                border: 1px solid var(--border); border-radius: var(--radius-sm);
                background: var(--bg-card); color: var(--text);
                font-size: 13px; font-family: inherit;
            }
            .trips-search-box input:focus { outline: none; border-color: var(--primary); }

            .trips-filter-select {
                padding: 9px 32px 9px 12px;
                border: 1px solid var(--border); border-radius: var(--radius-sm);
                background: var(--bg-card); color: var(--text);
                font-size: 13px; cursor: pointer;
                appearance: none;
                background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
                background-repeat: no-repeat;
                background-position: right 10px center;
                font-family: inherit;
            }

            /* Charts */
            .trips-chart-container { position: relative; height: 280px; margin-top: 8px; }

            /* Alerts */
            .trips-alert-list { display: flex; flex-direction: column; gap: 8px; }
            .trips-alert-item {
                display: flex; align-items: flex-start; gap: 12px;
                padding: 12px;
                border-radius: var(--radius-sm);
                border-left: 3px solid;
            }
            .trips-alert-item.warning { border-color: var(--warning); background: var(--warning-light); }
            .trips-alert-item.danger { border-color: var(--danger); background: var(--danger-light); }
            .trips-alert-item.info { border-color: var(--info); background: var(--info-light); }
            .trips-alert-item.success { border-color: var(--success); background: var(--success-light); }
            .trips-alert-icon {
                width: 32px; height: 32px; border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                flex-shrink: 0; background: rgba(255,255,255,0.6);
            }
            .trips-alert-content { flex: 1; }
            .trips-alert-title { font-size: 13px; font-weight: 600; margin-bottom: 2px; }
            .trips-alert-desc { font-size: 12px; color: var(--text-secondary); }
            .trips-alert-action {
                background: none; border: none;
                color: var(--primary);
                font-size: 12px; font-weight: 500;
                cursor: pointer; padding: 4px 0;
                font-family: inherit;
            }

            /* Detail view */
            .trip-detail-header {
                background: linear-gradient(135deg, var(--trip-color, var(--primary)), var(--trip-color-end, #7c3aed));
                color: white;
                border-radius: var(--radius-lg);
                padding: 24px;
                margin-bottom: 20px;
                position: relative;
                overflow: hidden;
            }
            .trip-detail-header::before {
                content: ''; position: absolute; top: -50%; right: -20%;
                width: 300px; height: 300px;
                background: rgba(255,255,255,0.08); border-radius: 50%;
            }
            .trip-detail-header h2 { font-size: 24px; font-weight: 700; margin-bottom: 4px; position: relative; }
            .trip-detail-subtitle { opacity: 0.9; font-size: 14px; position: relative; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
            .trip-detail-actions { margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap; position: relative; }
            .trip-detail-actions .btn { background: rgba(255,255,255,0.2); color: white; border-color: rgba(255,255,255,0.3); }
            .trip-detail-actions .btn:hover { background: rgba(255,255,255,0.3); }

            .trip-detail-tabs {
                display: flex; gap: 4px;
                border-bottom: 1px solid var(--border);
                margin-bottom: 20px;
                overflow-x: auto;
            }
            .trip-detail-tab {
                padding: 8px 14px;
                background: none; border: none;
                color: var(--text-secondary);
                font-size: 13px; font-weight: 500;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                margin-bottom: -1px;
                transition: all 0.15s;
                white-space: nowrap;
                font-family: inherit;
            }
            .trip-detail-tab:hover { color: var(--text); }
            .trip-detail-tab.active { color: var(--primary); border-bottom-color: var(--primary); }

            .trip-detail-pane { display: none; }
            .trip-detail-pane.active { display: block; }

            /* Daily budget */
            .day-card {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 14px;
                margin-bottom: 10px;
            }
            .day-card-head {
                display: flex; justify-content: space-between; align-items: center;
                margin-bottom: 10px; padding-bottom: 10px;
                border-bottom: 1px solid var(--border-light);
            }
            .day-card-date { font-weight: 600; font-size: 14px; }
            .day-card-amount { font-size: 16px; font-weight: 700; }
            .day-card-amount.under { color: var(--success); }
            .day-card-amount.over { color: var(--danger); }

            /* Timeline */
            .timeline { position: relative; padding-left: 24px; }
            .timeline::before {
                content: ''; position: absolute; left: 8px; top: 0; bottom: 0;
                width: 2px; background: var(--border);
            }
            .timeline-item {
                position: relative; padding-bottom: 16px;
            }
            .timeline-item::before {
                content: ''; position: absolute; left: -20px; top: 4px;
                width: 12px; height: 12px; border-radius: 50%;
                background: var(--primary);
                border: 2px solid var(--bg-card);
                box-shadow: 0 0 0 2px var(--primary);
            }
            .timeline-item.paid::before { background: var(--success); box-shadow: 0 0 0 2px var(--success); }
            .timeline-item.pending::before { background: var(--warning); box-shadow: 0 0 0 2px var(--warning); }
            .timeline-item.cancelled::before { background: var(--text-muted); box-shadow: 0 0 0 2px var(--text-muted); }
            .timeline-content {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                padding: 10px 12px;
            }
            .timeline-title { font-weight: 600; font-size: 13px; margin-bottom: 2px; }
            .timeline-meta { font-size: 11px; color: var(--text-muted); }

            /* Forms */
            .trips-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
            .trips-form-row.single { grid-template-columns: 1fr; }
            .trips-form-row.three { grid-template-columns: repeat(3, 1fr); }
            @media (max-width: 768px) {
                .trips-form-row, .trips-form-row.three { grid-template-columns: 1fr; }
            }

            .trips-form-group { margin-bottom: 14px; }
            .trips-form-label {
                display: block; font-size: 12px; font-weight: 500;
                color: var(--text-secondary); margin-bottom: 6px;
            }
            .trips-form-input, .trips-form-select, .trips-form-textarea {
                width: 100%; padding: 9px 12px;
                border: 1px solid var(--border); border-radius: var(--radius-sm);
                background: var(--bg-card); color: var(--text);
                font-size: 13px; font-family: inherit;
            }
            .trips-form-input:focus, .trips-form-select:focus, .trips-form-textarea:focus {
                outline: none; border-color: var(--primary);
            }
            .trips-form-textarea { resize: vertical; min-height: 70px; }
            .trips-form-error { font-size: 11px; color: var(--danger); margin-top: 4px; display: none; }
            .trips-form-group.error .trips-form-input,
            .trips-form-group.error .trips-form-select { border-color: var(--danger); }
            .trips-form-group.error .trips-form-error { display: block; }
            .trips-form-hint { font-size: 11px; color: var(--text-muted); margin-top: 4px; }

            /* Modal */
            .trips-modal {
                display: none; position: fixed; inset: 0;
                background: rgba(0,0,0,0.5); z-index: 1000;
                align-items: center; justify-content: center;
                padding: 20px;
            }
            .trips-modal.active { display: flex; }
            .trips-modal-content {
                background: var(--bg-card); border-radius: var(--radius-lg);
                max-width: 700px; width: 100%;
                max-height: 90vh; overflow-y: auto;
                box-shadow: var(--shadow-md);
            }
            .trips-modal-header {
                padding: 20px; border-bottom: 1px solid var(--border);
                display: flex; justify-content: space-between; align-items: center;
                position: sticky; top: 0; background: var(--bg-card); z-index: 1;
            }
            .trips-modal-title { font-size: 16px; font-weight: 600; }
            .trips-modal-close {
                background: none; border: none;
                color: var(--text-muted); cursor: pointer;
                font-size: 18px; padding: 4px;
            }
            .trips-modal-body { padding: 20px; }
            .trips-modal-footer {
                padding: 16px 20px; border-top: 1px solid var(--border);
                display: flex; justify-content: flex-end; gap: 8px;
                position: sticky; bottom: 0; background: var(--bg-card);
            }

            /* Section title */
            .trips-section-title {
                font-size: 13px; font-weight: 600;
                text-transform: uppercase; letter-spacing: 0.5px;
                color: var(--text-muted);
                margin: 20px 0 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--border);
            }

            /* Empty */
            .trips-empty {
                text-align: center; padding: 40px 20px;
                color: var(--text-muted);
            }
            .trips-empty i { font-size: 40px; margin-bottom: 12px; opacity: 0.5; }
            .trips-empty h3 { font-size: 15px; color: var(--text); margin-bottom: 6px; }
            .trips-empty p { font-size: 13px; margin-bottom: 16px; }

            /* Color picker */
            .trips-color-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; margin-top: 6px; }
            .trips-color-option {
                width: 28px; height: 28px; border-radius: 6px;
                cursor: pointer; border: 2px solid transparent;
                transition: all 0.15s;
            }
            .trips-color-option:hover { transform: scale(1.1); }
            .trips-color-option.selected { border-color: var(--text); }

            /* Config */
            .trips-config-section { margin-bottom: 24px; }
            .trips-config-section h3 {
                font-size: 14px; font-weight: 600;
                margin-bottom: 12px; padding-bottom: 8px;
                border-bottom: 1px solid var(--border);
                display: flex; align-items: center; gap: 8px;
            }
            .trips-config-row {
                display: flex; justify-content: space-between; align-items: center;
                padding: 10px 0;
                border-bottom: 1px solid var(--border-light);
                font-size: 13px;
                gap: 12px;
            }
            .trips-config-row:last-child { border-bottom: none; }
            .trips-config-row .label { color: var(--text-secondary); flex: 1; }

            /* Switch */
            .trips-switch { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; }
            .trips-switch input { opacity: 0; width: 0; height: 0; }
            .trips-slider {
                position: absolute; cursor: pointer; inset: 0;
                background: var(--border); border-radius: 20px;
                transition: 0.2s;
            }
            .trips-slider:before {
                position: absolute; content: "";
                height: 14px; width: 14px; left: 3px; bottom: 3px;
                background: white; border-radius: 50%;
                transition: 0.2s;
            }
            .trips-switch input:checked + .trips-slider { background: var(--primary); }
            .trips-switch input:checked + .trips-slider:before { transform: translateX(16px); }

            /* Details toggle */
            .trips-details-toggle {
                background: none; border: none;
                color: var(--primary);
                font-size: 12px; font-weight: 500;
                cursor: pointer; padding: 8px 0;
                display: flex; align-items: center; gap: 6px;
                font-family: inherit;
            }
            .trips-details-content { display: none; padding-top: 8px; }
            .trips-details-content.open { display: block; }

            /* Action menu */
            .trips-action-menu { position: relative; display: inline-block; }
            .trips-action-dropdown {
                display: none;
                position: absolute; right: 0; top: 100%;
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                box-shadow: var(--shadow-md);
                min-width: 170px;
                z-index: 50; padding: 4px;
            }
            .trips-action-dropdown.open { display: block; }
            .trips-action-dropdown button {
                display: flex; align-items: center; gap: 8px;
                width: 100%; padding: 8px 10px;
                background: none; border: none;
                color: var(--text); font-size: 13px;
                cursor: pointer; border-radius: 4px;
                text-align: left; font-family: inherit;
            }
            .trips-action-dropdown button:hover { background: var(--border-light); }
            .trips-action-dropdown button.danger { color: var(--danger); }
            .trips-action-dropdown button i { width: 14px; color: var(--text-muted); }
            .trips-action-dropdown button.danger i { color: var(--danger); }

            /* Mobile */
            .trips-table-desktop { display: block; }
            .trips-table-mobile { display: none; }
            @media (max-width: 768px) {
                .trips-table-desktop { display: none; }
                .trips-table-mobile { display: block; }
            }
            .trips-mobile-card {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 14px;
                margin-bottom: 10px;
                cursor: pointer;
            }
            .trips-mobile-card:hover { box-shadow: var(--shadow-md); }
            .trips-mobile-card-head {
                display: flex; justify-content: space-between; align-items: flex-start;
                margin-bottom: 10px; gap: 8px;
            }
            .trips-mobile-card-row {
                display: flex; justify-content: space-between;
                font-size: 12px; padding: 4px 0;
            }
            .trips-mobile-card-row .lbl { color: var(--text-muted); }
            .trips-mobile-card-row .val { font-weight: 500; }
        `;
        document.head.appendChild(style);
    }

    // =========================================================
    // DATOS POR DEFECTO
    // =========================================================
    const DEFAULT_TRIPS_DATA = {
        trips: [
            {
                id: 'trip-1',
                name: 'Escapada a Oporto',
                destination: 'Oporto, Portugal',
                otherDestinations: ['Braga'],
                type: 'escapada',
                startDate: '2026-12-18',
                endDate: '2026-12-22',
                participants: ['ana', 'carlos'],
                status: 'planificado',
                color: '#14b8a6',
                colorEnd: '#0891b2',
                description: 'Escapada de 4 noches para disfrutar del Douro y la gastronomía portuguesa.',
                budget: 800,
                currency: 'EUR',
                splitMethod: 'equal',
                dailyBudget: 120,
                contingencyPercent: 10,
                savingsGoal: 800,
                savingsSaved: 320,
                savingsTargetDate: '2026-12-15',
                savingsMonthly: 120,
                savingsResponsible: 'conjunto'
            },
            {
                id: 'trip-2',
                name: 'Navidades en Sevilla',
                destination: 'Sevilla, España',
                otherDestinations: [],
                type: 'familiar',
                startDate: '2026-12-23',
                endDate: '2026-12-28',
                participants: ['ana', 'carlos'],
                status: 'reservado',
                color: '#f59e0b',
                colorEnd: '#d97706',
                description: 'Navidades en familia. Vuelos y hotel ya reservados.',
                budget: 1200,
                currency: 'EUR',
                splitMethod: 'equal',
                dailyBudget: 150,
                contingencyPercent: 10,
                savingsGoal: 1200,
                savingsSaved: 900,
                savingsTargetDate: '2026-12-20',
                savingsMonthly: 150,
                savingsResponsible: 'conjunto'
            },
            {
                id: 'trip-3',
                name: 'Verano en Costa Brava',
                destination: 'Costa Brava, España',
                otherDestinations: ['Cadaqués'],
                type: 'vacaciones',
                startDate: '2026-08-05',
                endDate: '2026-08-12',
                participants: ['ana', 'carlos'],
                status: 'completado',
                color: '#2563eb',
                colorEnd: '#1d4ed8',
                description: 'Semana de vacaciones en la costa.',
                budget: 1400,
                currency: 'EUR',
                splitMethod: 'equal',
                dailyBudget: 150,
                contingencyPercent: 10,
                savingsGoal: 1400,
                savingsSaved: 1400,
                savingsTargetDate: '2026-08-01',
                savingsMonthly: 200,
                savingsResponsible: 'conjunto'
            },
            {
                id: 'trip-4',
                name: 'Idea: Japón en primavera',
                destination: 'Tokio, Japón',
                otherDestinations: ['Kioto', 'Osaka'],
                type: 'vacaciones',
                startDate: '',
                endDate: '',
                participants: ['ana', 'carlos'],
                status: 'idea',
                color: '#ec4899',
                colorEnd: '#db2777',
                description: 'Idea de viaje para ver los cerezos en flor. Pendiente de definir fechas y presupuesto.',
                budget: 5000,
                currency: 'EUR',
                splitMethod: 'equal',
                dailyBudget: null,
                contingencyPercent: 15,
                savingsGoal: null,
                savingsSaved: 0,
                savingsTargetDate: '',
                savingsMonthly: null,
                savingsResponsible: 'conjunto'
            }
        ],
        tripCategories: [
            { id: 'tc-1', name: 'Transporte', icon: 'fas fa-plane', color: '#2563eb' },
            { id: 'tc-2', name: 'Alojamiento', icon: 'fas fa-bed', color: '#8b5cf6' },
            { id: 'tc-3', name: 'Alimentación', icon: 'fas fa-utensils', color: '#f59e0b' },
            { id: 'tc-4', name: 'Restaurantes', icon: 'fas fa-wine-glass', color: '#ef4444' },
            { id: 'tc-5', name: 'Actividades', icon: 'fas fa-ticket-alt', color: '#10b981' },
            { id: 'tc-6', name: 'Compras', icon: 'fas fa-shopping-bag', color: '#a855f7' },
            { id: 'tc-7', name: 'Seguros', icon: 'fas fa-shield-alt', color: '#06b6d4' },
            { id: 'tc-8', name: 'Transporte local', icon: 'fas fa-bus', color: '#14b8a6' },
            { id: 'tc-9', name: 'Otros', icon: 'fas fa-ellipsis-h', color: '#94a3b8' }
        ],
        tripTypes: [
            { id: 'vacaciones', name: 'Vacaciones', icon: 'fas fa-umbrella-beach' },
            { id: 'escapada', name: 'Escapada de fin de semana', icon: 'fas fa-suitcase-rolling' },
            { id: 'varios-dias', name: 'Viaje de varios días', icon: 'fas fa-route' },
            { id: 'familiar', name: 'Visita familiar', icon: 'fas fa-home' },
            { id: 'otro', name: 'Otro', icon: 'fas fa-compass' }
        ],
        tripBudgets: [
            // Trip 1 (Oporto)
            { id: 'tb-1', tripId: 'trip-1', categoryId: 'tc-1', amount: 200 },
            { id: 'tb-2', tripId: 'trip-1', categoryId: 'tc-2', amount: 320 },
            { id: 'tb-3', tripId: 'trip-1', categoryId: 'tc-3', amount: 100 },
            { id: 'tb-4', tripId: 'trip-1', categoryId: 'tc-4', amount: 120 },
            { id: 'tb-5', tripId: 'trip-1', categoryId: 'tc-5', amount: 60 },
            // Trip 2 (Sevilla)
            { id: 'tb-10', tripId: 'trip-2', categoryId: 'tc-1', amount: 300 },
            { id: 'tb-11', tripId: 'trip-2', categoryId: 'tc-2', amount: 480 },
            { id: 'tb-12', tripId: 'trip-2', categoryId: 'tc-3', amount: 150 },
            { id: 'tb-13', tripId: 'trip-2', categoryId: 'tc-4', amount: 180 },
            { id: 'tb-14', tripId: 'trip-2', categoryId: 'tc-5', amount: 90 },
            // Trip 3 (Costa Brava - completado)
            { id: 'tb-20', tripId: 'trip-3', categoryId: 'tc-1', amount: 250 },
            { id: 'tb-21', tripId: 'trip-3', categoryId: 'tc-2', amount: 560 },
            { id: 'tb-22', tripId: 'trip-3', categoryId: 'tc-3', amount: 180 },
            { id: 'tb-23', tripId: 'trip-3', categoryId: 'tc-4', amount: 220 },
            { id: 'tb-24', tripId: 'trip-3', categoryId: 'tc-5', amount: 120 },
            { id: 'tb-25', tripId: 'trip-3', categoryId: 'tc-6', amount: 80 }
        ],
        tripExpenses: [
            // Trip 3 - Costa Brava (completado, gastos reales)
            { id: 'te-1', tripId: 'trip-3', concept: 'Vuelos ida/vuelta', amount: 240, date: '2026-07-20', categoryId: 'tc-1', person: 'conjunto', status: 'registrado', paymentStatus: 'pagado', notes: '', linkedExpenseId: null },
            { id: 'te-2', tripId: 'trip-3', concept: 'Hotel 7 noches', amount: 580, date: '2026-08-05', categoryId: 'tc-2', person: 'conjunto', status: 'registrado', paymentStatus: 'pagado', notes: '', linkedExpenseId: null },
            { id: 'te-3', tripId: 'trip-3', concept: 'Comidas supermercado', amount: 165, date: '2026-08-06', categoryId: 'tc-3', person: 'ana', status: 'registrado', paymentStatus: 'pagado', notes: '', linkedExpenseId: null },
            { id: 'te-4', tripId: 'trip-3', concept: 'Restaurantes varios', amount: 245, date: '2026-08-07', categoryId: 'tc-4', person: 'conjunto', status: 'registrado', paymentStatus: 'pagado', notes: '', linkedExpenseId: null },
            { id: 'te-5', tripId: 'trip-3', concept: 'Excursión Cadaqués', amount: 95, date: '2026-08-08', categoryId: 'tc-5', person: 'conjunto', status: 'registrado', paymentStatus: 'pagado', notes: '', linkedExpenseId: null },
            { id: 'te-6', tripId: 'trip-3', concept: 'Souvenirs', amount: 72, date: '2026-08-10', categoryId: 'tc-6', person: 'carlos', status: 'registrado', paymentStatus: 'pagado', notes: '', linkedExpenseId: null },
            { id: 'te-7', tripId: 'trip-3', concept: 'Gasolina', amount: 85, date: '2026-08-05', categoryId: 'tc-1', person: 'carlos', status: 'registrado', paymentStatus: 'pagado', notes: '', linkedExpenseId: null },
            // Trip 2 - Sevilla (reservado, algunos gastos previstos)
            { id: 'te-10', tripId: 'trip-2', concept: 'Vuelos', amount: 280, date: '2026-11-15', categoryId: 'tc-1', person: 'conjunto', status: 'previsto', paymentStatus: 'pagado', notes: 'Reservados en noviembre', linkedExpenseId: null },
            { id: 'te-11', tripId: 'trip-2', concept: 'Hotel 5 noches', amount: 450, date: '2026-11-20', categoryId: 'tc-2', person: 'conjunto', status: 'previsto', paymentStatus: 'parcial', notes: 'Señal pagada, resto el 15/12', linkedExpenseId: null },
            { id: 'te-12', tripId: 'trip-2', concept: 'Estimación comidas', amount: 180, date: '2026-12-23', categoryId: 'tc-3', person: 'conjunto', status: 'estimado', paymentStatus: 'pendiente', notes: 'Estimación agregada', linkedExpenseId: null, isAggregated: true },
            // Trip 1 - Oporto (planificado)
            { id: 'te-20', tripId: 'trip-1', concept: 'Estimación transporte', amount: 200, date: '2026-12-18', categoryId: 'tc-1', person: 'conjunto', status: 'estimado', paymentStatus: 'pendiente', notes: 'Tren o vuelo', linkedExpenseId: null, isAggregated: true }
        ],
        tripReservations: [
            {
                id: 'tr-1', tripId: 'trip-2', concept: 'Vuelos Madrid-Sevilla',
                provider: 'Iberia', totalAmount: 280, paidAmount: 280, pendingAmount: 0,
                reservationDate: '2026-11-15', paymentDates: ['2026-11-15'],
                serviceDate: '2026-12-23', categoryId: 'tc-1',
                status: 'pagado', conditions: 'No reembolsable', notes: ''
            },
            {
                id: 'tr-2', tripId: 'trip-2', concept: 'Hotel Casa Palacio',
                provider: 'Booking', totalAmount: 450, paidAmount: 150, pendingAmount: 300,
                reservationDate: '2026-11-20', paymentDates: ['2026-11-20', '2026-12-15'],
                serviceDate: '2026-12-23', categoryId: 'tc-2',
                status: 'parcial', conditions: 'Cancelación gratuita hasta 7 días antes', notes: 'Señal de 150€ pagada'
            },
            {
                id: 'tr-3', tripId: 'trip-1', concept: 'Hotel Oporto Centro',
                provider: 'Airbnb', totalAmount: 320, paidAmount: 0, pendingAmount: 320,
                reservationDate: '', paymentDates: ['2026-12-01'],
                serviceDate: '2026-12-18', categoryId: 'tc-2',
                status: 'pendiente', conditions: 'Cancelación gratuita hasta 30 días antes', notes: 'Pendiente de confirmar'
            },
            {
                id: 'tr-4', tripId: 'trip-3', concept: 'Hotel Costa Brava',
                provider: 'Booking', totalAmount: 560, paidAmount: 560, pendingAmount: 0,
                reservationDate: '2026-06-10', paymentDates: ['2026-06-10'],
                serviceDate: '2026-08-05', categoryId: 'tc-2',
                status: 'pagado', conditions: '', notes: ''
            }
        ],
        tripActivities: [
            // Trip 2 - Sevilla
            { id: 'ta-1', tripId: 'trip-2', title: 'Llegada Sevilla', date: '2026-12-23', time: '11:30', location: 'Aeropuerto SVQ', estimatedCost: 0, status: 'pendiente', type: 'transporte', notes: '' },
            { id: 'ta-2', tripId: 'trip-2', title: 'Check-in hotel', date: '2026-12-23', time: '14:00', location: 'Casa Palacio', estimatedCost: 0, status: 'pendiente', type: 'alojamiento', notes: '' },
            { id: 'ta-3', tripId: 'trip-2', title: 'Cena Navidad familiar', date: '2026-12-24', time: '21:00', location: 'Casa familia', estimatedCost: 60, status: 'pendiente', type: 'restaurante', notes: '' },
            { id: 'ta-4', tripId: 'trip-2', title: 'Visita Catedral', date: '2026-12-25', time: '10:00', location: 'Catedral de Sevilla', estimatedCost: 30, status: 'pendiente', type: 'actividad', notes: '' },
            { id: 'ta-5', tripId: 'trip-2', title: 'Regreso', date: '2026-12-28', time: '18:00', location: 'Aeropuerto SVQ', estimatedCost: 0, status: 'pendiente', type: 'transporte', notes: '' },
            // Trip 1 - Oporto
            { id: 'ta-10', tripId: 'trip-1', title: 'Salida', date: '2026-12-18', time: '08:00', location: 'Madrid', estimatedCost: 0, status: 'pendiente', type: 'transporte', notes: '' },
            { id: 'ta-11', tripId: 'trip-1', title: 'Tour bodegas Porto', date: '2026-12-19', time: '15:00', location: 'Vila Nova de Gaia', estimatedCost: 25, status: 'pendiente', type: 'actividad', notes: '' }
        ],
        settings: {
            defaultCurrency: 'EUR',
            defaultContingency: 10,
            alertNoBudget: true,
            alertPendingPayments: true,
            alertUpcomingTrips: true,
            alertLowSavings: true,
            upcomingDaysThreshold: 30,
            defaultSort: 'startDate-asc'
        }
    };

    // =========================================================
    // ESTADO
    // =========================================================
    let tripsData = loadData();
    let currentView = 'resumen';
    let currentTripId = null;
    let currentTripTab = 'resumen';
    let tripFilters = { search: '', status: '', type: '', destination: '', participant: '', year: '', hasPending: '' };
    let charts = {};
    let containerEl = null;

    function loadData() {
        try {
            const saved = localStorage.getItem('finanzas_trips_data');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge con defaults para asegurar estructura completa
                return Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_TRIPS_DATA)), parsed);
            }
        } catch(e) {}
        return JSON.parse(JSON.stringify(DEFAULT_TRIPS_DATA));
    }

    function saveData() {
        try {
            localStorage.setItem('finanzas_trips_data', JSON.stringify(tripsData));
        } catch(e) {}
    }

    // =========================================================
    // HELPERS
    // =========================================================
    function getTripById(id) { return tripsData.trips.find(t => t.id === id); }
    function getCategoryById(id) { return tripsData.tripCategories.find(c => c.id === id); }
    function getTypeById(id) { return tripsData.tripTypes.find(t => t.id === id); }

    function getTripExpenses(tripId, includeEstimated = false) {
        return tripsData.tripExpenses.filter(e => {
            if (e.tripId !== tripId) return false;
            if (!includeEstimated && e.status === 'estimado') return false;
            return true;
        });
    }

    function getTripReservations(tripId) {
        return tripsData.tripReservations.filter(r => r.tripId === tripId);
    }

    function getTripActivities(tripId) {
        return tripsData.tripActivities.filter(a => a.tripId === tripId)
            .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    }

    function getTripBudgetByCategory(tripId, categoryId) {
        const b = tripsData.tripBudgets.find(b => b.tripId === tripId && b.categoryId === categoryId);
        return b ? b.amount : null;
    }

    function getTripExpenseByCategory(tripId, categoryId) {
        return getTripExpenses(tripId, false)
            .filter(e => e.categoryId === categoryId)
            .reduce((s, e) => s + e.amount, 0);
    }

    function getTripTotalBudget(tripId) {
        const trip = getTripById(tripId);
        if (!trip) return 0;
        return trip.budget || 0;
    }

    function getTripTotalSpent(tripId) {
        return getTripExpenses(tripId, false)
            .reduce((s, e) => s + e.amount, 0);
    }

    function getTripTotalEstimated(tripId) {
        return tripsData.tripExpenses
            .filter(e => e.tripId === tripId && e.status === 'estimado')
            .reduce((s, e) => s + e.amount, 0);
    }

    function getTripTotalPaid(tripId) {
        const reservations = getTripReservations(tripId);
        const paidFromReservations = reservations.reduce((s, r) => s + r.paidAmount, 0);
        const paidFromExpenses = getTripExpenses(tripId, true)
            .filter(e => e.paymentStatus === 'pagado')
            .reduce((s, e) => s + e.amount, 0);
        return Math.max(paidFromReservations, paidFromExpenses);
    }

    function getTripPendingPayments(tripId) {
        return getTripReservations(tripId)
            .filter(r => r.status !== 'cancelado' && r.status !== 'pagado')
            .reduce((s, r) => s + r.pendingAmount, 0);
    }

    function getTripDuration(trip) {
        if (!trip.startDate || !trip.endDate) return null;
        const start = new Date(trip.startDate + 'T00:00:00');
        const end = new Date(trip.endDate + 'T00:00:00');
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        return days;
    }

    function getStatusLabel(status) {
        const map = {
            idea: 'Idea',
            planificado: 'Planificado',
            reservado: 'Reservado',
            en_curso: 'En curso',
            completado: 'Completado',
            cancelado: 'Cancelado'
        };
        return map[status] || status;
    }

    function getStatusBadge(status) {
        const map = {
            idea: '<span class="badge badge-neutral">Idea</span>',
            planificado: '<span class="badge badge-info">Planificado</span>',
            reservado: '<span class="badge badge-warning">Reservado</span>',
            en_curso: '<span class="badge badge-success">En curso</span>',
            completado: '<span class="badge badge-success">Completado</span>',
            cancelado: '<span class="badge badge-danger">Cancelado</span>'
        };
        return map[status] || '';
    }

    function getPaymentStatusBadge(status) {
        const map = {
            pendiente: '<span class="badge badge-warning">Pendiente</span>',
            parcial: '<span class="badge badge-info">Parcial</span>',
            pagado: '<span class="badge badge-success">Pagado</span>'
        };
        return map[status] || '';
    }

    function getReservationStatusLabel(status) {
        const map = {
            pendiente: '<span class="badge badge-neutral">Pendiente</span>',
            reservado: '<span class="badge badge-info">Reservado</span>',
            parcial: '<span class="badge badge-warning">Parcial</span>',
            pagado: '<span class="badge badge-success">Pagado</span>',
            cancelado: '<span class="badge badge-danger">Cancelado</span>'
        };
        return map[status] || '';
    }

    function getDaysUntil(dateStr) {
        if (!dateStr) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(dateStr + 'T00:00:00');
        return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    }

    function getFilteredTrips() {
        let list = [...tripsData.trips];
        if (tripFilters.search) {
            const s = tripFilters.search.toLowerCase();
            list = list.filter(t =>
                t.name.toLowerCase().includes(s) ||
                t.destination.toLowerCase().includes(s)
            );
        }
        if (tripFilters.status) list = list.filter(t => t.status === tripFilters.status);
        if (tripFilters.type) list = list.filter(t => t.type === tripFilters.type);
        if (tripFilters.destination) {
            const d = tripFilters.destination.toLowerCase();
            list = list.filter(t => t.destination.toLowerCase().includes(d));
        }
        if (tripFilters.participant) list = list.filter(t => t.participants.includes(tripFilters.participant));
        if (tripFilters.year) {
            list = list.filter(t => {
                if (!t.startDate) return false;
                return t.startDate.startsWith(tripFilters.year);
            });
        }
        if (tripFilters.hasPending === 'yes') {
            list = list.filter(t => getTripPendingPayments(t.id) > 0);
        } else if (tripFilters.hasPending === 'no') {
            list = list.filter(t => getTripPendingPayments(t.id) === 0);
        }

        // Ordenación
        const sort = tripsData.settings.defaultSort || 'startDate-asc';
        const [field, dir] = sort.split('-');
        list.sort((a, b) => {
            let va, vb;
            if (field === 'startDate') { va = a.startDate || '9999'; vb = b.startDate || '9999'; }
            else if (field === 'budget') { va = a.budget || 0; vb = b.budget || 0; }
            else if (field === 'name') { va = a.name; vb = b.name; }
            else if (field === 'status') { va = a.status; vb = b.status; }
            if (va < vb) return dir === 'asc' ? -1 : 1;
            if (va > vb) return dir === 'asc' ? 1 : -1;
            return 0;
        });

        return list;
    }

    // =========================================================
    // RENDER PRINCIPAL
    // =========================================================
    function render(container) {
        injectStyles();
        containerEl = container;

        container.innerHTML = `
            <div class="card" style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <select class="trips-filter-select" id="tripsGlobalStatusFilter">
                            <option value="">Todos los estados</option>
                            <option value="idea">Idea</option>
                            <option value="planificado">Planificado</option>
                            <option value="reservado">Reservado</option>
                            <option value="en_curso">En curso</option>
                            <option value="completado">Completado</option>
                            <option value="cancelado">Cancelado</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="btn btn-sm btn-secondary" id="tripsConfigBtn">
                            <i class="fas fa-cog"></i> Configuración
                        </button>
                        <button class="btn btn-sm btn-primary" id="tripsNewTripBtn">
                            <i class="fas fa-plus"></i> Crear viaje
                        </button>
                    </div>
                </div>
            </div>

            <div class="trips-subnav">
                <button class="trips-subnav-item active" data-view="resumen"><i class="fas fa-chart-pie"></i> Resumen</button>
                <button class="trips-subnav-item" data-view="mis-viajes"><i class="fas fa-suitcase"></i> Mis viajes</button>
                <button class="trips-subnav-item" data-view="planificacion"><i class="fas fa-plus-circle"></i> Planificación</button>
                <button class="trips-subnav-item" data-view="configuracion"><i class="fas fa-cog"></i> Configuración</button>
            </div>

            <div class="trips-subview active" id="tripsView-resumen"></div>
            <div class="trips-subview" id="tripsView-mis-viajes"></div>
            <div class="trips-subview" id="tripsView-planificacion"></div>
            <div class="trips-subview" id="tripsView-configuracion"></div>
            <div class="trips-subview" id="tripsView-detalle"></div>

            <!-- Modal Viaje -->
            <div class="trips-modal" id="tripsTripModal">
                <div class="trips-modal-content">
                    <div class="trips-modal-header">
                        <h3 class="trips-modal-title" id="tripsTripModalTitle">Nuevo viaje</h3>
                        <button class="trips-modal-close" data-close-trips-modal><i class="fas fa-times"></i></button>
                    </div>
                    <div class="trips-modal-body" id="tripsTripModalBody"></div>
                    <div class="trips-modal-footer">
                        <button class="btn btn-secondary" data-close-trips-modal>Cancelar</button>
                        <button class="btn btn-primary" id="tripsSaveTripBtn"><i class="fas fa-save"></i> Guardar</button>
                    </div>
                </div>
            </div>

            <!-- Modal Gasto -->
            <div class="trips-modal" id="tripsExpenseModal">
                <div class="trips-modal-content">
                    <div class="trips-modal-header">
                        <h3 class="trips-modal-title" id="tripsExpenseModalTitle">Nuevo gasto</h3>
                        <button class="trips-modal-close" data-close-trips-modal><i class="fas fa-times"></i></button>
                    </div>
                    <div class="trips-modal-body" id="tripsExpenseModalBody"></div>
                    <div class="trips-modal-footer">
                        <button class="btn btn-secondary" data-close-trips-modal>Cancelar</button>
                        <button class="btn btn-primary" id="tripsSaveExpenseBtn"><i class="fas fa-save"></i> Guardar</button>
                    </div>
                </div>
            </div>

            <!-- Modal Reserva -->
            <div class="trips-modal" id="tripsReservationModal">
                <div class="trips-modal-content">
                    <div class="trips-modal-header">
                        <h3 class="trips-modal-title" id="tripsReservationModalTitle">Nueva reserva</h3>
                        <button class="trips-modal-close" data-close-trips-modal><i class="fas fa-times"></i></button>
                    </div>
                    <div class="trips-modal-body" id="tripsReservationModalBody"></div>
                    <div class="trips-modal-footer">
                        <button class="btn btn-secondary" data-close-trips-modal>Cancelar</button>
                        <button class="btn btn-primary" id="tripsSaveReservationBtn"><i class="fas fa-save"></i> Guardar</button>
                    </div>
                </div>
            </div>

            <!-- Modal Actividad -->
            <div class="trips-modal" id="tripsActivityModal">
                <div class="trips-modal-content">
                    <div class="trips-modal-header">
                        <h3 class="trips-modal-title" id="tripsActivityModalTitle">Nueva actividad</h3>
                        <button class="trips-modal-close" data-close-trips-modal><i class="fas fa-times"></i></button>
                    </div>
                    <div class="trips-modal-body" id="tripsActivityModalBody"></div>
                    <div class="trips-modal-footer">
                        <button class="btn btn-secondary" data-close-trips-modal>Cancelar</button>
                        <button class="btn btn-primary" id="tripsSaveActivityBtn"><i class="fas fa-save"></i> Guardar</button>
                    </div>
                </div>
            </div>
        `;

        renderView(currentView);
        bindGlobalEvents();
    }

    function bindGlobalEvents() {
        // Sub-navegación
        containerEl.querySelectorAll('.trips-subnav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.view === 'detalle') return;
                currentView = btn.dataset.view;
                currentTripId = null;
                containerEl.querySelectorAll('.trips-subnav-item').forEach(b =>
                    b.classList.toggle('active', b === btn));
                containerEl.querySelectorAll('.trips-subview').forEach(v =>
                    v.classList.toggle('active', v.id === `tripsView-${currentView}`));
                renderView(currentView);
            });
        });

        // Filtro global
        containerEl.querySelector('#tripsGlobalStatusFilter').addEventListener('change', (e) => {
            tripFilters.status = e.target.value;
            if (currentView !== 'mis-viajes') switchView('mis-viajes');
            else renderMisViajes();
        });

        containerEl.querySelector('#tripsNewTripBtn').addEventListener('click', () => openTripModal());
        containerEl.querySelector('#tripsConfigBtn').addEventListener('click', () => switchView('configuracion'));

        // Cerrar modales
        containerEl.querySelectorAll('[data-close-trips-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.trips-modal').classList.remove('active');
            });
        });
        containerEl.querySelectorAll('.trips-modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        });

        // Save handlers
        containerEl.querySelector('#tripsSaveTripBtn').addEventListener('click', saveTrip);
        containerEl.querySelector('#tripsSaveExpenseBtn').addEventListener('click', saveExpense);
        containerEl.querySelector('#tripsSaveReservationBtn').addEventListener('click', saveReservation);
        containerEl.querySelector('#tripsSaveActivityBtn').addEventListener('click', saveActivity);
    }

    function switchView(view) {
        currentView = view;
        containerEl.querySelectorAll('.trips-subnav-item').forEach(b =>
            b.classList.toggle('active', b.dataset.view === view));
        containerEl.querySelectorAll('.trips-subview').forEach(v =>
            v.classList.toggle('active', v.id === `tripsView-${view}`));
        renderView(view);
    }

    function renderView(view) {
        if (view === 'resumen') renderResumen();
        else if (view === 'mis-viajes') renderMisViajes();
        else if (view === 'planificacion') renderPlanificacion();
        else if (view === 'configuracion') renderConfiguracion();
        else if (view === 'detalle') renderDetalle();
    }

    // =========================================================
    // VISTA: RESUMEN
    // =========================================================
    function renderResumen() {
        const view = containerEl.querySelector('#tripsView-resumen');

        // Cálculos globales
        const allTrips = tripsData.trips.filter(t => t.status !== 'cancelado');
        const plannedTrips = allTrips.filter(t => ['planificado', 'reservado', 'idea'].includes(t.status));
        const completedTrips = allTrips.filter(t => t.status === 'completado');

        const totalEstimated = plannedTrips.reduce((s, t) => s + (t.budget || 0), 0);
        const totalPaid = allTrips.reduce((s, t) => s + getTripTotalPaid(t.id), 0);
        const totalPending = allTrips.reduce((s, t) => s + getTripPendingPayments(t.id), 0);
        const totalSaved = allTrips.reduce((s, t) => s + (t.savingsSaved || 0), 0);
        const completedSpent = completedTrips.reduce((s, t) => s + getTripTotalSpent(t.id), 0);

        // Próximos viajes
        const upcoming = allTrips
            .filter(t => t.startDate && getDaysUntil(t.startDate) !== null && getDaysUntil(t.startDate) >= 0 && t.status !== 'completado')
            .sort((a, b) => a.startDate.localeCompare(b.startDate))
            .slice(0, 6);

        view.innerHTML = `
            <div class="trips-stats">
                <div class="trips-stat" data-action="goto-mis-viajes">
                    <div class="trips-stat-head">
                        <div>
                            <div class="trips-stat-label">Coste estimado</div>
                            <div class="trips-stat-value">${App.formatCurrency(totalEstimated)}</div>
                            <div class="trips-stat-meta">${plannedTrips.length} viaje(s) planificado(s)</div>
                        </div>
                        <div class="trips-stat-icon" style="background: var(--primary-light); color: var(--primary);"><i class="fas fa-calculator"></i></div>
                    </div>
                </div>
                <div class="trips-stat">
                    <div class="trips-stat-head">
                        <div>
                            <div class="trips-stat-label">Pagado</div>
                            <div class="trips-stat-value">${App.formatCurrency(totalPaid)}</div>
                            <div class="trips-stat-meta">${totalEstimated > 0 ? ((totalPaid/totalEstimated)*100).toFixed(0) : 0}% del total</div>
                        </div>
                        <div class="trips-stat-icon" style="background: var(--success-light); color: var(--success);"><i class="fas fa-check-circle"></i></div>
                    </div>
                </div>
                <div class="trips-stat">
                    <div class="trips-stat-head">
                        <div>
                            <div class="trips-stat-label">Pendiente de pago</div>
                            <div class="trips-stat-value">${App.formatCurrency(totalPending)}</div>
                            <div class="trips-stat-meta">${totalPending > 0 ? 'Requiere atención' : 'Todo al día'}</div>
                        </div>
                        <div class="trips-stat-icon" style="background: var(--warning-light); color: var(--warning);"><i class="fas fa-clock"></i></div>
                    </div>
                </div>
                <div class="trips-stat">
                    <div class="trips-stat-head">
                        <div>
                            <div class="trips-stat-label">Ahorrado</div>
                            <div class="trips-stat-value">${App.formatCurrency(totalSaved)}</div>
                            <div class="trips-stat-meta">Para todos los viajes</div>
                        </div>
                        <div class="trips-stat-icon" style="background: var(--info-light); color: var(--info);"><i class="fas fa-piggy-bank"></i></div>
                    </div>
                </div>
                <div class="trips-stat">
                    <div class="trips-stat-head">
                        <div>
                            <div class="trips-stat-label">Gastado (realizados)</div>
                            <div class="trips-stat-value">${App.formatCurrency(completedSpent)}</div>
                            <div class="trips-stat-meta">${completedTrips.length} viaje(s) completado(s)</div>
                        </div>
                        <div class="trips-stat-icon" style="background: var(--danger-light); color: var(--danger);"><i class="fas fa-shopping-cart"></i></div>
                    </div>
                </div>
            </div>

            <div id="tripsAlertsContainer"></div>

            <div class="trips-section-title" style="margin-top: 24px;">Próximos viajes</div>
            ${upcoming.length === 0 ? `
                <div class="trips-empty">
                    <i class="fas fa-suitcase-rolling"></i>
                    <h3>Sin viajes próximos</h3>
                    <p>Planifica tu próxima aventura.</p>
                    <button class="btn btn-primary" onclick="TripsApp.openTripModal()"><i class="fas fa-plus"></i> Crear viaje</button>
                </div>
            ` : `
                <div class="trips-grid">
                    ${upcoming.map(t => renderTripCard(t)).join('')}
                </div>
            `}

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px;">
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">Coste estimado por viaje</div>
                            <div class="card-subtitle">Viajes planificados</div>
                        </div>
                    </div>
                    <div class="trips-chart-container"><canvas id="tripsChartBudget"></canvas></div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">Distribución por categorías</div>
                            <div class="card-subtitle">Presupuestos de viajes activos</div>
                        </div>
                    </div>
                    <div class="trips-chart-container"><canvas id="tripsChartCategories"></canvas></div>
                </div>
            </div>

            <div class="card" style="margin-top: 16px;">
                <div class="card-header">
                    <div>
                        <div class="card-title">Presupuesto vs Gasto real</div>
                        <div class="card-subtitle">Viajes completados</div>
                    </div>
                </div>
                <div class="trips-chart-container"><canvas id="tripsChartComparison"></canvas></div>
            </div>
        `;

        renderAlerts();
        renderCharts();

        view.querySelectorAll('[data-action="goto-mis-viajes"]').forEach(el => {
            el.addEventListener('click', () => switchView('mis-viajes'));
        });
        view.querySelectorAll('[data-trip-id]').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                openTripDetail(el.dataset.tripId);
            });
        });
        view.querySelectorAll('[data-trip-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.tripAction;
                const id = btn.dataset.tripId;
                if (action === 'view') openTripDetail(id);
                else if (action === 'edit') openTripModal(id);
                else if (action === 'payment') openReservationModal(null, id);
            });
        });
    }

    function renderTripCard(trip) {
        const days = getTripDuration(trip);
        const daysUntil = getDaysUntil(trip.startDate);
        const budget = trip.budget || 0;
        const spent = getTripTotalSpent(trip.id);
        const paid = getTripTotalPaid(trip.id);
        const pending = getTripPendingPayments(trip.id);
        const saved = trip.savingsSaved || 0;
        const pctPaid = budget > 0 ? (paid / budget) * 100 : 0;
        const pctSpent = budget > 0 ? (spent / budget) * 100 : 0;
        const type = getTypeById(trip.type);

        return `
            <div class="trip-card" data-trip-id="${trip.id}" style="--trip-color: ${trip.color}; --trip-color-end: ${trip.colorEnd || trip.color};">
                <div class="trip-card-banner">
                    <div class="trip-card-status">${getStatusLabel(trip.status)}</div>
                    <div class="trip-card-destination">${App.escapeHtml(trip.destination)}</div>
                </div>
                <div class="trip-card-body">
                    <div class="trip-card-title">${App.escapeHtml(trip.name)}</div>
                    <div class="trip-card-dates">
                        <i class="fas fa-calendar"></i>
                        ${trip.startDate ? `${App.formatDate(trip.startDate)} - ${App.formatDate(trip.endDate)}` : 'Sin fechas'}
                        ${days ? ` · ${days} día${days > 1 ? 's' : ''}` : ''}
                    </div>
                    <div class="trip-card-metrics">
                        <div class="trip-card-metric">
                            <div class="trip-card-metric-label">Presupuesto</div>
                            <div class="trip-card-metric-value">${App.formatCurrency(budget)}</div>
                        </div>
                        <div class="trip-card-metric">
                            <div class="trip-card-metric-label">Pagado</div>
                            <div class="trip-card-metric-value">${App.formatCurrency(paid)}</div>
                        </div>
                        <div class="trip-card-metric">
                            <div class="trip-card-metric-label">Pendiente</div>
                            <div class="trip-card-metric-value" style="color: ${pending > 0 ? 'var(--warning)' : 'var(--text)'};">${App.formatCurrency(pending)}</div>
                        </div>
                        <div class="trip-card-metric">
                            <div class="trip-card-metric-label">Ahorrado</div>
                            <div class="trip-card-metric-value">${App.formatCurrency(saved)}</div>
                        </div>
                    </div>
                    <div class="trip-card-progress">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                            <span style="color: var(--text-muted);">Pagado del presupuesto</span>
                            <span style="font-weight: 600;">${pctPaid.toFixed(0)}%</span>
                        </div>
                        <div class="trips-progress"><div class="trips-progress-bar ${pctPaid >= 100 ? 'success' : pctPaid >= 70 ? '' : 'warning'}" style="width: ${Math.min(pctPaid, 100)}%;"></div></div>
                    </div>
                    <div class="trip-card-actions">
                        <button class="btn btn-secondary btn-sm" data-trip-action="view" data-trip-id="${trip.id}"><i class="fas fa-eye"></i> Ver</button>
                        <button class="btn btn-secondary btn-sm" data-trip-action="edit" data-trip-id="${trip.id}"><i class="fas fa-edit"></i> Editar</button>
                        <button class="btn btn-primary btn-sm" data-trip-action="payment" data-trip-id="${trip.id}"><i class="fas fa-credit-card"></i> Pago</button>
                    </div>
                </div>
            </div>
        `;
    }

    // =========================================================
    // ALERTAS
    // =========================================================
    function renderAlerts() {
        const container = containerEl.querySelector('#tripsAlertsContainer');
        const alerts = [];
        const settings = tripsData.settings;

        tripsData.trips.forEach(trip => {
            if (trip.status === 'cancelado') return;

            // Viaje próximo sin presupuesto
            if (settings.alertNoBudget && (!trip.budget || trip.budget === 0) && trip.startDate && getDaysUntil(trip.startDate) <= 60 && getDaysUntil(trip.startDate) >= 0) {
                alerts.push({
                    type: 'warning', icon: 'fas fa-calculator',
                    title: `${trip.name} sin presupuesto definido`,
                    desc: `El viaje a ${trip.destination} está próximo pero no tiene presupuesto asignado.`,
                    action: () => openTripModal(trip.id)
                });
            }

            // Pagos pendientes próximos
            if (settings.alertPendingPayments) {
                getTripReservations(trip.id).forEach(r => {
                    if (r.status === 'pagado' || r.status === 'cancelado') return;
                    if (r.pendingAmount <= 0) return;
                    r.paymentDates.forEach(date => {
                        const days = getDaysUntil(date);
                        if (days !== null && days >= 0 && days <= 15) {
                            alerts.push({
                                type: days <= 3 ? 'danger' : 'warning',
                                icon: 'fas fa-credit-card',
                                title: `Pago próximo: ${r.concept}`,
                                desc: `${App.formatCurrency(r.pendingAmount)} pendientes para ${trip.name}. Fecha: ${App.formatDate(date)} (${days === 0 ? 'hoy' : `en ${days} día${days > 1 ? 's' : ''}`}).`,
                                action: () => openTripDetail(trip.id, 'reservas')
                            });
                        }
                    });
                });
            }

            // Viaje próximo
            if (settings.alertUpcomingTrips) {
                const days = getDaysUntil(trip.startDate);
                if (days !== null && days >= 0 && days <= settings.upcomingDaysThreshold && trip.status !== 'completado') {
                    alerts.push({
                        type: 'info', icon: 'fas fa-plane-departure',
                        title: `${trip.name} en ${days} día${days !== 1 ? 's' : ''}`,
                        desc: `Salida el ${App.formatDate(trip.startDate)} hacia ${trip.destination}.`,
                        action: () => openTripDetail(trip.id)
                    });
                }
            }

            // Ahorro insuficiente
            if (settings.alertLowSavings && trip.savingsGoal && trip.savingsSaved < trip.savingsGoal) {
                const missing = trip.savingsGoal - trip.savingsSaved;
                alerts.push({
                    type: 'info', icon: 'fas fa-piggy-bank',
                    title: `Falta ahorrar para ${trip.name}`,
                    desc: `Objetivo: ${App.formatCurrency(trip.savingsGoal)}. Reservado: ${App.formatCurrency(trip.savingsSaved)}. Falta: ${App.formatCurrency(missing)}.`,
                    action: () => openTripDetail(trip.id, 'resumen')
                });
            }
        });

        if (alerts.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title"><i class="fas fa-bell"></i> Alertas y próximos pagos</div>
                        <div class="card-subtitle">${alerts.length} aviso(s) activo(s)</div>
                    </div>
                </div>
                <div class="trips-alert-list">
                    ${alerts.map((a, i) => `
                        <div class="trips-alert-item ${a.type}">
                            <div class="trips-alert-icon"><i class="${a.icon}"></i></div>
                            <div class="trips-alert-content">
                                <div class="trips-alert-title">${a.title}</div>
                                <div class="trips-alert-desc">${a.desc}</div>
                                <button class="trips-alert-action" data-alert-idx="${i}">Ver detalle →</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        container.querySelectorAll('[data-alert-idx]').forEach(btn => {
            btn.addEventListener('click', () => alerts[parseInt(btn.dataset.alertIdx)].action());
        });
    }

    // =========================================================
    // GRÁFICOS
    // =========================================================
    function getChartColors() {
        const isDark = App.isDarkMode ? App.isDarkMode() : false;
        return {
            text: isDark ? '#cbd5e1' : '#64748b',
            grid: isDark ? '#334155' : '#e2e8f0',
            bg: isDark ? '#1e293b' : '#ffffff'
        };
    }

    function renderCharts() {
        renderChartBudget();
        renderChartCategories();
        renderChartComparison();
    }

    function renderChartBudget() {
        const canvas = containerEl.querySelector('#tripsChartBudget');
        if (!canvas) return;
        if (charts.budget) charts.budget.destroy();

        const colors = getChartColors();
        const trips = tripsData.trips.filter(t => t.status !== 'cancelado' && t.status !== 'completado' && t.budget > 0);

        if (trips.length === 0) {
            canvas.parentElement.innerHTML = '<div class="trips-empty"><i class="fas fa-chart-bar"></i><h3>Sin datos</h3></div>';
            return;
        }

        charts.budget = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: trips.map(t => t.name),
                datasets: [{
                    label: 'Presupuesto',
                    data: trips.map(t => t.budget),
                    backgroundColor: trips.map(t => t.color + 'cc'),
                    borderColor: trips.map(t => t.color),
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => App.formatCurrency(ctx.parsed.x) } }
                },
                scales: {
                    x: { ticks: { color: colors.text, callback: v => App.formatCurrency(v) }, grid: { color: colors.grid } },
                    y: { ticks: { color: colors.text }, grid: { display: false } }
                }
            }
        });
    }

    function renderChartCategories() {
        const canvas = containerEl.querySelector('#tripsChartCategories');
        if (!canvas) return;
        if (charts.categories) charts.categories.destroy();

        const colors = getChartColors();
        const activeTrips = tripsData.trips.filter(t => !['cancelado', 'completado'].includes(t.status));
        const byCategory = {};

        activeTrips.forEach(trip => {
            tripsData.tripCategories.forEach(cat => {
                const budget = getTripBudgetByCategory(trip.id, cat.id);
                if (budget) {
                    if (!byCategory[cat.id]) byCategory[cat.id] = { name: cat.name, color: cat.color, total: 0 };
                    byCategory[cat.id].total += budget;
                }
            });
        });

        const items = Object.values(byCategory).sort((a, b) => b.total - a.total);
        if (items.length === 0) {
            canvas.parentElement.innerHTML = '<div class="trips-empty"><i class="fas fa-chart-pie"></i><h3>Sin datos</h3></div>';
            return;
        }

        charts.categories = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: items.map(i => i.name),
                datasets: [{
                    data: items.map(i => i.total),
                    backgroundColor: items.map(i => i.color),
                    borderWidth: 2, borderColor: colors.bg
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '65%',
                plugins: {
                    legend: { position: 'right', labels: { color: colors.text, font: { size: 11 }, padding: 8 } },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${App.formatCurrency(ctx.parsed)}` } }
                }
            }
        });
    }

    function renderChartComparison() {
        const canvas = containerEl.querySelector('#tripsChartComparison');
        if (!canvas) return;
        if (charts.comparison) charts.comparison.destroy();

        const colors = getChartColors();
        const completed = tripsData.trips.filter(t => t.status === 'completado');

        if (completed.length === 0) {
            canvas.parentElement.innerHTML = '<div class="trips-empty"><i class="fas fa-chart-bar"></i><h3>Sin viajes completados</h3><p>La comparativa aparecerá cuando completes algún viaje.</p></div>';
            return;
        }

        charts.comparison = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: completed.map(t => t.name),
                datasets: [
                    {
                        label: 'Presupuesto estimado',
                        data: completed.map(t => t.budget),
                        backgroundColor: 'rgba(37,99,235,0.2)',
                        borderColor: '#2563eb',
                        borderWidth: 2,
                        borderRadius: 4
                    },
                    {
                        label: 'Gasto real',
                        data: completed.map(t => getTripTotalSpent(t.id)),
                        backgroundColor: 'rgba(16,185,129,0.6)',
                        borderColor: '#10b981',
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { color: colors.text, font: { size: 11 } } },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${App.formatCurrency(ctx.parsed.y)}` } }
                },
                scales: {
                    x: { ticks: { color: colors.text }, grid: { display: false } },
                    y: { ticks: { color: colors.text, callback: v => App.formatCurrency(v) }, grid: { color: colors.grid } }
                }
            }
        });
    }

    // =========================================================
    // VISTA: MIS VIAJES
    // =========================================================
    function renderMisViajes() {
        const view = containerEl.querySelector('#tripsView-mis-viajes');
        view.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Todos los viajes</div>
                        <div class="card-subtitle" id="tripsCountLabel">0 viajes</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-sm btn-secondary" id="tripsExportBtn"><i class="fas fa-download"></i> Exportar</button>
                        <button class="btn btn-sm btn-primary" id="tripsNewTripBtn2"><i class="fas fa-plus"></i> Crear viaje</button>
                    </div>
                </div>
                <div class="trips-filters-bar">
                    <div class="trips-search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" id="tripsSearch" placeholder="Buscar por nombre o destino...">
                    </div>
                    <select class="trips-filter-select" id="tripsFilterStatus">
                        <option value="">Todos los estados</option>
                        <option value="idea">Idea</option>
                        <option value="planificado">Planificado</option>
                        <option value="reservado">Reservado</option>
                        <option value="en_curso">En curso</option>
                        <option value="completado">Completado</option>
                        <option value="cancelado">Cancelado</option>
                    </select>
                    <select class="trips-filter-select" id="tripsFilterType">
                        <option value="">Todos los tipos</option>
                        ${tripsData.tripTypes.map(t => `<option value="${t.id}">${App.escapeHtml(t.name)}</option>`).join('')}
                    </select>
                    <select class="trips-filter-select" id="tripsFilterYear">
                        <option value="">Todos los años</option>
                        <option value="2026">2026</option>
                        <option value="2027">2027</option>
                        <option value="2025">2025</option>
                    </select>
                    <select class="trips-filter-select" id="tripsFilterParticipant">
                        <option value="">Todas las personas</option>
                        ${App.data.profiles.map(p => `<option value="${p.id}">${App.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                    <select class="trips-filter-select" id="tripsFilterPending">
                        <option value="">Pagos</option>
                        <option value="yes">Con pendientes</option>
                        <option value="no">Sin pendientes</option>
                    </select>
                    <button class="btn btn-sm btn-secondary" id="tripsClearFilters"><i class="fas fa-times"></i> Limpiar</button>
                </div>
                <div class="trips-grid" id="tripsGrid"></div>
            </div>
        `;

        renderTripsGrid();

        view.querySelector('#tripsNewTripBtn2').addEventListener('click', () => openTripModal());
        view.querySelector('#tripsExportBtn').addEventListener('click', exportTrips);
        view.querySelector('#tripsSearch').addEventListener('input', (e) => { tripFilters.search = e.target.value; renderTripsGrid(); });
        view.querySelector('#tripsFilterStatus').addEventListener('change', (e) => { tripFilters.status = e.target.value; renderTripsGrid(); });
        view.querySelector('#tripsFilterType').addEventListener('change', (e) => { tripFilters.type = e.target.value; renderTripsGrid(); });
        view.querySelector('#tripsFilterYear').addEventListener('change', (e) => { tripFilters.year = e.target.value; renderTripsGrid(); });
        view.querySelector('#tripsFilterParticipant').addEventListener('change', (e) => { tripFilters.participant = e.target.value; renderTripsGrid(); });
        view.querySelector('#tripsFilterPending').addEventListener('change', (e) => { tripFilters.hasPending = e.target.value; renderTripsGrid(); });
        view.querySelector('#tripsClearFilters').addEventListener('click', () => {
            tripFilters = { search: '', status: '', type: '', destination: '', participant: '', year: '', hasPending: '' };
            view.querySelector('#tripsSearch').value = '';
            view.querySelector('#tripsFilterStatus').value = '';
            view.querySelector('#tripsFilterType').value = '';
            view.querySelector('#tripsFilterYear').value = '';
            view.querySelector('#tripsFilterParticipant').value = '';
            view.querySelector('#tripsFilterPending').value = '';
            renderTripsGrid();
        });

        // Sync con filtro global
        if (tripFilters.status) {
            view.querySelector('#tripsFilterStatus').value = tripFilters.status;
        }
    }

    function renderTripsGrid() {
        const grid = containerEl.querySelector('#tripsGrid');
        const list = getFilteredTrips();
        containerEl.querySelector('#tripsCountLabel').textContent = `${list.length} viaje(s)`;

        if (list.length === 0) {
            grid.innerHTML = '<div class="trips-empty"><i class="fas fa-suitcase"></i><h3>Sin viajes</h3><p>No hay viajes que coincidan con los filtros.</p></div>';
            return;
        }

        grid.innerHTML = list.map(t => renderTripCard(t)).join('');

        grid.querySelectorAll('[data-trip-id]').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                openTripDetail(el.dataset.tripId);
            });
        });
        grid.querySelectorAll('[data-trip-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.tripAction;
                const id = btn.dataset.tripId;
                if (action === 'view') openTripDetail(id);
                else if (action === 'edit') openTripModal(id);
                else if (action === 'payment') openReservationModal(null, id);
            });
        });
    }

    // =========================================================
    // VISTA: DETALLE DE VIAJE
    // =========================================================
    function openTripDetail(tripId, tab = 'resumen') {
        currentTripId = tripId;
        currentTripTab = tab;
        currentView = 'detalle';
        containerEl.querySelectorAll('.trips-subview').forEach(v =>
            v.classList.toggle('active', v.id === 'tripsView-detalle'));
        renderDetalle();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderDetalle() {
        const view = containerEl.querySelector('#tripsView-detalle');
        const trip = getTripById(currentTripId);
        if (!trip) {
            view.innerHTML = '<div class="trips-empty"><h3>Viaje no encontrado</h3><button class="btn btn-secondary" onclick="TripsApp.backToList()">Volver</button></div>';
            return;
        }

        const days = getTripDuration(trip);
        const budget = trip.budget || 0;
        const spent = getTripTotalSpent(trip.id);
        const estimated = getTripTotalEstimated(trip.id);
        const paid = getTripTotalPaid(trip.id);
        const pending = getTripPendingPayments(trip.id);
        const saved = trip.savingsSaved || 0;
        const diff = budget - spent;
        const pctSpent = budget > 0 ? (spent / budget) * 100 : 0;

        view.innerHTML = `
            <button class="btn btn-secondary btn-sm" id="tripsBackBtn" style="margin-bottom: 12px;">
                <i class="fas fa-arrow-left"></i> Volver a Mis viajes
            </button>

            <div class="trip-detail-header" style="--trip-color: ${trip.color}; --trip-color-end: ${trip.colorEnd || trip.color};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h2>${App.escapeHtml(trip.name)}</h2>
                        <div class="trip-detail-subtitle">
                            <i class="fas fa-map-marker-alt"></i>
                            ${App.escapeHtml(trip.destination)}
                            ${trip.startDate ? ` · <i class="fas fa-calendar"></i> ${App.formatDate(trip.startDate)} - ${App.formatDate(trip.endDate)}` : ''}
                            ${days ? ` · ${days} día${days > 1 ? 's' : ''}` : ''}
                            · ${getStatusBadge(trip.status)}
                        </div>
                    </div>
                </div>
                <div class="trip-detail-actions">
                    <button class="btn btn-sm" data-detail-action="edit"><i class="fas fa-edit"></i> Editar viaje</button>
                    <button class="btn btn-sm" data-detail-action="expense"><i class="fas fa-receipt"></i> Nuevo gasto</button>
                    <button class="btn btn-sm" data-detail-action="reservation"><i class="fas fa-credit-card"></i> Nueva reserva</button>
                    <button class="btn btn-sm" data-detail-action="activity"><i class="fas fa-calendar-plus"></i> Actividad</button>
                    <button class="btn btn-sm" data-detail-action="archive" style="margin-left: auto;"><i class="fas fa-archive"></i> ${trip.status === 'cancelado' ? 'Restaurar' : 'Archivar'}</button>
                </div>
            </div>

            <div class="trips-stats" style="grid-template-columns: repeat(5, 1fr);">
                <div class="trips-stat">
                    <div class="trips-stat-label">Presupuesto</div>
                    <div class="trips-stat-value">${App.formatCurrency(budget)}</div>
                    <div class="trips-stat-meta">Estimado</div>
                </div>
                <div class="trips-stat">
                    <div class="trips-stat-label">Gasto real</div>
                    <div class="trips-stat-value">${App.formatCurrency(spent)}</div>
                    <div class="trips-stat-meta">${pctSpent.toFixed(0)}% consumido</div>
                </div>
                <div class="trips-stat">
                    <div class="trips-stat-label">Diferencia</div>
                    <div class="trips-stat-value" style="color: ${diff >= 0 ? 'var(--success)' : 'var(--danger)'};">${App.formatCurrency(diff)}</div>
                    <div class="trips-stat-meta">${diff >= 0 ? 'Dentro del presupuesto' : 'Superado'}</div>
                </div>
                <div class="trips-stat">
                    <div class="trips-stat-label">Pagado</div>
                    <div class="trips-stat-value">${App.formatCurrency(paid)}</div>
                    <div class="trips-stat-meta">Pendiente: ${App.formatCurrency(pending)}</div>
                </div>
                <div class="trips-stat">
                    <div class="trips-stat-label">Ahorrado</div>
                    <div class="trips-stat-value">${App.formatCurrency(saved)}</div>
                    <div class="trips-stat-meta">${trip.savingsGoal ? `Objetivo: ${App.formatCurrency(trip.savingsGoal)}` : 'Sin objetivo'}</div>
                </div>
            </div>

            <div class="trip-detail-tabs">
                <button class="trip-detail-tab ${currentTripTab === 'resumen' ? 'active' : ''}" data-tab="resumen">Resumen</button>
                <button class="trip-detail-tab ${currentTripTab === 'presupuesto' ? 'active' : ''}" data-tab="presupuesto">Presupuesto</button>
                <button class="trip-detail-tab ${currentTripTab === 'gastos' ? 'active' : ''}" data-tab="gastos">Gastos</button>
                <button class="trip-detail-tab ${currentTripTab === 'reservas' ? 'active' : ''}" data-tab="reservas">Reservas y pagos</button>
                <button class="trip-detail-tab ${currentTripTab === 'itinerario' ? 'active' : ''}" data-tab="itinerario">Itinerario</button>
                <button class="trip-detail-tab ${currentTripTab === 'diario' ? 'active' : ''}" data-tab="diario">Calendario diario</button>
            </div>

            <div class="trip-detail-pane ${currentTripTab === 'resumen' ? 'active' : ''}" id="tripPane-resumen"></div>
            <div class="trip-detail-pane ${currentTripTab === 'presupuesto' ? 'active' : ''}" id="tripPane-presupuesto"></div>
            <div class="trip-detail-pane ${currentTripTab === 'gastos' ? 'active' : ''}" id="tripPane-gastos"></div>
            <div class="trip-detail-pane ${currentTripTab === 'reservas' ? 'active' : ''}" id="tripPane-reservas"></div>
            <div class="trip-detail-pane ${currentTripTab === 'itinerario' ? 'active' : ''}" id="tripPane-itinerario"></div>
            <div class="trip-detail-pane ${currentTripTab === 'diario' ? 'active' : ''}" id="tripPane-diario"></div>
        `;

        // Eventos
        view.querySelector('#tripsBackBtn').addEventListener('click', backToList);
        view.querySelectorAll('[data-detail-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.detailAction;
                if (action === 'edit') openTripModal(trip.id);
                else if (action === 'expense') openExpenseModal(null, trip.id);
                else if (action === 'reservation') openReservationModal(null, trip.id);
                else if (action === 'activity') openActivityModal(null, trip.id);
                else if (action === 'archive') toggleTripArchive(trip.id);
            });
        });
        view.querySelectorAll('.trip-detail-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                currentTripTab = tab.dataset.tab;
                view.querySelectorAll('.trip-detail-tab').forEach(t => t.classList.toggle('active', t === tab));
                view.querySelectorAll('.trip-detail-pane').forEach(p => p.classList.toggle('active', p.id === `tripPane-${currentTripTab}`));
                renderTripTab(currentTripTab);
            });
        });

        renderTripTab(currentTripTab);
    }

    function renderTripTab(tab) {
        if (tab === 'resumen') renderTripResumen();
        else if (tab === 'presupuesto') renderTripPresupuesto();
        else if (tab === 'gastos') renderTripGastos();
        else if (tab === 'reservas') renderTripReservas();
        else if (tab === 'itinerario') renderTripItinerario();
        else if (tab === 'diario') renderTripDiario();
    }

    function renderTripResumen() {
        const pane = containerEl.querySelector('#tripPane-resumen');
        const trip = getTripById(currentTripId);
        const budget = trip.budget || 0;
        const spent = getTripTotalSpent(trip.id);
        const diff = budget - spent;
        const paid = getTripTotalPaid(trip.id);
        const pending = getTripPendingPayments(trip.id);
        const saved = trip.savingsSaved || 0;
        const days = getTripDuration(trip);
        const dailyBudget = trip.dailyBudget || (days && budget ? budget / days : null);
        const savingsMissing = trip.savingsGoal ? trip.savingsGoal - saved : null;

        // Próximos hitos
        const upcomingActivities = getTripActivities(trip.id)
            .filter(a => a.date && getDaysUntil(a.date) !== null && getDaysUntil(a.date) >= 0)
            .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
            .slice(0, 5);

        const upcomingReservations = getTripReservations(trip.id)
            .filter(r => r.status !== 'pagado' && r.status !== 'cancelado')
            .flatMap(r => r.paymentDates.map(d => ({ ...r, paymentDate: d })))
            .filter(r => getDaysUntil(r.paymentDate) !== null && getDaysUntil(r.paymentDate) >= 0)
            .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate))
            .slice(0, 5);

        pane.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div class="card">
                    <div class="card-header"><div class="card-title">Información general</div></div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <div style="display: flex; justify-content: space-between; font-size: 13px;">
                            <span style="color: var(--text-secondary);">Destino</span>
                            <span style="font-weight: 500;">${App.escapeHtml(trip.destination)}</span>
                        </div>
                        ${trip.otherDestinations && trip.otherDestinations.length > 0 ? `
                            <div style="display: flex; justify-content: space-between; font-size: 13px;">
                                <span style="color: var(--text-secondary);">Otros destinos</span>
                                <span style="font-weight: 500;">${trip.otherDestinations.map(App.escapeHtml).join(', ')}</span>
                            </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between; font-size: 13px;">
                            <span style="color: var(--text-secondary);">Tipo</span>
                            <span style="font-weight: 500;">${getTypeById(trip.type)?.name || '—'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 13px;">
                            <span style="color: var(--text-secondary);">Participantes</span>
                            <span style="font-weight: 500;">${trip.participants.map(p => App.getProfileName(p)).join(', ')}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 13px;">
                            <span style="color: var(--text-secondary);">Duración</span>
                            <span style="font-weight: 500;">${days ? `${days} día${days > 1 ? 's' : ''}` : '—'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 13px;">
                            <span style="color: var(--text-secondary);">Presupuesto diario</span>
                            <span style="font-weight: 500;">${dailyBudget ? App.formatCurrency(dailyBudget) : '—'}</span>
                        </div>
                        ${trip.description ? `
                            <div style="padding-top: 10px; border-top: 1px solid var(--border-light); font-size: 13px; color: var(--text-secondary);">
                                ${App.escapeHtml(trip.description)}
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="card">
                    <div class="card-header"><div class="card-title">Objetivo de ahorro</div></div>
                    ${trip.savingsGoal ? `
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <div style="display: flex; justify-content: space-between; font-size: 13px;">
                                <span style="color: var(--text-secondary);">Objetivo</span>
                                <span style="font-weight: 600;">${App.formatCurrency(trip.savingsGoal)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 13px;">
                                <span style="color: var(--text-secondary);">Reservado</span>
                                <span style="font-weight: 600; color: var(--success);">${App.formatCurrency(saved)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 13px;">
                                <span style="color: var(--text-secondary);">Por reservar</span>
                                <span style="font-weight: 600; color: ${savingsMissing > 0 ? 'var(--warning)' : 'var(--success)'};">${App.formatCurrency(savingsMissing)}</span>
                            </div>
                            ${trip.savingsMonthly ? `
                                <div style="display: flex; justify-content: space-between; font-size: 13px;">
                                    <span style="color: var(--text-secondary);">Aportación mensual</span>
                                    <span style="font-weight: 500;">${App.formatCurrency(trip.savingsMonthly)}</span>
                                </div>
                            ` : ''}
                            <div class="trips-progress" style="margin-top: 6px;">
                                <div class="trips-progress-bar" style="width: ${Math.min((saved/trip.savingsGoal)*100, 100)}%;"></div>
                            </div>
                            <div style="font-size: 11px; color: var(--text-muted); text-align: center;">
                                ${((saved/trip.savingsGoal)*100).toFixed(0)}% del objetivo
                            </div>
                        </div>
                    ` : `
                        <div class="trips-empty" style="padding: 20px;">
                            <i class="fas fa-piggy-bank"></i>
                            <p>Sin objetivo de ahorro definido</p>
                        </div>
                    `}
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
                <div class="card">
                    <div class="card-header"><div class="card-title">Próximos hitos</div></div>
                    ${upcomingActivities.length === 0 && upcomingReservations.length === 0 ? `
                        <div class="trips-empty" style="padding: 20px;">
                            <i class="fas fa-calendar-check"></i>
                            <p>Sin hitos próximos</p>
                        </div>
                    ` : `
                        <div class="timeline">
                            ${[...upcomingActivities.map(a => ({ type: 'activity', data: a, date: a.date })),
                                ...upcomingReservations.map(r => ({ type: 'reservation', data: r, date: r.paymentDate }))]
                                .sort((a, b) => a.date.localeCompare(b.date))
                                .slice(0, 6)
                                .map(item => {
                                    const daysUntil = getDaysUntil(item.date);
                                    if (item.type === 'activity') {
                                        return `
                                            <div class="timeline-item">
                                                <div class="timeline-content">
                                                    <div class="timeline-title"><i class="fas fa-map-marked-alt"></i> ${App.escapeHtml(item.data.title)}</div>
                                                    <div class="timeline-meta">${App.formatDate(item.date)} ${item.data.time ? `· ${item.data.time}` : ''} · ${daysUntil === 0 ? 'Hoy' : `en ${daysUntil} día${daysUntil > 1 ? 's' : ''}`}</div>
                                                </div>
                                            </div>
                                        `;
                                    } else {
                                        return `
                                            <div class="timeline-item pending">
                                                <div class="timeline-content">
                                                    <div class="timeline-title"><i class="fas fa-credit-card"></i> Pago: ${App.escapeHtml(item.data.concept)}</div>
                                                    <div class="timeline-meta">${App.formatDate(item.date)} · ${App.formatCurrency(item.data.pendingAmount)} · ${daysUntil === 0 ? 'Hoy' : `en ${daysUntil} día${daysUntil > 1 ? 's' : ''}`}</div>
                                                </div>
                                            </div>
                                        `;
                                    }
                                }).join('')}
                        </div>
                    `}
                </div>

                <div class="card">
                    <div class="card-header"><div class="card-title">Distribución del gasto</div></div>
                    <div class="trips-chart-container" style="height: 220px;"><canvas id="tripDetailChart"></canvas></div>
                </div>
            </div>
        `;

        renderTripDetailChart();
    }

    function renderTripDetailChart() {
        const canvas = containerEl.querySelector('#tripDetailChart');
        if (!canvas) return;
        if (charts.detail) charts.detail.destroy();

        const colors = getChartColors();
        const byCategory = {};
        getTripExpenses(currentTripId, false).forEach(e => {
            const cat = getCategoryById(e.categoryId);
            if (!cat) return;
            if (!byCategory[cat.id]) byCategory[cat.id] = { name: cat.name, color: cat.color, total: 0 };
            byCategory[cat.id].total += e.amount;
        });

        const items = Object.values(byCategory).sort((a, b) => b.total - a.total);
        if (items.length === 0) {
            canvas.parentElement.innerHTML = '<div class="trips-empty" style="padding: 20px;"><i class="fas fa-chart-pie"></i><p>Sin gastos registrados</p></div>';
            return;
        }

        charts.detail = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: items.map(i => i.name),
                datasets: [{
                    data: items.map(i => i.total),
                    backgroundColor: items.map(i => i.color),
                    borderWidth: 2, borderColor: colors.bg
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '60%',
                plugins: {
                    legend: { position: 'right', labels: { color: colors.text, font: { size: 11 }, padding: 6 } },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${App.formatCurrency(ctx.parsed)}` } }
                }
            }
        });
    }

    function renderTripPresupuesto() {
        const pane = containerEl.querySelector('#tripPane-presupuesto');
        const trip = getTripById(currentTripId);

        let totalBudget = 0, totalSpent = 0;
        const rows = tripsData.tripCategories.map(cat => {
            const budget = getTripBudgetByCategory(trip.id, cat.id);
            const spent = getTripExpenseByCategory(trip.id, cat.id);
            if (budget) totalBudget += budget;
            totalSpent += spent;
            return { cat, budget, spent };
        }).filter(r => r.budget !== null || r.spent > 0);

        pane.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Presupuesto por categorías</div>
                        <div class="card-subtitle">Total: ${App.formatCurrency(totalBudget)} · Gastado: ${App.formatCurrency(totalSpent)}</div>
                    </div>
                    <button class="btn btn-sm btn-primary" id="tripEditBudgetBtn"><i class="fas fa-edit"></i> Editar presupuestos</button>
                </div>
                <div class="trips-table-desktop">
                    <div class="trips-table-wrap">
                        <table class="trips-table">
                            <thead>
                                <tr>
                                    <th>Categoría</th>
                                    <th>Presupuesto</th>
                                    <th>Gastado</th>
                                    <th>Diferencia</th>
                                    <th>% Consumido</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows.map(r => {
                                    const diff = r.budget !== null ? r.budget - r.spent : null;
                                    const pct = r.budget && r.budget > 0 ? (r.spent / r.budget) * 100 : null;
                                    const pctBadge = pct === null ? '<span class="badge badge-neutral">—</span>' :
                                        pct >= 100 ? `<span class="badge badge-danger">${pct.toFixed(0)}%</span>` :
                                        pct >= 80 ? `<span class="badge badge-warning">${pct.toFixed(0)}%</span>` :
                                        `<span class="badge badge-success">${pct.toFixed(0)}%</span>`;
                                    const statusBadge = r.budget === null ? '<span class="badge badge-neutral">Sin presupuesto</span>' :
                                        pct >= 100 ? '<span class="badge badge-danger">Superado</span>' :
                                        pct >= 80 ? '<span class="badge badge-warning">Alerta</span>' :
                                        '<span class="badge badge-success">OK</span>';
                                    return `
                                        <tr>
                                            <td>
                                                <div style="display: flex; align-items: center; gap: 10px;">
                                                    <div style="width: 28px; height: 28px; border-radius: 6px; background: ${r.cat.color}; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px;">
                                                        <i class="${r.cat.icon}"></i>
                                                    </div>
                                                    <span>${App.escapeHtml(r.cat.name)}</span>
                                                </div>
                                            </td>
                                            <td class="amount">${r.budget !== null ? App.formatCurrency(r.budget) : '—'}</td>
                                            <td class="amount">${App.formatCurrency(r.spent)}</td>
                                            <td class="amount" style="color: ${diff === null ? 'var(--text-muted)' : diff >= 0 ? 'var(--success)' : 'var(--danger)'};">
                                                ${diff !== null ? App.formatCurrency(diff) : '—'}
                                            </td>
                                            <td>${pctBadge}</td>
                                            <td>${statusBadge}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        pane.querySelector('#tripEditBudgetBtn').addEventListener('click', () => openBudgetEditor());
    }

    function openBudgetEditor() {
        const trip = getTripById(currentTripId);
        const modal = containerEl.querySelector('#tripsTripModal');
        containerEl.querySelector('#tripsTripModalTitle').textContent = `Presupuestos - ${trip.name}`;

        const body = containerEl.querySelector('#tripsTripModalBody');
        body.innerHTML = `
            <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
                Define el presupuesto para cada categoría de gasto del viaje.
            </p>
            <div class="trips-form-row single">
                <div class="trips-form-group">
                    <label class="trips-form-label">Presupuesto total del viaje (€)</label>
                    <input type="number" step="0.01" min="0" class="trips-form-input" id="tripTotalBudget" value="${trip.budget || ''}">
                </div>
            </div>
            <div class="trips-section-title">Presupuesto por categorías</div>
            ${tripsData.tripCategories.map(cat => {
                const budget = getTripBudgetByCategory(trip.id, cat.id);
                return `
                    <div class="trips-form-row">
                        <div class="trips-form-group">
                            <label class="trips-form-label" style="display: flex; align-items: center; gap: 8px;">
                                <span style="width: 24px; height: 24px; border-radius: 5px; background: ${cat.color}; color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 11px;">
                                    <i class="${cat.icon}"></i>
                                </span>
                                ${App.escapeHtml(cat.name)}
                            </label>
                            <input type="number" step="0.01" min="0" class="trips-form-input" data-cat-budget="${cat.id}" value="${budget !== null ? budget : ''}">
                        </div>
                    </div>
                `;
            }).join('')}
        `;

        // Reutilizar modal de viaje pero con handler especial
        const saveBtn = containerEl.querySelector('#tripsSaveTripBtn');
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        newBtn.id = 'tripsSaveTripBtn';
        newBtn.addEventListener('click', () => {
            const totalBudget = parseFloat(containerEl.querySelector('#tripTotalBudget').value);
            if (!isNaN(totalBudget)) trip.budget = totalBudget;

            tripsData.tripCategories.forEach(cat => {
                const input = containerEl.querySelector(`[data-cat-budget="${cat.id}"]`);
                const val = parseFloat(input.value);
                const existing = tripsData.tripBudgets.find(b => b.tripId === trip.id && b.categoryId === cat.id);
                if (!isNaN(val) && val >= 0) {
                    if (existing) existing.amount = val;
                    else tripsData.tripBudgets.push({ id: App.generateId('tb'), tripId: trip.id, categoryId: cat.id, amount: val });
                } else if (existing) {
                    tripsData.tripBudgets = tripsData.tripBudgets.filter(b => b !== existing);
                }
            });

            saveData();
            modal.classList.remove('active');
            App.showToast('Presupuestos actualizados');
            renderDetalle();
        });

        modal.classList.add('active');
    }

    function renderTripGastos() {
        const pane = containerEl.querySelector('#tripPane-gastos');
        const expenses = getTripExpenses(currentTripId, true)
            .sort((a, b) => b.date.localeCompare(a.date));
        const total = expenses.filter(e => e.status !== 'estimado').reduce((s, e) => s + e.amount, 0);

        pane.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Gastos del viaje</div>
                        <div class="card-subtitle">${expenses.length} gasto(s) · Total: ${App.formatCurrency(total)}</div>
                    </div>
                    <button class="btn btn-sm btn-primary" id="tripNewExpenseBtn"><i class="fas fa-plus"></i> Nuevo gasto</button>
                </div>
                <div class="trips-table-desktop">
                    <div class="trips-table-wrap">
                        <table class="trips-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Concepto</th>
                                    <th>Categoría</th>
                                    <th>Importe</th>
                                    <th>Estado</th>
                                    <th>Pago</th>
                                    <th style="width: 80px;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${expenses.length === 0 ? '<tr><td colspan="7"><div class="trips-empty"><i class="fas fa-receipt"></i><h3>Sin gastos</h3></div></td></tr>' :
                                expenses.map(e => {
                                    const cat = getCategoryById(e.categoryId);
                                    const statusBadge = e.status === 'estimado' ? '<span class="badge badge-neutral">Estimado</span>' :
                                        e.status === 'previsto' ? '<span class="badge badge-info">Previsto</span>' :
                                        '<span class="badge badge-success">Registrado</span>';
                                    return `
                                        <tr>
                                            <td>${App.formatDate(e.date)}</td>
                                            <td>
                                                <div style="font-weight: 500;">${App.escapeHtml(e.concept)}</div>
                                                ${e.isAggregated ? '<span class="badge badge-neutral" style="margin-top: 2px;">Agregado</span>' : ''}
                                                ${e.notes ? `<div style="font-size: 11px; color: var(--text-muted);">${App.escapeHtml(e.notes)}</div>` : ''}
                                            </td>
                                            <td>
                                                ${cat ? `
                                                    <div style="display: flex; align-items: center; gap: 6px;">
                                                        <span style="width: 20px; height: 20px; border-radius: 4px; background: ${cat.color}; color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 10px;">
                                                            <i class="${cat.icon}"></i>
                                                        </span>
                                                        <span>${App.escapeHtml(cat.name)}</span>
                                                    </div>
                                                ` : '<span style="color: var(--text-muted);">Sin categorizar</span>'}
                                            </td>
                                            <td class="amount negative">${App.formatCurrency(e.amount)}</td>
                                            <td>${statusBadge}</td>
                                            <td>${getPaymentStatusBadge(e.paymentStatus)}</td>
                                            <td>
                                                <div class="trips-action-menu">
                                                    <button class="btn btn-icon btn-ghost" data-expense-menu="${e.id}"><i class="fas fa-ellipsis-v"></i></button>
                                                    <div class="trips-action-dropdown" id="temenu-${e.id}">
                                                        <button data-expense-action="edit" data-id="${e.id}"><i class="fas fa-edit"></i> Editar</button>
                                                        <button data-expense-action="delete" data-id="${e.id}" class="danger"><i class="fas fa-trash"></i> Eliminar</button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        pane.querySelector('#tripNewExpenseBtn').addEventListener('click', () => openExpenseModal(null, currentTripId));

        pane.querySelectorAll('[data-expense-menu]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.expenseMenu;
                pane.querySelectorAll('.trips-action-dropdown.open').forEach(m => {
                    if (m.id !== `temenu-${id}`) m.classList.remove('open');
                });
                pane.querySelector(`#temenu-${id}`).classList.toggle('open');
            });
        });

        pane.querySelectorAll('[data-expense-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.expenseAction;
                const id = btn.dataset.id;
                pane.querySelectorAll('.trips-action-dropdown.open').forEach(m => m.classList.remove('open'));
                if (action === 'edit') openExpenseModal(id, currentTripId);
                else if (action === 'delete') confirmDeleteExpense(id);
            });
        });
    }

    function confirmDeleteExpense(id) {
        const exp = tripsData.tripExpenses.find(e => e.id === id);
        if (!exp) return;
        App.showConfirm(
            'Eliminar gasto',
            `¿Seguro que quieres eliminar "${exp.concept}" (${App.formatCurrency(exp.amount)})?`,
            () => {
                tripsData.tripExpenses = tripsData.tripExpenses.filter(e => e.id !== id);
                saveData();
                App.showToast('Gasto eliminado');
                renderDetalle();
            }
        );
    }

    function renderTripReservas() {
        const pane = containerEl.querySelector('#tripPane-reservas');
        const reservations = getTripReservations(currentTripId);
        const totalPending = reservations.reduce((s, r) => s + (r.status !== 'cancelado' ? r.pendingAmount : 0), 0);

        pane.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Reservas y pagos</div>
                        <div class="card-subtitle">${reservations.length} reserva(s) · Pendiente total: ${App.formatCurrency(totalPending)}</div>
                    </div>
                    <button class="btn btn-sm btn-primary" id="tripNewReservationBtn"><i class="fas fa-plus"></i> Nueva reserva</button>
                </div>
                ${reservations.length === 0 ? `
                    <div class="trips-empty">
                        <i class="fas fa-credit-card"></i>
                        <h3>Sin reservas</h3>
                        <p>Registra las reservas del viaje (vuelos, hotel, entradas...)</p>
                    </div>
                ` : `
                    <div class="trips-table-desktop">
                        <div class="trips-table-wrap">
                            <table class="trips-table">
                                <thead>
                                    <tr>
                                        <th>Concepto</th>
                                        <th>Proveedor</th>
                                        <th>Total</th>
                                        <th>Pagado</th>
                                        <th>Pendiente</th>
                                        <th>Próximo pago</th>
                                        <th>Estado</th>
                                        <th style="width: 80px;">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${reservations.map(r => {
                                        const nextPayment = r.paymentDates
                                            .filter(d => getDaysUntil(d) !== null && getDaysUntil(d) >= 0)
                                            .sort()[0];
                                        return `
                                            <tr>
                                                <td>
                                                    <div style="font-weight: 500;">${App.escapeHtml(r.concept)}</div>
                                                    ${r.conditions ? `<div style="font-size: 11px; color: var(--text-muted);">${App.escapeHtml(r.conditions)}</div>` : ''}
                                                </td>
                                                <td>${App.escapeHtml(r.provider || '—')}</td>
                                                <td class="amount">${App.formatCurrency(r.totalAmount)}</td>
                                                <td class="amount positive">${App.formatCurrency(r.paidAmount)}</td>
                                                <td class="amount ${r.pendingAmount > 0 ? 'negative' : ''}">${App.formatCurrency(r.pendingAmount)}</td>
                                                <td>${nextPayment ? App.formatDate(nextPayment) : '—'}</td>
                                                <td>${getReservationStatusLabel(r.status)}</td>
                                                <td>
                                                    <div class="trips-action-menu">
                                                        <button class="btn btn-icon btn-ghost" data-res-menu="${r.id}"><i class="fas fa-ellipsis-v"></i></button>
                                                        <div class="trips-action-dropdown" id="rmenu-${r.id}">
                                                            <button data-res-action="edit" data-id="${r.id}"><i class="fas fa-edit"></i> Editar</button>
                                                            <button data-res-action="pay" data-id="${r.id}"><i class="fas fa-money-bill"></i> Registrar pago</button>
                                                            <button data-res-action="delete" data-id="${r.id}" class="danger"><i class="fas fa-trash"></i> Eliminar</button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `}
            </div>
        `;

        pane.querySelector('#tripNewReservationBtn').addEventListener('click', () => openReservationModal(null, currentTripId));

        pane.querySelectorAll('[data-res-menu]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.resMenu;
                pane.querySelectorAll('.trips-action-dropdown.open').forEach(m => {
                    if (m.id !== `rmenu-${id}`) m.classList.remove('open');
                });
                pane.querySelector(`#rmenu-${id}`).classList.toggle('open');
            });
        });

        pane.querySelectorAll('[data-res-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.resAction;
                const id = btn.dataset.id;
                pane.querySelectorAll('.trips-action-dropdown.open').forEach(m => m.classList.remove('open'));
                if (action === 'edit') openReservationModal(id, currentTripId);
                else if (action === 'pay') openPaymentModal(id);
                else if (action === 'delete') confirmDeleteReservation(id);
            });
        });
    }

    function confirmDeleteReservation(id) {
        const r = tripsData.tripReservations.find(r => r.id === id);
        if (!r) return;
        App.showConfirm(
            'Eliminar reserva',
            `¿Seguro que quieres eliminar "${r.concept}"?`,
            () => {
                tripsData.tripReservations = tripsData.tripReservations.filter(r => r.id !== id);
                saveData();
                App.showToast('Reserva eliminada');
                renderDetalle();
            }
        );
    }

    function openPaymentModal(reservationId) {
        const r = tripsData.tripReservations.find(r => r.id === reservationId);
        if (!r) return;

        const modal = containerEl.querySelector('#tripsReservationModal');
        containerEl.querySelector('#tripsReservationModalTitle').textContent = `Registrar pago - ${r.concept}`;

        const body = containerEl.querySelector('#tripsReservationModalBody');
        body.innerHTML = `
            <div style="padding: 14px; background: var(--border-light); border-radius: var(--radius-sm); margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: var(--text-secondary); font-size: 13px;">Importe total</span>
                    <strong>${App.formatCurrency(r.totalAmount)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: var(--text-secondary); font-size: 13px;">Ya pagado</span>
                    <strong style="color: var(--success);">${App.formatCurrency(r.paidAmount)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-secondary); font-size: 13px;">Pendiente</span>
                    <strong style="color: var(--danger);">${App.formatCurrency(r.pendingAmount)}</strong>
                </div>
            </div>
            <div class="trips-form-row single">
                <div class="trips-form-group">
                    <label class="trips-form-label">Importe a pagar (€) *</label>
                    <input type="number" step="0.01" min="0" max="${r.pendingAmount}" class="trips-form-input" id="paymentAmount" value="${r.pendingAmount}">
                    <div class="trips-form-error">Importe inválido</div>
                    <div class="trips-form-hint">Máximo pendiente: ${App.formatCurrency(r.pendingAmount)}</div>
                </div>
            </div>
            <div class="trips-form-row single">
                <div class="trips-form-group">
                    <label class="trips-form-label">Fecha del pago</label>
                    <input type="date" class="trips-form-input" id="paymentDate" value="${new Date().toISOString().substring(0, 10)}">
                </div>
            </div>
            <div class="trips-form-row single">
                <div class="trips-form-group">
                    <label class="trips-form-label">Notas</label>
                    <input type="text" class="trips-form-input" id="paymentNotes" placeholder="Opcional">
                </div>
            </div>
        `;

        const saveBtn = containerEl.querySelector('#tripsSaveReservationBtn');
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        newBtn.id = 'tripsSaveReservationBtn';
        newBtn.addEventListener('click', () => {
            const amount = parseFloat(containerEl.querySelector('#paymentAmount').value);
            if (isNaN(amount) || amount <= 0 || amount > r.pendingAmount) {
                containerEl.querySelector('#paymentAmount').closest('.trips-form-group').classList.add('error');
                return;
            }

            r.paidAmount += amount;
            r.pendingAmount -= amount;
            const paymentDate = containerEl.querySelector('#paymentDate').value;
            if (paymentDate && !r.paymentDates.includes(paymentDate)) {
                r.paymentDates.push(paymentDate);
            }

            if (r.pendingAmount <= 0.01) {
                r.status = 'pagado';
                r.pendingAmount = 0;
            } else if (r.paidAmount > 0) {
                r.status = 'parcial';
            }

            saveData();
            modal.classList.remove('active');
            App.showToast(`Pago de ${App.formatCurrency(amount)} registrado`);
            renderDetalle();
        });

        modal.classList.add('active');
    }

    function renderTripItinerario() {
        const pane = containerEl.querySelector('#tripPane-itinerario');
        const activities = getTripActivities(currentTripId);

        // Agrupar por fecha
        const byDate = {};
        activities.forEach(a => {
            if (!byDate[a.date]) byDate[a.date] = [];
            byDate[a.date].push(a);
        });

        const dates = Object.keys(byDate).sort();

        pane.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Itinerario</div>
                        <div class="card-subtitle">${activities.length} actividad(es) planificada(s)</div>
                    </div>
                    <button class="btn btn-sm btn-primary" id="tripNewActivityBtn"><i class="fas fa-plus"></i> Nueva actividad</button>
                </div>
                ${dates.length === 0 ? `
                    <div class="trips-empty">
                        <i class="fas fa-route"></i>
                        <h3>Sin actividades</h3>
                        <p>Planifica las actividades del viaje día a día.</p>
                    </div>
                ` : dates.map(date => `
                    <div style="margin-bottom: 20px;">
                        <div style="font-weight: 600; font-size: 14px; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-calendar-day" style="color: var(--primary);"></i>
                            ${App.formatDate(date)}
                            ${getDaysUntil(date) !== null ? `<span style="font-size: 11px; color: var(--text-muted); font-weight: 400;">(${getDaysUntil(date) === 0 ? 'hoy' : getDaysUntil(date) > 0 ? `en ${getDaysUntil(date)} días` : `hace ${-getDaysUntil(date)} días`})</span>` : ''}
                        </div>
                        <div class="timeline">
                            ${byDate[date].map(a => `
                                <div class="timeline-item">
                                    <div class="timeline-content">
                                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                                            <div style="flex: 1;">
                                                <div class="timeline-title">${App.escapeHtml(a.title)}</div>
                                                <div class="timeline-meta">
                                                    ${a.time ? `<i class="fas fa-clock"></i> ${a.time} · ` : ''}
                                                    ${a.location ? `<i class="fas fa-map-marker-alt"></i> ${App.escapeHtml(a.location)} · ` : ''}
                                                    ${a.estimatedCost > 0 ? `<i class="fas fa-euro-sign"></i> ${App.formatCurrency(a.estimatedCost)}` : ''}
                                                </div>
                                                ${a.notes ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${App.escapeHtml(a.notes)}</div>` : ''}
                                            </div>
                                            <div style="display: flex; gap: 4px;">
                                                <button class="btn btn-icon btn-ghost btn-sm" data-activity-edit="${a.id}"><i class="fas fa-edit"></i></button>
                                                <button class="btn btn-icon btn-ghost btn-sm" data-activity-delete="${a.id}"><i class="fas fa-trash"></i></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        pane.querySelector('#tripNewActivityBtn').addEventListener('click', () => openActivityModal(null, currentTripId));

        pane.querySelectorAll('[data-activity-edit]').forEach(btn => {
            btn.addEventListener('click', () => openActivityModal(btn.dataset.activityEdit, currentTripId));
        });
        pane.querySelectorAll('[data-activity-delete]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.activityDelete;
                const a = tripsData.tripActivities.find(a => a.id === id);
                App.showConfirm('Eliminar actividad', `¿Eliminar "${a.title}"?`, () => {
                    tripsData.tripActivities = tripsData.tripActivities.filter(a => a.id !== id);
                    saveData();
                    App.showToast('Actividad eliminada');
                    renderDetalle();
                });
            });
        });
    }

    function renderTripDiario() {
        const pane = containerEl.querySelector('#tripPane-diario');
        const trip = getTripById(currentTripId);
        if (!trip.startDate || !trip.endDate) {
            pane.innerHTML = '<div class="trips-empty"><i class="fas fa-calendar"></i><h3>Sin fechas</h3><p>Define las fechas del viaje para ver el calendario diario.</p></div>';
            return;
        }

        const days = getTripDuration(trip);
        const dailyBudget = trip.dailyBudget || (trip.budget ? trip.budget / days : 0);
        const expenses = getTripExpenses(currentTripId, false);

        // Generar días
        const start = new Date(trip.startDate + 'T00:00:00');
        const dayCards = [];
        let totalSpent = 0, totalBudget = 0;

        for (let i = 0; i < days; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().substring(0, 10);
            const dayExpenses = expenses.filter(e => e.date === dateStr);
            const daySpent = dayExpenses.reduce((s, e) => s + e.amount, 0);
            const diff = dailyBudget - daySpent;
            totalSpent += daySpent;
            totalBudget += dailyBudget;

            dayCards.push({
                date: dateStr,
                dateObj: d,
                expenses: dayExpenses,
                spent: daySpent,
                budget: dailyBudget,
                diff
            });
        }

        const avgDaily = days > 0 ? totalSpent / days : 0;
        const remaining = totalBudget - totalSpent;

        pane.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Calendario diario</div>
                        <div class="card-subtitle">Control del gasto día a día</div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
                    <div style="padding: 12px; background: var(--border-light); border-radius: var(--radius-sm);">
                        <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Presupuesto diario</div>
                        <div style="font-size: 18px; font-weight: 700; margin-top: 4px;">${App.formatCurrency(dailyBudget)}</div>
                    </div>
                    <div style="padding: 12px; background: var(--border-light); border-radius: var(--radius-sm);">
                        <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Media diaria</div>
                        <div style="font-size: 18px; font-weight: 700; margin-top: 4px;">${App.formatCurrency(avgDaily)}</div>
                    </div>
                    <div style="padding: 12px; background: var(--border-light); border-radius: var(--radius-sm);">
                        <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Total gastado</div>
                        <div style="font-size: 18px; font-weight: 700; margin-top: 4px; color: var(--danger);">${App.formatCurrency(totalSpent)}</div>
                    </div>
                    <div style="padding: 12px; background: var(--border-light); border-radius: var(--radius-sm);">
                        <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Restante</div>
                        <div style="font-size: 18px; font-weight: 700; margin-top: 4px; color: ${remaining >= 0 ? 'var(--success)' : 'var(--danger)'};">${App.formatCurrency(remaining)}</div>
                    </div>
                </div>

                ${dayCards.map(day => {
                    const isPast = day.dateObj < new Date();
                    const isToday = day.date === new Date().toISOString().substring(0, 10);
                    return `
                        <div class="day-card" style="${isToday ? 'border-color: var(--primary); border-width: 2px;' : ''} ${isPast && day.spent === 0 ? 'opacity: 0.6;' : ''}">
                            <div class="day-card-head">
                                <div>
                                    <div class="day-card-date">
                                        ${day.dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                                        ${isToday ? ' <span class="badge badge-info">Hoy</span>' : ''}
                                    </div>
                                    <div style="font-size: 11px; color: var(--text-muted);">Límite: ${App.formatCurrency(day.budget)}</div>
                                </div>
                                <div class="day-card-amount ${day.diff >= 0 ? 'under' : 'over'}">
                                    ${App.formatCurrency(day.spent)}
                                </div>
                            </div>
                            ${day.expenses.length > 0 ? `
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    ${day.expenses.map(e => {
                                        const cat = getCategoryById(e.categoryId);
                                        return `
                                            <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0;">
                                                <span>${cat ? `<i class="${cat.icon}" style="color: ${cat.color}; margin-right: 4px;"></i>` : ''}${App.escapeHtml(e.concept)}</span>
                                                <span style="font-weight: 600;">${App.formatCurrency(e.amount)}</span>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            ` : `<div style="font-size: 12px; color: var(--text-muted);">Sin gastos registrados</div>`}
                            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-light); display: flex; justify-content: space-between; font-size: 11px;">
                                <span style="color: var(--text-muted);">Margen del día</span>
                                <span style="font-weight: 600; color: ${day.diff >= 0 ? 'var(--success)' : 'var(--danger)'};">
                                    ${day.diff >= 0 ? '+' : ''}${App.formatCurrency(day.diff)}
                                </span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // =========================================================
    // MODAL: VIAJE
    // =========================================================
    function openTripModal(id = null) {
        const modal = containerEl.querySelector('#tripsTripModal');
        const body = containerEl.querySelector('#tripsTripModalBody');
        containerEl.querySelector('#tripsTripModalTitle').textContent = id ? 'Editar viaje' : 'Nuevo viaje';

        const trip = id ? getTripById(id) : null;

        body.innerHTML = `
            <input type="hidden" id="tripEditId" value="${id || ''}">

            <div class="trips-section-title" style="margin-top: 0;">Información general</div>
            <div class="trips-form-row single">
                <div class="trips-form-group">
                    <label class="trips-form-label">Nombre del viaje *</label>
                    <input type="text" class="trips-form-input" id="tripName" value="${trip ? App.escapeHtml(trip.name) : ''}" required>
                    <div class="trips-form-error">Nombre obligatorio</div>
                </div>
            </div>
            <div class="trips-form-row">
                <div class="trips-form-group">
                    <label class="trips-form-label">Destino principal *</label>
                    <input type="text" class="trips-form-input" id="tripDestination" value="${trip ? App.escapeHtml(trip.destination) : ''}" required>
                    <div class="trips-form-error">Destino obligatorio</div>
                </div>
                <div class="trips-form-group">
                    <label class="trips-form-label">Tipo de viaje</label>
                    <select class="trips-form-select" id="tripType">
                        ${tripsData.tripTypes.map(t => `<option value="${t.id}" ${trip && trip.type === t.id ? 'selected' : ''}>${App.escapeHtml(t.name)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="trips-form-row">
                <div class="trips-form-group">
                    <label class="trips-form-label">Fecha de salida</label>
                    <input type="date" class="trips-form-input" id="tripStartDate" value="${trip ? trip.startDate : ''}">
                </div>
                <div class="trips-form-group">
                    <label class="trips-form-label">Fecha de regreso</label>
                    <input type="date" class="trips-form-input" id="tripEndDate" value="${trip ? trip.endDate : ''}">
                    <div class="trips-form-error">La fecha de regreso debe ser posterior a la salida</div>
                </div>
            </div>
            <div class="trips-form-row">
                <div class="trips-form-group">
                    <label class="trips-form-label">Participantes</label>
                    <select class="trips-form-select" id="tripParticipants" multiple size="3">
                        ${App.data.profiles.map(p => `<option value="${p.id}" ${trip && trip.participants.includes(p.id) ? 'selected' : ''}>${App.escapeHtml(p.name)}</option>`).join('')}
                        <option value="conjunto" ${trip && trip.participants.includes('conjunto') ? 'selected' : ''}>Conjunto</option>
                    </select>
                    <div class="trips-form-hint">Mantén Ctrl/Cmd para seleccionar varios</div>
                </div>
                <div class="trips-form-group">
                    <label class="trips-form-label">Estado</label>
                    <select class="trips-form-select" id="tripStatus">
                        <option value="idea" ${trip && trip.status === 'idea' ? 'selected' : ''}>Idea</option>
                        <option value="planificado" ${!trip || trip.status === 'planificado' ? 'selected' : ''}>Planificado</option>
                        <option value="reservado" ${trip && trip.status === 'reservado' ? 'selected' : ''}>Reservado</option>
                        <option value="en_curso" ${trip && trip.status === 'en_curso' ? 'selected' : ''}>En curso</option>
                        <option value="completado" ${trip && trip.status === 'completado' ? 'selected' : ''}>Completado</option>
                        <option value="cancelado" ${trip && trip.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                    </select>
                </div>
            </div>
            <div class="trips-form-row single">
                <div class="trips-form-group">
                    <label class="trips-form-label">Descripción</label>
                    <textarea class="trips-form-textarea" id="tripDescription">${trip ? App.escapeHtml(trip.description || '') : ''}</textarea>
                </div>
            </div>

            <button type="button" class="trips-details-toggle" id="tripToggleBudget">
                <i class="fas fa-chevron-right"></i> Presupuesto y ahorro
            </button>
            <div class="trips-details-content" id="tripBudgetContent">
                <div class="trips-section-title">Presupuesto</div>
                <div class="trips-form-row">
                    <div class="trips-form-group">
                        <label class="trips-form-label">Presupuesto total estimado (€)</label>
                        <input type="number" step="0.01" min="0" class="trips-form-input" id="tripBudget" value="${trip ? trip.budget || '' : ''}">
                    </div>
                    <div class="trips-form-group">
                        <label class="trips-form-label">Presupuesto diario (€)</label>
                        <input type="number" step="0.01" min="0" class="trips-form-input" id="tripDailyBudget" value="${trip ? trip.dailyBudget || '' : ''}">
                        <div class="trips-form-hint">Se calcula automáticamente si se deja vacío</div>
                    </div>
                </div>
                <div class="trips-form-row">
                    <div class="trips-form-group">
                        <label class="trips-form-label">Moneda</label>
                        <select class="trips-form-select" id="tripCurrency">
                            <option value="EUR" ${trip && trip.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                            <option value="USD" ${trip && trip.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                            <option value="GBP" ${trip && trip.currency === 'GBP' ? 'selected' : ''}>GBP (£)</option>
                        </select>
                    </div>
                    <div class="trips-form-group">
                        <label class="trips-form-label">Margen imprevistos (%)</label>
                        <input type="number" step="1" min="0" max="100" class="trips-form-input" id="tripContingency" value="${trip ? trip.contingencyPercent || 10 : 10}">
                    </div>
                </div>

                <div class="trips-section-title">Objetivo de ahorro</div>
                <div class="trips-form-row">
                    <div class="trips-form-group">
                        <label class="trips-form-label">Importe objetivo (€)</label>
                        <input type="number" step="0.01" min="0" class="trips-form-input" id="tripSavingsGoal" value="${trip ? trip.savingsGoal || '' : ''}">
                    </div>
                    <div class="trips-form-group">
                        <label class="trips-form-label">Ya reservado (€)</label>
                        <input type="number" step="0.01" min="0" class="trips-form-input" id="tripSavingsSaved" value="${trip ? trip.savingsSaved || 0 : 0}">
                    </div>
                </div>
                <div class="trips-form-row">
                    <div class="trips-form-group">
                        <label class="trips-form-label">Fecha objetivo</label>
                        <input type="date" class="trips-form-input" id="tripSavingsDate" value="${trip ? trip.savingsTargetDate || '' : ''}">
                    </div>
                    <div class="trips-form-group">
                        <label class="trips-form-label">Aportación mensual (€)</label>
                        <input type="number" step="0.01" min="0" class="trips-form-input" id="tripSavingsMonthly" value="${trip ? trip.savingsMonthly || '' : ''}">
                    </div>
                </div>
            </div>

            <button type="button" class="trips-details-toggle" id="tripToggleAppearance">
                <i class="fas fa-chevron-right"></i> Apariencia
            </button>
            <div class="trips-details-content" id="tripAppearanceContent">
                <div class="trips-form-row single">
                    <div class="trips-form-group">
                        <label class="trips-form-label">Color</label>
                        <div class="trips-color-grid" id="tripColorGrid"></div>
                        <input type="hidden" id="tripColor" value="${trip ? trip.color : '#2563eb'}">
                    </div>
                </div>
            </div>
        `;

        // Color picker
        const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#a855f7', '#dc2626', '#0ea5e9', '#d97706', '#059669', '#7c3aed', '#64748b', '#94a3b8'];
        const colorGrid = body.querySelector('#tripColorGrid');
        colorGrid.innerHTML = colors.map(c => `<div class="trips-color-option" data-color="${c}" style="background: ${c};"></div>`).join('');
        colorGrid.querySelectorAll('.trips-color-option').forEach(opt => {
            opt.addEventListener('click', () => {
                colorGrid.querySelectorAll('.trips-color-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                body.querySelector('#tripColor').value = opt.dataset.color;
            });
        });
        const currentColor = body.querySelector('#tripColor').value;
        const selectedColor = colorGrid.querySelector(`[data-color="${currentColor}"]`);
        if (selectedColor) selectedColor.classList.add('selected');

        // Toggles
        body.querySelector('#tripToggleBudget').addEventListener('click', function() {
            const content = body.querySelector('#tripBudgetContent');
            const isOpen = content.classList.toggle('open');
            this.innerHTML = `<i class="fas fa-chevron-${isOpen ? 'down' : 'right'}"></i> Presupuesto y ahorro`;
        });
        body.querySelector('#tripToggleAppearance').addEventListener('click', function() {
            const content = body.querySelector('#tripAppearanceContent');
            const isOpen = content.classList.toggle('open');
            this.innerHTML = `<i class="fas fa-chevron-${isOpen ? 'down' : 'right'}"></i> Apariencia`;
        });

        // Cálculo automático presupuesto diario
        const startDateInput = body.querySelector('#tripStartDate');
        const endDateInput = body.querySelector('#tripEndDate');
        const budgetInput = body.querySelector('#tripBudget');
        const dailyBudgetInput = body.querySelector('#tripDailyBudget');

        function updateDailyBudget() {
            if (dailyBudgetInput.value) return; // No sobrescribir si el usuario lo ha definido
            const start = startDateInput.value;
            const end = endDateInput.value;
            const budget = parseFloat(budgetInput.value);
            if (start && end && !isNaN(budget) && budget > 0) {
                const s = new Date(start + 'T00:00:00');
                const e = new Date(end + 'T00:00:00');
                const days = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
                if (days > 0) {
                    dailyBudgetInput.placeholder = App.formatCurrency(budget / days) + ' (auto)';
                }
            }
        }
        [startDateInput, endDateInput, budgetInput].forEach(el => el.addEventListener('change', updateDailyBudget));
        updateDailyBudget();

        // Restaurar handler del botón guardar
        const saveBtn = containerEl.querySelector('#tripsSaveTripBtn');
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        newBtn.id = 'tripsSaveTripBtn';
        newBtn.addEventListener('click', saveTrip);

        modal.classList.add('active');
    }

    function saveTrip() {
        const body = containerEl.querySelector('#tripsTripModalBody');
        const id = body.querySelector('#tripEditId').value;
        const name = body.querySelector('#tripName').value.trim();
        const destination = body.querySelector('#tripDestination').value.trim();
        const startDate = body.querySelector('#tripStartDate').value;
        const endDate = body.querySelector('#tripEndDate').value;

        body.querySelectorAll('.trips-form-group').forEach(g => g.classList.remove('error'));

        let valid = true;
        if (!name) { body.querySelector('#tripName').closest('.trips-form-group').classList.add('error'); valid = false; }
        if (!destination) { body.querySelector('#tripDestination').closest('.trips-form-group').classList.add('error'); valid = false; }
        if (startDate && endDate && endDate < startDate) {
            body.querySelector('#tripEndDate').closest('.trips-form-group').classList.add('error');
            valid = false;
        }
        if (!valid) return;

        const participants = Array.from(body.querySelector('#tripParticipants').selectedOptions).map(o => o.value);

        const budgetVal = parseFloat(body.querySelector('#tripBudget').value);
        const dailyBudgetVal = parseFloat(body.querySelector('#tripDailyBudget').value);
        const savingsGoalVal = parseFloat(body.querySelector('#tripSavingsGoal').value);
        const savingsSavedVal = parseFloat(body.querySelector('#tripSavingsSaved').value);
        const savingsMonthlyVal = parseFloat(body.querySelector('#tripSavingsMonthly').value);

        const tripData = {
            name,
            destination,
            otherDestinations: [],
            type: body.querySelector('#tripType').value,
            startDate,
            endDate,
            participants: participants.length > 0 ? participants : ['conjunto'],
            status: body.querySelector('#tripStatus').value,
            description: body.querySelector('#tripDescription').value.trim(),
            color: body.querySelector('#tripColor').value,
            colorEnd: body.querySelector('#tripColor').value,
            budget: isNaN(budgetVal) ? null : budgetVal,
            currency: body.querySelector('#tripCurrency').value,
            splitMethod: 'equal',
            dailyBudget: isNaN(dailyBudgetVal) ? null : dailyBudgetVal,
            contingencyPercent: parseInt(body.querySelector('#tripContingency').value) || 10,
            savingsGoal: isNaN(savingsGoalVal) ? null : savingsGoalVal,
            savingsSaved: isNaN(savingsSavedVal) ? 0 : savingsSavedVal,
            savingsTargetDate: body.querySelector('#tripSavingsDate').value,
            savingsMonthly: isNaN(savingsMonthlyVal) ? null : savingsMonthlyVal,
            savingsResponsible: 'conjunto'
        };

        if (id) {
            const trip = getTripById(id);
            Object.assign(trip, tripData);
            App.addHistory('trip_updated', name);
            App.showToast('Viaje actualizado');
        } else {
            tripData.id = App.generateId('trip');
            tripsData.trips.push(tripData);
            App.addHistory('trip_created', name);
            App.showToast('Viaje creado');
        }

        saveData();
        containerEl.querySelector('#tripsTripModal').classList.remove('active');

        if (currentView === 'detalle' && id) renderDetalle();
        else renderView(currentView);
    }

    function toggleTripArchive(id) {
        const trip = getTripById(id);
        if (!trip) return;
        const newStatus = trip.status === 'cancelado' ? 'planificado' : 'cancelado';
        trip.status = newStatus;
        saveData();
        App.showToast(newStatus === 'cancelado' ? 'Viaje archivado' : 'Viaje restaurado');
        renderDetalle();
    }

    // =========================================================
    // MODAL: GASTO
    // =========================================================
    function openExpenseModal(id = null, tripId = null) {
        const modal = containerEl.querySelector('#tripsExpenseModal');
        const body = containerEl.querySelector('#tripsExpenseModalBody');
        containerEl.querySelector('#tripsExpenseModalTitle').textContent = id ? 'Editar gasto' : 'Nuevo gasto';

        const exp = id ? tripsData.tripExpenses.find(e => e.id === id) : null;
        const tid = tripId || (exp ? exp.tripId : currentTripId);

        body.innerHTML = `
            <input type="hidden" id="expenseEditId" value="${id || ''}">
            <input type="hidden" id="expenseTripId" value="${tid}">

            <div class="trips-form-row single">
                <div class="trips-form-group">
                    <label class="trips-form-label">Concepto *</label>
                    <input type="text" class="trips-form-input" id="expenseConcept" value="${exp ? App.escapeHtml(exp.concept) : ''}" required>
                    <div class="trips-form-error">Concepto obligatorio</div>
                </div>
            </div>
            <div class="trips-form-row three">
                <div class="trips-form-group">
                    <label class="trips-form-label">Importe (€) *</label>
                    <input type="number" step="0.01" min="0" class="trips-form-input" id="expenseAmount" value="${exp ? exp.amount : ''}" required>
                    <div class="trips-form-error">Importe inválido</div>
                </div>
                <div class="trips-form-group">
                    <label class="trips-form-label">Fecha *</label>
                    <input type="date" class="trips-form-input" id="expenseDate" value="${exp ? exp.date : new Date().toISOString().substring(0, 10)}" required>
                    <div class="trips-form-error">Fecha obligatoria</div>
                </div>
                <div class="trips-form-group">
                    <label class="trips-form-label">Categoría</label>
                    <select class="trips-form-select" id="expenseCategory">
                        <option value="">Sin categorizar</option>
                        ${tripsData.tripCategories.map(c => `<option value="${c.id}" ${exp && exp.categoryId === c.id ? 'selected' : ''}>${App.escapeHtml(c.name)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="trips-form-row">
                <div class="trips-form-group">
                    <label class="trips-form-label">Estado del gasto</label>
                    <select class="trips-form-select" id="expenseStatus">
                        <option value="registrado" ${exp && exp.status === 'registrado' ? 'selected' : (!exp ? 'selected' : '')}>Registrado (gasto real)</option>
                        <option value="previsto" ${exp && exp.status === 'previsto' ? 'selected' : ''}>Previsto (pendiente de confirmar)</option>
                        <option value="estimado" ${exp && exp.status === 'estimado' ? 'selected' : ''}>Estimación (no contar como real)</option>
                    </select>
                    <div class="trips-form-hint">Las estimaciones no se suman al gasto real</div>
                </div>
                <div class="trips-form-group">
                    <label class="trips-form-label">Estado del pago</label>
                    <select class="trips-form-select" id="expensePaymentStatus">
                        <option value="pendiente" ${exp && exp.paymentStatus === 'pendiente' ? 'selected' : (!exp ? 'selected' : '')}>Pendiente</option>
                        <option value="parcial" ${exp && exp.paymentStatus === 'parcial' ? 'selected' : ''}>Parcial</option>
                        <option value="pagado" ${exp && exp.paymentStatus === 'pagado' ? 'selected' : ''}>Pagado</option>
                    </select>
                </div>
            </div>
            <div class="trips-form-row">
                <div class="trips-form-group">
                    <label class="trips-form-label">Persona</label>
                    <select class="trips-form-select" id="expensePerson">
                        <option value="conjunto" ${exp && exp.person === 'conjunto' ? 'selected' : (!exp ? 'selected' : '')}>Conjunto</option>
                        ${App.data.profiles.map(p => `<option value="${p.id}" ${exp && exp.person === p.id ? 'selected' : ''}>${App.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="trips-form-group">
                    <label class="trips-form-label">
                        <input type="checkbox" id="expenseAggregated" ${exp && exp.isAggregated ? 'checked' : ''} style="margin-right: 6px;">
                        Gasto agregado (estimación sin desglose)
                    </label>
                    <div class="trips-form-hint">Marca si es una estimación global, no un gasto individual</div>
                </div>
            </div>
            <div class="trips-form-row single">
                <div class="trips-form-group">
                    <label class="trips-form-label">Notas</label>
                    <textarea class="trips-form-textarea" id="expenseNotes">${exp ? App.escapeHtml(exp.notes || '') : ''}</textarea>
                </div>
            </div>
        `;

        const saveBtn = containerEl.querySelector('#tripsSaveExpenseBtn');
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        newBtn.id = 'tripsSaveExpenseBtn';
        newBtn.addEventListener('click', saveExpense);

        modal.classList.add('active');
    }

    function saveExpense() {
        const body = containerEl.querySelector('#tripsExpenseModalBody');
        const id = body.querySelector('#expenseEditId').value;
        const tripId = body.querySelector('#expenseTripId').value;
        const concept = body.querySelector('#expenseConcept').value.trim();
        const amount = parseFloat(body.querySelector('#expenseAmount').value);
        const date = body.querySelector('#expenseDate').value;

        body.querySelectorAll('.trips-form-group').forEach(g => g.classList.remove('error'));

        let valid = true;
        if (!concept) { body.querySelector('#expenseConcept').closest('.trips-form-group').classList.add('error'); valid = false; }
        if (isNaN(amount) || amount <= 0) { body.querySelector('#expenseAmount').closest('.trips-form-group').classList.add('error'); valid = false; }
        if (!date) { body.querySelector('#expenseDate').closest('.trips-form-group').classList.add('error'); valid = false; }
        if (!valid) return;

        const expenseData = {
            tripId,
            concept,
            amount,
            date,
            categoryId: body.querySelector('#expenseCategory').value,
            status: body.querySelector('#expenseStatus').value,
            paymentStatus: body.querySelector('#expensePaymentStatus').value,
            person: body.querySelector('#expensePerson').value,
            isAggregated: body.querySelector('#expenseAggregated').checked,
            notes: body.querySelector('#expenseNotes').value.trim(),
            linkedExpenseId: null
        };

        if (id) {
            const exp = tripsData.tripExpenses.find(e => e.id === id);
            Object.assign(exp, expenseData);
            App.addHistory('trip_expense_updated', concept);
            App.showToast('Gasto actualizado');
        } else {
            expenseData.id = App.generateId('te');
            tripsData.tripExpenses.push(expenseData);
            App.addHistory('trip_expense_created', concept);
            App.showToast('Gasto registrado');
        }

        saveData();
        containerEl.querySelector('#tripsExpenseModal').classList.remove('active');
        if (currentView === 'detalle') renderDetalle();
        else renderView(currentView);
    }

    // =========================================================
    // MODAL: RESERVA
    // =========================================================
    function openReservationModal(id = null, tripId = null) {
        const modal = containerEl.querySelector('#tripsReservationModal');
        const body = containerEl.querySelector('#tripsReservationModalBody');
        containerEl.querySelector('#tripsReservationModalTitle').textContent = id ? 'Editar reserva' : 'Nueva reserva';

        const res = id ? tripsData.tripReservations.find(r => r.id === id) : null;
        const tid = tripId || (res ? res.tripId : currentTripId);

        body.innerHTML = `
            <input type="hidden" id="resEditId" value="${id || ''}">
            <input type="hidden" id="resTripId" value="${tid}">

            <div class="trips-form-row">
                <div class="trips-form-group">
                    <label class="trips-form-label">Concepto *</label>
                    <input type="text" class="trips-form-input" id="resConcept" value="${res ? App.escapeHtml(res.concept) : ''}" required>
                    <div class="trips-form-error">Concepto obligatorio</div>
                </div>
                <div class="trips-form-group">
                    <label class="trips-form-label">Proveedor</label>
                    <input type="text" class="trips-form-input" id="resProvider" value="${res ? App.escapeHtml(res.provider || '') : ''}">
                </div>
            </div>
            <div class="trips-form-row three">
                <div class="trips-form-group">
                    <label class="trips-form-label">Importe total (€) *</label>
                    <input type="number" step="0.01" min="0" class="trips-form-input" id="resTotal" value="${res ? res.totalAmount : ''}" required>
                    <div class="trips-form-error">Importe inválido</div>
                </div>
                <div class="trips-form-group">
                    <label class="trips-form-label">Ya pagado (€)</label>
                    <input type="number" step="0.01" min="0" class="trips-form-input" id="resPaid" value="${res ? res.paidAmount : 0}">
                </div>
                <div class="trips-form-group">
                    <label class="trips-form-label">Categoría</label>
                    <select class="trips-form-select" id="resCategory">
                        ${tripsData.tripCategories.map(c => `<option value="${c.id}" ${res && res.categoryId === c.id ? 'selected' : ''}>${App.escapeHtml(c.name)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="trips-form-row">
                <div class="trips-form-group">
                    <label class="trips-form-label">Fecha de reserva</label>
                    <input type="date" class="trips-form-input" id="resReservationDate" value="${res ? res.reservationDate : ''}">
                </div>
                <div class="trips-form-group">
                    <label class="trips-form-label">Fecha del servicio</label>
                    <input type="date" class="trips-form-input" id="resServiceDate" value="${res ? res.serviceDate : ''}">
                </div>
            </div>
            <div class="trips-form-row single">
                <div class="trips-form-group">
                    <label class="trips-form-label">Fechas de pago (separadas por coma, formato AAAA-MM-DD)</label>
                    <input type="text" class="trips-form-input" id="resPaymentDates" value="${res ? res.paymentDates.join(', ') : ''}" placeholder="2026-12-01, 2026-12-15">
                    <div class="trips-form-hint">Permite pagos fraccionados indicando varias fechas</div>
                </div>
            </div>
            <div class="trips-form-row">
                <div class="trips-form-group">
                    <label class="trips-form-label">Estado</label>
                    <select class="trips-form-select" id="resStatus">
                        <option value="pendiente" ${res && res.status === 'pendiente' ? 'selected' : ''}>Pendiente de reservar</option>
                        <option value="reservado" ${!res || res.status === 'reservado' ? 'selected' : ''}>Reservado</option>
                        <option value="parcial" ${res && res.status === 'parcial' ? 'selected' : ''}>Parcialmente pagado</option>
                        <option value="pagado" ${res && res.status === 'pagado' ? 'selected' : ''}>Pagado</option>
                        <option value="cancelado" ${res && res.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                    </select>
                </div>
                <div class="trips-form-group">
                    <label class="trips-form-label">Política / Condiciones</label>
                    <input type="text" class="trips-form-input" id="resConditions" value="${res ? App.escapeHtml(res.conditions || '') : ''}" placeholder="Ej: Cancelación gratuita hasta 7 días antes">
                </div>
            </div>
            <div class="trips-form-row single">
                <div class="trips-form-group">
                    <label class="trips-form-label">Notas</label>
                    <textarea class="trips-form-textarea" id="resNotes">${res ? App.escapeHtml(res.notes || '') : ''}</textarea>
                </div>
            </div>
        `;

        // Auto-calcular pendiente
        const totalInput = body.querySelector('#resTotal');
        const paidInput = body.querySelector('#resPaid');
        function updatePending() {
            const total = parseFloat(totalInput.value) || 0;
            const paid = parseFloat(paidInput.value) || 0;
            paidInput.max = total;
        }
        totalInput.addEventListener('input', updatePending);
        paidInput.addEventListener('input', updatePending);

        const saveBtn = containerEl.querySelector('#tripsSaveReservationBtn');
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        newBtn.id = 'tripsSaveReservationBtn';
        newBtn.addEventListener('click', saveReservation);

        modal.classList.add('active');
    }

    function saveReservation() {
        const body = containerEl.querySelector('#tripsReservationModalBody');
        const id = body.querySelector('#resEditId').value;
        const tripId = body.querySelector('#resTripId').value;
        const concept = body.querySelector('#resConcept').value.trim();
        const totalAmount = parseFloat(body.querySelector('#resTotal').value);
        const paidAmount = parseFloat(body.querySelector('#resPaid').value) || 0;

        body.querySelectorAll('.trips-form-group').forEach(g => g.classList.remove('error'));

        let valid = true;
        if (!concept) { body.querySelector('#resConcept').closest('.trips-form-group').classList.add('error'); valid = false; }
        if (isNaN(totalAmount) || totalAmount <= 0) { body.querySelector('#resTotal').closest('.trips-form-group').classList.add('error'); valid = false; }
        if (paidAmount > totalAmount) {
            body.querySelector('#resPaid').closest('.trips-form-group').classList.add('error');
            App.showToast('El importe pagado no puede superar el total', 'error');
            valid = false;
        }
        if (!valid) return;

        const paymentDatesStr = body.querySelector('#resPaymentDates').value;
        const paymentDates = paymentDatesStr.split(',').map(s => s.trim()).filter(s => s);

        const resData = {
            tripId,
            concept,
            provider: body.querySelector('#resProvider').value.trim(),
            totalAmount,
            paidAmount,
            pendingAmount: totalAmount - paidAmount,
            reservationDate: body.querySelector('#resReservationDate').value,
            paymentDates,
            serviceDate: body.querySelector('#resServiceDate').value,
            categoryId: body.querySelector('#resCategory').value,
            status: body.querySelector('#resStatus').value,
            conditions: body.querySelector('#resConditions').value.trim(),
            notes: body.querySelector('#resNotes').value.trim()
        };

        if (id) {
            const res = tripsData.tripReservations.find(r => r.id === id);
            Object.assign(res, resData);
            App.addHistory('reservation_updated', concept);
            App.showToast('Reserva actualizada');
        } else {
            resData.id = App.generateId('tr');
            tripsData.tripReservations.push(resData);
            App.addHistory('reservation_created', concept);
            App.showToast('Reserva creada');
        }

        saveData();
        containerEl.querySelector('#tripsReservationModal').classList.remove('active');
        if (currentView === 'detalle') renderDetalle();
        else renderView(currentView);
    }

    // =========================================================
    // MODAL: ACTIVIDAD
    // =========================================================
    function openActivityModal(id = null, tripId = null) {
        const modal = containerEl.querySelector('#tripsActivityModal');
        const body = containerEl.querySelector('#tripsActivityModalBody');
        containerEl.querySelector('#tripsActivityModalTitle').textContent = id ? 'Editar actividad' : 'Nueva actividad';

        const act = id ? tripsData.tripActivities.find(a => a.id === id) : null;
        const tid = tripId || (act ? act.tripId : currentTripId);
        const trip = getTripById(tid);

        body.innerHTML = `
            <input type="hidden" id="actEditId" value="${id || ''}">
            <input type="hidden" id="actTripId" value="${tid}">

            <div class="trips-form-row single">
                <div class="trips-form-group">
                    <label class="trips-form-label">Título *</label>
                    <input type="text" class="trips-form-input" id="actTitle" value="${act ? App.escapeHtml(act.title) : ''}" required>
                    <div class="trips-form-error">Título obligatorio</div>
                </div>
            </div>
            <div class="trips-form-row three">
                <div class="trips-form-group">
                    <label class="trips-form-label">Fecha *</label>
                    <input type="date" class="trips-form-input" id="actDate" value="${act ? act.date : (trip ? trip.startDate : '')}" required>
                    <div class="trips-form-error">Fecha obligatoria</div>
                </div>
                <div class="trips-form-group">
                    <label class="trips-form-label">Hora</label>
                    <input type="time" class="trips-form-input" id="actTime" value="${act ? act.time || '' : ''}">
                </div>
                <div class="trips-form-group">
                    <label class="trips-form-label">Tipo</label>
                    <select class="trips-form-select" id="actType">
                        <option value="transporte" ${act && act.type === 'transporte' ? 'selected' : ''}>Transporte</option>
                        <option value="alojamiento" ${act && act.type === 'alojamiento' ? 'selected' : ''}>Alojamiento</option>
                        <option value="actividad" ${act && act.type === 'actividad' ? 'selected' : (!act ? 'selected' : '')}>Actividad</option>
                        <option value="restaurante" ${act && act.type === 'restaurante' ? 'selected' : ''}>Restaurante</option>
                        <option value="excursion" ${act && act.type === 'excursion' ? 'selected' : ''}>Excursión</option>
                        <option value="otro" ${act && act.type === 'otro' ? 'selected' : ''}>Otro</option>
                    </select>
                </div>
            </div>
            <div class="trips-form-row">
                <div class="trips-form-group">
                    <label class="trips-form-label">Ubicación</label>
                    <input type="text" class="trips-form-input" id="actLocation" value="${act ? App.escapeHtml(act.location || '') : ''}" placeholder="Texto libre">
                </div>
                <div class="trips-form-group">
                    <label class="trips-form-label">Coste estimado (€)</label>
                    <input type="number" step="0.01" min="0" class="trips-form-input" id="actCost" value="${act ? act.estimatedCost || '' : ''}">
                    <div class="trips-form-hint">No se suma al gasto real hasta que se registre como gasto</div>
                </div>
            </div>
            <div class="trips-form-row single">
                <div class="trips-form-group">
                    <label class="trips-form-label">Notas</label>
                    <textarea class="trips-form-textarea" id="actNotes">${act ? App.escapeHtml(act.notes || '') : ''}</textarea>
                </div>
            </div>
        `;

        const saveBtn = containerEl.querySelector('#tripsSaveActivityBtn');
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        newBtn.id = 'tripsSaveActivityBtn';
        newBtn.addEventListener('click', saveActivity);

        modal.classList.add('active');
    }

    function saveActivity() {
        const body = containerEl.querySelector('#tripsActivityModalBody');
        const id = body.querySelector('#actEditId').value;
        const tripId = body.querySelector('#actTripId').value;
        const title = body.querySelector('#actTitle').value.trim();
        const date = body.querySelector('#actDate').value;

        body.querySelectorAll('.trips-form-group').forEach(g => g.classList.remove('error'));

        let valid = true;
        if (!title) { body.querySelector('#actTitle').closest('.trips-form-group').classList.add('error'); valid = false; }
        if (!date) { body.querySelector('#actDate').closest('.trips-form-group').classList.add('error'); valid = false; }
        if (!valid) return;

        const cost = parseFloat(body.querySelector('#actCost').value);

        const actData = {
            tripId,
            title,
            date,
            time: body.querySelector('#actTime').value,
            type: body.querySelector('#actType').value,
            location: body.querySelector('#actLocation').value.trim(),
            estimatedCost: isNaN(cost) ? 0 : cost,
            status: 'pendiente',
            notes: body.querySelector('#actNotes').value.trim()
        };

        if (id) {
            const act = tripsData.tripActivities.find(a => a.id === id);
            Object.assign(act, actData);
            App.showToast('Actividad actualizada');
        } else {
            actData.id = App.generateId('ta');
            tripsData.tripActivities.push(actData);
            App.showToast('Actividad añadida');
        }

        saveData();
        containerEl.querySelector('#tripsActivityModal').classList.remove('active');
        if (currentView === 'detalle') renderDetalle();
    }

    // =========================================================
    // VISTA: PLANIFICACIÓN
    // =========================================================
    function renderPlanificacion() {
        const view = containerEl.querySelector('#tripsView-planificacion');
        view.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Planificar un nuevo viaje</div>
                        <div class="card-subtitle">Crea un viaje nuevo o guarda una idea para más adelante</div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
                    <button class="btn btn-primary" onclick="TripsApp.openTripModal()" style="padding: 20px; justify-content: center; flex-direction: column; gap: 8px;">
                        <i class="fas fa-plus-circle" style="font-size: 24px;"></i>
                        <span>Crear viaje completo</span>
                    </button>
                    <button class="btn btn-secondary" onclick="TripsApp.openTripModalQuick('idea')" style="padding: 20px; justify-content: center; flex-direction: column; gap: 8px;">
                        <i class="fas fa-lightbulb" style="font-size: 24px; color: var(--warning);"></i>
                        <span>Guardar una idea</span>
                    </button>
                    <button class="btn btn-secondary" onclick="TripsApp.openTripModalQuick('escapada')" style="padding: 20px; justify-content: center; flex-direction: column; gap: 8px;">
                        <i class="fas fa-suitcase-rolling" style="font-size: 24px; color: var(--info);"></i>
                        <span>Planificar escapada</span>
                    </button>
                </div>
                <div style="margin-top: 20px; padding: 16px; background: var(--border-light); border-radius: var(--radius); font-size: 13px; color: var(--text-secondary);">
                    <strong style="color: var(--text);"><i class="fas fa-info-circle"></i> Consejo:</strong>
                    Puedes crear un viaje sin fechas ni presupuesto definitivos y completarlo más adelante.
                    Los gastos registrados en Viajes pueden vincularse al presupuesto común cuando corresponda.
                </div>
            </div>
        `;
    }

    // =========================================================
    // VISTA: CONFIGURACIÓN
    // =========================================================
    function renderConfiguracion() {
        const view = containerEl.querySelector('#tripsView-configuracion');
        const s = tripsData.settings;

        view.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Configuración de Viajes</div>
                        <div class="card-subtitle">Personaliza el comportamiento de la sección</div>
                    </div>
                </div>

                <div class="trips-config-section">
                    <h3><i class="fas fa-bell"></i> Alertas</h3>
                    <div class="trips-config-row">
                        <span class="label">Alertar de viajes sin presupuesto</span>
                        <label class="trips-switch"><input type="checkbox" id="cfgAlertNoBudget" ${s.alertNoBudget ? 'checked' : ''}><span class="trips-slider"></span></label>
                    </div>
                    <div class="trips-config-row">
                        <span class="label">Alertar de pagos pendientes próximos</span>
                        <label class="trips-switch"><input type="checkbox" id="cfgAlertPending" ${s.alertPendingPayments ? 'checked' : ''}><span class="trips-slider"></span></label>
                    </div>
                    <div class="trips-config-row">
                        <span class="label">Alertar de viajes próximos</span>
                        <label class="trips-switch"><input type="checkbox" id="cfgAlertUpcoming" ${s.alertUpcomingTrips ? 'checked' : ''}><span class="trips-slider"></span></label>
                    </div>
                    <div class="trips-config-row">
                        <span class="label">Alertar de ahorro insuficiente</span>
                        <label class="trips-switch"><input type="checkbox" id="cfgAlertLowSavings" ${s.alertLowSavings ? 'checked' : ''}><span class="trips-slider"></span></label>
                    </div>
                    <div class="trips-config-row">
                        <span class="label">Días de antelación para alertas de viaje próximo</span>
                        <input type="number" min="1" max="365" class="trips-form-input" style="width: 100px;" id="cfgUpcomingDays" value="${s.upcomingDaysThreshold}">
                    </div>
                </div>

                <div class="trips-config-section">
                    <h3><i class="fas fa-euro-sign"></i> Presupuestos</h3>
                    <div class="trips-config-row">
                        <span class="label">Moneda predeterminada</span>
                        <select class="trips-filter-select" id="cfgCurrency">
                            <option value="EUR" ${s.defaultCurrency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                            <option value="USD" ${s.defaultCurrency === 'USD' ? 'selected' : ''}>USD ($)</option>
                            <option value="GBP" ${s.defaultCurrency === 'GBP' ? 'selected' : ''}>GBP (£)</option>
                        </select>
                    </div>
                    <div class="trips-config-row">
                        <span class="label">Margen por defecto para imprevistos (%)</span>
                        <input type="number" min="0" max="100" class="trips-form-input" style="width: 100px;" id="cfgContingency" value="${s.defaultContingency}">
                    </div>
                    <div class="trips-config-row">
                        <span class="label">Ordenación predeterminada</span>
                        <select class="trips-filter-select" id="cfgSort">
                            <option value="startDate-asc" ${s.defaultSort === 'startDate-asc' ? 'selected' : ''}>Fecha (próximos primero)</option>
                            <option value="startDate-desc" ${s.defaultSort === 'startDate-desc' ? 'selected' : ''}>Fecha (antiguos primero)</option>
                            <option value="budget-desc" ${s.defaultSort === 'budget-desc' ? 'selected' : ''}>Presupuesto (mayor)</option>
                            <option value="budget-asc" ${s.defaultSort === 'budget-asc' ? 'selected' : ''}>Presupuesto (menor)</option>
                            <option value="name-asc" ${s.defaultSort === 'name-asc' ? 'selected' : ''}>Nombre (A-Z)</option>
                        </select>
                    </div>
                </div>

                <div class="trips-config-section">
                    <h3><i class="fas fa-database"></i> Datos</h3>
                    <div class="trips-config-row">
                        <span class="label">Exportar todos los viajes a JSON</span>
                        <button class="btn btn-sm btn-secondary" id="cfgExportJson"><i class="fas fa-file-code"></i> Descargar</button>
                    </div>
                    <div class="trips-config-row">
                        <span class="label">Restaurar datos de demostración</span>
                        <button class="btn btn-sm btn-danger" id="cfgResetData"><i class="fas fa-undo"></i> Restaurar</button>
                    </div>
                </div>
            </div>
        `;

        // Bind settings
        const bindings = [
            ['cfgAlertNoBudget', 'alertNoBudget', 'checked'],
            ['cfgAlertPending', 'alertPendingPayments', 'checked'],
            ['cfgAlertUpcoming', 'alertUpcomingTrips', 'checked'],
            ['cfgAlertLowSavings', 'alertLowSavings', 'checked'],
            ['cfgUpcomingDays', 'upcomingDaysThreshold', 'value', 'int'],
            ['cfgCurrency', 'defaultCurrency', 'value'],
            ['cfgContingency', 'defaultContingency', 'value', 'int'],
            ['cfgSort', 'defaultSort', 'value']
        ];

        bindings.forEach(([uiId, key, prop, type]) => {
            const el = view.querySelector('#' + uiId);
            if (!el) return;
            el.addEventListener('change', () => {
                let val = el[prop];
                if (type === 'int') val = parseInt(val);
                tripsData.settings[key] = val;
                saveData();
                App.showToast('Configuración guardada');
            });
        });

        view.querySelector('#cfgExportJson').addEventListener('click', () => {
            const json = JSON.stringify(tripsData, null, 2);
            const blob = new Blob(['\ufeff' + json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'viajes-backup.json'; a.click();
            URL.revokeObjectURL(url);
            App.showToast('JSON exportado');
        });

        view.querySelector('#cfgResetData').addEventListener('click', () => {
            App.showConfirm(
                'Restaurar datos',
                '¿Seguro que quieres restaurar los datos de demostración de Viajes? Se perderán todos los cambios.',
                () => {
                    tripsData = JSON.parse(JSON.stringify(DEFAULT_TRIPS_DATA));
                    saveData();
                    renderConfiguracion();
                    App.showToast('Datos restaurados');
                }
            );
        });
    }

    // =========================================================
    // UTILIDADES
    // =========================================================
    function backToList() {
        currentTripId = null;
        switchView('mis-viajes');
    }

    function exportTrips() {
        const rows = [['Nombre', 'Destino', 'Tipo', 'Estado', 'Fecha salida', 'Fecha regreso', 'Presupuesto', 'Gastado', 'Pagado']];
        tripsData.trips.forEach(t => {
            rows.push([
                t.name,
                t.destination,
                getTypeById(t.type)?.name || '',
                getStatusLabel(t.status),
                t.startDate || '',
                t.endDate || '',
                (t.budget || 0).toFixed(2),
                getTripTotalSpent(t.id).toFixed(2),
                getTripTotalPaid(t.id).toFixed(2)
            ]);
        });
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'viajes.csv'; a.click();
        URL.revokeObjectURL(url);
        App.showToast('CSV exportado');
    }

    // Cerrar dropdowns al hacer click fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.trips-action-menu')) {
            containerEl && containerEl.querySelectorAll('.trips-action-dropdown.open').forEach(m => m.classList.remove('open'));
        }
    });

    // =========================================================
    // INIT
    // =========================================================
    function init() {}

    function onThemeChange() {
        if (currentView === 'resumen') renderCharts();
        else if (currentView === 'detalle') renderTripTab(currentTripTab);
    }

    // =========================================================
    // API PÚBLICA
    // =========================================================
    return {
        render,
        init,
        onThemeChange,
        openTripModal,
        backToList
    };
})();

// Registrar sección
App.registerSection('viajes', {
    render: (container) => TripsApp.render(container),
    init: () => TripsApp.init(),
    onThemeChange: () => TripsApp.onThemeChange()
});

window.TripsApp = TripsApp;