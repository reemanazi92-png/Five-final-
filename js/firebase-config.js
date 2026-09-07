import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, child, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// =========================================================================
// ⚠️ ضع بيانات مشروع الفايربيس الخاص بك هنا (Firebase Config)
// =========================================================================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, get, update, onValue, push, child, serverTimestamp };
