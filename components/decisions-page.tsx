"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BRIEF_SCENARIO,
  CACHE_HIT_RATE,
  type CostInput,
  formatCount,
  formatTokens,
  formatUsd,
  formatUsdRange,
  monthlyCost,
} from "@/lib/decisions/cost";

const TOOLS = [
  {
    name: "نكست",
    role: "تطبيق واحد",
    why: "واجهة العرض ومسار استقبال الرسالة ونقاط المساعدة تُنشر معاً. ملف مسار الدردشة هو نقطة الدخول المطلوبة كما هي.",
    instead: "خادم منفصل مع واجهة مستقلة يعني خدمتين للتشغيل والمراجعة.",
  },
  {
    name: "لانغغراف",
    role: "خطوات ظاهرة",
    why: "التدفق خطوات بأسماء واضحة: تحميل الموظف، تحليل الرسالة، ثم الصلاحية والتاريخ والحفظ. فحص الصلاحية خطوة في الرسم وتظهر في كل تتبع، وليست جملة داخل التعليمات.",
    instead: "حلقة وكيل يستدعي الأدوات بنفسه، فيصير قرار إنشاء المهمة بيد النموذج.",
  },
  {
    name: "لانغسميث",
    role: "تتبع وتقييم",
    why: "كل طلب تتبع واحد يحمل معرّف المستخدم والقناة، وخطوات فرعية لكل عقدة ولكل استدعاء للنموذج. معرّف التشغيل يُحفظ في سجل التدقيق. أمر التقييم يحوّل رسائل الاختبار العشر إلى تجربة تُعاد كلما تغيّرت التعليمات أو النموذج.",
    instead: "لانغفيوز إذا صارت إقامة البيانات داخل البلد شرطاً.",
  },
  {
    name: "النموذج المصغّر",
    role: "تحليل رخيص",
    why: "المخرجات تطابق مخطط التحقق دائماً، والفهم مقبول للهجة الخليجية، والزمن مناسب للمحادثة. درجة العشوائية صفر. اسم النموذج يتبدّل من الإعداد دون تغيير الرسم.",
    instead: "النسخة الأصغر أرخص بنحو أربع مرات وأضعف في اللهجة. نموذج التفكير يضيف انتظاراً لا يحتاجه التحليل. النماذج الصغيرة من كلاود وجيميناي بديل صالح.",
  },
  {
    name: "مونغو",
    role: "بيانات بلا إعداد محلي",
    why: "عنوان الاتصال يكفي: المجموعات والمدققات والموظفون الستة تُنشأ عند أول طلب. مدقق المجموعة يرفض المهمة المشوّهة وموعد الجمعة. الاختبارات تعمل على قاعدة في الذاكرة ولا تلمس القاعدة الحقيقية.",
    instead: "بوستغرس مع سياسات الصف أنسب للإنتاج لأنه يفرض قاعدة «من يسند لمن». مدقق مونغو لا يرى المجموعات الأخرى، فتبقى هذه القاعدة في التطبيق.",
  },
  {
    name: "لوكسون وزود وفيتست",
    role: "تاريخ وعقد واختبار",
    why: "لوكسون يحسب توقيت الرياض أياً كانت منطقة الخادم. زود مخطط واحد لمخرجات النموذج وللطلب. فيتست يشغّل مئة وعشرين اختباراً حتمياً بلا مفتاح.",
    instead: "مكتبة تاريخ أخرى للحساب الزمني، وجيست للاختبارات.",
  },
] as const;

