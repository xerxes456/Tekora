/**
 * Tekora — js/pages/facilities.js
 * Admin: Facilities CRUD + decommission
 */
"use strict";

async function loadFacilities() {
  loading('facilities-table-wrap');
  await loadCaches();
  if (!_facilities.length) {
    setHTML('facilities-table-wrap', emptyState('No facilities yet')); return;
  }
  setHTML('facilities-table-wrap', `
    <table>
      <thead><tr><th>Name</th><th>Type</th><th>Location</th><th>Capacity</th><th>State</th><th>Fuel Type</th><th>Actions</th></tr></thead>
      <tbody>
        ${_facilities.map(f => `<tr>
          <td class="td-primary">${f.name}</td>
          <td><span class="badge badge-blue">${f.type || '—'}</span></td>
          <td class="text-muted small">${f.location || '—'}</td>
          <td class="text-muted small">${f.holdingCapacity || '—'}</td>
          <td>${stateBadge(f.state || 'Operational')}</td>
          <td class="text-muted small">${f.fuelType || '—'}</td>
          <td><div class="actions-cell">
            <button class="btn btn-ghost btn-sm" onclick="openEditModal('facility','${f.id}')">
              ${icon('icon-edit','12px')} Edit
            </button>
            <button class="btn btn-danger btn-sm btn-icon" title="Decommission" onclick="decommission('${f.id}')">
              ${icon('icon-close','13px')}
            </button>
            <button class="btn btn-danger btn-sm btn-icon" title="Delete" onclick="deleteDoc('facilities','${f.id}',loadFacilities)">
              ${icon('icon-trash','13px')}
            </button>
          </div></td>
        </tr>`).join('')}
      </tbody>
    </table>`);
}

async function decommission(id) {
  if (!confirm('Decommission this facility? It will be marked inactive.')) return;
  try {
    await db.collection('facilities').doc(id).update({ state: 'Decommissioned' });
    toast('Facility decommissioned', 'info');
    await loadCaches();
    loadFacilities();
  } catch (e) { toast('Failed', 'error'); }
}
