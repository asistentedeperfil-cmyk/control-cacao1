/* =============================================
   COMPRAS.JS — Módulo de registro de compras
   Sistema Control Cacao - FUMISA
   ============================================= */

const Compras = {

  // Paginación
  _pagina: 1,
  _porPagina: 20,
  _filtrados: [],
  _editandoId: null,

  // ---- Inicializar módulo ----
  init() {
    this._bindEvents();
    this._setFechaHoy();
    this.cargar();
  },

  _setFechaHoy() {
    const hoy = new Date().toISOString().split('T')[0];
    const el = document.getElementById('filtro-fecha-compra');
    if (el && !el.value) el.value = hoy;
  },

  // ---- Eventos ----
  _bindEvents() {
    // Botón nueva compra
    document.getElementById('btn-nueva-compra')?.addEventListener('click', () => this.abrirModal());

    // Guardar compra
    document.getElementById('btn-guardar-compra')?.addEventListener('click', () => this.guardar());

    // Filtrar
    document.getElementById('btn-filtrar-compras')?.addEventListener('click', () => this.cargar());
    document.getElementById('btn-limpiar-filtros')?.addEventListener('click', () => this.limpiarFiltros());

    // Exportar
    document.getElementById('btn-exportar-compras')?.addEventListener('click', () => this.exportar());

    // Calcular total automático al cambiar precio o qq seco
    document.getElementById('c-qq-seco')?.addEventListener('input', () => this._calcularTotal());
    document.getElementById('c-precio')?.addEventListener('input',   () => this._calcularTotal());
    document.getElementById('c-qq-seco')?.addEventListener('input', () => this._calcularTon());

    // Auto-generar nombre de lote al cambiar calidad + fecha
    document.getElementById('c-calidad')?.addEventListener('change',  () => this._sugerirLote());
    document.getElementById('c-fecha')?.addEventListener('change',    () => this._sugerirLote());

    // Enter en filtros
    ['filtro-fecha-compra','filtro-calidad-compra','filtro-proveedor-compra'].forEach(id => {
      document.getElementById(id)?.addEventListener('keydown', e => {
        if (e.key === 'Enter') this.cargar();
      });
    });
  },

  // ---- Calcular total y toneladas ----
  _calcularTotal() {
    const qqSeco = parseFloat(document.getElementById('c-qq-seco')?.value) || 0;
    const precio = parseFloat(document.getElementById('c-precio')?.value)  || 0;
    const total  = parseFloat((qqSeco * precio).toFixed(2));
    const elTotal = document.getElementById('c-total');
    if (elTotal) elTotal.value = total || '';
  },

  _calcularTon() {
    const qqSeco = parseFloat(document.getElementById('c-qq-seco')?.value) || 0;
    const ton    = parseFloat((qqSeco / 22.046).toFixed(3));
    const elTon  = document.getElementById('c-ton');
    if (elTon) elTon.value = ton || '';
  },

  // ---- Sugerir nombre de lote ----
  _sugerirLote() {
    const calidad = document.getElementById('c-calidad')?.value;
    const fecha   = document.getElementById('c-fecha')?.value;
    const elLote  = document.getElementById('c-lote');
    if (!calidad || !fecha || !elLote || elLote.value) return;

    const d = new Date(fecha);
    const anio   = String(d.getFullYear()).slice(-2);
    const semana = this._getWeek(d);
    elLote.value = `${calidad}-${anio}${semana.toString().padStart(2,'0')}01-C1`;

    // Auto-llenar semana y año
    const elSem = document.getElementById('c-semana');
    const elAnio = document.getElementById('c-anio');
    if (elSem && !elSem.value) elSem.value = semana;
    if (elAnio && !elAnio.value) elAnio.value = anio;
  },

  _getWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  },

  // ---- Cargar y renderizar tabla ----
  cargar() {
    const fecha     = document.getElementById('filtro-fecha-compra')?.value    || '';
    const calidad   = document.getElementById('filtro-calidad-compra')?.value  || '';
    const proveedor = document.getElementById('filtro-proveedor-compra')?.value || '';

    this._filtrados = DB.Compras.getFiltered({ fecha, calidad, proveedor });
    this._pagina = 1;
    this._renderTabla();
    this._renderPaginacion();
    this._actualizarContador();
  },

  limpiarFiltros() {
    const hoy = new Date().toISOString().split('T')[0];
    const ef = document.getElementById('filtro-fecha-compra');
    const ec = document.getElementById('filtro-calidad-compra');
    const ep = document.getElementById('filtro-proveedor-compra');
    if (ef) ef.value = '';
    if (ec) ec.value = '';
    if (ep) ep.value = '';
    this._filtrados = DB.Compras.getAll();
    this._pagina = 1;
    this._renderTabla();
    this._renderPaginacion();
    this._actualizarContador();
  },

  _actualizarContador() {
    const el = document.getElementById('compras-count');
    if (el) el.textContent = `${this._filtrados.length} registros`;
  },

  // ---- Render tabla ----
  _renderTabla() {
    const tbody = document.getElementById('tbody-compras');
    if (!tbody) return;

    const inicio = (this._pagina - 1) * this._porPagina;
    const pagina = this._filtrados.slice(inicio, inicio + this._porPagina);

    if (!pagina.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="empty-row">
        <i class="fa-solid fa-inbox"></i> No hay compras con esos filtros</td></tr>`;
      return;
    }

    const fmt = n => (parseFloat(n) || 0).toFixed(2);
    const fmtMoney = n => '$' + (parseFloat(n) || 0).toLocaleString('es-EC', { minimumFractionDigits: 2 });
    const canEdit   = Auth.hasRole('supervisor');
    const canDelete = Auth.isAdmin();

    tbody.innerHTML = pagina.map(c => `
      <tr data-id="${c.id}">
        <td>${this._formatFecha(c.fecha)}</td>
        <td><span class="font-mono font-bold">${c.ticket || ''}</span></td>
        <td><span class="truncate" title="${c.lote || ''}">${c.lote || ''}</span></td>
        <td><span class="truncate" title="${c.proveedor}">${this._titleCase(c.proveedor)}</span></td>
        <td>${this._badgeCalidad(c.calidad)}</td>
        <td class="number-cell">${fmt(c.qqBaba)}</td>
        <td class="number-cell">${fmt(c.qqSeco)}</td>
        <td class="number-cell">$${fmt(c.precio)}</td>
        <td class="money-cell">${fmtMoney(c.total)}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon view" title="Ver detalle" onclick="Compras.verDetalle('${c.id}')">
              <i class="fa-solid fa-eye"></i>
            </button>
            ${canEdit ? `<button class="btn-icon edit" title="Editar" onclick="Compras.abrirModal('${c.id}')">
              <i class="fa-solid fa-pen"></i>
            </button>` : ''}
            ${canDelete ? `<button class="btn-icon delete" title="Eliminar" onclick="Compras.eliminar('${c.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>` : ''}
          </div>
        </td>
      </tr>`).join('');
  },

  // ---- Paginación ----
  _renderPaginacion() {
    const container = document.getElementById('pagination-compras');
    if (!container) return;

    const total  = this._filtrados.length;
    const paginas = Math.ceil(total / this._porPagina);
    if (paginas <= 1) { container.innerHTML = ''; return; }

    let html = `<button class="page-btn" ${this._pagina===1?'disabled':''} onclick="Compras._irPagina(${this._pagina-1})">
      <i class="fa-solid fa-chevron-left"></i></button>`;

    for (let p = 1; p <= paginas; p++) {
      if (p === 1 || p === paginas || Math.abs(p - this._pagina) <= 2) {
        html += `<button class="page-btn ${p===this._pagina?'active':''}" onclick="Compras._irPagina(${p})">${p}</button>`;
      } else if (Math.abs(p - this._pagina) === 3) {
        html += `<span class="page-btn" style="pointer-events:none">…</span>`;
      }
    }

    html += `<button class="page-btn" ${this._pagina===paginas?'disabled':''} onclick="Compras._irPagina(${this._pagina+1})">
      <i class="fa-solid fa-chevron-right"></i></button>`;

    container.innerHTML = html;
  },

  _irPagina(p) {
    this._pagina = p;
    this._renderTabla();
    this._renderPaginacion();
    document.getElementById('page-compras')?.scrollTo(0,0);
  },

  // ---- Abrir modal ----
  abrirModal(id = null) {
    this._editandoId = id;
    const modal = document.getElementById('modal-compra');
    const title = document.getElementById('modal-compra-title');
    const form  = document.getElementById('form-compra');

    if (!modal) return;
    form.reset();

    if (id) {
      const c = DB.Compras.getById(id);
      if (!c) return;
      title.innerHTML = '<i class="fa-solid fa-pen"></i> Editar Compra';
      document.getElementById('c-fecha').value           = c.fecha           || '';
      document.getElementById('c-ticket').value          = c.ticket          || '';
      document.getElementById('c-calidad').value         = c.calidad         || '';
      document.getElementById('c-lote').value            = c.lote            || '';
      document.getElementById('c-proveedor').value       = c.proveedor       || '';
      document.getElementById('c-reporte-calidad').value = c.reporteCalidad  || '';
      document.getElementById('c-calidad-odoo').value    = c.calidadOdoo     || '';
      document.getElementById('c-anio').value            = c.anio            || '';
      document.getElementById('c-semana').value          = c.semana          || '';
      document.getElementById('c-dia').value             = c.dia             || '';
      document.getElementById('c-qq-baba').value         = c.qqBaba          || '';
      document.getElementById('c-qq-seco').value         = c.qqSeco          || '';
      document.getElementById('c-ton').value             = c.ton             || '';
      document.getElementById('c-precio').value          = c.precio          || '';
      document.getElementById('c-total').value           = c.total           || '';
    } else {
      title.innerHTML = '<i class="fa-solid fa-cart-plus"></i> Nueva Compra';
      // Fecha hoy por defecto
      document.getElementById('c-fecha').value  = new Date().toISOString().split('T')[0];
      // Sugerir siguiente ticket
      document.getElementById('c-ticket').value = DB.Compras.nextTicket();
    }

    // Llenar datalist de proveedores
    this._llenarProveedoresDatalist();

    modal.classList.remove('hidden');
  },

  _llenarProveedoresDatalist() {
    const dl = document.getElementById('proveedores-datalist');
    if (!dl) return;
    const nombres = DB.Proveedores.getNombres();
    dl.innerHTML = nombres.map(n => `<option value="${this._titleCase(n)}">`).join('');
  },

  cerrarModal() {
    document.getElementById('modal-compra')?.classList.add('hidden');
    this._editandoId = null;
  },

  // ---- Guardar ----
  guardar() {
    const fecha    = document.getElementById('c-fecha')?.value;
    const ticket   = document.getElementById('c-ticket')?.value?.trim();
    const calidad  = document.getElementById('c-calidad')?.value;
    const lote     = document.getElementById('c-lote')?.value?.trim();
    const proveedor= document.getElementById('c-proveedor')?.value?.trim();
    const repCal   = document.getElementById('c-reporte-calidad')?.value;
    const calOdoo  = document.getElementById('c-calidad-odoo')?.value?.trim();
    const anio     = document.getElementById('c-anio')?.value;
    const semana   = document.getElementById('c-semana')?.value;
    const dia      = document.getElementById('c-dia')?.value;
    const qqBaba   = parseFloat(document.getElementById('c-qq-baba')?.value) || 0;
    const qqSeco   = parseFloat(document.getElementById('c-qq-seco')?.value) || 0;
    const ton      = parseFloat(document.getElementById('c-ton')?.value)     || 0;
    const precio   = parseFloat(document.getElementById('c-precio')?.value)  || 0;
    const total    = parseFloat(document.getElementById('c-total')?.value)   || 0;

    // Validación
    if (!fecha || !ticket || !calidad || !lote || !proveedor || !repCal) {
      App.toast('Completa todos los campos obligatorios (*)', 'warning');
      return;
    }
    if (qqSeco <= 0 || precio <= 0) {
      App.toast('QQ Seco y Precio deben ser mayores a 0', 'warning');
      return;
    }

    // Verificar ticket duplicado (solo en nueva compra)
    if (!this._editandoId) {
      const existe = DB.Compras.getAll().find(c => c.ticket === ticket);
      if (existe) {
        App.toast(`El ticket ${ticket} ya existe en el sistema`, 'error');
        return;
      }
    }

    const data = {
      id:             this._editandoId || undefined,
      fecha, ticket, calidad, lote,
      proveedor:      proveedor.toUpperCase(),
      reporteCalidad: repCal,
      calidadOdoo:    calOdoo,
      anio:           anio || 26,
      semana:         semana || '',
      dia:            dia || '',
      qqBaba, qqSeco, ton, precio, total
    };

    DB.Compras.save(data);

    // Recalcular el lote
    DB.Lotes.recalcular(lote);

    this.cerrarModal();
    this.cargar();
    App.toast(this._editandoId ? 'Compra actualizada' : 'Compra registrada correctamente', 'success');
    App.actualizarDashboard();
  },

  // ---- Ver detalle ----
  verDetalle(id) {
    const c = DB.Compras.getById(id);
    if (!c) return;
    const fmt = n => (parseFloat(n) || 0).toFixed(2);
    const fmtMoney = n => '$' + (parseFloat(n) || 0).toLocaleString('es-EC', {minimumFractionDigits: 2});

    const msg = document.getElementById('confirm-message');
    if (msg) msg.innerHTML = `
      <div style="font-size:0.85rem;line-height:1.8;">
        <strong>Ticket:</strong> ${c.ticket}<br>
        <strong>Fecha:</strong> ${this._formatFecha(c.fecha)}<br>
        <strong>Proveedor:</strong> ${this._titleCase(c.proveedor)}<br>
        <strong>Lote:</strong> ${c.lote}<br>
        <strong>Calidad:</strong> ${c.calidad}<br>
        <strong>Reporte:</strong> ${c.reporteCalidad || '-'}<br>
        <strong>QQ Baba:</strong> ${fmt(c.qqBaba)}<br>
        <strong>QQ Seco:</strong> ${fmt(c.qqSeco)}<br>
        <strong>Precio:</strong> $${fmt(c.precio)}<br>
        <strong>Total:</strong> ${fmtMoney(c.total)}
      </div>`;

    const btnOk = document.getElementById('btn-confirm-ok');
    if (btnOk) { btnOk.textContent = 'Cerrar'; btnOk.className = 'btn btn-secondary'; }

    const modal = document.getElementById('modal-confirm');
    if (modal) {
      modal.classList.remove('hidden');
      const h3 = modal.querySelector('.modal-header h3');
      if (h3) h3.innerHTML = '<i class="fa-solid fa-eye"></i> Detalle de Compra';
      btnOk?.addEventListener('click', () => modal.classList.add('hidden'), { once: true });
    }
  },

  // ---- Eliminar ----
  eliminar(id) {
    const c = DB.Compras.getById(id);
    if (!c) return;

    App.confirmar(`¿Eliminar el ticket <strong>${c.ticket}</strong> de ${this._titleCase(c.proveedor)}?`, () => {
      DB.Compras.delete(id);
      DB.Lotes.recalcular(c.lote);
      this.cargar();
      App.toast('Compra eliminada', 'success');
      App.actualizarDashboard();
    });
  },

  // ---- Exportar a Excel ----
  exportar() {
    const data = this._filtrados;
    if (!data.length) { App.toast('No hay datos para exportar', 'warning'); return; }

    const rows = data.map(c => ({
      'Fecha':           c.fecha,
      'Ticket':          c.ticket,
      'Calidad':         c.calidad,
      'Año':             c.anio,
      'Semana':          c.semana,
      'Día':             c.dia,
      'Nombre del Lote': c.lote,
      'Proveedor':       this._titleCase(c.proveedor),
      'Reporte Calidad': c.reporteCalidad,
      'Calidad Odoo':    c.calidadOdoo,
      'QQ Baba/Semiseco': parseFloat(c.qqBaba)  || 0,
      'QQ Seco':          parseFloat(c.qqSeco)  || 0,
      'Peso en Ton':      parseFloat(c.ton)     || 0,
      'Precio':           parseFloat(c.precio)  || 0,
      'Total Pagado':     parseFloat(c.total)   || 0
    }));

    const ws   = XLSX.utils.json_to_sheet(rows);
    const wb   = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Compras');
    XLSX.writeFile(wb, `Compras_FUMISA_${new Date().toISOString().split('T')[0]}.xlsx`);
    App.toast('Archivo exportado correctamente', 'success');
  },

  // ---- Helpers ----
  _formatFecha(f) {
    if (!f) return '';
    const [y, m, d] = f.split('-');
    return `${d}/${m}/${y}`;
  },

  _titleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  },

  _badgeCalidad(cal) {
    const map = {
      MIXCCN:    'calidad-ccn',
      MIXBN:     'calidad-bn',
      MIXAGRI:   'calidad-agri',
      CCNCOM:    'calidad-com',
      'H-AGROCOCOA': 'calidad-hcda'
    };
    const cls = map[cal] || '';
    return `<span class="status-badge ${cls}">${cal || ''}</span>`;
  }
};

