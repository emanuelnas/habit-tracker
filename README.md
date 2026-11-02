# האביט טראקר

מחברת מעקב חודשית: עמוד ימין — הרגעים הזכורים, עמוד שמאל — גרפים וטבלת הנושאים.
React 18 מ‑CDN, בלי Babel בדפדפן, Firebase Auth + Firestore, מתארח ב‑GitHub Pages.

## מה צריך לעשות פעם אחת

1. **פרטי Firebase** — פתח את `src/firebase-config.js` והדבק את אותו אובייקט
   שכבר קיים אצלך ב‑Arabicademy. אותו פרויקט, אותו מייל, אותה סיסמה.
2. **כללי Firestore** — הוסף ב‑Firebase Console → Firestore → Rules את הקטע הזה
   (בנוסף למה שכבר יש שם לערבית, לא במקומו):

   ```
   match /users/{uid}/habitMonths/{doc} {
     allow read, write: if request.auth != null && request.auth.uid == uid;
   }
   ```
3. **Pages** — Settings → Pages → Source: `Deploy from a branch`, ענף `main`, תיקייה `/docs`.

## מה להעלות

כל מה שבתוך `docs/` — זו התיקייה שמוגשת בפועל. שאר התיקיות הן קוד מקור.

## בנייה

```bash
./build.sh
```

מקמפל את `src/app.jsx` ל‑`docs/app.js`, מעתיק את שאר הקבצים ל‑`docs/`,
ומריץ את הבדיקות. `git add . && git commit && git push` וזהו.

## מבנה

| קובץ | מה יש בו |
|---|---|
| `src/logic.js` | כל הלוגיקה הטהורה: תאריכים, רצפים, אחוזים, חיתוך הגרפים. בלי React. |
| `src/app.jsx` | הממשק. שתי תצוגות: מחברת (900px ומעלה) וטלפון. |
| `src/styles.css` | העיצוב. |
| `tests/logic.test.js` | בדיקות אוטומטיות. רצות בכל בנייה. |

## הנתונים ב‑Firestore

`users/{uid}/habitMonths/{YYYY-MM}`:

```js
{
  habits: [{ id: "read", name: "לקרוא" }],
  days: { "1": { moment: "", sleep: 84, weight: 84.2, marks: { read: true } } },
  nextMonth: "מדיטציה"
}
```

מסמך לכל חודש. חודש חדש נפתח עם רשימת הנושאים של החודש שקדם לו,
ומשם אפשר לשנות בלי לגעת בהיסטוריה.
