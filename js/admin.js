import { db, ref, set, update, get } from "./firebase-config.js";
import { initialQuestions } from "./questions.js";

let timerInterval = null;
let questionsBank = [...initialQuestions];

// تهيئة اللعبة أو إعادة الضبط
document.getElementById("btn-start-game").addEventListener("click", startNewQuestion);
document.getElementById("btn-next-question").addEventListener("click", startNewQuestion);
document.getElementById("btn-save-settings").addEventListener("click", saveSettings);
document.getElementById("btn-reset-all").addEventListener("click", resetAll);

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
    alert("نفذت الأسئلة المتاحة بهذا المستوى! سيتم إعادة تصفير السجل.");
    await set(ref(db, "gameState/usedQuestions"), []);
    available = questionsBank;
  }

  const randomQ = available[Math.floor(Math.random() * available.length)];

  // تحديث حالة الفايربيس للبدء
  const newState = {
    isActive: true,
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

    // فحص الفائز أثناء الوقت
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

async function resetAll() {
  if (confirm("هل أنت تأكد من إعادة ضبط اللعبة بالكامل وتصفير النقاط؟")) {
    clearInterval(timerInterval);
    await set(ref(db, "gameState"), {
      isActive: false,
      currentRound: 0,
      scores: { team1: 0, team2: 0 },
      settings: { team1Name: "الفريق الأزرق", team2Name: "الفريق الأحمر", questionDuration: 30, stealDuration: 10, difficulty: "all" },
      timer: 30,
      usedQuestions: []
    });
    location.reload();
  }
}
