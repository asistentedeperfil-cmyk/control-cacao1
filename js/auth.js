/* =============================================
   AUTH.JS — Sistema de autenticación y sesión
   Sistema Control Cacao - FUMISA
   ============================================= */

const Auth = {

  // Usuario actualmente logueado
  currentUser: null,

  // ---- Inicializar ----
  init() {
    const session = DB._get(DB.KEYS.SESSION);
    if (session && session.userId) {
      const user = DB.Usuarios.getById(session.userId);
      if (user && user.activo) {
        this.currentUser = user;
        return true; // sesión válida
      }
    }
    return false; // no hay sesión
  },

  // ---- Login ----
  login(usuario, password) {
    const user = DB.Usuarios.getByUser(usuario.trim());
    if (!user) return { ok: false, msg: 'Usuario no encontrado' };
    if (!user.activo) return { ok: false, msg: 'Usuario inactivo' };
    if (user.password !== password) return { ok: false, msg: 'Contraseña incorrecta' };

    this.currentUser = user;
    DB._set(DB.KEYS.SESSION, {
      userId:    user.id,
      loginTime: new Date().toISOString()
    });
    return { ok: true, user };
  },

  // ---- Logout ----
  logout() {
    this.currentUser = null;
    localStorage.removeItem(DB.KEYS.SESSION);
  },

  // ---- Verificar rol ----
  hasRole(rol) {
    if (!this.currentUser) return false;
    const jerarquia = { operador: 1, supervisor: 2, admin: 3 };
    return (jerarquia[this.currentUser.rol] || 0) >= (jerarquia[rol] || 0);
  },

  isAdmin()      { return this.hasRole('admin'); },
  isSupervisor() { return this.hasRole('supervisor'); },

  // ---- Obtener usuario actual ----
  getUser() { return this.currentUser; },

  // ---- Cambiar contraseña ----
  changePassword(userId, newPass) {
    const user = DB.Usuarios.getById(userId);
    if (!user) return false;
    DB.Usuarios.save({ ...user, password: newPass });
    return true;
  }
};