const WEEK = [
  {
    title: "فرض قاعدة الإسناد داخل قاعدة البيانات",
    detail:
      "الانتقال إلى بوستغرس، أو سوبابيس، وكتابة قاعدة الإسناد كسياسات صف تُقاد بمعرّف المستخدم في كل طلب. على مونغو البديل هو مستخدم قاعدة لكل دور مع عروض مقيدة. عندها ترفض القاعدة القراءة والكتابة المخالفة، لا التطبيق وحده.",
    outcome: "طبقة رابعة تطابق طبقات الكود، ويصعب تجاوزها بمسار جديد.",
  },
  {
    title: "قناة واتساب حقيقية",
    detail:
      "نقطة استقبال لواجهة واتساب السحابية مع التحقق من التوقيع، وربط الرقم المتحقَّق بجدول الموظفين. محوّل تيليغرام يبيّن الشكل نفسه.",
    outcome: "الهوية تأتي من القناة لا من نص الرسالة، وأمر تبديل الهوية يبقى للعرض فقط.",
  },
  {
    title: "توضيح على أكثر من رسالة",
    detail:
      "حافظ حالة في لانغغراف مفتاحه المرسِل، فيكمل «خالد» طلباً معلّقاً بعد «أحمد مين؟» بدل أن تبدأ الرسالة من الصفر. التأكيد قبل أي إجراء يغيّر البيانات يدخل هنا.",
    outcome: "سؤال التوضيح عند الاسم المجهول يصبح حواراً، لا إعادة إرسال للطلب كاملاً.",
  },
  {
    title: "إكمال دورة المهمة",
    detail:
      "تحديث الحالة («خلصت المهمة 12») وإعادة الجدولة والإلغاء، بنفس طبقات الصلاحية. هذا يخدم بند السياسة الذي يطلب تحديثاً يومياً للحالة.",
    outcome: "البوت يسجّل وينفّذ المتابعة، لا الإنشاء والعرض فقط.",
  },
  {
    title: "مجموعة تقييم أوسع",
    detail:
      "أكثر من مئة تنويعة: نجدية وحجازية وخليجية، وعربيزي، وأخطاء إملائية، ونصوص ملاحظات صوتية. مقيّم للنبرة، ويفشل التكامل إذا نزل أي مقيّم أمني عن 100٪.",
    outcome: "تغيير النموذج أو الأمر لا يمرّ إلا إذا بقيت الصلاحيات والتأريض كما هما.",
  },
  {
    title: "تشغيل يمكن مراقبته",
    detail: "حدّ لكل مرسل، وإخفاء البيانات الشخصية في التتبع، وسجلات منظمة، ولوحة للمدير فوق سجل التدقيق.",
    outcome: "الحجم في تقدير التكلفة يصبح قابلاً للتشغيل لا للعرض فقط.",
  },
] as const;

