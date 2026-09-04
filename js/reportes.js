/* =============================================
   REPORTES.JS — Módulo de reportes y resúmenes
   Sistema Control Cacao - FUMISA
   ============================================= */

const Reportes = {

  _reporteActual: null,

  init() {
    this._bindEvents();
  },

  _bindEvents() {
    // Botones de reporte en tarjetas
    document.querySelectorAll('.reporte-card').forEach(card => {
      card.querySelector('button')?.addEventListener('click', () => {
        const tipo = card.dataset.reporte;
        this.generarReporte(tipo);
      });
      card.addEventListener('click', e => {
        if (e.target.tagName !== 'BUTTON') {
          const tipo = card.dataset.reporte;
          this.generarReporte(tipo);
        }
      });
    });

    // Botón imprimir
    document.getElementById('btn-imprimir-reporte')?.addEventListener('click', () => window.print());

    // Botón exportar
    document.getElementById('btn-exportar-reporte')?.addEventListener('click', () => this.exportarReporte());

    // Botón cerrar reporte
    document.getElementById('btn-cerrar-reporte')?.addEventListener('click', () => {
      document.getElementById('reporte-resultado')?.classList.add('hidden');
      this._reporteActual = null;
    });
  },

  // ---- Dispatcher de reportes ----
  generarReporte(tipo) {
    this._reporteActual = tipo;
    switch (tipo) {
      case 'compras-dia':        this._reporteComprasDia();       break;
      case 'compras-semana':     this._reporteComprasSemana();    break;
      case 'proveedor-historial':this._reporteProveedor();        break;
      case 'inventario-general': this._reporteInventario();       break;
      case 'lote-detalle':       this._reporteLote();             break;
      case 'resumen-calidad':    this._reporteResumenCalidad();   break;
    }
  },

  // ============================================================
  //  REPORTE 1: Compras por Día
  // ============================================================
  _reporteComprasDia() {
    const fecha = prompt('Ingresa la fecha (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!fecha) return;

    const compras = DB.Compras.getByFecha(fecha);
    const totales = DB.Compras.totales(compras);
    const [y,m,d] = fecha.split('-');

    this._mostrarReporte(
      `Compras del ${d}/${m}/${y}`,
      this._tablaComprasHTML(compras, totales)
    );
  },

  // ============================================================
  //  REPORTE 2: Compras por Semana
  // ============================================================
  _reporteComprasSemana() {
    const semana = prompt('Ingresa el número de semana (ej: 34):');
    if (!semana) return;

    const anio = prompt('Ingresa el año (ej: 26):', '26');
    if (!anio) return;

    const compras = DB.Compras.getFiltered({ semana, anio });
    const totales = DB.Compras.totales(compras);
    const porCalidad = DB.Compras.porCalidad(compras);

    const fmt  = n => (parseFloat(n)||0).toFixed(2);
    const fmtM = n => '$' + (parseFloat(n)||0).toLocaleString('es-EC',{minimumFractionDigits:2});

    let html = `
      <div class="resumen-semana" style="margin-bottom:1.25rem">
        <div class="resumen-item"><span class="resumen-item-label">Total Registros</span>
          <span class="resumen-item-value">${totales.registros}</span></div>
        <div class="resumen-item"><span class="resumen-item-label">QQ Baba/Semiseco</span>
          <span class="resumen-item-value">${fmt(totales.qqBaba)}</span></div>
        <div class="resumen-item"><span class="resumen-item-label">QQ Seco</span>
          <span class="resumen-item-value">${fmt(totales.qqSeco)}</span></div>
        <div class="resumen-item"><span class="resumen-item-label">Total Pagado</span>
          <span class="resumen-item-value text-success">${fmtM(totales.totalPagado)}</span></div>
      </div>

      <h4 style="margin-bottom:.75rem;font-size:.9rem">Por Calidad</h4>
      <table class="data-table" style="margin-bottom:1.25rem">
        <thead><tr><th>Calidad</th><th>Registros</th><th>QQ Baba</th><th>QQ Seco</th><th>Total</th></tr></thead>
        <tbody>
          ${porCalidad.map(g => `<tr>
            <td>${g.calidad}</td>
            <td class="text-center">${g.registros}</td>
            <td class="number-cell">${fmt(g.qqBaba)}</td>
            <td class="number-cell">${fmt(g.qqSeco)}</td>
            <td class="money-cell">${fmtM(g.total)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${this._tablaComprasHTML(compras, null, false)}`;

    this._mostrarReporte(`Compras Semana ${semana} / Año ${anio}`, html);
  },

  // ============================================================
  //  REPORTE 3: Historial por Proveedor
  // ============================================================
  _reporteProveedor() {
    const proveedores = DB.Proveedores.getNombres();
    if (!proveedores.length) {
      App.toast('No hay proveedores registrados', 'warning'); return;
    }

    const nombre = prompt('Ingresa el nombre (o parte) del proveedor:');
    if (!nombre) return;

    const compras = DB.Compras.getFiltered({ proveedor: nombre });
    if (!compras.length) {
      App.toast(`No se encontraron compras para: ${nombre}`, 'warning'); return;
    }

    const totales = DB.Compras.totales(compras);
    const provNombre = compras[0]?.proveedor || nombre;
    const titleCase = s => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

    this._mostrarReporte(
      `Historial: ${titleCase(provNombre)}`,
      this._tablaComprasHTML(compras.sort((a,b) => (b.fecha||'').localeCompare(a.fecha||'')), totales)
    );
  },

  // ============================================================
  //  REPORTE 4: Inventario General
  // ============================================================
  _reporteInventario() {
    const lotes   = DB.Lotes.getAll();
    const fmt     = n => (parseFloat(n)||0).toFixed(2);
    const fmtM    = n => '$' + (parseFloat(n)||0).toLocaleString('es-EC',{minimumFractionDigits:2});
    const totales = DB.Inventario.totalGeneral();

    const porEstado = { FERMENTACION: [], SECADO: [], BODEGA: [] };
    lotes.forEach(l => {
      if (porEstado[l.estado]) porEstado[l.estado].push(l);
    });

    let html = '';
    ['FERMENTACION','SECADO','BODEGA'].forEach(estado => {
      const group = porEstado[estado];
      if (!group.length) return;
      const icon = { FERMENTACION: 'fa-fire', SECADO: 'fa-sun', BODEGA: 'fa-warehouse' }[estado];
      const subtotal = group.reduce((s,l) => s + (parseFloat(l.volReal)||0), 0);

      html += `
        <h4 style="margin:1rem 0 .5rem;font-size:.9rem;display:flex;align-items:center;gap:.4rem">
          <i class="fa-solid ${icon}" style="color:var(--primary)"></i> ${estado}
          <span class="badge">${group.length} lotes</span>
          <span style="margin-left:auto;font-size:.85rem">QQ: ${fmt(subtotal)}</span>
        </h4>
        <table class="data-table" style="margin-bottom:.5rem">
          <thead><tr>
            <th>Nombre Lote</th><th>Costo Total</th>
            <th>QQ Seco</th><th>Vol. Real</th><th>Saldo</th><th>P/G</th><th>Perfil</th>
          </tr></thead>
          <tbody>
          ${group.map(l => `<tr>
            <td style="font-size:.78rem;font-weight:600">${l.nombre}</td>
            <td class="money-cell">${fmtM(l.costoTotal)}</td>
            <td class="number-cell">${fmt(l.volSeco)}</td>
            <td class="number-cell">${fmt(l.volReal)}</td>
            <td class="number-cell">${fmt(l.saldo)}</td>
            <td class="${l.pg==='GANANCIA'?'pg-ganancia':l.pg==='PERDIDA'?'pg-perdida':'pg-igual'}">${l.pg||''}</td>
            <td style="font-size:.72rem">${l.perfil||''}</td>
          </tr>`).join('')}
          </tbody>
        </table>`;
    });

    html += `<div style="margin-top:1rem;padding:1rem;background:#f0fdf4;border-radius:8px;border:2px solid var(--primary)">
      <strong>TOTAL INVENTARIO: ${fmt(totales.qqTotal)} QQ — ${fmt(totales.tonTotal)} Toneladas</strong>
    </div>`;

    this._mostrarReporte('Inventario General de Lotes', html);
  },

  // ============================================================
  //  REPORTE 5: Detalle de Lote
  // ============================================================
  _reporteLote() {
    const lotes = DB.Lotes.getAll();
    if (!lotes.length) { App.toast('No hay lotes registrados', 'warning'); return; }

    const nombre = prompt('Ingresa el nombre del lote (ej: MIXCCN-263401-C1):');
    if (!nombre) return;

    const lote = lotes.find(l => l.nombre.toLowerCase().includes(nombre.toLowerCase()));
    if (!lote) { App.toast(`Lote no encontrado: ${nombre}`, 'warning'); return; }

    const compras = DB.Compras.getByLote(lote.nombre);
    const totales = DB.Compras.totales(compras);
    const fmt  = n => (parseFloat(n)||0).toFixed(2);
    const fmtM = n => '$' + (parseFloat(n)||0).toLocaleString('es-EC',{minimumFractionDigits:2});

    const resumenLote = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.75rem;margin-bottom:1.25rem">
        ${[
          ['Nombre', lote.nombre],
          ['Estado', lote.estado || '-'],
          ['Perfil', lote.perfil || '-'],
          ['Costo Total', fmtM(lote.costoTotal)],
          ['QQ Baba Comprados', fmt(lote.volBaba)],
          ['QQ Seco', fmt(lote.volSeco)],
          ['Vol. Real', fmt(lote.volReal)],
          ['Saldo', fmt(lote.saldo)],
          ['P/G', lote.pg || '-'],
          ['N° Compras', totales.registros]
        ].map(([k,v]) => `
          <div style="background:#f8fafc;border-radius:6px;padding:.5rem .75rem;border:1px solid #e2e8f0">
            <div style="font-size:.7rem;color:#64748b;font-weight:600">${k}</div>
            <div style="font-size:.85rem;font-weight:700;margin-top:.1rem">${v}</div>
          </div>`).join('')}
      </div>`;

    this._mostrarReporte(
      `Detalle Lote: ${lote.nombre}`,
      resumenLote + this._tablaComprasHTML(compras, totales)
    );
  },

  // ============================================================
  //  REPORTE 6: Resumen por Calidad
  // ============================================================
  _reporteResumenCalidad() {
    const todas = DB.Compras.getAll();
    const grupos = DB.Compras.porCalidad(todas);
    const totalGeneral = DB.Compras.totales(todas);
    const fmt  = n => (parseFloat(n)||0).toFixed(2);
    const fmtM = n => '$' + (parseFloat(n)||0).toLocaleString('es-EC',{minimumFractionDigits:2});

    const colores = {
      MIXCCN: '#92400e', MIXBN: '#5b21b6', MIXAGRI: '#065f46',
      CCNCOM: '#991b1b', 'H-AGROCOCOA': '#0c4a6e'
    };

    // Barras de proporción
    const maxQQ = Math.max(...grupos.map(g => g.qqSeco), 1);
    const barras = grupos.map(g => {
      const pct = Math.round((g.qqSeco / maxQQ) * 100);
      const color = colores[g.calidad] || '#64748b';
      return `
        <div class="chart-bar-item">
          <div class="chart-bar-label">
            <span>${g.calidad}</span>
            <span>${fmt(g.qqSeco)} QQ</span>
          </div>
          <div class="chart-bar-track">
            <div class="chart-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
        </div>`;
    }).join('');

    const html = `
      <div style="margin-bottom:1.25rem">
        <div class="chart-container">${barras}</div>
      </div>

      <table class="data-table">
        <thead><tr>
          <th>Calidad</th><th>N° Compras</th>
          <th>QQ Baba</th><th>QQ Seco</th><th>Total Pagado</th><th>% del Total</th>
        </tr></thead>
        <tbody>
          ${grupos.sort((a,b) => b.qqSeco - a.qqSeco).map(g => {
            const pct = totalGeneral.qqSeco > 0
              ? ((g.qqSeco / totalGeneral.qqSeco) * 100).toFixed(1)
              : '0.0';
            return `<tr>
              <td><span class="font-bold" style="color:${colores[g.calidad]||'#333'}">${g.calidad}</span></td>
              <td class="text-center">${g.registros}</td>
              <td class="number-cell">${fmt(g.qqBaba)}</td>
              <td class="number-cell">${fmt(g.qqSeco)}</td>
              <td class="money-cell">${fmtM(g.total)}</td>
              <td class="text-center">${pct}%</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#f8fafc;font-weight:700;border-top:2px solid #e2e8f0">
            <td>TOTAL</td>
            <td class="text-center">${totalGeneral.registros}</td>
            <td class="number-cell">${fmt(totalGeneral.qqBaba)}</td>
            <td class="number-cell">${fmt(totalGeneral.qqSeco)}</td>
            <td class="money-cell">${fmtM(totalGeneral.totalPagado)}</td>
            <td class="text-center">100%</td>
          </tr>
        </tfoot>
      </table>`;

    this._mostrarReporte('Resumen por Tipo de Calidad', html);
  },

  // ============================================================
  //  HELPERS
  // ============================================================
  _tablaComprasHTML(compras, totales, showTotales = true) {
    const fmt  = n => (parseFloat(n)||0).toFixed(2);
    const fmtM = n => '$' + (parseFloat(n)||0).toLocaleString('es-EC',{minimumFractionDigits:2});
    const fmtF = f => { if(!f) return ''; const [y,m,d]=f.split('-'); return `${d}/${m}/${y}`; };
    const tc   = s => s ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : '';

    if (!compras.length) {
      return `<div class="list-empty"><i class="fa-solid fa-inbox"></i><p>No hay datos</p></div>`;
    }

    let html = `
      <div style="overflow-x:auto">
      <table class="data-table">
        <thead><tr>
          <th>Fecha</th><th>Ticket</th><th>Lote</th><th>Proveedor</th>
          <th>Calidad</th><th>QQ Baba</th><th>QQ Seco</th><th>Precio</th><th>Total</th>
        </tr></thead>
        <tbody>
          ${compras.map(c => `<tr>
            <td>${fmtF(c.fecha)}</td>
            <td class="font-bold font-mono">${c.ticket}</td>
            <td style="font-size:.75rem">${c.lote}</td>
            <td>${tc(c.proveedor)}</td>
            <td><small>${c.reporteCalidad||c.calidad}</small></td>
            <td class="number-cell">${fmt(c.qqBaba)}</td>
            <td class="number-cell">${fmt(c.qqSeco)}</td>
            <td class="number-cell">$${fmt(c.precio)}</td>
            <td class="money-cell">${fmtM(c.total)}</td>
          </tr>`).join('')}
        </tbody>
        ${showTotales && totales ? `
        <tfoot>
          <tr style="background:#f8fafc;font-weight:700;border-top:2px solid #e2e8f0">
            <td colspan="5">TOTALES (${totales.registros} registros)</td>
            <td class="number-cell">${fmt(totales.qqBaba)}</td>
            <td class="number-cell">${fmt(totales.qqSeco)}</td>
            <td></td>
            <td class="money-cell">${fmtM(totales.totalPagado)}</td>
          </tr>
        </tfoot>` : ''}
      </table></div>`;

    return html;
  },

  _mostrarReporte(titulo, contenido) {
    const card = document.getElementById('reporte-resultado');
    const tit  = document.getElementById('reporte-titulo');
    const cont = document.getElementById('reporte-contenido');
    if (!card) return;

    if (tit)  tit.innerHTML  = `<i class="fa-solid fa-chart-bar" style="color:var(--primary)"></i> ${titulo}`;
    if (cont) cont.innerHTML = contenido;
    card.classList.remove('hidden');
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  exportarReporte() {
    if (!this._reporteActual) { App.toast('No hay reporte activo', 'warning'); return; }

    // Extraer datos de la tabla del reporte
    const table = document.querySelector('#reporte-contenido table');
    if (!table) { App.toast('No hay tabla para exportar', 'warning'); return; }

    const ws = XLSX.utils.table_to_sheet(table);
    const wb = XLSX.utils.book_new();
    const titulo = document.getElementById('reporte-titulo')?.textContent?.replace(/[^\w\s-]/g,'').trim() || 'Reporte';
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, `${titulo}_${new Date().toISOString().split('T')[0]}.xlsx`);
    App.toast('Reporte exportado', 'success');
  }
};

