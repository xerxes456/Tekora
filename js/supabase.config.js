/**
 * ============================================================
 *  Tekora — Maintenance Management System
 *  File: js/supabase.config.js
 *
 *  PURPOSE: Supabase project credentials + client initialisation.
 *           Also exposes a thin db abstraction layer that maps
 *           the Firebase-style API used throughout the app to
 *           Supabase equivalents — so every page file stays clean.
 *
 *  SETUP STEPS:
 *  ─────────────────────────────────────────────────────────
 *  1. Go to https://supabase.com → create a new project
 *  2. Project Settings → API → copy "Project URL" and
 *     "anon / public" key → paste below
 *  3. SQL Editor → paste and run supabase/schema.sql
 *  4. Authentication → Users → Add user:
 *       Email:    Admin@tekora.example
 *       Password: Admin
 *     Copy the UUID and update the INSERT in schema.sql
 *  5. Serve the project from a local/remote web server
 *     (file:// won't work with Supabase JS client)
 *
 *  TABLES USED:
 *  ─────────────────────────────────────────────────────────
 *  companies · users · facilities · facility_history
 *  equipment · equipment_facilities · activities
 *  requests  · pms_schedules · maintenance_groups
 * ============================================================
 */

"use strict";

// ── YOUR SUPABASE CREDENTIALS ─────────────────────────────
const SUPABASE_URL  = "https://imbmkrlqjrfvcpswuymq.supabase.co";
const SUPABASE_ANON = "sb_publishable_l7W-vFcP4RxpPZzrq7E-zQ_3weHsI8N";
// ─────────────────────────────────────────────────────────

// Initialise the Supabase client (loaded via CDN in index.html)
const _sb   = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
const sbAuth = _sb.auth;

// ── AUTH convenience handles used by auth.js ──────────────
const auth = {
  // Sign in
  signInWithEmailAndPassword: async (email, password) => {
    const { data, error } = await sbAuth.signInWithPassword({ email, password });
    if (error) throw { code: error.message, message: error.message };
    return data;
  },
  // Register
  createUserWithEmailAndPassword: async (email, password) => {
    const { data, error } = await sbAuth.signUp({ email, password });
    if (error) {
      const code = error.message.includes('already') ? 'auth/email-already-in-use' : error.message;
      throw { code, message: error.message };
    }
    // Return a Firebase-shaped credential object
    return { user: { uid: data.user.id, email: data.user.email } };
  },
  // Sign out
  signOut: async () => { await sbAuth.signOut(); },
  // Auth state listener — mirrors firebase.auth().onAuthStateChanged
  onAuthStateChanged: (callback) => {
    // Supabase fires synchronously on initial session restore + on change
    sbAuth.getSession().then(({ data }) => {
      callback(data.session ? { uid: data.session.user.id, email: data.session.user.email } : null);
    });
    sbAuth.onAuthStateChange((_event, session) => {
      callback(session ? { uid: session.user.id, email: session.user.email } : null);
    });
  },
  // Password change for currently signed-in user
  currentUser: {
    updatePassword: async (newPassword) => {
      const { error } = await sbAuth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
    }
  },
  // Not needed in Supabase — stub kept for interface compatibility
  fetchSignInMethodsForEmail: async (email) => {
    // Returns an empty array (Supabase doesn't expose this — we handle duplicate
    // registration via the error code from signUp instead)
    return [];
  },
};

