/**
 * Tekora — js/pages/company.js
 * Admin: Company details
 */
"use strict";

async function loadCompany() {
  try {
    const snap = await db.collection('companies').limit(1).get();
    if (!snap.empty) {
      const d = snap.docs[0].data();
      $('co-name').value    = d.name    || '';
      $('co-address').value = d.address || '';
    }
  } catch (e) { console.error(e); }
}

async function saveCompany() {
  try {
    const snap = await db.collection('companies').limit(1).get();
    const data = {
      name:    $('co-name').value.trim(),
      address: $('co-address').value.trim()
    };
    if (snap.empty) {
      await db.collection('companies').add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    } else {
      await db.collection('companies').doc(snap.docs[0].id).update(data);
    }
    toast('Company saved');
  } catch (e) { toast('Save failed', 'error'); }
}
