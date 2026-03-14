export interface Service {
  slug: string
  title: string
  category: 'nursing' | 'caretaker'
  icon: string
  image: string
  shortDesc: string
  description: string[]
  benefits: string[]
  whyUs: { title: string; text: string }[]
}

export const services: Service[] = [
  {
    slug: 'wound-care',
    title: 'Wound Care',
    category: 'nursing',
    icon: 'bandage',
    image: '/images/services/wound-care.jpg',
    shortDesc: 'Expert wound care and dressing services delivered safely in the comfort of your home.',
    description: [
      'At 99 Care, we understand that proper wound care is a critical component of recovery — especially for elderly patients and those managing long-term medical conditions. Untreated or poorly managed wounds can lead to serious infections, prolonged recovery times, and a significant decline in quality of life. That is why our skilled nursing team brings professional wound care directly to your doorstep.',
      'Our trained caregivers are equipped to handle a wide range of wound types including post-surgical wounds, diabetic ulcers, pressure sores, and injury-related lacerations. We follow strict clinical protocols for cleaning, dressing, and monitoring wounds to ensure the fastest and safest healing process possible — all without the need to travel to a clinic or hospital.',
      'We believe that healing happens best in a familiar, comfortable environment. By receiving wound care at home, patients experience less stress, lower risk of hospital-acquired infections, and the emotional comfort of being surrounded by loved ones. Our team provides not just physical care but also guidance to family members on how to support the healing process between visits.',
    ],
    benefits: [
      'Professional wound assessment and cleaning by trained nursing staff',
      'Sterile dressing and bandaging using medical-grade materials',
      'Infection prevention monitoring and early complication detection',
      'Regular progress tracking and documentation shared with your doctor',
      'Family education on wound care best practices between visits',
    ],
    whyUs: [
      {
        title: 'Clinically Trained Nurses',
        text: 'Our wound care specialists are trained in advanced clinical wound management protocols ensuring safe, effective treatment every visit.',
      },
      {
        title: 'Sterile Equipment at Home',
        text: 'We bring all necessary sterile supplies and medical-grade dressing materials to your home — no trip to a pharmacy needed.',
      },
      {
        title: '24/7 Follow-Up Support',
        text: 'Our team is available round the clock to answer questions, monitor recovery progress, and respond to any concerns between scheduled visits.',
      },
    ],
  },
  {
    slug: 'respiratory-care-at-home',
    title: 'Respiratory Care at Home',
    category: 'nursing',
    icon: 'wind',
    image: '/images/services/respiratory-care.jpg',
    shortDesc: 'Comprehensive respiratory support and monitoring for patients with chronic or acute breathing conditions.',
    description: [
      'Breathing is life — and maintaining good respiratory health is essential, particularly for individuals recovering from illness or managing chronic conditions such as asthma, COPD, or post-COVID complications. At 99 Care, we bring expert respiratory care directly to your home so that you or your loved ones never have to compromise on the quality of treatment received.',
      'Our respiratory care services include nebulization therapy, oxygen therapy support, chest physiotherapy, and continuous monitoring of respiratory vitals. Our caregivers are trained to operate and assist with home ventilators and oxygen concentrators, ensuring that patients with complex respiratory needs receive the same level of attention they would in a clinical setting — right in their own bedroom.',
      'Being at home during respiratory recovery significantly reduces the anxiety and discomfort associated with hospital environments. Patients breathe easier — both literally and figuratively — when they are in a calm, familiar space. Our nurses work closely with your pulmonologist or treating physician to follow prescribed care plans and keep all parties informed of your progress.',
    ],
    benefits: [
      'Nebulization and inhalation therapy administered by trained nurses',
      'Oxygen therapy setup, monitoring, and equipment support',
      'Chest physiotherapy to aid mucus clearance and lung function',
      'Continuous monitoring of SpO2, respiratory rate, and breathing patterns',
      'Coordination with your treating physician for ongoing care plan updates',
    ],
    whyUs: [
      {
        title: 'Specialized Respiratory Training',
        text: 'Our nurses receive specialized training in respiratory care procedures ensuring safe, precise administration of all therapies.',
      },
      {
        title: 'Equipment Support',
        text: 'We assist with the setup and operation of home oxygen concentrators, nebulizers, and other respiratory devices prescribed by your doctor.',
      },
      {
        title: 'Physician Coordination',
        text: 'We maintain close communication with your treating pulmonologist, sharing regular updates and adjusting care plans as your condition evolves.',
      },
    ],
  },
  {
    slug: 'injection-at-home',
    title: 'Injection at Home',
    category: 'nursing',
    icon: 'syringe',
    image: '/images/services/injection-at-home.jpg',
    shortDesc: 'Safe, professional injection services administered at home — no clinic visit required.',
    description: [
      'In today\'s fast-paced world, convenience and comfort are critical — especially when it comes to medical care. Whether you require daily insulin injections, vitamin B12 shots, antibiotic infusions, or other prescribed injectable medications, 99 Care brings safe and professional injection services right to your home. We understand the need for timely, accurate medication delivery without the hassle of repeated clinic visits.',
      'All injections are administered by qualified nurses following strict aseptic techniques to ensure patient safety. We handle intramuscular (IM), intravenous (IV), and subcutaneous injections as prescribed by your doctor. Our nurses verify prescriptions, prepare dosages accurately, and monitor patients for any post-injection reactions before concluding the visit.',
      'For patients who require daily or multiple injections — such as those on insulin therapy or recovering from infections requiring IV antibiotics — our home injection service provides a consistent, reliable, and stress-free alternative to frequent hospital or clinic visits. We help you stay on schedule with your treatment without disrupting your daily routine.',
    ],
    benefits: [
      'Intramuscular, intravenous, and subcutaneous injections by qualified nurses',
      'Strict aseptic technique to eliminate risk of infection',
      'Prescription verification before every injection for complete safety',
      'Post-injection monitoring for allergic reactions or adverse effects',
      'Flexible scheduling including early morning and late evening slots',
    ],
    whyUs: [
      {
        title: 'Qualified & Verified Nurses',
        text: 'Every nurse providing injection services is a licensed healthcare professional with background verification and clinical injection training.',
      },
      {
        title: 'Zero Compromise on Safety',
        text: 'We use single-use sterile needles and syringes for every visit. Strict aseptic protocols are followed without exception.',
      },
      {
        title: 'Flexible Scheduling',
        text: 'We schedule injection visits around your routine — early mornings, evenings, or any time of day that works best for you.',
      },
    ],
  },
  {
    slug: 'nursing-services-on-demand',
    title: 'Nursing Services On-Demand',
    category: 'nursing',
    icon: 'stethoscope',
    image: '/images/services/nursing-services.jpg',
    shortDesc: 'Professional, compassionate nursing care delivered to your home whenever you need it.',
    description: [
      'Patients can receive expert and compassionate care in the comfort of their own homes with 99 Care\'s on-demand professional nursing services. Our mission is to provide individualized care that is tailored to each patient\'s specific requirements, preserving their well-being, comfort, and dignity. Whether you need post-operative nursing, chronic illness management, palliative care, or general nursing support — we are just a call away.',
      'Our on-demand nursing team is equipped to handle a comprehensive range of medical needs including vital signs monitoring, catheter care, nasogastric tube management, medication administration, physiotherapy assistance, and more. Each nurse is assigned based on the specific clinical requirements of the patient, ensuring the right expertise is always at hand.',
      '99 Care guarantees excellent medical treatment and assistance at your door for any nursing need. Our nurses work with complete professionalism, empathy, and respect for patients and their families. We understand that inviting a caregiver into your home requires trust — and we work hard every day to earn and maintain that trust through consistent, high-quality care.',
    ],
    benefits: [
      'Post-operative care and surgical wound management at home',
      'Chronic illness monitoring for diabetes, hypertension, and heart conditions',
      'Catheter care, nasogastric tube management, and stoma care',
      'Medication administration and adherence monitoring',
      'Palliative and end-of-life comfort care with compassion',
    ],
    whyUs: [
      {
        title: 'Right Nurse for Every Need',
        text: 'We match each patient with a nurse whose skills and experience align with the specific medical condition being managed.',
      },
      {
        title: 'Comprehensive Clinical Coverage',
        text: 'From post-surgery recovery to chronic disease management, our nursing team covers the full spectrum of home-based clinical care.',
      },
      {
        title: 'Compassion at the Core',
        text: 'Our nurses are trained not just clinically but also in empathetic patient communication, ensuring every interaction is warm, respectful, and supportive.',
      },
    ],
  },
  {
    slug: 'maternity-care',
    title: 'Maternity Care',
    category: 'caretaker',
    icon: 'heart',
    image: '/images/services/maternity-care.jpg',
    shortDesc: 'Dedicated post-natal and maternity care for new mothers in the comfort of home.',
    description: [
      'The arrival of a new baby is one of the most beautiful and transformative experiences in life — but it also comes with its own set of physical and emotional demands for the new mother. At 99 Care, we offer dedicated maternity caretaker services designed to support mothers through the post-natal period with professional care, warmth, and expertise delivered right at home.',
      'Our maternity caretakers assist with post-delivery recovery, helping new mothers with personal hygiene, dietary support, breastfeeding guidance, and rest management. We also assist with basic newborn care coordination so that the mother can focus on bonding and healing without being overwhelmed. Our caretakers are trained to identify signs of post-partum complications and escalate promptly when needed.',
      'Every new mother deserves dedicated attention and care during this delicate period. Our team brings professional support without intruding on the intimate family experience of welcoming a new child. We work around your preferences, routines, and family dynamics to provide care that truly feels like an extension of your family.',
    ],
    benefits: [
      'Post-delivery physical recovery support and personal hygiene assistance',
      'Dietary and nutritional guidance tailored for nursing mothers',
      'Breastfeeding support and lactation guidance',
      'Basic newborn care coordination and mother-baby routine management',
      'Monitoring for post-partum complications with prompt escalation',
    ],
    whyUs: [
      {
        title: 'Experienced Maternity Caretakers',
        text: 'Our caretakers have hands-on experience supporting new mothers through post-natal recovery, ensuring professional care at every step.',
      },
      {
        title: 'Mother-Centered Approach',
        text: 'We design our care schedules around the mother\'s comfort, preferences, and family routines — making the transition to parenthood smoother.',
      },
      {
        title: 'Holistic Support',
        text: 'Beyond physical care, we provide emotional reassurance and practical guidance that helps new mothers feel confident and supported.',
      },
    ],
  },
  {
    slug: 'new-born-baby-care',
    title: 'New Born Baby Care',
    category: 'caretaker',
    icon: 'baby',
    image: '/images/services/new-born-baby-care.jpg',
    shortDesc: 'Gentle, expert newborn care at home — giving your baby the best start in life.',
    description: [
      'A newborn baby requires round-the-clock attention, delicate handling, and expert care during the most vulnerable weeks of their life. At 99 Care, our trained newborn caretakers bring professional baby care expertise directly to your home, allowing parents to rest, recover, and bond with their baby while knowing that their little one is in safe, capable hands.',
      'Our newborn care services cover feeding support, diapering, bathing, sleep routine establishment, umbilical cord care, and skin care for sensitive newborn skin. Our caretakers are also trained to monitor newborns for signs of jaundice, feeding difficulties, weight loss, or other early health concerns that warrant medical attention.',
      'We understand that every baby is unique and every family has its own preferences and routines. Our caretakers adapt to your parenting style and family environment, providing support that complements rather than overrides your instincts as a parent. Whether you need full-day support, night care only, or flexible hourly help — we are here for you.',
    ],
    benefits: [
      'Newborn bathing, diapering, and skin care by trained caregivers',
      'Feeding assistance — bottle preparation, breastfeeding support, and burping',
      'Sleep routine establishment and safe sleep environment guidance',
      'Umbilical cord care and early health monitoring for jaundice and weight',
      'Night care available so parents can rest and recover fully',
    ],
    whyUs: [
      {
        title: 'Trained Newborn Specialists',
        text: 'Our baby caretakers receive specific training in newborn handling, hygiene, and health monitoring to keep your baby safe at all times.',
      },
      {
        title: 'Gentle & Patient Care',
        text: 'Newborns require extraordinary patience and gentleness. Our caretakers are selected for their calm temperament and genuine love for infant care.',
      },
      {
        title: 'Flexible Scheduling',
        text: 'From full-day support to overnight care, we offer scheduling options that match your family\'s specific needs and routines.',
      },
    ],
  },
  {
    slug: 'old-age-person-care',
    title: 'Old Age Person Care',
    category: 'caretaker',
    icon: 'user',
    image: '/images/services/old-age-person-care.jpg',
    shortDesc: 'Compassionate elderly care at home — dignity, comfort, and support for your loved ones.',
    description: [
      'As our loved ones age, they deserve the highest quality of care, attention, and dignity in the comfort of their own homes. At 99 Care, our elderly care services are designed to support senior citizens with their daily activities, medical needs, emotional well-being, and social engagement — all while preserving their independence and sense of self.',
      'Our elderly caretakers assist with activities of daily living including bathing, grooming, dressing, meal preparation, medication reminders, and mobility support. For seniors with conditions such as dementia, Parkinson\'s disease, or post-stroke mobility issues, we provide specialized care plans developed in coordination with the family and treating physician to ensure safety and comfort at all times.',
      'Loneliness and social isolation are among the greatest challenges faced by elderly individuals living at home. Our caretakers are trained not just in physical assistance but in companionship — engaging seniors in meaningful conversation, light activities, and emotional support that makes a profound difference in their quality of life. We treat every elderly patient with patience, warmth, and deep respect.',
    ],
    benefits: [
      'Assistance with bathing, grooming, dressing, and personal hygiene',
      'Meal preparation, feeding assistance, and nutrition monitoring',
      'Medication reminders and adherence support',
      'Mobility assistance, fall prevention, and safe environment management',
      'Companionship, emotional support, and social engagement activities',
    ],
    whyUs: [
      {
        title: 'Dignity-First Philosophy',
        text: 'We train all our elderly caretakers to prioritize the dignity, privacy, and independence of every senior in our care — always.',
      },
      {
        title: 'Specialized Condition Care',
        text: 'Our caretakers are trained to handle dementia, Parkinson\'s, post-stroke care, and other age-related conditions with expertise and empathy.',
      },
      {
        title: 'Family Communication',
        text: 'We keep families regularly updated on their loved one\'s condition, mood, and care progress so you always feel connected and informed.',
      },
    ],
  },
]

export const getNursingServices = () => services.filter(s => s.category === 'nursing')
export const getCaretakerServices = () => services.filter(s => s.category === 'caretaker')
export const getServiceBySlug = (slug: string) => services.find(s => s.slug === slug)
