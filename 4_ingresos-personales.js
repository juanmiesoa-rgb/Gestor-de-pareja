/* =============================================================
   MI-DINERO.JS
   Sección completa con 6 vistas:
   - Resumen (indicadores por persona y conjunto)
   - Nóminas (perfil salarial, cálculo neto estimado vs real)
   - Gastos individuales obligatorios
   - Distribución del dinero restante
   - Pagas extras (con distribución independiente)
   - Configuración
   
   Regla clave: el mayor número de pagas de la pareja (15 vs 14)
   se usa como referencia común para normalizar el ingreso mensual.
   ============================================================= */
const MyMoneyApp = (function () {
    'use strict';

    // =========================================================
    // ESTILOS ESPECÍFICOS
    // =========================================================
    function injectStyles() {
        if (document.getElementById('mymoney-styles')) return;
        const style = document.createElement('style');
        style.id = 'mymoney-styles';
        style.textContent = `
            /* Sub-navegación */
            .mm-subnav {
                display: flex; gap: 4px;
                border-bottom: 1px solid var(--border);
                margin-bottom: 24px;
                overflow-x: auto;
            }
            .mm-subnav-item {
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
            .mm-subnav-item:hover { color: var(--text); }
            .mm-subnav-item.active { color: var(--primary); border-bottom-color: var(--primary); }

            .mm-subview { display: none; }
            .mm-subview.active { display: block; }

            /* Person tabs */
            .mm-person-tabs {
                display: flex; gap: 8px; margin-bottom: 20px;
                padding: 4px; background: var(--border-light);
                border-radius: var(--radius);
            }
            .mm-person-tab {
                flex: 1; padding: 10px;
                background: transparent; border: none;
                color: var(--text-secondary);
                font-size: 13px; font-weight: 500;
                cursor: pointer; border-radius: var(--radius-sm);
                transition: all 0.15s; font-family: inherit;
                display: flex; align-items: center; justify-content: center; gap: 8px;
            }
            .mm-person-tab.active {
                background: var(--bg-card); color: var(--text);
                box-shadow: var(--shadow-sm);
            }
            .mm-person-avatar {
                width: 22px; height: 22px; border-radius: 50%;
                display: inline-flex; align-items: center; justify-content: center;
                font-size: 11px; font-weight: 700;
            }

            /* Stats */
            .mm-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
            @media (max-width: 1024px) { .mm-stats { grid-template-columns: repeat(2, 1fr); } }
            @media (max-width: 480px) { .mm-stats { grid-template-columns: 1fr; } }

            .mm-stat {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 16px;
                transition: all 0.2s;
            }
            .mm-stat:hover { box-shadow: var(--shadow-md); }
            .mm-stat-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
            .mm-stat-icon {
                width: 34px; height: 34px; border-radius: 10px;
                display: flex; align-items: center; justify-content: center;
                font-size: 15px;
            }
            .mm-stat-label { font-size: 11px; color: var(--text-secondary); font-weight: 500; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.3px; }
            .mm-stat-value { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
            .mm-stat-meta { font-size: 11px; color: var(--text-muted); }
            .mm-stat-meta.estimated { font-style: italic; color: var(--warning); }

            /* Profile cards */
            .mm-profile-card {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                overflow: hidden;
                margin-bottom: 16px;
            }
            .mm-profile-header {
                padding: 16px 20px;
                background: linear-gradient(135deg, var(--profile-color, var(--primary)), var(--profile-color-end, #7c3aed));
                color: white;
                display: flex; align-items: center; gap: 14px;
            }
            .mm-profile-avatar {
                width: 48px; height: 48px; border-radius: 50%;
                background: rgba(255,255,255,0.2);
                display: flex; align-items: center; justify-content: center;
                font-size: 20px; font-weight: 700;
            }
            .mm-profile-info { flex: 1; }
            .mm-profile-name { font-size: 18px; font-weight: 700; }
            .mm-profile-sub { font-size: 12px; opacity: 0.9; }
            .mm-profile-body { padding: 16px 20px; }

            /* Distribution bars */
            .mm-dist-item {
                margin-bottom: 14px;
            }
            .mm-dist-head {
                display: flex; justify-content: space-between; align-items: center;
                margin-bottom: 6px;
            }
            .mm-dist-label {
                display: flex; align-items: center; gap: 8px;
                font-size: 13px; font-weight: 500;
            }
            .mm-dist-icon {
                width: 24px; height: 24px; border-radius: 6px;
                display: flex; align-items: center; justify-content: center;
                font-size: 11px; color: white;
            }
            .mm-dist-values {
                display: flex; gap: 8px; align-items: center;
                font-size: 13px;
            }
            .mm-dist-amount { font-weight: 700; }
            .mm-dist-pct { color: var(--text-muted); font-size: 12px; }
            .mm-dist-bar {
                width: 100%; height: 8px;
                background: var(--border-light);
                border-radius: 4px; overflow: hidden;
            }
            .mm-dist-bar-fill {
                height: 100%; border-radius: 4px;
                transition: width 0.3s;
            }

            /* Slider input */
            .mm-slider-row {
                display: flex; align-items: center; gap: 12px;
                margin-bottom: 14px;
            }
            .mm-slider-row label {
                flex: 0 0 160px;
                font-size: 13px; font-weight: 500;
            }
            .mm-slider-row input[type="range"] {
                flex: 1;
                accent-color: var(--primary);
            }
            .mm-slider-row .mm-slider-value {
                flex: 0 0 100px; text-align: right;
                font-weight: 700; font-size: 13px;
            }

            /* Tables */
            .mm-table-wrap { overflow-x: auto; }
            .mm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
            .mm-table th {
                text-align: left; padding: 10px 12px;
                font-size: 11px; font-weight: 600;
                color: var(--text-muted);
                text-transform: uppercase; letter-spacing: 0.5px;
                border-bottom: 1px solid var(--border);
                background: var(--bg-card);
            }
            .mm-table td {
                padding: 12px;
                border-bottom: 1px solid var(--border-light);
                vertical-align: middle;
            }
            .mm-table tr:hover td { background: var(--border-light); }
            .mm-table .amount { font-weight: 600; font-variant-numeric: tabular-nums; }
            .mm-table .amount.positive { color: var(--success); }
            .mm-table .amount.negative { color: var(--danger); }

            /* Forms */
            .mm-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
            .mm-form-row.single { grid-template-columns: 1fr; }
            .mm-form-row.three { grid-template-columns: repeat(3, 1fr); }
            @media (max-width: 768px) {
                .mm-form-row, .mm-form-row.three { grid-template-columns: 1fr; }
            }

            .mm-form-group { margin-bottom: 14px; }
            .mm-form-label {
                display: block; font-size: 12px; font-weight: 500;
                color: var(--text-secondary); margin-bottom: 6px;
            }
            .mm-form-input, .mm-form-select, .mm-form-textarea {
                width: 100%; padding: 9px 12px;
                border: 1px solid var(--border); border-radius: var(--radius-sm);
                background: var(--bg-card); color: var(--text);
                font-size: 13px; font-family: inherit;
            }
            .mm-form-input:focus, .mm-form-select:focus { outline: none; border-color: var(--primary); }
            .mm-form-textarea { resize: vertical; min-height: 70px; }
            .mm-form-hint { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
            .mm-form-error { font-size: 11px; color: var(--danger); margin-top: 4px; display: none; }
            .mm-form-group.error .mm-form-input,
            .mm-form-group.error .mm-form-select { border-color: var(--danger); }
            .mm-form-group.error .mm-form-error { display: block; }

            /* Modal */
            .mm-modal {
                display: none; position: fixed; inset: 0;
                background: rgba(0,0,0,0.5); z-index: 1000;
                align-items: center; justify-content: center;
                padding: 20px;
            }
            .mm-modal.active { display: flex; }
            .mm-modal-content {
                background: var(--bg-card); border-radius: var(--radius-lg);
                max-width: 600px; width: 100%;
                max-height: 90vh; overflow-y: auto;
                box-shadow: var(--shadow-md);
            }
            .mm-modal-header {
                padding: 20px; border-bottom: 1px solid var(--border);
                display: flex; justify-content: space-between; align-items: center;
                position: sticky; top: 0; background: var(--bg-card); z-index: 1;
            }
            .mm-modal-title { font-size: 16px; font-weight: 600; }
            .mm-modal-close {
                background: none; border: none;
                color: var(--text-muted); cursor: pointer;
                font-size: 18px; padding: 4px;
            }
            .mm-modal-body { padding: 20px; }
            .mm-modal-footer {
                padding: 16px 20px; border-top: 1px solid var(--border);
                display: flex; justify-content: flex-end; gap: 8px;
                position: sticky; bottom: 0; background: var(--bg-card);
            }

            /* Section title */
            .mm-section-title {
                font-size: 13px; font-weight: 600;
                text-transform: uppercase; letter-spacing: 0.5px;
                color: var(--text-muted);
                margin: 20px 0 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--border);
            }

            /* Empty */
            .mm-empty {
                text-align: center; padding: 40px 20px;
                color: var(--text-muted);
            }
            .mm-empty i { font-size: 40px; margin-bottom: 12px; opacity: 0.5; }
            .mm-empty h3 { font-size: 15px; color: var(--text); margin-bottom: 6px; }
            .mm-empty p { font-size: 13px; margin-bottom: 16px; }

            /* Config */
            .mm-config-section { margin-bottom: 24px; }
            .mm-config-section h3 {
                font-size: 14px; font-weight: 600;
                margin-bottom: 12px; padding-bottom: 8px;
                border-bottom: 1px solid var(--border);
                display: flex; align-items: center; gap: 8px;
            }
            .mm-config-row {
                display: flex; justify-content: space-between; align-items: center;
                padding: 10px 0;
                border-bottom: 1px solid var(--border-light);
                font-size: 13px;
                gap: 12px;
            }
            .mm-config-row:last-child { border-bottom: none; }
            .mm-config-row .label { color: var(--text-secondary); flex: 1; }

            /* Switch */
            .mm-switch { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; }
            .mm-switch input { opacity: 0; width: 0; height: 0; }
            .mm-slider {
                position: absolute; cursor: pointer; inset: 0;
                background: var(--border); border-radius: 20px;
                transition: 0.2s;
            }
            .mm-slider:before {
                position: absolute; content: "";
                height: 14px; width: 14px; left: 3px; bottom: 3px;
                background: white; border-radius: 50%;
                transition: 0.2s;
            }
            .mm-switch input:checked + .mm-slider { background: var(--primary); }
            .mm-switch input:checked + .mm-slider:before { transform: translateX(16px); }

            /* Action menu */
            .mm-action-menu { position: relative; display: inline-block; }
            .mm-action-dropdown {
                display: none;
                position: absolute; right: 0; top: 100%;
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                box-shadow: var(--shadow-md);
                min-width: 170px;
                z-index: 50; padding: 4px;
            }
            .mm-action-dropdown.open { display: block; }
            .mm-action-dropdown button {
                display: flex; align-items: center; gap: 8px;
                width: 100%; padding: 8px 10px;
                background: none; border: none;
                color: var(--text); font-size: 13px;
                cursor: pointer; border-radius: 4px;
                text-align: left; font-family: inherit;
            }
            .mm-action-dropdown button:hover { background: var(--border-light); }
            .mm-action-dropdown button.danger { color: var(--danger); }
            .mm-action-dropdown button i { width: 14px; color: var(--text-muted); }
            .mm-action-dropdown button.danger i { color: var(--danger); }

            /* Alert banner */
            .mm-alert {
                padding: 12px 14px;
                border-radius: var(--radius-sm);
                margin-bottom: 12px;
                display: flex; align-items: flex-start; gap: 10px;
                font-size: 13px;
            }
            .mm-alert.warning { background: var(--warning-light); color: var(--warning); border-left: 3px solid var(--warning); }
            .mm-alert.danger { background: var(--danger-light); color: var(--danger); border-left: 3px solid var(--danger); }
            .mm-alert.info { background: var(--info-light); color: var(--info); border-left: 3px solid var(--info); }
            .mm-alert.success { background: var(--success-light); color: var(--success); border-left: 3px solid var(--success); }

            /* Pays list */
            .mm-pay-item {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 14px;
                margin-bottom: 10px;
                display: flex; align-items: center; gap: 14px;
            }
            .mm-pay-date {
                min-width: 70px; text-align: center;
                padding: 8px;
                background: var(--border-light);
                border-radius: var(--radius-sm);
            }
            .mm-pay-date .d { font-size: 18px; font-weight: 700; line-height: 1; }
            .mm-pay-date .m { font-size: 10px; color: var(--text-muted); text-transform: uppercase; }
            .mm-pay-info { flex: 1; }
            .mm-pay-title { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
            .mm-pay-meta { font-size: 11px; color: var(--text-muted); }
            .mm-pay-amount { font-size: 16px; font-weight: 700; text-align: right; }

            /* Comparison */
            .mm-compare-row {
                display: flex; justify-content: space-between; align-items: center;
                padding: 10px 0;
                border-bottom: 1px solid var(--border-light);
                font-size: 13px;
            }
            .mm-compare-row:last-child { border-bottom: none; }
            .mm-compare-row .lbl { color: var(--text-secondary); }
            .mm-compare-row .val { font-weight: 600; }
            .mm-compare-row .val.positive { color: var(--success); }
            .mm-compare-row .val.negative { color: var(--danger); }
            .mm-compare-row .val.estimated { color: var(--warning); font-style: italic; }

            /* Mobile */
            @media (max-width: 768px) {
                .mm-slider-row { flex-direction: column; align-items: stretch; }
                .mm-slider-row label { flex: none; }
                .mm-slider-row .mm-slider-value { flex: none; text-align: left; }
            }
        `;
        document.head.appendChild(style);
    }

    // =========================================================
    // DATOS POR DEFECTO
    // =========================================================
    const DEFAULT_MY_MONEY_DATA = {
        // Datos salariales por persona
        salaryProfiles: {
            ana: {
                personId: 'ana',
                company: 'TechCorp SL',
                grossAnnual: 38000,
                paysPerYear: 15, // 14 pagas + 1 prorrateo (o 12+3 extras)
                grossPerPay: null, // Se calcula si es null
                socialSecurity: 160, // €/mes aproximado
                irpfPercent: 18,
                irpfAmount: null,
                otherDeductions: 30,
                otherComplements: 50,
                usualPayDay: 1, // día del mes
                extraPayDates: ['2026-07-01', '2026-12-01'], // pagas extras reales
                extraPayType: 'separate', // separate o prorated
                notes: 'Datos actualizados según nómina de septiembre 2026'
            },
            carlos: {
                personId: 'carlos',
                company: 'Consultora ABC',
                grossAnnual: 42000,
                paysPerYear: 14, // 12 + 2 extras
                grossPerPay: null,
                socialSecurity: 180,
                irpfPercent: 20,
                irpfAmount: null,
                otherDeductions: 25,
                otherComplements: 0,
                usualPayDay: 5,
                extraPayDates: ['2026-07-15', '2026-12-15'],
                extraPayType: 'separate',
                notes: ''
            }
        },

        // Ingreso mensual neto REAL introducido manualmente (prioriza sobre estimado)
        realMonthlyIncome: {
            ana: 2350,
            carlos: null // Pendiente de introducir
        },

        // Gastos individuales obligatorios
        individualExpenses: [
            // Ana
            { id: 'ie-1', personId: 'ana', name: 'Seguro médico', category: 'salud', amount: 45, frequency: 'monthly', nextPayment: '2026-11-05', account: 'acc-ana', active: true, mandatory: true, notes: '' },
            { id: 'ie-2', personId: 'ana', name: 'Suscripción gimnasio', category: 'suscripciones', amount: 35, frequency: 'monthly', nextPayment: '2026-11-01', account: 'acc-ana', active: true, mandatory: true, notes: '' },
            { id: 'ie-3', personId: 'ana', name: 'Teléfono móvil', category: 'telefono', amount: 25, frequency: 'monthly', nextPayment: '2026-11-10', account: 'acc-ana', active: true, mandatory: true, notes: '' },
            { id: 'ie-4', personId: 'ana', name: 'Seguro coche', category: 'coche', amount: 480, frequency: 'annual', nextPayment: '2027-03-15', account: 'acc-ana', active: true, mandatory: true, notes: 'Anual, equivale a 40€/mes' },
            // Carlos
            { id: 'ie-5', personId: 'carlos', name: 'Financiación coche', category: 'coche', amount: 220, frequency: 'monthly', nextPayment: '2026-11-10', account: 'acc-carlos', active: true, mandatory: true, notes: 'Préstamo vehículo' },
            { id: 'ie-6', personId: 'carlos', name: 'Gasolina', category: 'coche', amount: 120, frequency: 'monthly', nextPayment: '2026-11-05', account: 'acc-carlos', active: true, mandatory: true, notes: 'Media mensual estimada' },
            { id: 'ie-7', personId: 'carlos', name: 'Parking mensual', category: 'coche', amount: 80, frequency: 'monthly', nextPayment: '2026-11-01', account: 'acc-carlos', active: true, mandatory: true, notes: '' },
            { id: 'ie-8', personId: 'carlos', name: 'Netflix personal', category: 'suscripciones', amount: 12.99, frequency: 'monthly', nextPayment: '2026-11-08', account: 'acc-carlos', active: true, mandatory: false, notes: 'Suscripción individual' },
            { id: 'ie-9', personId: 'carlos', name: 'Seguro médico', category: 'salud', amount: 55, frequency: 'monthly', nextPayment: '2026-11-05', account: 'acc-carlos', active: true, mandatory: true, notes: '' }
        ],

        // Distribución mensual del dinero restante (debe sumar 100%)
        monthlyDistribution: {
            ana: {
                shared: 45,
                mortgage: 25,
                trips: 15,
                personal: 15
            },
            carlos: {
                shared: 50,
                mortgage: 20,
                trips: 15,
                personal: 15
            }
        },

        // Distribución de pagas extras (independiente, debe sumar 100%)
        extraPayDistribution: {
            ana: {
                shared: 20,
                mortgage: 40,
                trips: 25,
                personal: 15
            },
            carlos: {
                shared: 15,
                mortgage: 45,
                trips: 25,
                personal: 15
            }
        },

        // Pagas extras reales registradas
        extraPays: [
            { id: 'ep-1', personId: 'ana', date: '2026-07-01', type: 'extraordinary', estimatedAmount: 2533.33, realAmount: 2580, status: 'received', notes: 'Paga verano cobrada' },
            { id: 'ep-2', personId: 'carlos', date: '2026-07-15', type: 'extraordinary', estimatedAmount: 3000, realAmount: 3000, status: 'received', notes: '' }
        ],

        // Ahorros acumulados (registrados manualmente)
        savings: {
            mortgage: {
                ana: 8500,
                carlos: 7200,
                goal: 40000
            },
            trips: {
                ana: 1200,
                carlos: 1100
            }
        },

        // Aportaciones reales registradas a gastos compartidos (histórico)
        sharedContributions: [
            { id: 'sc-1', personId: 'ana', date: '2026-10-02', amount: 1057.50, month: '2026-10', notes: 'Aportación octubre' },
            { id: 'sc-2', personId: 'carlos', date: '2026-10-05', amount: 1175, month: '2026-10', notes: 'Aportación octubre' }
        ],

        // Historial de cambios
        history: [],

        // Configuración
        settings: {
            defaultView: 'resumen',
            showEstimatedWhenNoReal: true,
            warningNegativeRemaining: true
        }
    };

    // =========================================================
    // ESTADO
    // =========================================================
    let myData = loadData();
    let currentView = 'resumen';
    let currentPerson = 'ana';
    let containerEl = null;

    function loadData() {
        try {
            const saved = localStorage.getItem('finanzas_mymoney_data');
            if (saved) {
                const parsed = JSON.parse(saved);
                return Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_MY_MONEY_DATA)), parsed);
            }
        } catch (e) {}
        return JSON.parse(JSON.stringify(DEFAULT_MY_MONEY_DATA));
    }

    function saveData() {
        try {
            localStorage.setItem('finanzas_mymoney_data', JSON.stringify(myData));
        } catch (e) {}
    }

    // =========================================================
    // CÁLCULOS FINANCIEROS
    // =========================================================
    
    /**
     * Referencia común: el mayor número de pagas de la pareja.
     * Regla fundamental del proyecto.
     */
    function getCommonPaysReference() {
        const pays = Object.values(myData.salaryProfiles).map(p => p.paysPerYear || 12);
        return Math.max(...pays);
    }

    /**
     * Calcula el neto anual estimado de una persona.
     */
    function getEstimatedNetAnnual(personId) {
        const profile = myData.salaryProfiles[personId];
        if (!profile) return 0;

        const grossAnnual = profile.grossAnnual || 0;
        const ssAnnual = (profile.socialSecurity || 0) * 12;
        
        // IRPF: si hay importe fijo usarlo, si no calcular del %
        let irpfAnnual;
        if (profile.irpfAmount !== null && profile.irpfAmount !== undefined && profile.irpfAmount > 0) {
            irpfAnnual = profile.irpfAmount * 12;
        } else {
            irpfAnnual = grossAnnual * ((profile.irpfPercent || 0) / 100);
        }
        
        const otherDedAnnual = (profile.otherDeductions || 0) * 12;
        const otherCompAnnual = (profile.otherComplements || 0) * 12;

        const netAnnual = grossAnnual - ssAnnual - irpfAnnual - otherDedAnnual + otherCompAnnual;
        return Math.max(0, netAnnual);
    }

    /**
     * Neto mensual estimado NORMALIZADO usando la referencia común de pagas.
     * Si una persona cobra 14 pagas y la otra 15, ambas se dividen entre 15.
     */
    function getNormalizedMonthlyEstimated(personId) {
        const netAnnual = getEstimatedNetAnnual(personId);
        const reference = getCommonPaysReference();
        return netAnnual / reference;
    }

    /**
     * Ingreso mensual UTILIZADO para planificación:
     * - Si existe real introducido → usar real
     * - Si no → usar estimado normalizado
     */
    function getMonthlyIncomeUsed(personId) {
        const real = myData.realMonthlyIncome[personId];
        if (real !== null && real !== undefined && real > 0) {
            return real;
        }
        return getNormalizedMonthlyEstimated(personId);
    }

    /**
     * Total de gastos individuales mensuales EQUIVALENTES (normalizados).
     */
    function getIndividualExpensesMonthly(personId) {
        return myData.individualExpenses
            .filter(e => e.personId === personId && e.active !== false)
            .reduce((sum, e) => sum + normalizeToMonthly(e.amount, e.frequency), 0);
    }

    /**
     * Normaliza un importe a equivalente mensual según frecuencia.
     */
    function normalizeToMonthly(amount, frequency) {
        const a = parseFloat(amount) || 0;
        switch (frequency) {
            case 'weekly': return a * 52 / 12;
            case 'monthly': return a;
            case 'quarterly': return a / 3;
            case 'semiannual': return a / 6;
            case 'annual': return a / 12;
            default: return a;
        }
    }

    /**
     * Dinero restante mensual después de gastos obligatorios.
     */
    function getRemainingMonthly(personId) {
        return getMonthlyIncomeUsed(personId) - getIndividualExpensesMonthly(personId);
    }

    /**
     * Calcula la distribución de una persona (importes por categoría).
     */
    function getDistribution(personId, distributionType = 'monthly') {
        const dist = distributionType === 'extra' 
            ? myData.extraPayDistribution[personId] 
            : myData.monthlyDistribution[personId];
        const base = distributionType === 'extra' ? 0 : getRemainingMonthly(personId);
        
        return {
            shared: base * (dist.shared / 100),
            mortgage: base * (dist.mortgage / 100),
            trips: base * (dist.trips / 100),
            personal: base * (dist.personal / 100)
        };
    }

    /**
     * Valida que los porcentajes sumen 100%.
     */
    function validateDistribution(dist) {
        const total = dist.shared + dist.mortgage + dist.trips + dist.personal;
        return Math.abs(total - 100) < 0.01;
    }

    /**
     * Obtiene el perfil de una persona desde App.data.
     */
    function getPersonProfile(personId) {
        return App.data.profiles.find(p => p.id === personId) || { id: personId, name: personId, initial: '?', color: '#94a3b8' };
    }

    /**
     * Próxima nómina mensual de una persona.
     */
    function getNextMonthlyPayDate(personId) {
        const profile = myData.salaryProfiles[personId];
        if (!profile) return null;
        const today = new Date(2026, 9, 30); // Fecha demo
        const day = profile.usualPayDay || 1;
        let next = new Date(today.getFullYear(), today.getMonth(), day);
        if (next < today) {
            next = new Date(today.getFullYear(), today.getMonth() + 1, day);
        }
        return next.toISOString().substring(0, 10);
    }

    // =========================================================
    // RENDER PRINCIPAL
    // =========================================================
    function render(container) {
        injectStyles();
        containerEl = container;

        container.innerHTML = `
            <div class="mm-subnav">
                <button class="mm-subnav-item active" data-view="resumen"><i class="fas fa-chart-pie"></i> Resumen</button>
                <button class="mm-subnav-item" data-view="nominas"><i class="fas fa-file-invoice-dollar"></i> Nóminas</button>
                <button class="mm-subnav-item" data-view="gastos"><i class="fas fa-receipt"></i> Gastos individuales</button>
                <button class="mm-subnav-item" data-view="distribucion"><i class="fas fa-sliders-h"></i> Distribución</button>
                <button class="mm-subnav-item" data-view="pagas"><i class="fas fa-gift"></i> Pagas extras</button>
                <button class="mm-subnav-item" data-view="configuracion"><i class="fas fa-cog"></i> Configuración</button>
            </div>

            <div class="mm-subview active" id="mmView-resumen"></div>
            <div class="mm-subview" id="mmView-nominas"></div>
            <div class="mm-subview" id="mmView-gastos"></div>
            <div class="mm-subview" id="mmView-distribucion"></div>
            <div class="mm-subview" id="mmView-pagas"></div>
            <div class="mm-subview" id="mmView-configuracion"></div>

            <!-- Modal Perfil Salarial -->
            <div class="mm-modal" id="mmSalaryModal">
                <div class="mm-modal-content">
                    <div class="mm-modal-header">
                        <h3 class="mm-modal-title" id="mmSalaryModalTitle">Editar perfil salarial</h3>
                        <button class="mm-modal-close" data-close-mm><i class="fas fa-times"></i></button>
                    </div>
                    <div class="mm-modal-body" id="mmSalaryModalBody"></div>
                    <div class="mm-modal-footer">
                        <button class="btn btn-secondary" data-close-mm>Cancelar</button>
                        <button class="btn btn-primary" id="mmSaveSalaryBtn"><i class="fas fa-save"></i> Guardar</button>
                    </div>
                </div>
            </div>

            <!-- Modal Gasto Individual -->
            <div class="mm-modal" id="mmExpenseModal">
                <div class="mm-modal-content">
                    <div class="mm-modal-header">
                        <h3 class="mm-modal-title" id="mmExpenseModalTitle">Nuevo gasto individual</h3>
                        <button class="mm-modal-close" data-close-mm><i class="fas fa-times"></i></button>
                    </div>
                    <div class="mm-modal-body" id="mmExpenseModalBody"></div>
                    <div class="mm-modal-footer">
                        <button class="btn btn-secondary" data-close-mm>Cancelar</button>
                        <button class="btn btn-primary" id="mmSaveExpenseBtn"><i class="fas fa-save"></i> Guardar</button>
                    </div>
                </div>
            </div>

            <!-- Modal Paga Extra -->
            <div class="mm-modal" id="mmExtraPayModal">
                <div class="mm-modal-content">
                    <div class="mm-modal-header">
                        <h3 class="mm-modal-title" id="mmExtraPayModalTitle">Registrar paga extra</h3>
                        <button class="mm-modal-close" data-close-mm><i class="fas fa-times"></i></button>
                    </div>
                    <div class="mm-modal-body" id="mmExtraPayModalBody"></div>
                    <div class="mm-modal-footer">
                        <button class="btn btn-secondary" data-close-mm>Cancelar</button>
                        <button class="btn btn-primary" id="mmSaveExtraPayBtn"><i class="fas fa-save"></i> Guardar</button>
                    </div>
                </div>
            </div>
        `;

        bindGlobalEvents();
        renderView(currentView);
    }

    function bindGlobalEvents() {
        containerEl.querySelectorAll('.mm-subnav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                currentView = btn.dataset.view;
                containerEl.querySelectorAll('.mm-subnav-item').forEach(b => b.classList.toggle('active', b === btn));
                containerEl.querySelectorAll('.mm-subview').forEach(v => v.classList.toggle('active', v.id === `mmView-${currentView}`));
                renderView(currentView);
            });
        });

        containerEl.querySelectorAll('[data-close-mm]').forEach(btn => {
            btn.addEventListener('click', () => btn.closest('.mm-modal').classList.remove('active'));
        });
        containerEl.querySelectorAll('.mm-modal').forEach(modal => {
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
        });

        containerEl.querySelector('#mmSaveSalaryBtn').addEventListener('click', saveSalaryProfile);
        containerEl.querySelector('#mmSaveExpenseBtn').addEventListener('click', saveIndividualExpense);
        containerEl.querySelector('#mmSaveExtraPayBtn').addEventListener('click', saveExtraPay);
    }

    function switchView(view) {
        currentView = view;
        containerEl.querySelectorAll('.mm-subnav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
        containerEl.querySelectorAll('.mm-subview').forEach(v => v.classList.toggle('active', v.id === `mmView-${view}`));
        renderView(view);
    }

    function renderView(view) {
        if (view === 'resumen') renderResumen();
        else if (view === 'nominas') renderNominas();
        else if (view === 'gastos') renderGastos();
        else if (view === 'distribucion') renderDistribucion();
        else if (view === 'pagas') renderPagas();
        else if (view === 'configuracion') renderConfiguracion();
    }

    // =========================================================
    // VISTA: RESUMEN
    // =========================================================
    function renderResumen() {
        const view = containerEl.querySelector('#mmView-resumen');
        const reference = getCommonPaysReference();

        // Cálculos por persona
        const people = App.data.profiles.map(p => {
            const normalized = getNormalizedMonthlyEstimated(p.id);
            const real = myData.realMonthlyIncome[p.id];
            const used = getMonthlyIncomeUsed(p.id);
            const expenses = getIndividualExpensesMonthly(p.id);
            const remaining = getRemainingMonthly(p.id);
            const dist = getDistribution(p.id);
            const hasReal = real !== null && real !== undefined && real > 0;
            return {
                profile: p,
                normalized,
                real,
                used,
                expenses,
                remaining,
                distribution: dist,
                hasReal
            };
        });

        const totalIncome = people.reduce((s, p) => s + p.used, 0);
        const totalExpenses = people.reduce((s, p) => s + p.expenses, 0);
        const totalRemaining = people.reduce((s, p) => s + p.remaining, 0);
        const totalShared = people.reduce((s, p) => s + p.distribution.shared, 0);
        const totalMortgage = people.reduce((s, p) => s + p.distribution.mortgage, 0);
        const totalTrips = people.reduce((s, p) => s + p.distribution.trips, 0);

        view.innerHTML = `
            <div class="mm-alert info">
                <i class="fas fa-info-circle"></i>
                <div>
                    <strong>Referencia común de pagas: ${reference}</strong>
                    El ingreso mensual estimado se normaliza dividiendo el neto anual entre ${reference} (el mayor número de pagas de la pareja) para poder comparar y planificar de forma homogénea.
                </div>
            </div>

            <div class="mm-stats">
                <div class="mm-stat">
                    <div class="mm-stat-head">
                        <div>
                            <div class="mm-stat-label">Ingresos mensuales</div>
                            <div class="mm-stat-value">${App.formatCurrency(totalIncome)}</div>
                            <div class="mm-stat-meta">Suma de ambos perfiles</div>
                        </div>
                        <div class="mm-stat-icon" style="background: var(--success-light); color: var(--success);"><i class="fas fa-euro-sign"></i></div>
                    </div>
                </div>
                <div class="mm-stat">
                    <div class="mm-stat-head">
                        <div>
                            <div class="mm-stat-label">Gastos individuales</div>
                            <div class="mm-stat-value">${App.formatCurrency(totalExpenses)}</div>
                            <div class="mm-stat-meta">Obligatorios normalizados</div>
                        </div>
                        <div class="mm-stat-icon" style="background: var(--danger-light); color: var(--danger);"><i class="fas fa-receipt"></i></div>
                    </div>
                </div>
                <div class="mm-stat">
                    <div class="mm-stat-head">
                        <div>
                            <div class="mm-stat-label">Dinero restante</div>
                            <div class="mm-stat-value" style="color: ${totalRemaining >= 0 ? 'var(--success)' : 'var(--danger)'};">${App.formatCurrency(totalRemaining)}</div>
                            <div class="mm-stat-meta">Para distribuir</div>
                        </div>
                        <div class="mm-stat-icon" style="background: var(--primary-light); color: var(--primary);"><i class="fas fa-wallet"></i></div>
                    </div>
                </div>
                <div class="mm-stat">
                    <div class="mm-stat-head">
                        <div>
                            <div class="mm-stat-label">Aportación compartida</div>
                            <div class="mm-stat-value">${App.formatCurrency(totalShared)}</div>
                            <div class="mm-stat-meta">Presupuesto común</div>
                        </div>
                        <div class="mm-stat-icon" style="background: var(--info-light); color: var(--info);"><i class="fas fa-users"></i></div>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                ${people.map(p => renderPersonSummaryCard(p)).join('')}
            </div>

            <div class="card" style="margin-top: 16px;">
                <div class="card-header">
                    <div>
                        <div class="card-title">Distribución conjunta del dinero restante</div>
                        <div class="card-subtitle">Total: ${App.formatCurrency(totalRemaining)}</div>
                    </div>
                </div>
                ${renderDistributionSummary({
                    shared: totalShared,
                    mortgage: totalMortgage,
                    trips: totalTrips,
                    personal: people.reduce((s, p) => s + p.distribution.personal, 0)
                }, totalRemaining)}
            </div>

            <div class="card" style="margin-top: 16px;">
                <div class="card-header">
                    <div>
                        <div class="card-title">Próximos cobros</div>
                        <div class="card-subtitle">Nóminas y pagas previstas</div>
                    </div>
                </div>
                <div id="mmNextPaysList"></div>
            </div>
        `;

        renderNextPays();
    }

    function renderPersonSummaryCard(p) {
        const diff = p.hasReal ? p.real - p.normalized : null;
        return `
            <div class="mm-profile-card" style="--profile-color: ${p.profile.color}; --profile-color-end: ${p.profile.color}dd;">
                <div class="mm-profile-header">
                    <div class="mm-profile-avatar">${p.profile.initial}</div>
                    <div class="mm-profile-info">
                        <div class="mm-profile-name">${App.escapeHtml(p.profile.name)}</div>
                        <div class="mm-profile-sub">${myData.salaryProfiles[p.profile.id]?.company || 'Sin empresa'}</div>
                    </div>
                </div>
                <div class="mm-profile-body">
                    <div class="mm-compare-row">
                        <span class="lbl">Neto estimado normalizado</span>
                        <span class="val estimated">${App.formatCurrency(p.normalized)}</span>
                    </div>
                    <div class="mm-compare-row">
                        <span class="lbl">Ingreso mensual ${p.hasReal ? 'real' : 'utilizado'}</span>
                        <span class="val">${App.formatCurrency(p.used)}</span>
                    </div>
                    ${diff !== null ? `
                        <div class="mm-compare-row">
                            <span class="lbl">Diferencia (real − estimado)</span>
                            <span class="val ${diff >= 0 ? 'positive' : 'negative'}">${diff >= 0 ? '+' : ''}${App.formatCurrency(diff)}</span>
                        </div>
                    ` : ''}
                    <div class="mm-compare-row">
                        <span class="lbl">Gastos individuales</span>
                        <span class="val negative">−${App.formatCurrency(p.expenses)}</span>
                    </div>
                    <div class="mm-compare-row">
                        <span class="lbl"><strong>Dinero restante</strong></span>
                        <span class="val" style="color: ${p.remaining >= 0 ? 'var(--success)' : 'var(--danger)'};"><strong>${App.formatCurrency(p.remaining)}</strong></span>
                    </div>
                    ${p.remaining < 0 ? `
                        <div class="mm-alert danger" style="margin-top: 10px; margin-bottom: 0;">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span>Los gastos superan al ingreso utilizado</span>
                        </div>
                    ` : ''}
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-light);">
                        <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Distribución</div>
                        ${renderMiniDistribution(p.distribution, p.remaining)}
                    </div>
                    <div style="display: flex; gap: 6px; margin-top: 12px;">
                        <button class="btn btn-sm btn-secondary" data-person-action="edit-salary" data-person="${p.profile.id}" style="flex: 1;"><i class="fas fa-edit"></i> Nómina</button>
                        <button class="btn btn-sm btn-secondary" data-person-action="edit-expenses" data-person="${p.profile.id}" style="flex: 1;"><i class="fas fa-receipt"></i> Gastos</button>
                        <button class="btn btn-sm btn-secondary" data-person-action="edit-dist" data-person="${p.profile.id}" style="flex: 1;"><i class="fas fa-sliders-h"></i> %</button>
                    </div>
                </div>
            </div>
        `;
    }

    function renderMiniDistribution(dist, base) {
        const items = [
            { key: 'shared', label: 'Compartido', color: 'var(--primary)', icon: 'fa-users' },
            { key: 'mortgage', label: 'Hipoteca', color: 'var(--success)', icon: 'fa-home' },
            { key: 'trips', label: 'Viajes', color: 'var(--info)', icon: 'fa-plane' },
            { key: 'personal', label: 'Personal', color: 'var(--warning)', icon: 'fa-user' }
        ];
        return items.map(it => {
            const amount = base * (dist[it.key] / 100);
            return `
                <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0;">
                    <span style="color: var(--text-secondary);"><i class="fas ${it.icon}" style="color: ${it.color}; margin-right: 4px;"></i>${it.label}</span>
                    <span style="font-weight: 600;">${App.formatCurrency(amount)}</span>
                </div>
            `;
        }).join('');
    }

    function renderDistributionSummary(dist, total) {
        const items = [
            { key: 'shared', label: 'Gastos compartidos', color: 'var(--primary)', icon: 'fa-users' },
            { key: 'mortgage', label: 'Ahorro hipoteca', color: 'var(--success)', icon: 'fa-home' },
            { key: 'trips', label: 'Viajes', color: 'var(--info)', icon: 'fa-plane' },
            { key: 'personal', label: 'Dinero personal', color: 'var(--warning)', icon: 'fa-user' }
        ];
        return items.map(it => {
            const pct = total > 0 ? (dist[it.key] / total) * 100 : 0;
            return `
                <div class="mm-dist-item">
                    <div class="mm-dist-head">
                        <div class="mm-dist-label">
                            <div class="mm-dist-icon" style="background: ${it.color};"><i class="fas ${it.icon}"></i></div>
                            <span>${it.label}</span>
                        </div>
                        <div class="mm-dist-values">
                            <span class="mm-dist-amount">${App.formatCurrency(dist[it.key])}</span>
                            <span class="mm-dist-pct">${pct.toFixed(1)}%</span>
                        </div>
                    </div>
                    <div class="mm-dist-bar">
                        <div class="mm-dist-bar-fill" style="width: ${Math.min(pct, 100)}%; background: ${it.color};"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderNextPays() {
        const container = containerEl.querySelector('#mmNextPaysList');
        const pays = [];

        App.data.profiles.forEach(p => {
            const nextMonthly = getNextMonthlyPayDate(p.id);
            if (nextMonthly) {
                pays.push({
                    personId: p.id,
                    personName: p.name,
                    color: p.color,
                    initial: p.initial,
                    date: nextMonthly,
                    type: 'monthly',
                    title: `Nómina mensual`,
                    amount: getMonthlyIncomeUsed(p.id),
                    isEstimate: !myData.realMonthlyIncome[p.id]
                });
            }
        });

        // Pagas extras próximas
        Object.entries(myData.salaryProfiles).forEach(([personId, profile]) => {
            const person = getPersonProfile(personId);
            (profile.extraPayDates || []).forEach(date => {
                if (date >= '2026-10-30') {
                    const netPay = getEstimatedNetAnnual(personId) / (profile.paysPerYear || 14);
                    pays.push({
                        personId,
                        personName: person.name,
                        color: person.color,
                        initial: person.initial,
                        date,
                        type: 'extra',
                        title: 'Paga extra',
                        amount: netPay,
                        isEstimate: true
                    });
                }
            });
        });

        pays.sort((a, b) => a.date.localeCompare(b.date));

        if (pays.length === 0) {
            container.innerHTML = '<div class="mm-empty"><i class="fas fa-calendar-check"></i><h3>Sin cobros próximos</h3></div>';
            return;
        }

        container.innerHTML = pays.slice(0, 6).map(p => {
            const d = new Date(p.date + 'T00:00:00');
            return `
                <div class="mm-pay-item">
                    <div class="mm-pay-date" style="background: ${p.color}20; color: ${p.color};">
                        <div class="d">${d.getDate()}</div>
                        <div class="m">${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()]}</div>
                    </div>
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: ${p.color}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700;">${p.initial}</div>
                    <div class="mm-pay-info">
                        <div class="mm-pay-title">${p.title} · ${App.escapeHtml(p.personName)}</div>
                        <div class="mm-pay-meta">${App.formatDate(p.date)} ${p.isEstimate ? '· <em style="color: var(--warning);">Estimado</em>' : '· Real'}</div>
                    </div>
                    <div class="mm-pay-amount" style="color: var(--success);">${App.formatCurrency(p.amount)}</div>
                </div>
            `;
        }).join('');
    }

    // =========================================================
    // VISTA: NÓMINAS
    // =========================================================
    function renderNominas() {
        const view = containerEl.querySelector('#mmView-nominas');
        const reference = getCommonPaysReference();

        view.innerHTML = `
            <div class="mm-alert info">
                <i class="fas fa-calculator"></i>
                <div>
                    <strong>Referencia común: ${reference} pagas/año</strong>
                    El neto anual estimado se divide entre ${reference} para obtener el mensual normalizado. Esto permite comparar ingresos aunque cada persona cobre distinto número de pagas.
                </div>
            </div>

            <div class="mm-person-tabs">
                ${App.data.profiles.map(p => `
                    <button class="mm-person-tab ${currentPerson === p.id ? 'active' : ''}" data-person="${p.id}">
                        <span class="mm-person-avatar" style="background: ${p.color}30; color: ${p.color};">${p.initial}</span>
                        ${App.escapeHtml(p.name)}
                    </button>
                `).join('')}
            </div>

            <div id="mmSalaryContent"></div>
        `;

        view.querySelectorAll('.mm-person-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                currentPerson = tab.dataset.person;
                view.querySelectorAll('.mm-person-tab').forEach(t => t.classList.toggle('active', t === tab));
                renderSalaryContent();
            });
        });

        renderSalaryContent();
    }

    function renderSalaryContent() {
        const container = containerEl.querySelector('#mmSalaryContent');
        const profile = myData.salaryProfiles[currentPerson];
        const person = getPersonProfile(currentPerson);
        const netAnnual = getEstimatedNetAnnual(currentPerson);
        const normalized = getNormalizedMonthlyEstimated(currentPerson);
        const real = myData.realMonthlyIncome[currentPerson];
        const used = getMonthlyIncomeUsed(currentPerson);
        const reference = getCommonPaysReference();

        // Desglose deducciones
        const grossAnnual = profile.grossAnnual || 0;
        const ssAnnual = (profile.socialSecurity || 0) * 12;
        const irpfAnnual = profile.irpfAmount ? profile.irpfAmount * 12 : grossAnnual * ((profile.irpfPercent || 0) / 100);
        const otherDedAnnual = (profile.otherDeductions || 0) * 12;
        const otherCompAnnual = (profile.otherComplements || 0) * 12;

        container.innerHTML = `
            <div class="mm-profile-card" style="--profile-color: ${person.color}; --profile-color-end: ${person.color}dd;">
                <div class="mm-profile-header">
                    <div class="mm-profile-avatar">${person.initial}</div>
                    <div class="mm-profile-info">
                        <div class="mm-profile-name">${App.escapeHtml(person.name)}</div>
                        <div class="mm-profile-sub">${App.escapeHtml(profile.company || 'Sin empresa')} · ${profile.paysPerYear} pagas/año</div>
                    </div>
                    <button class="btn btn-sm" style="background: rgba(255,255,255,0.2); color: white; border-color: rgba(255,255,255,0.3);" data-edit-salary="${currentPerson}">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                </div>
                <div class="mm-profile-body">
                    <div class="mm-section-title" style="margin-top: 0;">Cálculo del neto estimado</div>
                    <div class="mm-compare-row">
                        <span class="lbl">Salario bruto anual</span>
                        <span class="val">${App.formatCurrency(grossAnnual)}</span>
                    </div>
                    <div class="mm-compare-row">
                        <span class="lbl">− Seguridad Social (anual)</span>
                        <span class="val negative">−${App.formatCurrency(ssAnnual)}</span>
                    </div>
                    <div class="mm-compare-row">
                        <span class="lbl">− IRPF (${profile.irpfAmount ? 'fijo' : profile.irpfPercent + '%'} · anual)</span>
                        <span class="val negative">−${App.formatCurrency(irpfAnnual)}</span>
                    </div>
                    <div class="mm-compare-row">
                        <span class="lbl">− Otras deducciones (anual)</span>
                        <span class="val negative">−${App.formatCurrency(otherDedAnnual)}</span>
                    </div>
                    <div class="mm-compare-row">
                        <span class="lbl">+ Otros complementos (anual)</span>
                        <span class="val positive">+${App.formatCurrency(otherCompAnnual)}</span>
                    </div>
                    <div class="mm-compare-row" style="border-top: 2px solid var(--border); padding-top: 12px; margin-top: 8px;">
                        <span class="lbl"><strong>Neto anual estimado</strong></span>
                        <span class="val" style="font-size: 16px;"><strong>${App.formatCurrency(netAnnual)}</strong></span>
                    </div>
                    <div class="mm-compare-row">
                        <span class="lbl">÷ ${profile.paysPerYear} pagas propias</span>
                        <span class="val">${App.formatCurrency(netAnnual / (profile.paysPerYear || 14))}</span>
                    </div>
                    <div class="mm-compare-row" style="background: var(--warning-light); padding: 10px; border-radius: var(--radius-sm); margin-top: 8px;">
                        <span class="lbl"><strong>÷ ${reference} pagas (referencia común)</strong></span>
                        <span class="val estimated"><strong>${App.formatCurrency(normalized)} /mes</strong></span>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Ingreso mensual para planificación</div>
                        <div class="card-subtitle">Se prioriza el valor real si existe</div>
                    </div>
                </div>
                <div class="mm-compare-row">
                    <span class="lbl">Ingreso mensual normalizado estimado</span>
                    <span class="val estimated">${App.formatCurrency(normalized)}</span>
                </div>
                <div class="mm-compare-row">
                    <span class="lbl">Ingreso mensual real introducido</span>
                    <span class="val">${real !== null && real !== undefined ? App.formatCurrency(real) : '<em style="color: var(--text-muted);">No introducido</em>'}</span>
                </div>
                <div class="mm-compare-row" style="background: var(--primary-light); padding: 10px; border-radius: var(--radius-sm); margin-top: 8px;">
                    <span class="lbl"><strong>Ingreso mensual utilizado</strong></span>
                    <span class="val" style="color: var(--primary);"><strong>${App.formatCurrency(used)}</strong></span>
                </div>
                ${real !== null && real !== undefined ? `
                    <div class="mm-compare-row">
                        <span class="lbl">Diferencia (real − estimado)</span>
                        <span class="val ${real - normalized >= 0 ? 'positive' : 'negative'}">${real - normalized >= 0 ? '+' : ''}${App.formatCurrency(real - normalized)}</span>
                    </div>
                ` : `
                    <div class="mm-alert warning" style="margin-top: 12px; margin-bottom: 0;">
                        <i class="fas fa-info-circle"></i>
                        <div>
                            No has introducido el ingreso real. Se está utilizando la estimación normalizada.
                            <button class="btn btn-sm btn-secondary" style="margin-top: 6px;" data-introduce-real="${currentPerson}">
                                <i class="fas fa-edit"></i> Introducir ingreso real
                            </button>
                        </div>
                    </div>
                `}
            </div>

            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Próximos cobros</div>
                    </div>
                </div>
                ${renderPersonPays(currentPerson)}
            </div>
        `;

        container.querySelector(`[data-edit-salary="${currentPerson}"]`)?.addEventListener('click', () => openSalaryModal(currentPerson));
        container.querySelector(`[data-introduce-real="${currentPerson}"]`)?.addEventListener('click', () => openSalaryModal(currentPerson, true));
    }

    function renderPersonPays(personId) {
        const profile = myData.salaryProfiles[personId];
        const pays = [];

        // Nóminas mensuales próximas (3 meses)
        for (let i = 0; i < 3; i++) {
            const today = new Date(2026, 9, 30);
            const d = new Date(today.getFullYear(), today.getMonth() + i, profile.usualPayDay || 1);
            if (d >= today) {
                pays.push({
                    date: d.toISOString().substring(0, 10),
                    title: 'Nómina mensual',
                    amount: getMonthlyIncomeUsed(personId),
                    type: 'monthly',
                    isEstimate: !myData.realMonthlyIncome[personId]
                });
            }
        }

        // Pagas extras
        (profile.extraPayDates || []).forEach(date => {
            if (date >= '2026-10-30') {
                pays.push({
                    date,
                    title: 'Paga extra',
                    amount: getEstimatedNetAnnual(personId) / (profile.paysPerYear || 14),
                    type: 'extra',
                    isEstimate: true
                });
            }
        });

        pays.sort((a, b) => a.date.localeCompare(b.date));

        if (pays.length === 0) return '<div class="mm-empty"><p>Sin cobros próximos</p></div>';

        return pays.slice(0, 6).map(p => {
            const d = new Date(p.date + 'T00:00:00');
            return `
                <div class="mm-pay-item">
                    <div class="mm-pay-date">
                        <div class="d">${d.getDate()}</div>
                        <div class="m">${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()]}</div>
                    </div>
                    <div class="mm-pay-info">
                        <div class="mm-pay-title">${p.title}</div>
                        <div class="mm-pay-meta">${App.formatDate(p.date)} ${p.isEstimate ? '· <em style="color: var(--warning);">Estimado</em>' : ''}</div>
                    </div>
                    <div class="mm-pay-amount" style="color: var(--success);">${App.formatCurrency(p.amount)}</div>
                </div>
            `;
        }).join('');
    }

    // =========================================================
    // MODAL: PERFIL SALARIAL
    // =========================================================
    function openSalaryModal(personId, focusReal = false) {
        const modal = containerEl.querySelector('#mmSalaryModal');
        const body = containerEl.querySelector('#mmSalaryModalBody');
        const profile = myData.salaryProfiles[personId];
        const person = getPersonProfile(personId);

        containerEl.querySelector('#mmSalaryModalTitle').textContent = `Perfil salarial · ${person.name}`;

        body.innerHTML = `
            <input type="hidden" id="salaryPersonId" value="${personId}">
            
            <div class="mm-section-title" style="margin-top: 0;">Datos laborales</div>
            <div class="mm-form-row">
                <div class="mm-form-group">
                    <label class="mm-form-label">Empresa</label>
                    <input type="text" class="mm-form-input" id="salaryCompany" value="${App.escapeHtml(profile.company || '')}">
                </div>
                <div class="mm-form-group">
                    <label class="mm-form-label">Salario bruto anual (€) *</label>
                    <input type="number" step="0.01" min="0" class="mm-form-input" id="salaryGrossAnnual" value="${profile.grossAnnual || ''}" required>
                    <div class="mm-form-error">Obligatorio</div>
                </div>
            </div>
            <div class="mm-form-row">
                <div class="mm-form-group">
                    <label class="mm-form-label">Número de pagas al año *</label>
                    <select class="mm-form-select" id="salaryPays">
                        <option value="12" ${profile.paysPerYear === 12 ? 'selected' : ''}>12 pagas (mensual con prorrateo)</option>
                        <option value="14" ${profile.paysPerYear === 14 ? 'selected' : ''}>14 pagas (12 mensuales + 2 extras)</option>
                        <option value="15" ${profile.paysPerYear === 15 ? 'selected' : ''}>15 pagas (12 mensuales + 3 extras)</option>
                        <option value="16" ${profile.paysPerYear === 16 ? 'selected' : ''}>16 pagas</option>
                    </select>
                </div>
                <div class="mm-form-group">
                    <label class="mm-form-label">Día habitual de cobro</label>
                    <input type="number" min="1" max="31" class="mm-form-input" id="salaryPayDay" value="${profile.usualPayDay || 1}">
                </div>
            </div>

            <div class="mm-section-title">Deducciones</div>
            <div class="mm-form-row">
                <div class="mm-form-group">
                    <label class="mm-form-label">Seguridad Social mensual (€)</label>
                    <input type="number" step="0.01" min="0" class="mm-form-input" id="salarySS" value="${profile.socialSecurity || 0}">
                </div>
                <div class="mm-form-group">
                    <label class="mm-form-label">IRPF (%)</label>
                    <input type="number" step="0.01" min="0" max="100" class="mm-form-input" id="salaryIRPFPct" value="${profile.irpfPercent || 0}">
                    <div class="mm-form-hint">Se aplica si no hay importe fijo</div>
                </div>
            </div>
            <div class="mm-form-row">
                <div class="mm-form-group">
                    <label class="mm-form-label">IRPF fijo mensual (€)</label>
                    <input type="number" step="0.01" min="0" class="mm-form-input" id="salaryIRPFAmount" value="${profile.irpfAmount || ''}">
                    <div class="mm-form-hint">Dejar vacío para usar el %</div>
                </div>
                <div class="mm-form-group">
                    <label class="mm-form-label">Otras deducciones mensuales (€)</label>
                    <input type="number" step="0.01" min="0" class="mm-form-input" id="salaryOtherDed" value="${profile.otherDeductions || 0}">
                </div>
            </div>
            <div class="mm-form-row single">
                <div class="mm-form-group">
                    <label class="mm-form-label">Otros complementos netos mensuales (€)</label>
                    <input type="number" step="0.01" min="0" class="mm-form-input" id="salaryComplements" value="${profile.otherComplements || 0}">
                </div>
            </div>

            <div class="mm-section-title">Ingreso mensual real</div>
            <div class="mm-form-row single">
                <div class="mm-form-group">
                    <label class="mm-form-label">Ingreso mensual neto REAL (€)</label>
                    <input type="number" step="0.01" min="0" class="mm-form-input" id="salaryRealIncome" value="${myData.realMonthlyIncome[personId] || ''}">
                    <div class="mm-form-hint">Si se introduce, se prioriza sobre la estimación normalizada</div>
                </div>
            </div>

            <div class="mm-section-title">Pagas extras</div>
            <div class="mm-form-row single">
                <div class="mm-form-group">
                    <label class="mm-form-label">Fechas previstas de pagas extras (separadas por coma, formato AAAA-MM-DD)</label>
                    <input type="text" class="mm-form-input" id="salaryExtraDates" value="${(profile.extraPayDates || []).join(', ')}" placeholder="2026-07-01, 2026-12-01">
                </div>
            </div>
            <div class="mm-form-row single">
                <div class="mm-form-group">
                    <label class="mm-form-label">Notas</label>
                    <textarea class="mm-form-textarea" id="salaryNotes">${App.escapeHtml(profile.notes || '')}</textarea>
                </div>
            </div>
        `;

        modal.classList.add('active');
        if (focusReal) {
            setTimeout(() => body.querySelector('#salaryRealIncome').focus(), 100);
        }
    }

    function saveSalaryProfile() {
        const body = containerEl.querySelector('#mmSalaryModalBody');
        const personId = body.querySelector('#salaryPersonId').value;
        const grossAnnual = parseFloat(body.querySelector('#salaryGrossAnnual').value);

        body.querySelectorAll('.mm-form-group').forEach(g => g.classList.remove('error'));
        if (isNaN(grossAnnual) || grossAnnual <= 0) {
            body.querySelector('#salaryGrossAnnual').closest('.mm-form-group').classList.add('error');
            return;
        }

        const profile = myData.salaryProfiles[personId];
        profile.company = body.querySelector('#salaryCompany').value.trim();
        profile.grossAnnual = grossAnnual;
        profile.paysPerYear = parseInt(body.querySelector('#salaryPays').value);
        profile.usualPayDay = parseInt(body.querySelector('#salaryPayDay').value) || 1;
        profile.socialSecurity = parseFloat(body.querySelector('#salarySS').value) || 0;
        profile.irpfPercent = parseFloat(body.querySelector('#salaryIRPFPct').value) || 0;
        const irpfAmountVal = body.querySelector('#salaryIRPFAmount').value;
        profile.irpfAmount = irpfAmountVal === '' ? null : parseFloat(irpfAmountVal);
        profile.otherDeductions = parseFloat(body.querySelector('#salaryOtherDed').value) || 0;
        profile.otherComplements = parseFloat(body.querySelector('#salaryComplements').value) || 0;
        profile.notes = body.querySelector('#salaryNotes').value.trim();

        const extraDatesStr = body.querySelector('#salaryExtraDates').value;
        profile.extraPayDates = extraDatesStr.split(',').map(s => s.trim()).filter(s => s);

        const realVal = body.querySelector('#salaryRealIncome').value;
        myData.realMonthlyIncome[personId] = realVal === '' ? null : parseFloat(realVal);

        myData.history.unshift({
            timestamp: new Date().toISOString(),
            action: 'salary_updated',
            personId,
            detail: `Salario bruto: ${App.formatCurrency(grossAnnual)}`
        });

        saveData();
        containerEl.querySelector('#mmSalaryModal').classList.remove('active');
        App.showToast('Perfil salarial actualizado');
        renderView(currentView);
    }

    // =========================================================
    // VISTA: GASTOS INDIVIDUALES
    // =========================================================
    function renderGastos() {
        const view = containerEl.querySelector('#mmView-gastos');

        view.innerHTML = `
            <div class="mm-person-tabs">
                ${App.data.profiles.map(p => `
                    <button class="mm-person-tab ${currentPerson === p.id ? 'active' : ''}" data-person="${p.id}">
                        <span class="mm-person-avatar" style="background: ${p.color}30; color: ${p.color};">${p.initial}</span>
                        ${App.escapeHtml(p.name)}
                    </button>
                `).join('')}
            </div>

            <div id="mmExpensesContent"></div>
        `;

        view.querySelectorAll('.mm-person-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                currentPerson = tab.dataset.person;
                view.querySelectorAll('.mm-person-tab').forEach(t => t.classList.toggle('active', t === tab));
                renderExpensesContent();
            });
        });

        renderExpensesContent();
    }

    function renderExpensesContent() {
        const container = containerEl.querySelector('#mmExpensesContent');
        const person = getPersonProfile(currentPerson);
        const expenses = myData.individualExpenses.filter(e => e.personId === currentPerson);
        const totalMonthly = getIndividualExpensesMonthly(currentPerson);
        const income = getMonthlyIncomeUsed(currentPerson);
        const remaining = getRemainingMonthly(currentPerson);

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Gastos individuales de ${App.escapeHtml(person.name)}</div>
                        <div class="card-subtitle">${expenses.length} gasto(s) · Total mensual equivalente: ${App.formatCurrency(totalMonthly)}</div>
                    </div>
                    <button class="btn btn-sm btn-primary" data-new-expense="${currentPerson}"><i class="fas fa-plus"></i> Nuevo gasto</button>
                </div>

                ${remaining < 0 ? `
                    <div class="mm-alert danger">
                        <i class="fas fa-exclamation-triangle"></i>
                        <div>
                            <strong>Los gastos obligatorios superan al ingreso utilizado.</strong>
                            Déficit mensual: ${App.formatCurrency(Math.abs(remaining))}
                        </div>
                    </div>
                ` : ''}

                ${expenses.length === 0 ? `
                    <div class="mm-empty">
                        <i class="fas fa-receipt"></i>
                        <h3>Sin gastos individuales</h3>
                        <p>Añade los gastos obligatorios de esta persona.</p>
                    </div>
                ` : `
                    <div class="mm-table-wrap">
                        <table class="mm-table">
                            <thead>
                                <tr>
                                    <th>Concepto</th>
                                    <th>Categoría</th>
                                    <th>Importe</th>
                                    <th>Frecuencia</th>
                                    <th>Eq. mensual</th>
                                    <th>Próximo pago</th>
                                    <th>Estado</th>
                                    <th style="width: 80px;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${expenses.map(e => {
                                    const monthly = normalizeToMonthly(e.amount, e.frequency);
                                    const freqLabel = { weekly: 'Semanal', monthly: 'Mensual', quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual' }[e.frequency] || e.frequency;
                                    return `
                                        <tr style="${e.active === false ? 'opacity: 0.5;' : ''}">
                                            <td>
                                                <div style="font-weight: 500;">${App.escapeHtml(e.name)}</div>
                                                ${e.notes ? `<div style="font-size: 11px; color: var(--text-muted);">${App.escapeHtml(e.notes)}</div>` : ''}
                                            </td>
                                            <td><span class="badge badge-neutral">${e.category || '—'}</span></td>
                                            <td class="amount">${App.formatCurrency(e.amount)}</td>
                                            <td>${freqLabel}</td>
                                            <td class="amount"><strong>${App.formatCurrency(monthly)}</strong></td>
                                            <td>${e.nextPayment ? App.formatDate(e.nextPayment) : '—'}</td>
                                            <td>${e.active === false ? '<span class="badge badge-neutral">Inactivo</span>' : e.mandatory ? '<span class="badge badge-warning">Obligatorio</span>' : '<span class="badge badge-info">Opcional</span>'}</td>
                                            <td>
                                                <div class="mm-action-menu">
                                                    <button class="btn btn-icon btn-ghost" data-expense-menu="${e.id}"><i class="fas fa-ellipsis-v"></i></button>
                                                    <div class="mm-action-dropdown" id="iemenu-${e.id}">
                                                        <button data-expense-action="edit" data-id="${e.id}"><i class="fas fa-edit"></i> Editar</button>
                                                        <button data-expense-action="toggle" data-id="${e.id}"><i class="fas fa-${e.active === false ? 'check' : 'times'}"></i> ${e.active === false ? 'Activar' : 'Desactivar'}</button>
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
                `}
            </div>

            <div class="card">
                <div class="card-header">
                    <div class="card-title">Resumen mensual</div>
                </div>
                <div class="mm-compare-row">
                    <span class="lbl">Ingreso mensual utilizado</span>
                    <span class="val">${App.formatCurrency(income)}</span>
                </div>
                <div class="mm-compare-row">
                    <span class="lbl">− Total gastos individuales (equivalente mensual)</span>
                    <span class="val negative">−${App.formatCurrency(totalMonthly)}</span>
                </div>
                <div class="mm-compare-row" style="background: ${remaining >= 0 ? 'var(--success-light)' : 'var(--danger-light)'}; padding: 10px; border-radius: var(--radius-sm); margin-top: 8px;">
                    <span class="lbl"><strong>= Dinero restante mensual</strong></span>
                    <span class="val" style="color: ${remaining >= 0 ? 'var(--success)' : 'var(--danger)'}; font-size: 16px;"><strong>${App.formatCurrency(remaining)}</strong></span>
                </div>
            </div>
        `;

        container.querySelector(`[data-new-expense="${currentPerson}"]`).addEventListener('click', () => openExpenseModal(null, currentPerson));

        container.querySelectorAll('[data-expense-menu]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.expenseMenu;
                container.querySelectorAll('.mm-action-dropdown.open').forEach(m => {
                    if (m.id !== `iemenu-${id}`) m.classList.remove('open');
                });
                container.querySelector(`#iemenu-${id}`).classList.toggle('open');
            });
        });

        container.querySelectorAll('[data-expense-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.expenseAction;
                const id = btn.dataset.id;
                container.querySelectorAll('.mm-action-dropdown.open').forEach(m => m.classList.remove('open'));
                if (action === 'edit') openExpenseModal(id, currentPerson);
                else if (action === 'toggle') toggleExpense(id);
                else if (action === 'delete') confirmDeleteExpense(id);
            });
        });
    }

    function toggleExpense(id) {
        const exp = myData.individualExpenses.find(e => e.id === id);
        if (!exp) return;
        exp.active = exp.active === false ? true : false;
        saveData();
        App.showToast(exp.active ? 'Gasto activado' : 'Gasto desactivado');
        renderExpensesContent();
    }

    function confirmDeleteExpense(id) {
        const exp = myData.individualExpenses.find(e => e.id === id);
        if (!exp) return;
        App.showConfirm(
            'Eliminar gasto',
            `¿Eliminar "${exp.name}"?`,
            () => {
                myData.individualExpenses = myData.individualExpenses.filter(e => e.id !== id);
                saveData();
                App.showToast('Gasto eliminado');
                renderExpensesContent();
            }
        );
    }

    // =========================================================
    // MODAL: GASTO INDIVIDUAL
    // =========================================================
    function openExpenseModal(id = null, personId = null) {
        const modal = containerEl.querySelector('#mmExpenseModal');
        const body = containerEl.querySelector('#mmExpenseModalBody');
        const exp = id ? myData.individualExpenses.find(e => e.id === id) : null;
        const pid = personId || (exp ? exp.personId : currentPerson);
        const person = getPersonProfile(pid);

        containerEl.querySelector('#mmExpenseModalTitle').textContent = exp ? 'Editar gasto individual' : `Nuevo gasto · ${person.name}`;

        body.innerHTML = `
            <input type="hidden" id="expEditId" value="${id || ''}">
            <input type="hidden" id="expPersonId" value="${pid}">
            
            <div class="mm-form-row single">
                <div class="mm-form-group">
                    <label class="mm-form-label">Nombre del gasto *</label>
                    <input type="text" class="mm-form-input" id="expName" value="${exp ? App.escapeHtml(exp.name) : ''}" required>
                    <div class="mm-form-error">Obligatorio</div>
                </div>
            </div>
            <div class="mm-form-row three">
                <div class="mm-form-group">
                    <label class="mm-form-label">Importe (€) *</label>
                    <input type="number" step="0.01" min="0" class="mm-form-input" id="expAmount" value="${exp ? exp.amount : ''}" required>
                    <div class="mm-form-error">Obligatorio</div>
                </div>
                <div class="mm-form-group">
                    <label class="mm-form-label">Frecuencia</label>
                    <select class="mm-form-select" id="expFrequency">
                        <option value="weekly" ${exp && exp.frequency === 'weekly' ? 'selected' : ''}>Semanal</option>
                        <option value="monthly" ${exp && exp.frequency === 'monthly' ? 'selected' : (!exp ? 'selected' : '')}>Mensual</option>
                        <option value="quarterly" ${exp && exp.frequency === 'quarterly' ? 'selected' : ''}>Trimestral</option>
                        <option value="semiannual" ${exp && exp.frequency === 'semiannual' ? 'selected' : ''}>Semestral</option>
                        <option value="annual" ${exp && exp.frequency === 'annual' ? 'selected' : ''}>Anual</option>
                    </select>
                </div>
                <div class="mm-form-group">
                    <label class="mm-form-label">Categoría</label>
                    <select class="mm-form-select" id="expCategory">
                        <option value="coche" ${exp && exp.category === 'coche' ? 'selected' : ''}>Coche</option>
                        <option value="salud" ${exp && exp.category === 'salud' ? 'selected' : ''}>Salud</option>
                        <option value="telefono" ${exp && exp.category === 'telefono' ? 'selected' : ''}>Teléfono</option>
                        <option value="suscripciones" ${exp && exp.category === 'suscripciones' ? 'selected' : ''}>Suscripciones</option>
                        <option value="seguros" ${exp && exp.category === 'seguros' ? 'selected' : ''}>Seguros</option>
                        <option value="transporte" ${exp && exp.category === 'transporte' ? 'selected' : ''}>Transporte</option>
                        <option value="otros" ${exp && exp.category === 'otros' ? 'selected' : ''}>Otros</option>
                    </select>
                </div>
            </div>
            <div class="mm-form-row">
                <div class="mm-form-group">
                    <label class="mm-form-label">Próximo pago</label>
                    <input type="date" class="mm-form-input" id="expNextPayment" value="${exp ? exp.nextPayment || '' : ''}">
                </div>
                <div class="mm-form-group">
                    <label class="mm-form-label">Cuenta asociada</label>
                    <select class="mm-form-select" id="expAccount">
                        <option value="">—</option>
                        ${App.data.accounts.filter(a => a.owners.includes(pid) || a.owners.includes('conjunto')).map(a => `<option value="${a.id}" ${exp && exp.account === a.id ? 'selected' : ''}>${App.escapeHtml(a.name)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="mm-form-row">
                <div class="mm-form-group">
                    <label class="mm-form-label">Carácter</label>
                    <select class="mm-form-select" id="expMandatory">
                        <option value="true" ${exp && exp.mandatory !== false ? 'selected' : (!exp ? 'selected' : '')}>Obligatorio</option>
                        <option value="false" ${exp && exp.mandatory === false ? 'selected' : ''}>Opcional</option>
                    </select>
                </div>
                <div class="mm-form-group">
                    <label class="mm-form-label">Estado</label>
                    <select class="mm-form-select" id="expActive">
                        <option value="true" ${exp && exp.active !== false ? 'selected' : (!exp ? 'selected' : '')}>Activo</option>
                        <option value="false" ${exp && exp.active === false ? 'selected' : ''}>Inactivo</option>
                    </select>
                </div>
            </div>
            <div class="mm-form-row single">
                <div class="mm-form-group">
                    <label class="mm-form-label">Notas</label>
                    <textarea class="mm-form-textarea" id="expNotes">${exp ? App.escapeHtml(exp.notes || '') : ''}</textarea>
                </div>
            </div>
        `;

        modal.classList.add('active');
    }

    function saveIndividualExpense() {
        const body = containerEl.querySelector('#mmExpenseModalBody');
        const id = body.querySelector('#expEditId').value;
        const personId = body.querySelector('#expPersonId').value;
        const name = body.querySelector('#expName').value.trim();
        const amount = parseFloat(body.querySelector('#expAmount').value);

        body.querySelectorAll('.mm-form-group').forEach(g => g.classList.remove('error'));
        let valid = true;
        if (!name) { body.querySelector('#expName').closest('.mm-form-group').classList.add('error'); valid = false; }
        if (isNaN(amount) || amount <= 0) { body.querySelector('#expAmount').closest('.mm-form-group').classList.add('error'); valid = false; }
        if (!valid) return;

        const expData = {
            personId,
            name,
            amount,
            frequency: body.querySelector('#expFrequency').value,
            category: body.querySelector('#expCategory').value,
            nextPayment: body.querySelector('#expNextPayment').value,
            account: body.querySelector('#expAccount').value,
            mandatory: body.querySelector('#expMandatory').value === 'true',
            active: body.querySelector('#expActive').value === 'true',
            notes: body.querySelector('#expNotes').value.trim()
        };

        if (id) {
            const exp = myData.individualExpenses.find(e => e.id === id);
            Object.assign(exp, expData);
            App.showToast('Gasto actualizado');
        } else {
            expData.id = App.generateId('ie');
            myData.individualExpenses.push(expData);
            App.showToast('Gasto añadido');
        }

        saveData();
        containerEl.querySelector('#mmExpenseModal').classList.remove('active');
        renderExpensesContent();
    }

    // =========================================================
    // VISTA: DISTRIBUCIÓN
    // =========================================================
    function renderDistribucion() {
        const view = containerEl.querySelector('#mmView-distribucion');

        view.innerHTML = `
            <div class="mm-person-tabs">
                ${App.data.profiles.map(p => `
                    <button class="mm-person-tab ${currentPerson === p.id ? 'active' : ''}" data-person="${p.id}">
                        <span class="mm-person-avatar" style="background: ${p.color}30; color: ${p.color};">${p.initial}</span>
                        ${App.escapeHtml(p.name)}
                    </button>
                `).join('')}
            </div>

            <div id="mmDistContent"></div>
        `;

        view.querySelectorAll('.mm-person-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                currentPerson = tab.dataset.person;
                view.querySelectorAll('.mm-person-tab').forEach(t => t.classList.toggle('active', t === tab));
                renderDistContent();
            });
        });

        renderDistContent();
    }

    function renderDistContent() {
        const container = containerEl.querySelector('#mmDistContent');
        const person = getPersonProfile(currentPerson);
        const dist = myData.monthlyDistribution[currentPerson];
        const remaining = getRemainingMonthly(currentPerson);
        const isValid = validateDistribution(dist);

        const items = [
            { key: 'shared', label: 'Gastos compartidos', color: 'var(--primary)', icon: 'fa-users', desc: 'Aportación al presupuesto común' },
            { key: 'mortgage', label: 'Ahorro hipoteca', color: 'var(--success)', icon: 'fa-home', desc: `Acumulado: ${App.formatCurrency(myData.savings.mortgage[currentPerson] || 0)}` },
            { key: 'trips', label: 'Viajes', color: 'var(--info)', icon: 'fa-plane', desc: `Acumulado: ${App.formatCurrency(myData.savings.trips[currentPerson] || 0)}` },
            { key: 'personal', label: 'Dinero personal', color: 'var(--warning)', icon: 'fa-user', desc: 'Disponible libre' }
        ];

        container.innerHTML = `
            ${remaining < 0 ? `
                <div class="mm-alert danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>
                        <strong>No hay dinero restante para distribuir.</strong>
                        Los gastos individuales (${App.formatCurrency(getIndividualExpensesMonthly(currentPerson))}) superan al ingreso utilizado (${App.formatCurrency(getMonthlyIncomeUsed(currentPerson))}).
                    </div>
                </div>
            ` : ''}

            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Distribución mensual de ${App.escapeHtml(person.name)}</div>
                        <div class="card-subtitle">Base: ${App.formatCurrency(remaining)} restantes</div>
                    </div>
                    <div>
                        ${isValid 
                            ? '<span class="badge badge-success"><i class="fas fa-check"></i> Suma 100%</span>'
                            : `<span class="badge badge-danger"><i class="fas fa-times"></i> Suma ${(dist.shared + dist.mortgage + dist.trips + dist.personal).toFixed(1)}%</span>`
                        }
                    </div>
                </div>

                ${!isValid ? `
                    <div class="mm-alert warning">
                        <i class="fas fa-exclamation-circle"></i>
                        <div>Los porcentajes deben sumar exactamente 100% para que la distribución sea válida.</div>
                    </div>
                ` : ''}

                ${items.map(it => {
                    const amount = remaining > 0 ? remaining * (dist[it.key] / 100) : 0;
                    return `
                        <div class="mm-slider-row">
                            <label>
                                <span class="mm-dist-icon" style="background: ${it.color}; display: inline-flex; width: 20px; height: 20px; border-radius: 5px; font-size: 10px; margin-right: 6px;"><i class="fas ${it.icon}"></i></span>
                                ${it.label}
                            </label>
                            <input type="range" min="0" max="100" step="1" value="${dist[it.key]}" data-dist-key="${it.key}">
                            <div class="mm-slider-value">
                                <div>${dist[it.key]}%</div>
                                <div style="font-size: 11px; color: var(--text-muted); font-weight: 400;">${App.formatCurrency(amount)}</div>
                            </div>
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted); margin: -8px 0 12px 172px;">${it.desc}</div>
                    `;
                }).join('')}
            </div>

            <div class="card">
                <div class="card-header">
                    <div class="card-title">Detalle de la distribución</div>
                </div>
                ${renderDistributionSummary({
                    shared: remaining > 0 ? remaining * (dist.shared / 100) : 0,
                    mortgage: remaining > 0 ? remaining * (dist.mortgage / 100) : 0,
                    trips: remaining > 0 ? remaining * (dist.trips / 100) : 0,
                    personal: remaining > 0 ? remaining * (dist.personal / 100) : 0
                }, remaining)}
            </div>
        `;

        // Bind sliders
        container.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.addEventListener('input', () => {
                const key = slider.dataset.distKey;
                dist[key] = parseInt(slider.value);
                renderDistContent();
            });
            slider.addEventListener('change', () => {
                saveData();
                App.showToast('Distribución actualizada');
            });
        });
    }

    // =========================================================
    // VISTA: PAGAS EXTRAS
    // =========================================================
    function renderPagas() {
        const view = containerEl.querySelector('#mmView-pagas');

        view.innerHTML = `
            <div class="mm-person-tabs">
                ${App.data.profiles.map(p => `
                    <button class="mm-person-tab ${currentPerson === p.id ? 'active' : ''}" data-person="${p.id}">
                        <span class="mm-person-avatar" style="background: ${p.color}30; color: ${p.color};">${p.initial}</span>
                        ${App.escapeHtml(p.name)}
                    </button>
                `).join('')}
            </div>

            <div id="mmPagasContent"></div>
        `;

        view.querySelectorAll('.mm-person-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                currentPerson = tab.dataset.person;
                view.querySelectorAll('.mm-person-tab').forEach(t => t.classList.toggle('active', t === tab));
                renderPagasContent();
            });
        });

        renderPagasContent();
    }

    function renderPagasContent() {
        const container = containerEl.querySelector('#mmPagasContent');
        const person = getPersonProfile(currentPerson);
        const profile = myData.salaryProfiles[currentPerson];
        const extraDist = myData.extraPayDistribution[currentPerson];
        const isValid = validateDistribution(extraDist);

        const personPays = myData.extraPays.filter(p => p.personId === currentPerson);
        const totalReceived = personPays.filter(p => p.status === 'received').reduce((s, p) => s + (p.realAmount || 0), 0);

        // Importe estimado de cada paga extra
        const netAnnual = getEstimatedNetAnnual(currentPerson);
        const estimatedPerExtraPay = netAnnual / (profile.paysPerYear || 14);

        // Próximas pagas extras
        const upcomingExtras = (profile.extraPayDates || [])
            .filter(d => d >= '2026-10-30')
            .map(d => ({
                date: d,
                amount: estimatedPerExtraPay,
                registered: personPays.find(p => p.date === d)
            }));

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Distribución de pagas extras · ${App.escapeHtml(person.name)}</div>
                        <div class="card-subtitle">Porcentajes independientes de la distribución mensual</div>
                    </div>
                    <div>
                        ${isValid 
                            ? '<span class="badge badge-success"><i class="fas fa-check"></i> Suma 100%</span>'
                            : `<span class="badge badge-danger"><i class="fas fa-times"></i> Suma ${(extraDist.shared + extraDist.mortgage + extraDist.trips + extraDist.personal).toFixed(1)}%</span>`
                        }
                    </div>
                </div>

                ${!isValid ? `
                    <div class="mm-alert warning">
                        <i class="fas fa-exclamation-circle"></i>
                        <div>Los porcentajes deben sumar exactamente 100%.</div>
                    </div>
                ` : ''}

                <div class="mm-slider-row">
                    <label><i class="fas fa-users" style="color: var(--primary); margin-right: 6px;"></i>Gastos compartidos</label>
                    <input type="range" min="0" max="100" step="1" value="${extraDist.shared}" data-extra-key="shared">
                    <div class="mm-slider-value">${extraDist.shared}%</div>
                </div>
                <div class="mm-slider-row">
                    <label><i class="fas fa-home" style="color: var(--success); margin-right: 6px;"></i>Ahorro hipoteca</label>
                    <input type="range" min="0" max="100" step="1" value="${extraDist.mortgage}" data-extra-key="mortgage">
                    <div class="mm-slider-value">${extraDist.mortgage}%</div>
                </div>
                <div class="mm-slider-row">
                    <label><i class="fas fa-plane" style="color: var(--info); margin-right: 6px;"></i>Viajes</label>
                    <input type="range" min="0" max="100" step="1" value="${extraDist.trips}" data-extra-key="trips">
                    <div class="mm-slider-value">${extraDist.trips}%</div>
                </div>
                <div class="mm-slider-row">
                    <label><i class="fas fa-user" style="color: var(--warning); margin-right: 6px;"></i>Dinero personal</label>
                    <input type="range" min="0" max="100" step="1" value="${extraDist.personal}" data-extra-key="personal">
                    <div class="mm-slider-value">${extraDist.personal}%</div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Próximas pagas extras</div>
                        <div class="card-subtitle">Importe estimado: ${App.formatCurrency(estimatedPerExtraPay)} por paga</div>
                    </div>
                </div>
                ${upcomingExtras.length === 0 ? `
                    <div class="mm-empty">
                        <i class="fas fa-gift"></i>
                        <h3>Sin pagas extras próximas</h3>
                    </div>
                ` : upcomingExtras.map(p => `
                    <div class="mm-pay-item">
                        <div class="mm-pay-date" style="background: ${person.color}20; color: ${person.color};">
                            <div class="d">${new Date(p.date + 'T00:00:00').getDate()}</div>
                            <div class="m">${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][new Date(p.date + 'T00:00:00').getMonth()]}</div>
                        </div>
                        <div class="mm-pay-info">
                            <div class="mm-pay-title">Paga extra</div>
                            <div class="mm-pay-meta">
                                ${App.formatDate(p.date)} · 
                                ${p.registered 
                                    ? `<span class="badge badge-success">Cobrada: ${App.formatCurrency(p.registered.realAmount)}</span>`
                                    : '<em style="color: var(--warning);">Prevista</em>'
                                }
                            </div>
                        </div>
                        <div class="mm-pay-amount" style="color: var(--success);">${App.formatCurrency(p.amount)}</div>
                        ${!p.registered ? `<button class="btn btn-sm btn-primary" data-register-extra="${p.date}"><i class="fas fa-check"></i> Cobrada</button>` : ''}
                    </div>
                `).join('')}
            </div>

            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Historial de pagas extras</div>
                        <div class="card-subtitle">Total cobrado: ${App.formatCurrency(totalReceived)}</div>
                    </div>
                    <button class="btn btn-sm btn-primary" data-register-new-extra="${currentPerson}"><i class="fas fa-plus"></i> Registrar paga</button>
                </div>
                ${personPays.length === 0 ? `
                    <div class="mm-empty">
                        <i class="fas fa-history"></i>
                        <p>Sin pagas extras registradas</p>
                    </div>
                ` : personPays.map(p => `
                    <div class="mm-pay-item">
                        <div class="mm-pay-date">
                            <div class="d">${new Date(p.date + 'T00:00:00').getDate()}</div>
                            <div class="m">${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][new Date(p.date + 'T00:00:00').getMonth()]}</div>
                        </div>
                        <div class="mm-pay-info">
                            <div class="mm-pay-title">Paga extra ${new Date(p.date + 'T00:00:00').getFullYear()}</div>
                            <div class="mm-pay-meta">
                                ${App.formatDate(p.date)} · 
                                ${p.status === 'received' ? '<span class="badge badge-success">Cobrada</span>' : '<span class="badge badge-warning">Pendiente</span>'}
                                ${p.notes ? ` · ${App.escapeHtml(p.notes)}` : ''}
                            </div>
                        </div>
                        <div>
                            <div class="mm-pay-amount" style="color: var(--success);">${App.formatCurrency(p.realAmount || p.estimatedAmount)}</div>
                            ${p.realAmount && p.estimatedAmount && Math.abs(p.realAmount - p.estimatedAmount) > 0.01 ? `
                                <div style="font-size: 10px; color: var(--text-muted); text-align: right;">Estimado: ${App.formatCurrency(p.estimatedAmount)}</div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Bind sliders
        container.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.addEventListener('input', () => {
                const key = slider.dataset.extraKey;
                extraDist[key] = parseInt(slider.value);
                renderPagasContent();
            });
            slider.addEventListener('change', () => {
                saveData();
                App.showToast('Distribución de pagas extras actualizada');
            });
        });

        container.querySelectorAll('[data-register-extra]').forEach(btn => {
            btn.addEventListener('click', () => openExtraPayModal(null, currentPerson, btn.dataset.registerExtra));
        });
        container.querySelector(`[data-register-new-extra="${currentPerson}"]`)?.addEventListener('click', () => openExtraPayModal(null, currentPerson));
    }

    // =========================================================
    // MODAL: PAGAS EXTRAS
    // =========================================================
    function openExtraPayModal(id = null, personId = null, preselectedDate = null) {
        const modal = containerEl.querySelector('#mmExtraPayModal');
        const body = containerEl.querySelector('#mmExtraPayModalBody');
        const pay = id ? myData.extraPays.find(p => p.id === id) : null;
        const pid = personId || (pay ? pay.personId : currentPerson);
        const person = getPersonProfile(pid);

        containerEl.querySelector('#mmExtraPayModalTitle').textContent = pay ? 'Editar paga extra' : `Registrar paga extra · ${person.name}`;

        body.innerHTML = `
            <input type="hidden" id="extraPayEditId" value="${id || ''}">
            <input type="hidden" id="extraPayPersonId" value="${pid}">
            
            <div class="mm-form-row">
                <div class="mm-form-group">
                    <label class="mm-form-label">Fecha de cobro *</label>
                    <input type="date" class="mm-form-input" id="extraPayDate" value="${pay ? pay.date : (preselectedDate || '')}" required>
                    <div class="mm-form-error">Obligatorio</div>
                </div>
                <div class="mm-form-group">
                    <label class="mm-form-label">Estado</label>
                    <select class="mm-form-select" id="extraPayStatus">
                        <option value="received" ${pay && pay.status === 'received' ? 'selected' : (!pay ? 'selected' : '')}>Cobrada</option>
                        <option value="pending" ${pay && pay.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                    </select>
                </div>
            </div>
            <div class="mm-form-row">
                <div class="mm-form-group">
                    <label class="mm-form-label">Importe estimado (€)</label>
                    <input type="number" step="0.01" min="0" class="mm-form-input" id="extraPayEstimated" value="${pay ? pay.estimatedAmount : (getEstimatedNetAnnual(pid) / (myData.salaryProfiles[pid].paysPerYear || 14))}">
                </div>
                <div class="mm-form-group">
                    <label class="mm-form-label">Importe REAL cobrado (€)</label>
                    <input type="number" step="0.01" min="0" class="mm-form-input" id="extraPayReal" value="${pay ? (pay.realAmount || '') : ''}">
                    <div class="mm-form-hint">Si se introduce, se usará para la distribución definitiva</div>
                </div>
            </div>
            <div class="mm-form-row single">
                <div class="mm-form-group">
                    <label class="mm-form-label">Notas</label>
                    <textarea class="mm-form-textarea" id="extraPayNotes">${pay ? App.escapeHtml(pay.notes || '') : ''}</textarea>
                </div>
            </div>
        `;

        modal.classList.add('active');
    }

    function saveExtraPay() {
        const body = containerEl.querySelector('#mmExtraPayModalBody');
        const id = body.querySelector('#extraPayEditId').value;
        const personId = body.querySelector('#extraPayPersonId').value;
        const date = body.querySelector('#extraPayDate').value;

        body.querySelectorAll('.mm-form-group').forEach(g => g.classList.remove('error'));
        if (!date) {
            body.querySelector('#extraPayDate').closest('.mm-form-group').classList.add('error');
            return;
        }

        const estimatedVal = parseFloat(body.querySelector('#extraPayEstimated').value);
        const realVal = body.querySelector('#extraPayReal').value;

        const payData = {
            personId,
            date,
            type: 'extraordinary',
            estimatedAmount: isNaN(estimatedVal) ? 0 : estimatedVal,
            realAmount: realVal === '' ? null : parseFloat(realVal),
            status: body.querySelector('#extraPayStatus').value,
            notes: body.querySelector('#extraPayNotes').value.trim()
        };

        if (id) {
            const pay = myData.extraPays.find(p => p.id === id);
            Object.assign(pay, payData);
            App.showToast('Paga extra actualizada');
        } else {
            payData.id = App.generateId('ep');
            myData.extraPays.push(payData);
            App.showToast('Paga extra registrada');
        }

        saveData();
        containerEl.querySelector('#mmExtraPayModal').classList.remove('active');
        renderPagasContent();
    }

    // =========================================================
    // VISTA: CONFIGURACIÓN
    // =========================================================
    function renderConfiguracion() {
        const view = containerEl.querySelector('#mmView-configuracion');
        const s = myData.settings;

        view.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Configuración de Mi dinero</div>
                        <div class="card-subtitle">Personaliza el comportamiento</div>
                    </div>
                </div>

                <div class="mm-config-section">
                    <h3><i class="fas fa-calculator"></i> Cálculos</h3>
                    <div class="mm-config-row">
                        <span class="label">Mostrar estimación cuando no hay ingreso real</span>
                        <label class="mm-switch"><input type="checkbox" id="cfgShowEstimated" ${s.showEstimatedWhenNoReal ? 'checked' : ''}><span class="mm-slider"></span></label>
                    </div>
                    <div class="mm-config-row">
                        <span class="label">Avisar cuando el dinero restante sea negativo</span>
                        <label class="mm-switch"><input type="checkbox" id="cfgWarnNegative" ${s.warningNegativeRemaining ? 'checked' : ''}><span class="mm-slider"></span></label>
                    </div>
                </div>

                <div class="mm-config-section">
                    <h3><i class="fas fa-info-circle"></i> Información</h3>
                    <div class="mm-config-row">
                        <span class="label">Referencia común de pagas actual</span>
                        <span style="font-weight: 600;">${getCommonPaysReference()} pagas/año</span>
                    </div>
                    <div class="mm-config-row">
                        <span class="label">Personas registradas</span>
                        <span style="font-weight: 600;">${App.data.profiles.length}</span>
                    </div>
                    <div class="mm-config-row">
                        <span class="label">Gastos individuales activos</span>
                        <span style="font-weight: 600;">${myData.individualExpenses.filter(e => e.active !== false).length}</span>
                    </div>
                </div>

                <div class="mm-config-section">
                    <h3><i class="fas fa-database"></i> Datos</h3>
                    <div class="mm-config-row">
                        <span class="label">Exportar datos a JSON</span>
                        <button class="btn btn-sm btn-secondary" id="cfgExportJson"><i class="fas fa-file-code"></i> Descargar</button>
                    </div>
                    <div class="mm-config-row">
                        <span class="label">Restaurar datos de demostración</span>
                        <button class="btn btn-sm btn-danger" id="cfgResetData"><i class="fas fa-undo"></i> Restaurar</button>
                    </div>
                </div>
            </div>
        `;

        view.querySelector('#cfgShowEstimated').addEventListener('change', (e) => {
            myData.settings.showEstimatedWhenNoReal = e.target.checked;
            saveData();
        });
        view.querySelector('#cfgWarnNegative').addEventListener('change', (e) => {
            myData.settings.warningNegativeRemaining = e.target.checked;
            saveData();
        });

        view.querySelector('#cfgExportJson').addEventListener('click', () => {
            const json = JSON.stringify(myData, null, 2);
            const blob = new Blob(['\ufeff' + json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'mi-dinero-backup.json'; a.click();
            URL.revokeObjectURL(url);
            App.showToast('JSON exportado');
        });

        view.querySelector('#cfgResetData').addEventListener('click', () => {
            App.showConfirm(
                'Restaurar datos',
                '¿Seguro que quieres restaurar los datos de demostración? Se perderán todos los cambios.',
                () => {
                    myData = JSON.parse(JSON.stringify(DEFAULT_MY_MONEY_DATA));
                    saveData();
                    renderConfiguracion();
                    App.showToast('Datos restaurados');
                }
            );
        });
    }

    // =========================================================
    // INIT
    // =========================================================
    function init() {
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.mm-action-menu')) {
                containerEl && containerEl.querySelectorAll('.mm-action-dropdown.open').forEach(m => m.classList.remove('open'));
            }
        });
    }

    function onThemeChange() {
        // Los gráficos usarían colores del tema, pero esta vista no tiene gráficos Chart.js
    }

    // =========================================================
    // API PÚBLICA
    // =========================================================
    return {
        render,
        init,
        onThemeChange,
        // API para integración con otras secciones
        getMonthlyIncomeUsed,
        getDistribution,
        getRemainingMonthly,
        getSavings: () => myData.savings
    };
})();

// Registrar sección
App.registerSection('mi-dinero', {
    render: (container) => MyMoneyApp.render(container),
    init: () => MyMoneyApp.init(),
    onThemeChange: () => MyMoneyApp.onThemeChange()
});

window.MyMoneyApp = MyMoneyApp;