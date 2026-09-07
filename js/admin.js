import { db, ref, set, update, get, onValue } from "./firebase-config.js";
import { initialQuestions } from "./questions.js";

let timerInterval = null;
let questionsBank = [...initialQuestions];
let autoStartTriggered = false; // لمنع التكرار التلقائي

// تهيئة الأحداث اليدوية
document.getElementById("btn-start-game")?.addEventListener("click", () => startNewQuestion());
document.getElementById("btn-next-question")?.addEventListener("click", () => startNewQuestion());
document.getElementById("btn-save-settings")?.addEventListener("click", saveSettings);
document.getElementById("btn-reset-all")?.addEventListener("click", resetAll);

// --- التشغيل التلقائي بمجرد دخول الفريقين ---
onValue(ref(db, "gameState"), (snapshot) => {
  const state = snapshot.val();
  if (!state) return;

  // التحقق من انضمام الفريقين وأن اللعبة ليست نشطة حاليًا
  const team1Joined = state.team1Status && !state.team1Status.includes("في انتظار");
  const team2Joined = state.team2Status && !state.team2Status.includes("في انتظار");

  if (team1Joined && team2Joined && !state.isActive && !state.isCountdown && !autoStartTriggered) {
    autoStartTriggered = true;
    startNewQuestion();
  }
});

async function saveSettings() {
  const team1Name = document.getElementById("input-team1-name").value;
  const team2Name = document.getElementById("input-team2-name").value;
  const timer = parseInt(document.getElementById("select-timer").value);
  const stealTimer = parseInt(document.getElementById("input-steal-timer").value);
  const difficulty = document.getElementById("select-difficulty").value;

  await update(ref(db, "gameState/settings"), {
    team1Name, team2Name, questionDuration: timer, stealDuration: stealTimer, difficulty
  });
  alert("تم حفظ الإعدادات بنجاح!");
}

async function startNewQuestion() {
  clearInterval(timerInterval);

  const snapshot = await get(ref(db, "gameState"));
  const state = snapshot.val() || {};
  const settings = state.settings || { questionDuration: 30, difficulty: "all" };

  // اختيار سؤال غير مكرر
  const usedIds = state.usedQuestions || [];
  let available = questionsBank.filter(q => !usedIds.includes(q.id));
  if (settings.difficulty !== "all") {
    available = available.filter(q => q.difficulty === settings.difficulty);
  }

  if (available.length === 0) {
    alert("نفدت الأسئلة المتاحة بهذا المستوى! سيتم إعادة تصفير السجل.");
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
      statusMessage: `🔥 اكتمل الفريقان! تبدأ الجولة خلال: ${countdown}`
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // --- بدء الجولة رسمياً ---
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
    isStealPhase: false,
    settings: settings,
    scores: state.scores || { team1: 0, team2: 0 },
    usedQuestions: [...usedIds, randomQ.id]
  };

  await set(ref(db, "gameState"), newState);
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
  const currentScores = state.scores;
  currentScores[winnerTeam] += 1;

  await update(ref(db, "gameState"), {
    isActive: false,
    scores: currentScores,
    roundWinner: null,
    [`${winnerTeam}Status`]: "🏆 فاز بالجولة!"
  });
  
  autoStartTriggered = false; // السماح بالجولة التالية
}

async function handleTimeOut() {
  await update(ref(db, "gameState"), {
    isActive: false,
    isStealPhase: true,
    timer: 10,
    team1Status: "⏰ انتهى الوقت",
    team2Status: "⏰ انتهى الوقت"
  });
  
  autoStartTriggered = false;
}

async function resetAll() {
  if (confirm("هل أنت تأكد من إعادة ضبط اللعبة بالكامل وتصفير النقاط؟")) {
    clearInterval(timerInterval);
    autoStartTriggered = false;
    await set(ref(db, "gameState"), {
      isActive: false,
      isCountdown: false,
      currentRound: 0,
      scores: { team1: 0, team2: 0 },
      settings: { team1Name: "الفريق الأزرق", team2Name: "الفريق الأحمر", questionDuration: 30, stealDuration: 10, difficulty: "all" },
      timer: 30,
      usedQuestions: []
    });
    location.reload();
  }
}
