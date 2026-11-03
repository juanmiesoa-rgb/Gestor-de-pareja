/* =============================================================================
   VIAJES.JS  ·  Módulo de Planificación de Viajes (reescrito desde cero)
   -----------------------------------------------------------------------------
   · Vanilla JS (ES6+) — sin librerías externas.
   · Gráficas nativas con Canvas HTML5.
   · Estilos CSS inyectados dinámicamente en el <head>.
   · Se exporta como window.TripManager y se conecta al DOM a través de app.js.
   · Contenedor principal: #trip-manager-app
   ============================================================================= */
(function () {
    'use strict';

    /* =========================================================================
       1. DATOS FICTICIOS (mockData)
       ========================================================================= */
    const mockData = {
        savings: {
            goalTotal: 7200,          // Objetivo de ahorro conjunto de todos los viajes
            contributions: [
                { id: 'sc-1', date: '2026-06-05', amount: 400, payer: 'Ana',   note: 'Apertura del fondo' },
                { id: 'sc-2', date: '2026-07-03', amount: 300, payer: 'Luis',  note: 'Aportación mensual' },
                { id: 'sc-3', date: '2026-08-04', amount: 300, payer: 'Ana',   note: 'Aportación mensual' },
                { id: 'sc-4', date: '2026-09-02', amount: 350, payer: 'Luis',  note: 'Aportación mensual' },
                { id: 'sc-5', date: '2026-09-20', amount: 500, payer: 'Ana',   note: 'Extra: nómina de septiembre' },
                { id: 'sc-6', date: '2026-10-05', amount: 350, payer: 'Luis',  note: 'Aportación mensual' },
                { id: 'sc-7', date: '2026-10-15', amount: 200, payer: 'Ana',   note: 'Venta de bicicleta antigua' },
                { id: 'sc-8', date: '2026-11-02', amount: 400, payer: 'Luis',  note: 'Aportación mensual' }
            ]
        },
        trips: [
            /* -----------------------------------------------------------------
               VIAJE 1 · Japón — Próximo (dentro de ~130 días)
               ----------------------------------------------------------------- */
            {
                id: 'jp-2026',
                name: 'Japón Inolvidable',
                destination: 'Tokio · Kioto · Osaka, Japón',
                image: 'https://images.unsplash.com/photo-1493976045277-9855ac817ce3?auto=format&fit=crop&w=1200&q=80',
                startDate: '2027-03-15',
                endDate: '2027-03-28',
                travelers: ['Ana', 'Luis'],
                budgetLimit: 6800,
                notes: 'Viaje de 14 días. Vuelos comprados en promoción; JR Pass pendiente de compra definitiva.',
                categories: [
                    {
                        id: 'jp-transporte', name: 'Transporte', icon: '✈️',
                        items: [
                            {
                                id: 'jp-vuelos', subcategory: 'Vuelos Madrid–Tokio (ida y vuelta)',
                                provider: 'Iberia', city: 'Madrid / Tokio', total: 2140, dueDate: '2026-12-01',
                                payments: [
                                    { id: 'jp-v-p1', amount: 1070, date: '2026-08-12', payer: 'Ana',  method: 'Tarjeta de crédito' },
                                    { id: 'jp-v-p2', amount: 540,  date: '2026-10-03', payer: 'Luis', method: 'Bizum' }
                                ]
                            },
                            {
                                id: 'jp-jrpass', subcategory: 'JR Pass 14 días (trenes bala)',
                                provider: 'Japan Rail', city: 'Tokio', total: 660, dueDate: '2027-01-15',
                                payments: []
                            },
                            {
                                id: 'jp-metro', subcategory: 'Abonos de metro y transfers locales',
                                provider: 'Varios (Suica / ICOCA)', city: 'Kioto / Osaka', total: 120, dueDate: null,
                                payments: []
                            }
                        ]
                    },
                    {
                        id: 'jp-hospedaje', name: 'Hospedaje', icon: '🏨',
                        items: [
                            {
                                id: 'jp-hotel-tokio', subcategory: 'Hotel Shinjuku 5 noches',
                                provider: 'Hotel Gracery', city: 'Tokio', total: 890, dueDate: '2027-02-20',
                                payments: [
                                    { id: 'jp-h-p1', amount: 445, date: '2026-09-28', payer: 'Luis', method: 'Transferencia' }
                                ]
                            },
                            {
                                id: 'jp-ryokan', subcategory: 'Ryokan tradicional 3 noches',
                                provider: 'Yuzuya Ryokan', city: 'Kioto', total: 780, dueDate: '2027-01-30',
                                payments: []
                            },
                            {
                                id: 'jp-osaka', subcategory: 'Apartamento Namba 3 noches',
                                provider: 'Airbnb', city: 'Osaka', total: 420, dueDate: '2027-02-01',
                                payments: [
                                    { id: 'jp-o-p1', amount: 150, date: '2026-10-20', payer: 'Ana', method: 'Tarjeta de débito' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'jp-comida', name: 'Comida', icon: '🍜',
                        items: [
                            {
                                id: 'jp-reservas-gastro', subcategory: 'Reservas gastronómicas (omakase + kaiseki)',
                                provider: 'Sushi Saito / Kikunoi', city: 'Tokio / Kioto', total: 480, dueDate: '2027-02-10',
                                payments: []
                            },
                            {
                                id: 'jp-comida-diaria', subcategory: 'Presupuesto de comidas diarias',
                                provider: 'Efectivo / IC cards', city: 'General', total: 700, dueDate: null,
                                payments: []
                            }
                        ]
                    },
                    {
                        id: 'jp-actividades-cat', name: 'Actividades', icon: '🎟️',
                        items: [
                            {
                                id: 'jp-disney', subcategory: 'Entradas Tokyo DisneySea (2 pax)',
                                provider: 'Disney', city: 'Tokio', total: 160, dueDate: '2027-01-10',
                                payments: [
                                    { id: 'jp-d-p1', amount: 160, date: '2026-10-28', payer: 'Ana', method: 'Tarjeta de crédito' }
                                ]
                            },
                            {
                                id: 'jp-teamlab', subcategory: 'teamLab Planets + Ghibli Museum',
                                provider: 'Varios', city: 'Tokio', total: 95, dueDate: '2027-01-10',
                                payments: []
                            },
                            {
                                id: 'jp-tours', subcategory: 'Tour de templos y experiencia té',
                                provider: 'Magical Trip', city: 'Kioto', total: 140, dueDate: null,
                                payments: []
                            }
                        ]
                    },
                    {
                        id: 'jp-otros', name: 'Otros', icon: '🧳',
                        items: [
                            {
                                id: 'jp-seguro', subcategory: 'Seguro de viaje 15 días',
                                provider: 'InterMundial', city: '—', total: 85, dueDate: '2027-02-28',
                                payments: []
                            },
                            {
                                id: 'jp-esim', subcategory: 'eSIM datos + propinas varios',
                                provider: 'Airalo', city: '—', total: 60, dueDate: null,
                                payments: [
                                    { id: 'jp-e-p1', amount: 30, date: '2026-11-01', payer: 'Luis', method: 'Bizum' }
                                ]
                            }
                        ]
                    }
                ],
                days: [
                    { date: '2027-03-15', items: [
                        { concept: 'Taxi aeropuerto Barajas', budgeted: 35, real: 38 },
                        { concept: 'Snack y café en el vuelo', budgeted: 20, real: 18 }
                    ]},
                    { date: '2027-03-16', items: [
                        { concept: 'Narita Express a Tokio', budgeted: 60, real: 0 },
                        { concept: 'Cena ramen en Shinjuku', budgeted: 30, real: 0 }
                    ]},
                    { date: '2027-03-17', items: [
                        { concept: 'Entrada teamLab Planets', budgeted: 48, real: 0 },
                        { concept: 'Comida callejera Harajuku', budgeted: 25, real: 0 }
                    ]},
                    { date: '2027-03-18', items: [
                        { concept: 'Templo Senso-ji + souvenirs', budgeted: 40, real: 0 },
                        { concept: 'Crucero por la bahía de Tokio', budgeted: 35, real: 0 }
                    ]},
                    { date: '2027-03-19', items: [
                        { concept: 'Palacio Imperial y jardines', budgeted: 20, real: 0 },
                        { concept: 'Almuerzo mercado Tsukiji', budgeted: 45, real: 0 }
                    ]},
                    { date: '2027-03-20', items: [
                        { concept: 'Tren bala a Kioto', budgeted: 110, real: 0 },
                        { concept: 'Fushimi Inari al atardecer', budgeted: 15, real: 0 }
                    ]},
                    { date: '2027-03-21', items: [
                        { concept: 'Tour de templos guiado', budgeted: 70, real: 0 },
                        { concept: 'Experiencia de té matcha', budgeted: 35, real: 0 }
                    ]},
                    { date: '2027-03-22', items: [
                        { concept: 'Excursión a Nara', budgeted: 55, real: 0 },
                        { concept: 'Cena kaiseki (complemento)', budgeted: 90, real: 0 }
                    ]},
                    { date: '2027-03-23', items: [
                        { concept: 'Barco a Osaka + metro', budgeted: 45, real: 0 },
                        { concept: 'Street food Dotonbori', budgeted: 30, real: 0 }
                    ]},
                    { date: '2027-03-24', items: [
                        { concept: 'Castillo de Osaka', budgeted: 25, real: 0 },
                        { concept: 'Mirador Umeda Sky', budgeted: 30, real: 0 }
                    ]},
                    { date: '2027-03-25', items: [
                        { concept: 'Museo Ghibli (traslado incluido)', budgeted: 50, real: 0 },
                        { concept: 'Comida en Kichijoji', budgeted: 25, real: 0 }
                    ]},
                    { date: '2027-03-26', items: [
                        { concept: 'Día libre DisneySea (extras)', budgeted: 80, real: 0 },
                        { concept: 'Cena despedida izakaya', budgeted: 60, real: 0 }
                    ]},
                    { date: '2027-03-27', items: [
                        { concept: 'Compras de último momento', budgeted: 70, real: 0 },
                        { concept: 'Lavandería hotel', budgeted: 15, real: 0 }
                    ]},
                    { date: '2027-03-28', items: [
                        { concept: 'Airport transfer Haneda', budgeted: 40, real: 0 },
                        { concept: 'Comida en aeropuerto', budgeted: 25, real: 0 }
                    ]}
                ],
                activities: [
                    { id: 'jp-a1', title: 'teamLab Planets', day: '2027-03-17', time: '14:00 – 16:30', location: 'Toyosu, Tokio', cost: 96, paid: true,  payer: 'Ana',  notes: 'Entradas ya confirmadas por e-mail. Llegar 15 min antes.' },
                    { id: 'jp-a2', title: 'Tour de templos y ceremonia del té', day: '2027-03-21', time: '09:30 – 14:00', location: 'Kioto', cost: 140, paid: false, payer: 'Luis', notes: 'Punto de encuentro: estación de Kioto, salida oeste.' },
                    { id: 'jp-a3', title: 'Excursión a Nara', day: '2027-03-22', time: '08:45 – 18:00', location: 'Nara', cost: 55, paid: false, payer: 'Ambos', notes: 'Kinkaku-ji no entra en esta ruta; queda para el día libre.' },
                    { id: 'jp-a4', title: 'Tokyo DisneySea', day: '2027-03-26', time: '09:00 – 21:00', location: 'Urayasu, Chiba', cost: 160, paid: true,  payer: 'Ana',  notes: 'Tickets de 1 día comprados con descuento anticipado.' },
                    { id: 'jp-a5', title: 'Crucero nocturno por la bahía', day: '2027-03-18', time: '19:30 – 21:00', location: 'Odaiba, Tokio', cost: 70, paid: false, payer: 'Luis', notes: 'Reserva hecha, pago a la llegada al muelle.' },
                    { id: 'jp-a6', title: 'Desayuno tsukiji + mercado exterior', day: '2027-03-19', time: '08:00 – 11:00', location: 'Tsukiji, Tokio', cost: 45, paid: false, payer: 'Ambos', notes: 'Llevamos efectivo: algunos puestos no aceptan tarjeta.' }
                ]
            },

            /* -----------------------------------------------------------------
               VIAJE 2 · Italia — Realizado (finalizado en junio 2026)
               ----------------------------------------------------------------- */
            {
                id: 'it-2026',
                name: 'Roma & Florencia Clásica',
                destination: 'Roma · Florencia, Italia',
                image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b0?auto=format&fit=crop&w=1200&q=80',
                startDate: '2026-06-05',
                endDate: '2026-06-12',
                travelers: ['Ana', 'Luis'],
                budgetLimit: 2600,
                notes: 'Escapada de 8 días. Viaje terminado: gastos reales cerrados.',
                categories: [
                    {
                        id: 'it-transporte', name: 'Transporte', icon: '✈️',
                        items: [
                            {
                                id: 'it-vuelos', subcategory: 'Vuelos Madrid–Roma / Florencia–Madrid',
                                provider: 'ITA Airways', city: 'Madrid / Roma', total: 420, dueDate: '2026-03-01',
                                payments: [
                                    { id: 'it-v-p1', amount: 420, date: '2026-03-02', payer: 'Ana', method: 'Tarjeta de crédito' }
                                ]
                            },
                            {
                                id: 'it-trenitalia', subcategory: 'Treno alta velocidad Roma–Florencia',
                                provider: 'Trenitalia', city: 'Roma / Florencia', total: 90, dueDate: '2026-05-15',
                                payments: [
                                    { id: 'it-t-p1', amount: 90, date: '2026-05-10', payer: 'Luis', method: 'Tarjeta de débito' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'it-hospedaje', name: 'Hospedaje', icon: '🏨',
                        items: [
                            {
                                id: 'it-hotel-roma', subcategory: 'Hotel Cavour 4 noches',
                                provider: 'Hotel Cavour', city: 'Roma', total: 640, dueDate: '2026-05-20',
                                payments: [
                                    { id: 'it-h-p1', amount: 200, date: '2026-04-18', payer: 'Ana', method: 'Tarjeta de crédito' },
                                    { id: 'it-h-p2', amount: 440, date: '2026-06-05', payer: 'Luis', method: 'Tarjeta de débito' }
                                ]
                            },
                            {
                                id: 'it-agriturismo', subcategory: 'Agriturismo toscano 3 noches',
                                provider: 'La Torricina', city: 'Florencia', total: 450, dueDate: '2026-05-25',
                                payments: [
                                    { id: 'it-a-p1', amount: 450, date: '2026-05-22', payer: 'Ana', method: 'Transferencia' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'it-comida', name: 'Comida', icon: '🍝',
                        items: [
                            {
                                id: 'it-ristorantes', subcategory: 'Comidas y cenas (trattorias)',
                                provider: 'Varios', city: 'Roma / Florencia', total: 480, dueDate: null,
                                payments: [
                                    { id: 'it-r-p1', amount: 480, date: '2026-06-12', payer: 'Ambos', method: 'Efectivo' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'it-actividades-cat', name: 'Actividades', icon: '🎟️',
                        items: [
                            {
                                id: 'it-coliseo', subcategory: 'Coliseo + Foro Romano (tour guiado)',
                                provider: 'Walks of Italy', city: 'Roma', total: 130, dueDate: '2026-05-01',
                                payments: [
                                    { id: 'it-c-p1', amount: 130, date: '2026-04-28', payer: 'Luis', method: 'Tarjeta de crédito' }
                                ]
                            },
                            {
                                id: 'it-uffizi', subcategory: 'Galería Uffizi + Palazzo Pitti',
                                provider: 'B-ticket', city: 'Florencia', total: 76, dueDate: '2026-05-28',
                                payments: [
                                    { id: 'it-u-p1', amount: 76, date: '2026-05-26', payer: 'Ana', method: 'Bizum' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'it-otros', name: 'Otros', icon: '🧳',
                        items: [
                            {
                                id: 'it-souvenirs', subcategory: 'Souvenirs y extras',
                                provider: 'Varios', city: 'General', total: 120, dueDate: null,
                                payments: [
                                    { id: 'it-s-p1', amount: 120, date: '2026-06-12', payer: 'Ambos', method: 'Efectivo' }
                                ]
                            }
                        ]
                    }
                ],
                days: [
                    { date: '2026-06-05', items: [
                        { concept: 'Metro + taxi al hotel', budgeted: 25, real: 28 },
                        { concept: 'Cena trattoria Trastevere', budgeted: 55, real: 62 }
                    ]},
                    { date: '2026-06-06', items: [
                        { concept: 'Tour Coliseo y Foro', budgeted: 65, real: 65 },
                        { concept: 'Gelatos y aperitivo', budgeted: 20, real: 24 }
                    ]},
                    { date: '2026-06-07', items: [
                        { concept: 'Vaticano (entradas fuera del día)', budgeted: 0, real: 0 },
                        { concept: 'Comida en Prati', budgeted: 50, real: 47 }
                    ]},
                    { date: '2026-06-08', items: [
                        { concept: 'Treno a Florencia', budgeted: 45, real: 45 },
                        { concept: 'Pícnic río Arno', budgeted: 25, real: 22 }
                    ]},
                    { date: '2026-06-09', items: [
                        { concept: 'Uffizi y Duomo', budgeted: 38, real: 38 },
                        { concept: 'Cena bistecca fiorentina', budgeted: 80, real: 92 }
                    ]},
                    { date: '2026-06-10', items: [
                        { concept: 'Excursión Siena (bus)', budgeted: 40, real: 40 },
                        { concept: 'Comidas excursión', budgeted: 35, real: 33 }
                    ]},
                    { date: '2026-06-11', items: [
                        { concept: 'Mercado Central y souvenirs', budgeted: 60, real: 71 },
                        { concept: 'Cena despedida', budgeted: 70, real: 68 }
                    ]},
                    { date: '2026-06-12', items: [
                        { concept: 'Traslado aeropuerto FLR', budgeted: 30, real: 30 },
                        { concept: 'Comida en aeropuerto', budgeted: 25, real: 20 }
                    ]}
                ],
                activities: [
                    { id: 'it-a1', title: 'Tour guiado Coliseo + Foro', day: '2026-06-06', time: '09:30 – 13:30', location: 'Piazza del Colosseo, Roma', cost: 130, paid: true, payer: 'Luis', notes: 'Incluye acceso prioritario y guía en español.' },
                    { id: 'it-a2', title: 'Galería Uffizi', day: '2026-06-09', time: '10:00 – 13:00', location: 'Piazzale degli Uffizi, Florencia', cost: 76, paid: true, payer: 'Ana', notes: 'Reserva online con hora fijada.' },
                    { id: 'it-a3', title: 'Excursión a Siena', day: '2026-06-10', time: '08:30 – 18:00', location: 'Salida: SITA Bus, Florencia', cost: 40, paid: true, payer: 'Ambos', notes: 'Billetes de ida y vuelta comprados en la estación de Santa Maria Novella.' },
                    { id: 'it-a4', title: 'Cena típica Trattoria da Benito', day: '2026-06-05', time: '20:30 – 22:30', location: 'Trastevere, Roma', cost: 62, paid: true, payer: 'Ana', notes: 'Mesa reservada a nombre de Ana.' }
                ]
            }
        ]
    };

    /* =========================================================================
       2. INYECCIÓN DINÁMICA DE ESTILOS CSS EN EL <head>
       ========================================================================= */
    const CSS_ID = 'trip-manager-styles';

    // CSS del módulo → inyección estandarizada (App.injectStylesheet)
    function moduleCSS() { return `
        /* ===== Variables propias del módulo (con fallback al tema global) ===== */
        .tm-root {
            --tm-primary: var(--primary, #2563eb);
            --tm-bg-card: var(--bg-card, #ffffff);
            --tm-text: var(--text, #0f172a);
            --tm-text-secondary: var(--text-secondary, #64748b);
            --tm-text-muted: var(--text-muted, #94a3b8);
            --tm-border: var(--border, #e2e8f0);
            --tm-radius: var(--radius, 10px);
            --tm-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0,0,0,.08));
            --tm-success: var(--success, #10b981);
            --tm-warning: var(--warning, #f59e0b);
            --tm-danger: var(--danger, #ef4444);
            --tm-info: var(--info, #06b6d4);
            font-family: inherit;
            color: var(--tm-text);
        }
        [data-theme="dark"] .tm-root { filter: none; }

        /* ===== Cabecera ===== */
        .tm-header {
            display: flex; flex-wrap: wrap; gap: 14px; align-items: center;
            justify-content: space-between; margin-bottom: 18px;
        }
        .tm-title-group h2 { font-size: 20px; margin: 0 0 2px; }
        .tm-title-group p { margin: 0; font-size: 13px; color: var(--tm-text-secondary); }
        .tm-controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .tm-select {
            padding: 9px 12px; border-radius: var(--tm-radius); border: 1px solid var(--tm-border);
            background: var(--tm-bg-card); color: var(--tm-text); font-size: 13px; cursor: pointer;
            min-width: 220px; font-family: inherit;
        }
        .tm-btn {
            padding: 9px 14px; border-radius: var(--tm-radius); border: 1px solid transparent;
            font-size: 13px; font-weight: 600; cursor: pointer; transition: all .15s ease;
            font-family: inherit; display: inline-flex; align-items: center; gap: 6px;
        }
        .tm-btn-primary { background: var(--tm-primary); color: #fff; }
        .tm-btn-primary:hover { opacity: .9; transform: translateY(-1px); }
        .tm-btn-ghost { background: transparent; color: var(--tm-text-secondary); border-color: var(--tm-border); }
        .tm-btn-ghost:hover { color: var(--tm-text); border-color: var(--tm-text-muted); }
        .tm-btn-danger { background: var(--tm-danger); color: #fff; }
        .tm-btn-sm { padding: 6px 10px; font-size: 12px; }

        /* ===== Tabs internas ===== */
        .tm-tabs {
            display: flex; gap: 4px; border-bottom: 1px solid var(--tm-border);
            margin-bottom: 22px; overflow-x: auto; scrollbar-width: thin;
        }
        .tm-tab {
            padding: 11px 16px; background: none; border: none; color: var(--tm-text-secondary);
            font-size: 13.5px; font-weight: 500; cursor: pointer; white-space: nowrap;
            border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all .15s;
            font-family: inherit; display: inline-flex; align-items: center; gap: 7px;
        }
        .tm-tab:hover { color: var(--tm-text); }
        .tm-tab.active { color: var(--tm-primary); border-bottom-color: var(--tm-primary); font-weight: 600; }
        .tm-view { display: none; animation: tmFade .25s ease; }
        .tm-view.active { display: block; }
        @keyframes tmFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

        /* ===== Badges ===== */
        .tm-badge {
            display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px;
            border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: .3px;
            text-transform: uppercase;
        }
        .tm-badge-proximo   { background: rgba(245,158,11,.15); color: #b45309; }
        .tm-badge-en-curso  { background: rgba(16,185,129,.15); color: #047857; }
        .tm-badge-realizado { background: rgba(100,116,139,.15); color: #64748b; }
        .tm-badge-pagado    { background: rgba(16,185,129,.15); color: #047857; }
        .tm-badge-pendiente { background: rgba(239,68,68,.14);  color: #b91c1c; }
        [data-theme="dark"] .tm-badge-proximo   { color: #fcd34d; }
        [data-theme="dark"] .tm-badge-en-curso,
        [data-theme="dark"] .tm-badge-pagado    { color: #6ee7b7; }
        [data-theme="dark"] .tm-badge-realizado { color: #cbd5e1; }
        [data-theme="dark"] .tm-badge-pendiente { color: #fca5a5; }

        /* ===== Grid de tarjetas de viaje ===== */
        .tm-trips-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 18px; }
        .tm-trip-card {
            background: var(--tm-bg-card); border: 1px solid var(--tm-border); border-radius: var(--tm-radius);
            overflow: hidden; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease;
            display: flex; flex-direction: column;
        }
        .tm-trip-card:hover { transform: translateY(-4px); box-shadow: var(--tm-shadow); }
        .tm-trip-img { position: relative; height: 150px; background: linear-gradient(135deg,#1e3a8a,#7c3aed); }
        .tm-trip-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .tm-trip-img .tm-badge { position: absolute; top: 10px; right: 10px; box-shadow: 0 2px 6px rgba(0,0,0,.25); }
        .tm-trip-countdown {
            position: absolute; left: 10px; bottom: 10px; background: rgba(15,23,42,.72); color: #fff;
            padding: 4px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 600; backdrop-filter: blur(4px);
        }
        .tm-trip-body { padding: 14px 16px 16px; flex: 1; display: flex; flex-direction: column; gap: 10px; }
        .tm-trip-name { font-size: 16px; font-weight: 700; margin: 0; }
        .tm-trip-meta { font-size: 12.5px; color: var(--tm-text-secondary); display: flex; gap: 12px; flex-wrap: wrap; }
        .tm-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .tm-metric { background: rgba(148,163,184,.08); border: 1px solid var(--tm-border); border-radius: 8px; padding: 8px; }
        .tm-metric small { display: block; font-size: 10px; color: var(--tm-text-muted); text-transform: uppercase; letter-spacing: .4px; }
        .tm-metric strong { font-size: 13.5px; }
        .tm-progress-track { height: 8px; border-radius: 999px; background: rgba(148,163,184,.25); overflow: hidden; }
        .tm-progress-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--tm-primary), #7c3aed); transition: width .4s ease; }
        .tm-progress-fill.warn { background: linear-gradient(90deg, var(--tm-warning), var(--tm-danger)); }
        .tm-progress-label { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--tm-text-secondary); margin-top: 5px; }

        /* ===== Panel de alertas ===== */
        .tm-alerts { margin-top: 22px; display: flex; flex-direction: column; gap: 10px; }
        .tm-alert {
            display: flex; gap: 12px; align-items: flex-start; padding: 13px 16px; border-radius: var(--tm-radius);
            border: 1px solid var(--tm-border); background: var(--tm-bg-card);
        }
        .tm-alert-icon { font-size: 18px; line-height: 1.2; }
        .tm-alert strong { display: block; font-size: 13.5px; margin-bottom: 2px; }
        .tm-alert span { font-size: 12.5px; color: var(--tm-text-secondary); }
        .tm-alert-warning { border-left: 4px solid var(--tm-warning); }
        .tm-alert-danger  { border-left: 4px solid var(--tm-danger); }
        .tm-alert-ok      { border-left: 4px solid var(--tm-success); }

        /* ===== Layout de dashboard (card + gráfica) ===== */
        .tm-dash-row { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 22px; }
        .tm-panel {
            background: var(--tm-bg-card); border: 1px solid var(--tm-border);
            border-radius: var(--tm-radius); padding: 18px;
        }
        .tm-panel h3 { margin: 0 0 14px; font-size: 15px; display: flex; align-items: center; gap: 8px; }
        .tm-chart-wrap { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
        .tm-chart-legend { display: flex; flex-direction: column; gap: 8px; font-size: 12.5px; }
        .tm-legend-item { display: flex; align-items: center; gap: 8px; color: var(--tm-text-secondary); }
        .tm-legend-dot { width: 11px; height: 11px; border-radius: 3px; flex-shrink: 0; }

        /* ===== Acordeón de categorías ===== */
        .tm-accordion { display: flex; flex-direction: column; gap: 12px; }
        .tm-acc-item { background: var(--tm-bg-card); border: 1px solid var(--tm-border); border-radius: var(--tm-radius); overflow: hidden; }
        .tm-acc-head {
            width: 100%; display: flex; align-items: center; gap: 12px; padding: 14px 16px;
            background: none; border: none; cursor: pointer; color: var(--tm-text); font-family: inherit;
        }
        .tm-acc-head:hover { background: rgba(148,163,184,.07); }
        .tm-acc-icon { font-size: 18px; }
        .tm-acc-title { font-weight: 600; font-size: 14.5px; flex: 1; text-align: left; }
        .tm-acc-sum { font-size: 13px; color: var(--tm-text-secondary); font-weight: 600; }
        .tm-acc-chev { transition: transform .2s; color: var(--tm-text-muted); font-size: 12px; }
        .tm-acc-item.open .tm-acc-chev { transform: rotate(90deg); }
        .tm-acc-body { display: none; border-top: 1px solid var(--tm-border); padding: 6px 16px 12px; }
        .tm-acc-item.open .tm-acc-body { display: block; }
        .tm-subcat-row {
            display: flex; align-items: center; gap: 12px; padding: 12px 4px;
            border-bottom: 1px dashed var(--tm-border);
        }
        .tm-subcat-row:last-child { border-bottom: none; }
        .tm-subcat-info { flex: 1; min-width: 0; }
        .tm-subcat-name { font-size: 13.5px; font-weight: 600; }
        .tm-subcat-detail { font-size: 12px; color: var(--tm-text-muted); margin-top: 2px; }
        .tm-subcat-total { font-size: 14px; font-weight: 700; white-space: nowrap; }
        .tm-subcat-paid { font-size: 11.5px; color: var(--tm-success); white-space: nowrap; }
        .tm-pay-arrow {
            width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--tm-border);
            background: var(--tm-bg-card); color: var(--tm-primary); font-size: 15px; cursor: pointer;
            display: inline-flex; align-items: center; justify-content: center; transition: all .15s; flex-shrink: 0;
        }
        .tm-pay-arrow:hover { background: var(--tm-primary); color: #fff; transform: scale(1.08); }

        /* ===== Planificación diaria ===== */
        .tm-days-grid { display: flex; flex-direction: column; gap: 14px; max-width: 860px; }
        .tm-day-card { background: var(--tm-bg-card); border: 1px solid var(--tm-border); border-radius: var(--tm-radius); padding: 16px; }
        .tm-day-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
        .tm-day-title { font-size: 14.5px; font-weight: 700; }
        .tm-day-title small { display: block; font-weight: 500; color: var(--tm-text-muted); font-size: 11.5px; }
        .tm-day-remain { font-size: 12.5px; font-weight: 700; }
        .tm-day-remain.pos { color: var(--tm-success); }
        .tm-day-remain.neg { color: var(--tm-danger); }
        .tm-expense-row {
            display: grid; grid-template-columns: 1fr 120px 120px 34px; gap: 10px; align-items: center;
            padding: 8px 0; border-top: 1px dashed var(--tm-border); font-size: 13px;
        }
        .tm-expense-concept { color: var(--tm-text); }
        .tm-input {
            width: 100%; padding: 7px 9px; border-radius: 8px; border: 1px solid var(--tm-border);
            background: transparent; color: var(--tm-text); font-size: 13px; font-family: inherit;
        }
        .tm-input:focus { outline: 2px solid var(--tm-primary); outline-offset: -1px; }
        .tm-del { background: none; border: none; color: var(--tm-text-muted); cursor: pointer; font-size: 14px; }
        .tm-del:hover { color: var(--tm-danger); }
        .tm-day-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; gap: 10px; flex-wrap: wrap; }
        .tm-balance-banner {
            display: flex; gap: 18px; flex-wrap: wrap; align-items: center; padding: 14px 18px; margin-bottom: 18px;
            background: var(--tm-bg-card); border: 1px solid var(--tm-border); border-radius: var(--tm-radius);
        }
        .tm-balance-item small { display: block; font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; color: var(--tm-text-muted); }
        .tm-balance-item strong { font-size: 17px; }

        /* ===== Actividades ===== */
        .tm-act-card { background: var(--tm-bg-card); border: 1px solid var(--tm-border); border-radius: var(--tm-radius); padding: 16px; }
        .tm-act-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
        .tm-act-row {
            display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 8px;
            border: 1px solid var(--tm-border); cursor: pointer; transition: all .15s; background: transparent;
        }
        .tm-act-row:hover { border-color: var(--tm-primary); box-shadow: var(--tm-shadow); transform: translateX(3px); }
        .tm-act-time { font-size: 12px; color: var(--tm-text-muted); white-space: nowrap; font-weight: 600; }
        .tm-act-name { flex: 1; font-size: 13.5px; font-weight: 600; }
        .tm-act-cost { font-size: 13px; font-weight: 700; white-space: nowrap; }

        /* ===== Ahorro ===== */
        .tm-save-hero { text-align: center; padding: 26px 18px; }
        .tm-save-hero .tm-big { font-size: 34px; font-weight: 800; letter-spacing: -1px; }
        .tm-save-bar { height: 14px; border-radius: 999px; background: rgba(148,163,184,.25); overflow: hidden; margin: 18px 0 8px; }
        .tm-save-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--tm-success), #34d399); transition: width .5s ease; }
        .tm-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 18px; }
        .tm-list { list-style: none; margin: 0; padding: 0; }
        .tm-list li {
            display: flex; justify-content: space-between; gap: 10px; padding: 10px 4px;
            border-bottom: 1px dashed var(--tm-border); font-size: 13px;
        }
        .tm-list li:last-child { border-bottom: none; }
        .tm-list .muted { color: var(--tm-text-muted); font-size: 12px; }

        /* ===== Modales flotantes ===== */
        .tm-modal-overlay {
            position: fixed; inset: 0; background: rgba(15,23,42,.55); backdrop-filter: blur(3px);
            display: none; align-items: center; justify-content: center; z-index: 1000; padding: 18px;
        }
        .tm-modal-overlay.active { display: flex; animation: tmFade .2s ease; }
        .tm-modal {
            background: var(--tm-bg-card); color: var(--tm-text); border-radius: 14px; width: 100%;
            max-width: 560px; max-height: 88vh; overflow-y: auto; box-shadow: 0 24px 60px rgba(0,0,0,.35);
            border: 1px solid var(--tm-border); animation: tmPop .22s ease;
        }
        @keyframes tmPop { from { transform: scale(.96) translateY(10px); opacity: 0; } to { transform: none; opacity: 1; } }
        .tm-modal-head {
            display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
            padding: 18px 20px 14px; border-bottom: 1px solid var(--tm-border);
            position: sticky; top: 0; background: var(--tm-bg-card); z-index: 2;
        }
        .tm-modal-head h3 { margin: 0; font-size: 16px; }
        .tm-modal-head p { margin: 3px 0 0; font-size: 12.5px; color: var(--tm-text-muted); }
        .tm-modal-close { background: none; border: none; font-size: 20px; color: var(--tm-text-muted); cursor: pointer; line-height: 1; }
        .tm-modal-close:hover { color: var(--tm-danger); }
        .tm-modal-body { padding: 16px 20px 20px; }
        .tm-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .tm-field label { display: block; font-size: 11.5px; font-weight: 600; color: var(--tm-text-secondary); margin-bottom: 4px; text-transform: uppercase; letter-spacing: .3px; }
        .tm-field.full { grid-column: 1 / -1; }
        .tm-payment-history { margin: 0 0 16px; }
        .tm-kv { display: grid; grid-template-columns: 130px 1fr; gap: 6px 12px; font-size: 13.5px; margin-bottom: 14px; }
        .tm-kv dt { color: var(--tm-text-muted); }
        .tm-kv dd { margin: 0; font-weight: 600; }

        /* ===== Estado vacío / banner "dentro del viaje" ===== */
        .tm-inside-banner {
            display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; margin-bottom: 18px;
            background: linear-gradient(90deg, rgba(37,99,235,.10), rgba(124,58,237,.10));
            border: 1px solid var(--tm-border); border-radius: var(--tm-radius);
        }
        .tm-inside-banner strong { font-size: 14px; }
        .tm-empty { text-align: center; padding: 40px 20px; color: var(--tm-text-muted); font-size: 13.5px; }

        /* ===== Responsive ===== */
        @media (max-width: 900px) {
            .tm-dash-row, .tm-two-col { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
            .tm-metrics { grid-template-columns: 1fr; }
            .tm-expense-row { grid-template-columns: 1fr 1fr; }
            .tm-expense-concept { grid-column: 1 / -1; }
            .tm-form-grid { grid-template-columns: 1fr; }
            .tm-select { min-width: 160px; }
            /* Cabecera apilada y modal a pantalla completa en móvil */
            .tm-header { flex-direction: column; align-items: stretch; gap: 10px; }
            .tm-controls { justify-content: space-between; }
            .tm-modal { width: 100%; max-width: 100vw; max-height: 92vh; border-radius: 18px 18px 0 0; margin: auto 0 0 0; overflow-y: auto; }
            .tm-tabs { -webkit-overflow-scrolling: touch; }
            .tm-detail-hero { flex-direction: column; }
            .tm-detail-hero img, .tm-detail-hero .tm-hero-img { height: 160px; width: 100%; }
            .tm-detail-metrics { grid-template-columns: 1fr 1fr; }
            .tm-mini-cal-row { flex-wrap: wrap; }
        }

        /* ================================================================
           ESTILOS DE LA VISTA GLOBAL COMPACTA + PANTALLA DE CONFIGURACIÓN
           ================================================================ */
        /* Cabecera compacta: sin título grande ni descripción */
        .tm-header-compact { margin-bottom: 10px; justify-content: flex-end; }
        .tm-header-compact .tm-select { min-width: 200px; }

        /* Barra de filtros + segmentado */
        .tm-filterbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .tm-seg { display: inline-flex; background: rgba(148,163,184,.14); border: 1px solid var(--tm-border); border-radius: 999px; padding: 3px; gap: 2px; }
        .tm-seg-btn { border: none; background: transparent; color: var(--tm-text-secondary); font-size: 12.5px; font-weight: 600; padding: 7px 14px; border-radius: 999px; cursor: pointer; font-family: inherit; transition: all .15s ease; white-space: nowrap; }
        .tm-seg-btn:hover { color: var(--tm-text); }
        .tm-seg-btn.active { background: var(--tm-bg-card); color: var(--tm-primary); box-shadow: 0 1px 4px rgba(0,0,0,.12); }
        .tm-select-sm { padding: 7px 10px; font-size: 12.5px; min-width: 170px; }

        /* Tabla cruzada categorías × viajes */
        .tm-xscroll { overflow-x: auto; scrollbar-width: thin; }
        .tm-xtable { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 560px; }
        .tm-xtable th, .tm-xtable td { padding: 10px 12px; border-bottom: 1px solid var(--tm-border); text-align: left; white-space: nowrap; }
        .tm-xtable thead th { font-size: 10.5px; text-transform: uppercase; letter-spacing: .5px; color: var(--tm-text-muted); background: rgba(148,163,184,.07); position: sticky; top: 0; }
        .tm-th-num, .tm-td-num { text-align: right; font-variant-numeric: tabular-nums; }
        .tm-td-num.tm-zero { color: var(--tm-text-muted); }
        .tm-td-num.tm-strong { font-weight: 800; }
        .tm-xrow { cursor: pointer; transition: background .12s ease; }
        .tm-xrow:hover { background: rgba(37,99,235,.06); }
        .tm-xrow small.tm-muted { color: var(--tm-text-muted); font-size: 11px; }
        .tm-xtotal td { font-weight: 800; border-top: 2px solid var(--tm-border); border-bottom: none; background: rgba(148,163,184,.07); }
        .tm-hint { font-size: 12px; color: var(--tm-text-muted); margin: 10px 2px 0; }

        /* Hero del detalle: foto arriba, portada con degradado */
        .tm-detail-hero { position: relative; border-radius: 16px; overflow: hidden; border: 1px solid var(--tm-border); background: var(--tm-bg-card); margin-bottom: 16px; box-shadow: var(--tm-shadow); }
        .tm-detail-hero > img { display: block; width: 100%; height: 210px; object-fit: cover; }
        .tm-detail-hero-body { padding: 16px 20px 18px; }
        .tm-detail-kicker { font-size: 10.5px; font-weight: 800; letter-spacing: .7px; text-transform: uppercase; color: var(--tm-text-muted); display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .tm-detail-hero-body h2 { margin: 0 0 3px; font-size: 22px; letter-spacing: -.3px; }
        .tm-detail-sub { font-size: 13.5px; color: var(--tm-text-secondary); margin-bottom: 8px; }
        .tm-detail-meta { display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: 12.5px; color: var(--tm-text-secondary); margin-bottom: 12px; }
        .tm-detail-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
        .tm-detail-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .tm-detail-section { margin-bottom: 26px; }
        .tm-detail-section h3 { margin: 0 0 12px; font-size: 15.5px; display: flex; align-items: center; gap: 8px; }

        /* Pestañas internas de la pantalla de configuración del viaje */
        .tm-subtabs { display: inline-flex; gap: 4px; background: rgba(148,163,184,.14); border: 1px solid var(--tm-border); border-radius: 999px; padding: 4px; margin-bottom: 18px; max-width: 100%; overflow-x: auto; scrollbar-width: none; }
        .tm-subtabs::-webkit-scrollbar { display: none; }
        .tm-subtab { border: none; background: transparent; color: var(--tm-text-secondary); font-size: 12.5px; font-weight: 600; padding: 8px 16px; border-radius: 999px; cursor: pointer; font-family: inherit; transition: all .15s ease; white-space: nowrap; }
        .tm-subtab:hover { color: var(--tm-text); }
        .tm-subtab.active { background: var(--tm-bg-card); color: var(--tm-primary); box-shadow: 0 1px 4px rgba(0,0,0,.12); }

        /* Mini calendario mensual */
        .tm-mini-cal-row { display: flex; gap: 14px; flex-wrap: wrap; }
        .tm-mini-cal { background: rgba(148,163,184,.08); border: 1px solid var(--tm-border); border-radius: 10px; padding: 8px 10px; }
        .tm-mini-cal-title { font-size: 11px; font-weight: 700; text-transform: capitalize; color: var(--tm-text-secondary); margin-bottom: 5px; text-align: center; }
        .tm-cal-grid { display: grid; grid-template-columns: repeat(7, 22px); gap: 2px; }
        .tm-cal-dow { font-size: 9px; font-weight: 800; color: var(--tm-text-muted); text-align: center; }
        .tm-cal-day { font-size: 10px; line-height: 22px; text-align: center; border-radius: 6px; color: var(--tm-text-secondary); }
        .tm-cal-day.in { background: rgba(37,99,235,.16); color: var(--tm-primary); font-weight: 700; }
        .tm-cal-day.edge { background: var(--tm-primary); color: #fff; font-weight: 800; }

        /* Chips de categorías presupuestadas */
        .tm-cat-chips { display: flex; gap: 10px; flex-wrap: wrap; }
        .tm-cat-chip { display: flex; align-items: center; gap: 9px; border: 1px solid var(--tm-border); border-left: 4px solid var(--chip, var(--tm-primary)); background: var(--tm-bg-card); border-radius: 10px; padding: 8px 12px; min-width: 150px; }
        .tm-cat-chip-icon { font-size: 17px; }
        .tm-cat-chip strong { display: block; font-size: 12.5px; }
        .tm-cat-chip small { font-size: 11px; color: var(--tm-text-secondary); font-variant-numeric: tabular-nums; }

        /* Carrusel horizontal de tarjetas (días y actividades) */
        .tm-carousel { display: flex; align-items: center; gap: 10px; }
        .tm-car-track { display: flex; gap: 14px; overflow-x: auto; scroll-behavior: smooth; padding: 4px 2px 10px; scrollbar-width: thin; flex: 1; min-width: 0; }
        .tm-car-track::-webkit-scrollbar { height: 6px; }
        .tm-car-track::-webkit-scrollbar-thumb { background: rgba(148,163,184,.4); border-radius: 999px; }
        .tm-car-arrow { flex: none; order: -1; width: 46px; height: 46px; border-radius: 50%; border: 1px solid var(--tm-border); background: var(--tm-bg-card); color: var(--tm-text); font-size: 24px; line-height: 1; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,.16); display: flex; align-items: center; justify-content: center; transition: all .15s ease; }
        .tm-car-arrow:hover { background: var(--tm-primary); color: #fff; transform: scale(1.06); }
        .tm-carousel .tm-car-arrow.right { order: 1; }
        .tm-day-card-h { flex: 0 0 340px; width: 340px; display: flex; flex-direction: column; vertical-align: top; }
        .tm-day-card-h .tm-day-title { font-size: 12.5px; }

        /* Líneas de gasto diario dentro de la tarjeta */
        .tm-dline { display: grid; grid-template-columns: 1fr 62px 62px 22px; gap: 6px; align-items: center; padding: 6px 0; border-top: 1px dashed var(--tm-border); font-size: 12px; }
        .tm-dline-head { border-top: none; padding: 2px 0 4px; font-size: 9.5px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; color: var(--tm-text-muted); }
        .tm-dline.over .tm-dline-cat, .tm-dline.over .tm-input.neg { color: var(--tm-danger); }
        .tm-dline.over { background: rgba(239,68,68,.06); border-radius: 6px; }
        .tm-dline-cat { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
        .tm-dline-cat::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--dot, var(--tm-primary)); flex: none; }
        .tm-input-xs { padding: 4px 6px; font-size: 12px; border-radius: 6px; text-align: right; }
        .tm-input-xs.neg { border-color: var(--tm-danger); color: var(--tm-danger); font-weight: 700; }

        /* Filas de actividades dentro del carrusel */
        .tm-act-row .tm-badge { font-size: 9.5px; padding: 2px 7px; }

        /* Reglas y avisos (pantalla Configuración) */
        .tm-rule-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px dashed var(--tm-border); font-size: 13px; }
        .tm-rule-row:first-of-type { border-top: none; }
        .tm-rule-icon { font-size: 18px; flex: none; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 10px; background: rgba(148,163,184,.12); }
        .tm-rule-main { flex: 1; min-width: 0; }
        .tm-rule-label { font-weight: 600; }
        .tm-rule-sub { font-size: 11.5px; color: var(--tm-text-muted); margin-top: 2px; }
        .tm-switch { position: relative; width: 40px; height: 22px; flex: none; cursor: pointer; }
        .tm-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
        .tm-switch-slider { position: absolute; inset: 0; border-radius: 999px; background: rgba(148,163,184,.45); transition: background .15s ease; }
        .tm-switch-slider::before { content: ""; position: absolute; left: 3px; top: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .15s ease; }
        .tm-switch input:checked + .tm-switch-slider { background: var(--tm-success); }
        .tm-switch input:checked + .tm-switch-slider::before { transform: translateX(18px); }
        .tm-select-days { width: 110px; flex: none; }
        .tm-alert-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid rgba(239,68,68,.35); background: rgba(239,68,68,.06); border-radius: 10px; margin-bottom: 8px; font-size: 13px; }
        .tm-alert-item.warn { border-color: rgba(245,158,11,.4); background: rgba(245,158,11,.07); }
        .tm-alert-item strong { margin-left: auto; white-space: nowrap; }

        /* Ahorro y financiación del viaje (rediseño) */
        .tm-fund-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
        .tm-fund-card { background: var(--tm-bg-card); border: 1px solid var(--tm-border); border-radius: 12px; padding: 14px 16px; }
        .tm-fund-card small { display: block; font-size: 10.5px; text-transform: uppercase; letter-spacing: .5px; color: var(--tm-text-muted); margin-bottom: 4px; }
        .tm-fund-card strong { font-size: 17px; letter-spacing: -.3px; }
        .tm-fund-bar { height: 12px; border-radius: 999px; background: rgba(148,163,184,.25); overflow: hidden; margin: 10px 0 6px; }
        .tm-fund-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--tm-primary), #60a5fa); transition: width .5s ease; }
        .tm-fund-split { display: flex; gap: 4px; height: 12px; border-radius: 999px; overflow: hidden; background: rgba(148,163,184,.25); margin: 10px 0 6px; }
        .tm-fund-split > span { display: block; height: 100%; }
        .tm-legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 11.5px; color: var(--tm-text-secondary); margin-top: 6px; }
        .tm-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 5px; }
    `; }

    /* =========================================================================
       3. CLASE PRINCIPAL TripManager
       ========================================================================= */
    class TripManager {
        /**
         * @param {HTMLElement|string} mountOrSelector Contenedor o selector (p.ej. '#trip-manager-app')
         * @param {object}             options         { data, onChange(trip) }
         */
        constructor(mountOrSelector, options = {}) {
            this.mount = typeof mountOrSelector === 'string'
                ? document.querySelector(mountOrSelector)
                : mountOrSelector;
            if (!this.mount) throw new Error('[TripManager] No se encontró el contenedor de montaje.');

            this.data = options.data || JSON.parse(JSON.stringify(mockData));
            this.onChange = typeof options.onChange === 'function' ? options.onChange : null;

            this.state = {
                activeTab: 'resumen',
                detailTab: 'config',      // pestaña interna del detalle: config | diario | actividades | ahorro
                selectedTripId: null,     // null → vista global (Resumen General)
                openCategories: {},       // { tripId|categoryId: true } estado acordeón
                expandedDays: {},
                statusFilter: 'proximos', // 'proximos' | 'finalizados'
                monthFilter: '',          // '' | 'YYYY-MM'
                dayScroll: 0,             // desplazamiento del carrusel diario (detail)
                actScroll: 0              // desplazamiento del carrusel de actividades (detail)
            };

            this._onKeydown = (e) => { if (e.key === 'Escape') this.closeModal(); };
            this.mounted = false;
        }

        /* --------------------- Utilidades --------------------- */
        static fmt(n) {
            return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
        }
        static parseDate(str) { return new Date(str + 'T00:00:00'); }
        static iso(d) {
            const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
        }
        static longDate(str) {
            const d = TripManager.parseDate(str);
            return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }
        static shortDate(str) {
            return TripManager.parseDate(str).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
        }
        static cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
        static esc(s) {
            return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[c]));
        }
        static daysBetween(a, b) {
            return Math.round((TripManager.parseDate(b) - TripManager.parseDate(a)) / 86400000);
        }
        static uid(prefix) { return prefix + '-' + Math.random().toString(36).slice(2, 8); }

        get today() { return TripManager.iso(new Date()); }

        get trips() { return this.data.trips; }
        get selectedTrip() {
            return this.trips.find(t => t.id === this.state.selectedTripId) || null;
        }
        /** Trips que se muestran según si estamos "dentro" de un viaje o en vista global. */
        get visibleTrips() {
            const t = this.selectedTrip;
            return t ? [t] : this.trips;
        }
        /** Lista de viajes para la vista GLOBAL con los filtros aplicados. */
        filteredTrips() {
            let list = [...this.trips];
            if (this.state.statusFilter === 'finalizados') list = list.filter(t => this.statusOf(t) === 'realizado');
            else list = list.filter(t => this.statusOf(t) !== 'realizado');
            if (this.state.monthFilter) list = list.filter(t => this._tripMonths(t).includes(this.state.monthFilter));
            return list.sort((a, b) => a.startDate.localeCompare(b.startDate));
        }
        /** Meses (YYYY-MM) tocados por el rango de fechas del viaje. */
        _tripMonths(trip) {
            const months = [];
            const s = TripManager.parseDate(trip.startDate), e = TripManager.parseDate(trip.endDate);
            const d = new Date(s.getFullYear(), s.getMonth(), 1);
            while (d <= e) {
                months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                d.setMonth(d.getMonth() + 1);
            }
            return months;
        }
        /** Opciones de mes/año para el filtro (de todos los viajes). */
        _monthOptions() {
            const set = new Set();
            this.trips.forEach(t => this._tripMonths(t).forEach(m => set.add(m)));
            return [...set].sort();
        }

        statusOf(trip) {
            const today = this.today;
            if (today > trip.endDate) return 'realizado';
            if (today >= trip.startDate) return 'en-curso';
            return 'proximo';
        }
        statusLabel(trip) {
            return { proximo: 'Próximo', 'en-curso': 'En curso', realizado: 'Realizado' }[this.statusOf(trip)];
        }
        daysUntil(trip) { return TripManager.daysBetween(this.today, trip.startDate); }

        /** Total presupuestado (planificado) de todas las subcategorías del viaje. */
        plannedOf(trip) {
            return trip.categories.reduce((s, c) => s + c.items.reduce((x, i) => x + (i.total || 0), 0), 0);
        }
        /** Total ya pagado (suma de movimientos parciales). */
        paidOf(trip) {
            return trip.categories.reduce((s, c) => s + c.items.reduce(
                (x, i) => x + i.payments.reduce((p, q) => p + (q.amount || 0), 0), 0), 0);
        }
        pendingOf(trip) { return Math.max(this.plannedOf(trip) - this.paidOf(trip), 0); }
        dailyBudgetedOf(trip) { return trip.days.reduce((s, d) => s + d.items.reduce((x, i) => x + (i.budgeted || 0), 0), 0); }
        dailyRealOf(trip) { return trip.days.reduce((s, d) => s + d.items.reduce((x, i) => x + (i.real || 0), 0), 0); }
        /** Gastado/Planificado = grandes pagos planificados + presupuesto diario ajustable. */
        spentPlannedOf(trip) { return this.plannedOf(trip) + this.dailyBudgetedOf(trip); }

        categoryTotals(trip) {
            return trip.categories.map(c => ({
                name: c.name,
                value: c.items.reduce((s, i) => s + (i.total || 0), 0)
            })).filter(c => c.value > 0);
        }

        savedTotal() {
            return this.data.savings.contributions.reduce((s, c) => s + c.amount, 0);
        }

        /** Pagos pendientes próximos (para alertas y vencimientos). */
        upcomingPayments(trip = null) {
            const list = [];
            const trips = trip ? [trip] : this.trips;
            trips.forEach(t => {
                if (this.statusOf(t) === 'realizado') return;
                t.categories.forEach(c => c.items.forEach(i => {
                    const paid = i.payments.reduce((s, p) => s + p.amount, 0);
                    const pending = (i.total || 0) - paid;
                    if (pending > 0.005 && i.dueDate) {
                        list.push({ trip: t, item: i, category: c, pending, dueDate: i.dueDate });
                    }
                }));
            });
            return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        }

        /* --------------------- Ciclo de vida --------------------- */
        mountApp() {
            if (this.mounted) return this;
            // Se usa window.App explícito: dentro de este IIFE 'App' no está definido
            // y lanzaba ReferenceError → el módulo nunca se montaba (pantalla en blanco).
            const shell = window.App || App;
            shell.injectStylesheet(CSS_ID, moduleCSS());
            this.mount.classList.add('tm-root');
            this.mount.innerHTML = `
                <header class="tm-header tm-header-compact">
                    <div class="tm-controls">
                        <button type="button" class="tm-btn tm-btn-ghost tm-btn-sm" id="tm-back-btn" data-action="back-btn" hidden>← Volver</button>
                    </div>
                </header>
                <nav class="tm-tabs" role="tablist">
                    <button class="tm-tab" data-tab="resumen" role="tab">📊 Resumen</button>
                    <button class="tm-tab" data-tab="categorias" role="tab">🗂️ Categorías</button>
                    <button class="tm-tab" data-tab="ahorro" role="tab">💶 Ahorro y Financiación</button>
                </nav>
                <div id="tm-view-resumen"     class="tm-view" role="tabpanel"></div>
                <div id="tm-view-categorias"  class="tm-view" role="tabpanel"></div>
                <div id="tm-view-ahorro"      class="tm-view" role="tabpanel"></div>
                <div id="tm-view-detail"      class="tm-view" role="region"></div>
                <div class="tm-modal-overlay" id="tm-modal-overlay" aria-hidden="true">
                    <div class="tm-modal" role="dialog" aria-modal="true"><div id="tm-modal-inner"></div></div>
                </div>`;

            // Delegación de eventos única (sustituye a los bindings por render)
            this.mount.addEventListener('click', (e) => this._onClick(e));
            this.mount.addEventListener('input', (e) => this._onInput(e));
            this.mount.addEventListener('change', (e) => this._onChange(e));

            const overlay = this.mount.querySelector('#tm-modal-overlay');
            overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeModal(); });
            document.addEventListener('keydown', this._onKeydown);

            this.mounted = true;
            this.render();
            return this;
        }

        destroy() {
            document.removeEventListener('keydown', this._onKeydown);
            if (this.mount) this.mount.innerHTML = '';
            this.mounted = false;
        }

        /* --------------------- Navegación interna --------------------- */
        selectTrip(id) {
            this.state.selectedTripId = id || null;
            this.render();
        }
        switchTab(tab) {
            this.state.activeTab = tab;
            this.render();
        }

        /* --------------------- Render maestro --------------------- */
        render() {
            if (!this.mounted) return;
            this._renderHeader();
            this._renderTabs();
            // La pantalla de configuración del viaje sustituye a las pestañas
            this['_render_' + this.state.activeTab]();
        }

        _renderHeader() {
            const inDetail = this.state.activeTab === 'detail';
            const header = this.mount.querySelector('.tm-header');
            if (header) header.style.display = inDetail ? '' : 'none';
            const backBtn = this.mount.querySelector('#tm-back-btn');
            backBtn.hidden = !inDetail;
        }

        _renderTabs() {
            const global = this.state.activeTab !== 'detail';
            this.mount.querySelectorAll('.tm-tabs, .tm-header').forEach(el => { /* header siempre visible (botón volver) */ });
            this.mount.querySelector('.tm-tabs').style.display = global ? '' : 'none';
            this.mount.querySelectorAll('.tm-tab').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === this.state.activeTab);
            });
            this.mount.querySelectorAll('.tm-view').forEach(v => {
                v.classList.toggle('active', v.id === 'tm-view-' + this.state.activeTab);
            });
        }

        /* =========================================================
           TAB 1 · RESUMEN GENERAL (vista global: filtros + tarjetas)
           ========================================================= */
        _filtersBarHTML() {
            const msel = new Intl.DateTimeFormat('es-ES', { month: 'long' });
            const opts = ['<option value="">Todos los meses</option>'].concat(
                this._monthOptions().map(m => {
                    const [y, mm] = m.split('-');
                    const label = TripManager.cap(msel.format(new Date(Number(y), Number(mm) - 1, 1))) + ' ' + y;
                    return `<option value="${m}" ${m === this.state.monthFilter ? 'selected' : ''}>${label}</option>`;
                }));
            return `
            <div class="tm-filterbar">
                <div class="tm-seg" role="group" aria-label="Filtro por estado">
                    <button type="button" class="tm-seg-btn ${this.state.statusFilter === 'proximos' ? 'active' : ''}" data-action="status-filter" data-val="proximos">🧳 Próximos</button>
                    <button type="button" class="tm-seg-btn ${this.state.statusFilter === 'finalizados' ? 'active' : ''}" data-action="status-filter" data-val="finalizados">✅ Finalizados</button>
                </div>
                <select class="tm-select tm-select-sm" data-action="month-filter" aria-label="Filtrar por mes y año">${opts.join('')}</select>
            </div>`;
        }

        _render_resumen() {
            const view = this.mount.querySelector('#tm-view-resumen');
            const trips = this.filteredTrips();
            const cards = trips.map(t => this._tripCardHTML(t)).join('');
            const pieTrip = trips.slice().sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

            view.innerHTML = `
                ${this._filtersBarHTML()}
                <div class="tm-trips-grid">${cards || '<div class="tm-empty">No hay viajes con los filtros seleccionados.</div>'}</div>
                ${pieTrip ? `
                <div class="tm-dash-row">
                    <div class="tm-panel">
                        <h3>🥧 Distribución del gasto por categoría</h3>
                        <div class="tm-chart-wrap">
                            <canvas id="tm-pie-canvas" width="220" height="220" aria-label="Gráfica de rosco por categoría"></canvas>
                            <div class="tm-chart-legend" id="tm-pie-legend"></div>
                        </div>
                        <p style="font-size:12px;color:var(--tm-text-muted);margin:12px 0 0;">
                            Datos del viaje: <strong>${TripManager.esc(pieTrip.name)}</strong>
                        </p>
                    </div>
                    <div class="tm-panel">
                        <h3>🔔 Alertas inteligentes</h3>
                        <div class="tm-alerts" style="margin-top:0;">${this._alertsHTML()}</div>
                    </div>
                </div>` : ''}`;

            if (pieTrip) this._drawPie(pieTrip);
        }

        _tripCardHTML(trip) {
            const st = this.statusOf(trip);
            const limit = trip.budgetLimit;
            const planned = this.spentPlannedOf(trip);
            const paid = this.paidOf(trip);
            const pct = limit > 0 ? Math.min(Math.round(planned / limit * 100), 100) : 0;
            const days = this.daysUntil(trip);
            const countdown = st === 'realizado'
                ? 'Finalizado'
                : st === 'en-curso' ? '¡Disfrutando el viaje!' : `Faltan ${days} días`;

            return `
            <article class="tm-trip-card" data-action="open-trip" data-trip="${trip.id}" tabindex="0" role="button"
                     aria-label="Abrir detalle del viaje ${TripManager.esc(trip.name)}">
                <div class="tm-trip-img">
                    <img src="${trip.image}" alt="${TripManager.esc(trip.destination)}" loading="lazy"
                         onerror="this.style.display='none'">
                    <span class="tm-badge tm-badge-${st}">${this.statusLabel(trip)}</span>
                    <span class="tm-trip-countdown">⏳ ${countdown}</span>
                </div>
                <div class="tm-trip-body">
                    <h3 class="tm-trip-name">${TripManager.esc(trip.name)}</h3>
                    <div class="tm-trip-meta">
                        <span>📍 ${TripManager.esc(trip.destination)}</span>
                        <span>🗓️ ${TripManager.shortDate(trip.startDate)} → ${TripManager.shortDate(trip.endDate)}</span>
                    </div>
                    <div class="tm-metrics">
                        <div class="tm-metric"><small>Presupuesto límite</small><strong>${TripManager.fmt(limit)}</strong></div>
                        <div class="tm-metric"><small>Gastado / Planif.</small><strong>${TripManager.fmt(planned)}</strong></div>
                        <div class="tm-metric"><small>Pagado ya</small><strong style="color:var(--tm-success)">${TripManager.fmt(paid)}</strong></div>
                    </div>
                    <div>
                        <div class="tm-progress-track"><div class="tm-progress-fill ${pct >= 85 ? 'warn' : ''}" style="width:${pct}%"></div></div>
                        <div class="tm-progress-label">
                            <span>${pct}% del presupuesto comprometido</span>
                            <span>${TripManager.fmt(limit - planned)} libres</span>
                        </div>
                    </div>
                </div>
            </article>`;
        }

        _alertsHTML() {
            const alerts = [];
            this.trips.filter(t => this.statusOf(t) !== 'realizado').forEach(t => {
                const days = this.daysUntil(t);
                const pendings = this.upcomingPayments(t);
                const pendingSum = pendings.reduce((s, p) => s + p.pending, 0);
                if (days < 45 && pendingSum > 0) {
                    alerts.push(`
                        <div class="tm-alert tm-alert-danger">
                            <span class="tm-alert-icon">🚨</span>
                            <div>
                                <strong>«${TripManager.esc(t.name)}»: quedan ${days} días y hay ${TripManager.fmt(pendingSum)} pendientes de abonar</strong>
                                <span>${pendings.length} reserva(s) con pagos pendientes. Próximo vencimiento: ${TripManager.esc(pendings[0].item.subcategory)} — ${TripManager.shortDate(pendings[0].dueDate)}.</span>
                            </div>
                        </div>`);
                } else if (days < 45) {
                    alerts.push(`
                        <div class="tm-alert tm-alert-warning">
                            <span class="tm-alert-icon">⏰</span>
                            <div>
                                <strong>«${TripManager.esc(t.name)}» empieza en ${days} días</strong>
                                <span>Todos los pagos registrados están al corriente. ¡A preparar la maleta!</span>
                            </div>
                        </div>`);
                } else if (pendingSum > 0) {
                    alerts.push(`
                        <div class="tm-alert tm-alert-warning">
                            <span class="tm-alert-icon">📌</span>
                            <div>
                                <strong>«${TripManager.esc(t.name)}»: ${TripManager.fmt(pendingSum)} pendientes</strong>
                                <span>Faltan ${days} días para la salida. Planifica los pagos parciales restantes.</span>
                            </div>
                        </div>`);
                }
            });
            if (!alerts.length) {
                alerts.push(`
                    <div class="tm-alert tm-alert-ok">
                        <span class="tm-alert-icon">✅</span>
                        <div><strong>Sin alertas activas</strong><span>Ningún viaje próximo con urgencia de pagos.</span></div>
                    </div>`);
            }
            return alerts.join('');
        }

        /** Gráfica de rosco nativa en Canvas HTML5. */
        _drawPie(trip) {
            const canvas = this.mount.querySelector('#tm-pie-canvas');
            if (!canvas || typeof canvas.getContext !== 'function') return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const dpr = window.devicePixelRatio || 1;
            const size = 220;
            canvas.width = size * dpr; canvas.height = size * dpr;
            canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const palette = ['#2563eb', '#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'];
            const slices = this.categoryTotals(trip);
            const total = slices.reduce((s, x) => s + x.value, 0);

            ctx.clearRect(0, 0, size, size);
            const cx = size / 2, cy = size / 2, r = size / 2 - 8, inner = r * 0.58;
            let angle = -Math.PI / 2;
            slices.forEach((sl, idx) => {
                const sliceAngle = total > 0 ? (sl.value / total) * Math.PI * 2 : 0;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, r, angle, angle + sliceAngle);
                ctx.closePath();
                ctx.fillStyle = palette[idx % palette.length];
                ctx.fill();
                angle += sliceAngle;
            });
            // Agujero central (efecto donut)
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath(); ctx.arc(cx, cy, inner, 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            // Texto central
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text') || '#0f172a';
            ctx.font = '700 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(TripManager.fmt(total), cx, cy - 8);
            ctx.font = '500 10px sans-serif'; ctx.fillStyle = '#94a3b8';
            ctx.fillText('TOTAL PLANIFICADO', cx, cy + 10);

            const legend = this.mount.querySelector('#tm-pie-legend');
            legend.innerHTML = slices.map((sl, idx) => `
                <div class="tm-legend-item">
                    <span class="tm-legend-dot" style="background:${palette[idx % palette.length]}"></span>
                    <span>${TripManager.esc(sl.name)} — <strong>${TripManager.fmt(sl.value)}</strong>
                    (${total ? Math.round(sl.value / total * 100) : 0}%)</span>
                </div>`).join('');
        }

        /* =========================================================
           TAB 2 · CATEGORÍAS (vista global: tabla categorías × viajes)
           ========================================================= */
        _render_categorias() {
            const view = this.mount.querySelector('#tm-view-categorias');
            const trips = this.filteredTrips();
            if (!trips.length) { view.innerHTML = '<div class="tm-empty">No hay viajes con los filtros seleccionados.</div>'; return; }

            // Columnas = todas las categorías presentes (Avión separado de Transporte)
            const colMap = new Map();
            trips.forEach(t => t.categories.forEach(c => {
                if (!colMap.has(c.name)) colMap.set(c.name, { name: c.name, icon: c.icon });
            }));
            const cols = [...colMap.values()];

            const cellValue = (trip, catName) => trip.categories
                .filter(c => c.name === catName)
                .reduce((s, c) => s + c.items.reduce((x, i) => x + (i.total || 0), 0), 0);

            const head = `<tr><th>VIAJE</th>${cols.map(c => `<th class="tm-th-num">${c.icon} ${TripManager.esc(c.name)}</th>`).join('')}<th class="tm-th-num">TOTAL</th></tr>`;
            const rows = trips.map(t => {
                const total = this.plannedOf(t);
                return `<tr class="tm-xrow" data-action="open-trip" data-trip="${t.id}" tabindex="0" role="button">
                    <td><strong>${TripManager.esc(t.name)}</strong><br><small class="tm-muted">${TripManager.shortDate(t.startDate)} → ${TripManager.shortDate(t.endDate)}</small></td>
                    ${cols.map(c => { const v = cellValue(t, c.name); return `<td class="tm-td-num${v ? '' : ' tm-zero'}">${v ? TripManager.fmt(v) : '·'}</td>`; }).join('')}
                    <td class="tm-td-num tm-strong">${TripManager.fmt(total)}</td></tr>`;
            }).join('');
            const colTotals = cols.map(c => trips.reduce((s, t) => s + cellValue(t, c.name), 0));
            const grand = trips.reduce((s, t) => s + this.plannedOf(t), 0);
            const foot = `<tr class="tm-xtotal"><td>TOTAL</td>${colTotals.map(v => `<td class="tm-td-num">${TripManager.fmt(v)}</td>`).join('')}<td class="tm-td-num tm-strong">${TripManager.fmt(grand)}</td></tr>`;

            view.innerHTML = `
                <div class="tm-panel" style="padding:6px 0 0;">
                    <div class="tm-xscroll"><table class="tm-xtable"><thead>${head}</thead><tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></div>
                </div>
                <p class="tm-hint">💡 Pincha en un viaje para abrir su configuración y el desglose de pagos parciales por categoría.</p>`;
        }

        /* helpers de detalle ------------------------------------------------- */
        _catColor(name) {
            const palette = ['#2563eb', '#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#0ea5e9', '#a855f7'];
            let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
            return palette[h % palette.length];
        }
        /** Categorías del viaje con "Vuelos/Avión" separada de "Transporte". */
        _splitCategories(trip) {
            const FL = /vuel|flight|av[ió]n|iberia|ryanair|vueling/i;
            const out = [];
            trip.categories.forEach(c => {
                const flights = c.items.filter(i => FL.test((i.subcategory || '') + ' ' + (i.provider || '')));
                const rest = c.items.filter(i => !FL.test((i.subcategory || '') + ' ' + (i.provider || '')));
                if (flights.length && rest.length) {
                    out.push({ id: c.id + '-avion', name: 'Avión', icon: '✈️', items: flights, color: '#0ea5e9' });
                    out.push({ id: c.id, name: c.name, icon: c.icon, items: rest, color: this._catColor(c.name) });
                } else if (flights.length && /^transporte$/i.test(c.name)) {
                    out.push({ id: c.id + '-avion', name: 'Avión', icon: '✈️', items: flights, color: '#0ea5e9' });
                } else {
                    out.push({ id: c.id, name: c.name, icon: c.icon, items: c.items, color: this._catColor(c.name) });
                }
            });
            return out;
        }
        _miniMonth(cal, monthIso) {
            const [y, m] = monthIso.split('-').map(Number);
            const first = new Date(y, m - 1, 1);
            const dim = new Date(y, m, 0).getDate();
            const startW = (first.getDay() + 6) % 7; // lunes = 0
            const inRange = d => { const iso = TripManager.iso(d); return iso >= cal.start && iso <= cal.end; };
            let cells = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(w => `<span class="tm-cal-dow">${w}</span>`).join('');
            for (let i = 0; i < startW; i++) cells += '<span></span>';
            for (let d = 1; d <= dim; d++) {
                const date = new Date(y, m - 1, d);
                const cls = inRange(date) ? (TripManager.iso(date) === cal.start || TripManager.iso(date) === cal.end ? 'edge' : 'in') : '';
                cells += `<span class="tm-cal-day ${cls}">${d}</span>`;
            }
            const label = TripManager.cap(new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));
            return `<div class="tm-mini-cal"><div class="tm-mini-cal-title">${label}</div><div class="tm-cal-grid">${cells}</div></div>`;
        }
        _calHTML(trip) {
            const months = this._tripMonths(trip);
            return `<div class="tm-mini-cal-row">${months.slice(0, 4).map(m => this._miniMonth({ start: trip.startDate, end: trip.endDate }, m)).join('')}</div>`;
        }

        /* =========================================================
           PANTALLA DE CONFIGURACIÓN DEL VIAJE (no modal, con volver)
           ========================================================= */
        openTripDetail(id) {
            this.state.selectedTripId = id;
            this.state.activeTab = 'detail';
            this.state.detailTab = 'config';   // siempre arranca en la 1ª pestaña
            this.state.dayScroll = 0;
            this.state.actScroll = 0;
            this.render();
            if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        closeTripDetail() {
            this.state.selectedTripId = null;
            this.state.activeTab = 'resumen';
            this.render();
        }

        _render_detail() {
            const view = this.mount.querySelector('#tm-view-detail');
            const trip = this.selectedTrip;
            if (!trip) { this.closeTripDetail(); return; }
            const st = this.statusOf(trip);
            const days = this.daysUntil(trip);
            const totalDays = TripManager.daysBetween(trip.startDate, trip.endDate) + 1;
            const planned = this.spentPlannedOf(trip);
            const paid = this.paidOf(trip);
            const cats = this._splitCategories(trip);
            const dt = this.state.detailTab || 'config';

            const sectionHTML = {
                config: `
                    <section class="tm-detail-section">
                        <h3>🗂️ Categorías presupuestadas</h3>
                        <div class="tm-cat-chips">
                            ${cats.map(c => {
                                const tot = c.items.reduce((s, i) => s + (i.total || 0), 0);
                                const cp = c.items.reduce((s, i) => s + i.payments.reduce((x, p) => x + p.amount, 0), 0);
                                return `<div class="tm-cat-chip" style="--chip:${c.color}">
                                    <span class="tm-cat-chip-icon">${c.icon}</span>
                                    <div><strong>${TripManager.esc(c.name)}</strong><small>${TripManager.fmt(cp)} / ${TripManager.fmt(tot)}</small></div>
                                </div>`;
                            }).join('')}
                        </div>
                        <div class="tm-accordion" style="margin-top:14px;">${this._catAccordionHTML(trip)}</div>
                    </section>
                    ${this._rulesSectionHTML(trip, st)}`,
                diario: `
                    <section class="tm-detail-section">
                        <h3>📅 Planificación diaria</h3>
                        ${this._carouselHTML('day', this._daysCarouselInner(trip), `Total del viaje: ${TripManager.fmt(this.dailyBudgetedOf(trip))} planificado · ${TripManager.fmt(this.dailyRealOf(trip))} real`)}
                    </section>`,
                actividades: `
                    <section class="tm-detail-section">
                        <h3>🎯 Actividades</h3>
                        ${this._carouselHTML('act', this._activitiesCarouselInner(trip))}
                    </section>`,
                ahorro: `
                    <section class="tm-detail-section">
                        <h3>💶 Ahorro y financiación del viaje</h3>
                        ${this._privateFundHTML(trip)}
                    </section>`
            }[dt];

            view.innerHTML = `
                <div class="tm-detail-hero">
                    <img src="${trip.image}" alt="${TripManager.esc(trip.destination)}" onerror="this.style.display='none'">
                    <div class="tm-detail-hero-body">
                        <div class="tm-detail-kicker">CONFIGURACIÓN DEL VIAJE · <span class="tm-badge tm-badge-${st}">${this.statusLabel(trip)}</span></div>
                        <h2>${TripManager.esc(trip.name)}</h2>
                        <div class="tm-detail-sub">📍 ${TripManager.esc(trip.destination)}</div>
                        <div class="tm-detail-meta">
                            <span>🗓️ ${TripManager.shortDate(trip.startDate)} → ${TripManager.shortDate(trip.endDate)}</span>
                            <span>⏳ ${st === 'realizado' ? 'Finalizado' : st === 'en-curso' ? '¡En curso!' : `Faltan ${days} días`}</span>
                            <span>🧮 ${totalDays} días de viaje</span>
                            <span>👥 ${TripManager.esc((trip.travelers || []).join(', '))}</span>
                        </div>
                        ${this._calHTML(trip)}
                        <div class="tm-detail-actions">
                            <button type="button" class="tm-btn tm-btn-primary tm-btn-sm" data-action="edit-trip">✏️ Editar datos generales</button>
                        </div>
                    </div>
                </div>

                <nav class="tm-subtabs" role="tablist">
                    <button type="button" class="tm-subtab ${dt === 'config' ? 'active' : ''}" data-action="detail-tab" data-tab="config">⚙️ Configuración y categorías</button>
                    <button type="button" class="tm-subtab ${dt === 'diario' ? 'active' : ''}" data-action="detail-tab" data-tab="diario">📅 Planificación diaria</button>
                    <button type="button" class="tm-subtab ${dt === 'actividades' ? 'active' : ''}" data-action="detail-tab" data-tab="actividades">🎯 Actividades</button>
                    <button type="button" class="tm-subtab ${dt === 'ahorro' ? 'active' : ''}" data-action="detail-tab" data-tab="ahorro">💶 Ahorro y financiación</button>
                </nav>

                ${sectionHTML}`;

            // restaurar desplazamientos de los carruseles
            this._applyScroll('day'); this._applyScroll('act');
        }

        _catAccordionHTML(trip) {
            return trip.categories.map(cat => {
                const catTotal = cat.items.reduce((s, i) => s + (i.total || 0), 0);
                const catPaid = cat.items.reduce((s, i) => s + i.payments.reduce((x, p) => x + p.amount, 0), 0);
                const key = trip.id + '|' + cat.id;
                const open = !!this.state.openCategories[key];
                const rows = cat.items.map(item => {
                    const itemPaid = item.payments.reduce((s, p) => s + p.amount, 0);
                    const fullyPaid = itemPaid >= (item.total || 0) - 0.005;
                    return `
                    <div class="tm-subcat-row">
                        <div class="tm-subcat-info">
                            <div class="tm-subcat-name">${TripManager.esc(item.subcategory)}</div>
                            <div class="tm-subcat-detail">${TripManager.esc(item.provider)} · ${TripManager.esc(item.city)}
                                ${item.dueDate ? '· 📅 vence ' + TripManager.shortDate(item.dueDate) : ''}</div>
                            <div class="tm-subcat-paid">${itemPaid > 0 ? 'Pagado ' + TripManager.fmt(itemPaid) + ' de ' + TripManager.fmt(item.total) : 'Sin pagos registrados'}</div>
                        </div>
                        <span class="tm-badge tm-badge-${fullyPaid ? 'pagado' : 'pendiente'}">${fullyPaid ? 'Pagado' : 'Pendiente'}</span>
                        <span class="tm-subcat-total">${TripManager.fmt(item.total)}</span>
                        <button type="button" class="tm-pay-arrow" title="Ver / registrar pagos parciales"
                                data-action="payments-modal" data-trip="${trip.id}" data-item="${item.id}">➔</button>
                    </div>`;
                }).join('');
                return `
                <div class="tm-acc-item ${open ? 'open' : ''}">
                    <button type="button" class="tm-acc-head" data-action="toggle-acc" data-key="${key}">
                        <span class="tm-acc-icon">${cat.icon}</span>
                        <span class="tm-acc-title">${TripManager.esc(cat.name)}</span>
                        <span class="tm-acc-sum">${TripManager.fmt(catPaid)} / ${TripManager.fmt(catTotal)}</span>
                        <span class="tm-acc-chev">▶</span>
                    </button>
                    <div class="tm-acc-body">${rows}</div>
                </div>`;
            }).join('');
        }

        /* Carrusel horizontal genérico (flechas ‹ ›) */
        _carouselHTML(kind, inner, hint) {
            return `
            <div class="tm-carousel" data-carousel="${kind}">
                <button type="button" class="tm-car-arrow left" data-action="car-prev" data-kind="${kind}" aria-label="Anterior">‹</button>
                <div class="tm-car-track" id="tm-track-${kind}">${inner}</div>
                <button type="button" class="tm-car-arrow right" data-action="car-next" data-kind="${kind}" aria-label="Siguiente">›</button>
            </div>${hint ? `<p class="tm-hint">${hint}</p>` : ''}`;
        }
        _daysCarouselInner(trip) {
            const cats = this._splitCategories(trip);
            return trip.days.map((day, di) => {
                const b = day.items.reduce((s, i) => s + (i.budgeted || 0), 0);
                const r = day.items.reduce((s, i) => s + (i.real || 0), 0);
                const rows = day.items.map((it, ii) => {
                    const over = (it.real || 0) > (it.budgeted || 0) && (it.real || 0) > 0;
                    const catColor = (cats.find(c => c.name === it.category) || {}).color || 'var(--tm-primary)';
                    return `
                    <div class="tm-dline ${over ? 'over' : ''}">
                        <span class="tm-dline-cat" style="--dot:${catColor}">${TripManager.esc(it.category || 'Otros')}</span>
                        <input class="tm-input tm-input-xs" type="number" min="0" step="1" inputmode="decimal"
                               value="${it.budgeted}" data-action="day-budgeted" data-day="${di}" data-item="${ii}" title="Presupuesto">
                        <input class="tm-input tm-input-xs ${over ? 'neg' : ''}" type="number" min="0" step="1" inputmode="decimal"
                               value="${it.real}" data-action="day-real" data-day="${di}" data-item="${ii}" title="Gasto real">
                        <button type="button" class="tm-del" data-action="del-expense" data-day="${di}" data-item="${ii}" title="Eliminar">✕</button>
                    </div>`;
                }).join('');
                return `
                <div class="tm-day-card tm-day-card-h">
                    <div class="tm-day-head">
                        <div class="tm-day-title">${TripManager.cap(TripManager.longDate(day.date))}<small>Día ${di + 1}/${trip.days.length}</small></div>
                        <div class="tm-day-remain ${b - r >= 0 ? 'pos' : 'neg'}">${TripManager.fmt(b - r)}</div>
                    </div>
                    <div class="tm-dline tm-dline-head"><span>Categoría</span><span>Presup.</span><span>Real</span><span></span></div>
                    ${rows || '<div class="tm-empty" style="padding:10px;">Sin líneas este día.</div>'}
                    <button type="button" class="tm-btn tm-btn-ghost tm-btn-sm" data-action="add-expense" data-day="${di}">＋ Añadir línea</button>
                </div>`;
            }).join('');
        }
        _activitiesCarouselInner(trip) {
            const byDay = {};
            trip.activities.forEach(a => { (byDay[a.day] = byDay[a.day] || []).push(a); });
            const days = Object.keys(byDay).sort();
            if (!days.length) return '<div class="tm-empty" style="padding:10px;">Sin actividades programadas.</div>';
            return days.map(day => {
                const rows = byDay[day].map(a => `
                    <div class="tm-act-row" data-action="activity-modal" data-trip="${trip.id}" data-activity="${a.id}" tabindex="0" role="button">
                        <span class="tm-act-time">${TripManager.esc(a.time.split('–')[0].trim())}</span>
                        <span class="tm-act-name">${TripManager.esc(a.title)}</span>
                        <span class="tm-act-cost">${TripManager.fmt(a.cost)}</span>
                        <span class="tm-badge tm-badge-${a.paid ? 'pagado' : 'pendiente'}">${a.paid ? 'Pagado' : 'Pendiente'}</span>
                    </div>`).join('');
                return `
                <div class="tm-day-card tm-day-card-h">
                    <div class="tm-day-head"><div class="tm-day-title">${TripManager.cap(TripManager.longDate(day))}</div></div>
                    <div class="tm-act-list">${rows}</div>
                </div>`;
            }).join('');
        }
        _applyScroll(kind) {
            const track = this.mount.querySelector('#tm-track-' + kind);
            if (track) track.scrollLeft = this.state[kind + 'Scroll'] || 0;
        }
        _carMove(kind, dir) {
            const track = this.mount.querySelector('#tm-track-' + kind);
            if (!track) return;
            const card = track.querySelector('.tm-day-card');
            const step = card ? card.offsetWidth + 16 : 300;
            this.state[kind + 'Scroll'] = Math.max(0, Math.min(track.scrollLeft + dir * step, track.scrollWidth - track.clientWidth));
            track.scrollTo({ left: this.state[kind + 'Scroll'], behavior: 'smooth' });
        }

        /* Ahorro y financiación PRIVATIZADA al viaje (rediseño) */
        _privateFundHTML(trip) {
            const planned = this.plannedOf(trip);
            const paid = this.paidOf(trip);
            const remaining = Math.max(planned - paid, 0);
            const saved = this.savedTotal();
            const coverage = remaining > 0 ? Math.min(Math.round(saved / remaining * 100), 999) : 100;
            const fundPct = remaining > 0 ? Math.min(Math.round(Math.min(saved, remaining) / remaining * 100), 100) : 100;
            const contribs = this.data.savings.contributions.slice().reverse().slice(0, 6).map(c => `
                <li><span>${TripManager.shortDate(c.date)} · ${TripManager.esc(c.note)} <span class="muted">(${TripManager.esc(c.payer)})</span></span>
                    <strong style="color:var(--tm-success)">+${TripManager.fmt(c.amount)}</strong></li>`).join('');
            return `
                <div class="tm-fund-grid">
                    <div class="tm-fund-card"><small>Planificado del viaje</small><strong>${TripManager.fmt(planned)}</strong></div>
                    <div class="tm-fund-card"><small>Ya pagado</small><strong style="color:var(--tm-success)">${TripManager.fmt(paid)}</strong></div>
                    <div class="tm-fund-card"><small>Restante por financiar</small><strong style="color:var(--tm-danger)">${TripManager.fmt(remaining)}</strong></div>
                    <div class="tm-fund-card"><small>Fondo de ahorro disponible</small><strong>${TripManager.fmt(saved)}</strong></div>
                </div>

                <div class="tm-panel" style="padding:16px 18px;">
                    <h3 style="font-size:13.5px;margin:0 0 4px;">Cobertura del fondo sobre «${TripManager.esc(trip.name)}»</h3>
                    <div class="tm-fund-bar"><div class="tm-fund-bar-fill" style="width:${fundPct}%"></div></div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--tm-text-secondary);">
                        <span>${coverage >= 100 ? '✅ El fondo cubre la totalidad del restante' : `El fondo cubre el ${coverage}% del restante`}</span>
                        <span>${TripManager.fmt(Math.min(saved, remaining))} / ${TripManager.fmt(remaining)}</span>
                    </div>
                    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
                        <button type="button" class="tm-btn tm-btn-primary tm-btn-sm" data-action="contribution-modal">＋ Registrar aportación al fondo</button>
                    </div>
                </div>

                <div class="tm-panel" style="padding:16px 18px;margin-top:14px;">
                    <h3 style="font-size:13.5px;margin:0 0 8px;">Últimas aportaciones</h3>
                    <ul class="tm-list">${contribs || '<li><span class="muted">Sin aportaciones todavía.</span></li>'}</ul>
                </div>`;
        }

        /* --------------------- Reglas y avisos del viaje --------------------- */
        RULE_CATALOG() {
            return [
                { id: 'vuelos',      icon: '✈️', label: 'Comprar los vuelos',              match: /transporte|vuelo/i },
                { id: 'hospedaje',   icon: '🏨', label: 'Reservar el hospedaje',           match: /hospedaje|hotel|alojamiento|accommodation/i },
                { id: 'actividades', icon: '🎟️', label: 'Reservar actividades y entradas', match: /actividad/i },
                { id: 'seguro',      icon: '🛡️', label: 'Contratar el seguro de viaje',    match: /seguro/i },
                { id: 'comida',      icon: '🍽️', label: 'Presupuestar la comida',          match: /comida/i },
                { id: 'otros',       icon: '🧳', label: 'Revisar otros gastos',            match: /otro/i }
            ];
        }
        _ensureRules() {
            if (!this.data.rules) this.data.rules = [];
            const catalog = this.RULE_CATALOG();
            catalog.forEach(def => {
                if (!this.data.rules.find(r => r.id === def.id)) {
                    this.data.rules.push({ id: def.id, enabled: true, days: 60 });
                }
            });
            // limpiar reglas fuera del catálogo
            this.data.rules = this.data.rules.filter(r => catalog.some(d => d.id === r.id));
        }
        /** Devuelve {def, rule, pending, dueDate|null} por regla aplicable a un viaje. */
        _ruleStatusForTrip(trip) {
            this._ensureRules();
            return this.RULE_CATALOG().map(def => {
                const rule = this.data.rules.find(r => r.id === def.id);
                const cats = trip.categories.filter(c => def.match.test(c.name));
                let pending = 0, dueDate = null;
                cats.forEach(c => c.items.forEach(i => {
                    const p = i.payments.reduce((s, pp) => s + pp.amount, 0);
                    const rest = (i.total || 0) - p;
                    if (rest > 0.005) {
                        pending += rest;
                        const dd = i.dueDate || trip.startDate;
                        if (!dueDate || dd < dueDate) dueDate = dd;
                    }
                }));
                return { def, rule, pending, dueDate };
            });
        }
        _rulesSectionHTML(trip, st) {
            const today = TripManager.iso(new Date());
            const statuses = this._ruleStatusForTrip(trip);
            const rows = statuses.map(({ def, rule, pending }) => {
                const dayOpts = [7, 14, 30, 45, 60, 90].map(d =>
                    `<option value="${d}" ${d === rule.days ? 'selected' : ''}>${d} días antes</option>`).join('');
                return `
                <div class="tm-rule-row">
                    <span class="tm-rule-icon">${def.icon}</span>
                    <div class="tm-rule-main">
                        <div class="tm-rule-label">${def.label}</div>
                        <div class="tm-rule-sub">Avisa si sigue sin cerrar el pago de esta categoría</div>
                    </div>
                    <select class="tm-select tm-select-sm tm-select-days" data-action="rule-days" data-rule="${def.id}" ${rule.enabled ? '' : 'disabled'} aria-label="Antelación del aviso">${dayOpts}</select>
                    <label class="tm-switch" title="${rule.enabled ? 'Regla activada' : 'Regla desactivada'}">
                        <input type="checkbox" data-action="rule-toggle" data-rule="${def.id}" ${rule.enabled ? 'checked' : ''}>
                        <span class="tm-switch-slider"></span>
                    </label>
                </div>`;
            }).join('');

            // Avisos activos para este viaje
            let alerts = '';
            if (st !== 'realizado') {
                const items = statuses.map(({ def, rule, pending, dueDate }) => {
                    if (!rule.enabled || pending <= 0.005 || !dueDate) return '';
                    const limit = TripManager.addDays(trip.startDate, -rule.days);
                    if (today > limit) {
                        return `<div class="tm-alert-item">⏰ <span><strong>${def.icon} ${def.label}:</strong> quedan pagos pendientes y ya deberías haberlo cerrado (fecha límite: ${TripManager.shortDate(limit)}).</span><strong style="color:var(--tm-danger)">${TripManager.fmt(pending)}</strong></div>`;
                    }
                    if (dueDate < today) {
                        return `<div class="tm-alert-item warn">📅 <span><strong>${def.icon} ${def.label}:</strong> vencimiento pasado con saldo pendiente.</span><strong style="color:var(--tm-warning, #f59e0b)">${TripManager.fmt(pending)}</strong></div>`;
                    }
                    return `<div class="tm-alert-item warn">🔔 <span><strong>${def.icon} ${def.label}:</strong> avisa el ${TripManager.shortDate(limit)} (${rule.days} días antes de la salida). Vence: ${TripManager.shortDate(dueDate)}.</span><strong>${TripManager.fmt(pending)}</strong></div>`;
                }).join('');
                alerts = items || '<div class="tm-rule-sub" style="margin-top:8px;">✅ Sin avisos: todo lo programado está en plazo o pagado.</div>';
            }

            return `
                <section class="tm-detail-section">
                    <h3>🔔 Reglas y avisos</h3>
                    <div class="tm-panel" style="padding:6px 18px 14px;">${rows}</div>
                    ${alerts ? `<div style="margin-top:14px;"><h3 style="font-size:13.5px;">Avisos para «${TripManager.esc(trip.name)}»</h3>${alerts}</div>` : ''}
                </section>`;
        }

        /* =========================================================
           TAB 3 · AHORRO Y FINANCIACIÓN (global)
           ========================================================= */
        _render_ahorro() {
            const view = this.mount.querySelector('#tm-view-ahorro');
            const saved = this.savedTotal();
            const goal = this.data.savings.goalTotal;
            const pct = goal ? Math.min(Math.round(saved / goal * 100), 100) : 0;
            const totalPlanned = this.trips.reduce((s, t) => s + this.spentPlannedOf(t), 0);
            const totalPaid = this.trips.reduce((s, t) => s + this.paidOf(t), 0);
            const dues = this.upcomingPayments();

            const contribs = [...this.data.savings.contributions].reverse().map(c => `
                <li><span>${TripManager.shortDate(c.date)} · ${TripManager.esc(c.note)} <span class="muted">(${TripManager.esc(c.payer)})</span></span>
                    <strong style="color:var(--tm-success)">+${TripManager.fmt(c.amount)}</strong></li>`).join('');

            const dueRows = dues.map(d => `
                <li><span>${TripManager.esc(d.item.subcategory)} <span class="muted">· ${TripManager.esc(d.trip.name)}</span></span>
                    <strong style="white-space:nowrap">${TripManager.fmt(d.pending)} <span class="muted">(${TripManager.shortDate(d.dueDate)})</span></strong></li>`).join('');

            view.innerHTML = `
                <div class="tm-panel tm-save-hero">
                    <div style="font-size:12px;text-transform:uppercase;letter-spacing:.6px;color:var(--tm-text-muted)">Fondo de ahorro conjunto</div>
                    <div class="tm-big">${TripManager.fmt(saved)} <span style="font-size:16px;color:var(--tm-text-muted)">/ ${TripManager.fmt(goal)}</span></div>
                    <div class="tm-save-bar"><div class="tm-save-bar-fill" style="width:${pct}%"></div></div>
                    <div style="font-size:12.5px;color:var(--tm-text-secondary)">${pct}% del objetivo alcanzado · faltan ${TripManager.fmt(Math.max(goal - saved, 0))}</div>
                    <div style="display:flex;gap:14px;justify-content:center;margin-top:16px;flex-wrap:wrap">
                        <button type="button" class="tm-btn tm-btn-primary" data-action="contribution-modal">＋ Registrar aportación</button>
                    </div>
                </div>
                <div class="tm-two-col">
                    <div class="tm-panel">
                        <h3>🏦 Financiación del conjunto de viajes</h3>
                        <ul class="tm-list">
                            <li><span>Total planificado (todos los viajes)</span><strong>${TripManager.fmt(totalPlanned)}</strong></li>
                            <li><span>Total ya pagado</span><strong style="color:var(--tm-success)">${TripManager.fmt(totalPaid)}</strong></li>
                            <li><span>Restante por financiar</span><strong style="color:var(--tm-danger)">${TripManager.fmt(Math.max(totalPlanned - totalPaid, 0))}</strong></li>
                            <li><span>Ahorro disponible</span><strong>${TripManager.fmt(saved)}</strong></li>
                            <li><span>Cobertura del ahorro sobre el restante</span>
                                <strong>${totalPlanned - totalPaid > 0 ? Math.round(Math.min(saved / (totalPlanned - totalPaid), 1) * 100) : 100}%</strong></li>
                        </ul>
                    </div>
                    <div class="tm-panel">
                        <h3>📆 Próximos vencimientos de pago</h3>
                        <ul class="tm-list">${dueRows || '<li><span class="muted">No hay vencimientos programados.</span></li>'}</ul>
                    </div>
                </div>
                <div class="tm-panel" style="margin-top:18px;">
                    <h3>💰 Historial de aportaciones</h3>
                    <ul class="tm-list">${contribs}</ul>
                </div>`;
        }

        /* =========================================================================
           4. MODALES EMERGENTES
           ========================================================================= */
        openModal(title, subtitle, bodyHTML) {
            const overlay = this.mount.querySelector('#tm-modal-overlay');
            this.mount.querySelector('#tm-modal-inner').innerHTML = `
                <div class="tm-modal-head">
                    <div><h3>${title}</h3><p>${subtitle || ''}</p></div>
                    <button type="button" class="tm-modal-close" data-action="close-modal" aria-label="Cerrar">×</button>
                </div>
                <div class="tm-modal-body">${bodyHTML}</div>`;
            overlay.classList.add('active');
            overlay.setAttribute('aria-hidden', 'false');
        }
        closeModal() {
            const overlay = this.mount && this.mount.querySelector('#tm-modal-overlay');
            if (overlay) { overlay.classList.remove('active'); overlay.setAttribute('aria-hidden', 'true'); }
        }

        findItem(tripId, itemId) {
            const trip = this.trips.find(t => t.id === tripId);
            if (!trip) return null;
            for (const cat of trip.categories) {
                const item = cat.items.find(i => i.id === itemId);
                if (item) return { trip, cat, item };
            }
            return null;
        }

        /** Modal de pagos parciales de una subcategoría. */
        openPaymentsModal(tripId, itemId) {
            const found = this.findItem(tripId, itemId);
            if (!found) return;
            const { trip, item } = found;
            const paid = item.payments.reduce((s, p) => s + p.amount, 0);
            const pending = (item.total || 0) - paid;

            const history = item.payments.length
                ? item.payments.map(p => `
                    <li>
                        <span>${TripManager.shortDate(p.date)} · ${TripManager.esc(p.payer)} <span class="muted">(${TripManager.esc(p.method)})</span></span>
                        <strong style="color:var(--tm-success)">${TripManager.fmt(p.amount)}</strong>
                    </li>`).join('')
                : '<li><span class="muted">Aún no hay pagos registrados para este concepto.</span></li>';

            const methods = ['Tarjeta de crédito', 'Tarjeta de débito', 'Bizum', 'Transferencia', 'Efectivo', 'PayPal'];
            const payers = [...new Set(trip.travelers.concat(['Ambos']))];

            this.openModal(
                '💳 Pagos parciales',
                `${TripManager.esc(item.subcategory)} — ${TripManager.esc(trip.name)}`,
                `
                <div class="tm-kv">
                    <dt>Total contratado</dt><dd>${TripManager.fmt(item.total)}</dd>
                    <dt>Acumulado pagado</dt><dd style="color:var(--tm-success)">${TripManager.fmt(paid)}</dd>
                    <dt>Pendiente</dt><dd style="color:${pending > 0 ? 'var(--tm-danger)' : 'var(--tm-success)'}">${TripManager.fmt(Math.max(pending, 0))}</dd>
                </div>
                <div class="tm-panel" style="padding:12px 14px;margin-bottom:16px;background:rgba(148,163,184,.06)">
                    <h3 style="font-size:13px;margin-bottom:8px;">Historial de movimientos</h3>
                    <ul class="tm-list" style="font-size:12.5px;">${history}</ul>
                </div>
                <form id="tm-new-payment-form" autocomplete="off">
                    <h3 style="font-size:13px;margin:0 0 10px;">Registrar nuevo pago parcial</h3>
                    <div class="tm-form-grid">
                        <div class="tm-field"><label for="np-amount">Importe (€)</label>
                            <input class="tm-input" id="np-amount" type="number" min="0.01" step="0.01" required placeholder="${pending > 0 ? Math.min(pending, 100).toFixed(2) : '50.00'}"
                                   value="${pending > 0 ? pending.toFixed(2) : ''}"></div>
                        <div class="tm-field"><label for="np-date">Fecha</label>
                            <input class="tm-input" id="np-date" type="date" required value="${this.today}"></div>
                        <div class="tm-field"><label for="np-payer">Pagador/a</label>
                            <select class="tm-input" id="np-payer">${payers.map(p => `<option>${p}</option>`).join('')}</select></div>
                        <div class="tm-field"><label for="np-method">Método</label>
                            <select class="tm-input" id="np-method">${methods.map(m => `<option>${m}</option>`).join('')}</select></div>
                    </div>
                    <input type="hidden" name="trip" value="${tripId}">
                    <input type="hidden" name="item" value="${itemId}">
                    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px;">
                        <button type="button" class="tm-btn tm-btn-ghost" data-action="close-modal">Cancelar</button>
                        <button type="submit" class="tm-btn tm-btn-primary">✔ Guardar pago</button>
                    </div>
                </form>`);

            this.mount.querySelector('#tm-new-payment-form')
                .addEventListener('submit', (e) => { e.preventDefault(); this._submitPayment(e.target); });
        }

        _submitPayment(form) {
            const tripId = form.elements.trip.value;
            const itemId = form.elements.item.value;
            const amount = parseFloat(form.elements['np-amount'].value);
            const date = form.elements['np-date'].value;
            const payer = form.elements['np-payer'].value;
            const method = form.elements['np-method'].value;
            if (!(amount > 0) || !date) return;

            const found = this.findItem(tripId, itemId);
            if (!found) return;
            found.item.payments.push({ id: TripManager.uid('pay'), amount, date, payer, method });
            this.closeModal();
            this.render();                       // totales acumulados y Dashboard al instante
            this._toast(`Pago de ${TripManager.fmt(amount)} registrado en «${found.item.subcategory}»`);
            if (this.onChange) this.onChange(found.trip);
        }

        /** Modal de detalle de actividad. */
        openActivityModal(tripId, actId) {
            const trip = this.trips.find(t => t.id === tripId);
            const act = trip && trip.activities.find(a => a.id === actId);
            if (!act) return;
            this.openModal(
                `${act.paid ? '✅' : '🕐'} ${TripManager.esc(act.title)}`,
                `${TripManager.cap(TripManager.longDate(act.day))} — ${TripManager.esc(trip.name)}`,
                `
                <dl class="tm-kv">
                    <dt>🕒 Horario</dt><dd>${TripManager.esc(act.time)}</dd>
                    <dt>📍 Ubicación</dt><dd>${TripManager.esc(act.location)}</dd>
                    <dt>💶 Costo vinculado</dt><dd>${TripManager.fmt(act.cost)}</dd>
                    <dt>👤 Asumido por</dt><dd>${TripManager.esc(act.payer)}</dd>
                    <dt>Estado</dt><dd><span class="tm-badge tm-badge-${act.paid ? 'pagado' : 'pendiente'}">${act.paid ? 'Pagado' : 'Pendiente'}</span></dd>
                </dl>
                <div class="tm-panel" style="padding:12px 14px;background:rgba(148,163,184,.06)">
                    <h3 style="font-size:13px;margin-bottom:6px;">📝 Notas</h3>
                    <p style="margin:0;font-size:13px;color:var(--tm-text-secondary);">${TripManager.esc(act.notes)}</p>
                </div>
                <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">
                    <button type="button" class="tm-btn tm-btn-ghost" data-action="close-modal">Cerrar</button>
                    <button type="button" class="tm-btn tm-btn-primary" data-action="toggle-activity-paid" data-trip="${tripId}" data-activity="${act.id}">
                        ${act.paid ? 'Marcar como pendiente' : 'Marcar como pagada'}
                    </button>
                </div>`);
        }

        /** Modal de edición de datos generales del viaje activo. */
        openEditTripModal() {
            const trip = this.selectedTrip;
            if (!trip) return;
            this.openModal(
                '✏️ Editar datos generales',
                TripManager.esc(trip.name),
                `
                <form id="tm-edit-trip-form" autocomplete="off">
                    <div class="tm-form-grid">
                        <div class="tm-field full"><label for="et-name">Nombre del viaje</label>
                            <input class="tm-input" id="et-name" required value="${TripManager.esc(trip.name)}"></div>
                        <div class="tm-field full"><label for="et-dest">Destino</label>
                            <input class="tm-input" id="et-dest" required value="${TripManager.esc(trip.destination)}"></div>
                        <div class="tm-field"><label for="et-start">Fecha de salida</label>
                            <input class="tm-input" id="et-start" type="date" required value="${trip.startDate}"></div>
                        <div class="tm-field"><label for="et-end">Fecha de regreso</label>
                            <input class="tm-input" id="et-end" type="date" required value="${trip.endDate}"></div>
                        <div class="tm-field"><label for="et-budget">Presupuesto límite (€)</label>
                            <input class="tm-input" id="et-budget" type="number" min="0" step="10" required value="${trip.budgetLimit}"></div>
                        <div class="tm-field"><label for="et-img">URL imagen (Unsplash)</label>
                            <input class="tm-input" id="et-img" type="url" value="${TripManager.esc(trip.image)}"></div>
                        <div class="tm-field full"><label for="et-notes">Notas</label>
                            <textarea class="tm-input" id="et-notes" rows="3">${TripManager.esc(trip.notes || '')}</textarea></div>
                    </div>
                    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px;">
                        <button type="button" class="tm-btn tm-btn-ghost" data-action="close-modal">Cancelar</button>
                        <button type="submit" class="tm-btn tm-btn-primary">💾 Guardar cambios</button>
                    </div>
                </form>`);
            this.mount.querySelector('#tm-edit-trip-form')
                .addEventListener('submit', (e) => { e.preventDefault(); this._submitEditTrip(e.target); });
        }

        _submitEditTrip(form) {
            const trip = this.selectedTrip;
            if (!trip) return;
            const start = form.elements['et-start'].value;
            const end = form.elements['et-end'].value;
            if (end < start) { this._toast('El regreso no puede ser anterior a la salida', 'error'); return; }
            trip.name = form.elements['et-name'].value.trim() || trip.name;
            trip.destination = form.elements['et-dest'].value.trim() || trip.destination;
            trip.startDate = start;
            trip.endDate = end;
            trip.budgetLimit = Math.max(parseFloat(form.elements['et-budget'].value) || 0, 0);
            trip.image = form.elements['et-img'].value.trim() || trip.image;
            trip.notes = form.elements['et-notes'].value;
            this.closeModal();
            this.render();
            this._toast('Viaje actualizado correctamente');
            if (this.onChange) this.onChange(trip);
        }

        /** Modal para registrar una aportación al fondo de ahorro. */
        openContributionModal() {
            const payers = ['Ana', 'Luis', 'Ambos'];
            this.openModal('💶 Nueva aportación al fondo', 'Fondo de ahorro conjunto de viajes', `
                <form id="tm-contribution-form" autocomplete="off">
                    <div class="tm-form-grid">
                        <div class="tm-field"><label for="nc-amount">Importe (€)</label>
                            <input class="tm-input" id="nc-amount" type="number" min="0.01" step="0.01" required placeholder="200.00"></div>
                        <div class="tm-field"><label for="nc-date">Fecha</label>
                            <input class="tm-input" id="nc-date" type="date" required value="${this.today}"></div>
                        <div class="tm-field"><label for="nc-payer">Quién aporta</label>
                            <select class="tm-input" id="nc-payer">${payers.map(p => `<option>${p}</option>`).join('')}</select></div>
                        <div class="tm-field"><label for="nc-note">Concepto</label>
                            <input class="tm-input" id="nc-note" placeholder="Aportación mensual" required></div>
                    </div>
                    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px;">
                        <button type="button" class="tm-btn tm-btn-ghost" data-action="close-modal">Cancelar</button>
                        <button type="submit" class="tm-btn tm-btn-primary">✔ Registrar aportación</button>
                    </div>
                </form>`);
            this.mount.querySelector('#tm-contribution-form')
                .addEventListener('submit', (e) => {
                    e.preventDefault();
                    const f = e.target;
                    const amount = parseFloat(f.elements['nc-amount'].value);
                    if (!(amount > 0)) return;
                    this.data.savings.contributions.push({
                        id: TripManager.uid('sc'),
                        amount,
                        date: f.elements['nc-date'].value,
                        payer: f.elements['nc-payer'].value,
                        note: f.elements['nc-note'].value.trim() || 'Aportación'
                    });
                    this.closeModal();
                    this.render();
                    this._toast(`Aportación de ${TripManager.fmt(amount)} sumada al fondo`);
                });
        }

        /* =========================================================================
           5. MANEJO DE EVENTOS (delegación)
           ========================================================================= */
        _onClick(e) {
            const tabBtn = e.target.closest('.tm-tab');
            if (tabBtn) { this.switchTab(tabBtn.dataset.tab); return; }

            const el = e.target.closest('[data-action]');
            if (!el) return;
            const action = el.dataset.action;

            switch (action) {
                case 'open-trip':
                    this.openTripDetail(el.dataset.trip);
                    break;
                case 'back-btn':
                case 'exit-trip':
                    this.closeTripDetail();
                    break;
                case 'status-filter':
                    this.state.statusFilter = el.dataset.val;
                    this.render();
                    break;
                case 'month-filter':
                    break; // se gestiona en _onChange (evento change)
                case 'car-prev':
                    this._carMove(el.dataset.kind, -1);
                    break;
                case 'car-next':
                    this._carMove(el.dataset.kind, +1);
                    break;
                case 'edit-trip':
                    this.openEditTripModal();
                    break;
                case 'toggle-acc': {
                    const key = el.dataset.key;
                    this.state.openCategories[key] = !this.state.openCategories[key];
                    // Alternar la clase sobre el DOM existente: mantiene vivo el
                    // botón pulsado y no rompe la delegación de eventos.
                    el.closest('.tm-acc-item').classList.toggle('open', this.state.openCategories[key]);
                    break;
                }
                case 'payments-modal':
                    this.openPaymentsModal(el.dataset.trip, el.dataset.item);
                    break;
                case 'activity-modal':
                    this.openActivityModal(el.dataset.trip, el.dataset.activity);
                    break;
                case 'toggle-activity-paid': {
                    const trip = this.trips.find(t => t.id === el.dataset.trip);
                    const act = trip && trip.activities.find(a => a.id === el.dataset.activity);
                    if (act) {
                        act.paid = !act.paid;
                        this.closeModal();
                        this.render();
                        this._toast(`«${act.title}» marcada como ${act.paid ? 'pagada' : 'pendiente'}`);
                    }
                    break;
                }
                case 'contribution-modal':
                    this.openContributionModal();
                    break;
                case 'add-expense': {
                    const trip = this.selectedTrip;
                    if (trip) {
                        trip.days[+el.dataset.day].items.push({ category: 'Otros', budgeted: 0, real: 0 });
                        this._render_detail();
                        const inputs = this.mount.querySelectorAll(`#tm-view-detail [data-day="${el.dataset.day}"][data-action="day-budgeted"]`);
                        const last = inputs[inputs.length - 1];
                        if (last) { last.focus(); last.select(); }
                    }
                    break;
                }
                case 'del-expense': {
                    const trip = this.selectedTrip;
                    if (trip) {
                        trip.days[+el.dataset.day].items.splice(+el.dataset.item, 1);
                        this._render_detail();
                    }
                    break;
                }
                case 'close-modal':
                    this.closeModal();
                    break;
            }
        }

        /** Edición en tiempo real de los inputs de la planificación diaria. */
        _onInput(e) {
            const el = e.target;
            if (!el.dataset || !el.dataset.action) return;
            if (el.dataset.action !== 'day-budgeted' && el.dataset.action !== 'day-real') return;

            const trip = this.selectedTrip;
            if (!trip) return;
            const day = trip.days[+el.dataset.day];
            const item = day && day.items[+el.dataset.item];
            if (!item) return;

            const val = Math.max(parseFloat(el.value) || 0, 0);
            if (el.dataset.action === 'day-budgeted') item.budgeted = val;
            else item.real = val;

            // Recalculo instantáneo del remanente del día y del saldo global,
            // sin re-render completo (se preserva el foco del input).
            const card = el.closest('.tm-day-card');
            if (card) {
                const b = day.items.reduce((s, i) => s + (i.budgeted || 0), 0);
                const r = day.items.reduce((s, i) => s + (i.real || 0), 0);
                const remainEl = card.querySelector('.tm-day-remain');
                if (remainEl) {
                    remainEl.textContent = TripManager.fmt(b - r);
                    remainEl.className = 'tm-day-remain ' + (b - r >= 0 ? 'pos' : 'neg');
                }
                // Marca la línea en rojo si el real supera al presupuesto
                const line = el.closest('.tm-dline');
                if (line && el.dataset.action === 'day-real') {
                    line.classList.toggle('over', r > 0 && (item.real || 0) > (item.budgeted || 0));
                    el.classList.toggle('neg', (item.real || 0) > (item.budgeted || 0));
                }
            }
            // Métricas superiores del detalle (Gastado/Planif. y Pendiente)
            const plannedEl = this.mount.querySelector('#tm-detail-planned');
            const pendingEl = this.mount.querySelector('#tm-detail-pending');
            if (plannedEl) plannedEl.textContent = TripManager.fmt(this.spentPlannedOf(trip));
            if (pendingEl) {
                const pend = Math.max(this.spentPlannedOf(trip) - this.paidOf(trip), 0);
                pendingEl.textContent = TripManager.fmt(pend);
            }
        }

        _onChange(e) {
            const el = e.target;
            if (el.dataset && el.dataset.action === 'month-filter') {
                this.state.monthFilter = el.value || '';
                this.render();
                return;
            }
            if (el.dataset && el.dataset.action === 'rule-days') {
                this._ensureRules();
                const r = this.data.rules.find(x => x.id === el.dataset.rule);
                if (r) { r.days = parseInt(el.value, 10) || 0; this._notifyChange(); }
                return;
            }
            if (el.dataset && el.dataset.action === 'rule-toggle') {
                this._ensureRules();
                const r = this.data.rules.find(x => x.id === el.dataset.rule);
                if (r) {
                    r.enabled = !!el.checked;
                    this._notifyChange();
                    // Refresca los avisos sin re-render completo
                    if (this.state.activeTab === 'detail' && this.state.detailTab === 'config') this._render_detail();
                }
                return;
            }
            if (el.dataset && el.dataset.action === 'cat-select') {
                const trip = this.selectedTrip;
                if (!trip) return;
                const day = trip.days[+el.dataset.day];
                const item = day && day.items[+el.dataset.item];
                if (item) {
                    item.category = el.value;
                    const line = el.closest('.tm-dline');
                    const catEl = line && line.querySelector('.tm-dline-cat');
                    if (catEl) {
                        const c = this._splitCategories(trip).find(cc => cc.name === el.value);
                        catEl.textContent = c ? c.icon : el.value;
                        catEl.style.setProperty('--dot', c ? c.color : 'var(--tm-primary)');
                        catEl.title = el.value;
                    }
                }
            }
        }

        /* --------------------- Toast ligero --------------------- */
        _toast(msg, type = 'success') {
            // Reutiliza el toast global de App si existe; si no, uno propio.
            if (window.App && typeof window.App.showToast === 'function') {
                window.App.showToast(msg, type === 'error' ? 'warning' : 'success');
                return;
            }
            let host = document.getElementById('tm-toasts');
            if (!host) {
                host = document.createElement('div');
                host.id = 'tm-toasts';
                host.style.cssText = 'position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;gap:8px;z-index:1200;';
                document.body.appendChild(host);
            }
            const t = document.createElement('div');
            t.textContent = msg;
            t.style.cssText = 'background:#0f172a;color:#f8fafc;padding:10px 16px;border-radius:10px;font-size:13px;' +
                'box-shadow:0 8px 20px rgba(0,0,0,.25);opacity:0;transition:opacity .25s;max-width:320px;';
            host.appendChild(t);
            requestAnimationFrame(() => { t.style.opacity = '1'; });
            setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3200);
        }
    }

    /* =========================================================================
       6. EXPORTACIÓN GLOBAL
       ========================================================================= */
    window.TripManager = TripManager;
    window.TripManagerMockData = mockData;
})();
