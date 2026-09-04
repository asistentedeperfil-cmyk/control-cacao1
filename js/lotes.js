/* =============================================
   LOTES.JS — Módulo de control de lotes
   Sistema Control Cacao - FUMISA
   ============================================= */

const Lotes = {

  _filtrados: [],
  _editandoId: null,

  // ---- Inicializar ----
  init() {
    this._bindEvents();
    this.cargar();
  },

  _bindEvents() {
    document.getElementById('btn-nuevo-lote')?.addEventListener('click', () => this.abrirModal());
    document.getElementById('btn-guardar-lote')?.addEventListener('click', () => this.guardar());
    document.getElementById('btn-filtrar-lotes')?.addEventListener('click', () => this.cargar());
  },

  // ---- Cargar y renderizar ----
  cargar() {
    const estado = document.getElementById('filtro-estado-lote')?.value || '';
    const tipo   = document.getElementById('filtro-tipo-lote')?.value   || '';
    this._filtrados = DB.Lotes.getFiltered({ estado, tipo });
    this._renderTabla();
    this._actualizarContador();
  },

  _actualizarContador() {
    const el = document.getElementById('lotes-count');
    if (el) el.textContent = `${this._filtrados.length} lotes`;
  },

  _renderTabla() {
    const tbody = document.getElementById('tbody-lotes');
    if (!tbody) return;

    if (!this._filtrados.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="empty-row">
        <i class="fa-solid fa-inbox"></i> No hay lotes con esos filtros</td></tr>`;
      return;
    }

    const fmt = n => (parseFloat(n) || 0).toLocaleString('es-EC', { minimumFractionDigits: 2 });
    const fmtMoney = n => '$' + (parseFloat(n) || 0).toLocaleString('es-EC', { minimumFractionDigits: 2 });
    const canEdit   = Auth.hasRole('supervisor');
    const canDelete = Auth.isAdmin();

    tbody.innerHTML = this._filtrados.map(l => `
      <tr data-id="${l.id}">
        <td><span class="font-bold" style="font-size:0.78rem">${l.nombre}</span></td>
        <td class="money-cell">${fmtMoney(l.costoTotal)}</td>
        <td class="number-cell">${fmt(l.volBaba)}</td>
        <td class="number-cell">${fmt(l.volSeco)}</td>
        <td class="number-cell">${fmt(l.volReal)}</td>
        <td>${this._badgeEstado(l.estado)}</td>
        <td>${this._badgePG(l.pg)}</td>
        <td class="number-cell">${fmt(l.saldo)}</td>
        <td>${this._badgePerfil(l.perfil)}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon view" title="Ver compras del lote"
              onclick="Lotes.verCompras('${l.nombre}')">
              <i class="fa-solid fa-list"></i>
            </button>
            ${canEdit ? `<button class="btn-icon edit" title="Editar estado"
              onclick="Lotes.abrirModal('${l.id}')">
              <i class="fa-solid fa-pen"></i>
            </button>` : ''}
            ${canEdit ? `<button class="btn-icon" style="color:#8b5cf6" title="Recalcular desde compras"
              onclick="Lotes.recalcular('${l.nombre}')">
              <i class="fa-solid fa-rotate"></i>
            </button>` : ''}
            ${canDelete ? `<button class="btn-icon delete" title="Eliminar"
              onclick="Lotes.eliminar('${l.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>` : ''}
          </div>
        </td>
      </tr>`).join('');
  },

  // ---- Abrir modal ----
  abrirModal(id = null) {
    this._editandoId = id;
    const modal = document.getElementById('modal-lote');
    const title = document.getElementById('modal-lote-title');
    const form  = document.getElementById('form-lote');
    if (!modal) return;
    form.reset();

    if (id) {
      const l = DB.Lotes.getById(id);
      if (!l) return;
      title.innerHTML = '<i class="fa-solid fa-pen"></i> Editar Lote';
      document.getElementById('l-nombre').value   = l.nombre    || '';
      document.getElementById('l-costo').value    = l.costoTotal|| '';
      document.getElementById('l-vol-baba').value = l.volBaba   || '';
      document.getElementById('l-vol-seco').value = l.volSeco   || '';
      document.getElementById('l-vol-real').value = l.volReal   || '';
      document.getElementById('l-estado').value   = l.estado    || 'FERMENTACION';
      document.getElementById('l-pg').value       = l.pg        || 'IGUAL';
      document.getElementById('l-salida').value   = l.salida    || '';
      document.getElementById('l-saldo').value    = l.saldo     || '';
      document.getElementById('l-perfil').value   = l.perfil    || 'EN PROCESO';
    } else {
      title.innerHTML = '<i class="fa-solid fa-box-archive"></i> Nuevo Lote';
    }

    modal.classList.remove('hidden');
  },

  cerrarModal() {
    document.getElementById('modal-lote')?.classList.add('hidden');
    this._editandoId = null;
  },

  // ---- Guardar ----
  guardar() {
    const nombre   = document.getElementById('l-nombre')?.value?.trim();
    const estado   = document.getElementById('l-estado')?.value;
    const perfil   = document.getElementById('l-perfil')?.value;

    if (!nombre || !estado) {
      App.toast('Nombre y Estado son obligatorios', 'warning');
      return;
    }

    DB.Lotes.save({
      id:         this._editandoId || undefined,
      nombre,
      costoTotal: parseFloat(document.getElementById('l-costo')?.value)    || 0,
      volBaba:    parseFloat(document.getElementById('l-vol-baba')?.value) || 0,
      volSeco:    parseFloat(document.getElementById('l-vol-seco')?.value) || 0,
      volReal:    parseFloat(document.getElementById('l-vol-real')?.value) || 0,
      estado,
      pg:         document.getElementById('l-pg')?.value    || 'IGUAL',
      salida:     parseFloat(document.getElementById('l-salida')?.value)   || 0,
      saldo:      parseFloat(document.getElementById('l-saldo')?.value)    || 0,
      perfil:     perfil || 'EN PROCESO'
    });

    this.cerrarModal();
    this.cargar();
    Inventario.cargar();
    App.toast(this._editandoId ? 'Lote actualizado' : 'Lote creado', 'success');
    App.actualizarDashboard();
  },

  // ---- Recalcular desde compras ----
  recalcular(nombre) {
    DB.Lotes.recalcular(nombre);
    this.cargar();
    App.toast(`Lote ${nombre} recalculado desde compras`, 'success');
    App.actualizarDashboard();
  },

  // ---- Ver compras del lote ----
  verCompras(nombre) {
    const compras = DB.Compras.getByLote(nombre);
    const totales = DB.Compras.totales(compras);
    const fmt = n => (parseFloat(n)||0).toFixed(2);
    const fmtM = n => '$' + (parseFloat(n)||0).toLocaleString('es-EC',{minimumFractionDigits:2});

    let html = `<div style="margin-bottom:.75rem;font-size:.82rem">
      <strong>${compras.length} compras</strong> — 
      QQ Baba: <strong>${fmt(totales.qqBaba)}</strong> | 
      QQ Seco: <strong>${fmt(totales.qqSeco)}</strong> | 
      Total: <strong>${fmtM(totales.totalPagado)}</strong>
    </div>
    <div style="overflow-x:auto;max-height:350px;overflow-y:auto">
    <table class="data-table">
      <thead><tr>
        <th>Fecha</th><th>Ticket</th><th>Proveedor</th><th>Calidad</th>
        <th>QQ Baba</th><th>QQ Seco</th><th>Precio</th><th>Total</th>
      </tr></thead>
      <tbody>`;

    compras.forEach(c => {
      html += `<tr>
        <td>${this._formatFecha(c.fecha)}</td>
        <td class="font-bold font-mono">${c.ticket}</td>
        <td>${this._titleCase(c.proveedor)}</td>
        <td>${c.reporteCalidad || c.calidad}</td>
        <td class="number-cell">${fmt(c.qqBaba)}</td>
        <td class="number-cell">${fmt(c.qqSeco)}</td>
        <td class="number-cell">$${fmt(c.precio)}</td>
        <td class="money-cell">${fmtM(c.total)}</td>
      </tr>`;
    });

    html += compras.length === 0
      ? `<tr><td colspan="8" class="empty-row"><i class="fa-solid fa-inbox"></i> Sin compras registradas</td></tr>`
      : '';
    html += '</tbody></table></div>';

    const msg = document.getElementById('confirm-message');
    if (msg) msg.innerHTML = html;

    const btnOk = document.getElementById('btn-confirm-ok');
    if (btnOk) { btnOk.textContent = 'Cerrar'; btnOk.className = 'btn btn-secondary'; }

    const modal = document.getElementById('modal-confirm');
    if (modal) {
      const h3 = modal.querySelector('.modal-header h3');
      if (h3) h3.innerHTML = `<i class="fa-solid fa-list"></i> Lote: ${nombre}`;
      modal.classList.remove('hidden');
      modal.querySelector('.modal-dialog')?.style.setProperty('max-width','800px');
      btnOk?.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.querySelector('.modal-dialog')?.style.removeProperty('max-width');
      }, { once: true });
    }
  },

  // ---- Eliminar ----
  eliminar(id) {
    const l = DB.Lotes.getById(id);
    if (!l) return;
    App.confirmar(`¿Eliminar el lote <strong>${l.nombre}</strong>?<br><small>Las compras asociadas NO se eliminarán.</small>`, () => {
      DB.Lotes.delete(id);
      this.cargar();
      Inventario.cargar();
      App.toast('Lote eliminado', 'success');
      App.actualizarDashboard();
    });
  },

  // ---- Helpers ----
  _badgeEstado(est) {
    const map = {
      FERMENTACION: ['status-fermentacion', 'fa-fire', 'Fermentación'],
      SECADO:       ['status-secado',       'fa-sun',  'Secado'],
      BODEGA:       ['status-bodega',       'fa-warehouse', 'Bodega']
    };
    const [cls, icon, label] = map[est] || ['', 'fa-circle', est || ''];
    return `<span class="status-badge ${cls}"><i class="fa-solid ${icon}"></i> ${label}</span>`;
  },

  _badgePG(pg) {
    if (!pg) return '';
    if (pg === 'GANANCIA') return `<span class="pg-ganancia"><i class="fa-solid fa-arrow-trend-up"></i> ${pg}</span>`;
    if (pg === 'PERDIDA')  return `<span class="pg-perdida"><i class="fa-solid fa-arrow-trend-down"></i> ${pg}</span>`;
    return `<span class="pg-igual">${pg}</span>`;
  },

  _badgePerfil(perfil) {
    if (!perfil) return '';
    const map = {
      'PERFIL':                      '#16a34a',
      'BASE':                        '#2563eb',
      'EN PROCESO':                  '#7c3aed',
      'RECHAZADO PARA CONVENCIONAL': '#dc2626'
    };
    const color = map[perfil] || '#64748b';
    return `<span style="font-size:.7rem;font-weight:700;color:${color}">${perfil}</span>`;
  },

  _formatFecha(f) {
    if (!f) return '';
    const [y, m, d] = f.split('-');
    return `${d}/${m}/${y}`;
  },

  _titleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }
};

/* =============================================
   INVENTARIO — Módulo de resumen de inventario
   ============================================= */
const Inventario = {

  init() { this.cargar(); },

  cargar() {
    this._renderResumen();
    this._renderProcesados();
    this._renderSubproductos();
    this._renderTotal();
  },

  _renderResumen() {
    const tbody = document.getElementById('tbody-resumen-inventario');
    if (!tbody) return;
    const resumen = DB.Inventario.calcularResumen();
    const fmt = n => (parseFloat(n)||0).toFixed(2);
    tbody.innerHTML = resumen.map(r => `
      <tr>
        <td>${r.detalle}</td>
        <td>${r.calidad}</td>
        <td class="number-cell font-bold">${fmt(r.qq)}</td>
        <td class="number-cell">${fmt(r.ton)}</td>
      </tr>`).join('');
  },

  _renderProcesados() {
    const tbody = document.getElementById('tbody-lotes-procesados');
    if (!tbody) return;
    const inv = DB.Inventario.get();
    const rows = inv.lotesProcessados || [];
    const fmt = n => (parseFloat(n)||0).toFixed(2);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Sin lotes procesados</td></tr>`;
      return;
    }
    let total = 0;
    tbody.innerHTML = rows.map(r => {
      total += parseFloat(r.qq) || 0;
      return `<tr>
        <td>${r.detalle}</td>
        <td>${r.calidad}</td>
        <td class="number-cell">${fmt(r.qq)}</td>
        <td class="number-cell">${fmt(r.ton)}</td>
      </tr>`;
    }).join('') + `<tr style="background:#f8fafc;font-weight:700">
      <td colspan="2">TOTAL PROCESADOS</td>
      <td class="number-cell text-success">${fmt(total)}</td>
      <td class="number-cell text-success">${fmt(total/22.046)}</td>
    </tr>`;
  },

  _renderSubproductos() {
    const tbody = document.getElementById('tbody-subproductos');
    if (!tbody) return;
    const inv = DB.Inventario.get();
    const rows = inv.subproductos || [];
    const fmt = n => (parseFloat(n)||0).toFixed(2);
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.detalle}</td>
        <td>${r.calidad}</td>
        <td class="number-cell">${fmt(r.qq)}</td>
        <td class="number-cell">${fmt(r.ton)}</td>
      </tr>`).join('') || `<tr><td colspan="4" class="empty-row">Sin subproductos</td></tr>`;
  },

  _renderTotal() {
    const totales = DB.Inventario.totalGeneral();
    const elQQ  = document.getElementById('total-inventario-qq');
    const elTon = document.getElementById('total-inventario-ton');
    if (elQQ)  elQQ.textContent  = totales.qqTotal.toFixed(2) + ' QQ';
    if (elTon) elTon.textContent = totales.tonTotal.toFixed(2) + ' Ton';
  }
};

