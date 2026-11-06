/* =============================================================================
   APP.JS · v2 — Shell + puente completo entre módulos
   -----------------------------------------------------------------------------
   Contiene:
     · DEFAULT_DATA sin duplicidades (Fase 1)
     · Migración automática e idempotente de datos antiguos (Fase 1)
     · Puente completo App (lectura + escritura cruzada) (Fase 2)
     · Notificación con dedup + guarda anti-bucle (Fase 2)
     · Utilidades compartidas (formato, storage, estilos, toast, confirm)
     · Navegación entre secciones con contenedor por sección
     · Tema, menú móvil, perfil
     · Arranque + montaje de TripManager
   ============================================================================= */
const App = (function () {
    'use strict';

    /* =========================================================
       DATOS POR DEFECTO (sin duplicidades)
       ========================================================= */
    const DEFAULT_DATA = {
        /* ---------- Usuarios (no es demo · son los perfiles de la app) ---------- */
        profiles: [
            { id: 'ana', name: 'Nena', initial: 'N', color: '#ec4899' },
            { id: 'carlos', name: 'Bombón', initial: 'B', color: '#2563eb' }
        ],
        activeProfile: 'ana',

        /* ---------- Datos: TODO vacío · la fuente es el Google Sheet ---------- */
        accounts: [],
        categories: [],
        expenses: [],
        budgets: [],
        trips: [],
        calendarEvents: [],
        transfers: [],
        tripActivities: [],
        tripReservations: [],

        /* ---------- Configuración por defecto (no es demo · son valores iniciales) ---------- */
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

        /* ---------- Presupuesto común · estructura mínima (sin categorías, sin datos) ---------- */
        pcCategories: [],
        pcSubcategories: [],
        pcWeeks: [],
        pcMyInvestorTarget: 0,
        pcReconciliation: {
            initialBalance: 0,
            weeksClosed: {},
            loansPaid: {},
            realBalances: {}
        }
    };

    /* =========================================================
       ESTADO Y PERSISTENCIA
       ========================================================= */
    const clone = obj => JSON.parse(JSON.stringify(obj));

    function loadStored(key, defaults) {
        if (window.DataService && typeof DataService.loadStored === 'function') {
            return DataService.loadStored(key, defaults);
        }
        try {
            const saved = localStorage.getItem(key);
            if (saved) return Object.assign(clone(defaults), JSON.parse(saved));
        } catch (e) {}
        return clone(defaults);
    }
    function saveStored(key, value) {
        if (window.DataService && typeof DataService.saveStored === 'function') {
            DataService.saveStored(key, value);
            return;
        }
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }
    function injectStylesheet(id, css) {
        if (document.getElementById(id)) return;
        const style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        document.head.appendChild(style);
    }

    function loadData() {
        const parsed = loadStored('finanzas_data', DEFAULT_DATA);
        ['pcCategories','pcSubcategories','pcWeeks','pcReconciliation',
         'calendarEvents','transfers','tripActivities','tripReservations'].forEach(k => {
            if (!(k in parsed)) parsed[k] = clone(DEFAULT_DATA[k]);
        });
        return parsed;
    }

    let data = loadData();
    let currentSection = 'presupuesto-comun';
    const sections = {};
    const modules = {};

    function saveData() { saveStored('finanzas_data', data); }

    function resetData() {
        data = clone(DEFAULT_DATA);
        saveData();
    }

    function addHistory(action, detail) {
        data.history.unshift({
            timestamp: new Date().toISOString(),
            action, detail
        });
        if (data.history.length > 100) data.history = data.history.slice(0, 100);
        saveData();
    }

    /* =========================================================
       FORMATO
       ========================================================= */
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
        return `${months[parseInt(m) - 1]} ${y}`;
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
    function formatRelativeTime(ts) {
        if (!ts) return '';
        const diff = Math.floor((Date.now() - ts) / 1000);
        if (diff < 5) return 'ahora mismo';
        if (diff < 60) return 'hace ' + diff + 's';
        if (diff < 3600) return 'hace ' + Math.floor(diff / 60) + ' min';
        if (diff < 86400) return 'hace ' + Math.floor(diff / 3600) + ' h';
        return 'hace ' + Math.floor(diff / 86400) + ' d';
    }

    /* =========================================================
       TOAST Y CONFIRMACIÓN
       ========================================================= */
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
        newBtn.addEventListener('click', () => { onConfirm(); close(); });
    }

    /* =========================================================
       NOTIFICACIÓN ENTRE MÓDULOS CON GUARDAS
       ========================================================= */
    const _recentNotifies = new Map();
    let _notifyDepth = 0;

    function notifyModuleChange(source, detail) {
        detail = detail || {};
        const key = source + '|' + (detail.reason || '');
        const now = Date.now();

        const last = _recentNotifies.get(key);
        if (last && now - last < 100) return;

        _recentNotifies.set(key, now);
        setTimeout(() => _recentNotifies.delete(key), 200);

        if (_notifyDepth > 8) {
            console.warn('[App] Bucle detectado en notifyModuleChange:', source, detail.reason);
            return;
        }
        _notifyDepth++;
        try {
            document.dispatchEvent(new CustomEvent('app:module-changed', {
                detail: Object.assign({ source, ts: now }, detail)
            }));
        } finally {
            setTimeout(() => { _notifyDepth = Math.max(0, _notifyDepth - 1); }, 0);
        }
    }

    /* =========================================================
       NAVEGACIÓN
       ========================================================= */
    const SECTION_META = {
        'presupuesto-comun': { title: 'Presupuesto común', subtitle: () => 'Dashboard financiero compartido · pantalla única' },
        'calendario': { title: 'Calendario', subtitle: () => 'Planificación y vencimientos' },
        'mi-dinero': { title: 'Dinero', subtitle: () => 'Tu dinero en una sola pantalla · monederos, deudas, préstamos, objetivos y pagos' },
        'ingresos-personales': { title: 'Ingresos personales', subtitle: () => 'Nóminas, equiparación de pagas, distribución equitativa y simulador de escenarios' },
        'viajes': { title: 'Viajes', subtitle: () => 'Planifica tus escapadas' }
    };
    const SECTION_ALIASES = { 'inicio': 'presupuesto-comun', 'home': 'presupuesto-comun', 'presupuesto': 'presupuesto-comun' };

    function normalizeSectionName(name) { return SECTION_ALIASES[name] || name; }

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

        // Click en el indicador de sincronización → forzar refresh
        const syncBox = document.getElementById('syncStatusBox');
        if (syncBox) {
            syncBox.addEventListener('click', () => {
                if (!window.DataService || typeof DataService.forceRefresh !== 'function') return;
                const s = DataService.getStatus();
                if (s.syncing) return;
                DataService.forceRefresh().catch(() => {});
            });
        }

        navigateTo(normalizeSectionName('presupuesto-comun'));
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
        const mountForSection = () => {
            let el = document.getElementById('sec-' + section);
            if (!el) {
                el = document.createElement('div');
                el.id = 'sec-' + section;
                container.appendChild(el);
            }
            return el;
        };
        Array.from(container.children).forEach(ch => { ch.hidden = ch.id !== 'sec-' + section; });

        if (section === 'viajes') {
            if (typeof window.initTripManager === 'function' && !window.getTripManager()) {
                window.initTripManager();
            }
            const tm = window.getTripManager ? window.getTripManager() : null;
            if (tm && typeof tm.syncVisibility === 'function') tm.syncVisibility();
        } else {
            const secEl = mountForSection();
            if (sections[section].init) sections[section].init(secEl);
            sections[section].render(secEl);
        }
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('overlay').classList.remove('open');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function registerSection(name, module) {
        sections[normalizeSectionName(name)] = module;
    }
    function registerModule(key, api) {
        modules[key] = api;
    }

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

    /* =========================================================
       TEMA / MENÚ MÓVIL / PERFIL
       ========================================================= */
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
        if (avatar) { avatar.textContent = p.initial; avatar.style.background = p.color + '30'; avatar.style.color = p.color; }
        if (name) name.textContent = p.name;
    }

    /* =========================================================
       INIT
       ========================================================= */
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

        navigateTo(normalizeSectionName('presupuesto-comun'));
    }

    /* =========================================================
       BRIDGE COMPLETO (Fase 1 + Fase 2)
       ========================================================= */
    return {
        get data() { return data; },
        reloadData: () => { data = loadData(); },
        saveData, resetData, addHistory,
        navigateTo, goTo, registerSection, registerModule,
        currentSection: () => currentSection,
        formatCurrency, formatDate, formatPeriod, escapeHtml, generateId,
        loadStored, saveStored, injectStylesheet,
        showToast, showConfirm, isDarkMode,
        getActiveProfile, getProfileName,
        notifyModuleChange,
        isModuleReady: (name) => !!modules[name],
        init,

        updateSyncBadge: (status) => {
            const box = document.getElementById('syncStatusBox');
            const label = document.getElementById('syncLabel');
            const detail = document.getElementById('syncDetail');
            if (!box || !label || !detail) return;

            const phase = status.phase || (status.syncing ? 'writing' : (status.connected ? 'connected' : 'disconnected'));
            const pendingCount = (status.pendingModules || []).length;

            let labelText = 'Conectado';
            let detailText = 'Google Sheets';
            let stateClass = 'state-connected';

            switch (phase) {
                case 'connecting':
                    labelText = 'Conectando…';
                    detailText = 'Iniciando conexión';
                    stateClass = 'state-connecting';
                    break;
                case 'reading':
                    labelText = 'Leyendo…';
                    detailText = 'Descargando datos';
                    stateClass = 'state-reading';
                    break;
                case 'writing':
                    labelText = 'Escribiendo…';
                    detailText = 'Guardando cambios';
                    stateClass = 'state-writing';
                    break;
                case 'connected':
                    if (pendingCount > 0) {
                        labelText = 'Sincronizando…';
                        detailText = pendingCount + ' cambio' + (pendingCount === 1 ? '' : 's') + ' pendiente' + (pendingCount === 1 ? '' : 's');
                        stateClass = 'state-writing';
                    } else {
                        labelText = 'Conectado';
                        detailText = status.lastSync ? 'Sincronizado ' + formatRelativeTime(status.lastSync) : 'Google Sheets';
                        stateClass = 'state-connected';
                    }
                    break;
                case 'error':
                    labelText = 'Sesión expirada';
                    detailText = 'Vuelve a iniciar sesión';
                    stateClass = 'state-error';
                    break;
                case 'disconnected':
                default: {
                    labelText = 'Desconectado';
                    const err = status.lastError ? String(status.lastError) : '';
                    if (/internet/i.test(err)) detailText = 'Sin conexión a internet';
                    else if (/sesión|unauthorized/i.test(err)) detailText = 'Vuelve a iniciar sesión';
                    else if (err) detailText = err.substring(0, 40);
                    else detailText = 'Trabajando en local';
                    stateClass = 'state-disconnected';
                }
            }

            box.classList.remove('state-connecting', 'state-reading', 'state-writing',
                                'state-connected', 'state-disconnected', 'state-error');
            box.classList.add(stateClass);
            label.textContent = labelText;
            detail.textContent = detailText;
            box.title = 'Google Sheets · ' + labelText + (detailText ? ' · ' + detailText : '') + ' (clic para reintentar)';
        },

        updateAuthUI: (payload) => {
            const chip = document.getElementById('userChip');
            const avatar = document.getElementById('userAvatar');
            const name = document.getElementById('userName');
            if (!chip) return;
            if (payload && payload.signedIn && payload.user) {
                chip.hidden = false;
                if (avatar && payload.user.picture) {
                    avatar.src = payload.user.picture;
                    avatar.alt = payload.user.name || '';
                }
                if (name) name.textContent = payload.user.name || payload.user.email || '';
            } else {
                chip.hidden = true;
            }
        },

        /* ---------- FASE 1 · Acceso unificado ---------- */
        getAccounts: () => data.accounts || [],

        getLoans: () => {
            const mod = modules['mi-dinero'];
            return (mod && typeof mod.getLoans === 'function') ? mod.getLoans() : [];
        },
        payLoanInstallment: (loanId) => {
            const mod = modules['mi-dinero'];
            if (mod && typeof mod.payLoanInstallment === 'function') {
                mod.payLoanInstallment(loanId);
                notifyModuleChange('mi-dinero', { reason: 'loan-paid', loanId });
                return true;
            }
            return false;
        },
        getTripSavings: () => {
            const mod = modules['mi-dinero'];
            return (mod && typeof mod.getTripSavings === 'function')
                ? mod.getTripSavings()
                : { goalTotal: 0, saved: 0, contributions: [] };
        },
        addTripSavingsContribution: (payload) => {
            const mod = modules['mi-dinero'];
            if (mod && typeof mod.addTripSavingsContribution === 'function') {
                const g = mod.addTripSavingsContribution(payload);
                notifyModuleChange('mi-dinero', { reason: 'trip-savings-contribution' });
                return g;
            }
            return null;
        },

        /* ---------- FASE 2 · Lectura cruzada ---------- */
        getSharedContributionRules: () => {
            const mod = modules['ingresos-personales'];
            return (mod && typeof mod.getSharedContributionRules === 'function')
                ? mod.getSharedContributionRules()
                : null;
        },
        pcSummary: (period) => {
            const mod = modules['presupuesto-comun'];
            if (mod && typeof mod.getPcSummary === 'function') {
                try { return mod.getPcSummary(period); } catch (e) { return null; }
            }
            // Fallback
            try {
                const cats = data.pcCategories || [];
                let fixed = 0, variable = 0;
                const FIXED_IDS = ['pc-rent', 'pc-utilities', 'pc-loans'];
                cats.forEach(c => {
                    if (c.budget === null || c.budget === undefined) return;
                    if (FIXED_IDS.includes(c.id)) fixed += Number(c.budget); else variable += Number(c.budget);
                });
                return { period: null, fixed, variable, total: fixed + variable, planned: 0, budgetTotal: fixed + variable };
            } catch (e) { return null; }
        },
        getSalary: (pid, mk) => {
            const mod = modules['ingresos-personales'];
            return (mod && typeof mod.getSalary === 'function') ? mod.getSalary(pid, mk) : null;
        },
        getIncomeForMonth: (mk) => {
            const mod = modules['ingresos-personales'];
            return (mod && typeof mod.getIncomeForMonth === 'function') ? mod.getIncomeForMonth(mk) : null;
        },
        getIndividualExpenses: (pid) => {
            const mod = modules['ingresos-personales'];
            return (mod && typeof mod.getIndividualExpenses === 'function') ? mod.getIndividualExpenses(pid) : [];
        },
        getDineroData: () => {
            const mod = modules['mi-dinero'];
            if (mod && typeof mod.getState === 'function') {
                try { return mod.getState(); } catch (e) {}
            }
            try { return JSON.parse(localStorage.getItem('finanzas_dinero_v2') || 'null'); }
            catch (e) { return null; }
        },
        getIngresosData: () => {
            const mod = modules['ingresos-personales'];
            if (mod && typeof mod.getState === 'function') {
                try { return mod.getState(); } catch (e) {}
            }
            try { return JSON.parse(localStorage.getItem('finanzas_ingresos_v11') || 'null'); }
            catch (e) { return null; }
        },
        getPresupuestoData: () => {
            const mod = modules['presupuesto-comun'];
            if (mod && typeof mod.getState === 'function') {
                try { return mod.getState(); } catch (e) {}
            }
            return {
                categories: data.pcCategories || [],
                subcategories: data.pcSubcategories || [],
                weeks: data.pcWeeks || [],
                expenses: data.expenses || []
            };
        },
        getTripCommitments: () => {
            const mod = modules['mi-dinero'];
            return (mod && typeof mod.getTripCommitments === 'function') ? mod.getTripCommitments() : [];
        },
        getSavings: () => {
            const mod = modules['mi-dinero'];
            return (mod && typeof mod.getSavings === 'function') ? mod.getSavings() : null;
        },

        /* ---------- FASE 2 · Escritura cruzada ---------- */
        registerIncomeMovement: (payload) => {
            const mod = modules['mi-dinero'];
            if (mod && typeof mod.registerExternalIncome === 'function') {
                const mv = mod.registerExternalIncome(payload);
                notifyModuleChange('mi-dinero', { reason: 'income-registered', movementId: mv && mv.id });
                return mv;
            }
            return null;
        },
        registerExpenseMovement: (payload) => {
            const mod = modules['mi-dinero'];
            if (mod && typeof mod.registerExternalExpense === 'function') {
                const mv = mod.registerExternalExpense(payload);
                notifyModuleChange('mi-dinero', { reason: 'expense-registered', movementId: mv && mv.id });
                return mv;
            }
            return null;
        },
        distributeExtraIncome: (payload) => {
            const mod = modules['mi-dinero'];
            if (mod && typeof mod.distributeExtraIncome === 'function') {
                const res = mod.distributeExtraIncome(payload);
                notifyModuleChange('mi-dinero', { reason: 'extra-distributed' });
                return res;
            }
            console.info('[App] distributeExtraIncome: pendiente de implementar en dinero.js');
            return null;
        },
        syncTripGoal: (payload) => {
            const mod = modules['mi-dinero'];
            if (mod && typeof mod.syncTripGoal === 'function') {
                const g = mod.syncTripGoal(payload);
                notifyModuleChange('mi-dinero', { reason: 'trip-goal-synced', tripId: payload && payload.tripId });
                return g;
            }
            return null;
        },
        syncTripCommitments: (tripId, pendings) => {
            const mod = modules['mi-dinero'];
            if (mod && typeof mod.syncTripCommitments === 'function') {
                mod.syncTripCommitments(tripId, pendings);
                notifyModuleChange('mi-dinero', { reason: 'trip-commitments-synced', tripId });
                return true;
            }
            return false;
        },
        registerTripPayment: (payload) => {
            const pc = modules['presupuesto-comun'];
            if (pc && typeof pc.addMovement === 'function') {
                pc.addMovement('pc-trips', payload.amount, {
                    concept: payload.concept,
                    date: payload.date,
                    status: 'registrado',
                    account: payload.account || 'Trade Republic',
                    link: { kind: 'trip-payment', id: payload.itemId }
                });
                notifyModuleChange('presupuesto-comun', { reason: 'trip-payment' });
                notifyModuleChange('mi-dinero', { reason: 'trip-payment' });
                return true;
            }
            return false;
        },
        refreshModule: (name) => {
            const mod = modules[name];
            if (mod && typeof mod.render === 'function') {
                const el = document.getElementById('sec-' + name);
                if (el && el.isConnected) { try { mod.render(el); } catch (e) {} }
            }
        },
        refreshAll: () => {
            Object.keys(modules).forEach(name => {
                const el = document.getElementById('sec-' + name);
                if (el && el.isConnected && modules[name].render) {
                    try { modules[name].render(el); } catch (e) {}
                }
            });
        },

        confirmIncomeReceipt: (pid, mk, amount) => {
            const mod = modules['ingresos-personales'];
            if (mod && typeof mod.confirmIncomeReceipt === 'function') {
                mod.confirmIncomeReceipt(pid, mk, amount);
                notifyModuleChange('ingresos-personales', { reason: 'income-confirmed', pid, mk });
                return true;
            }
            return false;
        },
        confirmExtraReceipt: (pid, mk, itemId, amount) => {
            const mod = modules['ingresos-personales'];
            if (mod && typeof mod.confirmExtraReceipt === 'function') {
                mod.confirmExtraReceipt(pid, mk, itemId, amount);
                notifyModuleChange('ingresos-personales', { reason: 'extra-confirmed', pid, mk, itemId });
                return true;
            }
            return false;
        },
        getMonthExtras: (pid, mk) => {
            const mod = modules['ingresos-personales'];
            return (mod && typeof mod.getMonthExtras === 'function')
                ? mod.getMonthExtras(pid, mk)
                : [];
        },
    };
})();

