// نظام تطبيع ومعالجة النصوص العربية
export function normalizeArabicText(text) {
  if (!text) return "";
  let str = text.trim().toLowerCase();

  // إزالة التشكيل والتنوين
  str = str.replace(/[\u064B-\u0652]/g, "");

  // توحيد الهمزات والألف
  str = str.replace(/[أإآٱ]/g, "ا");

  // توحيد التاء المربوطة والهاء
  str = str.replace(/ة/g, "ه");

  // توحيد الياء المقصورة والياء
  str = str.replace(/ى/g, "ي");

  // إزالة التعريف في بداية الكلمات عند المقارنة المريضة (اختياري، سنبقيها دقيقة)
  // إزالة المسافات الزائدة ورموز الترقيم
  str = str.replace(/[^\w\sء-ي]/g, "");
  str = str.replace(/\s+/g, " ");

  return str.trim();
}

// نظام التأثيرات الصوتية الذاتي (Web Audio API - لا يحتاج ملفات خارجية)
class SoundEffects {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playTone(freq, type, duration) {
    if (!this.enabled) return;
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.log("Audio play error", e);
    }
  }

  correct() {
    this.playTone(523.25, 'sine', 0.1); // C5
    setTimeout(() => this.playTone(659.25, 'sine', 0.2), 100); // E5
  }

  wrong() {
    this.playTone(220, 'sawtooth', 0.3); // A3
  }

  tick() {
    this.playTone(800, 'square', 0.05);
  }

  win() {
    [400, 500, 600, 800].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'triangle', 0.2), i * 150);
    });
  }
}

export const soundFx = new SoundEffects();
