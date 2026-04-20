/**
 * ============================================================
 *  Tekora — Maintenance Management System
 *  File: js/app.js
 *
 *  Shared application core:
 *    - Global state variables
 *    - Utility helpers  ($, toast, badges, emptyState…)
 *    - Cache loader (facilities, equipment, activities)
 *    - UI setup & admin nav reveal
 *    - Page navigation (desktop sidebar + mobile drawer)
 *    - Theme system (5 themes + localStorage persistence)
 *    - Global modal engine (MODAL_CONFIGS)
 *
 *  Depends on: js/firebase.config.js
 * ============================================================
 */

"use strict";

// ─────────────────── GLOBAL STATE ───────────────────
let currentUser = null;
let userProfile = null;
let _facilities = [];
let _equipment  = [];
let _activities = [];
let _users      = [];
let _editId     = null;
let _editType   = null;
let _reqFilter  = 'all';

// ─────────────────── UTILITY HELPERS ─────────────────
const $ = id => document.getElementById(id);
const today = () => new Date().toISOString().split('T')[0];
function setHTML(id, html) { const el = $(id); if (el) el.innerHTML = html; }

function isAdmin() {
  if (!userProfile) return false;
  return userProfile.isAdmin === true
      || userProfile.role === 'admin'
      || userProfile.role === 'Admin';
}

function icon(id, size = '16px') {
  return `<svg width="${size}" height="${size}" aria-hidden="true"><use href="images/icons.svg#${id}"/></svg>`;
}

function toast(msg, type = 'success') {
  const iconId = { success: 'icon-check', error: 'icon-close', info: 'icon-info' };
  const el = document.createElement('div');
  el.className  = `toast ${type}`;
  el.innerHTML  = `${icon(iconId[type] || 'icon-info', '15px')}<span>${msg}</span>`;
  $('toast-container').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, 3000);
}

function getFacilityName(id)  { return (_facilities.find(f => f.id === id) || { name: '—' }).name; }
function getEquipName(id)     { return (_equipment.find(e => e.id === id)  || { name: '—' }).name; }
function getActivityName(id)  { return (_activities.find(a => a.id === id) || { name: '—' }).name; }

function priorityBadge(p) {
  const map = { high: 'badge-red', medium: 'badge-amber', low: 'badge-blue' };
  return `<span class="badge ${map[p] || 'badge-gray'}">${p || '—'}</span>`;
}
function statusBadge(s) {
  const map = {
    open: 'badge-red', in_progress: 'badge-amber', completed: 'badge-green',
    pending: 'badge-amber', skipped: 'badge-red', operational: 'badge-green',
    not_operational: 'badge-red', op_not_available: 'badge-gray', decommissioned: 'badge-gray'
  };
  return `<span class="badge ${map[s] || 'badge-gray'}">${(s || '—').replace(/_/g, ' ')}</span>`;
}
function stateBadge(s) {
  const map = {
    Operational: 'badge-green', 'Not Operational': 'badge-red',
    OpNotAvailable: 'badge-gray', Decommissioned: 'badge-gray'
  };
  return `<span class="badge ${map[s] || 'badge-gray'}">${s || '—'}</span>`;
}
function loading(id) {
  const el = $(id); if (!el) return;
  el.innerHTML = `<div style="padding:40px;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>`;
}
function emptyState(msg = 'No records found') {
  return `<div class="empty">${icon('icon-pms-admin','40px')}<p>${msg}</p></div>`;
}
function fmtDate(ts) {
  if (!ts) return '—';
  try { return new Date(ts.toDate()).toLocaleDateString(); } catch (e) { return ts || '—'; }
}
function autoCode() { return 'MR-' + String(Date.now()).slice(-5); }

function hideLoading() {
  const ol = $('loading-overlay');
  ol.classList.add('hidden');
  setTimeout(() => ol.style.display = 'none', 350);
}

// ─────────────────── CACHE LOADER ────────────────────
async function loadCaches() {
  try {
    const [fs, es, as] = await Promise.all([
      db.collection('facilities').orderBy('createdAt', 'asc').get(),
      db.collection('equipment').orderBy('createdAt', 'asc').get(),
      db.collection('activities').orderBy('createdAt', 'asc').get(),
    ]);
    _facilities = fs.docs.map(d => ({ id: d.id, ...d.data() }));
    _equipment  = es.docs.map(d => ({ id: d.id, ...d.data() }));
    _activities = as.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error('Cache load error', e); }
}

