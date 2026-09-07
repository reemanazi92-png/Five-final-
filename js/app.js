import { db, ref, onValue, set, update, get } from "./firebase-config.js";
import { soundFx } from "./utils.js";
import { initialQuestions } from "./questions.js";

// توليد QR Code لكل فريق
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

let timerInterval = null;
let isStarting = false;
let questionsBank = [...initialQuestions];

// الاستماع المباشر وتسيير اللعبة أوتوماتيكيًا
onValue(ref(db, "gameState"), (snapshot) => {
  const state = snapshot.val();
  if (!state) return;

  // 1. إعدادات الأسماء والنقاط
  const team1Name = state.settings?.team1Name || "الفريق الأول";
  const team2Name = state.settings?.team2Name || "الفريق الثاني";

  if (team1NameEl) team1NameEl.innerText = `🟦 ${team1Name}`;
  if (team2NameEl) team2NameEl.innerText = `🟥 ${team2Name}`;
  if (team1ScoreEl) team1ScoreEl.innerText = `${team1Name}: ${state.scores?.team1 || 0}`;
  if (team2ScoreEl) team2ScoreEl.innerText = `${team2Name}: ${state.scores?.team2 || 0}`;

  // 2. التحقق من انضمام الفريقين وبدء اللعبة أوتوماتيكيًا
  if (state.team1Joined && state.team2Joined && !state.isActive && !state.isCountdown && !isStarting) {
    isStarting = true;
    autoStartNewQuestion();
  }

  // 3. عرض العد التنازلي (5 -> 1)
  if (state.isCountdown) {
    if (timerEl) timerEl.innerText = state.countdownValue;
    if (roundEl) roundEl.innerText = "استعدوا!";
    if (questionTextEl) questionTextEl.innerText = state.statusMessage || "تجهزوا للإجابة...";
    if (categoryEl) categoryEl.innerText = "العد التنازلي";
    if (stealBanner) stealBanner.style.display = "none";
    soundFx.tick();
    return;
  }

  // 4. عرض الجولة والسؤال أثناء اللعب
  if (roundEl) roundEl.innerText = `الجولة ${state.currentRound || 1}`;
  if (timerEl) timerEl.innerText = state.timer ?? 30;

  if (state.timer <= 5 && state.timer > 0 && state.isActive) {
    timerEl.classList.add("pulse-warning");
    soundFx.tick();
  } else {
    if (timerEl) timerEl.classList.remove("pulse-warning");
  }

  if (state.isActive && state.currentQuestion) {
    if (questionTextEl) questionTextEl.innerText = state.currentQuestion.question;
    if (categoryEl) categoryEl.innerText = state.currentQuestion.category || "التصنيف";
  } else if (!state.isActive && !state.isCountdown) {
    if (questionTextEl) questionTextEl.innerText = "بانتظار انضمام الفريقين عبر الـ QR...";
  }

  if (stealBanner) stealBanner.style.display = state.isStealPhase ? "block" : "none";

  renderAnswers(state.team1Answers || {}, team1AnswersLive, team1CountEl, state.team1Status, team1StatusEl);
  renderAnswers(state.team2Answers || {}, team2AnswersLive, team2CountEl, state.team2Status, team2StatusEl);

  // الفائز باللعبة
  if (state.winner) {
    soundFx.win();
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    document.getElementById("winner-modal").style.display = "flex";
    document.getElementById("winner-team-name").innerText = state.winner;
    document.getElementById("final-scores").innerText = `${state.scores.team1} - ${state.scores.team2}`;
  }
});

// دالة بدء السؤال تلقائيًا وإدارة المؤقت
async function autoStartNewQuestion() {
  clearInterval(timerInterval);

  const snapshot = await get(ref(db, "gameState"));
  const state = snapshot.val() || {};
  const settings = state.settings || { questionDuration: 30, difficulty: "all" };

  const usedIds = state.usedQuestions || [];
  let available = questionsBank.filter(q => !usedIds.includes(q.id));
  if (settings.difficulty !== "all") {
    available = available.filter(q => q.difficulty === settings.difficulty);
  }

  if (available.length === 0) {
    await set(ref(db, "gameState/usedQuestions"), []);
    available = questionsBank;
  }

  const randomQ = available[Math.floor(Math.random() * available.length)];

  // العد التنازلي (5 -> 1)
  for (let countdown = 5; countdown >= 1; countdown--) {
    await update(ref(db, "gameState"), {
      isActive: false,
      isCountdown: true,
      countdownValue: countdown,
      statusMessage: `🔥 انضم الفريقان! تبدأ الجولة خلال: ${countdown}`
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // إطلاق السؤال
  const newState = {
    isActive: true,
    isCountdown: false,
    currentQuestion: randomQ,
    currentRound: (state.currentRound || 0) + 1,
    timer: settings.questionDuration,
    team1Answers: {},
    team2Answers: {},
    team1Status: "🟢 يجيب الآن",
    team2Status: "🟢 يجيب الآن",
    team1Joined: true,
    team2Joined: true,
    isStealPhase: false,
    settings: settings,
    scores: state.scores || { team1: 0, team2: 0 },
    usedQuestions: [...usedIds, randomQ.id]
  };

  await set(ref(db, "gameState"), newState);
  isStarting = false;
  runTimer(settings.questionDuration);
}

function runTimer(seconds) {
  let timeLeft = seconds;
  timerInterval = setInterval(async () => {
    timeLeft--;
    await update(ref(db, "gameState"), { timer: timeLeft });

    const snap = await get(ref(db, "gameState"));
    const val = snap.val();

    if (val.roundWinner) {
      clearInterval(timerInterval);
      handleRoundWin(val.roundWinner);
      return;
    }

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      handleTimeOut();
    }
  }, 1000);
}

async function handleRoundWin(winnerTeam) {
  const snap = await get(ref(db, "gameState"));
  const state = snap.val();
  const currentScores = state.scores || { team1: 0, team2: 0 };
  currentScores[winnerTeam] = (currentScores[winnerTeam] || 0) + 1;

  await update(ref(db, "gameState"), {
    isActive: false,
    scores: currentScores,
    roundWinner: null,
    [`${winnerTeam}Status`]: "🏆 فاز بالجولة!"
  });
}

async function handleTimeOut() {
  await update(ref(db, "gameState"), {
    isActive: false,
    isStealPhase: true,
    timer: 10,
    team1Status: "⏰ انتهى الوقت",
    team2Status: "⏰ انتهى الوقت"
  });
}

function renderAnswers(answersObj, container, countEl, status, statusEl) {
  if (!container) return;
  container.innerHTML = "";
  const answers = Object.values(answersObj);
  const validAnswers = answers.filter(a => a.valid);

  if (countEl) countEl.innerText = `${validAnswers.length} / 5`;
  if (statusEl) statusEl.innerText = status || "🟢 يجيب الآن";

  validAnswers.forEach(ans => {
    const chip = document.createElement("div");
    chip.className = "answer-chip";
    chip.innerHTML = `<span>✅ ${ans.text}</span>`;
    container.appendChild(chip);
  });
}
