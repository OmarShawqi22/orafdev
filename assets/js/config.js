/*
  ORAFDEV site configuration.
  Everything here is real-world information only the founders can supply.
  Empty values are hidden or shown as "coming soon" on the site, so nothing fake is ever published.
*/
window.ORAFDEV = {
  contact: {
    // Digits only, with country code, e.g. "201234567890"
    whatsapp: "601162256809",
    email: "contact@orafdev.tech",
    // Full profile links. Any channel left empty stays hidden on the site.
    instagram: "https://www.instagram.com/orafdev/",
    facebook: "https://www.facebook.com/profile.php?id=61559037788520",
    linkedin: "https://www.linkedin.com/company/orafdev/",
    github: "",
  },

  // Optional: a form service URL (e.g. Formspree) that accepts POSTed JSON.
  // If empty, the form opens WhatsApp (or email) with the request pre-written.
  formEndpoint: "",

  whatsappMessage: "Hi Orafdev, I'm interested in discussing a web development project.",

  // Live / source links per project. Empty live → the button is hidden. Empty source → no button.
  // tech: only list technologies you have verified, e.g. ["Next.js", "Node.js"]. Empty → line hidden.
  projects: {
    "car-rental": { live: "https://car-web-sandy.vercel.app", source: "", tech: ["Next.js", "Supabase"] },
    "aiu-shop": { live: "https://www.aiushop.net", source: "", tech: [] },
    "attoor": { live: "https://alttor.com/", source: "", tech: ["React", "Vite"] },
    "deep-focus": { live: "", source: "", tech: [] },
    "israf-guard": { live: "https://omarshawqi7722.github.io/isrraaff/", source: "", tech: [] },
    "ozo-store":  { live: "https://ozostore.odoo.com/", source: "", tech: [] },
    "ats-matching": { live: "", source: "", tech: [] },
  },

  /*
    Real client feedback only, word for word in Arabic, with an English translation.
    A review shows only when it has "link" (the live project) and "shot" (a real capture of it, 1120 x 1960, per
    language); the others wait here. Never add feedback from our own team. score: only when the client gave one.
  */
  testimonials: [
    {
      link: "https://alttor.com/", case: "work/attoor.html", tint: "232, 170, 40",
      shot: { en: "assets/img/review-alttor-en.webp", ar: "assets/img/review-alttor-ar.webp" },
      ar: { name: "محمد علي", who: "الطور للهندسة والإنشاءات", project: "موقع الشركة بالعربية والإنجليزية", quote: "بصراحة كانت تجربة ممتازة، وسرعة التنفيذ فاقت توقعاتي، والموقع طلع بشكل احترافي ومميز. أعجبني اهتمامكم بالتفاصيل وسلاسة التواصل معكم. يعطيكم ألف عافية، ومشكورين على جهودكم وإبداعكم، تستاهلون كل خير." },
      en: { name: "Mohammed Ali", who: "Alttor.CEGS", project: "Company website in English and Arabic", quote: "Honestly, it was an excellent experience. Delivery was faster than I expected, and the website came out professional and distinctive. I liked your attention to detail and how smooth it was to communicate with you. Thank you for your effort and creativity. You deserve the best." },
    },
    {
      score: "10/10",
      ar: { name: "عدي", who: "موقع شخصي (بورتفوليو)", quote: "أشكركم على جهودكم واهتمامكم. أعطي تجربتي مع فريق ORAFDEV تقييم 10/10، كان التعامل احترافيًا والنتيجة رائعة. البورتفوليو سيساعدني بالتأكيد في إبراز مهاراتي ومشاريعي بشكل أفضل." },
      en: { name: "Odai", who: "Portfolio website", quote: "Thank you for your effort and care. I rate my experience with the ORAFDEV team 10/10. They were professional to deal with, and the result was wonderful. The portfolio will definitely help me show my skills and projects better." },
    },
    {
      ar: { name: "سلمان أحمد", who: "موقع شخصي (بورتفوليو)", quote: "والله شغلكم فخم جدًا، ما شاء الله عليكم، والنتيجة طلعت أجمل مما توقعت. يعطيكم ألف عافية، ومشكورين على إبداعكم واحترافيتكم، ومنها للأعلى يا رب." },
      en: { name: "Salman Ahmed", who: "Portfolio website", quote: "Your work is truly premium, mashallah, and the result came out even more beautiful than I expected. Thank you for your creativity and professionalism. Onward and upward, God willing." },
    },
    {
      ar: { name: "راشد", who: "موقع شخصي (بورتفوليو)", quote: "ما قصّرتوا أبد، شغل يبيض الوجه واحترافية في كل التفاصيل. سعيد جدًا بتعاملي معكم، ويعطيكم ألف عافية على هالإبداع. تستاهلون كل خير!" },
      en: { name: "Rashid", who: "Portfolio website", quote: "You held nothing back. This is work to be proud of, professional in every detail. I'm really happy I worked with you, and thank you for this creativity. You deserve the best!" },
    },
  ],
};
