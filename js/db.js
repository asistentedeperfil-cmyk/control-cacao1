/* =============================================
   DB.JS — Base de datos local con localStorage
   Sistema Control Cacao - FUMISA
   ============================================= */

const DB = {

  // ---- Claves en localStorage ----
  KEYS: {
    USUARIOS:    'fumisa_usuarios',
    COMPRAS:     'fumisa_compras',
    LOTES:       'fumisa_lotes',
    PROVEEDORES: 'fumisa_proveedores',
    INVENTARIO:  'fumisa_inventario',
    CONFIG:      'fumisa_config',
    SESSION:     'fumisa_session'
  },

  // ============================================================
  //  UTILIDADES
  // ============================================================
  _get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('DB._get error:', key, e);
      return null;
    }
  },

  _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('DB._set error:', key, e);
      return false;
    }
  },

  // Genera un ID único
  _newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  // Timestamp ISO
  _now() {
    return new Date().toISOString();
  },

  // ============================================================
  //  INICIALIZACIÓN
  // ============================================================
  init() {
    // Crear usuario admin por defecto si no existe
    if (!this._get(this.KEYS.USUARIOS)) {
      this._set(this.KEYS.USUARIOS, [
        {
          id: 'u001',
          nombre: 'Administrador',
          usuario: 'admin',
          password: 'admin123',
          rol: 'admin',
          activo: true,
          creado: this._now()
        },
        {
          id: 'u002',
          nombre: 'Operador',
          usuario: 'operador',
          password: 'op123',
          rol: 'operador',
          activo: true,
          creado: this._now()
        }
      ]);
    }

    // Inicializar colecciones vacías si no existen
    if (!this._get(this.KEYS.COMPRAS))     this._set(this.KEYS.COMPRAS, []);
    if (!this._get(this.KEYS.LOTES))       this._set(this.KEYS.LOTES, []);
    if (!this._get(this.KEYS.PROVEEDORES)) this._set(this.KEYS.PROVEEDORES, []);
    if (!this._get(this.KEYS.INVENTARIO))  this._set(this.KEYS.INVENTARIO, this._defaultInventario());

    // Config
    if (!this._get(this.KEYS.CONFIG)) {
      this._set(this.KEYS.CONFIG, {
        empresa: 'FUMISA',
        anio: 2026,
        moneda: '$',
        decimales: 2
      });
    }

    console.log('[DB] Inicializado correctamente.');
  },

  _defaultInventario() {
    return {
      resumen: [],
      lotesProcessados: [
        { detalle: 'FERRERO 0716  G1 ITALIA 100tm', calidad: 'GRADO 1 PERFIL', qq: 2352.89, ton: 106.73 },
        { detalle: 'FERRERO 0714  G1 ITALIA 50tm',  calidad: 'GRADO 1 PERFIL', qq: 1145.57, ton: 51.96  },
        { detalle: 'LOTE CONVENCIONAL 50tm',         calidad: 'GRADO ?',        qq: 774.33,  ton: 35.12  }
      ],
      subproductos: [
        { detalle: 'TRITURADO PERFIL', calidad: 'TRITURADO', qq: 1153.90, ton: 52.34 }
      ]
    };
  },

  // ============================================================
  //  USUARIOS
  // ============================================================
  Usuarios: {
    getAll()       { return DB._get(DB.KEYS.USUARIOS) || []; },
    getById(id)    { return this.getAll().find(u => u.id === id) || null; },
    getByUser(usr) { return this.getAll().find(u => u.usuario === usr) || null; },

    save(data) {
      const list = this.getAll();
      if (data.id) {
        const idx = list.findIndex(u => u.id === data.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...data };
        else list.push(data);
      } else {
        data.id = DB._newId();
        data.creado = DB._now();
        list.push(data);
      }
      DB._set(DB.KEYS.USUARIOS, list);
      return data;
    },

    delete(id) {
      const list = this.getAll().filter(u => u.id !== id);
      DB._set(DB.KEYS.USUARIOS, list);
    }
  },

  // ============================================================
  //  PROVEEDORES
  // ============================================================
  Proveedores: {
    getAll()    { return DB._get(DB.KEYS.PROVEEDORES) || []; },
    getById(id) { return this.getAll().find(p => p.id === id) || null; },

    getByNombre(nombre) {
      const n = nombre.trim().toUpperCase();
      return this.getAll().find(p => p.nombre.toUpperCase() === n) || null;
    },

    getNombres() {
      return this.getAll().map(p => p.nombre).sort();
    },

    save(data) {
      const list = this.getAll();
      if (data.id) {
        const idx = list.findIndex(p => p.id === data.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...data };
        else list.push(data);
      } else {
        // Evitar duplicados por nombre
        const existe = this.getByNombre(data.nombre);
        if (existe) return existe;
        data.id = DB._newId();
        data.creado = DB._now();
        list.push(data);
      }
      DB._set(DB.KEYS.PROVEEDORES, list);
      return data;
    },

    // Asegura que el proveedor exista (crea si no)
    ensureExiste(nombre) {
      if (!nombre || !nombre.trim()) return null;
      const existe = this.getByNombre(nombre.trim());
      if (existe) return existe;
      return this.save({ nombre: nombre.trim().toUpperCase(), cedula: '', telefono: '', zona: '', obs: '' });
    },

    delete(id) {
      const list = this.getAll().filter(p => p.id !== id);
      DB._set(DB.KEYS.PROVEEDORES, list);
    },

    // Estadísticas de un proveedor
    getStats(nombre) {
      const compras = DB.Compras.getAll().filter(
        c => c.proveedor.toUpperCase() === nombre.toUpperCase()
      );
      return {
        totalCompras: compras.length,
        qqBaba: compras.reduce((s, c) => s + (parseFloat(c.qqBaba) || 0), 0),
        qqSeco: compras.reduce((s, c) => s + (parseFloat(c.qqSeco) || 0), 0),
        totalPagado: compras.reduce((s, c) => s + (parseFloat(c.total) || 0), 0)
      };
    }
  },

  // ============================================================
  //  COMPRAS
  // ============================================================
  Compras: {
    getAll()    { return DB._get(DB.KEYS.COMPRAS) || []; },
    getById(id) { return this.getAll().find(c => c.id === id) || null; },

    // Filtros combinados
    getFiltered({ fecha, calidad, proveedor, lote, semana, anio } = {}) {
      let list = this.getAll();
      if (fecha)      list = list.filter(c => c.fecha === fecha);
      if (calidad)    list = list.filter(c => c.calidad === calidad);
      if (proveedor)  list = list.filter(c => c.proveedor.toUpperCase().includes(proveedor.toUpperCase()));
      if (lote)       list = list.filter(c => c.lote === lote);
      if (semana)     list = list.filter(c => c.semana == semana);
      if (anio)       list = list.filter(c => c.anio == anio);
      return list;
    },

    getByFecha(fecha) { return this.getFiltered({ fecha }); },
    getByLote(lote)   { return this.getFiltered({ lote }); },

    // Obtener hoy
    getHoy() {
      const hoy = new Date().toISOString().split('T')[0];
      return this.getByFecha(hoy);
    },

    // Próximo número de ticket sugerido
    nextTicket() {
      const all = this.getAll();
      if (!all.length) return 'P30000';
      const nums = all
        .map(c => parseInt((c.ticket || '').replace(/\D/g, '')) || 0)
        .filter(n => n > 0);
      const max = nums.length ? Math.max(...nums) : 30000;
      return 'P' + (max + 1);
    },

    save(data) {
      const list = this.getAll();
      if (data.id) {
        const idx = list.findIndex(c => c.id === data.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...data, modificado: DB._now() };
        else list.push(data);
      } else {
        data.id = DB._newId();
        data.creado = DB._now();
        // Calcular totales automáticamente si faltan
        if (data.qqSeco && data.precio && !data.total) {
          data.total = parseFloat((data.qqSeco * data.precio).toFixed(2));
        }
        if (data.qqSeco && !data.ton) {
          data.ton = parseFloat((data.qqSeco / 22.046).toFixed(3));
        }
        list.push(data);
        // Auto-crear proveedor si no existe
        DB.Proveedores.ensureExiste(data.proveedor);
        // Auto-crear lote si no existe
        DB.Lotes.ensureLote(data.lote, data.calidad);
      }
      DB._set(DB.KEYS.COMPRAS, list);
      return data;
    },

    delete(id) {
      const list = this.getAll().filter(c => c.id !== id);
      DB._set(DB.KEYS.COMPRAS, list);
    },

    // Resumen totales de un conjunto de compras
    totales(compras) {
      return {
        registros:   compras.length,
        qqBaba:      compras.reduce((s, c) => s + (parseFloat(c.qqBaba) || 0), 0),
        qqSeco:      compras.reduce((s, c) => s + (parseFloat(c.qqSeco) || 0), 0),
        ton:         compras.reduce((s, c) => s + (parseFloat(c.ton)    || 0), 0),
        totalPagado: compras.reduce((s, c) => s + (parseFloat(c.total)  || 0), 0)
      };
    },

    // Agrupar por calidad
    porCalidad(compras) {
      const grupos = {};
      compras.forEach(c => {
        const cal = c.calidad || 'OTRO';
        if (!grupos[cal]) grupos[cal] = { calidad: cal, registros: 0, qqBaba: 0, qqSeco: 0, total: 0 };
        grupos[cal].registros++;
        grupos[cal].qqBaba += parseFloat(c.qqBaba) || 0;
        grupos[cal].qqSeco += parseFloat(c.qqSeco) || 0;
        grupos[cal].total  += parseFloat(c.total)  || 0;
      });
      return Object.values(grupos);
    },

    // Agrupar por semana
    porSemana() {
      const grupos = {};
      this.getAll().forEach(c => {
        const key = `${c.anio}-S${c.semana}`;
        if (!grupos[key]) grupos[key] = { key, anio: c.anio, semana: c.semana, registros: 0, qqSeco: 0, total: 0 };
        grupos[key].registros++;
        grupos[key].qqSeco += parseFloat(c.qqSeco) || 0;
        grupos[key].total  += parseFloat(c.total)  || 0;
      });
      return Object.values(grupos).sort((a, b) => a.semana - b.semana);
    }
  },

  // ============================================================
  //  LOTES
  // ============================================================
  Lotes: {
    getAll()         { return DB._get(DB.KEYS.LOTES) || []; },
    getById(id)      { return this.getAll().find(l => l.id === id) || null; },
    getByNombre(nom) { return this.getAll().find(l => l.nombre === nom) || null; },

    getActivos() {
      return this.getAll().filter(l => ['FERMENTACION','SECADO','BODEGA'].includes(l.estado));
    },

    getFiltered({ estado, tipo } = {}) {
      let list = this.getAll();
      if (estado) list = list.filter(l => l.estado === estado);
      if (tipo)   list = list.filter(l => l.nombre.startsWith(tipo));
      return list;
    },

    // Asegura que el lote exista; crea uno mínimo si no
    ensureLote(nombre, calidad) {
      if (!nombre || !nombre.trim()) return null;
      const existe = this.getByNombre(nombre.trim());
      if (existe) return existe;
      return this.save({
        nombre: nombre.trim(),
        calidad: calidad || '',
        costoTotal: 0,
        volBaba: 0,
        volSeco: 0,
        volReal: 0,
        estado: 'FERMENTACION',
        pg: 'IGUAL',
        salida: 0,
        saldo: 0,
        perfil: 'EN PROCESO'
      });
    },

    save(data) {
      const list = this.getAll();
      if (data.id) {
        const idx = list.findIndex(l => l.id === data.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...data, modificado: DB._now() };
        else list.push(data);
      } else {
        // No duplicar nombre
        const existe = this.getByNombre(data.nombre);
        if (existe) {
          // Actualizar en vez de duplicar
          const idx = list.findIndex(l => l.id === existe.id);
          list[idx] = { ...existe, ...data };
          DB._set(DB.KEYS.LOTES, list);
          return list[idx];
        }
        data.id = DB._newId();
        data.creado = DB._now();
        list.push(data);
      }
      DB._set(DB.KEYS.LOTES, list);
      return data;
    },

    delete(id) {
      const list = this.getAll().filter(l => l.id !== id);
      DB._set(DB.KEYS.LOTES, list);
    },

    // Recalcular totales de un lote a partir de sus compras
    recalcular(nombre) {
      if (!nombre || !nombre.trim()) return;
      const compras = DB.Compras.getByLote(nombre.trim());
      const lote    = this.getByNombre(nombre.trim());
      if (!lote) return;

      const totales = DB.Compras.totales(compras);

      // volReal = suma de qqSeco de todas las compras del lote
      // Si el lote tiene un volReal manual mayor (editado), lo respetamos
      const nuevoVolReal = totales.qqSeco;

      this.save({
        ...lote,
        costoTotal: parseFloat(totales.totalPagado.toFixed(2)),
        volBaba:    parseFloat(totales.qqBaba.toFixed(2)),
        volSeco:    parseFloat(totales.qqSeco.toFixed(2)),
        volReal:    parseFloat(nuevoVolReal.toFixed(2)),
        saldo:      lote.saldo > 0 ? lote.saldo : parseFloat(nuevoVolReal.toFixed(2))
      });
    }
  },

  // ============================================================
  //  INVENTARIO
  // ============================================================
  Inventario: {
    get()     { return DB._get(DB.KEYS.INVENTARIO) || DB._defaultInventario(); },
    set(data) { DB._set(DB.KEYS.INVENTARIO, data); },

    // Calcular resumen dinámico desde lotes
    calcularResumen() {
      const lotes = DB.Lotes.getAll();
      const grupos = {
        'PERFIL':                     { detalle: 'TOTAL QQ DE CACAO PERFIL',                        calidad: 'PERFIL',                         qq: 0, ton: 0 },
        'BASE':                       { detalle: 'TOTAL QQ DE CACAO BASE',                           calidad: 'BASE',                            qq: 0, ton: 0 },
        'EN PROCESO':                 { detalle: 'TOTAL QQ DE CACAO EN PROCESO',                     calidad: 'EN PROCESO',                      qq: 0, ton: 0 },
        'RECHAZADO PARA CONVENCIONAL':{ detalle: 'TOTAL QQ DE CACAO RECHAZADO PARA CONVENCIONAL',   calidad: 'RECHAZADO PARA CONVENCIONAL',     qq: 0, ton: 0 }
      };

      lotes.forEach(l => {
        const vol = parseFloat(l.volReal) || parseFloat(l.saldo) || 0;
        const perfil = l.perfil || 'EN PROCESO';
        if (grupos[perfil]) {
          grupos[perfil].qq  += vol;
          grupos[perfil].ton += parseFloat((vol / 22.046).toFixed(3));
        }
      });

      return Object.values(grupos).map(g => ({
        ...g,
        qq:  parseFloat(g.qq.toFixed(2)),
        ton: parseFloat(g.ton.toFixed(2))
      }));
    },

    // Total general de inventario
    totalGeneral() {
      const inv = this.get();
      const resumen = this.calcularResumen();
      const enProceso = resumen.reduce((s, r) => s + r.qq, 0);
      const procesados = (inv.lotesProcessados || []).reduce((s, l) => s + l.qq, 0);
      const subproductos = (inv.subproductos || []).reduce((s, s2) => s + s2.qq, 0);
      return {
        qqTotal:  parseFloat((enProceso + procesados + subproductos).toFixed(2)),
        tonTotal: parseFloat(((enProceso + procesados + subproductos) / 22.046).toFixed(2))
      };
    }
  },

  // ============================================================
  //  CONFIG
  // ============================================================
  Config: {
    get()      { return DB._get(DB.KEYS.CONFIG) || {}; },
    set(data)  { DB._set(DB.KEYS.CONFIG, data); },
    update(partial) {
      const cfg = this.get();
      DB._set(DB.KEYS.CONFIG, { ...cfg, ...partial });
    }
  },

  // ============================================================
  //  IMPORTACIÓN MASIVA
  // ============================================================
  importarCompras(rows) {
    let insertados = 0, errores = 0, logs = [];
    const lotesAfectados = new Set(); // para recalcular al final

    rows.forEach((row, i) => {
      try {
        // Validaciones mínimas
        if (!row.fecha || !row.proveedor || !row.ticket) {
          logs.push({ tipo: 'warn', msg: `Fila ${i+1}: omitida (faltan campos: fecha/proveedor/ticket)` });
          errores++;
          return;
        }

        // Verificar si el ticket ya existe (comparación exacta)
        const ticketBuscar = row.ticket.toString().trim().toUpperCase();
        const ya = this.Compras.getAll().find(
          c => c.ticket.toString().trim().toUpperCase() === ticketBuscar
        );
        if (ya) {
          // No contar como error, es esperado en reimportaciones
          return;
        }

        // Guardar con valores ya normalizados desde importar.js
        this.Compras.save({
          fecha:          row.fecha,
          calidad:        (row.calidad || '').toUpperCase(),
          anio:           row.anio           || 26,
          semana:         row.semana         || '',
          dia:            row.dia            || '',
          lote:           (row.lote || '').trim(),
          ticket:         row.ticket,
          proveedor:      row.proveedor.trim().toUpperCase(),
          reporteCalidad: row.reporteCalidad || '',
          calidadOdoo:    row.calidadOdoo    || '',
          qqBaba:         parseFloat(row.qqBaba)  || 0,
          qqSeco:         parseFloat(row.qqSeco)  || 0,
          ton:            parseFloat(row.ton)     || 0,
          precio:         parseFloat(row.precio)  || 0,
          total:          parseFloat(row.total)   || 0
        });

        if (row.lote) lotesAfectados.add(row.lote.trim());
        insertados++;
      } catch (e) {
        logs.push({ tipo: 'error', msg: `Fila ${i+1} [${row.ticket||'?'}] error: ${e.message}` });
        errores++;
      }
    });

    // Recalcular QQ de todos los lotes afectados al final
    const totalLotes = lotesAfectados.size;
    lotesAfectados.forEach(nombre => {
      try { this.Lotes.recalcular(nombre); } catch(e) {}
    });

    logs.unshift({
      tipo: 'success',
      msg: `Importación completa: ${insertados} tickets nuevos, ${totalLotes} lotes recalculados, ${errores} errores.`
    });
    return { insertados, errores, logs };
  },

  importarLotes(rows) {
    let insertados = 0, errores = 0, logs = [];

    rows.forEach((row, i) => {
      try {
        if (!row.nombre) {
          errores++;
          return;
        }
        this.Lotes.save({
          nombre:    row.nombre,
          costoTotal: parseFloat(row.costoTotal) || 0,
          volBaba:   parseFloat(row.volBaba)     || 0,
          volSeco:   parseFloat(row.volSeco)     || 0,
          volReal:   parseFloat(row.volReal)     || 0,
          estado:    row.estado                  || 'BODEGA',
          pg:        row.pg                      || 'IGUAL',
          salida:    parseFloat(row.salida)      || 0,
          saldo:     parseFloat(row.saldo)       || 0,
          perfil:    row.perfil                  || 'EN PROCESO'
        });
        insertados++;
      } catch (e) {
        logs.push({ tipo: 'error', msg: `Fila ${i+1}: ${e.message}` });
        errores++;
      }
    });

    logs.unshift({ tipo: 'info', msg: `Lotes: ${insertados} procesados, ${errores} errores.` });
    return { insertados, errores, logs };
  },

  // ============================================================
  //  EXPORTAR TODO (backup)
  // ============================================================
  exportarTodo() {
    return {
      version: '1.0',
      fecha: this._now(),
      compras:     this.Compras.getAll(),
      lotes:       this.Lotes.getAll(),
      proveedores: this.Proveedores.getAll(),
      inventario:  this.Inventario.get(),
      usuarios:    this.Usuarios.getAll()
    };
  },

  // ============================================================
  //  ESTADÍSTICAS GENERALES (para dashboard)
  // ============================================================
  dashboard() {
    const hoy = new Date().toISOString().split('T')[0];
    const comprasHoy = this.Compras.getByFecha(hoy);
    const totHoy = this.Compras.totales(comprasHoy);
    const lotesActivos = this.Lotes.getActivos();
    const invTotal = this.Inventario.totalGeneral();
    const ultimasCompras = this.Compras.getAll()
      .sort((a, b) => (b.creado || '').localeCompare(a.creado || ''))
      .slice(0, 8);
    const semanas = this.Compras.porSemana().slice(-4);
    const porCalidad = this.Compras.porCalidad(this.Compras.getAll());

    return {
      comprasHoy:    comprasHoy.length,
      qqHoy:         totHoy.qqSeco.toFixed(2),
      lotesActivos:  lotesActivos.length,
      qqInventario:  invTotal.qqTotal.toFixed(2),
      ultimasCompras,
      lotesActivos_list: lotesActivos.slice(0, 6),
      porCalidad,
      semanas
    };
  }
};

// Inicializar al cargar
DB.init();

