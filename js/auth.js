/**
 * Tekora — js/auth.js
 * Authentication: login, register, logout, auth state, forceAdmin
 * Depends on: js/supabase.config.js  (auth, db, _sb)
 *             js/app.js              (setupUI, loadCaches, goPage, hideLoading, $)
 */
"use strict";

(function () {
  try { const t = localStorage.getItem('tekora_theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) {}
})();

auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;
    try {
      let snap = await db.collection('users').doc(user.uid).get();
      if (!snap.exists) {
        const isDefaultAdmin = user.email.toLowerCase() === 'admin@tekora.example';
        await db.collection('users').doc(user.uid).set({
          firstName: isDefaultAdmin ? 'Admin' : '', lastName: isDefaultAdmin ? 'User' : '',
          email: user.email, position: isDefaultAdmin ? 'System Administrator' : '',
          role: isDefaultAdmin ? 'admin' : 'operator', isAdmin: isDefaultAdmin,
          facilityId: '', companyId: '', adminRequested: false,
        });
        snap = await db.collection('users').doc(user.uid).get();
      }
      userProfile = snap.data();
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
    $('auth-view').style.display = 'none';
    $('app-view').classList.add('visible');
    $('app-view').style.display  = 'flex';
  } else {
    hideLoading();
    $('auth-view').style.display = 'flex';
    $('app-view').classList.remove('visible');
    $('app-view').style.display  = 'none';
  }
});

function switchAuthTab(tab) {
  $('login-form').style.display    = tab === 'login'    ? 'block' : 'none';
  $('register-form').style.display = tab === 'register' ? 'block' : 'none';
  document.querySelectorAll('.auth-tab').forEach((el, i) =>
    el.classList.toggle('active', (i===0&&tab==='login')||(i===1&&tab==='register'))
  );
  $('auth-alert').className = 'auth-alert';
}

function setAuthAlert(msg, type = 'error') {
  const el = $('auth-alert'); el.textContent = msg; el.className = `auth-alert ${type}`;
}

async function doLogin() {
  const btn = $('login-btn'), email = $('l-email').value.trim(), pw = $('l-pw').value;
  if (!email || !pw) { setAuthAlert('Please fill in all fields.'); return; }
  btn.disabled = true;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>Signing in\u2026`;
  try {
    await auth.signInWithEmailAndPassword(email, pw);
  } catch (e) {
    const m = (e.message||'').toLowerCase();
    setAuthAlert(m.includes('invalid')||m.includes('credentials')||m.includes('password') ? 'Invalid email or password.' : (e.message||'Login failed.'));
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>Sign In`;
  }
}

async function doRegister() {
  const btn = $('register-btn');
  const first=$('r-firstname').value.trim(), last=$('r-lastname').value.trim();
  const pos=$('r-position').value.trim(), email=$('r-email').value.trim(), pw=$('r-pw').value;
  if (!first||!last||!email||!pw) { setAuthAlert('Please fill in all required fields.'); return; }
  if (pw.length < 8) { setAuthAlert('Password must be at least 8 characters.'); return; }
  btn.disabled = true; btn.textContent = 'Creating account\u2026';
  try {
    const existingSnap = await db.collection('users').limit(2).get();
    const nonDefaultExists = existingSnap.docs.some(d => d.data().email !== 'Admin@tekora.example');
    const shouldBeAdmin = !nonDefaultExists;
    const cred = await auth.createUserWithEmailAndPassword(email, pw);
    await db.collection('users').doc(cred.user.uid).set({
      firstName: first, lastName: last, position: pos, email,
      role: shouldBeAdmin ? 'admin' : 'operator', isAdmin: shouldBeAdmin,
      facilityId: '', companyId: '', adminRequested: false,
    });
    setAuthAlert(shouldBeAdmin ? 'Account created \u2014 you have been set as Admin!' : 'Account created! Signing you in\u2026', 'success');
  } catch (e) {
    const isAlready = (e.code==='auth/email-already-in-use')||(e.message||'').toLowerCase().includes('already');
    setAuthAlert(isAlready ? 'Email already registered.' : (e.message||'Registration failed.'));
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>Create Account`;
  }
}

async function doLogout() {
  await auth.signOut();
  currentUser = null; userProfile = null;
  $('app-view').classList.remove('visible');
  $('app-view').style.display = 'none';
  $('auth-view').style.display = 'none';
  document.querySelectorAll('.admin-section').forEach(el => el.style.display = 'none');
}

async function forceAdmin(uid) {
  if (!uid) { console.error('Usage: forceAdmin("<uid>")'); return; }
  await db.collection('users').doc(uid).update({ isAdmin: true, role: 'admin' });
  console.info(`Admin granted to ${uid}. Refresh required.`);
}