// ── DB ABSTRACTION LAYER ──────────────────────────────────
// Maps the Firebase Firestore-style chainable API used in the app
// to Supabase PostgREST calls. Only the methods actually used are
// implemented — keeping the shim minimal and readable.
//
// Supported patterns:
//   await db.from('table').select()
//   await db.from('table').insert(row)
//   await db.from('table').update(row).eq('id', id)
//   await db.from('table').delete().eq('id', id)
//   await db.from('table').select().eq('col', val)
//   await db.from('table').select().order('col')
//   await db.from('table').select().limit(n)
//
// Firebase → Supabase equivalents used in the app:
//   db.collection('x').get()               → db.from('x').select()
//   db.collection('x').doc(id).get()       → db.from('x').select().eq('id',id).single()
//   db.collection('x').doc(id).set(data)   → db.from('x').upsert({id,...data})
//   db.collection('x').doc(id).update(d)   → db.from('x').update(d).eq('id',id)
//   db.collection('x').doc(id).delete()    → db.from('x').delete().eq('id',id)
//   db.collection('x').add(data)           → db.from('x').insert(data)
//   db.batch()                             → BatchHelper (see below)
// ─────────────────────────────────────────────────────────

const db = {

  // ── collection() — Firebase-compat entry point ─────────
  collection: (table) => new CollectionRef(table),

  // ── Batch helper (replaces db.batch()) ─────────────────
  batch: () => new BatchHelper(),

  // ── Direct Supabase client (for advanced queries) ──────
  _client: _sb,
};

// ── CollectionRef — mirrors firebase CollectionReference ──
class CollectionRef {
  constructor(table) {
    this._table  = table;
    this._wheres = [];
    this._order  = null;
    this._lim    = null;
  }

  // .doc(id) → DocumentRef
  doc(id) { return new DocumentRef(this._table, id); }

  // .where(col, op, val)
  where(col, op, val) {
    this._wheres.push({ col, op, val }); return this;
  }

  // .orderBy(col, dir)
  orderBy(col, dir = 'asc') { this._order = { col, dir }; return this; }

  // .limit(n)
  limit(n) { this._lim = n; return this; }

  // .get() — returns a Firebase-shaped QuerySnapshot
  async get() {
    let q = _sb.from(this._table).select('*');

    this._wheres.forEach(({ col, op, val }) => {
      const sbCol = _toSnake(col);
      if (op === '==' || op === '=') q = q.eq(sbCol, val);
      else if (op === '!=')          q = q.neq(sbCol, val);
      else if (op === '<')           q = q.lt(sbCol, val);
      else if (op === '>')           q = q.gt(sbCol, val);
      else if (op === '<=')          q = q.lte(sbCol, val);
      else if (op === '>=')          q = q.gte(sbCol, val);
    });

    if (this._order) q = q.order(_toSnake(this._order.col), { ascending: this._order.dir !== 'desc' });
    if (this._lim)   q = q.limit(this._lim);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    return {
      docs:  (data || []).map(row => new DocumentSnapshot(row)),
      empty: !data || data.length === 0,
    };
  }

  // .add(data) — INSERT and return doc ref
  async add(data) {
    const payload = _toDB(data);
    const { data: rows, error } = await _sb.from(this._table).insert(payload).select();
    if (error) throw new Error(error.message);
    return new DocumentRef(this._table, rows[0].id);
  }
}

// ── DocumentRef — mirrors firebase DocumentReference ──────
class DocumentRef {
  constructor(table, id) { this._table = table; this._id = id; }

  async get() {
    const { data, error } = await _sb.from(this._table).select('*').eq('id', this._id).maybeSingle();
    if (error) throw new Error(error.message);
    return new DocumentSnapshot(data, this._id);
  }

  async set(data) {
    const payload = { id: this._id, ..._toDB(data) };
    const { error } = await _sb.from(this._table).upsert(payload);
    if (error) throw new Error(error.message);
  }

  async update(data) {
    const payload = _toDB(data);
    const { error } = await _sb.from(this._table).update(payload).eq('id', this._id);
    if (error) throw new Error(error.message);
  }

  async delete() {
    const { error } = await _sb.from(this._table).delete().eq('id', this._id);
    if (error) throw new Error(error.message);
  }
}

// ── DocumentSnapshot — mirrors firebase DocumentSnapshot ──
class DocumentSnapshot {
  constructor(row, fallbackId) {
    this._row = row;
    this.id     = row ? row.id : (fallbackId || null);
    this.exists = !!row;
  }
  data() {
    if (!this._row) return null;
    return _fromDB(this._row);
  }
}

