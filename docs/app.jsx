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
  return (
    <svg className="x" viewBox="0 0 24 24" style={{ transform: `rotate(${tilt}deg)` }} aria-hidden="true">
      <path d="M5 4.5 L19 19.5" />
      <path d="M19 4.8 L4.8 19.2" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

/** גרף אנכי: הימים יורדים, הערך נמדד לרוחב. הצד הימני = הערך הנמוך. */
function VerticalGraph({ points, min, max, width, rowH, headH, color, ticks, label, unit }) {
  const total = points.length;
  const height = total * rowH;
  const x = (v) => width - ((v - min) / (max - min)) * width;
  const y = (day) => (day - 0.5) * rowH;
  const segs = HT.segments(points);
  const tickLines = [];
  if (ticks > 0) for (let t = min; t <= max + 0.0001; t += ticks) tickLines.push(t);

  return (
    <div className="graph" style={{ width: width + "px" }}>
      <div className="graph-head" style={{ height: headH + "px" }}>
        <span className="graph-title">{label}</span>
        <span className="graph-scale"><b>{Math.round(max * 10) / 10}</b><i>{unit}</i><b>{Math.round(min * 10) / 10}</b></span>
      </div>
      <svg width={width} height={height} className="graph-svg" role="img" aria-label={label}>
        {tickLines.map((t, i) => (
          <line key={"t" + i} x1={x(t)} x2={x(t)} y1="0" y2={height}
                className={i % 5 === 0 ? "tick major" : "tick"} />
        ))}
        {points.map((p, i) => (
          <line key={"r" + i} x1="0" x2={width} y1={i * rowH} y2={i * rowH} className="tick row" />
        ))}
        {segs.map((seg, i) => (
          <polyline key={"s" + i} className="line" stroke={color}
                    points={seg.map((p) => `${x(p.value)},${y(p.day)}`).join(" ")} />
        ))}
        {points.filter((p) => p.value !== null).map((p) => (
          <circle key={"c" + p.day} cx={x(p.value)} cy={y(p.day)} r="2.6" fill={color} />
        ))}
      </svg>
    </div>
  );
}

/* ---------- מסך כניסה ---------- */

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!email || !password) { setError("צריך מייל וסיסמה."); return; }
    setBusy(true); setError("");
    try {
      await firebase.auth().signInWithEmailAndPassword(email.trim(), password);
    } catch (e) {
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

  return (
    <div className="login">
      <div className="login-card">
        <h1 className="brand big">האביט טראקר</h1>
        <p className="login-sub">המחברת, בלי המחברת.</p>
        <label className="field">
          <span>מייל</span>
          <input type="email" dir="ltr" autoComplete="email" value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 onKeyDown={(e) => e.key === "Enter" && submit()} />
        </label>
        <label className="field">
          <span>סיסמה</span>
          <input type="password" dir="ltr" autoComplete="current-password" value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 onKeyDown={(e) => e.key === "Enter" && submit()} />
        </label>
        {error ? <p className="login-error">{error}</p> : null}
        <button className="btn primary" onClick={submit} disabled={busy}>
          {busy ? "מתחבר…" : "כניסה"}
        </button>
      </div>
    </div>
  );
}

/* ---------- באנר עליון ותפריט ---------- */

function TopBar({ onMenu }) {
  return (
    <header className="topbar">
      <button className="menu-btn" onClick={onMenu} aria-label="פתח תפריט"><MenuIcon /></button>
      <h1 className="brand">האביט טראקר</h1>
    </header>
  );
}

function Drawer({ open, onClose, month, monthKey, onChange, inherited, theme, setTheme }) {
  if (!open) return null;
  return (
    <div className="drawer-wrap" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2 className="brand sm">האביט טראקר</h2>
          <button className="ghost" onClick={onClose} aria-label="סגור">✕</button>
        </div>

        <div className="drawer-section">
          <h3>תצוגה</h3>
          <div className="toggle">
            <button className={theme === "light" ? "on" : ""} onClick={() => setTheme("light")}>יום</button>
            <button className={theme === "dark" ? "on" : ""} onClick={() => setTheme("dark")}>לילה</button>
          </div>
        </div>

        <div className="drawer-section grow">
          <HabitsEditor month={month} monthKey={monthKey} onChange={onChange} inherited={inherited} />
        </div>

        <button className="btn ghost wide" onClick={() => firebase.auth().signOut()}>יציאה מהחשבון</button>
      </aside>
    </div>
  );
}

