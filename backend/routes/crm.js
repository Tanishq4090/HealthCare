import express from "express";

const router = express.Router();
console.log("[CRM] Routes module loaded");

// Mock DB for CRM Configuration (Static for now)
const crmConfig = {
  serviceCategories: [
    {
      id: "nursing_care",
      name: "Nursing Care",
      questions: [
        "Patient Name",
        "City",
        "Area in Surat",
        "Service for whom?",
        "Relation with patient",
        "Gender (Male/Female)",
        "Age & Weight",
        "Condition/Disease details",
        "Service type (Day/Night/24h)",
        "Staff type (Proper Nursing / Caretaker / Both)",
        "Language preferred (Gujarati/Hindi/Marathi/English)",
        "Age of staff needed",
        "Start date",
        "Special requirements"
      ]
    },
    {
      id: "maternity_care",
      name: "Maternity Care",
      questions: [
        "Patient Name (Mother's name)",
        "City",
        "Area in Surat",
        "Expected delivery date or delivery done?",
        "Single or Twins?",
        "Any medical complications?",
        "Service type (Day/Night/24h)",
        "Work details for mother",
        "Language preferred (Gujarati/Hindi/Marathi/English)",
        "Age of caretaker needed",
        "Start date",
        "Special requirements"
      ]
    },
    {
      id: "new_born_baby_care",
      name: "New Born Baby Care",
      questions: [
        "Patient Name (Maa ka naam)",
        "City",
        "Area in Surat",
        "Single or Twins?",
        "Age of baby",
        "Any medical problems?",
        "Service type (Day/Night/24h)",
        "Work details for baby",
        "Language preferred (Gujarati/Hindi/Marathi/English)",
        "Age of baby sitter needed",
        "Start date",
        "Special requirements"
      ]
    },
    {
      id: "baby_care",
      name: "Baby Care",
      questions: [
        "Patient Name (Child's name)",
        "City",
        "Area in Surat",
        "Single or Twins?",
        "Age of baby",
        "Any medical problems?",
        "Service type (Day/Night/24h)",
        "Work details for baby",
        "Language preferred (Gujarati/Hindi/Marathi/English)",
        "Age of baby sitter needed",
        "Start date",
        "Special requirements"
      ]
    },
    {
      id: "japa_care",
      name: "Japa Care (Post-Delivery)",
      questions: [
        "Name",
        "City",
        "Area in Surat",
        "Service for whom?",
        "Relation",
        "Only Baby or Mother+Baby?",
        "Single or Twins?",
        "Delivery done or pending?",
        "Duration needed (Days/Months)",
        "Service type (Day/Night/24h)",
        "Work details",
        "Language preferred (Gujarati/Hindi/Marathi/English)",
        "Age of staff needed",
        "Start date",
        "Special requirements"
      ]
    },
    {
      id: "old_age_care",
      name: "Old Age Care",
      questions: [
        "Patient Name",
        "City",
        "Area in Surat",
        "Service for whom?",
        "Relation with patient",
        "Gender (Male/Female)",
        "Age & Weight",
        "Condition/Disease details",
        "Service type (Day/Night/24h)",
        "Work details",
        "Language preferred (Gujarati/Hindi/Marathi/English)",
        "Age of staff needed",
        "Start date",
        "Special requirements"
      ]
    }
  ],
  companyIntro: {
    gujarati: "99 કેર હેલ્પીંગ હેન્ડ છેલ્લા પાંચ વર્ષથી સુરતમાં કામ કરી રહી છે...",
    hindi: "99 केयर हेल्पिंग हैंड पिछले पांच वर्षों से सूरत में काम कर रहा है...",
    english: "99 Care Helping Hand has been working in Surat for the last five years..."
  },
  faqs: [
    { q: "What is your leave policy?", a: "If a caregiver takes 1 day leave, no replacement is provided. For >1 day, we arrange replacement." },
    { q: "What is the deposit amount?", a: "A security deposit of ₹15,000 is required before service starts." },
    { q: "How are bills calculated?", a: "Monthly bills are generated on the 1st. Rate is ₹850/day for full month, ₹1050/day for incomplete month." }
  ]
};

router.get("/config", (req, res) => {
  res.json(crmConfig);
});

export default router;
