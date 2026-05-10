const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.3 x 7.5
pres.title = "Анализ рынка юридических услуг — Legal AI TWA";
pres.author = "Legal AI TWA";

// ===== Palette (Legal Light) =====
const C = {
  bg: "FFFFFF",
  blue: "2563EB",
  blueDark: "1D4ED8",
  blueLight: "DBEAFE",
  ink: "0F172A",
  text: "1F2937",
  muted: "6B7280",
  line: "E5E7EB",
  card: "F9FAFB",
  red: "DC2626",
  redLight: "FEE2E2",
  amber: "D97706",
  amberLight: "FEF3C7",
  green: "059669",
  greenLight: "D1FAE5",
};

const F = { head: "Arial", body: "Arial" };

// ===== Helpers =====
const makeShadow = () => ({
  type: "outer", color: "000000", blur: 12, offset: 2, angle: 90, opacity: 0.08,
});

function addFooter(slide, pageNum, total) {
  slide.addShape(pres.shapes.LINE, {
    x: 0.5, y: 7.15, w: 12.3, h: 0, line: { color: C.line, width: 0.75 },
  });
  slide.addText("Legal AI TWA · Market Research", {
    x: 0.5, y: 7.2, w: 6, h: 0.25,
    fontFace: F.body, fontSize: 9, color: C.muted,
  });
  slide.addText(`${pageNum} / ${total}`, {
    x: 11.8, y: 7.2, w: 1, h: 0.25,
    fontFace: F.body, fontSize: 9, color: C.muted, align: "right",
  });
}

function pageHeader(slide, eyebrow, title) {
  slide.addText(eyebrow.toUpperCase(), {
    x: 0.5, y: 0.35, w: 12.3, h: 0.3,
    fontFace: F.head, fontSize: 10, bold: true, color: C.blue,
    charSpacing: 6, margin: 0,
  });
  slide.addText(title, {
    x: 0.5, y: 0.65, w: 12.3, h: 0.7,
    fontFace: F.head, fontSize: 32, bold: true, color: C.ink, margin: 0,
  });
}

function numberedCircle(slide, n, x, y, size = 0.5, bg = C.blue, fg = "FFFFFF") {
  slide.addShape(pres.shapes.OVAL, {
    x, y, w: size, h: size, fill: { color: bg }, line: { color: bg },
  });
  slide.addText(String(n), {
    x, y, w: size, h: size,
    fontFace: F.head, fontSize: size > 0.7 ? 20 : 16, bold: true,
    color: fg, align: "center", valign: "middle", margin: 0,
  });
}

const TOTAL = 12;
let slideNum = 0;

// ===== 1. TITLE SLIDE =====
slideNum++;
{
  const s = pres.addSlide();
  s.background = { color: C.bg };

  // Blue accent block left
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.35, h: 7.5, fill: { color: C.blue }, line: { color: C.blue },
  });

  s.addText("LEGAL AI TWA · MARKET RESEARCH", {
    x: 1, y: 1.4, w: 11, h: 0.4,
    fontFace: F.head, fontSize: 12, bold: true, color: C.blue,
    charSpacing: 8, margin: 0,
  });

  s.addText("Анализ рынка юридических услуг", {
    x: 1, y: 1.9, w: 11, h: 1.2,
    fontFace: F.head, fontSize: 48, bold: true, color: C.ink, margin: 0,
  });

  s.addText("для автоматизации (2026–2027)", {
    x: 1, y: 3.1, w: 11, h: 0.7,
    fontFace: F.head, fontSize: 28, color: C.blue, margin: 0,
  });

  s.addShape(pres.shapes.LINE, {
    x: 1, y: 4.2, w: 2, h: 0, line: { color: C.ink, width: 2 },
  });

  s.addText([
    { text: "Военное право · Миграция ЕС · Гражданские услуги", options: { breakLine: true, bold: true } },
    { text: "18 апреля 2026", options: { color: C.muted } },
  ], {
    x: 1, y: 4.4, w: 11, h: 1,
    fontFace: F.body, fontSize: 16, color: C.text, margin: 0,
    paraSpaceAfter: 8,
  });

  s.addText("Senior Market Research Analyst · LegalTech Consultant", {
    x: 1, y: 6.8, w: 11, h: 0.3,
    fontFace: F.body, fontSize: 11, italic: true, color: C.muted, margin: 0,
  });
}

