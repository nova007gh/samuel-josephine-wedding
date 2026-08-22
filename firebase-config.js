'use strict';

const ADMIN_EMAIL = 'sny@wedding.com';
const ADMIN_PASSWORD = 'sam&jossy@2027';

const firebaseConfig = {
  apiKey: "AIzaSyD3f9DX63UNykrP_2h2jecOGsG6LO1kApA",
  authDomain: "wedding-4db15.firebaseapp.com",
  projectId: "wedding-4db15",
  storageBucket: "wedding-4db15.firebasestorage.app",
  messagingSenderId: "1045910109676",
  appId: "1:1045910109676:web:ae13ab5ca80d67540f54c9",
  measurementId: "G-45J1NW9JN5"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code !== 'failed-precondition' && err.code !== 'unimplemented'){
    console.warn('Firestore persistence failed:', err);
  }
});
