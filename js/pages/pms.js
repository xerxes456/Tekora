/**
 * Tekora — js/pages/pms.js
 * Scheduled PMS page (user task checklist)
 */
"use strict";

async function loadPMSPage() {
  await loadCaches();
  const date = $('pms-date-pick') ? $('pms-date-pick').value || today() : today();
  try {
    const snap  = await db.collection('pms_schedules').where('scheduledDate', '==', date).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const userFacId  = userProfile.facilityId;
    const filtered   = isAdmin() ? items : items.filter(p => {
      const eq = _equipment.find(e => e.id === p.equipmentId);
      return eq && eq.facilityIds && eq.facilityIds.includes(userFacId);
    });
    const done = filtered.filter(p => p.status === 'completed');
    const pct  = filtered.length ? Math.round(done.length / filtered.length * 100) : 0;
    const progColor = pct === 100 ? 'var(--accent)' : pct > 50 ? 'var(--amber)' : 'var(--red)';

    $('pms-prog-label').textContent = `${done.length} / ${filtered.length} tasks completed`;
    $('pms-prog-pct').textContent   = pct + '%';
    $('pms-prog-pct').style.color   = progColor;
    $('pms-main-prog').style.width  = pct + '%';
    $('pms-main-prog').style.background = progColor;

    if (!filtered.length) {
      setHTML('pms-items-list', `<div class="card">${emptyState('No PMS scheduled for this date.')}</div>`);
      return;
    }
    setHTML('pms-items-list', filtered.map(p => `
      <div class="pms-item ${p.status === 'completed' ? 'done' : ''}" id="pms-item-${p.id}">
        <div class="pms-check ${p.status === 'completed' ? 'checked' : ''}" onclick="togglePMS('${p.id}','${p.status}')">
          ${icon('icon-check', '11px')}
        </div>
        <div class="pms-info">
          <div class="pms-name">${getActivityName(p.activityId)}</div>
          <div class="pms-meta">${getEquipName(p.equipmentId)} · ${p.period || ''}</div>
        </div>
        ${statusBadge(p.status)}
        ${p.status !== 'completed'
          ? `<button class="btn btn-ghost btn-sm" onclick="openSkipModal('${p.id}')">Skip</button>`
          : `<button class="btn btn-ghost btn-sm" onclick="undoPMS('${p.id}')">Undo</button>`}
      </div>`).join(''));
  } catch (e) { console.error(e); toast('Failed to load PMS', 'error'); }
}

async function togglePMS(id, currentStatus) {
  const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
  try {
    await db.collection('pms_schedules').doc(id).update({
      status: newStatus,
      completedAt:  newStatus === 'completed' ? firebase.firestore.FieldValue.serverTimestamp() : null,
      completedBy:  newStatus === 'completed' ? currentUser.uid : null,
    });
    loadPMSPage();
    toast(newStatus === 'completed' ? 'Task marked complete!' : 'Task reopened');
  } catch (e) { toast('Update failed', 'error'); }
}

function openSkipModal(id) {
  _editId = id; _editType = 'skip-pms';
  $('modal-title').textContent = 'Skip PMS Task';
  $('modal-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Reason Not Done *</label>
      <textarea class="form-input" id="f-skip-reason" placeholder="Enter reason for skipping this task"></textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="confirmSkipPMS()">Confirm Skip</button>
    </div>`;
  $('modal-backdrop').classList.add('open');
}

async function confirmSkipPMS() {
  const reason = $('f-skip-reason').value.trim();
  if (!reason) { toast('Reason is required', 'error'); return; }
  try {
    await db.collection('pms_schedules').doc(_editId).update({
      status: 'skipped', skipReason: reason,
      skippedBy: currentUser.uid,
      skippedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    closeModal(); loadPMSPage(); toast('Task skipped', 'info');
  } catch (e) { toast('Update failed', 'error'); }
}

async function undoPMS(id) {
  try {
    await db.collection('pms_schedules').doc(id).update({
      status: 'pending', completedAt: null, completedBy: null, skipReason: null
    });
    loadPMSPage(); toast('Task reopened');
  } catch (e) { toast('Update failed', 'error'); }
}
