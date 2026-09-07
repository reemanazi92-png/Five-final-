import { db, ref, onValue, set } from "./firebase-config.js";
import { soundFx } from "./utils.js";

// توليد QR Code لكل فريق تلقائياً بناءً على الرابط الحالي
const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
const team1Url = `${baseUrl}/team.html?team=team1`;
const team2Url = `${baseUrl}/team.html?team=team2`;

new QRCode(document.getElementById("qr-team1"), { text: team1Url, width: 140, height: 140 });
new QRCode(document.getElementById("qr-team2"), { text: team2Url, width: 140, height: 140 });

// عناصر الواجهة
const team1ScoreEl = document.getElementById("team1-score-display");
const team2ScoreEl = document.getElementById("team2-score-display");
const team1NameEl = document.getElementById("team1-name-display");
const team2NameEl = document.getElementById("team2-name-display");
const team1CountEl = document.getElementById("team1-count");
const team2CountEl = document.getElementById("team2-count");
const team1StatusEl = document.getElementById("team1-status");
const team2StatusEl = document.getElementById("team2-status");
const questionTextEl = document.getElementById("question-text");
const categoryEl = document.getElementById("question-category");
const roundEl = document.getElementById("round-number");
const timerEl = document.getElementById("timer-display");
const stealBanner = document.getElementById("steal-container");
const team1AnswersLive = document.getElementById("team1-answers-live");
const team2AnswersLive = document.getElementById("team2-answers-live");

// الاستماع المباشر للتغيرات في الفايربيس
onValue(ref(db, "gameState"), (snapshot) => {
  const state = snapshot.val();
  if (!state) return;

  // إعدادات وتحديثات الأسماء والنقاط
  team1NameEl.innerText = `🟦 ${state.settings.team1Name}`;
  team2NameEl.innerText = `🟥 ${state.settings.team2Name}`;
  team1ScoreEl.innerText = `${state.settings.team1Name}: ${state.scores.team1}`;
  team2ScoreEl.innerText = `${state.settings.team2Name}: ${state.scores.team2}`;
  roundEl.innerText = `الجولة ${state.currentRound || 1}`;
  timerEl.innerText = state.timer;

  if (state.timer <= 5 && state.timer > 0) {
    timerEl.classList.add("pulse-warning");
    soundFx.tick();
  } else {
    timerEl.classList.remove("pulse-warning");
  }

  // السؤال
  if (state.currentQuestion) {
    questionTextEl.innerText = state.currentQuestion.question;
    categoryEl.innerText = state.currentQuestion.category;
  }

  // حالة السرقة
  stealBanner.style.display = state.isStealPhase ? "block" : "none";

  // معالجة إجابات الفريقين المباشرة
  renderAnswers(state.team1Answers || {}, team1AnswersLive, team1CountEl, state.team1Status, team1StatusEl);
  renderAnswers(state.team2Answers || {}, team2AnswersLive, team2CountEl, state.team2Status, team2StatusEl);

  // الفائز بجميع الجولات
  if (state.winner) {
    soundFx.win();
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    document.getElementById("winner-modal").style.display = "flex";
    document.getElementById("winner-team-name").innerText = state.winner;
    document.getElementById("final-scores").innerText = `${state.scores.team1} - ${state.scores.team2}`;
  }
});

function renderAnswers(answersObj, container, countEl, status, statusEl) {
  container.innerHTML = "";
  const answers = Object.values(answersObj);
  const validAnswers = answers.filter(a => a.valid);

  countEl.innerText = `${validAnswers.length} / 5`;
  statusEl.innerText = status || "🟢 يجيب الآن";

  validAnswers.forEach(ans => {
    const chip = document.createElement("div");
    chip.className = "answer-chip";
    chip.innerHTML = `<span>✅ ${ans.text}</span>`;
    container.appendChild(chip);
  });
}
