/**
 * Tekora — js/pages/pms-admin.js
 * Admin: PMS Schedule Templates CRUD + Bulk Generate
 */
"use strict";

async function loadPMSAdmin() {
  loading('pms-admin-table-wrap');
  try {
    const snap  = await db.collection('pms_schedules').orderBy('scheduledDate', 'asc').limit(200).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!items.length) {
      setHTML('pms-admin-table-wrap', emptyState('No PMS schedules. Use Bulk Generate to create 30 days of schedules.'));
      return;
    }
    setHTML('pms-admin-table-wrap', `
      <table>
        <thead><tr><th>Date</th><th>Equipment</th><th>Activity</th><th>Period</th><th>Status</th><th>Reason</th><th>Actions</th></tr></thead>
        <tbody>
          ${items.map(p => `<tr>
            <td class="mono small text-muted">${p.scheduledDate}</td>
            <td class="td-primary">${getEquipName(p.equipmentId)}</td>
            <td class="text-muted small">${getActivityName(p.activityId)}</td>
            <td class="text-muted small">${p.period || '—'}</td>
            <td>${statusBadge(p.status)}</td>
            <td class="text-muted small">${p.skipReason || '—'}</td>
            <td><div class="actions-cell">
              <button class="btn btn-ghost btn-sm" onclick="openEditModal('pms-schedule','${p.id}')">
                ${icon('icon-edit','12px')} Edit
              </button>
              <button class="btn btn-danger btn-sm btn-icon" onclick="deleteDoc('pms_schedules','${p.id}',loadPMSAdmin)">
                ${icon('icon-trash','13px')}
              </button>
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table>`);
  } catch (e) { toast('Failed to load PMS', 'error'); }
}

async function bulkGenPMS() {
  if (!_equipment.length || !_activities.length) {
    toast('Add equipment and activities first', 'error'); return;
  }
  if (!confirm('Generate 30 days of PMS schedules from today?')) return;
  try {
    const batch     = db.batch();
    let count       = 0;
    const startDate = new Date();
    const periodDays = {
      Daily: 1, Weekly: 7, Monthly: 30,
      Quarterly: 90, 'Bi-Annually': 180, Annually: 365
    };
    for (let i = 0; i < 30; i++) {
      const d  = new Date(startDate);
      d.setDate(d.getDate() + i);
      const ds = d.toISOString().split('T')[0];
      _activities.forEach(act => {
        const freq = periodDays[act.period] || 7;
        if (i % Math.max(1, Math.floor(freq)) === 0 || i === 0) {
          _equipment.slice(0, 4).forEach(e => {
            const ref = db.collection('pms_schedules').doc();
            batch.set(ref, {
              equipmentId: e.id, activityId: act.id,
              scheduledDate: ds, period: act.period || 'Daily',
              status: 'pending',
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            count++;
          });
        }
      });
    }
    await batch.commit();
    toast(`Generated ${count} PMS schedules`);
    loadPMSAdmin();
  } catch (e) { console.error(e); toast('Bulk generation failed', 'error'); }
}