// ===== 2. TL;DR / Executive Summary =====
slideNum++;
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  pageHeader(s, "TL;DR", "Ключевые цифры рынка");

  const stats = [
    { n: "~4 млн", label: "украинцев со статусом TPD\nв ЕС (истекает 04.03.2027)" },
    { n: "124 тыс.", label: "разводов в Украине (2025)\nДія-онлайн стартует Q1 2026" },
    { n: "67 тыс.", label: "семей получили компенсации\nєВідновлення (31,5 млрд грн)" },
    { n: "15 млн ₴", label: "одноразовая помощь\nсемье погибшего (с 01.09.2025)" },
  ];

  const cardW = 2.85, cardH = 2.7, gap = 0.3;
  const startX = 0.5 + (12.3 - (cardW * 4 + gap * 3)) / 2;
  const startY = 2.2;

  stats.forEach((stat, i) => {
    const x = startX + i * (cardW + gap);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: startY, w: cardW, h: cardH,
      fill: { color: C.card }, line: { color: C.line, width: 0.75 },
      shadow: makeShadow(),
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: startY, w: cardW, h: 0.08, fill: { color: C.blue }, line: { color: C.blue },
    });
    s.addText(stat.n, {
      x: x + 0.1, y: startY + 0.5, w: cardW - 0.2, h: 1.2,
      fontFace: F.head, fontSize: 44, bold: true, color: C.blue,
      align: "center", valign: "middle", margin: 0,
    });
    s.addText(stat.label, {
      x: x + 0.2, y: startY + 1.75, w: cardW - 0.4, h: 0.85,
      fontFace: F.body, fontSize: 12, color: C.text,
      align: "center", valign: "top", margin: 0,
    });
  });

  s.addText("Итог: три независимых вертикали спроса — миграционная, военная, гражданская. Каждая подходит для шаблонной автоматизации.", {
    x: 0.5, y: 5.5, w: 12.3, h: 0.7,
    fontFace: F.body, fontSize: 14, italic: true, color: C.muted,
    align: "center", margin: 0,
  });

  addFooter(s, slideNum, TOTAL);
}

// ===== 3. Segment 1: Military Law =====
slideNum++;
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  pageHeader(s, "Сегмент 1", "Военное право / ТЦК / ВЛК");

  const items = [
    { t: "Відстрочка від мобілізації (ст. 23)", d: "Электронная подача через Резерв+ (2026). Стандартные основания п. 1–8, 13 — шаблонизируются.", score: "3/10" },
    { t: "Оскарження рішення ТЦК", d: "Адм. жалоба в МО — 1 месяц. Админ. иск — структурированный шаблон.", score: "6/10" },
    { t: "Оскарження висновку ВЛК (досудове)", d: "Скарга у вищу ВЛК — 1 мес. с момента получения справки.", score: "5/10" },
    { t: "15 млн ₴ сім'ї загиблого (ОГД)", d: "С 01.09.2025 новая схема: 3 млн сразу + 12 млн равными частями 80 мес.", score: "4/10" },
    { t: "Пенсія по втраті годувальника", d: "Стандартный пакет ПФУ. Шаблонизируется полностью.", score: "4/10" },
  ];

  const startY = 1.7;
  const rowH = 0.95, gap = 0.12;
  items.forEach((it, i) => {
    const y = startY + i * (rowH + gap);
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y, w: 12.3, h: rowH,
      fill: { color: C.card }, line: { color: C.line, width: 0.5 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y, w: 0.08, h: rowH, fill: { color: C.blue }, line: { color: C.blue },
    });
    numberedCircle(s, i + 1, 0.8, y + 0.23, 0.5);
    s.addText(it.t, {
      x: 1.5, y: y + 0.1, w: 8.5, h: 0.4,
      fontFace: F.head, fontSize: 14, bold: true, color: C.ink, margin: 0,
    });
    s.addText(it.d, {
      x: 1.5, y: y + 0.48, w: 8.5, h: 0.45,
      fontFace: F.body, fontSize: 11, color: C.muted, margin: 0,
    });
    // Score pill
    s.addShape(pres.shapes.RECTANGLE, {
      x: 11.2, y: y + 0.27, w: 1.5, h: 0.4,
      fill: { color: C.blueLight }, line: { color: C.blueLight },
    });
    s.addText("Авто: " + it.score, {
      x: 11.2, y: y + 0.27, w: 1.5, h: 0.4,
      fontFace: F.head, fontSize: 11, bold: true, color: C.blueDark,
      align: "center", valign: "middle", margin: 0,
    });
  });

  addFooter(s, slideNum, TOTAL);
}

