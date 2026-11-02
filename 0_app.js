const App = (function() {
    'use strict';

    // =========================================================
    // DATOS POR DEFECTO
    // =========================================================
    const DEFAULT_DATA = {
        profiles: [
            { id: 'ana', name: 'Ana', initial: 'A', color: '#ec4899' },
            { id: 'carlos', name: 'Carlos', initial: 'C', color: '#2563eb' }
        ],
        activeProfile: 'ana',
        accounts: [
            { id: 'acc-1', name: 'Cuenta conjunta', type: 'conjunta', balance: 3450.80, owners: ['ana', 'carlos'], color: '#2563eb' },
            { id: 'acc-2', name: 'Cuenta Ana', type: 'personal', balance: 1820.50, owners: ['ana'], color: '#ec4899' },
            { id: 'acc-3', name: 'Cuenta Carlos', type: 'personal', balance: 2460.00, owners: ['carlos'], color: '#10b981' },
            { id: 'acc-tr', name: 'Trade Republic', type: 'inversion', balance: 781.15, owners: ['ana', 'carlos'], color: '#5b6cff' },
            { id: 'acc-mi', name: 'MyInvestor', type: 'banco', balance: 1150.00, owners: ['ana', 'carlos'], color: '#0ea5e9' }
        ],
        categories: [
            { id: 'cat-1', name: 'Alimentación', icon: 'fas fa-utensils', color: '#f59e0b', parentId: null, status: 'active', order: 1, budget: 500, description: 'Supermercado, mercado y limpieza' },
            { id: 'cat-1-1', name: 'Supermercado', icon: 'fas fa-shopping-basket', color: '#f59e0b', parentId: 'cat-1', status: 'active', order: 1 },
            { id: 'cat-1-2', name: 'Mercado', icon: 'fas fa-store', color: '#f59e0b', parentId: 'cat-1', status: 'active', order: 2 },
            { id: 'cat-1-3', name: 'Productos de limpieza', icon: 'fas fa-soap', color: '#f59e0b', parentId: 'cat-1', status: 'active', order: 3 },
            { id: 'cat-2', name: 'Restaurantes y ocio', icon: 'fas fa-coffee', color: '#06b6d4', parentId: null, status: 'active', order: 2, budget: 250 },
            { id: 'cat-2-1', name: 'Restaurantes', icon: 'fas fa-utensils', color: '#06b6d4', parentId: 'cat-2', status: 'active', order: 1 },
            { id: 'cat-2-2', name: 'Cafeterías', icon: 'fas fa-mug-hot', color: '#06b6d4', parentId: 'cat-2', status: 'active', order: 2 },
            { id: 'cat-2-3', name: 'Actividades de ocio', icon: 'fas fa-film', color: '#06b6d4', parentId: 'cat-2', status: 'active', order: 3 },
            { id: 'cat-3', name: 'Vivienda', icon: 'fas fa-home', color: '#ef4444', parentId: null, status: 'active', order: 3, budget: 1000 },
            { id: 'cat-3-1', name: 'Alquiler', icon: 'fas fa-key', color: '#ef4444', parentId: 'cat-3', status: 'active', order: 1 },
            { id: 'cat-3-2', name: 'Comunidad', icon: 'fas fa-building', color: '#ef4444', parentId: 'cat-3', status: 'active', order: 2 },
            { id: 'cat-3-3', name: 'Otros gastos de vivienda', icon: 'fas fa-tools', color: '#ef4444', parentId: 'cat-3', status: 'active', order: 3 },
            { id: 'cat-4', name: 'Suministros', icon: 'fas fa-bolt', color: '#8b5cf6', parentId: null, status: 'active', order: 4, budget: 200 },
            { id: 'cat-4-1', name: 'Electricidad', icon: 'fas fa-bolt', color: '#8b5cf6', parentId: 'cat-4', status: 'active', order: 1 },
            { id: 'cat-4-2', name: 'Agua', icon: 'fas fa-tint', color: '#8b5cf6', parentId: 'cat-4', status: 'active', order: 2 },
            { id: 'cat-4-3', name: 'Gas', icon: 'fas fa-fire', color: '#8b5cf6', parentId: 'cat-4', status: 'active', order: 3 },
            { id: 'cat-4-4', name: 'Internet y telefonía', icon: 'fas fa-wifi', color: '#8b5cf6', parentId: 'cat-4', status: 'active', order: 4 },
            { id: 'cat-5', name: 'Transporte', icon: 'fas fa-bus', color: '#10b981', parentId: null, status: 'active', order: 5, budget: 200 },
            { id: 'cat-5-1', name: 'Transporte público', icon: 'fas fa-subway', color: '#10b981', parentId: 'cat-5', status: 'active', order: 1 },
            { id: 'cat-5-2', name: 'Taxis y desplazamientos', icon: 'fas fa-taxi', color: '#10b981', parentId: 'cat-5', status: 'active', order: 2 },
            { id: 'cat-6', name: 'Coche', icon: 'fas fa-car', color: '#64748b', parentId: null, status: 'active', order: 6, budget: 300 },
            { id: 'cat-6-1', name: 'Combustible', icon: 'fas fa-gas-pump', color: '#64748b', parentId: 'cat-6', status: 'active', order: 1 },
            { id: 'cat-6-2', name: 'Seguro', icon: 'fas fa-shield-alt', color: '#64748b', parentId: 'cat-6', status: 'active', order: 2 },
            { id: 'cat-6-3', name: 'Mantenimiento', icon: 'fas fa-wrench', color: '#64748b', parentId: 'cat-6', status: 'active', order: 3 },
            { id: 'cat-6-4', name: 'Aparcamiento', icon: 'fas fa-parking', color: '#64748b', parentId: 'cat-6', status: 'active', order: 4 },
            { id: 'cat-7', name: 'Hogar', icon: 'fas fa-couch', color: '#ec4899', parentId: null, status: 'active', order: 7, budget: 150 },
            { id: 'cat-8', name: 'Salud', icon: 'fas fa-heartbeat', color: '#dc2626', parentId: null, status: 'active', order: 8, budget: 100 },
            { id: 'cat-9', name: 'Compras', icon: 'fas fa-shopping-bag', color: '#a855f7', parentId: null, status: 'active', order: 9, budget: 200 },
            { id: 'cat-10', name: 'Suscripciones', icon: 'fas fa-tv', color: '#0ea5e9', parentId: null, status: 'active', order: 10, budget: 80 },
            { id: 'cat-11', name: 'Viajes', icon: 'fas fa-plane', color: '#14b8a6', parentId: null, status: 'active', order: 11, budget: null },
            { id: 'cat-12', name: 'Otros', icon: 'fas fa-ellipsis-h', color: '#94a3b8', parentId: null, status: 'active', order: 12, budget: null }
        ],
        expenses: [
            { id: 'e1', concept: 'Mercado San Miguel', amount: 42.80, date: '2026-10-30', categoryId: 'cat-1-2', person: 'conjunto', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e2', concept: 'Iberdrola - Electricidad', amount: 87.40, date: '2026-10-29', categoryId: 'cat-4-1', person: 'conjunto', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e3', concept: 'Repsol - Combustible', amount: 65.20, date: '2026-10-28', categoryId: 'cat-6-1', person: 'carlos', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e4', concept: 'Alquiler noviembre', amount: 950.00, date: '2026-11-01', categoryId: 'cat-3-1', person: 'conjunto', status: 'previsto', type: 'individual', notes: '' },
            { id: 'e5', concept: 'Cafetería Central', amount: 12.50, date: '2026-10-27', categoryId: 'cat-2-2', person: 'ana', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e6', concept: 'Netflix + Spotify', amount: 25.99, date: '2026-10-25', categoryId: 'cat-10', person: 'conjunto', status: 'registrado', type: 'agregado', notes: 'Suscripciones mensuales', aggPeriod: '2026-10' },
            { id: 'e7', concept: 'Cena restaurante italiano', amount: 58.00, date: '2026-10-24', categoryId: 'cat-2-1', person: 'conjunto', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e8', concept: 'Supermercado Mercadona', amount: 124.30, date: '2026-10-22', categoryId: 'cat-1-1', person: 'ana', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e9', concept: 'Agua - Canal Isabel II', amount: 32.50, date: '2026-10-20', categoryId: 'cat-4-2', person: 'conjunto', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e10', concept: 'Abono transporte mensual', amount: 84.00, date: '2026-10-18', categoryId: 'cat-5-1', person: 'conjunto', status: 'registrado', type: 'agregado', notes: '', aggPeriod: '2026-10' },
            { id: 'e11', concept: 'Cine', amount: 18.00, date: '2026-10-17', categoryId: 'cat-2-3', person: 'conjunto', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e12', concept: 'Productos limpieza', amount: 28.40, date: '2026-10-15', categoryId: 'cat-1-3', person: 'ana', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e13', concept: 'Móvil Vodafone', amount: 45.00, date: '2026-10-14', categoryId: 'cat-4-4', person: 'conjunto', status: 'registrado', type: 'agregado', notes: '', aggPeriod: '2026-10' },
            { id: 'e14', concept: 'Farmacia', amount: 22.80, date: '2026-10-12', categoryId: 'cat-8', person: 'carlos', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e15', concept: 'Zara - Camisas', amount: 79.90, date: '2026-10-10', categoryId: 'cat-9', person: 'carlos', status: 'pendiente', type: 'individual', notes: 'Pendiente revisar ticket' },
            { id: 'e16', concept: 'Gas natural', amount: 38.60, date: '2026-10-08', categoryId: 'cat-4-3', person: 'conjunto', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e17', concept: 'Comunidad vecinos', amount: 85.00, date: '2026-10-05', categoryId: 'cat-3-2', person: 'conjunto', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e18', concept: 'Parking centro', amount: 15.00, date: '2026-10-04', categoryId: 'cat-6-4', person: 'ana', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e19', concept: 'Compra sin categorizar', amount: 35.00, date: '2026-10-03', categoryId: '', person: 'carlos', status: 'pendiente', type: 'individual', notes: 'Revisar' },
            { id: 'e20', concept: 'Mercado ecológico', amount: 56.70, date: '2026-10-02', categoryId: 'cat-1-2', person: 'ana', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e21', concept: 'Taller mecánico', amount: 145.00, date: '2026-10-01', categoryId: 'cat-6-3', person: 'conjunto', status: 'registrado', type: 'individual', notes: 'Cambio aceite' },
            { id: 'e100', concept: 'Alquiler octubre', amount: 950.00, date: '2026-10-01', categoryId: 'cat-3-1', person: 'conjunto', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e101', concept: 'Supermercado semanal', amount: 98.50, date: '2026-09-28', categoryId: 'cat-1-1', person: 'ana', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e102', concept: 'Restaurante japonés', amount: 72.00, date: '2026-09-25', categoryId: 'cat-2-1', person: 'conjunto', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e103', concept: 'Electricidad septiembre', amount: 92.30, date: '2026-09-22', categoryId: 'cat-4-1', person: 'conjunto', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e104', concept: 'Combustible', amount: 58.00, date: '2026-09-18', categoryId: 'cat-6-1', person: 'carlos', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e105', concept: 'Cine y palomitas', amount: 24.00, date: '2026-09-15', categoryId: 'cat-2-3', person: 'conjunto', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e106', concept: 'Comunidad', amount: 85.00, date: '2026-09-05', categoryId: 'cat-3-2', person: 'conjunto', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e107', concept: 'Abono transporte', amount: 84.00, date: '2026-09-03', categoryId: 'cat-5-1', person: 'conjunto', status: 'registrado', type: 'agregado', notes: '', aggPeriod: '2026-09' },
            { id: 'e200', concept: 'Alquiler septiembre', amount: 950.00, date: '2026-09-01', categoryId: 'cat-3-1', person: 'conjunto', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e201', concept: 'Supermercado', amount: 145.00, date: '2026-08-25', categoryId: 'cat-1-1', person: 'ana', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e202', concept: 'Playa - Restaurante', amount: 68.50, date: '2026-08-20', categoryId: 'cat-2-1', person: 'conjunto', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e203', concept: 'Electricidad agosto', amount: 110.00, date: '2026-08-18', categoryId: 'cat-4-1', person: 'conjunto', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e204', concept: 'Combustible vacaciones', amount: 120.00, date: '2026-08-10', categoryId: 'cat-6-1', person: 'carlos', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e205', concept: 'Hotel 2 noches', amount: 240.00, date: '2026-08-08', categoryId: 'cat-11', person: 'conjunto', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e300', concept: 'Alquiler agosto', amount: 950.00, date: '2026-08-01', categoryId: 'cat-3-1', person: 'conjunto', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e301', concept: 'Supermercado', amount: 132.00, date: '2026-07-22', categoryId: 'cat-1-1', person: 'ana', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e302', concept: 'Terraza verano', amount: 45.00, date: '2026-07-18', categoryId: 'cat-2-2', person: 'conjunto', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e303', concept: 'Electricidad julio', amount: 98.00, date: '2026-07-15', categoryId: 'cat-4-1', person: 'conjunto', status: 'registrado', type: 'individual', notes: '' },
            { id: 'e400', concept: 'Seguro coche anual', amount: 420.00, date: '2026-11-15', categoryId: 'cat-6-2', person: 'conjunto', status: 'previsto', type: 'individual', notes: '' }
        ],
        budgets: [
            { id: 'b1', categoryId: 'cat-1', amount: 500, period: '2026-10', frequency: 'monthly' },
            { id: 'b2', categoryId: 'cat-2', amount: 250, period: '2026-10', frequency: 'monthly' },
            { id: 'b3', categoryId: 'cat-3', amount: 1000, period: '2026-10', frequency: 'monthly' },
            { id: 'b4', categoryId: 'cat-4', amount: 200, period: '2026-10', frequency: 'monthly' },
            { id: 'b5', categoryId: 'cat-5', amount: 200, period: '2026-10', frequency: 'monthly' },
            { id: 'b6', categoryId: 'cat-6', amount: 300, period: '2026-10', frequency: 'monthly' },
            { id: 'b7', categoryId: 'cat-7', amount: 150, period: '2026-10', frequency: 'monthly' },
            { id: 'b8', categoryId: 'cat-8', amount: 100, period: '2026-10', frequency: 'monthly' },
            { id: 'b9', categoryId: 'cat-9', amount: 200, period: '2026-10', frequency: 'monthly' },
            { id: 'b10', categoryId: 'cat-10', amount: 80, period: '2026-10', frequency: 'monthly' }
        ],
        trips: [
            { id: 't1', name: 'Escapada Portugal', destination: 'Oporto', startDate: '2026-12-18', endDate: '2026-12-22', budget: 800, spent: 0, status: 'planificado' }
        ],
        settings: {
            defaultPeriod: 'monthly',
            rollover: false,
            includePlanned: false,
            thresholdWarning: 80,
            thresholdDanger: 100,
            alertUncategorized: true,
            alertNoBudget: true,
            showBudgetCard: true,
            showExpensesCard: true,
            showRemainingCard: true,
            showDeviationCard: true,
            recentCount: 5,
            defaultSort: 'date-desc'
        },
        history: [],

        // ===== PRESUPUESTO COMÚN (pantalla única) — datos maestros =====
        pcCategories: [
            { id: 'pc-groceries',  name: 'Groceries and Liquor',           label: 'GROCERIES AND LIQUOR', icon: '🛒', account: 'Trade Republic', budget: null, order: 1 },
            { id: 'pc-others',     name: 'Others',                         label: 'OTHERS',               icon: '📦', account: 'Trade Republic', budget: 200,  order: 2, dueDate: '2026-11-15' },
            { id: 'pc-utilities',  name: 'Utilities',                      label: 'UTILITIES',            icon: '💡', account: 'MyInvestor',   budget: null, order: 3 },
            { id: 'pc-rent',       name: 'Renta',                          label: 'RENT',                 icon: '🏠', account: 'MyInvestor',   budget: 950,  order: 4, dueDate: '2026-11-01' },
            { id: 'pc-loans',      name: 'Préstamos y Financiaciones',     label: 'LOANS',                icon: '💳', account: 'Trade Republic', budget: null, order: 5 },
            { id: 'pc-savings',    name: 'Savings',                        label: 'SAVINGS',              icon: '💰', account: 'MyInvestor',   budget: null, order: 6 }
        ],
        pcSubcategories: [
            { id: 'pcs-electricity', parentId: 'pc-utilities', name: 'Electricity (Luz)',        icon: '⚡', account: 'MyInvestor', budget: 90 },
            { id: 'pcs-water',       parentId: 'pc-utilities', name: 'Water (Agua)',             icon: '💧', account: 'MyInvestor', budget: 35, dueDate: '2026-11-28' },
            { id: 'pcs-phone',       parentId: 'pc-utilities', name: 'WiFi & Phone (Lowi)',      icon: '📶', account: 'MyInvestor', budget: 50, dueDate: '2026-11-15' },
            { id: 'pcs-others-gen',  parentId: 'pc-others',    name: 'Gastos varios',              icon: '🧩', account: 'Trade Republic', budget: 200 },
            { id: 'pcs-tr',          parentId: 'pc-savings',   name: 'Trade Republic',           icon: '📈', account: 'Trade Republic', destination: 'TradeRepublic', budget: 640 },
            { id: 'pcs-funds',       parentId: 'pc-savings',   name: 'Funds',                    icon: '💼', account: 'Trade Republic', destination: 'Funds', budget: null },
            { id: 'pcs-mi',          parentId: 'pc-savings',   name: 'MyInvestor',               icon: '🏦', account: 'MyInvestor', destination: 'MyInvestor' },
            { id: 'pcs-general',     parentId: 'pc-savings',   name: 'General Savings (Ahorro)', icon: '🐷', account: 'MyInvestor', destination: 'General' },
            { id: 'pcs-sofa',        parentId: 'pc-loans',     name: 'Sofá',                     icon: '🛋️', account: 'Trade Republic' },
            { id: 'pcs-bed',         parentId: 'pc-loans',     name: 'Cama',                     icon: '🛏️', account: 'Trade Republic' }
        ],
        pcWeeks: [
            { id: 'wk-1', label: 'Semana 1', start: '2026-11-02', end: '2026-11-08', budget: 160 },
            { id: 'wk-2', label: 'Semana 2', start: '2026-11-09', end: '2026-11-15', budget: 160 },
            { id: 'wk-3', label: 'Semana 3', start: '2026-11-16', end: '2026-11-22', budget: 160 },
            { id: 'wk-4', label: 'Semana 4', start: '2026-11-23', end: '2026-11-29', budget: 160 }
        ],
        pcLoans: [
            { id: 'loan-sofa', name: 'Sofá',     totalInstallments: 18, paidInstallments: 4,  amountPerInstallment: 45,  status: 'active' },
            { id: 'loan-bed',  name: 'Cama',     totalInstallments: 23, paidInstallments: 6,  amountPerInstallment: 38,  status: 'active' }
        ],
        pcIncomes: [
            { id: 'inc-nena',   name: 'Nena',   salary: 2100, freePct: 35, contribution: 550 },
            { id: 'inc-bombon', name: 'Bombón', salary: 1750, freePct: 30, contribution: 550 }
        ],
        pcMyInvestorTarget: 1125,
        // ===== Reconciliación Semanal Trade Republic =====
        pcReconciliation: {
            initialBalance: 845.15,   // Saldo Inicial TR al inicio del mes
            weeksClosed: {},          // { weekId: true } → descuenta presupuesto semanal
            loansPaid: {},            // { loanId: true } → descuenta cuota del préstamo
            realBalances: {}          // { weekId: saldoRealIntroducido }
        }
    };

    // =========================================================
    // ESTADO
    // =========================================================
    let data = loadData();
    let currentSection = 'presupuesto-comun';
    const sections = {};

    function loadData() {
        try {
            const saved = localStorage.getItem('finanzas_data');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Migración: inyectar claves nuevas del presupuesto común sin perder datos guardados
                ['pcCategories','pcSubcategories','pcWeeks','pcLoans','pcIncomes','pcReconciliation'].forEach(k => {
                    if (!(k in parsed)) parsed[k] = JSON.parse(JSON.stringify(DEFAULT_DATA[k]));
                });
                return parsed;
            }
        } catch(e) {}
        return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }

    function saveData() {
        try {
            localStorage.setItem('finanzas_data', JSON.stringify(data));
        } catch(e) {}
    }

    function resetData() {
        data = JSON.parse(JSON.stringify(DEFAULT_DATA));
        saveData();
    }

    function addHistory(action, detail) {
        data.history.unshift({
            timestamp: new Date().toISOString(),
            action,
            detail
        });
        if (data.history.length > 100) data.history = data.history.slice(0, 100);
        saveData();
    }

    // =========================================================
    // FORMATO
    // =========================================================
    function formatCurrency(n) {
        if (n === null || n === undefined || isNaN(n)) return '—';
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr + 'T00:00:00');
        if (isNaN(d.getTime())) return dateStr;
        return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
    }

    function formatPeriod(period) {
        if (!period) return '';
        const [y, m] = period.split('-');
        const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        return `${months[parseInt(m)-1]} ${y}`;
    }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function generateId(prefix = 'id') {
        return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    }

    // =========================================================
    // TOAST
    // =========================================================
    function showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        const icon = type === 'error' ? 'times-circle' : type === 'warning' ? 'exclamation-circle' : 'check-circle';
        const color = type === 'error' ? 'var(--danger)' : type === 'warning' ? 'var(--warning)' : 'var(--success)';
        toast.style.borderLeftColor = color;
        toast.innerHTML = `<i class="fas fa-${icon}" style="color: ${color};"></i><span>${escapeHtml(message)}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // =========================================================
    // CONFIRMACIÓN
    // =========================================================
    function showConfirm(title, message, onConfirm) {
        let modal = document.getElementById('globalConfirmModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'globalConfirmModal';
            modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;align-items:center;justify-content:center;padding:20px;';
            modal.innerHTML = `
                <div style="background:var(--bg-card);border-radius:14px;max-width:420px;width:100%;box-shadow:0 10px 25px rgba(0,0,0,0.2);">
                    <div style="padding:20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
                        <h3 id="gcTitle" style="font-size:16px;font-weight:600;margin:0;"></h3>
                        <button id="gcClose" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;padding:4px;"><i class="fas fa-times"></i></button>
                    </div>
                    <div style="padding:20px;"><p id="gcMessage" style="font-size:14px;margin:0;"></p></div>
                    <div style="padding:16px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;">
                        <button class="btn btn-secondary" id="gcCancel">Cancelar</button>
                        <button class="btn btn-danger" id="gcConfirm">Confirmar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        document.getElementById('gcTitle').textContent = title;
        document.getElementById('gcMessage').textContent = message;
        modal.style.display = 'flex';

        const close = () => { modal.style.display = 'none'; };
        document.getElementById('gcClose').onclick = close;
        document.getElementById('gcCancel').onclick = close;
        modal.onclick = (e) => { if (e.target === modal) close(); };

        const confirmBtn = document.getElementById('gcConfirm');
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
        newBtn.addEventListener('click', () => {
            onConfirm();
            close();
        });
    }

    // =========================================================
    // NAVEGACIÓN
    // =========================================================
    const SECTION_META = {
        'presupuesto-comun': { title: 'Presupuesto común', subtitle: () => 'Dashboard financiero compartido · pantalla única' },
        'calendario': { title: 'Calendario', subtitle: () => 'Planificación y vencimientos' },
        'mi-dinero': { title: 'Dinero', subtitle: () => 'Tu dinero en una sola pantalla · monederos, deudas, préstamos, objetivos y pagos' },
        'ingresos-personales': { title: 'Ingresos personales', subtitle: () => 'Tus finanzas personales (módulo legado)' },
        'viajes': { title: 'Viajes', subtitle: () => 'Planifica tus escapadas' }
    };

    // Alias de nombres de sección (soporta acentos y variantes en data-section)
    const SECTION_ALIASES = {
        'inicio': 'presupuesto-comun',
        'home': 'presupuesto-comun',
        'presupuesto': 'presupuesto-comun'
    };

    function normalizeSectionName(name) {
        return SECTION_ALIASES[name] || name;
    }

    function navigateTo(section) {
        section = normalizeSectionName(section);
        if (!sections[section]) {
            console.warn('Sección no registrada:', section);
            showToast('Sección no disponible', 'warning');
            return;
        }
        currentSection = section;
        const meta = SECTION_META[section];
        document.getElementById('pageTitle').textContent = meta.title;
        document.getElementById('pageSubtitle').textContent = meta.subtitle();

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });

        const container = document.getElementById('sectionContainer');
        container.innerHTML = '';
        sections[section].render(container);
        if (sections[section].init) sections[section].init();

        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('overlay').classList.remove('open');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function registerSection(name, module) {
        // Normaliza el nombre para que 'configuración' y 'configuracion'
        // sean intercambiables al registrar/navegar
        sections[normalizeSectionName(name)] = module;
    }

    // =========================================================
    // PUENTE ENTRE MÓDULOS (único punto de acoplamiento)
    // =========================================================
    // Los módulos se registran aquí con su clave y publican solo la API
    // que otros módulos necesitan. Ningún módulo llama directamente a otro.
    const modules = {};

    function registerModule(key, api) {
        modules[key] = api;
    }

    // Acceso a datos que un módulo expone a través del puente (read-only helpers)
    function getSavings() {
        const mod = modules['mi-dinero'];
        return mod && typeof mod.getSavings === 'function' ? mod.getSavings() : null;
    }

    // Navega a una sección y, si procede, invoca una acción del módulo destino
    // (p.ej. abrir el modal de un gasto concreto desde el calendario).
    function goTo(section, action, params) {
        navigateTo(section);
        if (!action) return;
        const mod = modules[section];
        if (mod && typeof mod[action] === 'function') {
            try {
                mod[action](...(Array.isArray(params) ? params : (params !== undefined ? [params] : [])));
            } catch (e) {
                console.error(`Error en la acción "${action}" del módulo "${section}":`, e);
            }
        } else {
            console.warn(`Módulo "${section}" no registrado o acción "${action}" no disponible`);
        }
    }

    // =========================================================
    // TEMA
    // =========================================================
    function initTheme() {
        const saved = localStorage.getItem('finanzas_theme') || 'light';
        document.documentElement.setAttribute('data-theme', saved);
        updateThemeIcon();

        document.getElementById('themeToggle').addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('finanzas_theme', next);
            updateThemeIcon();
            if (sections[currentSection] && sections[currentSection].onThemeChange) {
                sections[currentSection].onThemeChange();
            }
        });
    }

    function updateThemeIcon() {
        const theme = document.documentElement.getAttribute('data-theme');
        document.getElementById('themeToggle').innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }

    function isDarkMode() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }

    // =========================================================
    // MENÚ MÓVIL
    // =========================================================
    function initMobileMenu() {
        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
            document.getElementById('overlay').classList.toggle('open');
        });
        document.getElementById('overlay').addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('overlay').classList.remove('open');
        });
    }

    // =========================================================
    // PERFIL
    // =========================================================
    function getActiveProfile() {
        return data.profiles.find(p => p.id === data.activeProfile) || data.profiles[0];
    }

    function getProfileName(id) {
        if (id === 'conjunto') return 'Conjunto';
        const p = data.profiles.find(p => p.id === id);
        return p ? p.name : id;
    }

    function updateProfileUI() {
        const p = getActiveProfile();
        const avatar = document.getElementById('activeAvatar');
        const name = document.getElementById('activeName');
        if (avatar) {
            avatar.textContent = p.initial;
            avatar.style.background = p.color + '30';
            avatar.style.color = p.color;
        }
        if (name) name.textContent = p.name;
    }

    // =========================================================
    // INIT
    // =========================================================
    function init() {
        initTheme();
        initMobileMenu();
        updateProfileUI();

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo(normalizeSectionName(item.dataset.section));
            });
        });

        // Presupuesto común como pantalla de inicio de la aplicación
        navigateTo(normalizeSectionName('presupuesto-comun'));
    }

    // =========================================================
    // API PÚBLICA
    // =========================================================
    return {
        get data() { return data; },
        saveData,
        resetData,
        addHistory,

        navigateTo,
        goTo,
        registerSection,
        registerModule,
        getSavings,
        get currentSection() { return currentSection; },

        formatCurrency,
        formatDate,
        formatPeriod,
        escapeHtml,
        generateId,

        showToast,
        showConfirm,
        isDarkMode,

        getActiveProfile,
        getProfileName,

        init
    };
})();

window.App = App;