// ── BatchHelper — replaces db.batch() ─────────────────────
class BatchHelper {
  constructor() { this._ops = []; }

  set(ref, data) {
    this._ops.push({ type: 'upsert', table: ref._table, payload: { id: ref._id, ..._toDB(data) } });
    return this;
  }
  update(ref, data) {
    this._ops.push({ type: 'update', table: ref._table, id: ref._id, payload: _toDB(data) });
    return this;
  }
  delete(ref) {
    this._ops.push({ type: 'delete', table: ref._table, id: ref._id });
    return this;
  }

  async commit() {
    // Group inserts by table for efficiency
    const byTable = {};
    for (const op of this._ops) {
      if (!byTable[op.table]) byTable[op.table] = [];
      byTable[op.table].push(op);
    }
    for (const [table, ops] of Object.entries(byTable)) {
      const upserts = ops.filter(o => o.type === 'upsert').map(o => o.payload);
      if (upserts.length) {
        const { error } = await _sb.from(table).upsert(upserts);
        if (error) throw new Error(error.message);
      }
      for (const op of ops.filter(o => o.type === 'update')) {
        const { error } = await _sb.from(table).update(op.payload).eq('id', op.id);
        if (error) throw new Error(error.message);
      }
      for (const op of ops.filter(o => o.type === 'delete')) {
        const { error } = await _sb.from(table).delete().eq('id', op.id);
        if (error) throw new Error(error.message);
      }
    }
  }
}

// ── Key conversion helpers ────────────────────────────────
// Firebase used camelCase field names; Supabase/Postgres uses snake_case.
// These convert automatically so no page file needs to change.

const _CAMEL_TO_SNAKE = {
  createdAt:        'created_at',
  createdBy:        'created_by',
  facilityId:       'facility_id',
  facilityIds:      'facility_ids',  // stored as jsonb array
  companyId:        'company_id',
  isAdmin:          'is_admin',
  firstName:        'first_name',
  lastName:         'last_name',
  adminRequested:   'admin_requested',
  holdingCapacity:  'holding_capacity',
  fuelType:         'fuel_type',
  tankCapacity:     'tank_capacity',
  lubOilCapacity:   'lub_oil_capacity',
  maintenanceType:  'maintenance_type',
  currentMRH:       'current_mrh',
  totalMRH:         'total_mrh',
  dateReplaced:     'date_replaced',
  scheduledDate:    'scheduled_date',
  skipReason:       'skip_reason',
  completedAt:      'completed_at',
  completedBy:      'completed_by',
  skippedBy:        'skipped_by',
  skippedAt:        'skipped_at',
  generatedBy:      'generated_by',
  dateCompleted:    'date_completed',
};

const _SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(_CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
);

function _toSnake(key) { return _CAMEL_TO_SNAKE[key] || key; }
function _toCamel(key) { return _SNAKE_TO_CAMEL[key] || key; }

// Convert a camelCase JS object → snake_case DB row
function _toDB(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    // Strip Firebase sentinel values
    if (v && typeof v === 'object' && v.constructor && v.constructor.name === 'FieldValue') continue;
    if (v === null || v === undefined) continue;
    out[_toSnake(k)] = Array.isArray(v) ? v : v;
  }
  return out;
}

// Convert a snake_case DB row → camelCase JS object
function _fromDB(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[_toCamel(k)] = v;
  }
  return out;
}

// ── firebase.firestore.FieldValue stub ────────────────────
// The app uses FieldValue.serverTimestamp() and null in updates.
// We simply strip these from _toDB() above (Supabase sets
// created_at/updated_at via DB defaults/triggers).
if (typeof firebase === 'undefined') {
  window.firebase = {
    firestore: {
      FieldValue: { serverTimestamp: () => null, delete: () => null },
    },
  };
}