// ===== 4. Segment 2: EU Temporary Protection Timeline =====
slideNum++;
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  pageHeader(s, "Сегмент 2", "Временная защита в ЕС — таймлайн");

  // Timeline line
  const tlY = 3.8;
  s.addShape(pres.shapes.LINE, {
    x: 1, y: tlY, w: 11.3, h: 0, line: { color: C.blue, width: 3 },
  });

  const events = [
    { x: 1.0,  date: "Март 2022", label: "Активация TPD", color: C.muted },
    { x: 3.0,  date: "Июнь 2025", label: "Продление до 04.03.2027", color: C.blue },
    { x: 5.3,  date: "Апр 2026", label: "Окно Чехии (Lex Ukraine VII)", color: C.blue },
    { x: 7.6,  date: "Май 2026", label: "Предложение ЕК о новом статусе", color: C.amber },
    { x: 10.0, date: "04.03.2027", label: "Истечение TPD — точка X", color: C.red },
  ];

  events.forEach(e => {
    s.addShape(pres.shapes.OVAL, {
      x: e.x - 0.12, y: tlY - 0.12, w: 0.24, h: 0.24,
      fill: { color: e.color }, line: { color: e.color },
    });
    // Date above
    s.addText(e.date, {
      x: e.x - 1.1, y: tlY - 0.75, w: 2.2, h: 0.3,
      fontFace: F.head, fontSize: 11, bold: true, color: e.color,
      align: "center", margin: 0,
    });
    // Label below
    s.addText(e.label, {
      x: e.x - 1.2, y: tlY + 0.25, w: 2.4, h: 0.7,
      fontFace: F.body, fontSize: 10, color: C.text,
      align: "center", margin: 0,
    });
  });

  // Bottom stats row
  const countries = [
    { flag: "DE", name: "Германия", n: "~1,2 млн", note: "§24 → Chancenkarte / Blue Card\n(ЗП ≥ €48 300)" },
    { flag: "PL", name: "Польша", n: "~950 тыс.", note: "CUKR — законопроект (⚠)\nkarta pobytu czasowa" },
    { flag: "CZ", name: "Чехия", n: "~380 тыс.", note: "Special Long-Term Permit\n2+ года TP + CZK 440 000/год" },
  ];

  const cardW = 3.9, startX = 0.7, startY = 5.3;
  countries.forEach((c, i) => {
    const x = startX + i * (cardW + 0.15);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: startY, w: cardW, h: 1.5,
      fill: { color: C.card }, line: { color: C.line, width: 0.5 },
    });
    s.addText(c.flag, {
      x: x + 0.2, y: startY + 0.15, w: 0.6, h: 0.5,
      fontFace: F.head, fontSize: 18, bold: true, color: C.blue, margin: 0,
    });
    s.addText(c.name, {
      x: x + 0.8, y: startY + 0.15, w: 1.6, h: 0.35,
      fontFace: F.head, fontSize: 14, bold: true, color: C.ink, margin: 0,
    });
    s.addText(c.n, {
      x: x + 0.8, y: startY + 0.48, w: 1.6, h: 0.3,
      fontFace: F.head, fontSize: 13, color: C.blue, margin: 0,
    });
    s.addText(c.note, {
      x: x + 0.2, y: startY + 0.85, w: cardW - 0.4, h: 0.6,
      fontFace: F.body, fontSize: 10, color: C.muted, margin: 0,
    });
  });

  addFooter(s, slideNum, TOTAL);
}

