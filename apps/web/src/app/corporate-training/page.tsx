"use client";

import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import { useLanguage } from "@/contexts/language-context";
import styles from "./page.module.css";

type Language = "ar" | "en";

const COPY = {
  ar: {
    eyebrow: "حلول التعلم للمؤسسات",
    title: "طوّر فريقك. ووسّع أثر مؤسستك.",
    intro:
      "برامج لغات وتواصل مهني مصممة حول أهداف فريقك، يقودها مدربون متخصصون وتدعمها متابعة واضحة للتقدم.",
    primaryCta: "ناقش احتياجات فريقك",
    secondaryCta: "استكشف المسارات",
    panelLabel: "نتائج تهم مؤسستك",
    outcomes: [
      ["خطة مخصصة", "حسب الأدوار والأهداف"],
      ["تعلم مرن", "جماعي أو فردي"],
      ["تقدم واضح", "تقارير ومؤشرات عملية"],
    ],
    benefitEyebrow: "تعلم مبني حول العمل",
    benefitTitle: "من الاحتياج إلى أثر يمكن ملاحظته",
    benefitBody:
      "لا نقدم محتوى موحدًا للجميع. نحدد مواقف التواصل الأهم لفريقك، ثم نبني تجربة تعلم عملية تناسب جدولهم وثقافة مؤسستك.",
    benefits: [
      {
        number: "01",
        title: "محتوى وثيق الصلة",
        body: "سيناريوهات ومفردات وتمارين مستمدة من بيئة عمل فريقك.",
      },
      {
        number: "02",
        title: "مدربون مناسبون",
        body: "اختيار خبرات التدريس واللغة بما يلائم القطاع ومستوى المتعلمين.",
      },
      {
        number: "03",
        title: "تنفيذ مرن",
        body: "جلسات مباشرة عبر الإنترنت، ومجموعات بأحجام مناسبة، ومواعيد قابلة للتنسيق.",
      },
    ],
    processEyebrow: "كيف نعمل معك",
    processTitle: "ثلاث خطوات من الهدف إلى البرنامج",
    process: [
      {
        title: "نستمع ونقيس",
        body: "نتعرف على الأهداف، والأدوار، والمستويات الحالية، والتحديات اليومية.",
      },
      {
        title: "نصمم ونطلق",
        body: "نبني المسار، ونرشّح المدربين، وننسق المجموعات والجدول مع فريقك.",
      },
      {
        title: "نتابع ونطوّر",
        body: "نشارك التقدم، ونلتقط الملاحظات، ونكيّف البرنامج للحفاظ على الزخم.",
      },
    ],
    tracksEyebrow: "مسارات قابلة للتخصيص",
    tracksTitle: "ابدأ من احتياج فريقك",
    tracksBody:
      "يمكن تقديم كل مسار بمستويات مختلفة، أو دمج أكثر من مسار في برنامج واحد.",
    tracks: [
      {
        label: "للعمل اليومي",
        title: "اللغة المهنية",
        body: "اجتماعات ومراسلات وعروض ومحادثات أكثر وضوحًا وثقة.",
      },
      {
        label: "للفرق الدولية",
        title: "التواصل عبر الثقافات",
        body: "مهارات تعاون عملية تساعد الفرق متعددة الجنسيات على العمل بانسجام.",
      },
      {
        label: "للقادة",
        title: "تواصل القيادة",
        body: "لغة التأثير والتغذية الراجعة والتفاوض وتقديم الرؤية.",
      },
      {
        label: "حسب قطاعك",
        title: "لغة متخصصة",
        body: "برامج موجهة لخدمة العملاء أو الضيافة أو الأعمال وغيرها.",
      },
    ],
    ctaEyebrow: "لنصمم نقطة البداية",
    ctaTitle: "أخبرنا أين تريد أن يصل فريقك.",
    ctaBody:
      "شاركنا حجم الفريق، واللغة المطلوبة، والهدف. سنعود إليك بالخطوة التالية المناسبة.",
    ctaButton: "تواصل مع فريق التدريب",
    ctaNote: "محادثة أولية دون التزام",
  },
  en: {
    eyebrow: "Learning solutions for organisations",
    title: "Grow your team. Multiply your impact.",
    intro:
      "Language and professional communication programmes shaped around your team’s goals, led by specialist tutors and supported by clear progress tracking.",
    primaryCta: "Discuss your team’s needs",
    secondaryCta: "Explore the tracks",
    panelLabel: "Outcomes your organisation can use",
    outcomes: [
      ["Tailored plan", "Built around roles and goals"],
      ["Flexible learning", "Group or one-to-one"],
      ["Visible progress", "Practical reporting"],
    ],
    benefitEyebrow: "Learning built around the work",
    benefitTitle: "From a real need to a visible result",
    benefitBody:
      "We do not deliver the same content to every team. We identify the communication moments that matter most, then build a practical experience around your schedule and culture.",
    benefits: [
      {
        number: "01",
        title: "Relevant content",
        body: "Scenarios, vocabulary and practice drawn from your team’s working environment.",
      },
      {
        number: "02",
        title: "The right tutors",
        body: "Teaching and language expertise matched to your sector and learner levels.",
      },
      {
        number: "03",
        title: "Flexible delivery",
        body: "Live online sessions, purposeful group sizes and schedules that can be coordinated.",
      },
    ],
    processEyebrow: "How we work with you",
    processTitle: "Three steps from objective to programme",
    process: [
      {
        title: "Listen & assess",
        body: "We learn the goals, roles, current levels and everyday communication challenges.",
      },
      {
        title: "Design & launch",
        body: "We shape the track, match tutors, and coordinate groups and timing with your team.",
      },
      {
        title: "Review & refine",
        body: "We share progress, capture feedback and adapt the programme to maintain momentum.",
      },
    ],
    tracksEyebrow: "Customisable learning tracks",
    tracksTitle: "Start with what your team needs",
    tracksBody:
      "Every track can be delivered at different levels or combined into one focused programme.",
    tracks: [
      {
        label: "For daily work",
        title: "Professional language",
        body: "Clearer, more confident meetings, writing, presentations and conversations.",
      },
      {
        label: "For global teams",
        title: "Cross-cultural communication",
        body: "Practical collaboration skills for teams working across languages and cultures.",
      },
      {
        label: "For leaders",
        title: "Leadership communication",
        body: "The language of influence, feedback, negotiation and communicating a vision.",
      },
      {
        label: "For your sector",
        title: "Specialist language",
        body: "Focused programmes for customer service, hospitality, business and more.",
      },
    ],
    ctaEyebrow: "Let’s shape the starting point",
    ctaTitle: "Tell us where your team needs to go.",
    ctaBody:
      "Share your team size, target language and objective. We’ll come back with the right next step.",
    ctaButton: "Contact the training team",
    ctaNote: "No-obligation discovery conversation",
  },
} satisfies Record<Language, Record<string, unknown>>;

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

