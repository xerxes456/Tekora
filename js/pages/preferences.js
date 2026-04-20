/**
 * Tekora — js/pages/preferences.js
 * User preferences: profile, facility, password, theme, admin request
 */
"use strict";

function loadPreferences() {
  if (!userProfile) return;
  $('pref-firstname').value = userProfile.firstName || '';
  $('pref-lastname').value  = userProfile.lastName  || '';
  $('pref-position').value  = userProfile.position  || '';

  const sel = $('pref-facility');
  sel.innerHTML = '<option value="">Select your facility</option>'
    + _facilities.map(f =>
        `<option value="${f.id}" ${userProfile.facilityId === f.id ? 'selected' : ''}>${f.name}</option>`
      ).join('');

  const btn = $('admin-request-btn');
  if (btn) {
    if (userProfile.adminRequested) btn.textContent = 'Admin Role Requested ✓';
    if (isAdmin()) btn.style.display = 'none';
  }
  loadTheme();
}

async function savePreferences() {
  try {
    await db.collection('users').doc(currentUser.uid).update({
      firstName: $('pref-firstname').value.trim(),
      lastName:  $('pref-lastname').value.trim(),
      position:  $('pref-position').value.trim(),
    });
    const snap = await db.collection('users').doc(currentUser.uid).get();
    userProfile = snap.data();
    setupUI();
    toast('Profile saved');
  } catch (e) { toast('Save failed', 'error'); }
}

async function changeFacility() {
  const newFac = $('pref-facility').value;
  if (!newFac) { toast('Select a facility', 'error'); return; }
  if (newFac === userProfile.facilityId) { toast('Already in this facility', 'info'); return; }
  try {
    await db.collection('facility_history').add({
      userId:      currentUser.uid,
      fromFacility: userProfile.facilityId || null,
      toFacility:   newFac,
      changedAt:    firebase.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection('users').doc(currentUser.uid).update({ facilityId: newFac });
    const snap = await db.collection('users').doc(currentUser.uid).get();
    userProfile = snap.data();
    setupUI();
    toast('Facility updated');
  } catch (e) { toast('Failed to change facility', 'error'); }
}

async function changePassword() {
  const pw = $('pref-newpw').value;
  if (!pw || pw.length < 8) { toast('Password must be at least 8 characters', 'error'); return; }
  try {
    await currentUser.updatePassword(pw);
    $('pref-newpw').value = '';
    toast('Password updated');
  } catch (e) { toast(e.message, 'error'); }
}

async function requestAdminRole() {
  try {
    await db.collection('users').doc(currentUser.uid).update({ adminRequested: true });
    const btn = $('admin-request-btn');
    if (btn) btn.textContent = 'Admin Role Requested ✓';
    toast('Admin role request sent');
  } catch (e) { toast('Request failed', 'error'); }
}