// ─────────────────── UI SETUP ────────────────────────
function setupUI() {
  loadTheme();
  const name = ((userProfile.firstName || '') + ' ' + (userProfile.lastName || '')).trim()
             || currentUser.email;
  const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  $('user-avatar-el').textContent = initials;
  $('user-name-el').textContent   = name;
  $('user-role-el').textContent   = userProfile.isAdmin ? 'Admin' : (userProfile.role || 'Operator');

  document.querySelectorAll('.admin-section').forEach(el => {
    el.style.display = isAdmin()
      ? (el.classList.contains('nav-group-label') ? 'block' : 'flex')
      : 'none';
  });

  $('dash-date').textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const pmsDatePick = $('pms-date-pick');
  if (pmsDatePick) pmsDatePick.value = today();
  buildMobileDrawer();
}

// ─────────────────── NAV ─────────────────────────────
function goPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
  const page = $('page-' + id);
  if (page) page.classList.add('active');
  if (el)   el.classList.add('active');

  const loaders = {
    dashboard:        loadDashboard,
    requests:         loadRequests,
    equipment:        loadEquipment,
    pms:              loadPMSPage,
    preferences:      loadPreferences,
    facilities:       loadFacilities,
    'admin-equipment': loadAdminEquipment,
    activities:       loadActivities,
    'pms-admin':      loadPMSAdmin,
    users:            loadUsers,
    company:          loadCompany,
    reports:          loadReports,
  };
  if (loaders[id]) loaders[id]();
  closeDrawer();

  // Scroll the page container back to top on navigation
  if (page) page.scrollTop = 0;
}

// ─────────────────── MOBILE DRAWER ───────────────────
function buildMobileDrawer() {
  const items = [
    { id: 'equipment',   label: 'Equipment',     iconId: 'icon-equipment'   },
    { id: 'preferences', label: 'Preferences',   iconId: 'icon-preferences' },
  ];
  if (isAdmin()) {
    items.push(
      { id: 'facilities',       label: 'Facilities',     iconId: 'icon-facilities' },
      { id: 'admin-equipment',  label: 'All Equipment',  iconId: 'icon-equipment'  },
      { id: 'activities',       label: 'Activities',     iconId: 'icon-activities' },
      { id: 'pms-admin',        label: 'PMS Templates',  iconId: 'icon-pms-admin'  },
      { id: 'users',            label: 'Users',          iconId: 'icon-users'      },
      { id: 'reports',          label: 'Reports',        iconId: 'icon-reports'    },
      { id: 'company',          label: 'Company',        iconId: 'icon-company'    },
    );
  }
  $('bottom-drawer').innerHTML = `
    <div class="drawer-header">
      <span class="drawer-header-label">More</span>
      <button class="modal-close" onclick="closeDrawer()">${icon('icon-close', '14px')}</button>
    </div>
    ${items.map(it => `
      <div class="drawer-item" onclick="goPage('${it.id}',null)">
        ${icon(it.iconId, '18px')}${it.label}
      </div>`).join('')}
    <div class="drawer-item drawer-item-danger" onclick="doLogout()">
      ${icon('icon-logout', '18px')}Sign Out
    </div>`;
}

function toggleDrawer() {
  $('bottom-drawer').classList.toggle('open');
  $('drawer-overlay').classList.toggle('open');
}
function closeDrawer() {
  $('bottom-drawer').classList.remove('open');
  $('drawer-overlay').classList.remove('open');
}
function goPageMobile(id, bnavId) {
  document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
  $(bnavId) && $(bnavId).classList.add('active');
  goPage(id, null);
}

// ─────────────────── THEME SYSTEM ────────────────────
const THEMES = ['midnight', 'arctic', 'warm', 'cloud', 'forest'];

function applyTheme(name) {
  if (!THEMES.includes(name)) name = 'midnight';
  document.documentElement.setAttribute('data-theme', name);
  try { localStorage.setItem('tekora_theme', name); } catch (e) {}
  document.querySelectorAll('.theme-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.theme === name);
  });
  if (currentUser) {
    db.collection('users').doc(currentUser.uid).update({ theme: name }).catch(() => {});
  }
}