export default function CorporateTrainingPage() {
  const { lang } = useLanguage();
  const copy = COPY[lang];
  const contactHref = `mailto:hello@mrhacademy.com?subject=${encodeURIComponent(
    lang === "ar" ? "استفسار عن تدريب المؤسسات" : "Corporate training enquiry",
  )}`;

  return (
    <div
      className={`public-navbar-offset ${styles.page}`}
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <Navbar />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>{copy.eyebrow as string}</p>
              <h1>{copy.title as string}</h1>
              <p className={styles.lead}>{copy.intro as string}</p>
              <div className={styles.actions}>
                <a href={contactHref} className={styles.primaryButton}>
                  {copy.primaryCta as string}
                  <ArrowIcon />
                </a>
                <a href="#learning-tracks" className={styles.textButton}>
                  {copy.secondaryCta as string}
                </a>
              </div>
            </div>

            <aside className={styles.outcomesPanel}>
              <div className={styles.panelTop}>
                <span>MR.H</span>
                <p>{copy.panelLabel as string}</p>
              </div>
              <div className={styles.outcomeList}>
                {(copy.outcomes as string[][]).map(([title, body], index) => (
                  <div className={styles.outcome} key={title}>
                    <span className={styles.outcomeNumber}>0{index + 1}</span>
                    <div>
                      <strong>{title}</strong>
                      <small>{body}</small>
                    </div>
                    <CheckIcon />
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className={styles.benefits}>
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>{copy.benefitEyebrow as string}</p>
            <h2>{copy.benefitTitle as string}</h2>
            <p>{copy.benefitBody as string}</p>
          </div>
          <div className={styles.benefitList}>
            {(
              copy.benefits as {
                number: string;
                title: string;
                body: string;
              }[]
            ).map((benefit) => (
              <article className={styles.benefit} key={benefit.number}>
                <span>{benefit.number}</span>
                <h3>{benefit.title}</h3>
                <p>{benefit.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.process}>
          <div className={styles.processHeader}>
            <p className={styles.eyebrow}>{copy.processEyebrow as string}</p>
            <h2>{copy.processTitle as string}</h2>
          </div>
          <ol className={styles.processList}>
            {(
              copy.process as {
                title: string;
                body: string;
              }[]
            ).map((step, index) => (
              <li key={step.title}>
                <div className={styles.stepMarker}>{index + 1}</div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.tracks} id="learning-tracks">
          <div className={styles.tracksHeader}>
            <div>
              <p className={styles.eyebrow}>{copy.tracksEyebrow as string}</p>
              <h2>{copy.tracksTitle as string}</h2>
            </div>
            <p>{copy.tracksBody as string}</p>
          </div>
          <div className={styles.trackList}>
            {(
              copy.tracks as {
                label: string;
                title: string;
                body: string;
              }[]
            ).map((track, index) => (
              <article className={styles.track} key={track.title}>
                <span className={styles.trackIndex}>0{index + 1}</span>
                <div>
                  <p className={styles.trackLabel}>{track.label}</p>
                  <h3>{track.title}</h3>
                  <p>{track.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.contact}>
          <div className={styles.contactInner}>
            <div>
              <p className={styles.eyebrow}>{copy.ctaEyebrow as string}</p>
              <h2>{copy.ctaTitle as string}</h2>
            </div>
            <div className={styles.contactAction}>
              <p>{copy.ctaBody as string}</p>
              <a href={contactHref} className={styles.contactButton}>
                {copy.ctaButton as string}
                <ArrowIcon />
              </a>
              <small>
                <CheckIcon />
                {copy.ctaNote as string}
              </small>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
