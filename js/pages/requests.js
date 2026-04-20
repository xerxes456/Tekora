/**
 * Tekora — js/pages/requests.js
 * Maintenance Requests page
 */
"use strict";

async function loadRequests() {
  loading('requests-table-wrap');
  try {
    let q = db.collection('requests').orderBy('createdAt', 'desc');
    if (!isAdmin()) q = q.where('facilityId', '==', userProfile.facilityId || '');
    const snap = await q.get();
    const all  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const filtered = _reqFilter === 'all'  ? all
                   : _reqFilter === 'high' ? all.filter(r => r.priority === 'high')
                   : all.filter(r => r.status === _reqFilter);
    if (!filtered.length) {
      setHTML('requests-table-wrap', emptyState('No requests match this filter')); return;
    }
    setHTML('requests-table-wrap', `
      <table>
        <thead><tr><th>Code</th><th>Equipment</th><th>Defect</th><th>Facility</th><th>Priority</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>
          ${filtered.map(r => `<tr>
            <td><div class="td-primary mono">${r.code || '—'}</div></td>
            <td><div class="td-primary">${getEquipName(r.equipmentId)}</div></td>
            <td><div class="td-secondary">${(r.defectDescription || '').slice(0, 50)}${(r.defectDescription || '').length > 50 ? '…' : ''}</div></td>
            <td class="text-muted small">${getFacilityName(r.facilityId)}</td>
            <td>${priorityBadge(r.priority)}</td>
            <td>${statusBadge(r.status)}</td>
            <td class="mono small text-muted">${r.date || fmtDate(r.createdAt)}</td>
            <td><div class="actions-cell">
              ${r.status !== 'completed'
                ? `<button class="btn btn-ghost btn-sm" onclick="updateReqStatus('${r.id}','${r.status === 'open' ? 'in_progress' : 'completed'}')">
                     ${icon('icon-check', '12px')} ${r.status === 'open' ? 'Start' : 'Complete'}
                   </button>` : ''}
              ${isAdmin()
                ? `<button class="btn btn-ghost btn-sm btn-icon" onclick="openEditModal('request','${r.id}')">
                     ${icon('icon-edit', '13px')}
                   </button>` : ''}
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table>`);
  } catch (e) { console.error(e); toast('Failed to load requests', 'error'); }
}

function setReqFilter(f, el) {
  _reqFilter = f;
  document.querySelectorAll('#req-filter-row .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  loadRequests();
}

async function updateReqStatus(id, status) {
  try {
    const update = { status };
    if (status === 'completed') update.dateCompleted = today();
    await db.collection('requests').doc(id).update(update);
    toast('Status updated');
    loadRequests();
  } catch (e) { toast('Update failed', 'error'); }
}