/* ---------- ניווט חודשים ---------- */

function MonthNav({ monthKey, onShift, status }) {
  return (
    <div className="monthnav">
      <button className="ghost" onClick={() => onShift(-1)} disabled={!HT.canGoBack(monthKey)}
              aria-label="החודש הקודם">›</button>
      <h2 className="month-title">{HT.monthLabel(monthKey)}</h2>
      <button className="ghost" onClick={() => onShift(1)} aria-label="החודש הבא">‹</button>
      <span className={"status " + status}>
        {status === "saving" ? "שומר…" : status === "error" ? "לא נשמר" : "נשמר"}
      </span>
    </div>
  );
}

/* ---------- טבלת הנושאים ---------- */

function HabitGrid({ month, monthKey, today, rowH, headH, onToggle, showNumbers, onNumber, fluid, dayCol, onOpenDay }) {
  const total = HT.daysInMonthKey(monthKey);
  const days = [];
  for (let d = 1; d <= total; d++) days.push(d);

  return (
    <div className={"grid" + (fluid ? " fluid" : "")}>
      <div className="grid-head" style={{ height: headH + "px" }}>
        {dayCol ? <div className="corner" /> : null}
        {showNumbers ? (
          <React.Fragment>
            <div className="numhead">שינה</div>
            <div className="numhead">משקל</div>
          </React.Fragment>
        ) : null}
        {month.habits.map((h) => (
          <div className="habit-label" key={h.id}><span>{h.name}</span></div>
        ))}
      </div>
      <div className="grid-body">
        {days.map((d) => {
          const day = HT.getDay(month, d);
          return (
            <div className={"grid-row" + (d === today ? " is-today" : "") +
                            (HT.isWeekend(monthKey, d) ? " is-weekend" : "")}
                 key={d} style={{ height: rowH + "px" }}>
              {dayCol ? (
                <button className="daycol" onClick={() => onOpenDay && onOpenDay(d)}>
                  <b>{d}</b><i>{HT.dayOfWeekLetter(monthKey, d)}</i>
                </button>
              ) : null}
              {showNumbers ? (
                <React.Fragment>
                  <input className="numcell" inputMode="decimal" value={day.sleep === null ? "" : day.sleep}
                         onChange={(e) => onNumber(d, "sleep", e.target.value)} aria-label={"ציון שינה ליום " + d} />
                  <input className="numcell" inputMode="decimal" value={day.weight === null ? "" : day.weight}
                         onChange={(e) => onNumber(d, "weight", e.target.value)} aria-label={"משקל ליום " + d} />
                </React.Fragment>
              ) : null}
              {month.habits.map((h, i) => (
                <button className="cell" key={h.id} onClick={() => onToggle(d, h.id)}
                        aria-pressed={HT.isMarked(month, d, h.id)}
                        aria-label={h.name + ", יום " + d}>
                  {HT.isMarked(month, d, h.id) ? <XMark seed={d + i} /> : null}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- רשימת הרגעים ---------- */

function MomentsList({ month, monthKey, today, rowH, onMoment, onOpenDay }) {
  const total = HT.daysInMonthKey(monthKey);
  const rows = [];
  for (let d = 1; d <= total; d++) {
    const day = HT.getDay(month, d);
    rows.push(
      <div className={"moment-row" + (d === today ? " is-today" : "") +
                      (HT.isWeekend(monthKey, d) ? " is-weekend" : "")}
           key={d} style={{ height: rowH + "px" }}>
        {onOpenDay
          ? <button className="daynum" onClick={() => onOpenDay(d)} aria-label={"פתח את יום " + d}>
              <b>{d}</b><i>{HT.dayOfWeekLetter(monthKey, d)}</i>
            </button>
          : <span className="daynum"><b>{d}</b><i>{HT.dayOfWeekLetter(monthKey, d)}</i></span>}
        <input className="moment-input" value={day.moment} maxLength={110}
               placeholder={d === today ? "מה נשאר מהיום?" : ""}
               onChange={(e) => onMoment(d, e.target.value)}
               aria-label={"רגע זכור מיום " + d} />
      </div>
    );
  }
  return <div className="moments">{rows}</div>;
}

/* ---------- סיכום ---------- */

function Ring({ percent, size, stroke, color, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-fill" strokeWidth={stroke}
              stroke={color} strokeDasharray={`${(c * percent) / 100} ${c}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" className="ring-text">{children}</text>
    </svg>
  );
}

function Summary({ month, monthKey, now }) {
  const stats = HT.habitStats(month, monthKey, now);
  if (!stats.length) return null;
  const totalDone = stats.reduce((a, s) => a + s.done, 0);
  const totalPossible = stats.reduce((a, s) => a + s.counted, 0);
  const overall = totalPossible ? Math.round((totalDone / totalPossible) * 100) : 0;

  return (
    <section className="summary">
      <div className="band"><h3>מבט על</h3><span>{HT.monthLabel(monthKey)}</span></div>
      <div className="summary-body">
        <div className="overall">
          <Ring percent={overall} size={104} stroke={11} color="var(--pen)">{overall + "%"}</Ring>
          <p>{totalDone} סימונים מתוך {totalPossible} אפשריים</p>
        </div>
        <div className="rings">
          {stats.map((s) => (
            <div className="ring-cell" key={s.id}>
              <Ring percent={s.percent} size={68} stroke={8}
                    color={s.percent >= 80 ? "var(--pen-green)" : "var(--pen)"}>
                {s.percent + "%"}
              </Ring>
              <b>{s.name}</b>
              <i>{s.done}/{s.counted} · רצף {s.best}</i>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- עורך הנושאים ---------- */

function HabitsEditor({ month, onChange, monthKey, inherited }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="editor">
      <h3>נושאי {HT.monthLabel(monthKey)}</h3>
      <p className="hint">שינוי כאן משפיע על החודש הזה בלבד. החודש הבא ייפתח עם אותה רשימה.</p>
      {inherited ? <p className="hint note">בסוף החודש הקודם רשמת: “{inherited}”</p> : null}
      <ul className="editor-list">
        {month.habits.map((h, i) => (
          <li key={h.id}>
            <input value={h.name} onChange={(e) => onChange(HT.renameHabit(month, h.id, e.target.value))}
                   aria-label="שם הנושא" />
            <button className="ghost sm" onClick={() => onChange(HT.moveHabit(month, h.id, -1))}
                    disabled={i === 0} aria-label="הזז ימינה">↑</button>
            <button className="ghost sm" onClick={() => onChange(HT.moveHabit(month, h.id, 1))}
                    disabled={i === month.habits.length - 1} aria-label="הזז שמאלה">↓</button>
            <button className="ghost sm danger" aria-label={"מחק את " + h.name}
                    onClick={() => {
                      if (confirm("למחוק את “" + h.name + "” מהחודש הזה? כל האיקסים שלו בחודש הזה יימחקו.")) {
                        onChange(HT.removeHabit(month, h.id));
                      }
                    }}>✕</button>
          </li>
        ))}
      </ul>
      <div className="editor-add">
        <input value={draft} placeholder="נושא חדש" onChange={(e) => setDraft(e.target.value)}
               onKeyDown={(e) => {
                 if (e.key === "Enter" && draft.trim()) { onChange(HT.addHabit(month, draft.trim())); setDraft(""); }
               }} />
        <button className="btn" disabled={!draft.trim()}
                onClick={() => { onChange(HT.addHabit(month, draft.trim())); setDraft(""); }}>הוסף</button>
      </div>
    </div>
  );
}

function NextMonthNote({ month, onChange }) {
  return (
    <div className="nextmonth">
      <label>
        <span>לחודש הבא</span>
        <input value={month.nextMonth} maxLength={120} placeholder="נושאים שבא לי להוסיף…"
               onChange={(e) => onChange({ ...month, nextMonth: e.target.value })} />
      </label>
    </div>
  );
}

/* ---------- חלון יום בודד ---------- */

function DaySheet({ month, monthKey, day, onClose, onPatch, onToggle }) {
  if (!day) return null;
  const d = HT.getDay(month, day);
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>{day} ב{HT.monthLabel(monthKey).split(" ")[0]}, יום {HT.dayOfWeekLetter(monthKey, day)}</h3>
          <button className="ghost" onClick={onClose} aria-label="סגור">✕</button>
        </div>
        <label className="field">
          <span>רגע זכור</span>
          <input value={d.moment} maxLength={110} placeholder="שורה אחת מהיום"
                 onChange={(e) => onPatch(day, { moment: e.target.value })} />
        </label>
        <div className="two">
          <label className="field">
            <span>ציון שינה</span>
            <input inputMode="decimal" value={d.sleep === null ? "" : d.sleep} placeholder="0–100"
                   onChange={(e) => onPatch(day, { sleep: e.target.value })} />
          </label>
          <label className="field">
            <span>משקל</span>
            <input inputMode="decimal" value={d.weight === null ? "" : d.weight} placeholder='ק"ג'
                   onChange={(e) => onPatch(day, { weight: e.target.value })} />
          </label>
        </div>
        <div className="sheet-habits">
          {month.habits.map((h, i) => {
            const on = HT.isMarked(month, day, h.id);
            return (
              <button key={h.id} className={"chip" + (on ? " on" : "")} onClick={() => onToggle(day, h.id)}>
                {on ? <XMark seed={day + i} /> : <span className="dot" />}
                {h.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- תצוגת מחברת ---------- */

function Spread(props) {
  const { month, monthKey, today, now, onToggle, onNumber, onMoment, onChange } = props;
  const ROW = 30, HEAD = 132;
  const sleepPts = HT.series(month, "sleep", monthKey);
  const weightPts = HT.series(month, "weight", monthKey);
  const wb = HT.weightBounds(weightPts);

  return (
    <div className="spread">
      <section className="page page-right">
        <div className="page-head" style={{ height: HEAD + "px" }}>
          <MonthNav monthKey={monthKey} onShift={props.onShift} status={props.status} />
          <p className="page-kicker">רגעים זכורים</p>
        </div>
        <MomentsList month={month} monthKey={monthKey} today={today} rowH={ROW} onMoment={onMoment} />
        <NextMonthNote month={month} onChange={onChange} />
      </section>

      <div className="gutter" aria-hidden="true" />

      <section className="page page-left">
        <div className="left-inner">
          <div className="graphs">
            <VerticalGraph points={sleepPts} min={0} max={100} width={132} rowH={ROW} headH={HEAD}
                           color="var(--pen)" ticks={10} label="שינה" unit="ציון" />
            <VerticalGraph points={weightPts} min={wb.min} max={wb.max} width={86} rowH={ROW} headH={HEAD}
                           color="var(--pen-green)" ticks={(wb.max - wb.min) / 8} label="משקל" unit='ק"ג' />
          </div>
          <HabitGrid month={month} monthKey={monthKey} today={today} rowH={ROW} headH={HEAD}
                     onToggle={onToggle} showNumbers={true} onNumber={onNumber} />
        </div>
        <Summary month={month} monthKey={monthKey} now={now} />
      </section>
    </div>
  );
}

/* ---------- תצוגת נייד ---------- */

function Phone(props) {
  const { month, monthKey, today, now, onToggle, onMoment, onChange, tab, setTab } = props;
  const ROW = 40, HEAD = 108;
  const [sheetDay, setSheetDay] = useState(null);
  const sleepPts = HT.series(month, "sleep", monthKey);
  const weightPts = HT.series(month, "weight", monthKey);
  const wb = HT.weightBounds(weightPts);
  const missing = HT.missingSleepDays(month, monthKey, now);

  return (
    <div className="phone">
      <nav className="segments">
        {[["grid", "החודש"], ["moments", "רגעים"], ["graphs", "גרפים"]].map(([id, label]) => (
          <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      <div className="phone-month">
        <MonthNav monthKey={monthKey} onShift={props.onShift} status={props.status} />
      </div>

      {tab === "grid" ? (
        <div className="pane">
          <HabitGrid month={month} monthKey={monthKey} today={today} rowH={ROW} headH={HEAD}
                     onToggle={onToggle} showNumbers={false} fluid={true} dayCol={true}
                     onOpenDay={setSheetDay} />
          <Summary month={month} monthKey={monthKey} now={now} />
        </div>
      ) : null}

      {tab === "moments" ? (
        <div className="pane">
          <MomentsList month={month} monthKey={monthKey} today={today} rowH={44}
                       onMoment={onMoment} onOpenDay={setSheetDay} />
          <NextMonthNote month={month} onChange={onChange} />
        </div>
      ) : null}

      {tab === "graphs" ? (
        <div className="pane">
          {missing.length ? (
            <p className="missing">
              {missing.length === 1 ? "יום אחד בלי ציון שינה: " : missing.length + " ימים בלי ציון שינה: "}
              {missing.slice(0, 8).join(", ")}{missing.length > 8 ? "…" : ""}
            </p>
          ) : null}
          <div className="graph-row">
            <div className="rownums" style={{ paddingTop: "76px" }}>
              {Array.from({ length: HT.daysInMonthKey(monthKey) }, (_, i) => i + 1).map((d) => (
                <button key={d} className={"daynum sm" + (d === today ? " is-today" : "")}
                        style={{ height: "30px" }} onClick={() => setSheetDay(d)}>
                  <b>{d}</b>
                </button>
              ))}
            </div>
            <VerticalGraph points={sleepPts} min={0} max={100} width={128} rowH={30} headH={76}
                           color="var(--pen)" ticks={10} label="שינה" unit="ציון" />
            <VerticalGraph points={weightPts} min={wb.min} max={wb.max} width={100} rowH={30} headH={76}
                           color="var(--pen-green)" ticks={(wb.max - wb.min) / 8} label="משקל" unit='ק"ג' />
          </div>
        </div>
      ) : null}

      <DaySheet month={month} monthKey={monthKey} day={sheetDay} onClose={() => setSheetDay(null)}
                onPatch={props.onPatch} onToggle={onToggle} />
    </div>
  );
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
  const [inherited, setInherited] = useState("");
  const [theme, setTheme] = useState(function () {
    try { return localStorage.getItem("ht-theme") || "light"; } catch (e) { return "light"; }
  });
  const saveTimer = useRef(null);
  const dirty = useRef(false);

  const now = new Date();
  const t = HT.todayParts(now);
  const today = HT.monthKey(t.year, t.month) === monthKey ? t.day : -1;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("ht-theme", theme); } catch (e) {}
  }, [theme]);

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => firebase.auth().onAuthStateChanged((u) => setUser(u || null)), []);

  useEffect(() => {
    if (!user) { setMonth(null); return; }
    let cancelled = false;
    setMonth(null);
    dirty.current = false;
    (async () => {
      try {
        const snap = await monthRef(user.uid, monthKey).get();
        const prevSnap = await monthRef(user.uid, HT.shiftMonth(monthKey, -1)).get();
        if (cancelled) return;
        const prev = prevSnap.exists ? HT.normalizeMonth(prevSnap.data()) : null;
        setInherited(prev ? prev.nextMonth : "");
        setMonth(snap.exists
          ? HT.normalizeMonth(snap.data(), prev ? prev.habits : null)
          : HT.emptyMonth(prev ? prev.habits : null));
        setStatus("saved");
      } catch (e) {
        if (!cancelled) { setMonth(HT.emptyMonth()); setStatus("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [user, monthKey]);

  const scheduleSave = useCallback((next) => {
    if (!user) return;
    dirty.current = true;
    setStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await monthRef(user.uid, monthKey).set(next);
        dirty.current = false;
        setStatus("saved");
      } catch (e) { setStatus("error"); }
    }, 800);
  }, [user, monthKey]);

  const update = useCallback((next) => { setMonth(next); scheduleSave(next); }, [scheduleSave]);

  useEffect(() => {
    const warn = (e) => { if (dirty.current) { e.preventDefault(); e.returnValue = ""; } };
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
      if (isFinite(n)) val = Math.max(0, Math.min(100, n));
    }
    update(HT.withDay(month, d, { [field]: val }));
  };
  const onShift = (delta) => {
    if (delta < 0 && !HT.canGoBack(monthKey)) return;
    setMonthKey(HT.shiftMonth(monthKey, delta));
  };

  if (user === undefined) return <div className="boot">רגע…</div>;
  if (user === null) return <LoginScreen />;

  const shared = {
    month, monthKey, today, now, status, inherited,
    onToggle, onMoment, onNumber, onPatch, onShift, onChange: update
  };

  return (
    <div className="app">
      <TopBar onMenu={() => setMenu(true)} />
      {!month
        ? <div className="boot">פותח את {HT.monthLabel(monthKey)}…</div>
        : wide
          ? <div className="desk"><Spread {...shared} /></div>
          : <Phone {...shared} tab={tab} setTab={setTab} />}
      {month ? (
        <Drawer open={menu} onClose={() => setMenu(false)} month={month} monthKey={monthKey}
                onChange={update} inherited={inherited} theme={theme} setTheme={setTheme} />
      ) : null}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