window.App = App;

/* =============================================================================
   REGISTRO DE MÓDULOS EN EL PUENTE
   (cada script de módulo se auto-registra también; aquí reforzamos la API)
   ============================================================================= */
App.registerModule('presupuesto-comun', {
    openExpenseModal: (id) => window.BudgetApp && BudgetApp.openExpenseModal(id),
    openCategoryModal: (id) => window.BudgetApp && BudgetApp.openCategoryModal(id),
    openMovementModal: () => window.BudgetApp && BudgetApp.openMovementModal && BudgetApp.openMovementModal(),
    addMovement: (...args) => window.BudgetApp && BudgetApp.addMovement(...args),
    getPcSummary: (period) => window.BudgetApp && BudgetApp.getPcSummary(period),
    getState: () => window.BudgetApp && BudgetApp.getState && BudgetApp.getState()
});

App.registerModule('mi-dinero', {
    getSavings: () => window.DineroApp && DineroApp.getSavings(),
    getLoans: () => window.DineroApp && DineroApp.getLoans(),
    payLoanInstallment: (id) => window.DineroApp && DineroApp.payLoanInstallment(id),
    getTripSavings: () => window.DineroApp && DineroApp.getTripSavings(),
    addTripSavingsContribution: (p) => window.DineroApp && DineroApp.addTripSavingsContribution(p),
    getState: () => window.DineroApp && DineroApp.getState(),
    registerExternalIncome: (p) => window.DineroApp && DineroApp.registerExternalIncome(p),
    registerExternalExpense: (p) => window.DineroApp && DineroApp.registerExternalExpense(p),
    getTripCommitments: () => window.DineroApp && DineroApp.getTripCommitments && DineroApp.getTripCommitments()
});

