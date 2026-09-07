import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, child, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDsqfOvjo9TCAGRD7V2dYg9pwWHhgxtzmA",
  authDomain: "speed-challenge-ceb23.firebaseapp.com",
  databaseURL: "https://speed-challenge-ceb23-default-rtdb.firebaseio.com",
  projectId: "speed-challenge-ceb23",
  storageBucket: "speed-challenge-ceb23.firebasestorage.app",
  messagingSenderId: "520230840396",
  appId: "1:520230840396:web:02fec49a410b868172ace9",
  measurementId: "G-04ZN280VNK"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, get, update, onValue, push, child, serverTimestamp };
