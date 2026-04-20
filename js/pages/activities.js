/**
 * Tekora — js/pages/activities.js
 * Admin: Maintenance Activities CRUD
 */
"use strict";

async function loadActivities() {
  loading('activities-table-wrap');
  await loadCaches();
  if (!_activities.length) {
    setHTML('activities-table-wrap', emptyState('No activities yet')); return;
  }
  const catColors = {
    PMS: 'badge-green', Corrective: 'badge-red',
    Overhaul: 'badge-purple', Servicing: 'badge-blue', Inspection: 'badge-amber'
  };
  setHTML('activities-table-wrap', `
    <table>
      <thead><tr><th>Activity</th><th>Type</th><th>Period</th><th>Description</th><th>Actions</th></tr></thead>
      <tbody>
        ${_activities.map(a => `<tr>
          <td class="td-primary">${a.name}</td>
          <td><span class="badge ${catColors[a.type] || 'badge-gray'}">${a.type || '—'}</span></td>
          <td class="text-muted small">${a.period || '—'}</td>
          <td class="text-muted small">${(a.description || '').slice(0, 60)}${(a.description || '').length > 60 ? '…' : ''}</td>
          <td><div class="actions-cell">
            <button class="btn btn-ghost btn-sm" onclick="openEditModal('activity','${a.id}')">
              ${icon('icon-edit','12px')} Edit
            </button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="deleteDoc('activities','${a.id}',loadActivities)">
              ${icon('icon-trash','13px')}
            </button>
          </div></td>
        </tr>`).join('')}
      </tbody>
    </table>`);
}
