"use strict";
/* ==========================================================================
   app.jsx — ממשק הטראקר. React 18 מ‑CDN, בלי Babel בדפדפן.
   הכל בזרימה רגילה של הדף: אין sticky ואין גלילה מקוננת, כדי שזום לא יזיז כלום.
   ========================================================================== */
const { useState, useEffect, useRef, useMemo, useCallback } = React;
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
function Chevron({ dir }) {
    /* dir: "right" ‏= אחורה בעברית, "left" = קדימה. SVG לא מתהפך ב-RTL. */
    return (React.createElement("svg", { viewBox: "0 0 24 24", className: "chev-ico", "aria-hidden": "true" },
        React.createElement("path", { d: dir === "right" ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7" })));
}
function MenuIcon() {
    return (React.createElement("svg", { viewBox: "0 0 24 24", className: "ico", "aria-hidden": "true" },
        React.createElement("path", { d: "M4 7h16M4 12h16M4 17h16" })));
}
/** גרף אנכי: הימים יורדים, הערך נמדד לרוחב. הצד הימני = הערך הנמוך. */
function VerticalGraph({ points, min, max, width, rowH, headH, color, label, unit, labels, monthKey, today }) {
    const COLS = 10; // הרוחב מחולק לעשר משבצות שוות
    const cell = width / COLS;
    const total = points.length;
    const height = total * rowH;
    /* הערך ממופה למרכז המשבצת, כך שנקודה בקצה יושבת בתוך משבצת ולא על הקו */
    const x = (v) => (width - cell / 2) - ((v - min) / (max - min)) * (width - cell);
    const y = (day) => (day - 0.5) * rowH;
    const segs = HT.segments(points);
    const cols = [];
    for (let i = 0; i <= COLS; i++) {
        cols.push(Math.min(Math.max(i * cell, 0.5), width - 0.5));
    }
    return (React.createElement("div", { className: "graph", style: { width: width + "px" } },
        React.createElement("div", { className: "graph-head", style: { height: headH + "px" } },
            React.createElement("span", { className: "graph-title" },
                label,
                " ",
                React.createElement("i", null, unit)),
            React.createElement("span", { className: "graph-axis", dir: "ltr", style: { paddingInline: cell / 2 + "px" } }, (labels || HT.scaleLabels(min, max, 6)).map((v, i) => React.createElement("b", { key: i }, v)))),
        React.createElement("svg", { width: width, height: height, className: "graph-svg", role: "img", "aria-label": label },
            monthKey ? points.filter((p) => HT.isWeekend(monthKey, p.day)).map((p) => (React.createElement("rect", { key: "w" + p.day, x: "0", y: (p.day - 1) * rowH, width: width, height: rowH, className: "row-weekend" }))) : null,
            monthKey && today > 0 ? (React.createElement("rect", { x: "0.75", y: (today - 1) * rowH + 0.75, width: width - 1.5, height: rowH - 1.5, className: "row-today" })) : null,
            cols.map((cx, i) => (React.createElement("line", { key: "c" + i, x1: cx, x2: cx, y1: "0", y2: height, className: i % 5 === 0 ? "tick major" : "tick" }))),
            points.map((p, i) => (React.createElement("line", { key: "r" + i, x1: "0", x2: width, y1: i * rowH, y2: i * rowH, className: "tick row" }))),
            segs.map((seg, i) => (React.createElement("polyline", { key: "s" + i, className: "line", stroke: color, points: seg.map((p) => `${x(p.value)},${y(p.day)}`).join(" ") }))),
            points.filter((p) => p.value !== null).map((p) => (React.createElement("circle", { key: "d" + p.day, cx: x(p.value), cy: y(p.day), r: "2.6", fill: color }))))));
}
/* ---------- מסך כניסה ---------- */
function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [note, setNote] = useState("");
    const reset = async () => {
        if (!email.trim()) {
            setError("תזין קודם את המייל, ואשלח אליו קישור לאיפוס.");
            return;
        }
        setError("");
        setNote("");
        try {
            await firebase.auth().sendPasswordResetEmail(email.trim());
            setNote("שלחתי קישור לאיפוס סיסמה ל" + email.trim() + ". בדוק גם בספאם.");
        }
        catch (e) {
            setError(e.code === "auth/invalid-email" ? "כתובת המייל לא תקינה." : "שליחת האיפוס נכשלה.");
        }
    };
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
            React.createElement("h1", { className: "logo" }, "Log"),
            React.createElement("p", { className: "login-sub" }, "\u05D4\u05DE\u05D7\u05D1\u05E8\u05EA, \u05D1\u05DC\u05D9 \u05D4\u05DE\u05D7\u05D1\u05E8\u05EA."),
            React.createElement("label", { className: "field" },
                React.createElement("span", null, "\u05DE\u05D9\u05D9\u05DC"),
                React.createElement("input", { type: "email", dir: "ltr", autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value), onKeyDown: (e) => e.key === "Enter" && submit() })),
            React.createElement("label", { className: "field" },
                React.createElement("span", null, "\u05E1\u05D9\u05E1\u05DE\u05D4"),
                React.createElement("input", { type: "password", dir: "ltr", autoComplete: "current-password", value: password, onChange: (e) => setPassword(e.target.value), onKeyDown: (e) => e.key === "Enter" && submit() })),
            error ? React.createElement("p", { className: "login-error" }, error) : null,
            note ? React.createElement("p", { className: "login-note" }, note) : null,
            React.createElement("button", { className: "btn primary", onClick: submit, disabled: busy }, busy ? "מתחבר…" : "כניסה"),
            React.createElement("button", { className: "linky", onClick: reset }, "\u05E9\u05DB\u05D7\u05EA\u05D9 \u05E1\u05D9\u05E1\u05DE\u05D4"),
            React.createElement("p", { className: "credit", dir: "ltr" },
                "v",
                HT.VERSION,
                " \u00B7 ",
                HT.CREDIT))));
}
/* ---------- באנר עליון ותפריט ---------- */
function Section({ title, children, defaultOpen }) {
    const [open, setOpen] = useState(!!defaultOpen);
    return (React.createElement("div", { className: "section" + (open ? " open" : "") },
        React.createElement("button", { className: "section-head", onClick: () => setOpen(!open), "aria-expanded": open },
            React.createElement("span", null, title),
            React.createElement("i", { className: "chev", "aria-hidden": "true" }, "\u2304")),
        open ? React.createElement("div", { className: "section-body" }, children) : null));
}
function PlusIcon() {
    return (React.createElement("svg", { viewBox: "0 0 24 24", className: "ico", "aria-hidden": "true" },
        React.createElement("path", { d: "M12 5v14M5 12h14" })));
}
function TopBar({ onMenu }) {
    return (React.createElement("header", { className: "topbar" },
        React.createElement("div", { className: "topbar-actions" },
            React.createElement("button", { onClick: onMenu, "aria-label": "\u05E4\u05EA\u05D7 \u05EA\u05E4\u05E8\u05D9\u05D8" },
                React.createElement(MenuIcon, null))),
        React.createElement("h1", { className: "brand", dir: "ltr" },
            React.createElement("span", { className: "brand-log" }, "Log"),
            React.createElement("span", { className: "brand-rest" }, "- habit tracker"))));
}
function AddButton({ onClick, alert, title }) {
    return (React.createElement("button", { className: "add-btn" + (alert ? " has-alert" : ""), onClick: onClick, title: title, "aria-label": title || "הזנה מהירה ליום" },
        React.createElement(PlusIcon, null),
        alert ? React.createElement("span", { className: "badge", "aria-hidden": "true" }) : null));
}
function SummaryBrowser({ month, monthKey, now, uid }) {
    const [selected, setSelected] = useState(monthKey);
    const [data, setData] = useState(month);
    const [loading, setLoading] = useState(false);
    const months = HT.monthRange(HT.FIRST_MONTH, monthKey > HT.currentMonthKey(now) ? monthKey : HT.currentMonthKey(now));
    useEffect(() => {
        if (selected === monthKey) {
            setData(month);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        monthRef(uid, selected).get().then((snap) => {
            if (cancelled)
                return;
            setData(snap.exists ? HT.normalizeMonth(snap.data()) : null);
            setLoading(false);
        }).catch(() => { if (!cancelled) {
            setData(null);
            setLoading(false);
        } });
        return () => { cancelled = true; };
    }, [selected, monthKey, month, uid]);
    return (React.createElement("div", { className: "browser" },
        React.createElement("select", { className: "month-select", value: selected, onChange: (e) => setSelected(e.target.value), "aria-label": "\u05D1\u05D7\u05E8 \u05D7\u05D5\u05D3\u05E9" }, months.slice().reverse().map((k) => (React.createElement("option", { key: k, value: k }, HT.monthLabel(k))))),
        loading
            ? React.createElement("p", { className: "hint" }, "\u05D8\u05D5\u05E2\u05DF\u2026")
            : data
                ? React.createElement(Summary, { month: data, monthKey: selected, now: now, bare: true })
                : React.createElement("p", { className: "hint" }, "\u05D0\u05D9\u05DF \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05DC\u05D7\u05D5\u05D3\u05E9 \u05D4\u05D6\u05D4.")));
}
function YearGrid({ uid, monthKey, month, now }) {
    const [rows, setRows] = useState(null);
    const habits = month.habits;
    const months = HT.monthRange(HT.FIRST_MONTH, monthKey > HT.currentMonthKey(now) ? monthKey : HT.currentMonthKey(now));
    useEffect(() => {
        let cancelled = false;
        Promise.all(months.map((k) => k === monthKey
            ? Promise.resolve({ key: k, data: month })
            : monthRef(uid, k).get()
                .then((snap) => ({ key: k, data: snap.exists ? HT.normalizeMonth(snap.data()) : null }))
                .catch(() => ({ key: k, data: null })))).then((all) => {
            if (cancelled)
                return;
            setRows(all.map((r) => ({
                key: r.key,
                stats: r.data ? HT.habitStats(r.data, r.key, now) : null
            })));
        });
        return () => { cancelled = true; };
    }, [uid, monthKey, month]);
    if (!rows)
        return React.createElement("p", { className: "hint" }, "\u05D8\u05D5\u05E2\u05DF\u2026");
    return (React.createElement("div", { className: "year" },
        React.createElement("div", { className: "year-row year-head" },
            React.createElement("span", { className: "year-label" }),
            habits.map((h) => (React.createElement("span", { className: "year-cell head", key: h.id, title: h.name }, h.name.slice(0, 2))))),
        rows.slice().reverse().map((r) => (React.createElement("div", { className: "year-row", key: r.key },
            React.createElement("span", { className: "year-label" }, HT.shortMonthLabel(r.key)),
            habits.map((h) => {
                const st = r.stats ? r.stats.filter((x) => x.id === h.id)[0] : null;
                return (React.createElement("span", { className: "year-cell", key: h.id, title: st ? h.name + ": " + st.percent + "%" : "אין נתונים" }, st ? React.createElement("i", { style: { opacity: 0.12 + 0.88 * (st.percent / 100) } }) : null));
            })))),
        React.createElement("p", { className: "hint" }, "\u05DB\u05DB\u05DC \u05E9\u05D4\u05DE\u05E9\u05D1\u05E6\u05EA \u05DB\u05D4\u05D4 \u05D9\u05D5\u05EA\u05E8, \u05DB\u05DA \u05D4\u05D0\u05D7\u05D5\u05D6 \u05D1\u05D0\u05D5\u05EA\u05D5 \u05D7\u05D5\u05D3\u05E9 \u05D2\u05D1\u05D5\u05D4 \u05D9\u05D5\u05EA\u05E8.")));
}
function MomentSearch({ uid, monthKey, month, now, onGo }) {
    const [query, setQuery] = useState("");
    const [all, setAll] = useState(null);
    const months = HT.monthRange(HT.FIRST_MONTH, monthKey > HT.currentMonthKey(now) ? monthKey : HT.currentMonthKey(now));
    useEffect(() => {
        let cancelled = false;
        Promise.all(months.map((k) => k === monthKey
            ? Promise.resolve({ key: k, data: month })
            : monthRef(uid, k).get()
                .then((snap) => ({ key: k, data: snap.exists ? HT.normalizeMonth(snap.data()) : null }))
                .catch(() => ({ key: k, data: null })))).then((res) => { if (!cancelled)
            setAll(res); });
        return () => { cancelled = true; };
    }, [uid, monthKey, month]);
    const q = query.trim();
    let results = [];
    if (all && q.length >= 2) {
        all.forEach((r) => {
            if (!r.data)
                return;
            Object.keys(r.data.days).forEach((dayKey) => {
                const text = r.data.days[dayKey].moment;
                if (text && text.indexOf(q) !== -1) {
                    results.push({ key: r.key, day: parseInt(dayKey, 10), text: text });
                }
            });
        });
        results.sort((x, y) => (x.key === y.key ? y.day - x.day : (x.key < y.key ? 1 : -1)));
    }
    return (React.createElement("div", { className: "search" },
        React.createElement("input", { className: "search-input", value: query, placeholder: "\u05DE\u05D9\u05DC\u05D4 \u05DE\u05EA\u05D5\u05DA \u05E8\u05D2\u05E2 \u05D6\u05DB\u05D5\u05E8\u2026", onChange: (e) => setQuery(e.target.value), "aria-label": "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05D1\u05E8\u05D2\u05E2\u05D9\u05DD" }),
        !all ? React.createElement("p", { className: "hint" }, "\u05D8\u05D5\u05E2\u05DF\u2026") : null,
        all && q.length >= 2 ? (results.length ? (React.createElement(React.Fragment, null,
            React.createElement("p", { className: "hint" },
                results.length,
                " \u05EA\u05D5\u05E6\u05D0\u05D5\u05EA"),
            React.createElement("ul", { className: "results" }, results.slice(0, 60).map((r, i) => (React.createElement("li", { key: i },
                React.createElement("button", { onClick: () => onGo(r.key, r.day) },
                    React.createElement("b", null,
                        r.day,
                        " \u05D1",
                        HT.monthLabel(r.key)),
                    React.createElement("span", null, r.text)))))))) : React.createElement("p", { className: "hint" }, "\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0 \u05DB\u05DC\u05D5\u05DD.")) : null,
        all && q.length > 0 && q.length < 2 ? React.createElement("p", { className: "hint" }, "\u05E9\u05EA\u05D9 \u05D0\u05D5\u05EA\u05D9\u05D5\u05EA \u05DC\u05E4\u05D7\u05D5\u05EA.") : null));
}
function Drawer({ open, onClose, month, monthKey, onChange, inherited, theme, setTheme, now, uid, onGo }) {
    if (!open)
        return null;
    return (React.createElement("div", { className: "drawer-wrap", onClick: onClose },
        React.createElement("aside", { className: "drawer", onClick: (e) => e.stopPropagation() },
            React.createElement("div", { className: "drawer-head" },
                React.createElement("h2", { className: "brand sm", dir: "ltr" },
                    React.createElement("span", { className: "brand-log" }, "Log"),
                    React.createElement("span", { className: "brand-rest" }, "- habit tracker")),
                React.createElement("button", { className: "ghost", onClick: onClose, "aria-label": "\u05E1\u05D2\u05D5\u05E8" }, "\u2715")),
            React.createElement(Section, { title: "\u05EA\u05E6\u05D5\u05D2\u05D4" },
                React.createElement("div", { className: "toggle" },
                    React.createElement("button", { className: theme === "light" ? "on" : "", onClick: () => setTheme("light") }, "\u05D9\u05D5\u05DD"),
                    React.createElement("button", { className: theme === "dark" ? "on" : "", onClick: () => setTheme("dark") }, "\u05DC\u05D9\u05DC\u05D4"))),
            React.createElement(Section, { title: "\u05E0\u05D5\u05E9\u05D0\u05D9 \u05D4\u05DE\u05E2\u05E7\u05D1" },
                React.createElement(HabitsEditor, { month: month, monthKey: monthKey, onChange: onChange, inherited: inherited })),
            React.createElement(Section, { title: "\u05DE\u05D1\u05D8 \u05E2\u05DC" },
                React.createElement(SummaryBrowser, { month: month, monthKey: monthKey, now: now, uid: uid })),
            React.createElement(Section, { title: "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05D1\u05E8\u05D2\u05E2\u05D9\u05DD" },
                React.createElement(MomentSearch, { uid: uid, monthKey: monthKey, month: month, now: now, onGo: onGo })),
            React.createElement(Section, { title: "\u05DE\u05D1\u05D8 \u05E9\u05E0\u05EA\u05D9" },
                React.createElement(YearGrid, { uid: uid, monthKey: monthKey, month: month, now: now })),
            React.createElement(Section, { title: "\u05DC\u05D7\u05D5\u05D3\u05E9 \u05D4\u05D1\u05D0" },
                React.createElement(NextMonthNote, { month: month, onChange: onChange, bare: true })),
            React.createElement(Section, { title: "\u05D7\u05E9\u05D1\u05D5\u05DF" },
                React.createElement("button", { className: "btn ghost wide", onClick: () => firebase.auth().signOut() }, "\u05D9\u05E6\u05D9\u05D0\u05D4 \u05DE\u05D4\u05D7\u05E9\u05D1\u05D5\u05DF"),
                React.createElement("p", { className: "credit", dir: "ltr" },
                    "v",
                    HT.VERSION,
                    " \u00B7 ",
                    HT.CREDIT)))));
}
/* ---------- ניווט חודשים ---------- */
function MonthNav({ monthKey, onShift, status }) {
    return (React.createElement("div", { className: "monthnav" },
        React.createElement("button", { className: "ghost", onClick: () => onShift(-1), disabled: !HT.canGoBack(monthKey), "aria-label": "\u05D4\u05D7\u05D5\u05D3\u05E9 \u05D4\u05E7\u05D5\u05D3\u05DD" },
            React.createElement(Chevron, { dir: "right" })),
        React.createElement("h2", { className: "month-title" }, HT.monthLabel(monthKey)),
        React.createElement("button", { className: "ghost", onClick: () => onShift(1), "aria-label": "\u05D4\u05D7\u05D5\u05D3\u05E9 \u05D4\u05D1\u05D0" },
            React.createElement(Chevron, { dir: "left" })),
        React.createElement("span", { className: "status " + status }, status === "saving" ? "שומר…" : status === "error" ? "לא נשמר" : "נשמר")));
}
/* ---------- טבלת הנושאים ---------- */
function HabitGrid({ month, monthKey, today, rowH, headH, onToggle, fluid, dayCol, onOpenDay }) {
    const total = HT.daysInMonthKey(monthKey);
    const days = [];
    for (let d = 1; d <= total; d++)
        days.push(d);
    return (React.createElement("div", { className: "grid" + (fluid ? " fluid" : "") },
        React.createElement("div", { className: "grid-head", style: { height: headH + "px" } },
            dayCol ? React.createElement("div", { className: "corner" }) : null,
            month.habits.map((h) => (React.createElement("div", { className: "habit-label", key: h.id },
                React.createElement("span", null, h.name))))),
        React.createElement("div", { className: "grid-body" }, days.map((d) => {
            return (React.createElement("div", { className: "grid-row" + (d === today ? " is-today" : "") +
                    (HT.isWeekend(monthKey, d) ? " is-weekend" : ""), key: d, style: { height: rowH + "px" } },
                dayCol ? (React.createElement("button", { className: "daycol", onClick: () => onOpenDay && onOpenDay(d) },
                    React.createElement("b", null, d),
                    React.createElement("i", null, HT.dayOfWeekLetter(monthKey, d)))) : null,
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
/* ---------- סיכום ---------- */
function Ring({ percent, size, stroke, color, children }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    return (React.createElement("svg", { className: "ring", width: size, height: size, viewBox: `0 0 ${size} ${size}` },
        React.createElement("circle", { cx: size / 2, cy: size / 2, r: r, className: "ring-track", strokeWidth: stroke }),
        React.createElement("circle", { cx: size / 2, cy: size / 2, r: r, className: "ring-fill", strokeWidth: stroke, stroke: color, strokeDasharray: `${(c * percent) / 100} ${c}`, transform: `rotate(-90 ${size / 2} ${size / 2})` }),
        React.createElement("text", { x: "50%", y: "50%", className: "ring-text" }, children)));
}
function Insights({ month, monthKey, now }) {
    const lines = HT.insights(month, monthKey, now);
    if (!lines.length)
        return null;
    return (React.createElement("ul", { className: "insights" }, lines.map((l, i) => React.createElement("li", { key: i }, l))));
}
function Summary({ month, monthKey, now, bare }) {
    const stats = HT.habitStats(month, monthKey, now);
    if (!stats.length)
        return null;
    const totalDone = stats.reduce((a, s) => a + s.done, 0);
    const totalPossible = stats.reduce((a, s) => a + s.counted, 0);
    const overall = totalPossible ? Math.round((totalDone / totalPossible) * 100) : 0;
    return (React.createElement("section", { className: "summary" + (bare ? " bare" : "") },
        bare ? null : React.createElement("div", { className: "band" },
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
/* ---------- דיאלוג אישור ---------- */
function ConfirmDialog({ open, title, body, confirmLabel, danger, onConfirm, onCancel }) {
    if (!open)
        return null;
    return (React.createElement("div", { className: "confirm-wrap", onClick: onCancel },
        React.createElement("div", { className: "confirm", onClick: (e) => e.stopPropagation(), role: "alertdialog", "aria-modal": "true" },
            React.createElement("h3", null, title),
            body ? React.createElement("p", null, body) : null,
            React.createElement("div", { className: "confirm-actions" },
                React.createElement("button", { className: "btn", onClick: onCancel }, "\u05D1\u05D9\u05D8\u05D5\u05DC"),
                React.createElement("button", { className: "btn primary" + (danger ? " danger" : ""), onClick: onConfirm }, confirmLabel || "אישור")))));
}
/* ---------- עורך הנושאים ---------- */
function HabitsEditor({ month, onChange, monthKey, inherited }) {
    const [draft, setDraft] = useState("");
    const [pending, setPending] = useState(null);
    return (React.createElement("div", { className: "editor" },
        React.createElement("h3", null,
            "\u05E0\u05D5\u05E9\u05D0\u05D9 ",
            HT.monthLabel(monthKey)),
        React.createElement("p", { className: "hint" }, "\u05E9\u05D9\u05E0\u05D5\u05D9 \u05DB\u05D0\u05DF \u05DE\u05E9\u05E4\u05D9\u05E2 \u05E2\u05DC \u05D4\u05D7\u05D5\u05D3\u05E9 \u05D4\u05D6\u05D4 \u05D1\u05DC\u05D1\u05D3. \u05D4\u05D7\u05D5\u05D3\u05E9 \u05D4\u05D1\u05D0 \u05D9\u05D9\u05E4\u05EA\u05D7 \u05E2\u05DD \u05D0\u05D5\u05EA\u05D4 \u05E8\u05E9\u05D9\u05DE\u05D4."),
        inherited ? React.createElement("p", { className: "hint note" },
            "\u05D1\u05E1\u05D5\u05E3 \u05D4\u05D7\u05D5\u05D3\u05E9 \u05D4\u05E7\u05D5\u05D3\u05DD \u05E8\u05E9\u05DE\u05EA: \u201C",
            inherited,
            "\u201D") : null,
        React.createElement("ul", { className: "editor-list" }, month.habits.map((h, i) => (React.createElement("li", { key: h.id },
            React.createElement("input", { value: h.name, onChange: (e) => onChange(HT.renameHabit(month, h.id, e.target.value)), "aria-label": "\u05E9\u05DD \u05D4\u05E0\u05D5\u05E9\u05D0" }),
            React.createElement("button", { className: "ghost sm", onClick: () => onChange(HT.moveHabit(month, h.id, -1)), disabled: i === 0, "aria-label": "\u05D4\u05D6\u05D6 \u05D9\u05DE\u05D9\u05E0\u05D4" }, "\u2191"),
            React.createElement("button", { className: "ghost sm", onClick: () => onChange(HT.moveHabit(month, h.id, 1)), disabled: i === month.habits.length - 1, "aria-label": "\u05D4\u05D6\u05D6 \u05E9\u05DE\u05D0\u05DC\u05D4" }, "\u2193"),
            React.createElement("button", { className: "ghost sm danger", "aria-label": "מחק את " + h.name, onClick: () => setPending(h) }, "\u2715"))))),
        React.createElement("div", { className: "editor-add" },
            React.createElement("input", { value: draft, placeholder: "\u05E0\u05D5\u05E9\u05D0 \u05D7\u05D3\u05E9", onChange: (e) => setDraft(e.target.value), onKeyDown: (e) => {
                    if (e.key === "Enter" && draft.trim()) {
                        onChange(HT.addHabit(month, draft.trim()));
                        setDraft("");
                    }
                } }),
            React.createElement("button", { className: "btn", disabled: !draft.trim(), onClick: () => { onChange(HT.addHabit(month, draft.trim())); setDraft(""); } }, "\u05D4\u05D5\u05E1\u05E3")),
        React.createElement(ConfirmDialog, { open: !!pending, title: pending ? "למחוק את “" + pending.name + "”?" : "", body: "הנושא יימחק מ" + HT.monthLabel(monthKey) + " בלבד, יחד עם כל האיקסים שלו בחודש הזה. חודשים קודמים לא ייפגעו.", confirmLabel: "\u05DE\u05D7\u05E7", danger: true, onCancel: () => setPending(null), onConfirm: () => { onChange(HT.removeHabit(month, pending.id)); setPending(null); } })));
}
function NextMonthNote({ month, onChange, bare }) {
    return (React.createElement("div", { className: "nextmonth" + (bare ? " bare" : "") },
        React.createElement("label", null,
            React.createElement("span", null, "\u05DC\u05D7\u05D5\u05D3\u05E9 \u05D4\u05D1\u05D0"),
            React.createElement("input", { value: month.nextMonth, maxLength: 120, placeholder: "\u05E0\u05D5\u05E9\u05D0\u05D9\u05DD \u05E9\u05D1\u05D0 \u05DC\u05D9 \u05DC\u05D4\u05D5\u05E1\u05D9\u05E3\u2026", onChange: (e) => onChange(Object.assign(Object.assign({}, month), { nextMonth: e.target.value })) }))));
}
/* ---------- חלון יום בודד ---------- */
function DaySheet({ month, monthKey, day, onClose, onPatch, onToggle, onStep }) {
    if (!day)
        return null;
    const d = HT.getDay(month, day);
    const total = HT.daysInMonthKey(monthKey);
    return (React.createElement("div", { className: "sheet-wrap", onClick: onClose },
        React.createElement("div", { className: "sheet", onClick: (e) => e.stopPropagation() },
            React.createElement("div", { className: "sheet-head" },
                React.createElement("div", { className: "sheet-nav" },
                    React.createElement("button", { className: "ghost", onClick: () => onStep(-1), disabled: day <= 1, "aria-label": "\u05D9\u05D5\u05DD \u05E7\u05D5\u05D3\u05DD" },
                        React.createElement(Chevron, { dir: "right" })),
                    React.createElement("h3", null,
                        day,
                        " \u05D1",
                        HT.monthLabel(monthKey).split(" ")[0],
                        ", \u05D9\u05D5\u05DD ",
                        HT.dayOfWeekLetter(monthKey, day)),
                    React.createElement("button", { className: "ghost", onClick: () => onStep(1), disabled: day >= total, "aria-label": "\u05D9\u05D5\u05DD \u05D4\u05D1\u05D0" },
                        React.createElement(Chevron, { dir: "left" }))),
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
/* ---------- תצוגת מחברת ---------- */
function Spread(props) {
    const { month, monthKey, today, now, onToggle, onMoment, onChange } = props;
    const ROW = 30, HEAD = 132;
    const sleepPts = HT.series(month, "sleep", monthKey);
    const weightPts = HT.series(month, "weight", monthKey);
    const wb = HT.weightBounds(weightPts);
    return (React.createElement("div", { className: "spread" },
        React.createElement("section", { className: "page page-right" },
            React.createElement("div", { className: "page-head", style: { height: HEAD + "px" } },
                React.createElement(MonthNav, { monthKey: monthKey, onShift: props.onShift, status: props.status }),
                React.createElement("p", { className: "page-kicker" }, "\u05E8\u05D2\u05E2\u05D9\u05DD \u05D6\u05DB\u05D5\u05E8\u05D9\u05DD")),
            React.createElement(MomentsList, { month: month, monthKey: monthKey, today: today, rowH: ROW, onMoment: onMoment, onOpenDay: props.openDay }),
            React.createElement(NextMonthNote, { month: month, onChange: onChange })),
        React.createElement("div", { className: "gutter", "aria-hidden": "true" }),
        React.createElement("section", { className: "page page-left" },
            React.createElement(AddButton, { onClick: () => props.openDay(today > 0 ? today : 1), alert: props.missing > 0, title: props.missing > 0 ? props.missing + " ימים ללא ציון שינה" : "הזנה מהירה ליום" }),
            React.createElement("div", { className: "left-inner" },
                React.createElement("div", { className: "graphs" },
                    React.createElement(VerticalGraph, { points: sleepPts, min: 0, max: 100, width: 132, rowH: ROW, headH: HEAD, color: "var(--pen)", label: "\u05E9\u05D9\u05E0\u05D4", unit: "\u05E6\u05D9\u05D5\u05DF", monthKey: monthKey, today: today }),
                    React.createElement(VerticalGraph, { points: weightPts, min: wb.min, max: wb.max, width: 104, rowH: ROW, headH: HEAD, color: "var(--pen-green)", label: "\u05DE\u05E9\u05E7\u05DC", unit: '\u05E7"\u05D2', labels: HT.weightLabels(wb.min, wb.max), monthKey: monthKey, today: today })),
                React.createElement(HabitGrid, { month: month, monthKey: monthKey, today: today, rowH: ROW, headH: HEAD, onToggle: onToggle })),
            React.createElement(Summary, { month: month, monthKey: monthKey, now: now }))));
}
/* ---------- תצוגת נייד ---------- */
function Phone(props) {
    const { month, monthKey, today, now, onToggle, onMoment, tab, setTab, openDay } = props;
    const ROW = 40, HEAD = 108;
    const sleepPts = HT.series(month, "sleep", monthKey);
    const weightPts = HT.series(month, "weight", monthKey);
    const wb = HT.weightBounds(weightPts);
    const missing = HT.missingSleepDays(month, monthKey, now);
    return (React.createElement("div", { className: "phone" },
        React.createElement("nav", { className: "segments" }, [["grid", "החודש"], ["moments", "רגעים"], ["graphs", "גרפים"]].map(([id, label]) => (React.createElement("button", { key: id, className: tab === id ? "on" : "", onClick: () => setTab(id) }, label)))),
        React.createElement("div", { className: "phone-month" },
            React.createElement(MonthNav, { monthKey: monthKey, onShift: props.onShift, status: props.status }),
            React.createElement(AddButton, { onClick: () => openDay(today > 0 ? today : 1), alert: missing.length > 0, title: missing.length > 0 ? missing.length + " ימים ללא ציון שינה" : "הזנה מהירה ליום" })),
        tab === "grid" ? (React.createElement("div", { className: "pane" },
            React.createElement(HabitGrid, { month: month, monthKey: monthKey, today: today, rowH: ROW, headH: HEAD, onToggle: onToggle, fluid: true, dayCol: true, onOpenDay: openDay }))) : null,
        tab === "moments" ? (React.createElement("div", { className: "pane" },
            React.createElement(MomentsList, { month: month, monthKey: monthKey, today: today, rowH: 44, onMoment: onMoment, onOpenDay: openDay }))) : null,
        tab === "graphs" ? (React.createElement("div", { className: "pane" },
            missing.length ? (React.createElement("p", { className: "missing" },
                missing.length === 1 ? "יום אחד בלי ציון שינה: " : missing.length + " ימים בלי ציון שינה: ",
                missing.slice(0, 8).join(", "),
                missing.length > 8 ? "…" : "")) : null,
            React.createElement("div", { className: "graph-row" },
                React.createElement("div", { className: "rownums", style: { paddingTop: "76px" } }, Array.from({ length: HT.daysInMonthKey(monthKey) }, (_, i) => i + 1).map((d) => (React.createElement("button", { key: d, className: "daynum sm" + (d === today ? " is-today" : ""), style: { height: "30px" }, onClick: () => openDay(d) },
                    React.createElement("b", null, d))))),
                React.createElement(VerticalGraph, { points: sleepPts, min: 0, max: 100, width: 128, rowH: 30, headH: 76, color: "var(--pen)", label: "\u05E9\u05D9\u05E0\u05D4", unit: "\u05E6\u05D9\u05D5\u05DF", monthKey: monthKey, today: today }),
                React.createElement(VerticalGraph, { points: weightPts, min: wb.min, max: wb.max, width: 100, rowH: 30, headH: 76, color: "var(--pen-green)", label: "\u05DE\u05E9\u05E7\u05DC", unit: '\u05E7"\u05D2', labels: HT.weightLabels(wb.min, wb.max), monthKey: monthKey, today: today })),
            React.createElement(HabitGrid, { month: month, monthKey: monthKey, today: today, rowH: ROW, headH: HEAD, onToggle: onToggle }))) : null));
}
/* ---------- האפליקציה ---------- */
function App() {
    const [user, setUser] = useState(undefined);
    const [monthKey, setMonthKey] = useState(HT.currentMonthKey());
    const [month, setMonth] = useState(null);
    const [status, setStatus] = useState("saved");
    const [wide, setWide] = useState(window.innerWidth >= 900);
    const [tab, setTab] = useState("grid");
    const [menu, setMenu] = useState(false);
    const [sheetDay, setSheetDay] = useState(null);
    const [inherited, setInherited] = useState("");
    const [theme, setTheme] = useState(function () {
        try {
            return localStorage.getItem("ht-theme") || "light";
        }
        catch (e) {
            return "light";
        }
    });
    const saveTimer = useRef(null);
    const dirty = useRef(false);
    const now = new Date();
    const t = HT.todayParts(now);
    const today = HT.monthKey(t.year, t.month) === monthKey ? t.day : -1;
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        try {
            localStorage.setItem("ht-theme", theme);
        }
        catch (e) { }
    }, [theme]);
    useEffect(() => {
        const onResize = () => setWide(window.innerWidth >= 900);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);
    useEffect(() => firebase.auth().onAuthStateChanged((u) => setUser(u || null)), []);
    /* ניתוק אוטומטי אחרי 5 דקות בלי פעילות */
    useEffect(() => {
        if (!user)
            return;
        let timer = null;
        const IDLE_MS = 5 * 60 * 1000;
        const reset = () => {
            if (timer)
                clearTimeout(timer);
            timer = setTimeout(() => { firebase.auth().signOut(); }, IDLE_MS);
        };
        const events = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"];
        events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
        const onVisible = () => { if (document.visibilityState === "visible")
            reset(); };
        document.addEventListener("visibilitychange", onVisible);
        reset();
        return () => {
            if (timer)
                clearTimeout(timer);
            events.forEach((e) => window.removeEventListener(e, reset));
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [user]);
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
                setMonth(snap.exists
                    ? HT.normalizeMonth(snap.data(), prev ? prev.habits : null)
                    : HT.emptyMonth(prev ? prev.habits : null));
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
    const update = useCallback((next) => { setMonth(next); scheduleSave(next); }, [scheduleSave]);
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
        if (delta < 0 && !HT.canGoBack(monthKey))
            return;
        setMonthKey(HT.shiftMonth(monthKey, delta));
    };
    if (user === undefined)
        return React.createElement("div", { className: "boot" }, "\u05E8\u05D2\u05E2\u2026");
    if (user === null)
        return React.createElement(LoginScreen, null);
    const missingCount = month ? HT.missingSleepDays(month, monthKey, now).length : 0;
    const shared = {
        month, monthKey, today, now, status, inherited, missing: missingCount,
        onToggle, onMoment, onNumber, onPatch, onShift, onChange: update,
        openDay: setSheetDay
    };
    return (React.createElement("div", { className: "app" },
        React.createElement(TopBar, { onMenu: () => setMenu(true) }),
        !month
            ? React.createElement("div", { className: "boot" },
                "\u05E4\u05D5\u05EA\u05D7 \u05D0\u05EA ",
                HT.monthLabel(monthKey),
                "\u2026")
            : wide
                ? React.createElement("div", { className: "desk" },
                    React.createElement(Spread, Object.assign({}, shared)))
                : React.createElement(Phone, Object.assign({}, shared, { tab: tab, setTab: setTab })),
        month ? (React.createElement(React.Fragment, null,
            React.createElement(Drawer, { open: menu, onClose: () => setMenu(false), month: month, monthKey: monthKey, onChange: update, inherited: inherited, theme: theme, setTheme: setTheme, now: now, uid: user.uid, onGo: (key, day) => { setMonthKey(key); setSheetDay(day); setMenu(false); } }),
            React.createElement(DaySheet, { month: month, monthKey: monthKey, day: sheetDay, onClose: () => setSheetDay(null), onPatch: onPatch, onToggle: onToggle, onStep: (delta) => setSheetDay(function (cur) {
                    const total = HT.daysInMonthKey(monthKey);
                    return Math.min(total, Math.max(1, cur + delta));
                }) }))) : null));
}
/* רשת ביטחון: שגיאה בזמן ריצה תציג הודעה במקום מסך לבן */
class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error: error }; }
    render() {
        if (!this.state.error)
            return this.props.children;
        return (React.createElement("div", { className: "crash" },
            React.createElement("h2", null, "\u05DE\u05E9\u05D4\u05D5 \u05E0\u05E9\u05D1\u05E8"),
            React.createElement("p", null, "\u05E0\u05E1\u05D4 \u05DC\u05E8\u05E2\u05E0\u05DF \u05D0\u05EA \u05D4\u05D3\u05E3. \u05D0\u05DD \u05D6\u05D4 \u05D7\u05D5\u05D6\u05E8, \u05D6\u05D4 \u05D4\u05E4\u05E8\u05D8 \u05E9\u05D9\u05E2\u05D6\u05D5\u05E8 \u05DC\u05EA\u05E7\u05DF:"),
            React.createElement("code", null, String(this.state.error && this.state.error.message)),
            React.createElement("p", { className: "credit", dir: "ltr" },
                "v",
                HT.VERSION)));
    }
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(ErrorBoundary, null,
    React.createElement(App, null)));
