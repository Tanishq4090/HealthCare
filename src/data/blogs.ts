export interface BlogPost {
  slug: string
  title: string
  date: string
  author: string
  readTime: string
  excerpt: string
  tags: string[]
  relatedSlugs: string[]
  image: string
  content: { heading?: string; paragraph: string }[]
}

export const blogs: BlogPost[] = [
  {
    slug: 'advantages-of-home-health-care',
    title: 'Knowing the Advantages of Home Health Care',
    date: 'January 15, 2024',
    author: '99 Care Team',
    readTime: '4 min read',
    image: '/images/blog/advantages-home-care.jpg',
    excerpt:
      'Home health care is becoming a more and more popular choice for patients and families across India. Here is why it may be the best option for you and your loved ones.',
    tags: ['Home Care', 'Health Tips', 'Senior Care'],
    relatedSlugs: ['home-health-care-tips-for-seniors', 'reliable-home-health-care-99-care'],
    content: [
      {
        paragraph:
          'Home health care is rapidly becoming one of the most preferred models of patient care in India — and for very good reason. As healthcare costs rise and hospital environments become increasingly overwhelming, more and more families are turning to professional home-based care as a smarter, more compassionate alternative. Whether for post-surgery recovery, chronic illness management, or elderly care, the benefits of receiving medical attention at home are both profound and well-documented.',
      },
      {
        heading: 'Comfort Accelerates Recovery',
        paragraph:
          'Medical research consistently shows that patients recover faster when they are in familiar, comfortable surroundings. The stress and anxiety associated with hospital stays — the unfamiliar sounds, the constant interruptions, the lack of privacy — can actually slow the healing process. At home, patients sleep better, eat better, and feel emotionally supported by the presence of loved ones. This psychological comfort translates directly into faster physical recovery.',
      },
      {
        heading: 'Reduced Risk of Hospital-Acquired Infections',
        paragraph:
          'Hospitals, despite their best efforts, are environments where bacteria and viruses are in constant circulation. Patients recovering from surgery or illness are particularly vulnerable to hospital-acquired infections (HAIs) that can significantly set back their recovery. Home-based care virtually eliminates this risk. The patient recovers in a clean, personal environment without exposure to the pathogens that circulate in clinical settings.',
      },
      {
        heading: 'Personalised, One-on-One Attention',
        paragraph:
          'In a hospital, one nurse may be responsible for six, eight, or even twelve patients simultaneously. At home, the caregiver or nurse is entirely focused on your loved one. This one-on-one attention means that changes in the patient\'s condition are noticed sooner, medications are administered on time, and care is truly tailored to the individual rather than being standardized for the general ward population.',
      },
      {
        heading: 'Cost-Effective Without Compromising Quality',
        paragraph:
          'A prolonged hospital stay is enormously expensive — room charges, nursing charges, food, and a dozen other fees add up rapidly. Home health care delivers the same clinical quality at a fraction of the cost. For families managing chronic conditions that require ongoing medical support, home care is not just more comfortable — it is significantly more affordable over the long term.',
      },
      {
        paragraph:
          'At 99 Care, we have seen firsthand how home healthcare transforms the recovery experience for our patients in Surat and the surrounding areas. If you are considering home-based care for yourself or a loved one, we invite you to speak with our team. We are here to help you make the best decision for your family\'s health and well-being.',
      },
    ],
  },
  {
    slug: 'reliable-home-health-care-99-care',
    title: "Reliable Home Health Care by 99 Care: Why It's the Best Choice for Your Loved Ones",
    date: 'June 10, 2025',
    author: '99 Care Team',
    readTime: '5 min read',
    image: '/images/blog/reliable-care.png',
    excerpt:
      'Discover why families across Surat trust 99 Care for professional, compassionate home healthcare. From verified nurses to 24/7 support — here is what sets us apart.',
    tags: ['99 Care', 'Home Care', 'Surat Healthcare'],
    relatedSlugs: ['advantages-of-home-health-care', 'home-health-care-tips-for-seniors'],
    content: [
      {
        paragraph:
          'Choosing a home healthcare provider is one of the most important decisions a family can make. You are not just selecting a service — you are inviting someone into your home, into your most private and intimate space, and trusting them with the health and well-being of the person you love most. At 99 Care, we understand the weight of that trust, and we have built every aspect of our service around earning and protecting it.',
      },
      {
        heading: 'Background-Verified Caregivers',
        paragraph:
          'Every single caregiver and nurse at 99 Care undergoes a thorough background verification process before they ever step into a patient\'s home. We check identity documents, previous employment history, and conduct reference verification. This is not optional — it is a non-negotiable standard we have set for ourselves because we believe your family deserves nothing less than complete confidence in the people caring for them.',
      },
      {
        heading: 'Trained and Regularly Oriented Staff',
        paragraph:
          'Healthcare is not static — best practices evolve, new techniques emerge, and patient needs are always changing. That is why 99 Care invests in regular training and orientation sessions for all our caregivers. Whether it is updated wound care protocols, new respiratory therapy guidelines, or improved communication techniques for elderly patients with cognitive decline — our team stays current so our patients receive the best possible care.',
      },
      {
        heading: '24/7 Phone Support — Always There When You Need Us',
        paragraph:
          'Medical situations do not follow a 9-to-5 schedule. A wound might look concerning at midnight. A patient might have an unexpected reaction to medication on a Sunday morning. A new mother might have urgent breastfeeding questions at 3 AM. At 99 Care, our support line is available 24 hours a day, 7 days a week — because we believe that accessible support is not a luxury, it is a fundamental part of responsible healthcare.',
      },
      {
        heading: 'A Vast Network Built on Experience',
        paragraph:
          'Over three years of operation in Surat, we have built a deep network of experienced healthcare professionals, medical supply partners, and clinical consultants. This network means that when your loved one needs specialized care — whether it is a particular type of wound dressing, a specific physiotherapy technique, or a referral to a specialist — we have the connections to make it happen quickly and efficiently.',
      },
      {
        paragraph:
          'When you choose 99 Care, you are choosing a team that genuinely cares about outcomes — not just for your loved one\'s physical health but for the peace of mind and well-being of your entire family. We are proud to be Surat\'s trusted home healthcare partner, and we look forward to serving you.',
      },
    ],
  },
  {
    slug: 'get-house-ready-for-baby',
    title: 'How to Get Your House Ready for a Baby: Crucial Advice for Expectant Parents',
    date: 'July 20, 2024',
    author: '99 Care Team',
    readTime: '6 min read',
    image: '/images/blog/ready-for-baby.png',
    excerpt:
      'A newborn\'s arrival is thrilling and transformative. Here is how to fully prepare your home to ensure a safe, warm, and nurturing environment for your new baby.',
    tags: ['Maternity', 'Newborn Care', 'Parenting Tips'],
    relatedSlugs: ['advantages-of-home-health-care', 'reliable-home-health-care-99-care'],
    content: [
      {
        paragraph:
          'A newborn\'s arrival into your home is one of the most thrilling and transformative occasions in any parent\'s life. But alongside the excitement comes a very real responsibility — ensuring that your home is genuinely safe, comfortable, and ready to welcome its newest and most vulnerable member. The good news is that preparing your home for a baby does not have to be overwhelming. With the right guidance and a systematic approach, you can create a perfect environment for your little one.',
      },
      {
        heading: 'Set Up the Nursery Early',
        paragraph:
          'Ideally, the nursery should be ready at least four to six weeks before your due date. Choose a room that is well-ventilated, away from direct sunlight, and reasonably close to the master bedroom for easy night-time access. Invest in a firm, well-fitted crib mattress — soft surfaces increase the risk of suffocation for newborns. Keep the crib clear of pillows, loose blankets, and stuffed animals until the baby is older. A room temperature between 20–22°C is ideal for newborns.',
      },
      {
        heading: 'Babyproof Before You Think You Need To',
        paragraph:
          'Many parents wait until the baby starts crawling to babyproof — but it is much easier (and less stressful) to do it before the baby arrives. Cover all electrical outlets, secure heavy furniture to walls, and remove any small objects that could be choking hazards. Install safety gates for staircases if your home has multiple floors. Lock away cleaning products, medications, and any toxic substances in high or locked cabinets.',
      },
      {
        heading: 'Stock Up on Essentials',
        paragraph:
          'Before the baby arrives, make sure you have the basics ready: diapers in newborn and size 1, baby wipes (unscented), baby-safe laundry detergent, muslin swaddle cloths, feeding bottles (even if you plan to breastfeed — circumstances can change), and a nasal aspirator. Having a well-stocked first aid kit with a baby thermometer, saline drops, and infant-safe pain relief (as recommended by your pediatrician) is also essential.',
      },
      {
        heading: 'Prepare for Post-Delivery Recovery',
        paragraph:
          'This is something many expectant parents overlook — but the mother\'s recovery space is just as important as the baby\'s nursery. Create a comfortable nursing corner with a supportive chair, a side table for water and snacks, and easy access to burp cloths and extra clothes. If you are planning to have a home caretaker from 99 Care during the post-natal period, communicate their role to all family members in advance so everyone works together seamlessly.',
      },
      {
        heading: 'Build Your Support System',
        paragraph:
          'No parent is meant to do this alone. Before the baby arrives, identify your support network — family members who can help, a trusted pediatrician, and professional caretaker support if needed. At 99 Care, our newborn care and maternity care services are designed to give new parents the professional backup they need during the first critical weeks, so you can focus on bonding with your baby while we handle the rest.',
      },
      {
        paragraph:
          'The most important thing to remember is that no home is ever perfectly ready — and that is completely normal. What matters most is love, attentiveness, and the willingness to ask for help when you need it. Congratulations on your upcoming arrival, and know that the 99 Care team is here to support you every step of the way.',
      },
    ],
  },
  {
    slug: 'home-health-care-tips-for-seniors',
    title: 'Top 5 Tips for Effective Home Health Care for Seniors',
    date: 'January 28, 2024',
    author: '99 Care Team',
    readTime: '3 min read',
    image: '/images/blog/advantages-home-care.jpg',
    excerpt:
      'As our loved ones age, ensuring they receive the right care at home becomes essential. These five practical tips will help you provide effective, dignified care for elderly family members.',
    tags: ['Senior Care', 'Elderly', 'Home Care Tips'],
    relatedSlugs: ['advantages-of-home-health-care', 'reliable-home-health-care-99-care'],
    content: [
      {
        paragraph:
          'As our loved ones grow older, the quality of care they receive at home becomes one of the most important factors in determining their health outcomes, happiness, and overall quality of life. Family caregiving is deeply meaningful — but it also comes with real challenges. Whether you are caring for an elderly parent yourself or managing professional caretaker support, these five tips will help you provide effective, compassionate care that truly makes a difference.',
      },
      {
        heading: '1. Create a Safe Home Environment',
        paragraph:
          'Falls are the leading cause of injury among elderly individuals, and the majority of falls happen at home. Conduct a thorough safety audit of your home: remove loose rugs and clutter from walkways, install grab bars in bathrooms, ensure adequate lighting in all rooms (especially corridors and staircases), and consider a shower chair or non-slip bath mat. A safe environment is the foundation of effective elderly care.',
      },
      {
        heading: '2. Establish a Consistent Routine',
        paragraph:
          'Elderly individuals — particularly those with dementia or cognitive decline — thrive on routine and predictability. Consistent meal times, medication schedules, sleep routines, and activity patterns reduce confusion, lower anxiety, and improve cooperation with care. Work with your caretaker or nursing team to develop a daily schedule and stick to it as closely as possible.',
      },
      {
        heading: '3. Monitor Medications Carefully',
        paragraph:
          'Many elderly patients are on multiple medications simultaneously, and medication errors are surprisingly common in home settings. Use a pill organizer, set daily alarms as reminders, and keep an updated list of all medications (including dosages and timing) in a visible, accessible location. Inform all caregivers of the full medication list and watch for side effects or unusual symptoms that might indicate a drug interaction.',
      },
      {
        heading: '4. Prioritise Emotional Well-Being',
        paragraph:
          'Physical health is only one dimension of elderly care. Loneliness and depression are epidemic among seniors living at home, and their impact on physical health is profound. Make time for genuine conversation, encourage participation in activities the senior enjoys, facilitate regular contact with friends and family, and — if professional caretakers are involved — choose ones who engage warmly and patiently rather than simply completing physical tasks mechanically.',
      },
      {
        heading: '5. Partner with Professional Home Healthcare',
        paragraph:
          'Family love is irreplaceable — but professional expertise makes a critical difference in health outcomes. For complex medical needs like wound care, medication management, physiotherapy, or nursing support, partnering with a trusted home healthcare provider like 99 Care ensures your loved one receives clinical-grade care without the disruption and stress of frequent hospital visits. Our team works alongside families to provide seamless, comprehensive support that keeps seniors healthy, comfortable, and dignified at home.',
      },
      {
        paragraph:
          'Caring for an elderly loved one is one of the most profound acts of love a family can undertake. With the right environment, routines, and professional support, home-based senior care can be a deeply rewarding experience for everyone involved. If you would like to learn more about how 99 Care can support your family, do not hesitate to reach out to us.',
      },
    ],
  },
]

export const getBlogBySlug = (slug: string) => blogs.find(b => b.slug === slug)
export const getRelatedBlogs = (slugs: string[]) => blogs.filter(b => slugs.includes(b.slug))
export const getLatestBlogs = (count: number = 4) => blogs.slice(0, count)
