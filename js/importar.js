/* =============================================
   IMPORTAR.JS — Importación de datos desde Excel/CSV
   Sistema Control Cacao - FUMISA
   ============================================= */

const Importar = {

  _datosCompras:    [],
  _datosInventario: [],

  init() {
    this._bindEvents();
  },

  _bindEvents() {
    // ---- Zona de compras ----
    const fileCompras = document.getElementById('file-compras');
    const dropCompras = document.getElementById('drop-zone-compras');

    fileCompras?.addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) this._leerArchivo(f, 'compras');
    });

    this._setupDrop(dropCompras, 'compras');

    document.getElementById('btn-confirmar-import-compras')?.addEventListener('click', () => {
      this._confirmarCompras();
    });

    // ---- Zona de inventario ----
    const fileInv = document.getElementById('file-inventario');
    const dropInv = document.getElementById('drop-zone-inventario');

    fileInv?.addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) this._leerArchivo(f, 'inventario');
    });

    this._setupDrop(dropInv, 'inventario');

    document.getElementById('btn-confirmar-import-inventario')?.addEventListener('click', () => {
      this._confirmarInventario();
    });
  },

  // ---- Drag & Drop ----
  _setupDrop(zone, tipo) {
    if (!zone) return;
    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f) this._leerArchivo(f, tipo);
    });
  },

  // ---- Leer archivo ----
  _leerArchivo(file, tipo) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv','xlsx','xls'].includes(ext)) {
      App.toast('Formato no soportado. Usa CSV, XLSX o XLS', 'error');
      return;
    }

    this._log(`Leyendo archivo: ${file.name} (${(file.size/1024).toFixed(1)} KB)...`, 'info');

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });

        this._log(`Hoja: "${sheetName}" — ${rows.length} filas encontradas`, 'info');

        if (tipo === 'compras') {
          this._procesarCompras(rows);
        } else {
          this._procesarInventario(rows);
        }
      } catch (err) {
        this._log(`Error leyendo archivo: ${err.message}`, 'error');
        App.toast('Error al leer el archivo', 'error');
      }
    };
    reader.readAsBinaryString(file);
  },

  // ============================================================
  //  PROCESAR COMPRAS
  //  Mapea columnas del Excel de FUMISA al modelo interno
  // ============================================================
  _procesarCompras(rows) {
    this._datosCompras = [];
    let omitidas = 0;

    rows.forEach((row, i) => {
      try {
        // Detectar columnas por múltiples variantes de nombre
        const fecha    = this._col(row, ['FECHA','fecha','Fecha']);
        const calidad  = this._col(row, ['CALIDAD','calidad','Calidad']);
        const anio     = this._col(row, ['AÑO','AÃO','año','anio','Año']);
        const semana   = this._col(row, ['SEMANA','semana','Semana']);
        const dia      = this._col(row, ['DIAS','DIA','dia','Días','Dia']);
        const lote     = this._col(row, ['NOMBRE DEL LOTE','nombre del lote','Nombre del Lote','lote','Lote']);
        let ticket     = this._col(row, ['TICKETS','ticket','Ticket','TICKET','N° TICKET','No. TICKET']);
        const proveedor= this._col(row, ['PROVEEDOR','proveedor','Proveedor','NOMBRE PROVEEDOR']);
        const repCal   = this._col(row, ['REPORTE CALIDAD','reporte calidad','Reporte Calidad','REPORTE_CALIDAD']);
        const calOdoo  = this._col(row, ['CALIDAD ODDOO','CALIDAD ODOO','calidad odoo','Calidad Odoo']);
        const qqBaba   = this._col(row, ['PESO QQ EN BABA/SEMISECO','QQ BABA','qq baba','QQ Baba','PESO QQ BABA']);
        const qqSeco   = this._col(row, ['PESO QQ SECO','QQ SECO','qq seco','QQ Seco']);
        const ton      = this._col(row, ['PESO EN TON','TON','ton','Ton','Toneladas']);
        const precio   = this._col(row, ['PRECIO','precio','Precio','PRECIO UNIT']);
        const total    = this._col(row, ['TOTAL PAGADO BRUTO','TOTAL PAGADO','total','Total','Total Pagado']);

        // Normalizar ticket: asegurar que tenga prefijo P
        let ticketNorm = (ticket || '').toString().trim();
        if (ticketNorm && !/^[Pp]/.test(ticketNorm)) {
          ticketNorm = 'P' + ticketNorm;
        }
        ticketNorm = ticketNorm.toUpperCase();

        // Normalizar nombre de lote: debe empezar con 2 dígitos del año (ej: 26 para 2026)
        let loteNorm = (lote || '').toString().trim();
        if (loteNorm) {
          // Verificar que el lote tenga el formato correcto con año de 2 dígitos
          // Ejemplo correcto: MIXCCN-263401-C1 (26=año, 34=semana, 01=día)
          // Si empieza con el tipo de calidad seguido de guión
          const tiposValidos = ['MIXCCN','MIXBN','MIXAGRI','CCNCOM','H-AGROCOCOA','CCNH'];
          const tieneFormato = tiposValidos.some(t => loteNorm.startsWith(t + '-'));
          if (!tieneFormato) {
            // Intentar reconstruir desde calidad + año + semana + día
            const calStr   = (calidad || '').toString().trim().toUpperCase();
            const anioStr  = String(this._num(anio) || 26).padStart(2,'0').slice(-2);
            const semStr   = String(this._num(semana) || '').padStart(2,'0');
            const diaStr   = String(this._num(dia) || 1).padStart(2,'0');
            if (calStr && semStr) {
              loteNorm = `${calStr}-${anioStr}${semStr}${diaStr}-C1`;
            }
          }
        }

        if (!ticketNorm || !loteNorm) { omitidas++; return; }

        // Saltar filas sin proveedor o fecha
        if (!fecha || fecha === 'FECHA' || fecha.toString().includes('#N/A')) { omitidas++; return; }
        if (!proveedor || proveedor.toString().trim() === '') { omitidas++; return; }

        // Normalizar fecha
        let fechaNorm = this._normalizarFecha(fecha);
        if (!fechaNorm) { omitidas++; return; }

        // Normalizar números — usando el método corregido
        const qqBabaN = this._num(qqBaba);
        const qqSecoN = this._num(qqSeco);
        const tonN    = this._num(ton) > 0 ? this._num(ton) : parseFloat((qqSecoN / 22.046).toFixed(4));
        const precioN = this._num(precio);
        const totalN  = this._num(total) > 0 ? this._num(total) : parseFloat((qqSecoN * precioN).toFixed(2));

        this._datosCompras.push({
          fecha:          fechaNorm,
          calidad:        (calidad || '').toString().trim().toUpperCase(),
          anio:           this._num(anio) || 26,
          semana:         this._num(semana) || '',
          dia:            this._num(dia)    || '',
          lote:           loteNorm,
          ticket:         ticketNorm,
          proveedor:      (proveedor || '').toString().trim().toUpperCase(),
          reporteCalidad: (repCal  || '').toString().trim(),
          calidadOdoo:    (calOdoo || '').toString().trim(),
          qqBaba:         qqBabaN,
          qqSeco:         qqSecoN,
          ton:            tonN,
          precio:         precioN,
          total:          totalN
        });
      } catch (e) {
        omitidas++;
      }
    });

    this._log(`Filas procesadas: ${this._datosCompras.length} válidas, ${omitidas} omitidas`, 'info');

    if (this._datosCompras.length === 0) {
      App.toast('No se encontraron datos válidos en el archivo', 'warning');
      return;
    }

    this._mostrarPreviewCompras();
  },

  _mostrarPreviewCompras() {
    const container = document.getElementById('import-preview-compras');
    const btnConf   = document.getElementById('btn-confirmar-import-compras');
    if (!container) return;

    const muestra = this._datosCompras.slice(0, 5);
    const fmt = n => (parseFloat(n)||0).toFixed(2);
    const fmtF = f => { const [y,m,d] = f.split('-'); return `${d}/${m}/${y}`; };

    container.innerHTML = `
      <div style="margin-bottom:.5rem;font-weight:700;font-size:.82rem">
        Vista previa — ${this._datosCompras.length} registros a importar (mostrando primeros ${muestra.length}):
      </div>
      <table class="data-table">
        <thead><tr>
          <th>Fecha</th><th>Ticket</th><th>Lote</th><th>Proveedor</th>
          <th>QQ Baba</th><th>QQ Seco</th><th>Precio</th><th>Total</th>
        </tr></thead>
        <tbody>
          ${muestra.map(c => `<tr>
            <td>${fmtF(c.fecha)}</td>
            <td class="font-mono">${c.ticket}</td>
            <td style="font-size:.72rem">${c.lote}</td>
            <td style="font-size:.72rem">${c.proveedor.substring(0,30)}</td>
            <td class="number-cell">${fmt(c.qqBaba)}</td>
            <td class="number-cell">${fmt(c.qqSeco)}</td>
            <td class="number-cell">$${fmt(c.precio)}</td>
            <td class="money-cell">$${fmt(c.total)}</td>
          </tr>`).join('')}
          ${this._datosCompras.length > 5 ? `<tr><td colspan="8" class="text-center text-muted" style="font-size:.75rem">
            ... y ${this._datosCompras.length - 5} registros más</td></tr>` : ''}
        </tbody>
      </table>`;

    container.classList.remove('hidden');
    if (btnConf) btnConf.classList.remove('hidden');
  },

  _confirmarCompras() {
    if (!this._datosCompras.length) {
      App.toast('No hay datos para importar', 'warning'); return;
    }

    App.confirmar(
      `¿Importar <strong>${this._datosCompras.length}</strong> registros de compras?<br>
       <small>Los tickets duplicados se omitirán automáticamente.</small>`,
      () => {
        const result = DB.importarCompras(this._datosCompras);
        this._mostrarLog(result.logs);
        this._datosCompras = [];

        document.getElementById('import-preview-compras')?.classList.add('hidden');
        document.getElementById('btn-confirmar-import-compras')?.classList.add('hidden');

        Compras.cargar();
        Lotes.cargar();
        Inventario.cargar();
        Proveedores.cargar();
        App.actualizarDashboard();
        App.toast(`✅ ${result.insertados} compras importadas, ${result.errores} omitidas`, 'success');
      }
    );
  },

  // ============================================================
  //  PROCESAR INVENTARIO (hoja INVENTARIO 2026)
  // ============================================================
  _procesarInventario(rows) {
    this._datosInventario = [];
    let omitidas = 0;

    rows.forEach(row => {
      const nombre = this._col(row, ['NOMBRE/LOTE','nombre/lote','Nombre/Lote','LOTE','nombre']);
      if (!nombre || nombre.toString().includes('#N/A') || !nombre.toString().trim()) {
        omitidas++; return;
      }

      const costo   = this._col(row, ['COSTO TOTAL DE COMPRA','costo total','Costo Total']);
      const volBaba = this._col(row, ['VOLUMEN DE COMPRA BABA/SEMISECO','vol baba','Vol Baba']);
      const volSeco = this._col(row, ['VOLUMEN DE COMPRA EN QQ SECO','vol seco','QQ Seco']);
      const volReal = this._col(row, ['VOLUMEN REAL DEL PROCESO','vol real','Vol Real']);
      const estado  = this._col(row, ['STATUS','status','Estado','estado']);
      const pg      = this._col(row, ['PERDIDA & GANANCIA','P/G','Pérd. Ganancia']);
      const salida  = this._col(row, ['SALIDA','salida']);
      const saldo   = this._col(row, ['SALDO','saldo']);
      const perfil  = this._col(row, ['PERFIL DE CALIDAD','Perfil','perfil']);

      // Normalizar estado
      let estadoNorm = 'BODEGA';
      const estadoStr = (estado || '').toString().toUpperCase();
      if (estadoStr.includes('FERMENTAC')) estadoNorm = 'FERMENTACION';
      else if (estadoStr.includes('SECADO'))  estadoNorm = 'SECADO';
      else if (estadoStr.includes('BODEGA'))  estadoNorm = 'BODEGA';

      // Normalizar perfil
      let perfilNorm = 'EN PROCESO';
      const perfilStr = (perfil || '').toString().toUpperCase();
      if (perfilStr === 'PERFIL')        perfilNorm = 'PERFIL';
      else if (perfilStr === 'BASE')     perfilNorm = 'BASE';
      else if (perfilStr.includes('RECHAZADO')) perfilNorm = 'RECHAZADO PARA CONVENCIONAL';
      else if (perfilStr.includes('PROCESO'))   perfilNorm = 'EN PROCESO';

      // Normalizar P/G
      let pgNorm = 'IGUAL';
      const pgStr = (pg || '').toString().toUpperCase();
      if (pgStr.includes('GANANCIA'))  pgNorm = 'GANANCIA';
      else if (pgStr.includes('PERDIDA') || pgStr.includes('PÉRDIDA')) pgNorm = 'PERDIDA';

      this._datosInventario.push({
        nombre:    nombre.toString().trim(),
        costoTotal: this._num(costo),
        volBaba:   this._num(volBaba),
        volSeco:   this._num(volSeco),
        volReal:   this._num(volReal),
        estado:    estadoNorm,
        pg:        pgNorm,
        salida:    this._num(salida),
        saldo:     this._num(saldo),
        perfil:    perfilNorm
      });
    });

    this._log(`Lotes detectados: ${this._datosInventario.length}, filas omitidas: ${omitidas}`, 'info');

    if (!this._datosInventario.length) {
      App.toast('No se encontraron datos de inventario válidos', 'warning'); return;
    }

    this._mostrarPreviewInventario();
  },

  _mostrarPreviewInventario() {
    const container = document.getElementById('import-preview-inventario');
    const btnConf   = document.getElementById('btn-confirmar-import-inventario');
    if (!container) return;

    const muestra = this._datosInventario.slice(0, 6);
    const fmt = n => (parseFloat(n)||0).toFixed(2);

    container.innerHTML = `
      <div style="margin-bottom:.5rem;font-weight:700;font-size:.82rem">
        Vista previa — ${this._datosInventario.length} lotes a importar (mostrando primeros ${muestra.length}):
      </div>
      <table class="data-table">
        <thead><tr>
          <th>Nombre/Lote</th><th>QQ Seco</th><th>Vol. Real</th>
          <th>Estado</th><th>Saldo</th><th>Perfil</th>
        </tr></thead>
        <tbody>
          ${muestra.map(l => `<tr>
            <td style="font-size:.75rem;font-weight:600">${l.nombre}</td>
            <td class="number-cell">${fmt(l.volSeco)}</td>
            <td class="number-cell">${fmt(l.volReal)}</td>
            <td>${l.estado}</td>
            <td class="number-cell">${fmt(l.saldo)}</td>
            <td style="font-size:.72rem">${l.perfil}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;

    container.classList.remove('hidden');
    if (btnConf) btnConf.classList.remove('hidden');
  },

  _confirmarInventario() {
    if (!this._datosInventario.length) {
      App.toast('No hay datos para importar', 'warning'); return;
    }

    App.confirmar(
      `¿Importar <strong>${this._datosInventario.length}</strong> lotes de inventario?`,
      () => {
        const result = DB.importarLotes(this._datosInventario);
        this._mostrarLog(result.logs);
        this._datosInventario = [];

        document.getElementById('import-preview-inventario')?.classList.add('hidden');
        document.getElementById('btn-confirmar-import-inventario')?.classList.add('hidden');

        Lotes.cargar();
        Inventario.cargar();
        App.actualizarDashboard();
        App.toast(`✅ ${result.insertados} lotes importados`, 'success');
      }
    );
  },

  // ============================================================
  //  HELPERS
  // ============================================================

  // Obtener valor de columna por múltiples nombres posibles
  _col(row, names) {
    for (const name of names) {
      if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
        return row[name];
      }
    }
    // Búsqueda insensible a mayúsculas
    const keys = Object.keys(row);
    for (const name of names) {
      const found = keys.find(k => k.toLowerCase().replace(/\s+/g,'') === name.toLowerCase().replace(/\s+/g,''));
      if (found && row[found] !== undefined && row[found] !== '') return row[found];
    }
    return '';
  },

  // Convertir a número — maneja formatos: 1,234.56 / 1.234,56 / 1234.56
  _num(val) {
    if (val === null || val === undefined || val === '') return 0;
    let str = val.toString().trim();

    // Quitar símbolo $ y espacios
    str = str.replace(/[$\s]/g, '');

    // Si tiene coma Y punto: determinar cuál es decimal
    if (str.includes(',') && str.includes('.')) {
      // El último separador es el decimal
      const lastComma = str.lastIndexOf(',');
      const lastDot   = str.lastIndexOf('.');
      if (lastComma > lastDot) {
        // Formato europeo: 1.234,56 → quitar puntos, cambiar coma por punto
        str = str.replace(/\./g, '').replace(',', '.');
      } else {
        // Formato americano: 1,234.56 → quitar comas
        str = str.replace(/,/g, '');
      }
    } else if (str.includes(',')) {
      // Solo coma: puede ser decimal (1,56) o miles (1,234)
      const partes = str.split(',');
      if (partes.length === 2 && partes[1].length <= 2) {
        // Probablemente decimal: 1,56
        str = str.replace(',', '.');
      } else {
        // Miles: 1,234 → quitar coma
        str = str.replace(/,/g, '');
      }
    }

    const n = parseFloat(str);
    return isNaN(n) ? 0 : Math.round(n * 100000) / 100000; // 5 decimales máx
  },

  // Normalizar fecha a YYYY-MM-DD
  _normalizarFecha(val) {
    if (!val) return null;
    const s = val.toString().trim();

    // Ya está en formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // DD/MM/YYYY o DD-MM-YYYY
    const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m1) {
      const [, d, mo, y] = m1;
      return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }

    // DD-Mon-YYYY (17-Aug-2026)
    const meses = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
                   Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
    const m2 = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (m2) {
      const [, d, mes, y] = m2;
      const mo = meses[mes] || '01';
      return `${y}-${mo}-${d.padStart(2,'0')}`;
    }

    // Número serial de Excel (días desde 1900-01-01)
    const num = parseFloat(s);
    if (!isNaN(num) && num > 1000 && num < 100000) {
      const d = new Date((num - 25569) * 86400 * 1000);
      return d.toISOString().split('T')[0];
    }

    return null;
  },

  // Mostrar log en pantalla
  _mostrarLog(logs) {
    const container = document.getElementById('import-log');
    const content   = document.getElementById('import-log-content');
    if (!container || !content) return;

    content.innerHTML = logs.map(l => {
      const cls = { success: 'log-success', error: 'log-error', info: 'log-info', warn: 'log-warn' }[l.tipo] || '';
      const prefix = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' }[l.tipo] || '';
      return `<div class="${cls}">${prefix} ${l.msg}</div>`;
    }).join('');

    container.classList.remove('hidden');
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  _log(msg, tipo = 'info') {
    const content = document.getElementById('import-log-content');
    const container = document.getElementById('import-log');
    if (!content || !container) return;
    container.classList.remove('hidden');
    const cls = { success: 'log-success', error: 'log-error', info: 'log-info', warn: 'log-warn' }[tipo] || '';
    const prefix = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' }[tipo] || '';
    content.innerHTML += `<div class="${cls}">${prefix} ${msg}</div>`;
  }
};

