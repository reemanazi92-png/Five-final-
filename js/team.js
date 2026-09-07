import { db, ref, onValue, push, get, set } from "./firebase-config.js";
import { normalizeArabicText, soundFx } from "./utils.js";

const urlParams = new URLSearchParams(window.location.search);
const teamKey = urlParams.get("team") || "team1";

const teamHeader = document.getElementById("mobile-team-header");
const teamNameEl = document.getElementById("mobile-team-name");
const questionEl = document.getElementById("mobile-question");
const categoryEl = document.getElementById("mobile-category");
const timerEl = document.getElementById("mobile-timer");
const inputEl = document.getElementById("answer-input");
const btnSend = document.getElementById("btn-send");
const feedbackEl = document.getElementById("feedback-msg");
const listEl = document.getElementById("accepted-answers-list");
const countEl = document.getElementById("team-valid-count");

teamHeader.className = `team-header glass ${teamKey}`;

let currentGameState = null;

onValue(ref(db, "gameState"), (snapshot) => {
  currentGameState = snapshot.val();
  if (!currentGameState) return;

  const myTeamName = teamKey === "team1" ? currentGameState.settings.team1Name : currentGameState.settings.team2Name;
  teamNameEl.innerText = myTeamName;

  if (currentGameState.currentQuestion) {
    questionEl.innerText = currentGameState.currentQuestion.question;
    categoryEl.innerText = currentGameState.currentQuestion.category;
  }

  timerEl.innerText = currentGameState.timer;

  // تحديث قائمة الإجابات للمستخدم
  const myAnswersObj = currentGameState[`${teamKey}Answers`] || {};
  const myAnswersArr = Object.values(myAnswersObj);
  const validAnswers = myAnswersArr.filter(a => a.valid);

  countEl.innerText = validAnswers.length;
  listEl.innerHTML = "";
  validAnswers.forEach(a => {
    const div = document.createElement("div");
    div.className = "answer-chip";
    div.innerText = `✅ ${a.text}`;
    listEl.appendChild(div);
  });
});

// إرسال الإجابة
btnSend.addEventListener("click", submitAnswer);
inputEl.addEventListener("keypress", (e) => { if (e.key === "Enter") submitAnswer(); });

async function submitAnswer() {
  const text = inputEl.value.trim();
  if (!text || !currentGameState || !currentGameState.isActive) return;

  const normalizedInput = normalizeArabicText(text);
  const acceptedList = currentGameState.currentQuestion.acceptedAnswers.map(a => normalizeArabicText(a));
  const myAnswersObj = currentGameState[`${teamKey}Answers`] || {};
  const myAnswersArr = Object.values(myAnswersObj);

  // 1. فحص التكرار على مستوى الفريق كلياً
  const isDuplicate = myAnswersArr.some(a => normalizeArabicText(a.text) === normalizedInput);
  if (isDuplicate) {
    showFeedback("⚠️ هذه الإجابة مكررة ومسجلة سابقاً للفريق!", "msg-duplicate");
    soundFx.wrong();
    inputEl.value = "";
    return;
  }

  // 2. فحص هل الإجابة صحيحة ومقبولة
  const isValid = acceptedList.includes(normalizedInput);

  if (isValid) {
    showFeedback("✅ إجابة صحيحة ومقبولة!", "msg-success");
    soundFx.correct();

    // التسجيل السريع بالفضاء اللحظي Firebase
    const answersRef = ref(db, `gameState/${teamKey}Answers`);
    await push(answersRef, {
      text: text,
      valid: true,
      timestamp: Date.now()
    });

    // فحص الفوز الفوري (الوصول لـ 5 إجابات صحيحة)
    const currentValidCount = myAnswersArr.filter(a => a.valid).length + 1;
    if (currentValidCount >= 5) {
      await set(ref(db, `gameState/roundWinner`), teamKey);
    }
  } else {
    showFeedback("❌ إجابة غير صحيحة!", "msg-wrong");
    soundFx.wrong();
  }

  inputEl.value = "";
}

function showFeedback(msg, className) {
  feedbackEl.innerText = msg;
  feedbackEl.className = `feedback-msg ${className}`;
  setTimeout(() => { feedbackEl.innerText = ""; }, 2500);
}
