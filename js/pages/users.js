/**
 * Tekora — js/pages/users.js
 * Admin: Users management — roles, facility assignment, admin grant
 */
"use strict";

async function loadUsers() {
  loading('users-table-wrap');
  if (!isAdmin()) { setHTML('users-table-wrap', emptyState('Admin access required')); return; }
  try {
    const snap = await db.collection('users').get();
    _users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!_users.length) { setHTML('users-table-wrap', emptyState('No users found')); return; }
    setHTML('users-table-wrap', `
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Position</th><th>Role</th><th>Facility</th><th>Admin</th><th>Actions</th></tr></thead>
        <tbody>
          ${_users.map(u => `<tr>
            <td class="td-primary">${(u.firstName || '') + ' ' + (u.lastName || '')}</td>
            <td class="text-muted small">${u.email || '—'}</td>
            <td class="text-muted small">${u.position || '—'}</td>
            <td><span class="badge badge-gray">${u.role || 'operator'}</span></td>
            <td class="text-muted small">${getFacilityName(u.facilityId)}</td>
            <td>${u.isAdmin
                  ? '<span class="badge badge-amber">Admin</span>'
                  : u.adminRequested
                    ? '<span class="badge badge-blue">Requested</span>'
                    : '<span class="badge badge-gray">No</span>'}</td>
            <td><div class="actions-cell">
              <button class="btn btn-ghost btn-sm" onclick="openEditModal('user-role','${u.id}')">
                ${icon('icon-edit','12px')} Edit Role
              </button>
              ${u.adminRequested && !u.isAdmin
                ? `<button class="btn btn-primary btn-sm" onclick="grantAdmin('${u.id}')">Grant Admin</button>`
                : ''}
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table>`);
  } catch (e) { toast('Failed to load users', 'error'); }
}

async function grantAdmin(uid) {
  if (!confirm('Grant admin privileges to this user?')) return;
  try {
    await db.collection('users').doc(uid).update({ isAdmin: true, role: 'admin', adminRequested: false });
    toast('Admin granted');
    loadUsers();
  } catch (e) { toast('Failed', 'error'); }
}
