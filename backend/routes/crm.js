import express from "express";

const router = express.Router();
console.log("[CRM] Routes module loaded");

// Mock DB for CRM Configuration (Static for now)
const crmConfig = {
  serviceCategories: [
    {
      id: "baby_care",
      name: "Baby Care",
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
      id: "old_age_care",
      name: "Old Age Care",
      questions: [
        "Patient Name",
        "City",
        "Area",
        "Service for whom?",
        "Relation with patient",
        "Gender (Male/Female)",
        "Age & Weight",
        "Condition/Disease details",
        "Service type (Day/Night/24h)",
        "Work details",
        "Language preferred",
        "Age of staff needed",
        "Start date",
        "Special requirements"
      ]
    },
    {
      id: "nursing_care",
      name: "Nursing Care",
      questions: [
        "Patient Name",
        "City",
        "Area",
        "Service for whom?",
        "Relation",
        "Gender (Male/Female)",
        "Age & Weight",
        "Condition details",
        "Service type (Day/Night/24h)",
        "Staff type (Proper Nursing / Caretaker / Both)",
        "Language preferred",
        "Age of staff needed",
        "Start date",
        "Special requirements"
      ]
    },
    {
      id: "japa_care",
      name: "Japa Care",
      questions: [
        "Name",
        "City",
        "Area",
        "Service for whom?",
        "Relation",
        "Only Baby or Mother+Baby?",
        "Single or Twins?",
        "Delivery done or pending?",
        "Duration needed (Days/Months)",
        "Service type (Day/Night/24h)",
        "Work details",
        "Language preferred",
        "Age of staff needed",
        "Start date",
        "Special requirements"
      ]
    },
    {
      id: "physiotherapy",
      name: "Physiotherapy",
      questions: [
        "Name",
        "City",
        "Area",
        "Service for whom?",
        "Relation",
        "Gender (Male/Female)",
        "Age & Weight",
        "Condition details",
        "Preferred timing for physio",
        "Start date",
        "Special requirements"
      ]
    },
    {
      id: "on_call_nursing",
      name: "On Call Nursing",
      questions: [
        "Name",
        "City",
        "Area",
        "Service for whom?",
        "Relation",
        "Gender (Male/Female)",
        "Injection type?",
        "Doctor consultation file available?",
        "Photo of injection/file",
        "Start date",
        "Duration needed (Days)",
        "Frequency (1x/2x per day)",
        "Timing (Morning/Afternoon/Night)",
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