// ===== 5. Segment 3: Civil Services =====
slideNum++;
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  pageHeader(s, "Сегмент 3", "Гражданские и административные услуги");

  const cols = [
    {
      title: "Разводы",
      stat: "124 тыс./год",
      items: [
        "РАЦС без детей — шаблон ф-1/ф-8 (авто: 1/10)",
        "Дія-онлайн старт Q1 2026 (без детей)",
        "Позов ст. 110 СК с детьми — средний (5/10)",
        "Без согласия супруга — допустимо, ст. 112 СК",
      ],
    },
    {
      title: "Алименты",
      stat: "Судовий наказ",
      items: [
        "Без суд. заседания, 0 грн збору (авто: 2/10)",
        "¼ на 1 ребёнка · ⅓ на 2 · ½ на 3+",
        "Макс. 27 830 ₴ (до 6 лет) · 34 710 ₴ (6–18)",
        "Стабильная норма — идеальный кандидат MVP",
      ],
    },
    {
      title: "єВідновлення",
      stat: "67К+ семей",
      items: [
        "Повреждение — заявка в «Дії» (авто: 3/10)",
        "Разрушение — житловий сертифікат (4/10)",
        "Обновлена постановою КМУ 26.11.2025",
        "Оскарження відмови — 7/10 (практика ВС)",
      ],
    },
  ];

  const colW = 3.95, gap = 0.2;
  const startX = 0.5 + (12.3 - (colW * 3 + gap * 2)) / 2;
  const startY = 1.7;
  const colH = 5.2;

  cols.forEach((col, i) => {
    const x = startX + i * (colW + gap);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: startY, w: colW, h: colH,
      fill: { color: C.card }, line: { color: C.line, width: 0.75 },
      shadow: makeShadow(),
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: startY, w: colW, h: 0.08, fill: { color: C.blue }, line: { color: C.blue },
    });
    s.addText(col.title, {
      x: x + 0.25, y: startY + 0.2, w: colW - 0.5, h: 0.5,
      fontFace: F.head, fontSize: 22, bold: true, color: C.ink, margin: 0,
    });
    s.addText(col.stat, {
      x: x + 0.25, y: startY + 0.75, w: colW - 0.5, h: 0.4,
      fontFace: F.head, fontSize: 14, bold: true, color: C.blue, margin: 0,
    });
    s.addShape(pres.shapes.LINE, {
      x: x + 0.25, y: startY + 1.25, w: colW - 0.5, h: 0,
      line: { color: C.line, width: 0.75 },
    });
    s.addText(
      col.items.map((it, idx) => ({
        text: it,
        options: { bullet: { code: "25A0" }, breakLine: idx !== col.items.length - 1 },
      })),
      {
        x: x + 0.3, y: startY + 1.4, w: colW - 0.5, h: colH - 1.6,
        fontFace: F.body, fontSize: 12, color: C.text,
        paraSpaceAfter: 8, valign: "top", margin: 0,
      }
    );
  });

  addFooter(s, slideNum, TOTAL);
}

// ===== 6. Services Table — Part 1 =====
function servicesTableSlide(partTitle, rows, pageN) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  pageHeader(s, "Сводная таблица", partTitle);

  const header = [
    { text: "#", options: { bold: true, color: "FFFFFF", fill: { color: C.blue }, align: "center" } },
    { text: "Услуга", options: { bold: true, color: "FFFFFF", fill: { color: C.blue } } },
    { text: "Аудитория", options: { bold: true, color: "FFFFFF", fill: { color: C.blue } } },
    { text: "Сложность", options: { bold: true, color: "FFFFFF", fill: { color: C.blue }, align: "center" } },
    { text: "Тип документа", options: { bold: true, color: "FFFFFF", fill: { color: C.blue } } },
    { text: "Статус нормы", options: { bold: true, color: "FFFFFF", fill: { color: C.blue } } },
  ];

  const tableRows = [header, ...rows.map((r, i) => {
    const zebra = i % 2 === 0 ? C.bg : C.card;
    return [
      { text: r[0], options: { fill: { color: zebra }, align: "center", bold: true, color: C.blue } },
      { text: r[1], options: { fill: { color: zebra } } },
      { text: r[2], options: { fill: { color: zebra }, color: C.muted } },
      { text: r[3], options: { fill: { color: zebra }, align: "center", bold: true, color: scoreColor(r[3]) } },
      { text: r[4], options: { fill: { color: zebra } } },
      { text: r[5], options: { fill: { color: zebra }, color: C.muted } },
    ];
  })];

  s.addTable(tableRows, {
    x: 0.5, y: 1.6, w: 12.3,
    colW: [0.5, 3.4, 2.8, 1.1, 2.5, 2.0],
    rowH: 0.38,
    fontFace: F.body, fontSize: 9.5,
    border: { type: "solid", pt: 0.5, color: C.line },
    valign: "middle",
  });

  addFooter(s, pageN, TOTAL);
}

function scoreColor(score) {
  const n = parseInt(score, 10);
  if (n <= 3) return C.green;
  if (n <= 6) return C.amber;
  return C.red;
}

slideNum++;
servicesTableSlide("Услуги 1–9: гражданские + военные", [
  ["1", "Аліменти (судовий наказ, ст. 161, 183 СК)", "Матери/разведённые родители", "2", "Шаблон ЦПК", "Стабильная"],
  ["2", "Розлучення через РАЦС (без детей)", "Супруги без дет. до 18", "1", "Шаблон ф-1/ф-8", "Дія Q1 2026"],
  ["3", "Позов про розірвання шлюбу (ст. 110)", "Супруги с детьми", "5", "Иск", "Действующая"],
  ["4", "Відстрочка (ст. 23) — стандарт. основания", "Инвалиды, отцы 3+, опекуны", "3", "Заява / Резерв+", "Эл. подача 2026"],
  ["5", "Скарга на рішення ТЦК", "Получившие отказ", "6", "Адм. жалоба/иск", "Действующая"],
  ["6", "Оскарження ВЛК — досудове", "Военнослужащие", "5", "Скарга (1 мес.)", "Действующая"],
  ["7", "Адм. позов — скасування ВЛК", "Военнослужащие", "8", "Иск (6 мес.)", "Требует юриста"],
  ["8", "Одноразова допомога 15 млн сім'ї загиблого", "Вдовы, родители, дети", "4", "Пакет у ТЦК", "С 01.09.2025"],
  ["9", "Пенсія по втраті годувальника", "Семьи погибших", "4", "Пакет ПФУ", "Действующая"],
], slideNum);