export function DecisionsPage() {
  const [input, setInput] = useState<CostInput>(BRIEF_SCENARIO);
  const cost = useMemo(() => monthlyCost(input), [input]);
  const employees = Math.max(1, input.employees || 1);
  const perEmployeeLow = cost.totalLowUsd / employees;
  const perEmployeeHigh = cost.totalHighUsd / employees;
  const isBrief = input.employees === 100 && input.messagesPerDay === 20 && input.days === 30;
  const brief = useMemo(() => monthlyCost(BRIEF_SCENARIO), []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-wa-teal">مساعد المهام الذكي</p>
            <p className="text-sm font-bold">قرارات التصميم</p>
          </div>
          <nav className="hidden items-center gap-4 text-sm text-slate-600 sm:flex">
            <a href="#tools" className="hover:text-wa-teal">
              الأدوات
            </a>
            <a href="#cost" className="hover:text-wa-teal">
              التكلفة
            </a>
            <a href="#week" className="hover:text-wa-teal">
              أسبوع إضافي
            </a>
          </nav>
          <Link href="/" className="rounded-full bg-wa-teal px-4 py-1.5 text-sm font-semibold text-white">
            المحادثة
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-14 px-4 py-10">
        <section className="space-y-6">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold leading-snug text-wa-teal sm:text-4xl">ثلاثة قرارات، ورقم واحد للكلفة</h1>
            <p className="mt-3 text-lg leading-8 text-slate-700">
              النموذج يحوّل الرسالة العربية إلى وصف منظّم. الصلاحيات والتاريخ والرد تبقى كوداً يعمل على صفوف قاعدة البيانات. من هذا القرار جاءت الأدوات، وتقدير{" "}
              <span className="font-semibold">100 موظف × 20 رسالة يومياً</span>، وما يستحق أسبوعاً إضافياً.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <a href="#tools" className="rounded-2xl bg-white p-4 shadow-sm hover:ring-2 hover:ring-wa-teal/30">
              <p className="text-xs font-semibold text-slate-500">لماذا هذه الأدوات</p>
              <p className="mt-2 font-semibold leading-7">كل أداة إمّا تُظهر خطوة القرار، أو تُبقيها خارج النموذج.</p>
            </a>
            <a href="#cost" className="rounded-2xl bg-wa-teal p-4 text-white shadow-sm">
              <p className="text-xs font-semibold text-white/70">تكلفة النموذج في لانغسميث</p>
              <p className="mt-2 text-2xl font-bold">{formatUsd(brief.llmCachedUsd)} شهرياً</p>
              <p className="mt-1 text-sm text-white/80">
                {formatUsd(brief.typicalMessageUsd)} للرسالة العادية في التتبع
              </p>
            </a>
            <a href="#week" className="rounded-2xl bg-white p-4 shadow-sm hover:ring-2 hover:ring-wa-teal/30">
              <p className="text-xs font-semibold text-slate-500">أسبوع إضافي</p>
              <p className="mt-2 font-semibold leading-7">ست تحسينات. أولاها أن تفرض القاعدة نفسها قاعدة الإسناد.</p>
            </a>
          </div>
        </section>

        <section id="tools" className="scroll-mt-20 space-y-5">
          <div>
            <h2 className="text-2xl font-bold">لماذا هذه الأدوات</h2>
            <p className="mt-2 max-w-3xl leading-7 text-slate-600">
              الاختيار يتبع قاعدة واحدة: النموذج محلّل لا صاحب قرار. لذلك رُفضت حلقة الوكيل التي تستدعي الأدوات بنفسها، وقُبل رسم خطواته ظاهرة، ونموذج صغير بمخرجات صارمة، وقاعدة ترفض موعد الجمعة حتى لو أخطأ الكود.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {TOOLS.map((tool) => (
              <article key={tool.name} className="flex flex-col rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-lg font-bold">{tool.name}</h3>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">{tool.role}</span>
                </div>
                <p className="mt-3 flex-1 text-sm leading-7 text-slate-700">{tool.why}</p>
                <p className="mt-4 border-t border-slate-100 pt-3 text-sm leading-7 text-slate-500">
                  <span className="font-semibold text-slate-600">البديل: </span>
                  {tool.instead}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="cost" className="scroll-mt-20 space-y-5">
          <div>
            <h2 className="text-2xl font-bold">التكلفة الشهرية</h2>
            <p className="mt-2 max-w-3xl leading-7 text-slate-600">
              السيناريو المطلوب: 100 موظف، 20 رسالة في اليوم لكل موظف، على 30 يوماً. هذا حد أعلى. باستبعاد الجمعة يقترب الحجم من 52 ألف رسالة، لأن 26 يوماً × 2,000 رسالة = 52,000.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <form className="space-y-4 rounded-2xl bg-white p-5 shadow-sm" onSubmit={(event) => event.preventDefault()}>
              <p className="text-sm font-semibold text-slate-600">حجم الاستخدام</p>
              <Field
                label="عدد الموظفين"
                value={input.employees}
                min={1}
                max={100000}
                onChange={(employees) => setInput((current) => ({ ...current, employees }))}
              />
              <Field
                label="رسائل في اليوم لكل موظف"
                value={input.messagesPerDay}
                min={1}
                max={1000}
                onChange={(messagesPerDay) => setInput((current) => ({ ...current, messagesPerDay }))}
              />
              <fieldset>
                <legend className="mb-2 text-sm text-slate-600">أيام الشهر</legend>
                <div className="grid grid-cols-2 gap-2">
                  <DayButton days={30} current={input.days} onPick={(days) => setInput((current) => ({ ...current, days }))} caption="حد أعلى" />
                  <DayButton days={26} current={input.days} onPick={(days) => setInput((current) => ({ ...current, days }))} caption="بلا جمعة" />
                </div>
              </fieldset>
              {!isBrief && (
                <button type="button" onClick={() => setInput(BRIEF_SCENARIO)} className="text-sm font-semibold text-wa-teal">
                  العودة للسيناريو الأساسي
                </button>
              )}
            </form>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">
                {formatCount(input.employees)} موظف × {input.messagesPerDay} رسالة × {input.days} يوماً
              </p>
              <p className="mt-1 text-3xl font-bold text-wa-teal">{formatCount(cost.messages)} رسالة</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Stat label="النموذج كما في التتبع" value={formatUsd(cost.llmCachedUsd)} hint={`الرسالة العادية ${formatUsd(cost.typicalMessageUsd)}`} />
                <Stat label="الإجمالي مع الاستضافة" value={formatUsdRange(cost.totalLowUsd, cost.totalHighUsd)} hint="الاستضافة من 10 إلى 25 دولاراً" />
                <Stat label="لكل موظف" value={formatUsdRange(perEmployeeLow, perEmployeeHigh)} hint={`${formatUsd(cost.llmCachedUsd / employees)} منها للنموذج`} />
              </div>
              <CostBars cost={cost} />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-right text-sm">
              <caption className="px-5 py-4 text-right text-sm font-semibold text-slate-600">
                مقاس من تتبع لانغسميث: نحو 2430 رمز إدخال و31 رمز إخراج للرسالة العادية، و{Math.round(CACHE_HIT_RATE * 100)}٪ من الإدخال مخزّن. أول طلب قبل التخزين يُحسب بالسعر الكامل.
              </caption>
              <thead className="border-y border-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-2 font-medium">البند</th>
                  <th className="px-3 py-2 font-medium">الحساب</th>
                  <th className="px-3 py-2 font-medium">الرموز</th>
                  <th className="px-3 py-2 font-medium">بلا تخزين</th>
                  <th className="px-5 py-2 font-medium">كما في التتبع</th>
                </tr>
              </thead>
              <tbody>
                {cost.lines.map((line) => (
                  <tr key={line.id} className="border-b border-slate-50">
                    <td className="px-5 py-3 font-medium">{line.label}</td>
                    <td className="px-3 py-3 text-slate-500">{line.detail}</td>
                    <td className="px-3 py-3">{formatTokens(line.tokens)}</td>
                    <td className="px-3 py-3">{formatUsd(line.usd)}</td>
                    <td className="px-5 py-3 font-semibold text-wa-teal">{formatUsd(line.cachedUsd)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-5 py-3">مجموع النموذج</td>
                  <td className="px-3 py-3 text-slate-500">إنشاء المهام والعرض والردود قوالب بلا رموز</td>
                  <td className="px-3 py-3">{formatTokens(cost.lines.reduce((total, line) => total + line.tokens, 0))}</td>
                  <td className="px-3 py-3">{formatUsd(cost.llmUsd)}</td>
                  <td className="px-5 py-3 text-wa-teal">{formatUsd(cost.llmCachedUsd)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Mini label="الاستضافة وقاعدة البيانات" value={formatUsdRange(cost.hostingLowUsd, cost.hostingHighUsd)} detail="جهاز صغير أو مستضيف لبيئة نود. الطبقة المجانية تكفي هذا الحجم، والنسخ الاحتياطي يرفع الرقم." />
            <Mini label="واجهة واتساب السحابية" value="مجاناً" detail="المحادثات التي يبدأها الموظف ويُرد عليها خلال يوم لا تُحسب في هذا التقدير." />
          </div>

          <ul className="space-y-2 text-sm leading-7 text-slate-600">
            <li>التقدير السابق افترض 2000 رمز إدخال و150 رمز إخراج، فطلع نحو 0.001 دولار للرسالة. التتبع يُظهر إخراجاً بين 18 و82 رمزاً، وغالباً 31، مع تخزين نحو {Math.round(CACHE_HIT_RATE * 100)}٪ من الإدخال. لذلك الرسالة العادية نحو {formatUsd(cost.typicalMessageUsd)}.</li>
            <li>سؤال السياسة استدعاء ثانٍ بنحو 462 رمز إدخال. هذا الأمر أقصر من 1024 رمزاً فلا يُخزَّن، ويضيف نحو 0.00023 دولار. الافتراض أن ربع الرسائل كذلك.</li>
            <li>أول طلب قبل أن يسخن التخزين ظهر في التتبع بسعر 0.0011 دولار. لو بقيت كل الرسائل على هذا السعر لصارت تكلفة النموذج {formatUsd(cost.llmUsd)}، وهذا ليس وضع التشغيل بعد أول الرسائل.</li>
            <li>زمن الاستجابة في التتبع نحو 1.5 إلى 2.8 ثانية للرسالة العادية، ونحو 5 ثوانٍ حين يُستدعى النموذج مرتين.</li>
          </ul>
        </section>

        <section id="week" className="scroll-mt-20 space-y-5">
          <div>
            <h2 className="text-2xl font-bold">ماذا يتحسن في أسبوع إضافي</h2>
            <p className="mt-2 max-w-3xl leading-7 text-slate-600">
              المسار الحالي يغطي التسجيل والعرض والسياسة والصلاحيات. الأسبوع الإضافي لا يبدّل هذا التصميم؛ يكمّل الثغرة التي يقبلها التقدير اليوم: القاعدة لا تفرض «من يسند لمن»، والحوار من رسالة واحدة، والقناة للعرض.
            </p>
          </div>
          <ol className="space-y-3">
            {WEEK.map((item, index) => (
              <li key={item.title} className="grid gap-3 rounded-2xl bg-white p-5 shadow-sm sm:grid-cols-[auto_1fr]">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-wa-teal text-sm font-bold text-white">{index + 1}</span>
                <div>
                  <h3 className="font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{item.detail}</p>
                  <p className="mt-2 text-sm leading-7 text-emerald-800">
                    <span className="font-semibold">ما يتغيّر: </span>
                    {item.outcome}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm text-slate-600">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base font-semibold text-slate-900 outline-none focus:border-wa-teal"
      />
    </label>
  );
}

function DayButton({ days, current, onPick, caption }: { days: number; current: number; onPick: (days: number) => void; caption: string }) {
  const active = current === days;
  return (
    <button
      type="button"
      onClick={() => onPick(days)}
      className={`rounded-xl border px-3 py-2 text-right text-sm ${active ? "border-wa-teal bg-emerald-50 font-semibold text-wa-teal" : "border-slate-200"}`}
    >
      {days} يوماً
      <span className="mt-0.5 block text-xs font-normal text-slate-500">{caption}</span>
    </button>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>
    </div>
  );
}

function Mini({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function CostBars({ cost }: { cost: ReturnType<typeof monthlyCost> }) {
  const parts = [
    { label: "النموذج", usd: cost.llmCachedUsd, className: "bg-wa-teal" },
    { label: "الاستضافة", usd: cost.hostingLowUsd, className: "bg-slate-400" },
  ];
  const total = parts.reduce((sum, part) => sum + part.usd, 0) || 1;
  return (
    <div className="mt-5">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {parts.map((part) => (
          <div key={part.label} className={part.className} style={{ width: `${(part.usd / total) * 100}%` }} title={`${part.label} ${formatUsd(part.usd)}`} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {parts.map((part) => (
          <li key={part.label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${part.className}`} />
            {part.label} {formatUsd(part.usd)}
          </li>
        ))}
      </ul>
    </div>
  );
}
