/**
 * ============================================================
 *  Tekora — Maintenance Management System
 *  File: js/auth.js
 *
 *  Handles: Login, Registration, Logout, Auth State,
 *           Default Admin Bootstrap, forceAdmin() helper
 *
 *  Depends on: js/firebase.config.js  (auth, db)
 *              js/app.js              (setupUI, loadCaches, goPage,
 *                                      hideLoading, $)
 * ============================================================
 */

"use strict";

// ── Apply saved theme before Firebase resolves (prevents flash) ────────
(function () {
  try {
    const t = localStorage.getItem('tekora_theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();

// ── Bootstrap the default admin on very first app load ─────────────────
async function initializeDefaultAdmin() {
  const ADMIN_EMAIL = 'Admin@tekora.example';
  const ADMIN_PW    = 'Admin1234'; // Must meet Firebase password requirements (min 6 chars, etc.)
  try {
    const methods = await auth.fetchSignInMethodsForEmail(ADMIN_EMAIL);
    if (methods.length > 0) return; // already exists

    const cred = await auth.createUserWithEmailAndPassword(ADMIN_EMAIL, ADMIN_PW);
    await db.collection('users').doc(cred.user.uid).set({
      firstName: 'Admin', lastName: 'User',
      email: ADMIN_EMAIL, position: 'System Administrator',
      role: 'admin', isAdmin: true,
      facilityId: '', companyId: '',
      adminRequested: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.info('Tekora: default admin account created.');
    await auth.signOut();
  } catch (e) {
    if (e.code !== 'auth/email-already-in-use') {
      console.warn('initializeDefaultAdmin:', e.message);
    }
  }
}

// ── Auth state observer ────────────────────────────────────────────────
auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;
    try {
      let snap = await db.collection('users').doc(user.uid).get();

      // Auto-create Firestore profile if missing
      if (!snap.exists) {
        const isDefaultAdmin = user.email.toLowerCase() === 'admin@tekora.example';
        await db.collection('users').doc(user.uid).set({
          firstName:  isDefaultAdmin ? 'Admin' : '',
          lastName:   isDefaultAdmin ? 'User'  : '',
          email:      user.email,
          position:   isDefaultAdmin ? 'System Administrator' : '',
          role:       isDefaultAdmin ? 'admin' : 'operator',
          isAdmin:    isDefaultAdmin,
          facilityId: '', companyId: '',
          adminRequested: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        snap = await db.collection('users').doc(user.uid).get();
      }

      userProfile = snap.data();

      // Ensure default admin always retains admin rights
      if (user.email.toLowerCase() === 'admin@tekora.example' && !userProfile.isAdmin) {
        await db.collection('users').doc(user.uid).update({ isAdmin: true, role: 'admin' });
        userProfile = { ...userProfile, isAdmin: true, role: 'admin' };
      }

    } catch (e) {
      console.error('Profile load error', e);
      userProfile = { firstName: user.email, lastName: '', role: 'operator', isAdmin: false };
    }

    hideLoading();
    setupUI();
    await loadCaches();
    goPage('dashboard', $('nav-dashboard'));
    $('auth-view').style.display  = 'none';
    $('app-view').classList.add('visible');
    $('app-view').style.display   = 'flex';
  } else {
    hideLoading();
    $('auth-view').style.display  = 'flex';
    $('app-view').classList.remove('visible');
    $('app-view').style.display   = 'none';
  }
});

// ── Auth tab switch ────────────────────────────────────────────────────
function switchAuthTab(tab) {
  $('login-form').style.display    = tab === 'login'    ? 'block' : 'none';
  $('register-form').style.display = tab === 'register' ? 'block' : 'none';
  document.querySelectorAll('.auth-tab').forEach((el, i) =>
    el.classList.toggle('active',
      (i === 0 && tab === 'login') || (i === 1 && tab === 'register'))
  );
  $('auth-alert').className = 'auth-alert';
}

function setAuthAlert(msg, type = 'error') {
  const el = $('auth-alert');
  el.textContent = msg;
  el.className   = `auth-alert ${type}`;
}

// ── Login ──────────────────────────────────────────────────────────────
async function doLogin() {
  const btn   = $('login-btn');
  const email = $('l-email').value.trim();
  const pw    = $('l-pw').value;
  if (!email || !pw) { setAuthAlert('Please fill in all fields.'); return; }
  btn.disabled  = true;
  btn.innerHTML = `<svg class="btn-icon-svg" use="#icon-signin"></svg>Signing in…`;
  try {
    await auth.signInWithEmailAndPassword(email, pw);
  } catch (e) {
    setAuthAlert(
      e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found'
        ? 'Invalid email or password.' : e.message
    );
    btn.disabled  = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>Sign In`;
  }
}

// ── Register ───────────────────────────────────────────────────────────
async function doRegister() {
  const btn   = $('register-btn');
  const first = $('r-firstname').value.trim();
  const last  = $('r-lastname').value.trim();
  const pos   = $('r-position').value.trim();
  const email = $('r-email').value.trim();
  const pw    = $('r-pw').value;

  if (!first || !last || !email || !pw) {
    setAuthAlert('Please fill in all required fields.'); return;
  }
  if (pw.length < 8) {
    setAuthAlert('Password must be at least 8 characters.'); return;
  }

  btn.disabled  = true;
  btn.textContent = 'Creating account…';
  try {
    // First real registrant (non-default-admin) becomes admin
    const existingSnap     = await db.collection('users').limit(2).get();
    const nonDefaultExists = existingSnap.docs.some(
      d => d.data().email !== 'Admin@tekora.example'
    );
    const shouldBeAdmin = !nonDefaultExists;

    const cred = await auth.createUserWithEmailAndPassword(email, pw);
    await db.collection('users').doc(cred.user.uid).set({
      firstName: first, lastName: last, position: pos,
      email, role: shouldBeAdmin ? 'admin' : 'operator',
      isAdmin: shouldBeAdmin,
      facilityId: '', companyId: '',
      adminRequested: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    setAuthAlert(
      shouldBeAdmin
        ? 'Account created — you have been set as Admin!'
        : 'Account created! Signing you in…',
      'success'
    );
  } catch (e) {
    setAuthAlert(
      e.code === 'auth/email-already-in-use' ? 'Email already registered.' : e.message
    );
    btn.disabled  = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>Create Account`;
  }
}

// ── Logout ─────────────────────────────────────────────────────────────
async function doLogout() {
  await auth.signOut();
  currentUser  = null;
  userProfile  = null;
  $('app-view').classList.remove('visible');
  $('app-view').style.display = 'none';
  $('auth-view').style.display = 'flex';
  document.querySelectorAll('.admin-section').forEach(el => el.style.display = 'none');
}

// ── Console debug helper ───────────────────────────────────────────────
async function forceAdmin(uid) {
  if (!uid) { console.error('Usage: forceAdmin("<uid>")'); return; }
  await db.collection('users').doc(uid).update({ isAdmin: true, role: 'admin' });
  console.info(`Admin granted to ${uid}. Ask them to refresh.`);
}

// Run bootstrap
initializeDefaultAdmin().catch(() => {});