slideNum++;
servicesTableSlide("Услуги 10–18: єВідновлення + EU-миграция", [
  ["10", "Компенсація єВідновлення (повреждение)", "Собственники жилья", "3", "Заява в «Дії»", "Пост. КМУ 26.11.2025"],
  ["11", "Житловий сертифікат (знищене житло)", "Собственники", "4", "Заява + пакет", "Действующая"],
  ["12", "Позов до комісії єВідновлення", "Получившие отказ", "7", "Адм. иск", "Практика ВС"],
  ["13", "Відновлення документів", "ВПО за границей", "2", "Стандарт. заявы", "Действующая"],
  ["14", "Chancenkarte (Германия)", "Украинцы со §24", "6", "Пакет + баллы", "Действующая"],
  ["15", "EU Blue Card (Германия)", "Спец. ЗП ≥ €48 300", "7", "Пакет + работодатель", "Действующая"],
  ["16", "Special Long-Term Permit (Чехия)", "TP 2+ года, доход CZK 440К", "6", "Эл. заявка", "Окно 01–30.04.2026"],
  ["17", "Karta pobytu / CUKR (Польша)", "После окончания TP", "6", "Пакет воеводе", "⚠ Законопроект"],
  ["18", "Воссоединение семьи (EU)", "Родственники резидентов", "7", "Пакет + родство", "Действующая"],
], slideNum);

// ===== 8. Gold Mines 2027 =====
slideNum++;
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  pageHeader(s, "Прогноз 2027", "3 «золотые жилы» после окончания TPD");

  const mines = [
    {
      medal: "🥇", rank: "№1",
      title: "§24 → Chancenkarte / Blue Card",
      country: "Германия",
      market: "~1,2 млн",
      reason: "Формализованные критерии (Punktesystem, зарплата). Балльный калькулятор + пакет документов (Lebenslauf, Motivation, Antrag).",
      risk: "Средний — порог ЗП меняется ежегодно",
    },
    {
      medal: "🥈", rank: "№2",
      title: "Special Long-Term Permit",
      country: "Чехия · Lex Ukraine VII",
      market: "~380 тыс.",
      reason: "Условия алгоритмизируются: 2+ года TP на 31.03.2025, доход ≥ CZK 440 000. Ожидается вторая волна подачи.",
      risk: "Средний — возможны изменения в Lex Ukraine VIII",
    },
    {
      medal: "🥉", rank: "№3",
      title: "CUKR / karta pobytu",
      country: "Польша",
      market: "~950 тыс.",
      reason: "CUKR — 3 года, полный доступ к рынку труда. Фолбэк — karta czasowa по работе.",
      risk: "⚠ Высокий — CUKR ещё законопроект",
    },
  ];

  const cardW = 3.95, gap = 0.2;
  const startX = 0.5 + (12.3 - (cardW * 3 + gap * 2)) / 2;
  const startY = 1.7;
  const cardH = 5.2;

  mines.forEach((m, i) => {
    const x = startX + i * (cardW + gap);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: startY, w: cardW, h: cardH,
      fill: { color: C.card }, line: { color: C.line, width: 0.75 },
      shadow: makeShadow(),
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: startY, w: cardW, h: 0.08, fill: { color: C.blue }, line: { color: C.blue },
    });

    s.addText(m.medal, {
      x: x + 0.25, y: startY + 0.2, w: 0.8, h: 0.7,
      fontSize: 36, margin: 0, valign: "middle",
    });
    s.addText(m.rank, {
      x: x + 1.0, y: startY + 0.3, w: cardW - 1.2, h: 0.4,
      fontFace: F.head, fontSize: 18, bold: true, color: C.blue, margin: 0,
    });

    s.addText(m.title, {
      x: x + 0.25, y: startY + 1.0, w: cardW - 0.5, h: 0.7,
      fontFace: F.head, fontSize: 18, bold: true, color: C.ink, margin: 0,
    });
    s.addText(m.country, {
      x: x + 0.25, y: startY + 1.7, w: cardW - 0.5, h: 0.35,
      fontFace: F.body, fontSize: 12, italic: true, color: C.muted, margin: 0,
    });

    s.addShape(pres.shapes.LINE, {
      x: x + 0.25, y: startY + 2.15, w: cardW - 0.5, h: 0, line: { color: C.line, width: 0.5 },
    });

    s.addText("Объём рынка", {
      x: x + 0.25, y: startY + 2.3, w: cardW - 0.5, h: 0.25,
      fontFace: F.head, fontSize: 9, bold: true, color: C.muted,
      charSpacing: 4, margin: 0,
    });
    s.addText(m.market, {
      x: x + 0.25, y: startY + 2.55, w: cardW - 0.5, h: 0.4,
      fontFace: F.head, fontSize: 22, bold: true, color: C.blue, margin: 0,
    });

    s.addText("Почему шаблонизируется", {
      x: x + 0.25, y: startY + 3.1, w: cardW - 0.5, h: 0.25,
      fontFace: F.head, fontSize: 9, bold: true, color: C.muted,
      charSpacing: 4, margin: 0,
    });
    s.addText(m.reason, {
      x: x + 0.25, y: startY + 3.35, w: cardW - 0.5, h: 1.25,
      fontFace: F.body, fontSize: 11, color: C.text, margin: 0,
    });

    s.addText("Риск", {
      x: x + 0.25, y: startY + 4.65, w: cardW - 0.5, h: 0.25,
      fontFace: F.head, fontSize: 9, bold: true, color: C.muted,
      charSpacing: 4, margin: 0,
    });
    s.addText(m.risk, {
      x: x + 0.25, y: startY + 4.88, w: cardW - 0.5, h: 0.3,
      fontFace: F.body, fontSize: 11, italic: true, color: C.text, margin: 0,
    });
  });

  addFooter(s, slideNum, TOTAL);
}

