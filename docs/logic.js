/* ==========================================================================
   logic.js — כל הלוגיקה הטהורה של הטראקר.
   הקובץ הזה לא מכיר את React ולא את Firebase, ולכן אפשר לבדוק אותו
   בבדיקות אוטומטיות (tests/logic.test.js).
   ========================================================================== */
var HT = (function () {
  "use strict";

  var HEB_MONTHS = [
    "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
    "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"
  ];

  var DEFAULT_HABITS = [
    { id: "read", name: "לקרוא" },
    { id: "train", name: "להתאמן" },
    { id: "nosmoke", name: "לא לעשן" },
    { id: "academy", name: "לימודים אקדמאיים" },
    { id: "arabic", name: "לימודי ערבית" },
    { id: "calories", name: "צריכה קלורית" },
    { id: "coffee", name: "קפה (עד 3)" }
  ];

  var FIRST_MONTH = "2026-09"; // לא חוזרים אחורה מספטמבר 2026

  var VERSION = "2.1.0";
  var CREDIT = "Emanuel Nassimiha 2026";

  /* ---------- תאריכים ---------- */

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function monthKey(year, month) { return year + "-" + pad2(month); }

  function parseMonthKey(key) {
    var parts = String(key).split("-");
    return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) };
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function daysInMonthKey(key) {
    var p = parseMonthKey(key);
    return daysInMonth(p.year, p.month);
  }

  function monthLabel(key) {
    var p = parseMonthKey(key);
    return HEB_MONTHS[p.month - 1] + " " + p.year;
  }

  function shiftMonth(key, delta) {
    var p = parseMonthKey(key);
    var m = p.month - 1 + delta;
    var y = p.year + Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    return monthKey(y, m + 1);
  }

  function canGoBack(key) { return key > FIRST_MONTH; }

  /** כל מפתחות החודשים מ-from עד to, כולל */
  function monthRange(from, to) {
    var out = [], cur = from;
    var guard = 0;
    while (cur <= to && guard < 600) { out.push(cur); cur = shiftMonth(cur, 1); guard++; }
    return out;
  }

  function todayParts(now) {
    var d = now || new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }

  function currentMonthKey(now) {
    var t = todayParts(now);
    var key = monthKey(t.year, t.month);
    return key < FIRST_MONTH ? FIRST_MONTH : key;
  }

  /* ---------- מבנה הנתונים של חודש ---------- */
  /* { habits: [{id,name}], days: { "1": {moment, sleep, weight, marks:{id:true}} }, nextMonth: "" } */

  function emptyMonth(habits) {
    return {
      habits: (habits && habits.length ? habits : DEFAULT_HABITS).map(function (h) {
        return { id: h.id, name: h.name };
      }),
      days: {},
      nextMonth: ""
    };
  }

  function numOrNull(v) {
    if (v === "" || v === null || v === undefined) return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  /** מנקה מסמך שהגיע מ‑Firestore ומוודא שיש לו את כל השדות */
  function normalizeMonth(raw, fallbackHabits) {
    var base = emptyMonth(fallbackHabits);
    if (!raw || typeof raw !== "object") return base;

    var habits = Array.isArray(raw.habits) && raw.habits.length
      ? raw.habits
          .filter(function (h) { return h && h.id; })
          .map(function (h) { return { id: String(h.id), name: String(h.name || "ללא שם") }; })
      : base.habits;

    var ids = {};
    habits.forEach(function (h) { ids[h.id] = true; });

    var days = {};
    var rawDays = raw.days && typeof raw.days === "object" ? raw.days : {};
    Object.keys(rawDays).forEach(function (k) {
      var d = rawDays[k] || {};
      var marks = {};
      var rawMarks = d.marks && typeof d.marks === "object" ? d.marks : {};
      Object.keys(rawMarks).forEach(function (id) {
        if (rawMarks[id] && ids[id]) marks[id] = true; // מתעלמים מסימונים של נושא שנמחק
      });
      days[String(k)] = {
        moment: typeof d.moment === "string" ? d.moment : "",
        sleep: numOrNull(d.sleep),
        weight: numOrNull(d.weight),
        marks: marks
      };
    });

    return {
      habits: habits,
      days: days,
      nextMonth: typeof raw.nextMonth === "string" ? raw.nextMonth : ""
    };
  }

  function getDay(month, day) {
    var d = month.days[String(day)];
    return d || { moment: "", sleep: null, weight: null, marks: {} };
  }

  /* ---------- עדכונים (מחזירים אובייקט חדש, בלי לשנות את הקיים) ---------- */

  function withDay(month, day, patch) {
    var key = String(day);
    var current = getDay(month, day);
    var next = {
      moment: patch.moment !== undefined ? patch.moment : current.moment,
      sleep: patch.sleep !== undefined ? numOrNull(patch.sleep) : current.sleep,
      weight: patch.weight !== undefined ? numOrNull(patch.weight) : current.weight,
      marks: patch.marks !== undefined ? patch.marks : current.marks
    };
    var days = {};
    Object.keys(month.days).forEach(function (k) { days[k] = month.days[k]; });
    days[key] = next;
    return { habits: month.habits, days: days, nextMonth: month.nextMonth };
  }

  function toggleMark(month, day, habitId) {
    var current = getDay(month, day);
    var marks = {};
    Object.keys(current.marks).forEach(function (k) { marks[k] = true; });
    if (marks[habitId]) delete marks[habitId];
    else marks[habitId] = true;
    return withDay(month, day, { marks: marks });
  }

  function isMarked(month, day, habitId) {
    return !!getDay(month, day).marks[habitId];
  }

  function newHabitId(existing) {
    var taken = {};
    (existing || []).forEach(function (h) { taken[h.id] = true; });
    var i = 1;
    var id;
    do { id = "h" + i; i++; } while (taken[id]);
    return id;
  }

  function addHabit(month, name) {
    var habit = { id: newHabitId(month.habits), name: name || "נושא חדש" };
    return { habits: month.habits.concat([habit]), days: month.days, nextMonth: month.nextMonth };
  }

  function renameHabit(month, habitId, name) {
    return {
      habits: month.habits.map(function (h) {
        return h.id === habitId ? { id: h.id, name: name } : h;
      }),
      days: month.days,
      nextMonth: month.nextMonth
    };
  }

  /** מחיקת נושא מוחקת גם את כל הסימונים שלו בחודש הזה בלבד */
  function removeHabit(month, habitId) {
    var days = {};
    Object.keys(month.days).forEach(function (k) {
      var d = month.days[k];
      var marks = {};
      Object.keys(d.marks).forEach(function (id) { if (id !== habitId) marks[id] = true; });
      days[k] = { moment: d.moment, sleep: d.sleep, weight: d.weight, marks: marks };
    });
    return {
      habits: month.habits.filter(function (h) { return h.id !== habitId; }),
      days: days,
      nextMonth: month.nextMonth
    };
  }

  function moveHabit(month, habitId, delta) {
    var list = month.habits.slice();
    var i = list.findIndex(function (h) { return h.id === habitId; });
    var j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return month;
    var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    return { habits: list, days: month.days, nextMonth: month.nextMonth };
  }

  /* ---------- סטטיסטיקה ---------- */

  function longestStreak(flags) {
    var best = 0, run = 0;
    for (var i = 0; i < flags.length; i++) {
      if (flags[i]) { run++; if (run > best) best = run; }
      else run = 0;
    }
    return best;
  }

  function currentStreak(flags, upTo) {
    var end = (upTo === undefined ? flags.length : upTo) - 1;
    var run = 0;
    for (var i = end; i >= 0; i--) {
      if (flags[i]) run++;
      else break;
    }
    return run;
  }

  /** עד איזה יום סופרים: החודש הנוכחי נספר עד היום, חודש שעבר עד סופו */
  function countedDays(monthKeyStr, now) {
    var total = daysInMonthKey(monthKeyStr);
    var t = todayParts(now);
    if (monthKey(t.year, t.month) === monthKeyStr) return Math.min(t.day, total);
    if (monthKeyStr > monthKey(t.year, t.month)) return 0;
    return total;
  }

  function habitStats(month, monthKeyStr, now) {
    var total = daysInMonthKey(monthKeyStr);
    var counted = countedDays(monthKeyStr, now);
    return month.habits.map(function (h) {
      var flags = [];
      for (var d = 1; d <= total; d++) flags.push(isMarked(month, d, h.id));
      var done = 0;
      for (var i = 0; i < counted; i++) if (flags[i]) done++;
      return {
        id: h.id,
        name: h.name,
        done: done,
        counted: counted,
        percent: counted ? Math.round((done / counted) * 100) : 0,
        best: longestStreak(flags),
        current: currentStreak(flags, counted)
      };
    });
  }

  /* ---------- גרפים ---------- */

  /** מחזיר רשימת ערכים לפי יום, כולל ימים ריקים (null) — כדי שהקו יישבר */
  function series(month, field, monthKeyStr) {
    var total = daysInMonthKey(monthKeyStr);
    var out = [];
    for (var d = 1; d <= total; d++) {
      var v = getDay(month, d)[field];
      out.push({ day: d, value: (v === null || v === undefined) ? null : Number(v) });
    }
    return out;
  }

  /** חותך את הסדרה לקטעים רציפים — כל קטע הוא קו נפרד בגרף */
  function segments(points) {
    var segs = [], cur = [];
    points.forEach(function (p) {
      if (p.value === null) {
        if (cur.length) segs.push(cur);
        cur = [];
      } else {
        cur.push(p);
      }
    });
    if (cur.length) segs.push(cur);
    return segs;
  }

  /** תחום גרף המשקל: תמיד עד הכפולה של 5 הקרובה כלפי חוץ (67→65, 73→75) */
  function weightBounds(points) {
    var vals = points.filter(function (p) { return p.value !== null; })
                     .map(function (p) { return p.value; });
    if (!vals.length) return { min: 70, max: 75, empty: true };
    var lo = Math.min.apply(null, vals);
    var hi = Math.max.apply(null, vals);
    var min = Math.floor(lo / 5) * 5;
    var max = Math.ceil(hi / 5) * 5;
    if (max - min < 5) max = min + 5;
    return { min: min, max: max, empty: false };
  }

  /** תוויות המשקל: קילו שלם כשאפשר, ואחרת הקפיצה הקטנה ביותר שעדיין נקראת */
  function weightLabels(min, max) {
    var range = max - min;
    var steps = [1, 2, 5, 10, 25, 50];
    var step = steps[steps.length - 1];
    for (var i = 0; i < steps.length; i++) {
      var count = range / steps[i] + 1;
      if (Math.abs(count - Math.round(count)) < 1e-9 && count <= 6) { step = steps[i]; break; }
    }
    var out = [];
    for (var v = max; v >= min - 1e-9; v -= step) out.push(Math.round(v * 10) / 10);
    return out;
  }

  /** תוויות לסרגל הגרף, מהערך הגבוה לנמוך (סדר התצוגה משמאל לימין) */
  function scaleLabels(min, max, count) {
    var n = Math.max(2, count || 5);
    var step = (max - min) / (n - 1);
    var out = [];
    for (var i = 0; i < n; i++) {
      var v = max - step * i;
      out.push(Math.abs(step) >= 5 ? Math.round(v) : Math.round(v * 10) / 10);
    }
    return out;
  }

  /** ימים שכבר עברו ואין בהם ציון שינה */
  function missingSleepDays(month, monthKeyStr, now) {
    var counted = countedDays(monthKeyStr, now);
    var out = [];
    for (var d = 1; d <= counted; d++) {
      if (getDay(month, d).sleep === null) out.push(d);
    }
    return out;
  }

  function dayOfWeekLetter(monthKeyStr, day) {
    var p = parseMonthKey(monthKeyStr);
    var idx = new Date(p.year, p.month - 1, day).getDay();
    return ["א", "ב", "ג", "ד", "ה", "ו", "ש"][idx];
  }

  function isWeekend(monthKeyStr, day) {
    var p = parseMonthKey(monthKeyStr);
    var idx = new Date(p.year, p.month - 1, day).getDay();
    return idx === 5 || idx === 6;
  }

  return {
    VERSION: VERSION,
    CREDIT: CREDIT,
    HEB_MONTHS: HEB_MONTHS,
    DEFAULT_HABITS: DEFAULT_HABITS,
    FIRST_MONTH: FIRST_MONTH,
    pad2: pad2,
    monthKey: monthKey,
    parseMonthKey: parseMonthKey,
    daysInMonth: daysInMonth,
    daysInMonthKey: daysInMonthKey,
    monthLabel: monthLabel,
    shiftMonth: shiftMonth,
    canGoBack: canGoBack,
    monthRange: monthRange,
    todayParts: todayParts,
    currentMonthKey: currentMonthKey,
    emptyMonth: emptyMonth,
    normalizeMonth: normalizeMonth,
    getDay: getDay,
    withDay: withDay,
    toggleMark: toggleMark,
    isMarked: isMarked,
    newHabitId: newHabitId,
    addHabit: addHabit,
    renameHabit: renameHabit,
    removeHabit: removeHabit,
    moveHabit: moveHabit,
    longestStreak: longestStreak,
    currentStreak: currentStreak,
    countedDays: countedDays,
    habitStats: habitStats,
    series: series,
    segments: segments,
    weightBounds: weightBounds,
    scaleLabels: scaleLabels,
    weightLabels: weightLabels,
    missingSleepDays: missingSleepDays,
    dayOfWeekLetter: dayOfWeekLetter,
    isWeekend: isWeekend
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = HT;