App.registerModule('ingresos-personales', {
    getState: () => window.IngresosModulo && IngresosModulo.getState(),
    getSharedContributionRules: () => window.IngresosModulo && IngresosModulo.getSharedContributionRules(),
    getSalary: (pid, mk) => window.IngresosModulo && IngresosModulo.getSalary && IngresosModulo.getSalary(pid, mk),
    getIncomeForMonth: (mk) => window.IngresosModulo && IngresosModulo.getIncomeForMonth && IngresosModulo.getIncomeForMonth(mk),
    getIndividualExpenses: (pid) => window.IngresosModulo && IngresosModulo.getIndividualExpenses && IngresosModulo.getIndividualExpenses(pid)
});

App.registerModule('calendario', {
    getState: () => window.CalendarApp && CalendarApp.getState && CalendarApp.getState()
});

/* =============================================================================
   TRIPMANAGER ↔ DOM PRINCIPAL
   ============================================================================= */
(function () {
    'use strict';
    const CONTAINER_SELECTOR = '#trip-manager-app';
    let tripManagerInstance = null;

    function initTripManager(containerSelector = CONTAINER_SELECTOR) {
        if (tripManagerInstance && tripManagerInstance.mounted) return tripManagerInstance;
        const mount = document.querySelector(containerSelector);
        if (!mount) { console.warn('[app.js] No se encontró el contenedor', containerSelector); return null; }
        if (typeof window.TripManager !== 'function') {
            console.error('[app.js] window.TripManager no está disponible.');
            return null;
        }
        tripManagerInstance = new window.TripManager(mount, {
            onChange: (trip) => syncTripIntoGlobalState(trip)
        });
        tripManagerInstance.mountApp();
        tripManagerInstance.syncVisibility = syncVisibility;
        registerWithShell(tripManagerInstance);
        syncVisibility();
        console.info('[app.js] TripManager montado correctamente.');
        return tripManagerInstance;
    }

    function getTripManager() { return tripManagerInstance; }

    function syncVisibility() {
        const mount = document.querySelector(CONTAINER_SELECTOR);
        if (!mount) return;
        const isTripsSection = window.App && window.App.currentSection() === 'viajes';
        mount.hidden = !isTripsSection;
    }

    function registerWithShell(tm) {
        if (!window.App) return;
        if (typeof window.App.registerModule === 'function') {
            window.App.registerModule('viajes', {
                openTripDetail: (tripId, tab = 'resumen') => {
                    tm.selectTrip(tripId || null);
                    tm.switchTab(tab);
                },
                openTripModal: (tripId) => {
                    if (tripId) tm.selectTrip(tripId);
                    tm.openEditTripModal();
                },
                openPaymentsModal: (tripId, itemId) => tm.openPaymentsModal(tripId, itemId),
                backToList: () => { tm.selectTrip(null); tm.switchTab('resumen'); },
                getState: () => tm.getState && tm.getState()
            });
        }
        if (typeof window.App.registerSection === 'function') {
            window.App.registerSection('viajes', {
                init: () => {},
                render: () => { syncVisibility(); },
                onThemeChange: () => { if (tm.mounted) tm.render(); }
            });
        }
    }

    function syncTripIntoGlobalState(trip) {
        if (!window.App || !window.App.data || !Array.isArray(window.App.data.trips)) return;
        const record = {
            id: trip.id,
            name: trip.name,
            destination: trip.destination,
            startDate: trip.startDate,
            endDate: trip.endDate,
            budget: trip.budgetLimit,
            spent: trip.categories.reduce((s, c) =>
                s + c.items.reduce((x, i) => x + i.payments.reduce((p, q) => p + q.amount, 0), 0), 0),
            status: computeLegacyStatus(trip)
        };
        const trips = window.App.data.trips;
        const idx = trips.findIndex(t => t.id === trip.id);
        if (idx >= 0) trips[idx] = Object.assign({}, trips[idx], record);
        else trips.push(record);
        if (typeof window.App.saveData === 'function') window.App.saveData();
        if (typeof window.App.notifyModuleChange === 'function') {
            window.App.notifyModuleChange('viajes', { reason: 'trip-updated', tripId: trip.id });
        }
    }

    function computeLegacyStatus(trip) {
        const today = new Date().toISOString().slice(0, 10);
        if (today > trip.endDate) return 'realizado';
        if (today >= trip.startDate) return 'en-curso';
        return 'planificado';
    }

    window.initTripManager = initTripManager;
    window.getTripManager = getTripManager;
})();

