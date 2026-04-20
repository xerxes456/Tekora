/**
 * Tekora — js/pages/equipment.js
 * Equipment page (user view + admin view)
 */
"use strict";

async function loadEquipment() {
  loading('equipment-table-wrap');
  await loadCaches();
  try {
    let list = _equipment;
    if (!isAdmin() && userProfile.facilityId) {
      list = _equipment.filter(e => e.facilityIds && e.facilityIds.includes(userProfile.facilityId));
    }
    if (!list.length) { setHTML('equipment-table-wrap', emptyState('No equipment found for your facility')); return; }
    renderEquipTable('equipment-table-wrap', list, false);
  } catch (e) { toast('Failed to load equipment', 'error'); }
}

async function loadAdminEquipment() {
  loading('admin-equipment-table-wrap');
  await loadCaches();
  renderEquipTable('admin-equipment-table-wrap', _equipment, true);
}

function renderEquipTable(wrapId, list, fullAdmin) {
  if (!list.length) { setHTML(wrapId, emptyState('No equipment records')); return; }
  setHTML(wrapId, `
    <table>
      <thead><tr><th>Name</th><th>Type</th><th>Manufacturer</th><th>Model</th><th>State</th><th>Maint. Type</th><th>Current MRH</th><th>Total MRH</th><th>Actions</th></tr></thead>
      <tbody>
        ${list.map(e => `<tr>
          <td><div class="td-primary">${e.name || '—'}</div><div class="td-secondary">${e.capacity || ''}</div></td>
          <td class="text-muted small">${e.type || '—'}</td>
          <td class="text-muted small">${e.manufacturer || '—'}</td>
          <td class="text-muted small">${e.model || '—'}</td>
          <td>${stateBadge(e.state || 'Operational')}</td>
          <td><span class="badge badge-purple">${e.maintenanceType || '—'}</span></td>
          <td class="mono text-accent fw7">${(e.currentMRH || 0).toLocaleString()}</td>
          <td class="mono text-muted small">${(e.totalMRH || 0).toLocaleString()}</td>
          <td><div class="actions-cell">
            <button class="btn btn-ghost btn-sm" onclick="openEditModal('equipment','${e.id}')">
              ${icon('icon-edit', '12px')} Edit
            </button>
            ${fullAdmin
              ? `<button class="btn btn-danger btn-sm btn-icon" onclick="deleteDoc('equipment','${e.id}',loadAdminEquipment)">
                   ${icon('icon-trash', '13px')}
                 </button>` : ''}
          </div></td>
        </tr>`).join('')}
      </tbody>
    </table>`);
}