function loadTheme() {
  const saved = (userProfile && userProfile.theme)
    || (() => { try { return localStorage.getItem('tekora_theme'); } catch (e) { return null; } })()
    || 'midnight';
  document.documentElement.setAttribute('data-theme', saved);
  document.querySelectorAll('.theme-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.theme === saved);
  });
}

// ─────────────────── DELETE HELPER ───────────────────
async function deleteDoc(collection, id, reloadFn) {
  if (!confirm('Delete this record? This cannot be undone.')) return;
  try {
    await db.collection(collection).doc(id).delete();
    await loadCaches();
    toast('Record deleted');
    if (reloadFn) reloadFn();
  } catch (e) { toast('Delete failed', 'error'); }
}

// ─────────────────── MODAL ENGINE ────────────────────
const MODAL_CONFIGS = {

  request: {
    title: 'Maintenance Request',
    fields: (d = {}) => `
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Request Code *</label>
          <input class="form-input" id="f-code" value="${d.code || autoCode()}" placeholder="MR-001"/></div>
        <div class="form-group"><label class="form-label">Date</label>
          <input class="form-input" id="f-date" type="date" value="${d.date || today()}"/></div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Facility</label>
          <select class="form-input" id="f-facilityId"><option value="">Select facility</option>
            ${_facilities.map(f => `<option value="${f.id}" ${d.facilityId === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
          </select></div>
        <div class="form-group"><label class="form-label">Equipment *</label>
          <select class="form-input" id="f-equipmentId"><option value="">Select equipment</option>
            ${_equipment.map(e => `<option value="${e.id}" ${d.equipmentId === e.id ? 'selected' : ''}>${e.name}</option>`).join('')}
          </select></div>
      </div>
      <div class="form-group"><label class="form-label">Defect Description *</label>
        <textarea class="form-input" id="f-defect">${d.defectDescription || ''}</textarea></div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Priority</label>
          <select class="form-input" id="f-priority">
            <option value="low" ${d.priority === 'low' ? 'selected' : ''}>Low</option>
            <option value="medium" ${!d.priority || d.priority === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="high" ${d.priority === 'high' ? 'selected' : ''}>High</option>
          </select></div>
        <div class="form-group"><label class="form-label">Status</label>
          <select class="form-input" id="f-status">
            <option value="open" ${!d.status || d.status === 'open' ? 'selected' : ''}>Open</option>
            <option value="in_progress" ${d.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
            <option value="completed" ${d.status === 'completed' ? 'selected' : ''}>Completed</option>
          </select></div>
      </div>`,
    save: async (d, id) => {
      if (!$('f-code').value.trim() || !$('f-equipmentId').value || !$('f-defect').value.trim()) {
        toast('Code, equipment and defect description are required', 'error'); return false;
      }
      const data = {
        code: $('f-code').value.trim(), date: $('f-date').value,
        facilityId: $('f-facilityId').value, equipmentId: $('f-equipmentId').value,
        defectDescription: $('f-defect').value.trim(),
        priority: $('f-priority').value, status: $('f-status').value,
        generatedBy: currentUser.uid
      };
      if (id) await db.collection('requests').doc(id).update(data);
      else await db.collection('requests').add({
        ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: currentUser.uid
      });
      loadRequests(); return true;
    }
  },

  facility: {
    title: 'Facility',
    fields: (d = {}) => `
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Name *</label>
          <input class="form-input" id="f-name" value="${d.name || ''}" placeholder="Facility Alpha"/></div>
        <div class="form-group"><label class="form-label">Type</label>
          <select class="form-input" id="f-type">
            <option value="">Select type</option>
            ${['Offshore Platform','Onshore Facility','FPSO','FSO','Flowstation','Terminal','Compressor Station','Vessel','Depot']
              .map(t => `<option value="${t}" ${d.type === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select></div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Holding Capacity</label>
          <input class="form-input" id="f-holdingCapacity" value="${d.holdingCapacity || ''}" placeholder="e.g. 5000 MT"/></div>
        <div class="form-group"><label class="form-label">Current Holding</label>
          <input class="form-input" id="f-holding" value="${d.holding || ''}"/></div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Length (m)</label>
          <input class="form-input" id="f-length" type="number" value="${d.length || ''}"/></div>
        <div class="form-group"><label class="form-label">Breadth (m)</label>
          <input class="form-input" id="f-breadth" type="number" value="${d.breadth || ''}"/></div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Tonnage</label>
          <input class="form-input" id="f-tonnage" value="${d.tonnage || ''}"/></div>
        <div class="form-group"><label class="form-label">Fuel Type</label>
          <select class="form-input" id="f-fuelType">
            ${['','Diesel','HFO','LNG','MGO','Electric','Dual Fuel']
              .map(t => `<option value="${t}" ${d.fuelType === t ? 'selected' : ''}>${t || 'Select fuel type'}</option>`).join('')}
          </select></div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Tank Capacity (L)</label>
          <input class="form-input" id="f-tankCapacity" type="number" value="${d.tankCapacity || ''}"/></div>
        <div class="form-group"><label class="form-label">Lub Oil Capacity (L)</label>
          <input class="form-input" id="f-lubOilCapacity" type="number" value="${d.lubOilCapacity || ''}"/></div>
      </div>
      <div class="form-group"><label class="form-label">Location</label>
        <input class="form-input" id="f-location" value="${d.location || ''}" placeholder="e.g. OML-58, Niger Delta"/></div>
      <div class="form-group"><label class="form-label">State</label>
        <select class="form-input" id="f-state">
          ${['Operational','Not Operational','OpNotAvailable']
            .map(s => `<option value="${s}" ${(d.state || 'Operational') === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select></div>`,
    save: async (d, id) => {
      if (!$('f-name').value.trim()) { toast('Name is required', 'error'); return false; }
      const data = {
        name: $('f-name').value.trim(), type: $('f-type').value,
        holdingCapacity: $('f-holdingCapacity').value.trim(), holding: $('f-holding').value.trim(),
        length: parseFloat($('f-length').value) || 0, breadth: parseFloat($('f-breadth').value) || 0,
        tonnage: $('f-tonnage').value.trim(), fuelType: $('f-fuelType').value,
        tankCapacity: parseFloat($('f-tankCapacity').value) || 0,
        lubOilCapacity: parseFloat($('f-lubOilCapacity').value) || 0,
        location: $('f-location').value.trim(), state: $('f-state').value
      };
      if (id) await db.collection('facilities').doc(id).update(data);
      else await db.collection('facilities').add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      await loadCaches(); loadFacilities(); return true;
    }
  },

  equipment: {
    title: 'Equipment',
    fields: (d = {}) => `
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Name *</label>
          <input class="form-input" id="f-name" value="${d.name || ''}" placeholder="Gas Compressor A"/></div>
        <div class="form-group"><label class="form-label">Type</label>
          <input class="form-input" id="f-type" value="${d.type || ''}" placeholder="Compressor, Pump…"/></div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Manufacturer</label>
          <input class="form-input" id="f-manufacturer" value="${d.manufacturer || ''}"/></div>
        <div class="form-group"><label class="form-label">Model</label>
          <input class="form-input" id="f-model" value="${d.model || ''}"/></div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Capacity</label>
          <input class="form-input" id="f-capacity" value="${d.capacity || ''}" placeholder="e.g. 500kW"/></div>
        <div class="form-group"><label class="form-label">State</label>
          <select class="form-input" id="f-state">
            ${['Operational','Not Operational','OpNotAvailable']
              .map(s => `<option value="${s}" ${(d.state || 'Operational') === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select></div>
      </div>
      <div class="form-group"><label class="form-label">Facilities (Ctrl/Cmd for multiple)</label>
        <select class="form-input" id="f-facilityIds" multiple style="min-height:80px">
          ${_facilities.map(f => `<option value="${f.id}" ${d.facilityIds && d.facilityIds.includes(f.id) ? 'selected' : ''}>${f.name}</option>`).join('')}
        </select></div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Maintenance Type</label>
          <select class="form-input" id="f-maintenanceType">
            ${['PMS','Servicing','Corrective','Overhaul','None']
              .map(t => `<option value="${t}" ${(d.maintenanceType || 'PMS') === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select></div>
        <div class="form-group"><label class="form-label">MRH Interval (hrs)</label>
          <input class="form-input" id="f-mrh" type="number" min="0" value="${d.mrh || 0}"/></div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Current MRH</label>
          <input class="form-input" id="f-currentMRH" type="number" min="0" value="${d.currentMRH || 0}"/></div>
        <div class="form-group"><label class="form-label">Total MRH</label>
          <input class="form-input" id="f-totalMRH" type="number" min="0" value="${d.totalMRH || 0}"/></div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Replaced?</label>
          <select class="form-input" id="f-replaced">
            <option value="false" ${!d.replaced ? 'selected' : ''}>No</option>
            <option value="true"  ${d.replaced  ? 'selected' : ''}>Yes</option>
          </select></div>
        <div class="form-group"><label class="form-label">Date Replaced</label>
          <input class="form-input" id="f-dateReplaced" type="date" value="${d.dateReplaced || ''}"/></div>
      </div>`,
    save: async (d, id) => {
      if (!$('f-name').value.trim()) { toast('Name is required', 'error'); return false; }
      const selOpts = Array.from($('f-facilityIds').selectedOptions).map(o => o.value);
      const data = {
        name: $('f-name').value.trim(), type: $('f-type').value.trim(),
        manufacturer: $('f-manufacturer').value.trim(), model: $('f-model').value.trim(),
        capacity: $('f-capacity').value.trim(), state: $('f-state').value,
        facilityIds: selOpts, maintenanceType: $('f-maintenanceType').value,
        mrh: parseFloat($('f-mrh').value) || 0,
        currentMRH: parseFloat($('f-currentMRH').value) || 0,
        totalMRH: parseFloat($('f-totalMRH').value) || 0,
        replaced: $('f-replaced').value === 'true',
        dateReplaced: $('f-dateReplaced').value, maintained: true
      };
      if (id) await db.collection('equipment').doc(id).update(data);
      else await db.collection('equipment').add({
        ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: currentUser.uid
      });
      await loadCaches(); loadEquipment(); return true;
    }
  },

  activity: {
    title: 'Maintenance Activity',
    fields: (d = {}) => `
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Activity Name *</label>
          <input class="form-input" id="f-name" value="${d.name || ''}" placeholder="Oil & Filter Change"/></div>
        <div class="form-group"><label class="form-label">Type</label>
          <select class="form-input" id="f-type">
            ${['PMS','Corrective','Overhaul','Servicing','Inspection']
              .map(c => `<option value="${c}" ${d.type === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select></div>
      </div>
      <div class="form-group"><label class="form-label">Period</label>
        <select class="form-input" id="f-period">
          ${['Daily','Weekly','Monthly','Quarterly','Bi-Annually','Annually','Running Hours']
            .map(p => `<option value="${p}" ${d.period === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Description</label>
        <textarea class="form-input" id="f-description">${d.description || ''}</textarea></div>`,
    save: async (d, id) => {
      if (!$('f-name').value.trim()) { toast('Name is required', 'error'); return false; }
      const data = {
        name: $('f-name').value.trim(), type: $('f-type').value,
        period: $('f-period').value, description: $('f-description').value.trim()
      };
      if (id) await db.collection('activities').doc(id).update(data);
      else await db.collection('activities').add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      await loadCaches(); loadActivities(); return true;
    }
  },

  'pms-schedule': {
    title: 'PMS Schedule',
    fields: (d = {}) => `
      <div class="form-group"><label class="form-label">Equipment *</label>
        <select class="form-input" id="f-equipmentId"><option value="">Select equipment</option>
          ${_equipment.map(e => `<option value="${e.id}" ${d.equipmentId === e.id ? 'selected' : ''}>${e.name}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Activity *</label>
        <select class="form-input" id="f-activityId"><option value="">Select activity</option>
          ${_activities.map(a => `<option value="${a.id}" ${d.activityId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
        </select></div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Scheduled Date *</label>
          <input class="form-input" id="f-scheduledDate" type="date" value="${d.scheduledDate || today()}"/></div>
        <div class="form-group"><label class="form-label">Period</label>
          <select class="form-input" id="f-period">
            ${['Daily','Weekly','Monthly','Quarterly','Bi-Annually','Annually','Running Hours']
              .map(p => `<option value="${p}" ${(d.period || 'Daily') === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select></div>
      </div>
      <div class="form-group"><label class="form-label">Status</label>
        <select class="form-input" id="f-status">
          <option value="pending"   ${!d.status || d.status === 'pending'   ? 'selected' : ''}>Pending</option>
          <option value="completed" ${d.status === 'completed' ? 'selected' : ''}>Completed</option>
          <option value="skipped"   ${d.status === 'skipped'   ? 'selected' : ''}>Skipped</option>
        </select></div>`,
    save: async (d, id) => {
      const eId = $('f-equipmentId').value, aId = $('f-activityId').value, dt = $('f-scheduledDate').value;
      if (!eId || !aId || !dt) { toast('All fields required', 'error'); return false; }
      const data = { equipmentId: eId, activityId: aId, scheduledDate: dt, period: $('f-period').value, status: $('f-status').value };
      if (id) await db.collection('pms_schedules').doc(id).update(data);
      else await db.collection('pms_schedules').add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      loadPMSAdmin(); return true;
    }
  },

  'user-role': {
    title: 'Edit User Role',
    fields: (d = {}) => `
      <div style="margin-bottom:16px;padding:12px;background:var(--surface2);border-radius:8px;font-size:13px">
        <strong>${(d.firstName || '') + ' ' + (d.lastName || '')}</strong><br/>
        <span style="color:var(--text3)">${d.email || ''}</span>
      </div>
      <div class="form-group"><label class="form-label">Role</label>
        <input class="form-input" id="f-role" value="${d.role || 'operator'}" placeholder="e.g. Technician, Supervisor"/></div>
      <div class="form-group"><label class="form-label">Assign Facility</label>
        <select class="form-input" id="f-facilityId">
          <option value="">No facility assigned</option>
          ${_facilities.map(f => `<option value="${f.id}" ${d.facilityId === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Admin Access</label>
        <select class="form-input" id="f-isAdmin">
          <option value="false" ${!d.isAdmin ? 'selected' : ''}>No</option>
          <option value="true"  ${d.isAdmin  ? 'selected' : ''}>Yes — Grant Admin</option>
        </select></div>`,
    save: async (d, id) => {
      await db.collection('users').doc(id).update({
        role: $('f-role').value.trim(),
        facilityId: $('f-facilityId').value,
        isAdmin: $('f-isAdmin').value === 'true',
        adminRequested: false,
      });
      await loadUsers(); return true;
    }
  }
};

function openModal(type) {
  _editId = null; _editType = type;
  const cfg = MODAL_CONFIGS[type]; if (!cfg) return;
  $('modal-title').textContent = 'New ' + cfg.title;
  $('modal-body').innerHTML = cfg.fields() +
    `<div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="modal-save-btn" onclick="saveModal()">Save</button>
    </div>`;
  $('modal-backdrop').classList.add('open');
}

async function openEditModal(type, id) {
  _editId = id; _editType = type;
  const cfg = MODAL_CONFIGS[type]; if (!cfg) return;
  const collMap = {
    request: 'requests', facility: 'facilities', equipment: 'equipment',
    activity: 'activities', 'pms-schedule': 'pms_schedules', 'user-role': 'users'
  };
  try {
    const snap = await db.collection(collMap[type]).doc(id).get();
    const data = snap.exists ? { id: snap.id, ...snap.data() } : {};
    $('modal-title').textContent = 'Edit ' + cfg.title;
    $('modal-body').innerHTML = cfg.fields(data) +
      `<div class="form-actions">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="modal-save-btn" onclick="saveModal()">Update</button>
      </div>`;
    $('modal-backdrop').classList.add('open');
  } catch (e) { toast('Failed to load record', 'error'); }
}

async function saveModal() {
  const btn = $('modal-save-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  const cfg = MODAL_CONFIGS[_editType];
  if (!cfg) { btn.disabled = false; return; }
  try {
    const ok = await cfg.save({}, _editId);
    if (ok !== false) { closeModal(); toast(_editId ? 'Updated successfully' : 'Created successfully'); }
    else { btn.disabled = false; btn.textContent = _editId ? 'Update' : 'Save'; }
  } catch (e) {
    console.error(e);
    toast('Save failed: ' + e.message, 'error');
    btn.disabled = false; btn.textContent = _editId ? 'Update' : 'Save';
  }
}

function closeModal() {
  $('modal-backdrop').classList.remove('open');
  _editId = null; _editType = null;
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