/* =============================================================================
   ARRANQUE CON AUTENTICACIÓN Y CARGA INSTANTÁNEA
   ============================================================================= */
let appStarted = false;

async function bootstrapApp() {
    if (appStarted) return;
    appStarted = true;

    if (window.AuthService) AuthService.hideLogin();

    if (!App.data.profiles || App.data.profiles.length === 0) {
        App.data.profiles = [
            { id: 'ana', name: 'Nena', initial: 'N', color: '#ec4899' },
            { id: 'carlos', name: 'Bombón', initial: 'B', color: '#2563eb' }
        ];
    }

    if (window.AuthService) {
        const user = AuthService.getUser();
        if (user && user.email) {
            const emailNena = 'amcarranza216@gmail.com';
            const emailBombon = 'juanmi.sexto.a@gmail.com';
            if (user.email.toLowerCase() === emailBombon) App.data.activeProfile = 'carlos';
            else if (user.email.toLowerCase() === emailNena) App.data.activeProfile = 'ana';
        }
    }

    // 🔒 1. LEER EL SHEET Y ESPERAR
    if (window.DataService) {
        const success = await DataService.init();
        
        if (!success) {
            App.showToast('⚠️ No se pudo leer Google Sheets. Modo solo lectura.', 'error');
        } else {
            App.reloadData(); 
            console.log('[app.js] Datos recargados desde el Sheet:', App.data.accounts, App.data.pcCategories);
        }
    }

    // 2. Montar la app CON los datos ya cargados
    initTripManager();
    App.init();

    document.addEventListener('app:data-refreshed', () => {
        // Volvemos a recargar si hay cambios en segundo plano
        data = loadData();
        
        const tm = window.getTripManager && window.getTripManager();
        if (tm && tm.mounted) {
            const p = localStorage.getItem('finanzas_viajes_v2');
            if (p) { try { tm.data = JSON.parse(p); tm.render(); } catch (e) {} }
        }
        if (typeof App.refreshAll === 'function') App.refreshAll();
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // Si no hay servicio de auth (por si acaso), arrancamos normal
    if (!window.AuthService) {
        console.warn('[App] AuthService no cargado. Arrancando sin login.');
        bootstrapApp();
        return;
    }

    try {
        // 1. Cargar el SDK de Google
        await AuthService.init();
    } catch (e) {
        console.error('[App] Error al cargar Google Sign-In:', e);
        AuthService.showError('No se pudo cargar Google Sign-In. Comprueba tu conexión.');
        return;
    }

    // 2. Configurar el botón de cerrar sesión
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.onclick = () => {
            AuthService.signOut();
            appStarted = false; 
        };
    }

    // 3. Comprobar si ya hay sesión
    if (!AuthService.isSignedIn()) {
        AuthService.showLogin();
        AuthService.onChange(({ signedIn }) => {
            if (signedIn) bootstrapApp();
        });
        return;
    }

    // 4. Si ya está logueado, arrancar
    bootstrapApp();
});
