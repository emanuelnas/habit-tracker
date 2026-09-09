"use strict";
/* ==========================================================================
   app.jsx — ממשק הטראקר. נבנה כמו האפליקציה לערבית:
   React 18 מ‑CDN, בלי Babel בדפדפן (הקובץ מקומפל מראש ל‑app.js).
   ========================================================================== */
const { useState, useEffect, useRef, useMemo, useCallback } = React;
/* ---------- עזרי Firebase ---------- */
function monthRef(uid, key) {
    return firebase.firestore()
        .collection("users").doc(uid)
        .collection("habitMonths").doc(key);
}
/* ---------- רכיבים קטנים ---------- */
function XMark({ seed }) {
    const tilt = ((seed * 13) % 9) - 4;
    return (React.createElement("svg", { className: "x", viewBox: "0 0 24 24", style: { transform: `rotate(${tilt}deg)` }, "aria-hidden": "true" },
        React.createElement("path", { d: "M5 4.5 L19 19.5" }),
        React.createElement("path", { d: "M19 4.8 L4.8 19.2" })));
}
function PenIcon() {
    return (React.createElement("svg", { viewBox: "0 0 24 24", className: "ico", "aria-hidden": "true" },
        React.createElement("path", { d: "M4 20l4-1 10-10-3-3L5 16z" }),
        React.createElement("path", { d: "M15 6l3 3" })));
}
/** גרף אנכי: הימים יורדים מלמעלה למטה, הערך נמדד לרוחב.
    הצד הימני של הגרף = הערך הנמוך (קרוב למרכז המחברת). */
