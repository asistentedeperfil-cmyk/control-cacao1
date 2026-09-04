/* =============================================
   PROVEEDORES.JS — Gestión de agricultores
   Sistema Control Cacao - FUMISA
   ============================================= */

const Proveedores = {

  _filtrados: [],
  _editandoId: null,

  init() {
    this._bindEvents();
    this.cargar();
  },

  _bindEvents() {
    document.getElementById('btn-nuevo-proveedor')?.addEventListener('click', () => this.abrirModal());
    document.getElementById('btn-guardar-proveedor')?.addEventListener('click', () => this.guardar());
    document.getElementById('btn-filtrar-prov')?.addEventListener('click', () => this.cargar());
    document.getElementById('filtro-proveedor')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.cargar();
    });
  },

  cargar() {
    const filtro = (document.getElementById('filtro-proveedor')?.value || '').toUpperCase();
    const todos  = DB.Proveedores.getAll();
    this._filtrados = filtro
      ? todos.filter(p => p.nombre.includes(filtro))
      : todos;
    this._renderTabla();
    const el = document.getElementById('proveedores-count');
    if (el) el.textContent = `${this._filtrados.length} proveedores`;
  },

  _renderTabla() {
    const tbody = document.getElementById('tbody-proveedores');
    if (!tbody) return;

    if (!this._filtrados.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-row">
        <i class="fa-solid fa-inbox"></i> No hay proveedores registrados</td></tr>`;
      return;
    }

    const fmt  = n => (parseFloat(n)||0).toFixed(2);
    const fmtM = n => '$' + (parseFloat(n)||0).toLocaleString('es-EC',{minimumFractionDigits:2});
    const canEdit   = Auth.hasRole('supervisor');
    const canDelete = Auth.isAdmin();

    tbody.innerHTML = this._filtrados.map((p, i) => {
      const stats = DB.Proveedores.getStats(p.nombre);
      return `<tr>
        <td class="text-muted" style="font-size:.8rem">${i + 1}</td>
        <td>
          <div style="font-weight:700;font-size:.85rem">${this._titleCase(p.nombre)}</div>
          ${p.cedula ? `<div style="font-size:.75rem;color:#64748b">${p.cedula}</div>` : ''}
        </td>
        <td class="text-center"><span class="badge">${stats.totalCompras}</span></td>
        <td class="number-cell">${fmt(stats.qqBaba)}</td>
        <td class="number-cell">${fmt(stats.qqSeco)}</td>
        <td class="money-cell">${fmtM(stats.totalPagado)}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon view" title="Ver historial" onclick="Proveedores.verHistorial('${p.nombre}')">
              <i class="fa-solid fa-clock-rotate-left"></i>
            </button>
            ${canEdit ? `<button class="btn-icon edit" title="Editar" onclick="Proveedores.abrirModal('${p.id}')">
              <i class="fa-solid fa-pen"></i>
            </button>` : ''}
            ${canDelete ? `<button class="btn-icon delete" title="Eliminar" onclick="Proveedores.eliminar('${p.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
  },

  abrirModal(id = null) {
    this._editandoId = id;
    const modal = document.getElementById('modal-proveedor');
    const form  = document.getElementById('form-proveedor');
    if (!modal) return;
    form.reset();

    if (id) {
      const p = DB.Proveedores.getById(id);
      if (!p) return;
      document.getElementById('p-nombre').value   = this._titleCase(p.nombre);
      document.getElementById('p-cedula').value   = p.cedula   || '';
      document.getElementById('p-telefono').value = p.telefono || '';
      document.getElementById('p-zona').value     = p.zona     || '';
      document.getElementById('p-obs').value      = p.obs      || '';
    }

    modal.classList.remove('hidden');
  },

  cerrarModal() {
    document.getElementById('modal-proveedor')?.classList.add('hidden');
    this._editandoId = null;
  },

  guardar() {
    const nombre = document.getElementById('p-nombre')?.value?.trim();
    if (!nombre) { App.toast('El nombre es obligatorio', 'warning'); return; }

    DB.Proveedores.save({
      id:       this._editandoId || undefined,
      nombre:   nombre.toUpperCase(),
      cedula:   document.getElementById('p-cedula')?.value?.trim()   || '',
      telefono: document.getElementById('p-telefono')?.value?.trim() || '',
      zona:     document.getElementById('p-zona')?.value?.trim()     || '',
      obs:      document.getElementById('p-obs')?.value?.trim()      || ''
    });

    this.cerrarModal();
    this.cargar();
    App.toast(this._editandoId ? 'Proveedor actualizado' : 'Proveedor registrado', 'success');
  },

  verHistorial(nombre) {
    const compras = DB.Compras.getFiltered({ proveedor: nombre });
    const totales = DB.Compras.totales(compras);
    const fmt  = n => (parseFloat(n)||0).toFixed(2);
    const fmtM = n => '$' + (parseFloat(n)||0).toLocaleString('es-EC',{minimumFractionDigits:2});
    const fmtF = f => { if (!f) return ''; const [y,m,d] = f.split('-'); return `${d}/${m}/${y}`; };

    let html = `
      <div style="display:flex;gap:1.5rem;flex-wrap:wrap;margin-bottom:.75rem;font-size:.82rem">
        <span>📦 <strong>${totales.registros}</strong> compras</span>
        <span>⚖️ QQ Seco: <strong>${fmt(totales.qqSeco)}</strong></span>
        <span>💵 Total: <strong>${fmtM(totales.totalPagado)}</strong></span>
      </div>
      <div style="overflow-x:auto;max-height:360px;overflow-y:auto">
      <table class="data-table">
        <thead><tr>
          <th>Fecha</th><th>Ticket</th><th>Lote</th>
          <th>Reporte Calidad</th><th>QQ Baba</th><th>QQ Seco</th><th>Total</th>
        </tr></thead><tbody>`;

    if (!compras.length) {
      html += `<tr><td colspan="7" class="empty-row"><i class="fa-solid fa-inbox"></i> Sin compras</td></tr>`;
    } else {
      compras.sort((a,b) => (b.fecha||'').localeCompare(a.fecha||'')).forEach(c => {
        html += `<tr>
          <td>${fmtF(c.fecha)}</td>
          <td class="font-bold font-mono">${c.ticket}</td>
          <td style="font-size:.75rem">${c.lote}</td>
          <td>${c.reporteCalidad || c.calidad}</td>
          <td class="number-cell">${fmt(c.qqBaba)}</td>
          <td class="number-cell">${fmt(c.qqSeco)}</td>
          <td class="money-cell">${fmtM(c.total)}</td>
        </tr>`;
      });
    }
    html += '</tbody></table></div>';

    const msg   = document.getElementById('confirm-message');
    const btnOk = document.getElementById('btn-confirm-ok');
    if (msg) msg.innerHTML = html;
    if (btnOk) { btnOk.textContent = 'Cerrar'; btnOk.className = 'btn btn-secondary'; }

    const modal = document.getElementById('modal-confirm');
    if (modal) {
      const h3 = modal.querySelector('.modal-header h3');
      if (h3) h3.innerHTML = `<i class="fa-solid fa-user"></i> ${this._titleCase(nombre)}`;
      modal.querySelector('.modal-dialog')?.style.setProperty('max-width','820px');
      modal.classList.remove('hidden');
      btnOk?.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.querySelector('.modal-dialog')?.style.removeProperty('max-width');
      }, { once: true });
    }
  },

  eliminar(id) {
    const p = DB.Proveedores.getById(id);
    if (!p) return;
    App.confirmar(
      `¿Eliminar al proveedor <strong>${this._titleCase(p.nombre)}</strong>?<br>
       <small class="text-danger">Las compras asociadas NO se eliminarán.</small>`,
      () => {
        DB.Proveedores.delete(id);
        this.cargar();
        App.toast('Proveedor eliminado', 'success');
      }
    );
  },

  _titleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }
};

/* =============================================
   USUARIOS — Módulo de gestión de usuarios
   ============================================= */
const Usuarios = {

  _editandoId: null,

  init() {
    this._bindEvents();
    this.cargar();
  },

  _bindEvents() {
    document.getElementById('btn-nuevo-usuario')?.addEventListener('click', () => this.abrirModal());
    document.getElementById('btn-guardar-usuario')?.addEventListener('click', () => this.guardar());
  },

  cargar() {
    const tbody = document.getElementById('tbody-usuarios');
    if (!tbody) return;
    const list = DB.Usuarios.getAll();
    const canDelete = Auth.isAdmin();

    tbody.innerHTML = list.map(u => `
      <tr>
        <td class="font-bold">${u.usuario}</td>
        <td>${u.nombre}</td>
        <td>${this._badgeRol(u.rol)}</td>
        <td>
          <span class="status-badge ${u.activo ? 'status-bodega' : 'status-rechazado'}">
            <i class="fa-solid ${u.activo ? 'fa-check' : 'fa-xmark'}"></i>
            ${u.activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon edit" title="Editar" onclick="Usuarios.abrirModal('${u.id}')">
              <i class="fa-solid fa-pen"></i>
            </button>
            ${u.id !== Auth.getUser()?.id && canDelete ? `
            <button class="btn-icon delete" title="Eliminar" onclick="Usuarios.eliminar('${u.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>` : ''}
          </div>
        </td>
      </tr>`).join('');
  },

  abrirModal(id = null) {
    this._editandoId = id;
    const modal = document.getElementById('modal-usuario');
    const form  = document.getElementById('form-usuario');
    if (!modal) return;
    form.reset();

    if (id) {
      const u = DB.Usuarios.getById(id);
      if (!u) return;
      document.getElementById('u-nombre').value  = u.nombre;
      document.getElementById('u-usuario').value = u.usuario;
      document.getElementById('u-rol').value     = u.rol;
      document.getElementById('u-password').required = false;
      document.getElementById('u-password').placeholder = '(dejar vacío para no cambiar)';
    } else {
      document.getElementById('u-password').required = true;
      document.getElementById('u-password').placeholder = 'Contraseña';
    }

    modal.classList.remove('hidden');
  },

  cerrarModal() {
    document.getElementById('modal-usuario')?.classList.add('hidden');
    this._editandoId = null;
  },

  guardar() {
    const nombre  = document.getElementById('u-nombre')?.value?.trim();
    const usuario = document.getElementById('u-usuario')?.value?.trim();
    const pass    = document.getElementById('u-password')?.value;
    const rol     = document.getElementById('u-rol')?.value;

    if (!nombre || !usuario || !rol) {
      App.toast('Todos los campos son obligatorios', 'warning');
      return;
    }
    if (!this._editandoId && !pass) {
      App.toast('La contraseña es obligatoria para nuevo usuario', 'warning');
      return;
    }

    // Verificar usuario duplicado
    const existe = DB.Usuarios.getByUser(usuario);
    if (existe && existe.id !== this._editandoId) {
      App.toast(`El usuario "${usuario}" ya existe`, 'error');
      return;
    }

    const data = { nombre, usuario, rol, activo: true };
    if (this._editandoId) {
      data.id = this._editandoId;
      if (pass) data.password = pass;
    } else {
      data.password = pass;
    }

    DB.Usuarios.save(data);
    this.cerrarModal();
    this.cargar();
    App.toast(this._editandoId ? 'Usuario actualizado' : 'Usuario creado', 'success');
  },

  eliminar(id) {
    const u = DB.Usuarios.getById(id);
    if (!u) return;
    if (u.id === Auth.getUser()?.id) {
      App.toast('No puedes eliminarte a ti mismo', 'error');
      return;
    }
    App.confirmar(`¿Eliminar el usuario <strong>${u.usuario}</strong>?`, () => {
      DB.Usuarios.delete(id);
      this.cargar();
      App.toast('Usuario eliminado', 'success');
    });
  },

  _badgeRol(rol) {
    const map = {
      admin:      ['#ef4444','Administrador'],
      supervisor: ['#f59e0b','Supervisor'],
      operador:   ['#3b82f6','Operador']
    };
    const [color, label] = map[rol] || ['#64748b', rol];
    return `<span style="font-size:.72rem;font-weight:700;color:${color}">${label}</span>`;
  }
};

