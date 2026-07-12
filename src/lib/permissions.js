export const roleLabels = {
  owner: 'Propietario',
  admin: 'Administrador',
  reception: 'Recepción',
  mechanic: 'Mecánico',
  viewer: 'Solo lectura'
}

const pagePermissions = {
  dashboard: ['owner', 'admin', 'reception', 'mechanic', 'viewer'],
  agenda: ['owner', 'admin', 'reception', 'viewer'],
  clientes: ['owner', 'admin', 'reception', 'mechanic', 'viewer'],
  motos: ['owner', 'admin', 'reception', 'mechanic', 'viewer'],
  recepcion: ['owner', 'admin', 'reception'],
  ordenes: ['owner', 'admin', 'reception', 'mechanic', 'viewer'],
  presupuestos: ['owner', 'admin', 'reception', 'viewer'],
  facturas: ['owner', 'admin', 'reception', 'viewer'],
  inventario: ['owner', 'admin', 'mechanic', 'viewer'],
  reportes: ['owner', 'admin', 'viewer'],
  equipo: ['owner', 'admin'],
  configuracion: ['owner', 'admin']
}

export function canAccessPage(role, page) {
  return pagePermissions[page]?.includes(role) ?? false
}

export function isReadOnlyRole(role) {
  return role === 'viewer'
}
