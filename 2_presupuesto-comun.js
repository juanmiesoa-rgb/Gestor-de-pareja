/* =============================================================
   PRESUPUESTO-COMUN.JS
   Sección completa con 4 vistas:
   - Resumen (indicadores, gráficos, alertas, gastos recientes)
   - Categorías (tabla con subcategorías expandibles, CRUD)
   - Gastos (tabla con filtros, CRUD, estados)
   - Configuración (ajustes, exportación, restaurar datos)
   ============================================================= */
const BudgetApp = (function () {
    'use strict';

    // =========================================================
    // ESTILOS ESPECÍFICOS DE LA SECCIÓN
    // =========================================================
    function injectStyles() {
        if (document.getElementById('budget-styles')) return;
        const style = document.createElement('style');
        style.id = 'budget-styles';
        style.textContent = `
            /* Sub-navegación */
            .budget-subnav {
                display: flex; gap: 4px;
                border-bottom: 1px solid var(--border);
                margin-bottom: 24px;
                overflow-x: auto;
            }
            .budget-subnav-item {
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
            .budget-subnav-item:hover { color: var(--text); }
            .budget-subnav-item.active { color: var(--primary); border-bottom-color: var(--primary); }

            .budget-subview { display: none; }
            .budget-subview.active { display: block; }

            /* Stats */
            .budget-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
            @media (max-width: 1024px) { .budget-stats { grid-template-columns: repeat(2, 1fr); } }
            @media (max-width: 768px) { .budget-stats { grid-template-columns: 1fr; } }

            .budget-stat {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 18px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .budget-stat:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
            .budget-stat-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
            .budget-stat-icon {
                width: 36px; height: 36px; border-radius: 10px;
                display: flex; align-items: center; justify-content: center;
                font-size: 16px;
            }
            .budget-stat-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; margin-bottom: 4px; }
            .budget-stat-value { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
            .budget-stat-meta { font-size: 11px; color: var(--text-muted); }
            .budget-stat-change { font-size: 11px; display: flex; align-items: center; gap: 4px; margin-top: 4px; }
            .budget-stat-change.up { color: var(--success); }
            .budget-stat-change.down { color: var(--danger); }

            /* Progress */
            .budget-progress { width: 100%; height: 6px; background: var(--border-light); border-radius: 3px; overflow: hidden; margin-top: 8px; }
            .budget-progress-bar { height: 100%; background: var(--primary); border-radius: 3px; transition: width 0.3s; }
            .budget-progress-bar.warning { background: var(--warning); }
            .budget-progress-bar.danger { background: var(--danger); }

            /* Charts */
            .budget-chart-container { position: relative; height: 320px; margin-top: 8px; }

            /* Alerts */
            .budget-alert-list { display: flex; flex-direction: column; gap: 8px; }
            .budget-alert-item {
                display: flex; align-items: flex-start; gap: 12px;
                padding: 12px;
                border-radius: var(--radius-sm);
                border-left: 3px solid;
            }
            .budget-alert-item.warning { border-color: var(--warning); background: var(--warning-light); }
            .budget-alert-item.danger { border-color: var(--danger); background: var(--danger-light); }
            .budget-alert-item.info { border-color: var(--info); background: var(--info-light); }
            .budget-alert-icon {
                width: 32px; height: 32px; border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                flex-shrink: 0;
                background: rgba(255,255,255,0.6);
            }
            .budget-alert-content { flex: 1; }
            .budget-alert-title { font-size: 13px; font-weight: 600; margin-bottom: 2px; }
            .budget-alert-desc { font-size: 12px; color: var(--text-secondary); }
            .budget-alert-action {
                background: none; border: none;
                color: var(--primary);
                font-size: 12px; font-weight: 500;
                cursor: pointer; padding: 4px 0;
                font-family: inherit;
            }

            /* Tables */
            .budget-table-wrap { overflow-x: auto; }
            .budget-table { width: 100%; border-collapse: collapse; font-size: 13px; }
            .budget-table th {
                text-align: left; padding: 10px 12px;
                font-size: 11px; font-weight: 600;
                color: var(--text-muted);
                text-transform: uppercase; letter-spacing: 0.5px;
                border-bottom: 1px solid var(--border);
                background: var(--bg-card);
                cursor: pointer; user-select: none;
            }
            .budget-table th:hover { color: var(--text); }
            .budget-table td {
                padding: 12px;
                border-bottom: 1px solid var(--border-light);
                vertical-align: middle;
            }
            .budget-table tr:hover td { background: var(--border-light); }
            .budget-table .amount { font-weight: 600; font-variant-numeric: tabular-nums; }
            .budget-table .amount.negative { color: var(--danger); }
            .budget-table .amount.positive { color: var(--success); }

            /* Category cell */
            .budget-cat-cell { display: flex; align-items: center; gap: 10px; }
            .budget-cat-icon {
                width: 32px; height: 32px; border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                color: white; font-size: 13px; flex-shrink: 0;
            }
            .budget-cat-name { font-weight: 500; }
            .budget-cat-sub { font-size: 11px; color: var(--text-muted); }

            /* Filters */
            .budget-filters-bar {
                display: flex; gap: 8px; margin-bottom: 16px;
                flex-wrap: wrap; align-items: center;
            }
            .budget-search-box { position: relative; flex: 1; min-width: 200px; max-width: 320px; }
            .budget-search-box i {
                position: absolute; left: 12px; top: 50%;
                transform: translateY(-50%);
                color: var(--text-muted); font-size: 13px;
            }
            .budget-search-box input {
                width: 100%; padding: 9px 12px 9px 36px;
                border: 1px solid var(--border); border-radius: var(--radius-sm);
                background: var(--bg-card); color: var(--text);
                font-size: 13px; font-family: inherit;
            }
            .budget-search-box input:focus { outline: none; border-color: var(--primary); }

            .budget-filter-select {
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

            .budget-active-filters { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
            .budget-filter-chip {
                display: inline-flex; align-items: center; gap: 6px;
                padding: 4px 10px;
                background: var(--primary-light); color: var(--primary);
                border-radius: 12px;
                font-size: 12px; font-weight: 500;
            }
            .budget-filter-chip button {
                background: none; border: none;
                color: inherit; cursor: pointer; padding: 0; font-size: 11px;
            }

            /* Action menu */
            .budget-action-menu { position: relative; display: inline-block; }
            .budget-action-dropdown {
                display: none;
                position: absolute; right: 0; top: 100%;
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                box-shadow: var(--shadow-md);
                min-width: 170px;
                z-index: 50; padding: 4px;
            }
            .budget-action-dropdown.open { display: block; }
            .budget-action-dropdown button {
                display: flex; align-items: center; gap: 8px;
                width: 100%; padding: 8px 10px;
                background: none; border: none;
                color: var(--text); font-size: 13px;
                cursor: pointer; border-radius: 4px;
                text-align: left; font-family: inherit;
            }
            .budget-action-dropdown button:hover { background: var(--border-light); }
            .budget-action-dropdown button.danger { color: var(--danger); }
            .budget-action-dropdown button i { width: 14px; color: var(--text-muted); }
            .budget-action-dropdown button.danger i { color: var(--danger); }

            /* List item */
            .budget-list-item {
                display: flex; align-items: center; gap: 12px;
                padding: 12px 0;
                border-bottom: 1px solid var(--border-light);
            }
            .budget-list-item:last-child { border-bottom: none; }
            .budget-list-icon {
                width: 36px; height: 36px; border-radius: 10px;
                display: flex; align-items: center; justify-content: center;
                flex-shrink: 0;
            }
            .budget-list-info { flex: 1; min-width: 0; }
            .budget-list-title { font-size: 14px; font-weight: 500; }
            .budget-list-sub { font-size: 12px; color: var(--text-muted); }
            .budget-list-amount { font-size: 14px; font-weight: 600; text-align: right; }
            .budget-list-amount.negative { color: var(--danger); }

            /* Quick actions */
            .budget-quick-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
                gap: 10px;
            }
            .budget-quick-card {
                display: flex; flex-direction: column; align-items: center; gap: 6px;
                padding: 14px 10px;
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                cursor: pointer;
                transition: all 0.15s;
                font-family: inherit;
                color: var(--text);
            }
            .budget-quick-card:hover { border-color: var(--primary); transform: translateY(-2px); box-shadow: var(--shadow-md); }
            .budget-quick-card i { font-size: 18px; color: var(--primary); }
            .budget-quick-card span { font-size: 11px; font-weight: 500; text-align: center; }

            /* Category expand */
            .budget-expand-btn {
                background: none; border: none;
                color: var(--text-muted); cursor: pointer;
                padding: 4px; font-size: 11px;
                transition: transform 0.2s;
            }
            .budget-expand-btn.open { transform: rotate(90deg); }
            .budget-sub-row td { background: var(--border-light); padding-left: 48px; font-size: 12px; }

            /* Config */
            .budget-config-section { margin-bottom: 24px; }
            .budget-config-section h3 {
                font-size: 14px; font-weight: 600;
                margin-bottom: 12px; padding-bottom: 8px;
                border-bottom: 1px solid var(--border);
                display: flex; align-items: center; gap: 8px;
            }
            .budget-config-row {
                display: flex; justify-content: space-between; align-items: center;
                padding: 10px 0;
                border-bottom: 1px solid var(--border-light);
                font-size: 13px;
                gap: 12px;
            }
            .budget-config-row:last-child { border-bottom: none; }
            .budget-config-row .label { color: var(--text-secondary); flex: 1; }

            /* Switch */
            .budget-switch { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; }
            .budget-switch input { opacity: 0; width: 0; height: 0; }
            .budget-slider {
                position: absolute; cursor: pointer; inset: 0;
                background: var(--border); border-radius: 20px;
                transition: 0.2s;
            }
            .budget-slider:before {
                position: absolute; content: "";
                height: 14px; width: 14px; left: 3px; bottom: 3px;
                background: white; border-radius: 50%;
                transition: 0.2s;
            }
            .budget-switch input:checked + .budget-slider { background: var(--primary); }
            .budget-switch input:checked + .budget-slider:before { transform: translateX(16px); }

            /* Color/icon picker */
            .budget-color-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; margin-top: 6px; }
            .budget-color-option {
                width: 28px; height: 28px; border-radius: 6px;
                cursor: pointer; border: 2px solid transparent;
                transition: all 0.15s;
            }
            .budget-color-option:hover { transform: scale(1.1); }
            .budget-color-option.selected { border-color: var(--text); }

            .budget-icon-grid {
                display: grid; grid-template-columns: repeat(8, 1fr);
                gap: 6px; margin-top: 6px;
                max-height: 160px; overflow-y: auto;
            }
            .budget-icon-option {
                width: 32px; height: 32px;
                display: flex; align-items: center; justify-content: center;
                border-radius: 6px; cursor: pointer;
                border: 1px solid var(--border);
                background: var(--bg-card); color: var(--text);
                transition: all 0.15s;
            }
            .budget-icon-option:hover { border-color: var(--primary); }
            .budget-icon-option.selected { background: var(--primary); color: white; border-color: var(--primary); }

            /* Details toggle */
            .budget-details-toggle {
                background: none; border: none;
                color: var(--primary);
                font-size: 12px; font-weight: 500;
                cursor: pointer; padding: 8px 0;
                display: flex; align-items: center; gap: 6px;
                font-family: inherit;
            }
            .budget-details-content { display: none; padding-top: 8px; }
            .budget-details-content.open { display: block; }

            /* Mobile cards */
            .budget-mobile-card {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 14px;
                margin-bottom: 10px;
            }
            .budget-mobile-card-head {
                display: flex; justify-content: space-between; align-items: flex-start;
                margin-bottom: 10px;
                gap: 8px;
            }
            .budget-mobile-card-row {
                display: flex; justify-content: space-between;
                font-size: 12px; padding: 4px 0;
            }
            .budget-mobile-card-row .lbl { color: var(--text-muted); }
            .budget-mobile-card-row .val { font-weight: 500; }

            .budget-table-desktop { display: block; }
            .budget-table-mobile { display: none; }
            @media (max-width: 768px) {
                .budget-table-desktop { display: none; }
                .budget-table-mobile { display: block; }
            }

            /* Forms */
            .budget-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
            .budget-form-row.single { grid-template-columns: 1fr; }
            @media (max-width: 768px) { .budget-form-row { grid-template-columns: 1fr; } }

            .budget-form-group { margin-bottom: 14px; }
            .budget-form-label {
                display: block; font-size: 12px; font-weight: 500;
                color: var(--text-secondary); margin-bottom: 6px;
            }
            .budget-form-input, .budget-form-select, .budget-form-textarea {
                width: 100%; padding: 9px 12px;
                border: 1px solid var(--border); border-radius: var(--radius-sm);
                background: var(--bg-card); color: var(--text);
                font-size: 13px; font-family: inherit;
            }
            .budget-form-input:focus, .budget-form-select:focus, .budget-form-textarea:focus {
                outline: none; border-color: var(--primary);
            }
            .budget-form-textarea { resize: vertical; min-height: 70px; }
            .budget-form-error { font-size: 11px; color: var(--danger); margin-top: 4px; display: none; }
            .budget-form-group.error .budget-form-input,
            .budget-form-group.error .budget-form-select { border-color: var(--danger); }
            .budget-form-group.error .budget-form-error { display: block; }

            /* Modal */
            .budget-modal {
                display: none; position: fixed; inset: 0;
                background: rgba(0,0,0,0.5); z-index: 1000;
                align-items: center; justify-content: center;
                padding: 20px;
            }
            .budget-modal.active { display: flex; }
            .budget-modal-content {
                background: var(--bg-card); border-radius: var(--radius-lg);
                max-width: 600px; width: 100%;
                max-height: 90vh; overflow-y: auto;
                box-shadow: var(--shadow-md);
            }
            .budget-modal-header {
                padding: 20px; border-bottom: 1px solid var(--border);
                display: flex; justify-content: space-between; align-items: center;
            }
            .budget-modal-title { font-size: 16px; font-weight: 600; }
            .budget-modal-close {
                background: none; border: none;
                color: var(--text-muted); cursor: pointer;
                font-size: 18px; padding: 4px;
            }
            .budget-modal-body { padding: 20px; }
            .budget-modal-footer {
                padding: 16px 20px; border-top: 1px solid var(--border);
                display: flex; justify-content: flex-end; gap: 8px;
            }

            .budget-empty {
                text-align: center; padding: 40px 20px;
                color: var(--text-muted);
            }
            .budget-empty i { font-size: 40px; margin-bottom: 12px; opacity: 0.5; }
            .budget-empty h3 { font-size: 15px; color: var(--text); margin-bottom: 6px; }
            .budget-empty p { font-size: 13px; margin-bottom: 16px; }

            /* ===== PANTALLA ÚNICA (pc-*) ===== */
            .pc-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
            @media (max-width: 1024px) { .pc-kpis { grid-template-columns: repeat(2, 1fr); } }
            @media (max-width: 640px) { .pc-kpis { grid-template-columns: 1fr; } }
            .pc-kpi { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 18px; }
            .pc-kpi-label { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .4px; margin-bottom: 6px; }
            .pc-kpi-value { font-size: 22px; font-weight: 700; }
            .pc-kpi-meta { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
            .pc-block { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px 20px; margin-bottom: 16px; }
            .pc-block-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
            .pc-block-title { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
            .pc-block-sub { font-size: 12px; color: var(--text-muted); }
            .pc-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg); color: var(--text-secondary); }
            .pc-chip.green { background: rgba(16,185,129,.12); color: #059669; border-color: rgba(16,185,129,.35); }
            .pc-chip.amber { background: rgba(245,158,11,.14); color: #b45309; border-color: rgba(245,158,11,.4); }
            .pc-chip.red   { background: rgba(239,68,68,.12); color: #dc2626; border-color: rgba(239,68,68,.35); }
            .pc-chip.gray  { background: var(--bg); color: var(--text-muted); }
            .pc-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px dashed var(--border); flex-wrap: wrap; }
            .pc-row:last-child { border-bottom: none; }
            .pc-bar { height: 8px; border-radius: 6px; background: var(--bg); overflow: hidden; min-width: 120px; flex: 1; max-width: 260px; }
            .pc-bar > div { height: 100%; border-radius: 6px; background: var(--primary); transition: width .3s; }
            .pc-bar > div.warn { background: #f59e0b; }
            .pc-bar > div.over { background: #ef4444; }
            .pc-bar > div.ok { background: #10b981; }
            .pc-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            @media (max-width: 900px) { .pc-grid2 { grid-template-columns: 1fr; } }
            .pc-week { border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; margin-bottom: 8px; }
            .pc-week.current { border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-light); }
            .pc-loan-badge { font-family: monospace; font-weight: 700; font-size: 13px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 2px 8px; }
            .pc-mini-input { width: 90px; padding: 5px 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-card); color: var(--text); font-size: 13px; }
            /* ===== DASHBOARD INTERACTIVO (pcw-*) ===== */
            .pcw-topbar { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1.2fr; gap: 14px; margin-bottom: 18px; }
            @media (max-width: 1100px) { .pcw-topbar { grid-template-columns: 1fr 1fr; } }
            @media (max-width: 620px) { .pcw-topbar { grid-template-columns: 1fr; } }
            .pcw-kpi { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 16px 18px; transition: transform .15s, box-shadow .15s; }
            .pcw-kpi:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,.07); }
            .pcw-klabel { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .4px; margin-bottom: 6px; }
            .pcw-kvalue { font-size: 24px; font-weight: 800; }
            .pcw-kmeta { font-size: 12px; color: var(--text-muted); margin-top: 5px; }
            .pcw-split { display: flex; gap: 12px; font-size: 12px; font-weight: 700; margin-top: 6px; }
            .pcw-layout { display: grid; grid-template-columns: minmax(0,1fr) 320px; gap: 16px; align-items: start; }
            @media (max-width: 1024px) { .pcw-layout { grid-template-columns: 1fr; } }
            .pcw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
            .pcw-card { background: var(--bg-card); border: 1px solid var(--border); border-left: 4px solid var(--card-color, var(--primary)); border-radius: 14px; padding: 14px 16px; cursor: pointer; transition: all .18s ease; outline: none; }
            .pcw-card:hover { transform: translateY(-3px); box-shadow: 0 8px 22px rgba(0,0,0,.09); }
            .pcw-card.selected { border-color: var(--card-color, var(--primary)); box-shadow: 0 0 0 2px var(--card-color, var(--primary)), 0 8px 22px rgba(0,0,0,.08); }
            .pcw-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
            .pcw-title { font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 6px; }
            .pcw-ico { font-size: 18px; }
            .pcw-badge { font-size: 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 1px 6px; color: var(--text-muted); }
            .pcw-bar { height: 8px; border-radius: 6px; background: var(--bg); overflow: hidden; margin: 4px 0 6px; }
            .pcw-bar > div { height: 100%; border-radius: 6px; background: var(--card-color, var(--primary)); transition: width .4s ease; }
            .pcw-bar > div.warn { background: #f59e0b !important; }
            .pcw-bar > div.over { background: #ef4444 !important; }
            .pcw-foot { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); gap: 8px; }
            .pcw-over-txt { color: #dc2626; font-weight: 700; }
            .pcw-nodef { color: var(--text-muted); font-style: italic; }
            .pcw-card-sub { font-size: 11px; color: var(--text-muted); margin-top: 6px; }
            .pcw-hint { font-size: 11px; color: var(--card-color, var(--primary)); margin-top: 8px; opacity: .75; }
            .pcw-card.selected .pcw-hint i { transform: rotate(180deg); }
            .pcw-hint i { transition: transform .2s; }
            .pcw-detail { max-height: 0; overflow: hidden; opacity: 0; transition: max-height .35s ease, opacity .3s ease, margin .3s ease; background: var(--bg-card); border: 1px solid transparent; border-radius: 14px; margin-top: 0; }
            .pcw-detail.open { max-height: 900px; opacity: 1; border-color: var(--border); margin-top: 14px; padding: 4px 18px 16px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.02); }
            .pcw-detail-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 0 8px; border-bottom: 1px dashed var(--border); margin-bottom: 10px; }
            .pcw-detail-head h3 { font-size: 15px; margin: 0; }
            .pcw-close { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 15px; padding: 4px 8px; border-radius: 8px; }
            .pcw-close:hover { background: var(--bg); color: var(--danger); }
            .pcw-dgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px; }
            @media (max-width: 620px) { .pcw-dgrid { grid-template-columns: 1fr; } }
            .pcw-dlabel { font-size: 11px; color: var(--text-muted); text-transform: uppercase; }
            .pcw-sidebar { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 12px; }
            @media (max-width: 1024px) { .pcw-sidebar { position: static; } }
            .pcw-widget { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; }
            .pcw-whead { font-size: 13px; font-weight: 800; margin-bottom: 10px; }
            .pcw-alert { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; padding: 9px 11px; border-radius: 10px; margin-bottom: 8px; animation: pcwIn .3s ease; }
            .pcw-alert.amber { background: rgba(245,158,11,.13); color: #b45309; border: 1px solid rgba(245,158,11,.35); }
            .pcw-alert.red { background: rgba(239,68,68,.12); color: #dc2626; border: 1px solid rgba(239,68,68,.35); }
            .pcw-alert.ok { background: rgba(16,185,129,.1); color: #059669; border: 1px solid rgba(16,185,129,.3); }
            .pcw-act { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px dashed var(--border); animation: pcwIn .3s ease; }
            .pcw-act:last-child { border-bottom: none; }
            .pcw-avatar { width: 26px; height: 26px; min-width: 26px; border-radius: 50%; color: #fff; font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; }
            .pcw-act-main { flex: 1; min-width: 0; }
            .pcw-act-concept { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .pcw-act-meta { font-size: 11px; color: var(--text-muted); }
            .pcw-act-amt { font-size: 12.5px; white-space: nowrap; }
            .pcw-empty { font-size: 12px; color: var(--text-muted); padding: 8px 0; }
            @keyframes pcwIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        `;
        document.head.appendChild(style);
    }

    // =========================================================
    // ESTADO LOCAL
    // =========================================================
    let currentPeriod = '2026-11';
    let currentView = 'pantalla';
    let filters = { search: '', categoryId: '', status: '', person: '', dateFrom: '', dateTo: '', type: '' };
    let charts = {};
    let containerEl = null;

    // =========================================================
    // HELPERS DE DATOS
    // =========================================================
    function data() { return App.data; }

    function getCategoryById(id) { return data().categories.find(c => c.id === id); }

    function getDescendantIds(catId) {
        const result = [catId];
        data().categories.filter(c => c.parentId === catId).forEach(ch => {
            result.push(...getDescendantIds(ch.id));
        });
        return result;
    }

    function getRootCategory(cat) {
        if (!cat) return null;
        let current = cat;
        while (current.parentId) {
            const parent = getCategoryById(current.parentId);
            if (!parent) break;
            current = parent;
        }
        return current;
    }

    function getExpensesForPeriod(period, includePlanned = false) {
        return data().expenses.filter(e => {
            const expPeriod = e.aggPeriod || e.date.substring(0, 7);
            if (expPeriod !== period) return false;
            if (e.status === 'archivado') return false;
            if (!includePlanned && e.status === 'previsto') return false;
            return true;
        });
    }

    function getCategoryExpense(catId, period) {
        const ids = getDescendantIds(catId);
        return getExpensesForPeriod(period).reduce((sum, e) => {
            return ids.includes(e.categoryId) ? sum + e.amount : sum;
        }, 0);
    }

    function getCategoryBudget(catId, period) {
        const cat = getCategoryById(catId);
        if (!cat) return null;
        const b = data().budgets.find(b => b.categoryId === catId && b.period === period);
        if (b) return b.amount;
        if (!cat.parentId && cat.budget !== null && cat.budget !== undefined) {
            return cat.budget;
        }
        return null;
    }

    function getTotalBudget(period) {
        return data().categories
            .filter(c => !c.parentId)
            .reduce((sum, c) => {
                const b = getCategoryBudget(c.id, period);
                return sum + (b !== null ? b : 0);
            }, 0);
    }

    function getTotalExpense(period) {
        return getExpensesForPeriod(period).reduce((sum, e) => sum + e.amount, 0);
    }

    function getPreviousPeriod(period) {
        const [y, m] = period.split('-').map(Number);
        const d = new Date(y, m - 2, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    function getFilteredExpenses() {
        let list = getExpensesForPeriod(currentPeriod, true);
        if (filters.search) {
            const s = filters.search.toLowerCase();
            list = list.filter(e => e.concept.toLowerCase().includes(s));
        }
        if (filters.categoryId === '__uncategorized') {
            list = list.filter(e => !e.categoryId);
        } else if (filters.categoryId) {
            const ids = getDescendantIds(filters.categoryId);
            list = list.filter(e => ids.includes(e.categoryId));
        }
        if (filters.status) list = list.filter(e => e.status === filters.status);
        if (filters.person) list = list.filter(e => e.person === filters.person);
        if (filters.type) list = list.filter(e => e.type === filters.type);
        if (filters.dateFrom) list = list.filter(e => e.date >= filters.dateFrom);
        if (filters.dateTo) list = list.filter(e => e.date <= filters.dateTo);
        return list;
    }

    function getStatusBadge(status) {
        const map = {
            registrado: '<span class="badge badge-success">Registrado</span>',
            previsto: '<span class="badge badge-info">Previsto</span>',
            pendiente: '<span class="badge badge-warning">Pendiente</span>',
            archivado: '<span class="badge badge-neutral">Archivado</span>'
        };
        return map[status] || '';
    }

    // =========================================================
    // HELPERS PANTALLA ÚNICA (presupuesto común dinámico)
    // =========================================================
    function pcCats()      { return data().pcCategories || []; }
    function pcSubs(pid)   { return (data().pcSubcategories || []).filter(s => s.parentId === pid); }
    function pcWeeks()     { return (data().pcWeeks || []).slice().sort((a,b) => a.start.localeCompare(b.start)); }
    function pcLoans()     { return (data().pcLoans || []).filter(l => l.status !== 'archived'); }
    function pcIncomes()   { return data().pcIncomes || []; }

    // Gastos del periodo que NO son aportaciones de ahorro (evita doble contabilización)
    function pcRealExpenses(period) {
        return getExpensesForPeriod(period).filter(e => e.status !== 'aportacion');
    }
    function pcExpenseTotal(list) { return list.reduce((s, e) => s + e.amount, 0); }
    function pcCatExpense(catId, period) {
        const ids = getDescendantIds(catId);
        return pcExpenseTotal(pcRealExpenses(period).filter(e => ids.includes(e.categoryId)));
    }
    // Presupuesto "no definido" (null) vs fijado en 0 → suman solo los definidos
    function pcDefinedBudget(catId) {
        const c = pcCats().find(x => x.id === catId);
        if (!c) return null;
        let total = (c.budget === null || c.budget === undefined) ? null : Number(c.budget);
        pcSubs(catId).forEach(s => {
            if (s.budget !== null && s.budget !== undefined) {
                total = (total === null ? 0 : total) + Number(s.budget);
            }
        });
        return total;
    }
    function pcChip(presupuesto, gasto) {
        if (presupuesto === null || presupuesto === undefined)
            return '<span class="pc-chip gray">No definido</span>';
        if (presupuesto === 0)
            return '<span class="pc-chip red">Fijado 0,00 €' + (gasto > 0 ? ` · gasto ${App.formatCurrency(gasto)}` : '') + '</span>';
        const pct = (gasto / presupuesto) * 100;
        const cls = pct > 100 ? 'red' : pct >= 80 ? 'amber' : 'green';
        return `<span class="pc-chip ${cls}">${pct.toFixed(0)}% usado</span>`;
    }
    function pcBarHtml(gasto, presupuesto) {
        if (!presupuesto) return '';
        const pct = Math.min((gasto / presupuesto) * 100, 100);
        const cls = gasto > presupuesto ? 'over' : pct >= 80 ? 'warn' : 'ok';
        return `<div class="pc-bar"><div class="${cls}" style="width:${pct}%"></div></div>`;
    }
    function fmtShortDate(iso) {
        const d = new Date(iso + 'T00:00:00');
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
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
                    <div>
                        <select class="budget-filter-select" id="budgetPeriodSelector">
                            <option value="2026-10">Octubre 2026</option>
                            <option value="2026-09">Septiembre 2026</option>
                            <option value="2026-08">Agosto 2026</option>
                            <option value="2026-07">Julio 2026</option>
                            <option value="2026-11">Noviembre 2026</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="btn btn-sm btn-secondary" id="budgetToggleFilters">
                            <i class="fas fa-filter"></i> Filtros
                        </button>
                        <button class="btn btn-sm btn-primary" id="budgetNewExpenseTop">
                            <i class="fas fa-plus"></i> Nuevo gasto
                        </button>
                    </div>
                </div>
            </div>

            <div id="budgetFiltersPanel" style="display: none; margin-bottom: 16px;">
                <div class="card">
                    <div class="budget-filters-bar">
                        <div class="budget-search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="budgetFilterSearch" placeholder="Buscar por concepto...">
                        </div>
                        <select class="budget-filter-select" id="budgetFilterCategory">
                            <option value="">Todas las categorías</option>
                        </select>
                        <select class="budget-filter-select" id="budgetFilterStatus">
                            <option value="">Todos los estados</option>
                            <option value="registrado">Registrado</option>
                            <option value="previsto">Previsto</option>
                            <option value="pendiente">Pendiente</option>
                        </select>
                        <select class="budget-filter-select" id="budgetFilterPerson">
                            <option value="">Todas las personas</option>
                            <option value="conjunto">Conjunto</option>
                            <option value="ana">Ana</option>
                            <option value="carlos">Carlos</option>
                        </select>
                        <input type="date" class="budget-form-input" id="budgetFilterDateFrom" style="width: auto;">
                        <input type="date" class="budget-form-input" id="budgetFilterDateTo" style="width: auto;">
                        <button class="btn btn-sm btn-secondary" id="budgetClearFilters">
                            <i class="fas fa-times"></i> Limpiar
                        </button>
                    </div>
                    <div class="budget-active-filters" id="budgetActiveFilters"></div>
                </div>
            </div>

            <div class="budget-subnav">
                <button class="budget-subnav-item active" data-view="pantalla"><span style="font-size:14px">🗂️</span> Pantalla única</button>
                <button class="budget-subnav-item" data-view="gastos"><i class="fas fa-receipt"></i> Gastos</button>
            </div>

            <div class="budget-subview active" id="budgetView-pantalla"></div>
            <div class="budget-subview" id="budgetView-gastos"></div>

            <!-- Modal Gasto -->
            <div class="budget-modal" id="budgetExpenseModal">
                <div class="budget-modal-content">
                    <div class="budget-modal-header">
                        <h3 class="budget-modal-title" id="budgetExpenseModalTitle">Nuevo gasto</h3>
                        <button class="budget-modal-close" data-close-budget-modal><i class="fas fa-times"></i></button>
                    </div>
                    <div class="budget-modal-body">
                        <input type="hidden" id="budgetExpenseId">
                        <div class="budget-form-row">
                            <div class="budget-form-group">
                                <label class="budget-form-label">Tipo</label>
                                <select class="budget-form-select" id="budgetExpenseType">
                                    <option value="individual">Gasto individual</option>
                                    <option value="agregado">Gasto agregado</option>
                                </select>
                            </div>
                            <div class="budget-form-group">
                                <label class="budget-form-label">Estado</label>
                                <select class="budget-form-select" id="budgetExpenseStatus">
                                    <option value="registrado">Registrado</option>
                                    <option value="previsto">Previsto</option>
                                    <option value="pendiente">Pendiente</option>
                                </select>
                            </div>
                        </div>
                        <div class="budget-form-row single">
                            <div class="budget-form-group">
                                <label class="budget-form-label">Concepto *</label>
                                <input type="text" class="budget-form-input" id="budgetExpenseConcept" required>
                                <div class="budget-form-error">El concepto es obligatorio</div>
                            </div>
                        </div>
                        <div class="budget-form-row">
                            <div class="budget-form-group">
                                <label class="budget-form-label">Importe (€) *</label>
                                <input type="number" step="0.01" min="0" class="budget-form-input" id="budgetExpenseAmount" required>
                                <div class="budget-form-error">Importe inválido</div>
                            </div>
                            <div class="budget-form-group">
                                <label class="budget-form-label">Fecha *</label>
                                <input type="date" class="budget-form-input" id="budgetExpenseDate" required>
                                <div class="budget-form-error">Fecha obligatoria</div>
                            </div>
                        </div>
                        <div class="budget-form-row">
                            <div class="budget-form-group">
                                <label class="budget-form-label">Categoría</label>
                                <select class="budget-form-select" id="budgetExpenseCategory">
                                    <option value="">Sin categorizar</option>
                                </select>
                            </div>
                            <div class="budget-form-group">
                                <label class="budget-form-label">Persona</label>
                                <select class="budget-form-select" id="budgetExpensePerson">
                                    <option value="conjunto">Conjunto</option>
                                    <option value="ana">Ana</option>
                                    <option value="carlos">Carlos</option>
                                </select>
                            </div>
                        </div>
                        <div class="budget-form-row single">
                            <div class="budget-form-group">
                                <label class="budget-form-label">Notas</label>
                                <textarea class="budget-form-textarea" id="budgetExpenseNotes"></textarea>
                            </div>
                        </div>
                    </div>
                    <div class="budget-modal-footer">
                        <button class="btn btn-secondary" data-close-budget-modal>Cancelar</button>
                        <button class="btn btn-primary" id="budgetSaveExpenseBtn">
                            <i class="fas fa-save"></i> Guardar
                        </button>
                    </div>
                </div>
            </div>

            <!-- Modal Categoría -->
            <div class="budget-modal" id="budgetCategoryModal">
                <div class="budget-modal-content">
                    <div class="budget-modal-header">
                        <h3 class="budget-modal-title" id="budgetCategoryModalTitle">Nueva categoría</h3>
                        <button class="budget-modal-close" data-close-budget-modal><i class="fas fa-times"></i></button>
                    </div>
                    <div class="budget-modal-body">
                        <input type="hidden" id="budgetCategoryId">
                        <div class="budget-form-row single">
                            <div class="budget-form-group">
                                <label class="budget-form-label">Nombre *</label>
                                <input type="text" class="budget-form-input" id="budgetCategoryName" required>
                                <div class="budget-form-error">Nombre obligatorio</div>
                            </div>
                        </div>
                        <div class="budget-form-row">
                            <div class="budget-form-group">
                                <label class="budget-form-label">Categoría superior</label>
                                <select class="budget-form-select" id="budgetCategoryParent">
                                    <option value="">— Ninguna (raíz) —</option>
                                </select>
                            </div>
                            <div class="budget-form-group">
                                <label class="budget-form-label">Presupuesto mensual (€)</label>
                                <input type="number" step="0.01" min="0" class="budget-form-input" id="budgetCategoryBudget">
                            </div>
                        </div>
                        <div class="budget-form-row">
                            <div class="budget-form-group">
                                <label class="budget-form-label">Color</label>
                                <div class="budget-color-grid" id="budgetColorGrid"></div>
                                <input type="hidden" id="budgetCategoryColor" value="#2563eb">
                            </div>
                            <div class="budget-form-group">
                                <label class="budget-form-label">Icono</label>
                                <div class="budget-icon-grid" id="budgetIconGrid"></div>
                                <input type="hidden" id="budgetCategoryIcon" value="fas fa-tag">
                            </div>
                        </div>
                        <div class="budget-form-row single">
                            <div class="budget-form-group">
                                <label class="budget-form-label">Descripción</label>
                                <input type="text" class="budget-form-input" id="budgetCategoryDescription">
                            </div>
                        </div>
                    </div>
                    <div class="budget-modal-footer">
                        <button class="btn btn-secondary" data-close-budget-modal>Cancelar</button>
                        <button class="btn btn-primary" id="budgetSaveCategoryBtn">
                            <i class="fas fa-save"></i> Guardar
                        </button>
                    </div>
                </div>
            </div>

            <!-- Modal Detalle categoría -->
            <div class="budget-modal" id="budgetCategoryDetailModal">
                <div class="budget-modal-content">
                    <div class="budget-modal-header">
                        <h3 class="budget-modal-title" id="budgetCategoryDetailTitle">Detalle</h3>
                        <button class="budget-modal-close" data-close-budget-modal><i class="fas fa-times"></i></button>
                    </div>
                    <div class="budget-modal-body" id="budgetCategoryDetailBody"></div>
                    <div class="budget-modal-footer">
                        <button class="btn btn-secondary" data-close-budget-modal>Cerrar</button>
                    </div>
                </div>
            </div>
        `;

        renderView(currentView);
        bindGlobalEvents();
    }

    // =========================================================
    // EVENTOS GLOBALES
    // =========================================================
    function bindGlobalEvents() {
        // Sub-navegación
        containerEl.querySelectorAll('.budget-subnav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                currentView = btn.dataset.view;
                containerEl.querySelectorAll('.budget-subnav-item').forEach(b =>
                    b.classList.toggle('active', b === btn));
                containerEl.querySelectorAll('.budget-subview').forEach(v =>
                    v.classList.toggle('active', v.id === `budgetView-${currentView}`));
                renderView(currentView);
            });
        });

        // Periodo
        containerEl.querySelector('#budgetPeriodSelector').addEventListener('change', (e) => {
            currentPeriod = e.target.value;
            renderView(currentView);
        });

        // Toggle filtros
        containerEl.querySelector('#budgetToggleFilters').addEventListener('click', () => {
            const panel = containerEl.querySelector('#budgetFiltersPanel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });

        // Filtros
        ['budgetFilterSearch', 'budgetFilterCategory', 'budgetFilterStatus',
         'budgetFilterPerson', 'budgetFilterDateFrom', 'budgetFilterDateTo'].forEach(id => {
            const el = containerEl.querySelector('#' + id);
            if (el) el.addEventListener('change', applyFilters);
        });
        containerEl.querySelector('#budgetFilterSearch').addEventListener('input', applyFilters);
        containerEl.querySelector('#budgetClearFilters').addEventListener('click', clearFilters);

        // Nuevo gasto
        containerEl.querySelector('#budgetNewExpenseTop').addEventListener('click', () => openExpenseModal());

        // Modales - cerrar
        containerEl.querySelectorAll('[data-close-budget-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.budget-modal').classList.remove('active');
            });
        });
        containerEl.querySelectorAll('.budget-modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        });

        // Guardar gasto
        containerEl.querySelector('#budgetSaveExpenseBtn').addEventListener('click', saveExpense);
        // Guardar categoría
        containerEl.querySelector('#budgetSaveCategoryBtn').addEventListener('click', saveCategory);
    }

    // =========================================================
    // DISPATCH VISTAS
    // =========================================================
    function renderView(view) {
        if (view === 'pantalla') renderPantallaUnica();
        else if (view === 'gastos') renderGastos();
        else if (view === 'configuracion') renderConfiguracion();
    }

    // =========================================================
    // VISTA: RESUMEN
    // =========================================================
    function renderResumen() {
        const view = containerEl.querySelector('#budgetView-resumen');
        const totalBudget = getTotalBudget(currentPeriod);
        const totalExpense = getTotalExpense(currentPeriod);
        const remaining = totalBudget - totalExpense;
        const deviation = totalExpense - totalBudget;
        const deviationPct = totalBudget > 0 ? (deviation / totalBudget) * 100 : 0;
        const consumedPct = totalBudget > 0 ? (totalExpense / totalBudget) * 100 : 0;

        const prevPeriod = getPreviousPeriod(currentPeriod);
        const prevBudget = getTotalBudget(prevPeriod);
        const prevExpense = getTotalExpense(prevPeriod);
        const budgetChange = prevBudget > 0 ? ((totalBudget - prevBudget) / prevBudget) * 100 : 0;
        const expenseChange = prevExpense > 0 ? ((totalExpense - prevExpense) / prevExpense) * 100 : 0;

        const settings = data().settings || {};

        let statsHtml = '';
        if (settings.showBudgetCard !== false) {
            const cls = budgetChange > 0 ? 'up' : budgetChange < 0 ? 'down' : '';
            const icon = budgetChange > 0 ? 'arrow-up' : budgetChange < 0 ? 'arrow-down' : 'minus';
            statsHtml += `
                <div class="budget-stat" data-action="goto-categorias">
                    <div class="budget-stat-head">
                        <div>
                            <div class="budget-stat-label">Presupuesto total</div>
                            <div class="budget-stat-value">${App.formatCurrency(totalBudget)}</div>
                            ${prevBudget > 0 ? `<div class="budget-stat-change ${cls}"><i class="fas fa-${icon}"></i> ${Math.abs(budgetChange).toFixed(1)}% vs anterior</div>` : '<div class="budget-stat-meta">Sin datos anteriores</div>'}
                        </div>
                        <div class="budget-stat-icon" style="background: var(--primary-light); color: var(--primary);"><i class="fas fa-wallet"></i></div>
                    </div>
                </div>`;
        }
        if (settings.showExpensesCard !== false) {
            const cls = expenseChange > 0 ? 'down' : expenseChange < 0 ? 'up' : '';
            const icon = expenseChange > 0 ? 'arrow-up' : expenseChange < 0 ? 'arrow-down' : 'minus';
            statsHtml += `
                <div class="budget-stat" data-action="goto-gastos">
                    <div class="budget-stat-head">
                        <div>
                            <div class="budget-stat-label">Gastos registrados</div>
                            <div class="budget-stat-value">${App.formatCurrency(totalExpense)}</div>
                            ${prevExpense > 0 ? `<div class="budget-stat-change ${cls}"><i class="fas fa-${icon}"></i> ${Math.abs(expenseChange).toFixed(1)}% vs anterior</div>` : '<div class="budget-stat-meta">Primer mes con datos</div>'}
                        </div>
                        <div class="budget-stat-icon" style="background: var(--danger-light); color: var(--danger);"><i class="fas fa-shopping-cart"></i></div>
                    </div>
                </div>`;
        }
        if (settings.showRemainingCard !== false) {
            const hasBudget = totalBudget > 0;
            const barClass = consumedPct >= 100 ? 'danger' : consumedPct >= 80 ? 'warning' : '';
            statsHtml += `
                <div class="budget-stat">
                    <div class="budget-stat-head">
                        <div>
                            <div class="budget-stat-label">Presupuesto restante</div>
                            <div class="budget-stat-value">${hasBudget ? App.formatCurrency(remaining) : 'Sin presupuesto'}</div>
                            ${hasBudget ? `
                                <div class="budget-progress"><div class="budget-progress-bar ${barClass}" style="width: ${Math.min(consumedPct, 100)}%;"></div></div>
                                <div class="budget-stat-meta">${consumedPct.toFixed(1)}% consumido</div>
                            ` : '<div class="budget-stat-meta">Define presupuestos en Categorías</div>'}
                        </div>
                        <div class="budget-stat-icon" style="background: ${remaining >= 0 ? 'var(--success-light)' : 'var(--danger-light)'}; color: ${remaining >= 0 ? 'var(--success)' : 'var(--danger)'};">
                            <i class="fas fa-${remaining >= 0 ? 'piggy-bank' : 'exclamation-triangle'}"></i>
                        </div>
                    </div>
                </div>`;
        }
        if (settings.showDeviationCard !== false) {
            const isOver = deviation > 0;
            statsHtml += `
                <div class="budget-stat" data-action="goto-categorias">
                    <div class="budget-stat-head">
                        <div>
                            <div class="budget-stat-label">Desviación</div>
                            <div class="budget-stat-value" style="color: ${isOver ? 'var(--danger)' : 'var(--success)'};">
                                ${totalBudget > 0 ? (isOver ? '+' : '') + App.formatCurrency(deviation) : '—'}
                            </div>
                            ${totalBudget > 0 ? `
                                <div class="budget-stat-meta">${isOver ? 'Presupuesto superado' : 'Dentro del presupuesto'}</div>
                                <div class="budget-stat-change ${isOver ? 'down' : 'up'}"><i class="fas fa-${isOver ? 'arrow-up' : 'check'}"></i> ${Math.abs(deviationPct).toFixed(1)}%</div>
                            ` : '<div class="budget-stat-meta">Sin presupuesto definido</div>'}
                        </div>
                        <div class="budget-stat-icon" style="background: ${isOver ? 'var(--danger-light)' : 'var(--success-light)'}; color: ${isOver ? 'var(--danger)' : 'var(--success)'};">
                            <i class="fas fa-${isOver ? 'exclamation-circle' : 'check-circle'}"></i>
                        </div>
                    </div>
                </div>`;
        }

        view.innerHTML = `
            <div class="budget-stats">${statsHtml}</div>
            <div id="budgetAlertsContainer"></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">Presupuesto vs Gasto</div>
                            <div class="card-subtitle">Comparativa por categoría</div>
                        </div>
                    </div>
                    <div class="budget-chart-container"><canvas id="budgetChartVs"></canvas></div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">Distribución del gasto</div>
                            <div class="card-subtitle">Porcentaje por categoría</div>
                        </div>
                    </div>
                    <div class="budget-chart-container"><canvas id="budgetChartDist"></canvas></div>
                </div>
            </div>
            <div class="card" style="margin-top: 16px;">
                <div class="card-header">
                    <div>
                        <div class="card-title">Evolución mensual</div>
                        <div class="card-subtitle">Últimos 6 meses</div>
                    </div>
                </div>
                <div class="budget-chart-container"><canvas id="budgetChartEvo"></canvas></div>
            </div>
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-top: 16px;">
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">Gastos recientes</div>
                            <div class="card-subtitle">Últimos movimientos</div>
                        </div>
                        <button class="btn btn-sm btn-secondary" id="budgetViewAllExpenses">Ver todos</button>
                    </div>
                    <div id="budgetRecentList"></div>
                </div>
                <div class="card">
                    <div class="card-header"><div class="card-title">Accesos rápidos</div></div>
                    <div class="budget-quick-grid">
                        <button class="budget-quick-card" data-quick="new-expense"><i class="fas fa-plus-circle"></i><span>Registrar gasto</span></button>
                        <button class="budget-quick-card" data-quick="new-category"><i class="fas fa-coins"></i><span>Crear presupuesto</span></button>
                        <button class="budget-quick-card" data-quick="goto-categorias"><i class="fas fa-tags"></i><span>Categorías</span></button>
                        <button class="budget-quick-card" data-quick="uncategorized"><i class="fas fa-question-circle"></i><span>Sin categorizar</span></button>
                        <button class="budget-quick-card" data-quick="review-alerts"><i class="fas fa-bell"></i><span>Alertas</span></button>
                    </div>
                </div>
            </div>
        `;

        renderAlerts();
        renderCharts();
        renderRecentList();

        // Eventos
        view.querySelectorAll('[data-action]').forEach(el => {
            el.addEventListener('click', () => {
                const a = el.dataset.action;
                if (a === 'goto-categorias') switchView('pantalla');
                else if (a === 'goto-gastos') switchView('gastos');
            });
        });
        view.querySelector('#budgetViewAllExpenses').addEventListener('click', () => switchView('gastos'));
        view.querySelectorAll('[data-quick]').forEach(btn => {
            btn.addEventListener('click', () => {
                const q = btn.dataset.quick;
                if (q === 'new-expense') openExpenseModal();
                else if (q === 'new-category') openCategoryModal();
                else if (q === 'goto-categorias') switchView('pantalla');
                else if (q === 'uncategorized') {
                    switchView('gastos');
                    filters.categoryId = '__uncategorized';
                    renderGastos();
                }
                else if (q === 'review-alerts') window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    function switchView(view) {
        currentView = view;
        containerEl.querySelectorAll('.budget-subnav-item').forEach(b =>
            b.classList.toggle('active', b.dataset.view === view));
        containerEl.querySelectorAll('.budget-subview').forEach(v =>
            v.classList.toggle('active', v.id === `budgetView-${view}`));
        renderView(view);
    }

    // =========================================================
    // ALERTAS
    // =========================================================
    function renderAlerts() {
        const container = containerEl.querySelector('#budgetAlertsContainer');
        const alerts = [];
        const settings = data().settings || {};

        data().categories.filter(c => !c.parentId && c.status === 'active').forEach(cat => {
            const budget = getCategoryBudget(cat.id, currentPeriod);
            const expense = getCategoryExpense(cat.id, currentPeriod);
            if (budget === null) {
                if (settings.alertNoBudget !== false && expense > 0) {
                    alerts.push({
                        type: 'info', icon: 'fas fa-info-circle',
                        title: `${cat.name} sin presupuesto`,
                        desc: `Tiene ${App.formatCurrency(expense)} de gasto pero no hay presupuesto asignado.`,
                        action: () => openCategoryModal(cat.id)
                    });
                }
                return;
            }
            const pct = (expense / budget) * 100;
            const tDanger = cat.thresholdDanger || settings.thresholdDanger || 100;
            const tWarning = cat.thresholdWarning || settings.thresholdWarning || 80;
            if (pct >= tDanger) {
                alerts.push({
                    type: 'danger', icon: 'fas fa-exclamation-triangle',
                    title: `${cat.name} ha superado su presupuesto`,
                    desc: `Consumo del ${pct.toFixed(0)}% (${App.formatCurrency(expense)} / ${App.formatCurrency(budget)}). Exceso: ${App.formatCurrency(expense - budget)}.`,
                    action: () => { switchView('gastos'); filters.categoryId = cat.id; renderGastos(); }
                });
            } else if (pct >= tWarning) {
                alerts.push({
                    type: 'warning', icon: 'fas fa-exclamation-circle',
                    title: `${cat.name} cerca del límite`,
                    desc: `Consumo del ${pct.toFixed(0)}% (${App.formatCurrency(expense)} / ${App.formatCurrency(budget)}).`,
                    action: () => { switchView('gastos'); filters.categoryId = cat.id; renderGastos(); }
                });
            }
        });

        if (settings.alertUncategorized !== false) {
            const unc = getExpensesForPeriod(currentPeriod, true).filter(e => !e.categoryId);
            if (unc.length > 0) {
                alerts.push({
                    type: 'warning', icon: 'fas fa-question-circle',
                    title: `${unc.length} gasto(s) sin categorizar`,
                    desc: `Total: ${App.formatCurrency(unc.reduce((s, e) => s + e.amount, 0))}.`,
                    action: () => { switchView('gastos'); filters.categoryId = '__uncategorized'; renderGastos(); }
                });
            }
        }

        const pending = getExpensesForPeriod(currentPeriod, true).filter(e => e.status === 'pendiente');
        if (pending.length > 0) {
            alerts.push({
                type: 'info', icon: 'fas fa-clock',
                title: `${pending.length} gasto(s) pendiente(s) de revisión`,
                desc: `Total: ${App.formatCurrency(pending.reduce((s, e) => s + e.amount, 0))}.`,
                action: () => { switchView('gastos'); filters.status = 'pendiente'; renderGastos(); }
            });
        }

        if (alerts.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title"><i class="fas fa-bell"></i> Alertas</div>
                        <div class="card-subtitle">${alerts.length} aviso(s) activo(s)</div>
                    </div>
                </div>
                <div class="budget-alert-list">
                    ${alerts.map((a, i) => `
                        <div class="budget-alert-item ${a.type}">
                            <div class="budget-alert-icon"><i class="${a.icon}"></i></div>
                            <div class="budget-alert-content">
                                <div class="budget-alert-title">${a.title}</div>
                                <div class="budget-alert-desc">${a.desc}</div>
                                <button class="budget-alert-action" data-alert-idx="${i}">Ver detalle →</button>
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
        renderChartVs();
        renderChartDist();
        renderChartEvo();
    }

    function renderChartVs() {
        const canvas = containerEl.querySelector('#budgetChartVs');
        if (!canvas) return;
        if (charts.vs) charts.vs.destroy();

        const colors = getChartColors();
        const rootCats = data().categories.filter(c => !c.parentId && c.status === 'active').sort((a, b) => a.order - b.order);
        const labels = [], budgetData = [], expenseData = [], bgColors = [];

        rootCats.forEach(cat => {
            const budget = getCategoryBudget(cat.id, currentPeriod);
            const expense = getCategoryExpense(cat.id, currentPeriod);
            if (budget === null && expense === 0) return;
            labels.push(cat.name);
            budgetData.push(budget !== null ? budget : 0);
            expenseData.push(expense);
            bgColors.push(cat.color);
        });

        if (labels.length === 0) {
            canvas.parentElement.innerHTML = '<div class="budget-empty"><i class="fas fa-chart-bar"></i><h3>Sin datos</h3><p>No hay categorías con presupuesto o gasto en este periodo.</p></div>';
            return;
        }

        charts.vs = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Presupuesto', data: budgetData, backgroundColor: 'rgba(37,99,235,0.2)', borderColor: '#2563eb', borderWidth: 2, borderRadius: 4 },
                    { label: 'Gasto', data: expenseData, backgroundColor: bgColors.map(c => c + 'cc'), borderColor: bgColors, borderWidth: 1, borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                plugins: {
                    legend: { position: 'top', labels: { color: colors.text, font: { size: 11 } } },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${App.formatCurrency(ctx.parsed.x)}` } }
                },
                scales: {
                    x: { ticks: { color: colors.text, callback: v => App.formatCurrency(v) }, grid: { color: colors.grid } },
                    y: { ticks: { color: colors.text }, grid: { display: false } }
                }
            }
        });
    }

    function renderChartDist() {
        const canvas = containerEl.querySelector('#budgetChartDist');
        if (!canvas) return;
        if (charts.dist) charts.dist.destroy();

        const colors = getChartColors();
        const expenses = getExpensesForPeriod(currentPeriod);
        const byCategory = {};

        expenses.forEach(e => {
            const cat = getCategoryById(e.categoryId);
            const root = cat ? getRootCategory(cat) : null;
            const key = root ? root.id : '__uncategorized';
            const name = root ? root.name : 'Sin categorizar';
            const color = root ? root.color : '#94a3b8';
            if (!byCategory[key]) byCategory[key] = { name, color, total: 0 };
            byCategory[key].total += e.amount;
        });

        const items = Object.values(byCategory).sort((a, b) => b.total - a.total);
        const total = items.reduce((s, i) => s + i.total, 0);

        if (total === 0) {
            canvas.parentElement.innerHTML = `
                <div class="budget-empty">
                    <i class="fas fa-chart-pie"></i>
                    <h3>Sin gastos</h3>
                    <p>Registra tu primer gasto para ver la distribución.</p>
                    <button class="btn btn-primary" onclick="BudgetApp.openExpenseModal()"><i class="fas fa-plus"></i> Registrar gasto</button>
                </div>
            `;
            return;
        }

        charts.dist = new Chart(canvas, {
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
                    legend: { position: 'right', labels: { color: colors.text, font: { size: 11 }, padding: 10 } },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${App.formatCurrency(ctx.parsed)} (${((ctx.parsed / total) * 100).toFixed(1)}%)` } }
                }
            }
        });
    }

    function renderChartEvo() {
        const canvas = containerEl.querySelector('#budgetChartEvo');
        if (!canvas) return;
        if (charts.evo) charts.evo.destroy();

        const colors = getChartColors();
        const periods = [];
        const [y, m] = currentPeriod.split('-').map(Number);
        for (let i = 5; i >= 0; i--) {
            const d = new Date(y, m - 1 - i, 1);
            periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }

        const budgetData = periods.map(p => getTotalBudget(p));
        const expenseData = periods.map(p => getTotalExpense(p));
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const labels = periods.map(p => {
            const [yy, mm] = p.split('-');
            return `${monthNames[parseInt(mm) - 1]} ${yy}`;
        });

        charts.evo = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { type: 'bar', label: 'Presupuesto', data: budgetData, backgroundColor: 'rgba(37,99,235,0.2)', borderColor: '#2563eb', borderWidth: 2, borderRadius: 4 },
                    { type: 'bar', label: 'Gasto', data: expenseData, backgroundColor: 'rgba(16,185,129,0.6)', borderColor: '#10b981', borderWidth: 1, borderRadius: 4 }
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
    // GASTOS RECIENTES
    // =========================================================
    function renderRecentList() {
        const container = containerEl.querySelector('#budgetRecentList');
        const count = (data().settings && data().settings.recentCount) || 5;
        const expenses = getExpensesForPeriod(currentPeriod, true)
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, count);

        if (expenses.length === 0) {
            container.innerHTML = '<div class="budget-empty"><i class="fas fa-receipt"></i><h3>Sin gastos</h3><p>Registra tu primer gasto del periodo.</p></div>';
            return;
        }

        container.innerHTML = expenses.map(e => {
            const cat = getCategoryById(e.categoryId);
            const color = cat ? cat.color : '#94a3b8';
            const icon = cat ? cat.icon : 'fas fa-question';
            const catName = cat ? cat.name : 'Sin categorizar';
            return `
                <div class="budget-list-item">
                    <div class="budget-list-icon" style="background: ${color}20; color: ${color};"><i class="${icon}"></i></div>
                    <div class="budget-list-info">
                        <div class="budget-list-title">${App.escapeHtml(e.concept)}</div>
                        <div class="budget-list-sub">${catName} · ${App.formatDate(e.date)} ${getStatusBadge(e.status)}</div>
                    </div>
                    <div class="budget-list-amount negative">${App.formatCurrency(e.amount)}</div>
                </div>
            `;
        }).join('');
    }

    // =========================================================
    // VISTA: CATEGORÍAS
    // =========================================================
    function renderCategorias() {
        const view = containerEl.querySelector('#budgetView-categorias');
        view.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Categorías de gasto</div>
                        <div class="card-subtitle">Gestiona categorías, subcategorías y presupuestos</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-sm btn-secondary" id="budgetExportCategories"><i class="fas fa-download"></i> Exportar</button>
                        <button class="btn btn-sm btn-primary" id="budgetNewCategory"><i class="fas fa-plus"></i> Nueva categoría</button>
                    </div>
                </div>
                <div class="budget-filters-bar">
                    <div class="budget-search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" id="budgetCategorySearch" placeholder="Buscar categoría...">
                    </div>
                    <select class="budget-filter-select" id="budgetCategoryStatusFilter">
                        <option value="active">Activas</option>
                        <option value="archived">Archivadas</option>
                        <option value="all">Todas</option>
                    </select>
                </div>
                <div class="budget-table-wrap">
                    <table class="budget-table">
                        <thead>
                            <tr>
                                <th style="width: 30px;"></th>
                                <th>Categoría</th>
                                <th>Subcategorías</th>
                                <th>Presupuesto</th>
                                <th>Gasto</th>
                                <th>Diferencia</th>
                                <th>% Consumido</th>
                                <th>Estado</th>
                                <th style="width: 80px;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="budgetCategoriesBody"></tbody>
                    </table>
                </div>
            </div>
        `;

        renderCategoriesTable();

        view.querySelector('#budgetNewCategory').addEventListener('click', () => openCategoryModal());
        view.querySelector('#budgetCategorySearch').addEventListener('input', renderCategoriesTable);
        view.querySelector('#budgetCategoryStatusFilter').addEventListener('change', renderCategoriesTable);
        view.querySelector('#budgetExportCategories').addEventListener('click', exportCategories);
    }

    function renderCategoriesTable() {
        const tbody = containerEl.querySelector('#budgetCategoriesBody');
        const search = (containerEl.querySelector('#budgetCategorySearch').value || '').toLowerCase();
        const statusFilter = containerEl.querySelector('#budgetCategoryStatusFilter').value;

        let cats = data().categories.filter(c => !c.parentId);
        if (statusFilter === 'active') cats = cats.filter(c => c.status === 'active');
        else if (statusFilter === 'archived') cats = cats.filter(c => c.status === 'archived');
        cats = cats.sort((a, b) => a.order - b.order);
        if (search) cats = cats.filter(c => c.name.toLowerCase().includes(search));

        if (cats.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9"><div class="budget-empty"><i class="fas fa-tags"></i><h3>Sin categorías</h3></div></td></tr>';
            return;
        }

        let html = '';
        cats.forEach(cat => {
            const budget = getCategoryBudget(cat.id, currentPeriod);
            const expense = getCategoryExpense(cat.id, currentPeriod);
            const diff = budget !== null ? budget - expense : null;
            const pct = budget && budget > 0 ? (expense / budget) * 100 : null;
            const children = data().categories.filter(c => c.parentId === cat.id).sort((a, b) => a.order - b.order);

            const pctBadge = pct === null ? '<span class="badge badge-neutral">Sin presupuesto</span>' :
                pct >= 100 ? `<span class="badge badge-danger">${pct.toFixed(0)}%</span>` :
                pct >= 80 ? `<span class="badge badge-warning">${pct.toFixed(0)}%</span>` :
                `<span class="badge badge-success">${pct.toFixed(0)}%</span>`;

            const statusBadge = cat.status === 'archived' ? '<span class="badge badge-neutral">Archivada</span>' :
                pct !== null && pct >= 100 ? '<span class="badge badge-danger">Superado</span>' :
                pct !== null && pct >= 80 ? '<span class="badge badge-warning">Alerta</span>' :
                '<span class="badge badge-success">OK</span>';

            html += `
                <tr data-cat-id="${cat.id}">
                    <td>${children.length > 0 ? `<button class="budget-expand-btn" data-expand="${cat.id}"><i class="fas fa-chevron-right"></i></button>` : ''}</td>
                    <td>
                        <div class="budget-cat-cell">
                            <div class="budget-cat-icon" style="background: ${cat.color};"><i class="${cat.icon}"></i></div>
                            <div>
                                <div class="budget-cat-name">${App.escapeHtml(cat.name)}</div>
                                ${cat.description ? `<div class="budget-cat-sub">${App.escapeHtml(cat.description)}</div>` : ''}
                            </div>
                        </div>
                    </td>
                    <td>${children.length}</td>
                    <td class="amount">${budget !== null ? App.formatCurrency(budget) : '<span style="color: var(--text-muted);">—</span>'}</td>
                    <td class="amount">${App.formatCurrency(expense)}</td>
                    <td class="amount" style="color: ${diff === null ? 'var(--text-muted)' : diff >= 0 ? 'var(--success)' : 'var(--danger)'};">
                        ${diff !== null ? App.formatCurrency(diff) : '—'}
                    </td>
                    <td>${pctBadge}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <div class="budget-action-menu">
                            <button class="btn btn-icon btn-ghost" data-action-menu="${cat.id}"><i class="fas fa-ellipsis-v"></i></button>
                            <div class="budget-action-dropdown" id="bmenu-${cat.id}">
                                <button data-action="view-cat" data-id="${cat.id}"><i class="fas fa-eye"></i> Ver detalle</button>
                                <button data-action="edit-cat" data-id="${cat.id}"><i class="fas fa-edit"></i> Editar</button>
                                <button data-action="archive-cat" data-id="${cat.id}" class="${cat.status === 'archived' ? '' : 'danger'}">
                                    <i class="fas fa-${cat.status === 'archived' ? 'undo' : 'archive'}"></i>
                                    ${cat.status === 'archived' ? 'Restaurar' : 'Archivar'}
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;

            children.forEach(sub => {
                const subBudget = getCategoryBudget(sub.id, currentPeriod);
                const subExpense = getCategoryExpense(sub.id, currentPeriod);
                const subDiff = subBudget !== null ? subBudget - subExpense : null;
                const subPct = subBudget && subBudget > 0 ? (subExpense / subBudget) * 100 : null;
                html += `
                    <tr class="budget-sub-row" data-parent="${cat.id}" style="display: none;">
                        <td></td>
                        <td>
                            <div class="budget-cat-cell">
                                <div class="budget-cat-icon" style="background: ${sub.color}; width: 26px; height: 26px; font-size: 11px;"><i class="${sub.icon}"></i></div>
                                <div class="budget-cat-name">${App.escapeHtml(sub.name)}</div>
                            </div>
                        </td>
                        <td>—</td>
                        <td class="amount">${subBudget !== null ? App.formatCurrency(subBudget) : '—'}</td>
                        <td class="amount">${App.formatCurrency(subExpense)}</td>
                        <td class="amount" style="color: ${subDiff === null ? 'var(--text-muted)' : subDiff >= 0 ? 'var(--success)' : 'var(--danger)'};">
                            ${subDiff !== null ? App.formatCurrency(subDiff) : '—'}
                        </td>
                        <td>${subPct !== null ? subPct.toFixed(0) + '%' : '—'}</td>
                        <td></td>
                        <td><button class="btn btn-icon btn-ghost" data-action="edit-cat" data-id="${sub.id}"><i class="fas fa-edit"></i></button></td>
                    </tr>
                `;
            });
        });

        tbody.innerHTML = html;

        tbody.querySelectorAll('[data-expand]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.expand;
                const isOpen = btn.classList.toggle('open');
                tbody.querySelectorAll(`[data-parent="${id}"]`).forEach(row => {
                    row.style.display = isOpen ? 'table-row' : 'none';
                });
            });
        });

        tbody.querySelectorAll('[data-action-menu]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.actionMenu;
                containerEl.querySelectorAll('.budget-action-dropdown.open').forEach(m => {
                    if (m.id !== `bmenu-${id}`) m.classList.remove('open');
                });
                containerEl.querySelector(`#bmenu-${id}`).classList.toggle('open');
            });
        });

        tbody.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                containerEl.querySelectorAll('.budget-action-dropdown.open').forEach(m => m.classList.remove('open'));
                if (action === 'view-cat') showCategoryDetail(id);
                else if (action === 'edit-cat') openCategoryModal(id);
                else if (action === 'archive-cat') toggleCategoryArchive(id);
            });
        });
    }

    function toggleCategoryArchive(id) {
        const cat = getCategoryById(id);
        if (!cat) return;
        cat.status = cat.status === 'archived' ? 'active' : 'archived';
        App.addHistory(cat.status === 'archived' ? 'category_archived' : 'category_restored', cat.name);
        App.saveData();
        renderCategoriesTable();
        App.showToast(cat.status === 'archived' ? 'Categoría archivada' : 'Categoría restaurada');
    }

    function showCategoryDetail(catId) {
        const cat = getCategoryById(catId);
        if (!cat) return;
        const budget = getCategoryBudget(catId, currentPeriod);
        const expense = getCategoryExpense(catId, currentPeriod);
        const diff = budget !== null ? budget - expense : null;
        const pct = budget && budget > 0 ? (expense / budget) * 100 : null;

        const expenses = getExpensesForPeriod(currentPeriod, true)
            .filter(e => getDescendantIds(catId).includes(e.categoryId))
            .sort((a, b) => b.date.localeCompare(a.date));

        containerEl.querySelector('#budgetCategoryDetailTitle').textContent = cat.name;
        containerEl.querySelector('#budgetCategoryDetailBody').innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <div class="budget-cat-icon" style="background: ${cat.color}; width: 48px; height: 48px; font-size: 20px;"><i class="${cat.icon}"></i></div>
                <div>
                    <div style="font-size: 16px; font-weight: 600;">${App.escapeHtml(cat.name)}</div>
                    <div style="font-size: 12px; color: var(--text-muted);">${App.formatCurrency(expense)} gastados</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
                <div class="card" style="padding: 14px; margin: 0;">
                    <div class="budget-stat-label">Presupuesto</div>
                    <div style="font-size: 18px; font-weight: 700;">${budget !== null ? App.formatCurrency(budget) : 'Sin definir'}</div>
                </div>
                <div class="card" style="padding: 14px; margin: 0;">
                    <div class="budget-stat-label">Gasto</div>
                    <div style="font-size: 18px; font-weight: 700;">${App.formatCurrency(expense)}</div>
                </div>
                <div class="card" style="padding: 14px; margin: 0;">
                    <div class="budget-stat-label">Diferencia</div>
                    <div style="font-size: 18px; font-weight: 700; color: ${diff === null ? 'var(--text-muted)' : diff >= 0 ? 'var(--success)' : 'var(--danger)'};">
                        ${diff !== null ? App.formatCurrency(diff) : '—'}
                    </div>
                </div>
            </div>
            ${pct !== null ? `
                <div style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                        <span>Consumo</span><span style="font-weight: 600;">${pct.toFixed(1)}%</span>
                    </div>
                    <div class="budget-progress"><div class="budget-progress-bar ${pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : ''}" style="width: ${Math.min(pct, 100)}%;"></div></div>
                </div>
            ` : ''}
            <h4 style="font-size: 13px; font-weight: 600; margin: 16px 0 8px;">Gastos en esta categoría (${expenses.length})</h4>
            ${expenses.length === 0 ? '<p style="color: var(--text-muted); font-size: 13px;">Sin gastos en este periodo.</p>' :
                expenses.slice(0, 10).map(e => `
                    <div class="budget-list-item">
                        <div class="budget-list-info">
                            <div class="budget-list-title">${App.escapeHtml(e.concept)}</div>
                            <div class="budget-list-sub">${App.formatDate(e.date)} · ${App.getProfileName(e.person)}</div>
                        </div>
                        <div class="budget-list-amount negative">${App.formatCurrency(e.amount)}</div>
                    </div>
                `).join('')
            }
        `;
        containerEl.querySelector('#budgetCategoryDetailModal').classList.add('active');
    }

    // =========================================================
    // VISTA: GASTOS
    // =========================================================
    function renderGastos() {
        const view = containerEl.querySelector('#budgetView-gastos');
        view.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Listado de gastos</div>
                        <div class="card-subtitle" id="budgetExpensesCount">0 gastos</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-sm btn-secondary" id="budgetExportExpenses"><i class="fas fa-download"></i> Exportar</button>
                        <button class="btn btn-sm btn-primary" id="budgetNewExpense2"><i class="fas fa-plus"></i> Nuevo gasto</button>
                    </div>
                </div>
                <div class="budget-filters-bar">
                    <div class="budget-search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" id="budgetExpenseSearch" placeholder="Buscar por concepto...">
                    </div>
                    <select class="budget-filter-select" id="budgetExpenseCategoryFilter">
                        <option value="">Todas las categorías</option>
                    </select>
                    <select class="budget-filter-select" id="budgetExpenseStatusFilter">
                        <option value="">Todos los estados</option>
                        <option value="registrado">Registrado</option>
                        <option value="previsto">Previsto</option>
                        <option value="pendiente">Pendiente</option>
                    </select>
                    <select class="budget-filter-select" id="budgetExpenseTypeFilter">
                        <option value="">Todos los tipos</option>
                        <option value="individual">Individual</option>
                        <option value="agregado">Agregado</option>
                    </select>
                </div>
                <div class="budget-table-desktop">
                    <div class="budget-table-wrap">
                        <table class="budget-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Concepto</th>
                                    <th>Categoría</th>
                                    <th>Persona</th>
                                    <th>Importe</th>
                                    <th>Estado</th>
                                    <th>Tipo</th>
                                    <th style="width: 80px;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="budgetExpensesBody"></tbody>
                        </table>
                    </div>
                </div>
                <div class="budget-table-mobile" id="budgetExpensesMobile"></div>
            </div>
        `;

        renderExpensesTable();

        view.querySelector('#budgetNewExpense2').addEventListener('click', () => openExpenseModal());
        view.querySelector('#budgetExportExpenses').addEventListener('click', exportExpenses);
        view.querySelector('#budgetExpenseSearch').addEventListener('input', () => {
            filters.search = view.querySelector('#budgetExpenseSearch').value;
            renderExpensesTable();
        });
        view.querySelector('#budgetExpenseCategoryFilter').addEventListener('change', () => {
            filters.categoryId = view.querySelector('#budgetExpenseCategoryFilter').value;
            renderExpensesTable();
        });
        view.querySelector('#budgetExpenseStatusFilter').addEventListener('change', () => {
            filters.status = view.querySelector('#budgetExpenseStatusFilter').value;
            renderExpensesTable();
        });
        view.querySelector('#budgetExpenseTypeFilter').addEventListener('change', () => {
            filters.type = view.querySelector('#budgetExpenseTypeFilter').value;
            renderExpensesTable();
        });

        populateCategorySelect(view.querySelector('#budgetExpenseCategoryFilter'), filters.categoryId);
    }

    function renderExpensesTable() {
        const tbody = containerEl.querySelector('#budgetExpensesBody');
        const mobile = containerEl.querySelector('#budgetExpensesMobile');
        if (!tbody) return;

        let list = getFilteredExpenses();
        list.sort((a, b) => b.date.localeCompare(a.date));

        const countEl = containerEl.querySelector('#budgetExpensesCount');
        if (countEl) countEl.textContent = `${list.length} gasto(s) · Total: ${App.formatCurrency(list.reduce((s, e) => s + e.amount, 0))}`;

        if (list.length === 0) {
            const empty = '<tr><td colspan="8"><div class="budget-empty"><i class="fas fa-receipt"></i><h3>Sin gastos</h3><p>No hay gastos que coincidan con los filtros.</p></div></td></tr>';
            tbody.innerHTML = empty;
            if (mobile) mobile.innerHTML = '<div class="budget-empty"><i class="fas fa-receipt"></i><h3>Sin gastos</h3></div>';
            return;
        }

        tbody.innerHTML = list.map(e => {
            const cat = getCategoryById(e.categoryId);
            const catName = cat ? cat.name : 'Sin categorizar';
            const catColor = cat ? cat.color : '#94a3b8';
            const catIcon = cat ? cat.icon : 'fas fa-question';
            return `
                <tr>
                    <td>${App.formatDate(e.date)}</td>
                    <td>
                        <div style="font-weight: 500;">${App.escapeHtml(e.concept)}</div>
                        ${e.notes ? `<div style="font-size: 11px; color: var(--text-muted);">${App.escapeHtml(e.notes)}</div>` : ''}
                    </td>
                    <td>
                        <div class="budget-cat-cell">
                            <div class="budget-cat-icon" style="background: ${catColor}; width: 26px; height: 26px; font-size: 11px;"><i class="${catIcon}"></i></div>
                            <span>${catName}</span>
                        </div>
                    </td>
                    <td>${App.getProfileName(e.person)}</td>
                    <td class="amount negative">${App.formatCurrency(e.amount)}</td>
                    <td>${getStatusBadge(e.status)}</td>
                    <td><span class="badge badge-neutral">${e.type === 'agregado' ? 'Agregado' : 'Individual'}</span></td>
                    <td>
                        <div class="budget-action-menu">
                            <button class="btn btn-icon btn-ghost" data-expense-menu="${e.id}"><i class="fas fa-ellipsis-v"></i></button>
                            <div class="budget-action-dropdown" id="bemenu-${e.id}">
                                <button data-expense-action="edit" data-id="${e.id}"><i class="fas fa-edit"></i> Editar</button>
                                <button data-expense-action="archive" data-id="${e.id}"><i class="fas fa-archive"></i> ${e.status === 'archivado' ? 'Restaurar' : 'Archivar'}</button>
                                <button data-expense-action="delete" data-id="${e.id}" class="danger"><i class="fas fa-trash"></i> Eliminar</button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        if (mobile) {
            mobile.innerHTML = list.map(e => {
                const cat = getCategoryById(e.categoryId);
                const catName = cat ? cat.name : 'Sin categorizar';
                return `
                    <div class="budget-mobile-card">
                        <div class="budget-mobile-card-head">
                            <div>
                                <div style="font-weight: 600;">${App.escapeHtml(e.concept)}</div>
                                <div style="font-size: 11px; color: var(--text-muted);">${App.formatDate(e.date)} · ${App.getProfileName(e.person)}</div>
                            </div>
                            <div style="font-weight: 700; color: var(--danger);">${App.formatCurrency(e.amount)}</div>
                        </div>
                        <div class="budget-mobile-card-row"><span class="lbl">Categoría</span><span class="val">${catName}</span></div>
                        <div class="budget-mobile-card-row"><span class="lbl">Estado</span><span class="val">${getStatusBadge(e.status)}</span></div>
                        <div style="display: flex; gap: 6px; margin-top: 10px;">
                            <button class="btn btn-sm btn-secondary" data-expense-action="edit" data-id="${e.id}" style="flex: 1;"><i class="fas fa-edit"></i> Editar</button>
                            <button class="btn btn-sm btn-danger" data-expense-action="delete" data-id="${e.id}"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        containerEl.querySelectorAll('[data-expense-menu]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.expenseMenu;
                containerEl.querySelectorAll('.budget-action-dropdown.open').forEach(m => {
                    if (m.id !== `bemenu-${id}`) m.classList.remove('open');
                });
                containerEl.querySelector(`#bemenu-${id}`).classList.toggle('open');
            });
        });

        containerEl.querySelectorAll('[data-expense-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.expenseAction;
                const id = btn.dataset.id;
                containerEl.querySelectorAll('.budget-action-dropdown.open').forEach(m => m.classList.remove('open'));
                if (action === 'edit') openExpenseModal(id);
                else if (action === 'archive') archiveExpense(id);
                else if (action === 'delete') confirmDeleteExpense(id);
            });
        });
    }

    function archiveExpense(id) {
        const exp = data().expenses.find(e => e.id === id);
        if (!exp) return;
        exp.status = exp.status === 'archivado' ? 'registrado' : 'archivado';
        App.addHistory('expense_archived', exp.concept);
        App.saveData();
        renderExpensesTable();
        App.showToast('Estado actualizado');
    }

    function confirmDeleteExpense(id) {
        const exp = data().expenses.find(e => e.id === id);
        if (!exp) return;
        App.showConfirm(
            'Eliminar gasto',
            `¿Seguro que quieres eliminar "${exp.concept}" (${App.formatCurrency(exp.amount)})? Esta acción no se puede deshacer.`,
            () => {
                data().expenses = data().expenses.filter(e => e.id !== id);
                App.addHistory('expense_deleted', exp.concept);
                App.saveData();
                renderExpensesTable();
                App.showToast('Gasto eliminado');
            }
        );
    }

    // =========================================================
    // MODAL GASTO
    // =========================================================
    function openExpenseModal(id = null) {
        const form = containerEl.querySelector('#budgetExpenseModal');
        form.querySelectorAll('.budget-form-group').forEach(g => g.classList.remove('error'));

        if (id) {
            const exp = data().expenses.find(e => e.id === id);
            if (!exp) return;
            containerEl.querySelector('#budgetExpenseModalTitle').textContent = 'Editar gasto';
            containerEl.querySelector('#budgetExpenseId').value = exp.id;
            containerEl.querySelector('#budgetExpenseType').value = exp.type || 'individual';
            containerEl.querySelector('#budgetExpenseConcept').value = exp.concept;
            containerEl.querySelector('#budgetExpenseAmount').value = exp.amount;
            containerEl.querySelector('#budgetExpenseDate').value = exp.date;
            containerEl.querySelector('#budgetExpenseStatus').value = exp.status;
            containerEl.querySelector('#budgetExpensePerson').value = exp.person;
            containerEl.querySelector('#budgetExpenseNotes').value = exp.notes || '';
            populateCategorySelect(containerEl.querySelector('#budgetExpenseCategory'), exp.categoryId || '');
        } else {
            containerEl.querySelector('#budgetExpenseModalTitle').textContent = 'Nuevo gasto';
            containerEl.querySelector('#budgetExpenseId').value = '';
            containerEl.querySelector('#budgetExpenseType').value = 'individual';
            containerEl.querySelector('#budgetExpenseConcept').value = '';
            containerEl.querySelector('#budgetExpenseAmount').value = '';
            containerEl.querySelector('#budgetExpenseDate').value = new Date().toISOString().substring(0, 10);
            containerEl.querySelector('#budgetExpenseStatus').value = 'registrado';
            containerEl.querySelector('#budgetExpensePerson').value = 'conjunto';
            containerEl.querySelector('#budgetExpenseNotes').value = '';
            populateCategorySelect(containerEl.querySelector('#budgetExpenseCategory'), '');
        }

        form.classList.add('active');
    }

    function saveExpense() {
        const concept = containerEl.querySelector('#budgetExpenseConcept').value.trim();
        const amount = parseFloat(containerEl.querySelector('#budgetExpenseAmount').value);
        const date = containerEl.querySelector('#budgetExpenseDate').value;

        containerEl.querySelectorAll('#budgetExpenseModal .budget-form-group').forEach(g => g.classList.remove('error'));

        let valid = true;
        if (!concept) { containerEl.querySelector('#budgetExpenseConcept').closest('.budget-form-group').classList.add('error'); valid = false; }
        if (isNaN(amount) || amount <= 0) { containerEl.querySelector('#budgetExpenseAmount').closest('.budget-form-group').classList.add('error'); valid = false; }
        if (!date) { containerEl.querySelector('#budgetExpenseDate').closest('.budget-form-group').classList.add('error'); valid = false; }
        if (!valid) return;

        const id = containerEl.querySelector('#budgetExpenseId').value;
        const expenseData = {
            concept,
            amount,
            date,
            categoryId: containerEl.querySelector('#budgetExpenseCategory').value,
            person: containerEl.querySelector('#budgetExpensePerson').value,
            status: containerEl.querySelector('#budgetExpenseStatus').value,
            type: containerEl.querySelector('#budgetExpenseType').value,
            notes: containerEl.querySelector('#budgetExpenseNotes').value.trim()
        };

        if (id) {
            const exp = data().expenses.find(e => e.id === id);
            Object.assign(exp, expenseData);
            App.addHistory('expense_updated', concept);
            App.showToast('Gasto actualizado');
        } else {
            expenseData.id = App.generateId('e');
            data().expenses.push(expenseData);
            App.addHistory('expense_created', concept);
            App.showToast('Gasto registrado');
        }

        App.saveData();
        containerEl.querySelector('#budgetExpenseModal').classList.remove('active');
        renderView(currentView);
    }

    // =========================================================
    // MODAL CATEGORÍA
    // =========================================================
    const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b', '#14b8a6', '#a855f7', '#dc2626', '#0ea5e9', '#d97706', '#059669', '#7c3aed', '#94a3b8'];
    const ICONS = ['fas fa-tag', 'fas fa-utensils', 'fas fa-home', 'fas fa-car', 'fas fa-bolt', 'fas fa-coffee', 'fas fa-shopping-bag', 'fas fa-heartbeat', 'fas fa-plane', 'fas fa-tv', 'fas fa-couch', 'fas fa-bus', 'fas fa-gas-pump', 'fas fa-wifi', 'fas fa-film', 'fas fa-music', 'fas fa-book', 'fas fa-dumbbell', 'fas fa-baby', 'fas fa-paw', 'fas fa-gift', 'fas fa-tools', 'fas fa-graduation-cap', 'fas fa-briefcase'];

    function openCategoryModal(id = null) {
        const form = containerEl.querySelector('#budgetCategoryModal');
        form.querySelectorAll('.budget-form-group').forEach(g => g.classList.remove('error'));

        // Color grid
        const colorGrid = containerEl.querySelector('#budgetColorGrid');
        colorGrid.innerHTML = COLORS.map(c => `<div class="budget-color-option" data-color="${c}" style="background: ${c};"></div>`).join('');
        colorGrid.querySelectorAll('.budget-color-option').forEach(opt => {
            opt.addEventListener('click', () => {
                colorGrid.querySelectorAll('.budget-color-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                containerEl.querySelector('#budgetCategoryColor').value = opt.dataset.color;
            });
        });

        // Icon grid
        const iconGrid = containerEl.querySelector('#budgetIconGrid');
        iconGrid.innerHTML = ICONS.map(i => `<div class="budget-icon-option" data-icon="${i}"><i class="${i}"></i></div>`).join('');
        iconGrid.querySelectorAll('.budget-icon-option').forEach(opt => {
            opt.addEventListener('click', () => {
                iconGrid.querySelectorAll('.budget-icon-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                containerEl.querySelector('#budgetCategoryIcon').value = opt.dataset.icon;
            });
        });

        // Parent select
        const parentSelect = containerEl.querySelector('#budgetCategoryParent');
        parentSelect.innerHTML = '<option value="">— Ninguna (raíz) —</option>' +
            data().categories.filter(c => c.status === 'active' && !c.parentId && c.id !== id)
                .sort((a, b) => a.order - b.order)
                .map(c => `<option value="${c.id}">${App.escapeHtml(c.name)}</option>`).join('');

        if (id) {
            const cat = getCategoryById(id);
            if (!cat) return;
            containerEl.querySelector('#budgetCategoryModalTitle').textContent = 'Editar categoría';
            containerEl.querySelector('#budgetCategoryId').value = cat.id;
            containerEl.querySelector('#budgetCategoryName').value = cat.name;
            containerEl.querySelector('#budgetCategoryParent').value = cat.parentId || '';
            containerEl.querySelector('#budgetCategoryBudget').value = cat.budget || '';
            containerEl.querySelector('#budgetCategoryColor').value = cat.color;
            containerEl.querySelector('#budgetCategoryIcon').value = cat.icon;
            containerEl.querySelector('#budgetCategoryDescription').value = cat.description || '';
            const colorOpt = colorGrid.querySelector(`[data-color="${cat.color}"]`);
            if (colorOpt) colorOpt.classList.add('selected');
            const iconOpt = iconGrid.querySelector(`[data-icon="${cat.icon}"]`);
            if (iconOpt) iconOpt.classList.add('selected');
        } else {
            containerEl.querySelector('#budgetCategoryModalTitle').textContent = 'Nueva categoría';
            containerEl.querySelector('#budgetCategoryId').value = '';
            containerEl.querySelector('#budgetCategoryName').value = '';
            containerEl.querySelector('#budgetCategoryParent').value = '';
            containerEl.querySelector('#budgetCategoryBudget').value = '';
            containerEl.querySelector('#budgetCategoryColor').value = COLORS[0];
            containerEl.querySelector('#budgetCategoryIcon').value = ICONS[0];
            containerEl.querySelector('#budgetCategoryDescription').value = '';
            colorGrid.querySelector('.budget-color-option').classList.add('selected');
            iconGrid.querySelector('.budget-icon-option').classList.add('selected');
        }

        form.classList.add('active');
    }

    function saveCategory() {
        const name = containerEl.querySelector('#budgetCategoryName').value.trim();
        const parent = containerEl.querySelector('#budgetCategoryParent').value;
        const id = containerEl.querySelector('#budgetCategoryId').value;

        containerEl.querySelectorAll('#budgetCategoryModal .budget-form-group').forEach(g => g.classList.remove('error'));

        let valid = true;
        if (!name) { containerEl.querySelector('#budgetCategoryName').closest('.budget-form-group').classList.add('error'); valid = false; }
        if (parent === id) { containerEl.querySelector('#budgetCategoryParent').closest('.budget-form-group').classList.add('error'); valid = false; }
        if (!valid) return;

        const budgetVal = containerEl.querySelector('#budgetCategoryBudget').value;
        const catData = {
            name,
            parentId: parent || null,
            color: containerEl.querySelector('#budgetCategoryColor').value,
            icon: containerEl.querySelector('#budgetCategoryIcon').value,
            description: containerEl.querySelector('#budgetCategoryDescription').value.trim(),
            budget: budgetVal === '' ? null : parseFloat(budgetVal),
            status: 'active'
        };

        if (id) {
            const cat = getCategoryById(id);
            Object.assign(cat, catData);
            App.addHistory('category_updated', name);
            App.showToast('Categoría actualizada');
        } else {
            catData.id = App.generateId('cat');
            catData.order = data().categories.filter(c => !c.parentId).length + 1;
            data().categories.push(catData);
            App.addHistory('category_created', name);
            App.showToast('Categoría creada');
        }

        App.saveData();
        containerEl.querySelector('#budgetCategoryModal').classList.remove('active');
        renderView(currentView);
    }

    // =========================================================
    // VISTA: CONFIGURACIÓN
    // =========================================================
    function renderConfiguracion() {
        const view = containerEl.querySelector('#budgetView-configuracion');
        const s = data().settings || {};

        view.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Configuración</div>
                        <div class="card-subtitle">Personaliza el comportamiento de la sección</div>
                    </div>
                </div>

                <div class="budget-config-section">
                    <h3><i class="fas fa-coins"></i> Presupuestos</h3>
                    <div class="budget-config-row">
                        <span class="label">Incluir gastos previstos en el cálculo</span>
                        <label class="budget-switch"><input type="checkbox" id="cfgIncludePlanned" ${s.includePlanned ? 'checked' : ''}><span class="budget-slider"></span></label>
                    </div>
                    <div class="budget-config-row">
                        <span class="label">Trasladar saldo no utilizado</span>
                        <label class="budget-switch"><input type="checkbox" id="cfgRollover" ${s.rollover ? 'checked' : ''}><span class="budget-slider"></span></label>
                    </div>
                </div>

                <div class="budget-config-section">
                    <h3><i class="fas fa-bell"></i> Alertas</h3>
                    <div class="budget-config-row">
                        <span class="label">Umbral de alerta amarilla</span>
                        <select class="budget-filter-select" id="cfgThresholdWarning">
                            <option value="70" ${s.thresholdWarning === 70 ? 'selected' : ''}>70%</option>
                            <option value="80" ${(s.thresholdWarning || 80) === 80 ? 'selected' : ''}>80%</option>
                            <option value="90" ${s.thresholdWarning === 90 ? 'selected' : ''}>90%</option>
                        </select>
                    </div>
                    <div class="budget-config-row">
                        <span class="label">Umbral de alerta roja</span>
                        <select class="budget-filter-select" id="cfgThresholdDanger">
                            <option value="90" ${s.thresholdDanger === 90 ? 'selected' : ''}>90%</option>
                            <option value="100" ${(s.thresholdDanger || 100) === 100 ? 'selected' : ''}>100%</option>
                        </select>
                    </div>
                    <div class="budget-config-row">
                        <span class="label">Alertar de gastos sin categorizar</span>
                        <label class="budget-switch"><input type="checkbox" id="cfgAlertUncategorized" ${s.alertUncategorized !== false ? 'checked' : ''}><span class="budget-slider"></span></label>
                    </div>
                    <div class="budget-config-row">
                        <span class="label">Alertar de categorías sin presupuesto</span>
                        <label class="budget-switch"><input type="checkbox" id="cfgAlertNoBudget" ${s.alertNoBudget !== false ? 'checked' : ''}><span class="budget-slider"></span></label>
                    </div>
                </div>

                <div class="budget-config-section">
                    <h3><i class="fas fa-palette"></i> Personalización del resumen</h3>
                    <div class="budget-config-row">
                        <span class="label">Mostrar tarjeta "Presupuesto total"</span>
                        <label class="budget-switch"><input type="checkbox" id="cfgShowBudgetCard" ${s.showBudgetCard !== false ? 'checked' : ''}><span class="budget-slider"></span></label>
                    </div>
                    <div class="budget-config-row">
                        <span class="label">Mostrar tarjeta "Gastos registrados"</span>
                        <label class="budget-switch"><input type="checkbox" id="cfgShowExpensesCard" ${s.showExpensesCard !== false ? 'checked' : ''}><span class="budget-slider"></span></label>
                    </div>
                    <div class="budget-config-row">
                        <span class="label">Mostrar tarjeta "Presupuesto restante"</span>
                        <label class="budget-switch"><input type="checkbox" id="cfgShowRemainingCard" ${s.showRemainingCard !== false ? 'checked' : ''}><span class="budget-slider"></span></label>
                    </div>
                    <div class="budget-config-row">
                        <span class="label">Mostrar tarjeta "Desviación"</span>
                        <label class="budget-switch"><input type="checkbox" id="cfgShowDeviationCard" ${s.showDeviationCard !== false ? 'checked' : ''}><span class="budget-slider"></span></label>
                    </div>
                    <div class="budget-config-row">
                        <span class="label">Número de gastos recientes</span>
                        <select class="budget-filter-select" id="cfgRecentCount">
                            <option value="3" ${s.recentCount === 3 ? 'selected' : ''}>3</option>
                            <option value="5" ${(s.recentCount || 5) === 5 ? 'selected' : ''}>5</option>
                            <option value="10" ${s.recentCount === 10 ? 'selected' : ''}>10</option>
                        </select>
                    </div>
                </div>

                <div class="budget-config-section">
                    <h3><i class="fas fa-database"></i> Datos y exportación</h3>
                    <div class="budget-config-row">
                        <span class="label">Exportar gastos a CSV</span>
                        <button class="btn btn-sm btn-secondary" id="cfgExportCsv"><i class="fas fa-file-csv"></i> Descargar CSV</button>
                    </div>
                    <div class="budget-config-row">
                        <span class="label">Exportar todos los datos a JSON</span>
                        <button class="btn btn-sm btn-secondary" id="cfgExportJson"><i class="fas fa-file-code"></i> Descargar JSON</button>
                    </div>
                    <div class="budget-config-row">
                        <span class="label">Restaurar datos de demostración</span>
                        <button class="btn btn-sm btn-danger" id="cfgResetData"><i class="fas fa-undo"></i> Restaurar</button>
                    </div>
                </div>
            </div>
        `;

        // Bind settings
        const settingsBindings = [
            ['cfgIncludePlanned', 'includePlanned', 'checked'],
            ['cfgRollover', 'rollover', 'checked'],
            ['cfgThresholdWarning', 'thresholdWarning', 'value', 'int'],
            ['cfgThresholdDanger', 'thresholdDanger', 'value', 'int'],
            ['cfgAlertUncategorized', 'alertUncategorized', 'checked'],
            ['cfgAlertNoBudget', 'alertNoBudget', 'checked'],
            ['cfgShowBudgetCard', 'showBudgetCard', 'checked'],
            ['cfgShowExpensesCard', 'showExpensesCard', 'checked'],
            ['cfgShowRemainingCard', 'showRemainingCard', 'checked'],
            ['cfgShowDeviationCard', 'showDeviationCard', 'checked'],
            ['cfgRecentCount', 'recentCount', 'value', 'int']
        ];

        settingsBindings.forEach(([uiId, key, prop, type]) => {
            const el = view.querySelector('#' + uiId);
            if (!el) return;
            el.addEventListener('change', () => {
                if (!data().settings) data().settings = {};
                let val = el[prop];
                if (type === 'int') val = parseInt(val);
                data().settings[key] = val;
                App.saveData();
                App.showToast('Configuración guardada');
            });
        });

        view.querySelector('#cfgExportCsv').addEventListener('click', exportExpenses);
        view.querySelector('#cfgExportJson').addEventListener('click', exportJson);
        view.querySelector('#cfgResetData').addEventListener('click', () => {
            App.showConfirm(
                'Restaurar datos',
                '¿Seguro que quieres restaurar los datos de demostración? Se perderán todos los cambios.',
                () => {
                    App.resetData();
                    renderView(currentView);
                    App.showToast('Datos restaurados');
                }
            );
        });
    }

    // =========================================================
    // FILTROS GLOBALES
    // =========================================================
    function applyFilters() {
        filters.search = containerEl.querySelector('#budgetFilterSearch').value;
        filters.categoryId = containerEl.querySelector('#budgetFilterCategory').value;
        filters.status = containerEl.querySelector('#budgetFilterStatus').value;
        filters.person = containerEl.querySelector('#budgetFilterPerson').value;
        filters.dateFrom = containerEl.querySelector('#budgetFilterDateFrom').value;
        filters.dateTo = containerEl.querySelector('#budgetFilterDateTo').value;
        renderActiveFilters();
        if (currentView === 'gastos') renderExpensesTable();
    }

    function clearFilters() {
        filters = { search: '', categoryId: '', status: '', person: '', dateFrom: '', dateTo: '', type: '' };
        containerEl.querySelector('#budgetFilterSearch').value = '';
        containerEl.querySelector('#budgetFilterCategory').value = '';
        containerEl.querySelector('#budgetFilterStatus').value = '';
        containerEl.querySelector('#budgetFilterPerson').value = '';
        containerEl.querySelector('#budgetFilterDateFrom').value = '';
        containerEl.querySelector('#budgetFilterDateTo').value = '';
        renderActiveFilters();
        if (currentView === 'gastos') renderExpensesTable();
    }

    function renderActiveFilters() {
        const container = containerEl.querySelector('#budgetActiveFilters');
        if (!container) return;
        const chips = [];
        if (filters.search) chips.push({ label: `Búsqueda: ${filters.search}`, key: 'search' });
        if (filters.categoryId) {
            const cat = getCategoryById(filters.categoryId);
            chips.push({ label: `Categoría: ${cat ? cat.name : 'Sin categorizar'}`, key: 'categoryId' });
        }
        if (filters.status) chips.push({ label: `Estado: ${filters.status}`, key: 'status' });
        if (filters.person) chips.push({ label: `Persona: ${filters.person}`, key: 'person' });
        if (filters.dateFrom) chips.push({ label: `Desde: ${App.formatDate(filters.dateFrom)}`, key: 'dateFrom' });
        if (filters.dateTo) chips.push({ label: `Hasta: ${App.formatDate(filters.dateTo)}`, key: 'dateTo' });

        container.innerHTML = chips.map(c =>
            `<span class="budget-filter-chip">${c.label}<button data-clear="${c.key}"><i class="fas fa-times"></i></button></span>`
        ).join('');

        container.querySelectorAll('[data-clear]').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.clear;
                filters[key] = '';
                const map = { search: 'budgetFilterSearch', categoryId: 'budgetFilterCategory', status: 'budgetFilterStatus', person: 'budgetFilterPerson', dateFrom: 'budgetFilterDateFrom', dateTo: 'budgetFilterDateTo' };
                const el = containerEl.querySelector('#' + map[key]);
                if (el) el.value = '';
                applyFilters();
            });
        });
    }

    // =========================================================
    // UTILIDADES
    // =========================================================
    function populateCategorySelect(select, selectedId = '') {
        const current = select.value || selectedId;
        let html = '<option value="">Sin categorizar</option>';
        data().categories.filter(c => c.status === 'active' && !c.parentId).sort((a, b) => a.order - b.order).forEach(cat => {
            html += `<option value="${cat.id}" ${cat.id === current ? 'selected' : ''}>${App.escapeHtml(cat.name)}</option>`;
            data().categories.filter(c => c.parentId === cat.id && c.status === 'active').sort((a, b) => a.order - b.order).forEach(sub => {
                html += `<option value="${sub.id}" ${sub.id === current ? 'selected' : ''}>&nbsp;&nbsp;↳ ${App.escapeHtml(sub.name)}</option>`;
            });
        });
        select.innerHTML = html;
        select.value = current;
    }

    function downloadFile(content, filename, mime) {
        const blob = new Blob(['\ufeff' + content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function exportExpenses() {
        const rows = [['Fecha', 'Concepto', 'Categoría', 'Importe', 'Persona', 'Estado', 'Tipo']];
        data().expenses.forEach(e => {
            const cat = getCategoryById(e.categoryId);
            rows.push([
                App.formatDate(e.date),
                e.concept,
                cat ? cat.name : '',
                e.amount.toFixed(2),
                App.getProfileName(e.person),
                e.status,
                e.type || 'individual'
            ]);
        });
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
        downloadFile(csv, 'gastos.csv', 'text/csv;charset=utf-8');
        App.showToast('CSV exportado');
    }

    function exportCategories() {
        const rows = [['Nombre', 'Color', 'Icono', 'Presupuesto', 'Estado']];
        data().categories.forEach(c => {
            rows.push([c.name, c.color, c.icon, c.budget || '', c.status]);
        });
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
        downloadFile(csv, 'categorias.csv', 'text/csv;charset=utf-8');
        App.showToast('Categorías exportadas');
    }

    function exportJson() {
        const json = JSON.stringify(data(), null, 2);
        downloadFile(json, 'finanzas-backup.json', 'application/json');
        App.showToast('JSON exportado');
    }

    // =========================================================
    // INIT
    // =========================================================
    function init() {
        // Cerrar dropdowns al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.budget-action-menu')) {
                containerEl && containerEl.querySelectorAll('.budget-action-dropdown.open').forEach(m => m.classList.remove('open'));
            }
        });

        // Poblar filtro global de categorías
        setTimeout(() => {
            const sel = containerEl && containerEl.querySelector('#budgetFilterCategory');
            if (sel) populateCategorySelect(sel, '');
        }, 50);
    }

    function onThemeChange() {
        if (currentView === 'pantalla') renderPantallaUnica();
    }

    // =========================================================
    // DASHBOARD INTERACTIVO — helpers de widget
    // =========================================================
    let selectedCardId = 'pc-rent';

    function pcWidgetTitle(icon, title, sub) {
        return `<div class="pcw-head"><div class="pcw-title">${icon} ${title}</div>${sub ? `<div class="pcw-sub">${sub}</div>` : ''}</div>`;
    }

    function pcMiniBar(gasto, presupuesto, color) {
        if (presupuesto === null || presupuesto === undefined || presupuesto <= 0) {
            return `<div class="pcw-bar"><div style="width:${gasto > 0 ? 100 : 0}%;background:${color};opacity:.45"></div></div><div class="pcw-foot"><span>Gasto: ${App.formatCurrency(gasto)}</span><span class="pcw-nodef">Presupuesto no definido</span></div>`;
        }
        const pct = Math.min((gasto / presupuesto) * 100, 100);
        const real = (gasto / presupuesto) * 100;
        const cls = real > 100 ? 'over' : real >= 85 ? 'warn' : '';
        return `<div class="pcw-bar"><div class="${cls}" style="width:${pct}%;background:${cls ? '' : color}"></div></div>
            <div class="pcw-foot"><span>${App.formatCurrency(gasto)} / ${App.formatCurrency(presupuesto)}</span><span class="${real > 100 ? 'pcw-over-txt' : ''}">${real.toFixed(0)}%${real > 100 ? ' ⚠' : ''}</span></div>`;
    }

    function pcCard(cat, inner, opts) {
        opts = opts || {};
        const sel = selectedCardId === cat.id ? 'selected' : '';
        return `<div class="pcw-card ${sel}" data-card-id="${cat.id}" tabindex="0" role="button" aria-pressed="${sel ? 'true' : 'false'}" style="--card-color:${cat.color || 'var(--primary)'}">
            <div class="pcw-head"><div class="pcw-title"><span class="pcw-ico">${cat.icon}</span> ${cat.name}${opts.badge ? ` <span class="pcw-badge">${opts.badge}</span>` : ''}</div>${pcChip(opts.budget !== undefined ? opts.budget : cat.budget, opts.gasto || 0)}</div>
            ${inner}
            <div class="pcw-hint"><i class="fas fa-chevron-down"></i> Ver detalle</div>
        </div>`;
    }

    // Gasto real por bloque de tarjeta
    function pcCardGasto(catId, period) {
        const expenses = pcRealExpenses(period);
        switch (catId) {
            case 'pc-rent':      return pcCatExpense('cat-3-1', period);
            case 'pc-utilities': return pcExpenseTotal(expenses.filter(e => ['cat-4-1','cat-4-2','cat-4-4'].includes(e.categoryId)));
            case 'pc-groceries': { const ids = getDescendantIds('cat-1').concat(getDescendantIds('cat-2'));
                                   return pcExpenseTotal(expenses.filter(e => ids.includes(e.categoryId) || !e.categoryId)); }
            case 'pc-loans':     return pcLoans().reduce((s,l) => s + l.paidInstallments * l.amountPerInstallment, 0);
            case 'pc-others':    { const ex = ['cat-3','cat-4'].flatMap(c => getDescendantIds(c)).concat(getDescendantIds('cat-1'), getDescendantIds('cat-2'));
                                   return pcExpenseTotal(expenses.filter(e => !ex.includes(e.categoryId))); }
            default:             return 0;
        }
    }
    function pcCardBudget(catId) {
        switch (catId) {
            case 'pc-rent':      return pcDefinedBudget('pc-rent');
            case 'pc-utilities': return pcDefinedBudget('pc-utilities');
            case 'pc-groceries': return pcWeeks().length ? pcWeeks().reduce((s,w)=>s+Number(w.budget||0),0) : null;
            case 'pc-loans':     return pcLoans().length ? pcLoans().reduce((s,l)=>s+l.totalInstallments*l.amountPerInstallment,0) : null;
            case 'pc-savings':   return null;
            case 'pc-others':    return pcDefinedBudget('pc-others');
            default:             return null;
        }
    }

    // SVG mini cash-flow: ingresos vs gastos por quincena del mes
    function pcCashflowSvg(income, expense) {
        const h1i = income/2, h2i = income/2, h1e = expense*0.45, h2e = expense*0.55;
        const max = Math.max(h1i, h2i, h1e, h2e, 1);
        const W = 260, H = 96, bw = 26, gap = 14;
        const y = v => H - 16 - (v/max)*(H-30);
        const bars = [
            { x: 20,           hh: y(h1i), c: '#10b981', t: 'In·Q1' },
            { x: 20+bw+gap,    hh: y(h1e), c: '#ef4444', t: 'Gas·Q1' },
            { x: 130,          hh: y(h2i), c: '#10b981', t: 'In·Q2' },
            { x: 130+bw+gap,   hh: y(h2e), c: '#ef4444', t: 'Gas·Q2' }
        ].map(b => `<rect x="${b.x}" y="${b.hh}" width="${bw}" height="${H-16-b.hh}" rx="4" fill="${b.c}" opacity=".85"/><text x="${b.x+bw/2}" y="${H-4}" text-anchor="middle" font-size="8.5" fill="#94a3b8">${b.t}</text>`).join('');
        return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">${bars}<line x1="0" y1="${H-16}" x2="${W}" y2="${H-16}" stroke="var(--border)" stroke-width="1"/></svg>`;
    }

    function personBadge(person) {
        const map = { ana: ['Nena', '#ec4899'], carlos: ['Bombón', '#2563eb'], conjunto: ['∞', 'var(--primary)'] };
        const [ini, col] = map[person] || ['?', 'var(--text-muted)'];
        const name = ({ana:'Nena',carlos:'Bombón',conjunto:'Conjunto'})[person] || person;
        return `<span class="pcw-avatar" style="background:${col}" title="${name}">${ini}</span>`;
    }

    function pcAlertsHtml(period) {
        const alerts = [];
        pcCats().forEach(c => {
            if (c.id === 'pc-savings') return;
            const b = pcCardBudget(c.id), g = pcCardGasto(c.id, period);
            if (b && b > 0) {
                const pct = (g/b)*100;
                if (pct > 100) alerts.push({ sev: 'red', txt: `${c.icon} ${c.name} al ${pct.toFixed(0)}% de su presupuesto`, over: true });
                else if (pct >= 85) alerts.push({ sev: 'amber', txt: `${c.icon} ${c.name} al ${pct.toFixed(0)}% de su presupuesto` });
            } else if (b === 0 && g > 0) {
                alerts.push({ sev: 'red', txt: `${c.icon} ${c.name}: fijado en 0,00 € con gasto registrado`, over: true });
            }
        });
        pcSubs('pc-utilities').forEach(s => {
            const ids = { 'pcs-electricity':'cat-4-1','pcs-water':'cat-4-2','pcs-phone':'cat-4-4' }[s.id];
            const g = pcExpenseTotal(pcRealExpenses(period).filter(e => e.categoryId === ids));
            if (s.budget > 0 && (g/s.budget)*100 >= 85) alerts.push({ sev: (g/s.budget)*100 > 100 ? 'red' : 'amber', txt: `${s.icon} ${s.name} al ${((g/s.budget)*100).toFixed(0)}% de su presupuesto` });
        });
        if (!alerts.length) alerts.push({ sev: 'ok', txt: '🟢 Todo bajo control: sin categorías por encima del 85%' });
        return alerts.map(a => `<div class="pcw-alert ${a.sev}"><i class="fas ${a.over ? 'fa-triangle-exclamation' : a.sev === 'ok' ? 'fa-circle-check' : 'fa-bell'}"></i><span>${a.txt}</span></div>`).join('');
    }

    function pcActivityHtml(period) {
        const list = getExpensesForPeriod(period, true).slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
        if (!list.length) return '<div class="pcw-empty">Sin movimientos registrados este periodo.</div>';
        return list.map(e => {
            const cat = getCategoryById(e.categoryId);
            return `<div class="pcw-act">
                ${personBadge(e.person)}
                <div class="pcw-act-main"><div class="pcw-act-concept">${App.escapeHtml(e.concept)}</div>
                <div class="pcw-act-meta">${App.formatDate(e.date)} · ${cat ? cat.icon + ' ' + cat.name : '📦 Sin categoría'}${e.status==='aportacion'?' · <em>aportación</em>':''}${e.status==='previsto'?' · <em>previsto</em>':''}</div></div>
                <strong class="pcw-act-amt" style="color:${e.status==='aportacion'?'var(--success)':'inherit'}">${App.formatCurrency(e.amount)}</strong>
            </div>`;
        }).join('');
    }

    // -------- Paneles de detalle (drill-down) --------
    function pcDetailRent() {
        const period = currentPeriod, rent = pcCats().find(c=>c.id==='pc-rent') || {budget:950};
        const pagado = pcCatExpense('cat-3-1', period);
        const previsto = getExpensesForPeriod(period, true).filter(e=>e.status==='previsto'&&e.categoryId==='cat-3-1').reduce((s,e)=>s+e.amount,0);
        return `<div class="pcw-detail-body">
            <div class="pcw-dgrid">
                <div><div class="pcw-dlabel">Importe fijo mensual</div><strong>${App.formatCurrency(rent.budget||950)}</strong></div>
                <div><div class="pcw-dlabel">Pagado desde MyInvestor</div><strong>${App.formatCurrency(pagado)}</strong></div>
                <div><div class="pcw-dlabel">Previsto</div><strong>${App.formatCurrency(previsto)}</strong></div>
            </div>
            ${pcBarHtml(pagado + previsto, rent.budget||950)}
            <button class="btn btn-sm btn-secondary pc-add" data-cat="pc-rent" data-default-cat="cat-3-1" style="margin-top:10px"><i class="fas fa-plus"></i> Registrar pago de renta</button>
        </div>`;
    }
    function pcDetailUtilities() {
        const period = currentPeriod;
        const mapCat = { 'pcs-electricity':'cat-4-1','pcs-water':'cat-4-2','pcs-phone':'cat-4-4' };
        const rows = pcSubs('pc-utilities').map(s => {
            const ids=[mapCat[s.id]];
            const gasto = pcExpenseTotal(pcRealExpenses(period).filter(e=>ids.includes(e.categoryId)));
            return `<div class="pc-row">
                <div>${s.icon} <strong>${s.name}</strong> <span class="pc-block-sub">· ${s.account}</span></div>
                ${pcBarHtml(gasto, s.budget)}
                <div>${App.formatCurrency(gasto)} / ${s.budget===null?'—':App.formatCurrency(s.budget)}</div>
                ${pcChip(s.budget, gasto)}
                <button class="btn btn-sm btn-secondary pc-add" data-cat="pc-utilities" data-default-cat="${ids[0]}"><i class="fas fa-plus"></i></button>
            </div>`;
        }).join('');
        return `<div class="pcw-detail-body">${rows}</div>`;
    }
    function pcDetailGroceries() {
        const today = new Date().toISOString().substring(0,10);
        const period = currentPeriod;
        const groceryIds = getDescendantIds('cat-1').concat(getDescendantIds('cat-2'));
        const weeks = pcWeeks().map(w => {
            const isCurrent = today>=w.start && today<=w.end;
            const g = pcExpenseTotal(pcRealExpenses(period).filter(e=>e.date>=w.start&&e.date<=w.end&&(groceryIds.includes(e.categoryId)||!e.categoryId)));
            return `<div class="pc-week ${isCurrent?'current':''}"><div class="pc-row" style="padding:0;border:none">
                <div><strong>${w.label}</strong> <span class="pc-block-sub">${fmtShortDate(w.start)} → ${fmtShortDate(w.end)}</span>${isCurrent?' <span class="pc-chip green">Actual</span>':''}</div>
                ${pcBarHtml(g,w.budget)}<div>${App.formatCurrency(g)} / ${App.formatCurrency(w.budget)}</div>
                <button class="btn btn-sm btn-secondary pc-add" data-cat="pc-groceries" data-default-cat=""><i class="fas fa-plus"></i></button></div></div>`;
        }).join('');
        return `<div class="pcw-detail-body"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span class="pc-block-sub">Semanas con rango de fechas personalizable · asignación por bloque (ej. 160 €/semana)</span><button class="btn btn-sm btn-secondary" id="pcEditWeeks"><i class="fas fa-calendar-week"></i> Editar semanas</button></div>${weeks||'<div class="pcw-empty">Define las semanas en «Editar semanas».</div>'}</div>`;
    }
    function pcDetailLoans() {
        const rows = pcLoans().map(l => {
            const pct=(l.paidInstallments/l.totalInstallments)*100, pend=(l.totalInstallments-l.paidInstallments)*l.amountPerInstallment;
            return `<div class="pc-row">
                <div><strong>${l.name}</strong> <span class="pc-loan-badge">${l.paidInstallments}/${l.totalInstallments}</span></div>
                <div class="pc-bar"><div class="${pct>=80?'ok':''}" style="width:${pct}%"></div></div>
                <div class="pc-block-sub">${App.formatCurrency(l.amountPerInstallment)}/cuota · Pendiente ${App.formatCurrency(pend)}</div>
                <button class="btn btn-sm btn-primary pc-pay-loan" data-id="${l.id}"><i class="fas fa-hand-holding-usd"></i> Pagar cuota</button>
            </div>`;
        }).join('');
        return `<div class="pcw-detail-body">${rows||'<div class="pcw-empty">Sin préstamos activos.</div>'}<div class="pc-block-sub" style="margin-top:8px">Al liquidar la última cuota el préstamo se archiva preservando su historial.</div></div>`;
    }
    function pcDetailSavings() {
        const aportes = getExpensesForPeriod(currentPeriod).filter(e=>e.status==='aportacion');
        const rows = pcSubs('pc-savings').map(s=>{
            const m = aportes.filter(a=>a.notes&&a.notes.includes(s.destination)).reduce((sum,a)=>sum+a.amount,0);
            return `<div class="pc-row"><div>${s.icon} <strong>${s.name}</strong></div><div>${m>0?App.formatCurrency(m):'<span class="pc-block-sub">Sin aportaciones este mes</span>'}</div></div>`;
        }).join('');
        return `<div class="pcw-detail-body">${rows}<div class="pc-block-sub" style="margin-top:8px">Las aportaciones a ahorro/inversión <strong>no computan como gasto</strong> (evita doble contabilización con el salario aportado).</div></div>`;
    }
    function pcDetailOthers() {
        const period = currentPeriod;
        const ex = ['cat-3','cat-4'].flatMap(c=>getDescendantIds(c)).concat(getDescendantIds('cat-1'),getDescendantIds('cat-2'));
        const list = pcRealExpenses(period).filter(e=>!ex.includes(e.categoryId)).slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
        const rows = list.map(e=>`<div class="pc-row"><div>${App.escapeHtml(e.concept)}</div><div class="pc-block-sub">${App.formatDate(e.date)}</div><strong>${App.formatCurrency(e.amount)}</strong></div>`).join('');
        return `<div class="pcw-detail-body">${rows||'<div class="pcw-empty">Sin imprevistos este periodo.</div>'}<button class="btn btn-sm btn-secondary pc-add" data-cat="pc-others" style="margin-top:8px"><i class="fas fa-plus"></i> Añadir gasto</button></div>`;
    }
    function pcDetailIncomes() {
        let totalSalario=0,totalLibre=0,totalAporte=0;
        pcIncomes().forEach(i=>{totalSalario+=i.salary;totalLibre+=i.salary*(i.freePct/100);totalAporte+=i.contribution;});
        const rows = pcIncomes().map(i=>{
            const libre=i.salary*(i.freePct/100);
            return `<div class="pc-row">
                <div><strong>${i.name}</strong> <span class="pc-block-sub">${App.formatCurrency(i.salary)}/mes</span></div>
                <div class="pc-chip green">${i.freePct}% libre · ${App.formatCurrency(libre)}</div>
                <div class="pc-block-sub">Aporte común: <strong>${App.formatCurrency(i.contribution)}</strong></div>
                <input type="number" class="pc-mini-input" min="0" step="50" value="${i.contribution}" data-inc="${i.id}" title="Editar aporte">
            </div>`;
        }).join('');
        const prop = pcIncomes().map(i=>App.formatCurrency(totalAporte*((i.salary*i.freePct/100)/totalLibre))).join(' / ');
        return `<div class="pcw-detail-body">${rows}<div class="pc-row" style="font-weight:600"><div>Distribución</div><div class="pc-block-sub">Equitativa (50/50): ${App.formatCurrency(totalAporte/2)}/persona · Proporcional al sueldo libre: ${prop}</div></div></div>`;
    }

    function pcRenderDetailPanel() {
        const panel = containerEl.querySelector('#pcDetailPanel');
        if (!panel) return;
        const meta = {
            'pc-rent':      ['🏠','Renta', pcDetailRent],
            'pc-utilities': ['💡','Utilities — Suministros (MyInvestor)', pcDetailUtilities],
            'pc-groceries': ['🛒','Groceries & Leisure — Desglose semanal', pcDetailGroceries],
            'pc-loans':     ['💳','Préstamos y Financiaciones — Cuotas', pcDetailLoans],
            'pc-savings':   ['💰','Savings — Ahorros e inversiones', pcDetailSavings],
            'pc-others':    ['📦','Others — Varios e imprevistos', pcDetailOthers],
            'pc-incomes':   ['👥','Ingresos de la pareja — Nena + Bombón', pcDetailIncomes]
        };
        const m = meta[selectedCardId];
        if (!m) { panel.classList.remove('open'); return; }
        panel.innerHTML = `<div class="pcw-detail-head"><h3>${m[0]} ${m[1]}</h3><button class="pcw-close" id="pcCloseDetail" aria-label="Cerrar"><i class="fas fa-times"></i></button></div>${m[2]()}`;
        panel.classList.add('open');
        // re-bind eventos dentro del panel
        panel.querySelectorAll('.pc-add').forEach(b=>b.addEventListener('click',()=>openExpenseModal()));
        panel.querySelectorAll('.pc-pay-loan').forEach(b=>b.addEventListener('click',()=>payLoanInstallment(b.dataset.id)));
        panel.querySelectorAll('[data-inc]').forEach(inp=>inp.addEventListener('change',(e)=>{
            const inc=pcIncomes().find(i=>i.id===e.target.dataset.inc);
            if(inc){inc.contribution=parseFloat(e.target.value)||0;App.saveData();renderPantallaUnica();App.showToast('Aporte actualizado','success');}
        }));
        const eb=panel.querySelector('#pcEditWeeks'); if(eb) eb.addEventListener('click',openWeeksEditor);
        const cb=panel.querySelector('#pcCloseDetail'); if(cb) cb.addEventListener('click',()=>{selectedCardId=null;panel.classList.remove('open');containerEl.querySelectorAll('.pcw-card.selected').forEach(c=>c.classList.remove('selected'));});
    }

    // =========================================================
    // PANTALLA ÚNICA — Dashboard consolidado del presupuesto común
    // =========================================================
    function renderPantallaUnica() {
        const view = containerEl.querySelector('#budgetView-pantalla');
        const period = currentPeriod;
        const expenses = pcRealExpenses(period);

        // ---- KPIs superiores ----
        let totalBudget = 0, anyDefined = false;
        pcCats().forEach(c => { const b = pcDefinedBudget(c.id); if (b !== null) { totalBudget += b; anyDefined = true; } });
        const totalExpense = pcExpenseTotal(expenses);
        const remaining = anyDefined ? totalBudget - totalExpense : null;
        const deviation = anyDefined ? totalExpense - totalBudget : null;
        const incomes = pcIncomes();
        const totalIncome = incomes.reduce((s,i)=>s+i.salary,0);
        const aportesMes = getExpensesForPeriod(period).filter(e=>e.status==='aportacion').reduce((s,e)=>s+e.amount,0);
        const nena = incomes.find(i=>i.name==='Nena'), bombon = incomes.find(i=>i.name==='Bombón');
        const pctN = totalIncome&&nena ? ((nena.salary/totalIncome)*100).toFixed(0) : '50';
        const pctB = totalIncome&&bombon ? ((bombon.salary/totalIncome)*100).toFixed(0) : '50';

        const kpis = `
            <div class="pcw-topbar">
                <div class="pcw-kpi big"><div class="pcw-klabel">💶 Saldo restante total</div>
                    <div class="pcw-kvalue" style="color:${remaining===null?'var(--text-muted)':remaining>=0?'var(--success)':'var(--danger)'}">${remaining===null?'—':App.formatCurrency(remaining)}</div>
                    <div class="pcw-kmeta">Presupuesto definido ${anyDefined?App.formatCurrency(totalBudget):'—'} − Gastos ${App.formatCurrency(totalExpense)}</div></div>
                <div class="pcw-kpi"><div class="pcw-klabel">📥 Ingresos totales</div>
                    <div class="pcw-kvalue">${App.formatCurrency(totalIncome)}</div>
                    <div class="pcw-split"><span style="color:#ec4899">Nena ${pctN}%</span><span style="color:#2563eb">Bombón ${pctB}%</span></div></div>
                <div class="pcw-kpi"><div class="pcw-klabel">📤 Gastos totales acumulados</div>
                    <div class="pcw-kvalue" style="color:var(--danger)">${App.formatCurrency(totalExpense)}</div>
                    <div class="pcw-kmeta">${expenses.length} movimientos · Desviación: <strong style="color:${deviation===null?'inherit':deviation>0?'var(--danger)':'var(--success)'}">${deviation===null?'—':(deviation>0?'+':'')+App.formatCurrency(deviation)}</strong></div></div>
                <div class="pcw-kpi chart"><div class="pcw-klabel">📊 Cash flow del mes</div>${pcCashflowSvg(totalIncome, totalExpense)}
                    <div class="pcw-kmeta">Aportado a ahorro: ${App.formatCurrency(aportesMes)}</div></div>
            </div>`;

        // ---- Grid central de tarjetas (clic => drill-down) ----
        const cats = pcCats();
        const cardMeta = {
            'pc-rent':      { sub:'MyInvestor · fijo mensual', badge:'' },
            'pc-utilities': { sub:'⚡ Luz · 💧 Agua · 📶 Lowi', badge:'' },
            'pc-groceries': { sub:'Presupuesto semanal dinámico', badge: pcWeeks().length + ' sem' },
            'pc-loans':     { sub: pcLoans().map(l=>`${l.name} ${l.paidInstallments}/${l.totalInstallments}`).join(' · '), badge:'' },
            'pc-savings':   { sub:'TradeRepublic · MyInvestor · Ahorro', badge:'' },
            'pc-others':    { sub:'Varios e imprevistos', badge:'' }
        };
        const colors = { 'pc-rent':'#6366f1','pc-utilities':'#f59e0b','pc-groceries':'#10b981','pc-loans':'#ef4444','pc-savings':'#8b5cf6','pc-others':'#64748b' };
        let cardsHtml = '';
        cats.forEach(c => {
            const g = pcCardGasto(c.id, period), b = pcCardBudget(c.id), m = cardMeta[c.id] || {};
            const inner = `${pcMiniBar(g, b, colors[c.id]||'var(--primary)')}<div class="pcw-card-sub">${m.sub||''}</div>`;
            cardsHtml += pcCard({ ...c, color: colors[c.id] }, inner, { budget: b, gasto: g, badge: m.badge });
        });
        // tarjeta ingresos
        const totalLibre = incomes.reduce((s,i)=>s+i.salary*(i.freePct/100),0);
        const incCard = `<div class="pcw-card ${selectedCardId==='pc-incomes'?'selected':''}" data-card-id="pc-incomes" tabindex="0" role="button" style="--card-color:#0ea5e9">
            <div class="pcw-head"><div class="pcw-title"><span class="pcw-ico">👥</span> Ingresos pareja</div><span class="pc-chip gray">${totalLibre?((totalLibre/totalIncome)*100).toFixed(0):0}% libre</span></div>
            <div class="pcw-foot"><span>Nena ${nena?App.formatCurrency(nena.salary):'—'}</span><span>Bombón ${bombon?App.formatCurrency(bombon.salary):'—'}</span></div>
            <div class="pcw-hint"><i class="fas fa-chevron-down"></i> Ver detalle</div></div>`;

        const grid = `<div class="pcw-grid">${cardsHtml}${incCard}</div>`;

        // ---- Panel de detalle (drill-down animado) ----
        const detail = `<div class="pcw-detail" id="pcDetailPanel"></div>`;

        // ---- Sidebar derecho: actividad + alertas ----
        const sidebar = `<aside class="pcw-sidebar">
            <section class="pcw-widget"><div class="pcw-whead">🔔 Spending Alerts</div>${pcAlertsHtml(period)}</section>
            <section class="pcw-widget"><div class="pcw-whead">🕘 Actividad reciente</div><div class="pcw-acts">${pcActivityHtml(period)}</div></section>
        </aside>`;

        view.innerHTML = kpis + `<div class="pcw-layout"><div>${grid}${detail}</div>${sidebar}</div>`;

        pcRenderDetailPanel();

        // Eventos: selección de tarjetas
        view.querySelectorAll('.pcw-card').forEach(card => {
            const activate = () => {
                selectedCardId = card.dataset.cardId;
                view.querySelectorAll('.pcw-card').forEach(c => c.classList.toggle('selected', c === card));
                pcRenderDetailPanel();
                document.getElementById('pcDetailPanel') && document.getElementById('pcDetailPanel').scrollIntoView({ behavior:'smooth', block:'nearest' });
            };
            card.addEventListener('click', activate);
            card.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); activate(); } });
        });
    }

    function payLoanInstallment(loanId) {
        const loan = pcLoans().find(l => l.id === loanId);
        if (!loan) return;
        if (loan.paidInstallments >= loan.totalInstallments) { App.showToast('Préstamo ya liquidado', 'info'); return; }
        loan.paidInstallments += 1;
        data().expenses.unshift({
            id: App.generateId(), concept: `Cuota ${loan.name} (${loan.paidInstallments}/${loan.totalInstallments})`,
            amount: loan.amountPerInstallment, date: new Date().toISOString().substring(0,10),
            categoryId: 'cat-7', person: 'conjunto', status: 'registrado', type: 'individual', notes: 'Préstamo/financiación'
        });
        if (loan.paidInstallments === loan.totalInstallments) {
            loan.status = 'archived';
            App.addHistory('loan_finished', `Préstamo ${loan.name} liquidado — archivado con historial preservado`);
            App.showToast(`${loan.name} liquidado ✔ (archivado)`, 'success');
        } else {
            App.addHistory('loan_payment', `Cuota ${loan.paidInstallments}/${loan.totalInstallments} de ${loan.name}`);
            App.showToast(`Cuota de ${loan.name} registrada`, 'success');
        }
        App.saveData();
        renderPantallaUnica();
    }

    function openWeeksEditor() {
        const modal = containerEl.querySelector('#budgetCategoryDetailModal');
        const weeks = pcWeeks();
        let html = `<p class="pc-block-sub" style="margin-bottom:12px">Define el rango de fechas y el presupuesto de cada semana. Los cambios se guardan automáticamente al cerrar.</p>`;
        weeks.forEach((w, idx) => {
            html += `<div class="pc-row" data-widx="${idx}">
                <strong>${w.label}</strong>
                <label class="pc-block-sub">Desde <input type="date" class="pc-mini-input" data-f="start" value="${w.start}" style="width:140px"></label>
                <label class="pc-block-sub">Hasta <input type="date" class="pc-mini-input" data-f="end" value="${w.end}" style="width:140px"></label>
                <label class="pc-block-sub">Presup. <input type="number" min="0" step="5" class="pc-mini-input" data-f="budget" value="${w.budget}"></label>
                <button class="btn btn-sm btn-danger pc-del-week" data-id="${w.id}"><i class="fas fa-trash"></i></button>
            </div>`;
        });
        html += `<button class="btn btn-sm btn-secondary" id="pcAddWeek" style="margin-top:10px"><i class="fas fa-plus"></i> Añadir semana</button>`;
        containerEl.querySelector('#budgetCategoryDetailTitle').textContent = '🛒 Semanas de Groceries & Leisure';
        containerEl.querySelector('#budgetCategoryDetailBody').innerHTML = html;
        modal.classList.add('active');

        const body = containerEl.querySelector('#budgetCategoryDetailBody');
        body.querySelector('#pcAddWeek').addEventListener('click', () => {
            const last = weeks[weeks.length - 1];
            const nextStart = last ? new Date(new Date(last.end).getTime() + 86400000) : new Date();
            const nextEnd = new Date(nextStart.getTime() + 6 * 86400000);
            data().pcWeeks.push({ id: App.generateId(), label: `Semana ${weeks.length + 1}`,
                start: nextStart.toISOString().substring(0,10), end: nextEnd.toISOString().substring(0,10), budget: 160 });
            App.saveData(); openWeeksEditor();
        });
        body.querySelectorAll('.pc-del-week').forEach(b => b.addEventListener('click', () => {
            const arr = data().pcWeeks;
            const i = arr.findIndex(w => w.id === b.dataset.id);
            if (i >= 0) { const [removed] = arr.splice(i, 1); App.addHistory('week_removed', `Semana eliminada: ${removed.label} (${removed.start}→${removed.end})`); }
            App.saveData(); openWeeksEditor();
        }));
        modal.querySelectorAll('[data-close-budget-modal], .budget-modal-close').forEach(b => {
            b.addEventListener('click', function saveOnce() {
                body.querySelectorAll('.pc-row[data-widx]').forEach(row => {
                    const w = weeks[parseInt(row.dataset.widx)];
                    row.querySelectorAll('[data-f]').forEach(inp => {
                        const f = inp.dataset.f;
                        w[f] = f === 'budget' ? (parseFloat(inp.value) || 0) : inp.value;
                    });
                });
                App.saveData(); renderPantallaUnica();
                b.removeEventListener('click', saveOnce);
            }, { once: false });
        });
    }


    // =========================================================
    // API PÚBLICA
    // =========================================================
    return {
        render,
        init,
        onThemeChange,
        openExpenseModal,
        openCategoryModal
    };
})();

// Registrar sección
App.registerSection('presupuesto-comun', {
    render: (container) => BudgetApp.render(container),
    init: () => BudgetApp.init(),
    onThemeChange: () => BudgetApp.onThemeChange()
});

window.BudgetApp = BudgetApp;