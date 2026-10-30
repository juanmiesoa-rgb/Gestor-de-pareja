(function() {
    'use strict';

    function injectStyles() {
        if (document.getElementById('inicio-styles')) return;
        const style = document.createElement('style');
        style.id = 'inicio-styles';
        style.textContent = `
            .inicio-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
            @media (max-width: 1024px) { .inicio-stats { grid-template-columns: repeat(2, 1fr); } }
            @media (max-width: 768px) { .inicio-stats { grid-template-columns: 1fr; } }

            .inicio-stat {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 18px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .inicio-stat:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
            .inicio-stat-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
            .inicio-stat-icon {
                width: 36px; height: 36px; border-radius: 10px;
                display: flex; align-items: center; justify-content: center;
                font-size: 16px;
            }
            .inicio-stat-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
            .inicio-stat-value { font-size: 22px; font-weight: 700; }

            .inicio-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
            @media (max-width: 1024px) { .inicio-grid { grid-template-columns: 1fr; } }

            .list-item {
                display: flex; align-items: center; gap: 12px;
                padding: 12px 0;
                border-bottom: 1px solid var(--border-light);
            }
            .list-item:last-child { border-bottom: none; }
            .list-icon {
                width: 36px; height: 36px; border-radius: 10px;
                display: flex; align-items: center; justify-content: center;
                flex-shrink: 0;
            }
            .list-info { flex: 1; }
            .list-title { font-size: 14px; font-weight: 500; }
            .list-sub { font-size: 12px; color: var(--text-muted); }
            .list-amount { font-size: 14px; font-weight: 600; color: var(--danger); }
        `;
        document.head.appendChild(style);
    }

    function render(container) {
        injectStyles();

        const data = App.data;
        const recent = data.expenses.slice(0, 5);

        const html = `
            <div class="inicio-stats">
                <div class="inicio-stat" data-nav="presupuesto-comun">
                    <div class="inicio-stat-head">
                        <div>
                            <div class="inicio-stat-label">Presupuesto común</div>
                            <div class="inicio-stat-value">${App.formatCurrency(1950)}</div>
                        </div>
                        <div class="inicio-stat-icon" style="background: var(--primary-light); color: var(--primary);">
                            <i class="fas fa-wallet"></i>
                        </div>
                    </div>
                </div>
                <div class="inicio-stat" data-nav="presupuesto-comun">
                    <div class="inicio-stat-head">
                        <div>
                            <div class="inicio-stat-label">Gastos del mes</div>
                            <div class="inicio-stat-value">${App.formatCurrency(142.70)}</div>
                        </div>
                        <div class="inicio-stat-icon" style="background: var(--danger-light); color: var(--danger);">
                            <i class="fas fa-shopping-cart"></i>
                        </div>
                    </div>
                </div>
                <div class="inicio-stat" data-nav="mi-dinero">
                    <div class="inicio-stat-head">
                        <div>
                            <div class="inicio-stat-label">Mi saldo</div>
                            <div class="inicio-stat-value">${App.formatCurrency(5271.30)}</div>
                        </div>
                        <div class="inicio-stat-icon" style="background: var(--success-light); color: var(--success);">
                            <i class="fas fa-piggy-bank"></i>
                        </div>
                    </div>
                </div>
                <div class="inicio-stat" data-nav="cuentas">
                    <div class="inicio-stat-head">
                        <div>
                            <div class="inicio-stat-label">Cuentas</div>
                            <div class="inicio-stat-value">3</div>
                        </div>
                        <div class="inicio-stat-icon" style="background: var(--info-light); color: var(--info);">
                            <i class="fas fa-university"></i>
                        </div>
                    </div>
                </div>
            </div>

            <div class="inicio-grid">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Movimientos recientes</div>
                    </div>
                    ${recent.map(e => {
                        const cat = data.categories.find(c => c.id === e.categoryId);
                        const color = cat ? cat.color : '#94a3b8';
                        const icon = cat ? cat.icon : 'fas fa-question';
                        return `
                            <div class="list-item">
                                <div class="list-icon" style="background: ${color}20; color: ${color};">
                                    <i class="${icon}"></i>
                                </div>
                                <div class="list-info">
                                    <div class="list-title">${App.escapeHtml(e.concept)}</div>
                                    <div class="list-sub">${cat ? cat.name : 'Sin categorizar'} · ${App.formatDate(e.date)}</div>
                                </div>
                                <div class="list-amount">${App.formatCurrency(e.amount)}</div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Accesos rápidos</div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button class="btn btn-primary" data-nav="presupuesto-comun" style="width: 100%;">
                            <i class="fas fa-plus"></i> Nuevo gasto
                        </button>
                        <button class="btn btn-secondary" data-nav="calendario" style="width: 100%;">
                            <i class="fas fa-calendar"></i> Calendario
                        </button>
                        <button class="btn btn-secondary" data-nav="mi-dinero" style="width: 100%;">
                            <i class="fas fa-wallet"></i> Mi dinero
                        </button>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    function init() {
        document.querySelectorAll('[data-nav]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                App.navigateTo(el.dataset.nav);
            });
        });
    }

    App.registerSection('inicio', { render, init });
})();