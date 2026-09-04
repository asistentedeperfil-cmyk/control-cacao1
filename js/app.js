/* =============================================
   APP.JS — Lógica principal, navegación y orquestación
   Sistema Control Cacao - FUMISA
   ============================================= */

const App = {

  _paginaActual: 'dashboard',

  // ============================================================
  //  ARRANQUE
  // ============================================================
  init() {
    // Verificar sesión existente
    if (Auth.init()) {
      this._mostrarApp();
    } else {
      this._mostrarLogin();
    }
  },

  // ============================================================
  //  LOGIN / LOGOUT
  // ============================================================
  _mostrarLogin() {
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('app')?.classList.add('hidden');
    this._bindLoginEvents();
  },

  _bindLoginEvents() {
    const form = document.getElementById('login-form');
    form?.addEventListener('submit', e => {
      e.preventDefault();
      const user = document.getElementById('login-user')?.value?.trim();
      const pass = document.getElementById('login-pass')?.value;
      const err  = document.getElementById('login-error');

      const result = Auth.login(user, pass);
      if (result.ok) {
        if (err) err.classList.add('hidden');
        this._mostrarApp();
      } else {
        if (err) err.classList.remove('hidden');
        document.getElementById('login-pass').value = '';
        document.getElementById('login-pass').focus();
      }
    });
  },

  _mostrarApp() {
    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');

    this._configurarUsuario();
    this._bindAppEvents();
    this._inicializarModulos();
    this.navegarA('dashboard');
    this._actualizarFecha();
    this._ajustarMenuPorRol();
  },

  _configurarUsuario() {
    const user = Auth.getUser();
    if (!user) return;
    const inicial = user.nombre.charAt(0).toUpperCase();
    const nombre  = user.nombre;
    const rol     = { admin: 'Administrador', supervisor: 'Supervisor', operador: 'Operador' }[user.rol] || user.rol;

    document.getElementById('user-name-sidebar')?.textContent && (document.getElementById('user-name-sidebar').textContent = nombre);
    document.getElementById('user-rol-sidebar')?.textContent  && (document.getElementById('user-rol-sidebar').textContent  = rol);
    document.getElementById('topbar-username')?.textContent   && (document.getElementById('topbar-username').textContent   = nombre);

    ['user-avatar', 'topbar-avatar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = inicial;
    });
  },

  _ajustarMenuPorRol() {
    const isAdmin = Auth.isAdmin();
    document.querySelectorAll('.nav-admin-section, .nav-admin-item').forEach(el => {
      el.style.display = isAdmin ? '' : 'none';
    });
  },

  // ============================================================
  //  INICIALIZAR MÓDULOS
  // ============================================================
  _inicializarModulos() {
    Compras.init();
    Lotes.init();
    Inventario.init();
    Proveedores.init();
    Reportes.init();
    Importar.init();
    if (Auth.isAdmin()) Usuarios.init();
  },

  // ============================================================
  //  EVENTOS GLOBALES
  // ============================================================
  _bindAppEvents() {
    // Navegación sidebar
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        this.navegarA(item.dataset.page);
      });
    });

    // Botones dentro de cards que naveguen a páginas
    document.querySelectorAll('[data-page]').forEach(el => {
      if (!el.classList.contains('nav-item')) {
        el.addEventListener('click', () => this.navegarA(el.dataset.page));
      }
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      this.confirmar('¿Deseas cerrar sesión?', () => {
        Auth.logout();
        this._mostrarLogin();
      });
    });

    // Toggle sidebar colapsado
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      const main    = document.querySelector('.main-content');
      sidebar?.classList.toggle('collapsed');
      if (sidebar?.classList.contains('collapsed')) {
        main?.classList.add('sidebar-collapsed');
      } else {
        main?.classList.remove('sidebar-collapsed');
      }
    });

    // Menú móvil
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('mobile-open');
    });

    // Cerrar sidebar móvil al hacer clic afuera
    document.addEventListener('click', e => {
      const sidebar = document.getElementById('sidebar');
      const btn     = document.getElementById('mobile-menu-btn');
      if (sidebar?.classList.contains('mobile-open') &&
          !sidebar.contains(e.target) && e.target !== btn) {
        sidebar.classList.remove('mobile-open');
      }
    });

    // Modales — cerrar con overlay o botón close
    document.querySelectorAll('.modal').forEach(modal => {
      modal.querySelector('.modal-overlay')?.addEventListener('click', () => {
        modal.classList.add('hidden');
      });
      modal.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => modal.classList.add('hidden'));
      });
    });

    // Modal confirmación — cerrar con X
    document.querySelector('#modal-confirm .modal-close')?.addEventListener('click', () => {
      document.getElementById('modal-confirm')?.classList.add('hidden');
    });

    // Tecla Escape cierra modales
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
      }
    });
  },

  // ============================================================
  //  NAVEGACIÓN
  // ============================================================
  navegarA(pagina) {
    this._paginaActual = pagina;

    // Ocultar todas las páginas
    document.querySelectorAll('.page').forEach(p => {
      p.classList.remove('active');
      p.classList.add('hidden');
    });

    // Mostrar página destino
    const pageEl = document.getElementById(`page-${pagina}`);
    if (pageEl) {
      pageEl.classList.remove('hidden');
      pageEl.classList.add('active');
    }

    // Actualizar nav activo
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === pagina);
    });

    // Actualizar título
    const titulos = {
      dashboard:  'Dashboard',
      compras:    'Compras',
      lotes:      'Control de Lotes',
      inventario: 'Inventario',
      proveedores:'Proveedores / Agricultores',
      reportes:   'Reportes',
      importar:   'Importar desde Excel',
      usuarios:   'Gestión de Usuarios'
    };
    const el = document.getElementById('page-title');
    if (el) el.textContent = titulos[pagina] || pagina;

    // Recargar datos según página
    switch (pagina) {
      case 'dashboard':  this.actualizarDashboard(); break;
      case 'compras':    Compras.cargar();           break;
      case 'lotes':      Lotes.cargar();             break;
      case 'inventario': Inventario.cargar();        break;
      case 'proveedores':Proveedores.cargar();       break;
      case 'usuarios':   if (Auth.isAdmin()) Usuarios.cargar(); break;
    }

    // Cerrar sidebar móvil
    document.getElementById('sidebar')?.classList.remove('mobile-open');
  },

  // ============================================================
  //  DASHBOARD
  // ============================================================
  actualizarDashboard() {
    if (this._paginaActual !== 'dashboard') return;
    const data = DB.dashboard();

    // Stats
    this._setEl('stat-compras-hoy',    data.comprasHoy);
    this._setEl('stat-qq-hoy',         data.qqHoy);
    this._setEl('stat-lotes-activos',  data.lotesActivos);
    this._setEl('stat-qq-inventario',  data.qqInventario);

    // Últimas compras
    this._renderUltimasCompras(data.ultimasCompras);

    // Estado de lotes
    this._renderLotesEstado(data.lotesActivos_list);

    // Chart por calidad
    this._renderChartCalidad(data.porCalidad);

    // Resumen semana
    this._renderResumenSemana(data.semanas);
  },

  _renderUltimasCompras(compras) {
    const el = document.getElementById('ultimas-compras-list');
    if (!el) return;
    if (!compras.length) {
      el.innerHTML = `<div class="list-empty"><i class="fa-solid fa-inbox"></i><p>No hay compras registradas</p></div>`;
      return;
    }
    const fmt  = n => (parseFloat(n)||0).toFixed(2);
    const fmtM = n => '$' + (parseFloat(n)||0).toLocaleString('es-EC',{minimumFractionDigits:2});
    const tc   = s => s ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : '';
    const fmtF = f => { if(!f) return ''; const [y,m,d] = f.split('-'); return `${d}/${m}`; };

    el.innerHTML = compras.map(c => `
      <div class="compra-item">
        <div class="compra-item-left">
          <div class="ticket">${c.ticket} <small class="text-muted">${fmtF(c.fecha)}</small></div>
          <div class="proveedor">${tc(c.proveedor)}</div>
        </div>
        <div class="compra-item-right">
          <div class="monto">${fmtM(c.total)}</div>
          <div class="qq">${fmt(c.qqSeco)} QQ</div>
        </div>
      </div>`).join('');
  },

  _renderLotesEstado(lotes) {
    const el = document.getElementById('lotes-estado-list');
    if (!el) return;
    if (!lotes.length) {
      el.innerHTML = `<div class="list-empty"><i class="fa-solid fa-inbox"></i><p>No hay lotes activos</p></div>`;
      return;
    }
    const fmt = n => (parseFloat(n)||0).toFixed(2);
    const estadoColor = { FERMENTACION:'#d97706', SECADO:'#2563eb', BODEGA:'#15803d' };

    el.innerHTML = lotes.map(l => {
      const color = estadoColor[l.estado] || '#64748b';
      return `<div class="lote-item">
        <div>
          <div class="lote-nombre">${l.nombre}</div>
          <small style="color:${color};font-weight:700;font-size:.7rem">${l.estado}</small>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;font-size:.82rem">${fmt(l.volReal || l.volSeco)} QQ</div>
          <div style="font-size:.72rem;color:#64748b">${l.perfil || ''}</div>
        </div>
      </div>`;
    }).join('');
  },

  _renderChartCalidad(grupos) {
    const el = document.getElementById('inventario-calidad-chart');
    if (!el) return;
    if (!grupos.length) {
      el.innerHTML = `<div class="list-empty"><i class="fa-solid fa-chart-pie"></i><p>Sin datos</p></div>`;
      return;
    }
    const colores = {
      MIXCCN:'#d97706', MIXBN:'#7c3aed', MIXAGRI:'#16a34a',
      CCNCOM:'#dc2626', 'H-AGROCOCOA':'#0891b2'
    };
    const maxQQ = Math.max(...grupos.map(g => g.qqSeco), 1);
    const fmt = n => (parseFloat(n)||0).toFixed(1);

    el.innerHTML = grupos
      .sort((a,b) => b.qqSeco - a.qqSeco)
      .map(g => {
        const pct   = Math.round((g.qqSeco / maxQQ) * 100);
        const color = colores[g.calidad] || '#64748b';
        return `
          <div class="chart-bar-item">
            <div class="chart-bar-label">
              <span style="font-weight:600;font-size:.78rem">${g.calidad}</span>
              <span style="font-size:.75rem;color:#64748b">${fmt(g.qqSeco)} QQ</span>
            </div>
            <div class="chart-bar-track">
              <div class="chart-bar-fill" style="width:${pct}%;background:${color}"></div>
            </div>
          </div>`;
      }).join('');
  },

  _renderResumenSemana(semanas) {
    const el = document.getElementById('resumen-semana');
    if (!el) return;
    if (!semanas.length) {
      el.innerHTML = `<div class="list-empty"><i class="fa-solid fa-calendar"></i><p>Sin datos semanales</p></div>`;
      return;
    }
    const fmt  = n => (parseFloat(n)||0).toFixed(2);
    const fmtM = n => '$' + (parseFloat(n)||0).toLocaleString('es-EC',{minimumFractionDigits:2});

    el.innerHTML = semanas.map(s => `
      <div class="resumen-item">
        <span class="resumen-item-label">Semana ${s.semana} / ${s.anio}</span>
        <div style="text-align:right">
          <div class="resumen-item-value">${fmt(s.qqSeco)} QQ</div>
          <div style="font-size:.75rem;color:#16a34a">${fmtM(s.total)}</div>
        </div>
      </div>`).join('');
  },

  // ============================================================
  //  TOASTS
  // ============================================================
  toast(msg, tipo = 'info', duracion = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const iconos = {
      success: 'fa-circle-check',
      error:   'fa-circle-xmark',
      warning: 'fa-triangle-exclamation',
      info:    'fa-circle-info'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = `<i class="fa-solid ${iconos[tipo] || iconos.info}"></i> ${msg}`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, duracion);
  },

  // ============================================================
  //  MODAL DE CONFIRMACIÓN
  // ============================================================
  confirmar(mensaje, onConfirm) {
    const modal  = document.getElementById('modal-confirm');
    const msg    = document.getElementById('confirm-message');
    const btnOk  = document.getElementById('btn-confirm-ok');
    const h3     = modal?.querySelector('.modal-header h3');

    if (!modal) { onConfirm(); return; }

    if (msg)   msg.innerHTML  = mensaje;
    if (h3)    h3.innerHTML   = '<i class="fa-solid fa-triangle-exclamation"></i> Confirmar acción';
    if (btnOk) { btnOk.textContent = 'Confirmar'; btnOk.className = 'btn btn-danger'; }

    modal.classList.remove('hidden');

    // Listener único
    const handler = () => {
      modal.classList.add('hidden');
      onConfirm();
    };
    btnOk?.removeEventListener('click', btnOk._handler);
    btnOk._handler = handler;
    btnOk?.addEventListener('click', handler, { once: true });
  },

  // ============================================================
  //  UTILIDADES
  // ============================================================
  _setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  },

  _actualizarFecha() {
    const el = document.getElementById('current-date');
    if (!el) return;
    const hoy = new Date();
    const dias  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    el.textContent = `${dias[hoy.getDay()]}, ${hoy.getDate()} ${meses[hoy.getMonth()]} ${hoy.getFullYear()}`;

    // Actualizar cada minuto
    setInterval(() => {
      const n = new Date();
      el.textContent = `${dias[n.getDay()]}, ${n.getDate()} ${meses[n.getMonth()]} ${n.getFullYear()}`;
    }, 60000);
  }
};

// ============================================================
//  ARRANQUE
// ============================================================
document.addEventListener('DOMContentLoaded', () => App.init());