// ===== 9. Risk Management — 3 zones =====
slideNum++;
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  pageHeader(s, "Risk Management", "Где ИИ использовать нельзя / можно / нужно");

  const zones = [
    {
      color: C.red, bg: C.redLight, symbol: "✕",
      title: "Красная зона", sub: "Human-in-the-loop обязателен",
      items: [
        "Опека / место проживания ребёнка (ст. 161 СК)",
        "Раздел имущества с оспариванием долей",
        "Аргументация иска по ВЛК (Розклад хвороб)",
        "Уголовная защита — включая СЗЧ (ст. 407)",
        "Спорные отказы єВідновлення",
        "Immigration interviews / motivation letters",
      ],
    },
    {
      color: C.amber, bg: C.amberLight, symbol: "!",
      title: "Жёлтая зона", sub: "AI-ассист, финал — за юристом",
      items: [
        "Жалобы в вышестоящую ВЛК (досудебные)",
        "Иски о взыскании алиментов при оспаривании",
        "Трансфер §24 → Chancenkarte при нестандарт. CV",
        "Скарга на рішення ТЦК (средние случаи)",
      ],
    },
    {
      color: C.green, bg: C.greenLight, symbol: "✓",
      title: "Зелёная зона", sub: "Полная автоматизация",
      items: [
        "№1 Аліменти — судовий наказ",
        "№2 Розлучення через РАЦС",
        "№4 Стандартна відстрочка",
        "№8 Одноразова допомога сім'ям",
        "№10 Компенсація єВідновлення",
        "№13 Відновлення документів",
      ],
    },
  ];

  const cardW = 3.95, gap = 0.2;
  const startX = 0.5 + (12.3 - (cardW * 3 + gap * 2)) / 2;
  const startY = 1.7;
  const cardH = 5.2;

  zones.forEach((z, i) => {
    const x = startX + i * (cardW + gap);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: startY, w: cardW, h: cardH,
      fill: { color: C.bg }, line: { color: z.color, width: 1.5 },
      shadow: makeShadow(),
    });
    // Top colored band
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: startY, w: cardW, h: 1.1, fill: { color: z.bg }, line: { color: z.bg },
    });
    // Symbol circle
    s.addShape(pres.shapes.OVAL, {
      x: x + 0.3, y: startY + 0.27, w: 0.55, h: 0.55,
      fill: { color: z.color }, line: { color: z.color },
    });
    s.addText(z.symbol, {
      x: x + 0.3, y: startY + 0.27, w: 0.55, h: 0.55,
      fontFace: F.head, fontSize: 22, bold: true, color: "FFFFFF",
      align: "center", valign: "middle", margin: 0,
    });
    s.addText(z.title, {
      x: x + 1.0, y: startY + 0.25, w: cardW - 1.2, h: 0.4,
      fontFace: F.head, fontSize: 18, bold: true, color: z.color, margin: 0,
    });
    s.addText(z.sub, {
      x: x + 1.0, y: startY + 0.65, w: cardW - 1.2, h: 0.35,
      fontFace: F.body, fontSize: 11, italic: true, color: C.text, margin: 0,
    });

    // Items
    s.addText(
      z.items.map((it, idx) => ({
        text: it,
        options: { bullet: { code: "25A0" }, breakLine: idx !== z.items.length - 1 },
      })),
      {
        x: x + 0.3, y: startY + 1.3, w: cardW - 0.5, h: cardH - 1.5,
        fontFace: F.body, fontSize: 11, color: C.text,
        paraSpaceAfter: 6, valign: "top", margin: 0,
      }
    );
  });

  addFooter(s, slideNum, TOTAL);
}

