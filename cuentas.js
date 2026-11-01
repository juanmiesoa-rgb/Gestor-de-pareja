/* =============================================================
   CUENTAS.JS
   Sección completa con 5 vistas:
   - Resumen (indicadores, tarjetas, gráfico, avisos)
   - Mis cuentas (CRUD, tipos, titularidad)
   - Movimientos (filtros, transferencias, ajustes)
   - Conciliación (saldo manual vs estimado)
   - Configuración
   ============================================================= */
const AccountsApp = (function () {
    'use strict';

    // =========================================================
    // ESTILOS ESPECÍFICOS
    // =========================================================
    function injectStyles() {
        if (document.getElementById('accounts-styles')) return;
        const style = document.createElement('style');
        style.id = 'accounts-styles';
        style.textContent = `
            /* Sub-navegación */
            .acc-subnav {
                display: flex; gap: 4px;
                border-bottom: 1px solid var(--border);
                margin-bottom: 24px;
                overflow-x: auto;
            }
            .acc-subnav-item {
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
            .acc-subnav-item:hover { color: var(--text); }
            .acc-subnav-item.active { color: var(--primary); border-bottom-color: var(--primary); }

            .acc-subview { display: none; }
            .acc-subview.active { display: block; }

            /* Stats */
            .acc-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 20px; }
            @media (max-width: 1200px) { .acc-stats { grid-template-columns: repeat(3, 1fr); } }
            @media (max-width: 768px) { .acc-stats { grid-template-columns: repeat(2, 1fr); } }
            @media (max-width: 480px) { .acc-stats { grid-template-columns: 1fr; } }

            .acc-stat {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 16px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .acc-stat:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
            .acc-stat-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
            .acc-stat-icon {
                width: 34px; height: 34px; border-radius: 10px;
                display: flex; align-items: center; justify-content: center;
                font-size: 15px;
            }
            .acc-stat-label { font-size: 11px; color: var(--text-secondary); font-weight: 500; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.3px; }
            .acc-stat-value { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
            .acc-stat-meta { font-size: 11px; color: var(--text-muted); }

            /* Account cards */
            .acc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }

            .acc-card {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                overflow: hidden;
                transition: all 0.2s;
                cursor: pointer;
                position: relative;
            }
            .acc-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
            .acc-card-banner {
                height: 70px;
                background: linear-gradient(135deg, var(--acc-color, var(--primary)), var(--acc-color-end, #7c3aed));
                position: relative;
                display: flex;
                align-items: center;
                padding: 14px;
                color: white;
            }
            .acc-card-banner::before {
                content: ''; position: absolute; inset: 0;
                background: linear-gradient(to top, rgba(0,0,0,0.3), transparent);
            }
            .acc-card-banner-content { position: relative; z-index: 1; display: flex; align-items: center; gap: 10px; width: 100%; }
            .acc-card-icon {
                width: 40px; height: 40px; border-radius: 10px;
                background: rgba(255,255,255,0.2);
                display: flex; align-items: center; justify-content: center;
                font-size: 18px;
            }
            .acc-card-name { font-size: 16px; font-weight: 700; flex: 1; }
            .acc-card-entity { font-size: 11px; opacity: 0.9; }
            .acc-card-badges {
                position: absolute; top: 10px; right: 10px;
                z-index: 1;
                display: flex; gap: 4px;
            }
            .acc-card-body { padding: 14px; }
            .acc-card-balances {
                display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
                margin-bottom: 12px;
            }
            .acc-balance-box {
                padding: 10px;
                background: var(--border-light);
                border-radius: var(--radius-sm);
            }
            .acc-balance-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px; }
            .acc-balance-value { font-size: 16px; font-weight: 700; }
            .acc-balance-value.positive { color: var(--success); }
            .acc-balance-value.negative { color: var(--danger); }
            .acc-balance-date { font-size: 10px; color: var(--text-muted); margin-top: 2px; }
            .acc-card-diff {
                padding: 8px 10px;
                border-radius: var(--radius-sm);
                font-size: 12px;
                margin-bottom: 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .acc-card-diff.ok { background: var(--success-light); color: var(--success); }
            .acc-card-diff.warning { background: var(--warning-light); color: var(--warning); }
            .acc-card-diff.danger { background: var(--danger-light); color: var(--danger); }
            .acc-card-diff.neutral { background: var(--border-light); color: var(--text-muted); }
            .acc-card-meta {
                display: flex; justify-content: space-between;
                font-size: 11px; color: var(--text-muted);
                padding-top: 10px;
                border-top: 1px solid var(--border-light);
            }
            .acc-card-actions {
                display: flex; gap: 6px; margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid var(--border-light);
            }
            .acc-card-actions .btn { flex: 1; justify-content: center; font-size: 11px; padding: 6px 8px; }

            /* Tables */
            .acc-table-wrap { overflow-x: auto; }
            .acc-table { width: 100%; border-collapse: collapse; font-size: 13px; }
            .acc-table th {
                text-align: left; padding: 10px 12px;
                font-size: 11px; font-weight: 600;
                color: var(--text-muted);
                text-transform: uppercase; letter-spacing: 0.5px;
                border-bottom: 1px solid var(--border);
                background: var(--bg-card);
                cursor: pointer; user-select: none;
            }
            .acc-table th:hover { color: var(--text); }
            .acc-table td {
                padding: 12px;
                border-bottom: 1px solid var(--border-light);
                vertical-align: middle;
            }
            .acc-table tr:hover td { background: var(--border-light); }
            .acc-table .amount { font-weight: 600; font-variant-numeric: tabular-nums; }
            .acc-table .amount.positive { color: var(--success); }
            .acc-table .amount.negative { color: var(--danger); }
            .acc-table .amount.neutral { color: var(--text-muted); }

            /* Filters */
            .acc-filters-bar {
                display: flex; gap: 8px; margin-bottom: 16px;
                flex-wrap: wrap; align-items: center;
            }
            .acc-search-box { position: relative; flex: 1; min-width: 200px; max-width: 320px; }
            .acc-search-box i {
                position: absolute; left: 12px; top: 50%;
                transform: translateY(-50%);
                color: var(--text-muted); font-size: 13px;
            }
            .acc-search-box input {
                width: 100%; padding: 9px 12px 9px 36px;
                border: 1px solid var(--border); border-radius: var(--radius-sm);
                background: var(--bg-card); color: var(--text);
                font-size: 13px; font-family: inherit;
            }
            .acc-search-box input:focus { outline: none; border-color: var(--primary); }

            .acc-filter-select {
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
            .acc-chart-container { position: relative; height: 280px; margin-top: 8px; }

            /* Alerts */
            .acc-alert-list { display: flex; flex-direction: column; gap: 8px; }
            .acc-alert-item {
                display: flex; align-items: flex-start; gap: 12px;
                padding: 12px;
                border-radius: var(--radius-sm);
                border-left: 3px solid;
            }
            .acc-alert-item.warning { border-color: var(--warning); background: var(--warning-light); }
            .acc-alert-item.danger { border-color: var(--danger); background: var(--danger-light); }
            .acc-alert-item.info { border-color: var(--info); background: var(--info-light); }
            .acc-alert-item.success { border-color: var(--success); background: var(--success-light); }
            .acc-alert-icon {
                width: 32px; height: 32px; border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                flex-shrink: 0; background: rgba(255,255,255,0.6);
            }
            .acc-alert-content { flex: 1; }
            .acc-alert-title { font-size: 13px; font-weight: 600; margin-bottom: 2px; }
            .acc-alert-desc { font-size: 12px; color: var(--text-secondary); }
            .acc-alert-action {
                background: none; border: none;
                color: var(--primary);
                font-size: 12px; font-weight: 500;
                cursor: pointer; padding: 4px 0;
                font-family: inherit;
            }

            /* Forms */
            .acc-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
            .acc-form-row.single { grid-template-columns: 1fr; }
            .acc-form-row.three { grid-template-columns: repeat(3, 1fr); }
            @media (max-width: 768px) {
                .acc-form-row, .acc-form-row.three { grid-template-columns: 1fr; }
            }

            .acc-form-group { margin-bottom: 14px; }
            .acc-form-label {
                display: block; font-size: 12px; font-weight: 500;
                color: var(--text-secondary); margin-bottom: 6px;
            }
            .acc-form-input, .acc-form-select, .acc-form-textarea {
                width: 100%; padding: 9px 12px;
                border: 1px solid var(--border); border-radius: var(--radius-sm);
                background: var(--bg-card); color: var(--text);
                font-size: 13px; font-family: inherit;
            }
            .acc-form-input:focus, .acc-form-select:focus, .acc-form-textarea:focus {
                outline: none; border-color: var(--primary);
            }
            .acc-form-textarea { resize: vertical; min-height: 70px; }
            .acc-form-error { font-size: 11px; color: var(--danger); margin-top: 4px; display: none; }
            .acc-form-group.error .acc-form-input,
            .acc-form-group.error .acc-form-select { border-color: var(--danger); }
            .acc-form-group.error .acc-form-error { display: block; }
            .acc-form-hint { font-size: 11px; color: var(--text-muted); margin-top: 4px; }

            /* Modal */
            .acc-modal {
                display: none; position: fixed; inset: 0;
                background: rgba(0,0,0,0.5); z-index: 1000;
                align-items: center; justify-content: center;
                padding: 20px;
            }
            .acc-modal.active { display: flex; }
            .acc-modal-content {
                background: var(--bg-card); border-radius: var(--radius-lg);
                max-width: 700px; width: 100%;
                max-height: 90vh; overflow-y: auto;
                box-shadow: var(--shadow-md);
            }
            .acc-modal-header {
                padding: 20px; border-bottom: 1px solid var(--border);
                display: flex; justify-content: space-between; align-items: center;
                position: sticky; top: 0; background: var(--bg-card); z-index: 1;
            }
            .acc-modal-title { font-size: 16px; font-weight: 600; }
            .acc-modal-close {
                background: none; border: none;
                color: var(--text-muted); cursor: pointer;
                font-size: 18px; padding: 4px;
            }
            .acc-modal-body { padding: 20px; }
            .acc-modal-footer {
                padding: 16px 20px; border-top: 1px solid var(--border);
                display: flex; justify-content: flex-end; gap: 8px;
                position: sticky; bottom: 0; background: var(--bg-card);
            }

            /* Section title */
            .acc-section-title {
                font-size: 13px; font-weight: 600;
                text-transform: uppercase; letter-spacing: 0.5px;
                color: var(--text-muted);
                margin: 20px 0 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--border);
            }

            /* Empty */
            .acc-empty {
                text-align: center; padding: 40px 20px;
                color: var(--text-muted);
            }
            .acc-empty i { font-size: 40px; margin-bottom: 12px; opacity: 0.5; }
            .acc-empty h3 { font-size: 15px; color: var(--text); margin-bottom: 6px; }
            .acc-empty p { font-size: 13px; margin-bottom: 16px; }

            /* Color picker */
            .acc-color-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; margin-top: 6px; }
            .acc-color-option {
                width: 28px; height: 28px; border-radius: 6px;
                cursor: pointer; border: 2px solid transparent;
                transition: all 0.15s;
            }
            .acc-color-option:hover { transform: scale(1.1); }
            .acc-color-option.selected { border-color: var(--text); }

            /* Config */
            .acc-config-section { margin-bottom: 24px; }
            .acc-config-section h3 {
                font-size: 14px; font-weight: 600;
                margin-bottom: 12px; padding-bottom: 8px;
                border-bottom: 1px solid var(--border);
                display: flex; align-items: center; gap: 8px;
            }
            .acc-config-row {
                display: flex; justify-content: space-between; align-items: center;
                padding: 10px 0;
                border-bottom: 1px solid var(--border-light);
                font-size: 13px;
                gap: 12px;
            }
            .acc-config-row:last-child { border-bottom: none; }
            .acc-config-row .label { color: var(--text-secondary); flex: 1; }

            /* Switch */
            .acc-switch { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; }
            .acc-switch input { opacity: 0; width: 0; height: 0; }
            .acc-slider {
                position: absolute; cursor: pointer; inset: 0;
                background: var(--border); border-radius: 20px;
                transition: 0.2s;
            }
            .acc-slider:before {
                position: absolute; content: "";
                height: 14px; width: 14px; left: 3px; bottom: 3px;
                background: white; border-radius: 50%;
                transition: 0.2s;
            }
            .acc-switch input:checked + .acc-slider { background: var(--primary); }
            .acc-switch input:checked + .acc-slider:before { transform: translateX(16px); }

            /* Action menu */
            .acc-action-menu { position: relative; display: inline-block; }
            .acc-action-dropdown {
                display: none;
                position: absolute; right: 0; top: 100%;
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                box-shadow: var(--shadow-md);
                min-width: 180px;
                z-index: 50; padding: 4px;
            }
            .acc-action-dropdown.open { display: block; }
            .acc-action-dropdown button {
                display: flex; align-items: center; gap: 8px;
                width: 100%; padding: 8px 10px;
                background: none; border: none;
                color: var(--text); font-size: 13px;
                cursor: pointer; border-radius: 4px;
                text-align: left; font-family: inherit;
            }
            .acc-action-dropdown button:hover { background: var(--border-light); }
            .acc-action-dropdown button.danger { color: var(--danger); }
            .acc-action-dropdown button i { width: 14px; color: var(--text-muted); }
            .acc-action-dropdown button.danger i { color: var(--danger); }

            /* Mobile */
            .acc-table-desktop { display: block; }
            .acc-table-mobile { display: none; }
            @media (max-width: 768px) {
                .acc-table-desktop { display: none; }
                .acc-table-mobile { display: block; }
            }
            .acc-mobile-card {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 14px;
                margin-bottom: 10px;
            }
            .acc-mobile-card-head {
                display: flex; justify-content: space-between; align-items: flex-start;
                margin-bottom: 10px; gap: 8px;
            }
            .acc-mobile-card-row {
                display: flex; justify-content: space-between;
                font-size: 12px; padding: 4px 0;
            }
            .acc-mobile-card-row .lbl { color: var(--text-muted); }
            .acc-mobile-card-row .val { font-weight: 500; }

            /* Timeline */
            .acc-timeline { position: relative; padding-left: 24px; }
            .acc-timeline::before {
                content: ''; position: absolute; left: 8px; top: 0; bottom: 0;
                width: 2px; background: var(--border);
            }
            .acc-timeline-item {
                position: relative; padding-bottom: 12px;
            }
            .acc-timeline-item::before {
                content: ''; position: absolute; left: -20px; top: 4px;
                width: 12px; height: 12px; border-radius: 50%;
                background: var(--primary);
                border: 2px solid var(--bg-card);
                box-shadow: 0 0 0 2px var(--primary);
            }
            .acc-timeline-content {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                padding: 10px 12px;
                font-size: 13px;
            }

            /* Conciliation */
            .conc-card {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 16px;
                margin-bottom: 12px;
            }
            .conc-header {
                display: flex; justify-content: space-between; align-items: center;
                margin-bottom: 12px;
                padding-bottom: 12px;
                border-bottom: 1px solid var(--border-light);
            }
            .conc-title { font-weight: 600; font-size: 15px; }
            .conc-grid {
                display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
                margin-bottom: 12px;
            }
            @media (max-width: 768px) { .conc-grid { grid-template-columns: repeat(2, 1fr); } }
            .conc-box {
                padding: 10px;
                background: var(--border-light);
                border-radius: var(--radius-sm);
            }
            .conc-box-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 2px; }
            .conc-box-value { font-size: 16px; font-weight: 700; }
        `;
        document.head.appendChild(style);
    }

    // =========================================================
    // DATOS POR DEFECTO
    // =========================================================
    const DEFAULT_ACCOUNTS_DATA = {
        accounts: [
            {
                id: 'acc-trade1',
                name: 'Trade Republic 1',
                entity: 'Trade Republic',
                type: 'corriente',
                ownership: 'shared',
                owner: 'conjunto',
                currency: 'EUR',
                color: '#2563eb',
                colorEnd: '#1d4ed8',
                icon: 'fas fa-credit-card',
                status: 'active',
                openingDate: '2023-03-15',
                referenceBalance: 2500.00,
                referenceDate: '2026-09-30',
                manualBalance: 3450.80,
                manualBalanceDate: '2026-10-28',
                notes: 'Cuenta principal para gastos comunes y compras con tarjeta.',
                isLiquid: true
            },
            {
                id: 'acc-myinvestor',
                name: 'MyInvestor Ahorro',
                entity: 'MyInvestor',
                type: 'ahorro',
                ownership: 'shared',
                owner: 'conjunto',
                currency: 'EUR',
                color: '#10b981',
                colorEnd: '#059669',
                icon: 'fas fa-piggy-bank',
                status: 'active',
                openingDate: '2024-01-10',
                referenceBalance: 1200.00,
                referenceDate: '2026-09-30',
                manualBalance: 1820.50,
                manualBalanceDate: '2026-10-25',
                notes: 'Cuenta de ahorro compartida.',
                isLiquid: true
            },
            {
                id: 'acc-trade2',
                name: 'Trade Republic 2',
                entity: 'Trade Republic',
                type: 'corriente',
                ownership: 'shared',
                owner: 'conjunto',
                currency: 'EUR',
                color: '#8b5cf6',
                colorEnd: '#7c3aed',
                icon: 'fas fa-university',
                status: 'pending',
                openingDate: '',
                referenceBalance: null,
                referenceDate: '',
                manualBalance: null,
                manualBalanceDate: '',
                notes: 'Cuenta futura, pendiente de activar y configurar.',
                isLiquid: true
            },
            {
                id: 'acc-ana',
                name: 'Cuenta personal Ana',
                entity: 'BBVA',
                type: 'corriente',
                ownership: 'individual',
                owner: 'ana',
                currency: 'EUR',
                color: '#ec4899',
                colorEnd: '#db2777',
                icon: 'fas fa-user',
                status: 'active',
                openingDate: '2020-05-20',
                referenceBalance: 1500.00,
                referenceDate: '2026-09-30',
                manualBalance: 1820.50,
                manualBalanceDate: '2026-10-27',
                notes: 'Cuenta personal de Ana.',
                isLiquid: true
            },
            {
                id: 'acc-carlos',
                name: 'Cuenta personal Carlos',
                entity: 'Santander',
                type: 'corriente',
                ownership: 'individual',
                owner: 'carlos',
                currency: 'EUR',
                color: '#f59e0b',
                colorEnd: '#d97706',
                icon: 'fas fa-user',
                status: 'active',
                openingDate: '2019-09-01',
                referenceBalance: 2000.00,
                referenceDate: '2026-09-30',
                manualBalance: null,
                manualBalanceDate: '',
                notes: 'Cuenta personal de Carlos. Sin saldo manual actualizado.',
                isLiquid: true
            }
        ],
        accountTypes: [
            { id: 'corriente', name: 'Cuenta corriente', icon: 'fas fa-credit-card' },
            { id: 'remunerada', name: 'Cuenta remunerada', icon: 'fas fa-percentage' },
            { id: 'ahorro', name: 'Cuenta de ahorro', icon: 'fas fa-piggy-bank' },
            { id: 'inversion', name: 'Cuenta de inversión', icon: 'fas fa-chart-line' },
            { id: 'efectivo', name: 'Efectivo', icon: 'fas fa-money-bill-wave' },
            { id: 'otra', name: 'Otra', icon: 'fas fa-wallet' }
        ],
        movements: [
            // Movimientos de Trade Republic 1
            { id: 'mv-1', accountId: 'acc-trade1', date: '2026-10-30', concept: 'Mercado San Miguel', amount: -42.80, type: 'gasto', categoryId: 'cat-1-2', person: 'conjunto', status: 'registrado', origin: 'presupuesto', linkedId: 'e1', notes: '' },
            { id: 'mv-2', accountId: 'acc-trade1', date: '2026-10-29', concept: 'Iberdrola Electricidad', amount: -87.40, type: 'gasto', categoryId: 'cat-4-1', person: 'conjunto', status: 'registrado', origin: 'presupuesto', linkedId: 'e2', notes: '' },
            { id: 'mv-3', accountId: 'acc-trade1', date: '2026-10-28', concept: 'Repsol Combustible', amount: -65.20, type: 'gasto', categoryId: 'cat-6-1', person: 'carlos', status: 'registrado', origin: 'presupuesto', linkedId: 'e3', notes: '' },
            { id: 'mv-4', accountId: 'acc-trade1', date: '2026-10-22', concept: 'Mercadona', amount: -124.30, type: 'gasto', categoryId: 'cat-1-1', person: 'ana', status: 'registrado', origin: 'presupuesto', linkedId: 'e8', notes: '' },
            { id: 'mv-5', accountId: 'acc-trade1', date: '2026-10-20', concept: 'Agua Canal Isabel II', amount: -32.50, type: 'gasto', categoryId: 'cat-4-2', person: 'conjunto', status: 'registrado', origin: 'presupuesto', linkedId: 'e9', notes: '' },
            { id: 'mv-6', accountId: 'acc-trade1', date: '2026-10-18', concept: 'Abono transporte', amount: -84.00, type: 'gasto', categoryId: 'cat-5-1', person: 'conjunto', status: 'registrado', origin: 'presupuesto', linkedId: 'e10', notes: '' },
            { id: 'mv-7', accountId: 'acc-trade1', date: '2026-10-14', concept: 'Vodafone', amount: -45.00, type: 'gasto', categoryId: 'cat-4-4', person: 'conjunto', status: 'registrado', origin: 'presupuesto', linkedId: 'e13', notes: '' },
            { id: 'mv-8', accountId: 'acc-trade1', date: '2026-10-08', concept: 'Gas natural', amount: -38.60, type: 'gasto', categoryId: 'cat-4-3', person: 'conjunto', status: 'registrado', origin: 'presupuesto', linkedId: 'e16', notes: '' },
            { id: 'mv-9', accountId: 'acc-trade1', date: '2026-10-05', concept: 'Comunidad vecinos', amount: -85.00, type: 'gasto', categoryId: 'cat-3-2', person: 'conjunto', status: 'registrado', origin: 'presupuesto', linkedId: 'e17', notes: '' },
            { id: 'mv-10', accountId: 'acc-trade1', date: '2026-10-02', concept: 'Mercado ecológico', amount: -56.70, type: 'gasto', categoryId: 'cat-1-2', person: 'ana', status: 'registrado', origin: 'presupuesto', linkedId: 'e20', notes: '' },
            { id: 'mv-11', accountId: 'acc-trade1', date: '2026-10-01', concept: 'Taller mecánico', amount: -145.00, type: 'gasto', categoryId: 'cat-6-3', person: 'conjunto', status: 'registrado', origin: 'presupuesto', linkedId: 'e21', notes: '' },
            { id: 'mv-12', accountId: 'acc-trade1', date: '2026-10-01', concept: 'Alquiler octubre', amount: -950.00, type: 'gasto', categoryId: 'cat-3-1', person: 'conjunto', status: 'registrado', origin: 'presupuesto', linkedId: 'e100', notes: '' },
            // Movimientos de MyInvestor
            { id: 'mv-20', accountId: 'acc-myinvestor', date: '2026-10-15', concept: 'Transferencia desde TR1', amount: 300.00, type: 'transferencia', person: 'conjunto', status: 'registrado', origin: 'transferencia', linkedId: 'tr-1', notes: '' },
            { id: 'mv-21', accountId: 'acc-myinvestor', date: '2026-10-10', concept: 'Intereses remun.', amount: 12.50, type: 'ingreso', person: 'conjunto', status: 'registrado', origin: 'manual', notes: '' },
            // Movimientos cuenta Ana
            { id: 'mv-30', accountId: 'acc-ana', date: '2026-10-27', concept: 'Cafetería Central', amount: -12.50, type: 'gasto', categoryId: 'cat-2-2', person: 'ana', status: 'registrado', origin: 'presupuesto', linkedId: 'e5', notes: '' },
            { id: 'mv-31', accountId: 'acc-ana', date: '2026-10-15', concept: 'Productos limpieza', amount: -28.40, type: 'gasto', categoryId: 'cat-1-3', person: 'ana', status: 'registrado', origin: 'presupuesto', linkedId: 'e12', notes: '' },
            { id: 'mv-32', accountId: 'acc-ana', date: '2026-10-04', concept: 'Parking centro', amount: -15.00, type: 'gasto', categoryId: 'cat-6-4', person: 'ana', status: 'registrado', origin: 'presupuesto', linkedId: 'e18', notes: '' },
            { id: 'mv-33', accountId: 'acc-ana', date: '2026-10-01', concept: 'Nómina octubre', amount: 2100.00, type: 'ingreso', person: 'ana', status: 'registrado', origin: 'manual', notes: '' },
            // Transferencia TR1 -> MyInvestor (salida)
            { id: 'mv-40', accountId: 'acc-trade1', date: '2026-10-15', concept: 'Transferencia a MyInvestor', amount: -300.00, type: 'transferencia', person: 'conjunto', status: 'registrado', origin: 'transferencia', linkedId: 'tr-1', notes: '' },
            // Movimiento pendiente de revisión
            { id: 'mv-50', accountId: 'acc-trade1', date: '2026-10-26', concept: 'Cargo desconocido', amount: -19.99, type: 'gasto', person: 'conjunto', status: 'pendiente_revision', origin: 'manual', notes: 'Revisar con el banco' },
            // Ajuste manual
            { id: 'mv-60', accountId: 'acc-trade1', date: '2026-10-20', concept: 'Ajuste conciliación', amount: 5.00, type: 'ajuste', person: 'conjunto', status: 'registrado', origin: 'ajuste', notes: 'Diferencia detectada en conciliación' }
        ],
        transfers: [
            {
                id: 'tr-1',
                date: '2026-10-15',
                concept: 'Ahorro mensual',
                amount: 300.00,
                fromAccountId: 'acc-trade1',
                toAccountId: 'acc-myinvestor',
                status: 'completado',
                notes: 'Transferencia de ahorro mensual'
            }
        ],
        balanceHistory: [
            { id: 'bh-1', accountId: 'acc-trade1', date: '2026-09-30', balance: 2500.00, type: 'referencia', notes: 'Saldo de referencia inicial' },
            { id: 'bh-2', accountId: 'acc-trade1', date: '2026-10-15', balance: 2850.00, type: 'manual', notes: '' },
            { id: 'bh-3', accountId: 'acc-trade1', date: '2026-10-28', balance: 3450.80, type: 'manual', notes: 'Última actualización' },
            { id: 'bh-4', accountId: 'acc-myinvestor', date: '2026-09-30', balance: 1200.00, type: 'referencia', notes: '' },
            { id: 'bh-5', accountId: 'acc-myinvestor', date: '2026-10-25', balance: 1820.50, type: 'manual', notes: '' },
            { id: 'bh-6', accountId: 'acc-ana', date: '2026-09-30', balance: 1500.00, type: 'referencia', notes: '' },
            { id: 'bh-7', accountId: 'acc-ana', date: '2026-10-27', balance: 1820.50, type: 'manual', notes: '' }
        ],
        reconciliations: [
            { id: 'rc-1', accountId: 'acc-trade1', date: '2026-10-28', manualBalance: 3450.80, estimatedBalance: 3448.30, difference: 2.50, status: 'pendiente', notes: 'Diferencia pequeña, revisar' }
        ],
        settings: {
            updateFrequencyDays: 7,
            staleDaysThreshold: 14,
            diffAlertThreshold: 10,
            defaultView: 'resumen',
            showArchived: false,
            sortOrder: 'manual',
            alertNoReference: true,
            alertNoManual: true,
            alertStale: true,
            alertDifference: true
        }
    };

    // =========================================================
    // ESTADO
    // =========================================================
    let accData = loadData();
    let currentView = 'resumen';
    let currentAccountId = null;
    let movFilters = { search: '', accountId: '', ownership: '', person: '', type: '', status: '', origin: '', dateFrom: '', dateTo: '' };
    let charts = {};
    let containerEl = null;

    function loadData() {
        try {
            const saved = localStorage.getItem('finanzas_accounts_data');
            if (saved) {
                const parsed = JSON.parse(saved);
                return Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_ACCOUNTS_DATA)), parsed);
            }
        } catch(e) {}
        return JSON.parse(JSON.stringify(DEFAULT_ACCOUNTS_DATA));
    }

    function saveData() {
        try {
            localStorage.setItem('finanzas_accounts_data', JSON.stringify(accData));
        } catch(e) {}
    }

    // =========================================================
    // HELPERS
    // =========================================================
    function getAccountById(id) { return accData.accounts.find(a => a.id === id); }
    function getAccountType(id) { return accData.accountTypes.find(t => t.id === id); }

    function getAccountMovements(accountId, options = {}) {
        const { includePending = false, untilDate = null } = options;
        return accData.movements.filter(m => {
            if (m.accountId !== accountId) return false;
            if (!includePending && (m.status === 'pendiente_confirmar' || m.status === 'anulado')) return false;
            if (untilDate && m.date > untilDate) return false;
            return true;
        });
    }

    function getEstimatedBalance(accountId, untilDate = null) {
        const acc = getAccountById(accountId);
        if (!acc) return null;
        if (acc.referenceBalance === null || acc.referenceBalance === undefined || !acc.referenceDate) {
            return null; // Sin datos suficientes
        }
        const movements = getAccountMovements(accountId, { includePending: false, untilDate });
        const total = movements.reduce((sum, m) => {
            // Solo movimientos contabilizados (no transferencias duplicadas, no anulados)
            if (m.status === 'anulado') return sum;
            return sum + m.amount;
        }, 0);

        // Solo incluir movimientos posteriores a la fecha de referencia
        const refMovements = movements.filter(m => m.date > acc.referenceDate);
        const refTotal = refMovements.reduce((sum, m) => sum + m.amount, 0);

        return acc.referenceBalance + refTotal;
    }

    function getManualBalance(accountId) {
        const acc = getAccountById(accountId);
        if (!acc) return null;
        return acc.manualBalance !== null && acc.manualBalance !== undefined ? acc.manualBalance : null;
    }

    function getBalanceDifference(accountId) {
        const manual = getManualBalance(accountId);
        const estimated = getEstimatedBalance(accountId);
        if (manual === null || estimated === null) return null;
        return manual - estimated;
    }

    function getDaysSinceUpdate(accountId) {
        const acc = getAccountById(accountId);
        if (!acc || !acc.manualBalanceDate) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const last = new Date(acc.manualBalanceDate + 'T00:00:00');
        return Math.floor((today - last) / (1000 * 60 * 60 * 24));
    }

    function getActiveAccounts() {
        return accData.accounts.filter(a => a.status === 'active');
    }

    function getOwnershipLabel(ownership) {
        return ownership === 'shared' ? 'Compartida' : 'Individual';
    }

    function getAccountStatusBadge(status) {
        const map = {
            active: '<span class="badge badge-success">Activa</span>',
            archived: '<span class="badge badge-neutral">Archivada</span>',
            pending: '<span class="badge badge-warning">Pendiente</span>'
        };
        return map[status] || '';
    }

    function getMovementTypeLabel(type) {
        const map = {
            ingreso: 'Ingreso',
            gasto: 'Gasto',
            transferencia: 'Transferencia',
            ajuste: 'Ajuste'
        };
        return map[type] || type;
    }

    function getMovementTypeBadge(type) {
        const map = {
            ingreso: '<span class="badge badge-success">Ingreso</span>',
            gasto: '<span class="badge badge-danger">Gasto</span>',
            transferencia: '<span class="badge badge-info">Transferencia</span>',
            ajuste: '<span class="badge badge-warning">Ajuste</span>'
        };
        return map[type] || '';
    }

    function getMovementStatusBadge(status) {
        const map = {
            registrado: '<span class="badge badge-success">Registrado</span>',
            pendiente_confirmar: '<span class="badge badge-info">Pendiente confirmar</span>',
            pendiente_revision: '<span class="badge badge-warning">Pendiente revisión</span>',
            anulado: '<span class="badge badge-neutral">Anulado</span>'
        };
        return map[status] || '';
    }

    function getFilteredMovements() {
        let list = [...accData.movements];
        if (movFilters.search) {
            const s = movFilters.search.toLowerCase();
            list = list.filter(m => m.concept.toLowerCase().includes(s));
        }
        if (movFilters.accountId) list = list.filter(m => m.accountId === movFilters.accountId);
        if (movFilters.ownership) {
            list = list.filter(m => {
                const acc = getAccountById(m.accountId);
                return acc && acc.ownership === movFilters.ownership;
            });
        }
        if (movFilters.person) list = list.filter(m => m.person === movFilters.person);
        if (movFilters.type) list = list.filter(m => m.type === movFilters.type);
        if (movFilters.status) list = list.filter(m => m.status === movFilters.status);
        if (movFilters.origin) list = list.filter(m => m.origin === movFilters.origin);
        if (movFilters.dateFrom) list = list.filter(m => m.date >= movFilters.dateFrom);
        if (movFilters.dateTo) list = list.filter(m => m.date <= movFilters.dateTo);
        list.sort((a, b) => b.date.localeCompare(a.date));
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
                        <select class="acc-filter-select" id="accGlobalOwnership">
                            <option value="">Todas las cuentas</option>
                            <option value="shared">Compartidas</option>
                            <option value="individual">Individuales</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="btn btn-sm btn-secondary" id="accUpdateBalanceBtn">
                            <i class="fas fa-sync"></i> Actualizar saldo
                        </button>
                        <button class="btn btn-sm btn-primary" id="accNewAccountBtn">
                            <i class="fas fa-plus"></i> Añadir cuenta
                        </button>
                    </div>
                </div>
            </div>

            <div class="acc-subnav">
                <button class="acc-subnav-item active" data-view="resumen"><i class="fas fa-chart-pie"></i> Resumen</button>
                <button class="acc-subnav-item" data-view="cuentas"><i class="fas fa-university"></i> Mis cuentas</button>
                <button class="acc-subnav-item" data-view="movimientos"><i class="fas fa-exchange-alt"></i> Movimientos</button>
                <button class="acc-subnav-item" data-view="conciliacion"><i class="fas fa-balance-scale"></i> Conciliación</button>
                <button class="acc-subnav-item" data-view="configuracion"><i class="fas fa-cog"></i> Configuración</button>
            </div>

            <div class="acc-subview active" id="accView-resumen"></div>
            <div class="acc-subview" id="accView-cuentas"></div>
            <div class="acc-subview" id="accView-movimientos"></div>
            <div class="acc-subview" id="accView-conciliacion"></div>
            <div class="acc-subview" id="accView-configuracion"></div>

            <!-- Modal Cuenta -->
            <div class="acc-modal" id="accAccountModal">
                <div class="acc-modal-content">
                    <div class="acc-modal-header">
                        <h3 class="acc-modal-title" id="accAccountModalTitle">Nueva cuenta</h3>
                        <button class="acc-modal-close" data-close-acc-modal><i class="fas fa-times"></i></button>
                    </div>
                    <div class="acc-modal-body" id="accAccountModalBody"></div>
                    <div class="acc-modal-footer">
                        <button class="btn btn-secondary" data-close-acc-modal>Cancelar</button>
                        <button class="btn btn-primary" id="accSaveAccountBtn"><i class="fas fa-save"></i> Guardar</button>
                    </div>
                </div>
            </div>

            <!-- Modal Actualizar Saldo -->
            <div class="acc-modal" id="accBalanceModal">
                <div class="acc-modal-content">
                    <div class="acc-modal-header">
                        <h3 class="acc-modal-title">Actualizar saldo manual</h3>
                        <button class="acc-modal-close" data-close-acc-modal><i class="fas fa-times"></i></button>
                    </div>
                    <div class="acc-modal-body" id="accBalanceModalBody"></div>
                    <div class="acc-modal-footer">
                        <button class="btn btn-secondary" data-close-acc-modal>Cancelar</button>
                        <button class="btn btn-primary" id="accSaveBalanceBtn"><i class="fas fa-save"></i> Guardar</button>
                    </div>
                </div>
            </div>

            <!-- Modal Movimiento -->
            <div class="acc-modal" id="accMovementModal">
                <div class="acc-modal-content">
                    <div class="acc-modal-header">
                        <h3 class="acc-modal-title" id="accMovementModalTitle">Nuevo movimiento</h3>
                        <button class="acc-modal-close" data-close-acc-modal><i class="fas fa-times"></i></button>
                    </div>
                    <div class="acc-modal-body" id="accMovementModalBody"></div>
                    <div class="acc-modal-footer">
                        <button class="btn btn-secondary" data-close-acc-modal>Cancelar</button>
                        <button class="btn btn-primary" id="accSaveMovementBtn"><i class="fas fa-save"></i> Guardar</button>
                    </div>
                </div>
            </div>

            <!-- Modal Transferencia -->
            <div class="acc-modal" id="accTransferModal">
                <div class="acc-modal-content">
                    <div class="acc-modal-header">
                        <h3 class="acc-modal-title">Nueva transferencia</h3>
                        <button class="acc-modal-close" data-close-acc-modal><i class="fas fa-times"></i></button>
                    </div>
                    <div class="acc-modal-body" id="accTransferModalBody"></div>
                    <div class="acc-modal-footer">
                        <button class="btn btn-secondary" data-close-acc-modal>Cancelar</button>
                        <button class="btn btn-primary" id="accSaveTransferBtn"><i class="fas fa-save"></i> Guardar</button>
                    </div>
                </div>
            </div>

            <!-- Modal Detalle Cuenta -->
            <div class="acc-modal" id="accDetailModal">
                <div class="acc-modal-content" style="max-width: 800px;">
                    <div class="acc-modal-header">
                        <h3 class="acc-modal-title" id="accDetailModalTitle">Detalle</h3>
                        <button class="acc-modal-close" data-close-acc-modal><i class="fas fa-times"></i></button>
                    </div>
                    <div class="acc-modal-body" id="accDetailModalBody"></div>
                    <div class="acc-modal-footer">
                        <button class="btn btn-secondary" data-close-acc-modal>Cerrar</button>
                    </div>
                </div>
            </div>
        `;

        renderView(currentView);
        bindGlobalEvents();
    }

    function bindGlobalEvents() {
        containerEl.querySelectorAll('.acc-subnav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                currentView = btn.dataset.view;
                containerEl.querySelectorAll('.acc-subnav-item').forEach(b =>
                    b.classList.toggle('active', b === btn));
                containerEl.querySelectorAll('.acc-subview').forEach(v =>
                    v.classList.toggle('active', v.id === `accView-${currentView}`));
                renderView(currentView);
            });
        });

        containerEl.querySelector('#accNewAccountBtn').addEventListener('click', () => openAccountModal());
        containerEl.querySelector('#accUpdateBalanceBtn').addEventListener('click', () => openBalanceModal());

        containerEl.querySelectorAll('[data-close-acc-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.acc-modal').classList.remove('active');
            });
        });
        containerEl.querySelectorAll('.acc-modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        });

        containerEl.querySelector('#accSaveAccountBtn').addEventListener('click', saveAccount);
        containerEl.querySelector('#accSaveBalanceBtn').addEventListener('click', saveBalance);
        containerEl.querySelector('#accSaveMovementBtn').addEventListener('click', saveMovement);
        containerEl.querySelector('#accSaveTransferBtn').addEventListener('click', saveTransfer);
    }

    function switchView(view) {
        currentView = view;
        containerEl.querySelectorAll('.acc-subnav-item').forEach(b =>
            b.classList.toggle('active', b.dataset.view === view));
        containerEl.querySelectorAll('.acc-subview').forEach(v =>
            v.classList.toggle('active', v.id === `accView-${view}`));
        renderView(view);
    }

    function renderView(view) {
        if (view === 'resumen') renderResumen();
        else if (view === 'cuentas') renderCuentas();
        else if (view === 'movimientos') renderMovimientos();
        else if (view === 'conciliacion') renderConciliacion();
        else if (view === 'configuracion') renderConfiguracion();
    }

    // =========================================================
    // VISTA: RESUMEN
    // =========================================================
    function renderResumen() {
        const view = containerEl.querySelector('#accView-resumen');
        const active = getActiveAccounts();

        // Indicadores
        let totalManual = 0, manualCount = 0;
        let totalEstimated = 0, estimatedCount = 0;
        let pendingReview = 0;

        active.forEach(acc => {
            const manual = getManualBalance(acc.id);
            if (manual !== null) { totalManual += manual; manualCount++; }
            const estimated = getEstimatedBalance(acc.id);
            if (estimated !== null) { totalEstimated += estimated; estimatedCount++; }
            const pending = accData.movements.filter(m => m.accountId === acc.id && m.status === 'pendiente_revision').length;
            pendingReview += pending;
        });

        const totalDiff = manualCount > 0 && estimatedCount > 0 ? totalManual - totalEstimated : null;
        const staleAccounts = active.filter(a => {
            const days = getDaysSinceUpdate(a.id);
            return days !== null && days > accData.settings.staleDaysThreshold;
        }).length;

        view.innerHTML = `
            <div class="acc-stats">
                <div class="acc-stat">
                    <div class="acc-stat-head">
                        <div>
                            <div class="acc-stat-label">Saldo manual total</div>
                            <div class="acc-stat-value">${manualCount > 0 ? App.formatCurrency(totalManual) : '<span style="font-size: 14px; color: var(--text-muted);">Sin datos</span>'}</div>
                            <div class="acc-stat-meta">${manualCount} cuenta(s) actualizada(s)</div>
                        </div>
                        <div class="acc-stat-icon" style="background: var(--primary-light); color: var(--primary);"><i class="fas fa-wallet"></i></div>
                    </div>
                </div>
                <div class="acc-stat">
                    <div class="acc-stat-head">
                        <div>
                            <div class="acc-stat-label">Saldo estimado total</div>
                            <div class="acc-stat-value">${estimatedCount > 0 ? App.formatCurrency(totalEstimated) : '<span style="font-size: 14px; color: var(--text-muted);">Sin datos</span>'}</div>
                            <div class="acc-stat-meta">Calculado desde referencias</div>
                        </div>
                        <div class="acc-stat-icon" style="background: var(--info-light); color: var(--info);"><i class="fas fa-calculator"></i></div>
                    </div>
                </div>
                <div class="acc-stat">
                    <div class="acc-stat-head">
                        <div>
                            <div class="acc-stat-label">Diferencia total</div>
                            <div class="acc-stat-value" style="color: ${totalDiff === null ? 'var(--text-muted)' : Math.abs(totalDiff) < accData.settings.diffAlertThreshold ? 'var(--success)' : 'var(--warning)'};">
                                ${totalDiff !== null ? App.formatCurrency(totalDiff) : 'Sin datos'}
                            </div>
                            <div class="acc-stat-meta">${totalDiff !== null ? (Math.abs(totalDiff) < accData.settings.diffAlertThreshold ? 'Dentro del umbral' : 'Requiere revisión') : 'Necesita conciliación'}</div>
                        </div>
                        <div class="acc-stat-icon" style="background: var(--warning-light); color: var(--warning);"><i class="fas fa-balance-scale"></i></div>
                    </div>
                </div>
                <div class="acc-stat" data-action="goto-cuentas">
                    <div class="acc-stat-head">
                        <div>
                            <div class="acc-stat-label">Cuentas activas</div>
                            <div class="acc-stat-value">${active.length}</div>
                            <div class="acc-stat-meta">${accData.accounts.length - active.length} archivada(s)</div>
                        </div>
                        <div class="acc-stat-icon" style="background: var(--success-light); color: var(--success);"><i class="fas fa-university"></i></div>
                    </div>
                </div>
                <div class="acc-stat">
                    <div class="acc-stat-head">
                        <div>
                            <div class="acc-stat-label">Pendientes</div>
                            <div class="acc-stat-value">${pendingReview + staleAccounts}</div>
                            <div class="acc-stat-meta">${pendingReview} mov. · ${staleAccounts} cuentas desactualizadas</div>
                        </div>
                        <div class="acc-stat-icon" style="background: var(--danger-light); color: var(--danger);"><i class="fas fa-exclamation-circle"></i></div>
                    </div>
                </div>
            </div>

            <div id="accAlertsContainer"></div>

            <div class="acc-section-title" style="margin-top: 24px;">Tus cuentas</div>
            <div class="acc-grid" id="accCardsGrid"></div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px;">
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">Distribución del dinero</div>
                            <div class="card-subtitle">Por saldo manual</div>
                        </div>
                    </div>
                    <div class="acc-chart-container"><canvas id="accChartDist"></canvas></div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">Movimientos recientes</div>
                            <div class="card-subtitle">Últimas operaciones</div>
                        </div>
                        <button class="btn btn-sm btn-secondary" id="accViewAllMov">Ver todos</button>
                    </div>
                    <div id="accRecentMovList"></div>
                </div>
            </div>
        `;

        renderAccountCards();
        renderAlerts();
        renderCharts();
        renderRecentMovements();

        view.querySelectorAll('[data-action="goto-cuentas"]').forEach(el => {
            el.addEventListener('click', () => switchView('cuentas'));
        });
        view.querySelector('#accViewAllMov').addEventListener('click', () => switchView('movimientos'));
        view.querySelectorAll('[data-account-id]').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                openAccountDetail(el.dataset.accountId);
            });
        });
        view.querySelectorAll('[data-account-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.accountAction;
                const id = btn.dataset.accountId;
                if (action === 'view') openAccountDetail(id);
                else if (action === 'edit') openAccountModal(id);
                else if (action === 'update') openBalanceModal(id);
                else if (action === 'movement') openMovementModal(null, id);
            });
        });
    }

    function renderAccountCards() {
        const grid = containerEl.querySelector('#accCardsGrid');
        const accounts = accData.accounts.filter(a => a.status !== 'archived' || accData.settings.showArchived);

        grid.innerHTML = accounts.map(acc => {
            const manual = getManualBalance(acc.id);
            const estimated = getEstimatedBalance(acc.id);
            const diff = getBalanceDifference(acc.id);
            const daysSince = getDaysSinceUpdate(acc.id);
            const type = getAccountType(acc.type);
            const hasReference = acc.referenceBalance !== null && acc.referenceBalance !== undefined;

            let diffClass = 'neutral';
            let diffText = 'Sin datos suficientes';
            if (diff !== null) {
                if (Math.abs(diff) < 0.01) { diffClass = 'ok'; diffText = 'Conciliado'; }
                else if (Math.abs(diff) < accData.settings.diffAlertThreshold) { diffClass = 'warning'; diffText = `Diferencia: ${App.formatCurrency(diff)}`; }
                else { diffClass = 'danger'; diffText = `Diferencia: ${App.formatCurrency(diff)}`; }
            } else if (manual === null && !hasReference) {
                diffText = 'Sin saldo de referencia';
            } else if (manual === null) {
                diffText = 'Sin saldo manual';
            } else if (estimated === null) {
                diffText = 'Sin referencia para estimar';
            }

            return `
                <div class="acc-card" data-account-id="${acc.id}" style="--acc-color: ${acc.color}; --acc-color-end: ${acc.colorEnd || acc.color};">
                    <div class="acc-card-banner">
                        <div class="acc-card-badges">
                            ${acc.status === 'pending' ? '<span class="badge badge-warning">Pendiente</span>' : ''}
                            ${acc.ownership === 'shared' ? '<span class="badge badge-info">Compartida</span>' : '<span class="badge badge-neutral">Individual</span>'}
                        </div>
                        <div class="acc-card-banner-content">
                            <div class="acc-card-icon"><i class="${acc.icon}"></i></div>
                            <div>
                                <div class="acc-card-name">${App.escapeHtml(acc.name)}</div>
                                <div class="acc-card-entity">${App.escapeHtml(acc.entity)} · ${type ? type.name : acc.type}</div>
                            </div>
                        </div>
                    </div>
                    <div class="acc-card-body">
                        <div class="acc-card-balances">
                            <div class="acc-balance-box">
                                <div class="acc-balance-label">Saldo manual</div>
                                <div class="acc-balance-value">${manual !== null ? App.formatCurrency(manual) : '—'}</div>
                                ${acc.manualBalanceDate ? `<div class="acc-balance-date">${App.formatDate(acc.manualBalanceDate)}${daysSince !== null ? ` · hace ${daysSince}d` : ''}</div>` : ''}
                            </div>
                            <div class="acc-balance-box">
                                <div class="acc-balance-label">Saldo estimado</div>
                                <div class="acc-balance-value">${estimated !== null ? App.formatCurrency(estimated) : '—'}</div>
                                ${hasReference ? `<div class="acc-balance-date">Ref: ${App.formatDate(acc.referenceDate)}</div>` : ''}
                            </div>
                        </div>
                        <div class="acc-card-diff ${diffClass}">
                            <span><i class="fas fa-${diffClass === 'ok' ? 'check-circle' : diffClass === 'danger' ? 'exclamation-triangle' : diffClass === 'warning' ? 'exclamation-circle' : 'info-circle'}"></i></span>
                            <span>${diffText}</span>
                        </div>
                        <div class="acc-card-meta">
                            <span><i class="fas fa-user"></i> ${acc.ownership === 'shared' ? 'Compartida' : App.getProfileName(acc.owner)}</span>
                            <span>${acc.currency}</span>
                        </div>
                        <div class="acc-card-actions">
                            <button class="btn btn-secondary btn-sm" data-account-action="view" data-account-id="${acc.id}"><i class="fas fa-eye"></i> Ver</button>
                            <button class="btn btn-secondary btn-sm" data-account-action="update" data-account-id="${acc.id}"><i class="fas fa-sync"></i> Saldo</button>
                            <button class="btn btn-primary btn-sm" data-account-action="movement" data-account-id="${acc.id}"><i class="fas fa-plus"></i> Mov.</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderAlerts() {
        const container = containerEl.querySelector('#accAlertsContainer');
        const alerts = [];
        const settings = accData.settings;

        accData.accounts.filter(a => a.status === 'active').forEach(acc => {
            if (settings.alertNoReference && (acc.referenceBalance === null || acc.referenceBalance === undefined || !acc.referenceDate)) {
                alerts.push({
                    type: 'warning', icon: 'fas fa-info-circle',
                    title: `${acc.name} sin saldo de referencia`,
                    desc: `No se puede calcular el saldo estimado. Define un saldo de referencia.`,
                    action: () => openAccountModal(acc.id)
                });
            }
            if (settings.alertNoManual && (acc.manualBalance === null || acc.manualBalance === undefined)) {
                alerts.push({
                    type: 'info', icon: 'fas fa-hand-paper',
                    title: `${acc.name} sin saldo manual`,
                    desc: `Introduce el saldo real actual para conciliar.`,
                    action: () => openBalanceModal(acc.id)
                });
            }
            if (settings.alertStale) {
                const days = getDaysSinceUpdate(acc.id);
                if (days !== null && days > settings.staleDaysThreshold) {
                    alerts.push({
                        type: days > 30 ? 'danger' : 'warning',
                        icon: 'fas fa-clock',
                        title: `${acc.name} desactualizada`,
                        desc: `Última actualización hace ${days} días. Umbral: ${settings.staleDaysThreshold} días.`,
                        action: () => openBalanceModal(acc.id)
                    });
                }
            }
            if (settings.alertDifference) {
                const diff = getBalanceDifference(acc.id);
                if (diff !== null && Math.abs(diff) >= settings.diffAlertThreshold) {
                    alerts.push({
                        type: 'danger', icon: 'fas fa-balance-scale',
                        title: `Diferencia en ${acc.name}`,
                        desc: `Diferencia de ${App.formatCurrency(diff)} entre saldo manual y estimado.`,
                        action: () => openAccountDetail(acc.id)
                    });
                }
            }
        });

        const pendingReview = accData.movements.filter(m => m.status === 'pendiente_revision');
        if (pendingReview.length > 0) {
            alerts.push({
                type: 'warning', icon: 'fas fa-search',
                title: `${pendingReview.length} movimiento(s) pendiente(s) de revisión`,
                desc: `Total: ${App.formatCurrency(pendingReview.reduce((s, m) => s + Math.abs(m.amount), 0))}.`,
                action: () => { switchView('movimientos'); movFilters.status = 'pendiente_revision'; renderMovimientos(); }
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
                        <div class="card-title"><i class="fas fa-bell"></i> Avisos</div>
                        <div class="card-subtitle">${alerts.length} aviso(s) activo(s)</div>
                    </div>
                </div>
                <div class="acc-alert-list">
                    ${alerts.map((a, i) => `
                        <div class="acc-alert-item ${a.type}">
                            <div class="acc-alert-icon"><i class="${a.icon}"></i></div>
                            <div class="acc-alert-content">
                                <div class="acc-alert-title">${a.title}</div>
                                <div class="acc-alert-desc">${a.desc}</div>
                                <button class="acc-alert-action" data-alert-idx="${i}">Resolver →</button>
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

    function renderCharts() {
        const canvas = containerEl.querySelector('#accChartDist');
        if (!canvas) return;
        if (charts.dist) charts.dist.destroy();

        const isDark = App.isDarkMode ? App.isDarkMode() : false;
        const colors = {
            text: isDark ? '#cbd5e1' : '#64748b',
            grid: isDark ? '#334155' : '#e2e8f0',
            bg: isDark ? '#1e293b' : '#ffffff'
        };

        const accounts = getActiveAccounts().filter(a => getManualBalance(a.id) !== null);
        if (accounts.length === 0) {
            canvas.parentElement.innerHTML = '<div class="acc-empty"><i class="fas fa-chart-pie"></i><h3>Sin datos</h3><p>Actualiza los saldos manuales para ver la distribución.</p></div>';
            return;
        }

        const total = accounts.reduce((s, a) => s + getManualBalance(a.id), 0);
        const hasUnknown = accData.accounts.filter(a => a.status === 'active' && getManualBalance(a.id) === null).length > 0;

        charts.dist = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: accounts.map(a => a.name),
                datasets: [{
                    data: accounts.map(a => getManualBalance(a.id)),
                    backgroundColor: accounts.map(a => a.color),
                    borderWidth: 2, borderColor: colors.bg
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '60%',
                plugins: {
                    legend: { position: 'right', labels: { color: colors.text, font: { size: 11 }, padding: 8 } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                                return `${ctx.label}: ${App.formatCurrency(ctx.parsed)} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    function renderRecentMovements() {
        const container = containerEl.querySelector('#accRecentMovList');
        const recent = [...accData.movements]
            .filter(m => m.status !== 'anulado')
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 6);

        if (recent.length === 0) {
            container.innerHTML = '<div class="acc-empty"><i class="fas fa-exchange-alt"></i><h3>Sin movimientos</h3></div>';
            return;
        }

        container.innerHTML = recent.map(m => {
            const acc = getAccountById(m.accountId);
            const color = acc ? acc.color : '#94a3b8';
            const icon = m.type === 'ingreso' ? 'fa-arrow-down' : m.type === 'gasto' ? 'fa-arrow-up' : m.type === 'transferencia' ? 'fa-exchange-alt' : 'fa-wrench';
            return `
                <div style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-light);">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: ${color}20; color: ${color}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 13px; font-weight: 500;">${App.escapeHtml(m.concept)}</div>
                        <div style="font-size: 11px; color: var(--text-muted);">${acc ? acc.name : '—'} · ${App.formatDate(m.date)}</div>
                    </div>
                    <div style="font-size: 13px; font-weight: 600; color: ${m.amount >= 0 ? 'var(--success)' : 'var(--danger)'};">
                        ${m.amount >= 0 ? '+' : ''}${App.formatCurrency(m.amount)}
                    </div>
                </div>
            `;
        }).join('');
    }

    // =========================================================
    // VISTA: MIS CUENTAS
    // =========================================================
    function renderCuentas() {
        const view = containerEl.querySelector('#accView-cuentas');
        view.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Todas las cuentas</div>
                        <div class="card-subtitle">${accData.accounts.length} cuenta(s) en total</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-sm btn-secondary" id="accTransferBtn"><i class="fas fa-exchange-alt"></i> Transferencia</button>
                        <button class="btn btn-sm btn-primary" id="accNewAccountBtn2"><i class="fas fa-plus"></i> Añadir cuenta</button>
                    </div>
                </div>
                <div class="acc-filters-bar">
                    <select class="acc-filter-select" id="accFilterStatus">
                        <option value="active">Activas</option>
                        <option value="archived">Archivadas</option>
                        <option value="pending">Pendientes</option>
                        <option value="all">Todas</option>
                    </select>
                    <select class="acc-filter-select" id="accFilterOwnership">
                        <option value="">Todas las titularidades</option>
                        <option value="shared">Compartidas</option>
                        <option value="individual">Individuales</option>
                    </select>
                    <select class="acc-filter-select" id="accFilterType">
                        <option value="">Todos los tipos</option>
                        ${accData.accountTypes.map(t => `<option value="${t.id}">${App.escapeHtml(t.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="acc-grid" id="accAllGrid"></div>
            </div>
        `;

        renderAllAccountsGrid();

        view.querySelector('#accNewAccountBtn2').addEventListener('click', () => openAccountModal());
        view.querySelector('#accTransferBtn').addEventListener('click', () => openTransferModal());
        view.querySelector('#accFilterStatus').addEventListener('change', renderAllAccountsGrid);
        view.querySelector('#accFilterOwnership').addEventListener('change', renderAllAccountsGrid);
        view.querySelector('#accFilterType').addEventListener('change', renderAllAccountsGrid);
    }

    function renderAllAccountsGrid() {
        const grid = containerEl.querySelector('#accAllGrid');
        const statusFilter = containerEl.querySelector('#accFilterStatus').value;
        const ownershipFilter = containerEl.querySelector('#accFilterOwnership').value;
        const typeFilter = containerEl.querySelector('#accFilterType').value;

        let list = [...accData.accounts];
        if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter);
        if (ownershipFilter) list = list.filter(a => a.ownership === ownershipFilter);
        if (typeFilter) list = list.filter(a => a.type === typeFilter);

        if (list.length === 0) {
            grid.innerHTML = '<div class="acc-empty"><i class="fas fa-university"></i><h3>Sin cuentas</h3></div>';
            return;
        }

        grid.innerHTML = list.map(acc => {
            const manual = getManualBalance(acc.id);
            const estimated = getEstimatedBalance(acc.id);
            const type = getAccountType(acc.type);
            return `
                <div class="acc-card" data-account-id="${acc.id}" style="--acc-color: ${acc.color}; --acc-color-end: ${acc.colorEnd || acc.color};">
                    <div class="acc-card-banner">
                        <div class="acc-card-badges">
                            ${getAccountStatusBadge(acc.status)}
                        </div>
                        <div class="acc-card-banner-content">
                            <div class="acc-card-icon"><i class="${acc.icon}"></i></div>
                            <div>
                                <div class="acc-card-name">${App.escapeHtml(acc.name)}</div>
                                <div class="acc-card-entity">${App.escapeHtml(acc.entity)} · ${type ? type.name : acc.type}</div>
                            </div>
                        </div>
                    </div>
                    <div class="acc-card-body">
                        <div class="acc-card-balances">
                            <div class="acc-balance-box">
                                <div class="acc-balance-label">Saldo manual</div>
                                <div class="acc-balance-value">${manual !== null ? App.formatCurrency(manual) : '—'}</div>
                            </div>
                            <div class="acc-balance-box">
                                <div class="acc-balance-label">Saldo estimado</div>
                                <div class="acc-balance-value">${estimated !== null ? App.formatCurrency(estimated) : '—'}</div>
                            </div>
                        </div>
                        <div class="acc-card-actions">
                            <button class="btn btn-secondary btn-sm" data-account-action="view" data-account-id="${acc.id}"><i class="fas fa-eye"></i> Ver</button>
                            <button class="btn btn-secondary btn-sm" data-account-action="edit" data-account-id="${acc.id}"><i class="fas fa-edit"></i> Editar</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        grid.querySelectorAll('[data-account-id]').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                openAccountDetail(el.dataset.accountId);
            });
        });
        grid.querySelectorAll('[data-account-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.accountAction;
                const id = btn.dataset.accountId;
                if (action === 'view') openAccountDetail(id);
                else if (action === 'edit') openAccountModal(id);
            });
        });
    }

    // =========================================================
    // VISTA: MOVIMIENTOS
    // =========================================================
    function renderMovimientos() {
        const view = containerEl.querySelector('#accView-movimientos');
        view.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Movimientos</div>
                        <div class="card-subtitle" id="accMovCount">0 movimientos</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-sm btn-secondary" id="accExportMov"><i class="fas fa-download"></i> Exportar</button>
                        <button class="btn btn-sm btn-secondary" id="accNewTransferBtn"><i class="fas fa-exchange-alt"></i> Transferencia</button>
                        <button class="btn btn-sm btn-primary" id="accNewMovBtn"><i class="fas fa-plus"></i> Nuevo movimiento</button>
                    </div>
                </div>
                <div class="acc-filters-bar">
                    <div class="acc-search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" id="accMovSearch" placeholder="Buscar por concepto...">
                    </div>
                    <select class="acc-filter-select" id="accMovAccount">
                        <option value="">Todas las cuentas</option>
                        ${accData.accounts.map(a => `<option value="${a.id}">${App.escapeHtml(a.name)}</option>`).join('')}
                    </select>
                    <select class="acc-filter-select" id="accMovType">
                        <option value="">Todos los tipos</option>
                        <option value="ingreso">Ingreso</option>
                        <option value="gasto">Gasto</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="ajuste">Ajuste</option>
                    </select>
                    <select class="acc-filter-select" id="accMovStatus">
                        <option value="">Todos los estados</option>
                        <option value="registrado">Registrado</option>
                        <option value="pendiente_confirmar">Pendiente confirmar</option>
                        <option value="pendiente_revision">Pendiente revisión</option>
                        <option value="anulado">Anulado</option>
                    </select>
                    <select class="acc-filter-select" id="accMovPerson">
                        <option value="">Todas las personas</option>
                        <option value="conjunto">Conjunto</option>
                        ${App.data.profiles.map(p => `<option value="${p.id}">${App.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                    <input type="date" class="acc-form-input" id="accMovDateFrom" style="width: auto;">
                    <input type="date" class="acc-form-input" id="accMovDateTo" style="width: auto;">
                    <button class="btn btn-sm btn-secondary" id="accMovClear"><i class="fas fa-times"></i> Limpiar</button>
                </div>
                <div class="acc-table-desktop">
                    <div class="acc-table-wrap">
                        <table class="acc-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Concepto</th>
                                    <th>Cuenta</th>
                                    <th>Tipo</th>
                                    <th>Importe</th>
                                    <th>Persona</th>
                                    <th>Estado</th>
                                    <th>Origen</th>
                                    <th style="width: 80px;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="accMovBody"></tbody>
                        </table>
                    </div>
                </div>
                <div class="acc-table-mobile" id="accMovMobile"></div>
            </div>
        `;

        renderMovTable();

        view.querySelector('#accNewMovBtn').addEventListener('click', () => openMovementModal());
        view.querySelector('#accNewTransferBtn').addEventListener('click', () => openTransferModal());
        view.querySelector('#accExportMov').addEventListener('click', exportMovements);
        view.querySelector('#accMovSearch').addEventListener('input', (e) => { movFilters.search = e.target.value; renderMovTable(); });
        view.querySelector('#accMovAccount').addEventListener('change', (e) => { movFilters.accountId = e.target.value; renderMovTable(); });
        view.querySelector('#accMovType').addEventListener('change', (e) => { movFilters.type = e.target.value; renderMovTable(); });
        view.querySelector('#accMovStatus').addEventListener('change', (e) => { movFilters.status = e.target.value; renderMovTable(); });
        view.querySelector('#accMovPerson').addEventListener('change', (e) => { movFilters.person = e.target.value; renderMovTable(); });
        view.querySelector('#accMovDateFrom').addEventListener('change', (e) => { movFilters.dateFrom = e.target.value; renderMovTable(); });
        view.querySelector('#accMovDateTo').addEventListener('change', (e) => { movFilters.dateTo = e.target.value; renderMovTable(); });
        view.querySelector('#accMovClear').addEventListener('click', () => {
            movFilters = { search: '', accountId: '', ownership: '', person: '', type: '', status: '', origin: '', dateFrom: '', dateTo: '' };
            view.querySelector('#accMovSearch').value = '';
            view.querySelector('#accMovAccount').value = '';
            view.querySelector('#accMovType').value = '';
            view.querySelector('#accMovStatus').value = '';
            view.querySelector('#accMovPerson').value = '';
            view.querySelector('#accMovDateFrom').value = '';
            view.querySelector('#accMovDateTo').value = '';
            renderMovTable();
        });
    }

    function renderMovTable() {
        const tbody = containerEl.querySelector('#accMovBody');
        const mobile = containerEl.querySelector('#accMovMobile');
        const list = getFilteredMovements();

        const totalIn = list.filter(m => m.amount > 0).reduce((s, m) => s + m.amount, 0);
        const totalOut = list.filter(m => m.amount < 0).reduce((s, m) => s + m.amount, 0);
        containerEl.querySelector('#accMovCount').textContent = `${list.length} movimiento(s) · Ingresos: ${App.formatCurrency(totalIn)} · Gastos: ${App.formatCurrency(totalOut)}`;

        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9"><div class="acc-empty"><i class="fas fa-exchange-alt"></i><h3>Sin movimientos</h3></div></td></tr>';
            if (mobile) mobile.innerHTML = '<div class="acc-empty"><i class="fas fa-exchange-alt"></i><h3>Sin movimientos</h3></div>';
            return;
        }

        tbody.innerHTML = list.map(m => {
            const acc = getAccountById(m.accountId);
            return `
                <tr>
                    <td>${App.formatDate(m.date)}</td>
                    <td>
                        <div style="font-weight: 500;">${App.escapeHtml(m.concept)}</div>
                        ${m.notes ? `<div style="font-size: 11px; color: var(--text-muted);">${App.escapeHtml(m.notes)}</div>` : ''}
                    </td>
                    <td>${acc ? App.escapeHtml(acc.name) : '—'}</td>
                    <td>${getMovementTypeBadge(m.type)}</td>
                    <td class="amount ${m.amount > 0 ? 'positive' : m.amount < 0 ? 'negative' : 'neutral'}">
                        ${m.amount > 0 ? '+' : ''}${App.formatCurrency(m.amount)}
                    </td>
                    <td>${App.getProfileName(m.person)}</td>
                    <td>${getMovementStatusBadge(m.status)}</td>
                    <td><span class="badge badge-neutral">${m.origin}</span></td>
                    <td>
                        <div class="acc-action-menu">
                            <button class="btn btn-icon btn-ghost" data-mov-menu="${m.id}"><i class="fas fa-ellipsis-v"></i></button>
                            <div class="acc-action-dropdown" id="mmenu-${m.id}">
                                <button data-mov-action="edit" data-id="${m.id}"><i class="fas fa-edit"></i> Editar</button>
                                <button data-mov-action="review" data-id="${m.id}"><i class="fas fa-search"></i> Marcar revisión</button>
                                <button data-mov-action="delete" data-id="${m.id}" class="danger"><i class="fas fa-trash"></i> Eliminar</button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        if (mobile) {
            mobile.innerHTML = list.map(m => {
                const acc = getAccountById(m.accountId);
                return `
                    <div class="acc-mobile-card">
                        <div class="acc-mobile-card-head">
                            <div>
                                <div style="font-weight: 600;">${App.escapeHtml(m.concept)}</div>
                                <div style="font-size: 11px; color: var(--text-muted);">${App.formatDate(m.date)} · ${acc ? acc.name : '—'}</div>
                            </div>
                            <div style="font-weight: 700; color: ${m.amount > 0 ? 'var(--success)' : 'var(--danger)'};">${m.amount > 0 ? '+' : ''}${App.formatCurrency(m.amount)}</div>
                        </div>
                        <div class="acc-mobile-card-row"><span class="lbl">Tipo</span><span class="val">${getMovementTypeBadge(m.type)}</span></div>
                        <div class="acc-mobile-card-row"><span class="lbl">Estado</span><span class="val">${getMovementStatusBadge(m.status)}</span></div>
                        <div style="display: flex; gap: 6px; margin-top: 10px;">
                            <button class="btn btn-sm btn-secondary" data-mov-action="edit" data-id="${m.id}" style="flex: 1;"><i class="fas fa-edit"></i> Editar</button>
                            <button class="btn btn-sm btn-danger" data-mov-action="delete" data-id="${m.id}"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        containerEl.querySelectorAll('[data-mov-menu]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.movMenu;
                containerEl.querySelectorAll('.acc-action-dropdown.open').forEach(m => {
                    if (m.id !== `mmenu-${id}`) m.classList.remove('open');
                });
                containerEl.querySelector(`#mmenu-${id}`).classList.toggle('open');
            });
        });

        containerEl.querySelectorAll('[data-mov-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.movAction;
                const id = btn.dataset.id;
                containerEl.querySelectorAll('.acc-action-dropdown.open').forEach(m => m.classList.remove('open'));
                if (action === 'edit') openMovementModal(id);
                else if (action === 'review') toggleReviewMovement(id);
                else if (action === 'delete') confirmDeleteMovement(id);
            });
        });
    }

    function toggleReviewMovement(id) {
        const m = accData.movements.find(m => m.id === id);
        if (!m) return;
        m.status = m.status === 'pendiente_revision' ? 'registrado' : 'pendiente_revision';
        saveData();
        App.showToast(m.status === 'pendiente_revision' ? 'Movimiento marcado para revisión' : 'Revisión completada');
        renderMovTable();
    }

    function confirmDeleteMovement(id) {
        const m = accData.movements.find(m => m.id === id);
        if (!m) return;
        App.showConfirm(
            'Eliminar movimiento',
            `¿Eliminar "${m.concept}" (${App.formatCurrency(m.amount)})?`,
            () => {
                accData.movements = accData.movements.filter(m => m.id !== id);
                saveData();
                App.showToast('Movimiento eliminado');
                renderMovTable();
            }
        );
    }

    // =========================================================
    // VISTA: CONCILIACIÓN
    // =========================================================
    function renderConciliacion() {
        const view = containerEl.querySelector('#accView-conciliacion');
        const accounts = accData.accounts.filter(a => a.status === 'active');

        view.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Conciliación de saldos</div>
                        <div class="card-subtitle">Comparación entre saldo manual y estimado</div>
                    </div>
                    <button class="btn btn-sm btn-primary" id="accUpdateAllBtn"><i class="fas fa-sync"></i> Actualizar saldos</button>
                </div>
                ${accounts.map(acc => {
                    const manual = getManualBalance(acc.id);
                    const estimated = getEstimatedBalance(acc.id);
                    const diff = getBalanceDifference(acc.id);
                    const days = getDaysSinceUpdate(acc.id);
                    const hasReference = acc.referenceBalance !== null && acc.referenceBalance !== undefined;

                    let status = 'sin_datos';
                    let statusBadge = '<span class="badge badge-neutral">Sin datos suficientes</span>';
                    if (manual !== null && estimated !== null) {
                        if (Math.abs(diff) < 0.01) {
                            status = 'conciliado';
                            statusBadge = '<span class="badge badge-success">Conciliado</span>';
                        } else {
                            status = 'diferencia';
                            statusBadge = '<span class="badge badge-warning">Diferencia pendiente</span>';
                        }
                    } else if (manual === null && hasReference) {
                        status = 'sin_manual';
                        statusBadge = '<span class="badge badge-info">Sin saldo manual</span>';
                    } else if (!hasReference) {
                        status = 'sin_referencia';
                        statusBadge = '<span class="badge badge-warning">Sin referencia</span>';
                    }

                    return `
                        <div class="conc-card">
                            <div class="conc-header">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="width: 36px; height: 36px; border-radius: 10px; background: ${acc.color}; color: white; display: flex; align-items: center; justify-content: center;">
                                        <i class="${acc.icon}"></i>
                                    </div>
                                    <div>
                                        <div class="conc-title">${App.escapeHtml(acc.name)}</div>
                                        <div style="font-size: 11px; color: var(--text-muted);">
                                            ${acc.manualBalanceDate ? `Última actualización: ${App.formatDate(acc.manualBalanceDate)}${days !== null ? ` (hace ${days}d)` : ''}` : 'Sin actualizar'}
                                        </div>
                                    </div>
                                </div>
                                <div style="display: flex; gap: 6px;">
                                    ${statusBadge}
                                    <button class="btn btn-sm btn-secondary" data-conc-action="update" data-id="${acc.id}"><i class="fas fa-sync"></i> Actualizar</button>
                                    <button class="btn btn-sm btn-secondary" data-conc-action="detail" data-id="${acc.id}"><i class="fas fa-eye"></i> Detalle</button>
                                </div>
                            </div>
                            <div class="conc-grid">
                                <div class="conc-box">
                                    <div class="conc-box-label">Saldo manual</div>
                                    <div class="conc-box-value">${manual !== null ? App.formatCurrency(manual) : '—'}</div>
                                </div>
                                <div class="conc-box">
                                    <div class="conc-box-label">Saldo estimado</div>
                                    <div class="conc-box-value">${estimated !== null ? App.formatCurrency(estimated) : '—'}</div>
                                </div>
                                <div class="conc-box">
                                    <div class="conc-box-label">Diferencia</div>
                                    <div class="conc-box-value" style="color: ${diff === null ? 'var(--text-muted)' : Math.abs(diff) < 0.01 ? 'var(--success)' : Math.abs(diff) < accData.settings.diffAlertThreshold ? 'var(--warning)' : 'var(--danger)'};">
                                        ${diff !== null ? App.formatCurrency(diff) : '—'}
                                    </div>
                                </div>
                                <div class="conc-box">
                                    <div class="conc-box-label">Referencia</div>
                                    <div class="conc-box-value" style="font-size: 14px;">${hasReference ? App.formatCurrency(acc.referenceBalance) : '—'}</div>
                                    ${acc.referenceDate ? `<div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">${App.formatDate(acc.referenceDate)}</div>` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        view.querySelector('#accUpdateAllBtn').addEventListener('click', () => openBalanceModal());
        view.querySelectorAll('[data-conc-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.concAction;
                const id = btn.dataset.id;
                if (action === 'update') openBalanceModal(id);
                else if (action === 'detail') openAccountDetail(id);
            });
        });
    }

    // =========================================================
    // VISTA: CONFIGURACIÓN
    // =========================================================
    function renderConfiguracion() {
        const view = containerEl.querySelector('#accView-configuracion');
        const s = accData.settings;

        view.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Configuración de Cuentas</div>
                        <div class="card-subtitle">Personaliza el comportamiento</div>
                    </div>
                </div>

                <div class="acc-config-section">
                    <h3><i class="fas fa-sync"></i> Actualización de saldos</h3>
                    <div class="acc-config-row">
                        <span class="label">Frecuencia recomendada (días)</span>
                        <input type="number" min="1" max="365" class="acc-form-input" style="width: 100px;" id="cfgFrequency" value="${s.updateFrequencyDays}">
                    </div>
                    <div class="acc-config-row">
                        <span class="label">Umbral de desactualización (días)</span>
                        <input type="number" min="1" max="365" class="acc-form-input" style="width: 100px;" id="cfgStaleDays" value="${s.staleDaysThreshold}">
                    </div>
                    <div class="acc-config-row">
                        <span class="label">Umbral de diferencia para alertas (€)</span>
                        <input type="number" min="0" step="0.01" class="acc-form-input" style="width: 100px;" id="cfgDiffThreshold" value="${s.diffAlertThreshold}">
                    </div>
                </div>

                <div class="acc-config-section">
                    <h3><i class="fas fa-bell"></i> Alertas</h3>
                    <div class="acc-config-row">
                        <span class="label">Alertar de cuentas sin referencia</span>
                        <label class="acc-switch"><input type="checkbox" id="cfgAlertNoRef" ${s.alertNoReference ? 'checked' : ''}><span class="acc-slider"></span></label>
                    </div>
                    <div class="acc-config-row">
                        <span class="label">Alertar de cuentas sin saldo manual</span>
                        <label class="acc-switch"><input type="checkbox" id="cfgAlertNoManual" ${s.alertNoManual ? 'checked' : ''}><span class="acc-slider"></span></label>
                    </div>
                    <div class="acc-config-row">
                        <span class="label">Alertar de cuentas desactualizadas</span>
                        <label class="acc-switch"><input type="checkbox" id="cfgAlertStale" ${s.alertStale ? 'checked' : ''}><span class="acc-slider"></span></label>
                    </div>
                    <div class="acc-config-row">
                        <span class="label">Alertar de diferencias</span>
                        <label class="acc-switch"><input type="checkbox" id="cfgAlertDiff" ${s.alertDifference ? 'checked' : ''}><span class="acc-slider"></span></label>
                    </div>
                </div>

                <div class="acc-config-section">
                    <h3><i class="fas fa-eye"></i> Visualización</h3>
                    <div class="acc-config-row">
                        <span class="label">Mostrar cuentas archivadas por defecto</span>
                        <label class="acc-switch"><input type="checkbox" id="cfgShowArchived" ${s.showArchived ? 'checked' : ''}><span class="acc-slider"></span></label>
                    </div>
                    <div class="acc-config-row">
                        <span class="label">Vista inicial predeterminada</span>
                        <select class="acc-filter-select" id="cfgDefaultView">
                            <option value="resumen" ${s.defaultView === 'resumen' ? 'selected' : ''}>Resumen</option>
                            <option value="cuentas" ${s.defaultView === 'cuentas' ? 'selected' : ''}>Mis cuentas</option>
                            <option value="movimientos" ${s.defaultView === 'movimientos' ? 'selected' : ''}>Movimientos</option>
                            <option value="conciliacion" ${s.defaultView === 'conciliacion' ? 'selected' : ''}>Conciliación</option>
                        </select>
                    </div>
                </div>

                <div class="acc-config-section">
                    <h3><i class="fas fa-database"></i> Datos</h3>
                    <div class="acc-config-row">
                        <span class="label">Exportar cuentas y movimientos a JSON</span>
                        <button class="btn btn-sm btn-secondary" id="cfgExportJson"><i class="fas fa-file-code"></i> Descargar</button>
                    </div>
                    <div class="acc-config-row">
                        <span class="label">Restaurar datos de demostración</span>
                        <button class="btn btn-sm btn-danger" id="cfgResetData"><i class="fas fa-undo"></i> Restaurar</button>
                    </div>
                </div>
            </div>
        `;

        const bindings = [
            ['cfgFrequency', 'updateFrequencyDays', 'value', 'int'],
            ['cfgStaleDays', 'staleDaysThreshold', 'value', 'int'],
            ['cfgDiffThreshold', 'diffAlertThreshold', 'value', 'float'],
            ['cfgAlertNoRef', 'alertNoReference', 'checked'],
            ['cfgAlertNoManual', 'alertNoManual', 'checked'],
            ['cfgAlertStale', 'alertStale', 'checked'],
            ['cfgAlertDiff', 'alertDifference', 'checked'],
            ['cfgShowArchived', 'showArchived', 'checked'],
            ['cfgDefaultView', 'defaultView', 'value']
        ];

        bindings.forEach(([uiId, key, prop, type]) => {
            const el = view.querySelector('#' + uiId);
            if (!el) return;
            el.addEventListener('change', () => {
                let val = el[prop];
                if (type === 'int') val = parseInt(val);
                else if (type === 'float') val = parseFloat(val);
                accData.settings[key] = val;
                saveData();
                App.showToast('Configuración guardada');
            });
        });

        view.querySelector('#cfgExportJson').addEventListener('click', () => {
            const json = JSON.stringify(accData, null, 2);
            const blob = new Blob(['\ufeff' + json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'cuentas-backup.json'; a.click();
            URL.revokeObjectURL(url);
            App.showToast('JSON exportado');
        });

        view.querySelector('#cfgResetData').addEventListener('click', () => {
            App.showConfirm(
                'Restaurar datos',
                '¿Seguro que quieres restaurar los datos de demostración de Cuentas? Se perderán todos los cambios.',
                () => {
                    accData = JSON.parse(JSON.stringify(DEFAULT_ACCOUNTS_DATA));
                    saveData();
                    renderConfiguracion();
                    App.showToast('Datos restaurados');
                }
            );
        });
    }

    // =========================================================
    // MODAL: CUENTA
    // =========================================================
    function openAccountModal(id = null) {
        const modal = containerEl.querySelector('#accAccountModal');
        const body = containerEl.querySelector('#accAccountModalBody');
        containerEl.querySelector('#accAccountModalTitle').textContent = id ? 'Editar cuenta' : 'Nueva cuenta';

        const acc = id ? getAccountById(id) : null;

        body.innerHTML = `
            <input type="hidden" id="accEditId" value="${id || ''}">

            <div class="acc-form-row">
                <div class="acc-form-group">
                    <label class="acc-form-label">Nombre *</label>
                    <input type="text" class="acc-form-input" id="accName" value="${acc ? App.escapeHtml(acc.name) : ''}" required>
                    <div class="acc-form-error">Nombre obligatorio</div>
                </div>
                <div class="acc-form-group">
                    <label class="acc-form-label">Entidad financiera</label>
                    <input type="text" class="acc-form-input" id="accEntity" value="${acc ? App.escapeHtml(acc.entity || '') : ''}">
                </div>
            </div>
            <div class="acc-form-row three">
                <div class="acc-form-group">
                    <label class="acc-form-label">Tipo de cuenta</label>
                    <select class="acc-form-select" id="accType">
                        ${accData.accountTypes.map(t => `<option value="${t.id}" ${acc && acc.type === t.id ? 'selected' : ''}>${App.escapeHtml(t.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="acc-form-group">
                    <label class="acc-form-label">Titularidad</label>
                    <select class="acc-form-select" id="accOwnership">
                        <option value="shared" ${acc && acc.ownership === 'shared' ? 'selected' : (!acc ? 'selected' : '')}>Compartida</option>
                        <option value="individual" ${acc && acc.ownership === 'individual' ? 'selected' : ''}>Individual</option>
                    </select>
                </div>
                <div class="acc-form-group">
                    <label class="acc-form-label">Titular</label>
                    <select class="acc-form-select" id="accOwner">
                        <option value="conjunto" ${acc && acc.owner === 'conjunto' ? 'selected' : (!acc ? 'selected' : '')}>Conjunto</option>
                        ${App.data.profiles.map(p => `<option value="${p.id}" ${acc && acc.owner === p.id ? 'selected' : ''}>${App.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="acc-form-row">
                <div class="acc-form-group">
                    <label class="acc-form-label">Divisa</label>
                    <select class="acc-form-select" id="accCurrency">
                        <option value="EUR" ${acc && acc.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                        <option value="USD" ${acc && acc.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                        <option value="GBP" ${acc && acc.currency === 'GBP' ? 'selected' : ''}>GBP (£)</option>
                    </select>
                </div>
                <div class="acc-form-group">
                    <label class="acc-form-label">Estado</label>
                    <select class="acc-form-select" id="accStatus">
                        <option value="active" ${acc && acc.status === 'active' ? 'selected' : (!acc ? 'selected' : '')}>Activa</option>
                        <option value="pending" ${acc && acc.status === 'pending' ? 'selected' : ''}>Pendiente de configurar</option>
                        <option value="archived" ${acc && acc.status === 'archived' ? 'selected' : ''}>Archivada</option>
                    </select>
                </div>
            </div>
            <div class="acc-form-row">
                <div class="acc-form-group">
                    <label class="acc-form-label">Fecha de apertura</label>
                    <input type="date" class="acc-form-input" id="accOpeningDate" value="${acc ? acc.openingDate || '' : ''}">
                </div>
                <div class="acc-form-group">
                    <label class="acc-form-label">¿Es dinero líquido?</label>
                    <label class="acc-switch" style="margin-top: 6px;"><input type="checkbox" id="accIsLiquid" ${acc && acc.isLiquid !== false ? 'checked' : (!acc ? 'checked' : '')}><span class="acc-slider"></span></label>
                    <div class="acc-form-hint">Desmarca si es inversión no líquida</div>
                </div>
            </div>

            <button type="button" class="acc-details-toggle" id="accToggleBalances" style="background: none; border: none; color: var(--primary); font-size: 12px; font-weight: 500; cursor: pointer; padding: 8px 0; display: flex; align-items: center; gap: 6px; font-family: inherit;">
                <i class="fas fa-chevron-right"></i> Saldos y conciliación
            </button>
            <div id="accBalancesContent" style="display: none; padding-top: 8px;">
                <div class="acc-form-row">
                    <div class="acc-form-group">
                        <label class="acc-form-label">Saldo de referencia (€)</label>
                        <input type="number" step="0.01" class="acc-form-input" id="accRefBalance" value="${acc && acc.referenceBalance !== null ? acc.referenceBalance : ''}">
                        <div class="acc-form-hint">Punto de partida para calcular el saldo estimado</div>
                    </div>
                    <div class="acc-form-group">
                        <label class="acc-form-label">Fecha de la referencia</label>
                        <input type="date" class="acc-form-input" id="accRefDate" value="${acc ? acc.referenceDate || '' : ''}">
                    </div>
                </div>
                <div class="acc-form-row">
                    <div class="acc-form-group">
                        <label class="acc-form-label">Saldo manual actual (€)</label>
                        <input type="number" step="0.01" class="acc-form-input" id="accManualBalance" value="${acc && acc.manualBalance !== null ? acc.manualBalance : ''}">
                        <div class="acc-form-hint">Último saldo real consultado en el banco</div>
                    </div>
                    <div class="acc-form-group">
                        <label class="acc-form-label">Fecha del saldo manual</label>
                        <input type="date" class="acc-form-input" id="accManualDate" value="${acc ? acc.manualBalanceDate || '' : ''}">
                    </div>
                </div>
            </div>

            <div class="acc-form-row single">
                <div class="acc-form-group">
                    <label class="acc-form-label">Notas</label>
                    <textarea class="acc-form-textarea" id="accNotes">${acc ? App.escapeHtml(acc.notes || '') : ''}</textarea>
                </div>
            </div>

            <button type="button" class="acc-details-toggle" id="accToggleAppearance" style="background: none; border: none; color: var(--primary); font-size: 12px; font-weight: 500; cursor: pointer; padding: 8px 0; display: flex; align-items: center; gap: 6px; font-family: inherit;">
                <i class="fas fa-chevron-right"></i> Apariencia
            </button>
            <div id="accAppearanceContent" style="display: none; padding-top: 8px;">
                <div class="acc-form-row">
                    <div class="acc-form-group">
                        <label class="acc-form-label">Color</label>
                        <div class="acc-color-grid" id="accColorGrid"></div>
                        <input type="hidden" id="accColor" value="${acc ? acc.color : '#2563eb'}">
                    </div>
                    <div class="acc-form-group">
                        <label class="acc-form-label">Icono</label>
                        <select class="acc-form-select" id="accIcon">
                            <option value="fas fa-credit-card" ${acc && acc.icon === 'fas fa-credit-card' ? 'selected' : ''}>💳 Tarjeta</option>
                            <option value="fas fa-university" ${acc && acc.icon === 'fas fa-university' ? 'selected' : ''}>🏦 Banco</option>
                            <option value="fas fa-piggy-bank" ${acc && acc.icon === 'fas fa-piggy-bank' ? 'selected' : ''}>🐷 Ahorro</option>
                            <option value="fas fa-wallet" ${acc && acc.icon === 'fas fa-wallet' ? 'selected' : ''}>💰 Cartera</option>
                            <option value="fas fa-money-bill-wave" ${acc && acc.icon === 'fas fa-money-bill-wave' ? 'selected' : ''}>💵 Efectivo</option>
                            <option value="fas fa-chart-line" ${acc && acc.icon === 'fas fa-chart-line' ? 'selected' : ''}>📈 Inversión</option>
                            <option value="fas fa-user" ${acc && acc.icon === 'fas fa-user' ? 'selected' : ''}>👤 Personal</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        // Color picker
        const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#a855f7', '#dc2626', '#0ea5e9', '#d97706', '#059669', '#7c3aed', '#64748b', '#94a3b8'];
        const colorGrid = body.querySelector('#accColorGrid');
        colorGrid.innerHTML = colors.map(c => `<div class="acc-color-option" data-color="${c}" style="background: ${c};"></div>`).join('');
        colorGrid.querySelectorAll('.acc-color-option').forEach(opt => {
            opt.addEventListener('click', () => {
                colorGrid.querySelectorAll('.acc-color-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                body.querySelector('#accColor').value = opt.dataset.color;
            });
        });
        const currentColor = body.querySelector('#accColor').value;
        const selectedColor = colorGrid.querySelector(`[data-color="${currentColor}"]`);
        if (selectedColor) selectedColor.classList.add('selected');

        // Toggles
        body.querySelector('#accToggleBalances').addEventListener('click', function() {
            const content = body.querySelector('#accBalancesContent');
            const isOpen = content.style.display !== 'none';
            content.style.display = isOpen ? 'none' : 'block';
            this.innerHTML = `<i class="fas fa-chevron-${isOpen ? 'right' : 'down'}"></i> Saldos y conciliación`;
        });
        body.querySelector('#accToggleAppearance').addEventListener('click', function() {
            const content = body.querySelector('#accAppearanceContent');
            const isOpen = content.style.display !== 'none';
            content.style.display = isOpen ? 'none' : 'block';
            this.innerHTML = `<i class="fas fa-chevron-${isOpen ? 'right' : 'down'}"></i> Apariencia`;
        });

        const saveBtn = containerEl.querySelector('#accSaveAccountBtn');
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        newBtn.id = 'accSaveAccountBtn';
        newBtn.addEventListener('click', saveAccount);

        modal.classList.add('active');
    }

    function saveAccount() {
        const body = containerEl.querySelector('#accAccountModalBody');
        const id = body.querySelector('#accEditId').value;
        const name = body.querySelector('#accName').value.trim();

        body.querySelectorAll('.acc-form-group').forEach(g => g.classList.remove('error'));

        if (!name) {
            body.querySelector('#accName').closest('.acc-form-group').classList.add('error');
            return;
        }

        const refBalanceVal = body.querySelector('#accRefBalance').value;
        const manualBalanceVal = body.querySelector('#accManualBalance').value;

        const accData_new = {
            name,
            entity: body.querySelector('#accEntity').value.trim(),
            type: body.querySelector('#accType').value,
            ownership: body.querySelector('#accOwnership').value,
            owner: body.querySelector('#accOwner').value,
            currency: body.querySelector('#accCurrency').value,
            status: body.querySelector('#accStatus').value,
            openingDate: body.querySelector('#accOpeningDate').value,
            isLiquid: body.querySelector('#accIsLiquid').checked,
            referenceBalance: refBalanceVal === '' ? null : parseFloat(refBalanceVal),
            referenceDate: body.querySelector('#accRefDate').value,
            manualBalance: manualBalanceVal === '' ? null : parseFloat(manualBalanceVal),
            manualBalanceDate: body.querySelector('#accManualDate').value,
            notes: body.querySelector('#accNotes').value.trim(),
            color: body.querySelector('#accColor').value,
            colorEnd: body.querySelector('#accColor').value,
            icon: body.querySelector('#accIcon').value
        };

        if (id) {
            const acc = getAccountById(id);
            const hadMovements = accData.movements.some(m => m.accountId === id);
            if (acc.status !== 'archived' && accData_new.status === 'archived' && hadMovements) {
                // Advertir pero permitir
            }
            Object.assign(acc, accData_new);
            App.addHistory('account_updated', name);
            App.showToast('Cuenta actualizada');
        } else {
            accData_new.id = App.generateId('acc');
            accData.accounts.push(accData_new);
            // Registrar saldo de referencia en historial si existe
            if (accData_new.referenceBalance !== null && accData_new.referenceDate) {
                accData.balanceHistory.push({
                    id: App.generateId('bh'),
                    accountId: accData_new.id,
                    date: accData_new.referenceDate,
                    balance: accData_new.referenceBalance,
                    type: 'referencia',
                    notes: 'Saldo de referencia inicial'
                });
            }
            if (accData_new.manualBalance !== null && accData_new.manualBalanceDate) {
                accData.balanceHistory.push({
                    id: App.generateId('bh'),
                    accountId: accData_new.id,
                    date: accData_new.manualBalanceDate,
                    balance: accData_new.manualBalance,
                    type: 'manual',
                    notes: ''
                });
            }
            App.addHistory('account_created', name);
            App.showToast('Cuenta creada');
        }

        saveData();
        containerEl.querySelector('#accAccountModal').classList.remove('active');
        renderView(currentView);
    }

    // =========================================================
    // MODAL: ACTUALIZAR SALDO
    // =========================================================
    function openBalanceModal(accountId = null) {
        const modal = containerEl.querySelector('#accBalanceModal');
        const body = containerEl.querySelector('#accBalanceModalBody');

        body.innerHTML = `
            <input type="hidden" id="balAccountId" value="${accountId || ''}">
            <div class="acc-form-row single">
                <div class="acc-form-group">
                    <label class="acc-form-label">Cuenta *</label>
                    <select class="acc-form-select" id="balAccount" required>
                        <option value="">Selecciona una cuenta</option>
                        ${accData.accounts.filter(a => a.status !== 'archived').map(a => `<option value="${a.id}" ${accountId === a.id ? 'selected' : ''}>${App.escapeHtml(a.name)}</option>`).join('')}
                    </select>
                    <div class="acc-form-error">Selecciona una cuenta</div>
                </div>
            </div>
            <div class="acc-form-row">
                <div class="acc-form-group">
                    <label class="acc-form-label">Fecha del saldo *</label>
                    <input type="date" class="acc-form-input" id="balDate" value="${new Date().toISOString().substring(0, 10)}" required>
                    <div class="acc-form-error">Fecha obligatoria</div>
                </div>
                <div class="acc-form-group">
                    <label class="acc-form-label">Importe del saldo real (€) *</label>
                    <input type="number" step="0.01" class="acc-form-input" id="balAmount" required>
                    <div class="acc-form-error">Importe inválido</div>
                </div>
            </div>
            <div class="acc-form-row single">
                <div class="acc-form-group">
                    <label class="acc-form-label">Nota (opcional)</label>
                    <input type="text" class="acc-form-input" id="balNotes" placeholder="Ej: Saldo consultado en app del banco">
                </div>
            </div>
            <div id="balComparison" style="margin-top: 16px;"></div>
        `;

        // Mostrar comparación al seleccionar cuenta y fecha
        const accountSelect = body.querySelector('#balAccount');
        const dateInput = body.querySelector('#balDate');
        function updateComparison() {
            const accId = accountSelect.value;
            const date = dateInput.value;
            const container = body.querySelector('#balComparison');
            if (!accId || !date) { container.innerHTML = ''; return; }

            const estimated = getEstimatedBalance(accId, date);
            const acc = getAccountById(accId);
            const currentManual = getManualBalance(accId);

            let html = '<div style="padding: 14px; background: var(--border-light); border-radius: var(--radius-sm);">';
            html += '<div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--text-secondary);">Comparación en la fecha seleccionada:</div>';
            html += `<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">`;
            html += `<div><div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">Saldo actual manual</div><div style="font-size: 15px; font-weight: 600;">${currentManual !== null ? App.formatCurrency(currentManual) : '—'}</div></div>`;
            html += `<div><div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">Saldo estimado en fecha</div><div style="font-size: 15px; font-weight: 600;">${estimated !== null ? App.formatCurrency(estimated) : '—'}</div></div>`;
            if (estimated !== null) {
                html += `<div><div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">Diferencia tras guardar</div><div style="font-size: 15px; font-weight: 600;" id="balDiffPreview">—</div></div>`;
            }
            html += `</div></div>`;
            container.innerHTML = html;
        }

        accountSelect.addEventListener('change', updateComparison);
        dateInput.addEventListener('change', updateComparison);

        // Calcular diferencia al introducir importe
        body.querySelector('#balAmount').addEventListener('input', () => {
            const accId = accountSelect.value;
            const date = dateInput.value;
            const amount = parseFloat(body.querySelector('#balAmount').value);
            const diffPreview = body.querySelector('#balDiffPreview');
            if (!accId || !date || isNaN(amount) || !diffPreview) return;
            const estimated = getEstimatedBalance(accId, date);
            if (estimated !== null) {
                const diff = amount - estimated;
                diffPreview.textContent = App.formatCurrency(diff);
                diffPreview.style.color = Math.abs(diff) < 0.01 ? 'var(--success)' : Math.abs(diff) < accData.settings.diffAlertThreshold ? 'var(--warning)' : 'var(--danger)';
            }
        });

        const saveBtn = containerEl.querySelector('#accSaveBalanceBtn');
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        newBtn.id = 'accSaveBalanceBtn';
        newBtn.addEventListener('click', saveBalance);

        modal.classList.add('active');
    }

    function saveBalance() {
        const body = containerEl.querySelector('#accBalanceModalBody');
        const accountId = body.querySelector('#balAccount').value;
        const date = body.querySelector('#balDate').value;
        const amount = parseFloat(body.querySelector('#balAmount').value);
        const notes = body.querySelector('#balNotes').value.trim();

        body.querySelectorAll('.acc-form-group').forEach(g => g.classList.remove('error'));

        let valid = true;
        if (!accountId) { body.querySelector('#balAccount').closest('.acc-form-group').classList.add('error'); valid = false; }
        if (!date) { body.querySelector('#balDate').closest('.acc-form-group').classList.add('error'); valid = false; }
        if (isNaN(amount)) { body.querySelector('#balAmount').closest('.acc-form-group').classList.add('error'); valid = false; }
        if (!valid) return;

        const acc = getAccountById(accountId);
        acc.manualBalance = amount;
        acc.manualBalanceDate = date;

        // Añadir al historial
        accData.balanceHistory.push({
            id: App.generateId('bh'),
            accountId,
            date,
            balance: amount,
            type: 'manual',
            notes
        });

        // Calcular diferencia y registrar conciliación
        const estimated = getEstimatedBalance(accountId, date);
        if (estimated !== null) {
            const diff = amount - estimated;
            accData.reconciliations.push({
                id: App.generateId('rc'),
                accountId,
                date,
                manualBalance: amount,
                estimatedBalance: estimated,
                difference: diff,
                status: Math.abs(diff) < 0.01 ? 'conciliado' : 'pendiente',
                notes
            });
        }

        saveData();
        App.addHistory('balance_updated', `${acc.name}: ${App.formatCurrency(amount)}`);
        containerEl.querySelector('#accBalanceModal').classList.remove('active');
        App.showToast(`Saldo actualizado: ${App.formatCurrency(amount)}`);
        renderView(currentView);
    }

    // =========================================================
    // MODAL: MOVIMIENTO
    // =========================================================
    function openMovementModal(id = null, accountId = null) {
        const modal = containerEl.querySelector('#accMovementModal');
        const body = containerEl.querySelector('#accMovementModalBody');
        containerEl.querySelector('#accMovementModalTitle').textContent = id ? 'Editar movimiento' : 'Nuevo movimiento';

        const mov = id ? accData.movements.find(m => m.id === id) : null;

        body.innerHTML = `
            <input type="hidden" id="movEditId" value="${id || ''}">
            <div class="acc-form-row">
                <div class="acc-form-group">
                    <label class="acc-form-label">Cuenta *</label>
                    <select class="acc-form-select" id="movAccount" required>
                        <option value="">Selecciona cuenta</option>
                        ${accData.accounts.filter(a => a.status !== 'archived').map(a => `<option value="${a.id}" ${(accountId === a.id || (mov && mov.accountId === a.id)) ? 'selected' : ''}>${App.escapeHtml(a.name)}</option>`).join('')}
                    </select>
                    <div class="acc-form-error">Cuenta obligatoria</div>
                </div>
                <div class="acc-form-group">
                    <label class="acc-form-label">Tipo *</label>
                    <select class="acc-form-select" id="movType">
                        <option value="gasto" ${mov && mov.type === 'gasto' ? 'selected' : (!mov ? 'selected' : '')}>Gasto</option>
                        <option value="ingreso" ${mov && mov.type === 'ingreso' ? 'selected' : ''}>Ingreso</option>
                        <option value="ajuste" ${mov && mov.type === 'ajuste' ? 'selected' : ''}>Ajuste</option>
                    </select>
                </div>
            </div>
            <div class="acc-form-row single">
                <div class="acc-form-group">
                    <label class="acc-form-label">Concepto *</label>
                    <input type="text" class="acc-form-input" id="movConcept" value="${mov ? App.escapeHtml(mov.concept) : ''}" required>
                    <div class="acc-form-error">Concepto obligatorio</div>
                </div>
            </div>
            <div class="acc-form-row three">
                <div class="acc-form-group">
                    <label class="acc-form-label">Importe (€) *</label>
                    <input type="number" step="0.01" class="acc-form-input" id="movAmount" value="${mov ? Math.abs(mov.amount) : ''}" required>
                    <div class="acc-form-hint">Siempre en positivo, el signo lo define el tipo</div>
                    <div class="acc-form-error">Importe inválido</div>
                </div>
                <div class="acc-form-group">
                    <label class="acc-form-label">Fecha *</label>
                    <input type="date" class="acc-form-input" id="movDate" value="${mov ? mov.date : new Date().toISOString().substring(0, 10)}" required>
                    <div class="acc-form-error">Fecha obligatoria</div>
                </div>
                <div class="acc-form-group">
                    <label class="acc-form-label">Persona</label>
                    <select class="acc-form-select" id="movPerson">
                        <option value="conjunto" ${mov && mov.person === 'conjunto' ? 'selected' : (!mov ? 'selected' : '')}>Conjunto</option>
                        ${App.data.profiles.map(p => `<option value="${p.id}" ${mov && mov.person === p.id ? 'selected' : ''}>${App.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="acc-form-row">
                <div class="acc-form-group">
                    <label class="acc-form-label">Estado</label>
                    <select class="acc-form-select" id="movStatus">
                        <option value="registrado" ${mov && mov.status === 'registrado' ? 'selected' : (!mov ? 'selected' : '')}>Registrado</option>
                        <option value="pendiente_confirmar" ${mov && mov.status === 'pendiente_confirmar' ? 'selected' : ''}>Pendiente de confirmar</option>
                        <option value="pendiente_revision" ${mov && mov.status === 'pendiente_revision' ? 'selected' : ''}>Pendiente de revisión</option>
                    </select>
                </div>
                <div class="acc-form-group">
                    <label class="acc-form-label">Origen</label>
                    <select class="acc-form-select" id="movOrigin">
                        <option value="manual" ${mov && mov.origin === 'manual' ? 'selected' : (!mov ? 'selected' : '')}>Manual</option>
                        <option value="presupuesto" ${mov && mov.origin === 'presupuesto' ? 'selected' : ''}>Vinculado a presupuesto</option>
                    </select>
                </div>
            </div>
            <div class="acc-form-row single">
                <div class="acc-form-group">
                    <label class="acc-form-label">Notas</label>
                    <textarea class="acc-form-textarea" id="movNotes">${mov ? App.escapeHtml(mov.notes || '') : ''}</textarea>
                </div>
            </div>
        `;

        const saveBtn = containerEl.querySelector('#accSaveMovementBtn');
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        newBtn.id = 'accSaveMovementBtn';
        newBtn.addEventListener('click', saveMovement);

        modal.classList.add('active');
    }

    function saveMovement() {
        const body = containerEl.querySelector('#accMovementModalBody');
        const id = body.querySelector('#movEditId').value;
        const accountId = body.querySelector('#movAccount').value;
        const concept = body.querySelector('#movConcept').value.trim();
        const amount = parseFloat(body.querySelector('#movAmount').value);
        const date = body.querySelector('#movDate').value;
        const type = body.querySelector('#movType').value;

        body.querySelectorAll('.acc-form-group').forEach(g => g.classList.remove('error'));

        let valid = true;
        if (!accountId) { body.querySelector('#movAccount').closest('.acc-form-group').classList.add('error'); valid = false; }
        if (!concept) { body.querySelector('#movConcept').closest('.acc-form-group').classList.add('error'); valid = false; }
        if (isNaN(amount) || amount <= 0) { body.querySelector('#movAmount').closest('.acc-form-group').classList.add('error'); valid = false; }
        if (!date) { body.querySelector('#movDate').closest('.acc-form-group').classList.add('error'); valid = false; }
        if (!valid) return;

        // Aplicar signo según tipo
        const signedAmount = type === 'ingreso' || type === 'ajuste' && amount > 0 ? amount : -Math.abs(amount);

        const movData = {
            accountId,
            concept,
            amount: signedAmount,
            date,
            type,
            person: body.querySelector('#movPerson').value,
            status: body.querySelector('#movStatus').value,
            origin: body.querySelector('#movOrigin').value,
            notes: body.querySelector('#movNotes').value.trim(),
            categoryId: null,
            linkedId: null
        };

        if (id) {
            const mov = accData.movements.find(m => m.id === id);
            Object.assign(mov, movData);
            App.addHistory('movement_updated', concept);
            App.showToast('Movimiento actualizado');
        } else {
            movData.id = App.generateId('mv');
            accData.movements.push(movData);
            App.addHistory('movement_created', concept);
            App.showToast('Movimiento registrado');
        }

        saveData();
        containerEl.querySelector('#accMovementModal').classList.remove('active');
        renderView(currentView);
    }

    // =========================================================
    // MODAL: TRANSFERENCIA
    // =========================================================
    function openTransferModal() {
        const modal = containerEl.querySelector('#accTransferModal');
        const body = containerEl.querySelector('#accTransferModalBody');

        body.innerHTML = `
            <div class="acc-form-row">
                <div class="acc-form-group">
                    <label class="acc-form-label">Cuenta de origen *</label>
                    <select class="acc-form-select" id="trFrom" required>
                        <option value="">Selecciona</option>
                        ${accData.accounts.filter(a => a.status === 'active').map(a => `<option value="${a.id}">${App.escapeHtml(a.name)}</option>`).join('')}
                    </select>
                    <div class="acc-form-error">Obligatorio</div>
                </div>
                <div class="acc-form-group">
                    <label class="acc-form-label">Cuenta de destino *</label>
                    <select class="acc-form-select" id="trTo" required>
                        <option value="">Selecciona</option>
                        ${accData.accounts.filter(a => a.status === 'active').map(a => `<option value="${a.id}">${App.escapeHtml(a.name)}</option>`).join('')}
                    </select>
                    <div class="acc-form-error">Obligatorio</div>
                </div>
            </div>
            <div class="acc-form-row">
                <div class="acc-form-group">
                    <label class="acc-form-label">Importe (€) *</label>
                    <input type="number" step="0.01" min="0.01" class="acc-form-input" id="trAmount" required>
                    <div class="acc-form-error">Importe inválido</div>
                </div>
                <div class="acc-form-group">
                    <label class="acc-form-label">Fecha *</label>
                    <input type="date" class="acc-form-input" id="trDate" value="${new Date().toISOString().substring(0, 10)}" required>
                    <div class="acc-form-error">Fecha obligatoria</div>
                </div>
            </div>
            <div class="acc-form-row single">
                <div class="acc-form-group">
                    <label class="acc-form-label">Concepto</label>
                    <input type="text" class="acc-form-input" id="trConcept" placeholder="Ej: Ahorro mensual, Aporte a cuenta conjunta...">
                </div>
            </div>
            <div class="acc-form-row single">
                <div class="acc-form-group">
                    <label class="acc-form-label">Notas</label>
                    <textarea class="acc-form-textarea" id="trNotes"></textarea>
                </div>
            </div>
            <div style="padding: 12px; background: var(--info-light); border-radius: var(--radius-sm); font-size: 12px; color: var(--info);">
                <i class="fas fa-info-circle"></i> Una transferencia entre cuentas propias no es un ingreso ni un gasto del hogar. Solo mueve el dinero entre tus cuentas.
            </div>
        `;

        const saveBtn = containerEl.querySelector('#accSaveTransferBtn');
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        newBtn.id = 'accSaveTransferBtn';
        newBtn.addEventListener('click', saveTransfer);

        modal.classList.add('active');
    }

    function saveTransfer() {
        const body = containerEl.querySelector('#accTransferModalBody');
        const fromId = body.querySelector('#trFrom').value;
        const toId = body.querySelector('#trTo').value;
        const amount = parseFloat(body.querySelector('#trAmount').value);
        const date = body.querySelector('#trDate').value;
        const concept = body.querySelector('#trConcept').value.trim() || 'Transferencia entre cuentas';
        const notes = body.querySelector('#trNotes').value.trim();

        body.querySelectorAll('.acc-form-group').forEach(g => g.classList.remove('error'));

        let valid = true;
        if (!fromId) { body.querySelector('#trFrom').closest('.acc-form-group').classList.add('error'); valid = false; }
        if (!toId) { body.querySelector('#trTo').closest('.acc-form-group').classList.add('error'); valid = false; }
        if (fromId === toId) {
            body.querySelector('#trTo').closest('.acc-form-group').classList.add('error');
            App.showToast('La cuenta de origen y destino deben ser diferentes', 'error');
            valid = false;
        }
        if (isNaN(amount) || amount <= 0) { body.querySelector('#trAmount').closest('.acc-form-group').classList.add('error'); valid = false; }
        if (!date) { body.querySelector('#trDate').closest('.acc-form-group').classList.add('error'); valid = false; }
        if (!valid) return;

        // Crear transferencia con ID compartido
        const transferId = App.generateId('tr');
        accData.transfers.push({
            id: transferId,
            date,
            concept,
            amount,
            fromAccountId: fromId,
            toAccountId: toId,
            status: 'completado',
            notes
        });

        // Crear movimientos en ambas cuentas
        const fromAcc = getAccountById(fromId);
        const toAcc = getAccountById(toId);

        accData.movements.push({
            id: App.generateId('mv'),
            accountId: fromId,
            date,
            concept: `Transferencia a ${toAcc.name}`,
            amount: -amount,
            type: 'transferencia',
            person: fromAcc.ownership === 'shared' ? 'conjunto' : fromAcc.owner,
            status: 'registrado',
            origin: 'transferencia',
            linkedId: transferId,
            notes
        });

        accData.movements.push({
            id: App.generateId('mv'),
            accountId: toId,
            date,
            concept: `Transferencia desde ${fromAcc.name}`,
            amount: amount,
            type: 'transferencia',
            person: toAcc.ownership === 'shared' ? 'conjunto' : toAcc.owner,
            status: 'registrado',
            origin: 'transferencia',
            linkedId: transferId,
            notes
        });

        saveData();
        App.addHistory('transfer_created', `${App.formatCurrency(amount)} de ${fromAcc.name} a ${toAcc.name}`);
        containerEl.querySelector('#accTransferModal').classList.remove('active');
        App.showToast(`Transferencia de ${App.formatCurrency(amount)} registrada`);
        renderView(currentView);
    }

    // =========================================================
    // DETALLE DE CUENTA
    // =========================================================
    function openAccountDetail(accountId) {
        const acc = getAccountById(accountId);
        if (!acc) return;

        const modal = containerEl.querySelector('#accDetailModal');
        const body = containerEl.querySelector('#accDetailModalBody');
        containerEl.querySelector('#accDetailModalTitle').textContent = acc.name;

        const manual = getManualBalance(acc.id);
        const estimated = getEstimatedBalance(acc.id);
        const diff = getBalanceDifference(acc.id);
        const movements = getAccountMovements(acc.id, { includePending: true });
        const history = accData.balanceHistory.filter(h => h.accountId === acc.id).sort((a, b) => b.date.localeCompare(a.date));
        const reconciliations = accData.reconciliations.filter(r => r.accountId === acc.id).sort((a, b) => b.date.localeCompare(a.date));

        body.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
                <div class="conc-box">
                    <div class="conc-box-label">Saldo manual</div>
                    <div class="conc-box-value">${manual !== null ? App.formatCurrency(manual) : '—'}</div>
                    ${acc.manualBalanceDate ? `<div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">${App.formatDate(acc.manualBalanceDate)}</div>` : ''}
                </div>
                <div class="conc-box">
                    <div class="conc-box-label">Saldo estimado</div>
                    <div class="conc-box-value">${estimated !== null ? App.formatCurrency(estimated) : '—'}</div>
                </div>
                <div class="conc-box">
                    <div class="conc-box-label">Diferencia</div>
                    <div class="conc-box-value" style="color: ${diff === null ? 'var(--text-muted)' : Math.abs(diff) < 0.01 ? 'var(--success)' : 'var(--danger)'};">
                        ${diff !== null ? App.formatCurrency(diff) : '—'}
                    </div>
                </div>
            </div>

            <div class="acc-section-title" style="margin-top: 0;">Información</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
                <div><span style="color: var(--text-muted);">Entidad:</span> <strong>${App.escapeHtml(acc.entity || '—')}</strong></div>
                <div><span style="color: var(--text-muted);">Tipo:</span> <strong>${getAccountType(acc.type)?.name || acc.type}</strong></div>
                <div><span style="color: var(--text-muted);">Titularidad:</span> <strong>${getOwnershipLabel(acc.ownership)}</strong></div>
                <div><span style="color: var(--text-muted);">Titular:</span> <strong>${App.getProfileName(acc.owner)}</strong></div>
                <div><span style="color: var(--text-muted);">Divisa:</span> <strong>${acc.currency}</strong></div>
                <div><span style="color: var(--text-muted);">Estado:</span> <strong>${getAccountStatusBadge(acc.status)}</strong></div>
            </div>

            ${acc.notes ? `<div style="margin-top: 12px; padding: 10px; background: var(--border-light); border-radius: var(--radius-sm); font-size: 12px; color: var(--text-secondary);">${App.escapeHtml(acc.notes)}</div>` : ''}

            <div class="acc-section-title">Historial de saldos</div>
            ${history.length === 0 ? '<p style="font-size: 13px; color: var(--text-muted);">Sin historial.</p>' : `
                <div class="acc-timeline">
                    ${history.slice(0, 10).map(h => `
                        <div class="acc-timeline-item">
                            <div class="acc-timeline-content">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: 600;">${App.formatCurrency(h.balance)}</div>
                                        <div style="font-size: 11px; color: var(--text-muted);">${App.formatDate(h.date)} · ${h.type === 'referencia' ? 'Referencia' : 'Manual'}${h.notes ? ` · ${App.escapeHtml(h.notes)}` : ''}</div>
                                    </div>
                                    <span class="badge ${h.type === 'referencia' ? 'badge-info' : 'badge-success'}">${h.type}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}

            <div class="acc-section-title">Últimos movimientos (${movements.length})</div>
            ${movements.length === 0 ? '<p style="font-size: 13px; color: var(--text-muted);">Sin movimientos.</p>' : `
                <div style="max-height: 300px; overflow-y: auto;">
                    ${movements.slice(0, 15).map(m => `
                        <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border-light); font-size: 13px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 500;">${App.escapeHtml(m.concept)}</div>
                                <div style="font-size: 11px; color: var(--text-muted);">${App.formatDate(m.date)} · ${getMovementTypeBadge(m.type)}</div>
                            </div>
                            <div style="font-weight: 600; color: ${m.amount > 0 ? 'var(--success)' : 'var(--danger)'};">
                                ${m.amount > 0 ? '+' : ''}${App.formatCurrency(m.amount)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}

            ${reconciliations.length > 0 ? `
                <div class="acc-section-title">Conciliaciones</div>
                <div style="max-height: 200px; overflow-y: auto;">
                    ${reconciliations.slice(0, 5).map(r => `
                        <div style="padding: 8px; background: var(--border-light); border-radius: var(--radius-sm); margin-bottom: 6px; font-size: 12px;">
                            <div style="display: flex; justify-content: space-between;">
                                <strong>${App.formatDate(r.date)}</strong>
                                <span class="badge ${r.status === 'conciliado' ? 'badge-success' : 'badge-warning'}">${r.status}</span>
                            </div>
                            <div style="margin-top: 4px; color: var(--text-secondary);">
                                Manual: ${App.formatCurrency(r.manualBalance)} · Estimado: ${App.formatCurrency(r.estimatedBalance)} · Diferencia: ${App.formatCurrency(r.difference)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <div style="display: flex; gap: 8px; margin-top: 16px;">
                <button class="btn btn-primary" id="detailUpdateBtn"><i class="fas fa-sync"></i> Actualizar saldo</button>
                <button class="btn btn-secondary" id="detailEditBtn"><i class="fas fa-edit"></i> Editar cuenta</button>
                <button class="btn btn-secondary" id="detailMovBtn"><i class="fas fa-plus"></i> Nuevo movimiento</button>
            </div>
        `;

        body.querySelector('#detailUpdateBtn').addEventListener('click', () => {
            modal.classList.remove('active');
            openBalanceModal(accountId);
        });
        body.querySelector('#detailEditBtn').addEventListener('click', () => {
            modal.classList.remove('active');
            openAccountModal(accountId);
        });
        body.querySelector('#detailMovBtn').addEventListener('click', () => {
            modal.classList.remove('active');
            openMovementModal(null, accountId);
        });

        modal.classList.add('active');
    }

    // =========================================================
    // UTILIDADES
    // =========================================================
    function exportMovements() {
        const rows = [['Fecha', 'Concepto', 'Cuenta', 'Tipo', 'Importe', 'Persona', 'Estado', 'Origen', 'Notas']];
        accData.movements.forEach(m => {
            const acc = getAccountById(m.accountId);
            rows.push([
                App.formatDate(m.date),
                m.concept,
                acc ? acc.name : '',
                getMovementTypeLabel(m.type),
                m.amount.toFixed(2),
                App.getProfileName(m.person),
                m.status,
                m.origin,
                m.notes || ''
            ]);
        });
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'movimientos.csv'; a.click();
        URL.revokeObjectURL(url);
        App.showToast('CSV exportado');
    }

    // Cerrar dropdowns
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.acc-action-menu')) {
            containerEl && containerEl.querySelectorAll('.acc-action-dropdown.open').forEach(m => m.classList.remove('open'));
        }
    });

    // =========================================================
    // INIT
    // =========================================================
    function init() {}

    function onThemeChange() {
        if (currentView === 'resumen') renderCharts();
    }

    // =========================================================
    // API PÚBLICA
    // =========================================================
    return {
        render,
        init,
        onThemeChange,
        openAccountModal,
        openBalanceModal,
        openMovementModal,
        openTransferModal
    };
})();

// Registrar sección
App.registerSection('cuentas', {
    render: (container) => AccountsApp.render(container),
    init: () => AccountsApp.init(),
    onThemeChange: () => AccountsApp.onThemeChange()
});

window.AccountsApp = AccountsApp;