/* =============================================================================
   APP.JS  ·  Inicialización y conexión TripManager ↔ DOM principal
   -----------------------------------------------------------------------------
   · Crea la instancia de window.TripManager sobre el contenedor #trip-manager-app.
   · Registra el módulo en el puente global App (si la shell existe) para que
     otras secciones (Calendario, Presupuesto…) puedan navegar hasta un viaje.
   · Expone helpers globales: initTripManager() / getTripManager().
   ============================================================================= */
(function () {
    'use strict';

    const CONTAINER_SELECTOR = '#trip-manager-app';
    let tripManagerInstance = null;

    /**
     * Monta el módulo de viajes en el DOM principal.
     * Es idempotente: si ya está montado, devuelve la instancia existente.
     */
    function initTripManager(containerSelector = CONTAINER_SELECTOR) {
        if (tripManagerInstance && tripManagerInstance.mounted) return tripManagerInstance;

        const mount = document.querySelector(containerSelector);
        if (!mount) {
            console.warn('[app.js] No se encontró el contenedor', containerSelector, '— el módulo de viajes no se inicializó.');
            return null;
        }
        if (typeof window.TripManager !== 'function') {
            console.error('[app.js] window.TripManager no está disponible. Revisa que trip-manager.js se cargue ANTES que app.js.');
            return null;
        }

        tripManagerInstance = new window.TripManager(mount, {
            // Sincroniza los viajes con el estado global de la shell (App.data.trips)
            // para que el Calendario siga viendo salidas, regresos y vencimientos.
            onChange: (trip) => syncTripIntoGlobalState(trip)
        });
        tripManagerInstance.mountApp();

        // Registro en el puente de módulos de la aplicación (si la shell App existe)
        registerWithShell(tripManagerInstance);
        syncVisibility();   // deja #trip-manager-app oculto hasta navegar a 'viajes'

        console.info('[app.js] TripManager montado correctamente en', containerSelector);
        return tripManagerInstance;
    }

    /** Devuelve la instancia activa del gestor de viajes (o null). */
    function getTripManager() {
        return tripManagerInstance;
    }

    /** Muestra u oculta el contenedor #trip-manager-app según la sección activa. */
    function syncVisibility() {
        const mount = document.querySelector(CONTAINER_SELECTOR);
        if (!mount) return;
        const isTripsSection = window.App && window.App.currentSection === 'viajes';
        mount.hidden = !isTripsSection;
    }

    /**
     * Enchufa TripManager con la shell App:
     *  · Registra la API del módulo 'viajes' en el puente de módulos.
     *  · Registra una sección propia que muestra el contenedor del gestor.
     */
    function registerWithShell(tm) {
        if (!window.App) return;

        // API pública del módulo (la invoca p.ej. el Calendario vía App.goTo)
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
                backToList: () => { tm.selectTrip(null); tm.switchTab('resumen'); }
            });
        }

        // Sección gestionada por el nuevo TripManager (sustituye al módulo antiguo)
        if (typeof window.App.registerSection === 'function') {
            window.App.registerSection('viajes', {
                init: () => {},                       // el gestor ya está montado en #trip-manager-app
                render: () => { syncVisibility(); },  // muestra el contenedor del módulo
                onThemeChange: () => { if (tm.mounted) tm.render(); }
            });
        }
    }

    /**
     * Copia la cabecera del viaje editado hacia App.data.trips (estructura que
     * consume el Calendario). Si el viaje no existía, se añade.
     * Nota: se usa siempre la fuente de verdad fresca (window.App.data) porque
     * el getter `data` de la shell devuelve una copia superficial en cada acceso.
     */
    function syncTripIntoGlobalState(trip) {
        if (!window.App || !window.App.data || !Array.isArray(window.App.data.trips)) return;
        const record = {
            id: trip.id,
            name: trip.name,
            destination: trip.destination,
            startDate: trip.startDate,
            endDate: trip.endDate,
            budget: trip.budgetLimit,
            spent: trip.categories.reduce(
                (s, c) => s + c.items.reduce((x, i) => x + i.payments.reduce((p, q) => p + q.amount, 0), 0), 0),
            status: computeLegacyStatus(trip)
        };
        const trips = window.App.data.trips;
        const idx = trips.findIndex(t => t.id === trip.id);
        if (idx >= 0) trips[idx] = Object.assign({}, trips[idx], record);
        else trips.push(record);

        if (typeof window.App.saveData === 'function') window.App.saveData();
    }

    function computeLegacyStatus(trip) {
        const today = new Date().toISOString().slice(0, 10);
        if (today > trip.endDate) return 'realizado';
        if (today >= trip.startDate) return 'en-curso';
        return 'planificado';
    }

    /* ------------------------- Arranque ------------------------- */
    function boot() {
        initTripManager();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    /* ------------------------- Exportación ------------------------- */
    window.initTripManager = initTripManager;
    window.getTripManager = getTripManager;
})();