// ===== 10. MVP Recommendations =====
slideNum++;
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  pageHeader(s, "Рекомендации", "Дорожная карта Legal AI TWA");

  const prios = [
    {
      n: 1, label: "СЕЙЧАС",
      color: C.green,
      services: ["№1 Аліменти · судовий наказ", "№2 РАЦС-розлучення", "№4 Стандартна відстрочка", "№10 єВідновлення (первичная)"],
      reason: "Сотни тысяч запросов/год. Шаблонизируемость 90%+. Юр. риск низкий.",
    },
    {
      n: 2, label: "Q3–Q4 2026",
      color: C.amber,
      services: ["№8 Виплати сім'ям загиблих", "№14 Chancenkarte (Германия)", "№16 Чехия — ко второй волне"],
      reason: "Готовиться к окну легализации до марта 2027. Сейчас лучший момент собрать expertise.",
    },
    {
      n: 3, label: "МОНИТОРИТЬ",
      color: C.blue,
      services: ["№17 CUKR (Польша) — ждать закона", "№12 Оскарження єВідновлення — ждать ВС"],
      reason: "Нормативная нестабильность. Следить за вступлением в силу и практикой.",
    },
  ];

  const startY = 1.7;
  const rowH = 1.65, gap = 0.15;
  prios.forEach((p, i) => {
    const y = startY + i * (rowH + gap);
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y, w: 12.3, h: rowH,
      fill: { color: C.card }, line: { color: C.line, width: 0.5 },
      shadow: makeShadow(),
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y, w: 0.12, h: rowH, fill: { color: p.color }, line: { color: p.color },
    });
    numberedCircle(s, p.n, 0.85, y + 0.35, 0.95, p.color);
    s.addText("ПРИОРИТЕТ " + p.n + " · " + p.label, {
      x: 2.1, y: y + 0.2, w: 6, h: 0.35,
      fontFace: F.head, fontSize: 11, bold: true, color: p.color,
      charSpacing: 6, margin: 0,
    });
    s.addText(
      p.services.map((sv, idx) => ({
        text: sv,
        options: { bullet: { code: "25A0" }, breakLine: idx !== p.services.length - 1 },
      })),
      {
        x: 2.1, y: y + 0.55, w: 6.2, h: rowH - 0.65,
        fontFace: F.body, fontSize: 12, color: C.ink, bold: true,
        paraSpaceAfter: 2, valign: "top", margin: 0,
      }
    );

    // Divider
    s.addShape(pres.shapes.LINE, {
      x: 8.5, y: y + 0.25, w: 0, h: rowH - 0.5, line: { color: C.line, width: 0.75 },
    });

    s.addText("Обоснование", {
      x: 8.7, y: y + 0.2, w: 4, h: 0.3,
      fontFace: F.head, fontSize: 10, bold: true, color: C.muted,
      charSpacing: 4, margin: 0,
    });
    s.addText(p.reason, {
      x: 8.7, y: y + 0.5, w: 4, h: rowH - 0.6,
      fontFace: F.body, fontSize: 12, italic: true, color: C.text, margin: 0,
    });
  });

  addFooter(s, slideNum, TOTAL);
}