function VerticalGraph({ points, min, max, width, rowH, headH, color, ticks, label, unit }) {
    const total = points.length;
    const height = total * rowH;
    const x = (v) => width - ((v - min) / (max - min)) * width;
    const y = (day) => (day - 0.5) * rowH;
    const segs = HT.segments(points);
    const tickLines = [];
    if (ticks) {
        for (let t = min; t <= max + 0.0001; t += ticks) {
            tickLines.push(t);
        }
    }
    return (React.createElement("div", { className: "graph", style: { width: width + "px" } },
        React.createElement("div", { className: "graph-head", style: { height: headH + "px" } },
            React.createElement("span", { className: "graph-title" }, label),
            React.createElement("span", { className: "graph-scale" },
                React.createElement("b", null, max),
                React.createElement("i", null, unit),
                React.createElement("b", null, min))),
        React.createElement("svg", { width: width, height: height, className: "graph-svg", role: "img", "aria-label": label },
            tickLines.map((t, i) => (React.createElement("line", { key: "t" + i, x1: x(t), x2: x(t), y1: "0", y2: height, className: i % 5 === 0 ? "tick major" : "tick" }))),
            segs.map((seg, i) => (React.createElement("polyline", { key: "s" + i, className: "line", stroke: color, points: seg.map((p) => `${x(p.value)},${y(p.day)}`).join(" ") }))),
            points.filter((p) => p.value !== null).map((p) => (React.createElement("circle", { key: "c" + p.day, cx: x(p.value), cy: y(p.day), r: "2.6", fill: color }))))));
}
/* ---------- מסך כניסה ---------- */
function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const submit = async () => {
        if (!email || !password) {
            setError("צריך מייל וסיסמה.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            await firebase.auth().signInWithEmailAndPassword(email.trim(), password);
        }
        catch (e) {
            const map = {
                "auth/invalid-email": "כתובת המייל לא תקינה.",
                "auth/user-not-found": "אין חשבון עם המייל הזה.",
                "auth/wrong-password": "הסיסמה שגויה.",
                "auth/invalid-credential": "המייל או הסיסמה שגויים.",
                "auth/too-many-requests": "יותר מדי ניסיונות. נסה שוב בעוד כמה דקות.",
                "auth/network-request-failed": "אין חיבור לרשת."
            };
            setError(map[e.code] || "ההתחברות נכשלה. נסה שוב.");
            setBusy(false);
        }
    };
    return (React.createElement("div", { className: "login" },
        React.createElement("div", { className: "login-card" },
            React.createElement("h1", { className: "login-title" }, "\u05D4\u05D0\u05D1\u05D9\u05D8 \u05D8\u05E8\u05D0\u05E7\u05E8"),
            React.createElement("p", { className: "login-sub" }, "\u05D4\u05DE\u05D7\u05D1\u05E8\u05EA, \u05D1\u05DC\u05D9 \u05D4\u05DE\u05D7\u05D1\u05E8\u05EA."),
            React.createElement("label", { className: "field" },
                React.createElement("span", null, "\u05DE\u05D9\u05D9\u05DC"),
                React.createElement("input", { type: "email", dir: "ltr", autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value), onKeyDown: (e) => e.key === "Enter" && submit() })),
            React.createElement("label", { className: "field" },
                React.createElement("span", null, "\u05E1\u05D9\u05E1\u05DE\u05D4"),
                React.createElement("input", { type: "password", dir: "ltr", autoComplete: "current-password", value: password, onChange: (e) => setPassword(e.target.value), onKeyDown: (e) => e.key === "Enter" && submit() })),
            error ? React.createElement("p", { className: "login-error" }, error) : null,
            React.createElement("button", { className: "btn primary", onClick: submit, disabled: busy }, busy ? "מתחבר…" : "כניסה"))));
}
/* ---------- ניווט חודשים ---------- */
function MonthNav({ monthKey, onShift, status }) {
    return (React.createElement("div", { className: "monthnav" },
        React.createElement("button", { className: "ghost", onClick: () => onShift(-1), disabled: !HT.canGoBack(monthKey), "aria-label": "\u05D4\u05D7\u05D5\u05D3\u05E9 \u05D4\u05E7\u05D5\u05D3\u05DD" }, "\u203A"),
        React.createElement("h2", { className: "month-title" }, HT.monthLabel(monthKey)),
        React.createElement("button", { className: "ghost", onClick: () => onShift(1), "aria-label": "\u05D4\u05D7\u05D5\u05D3\u05E9 \u05D4\u05D1\u05D0" }, "\u2039"),
        React.createElement("span", { className: "status " + status }, status === "saving" ? "שומר…" : status === "error" ? "לא נשמר" : "נשמר")));
}
/* ---------- טבלת הנושאים ---------- */
function HabitGrid({ month, monthKey, today, rowH, headH, onToggle, showNumbers, onNumber }) {
    const total = HT.daysInMonthKey(monthKey);
    const days = [];
    for (let d = 1; d <= total; d++)
        days.push(d);
    return (React.createElement("div", { className: "grid" },
        React.createElement("div", { className: "grid-head", style: { height: headH + "px" } },
            showNumbers ? (React.createElement(React.Fragment, null,
                React.createElement("div", { className: "numhead" }, "\u05E9\u05D9\u05E0\u05D4"),
                React.createElement("div", { className: "numhead" }, "\u05DE\u05E9\u05E7\u05DC"))) : null,
            month.habits.map((h) => (React.createElement("div", { className: "habit-label", key: h.id },
                React.createElement("span", null, h.name))))),
        React.createElement("div", { className: "grid-body" }, days.map((d) => {
            const day = HT.getDay(month, d);
            return (React.createElement("div", { className: "grid-row" + (d === today ? " is-today" : "") +
                    (HT.isWeekend(monthKey, d) ? " is-weekend" : ""), key: d, style: { height: rowH + "px" } },
                showNumbers ? (React.createElement(React.Fragment, null,
                    React.createElement("input", { className: "numcell", inputMode: "decimal", value: day.sleep === null ? "" : day.sleep, onChange: (e) => onNumber(d, "sleep", e.target.value), "aria-label": "ציון שינה ליום " + d }),
                    React.createElement("input", { className: "numcell", inputMode: "decimal", value: day.weight === null ? "" : day.weight, onChange: (e) => onNumber(d, "weight", e.target.value), "aria-label": "משקל ליום " + d }))) : null,
                month.habits.map((h, i) => (React.createElement("button", { className: "cell", key: h.id, onClick: () => onToggle(d, h.id), "aria-pressed": HT.isMarked(month, d, h.id), "aria-label": h.name + ", יום " + d }, HT.isMarked(month, d, h.id) ? React.createElement(XMark, { seed: d + i }) : null)))));
        }))));
}
/* ---------- רשימת הרגעים ---------- */
function MomentsList({ month, monthKey, today, rowH, onMoment, onOpenDay }) {
    const total = HT.daysInMonthKey(monthKey);
    const rows = [];
    for (let d = 1; d <= total; d++) {
        const day = HT.getDay(month, d);
        rows.push(React.createElement("div", { className: "moment-row" + (d === today ? " is-today" : "") +
                (HT.isWeekend(monthKey, d) ? " is-weekend" : ""), key: d, style: { height: rowH + "px" } },
            onOpenDay
                ? React.createElement("button", { className: "daynum", onClick: () => onOpenDay(d), "aria-label": "פתח את יום " + d },
                    React.createElement("b", null, d),
                    React.createElement("i", null, HT.dayOfWeekLetter(monthKey, d)))
                : React.createElement("span", { className: "daynum" },
                    React.createElement("b", null, d),
                    React.createElement("i", null, HT.dayOfWeekLetter(monthKey, d))),
            React.createElement("input", { className: "moment-input", value: day.moment, maxLength: 110, placeholder: d === today ? "מה נשאר מהיום?" : "", onChange: (e) => onMoment(d, e.target.value), "aria-label": "רגע זכור מיום " + d })));
    }
    return React.createElement("div", { className: "moments" }, rows);
}
/* ---------- סיכום חודשי ---------- */
function Ring({ percent, size, stroke, color, children }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    return (React.createElement("svg", { className: "ring", width: size, height: size, viewBox: `0 0 ${size} ${size}` },
        React.createElement("circle", { cx: size / 2, cy: size / 2, r: r, className: "ring-track", strokeWidth: stroke }),
        React.createElement("circle", { cx: size / 2, cy: size / 2, r: r, className: "ring-fill", strokeWidth: stroke, stroke: color, strokeDasharray: `${(c * percent) / 100} ${c}`, transform: `rotate(-90 ${size / 2} ${size / 2})` }),
        React.createElement("text", { x: "50%", y: "50%", className: "ring-text" }, children)));
}
function Summary({ month, monthKey, now }) {
    const stats = HT.habitStats(month, monthKey, now);
    if (!stats.length)
        return null;
    const totalDone = stats.reduce((a, s) => a + s.done, 0);
    const totalPossible = stats.reduce((a, s) => a + s.counted, 0);
    const overall = totalPossible ? Math.round((totalDone / totalPossible) * 100) : 0;
    return (React.createElement("section", { className: "summary" },
        React.createElement("div", { className: "band" },
            React.createElement("h3", null, "\u05DE\u05D1\u05D8 \u05E2\u05DC"),
            React.createElement("span", null, HT.monthLabel(monthKey))),
        React.createElement("div", { className: "summary-body" },
            React.createElement("div", { className: "overall" },
                React.createElement(Ring, { percent: overall, size: 104, stroke: 11, color: "var(--pen)" }, overall + "%"),
                React.createElement("p", null,
                    totalDone,
                    " \u05E1\u05D9\u05DE\u05D5\u05E0\u05D9\u05DD \u05DE\u05EA\u05D5\u05DA ",
                    totalPossible,
                    " \u05D0\u05E4\u05E9\u05E8\u05D9\u05D9\u05DD")),
            React.createElement("div", { className: "rings" }, stats.map((s) => (React.createElement("div", { className: "ring-cell", key: s.id },
                React.createElement(Ring, { percent: s.percent, size: 68, stroke: 8, color: s.percent >= 80 ? "var(--pen-green)" : "var(--pen)" }, s.percent + "%"),
                React.createElement("b", null, s.name),
                React.createElement("i", null,
                    s.done,
                    "/",
                    s.counted,
                    " \u00B7 \u05E8\u05E6\u05E3 ",
                    s.best))))))));
}
/* ---------- עורך הנושאים ---------- */
function HabitsEditor({ month, onChange, monthKey, inherited }) {
    const [draft, setDraft] = useState("");
    return (React.createElement("div", { className: "editor" },
        React.createElement("h3", null,
            "\u05E0\u05D5\u05E9\u05D0\u05D9 \u05D4\u05DE\u05E2\u05E7\u05D1 \u05E9\u05DC ",
            HT.monthLabel(monthKey)),
        React.createElement("p", { className: "hint" }, "\u05E9\u05D9\u05E0\u05D5\u05D9 \u05DB\u05D0\u05DF \u05DE\u05E9\u05E4\u05D9\u05E2 \u05E2\u05DC \u05D4\u05D7\u05D5\u05D3\u05E9 \u05D4\u05D6\u05D4 \u05D1\u05DC\u05D1\u05D3. \u05D4\u05D7\u05D5\u05D3\u05E9 \u05D4\u05D1\u05D0 \u05D9\u05D9\u05E4\u05EA\u05D7 \u05E2\u05DD \u05D0\u05D5\u05EA\u05D4 \u05E8\u05E9\u05D9\u05DE\u05D4, \u05D5\u05DE\u05E9\u05DD \u05D0\u05E4\u05E9\u05E8 \u05DC\u05E9\u05E0\u05D5\u05EA \u05E9\u05D5\u05D1."),
        inherited ? React.createElement("p", { className: "hint note" },
            "\u05D1\u05E1\u05D5\u05E3 \u05D4\u05D7\u05D5\u05D3\u05E9 \u05D4\u05E7\u05D5\u05D3\u05DD \u05E8\u05E9\u05DE\u05EA: \u201C",
            inherited,
            "\u201D") : null,
        React.createElement("ul", { className: "editor-list" }, month.habits.map((h, i) => (React.createElement("li", { key: h.id },
            React.createElement("input", { value: h.name, onChange: (e) => onChange(HT.renameHabit(month, h.id, e.target.value)), "aria-label": "\u05E9\u05DD \u05D4\u05E0\u05D5\u05E9\u05D0" }),
            React.createElement("button", { className: "ghost sm", onClick: () => onChange(HT.moveHabit(month, h.id, -1)), disabled: i === 0, "aria-label": "\u05D4\u05D6\u05D6 \u05D9\u05DE\u05D9\u05E0\u05D4" }, "\u2191"),
            React.createElement("button", { className: "ghost sm", onClick: () => onChange(HT.moveHabit(month, h.id, 1)), disabled: i === month.habits.length - 1, "aria-label": "\u05D4\u05D6\u05D6 \u05E9\u05DE\u05D0\u05DC\u05D4" }, "\u2193"),
            React.createElement("button", { className: "ghost sm danger", "aria-label": "מחק את " + h.name, onClick: () => {
                    if (confirm("למחוק את “" + h.name + "” מהחודש הזה? כל האיקסים שלו בחודש הזה יימחקו.")) {
                        onChange(HT.removeHabit(month, h.id));
                    }
                } }, "\u2715"))))),
        React.createElement("div", { className: "editor-add" },
            React.createElement("input", { value: draft, placeholder: "\u05E0\u05D5\u05E9\u05D0 \u05D7\u05D3\u05E9", onChange: (e) => setDraft(e.target.value), onKeyDown: (e) => {
                    if (e.key === "Enter" && draft.trim()) {
                        onChange(HT.addHabit(month, draft.trim()));
                        setDraft("");
                    }
                } }),
            React.createElement("button", { className: "btn", disabled: !draft.trim(), onClick: () => { onChange(HT.addHabit(month, draft.trim())); setDraft(""); } }, "\u05D4\u05D5\u05E1\u05E3"))));
}
function NextMonthNote({ month, onChange }) {
    return (React.createElement("div", { className: "nextmonth" },
        React.createElement("label", null,
            React.createElement("span", null, "\u05DC\u05D7\u05D5\u05D3\u05E9 \u05D4\u05D1\u05D0"),
            React.createElement("input", { value: month.nextMonth, maxLength: 120, placeholder: "\u05E0\u05D5\u05E9\u05D0\u05D9\u05DD \u05E9\u05D1\u05D0 \u05DC\u05D9 \u05DC\u05D4\u05D5\u05E1\u05D9\u05E3\u2026", onChange: (e) => onChange(Object.assign(Object.assign({}, month), { nextMonth: e.target.value })) }))));
}
/* ---------- חלון יום בודד (נייד) ---------- */
function DaySheet({ month, monthKey, day, onClose, onPatch, onToggle }) {
    if (!day)
        return null;
    const d = HT.getDay(month, day);
    return (React.createElement("div", { className: "sheet-wrap", onClick: onClose },
        React.createElement("div", { className: "sheet", onClick: (e) => e.stopPropagation() },
            React.createElement("div", { className: "sheet-head" },
                React.createElement("h3", null,
                    day,
                    " \u05D1",
                    HT.monthLabel(monthKey).split(" ")[0],
                    ", \u05D9\u05D5\u05DD ",
                    HT.dayOfWeekLetter(monthKey, day)),
                React.createElement("button", { className: "ghost", onClick: onClose, "aria-label": "\u05E1\u05D2\u05D5\u05E8" }, "\u2715")),
            React.createElement("label", { className: "field" },
                React.createElement("span", null, "\u05E8\u05D2\u05E2 \u05D6\u05DB\u05D5\u05E8"),
                React.createElement("input", { value: d.moment, maxLength: 110, placeholder: "\u05E9\u05D5\u05E8\u05D4 \u05D0\u05D7\u05EA \u05DE\u05D4\u05D9\u05D5\u05DD", onChange: (e) => onPatch(day, { moment: e.target.value }) })),
            React.createElement("div", { className: "two" },
                React.createElement("label", { className: "field" },
                    React.createElement("span", null, "\u05E6\u05D9\u05D5\u05DF \u05E9\u05D9\u05E0\u05D4"),
                    React.createElement("input", { inputMode: "decimal", value: d.sleep === null ? "" : d.sleep, placeholder: "0\u2013100", onChange: (e) => onPatch(day, { sleep: e.target.value }) })),
                React.createElement("label", { className: "field" },
                    React.createElement("span", null, "\u05DE\u05E9\u05E7\u05DC"),
                    React.createElement("input", { inputMode: "decimal", value: d.weight === null ? "" : d.weight, placeholder: '\u05E7"\u05D2', onChange: (e) => onPatch(day, { weight: e.target.value }) }))),
            React.createElement("div", { className: "sheet-habits" }, month.habits.map((h, i) => {
                const on = HT.isMarked(month, day, h.id);
                return (React.createElement("button", { key: h.id, className: "chip" + (on ? " on" : ""), onClick: () => onToggle(day, h.id) },
                    on ? React.createElement(XMark, { seed: day + i }) : React.createElement("span", { className: "dot" }),
                    h.name));
            })))));
}
/* ---------- תצוגת מחברת (אייפד / מסך רחב) ---------- */
function Spread(props) {
    const { month, monthKey, today, now, onToggle, onNumber, onMoment, onChange, openDay } = props;
    const ROW = 30, HEAD = 132;
    const sleepPts = HT.series(month, "sleep", monthKey);
    const weightPts = HT.series(month, "weight", monthKey);
    const wb = HT.weightBounds(weightPts);
    return (React.createElement("div", { className: "spread" },
        React.createElement("section", { className: "page page-right" },
            React.createElement("div", { className: "page-head", style: { height: HEAD + "px" } },
                React.createElement(MonthNav, { monthKey: monthKey, onShift: props.onShift, status: props.status }),
                React.createElement("p", { className: "page-kicker" }, "\u05E8\u05D2\u05E2\u05D9\u05DD \u05D6\u05DB\u05D5\u05E8\u05D9\u05DD")),
            React.createElement(MomentsList, { month: month, monthKey: monthKey, today: today, rowH: ROW, onMoment: onMoment, onOpenDay: openDay }),
            React.createElement(NextMonthNote, { month: month, onChange: onChange })),
        React.createElement("div", { className: "gutter", "aria-hidden": "true" }),
        React.createElement("section", { className: "page page-left" },
            React.createElement("div", { className: "left-inner" },
                React.createElement("div", { className: "graphs" },
                    React.createElement(VerticalGraph, { points: sleepPts, min: 0, max: 100, width: 132, rowH: ROW, headH: 132, color: "var(--ink-blue)", ticks: 10, label: "\u05E9\u05D9\u05E0\u05D4", unit: "\u05E6\u05D9\u05D5\u05DF" }),
                    React.createElement(VerticalGraph, { points: weightPts, min: wb.min, max: wb.max, width: 86, rowH: ROW, headH: 132, color: "var(--pen-green)", ticks: (wb.max - wb.min) / 8, label: "\u05DE\u05E9\u05E7\u05DC", unit: '\u05E7"\u05D2' })),
                React.createElement(HabitGrid, { month: month, monthKey: monthKey, today: today, rowH: ROW, headH: HEAD, onToggle: onToggle, showNumbers: true, onNumber: onNumber })),
            React.createElement(Summary, { month: month, monthKey: monthKey, now: now }))));
}
/* ---------- תצוגת נייד ---------- */
function Phone(props) {
    const { month, monthKey, today, now, onToggle, onNumber, onMoment, onChange, tab, setTab } = props;
    const ROW = 38, HEAD = 104;
    const [sheetDay, setSheetDay] = useState(null);
    const sleepPts = HT.series(month, "sleep", monthKey);
    const weightPts = HT.series(month, "weight", monthKey);
    const wb = HT.weightBounds(weightPts);
    const missing = HT.missingSleepDays(month, monthKey, now);
    return (React.createElement("div", { className: "phone" },
        React.createElement("header", { className: "phone-head" },
            React.createElement(MonthNav, { monthKey: monthKey, onShift: props.onShift, status: props.status })),
        React.createElement("main", { className: "phone-body" },
            tab === "grid" ? (React.createElement("div", { className: "pane" },
                React.createElement("div", { className: "grid-scroll" },
                    React.createElement("div", { className: "rownums", style: { paddingTop: HEAD + "px" } }, Array.from({ length: HT.daysInMonthKey(monthKey) }, (_, i) => i + 1).map((d) => (React.createElement("button", { key: d, className: "daynum sm" + (d === today ? " is-today" : ""), style: { height: ROW + "px" }, onClick: () => setSheetDay(d) },
                        React.createElement("b", null, d),
                        React.createElement("i", null, HT.dayOfWeekLetter(monthKey, d)))))),
                    React.createElement(HabitGrid, { month: month, monthKey: monthKey, today: today, rowH: ROW, headH: HEAD, onToggle: onToggle, showNumbers: false })),
                React.createElement(Summary, { month: month, monthKey: monthKey, now: now }))) : null,
            tab === "moments" ? (React.createElement("div", { className: "pane" },
                React.createElement(MomentsList, { month: month, monthKey: monthKey, today: today, rowH: 44, onMoment: onMoment, onOpenDay: setSheetDay }),
                React.createElement(NextMonthNote, { month: month, onChange: onChange }))) : null,
            tab === "graphs" ? (React.createElement("div", { className: "pane" },
                missing.length ? (React.createElement("p", { className: "missing" },
                    missing.length === 1 ? "יום אחד בלי ציון שינה: " : missing.length + " ימים בלי ציון שינה: ",
                    missing.slice(0, 8).join(", "),
                    missing.length > 8 ? "…" : "")) : null,
                React.createElement("div", { className: "graph-scroll" },
                    React.createElement("div", { className: "rownums", style: { paddingTop: "76px" } }, Array.from({ length: HT.daysInMonthKey(monthKey) }, (_, i) => i + 1).map((d) => (React.createElement("button", { key: d, className: "daynum sm" + (d === today ? " is-today" : ""), style: { height: 30 + "px" }, onClick: () => setSheetDay(d) },
                        React.createElement("b", null, d))))),
                    React.createElement(VerticalGraph, { points: sleepPts, min: 0, max: 100, width: 132, rowH: 30, headH: 76, color: "var(--ink-blue)", ticks: 10, label: "\u05E9\u05D9\u05E0\u05D4", unit: "\u05E6\u05D9\u05D5\u05DF" }),
                    React.createElement(VerticalGraph, { points: weightPts, min: wb.min, max: wb.max, width: 104, rowH: 30, headH: 76, color: "var(--pen-green)", ticks: (wb.max - wb.min) / 8, label: "\u05DE\u05E9\u05E7\u05DC", unit: '\u05E7"\u05D2' })))) : null,
            tab === "habits" ? (React.createElement("div", { className: "pane pad" },
                React.createElement(HabitsEditor, { month: month, monthKey: monthKey, onChange: onChange, inherited: props.inherited }),
                React.createElement("button", { className: "btn ghost wide", onClick: () => firebase.auth().signOut() }, "\u05D9\u05E6\u05D9\u05D0\u05D4 \u05DE\u05D4\u05D7\u05E9\u05D1\u05D5\u05DF"))) : null),
        React.createElement("nav", { className: "tabs" }, [["grid", "החודש"], ["moments", "רגעים"], ["graphs", "גרפים"], ["habits", "נושאים"]].map(([id, label]) => (React.createElement("button", { key: id, className: tab === id ? "on" : "", onClick: () => setTab(id) }, label)))),
        React.createElement(DaySheet, { month: month, monthKey: monthKey, day: sheetDay, onClose: () => setSheetDay(null), onPatch: props.onPatch, onToggle: onToggle })));
}
/* ---------- האפליקציה ---------- */
function App() {
    const [user, setUser] = useState(undefined); // undefined = עוד בודקים
    const [monthKey, setMonthKey] = useState(HT.currentMonthKey());
    const [month, setMonth] = useState(null);
    const [status, setStatus] = useState("saved");
    const [wide, setWide] = useState(window.innerWidth >= 900);
    const [tab, setTab] = useState("grid");
    const [showEditor, setShowEditor] = useState(false);
    const [inherited, setInherited] = useState("");
    const saveTimer = useRef(null);
    const dirty = useRef(false);
    const now = new Date();
    const t = HT.todayParts(now);
    const today = HT.monthKey(t.year, t.month) === monthKey ? t.day : -1;
    useEffect(() => {
        const onResize = () => setWide(window.innerWidth >= 900);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);
    useEffect(() => firebase.auth().onAuthStateChanged((u) => setUser(u || null)), []);
    /* טעינת חודש. אם אין מסמך — יורשים את נושאי החודש הקודם. */
    useEffect(() => {
        if (!user) {
            setMonth(null);
            return;
        }
        let cancelled = false;
        setMonth(null);
        dirty.current = false;
        (async () => {
            try {
                const snap = await monthRef(user.uid, monthKey).get();
                const prevSnap = await monthRef(user.uid, HT.shiftMonth(monthKey, -1)).get();
                if (cancelled)
                    return;
                const prev = prevSnap.exists ? HT.normalizeMonth(prevSnap.data()) : null;
                setInherited(prev ? prev.nextMonth : "");
                if (snap.exists) {
                    setMonth(HT.normalizeMonth(snap.data(), prev ? prev.habits : null));
                }
                else {
                    setMonth(HT.emptyMonth(prev ? prev.habits : null));
                }
                setStatus("saved");
            }
            catch (e) {
                if (!cancelled) {
                    setMonth(HT.emptyMonth());
                    setStatus("error");
                }
            }
        })();
        return () => { cancelled = true; };
    }, [user, monthKey]);
    /* שמירה מושהית */
    const scheduleSave = useCallback((next) => {
        if (!user)
            return;
        dirty.current = true;
        setStatus("saving");
        if (saveTimer.current)
            clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            try {
                await monthRef(user.uid, monthKey).set(next);
                dirty.current = false;
                setStatus("saved");
            }
            catch (e) {
                setStatus("error");
            }
        }, 800);
    }, [user, monthKey]);
    const update = useCallback((next) => {
        setMonth(next);
        scheduleSave(next);
    }, [scheduleSave]);
    useEffect(() => {
        const warn = (e) => { if (dirty.current) {
            e.preventDefault();
            e.returnValue = "";
        } };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, []);
    const onToggle = (d, id) => update(HT.toggleMark(month, d, id));
    const onMoment = (d, v) => update(HT.withDay(month, d, { moment: v }));
    const onPatch = (d, patch) => update(HT.withDay(month, d, patch));
    const onNumber = (d, field, v) => {
        let val = v;
        if (field === "sleep" && v !== "") {
            const n = Number(v);
            if (isFinite(n))
                val = Math.max(0, Math.min(100, n));
        }
        update(HT.withDay(month, d, { [field]: val }));
    };
    const onShift = (delta) => {
        const next = HT.shiftMonth(monthKey, delta);
        if (delta < 0 && !HT.canGoBack(monthKey))
            return;
        setMonthKey(next);
    };
    if (user === undefined)
        return React.createElement("div", { className: "boot" }, "\u05E8\u05D2\u05E2\u2026");
    if (user === null)
        return React.createElement(LoginScreen, null);
    if (!month)
        return React.createElement("div", { className: "boot" },
            "\u05E4\u05D5\u05EA\u05D7 \u05D0\u05EA ",
            HT.monthLabel(monthKey),
            "\u2026");
    const shared = {
        month, monthKey, today, now, status, inherited,
        onToggle, onMoment, onNumber, onPatch, onShift,
        onChange: update
    };
    if (!wide)
        return React.createElement(Phone, Object.assign({}, shared, { tab: tab, setTab: setTab }));
    return (React.createElement("div", { className: "desk" },
        React.createElement(Spread, Object.assign({}, shared, { openDay: null })),
        React.createElement("div", { className: "desk-tools" },
            React.createElement("button", { className: "btn ghost", onClick: () => setShowEditor(!showEditor) },
                React.createElement(PenIcon, null),
                " ",
                showEditor ? "סגור עריכת נושאים" : "ערוך נושאים"),
            React.createElement("button", { className: "btn ghost", onClick: () => firebase.auth().signOut() }, "\u05D9\u05E6\u05D9\u05D0\u05D4")),
        showEditor ? (React.createElement("div", { className: "sheet-wrap", onClick: () => setShowEditor(false) },
            React.createElement("div", { className: "sheet wide", onClick: (e) => e.stopPropagation() },
                React.createElement(HabitsEditor, { month: month, monthKey: monthKey, onChange: update, inherited: inherited }),
                React.createElement("button", { className: "btn primary", onClick: () => setShowEditor(false) }, "\u05E1\u05D9\u05D9\u05DE\u05EA\u05D9")))) : null));
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App, null));
