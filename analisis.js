/* =============================================================
   ANALISIS.JS
   Dashboard ejecutivo de Análisis y Planificación Financiera.
   Vistas: Visión General, Ingresos y Gastos, Patrimonio y Ahorro,
   Planificación Futura (con escenarios interactivos).
   ============================================================= */
const AnalysisApp = (function () {
    'use strict';

    // =========================================================
    // ESTILOS ESPECÍFICOS (Dashboard Fintech Premium)
    // =========================================================
    function injectStyles() {
        if (document.getElementById('analysis-styles')) return;
        const style = document.createElement('style');
        style.id = 'analysis-styles';
        style.textContent = `
            /* Sub-navegación */
            .ana-subnav {
                display: flex; gap: 4px;
                border-bottom: 1px solid var(--border);
                margin-bottom: 20px;
                overflow-x: auto;
            }
            .ana-subnav-item {
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
            .ana-subnav-item:hover { color: var(--text); }
            .ana-subnav-item.active { color: var(--primary); border-bottom-color: var(--primary); }

            .ana-subview { display: none; animation: fadeIn 0.3s ease; }
            .ana-subview.active { display: block; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

            /* Filtros globales */
            .ana-filters-bar {
                display: flex; gap: 10px; margin-bottom: 20px;
                flex-wrap: wrap; align-items: center;
                background: var(--bg-card); padding: 12px;
                border: 1px solid var(--border); border-radius: var(--radius);
            }
            .ana-filter-select, .ana-filter-input {
                padding: 8px 32px 8px 12px;
                border: 1px solid var(--border); border-radius: var(--radius-sm);
                background: var(--bg-card); color: var(--text);
                font-size: 13px; cursor: pointer; font-family: inherit;
                appearance: none;
                background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
                background-repeat: no-repeat; background-position: right 10px center;
            }
            .ana-filter-input { background-image: none; cursor: text; }

            /* KPI Cards */
            .ana-kpi-grid {
                display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px; margin-bottom: 24px;
            }
            .ana-kpi-card {
                background: var(--bg-card); border: 1px solid var(--border);
                border-radius: var(--radius); padding: 16px;
                transition: all 0.2s; position: relative; overflow: hidden;
            }
            .ana-kpi-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
            .ana-kpi-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
            .ana-kpi-icon {
                width: 36px; height: 36px; border-radius: 10px;
                display: flex; align-items: center; justify-content: center;
                font-size: 16px;
            }
            .ana-kpi-label { font-size: 11px; color: var(--text-secondary); font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px; }
            .ana-kpi-value { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
            .ana-kpi-meta { font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; }
            .ana-kpi-meta.positive { color: var(--success); }
            .ana-kpi-meta.negative { color: var(--danger); }

            /* Charts */
            .ana-chart-container { position: relative; height: 320px; margin-top: 8px; }
            .ana-chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
            @media (max-width: 1024px) { .ana-chart-row { grid-template-columns: 1fr; } }

            /* Alerts */
            .ana-alerts-list { display: flex; flex-direction: column; gap: 8px; }
            .ana-alert-item {
                display: flex; align-items: flex-start; gap: 12px;
                padding: 12px; border-radius: var(--radius-sm);
                border-left: 3px solid; font-size: 13px;
            }
            .ana-alert-item.warning { border-color: var(--warning); background: var(--warning-light); color: #92400e; }
            .ana-alert-item.danger { border-color: var(--danger); background: var(--danger-light); color: #991b1b; }
            .ana-alert-item.info { border-color: var(--info); background: var(--info-light); color: #1e40af; }
            .ana-alert-item.success { border-color: var(--success); background: var(--success-light); color: #065f46; }
            .ana-alert-icon { flex-shrink: 0; margin-top: 2px; }

            /* Tables */
            .ana-table-wrap { overflow-x: auto; }
            .ana-table { width: 100%; border-collapse: collapse; font-size: 13px; }
            .ana-table th {
                text-align: left; padding: 10px 12px;
                font-size: 11px; font-weight: 600; color: var(--text-muted);
                text-transform: uppercase; letter-spacing: 0.5px;
                border-bottom: 1px solid var(--border); background: var(--bg-card);
                cursor: pointer; user-select: none;
            }
            .ana-table th:hover { color: var(--text); }
            .ana-table td { padding: 12px; border-bottom: 1px solid var(--border-light); vertical-align: middle; }
            .ana-table tr:hover td { background: var(--border-light); }
            .ana-table .amount { font-weight: 600; font-variant-numeric: tabular-nums; }
            .ana-table .amount.positive { color: var(--success); }
            .ana-table .amount.negative { color: var(--danger); }

            /* Scenario Sliders */
            .ana-scenario-panel {
                background: var(--bg-card); border: 1px solid var(--border);
                border-radius: var(--radius); padding: 16px; margin-bottom: 20px;
            }
            .ana-scenario-row {
                display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
            }
            .ana-scenario-row label { flex: 0 0 180px; font-size: 13px; font-weight: 500; }
            .ana-scenario-row input[type="range"] { flex: 1; accent-color: var(--primary); }
            .ana-scenario-row .ana-scenario-value { flex: 0 0 100px; text-align: right; font-weight: 700; font-size: 13px; }

            /* Progress bars */
            .ana-progress { width: 100%; height: 8px; background: var(--border-light); border-radius: 4px; overflow: hidden; margin-top: 6px; }
            .ana-progress-bar { height: 100%; background: var(--primary); border-radius: 4px; transition: width 0.3s; }
            .ana-progress-bar.warning { background: var(--warning); }
            .ana-progress-bar.danger { background: var(--danger); }
            .ana-progress-bar.success { background: var(--success); }

            /* Badges */
            .ana-badge {
                display: inline-flex; align-items: center; gap: 4px;
                padding: 3px 8px; border-radius: 10px;
                font-size: 11px; font-weight: 500;
            }
            .ana-badge-real { background: var(--success-light); color: var(--success); }
            .ana-badge-plan { background: var(--info-light); color: var(--info); }
            .ana-badge-sim { background: var(--warning-light); color: var(--warning); }

            /* Empty state */
            .ana-empty { text-align: center; padding: 40px 20px; color: var(--text-muted); }
            .ana-empty i { font-size: 40px; margin-bottom: 12px; opacity: 0.5; }
            .ana-empty h3 { font-size: 15px; color: var(--text); margin-bottom: 6px; }
        `;
        document.head.appendChild(style);
    }

    // =========================================================
    // ESTADO Y CONFIGURACIÓN
    // =========================================================
    let currentView = 'vision';
    let filters = {
        period: 'last3', // 'current', 'last3', 'last6', 'last12', 'custom'
        dateFrom: '2026-08-01',
        dateTo: '2026-10-30',
        person: 'conjunto', // 'ana', 'carlos', 'conjunto'
        type: 'comparativa' // 'real', 'planificada', 'comparativa'
    };
    let scenario = {
        active: false,
        incomeMod: 0, // %
        expenseMod: 0, // %
        extraExpense: 0 // €
    };
    let charts = {};
    let containerEl = null;

    // =========================================================
    // HELPERS DE DATOS (Single Source of Truth)
    // =========================================================
    function getFilteredData() {
        const from = filters.dateFrom;
        const to = filters.dateTo;
        
        // Filtrar gastos/ingresos
        let movements = App.data.expenses.filter(m => {
            if (m.date < from || m.date > to) return false;
            if (filters.person !== 'conjunto' && m.person !== filters.person) return false;
            return true;
        });

        // Filtrar por tipo (real vs planificada)
        if (filters.type === 'real') {
            movements = movements.filter(m => m.status === 'registrado');
        } else if (filters.type === 'planificada') {
            movements = movements.filter(m => m.status === 'previsto' || m.status === 'pendiente');
        }
        // 'comparativa' usa todos, pero los gráficos los separan

        return { movements };
    }

    function calculateKPIs() {
        const { movements } = getFilteredData();
        
        // Excluir transferencias de totales de ingreso/gasto para evitar doble conteo
        const realMovements = movements.filter(m => m.status === 'registrado' && m.type !== 'transferencia');
        const plannedMovements = movements.filter(m => (m.status === 'previsto' || m.status === 'pendiente') && m.type !== 'transferencia');

        const incomeReal = realMovements.filter(m => m.amount > 0).reduce((s, m) => s + m.amount, 0);
        const expenseReal = Math.abs(realMovements.filter(m => m.amount < 0).reduce((s, m) => s + m.amount, 0));
        const savingsReal = incomeReal - expenseReal;
        const savingsRate = incomeReal > 0 ? (savingsReal / incomeReal) * 100 : 0;

        const incomePlanned = plannedMovements.filter(m => m.amount > 0).reduce((s, m) => s + m.amount, 0);
        const expensePlanned = Math.abs(plannedMovements.filter(m => m.amount < 0).reduce((s, m) => s + m.amount, 0));

        // Dinero disponible (suma de saldos manuales de cuentas activas)
        const availableCash = App.data.accounts
            .filter(a => a.status === 'active' && a.isLiquid !== false)
            .reduce((s, a) => s + (a.manualBalance !== null ? a.manualBalance : 0), 0);

        // Próximos compromisos (próximos 30 días)
        const today = '2026-10-30';
        const next30 = '2026-11-29';
        const upcomingCommitments = App.data.expenses
            .filter(m => m.date >= today && m.date <= next30 && (m.status === 'previsto' || m.status === 'pendiente') && m.amount < 0)
            .reduce((s, m) => s + Math.abs(m.amount), 0);

        return { incomeReal, expenseReal, savingsReal, savingsRate, incomePlanned, expensePlanned, availableCash, upcomingCommitments };
    }

    function getChartColors() {
        const isDark = App.isDarkMode ? App.isDarkMode() : false;
        return {
            text: isDark ? '#cbd5e1' : '#64748b',
            grid: isDark ? '#334155' : '#e2e8f0',
            bg: isDark ? '#1e293b' : '#ffffff'
        };
    }

    function generateAlerts(kpis) {
        const alerts = [];
        if (kpis.savingsRate < 10 && kpis.incomeReal > 0) {
            alerts.push({ type: 'warning', icon: 'fas fa-piggy-bank', title: 'Tasa de ahorro baja', desc: `La tasa de ahorro del periodo es del ${kpis.savingsRate.toFixed(1)}%, por debajo del 10% recomendado.` });
        }
        if (kpis.upcomingCommitments > kpis.availableCash * 0.5) {
            alerts.push({ type: 'danger', icon: 'fas fa-exclamation-triangle', title: 'Liquidez comprometida', desc: `Los próximos compromisos (${App.formatCurrency(kpis.upcomingCommitments)}) representan más del 50% de la liquidez disponible.` });
        }
        
        // Alertas de cuentas desactualizadas
        App.data.accounts.filter(a => a.status === 'active').forEach(a => {
            if (a.manualBalanceDate) {
                const days = Math.floor((new Date('2026-10-30') - new Date(a.manualBalanceDate + 'T00:00:00')) / (1000 * 60 * 60 * 24));
                if (days > 14) {
                    alerts.push({ type: 'info', icon: 'fas fa-clock', title: `Saldo de ${a.name} desactualizado`, desc: `Última actualización hace ${days} días.`, action: () => App.navigateTo('cuentas') });
                }
            }
        });

        if (alerts.length === 0) {
            alerts.push({ type: 'success', icon: 'fas fa-check-circle', title: 'Sin desviaciones relevantes', desc: 'Los datos actuales no muestran alertas críticas en el periodo seleccionado.' });
        }
        return alerts;
    }

    // =========================================================
    // RENDER PRINCIPAL
    // =========================================================
    function render(container) {
        injectStyles();
        containerEl = container;

        container.innerHTML = `
            <div class="ana-filters-bar">
                <select class="ana-filter-select" id="anaFilterPeriod">
                    <option value="current">Mes actual</option>
                    <option value="last3" selected>Últimos 3 meses</option>
                    <option value="last6">Últimos 6 meses</option>
                    <option value="last12">Último año</option>
                    <option value="custom">Personalizado</option>
                </select>
                <input type="date" class="ana-filter-input" id="anaFilterFrom" value="${filters.dateFrom}" style="display: none;">
                <input type="date" class="ana-filter-input" id="anaFilterTo" value="${filters.dateTo}" style="display: none;">
                
                <select class="ana-filter-select" id="anaFilterPerson">
                    <option value="conjunto">Perspectiva: Pareja</option>
                    <option value="ana">Perspectiva: Ana</option>
                    <option value="carlos">Perspectiva: Carlos</option>
                </select>
                
                <select class="ana-filter-select" id="anaFilterType">
                    <option value="comparativa">Tipo: Comparativa (Real vs Plan)</option>
                    <option value="real">Tipo: Solo Real</option>
                    <option value="planificada">Tipo: Solo Planificada</option>
                </select>

                <button class="btn btn-sm btn-secondary" id="anaResetFilters" style="margin-left: auto;">
                    <i class="fas fa-undo"></i> Restablecer
               6>
            </div>

            <div class="ana-subnav">
                <button class="ana-subnav-item active" data-view="vision"><i class="fas fa-chart-line"></i> Visión general</button>
                <button class="ana-subnav-item" data-view="ingresos-gastos"><i class="fas fa-wallet"></i> Ingresos y gastos</button>
                <button class="ana-subnav-item" data-view="patrimonio"><i class="fas fa-landmark"></i> Patrimonio y ahorro</button>
                <button class="ana-subnav-item" data-view="planificacion"><i class="fas fa-chess-knight"></i> Planificación futura</button>
            </div>

            <div class="ana-subview active" id="anaView-vision"></div>
            <div class="ana-subview" id="anaView-ingresos-gastos"></div>
            <div class="ana-subview" id="anaView-patrimonio"></div>
            <div class="ana-subview" id="anaView-planificacion"></div>
        `;

        bindGlobalEvents();
        renderView(currentView);
    }

    function bindGlobalEvents() {
        containerEl.querySelectorAll('.ana-subnav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                currentView = btn.dataset.view;
                containerEl.querySelectorAll('.ana-subnav-item').forEach(b => b.classList.toggle('active', b === btn));
                containerEl.querySelectorAll('.ana-subview').forEach(v => v.classList.toggle('active', v.id === `anaView-${currentView}`));
                renderView(currentView);
            });
        });

        const updateFilters = () => {
            filters.period = containerEl.querySelector('#anaFilterPeriod').value;
            filters.person = containerEl.querySelector('#anaFilterPerson').value;
            filters.type = containerEl.querySelector('#anaFilterType').value;
            
            if (filters.period === 'custom') {
                containerEl.querySelector('#anaFilterFrom').style.display = 'block';
                containerEl.querySelector('#anaFilterTo').style.display = 'block';
                filters.dateFrom = containerEl.querySelector('#anaFilterFrom').value;
                filters.dateTo = containerEl.querySelector('#anaFilterTo').value;
            } else {
                containerEl.querySelector('#anaFilterFrom').style.display = 'none';
                containerEl.querySelector('#anaFilterTo').style.display = 'none';
                // Lógica simplificada para demo: ajustar fechas según periodo
                const today = new Date('2026-10-30');
                if (filters.period === 'current') { filters.dateFrom = '2026-10-01'; filters.dateTo = '2026-10-31'; }
                else if (filters.period === 'last3') { filters.dateFrom = '2026-08-01'; filters.dateTo = '2026-10-30'; }
                else if (filters.period === 'last6') { filters.dateFrom = '2026-05-01'; filters.dateTo = '2026-10-30'; }
                else if (filters.period === 'last12') { filters.dateFrom = '2025-11-01'; filters.dateTo = '2026-10-30'; }
            }
            renderView(currentView);
        };

        containerEl.querySelector('#anaFilterPeriod').addEventListener('change', updateFilters);
        containerEl.querySelector('#anaFilterPerson').addEventListener('change', updateFilters);
        containerEl.querySelector('#anaFilterType').addEventListener('change', updateFilters);
        containerEl.querySelector('#anaFilterFrom').addEventListener('change', updateFilters);
        containerEl.querySelector('#anaFilterTo').addEventListener('change', updateFilters);
        
        containerEl.querySelector('#anaResetFilters').addEventListener('click', () => {
            containerEl.querySelector('#anaFilterPeriod').value = 'last3';
            containerEl.querySelector('#anaFilterPerson').value = 'conjunto';
            containerEl.querySelector('#anaFilterType').value = 'comparativa';
            scenario = { active: false, incomeMod: 0, expenseMod: 0, extraExpense: 0 };
            updateFilters();
        });
    }

    function renderView(view) {
        if (view === 'vision') renderVision();
        else if (view === 'ingresos-gastos') renderIngresosGastos();
        else if (view === 'patrimonio') renderPatrimonio();
        else if (view === 'planificacion') renderPlanificacion();
    }

    // =========================================================
    // VISTA 1: VISIÓN GENERAL
    // =========================================================
    function renderVision() {
        const view = containerEl.querySelector('#anaView-vision');
        const kpis = calculateKPIs();
        const alerts = generateAlerts(kpis);
        const colors = getChartColors();

        view.innerHTML = `
            <div class="ana-kpi-grid">
                <div class="ana-kpi-card">
                    <div class="ana-kpi-header">
                        <div>
                            <div class="ana-kpi-label">Ingresos netos</div>
                            <div class="ana-kpi-value">${App.formatCurrency(kpis.incomeReal)}</div>
                        </div>
                        <div class="ana-kpi-icon" style="background: var(--success-light); color: var(--success);"><i class="fas fa-arrow-down"></i></div>
                    </div>
                    <div class="ana-kpi-meta">Periodo seleccionado</div>
                </div>
                <div class="ana-kpi-card">
                    <div class="ana-kpi-header">
                        <div>
                            <div class="ana-kpi-label">Gastos reales</div>
                            <div class="ana-kpi-value">${App.formatCurrency(kpis.expenseReal)}</div>
                        </div>
                        <div class="ana-kpi-icon" style="background: var(--danger-light); color: var(--danger);"><i class="fas fa-arrow-up"></i></div>
                    </div>
                    <div class="ana-kpi-meta">Excluye transferencias</div>
                </div>
                <div class="ana-kpi-card">
                    <div class="ana-kpi-header">
                        <div>
                            <div class="ana-kpi-label">Ahorro neto</div>
                            <div class="ana-kpi-value" style="color: ${kpis.savingsReal >= 0 ? 'var(--success)' : 'var(--danger)'};">${App.formatCurrency(kpis.savingsReal)}</div>
                        </div>
                        <div class="ana-kpi-icon" style="background: var(--primary-light); color: var(--primary);"><i class="fas fa-piggy-bank"></i></div>
                    </div>
                    <div class="ana-kpi-meta ${kpis.savingsReal >= 0 ? 'positive' : 'negative'}">
                        <i class="fas fa-${kpis.savingsReal >= 0 ? 'check' : 'exclamation'}"></i>
                        Tasa: ${kpis.incomeReal > 0 ? kpis.savingsRate.toFixed(1) + '%' : 'N/A'}
                    </div>
                </div>
                <div class="ana-kpi-card">
                    <div class="ana-kpi-header">
                        <div>
                            <div class="ana-kpi-label">Liquidez disponible</div>
                            <div class="ana-kpi-value">${App.formatCurrency(kpis.availableCash)}</div>
                        </div>
                        <div class="ana-kpi-icon" style="background: var(--info-light); color: var(--info);"><i class="fas fa-wallet"></i></div>
                    </div>
                    <div class="ana-kpi-meta">Saldos manuales actualizados</div>
                </div>
                <div class="ana-kpi-card">
                    <div class="ana-kpi-header">
                        <div>
                            <div class="ana-kpi-label">Próximos compromisos</div>
                            <div class="ana-kpi-value">${App.formatCurrency(kpis.upcomingCommitments)}</div>
                        </div>
                        <div class="ana-kpi-icon" style="background: var(--warning-light); color: var(--warning);"><i class="fas fa-calendar-alt"></i></div>
                    </div>
                    <div class="ana-kpi-meta">Próximos 30 días</div>
                </div>
            </div>

            <div class="ana-chart-row">
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">Evolución financiera</div>
                            <div class="card-subtitle">Ingresos, gastos y ahorro mensual</div>
                        </div>
                    </div>
                    <div class="ana-chart-container"><canvas id="anaChartEvolution"></canvas></div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">Planificado vs Real</div>
                            <div class="card-subtitle">Desviación del periodo</div>
                        </div>
                    </div>
                    <div class="ana-chart-container"><canvas id="anaChartPlannedVsReal"></canvas></div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <div class="card-title"><i class="fas fa-bell"></i> Observaciones y Alertas</div>
                </div>
                <div class="ana-alerts-list">
                    ${alerts.map(a => `
                        <div class="ana-alert-item ${a.type}">
                            <div class="ana-alert-icon"><i class="${a.icon}"></i></div>
                            <div style="flex: 1;">
                                <div style="font-weight: 600; margin-bottom: 2px;">${a.title}</div>
                                <div>${a.desc}</div>
                            </div>
                            ${a.action ? `<button class="btn btn-sm btn-secondary" id="alertActionBtn">Ver</button>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        if (alerts.some(a => a.action)) {
            view.querySelector('#alertActionBtn')?.addEventListener('click', () => {
                const actionAlert = alerts.find(a => a.action);
                if (actionAlert) actionAlert.action();
            });
        }

        renderEvolutionChart();
        renderPlannedVsRealChart();
    }

    function renderEvolutionChart() {
        const canvas = containerEl.querySelector('#anaChartEvolution');
        if (!canvas) return;
        if (charts.evolution) charts.evolution.destroy();

        const colors = getChartColors();
        // Datos de demo para los últimos 6 meses
        const labels = ['May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct'];
        const incomeData = [4800, 4800, 7500, 4800, 4800, 4800]; // Jul tiene paga extra
        const expenseData = [3200, 3400, 4100, 3300, 3500, 3600];
        const savingsData = incomeData.map((v, i) => v - expenseData[i]);

        charts.evolution = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Ingresos', data: incomeData, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.3 },
                    { label: 'Gastos', data: expenseData, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.3 },
                    { label: 'Ahorro', data: savingsData, borderColor: '#2563eb', borderDash: [5, 5], fill: false, tension: 0.3 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { color: colors.text, font: { size: 11 } } },
                    tooltip: { mode: 'index', intersect: false, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${App.formatCurrency(ctx.parsed.y)}` } }
                },
                scales: {
                    x: { ticks: { color: colors.text }, grid: { display: false } },
                    y: { ticks: { color: colors.text, callback: v => App.formatCurrency(v) }, grid: { color: colors.grid } }
                }
            }
        });
    }

    function renderPlannedVsRealChart() {
        const canvas = containerEl.querySelector('#anaChartPlannedVsReal');
        if (!canvas) return;
        if (charts.plannedVsReal) charts.plannedVsReal.destroy();

        const colors = getChartColors();
        const kpis = calculateKPIs();

        charts.plannedVsReal = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Ingresos', 'Gastos'],
                datasets: [
                    { label: 'Real', data: [kpis.incomeReal, kpis.expenseReal], backgroundColor: ['#10b981', '#ef4444'], borderRadius: 4 },
                    { label: 'Planificado', data: [kpis.incomePlanned, kpis.expensePlanned], backgroundColor: ['#6ee7b7', '#fca5a5'], borderRadius: 4 }
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
// VISTA 2: INGRESOS Y GASTOS
// =========================================================
    function renderIngresosGastos() {
        const view = containerEl.querySelector('#anaView-ingresos-gastos');
        const { movements } = getFilteredData();
        const expenses = movements.filter(m => m.amount < 0 && m.type !== 'transferencia');
        const incomes = movements.filter(m => m.amount > 0 && m.type !== 'transferencia');

        // CORRECCIÓN: Validar que existan categorías
        const categories = App.data.categories || [];

        // Agrupar gastos por categoría
        const byCategory = {};
        expenses.forEach(m => {
            const cat = categories.find(c => c.id === m.categoryId) || { id: 'unknown', name: 'Sin categorizar', color: '#94a3b8', icon: 'fas fa-question' };
            if (!byCategory[cat.id]) byCategory[cat.id] = { ...cat, total: 0 };
            byCategory[cat.id].total += Math.abs(m.amount);
        });
        const sortedCategories = Object.values(byCategory).sort((a, b) => b.total - a.total);
        const totalExpense = sortedCategories.reduce((s, c) => s + c.total, 0);

        view.innerHTML = `
            <div class="ana-chart-row">
                <div class="card">
                    <div class="card-header"><div class="card-title">Distribución de gastos por categoría</div></div>
                    ${sortedCategories.length === 0 ? `
                        <div class="ana-empty">
                            <i class="fas fa-chart-pie"></i>
                            <h3>Sin gastos en este periodo</h3>
                            <p>No hay gastos registrados para los filtros seleccionados.</p>
                        </div>
                    ` : `
                        <div class="ana-chart-container"><canvas id="anaChartCategories"></canvas></div>
                    `}
                </div>
                <div class="card">
                    <div class="card-header"><div class="card-title">Desglose de categorías</div></div>
                    ${sortedCategories.length === 0 ? `
                        <div class="ana-empty">
                            <i class="fas fa-list"></i>
                            <p>Sin datos para mostrar</p>
                        </div>
                    ` : `
                        <div style="max-height: 320px; overflow-y: auto; padding-right: 8px;">
                            ${sortedCategories.map(c => {
                                const pct = totalExpense > 0 ? (c.total / totalExpense) * 100 : 0;
                                return `
                                    <div style="margin-bottom: 12px;">
                                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                                            <span style="display: flex; align-items: center; gap: 6px;">
                                                <span style="width: 12px; height: 12px; border-radius: 3px; background: ${c.color};"></span>
                                                ${App.escapeHtml(c.name)}
                                            </span>
                                            <span style="font-weight: 600;">${App.formatCurrency(c.total)} (${pct.toFixed(1)}%)</span>
                                        </div>
                                        <div class="ana-progress"><div class="ana-progress-bar" style="width: ${pct}%; background: ${c.color};"></div></div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">Detalle de operaciones</div>
                        <div class="card-subtitle">${movements.length} movimientos en el periodo</div>
                    </div>
                    <button class="btn btn-sm btn-secondary" id="anaExportOps"><i class="fas fa-download"></i> Exportar CSV</button>
                </div>
                ${movements.length === 0 ? `
                    <div class="ana-empty">
                        <i class="fas fa-table"></i>
                        <h3>Sin movimientos</h3>
                        <p>No hay operaciones para los filtros seleccionados.</p>
                    </div>
                ` : `
                    <div class="ana-table-wrap">
                        <table class="ana-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Concepto</th>
                                    <th>Categoría</th>
                                    <th>Persona</th>
                                    <th>Importe</th>
                                    <th>Estado</th>
                                    <th>Origen</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${movements.slice(0, 20).map(m => {
                                    const cat = categories.find(c => c.id === m.categoryId);
                                    const statusBadge = m.status === 'registrado' ? '<span class="ana-badge ana-badge-real">Real</span>' : '<span class="ana-badge ana-badge-plan">Previsto</span>';
                                    return `
                                        <tr>
                                            <td>${App.formatDate(m.date)}</td>
                                            <td style="font-weight: 500;">${App.escapeHtml(m.concept)}</td>
                                            <td>${cat ? App.escapeHtml(cat.name) : '—'}</td>
                                            <td>${App.getProfileName(m.person)}</td>
                                            <td class="amount ${m.amount > 0 ? 'positive' : 'negative'}">${App.formatCurrency(m.amount)}</td>
                                            <td>${statusBadge}</td>
                                            <td><span class="ana-badge" style="background: var(--border-light); color: var(--text-secondary);">${m.origin || 'manual'}</span></td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;

        // CORRECCIÓN: Renderizar gráfico solo si hay datos y el canvas existe
        if (sortedCategories.length > 0) {
            setTimeout(() => {
                renderCategoryChart(sortedCategories);
            }, 100); // Pequeño delay para asegurar que el DOM está listo
        }
        
        view.querySelector('#anaExportOps')?.addEventListener('click', () => {
            const rows = [['Fecha', 'Concepto', 'Categoría', 'Persona', 'Importe', 'Estado']];
            movements.forEach(m => {
                const cat = categories.find(c => c.id === m.categoryId);
                rows.push([m.date, m.concept, cat ? cat.name : '', App.getProfileName(m.person), m.amount, m.status]);
            });
            const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'operaciones.csv'; a.click();
            URL.revokeObjectURL(url);
            App.showToast('CSV exportado');
        });
    }

    function renderCategoryChart(categories) {
        const canvas = containerEl.querySelector('#anaChartCategories');
        if (!canvas) return;
        if (charts.categories) charts.categories.destroy();

        const colors = getChartColors();
        charts.categories = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: categories.map(c => c.name),
                datasets: [{
                    data: categories.map(c => c.total),
                    backgroundColor: categories.map(c => c.color),
                    borderWidth: 2, borderColor: colors.bg
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '65%',
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${App.formatCurrency(ctx.parsed)}` } }
                }
            }
        });
    }

    // =========================================================
    // VISTA 3: PATRIMONIO Y AHORRO
    // =========================================================
    function renderPatrimonio() {
        const view = containerEl.querySelector('#anaView-patrimonio');
        
        // Obtener totales de ahorro del módulo Mi dinero a través del puente de App
        // (sin acoplamiento directo entre módulos)
        const DEFAULT_SAVINGS = { mortgage: { ana: 8500, carlos: 7200, goal: 40000 }, trips: { ana: 1200, carlos: 1100 } };
        let savingsData = DEFAULT_SAVINGS;
        try {
            const s = App.getSavings ? App.getSavings() : null;
            if (s && s.mortgage && s.trips) savingsData = s;
        } catch (e) { /* usa valores por defecto */ }
        const totalMortgage = (savingsData.mortgage.ana || 0) + (savingsData.mortgage.carlos || 0);
        const totalTrips = (savingsData.trips.ana || 0) + (savingsData.trips.carlos || 0);
        const mortgagePct = savingsData.mortgage.goal ? (totalMortgage / savingsData.mortgage.goal) * 100 : 0;

        view.innerHTML = `
            <div class="ana-kpi-grid" style="grid-template-columns: repeat(3, 1fr);">
                <div class="ana-kpi-card">
                    <div class="ana-kpi-label">Patrimonio financiero conocido</div>
                    <div class="ana-kpi-value">${App.formatCurrency(App.data.accounts.reduce((s, a) => s + (a.manualBalance !== null ? a.manualBalance : 0), 0))}</div>
                    <div class="ana-kpi-meta">Suma de saldos manuales de cuentas activas</div>
                </div>
                <div class="ana-kpi-card">
                    <div class="ana-kpi-label">Ahorro acumulado: Hipoteca</div>
                    <div class="ana-kpi-value" style="color: var(--success);">${App.formatCurrency(totalMortgage)}</div>
                    <div class="ana-kpi-meta">Objetivo: ${App.formatCurrency(savingsData.mortgage.goal || 0)}</div>
                </div>
                <div class="ana-kpi-card">
                    <div class="ana-kpi-label">Ahorro acumulado: Viajes</div>
                    <div class="ana-kpi-value" style="color: var(--info);">${App.formatCurrency(totalTrips)}</div>
                    <div class="ana-kpi-meta">Fondo conjunto</div>
                </div>
            </div>

            <div class="ana-chart-row">
                <div class="card">
                    <div class="card-header"><div class="card-title">Situación actual de cuentas</div></div>
                    <div class="ana-table-wrap">
                        <table class="ana-table">
                            <thead>
                                <tr>
                                    <th>Cuenta</th>
                                    <th>Titularidad</th>
                                    <th>Saldo Manual</th>
                                    <th>Saldo Estimado</th>
                                    <th>Diferencia</th>
                                    <th>Última actualización</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${App.data.accounts.filter(a => a.status === 'active').map(a => {
                                    const diff = a.manualBalance !== null && a.referenceBalance !== null ? a.manualBalance - (a.referenceBalance + 0) : null; // Simplificado para demo
                                    return `
                                        <tr>
                                            <td style="font-weight: 500; display: flex; align-items: center; gap: 8px;">
                                                <span style="width: 24px; height: 24px; border-radius: 6px; background: ${a.color}; color: white; display: flex; align-items: center; justify-content: center; font-size: 11px;"><i class="${a.icon}"></i></span>
                                                ${App.escapeHtml(a.name)}
                                            </td>
                                            <td>${a.ownership === 'shared' ? 'Compartida' : App.getProfileName(a.owner)}</td>
                                            <td class="amount">${a.manualBalance !== null ? App.formatCurrency(a.manualBalance) : '<span style="color: var(--text-muted);">Pendiente</span>'}</td>
                                            <td class="amount">${a.referenceBalance !== null ? App.formatCurrency(a.referenceBalance) : '—'}</td>
                                            <td class="amount ${diff !== null && diff < 0 ? 'negative' : 'positive'}">${diff !== null ? App.formatCurrency(diff) : '—'}</td>
                                            <td>${a.manualBalanceDate ? App.formatDate(a.manualBalanceDate) : '—'}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><div class="card-title">Progreso de objetivos</div></div>
                    <div style="padding: 10px 0;">
                        <div style="margin-bottom: 20px;">
                            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
                                <span style="font-weight: 600;"><i class="fas fa-home" style="color: var(--success); margin-right: 6px;"></i> Hipoteca</span>
                                <span>${mortgagePct.toFixed(1)}%</span>
                            </div>
                            <div class="ana-progress"><div class="ana-progress-bar success" style="width: ${Math.min(mortgagePct, 100)}%;"></div></div>
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${App.formatCurrency(totalMortgage)} de ${App.formatCurrency(savingsData.mortgage.goal || 0)}</div>
                        </div>
                        <div>
                            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
                                <span style="font-weight: 600;"><i class="fas fa-plane" style="color: var(--info); margin-right: 6px;"></i> Viajes</span>
                                <span>100% (Sin límite fijo)</span>
                            </div>
                            <div class="ana-progress"><div class="ana-progress-bar" style="width: 100%; background: var(--info);"></div></div>
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${App.formatCurrency(totalTrips)} acumulados</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // =========================================================
// VISTA 4: PLANIFICACIÓN FUTURA (con Escenarios)
// =========================================================
function renderPlanificacion() {
    const view = containerEl.querySelector('#anaView-planificacion');
    
    // Calcular proyección base
    const currentLiquidity = App.data.accounts.reduce((s, a) => s + (a.manualBalance !== null ? a.manualBalance : 0), 0);
    
    // Aplicar modificadores de escenario
    const incomeMod = scenario.incomeMod / 100;
    const expenseMod = scenario.expenseMod / 100;
    
    // Datos de proyección de demo (6 meses futuros)
    const months = ['Nov 26', 'Dic 26', 'Ene 27', 'Feb 27', 'Mar 27', 'Abr 27'];
    const baseIncome = [4800, 7500, 4800, 4800, 4800, 4800];
    const baseExpense = [3600, 4200, 3500, 3500, 3500, 3500];
    
    const projIncome = baseIncome.map(v => v * (1 + incomeMod));
    const projExpense = baseExpense.map(v => v * (1 + expenseMod) + (scenario.extraExpense / 6));
    
    let runningBalance = currentLiquidity;
    const balanceProjection = months.map((m, i) => {
        runningBalance = runningBalance + projIncome[i] - projExpense[i];
        return runningBalance;
    });

    const minBalance = Math.min(...balanceProjection);
    const finalBalance = balanceProjection[balanceProjection.length - 1];

    // CORRECCIÓN: Validar que existan los datos de viajes
    const trips = App.data.trips || [];
    const tripReservations = App.data.tripReservations || [];

    view.innerHTML = `
        <div class="ana-scenario-panel">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <div class="card-title"><i class="fas fa-flask"></i> Simulador de Escenarios</div>
                <button class="btn btn-sm btn-secondary" id="anaResetScenario"><i class="fas fa-undo"></i> Restablecer base</button>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
                <div class="ana-scenario-row">
                    <label>Ingresos futuros</label>
                    <input type="range" min="-20" max="20" value="${scenario.incomeMod}" id="scenIncome">
                    <div class="ana-scenario-value">${scenario.incomeMod > 0 ? '+' : ''}${scenario.incomeMod}%</div>
                </div>
                <div class="ana-scenario-row">
                    <label>Gastos futuros</label>
                    <input type="range" min="-20" max="20" value="${scenario.expenseMod}" id="scenExpense">
                    <div class="ana-scenario-value">${scenario.expenseMod > 0 ? '+' : ''}${scenario.expenseMod}%</div>
                </div>
                <div class="ana-scenario-row">
                    <label>Gasto extraordinario</label>
                    <input type="range" min="0" max="5000" step="100" value="${scenario.extraExpense}" id="scenExtra">
                    <div class="ana-scenario-value">${App.formatCurrency(scenario.extraExpense)}</div>
                </div>
            </div>
            ${scenario.active ? '<div class="ana-badge ana-badge-sim" style="margin-top: 8px;"><i class="fas fa-info-circle"></i> Modo simulación activo: los resultados son proyecciones, no datos reales.</div>' : ''}
        </div>

        <div class="ana-kpi-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 24px;">
            <div class="ana-kpi-card">
                <div class="ana-kpi-label">Liquidez inicial</div>
                <div class="ana-kpi-value">${App.formatCurrency(currentLiquidity)}</div>
            </div>
            <div class="ana-kpi-card">
                <div class="ana-kpi-label">Mínimo proyectado</div>
                <div class="ana-kpi-value" style="color: ${minBalance < 0 ? 'var(--danger)' : 'var(--success)'};">${App.formatCurrency(minBalance)}</div>
                <div class="ana-kpi-meta ${minBalance < 0 ? 'negative' : 'positive'}">${minBalance < 0 ? '¡Riesgo de saldo negativo!' : 'Colchón de seguridad OK'}</div>
            </div>
            <div class="ana-kpi-card">
                <div class="ana-kpi-label">Saldo final proyectado</div>
                <div class="ana-kpi-value">${App.formatCurrency(finalBalance)}</div>
                <div class="ana-kpi-meta">A 6 meses vista</div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <div>
                    <div class="card-title">Proyección de liquidez a 6 meses</div>
                    <div class="card-subtitle">Evolución del saldo considerando previsiones y escenario actual</div>
                </div>
            </div>
            <div class="ana-chart-container"><canvas id="anaChartProjection"></canvas></div>
        </div>

        <div class="card" style="margin-top: 16px;">
            <div class="card-header">
                <div class="card-title">Integración con Viajes y Compromisos</div>
            </div>
            ${trips.length === 0 ? `
                <div class="ana-empty">
                    <i class="fas fa-plane"></i>
                    <h3>Sin viajes planificados</h3>
                    <p>No hay viajes activos para mostrar en este momento.</p>
                </div>
            ` : `
                <div class="ana-table-wrap">
                    <table class="ana-table">
                        <thead>
                            <tr>
                                <th>Concepto</th>
                                <th>Fecha</th>
                                <th>Importe Total</th>
                                <th>Pagado</th>
                                <th>Pendiente</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${trips.filter(t => t.status !== 'cancelado' && t.status !== 'completado').map(t => {
                                const paid = tripReservations.filter(r => r.tripId === t.id).reduce((s, r) => s + (r.paidAmount || 0), 0);
                                const pending = tripReservations.filter(r => r.tripId === t.id).reduce((s, r) => s + (r.pendingAmount || 0), 0);
                                return `
                                    <tr>
                                        <td style="font-weight: 500;"><i class="fas fa-plane" style="color: var(--info); margin-right: 6px;"></i> ${App.escapeHtml(t.name)}</td>
                                        <td>${App.formatDate(t.startDate)}</td>
                                        <td class="amount">${App.formatCurrency(t.budget || 0)}</td>
                                        <td class="amount positive">${App.formatCurrency(paid)}</td>
                                        <td class="amount negative">${App.formatCurrency(pending)}</td>
                                        <td><span class="ana-badge ana-badge-plan">${t.status}</span></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        </div>
    `;

    // Bind scenario sliders
    const updateScenario = () => {
        scenario.active = true;
        scenario.incomeMod = parseInt(containerEl.querySelector('#scenIncome').value);
        scenario.expenseMod = parseInt(containerEl.querySelector('#scenExpense').value);
        scenario.extraExpense = parseInt(containerEl.querySelector('#scenExtra').value);
        renderPlanificacion();
    };

    containerEl.querySelector('#scenIncome').addEventListener('change', updateScenario);
    containerEl.querySelector('#scenExpense').addEventListener('change', updateScenario);
    containerEl.querySelector('#scenExtra').addEventListener('change', updateScenario);
    containerEl.querySelector('#anaResetScenario').addEventListener('click', () => {
        scenario = { active: false, incomeMod: 0, expenseMod: 0, extraExpense: 0 };
        renderPlanificacion();
    });

    renderProjectionChart(months, balanceProjection, currentLiquidity);
}

    function renderProjectionChart(labels, projectionData, startValue) {
        const canvas = containerEl.querySelector('#anaChartProjection');
        if (!canvas) return;
        if (charts.projection) charts.projection.destroy();

        const colors = getChartColors();
        
        // Crear dataset con color condicional si baja de 0
        const bgColors = projectionData.map(v => v < 0 ? 'rgba(239,68,68,0.2)' : 'rgba(37,99,235,0.2)');
        const borderColors = projectionData.map(v => v < 0 ? '#ef4444' : '#2563eb');

        charts.projection = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Actual', ...labels],
                datasets: [{
                    label: 'Saldo proyectado',
                    data: [startValue, ...projectionData],
                    backgroundColor: ['rgba(16,185,129,0.3)', ...bgColors],
                    borderColor: ['#10b981', ...borderColors],
                    borderWidth: 2,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => `Saldo: ${App.formatCurrency(ctx.parsed.y)}` } },
                    annotation: { // Nota: Chart.js annotation plugin no está cargado por defecto, se simula con línea de referencia si se quisiera
                    }
                },
                scales: {
                    x: { ticks: { color: colors.text }, grid: { display: false } },
                    y: { 
                        ticks: { color: colors.text, callback: v => App.formatCurrency(v) }, 
                        grid: { color: colors.grid },
                        beginAtZero: false
                    }
                }
            }
        });
    }

    // =========================================================
    // INIT
    // =========================================================
    function init() {}

    function onThemeChange() {
        // Re-renderizar gráficos para actualizar colores de ejes/grid
        if (currentView === 'vision') { renderEvolutionChart(); renderPlannedVsRealChart(); }
        else if (currentView === 'ingresos-gastos') renderIngresosGastos();
        else if (currentView === 'planificacion') renderPlanificacion();
    }

    // =========================================================
    // API PÚBLICA
    // =========================================================
    return {
        render,
        init,
        onThemeChange
    };
})();

// Registrar sección en la aplicación principal
App.registerSection('analisis', {
    render: (container) => AnalysisApp.render(container),
    init: () => AnalysisApp.init(),
    onThemeChange: () => AnalysisApp.onThemeChange()
});

window.AnalysisApp = AnalysisApp;