// ===== 11. Sources =====
slideNum++;
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  pageHeader(s, "Источники", "Официальные порталы и отраслевые отчёты");

  const groups = [
    { title: "EU Temporary Protection", items: ["consilium.europa.eu", "ec.europa.eu (home-affairs)", "eumigrationlawblog.eu", "emnbelgium.be"] },
    { title: "Германия · Чехия · Польша", items: ["migrando.de", "se-legal.de", "kpmg.com (Flash Alerts)", "help.unhcr.org/czech", "ey.com/en_pl"] },
    { title: "Украина: мобилизация / ВЛК", items: ["zakon.rada.gov.ua (ст. 23)", "yur-gazeta.com", "eopora.com.ua", "legalaid.wiki"] },
    { title: "Выплаты · єВідновлення", items: ["erecovery.diia.gov.ua", "supreme.court.gov.ua", "advokatmarket.com", "ldn.org.ua"] },
    { title: "Алименты · разводы", items: ["life.pravda.com.ua", "politarena.ua", "go-advocate.com", "2p.com.ua (статистика)"] },
    { title: "Юридический рынок", items: ["yur-gazeta.com (рейтинг)", "pravo.ua (ТОП-50)"] },
  ];

  const cardW = 3.95, gap = 0.2;
  const startX = 0.5 + (12.3 - (cardW * 3 + gap * 2)) / 2;
  const startY = 1.7;
  const rowH = 2.5, rowGap = 0.2;

  groups.forEach((g, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = startX + col * (cardW + gap);
    const y = startY + row * (rowH + rowGap);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: rowH,
      fill: { color: C.card }, line: { color: C.line, width: 0.5 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.08, h: rowH, fill: { color: C.blue }, line: { color: C.blue },
    });
    s.addText(g.title, {
      x: x + 0.25, y: y + 0.15, w: cardW - 0.4, h: 0.4,
      fontFace: F.head, fontSize: 14, bold: true, color: C.ink, margin: 0,
    });
    s.addText(
      g.items.map((it, idx) => ({
        text: it,
        options: { bullet: { code: "25A0" }, breakLine: idx !== g.items.length - 1 },
      })),
      {
        x: x + 0.3, y: y + 0.6, w: cardW - 0.5, h: rowH - 0.75,
        fontFace: F.body, fontSize: 10.5, color: C.text,
        paraSpaceAfter: 4, valign: "top", margin: 0,
      }
    );
  });

  addFooter(s, slideNum, TOTAL);
}

// ===== 12. Closing =====
slideNum++;
{
  const s = pres.addSlide();
  s.background = { color: C.bg };

  // Big blue band
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 13.3, h: 7.5, fill: { color: C.blue }, line: { color: C.blue },
  });

  s.addText("NEXT STEPS", {
    x: 0.8, y: 1.4, w: 11.5, h: 0.4,
    fontFace: F.head, fontSize: 12, bold: true, color: C.blueLight,
    charSpacing: 8, margin: 0,
  });

  s.addText("Стартуем с зелёной зоны", {
    x: 0.8, y: 1.9, w: 11.5, h: 1.1,
    fontFace: F.head, fontSize: 46, bold: true, color: "FFFFFF", margin: 0,
  });

  s.addText("и готовимся к окну легализации до марта 2027.", {
    x: 0.8, y: 3.1, w: 11.5, h: 0.6,
    fontFace: F.head, fontSize: 22, color: C.blueLight, margin: 0,
  });

  s.addShape(pres.shapes.LINE, {
    x: 0.8, y: 4.0, w: 2, h: 0, line: { color: "FFFFFF", width: 2 },
  });

  const steps = [
    { n: "1", t: "Валидировать form_config для услуг №1, №2, №4, №10" },
    { n: "2", t: "Подготовить hybrid-шаблоны (JS + AI на склонение и обґрунтування)" },
    { n: "3", t: "Добавить legal review checkpoint для жёлтой зоны" },
    { n: "4", t: "Мониторить предложение ЕК (май 2026) и Lex Ukraine VIII" },
  ];

  steps.forEach((step, i) => {
    const y = 4.3 + i * 0.55;
    s.addShape(pres.shapes.OVAL, {
      x: 0.8, y, w: 0.4, h: 0.4,
      fill: { color: "FFFFFF" }, line: { color: "FFFFFF" },
    });
    s.addText(step.n, {
      x: 0.8, y, w: 0.4, h: 0.4,
      fontFace: F.head, fontSize: 14, bold: true, color: C.blue,
      align: "center", valign: "middle", margin: 0,
    });
    s.addText(step.t, {
      x: 1.4, y: y + 0.02, w: 11, h: 0.4,
      fontFace: F.body, fontSize: 15, color: "FFFFFF", valign: "middle", margin: 0,
    });
  });

  s.addText("Legal AI TWA · 18 апреля 2026", {
    x: 0.8, y: 6.9, w: 11.5, h: 0.3,
    fontFace: F.body, fontSize: 11, color: C.blueLight, italic: true, margin: 0,
  });
}

// ===== Write =====
const out = "C:/Users/serge/Legal-AI/docs/market-research-legal-services-2026.pptx";
pres.writeFile({ fileName: out }).then(fn => console.log("Saved:", fn));
