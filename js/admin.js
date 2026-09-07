import { db, ref, set, update, get, onValue } from "./firebase-config.js";
import { initialQuestions } from "./questions.js";

let timerInterval = null;
let questionsBank = [...initialQuestions];
let isStarting = false; // منع تكرار التشغيل أكثر من مرة

// الاستماع المباشر لانضمام الفريقين
onValue(ref(db, "gameState"), (snapshot) => {
  const state = snapshot.val();
  if (!state) return;

  // التحقق من انضمام الفريقين وأن اللعبة متوقفة حالياً
  const team1Ready = state.team1Joined === true;
  const team2Ready = state.team2Joined === true;

  if (team1Ready && team2Ready && !state.isActive && !state.isCountdown && !isStarting) {
    isStarting = true;
    startNewQuestion();
  }
});

async function startNewQuestion() {
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

  // --- العد التنازلي (5 -> 1) ---
  for (let countdown = 5; countdown >= 1; countdown--) {
    await update(ref(db, "gameState"), {
      isActive: false,
      isCountdown: true,
      countdownValue: countdown,
      statusMessage: `🔥 اكتمل دخول الفريقين! تبدأ الجولة خلال: ${countdown}`
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // --- بدء السؤال ---
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

// أزرار التحكم اليدوي للإحتياط
document.getElementById("btn-start-game")?.addEventListener("click", startNewQuestion);
document.getElementById("btn-next-question")?.addEventListener("click", startNewQuestion);
