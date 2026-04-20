/**
 * ============================================================
 *  Tekora — Maintenance Management System
 *  File: js/firebase.config.js
 *
 *  PURPOSE: Firebase project credentials + SDK initialisation.
 *  This is the ONLY file you need to edit to connect Tekora
 *  to your own Firebase project.
 *
 *  SETUP STEPS:
 *  ─────────────────────────────────────────────────────────
 *  1. Go to https://console.firebase.google.com
 *  2. Create (or open) your project
 *  3. Project Settings → General → Your apps → Add app → Web
 *  4. Copy the firebaseConfig values and paste them below
 *  5. Authentication → Sign-in method → Enable "Email/Password"
 *  6. Firestore Database → Create database (Test mode to start)
 *  7. The default admin is auto-created on first load:
 *       Email:    Admin@tekora.example
 *       Password: Admin
 *     Change these credentials immediately after first login.
 *
 *  FIRESTORE COLLECTIONS:
 *  ─────────────────────────────────────────────────────────
 *  companies         — company name & address
 *  users             — user profiles, roles, facility assignment
 *  facilities        — facility records (type, capacity, state…)
 *  equipment         — all equipment across all facilities
 *  requests          — maintenance requests / work orders
 *  pms_schedules     — planned maintenance schedule instances
 *  activities        — PMS activity type templates
 *  maintenance_groups — groups / locations for activities
 *  facility_history  — audit trail: facility change log per user
 * ============================================================
 */

"use strict";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB-gAHwvfA_Yz5QI1HbTKJlE33g6psIMWM",
  authDomain: "fleet-maintenance-01aaa.firebaseapp.com",
  databaseURL: "https://fleet-maintenance-01aaa-default-rtdb.firebaseio.com",
  projectId: "fleet-maintenance-01aaa",
  storageBucket: "fleet-maintenance-01aaa.firebasestorage.app",
  messagingSenderId: "793969008538",
  appId: "1:793969008538:web:6bfe7ca5e0dec57298a423",
  measurementId: "G-RW5JEZVS7F"
};

// ── Initialise Firebase (runs once; guard against duplicate init) ──────
if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

// ── Exported service handles (used throughout the app) ─────────────────
const auth = firebase.auth();
const db   = firebase.firestore();

// Optional: enable Firestore offline persistence for field use
// db.enablePersistence().catch(err => {
//   if (err.code === 'failed-precondition') console.warn('Persistence failed: multiple tabs open');
//   else if (err.code === 'unimplemented') console.warn('Persistence not supported in this browser');
// });
