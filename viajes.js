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
        }
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
                selectedTripId: null,     // null → vista global (Resumen General)
                openCategories: {},       // { tripId|categoryId: true } estado acordeón
                expandedDays: {}
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
                <header class="tm-header">
                    <div class="tm-title-group">
                        <h2>🧭 Planificador de Viajes</h2>
                        <p>Presupuestos, pagos parciales, itinerarios y ahorro — todo en un mismo sitio.</p>
                    </div>
                    <div class="tm-controls">
                        <label for="tm-trip-select" class="tm-visually-hidden" style="position:absolute;left:-9999px;">Viaje activo</label>
                        <select id="tm-trip-select" class="tm-select" aria-label="Selector global de viaje activo"></select>
                        <button type="button" class="tm-btn tm-btn-ghost" id="tm-exit-trip" hidden>↩ Ver todos</button>
                    </div>
                </header>
                <nav class="tm-tabs" role="tablist">
                    <button class="tm-tab" data-tab="resumen" role="tab">📊 Resumen General</button>
                    <button class="tm-tab" data-tab="categorias" role="tab">🗂️ Detalle y Categorías</button>
                    <button class="tm-tab" data-tab="diario" role="tab">📅 Planificación Diaria</button>
                    <button class="tm-tab" data-tab="actividades" role="tab">🎯 Actividades</button>
                    <button class="tm-tab" data-tab="ahorro" role="tab">💶 Ahorro y Financiación</button>
                </nav>
                <section id="tm-inside-slot"></section>
                <div id="tm-view-resumen"     class="tm-view" role="tabpanel"></div>
                <div id="tm-view-categorias"  class="tm-view" role="tabpanel"></div>
                <div id="tm-view-diario"      class="tm-view" role="tabpanel"></div>
                <div id="tm-view-actividades" class="tm-view" role="tabpanel"></div>
                <div id="tm-view-ahorro"      class="tm-view" role="tabpanel"></div>
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
            this._renderInsideBanner();
            this['_render_' + this.state.activeTab]();
        }

        _renderHeader() {
            const sel = this.mount.querySelector('#tm-trip-select');
            const opts = ['<option value="">🌍 Todos los viajes</option>']
                .concat(this.trips.map(t =>
                    `<option value="${t.id}" ${t.id === this.state.selectedTripId ? 'selected' : ''}>${TripManager.esc(t.name)}</option>`));
            sel.innerHTML = opts.join('');
            const exitBtn = this.mount.querySelector('#tm-exit-trip');
            exitBtn.hidden = !this.state.selectedTripId;
        }

        _renderTabs() {
            this.mount.querySelectorAll('.tm-tab').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === this.state.activeTab);
            });
            this.mount.querySelectorAll('.tm-view').forEach(v => {
                v.classList.toggle('active', v.id === 'tm-view-' + this.state.activeTab);
            });
        }

        _renderInsideBanner() {
            const slot = this.mount.querySelector('#tm-inside-slot');
            const trip = this.selectedTrip;
            if (!trip) { slot.innerHTML = ''; return; }
            const st = this.statusOf(trip);
            slot.innerHTML = `
                <div class="tm-inside-banner">
                    <span>✈️</span>
                    <strong>Estás dentro de «${TripManager.esc(trip.name)}»</strong>
                    <span class="tm-badge tm-badge-${st}">${this.statusLabel(trip)}</span>
                    <span style="flex:1"></span>
                    <button type="button" class="tm-btn tm-btn-primary tm-btn-sm" data-action="edit-trip">✏️ Editar datos generales</button>
                    <button type="button" class="tm-btn tm-btn-ghost tm-btn-sm" data-action="exit-trip">Ver todos los viajes</button>
                </div>`;
        }

        /* =========================================================
           TAB 1 · RESUMEN GENERAL
           ========================================================= */
        _render_resumen() {
            const view = this.mount.querySelector('#tm-view-resumen');
            const trips = this.visibleTrips;

            const cards = trips.map(t => this._tripCardHTML(t)).join('');
            const chartTrip = trips[0]; // si hay selección, su gráfica; si no, la del primer viaje próximo
            const pieTrip = this.selectedTrip || chartTrip;

            view.innerHTML = `
                <div class="tm-trips-grid">${cards || '<div class="tm-empty">No hay viajes para mostrar.</div>'}</div>
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
           TAB 2 · DETALLE Y CATEGORÍAS (acordeón + pagos parciales)
           ========================================================= */
        _render_categorias() {
            const view = this.mount.querySelector('#tm-view-categorias');
            const trips = this.visibleTrips;

            view.innerHTML = trips.map(trip => {
                const planned = this.plannedOf(trip);
                const paid = this.paidOf(trip);
                const sections = trip.categories.map(cat => {
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

                const pct = planned ? Math.round(paid / planned * 100) : 0;
                return `
                <section style="margin-bottom:26px;">
                    <div class="tm-balance-banner">
                        <div class="tm-balance-item"><small>Viaje</small><strong>${TripManager.esc(trip.name)}</strong></div>
                        <div class="tm-balance-item"><small>Planificado</small><strong>${TripManager.fmt(planned)}</strong></div>
                        <div class="tm-balance-item"><small>Pagado</small><strong style="color:var(--tm-success)">${TripManager.fmt(paid)}</strong></div>
                        <div class="tm-balance-item"><small>Pendiente</small><strong style="color:var(--tm-danger)">${TripManager.fmt(planned - paid)}</strong></div>
                        <div style="flex:1;min-width:200px;">
                            <div class="tm-progress-track"><div class="tm-progress-fill" style="width:${pct}%"></div></div>
                            <div class="tm-progress-label"><span>${pct}% abonado</span><span>${TripManager.fmt(planned - paid)} pendientes</span></div>
                        </div>
                    </div>
                    <div class="tm-accordion">${sections}</div>
                </section>`;
            }).join('') || '<div class="tm-empty">Selecciona un viaje para ver su desglose.</div>';
        }

        /* =========================================================
           TAB 3 · PLANIFICACIÓN DIARIA
           ========================================================= */
        _render_diario() {
            const view = this.mount.querySelector('#tm-view-diario');
            const trip = this.selectedTrip || this.trips.find(t => this.statusOf(t) !== 'realizado') || this.trips[0];
            if (!trip) { view.innerHTML = '<div class="tm-empty">No hay viajes.</div>'; return; }

            const globalBudget = this.spentPlannedOf(trip);
            const globalLimit = trip.budgetLimit;
            const globalBalance = globalLimit - globalBudget;

            const cards = trip.days.map((day, di) => {
                const b = day.items.reduce((s, i) => s + (i.budgeted || 0), 0);
                const r = day.items.reduce((s, i) => s + (i.real || 0), 0);
                const remain = b - r;
                const rows = day.items.map((it, ii) => `
                    <div class="tm-expense-row">
                        <span class="tm-expense-concept">${TripManager.esc(it.concept)}</span>
                        <input class="tm-input" type="number" min="0" step="1" inputmode="decimal"
                               value="${it.budgeted}" data-action="day-budgeted" data-day="${di}" data-item="${ii}"
                               title="Presupuestado">
                        <input class="tm-input" type="number" min="0" step="1" inputmode="decimal"
                               value="${it.real}" data-action="day-real" data-day="${di}" data-item="${ii}"
                               title="Gasto real">
                        <button type="button" class="tm-del" data-action="del-expense" data-day="${di}" data-item="${ii}" title="Eliminar">✕</button>
                    </div>`).join('');
                return `
                <div class="tm-day-card">
                    <div class="tm-day-head">
                        <div class="tm-day-title">${TripManager.cap(TripManager.longDate(day.date))}
                            <small>Día ${di + 1} de ${trip.days.length}</small></div>
                        <div class="tm-day-remain ${remain >= 0 ? 'pos' : 'neg'}">
                            Remanente: ${TripManager.fmt(remain)}
                        </div>
                    </div>
                    ${rows || '<div class="tm-empty" style="padding:12px;">Sin gastos diarios este día.</div>'}
                    <div class="tm-day-foot">
                        <button type="button" class="tm-btn tm-btn-ghost tm-btn-sm" data-action="add-expense" data-day="${di}">＋ Añadir gasto del día</button>
                        <span style="font-size:12px;color:var(--tm-text-muted)">Presupuestado ${TripManager.fmt(b)} · Real ${TripManager.fmt(r)}</span>
                    </div>
                </div>`;
            }).join('');

            view.innerHTML = `
                <div class="tm-balance-banner">
                    <div class="tm-balance-item"><small>Vista diaria de</small><strong>${TripManager.esc(trip.name)}</strong></div>
                    <div class="tm-balance-item"><small>Saldo global del viaje</small>
                        <strong style="color:${globalBalance >= 0 ? 'var(--tm-success)' : 'var(--tm-danger)'}">${TripManager.fmt(globalBalance)}</strong></div>
                    <div class="tm-balance-item"><small>Límite</small><strong>${TripManager.fmt(globalLimit)}</strong></div>
                    <div class="tm-balance-item"><small>Comprometido</small><strong>${TripManager.fmt(globalBudget)}</strong></div>
                    <span style="flex:1"></span>
                    <select class="tm-select" data-action="switch-diary-trip" aria-label="Cambiar viaje de la planificación diaria">
                        ${this.trips.map(t => `<option value="${t.id}" ${t.id === trip.id ? 'selected' : ''}>${TripManager.esc(t.name)}</option>`).join('')}
                    </select>
                </div>
                <p style="font-size:12px;color:var(--tm-text-muted);margin:-8px 0 14px;">
                    💡 Los gastos diarios son ajustes menores: aquí <strong>no</strong> se incluyen los grandes pagos fijos
                    (vuelos, hoteles…) ya cubiertos en «Detalle y Categorías». Edita las cifras y el saldo se recalcula al instante.
                </p>
                <div class="tm-days-grid">${cards}</div>`;
        }

        /* =========================================================
           TAB 4 · ACTIVIDADES
           ========================================================= */
        _render_actividades() {
            const view = this.mount.querySelector('#tm-view-actividades');
            const trips = this.visibleTrips;

            view.innerHTML = trips.map(trip => {
                const byDay = {};
                trip.activities.forEach(a => { (byDay[a.day] = byDay[a.day] || []).push(a); });
                const days = Object.keys(byDay).sort();
                const blocks = days.map(day => {
                    const rows = byDay[day].map(a => `
                        <div class="tm-act-row" data-action="activity-modal" data-trip="${trip.id}" data-activity="${a.id}" tabindex="0" role="button">
                            <span class="tm-act-time">${TripManager.esc(a.time.split('–')[0].trim())}</span>
                            <span class="tm-act-name">${TripManager.esc(a.title)}</span>
                            <span class="tm-act-cost">${TripManager.fmt(a.cost)}</span>
                            <span class="tm-badge tm-badge-${a.paid ? 'pagado' : 'pendiente'}">${a.paid ? 'Pagado' : 'Pendiente'}</span>
                        </div>`).join('');
                    return `
                    <div class="tm-act-card">
                        <div class="tm-day-title">${TripManager.cap(TripManager.longDate(day))}<small>${TripManager.esc(trip.name)}</small></div>
                        <div class="tm-act-list">${rows}</div>
                    </div>`;
                }).join('');
                return `<div class="tm-days-grid">${blocks || '<div class="tm-empty">Sin actividades programadas.</div>'}</div>`;
            }).join('') || '<div class="tm-empty">No hay viajes.</div>';
        }

        /* =========================================================
           TAB 5 · AHORRO Y FINANCIACIÓN
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
                    this.selectTrip(el.dataset.trip);
                    this.switchTab('resumen');
                    break;
                case 'exit-trip':
                    this.selectTrip(null);
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
                    const trip = this._currentDiaryTrip();
                    if (trip) {
                        trip.days[+el.dataset.day].items.push({ concept: 'Nuevo gasto', budgeted: 0, real: 0 });
                        this._render_diario();
                        const inputs = this.mount.querySelectorAll(`#tm-view-diario [data-day="${el.dataset.day}"][data-action="day-budgeted"]`);
                        const last = inputs[inputs.length - 1];
                        if (last) { last.focus(); last.select(); }
                    }
                    break;
                }
                case 'del-expense': {
                    const trip = this._currentDiaryTrip();
                    if (trip) {
                        trip.days[+el.dataset.day].items.splice(+el.dataset.item, 1);
                        this._render_diario();
                    }
                    break;
                }
                case 'close-modal':
                    this.closeModal();
                    break;
            }
        }

        _currentDiaryTrip() {
            const sel = this.mount.querySelector('[data-action="switch-diary-trip"]');
            const id = sel ? sel.value : null;
            return this.trips.find(t => t.id === id) || this.selectedTrip || null;
        }

        /** Edición en tiempo real de los inputs de la planificación diaria. */
        _onInput(e) {
            const el = e.target;
            if (!el.dataset || !el.dataset.action) return;
            if (el.dataset.action !== 'day-budgeted' && el.dataset.action !== 'day-real') return;

            const trip = this._currentDiaryTrip();
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
                    remainEl.textContent = 'Remanente: ' + TripManager.fmt(b - r);
                    remainEl.className = 'tm-day-remain ' + (b - r >= 0 ? 'pos' : 'neg');
                }
                const foot = card.querySelector('.tm-day-foot span');
                if (foot) foot.textContent = `Presupuestado ${TripManager.fmt(b)} · Real ${TripManager.fmt(r)}`;
            }
            const globalBudget = this.spentPlannedOf(trip);
            const balanceEl = this.mount.querySelector('#tm-view-diario .tm-balance-item strong[style*="tm-success"], #tm-view-diario .tm-balance-item strong[style*="tm-danger"]');
            if (balanceEl) {
                const bal = trip.budgetLimit - globalBudget;
                balanceEl.textContent = TripManager.fmt(bal);
                balanceEl.style.color = bal >= 0 ? 'var(--tm-success)' : 'var(--tm-danger)';
            }
        }

        _onChange(e) {
            const el = e.target;
            if (el.id === 'tm-trip-select') {
                this.selectTrip(el.value || null);
                return;
            }
            if (el.dataset && el.dataset.action === 'switch-diary-trip') {
                const trip = this.trips.find(t => t.id === el.value);
                if (trip) { this.state.selectedTripId = trip.id; this.render(); }
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
