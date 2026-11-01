// 4. CATEGORY DATA STRUCTURE
const cardDeck = {
  cat1: {
    name: "Values, Logik & Philosophy",
    tierMin: "free",
    questions: [
      {
        id: "cat1_q1",
        question: "What is your absolute non-negotiable rule when dealing with people?",
        options: [
          "A) Absolute honesty, even when it stings.",
          "B) Loyalty above everything else.",
          "C) Respect my boundaries or get out.",
          "D) Keep your word or don't speak."
        ]
      },
      {
        id: "cat1_q2",
        question: "How do you decide if a major life decision is actually the right move?",
        options: [
          "A) Gut instinct—if it feels right, I jump.",
          "B) Endless spreadsheets and pros-and-cons lists.",
          "C) Asking my inner circle what they think.",
          "D) Flipping a coin and trusting fate."
        ]
      },
      {
        id: "cat1_q3",
        question: "What is a core belief you held five years ago that you completely abandoned?",
        options: [
          "A) That working endless hours equals success.",
          "B) That everyone has good intentions if you give them a chance.",
          "C) That I needed to please everyone to be liked.",
          "D) That life follows a neat, predictable timeline."
        ]
      },
      {
        id: "cat1_q4",
        question: "When faced with a moral grey area, what internal compass guides your choice?",
        options: [
          "A) Whatever causes the least amount of drama.",
          "B) Strict personal code of ethics, no exceptions.",
          "C) Doing what benefits my immediate circle.",
          "D) Whatever helps me sleep at night."
        ]
      },
      {
        id: "cat1_q5",
        question: "Does the concept of destiny comfort you, or do you believe we are entirely winging it?",
        options: [
          "A) Complete chaos; we are totally winging it.",
          "B) Everything happens for a specific reason.",
          "C) We build our own luck through pure grit.",
          "D) A mix of fate and stubborn willpower."
        ]
      },
      {
        id: "cat1_q6",
        question: "What does true integrity look like when nobody is watching you?",
        options: [
          "A) Doing the right thing even if it costs me.",
          "B) Holding myself to the same standards in private.",
          "C) Not cutting corners when nobody will ever know.",
          "D) Being honest with myself in the mirror."
        ]
      },
      {
        id: "cat1_q7",
        question: "How do you handle discovering that someone you respect holds completely opposing values?",
        options: [
          "A) Cut them off immediately; incompatibility is real.",
          "B) Debate them fiercely just for fun.",
          "C) Respect their perspective as long as they aren't toxic.",
          "D) Avoid talking about politics or values forever."
        ]
      },
      {
        id: "cat1_q8",
        question: "What is a philosophical truth about human nature that took you too long to learn?",
        options: [
          "A) Most people are just figuring it out as they go.",
          "B) Self-preservation always wins over idealism.",
          "C) People only change when pain forces them to.",
          "D) Kindness is rare and valuable."
        ]
      },
      {
        id: "cat1_q9",
        question: "How much weight do you put on tradition versus carving out your own path?",
        options: [
          "A) Tradition is just peer pressure from dead people.",
          "B) Traditions keep society anchored and stable.",
          "C) Take the best parts of tradition and invent the rest.",
          "D) Total reinvention every single time."
        ]
      },
      {
        id: "cat1_q10",
        question: "What is your definition of a truly successful life when all the noise is stripped away?",
        options: [
          "A) Peace of mind and zero daily anxiety.",
          "B) Freedom to do whatever I want, whenever I want.",
          "C) Surrounding myself with people I actually love.",
          "D) Leaving something meaningful behind."
        ]
      }
    ]
  },
  cat2: {
    name: "Social Dynamics & Friendships",
    tierMin: "free",
    questions: []
  }
};
// Adding Category 2 to our cardDeck structure in cards.js
cardDeck.cat2 = {
  name: "Social Dynamics & Friendships",
  tierMin: "free",
  questions: [
    {
      id: "cat2_q21",
      question: "What is your absolute limit for dealing with flaky friends?",
      options: [
        "A) One strike and you're on probation.",
        "B) I'm the flaky friend, so I can't judge.",
        "C) Three chances before I stop inviting you.",
        "D) I match energy—if you flake, I stop trying."
      ]
    },
    {
      id: "cat2_q22",
      question: "How do you handle a friend who only calls when they need to vent?",
      options: [
        "A) I set firm boundaries and listen on my terms.",
        "B) I lovingly roast them until they change the subject.",
        "C) I screen their calls until I have the energy.",
        "D) I'm the unofficial therapist friend, so I accept my fate."
      ]
    },
    {
      id: "cat2_q23",
      question: "What is your social battery capacity on a normal weekend?",
      options: [
        "A) One social event per week max, then leave me alone.",
        "B) Ready for anything from Friday night to Sunday night.",
        "C) I go out, but I need three business days to recover.",
        "D) Pure introvert hiding in my designated comfort zone."
      ]
    },
    {
      id: "cat2_q24",
      question: "How do you feel about group chats with more than 50 unread messages?",
      options: [
        "A) Instant mute and archive forever.",
        "B) I scroll up to read every single word like a gossip hound.",
        "C) I drop one random GIF and peace out.",
        "D) I leave the chat without warning."
      ]
    },
    {
      id: "cat2_q25",
      question: "What is your ultimate litmus test for knowing someone is a real, ride-or-die friend?",
      options: [
        "A) They show up when my life is an absolute disaster.",
        "B) We can sit in total silence without it being weird.",
        "C) They tell me when I'm being an idiot.",
        "D) They help me move heavy furniture without complaining."
      ]
    },
    {
      id: "cat2_q26",
      question: "How do you handle unsolicited drama between mutual friends?",
      options: [
        "A) Switzerland. I am completely neutral and deaf.",
        "B) I pull up with popcorn to watch the chaos.",
        "C) I try to mediate and make peace.",
        "D) I avoid everyone involved until it blows over."
      ]
    },
    {
      id: "cat2_q27",
      question: "What is your biggest pet peeve in a casual group hangout?",
      options: [
        "A) People staring at their phones the entire time.",
        "B) Endless indecision about where we're eating.",
        "C) Someone dominating every conversation.",
        "D) Chronic lateness without a heads-up."
      ]
    },
    {
      id: "cat2_q28",
      question: "How easy is it for you to cut toxic people out of your life?",
      options: [
        "A) Snip snip, you don't exist anymore.",
        "B) Painful, but necessary for survival.",
        "C) I give way too many second chances first.",
        "D) I let the friendship fade out slowly over time."
      ]
    },
    {
      id: "cat2_q29",
      question: "What role do you naturally play in a group of friends?",
      options: [
        "A) The chaotic instigator of bad ideas.",
        "B) The mom/dad friend holding everyone's keys and IDs.",
        "C) The quiet observer making witty side comments.",
        "D) The planner organizing all the hangouts."
      ]
    },
    {
      id: "cat2_q30",
      question: "How do you prefer to celebrate your birthday with your circle?",
      options: [
        "A) Zero parties; quiet dinner with three close people.",
        "B) Absolute chaos and a packed room of energy.",
        "C) A chill night playing games or getting food.",
        "D) Pretending it's a normal day to avoid attention."
      ]
    }
  ]
};
// Adding Category 3 to our cardDeck structure in cards.js
cardDeck.cat3 = {
  name: "Everyday Favorites & Weird Specifics",
  tierMin: "free",
  questions: [
    {
      id: "cat3_q101",
      question: "What is your favorite color, and what color should be permanently outlawed from home decor?",
      options: [
        "A) Black; burn every shade of beige and mustard yellow.",
        "B) Forest green; ban gray on gray on gray.",
        "C) Deep blue; get rid of millennial pink forever.",
        "D) Blood red; outlaw builder-grade white."
      ]
    },
    {
      id: "cat3_q102",
      question: "What is your most illegal food opinion that would get you kicked out of a restaurant?",
      options: [
        "A) Ketchup belongs on steak and I will die on this hill.",
        "B) Brunch is a scam and pancakes are just sad, flat cake.",
        "C) Fast food fries are better than high-end restaurant fries.",
        "D) Water is completely overrated as a beverage."
      ]
    },
    {
      id: "cat3_q103",
      question: "If you could talk to one animal, which one are you picking?",
      options: [
        "A) Stray cats, so I can find out who they're plotting against.",
        "B) Pigeons, because they know all the neighborhood gossip.",
        "C) Raccoons, to ask why they love knocking over trash cans.",
        "D) Dogs, just to tell them they're doing a great job."
      ]
    },
    {
      id: "cat3_q104",
      question: "What is your most unhinged late-night snack combination when nobody is watching?",
      options: [
        "A) Peanut butter and pickle sandwiches.",
        "B) Cold shredded cheese straight from the bag over the sink.",
        "C) Saltine crackers dipped in hot sauce and mayo.",
        "D) Whatever random carbs I can microwave in under a minute."
      ]
    },
    {
      id: "cat3_q105",
      question: "Are you packing three days early, or throwing clothes in a duffel while the Uber is outside?",
      options: [
        "A) Packed a week ago with color-coded packing cubes.",
        "B) Throwing random items into a bag thirty seconds before departure.",
        "C) Buying new clothes at my destination because I forgot to pack.",
        "D) I don't pack; I just panic."
      ]
    },
    {
      id: "cat3_q106",
      question: "What is your most useless party trick?",
      options: [
        "A) Naming any movie quote within two seconds of hearing it.",
        "B) Making a weird animal noise that scares pets.",
        "C) Opening a bottle cap with literally anything except an opener.",
        "D) Knowing the exact lyrics to obscure 2000s rap songs."
      ]
    },
    {
      id: "cat3_q107",
      question: "If you haunted a house, what minor, petty inconvenience would you cause?",
      options: [
        "A) Moving the car keys three inches to the left every night.",
        "B) Making the Wi-Fi drop out right when they're saving a file.",
        "C) Making every floorboard squeak exclusively when they walk by at 3 AM.",
        "D) Hiding one matching sock from every single pair in the laundry."
      ]
    },
    {
      id: "cat3_q108",
      question: "What is a terrible movie you secretly love to death?",
      options: [
        "A) Fast and Furious—the physics make zero sense and I love it.",
        "B) A cheesy 2000s rom-com where the plot is entirely predictable.",
        "C) A so-bad-it's-good horror movie with terrible acting.",
        "D) An animated kids' movie from 2004."
      ]
    },
    {
      id: "cat3_q109",
      question: "If you entered a competitive eating contest, what food gives you the win?",
      options: [
        "A) Spicy chicken wings—I have an unholy tolerance for pain.",
        "B) French fries. Unlimited carbs until I pass out.",
        "C) Pizza rolls straight out of the microwave lava oven.",
        "D) Mac and cheese. I'll drown in it."
      ]
    },
    {
      id: "cat3_q110",
      question: "What modern slang term makes you feel like an ancient skeleton?",
      options: [
        "A) Saying 'rizz' unironically makes my soul cringe out of my body.",
        "B) Hearing 'skibidi' makes me want to throw my phone in the ocean.",
        "C) 'Bet' and 'no cap' feel exhausting.",
        "D) I refuse to learn any new words past 2018."
      ]
    }
  ]
  };
  cardDeck.cat4 = {
  name: "Goofy Quirks & Childhood Nostalgia",
  tierMin: "free",
  questions: [
    {
      id: "cat4_q121",
      question: "What was your absolute cringiest teenage fashion phase?",
      options: [
        "A) Scene kid / emo hair covering half my face.",
        "B) Wearing three polo collars popped up at once.",
        "C) Graphic tees with sarcastic slogans that made zero sense.",
        "D) Baggy jeans that dragged on the floor until they were ruined."
      ]
    },
    {
      id: "cat4_q122",
      question: "How do you squeeze the toothpaste tube?",
      options: [
        "A) Neatly from the very bottom like a civilized human.",
        "B) Violently crushing it right from the middle.",
        "C) Rolling it up from the bottom like a tube of paint.",
        "D) Squeezing wherever my thumb lands until it pops."
      ]
    },
    {
      id: "cat4_q123",
      question: "What song forces you to air-drum or sing along instantly?",
      options: [
        "A) Anything by Earth, Wind & Fire.",
        "B) An aggressive 2000s rock anthem.",
        "C) Whatever chaotic hype song is stuck in my head.",
        "D) A random TV show theme song from childhood."
      ]
    },
    {
      id: "cat4_q124",
      question: "What is the most ridiculous nickname you've ever been given?",
      options: [
        "A) Something completely unrelated to my actual name.",
        "B) A childhood moniker based on a stupid mistake.",
        "C) 'The Management' because I'm bossy.",
        "D) Gremlin."
      ]
    },
    {
      id: "cat4_q125",
      question: "If you could change your car horn to any sound effect, what is it?",
      options: [
        "A) A loud, echoing goat scream.",
        "B) A cartoon 'boing' sound.",
        "C) Someone yelling 'Move!' in a megaphone.",
        "D) A disappointed sigh."
      ]
    },
    {
      id: "cat4_q126",
      question: "What is your go-to karaoke hype song?",
      options: [
        "A) An absolute throwback hip-hop classic everyone knows.",
        "B) A dramatic pop ballad I scream at the top of my lungs.",
        "C) Something terrible that forces everyone to sing along.",
        "D) I am never, ever touching a karaoke mic."
      ]
    },
    {
      id: "cat4_q127",
      question: "If you were a pro wrestler, what's your stage name and entrance track?",
      options: [
        "A) Name: The Menace. Track: Heavy bass beats.",
        "B) Name: Chaos Coordinator. Track: 80s synth-pop.",
        "C) Name: Silent Treatment. Track: Absolute dead silence.",
        "D) Name: The Overthinker. Track: Dial-up internet sounds."
      ]
    },
    {
      id: "cat4_q128",
      question: "What childish thing do you still love doing as an adult?",
      options: [
        "A) Jumping on the bed when nobody is looking.",
        "B) Eating cereal out of the biggest bowl in the house at midnight.",
        "C) Building blanket forts for movie nights.",
        "D) Playing video games until my eyes hurt."
      ]
    },
    {
      id: "cat4_q129",
      question: "Are you a 50-open-tabs browser, or single-digit clean tab person?",
      options: [
        "A) 300 tabs open across four windows, send help.",
        "B) Exactly three tabs: email, music, and one random search.",
        "C) I close everything the second I'm done looking at it.",
        "D) My browser crashes daily because of memory overload."
      ]
    },
    {
      id: "cat4_q130",
      question: "What is the weirdest thing you bought online at 2 AM while bored?",
      options: [
        "A) A ridiculous kitchen gadget I used exactly once.",
        "B) A costume for my pet that they hated.",
        "C) Three hundred custom stickers of a weird meme.",
        "D) A bulk pack of tiny plastic hands."
      ]
    }
  ]
};
// Adding Category 5 to our cardDeck structure in cards.js
cardDeck.cat5 = {
  name: "The Highly Debatable 'This or That'",
  tierMin: "free",
  questions: [
    {
      id: "cat5_q131",
      question: "Breakfast for dinner, or traditional dinner foods for breakfast?",
      options: [
        "A) Breakfast for dinner is elite. Give me pancakes at 9 PM.",
        "B) Cold pizza for breakfast is unmatched.",
        "C) Why choose? Eat both at the same time.",
        "D) Neither; keep meals in their proper time zones."
      ]
    },
    {
      id: "cat5_q132",
      question: "Crunchy peanut butter, smooth, or anti-peanut butter?",
      options: [
        "A) Smooth peanut butter only; texture is a trap.",
        "B) Crunchy peanut butter gives it character.",
        "C) SunButter or bust.",
        "D) Keep peanut butter away from me entirely."
      ]
    },
    {
      id: "cat5_q133",
      question: "Soggy socks forever, or popcorn kernel stuck in your teeth forever?",
      options: [
        "A) Popcorn kernel; I can deal with the annoyance.",
        "B) Soggy socks is a psychological torture chamber—hard pass.",
        "C) I'd rather walk barefoot on Lego bricks.",
        "D) This is an evil question, delete it."
      ]
    },
    {
      id: "cat5_q134",
      question: "Pineapple on pizza defender, or crime against humanity?",
      options: [
        "A) Defender for life—sweet and savory is a masterpiece.",
        "B) Absolute crime. Fruit does not belong on cheese.",
        "C) I'll eat it if someone else bought it, but I won't order it.",
        "D) Put whatever you want on your own pizza, leave me out of it."
      ]
    },
    {
      id: "cat5_q135",
      question: "Fight one horse-sized duck, or one hundred duck-sized horses?",
      options: [
        "A) Horse-sized duck; at least I know where the enemy is.",
        "B) One hundred tiny horses—I'm drop-kicking them.",
        "C) Absolutely neither; I'm negotiating peace with the ducks.",
        "D) Running away immediately."
      ]
    },
    {
      id: "cat5_q136",
      question: "Is a hot dog a sandwich?",
      options: [
        "A) Absolutely not; it's a taco or its own category.",
        "B) Yes, meat between bread is a sandwich by definition.",
        "C) It's a hot dog. Stop overcomplicating food.",
        "D) Who cares as long as it has mustard?"
      ]
    },
    {
      id: "cat5_q137",
      question: "Smell like onions forever, or have everyone around you smell like onions?",
      options: [
        "A) Everyone else smells like onions so I don't have to notice.",
        "B) I'll smell like onions; I'll just become the onion lord.",
        "C) Neither—lock me in a vacuum-sealed bubble.",
        "D) I love onions anyway, let's ride."
      ]
    }
  ]
};
    // Adding Category 6 to our cardDeck structure in cards.js
cardDeck.cat6 = {
  name: "Ambition, Growth & Habits",
  tierMin: "tier_30_day",
  questions: [
    {
      id: "cat6_q31",
      question: "What is a skill you're determined to learn, even if you suck at it right now?",
      options: [
        "A) Coding or building apps from scratch.",
        "B) Editing videos so I can look like a pro.",
        "C) Learning how to cook something that doesn't come in a box.",
        "D) Managing my money so my bank account stops crying."
      ]
    },
    {
      id: "cat6_q32",
      question: "What happens when a big project totally crashes and burns?",
      options: [
        "A) I stare at the wall questioning all my life choices.",
        "B) I immediately pivot and pretend it was the plan all along.",
        "C) I blame technology and walk away.",
        "D) I take a nap and deal with it tomorrow."
      ]
    },
    {
      id: "cat6_q33",
      question: "What bad habit are you currently fighting (and probably losing to)?",
      options: [
        "A) Scrolling my phone until 3 AM for no reason.",
        "B) Hitting snooze six times in a row.",
        "C) Procrastinating until the absolute last possible second.",
        "D) Buying things online I don't need."
      ]
    },
    {
      id: "cat6_q34",
      question: "Does a predictable, boring routine comfort you, or make you want to scream?",
      options: [
        "A) Give me predictable stability; I love peace.",
        "B) Routine feels like a prison sentence.",
        "C) I love a routine until I get bored of it on day two.",
        "D) My life is pure chaos; routine is a myth."
      ]
    },
    {
      id: "cat6_q35",
      question: "What is the best piece of advice or reality check you ever got?",
      options: [
        "A) 'Nobody cares what you're doing, so just do it.'",
        "B) 'Stop explaining yourself to people who don't want to understand.'",
        "C) 'If it takes less than two minutes, do it right now.'",
        "D) 'Nobody is coming to save you.'"
      ]
    },
    {
      id: "cat6_q36",
      question: "Are you living for today, or stressing about five years from now?",
      options: [
        "A) Living strictly day-to-day and hoping for the best.",
        "B) Stressing out about a timeline I made up in my head.",
        "C) Planning everything down to the minute.",
        "D) Winging it and panicking at the last second."
      ]
    },
    {
      id: "cat6_q37",
      question: "What kind of task makes you lose track of time completely?",
      options: [
        "A) Tinkering with tech, design, or building something.",
        "B) Down a deep internet research rabbit hole.",
        "C) Organizing and cleaning a space until it's spotless.",
        "D) Gaming or zoning out to music."
      ]
    },
    {
      id: "cat6_q38",
      question: "What fear is low-key holding you back right now?",
      options: [
        "A) Looking stupid in front of people.",
        "B) Failing after I told everyone I was going to do it.",
        "C) Success taking up too much of my free time.",
        "D) Absolutely nothing—I'm fearless (or delusional)."
      ]
    },
    {
      id: "cat6_q39",
      question: "How do you keep going when a project gets boring and you lose interest?",
      options: [
        "A) I force myself to finish out of pure spite.",
        "B) I abandon it and start three new projects instead.",
        "C) I take a break and come back a week later.",
        "D) I lower the bar just enough to cross the finish line."
      ]
    },
    {
      id: "cat6_q40",
      question: "What tiny daily ritual keeps you from losing your mind?",
      options: [
        "A) Drinking my coffee in absolute, uninterrupted silence.",
        "B) A late-night drive with the music turned all the way up.",
        "C) Lighting a candle and cleaning my desk.",
        "D) Doing absolutely nothing for ten minutes."
      ]
    }
  ]
};
// Adding Category 7 to our cardDeck structure in cards.js
cardDeck.cat7 = {
  name: "Vibe Check & Inner Thoughts",
  tierMin: "tier_30_day",
  questions: [
    {
      id: "cat7_q41",
      question: "What's your standard stress level during a regular, boring week?",
      options: [
        "A) Smooth sailing. I rarely stress.",
        "B) Low-key panicking about five things at once.",
        "C) Completely fine until one tiny inconvenience ruins my day.",
        "D) Pure adrenaline and survival mode 24/7."
      ]
    },
    {
      id: "cat7_q42",
      question: "When life gets heavy, where does your body instantly store the stress?",
      options: [
        "A) My shoulders are permanently stuck by my ears.",
        "B) Instant tension headache right between my eyes.",
        "C) My stomach is doing Olympic gymnastics.",
        "D) I just shut down and fall asleep for twelve hours."
      ]
    },
    {
      id: "cat7_q43",
      question: "What is your toxic coping mechanism when you're overwhelmed?",
      options: [
        "A) Pretending everything is totally fine while screaming inside.",
        "B) Buying random things online that I definitely don't need.",
        "C) Ghosting everyone and hiding in my room like a goblin.",
        "D) Eating a ridiculous amount of snacks at 2 AM."
      ]
    },
    {
      id: "cat7_q44",
      question: "How did your family mess up your conflict style today?",
      options: [
        "A) I yell immediately because that's how we communicated.",
        "B) I shut my mouth and run away to avoid drama.",
        "C) I over-explain myself until I'm out of breath.",
        "D) I act like nothing happened while plotting my revenge."
      ]
    },
    {
      id: "cat7_q45",
      question: "When your self-esteem takes a hit, what do you do for attention?",
      options: [
        "A) Post a selfie and wait for validation.",
        "B) Fish for compliments in group chats.",
        "C) Buy a new outfit so I can feel like a main character again.",
        "D) Pretend I don't care at all while dying inside."
      ]
    },
    {
      id: "cat7_q46",
      question: "How hard is it for you to be vulnerable with a bro or sis?",
      options: [
        "A) Impossible. I take my secrets to the grave.",
        "B) I'll share, but only wrapped in a joke so it doesn't look weak.",
        "C) I open up way too fast and regret it immediately.",
        "D) Only after three drinks or at 3 AM."
      ]
    },
    {
      id: "cat7_q47",
      question: "What do you do when you feel unappreciated?",
      options: [
        "A) Pull back and give everyone the absolute bare minimum.",
        "B) Throw subtle passive-aggressive hints.",
        "C) Complain to a different set of friends.",
        "D) Quietly pack up my energy and leave."
      ]
    },
    {
      id: "cat7_q48",
      question: "How do you actually handle major life changes or hard losses?",
      options: [
        "A) Throw myself into work so I don't have to think about it.",
        "B) Stare at the ceiling and process it for three days straight.",
        "C) Pretend it's fine until it hits me out of nowhere.",
        "D) Scream into a pillow and eat ice cream."
      ]
    },
    {
      id: "cat7_q49",
      question: "On a scale of 1 to 10, how much do you actually like your current routine?",
      options: [
        "A) 10/10 living my absolute best life.",
        "B) Solid 6—getting there, but needs work.",
        "C) A 3, and I'm one minor inconvenience away from moving to the woods.",
        "D) We don't talk about numbers right now."
      ]
    },
    {
      id: "cat7_q50",
      question: "Where is your ultimate safe space where you can finally let your guard down?",
      options: [
        "A) Locked in my room with the lights off.",
        "B) In my car with the music cranked up.",
        "C) Next to one specific person who gets my brain.",
        "D) Nowhere. I am always on guard."
      ]
    }
  ]
};
// Adding Category 10 to our cardDeck structure in cards.js
cardDeck.cat10 = {
  name: "Konflict Resolution & Communication",
  tierMin: "tier_30_day",
  questions: [
    {
      id: "cat10_q71",
      question: "When an argument pops off, do you need space or want to fix it right now?",
      options: [
        "A) Leave me alone in a dark room for two business days.",
        "B) We are fixing this right this second before I breathe.",
        "C) I'll shut down completely and pretend the room is empty.",
        "D) I need ten minutes to walk it off, then we can talk."
      ]
    },
    {
      id: "cat10_q72",
      question: "How do you tell your partner they're annoying you without starting a fight?",
      options: [
        "A) I use an overly calm voice that terrifies them.",
        "B) I make a joke out of it so it softens the blow.",
        "C) I bottle it up until I snap over a misplaced sock.",
        "D) I straight up tell them they're tripping."
      ]
    },
    {
      id: "cat10_q73",
      question: "What actually makes an apology feel real to you?",
      options: [
        "A) Actually changing the behavior instead of just saying sorry.",
        "B) Bringing me my favorite food as a peace offering.",
        "C) Owning it fully without making excuses.",
        "D) Acknowledging how it made me feel."
      ]
    },
    {
      id: "cat10_q74",
      question: "What do you do when you feel your partner pulling away?",
      options: [
        "A) Pull away twice as fast to protect my ego.",
        "B) Panic and overthink every single text they send.",
        "C) Sit them down and ask what's actually going on.",
        "D) Match their energy and wait for them to crack."
      ]
    },
    {
      id: "cat10_q75",
      question: "Have you ever held a grudge so long it poisoned the relationship?",
      options: [
        "A) Yes, and it went down in flames like it was supposed to.",
        "B) I carry grudges like a full-time job.",
        "C) I talk it out immediately so I don't build resentment.",
        "D) I forgive, but I never forget."
      ]
    },
    {
      id: "cat10_q76",
      question: "How do you handle feedback or criticism from a partner?",
      options: [
        "A) I get defensive immediately before my brain processes it.",
        "B) I take it like a champ, then cry in the shower later.",
        "C) I listen, nod, and immediately debate every point.",
        "D) If they're right, I own it (begrudgingly)."
      ]
    },
    {
      id: "cat10_q77",
      question: "How do you handle a massive disagreement where neither side will budge?",
      options: [
        "A) Agree to disagree and drop the subject.",
        "B) Stubborn standoff until one of us breaks.",
        "C) Order pizza and pretend the argument never happened.",
        "D) Flip a coin to see who loses."
      ]
    },
    {
      id: "cat10_q78",
      question: "How do you break the ice after a brutal, draining fight?",
      options: [
        "A) Hand them a snack and pretend nothing happened.",
        "B) A quiet hug or physical touch to reset the vibe.",
        "C) Send a dumb meme from across the room.",
        "D) A sincere 'my bad, let's start over.'"
      ]
    },
    {
      id: "cat10_q79",
      question: "What communication habit from a partner shuts your brain down instantly?",
      options: [
        "A) The silent treatment.",
        "B) Interrupting me every time I try to talk.",
        "C) Weaponizing things I told them in confidence.",
        "D) Saying 'calm down' when I am already calm."
      ]
    },
    {
      id: "cat10_q80",
      question: "How do you make sure both people are actually heard during a heated debate?",
      options: [
        "A) Taking turns talking without yelling over each other.",
        "B) Writing our thoughts down so we don't snap.",
        "C) Taking a pause when emotions get too high.",
        "D) Honestly? Whoever yells the loudest wins (kidding)."
      ]
    }
  ]
};
// Adding Category 11 to our cardDeck structure in cards.js
cardDeck.cat11 = {
  name: "Deep Hopes, Fears & Shared Dreams",
  tierMin: "tier_30_day",
  questions: [
    {
      id: "cat11_q81",
      question: "What is your wildly huge dream that you need a partner to support?",
      options: [
        "A) Building a business from scratch and quitting the 9-to-5.",
        "B) Traveling the globe and living out of a suitcase.",
        "C) Owning land out in the woods away from society.",
        "D) Creating something that outlives me."
      ]
    },
    {
      id: "cat11_q82",
      question: "What is your absolute biggest fear about long-term commitment?",
      options: [
        "A) Losing my independence and feeling trapped.",
        "B) Opening up completely just to get cheated on or left.",
        "C) Waking up ten years later realizing we grew apart.",
        "D) Settling for the wrong person out of comfort."
      ]
    },
    {
      id: "cat11_q83",
      question: "If you could undo one dating mistake from your past, what is it?",
      options: [
        "A) Ignoring every single red flag waving in my face.",
        "B) Staying in a dead-end relationship way too long.",
        "C) Giving my energy to people who didn't deserve it.",
        "D) Nothing—every disaster taught me a lesson."
      ]
    },
    {
      id: "cat11_q84",
      question: "What legacy do you actually want to build with a partner?",
      options: [
        "A) Building generational wealth so our people are set.",
        "B) Creating a safe, welcoming home for our circle.",
        "C) Leaving the world slightly better than we found it.",
        "D) Just having a peaceful, happy life with zero drama."
      ]
    },
    {
      id: "cat11_q85",
      question: "What bucket list adventure are you saving for the right person?",
      options: [
        "A) A spontaneous road trip across the country with no plan.",
        "B) Booking a first-class flight to a random country.",
        "C) Buying our dream fixer-upper home together.",
        "D) Renting a cabin in the mountains for a month."
      ]
    },
    {
      id: "cat11_q86",
      question: "How do you keep the spark alive when the relationship settles into a routine?",
      options: [
        "A) Forcing ourselves to go on actual dates instead of just staying home.",
        "B) Randomly doing goofy things to make each other laugh.",
        "C) Trying out completely new hobbies together.",
        "D) Recognizing that quiet stability is actually a good thing."
      ]
    },
    {
      id: "cat11_q87",
      question: "Do you actually believe 'unconditional love' exists between adults?",
      options: [
        "A) Yes, but it requires a lot of hard work and boundaries.",
        "B) Nah, love always has conditions and terms attached.",
        "C) It exists with family, but romance has rules.",
        "D) I want to believe it does."
      ]
    },
    {
      id: "cat11_q88",
      question: "What personal flaw do you need a partner to just tolerate about you?",
      options: [
        "A) I overthink literally everything.",
        "B) I need a lot of alone time to recharge my social battery.",
        "C) I'm chronically late to everything.",
        "D) I can be stubborn as a brick wall."
      ]
    },
    {
      id: "cat11_q89",
      question: "What do you hope a partner says about you when you're not in the room?",
      options: [
        "A) 'They're my absolute ride-or-die.'",
        "B) 'They keep me grounded when I'm losing my mind.'",
        "C) 'They're the funniest person I know.'",
        "D) 'They always follow through on what they say.'"
      ]
    },
    {
      id: "cat11_q90",
      question: "What makes you feel genuinely understood on a deep level?",
      options: [
        "A) When someone notices tiny details without me asking.",
        "B) When they laugh at my weirdest jokes.",
        "C) When they let me vent without trying to 'fix' it.",
        "D) When we sit in total silence and it feels comfortable."
      ]
    }
  ]
};// Adding Category 12 to our cardDeck structure in cards.js
cardDeck.cat12 = {
  name: "Vibe Check & Inner Wiring",
  tierMin: "tier_30_day",
  questions: [
    {
      id: "cat12_q91",
      question: "What toxic family trait do you catch yourself doing and cringe?",
      options: [
        "A) Raising my voice during a normal conversation.",
        "B) Shutting down and ghosting when things get hard.",
        "C) Over-explaining myself like I'm on trial.",
        "D) Apologizing for simply existing."
      ]
    },
    {
      id: "cat12_q92",
      question: "When your partner is stressed, do you put on a superhero cape or run away?",
      options: [
        "A) I turn into an aggressive project manager trying to fix it.",
        "B) I panic right alongside them.",
        "C) I offer quiet support from a safe distance.",
        "D) I distract them with food and bad TV."
      ]
    },
    {
      id: "cat12_q93",
      question: "What childhood scar still messes with how you handle rejection today?",
      options: [
        "A) Assuming people will leave, so I leave first.",
        "B) Feeling like I'm never quite doing enough.",
        "C) Taking everything way too personally.",
        "D) Building a titanium wall around my feelings."
      ]
    },
    {
      id: "cat12_q94",
      question: "Are you an anxious attachment mess or an avoidant ghost?",
      options: [
        "A) Anxious. Text me back in five seconds or I'll pass away.",
        "B) Avoidant. If you look at me funny, I'm ghosting.",
        "C) A chaotic mix of both depending on the day.",
        "D) Secure (congrats, you're a unicorn)."
      ]
    },
    {
      id: "cat12_q95",
      question: "How do you ask for emotional safety without sounding weak?",
      options: [
        "A) 'I need a minute to collect my brain.'",
        "B) 'Can we hit pause and restart this conversation?'",
        "C) 'I need some reassurance right now, please.'",
        "D) I don't—I just hint at it and hope they guess."
      ]
    },
    {
      id: "cat12_q96",
      question: "What hidden expectation do you secretly bring into a relationship?",
      options: [
        "A) That they'll just magically know what I'm thinking.",
        "B) That they'll fix all my problems for me.",
        "C) That they won't leave when things get ugly.",
        "D) That they'll match my exact energy 24/7."
      ]
    },
    {
      id: "cat12_q97",
      question: "How do you tell the difference between real love and just needing attention?",
      options: [
        "A) Real love stays when the excitement fades; attention is temporary.",
        "B) Love feels calm; desperate attention feels frantic.",
        "C) If I want them around when I'm doing nothing, it's real.",
        "D) Honestly, I'm still trying to figure that out."
      ]
    },
    {
      id: "cat12_q98",
      question: "When trust gets shattered, what is your exact blueprint for fixing it?",
      options: [
        "A) Total transparency, shared passwords, and infinite patience.",
        "B) Time, space, and a lot of rebuilding.",
        "C) Once it's broken, it can't be glued back together.",
        "D) Proof of changed behavior over a long period."
      ]
    },
    {
      id: "cat12_q99",
      question: "What emotional needs do you handle yourself vs. expecting a partner to carry?",
      options: [
        "A) My happiness is my job; my partner is just the bonus.",
        "B) I expect them to listen to me vent about my day.",
        "C) I carry my own trauma; they just bring good vibes.",
        "D) We share everything 50/50."
      ]
    },
    {
      id: "cat12_q100",
      question: "How do you keep your own identity so you don't lose yourself in a relationship?",
      options: [
        "A) Keeping my own friends, hobbies, and alone time sacred.",
        "B) Maintaining my bank account and independence.",
        "C) Refusing to let someone else dictate my schedule.",
        "D) Remembering who I was before I met them."
      ]
    }
  ]
};// Adding Category 13 to our cardDeck structure in cards.js
cardDeck.cat13 = {
  name: "Sci-Fi, Superpowers & Hypotheticals",
  tierMin: "unlocked",
  questions: [
    {
      id: "cat13_q111",
      question: "If you could have one totally useless, mundane superpower, what is it?",
      options: [
        "A) Always knowing exactly where my misplaced keys and phone are.",
        "B) Being able to instantly fold fitted sheets.",
        "C) Making traffic lights turn green by glaring at them.",
        "D) Never burning my tongue on hot coffee."
      ]
    },
    {
      id: "cat13_q112",
      question: "In a sudden zombie apocalypse, what store are you running to first?",
      options: [
        "A) Costco—we're barricading the doors and eating bulk snacks.",
        "B) Hardware store—give me weapons and duct tape.",
        "C) Total Wine—if the world is ending, we're going out loose.",
        "D) A bookstore, because nobody looks for survivors there."
      ]
    },
    {
      id: "cat13_q113",
      question: "If you got arrested with zero explanation, what would people assume you did?",
      options: [
        "A) Smacked someone for walking too slow on the sidewalk.",
        "B) Started an underground squirrel-fighting ring.",
        "C) Grand theft auto because I missed my exit.",
        "D) Tax fraud, but by total accident."
      ]
    },
    {
      id: "cat13_q114",
      question: "If you could time-travel for five minutes just to look around, where are you going?",
      options: [
        "A) 90s underground hip-hop club scene.",
        "B) Ancient Rome to watch the chaos unfold.",
        "C) Five minutes into the future to check lottery numbers.",
        "D) Dinosaurs, just to see if they actually had feathers."
      ]
    },
    {
      id: "cat13_q115",
      question: "If your pet could talk for one day, what embarrassing secret are they telling?",
      options: [
        "A) How many times I talked to myself out loud while pacing.",
        "B) Exactly how much junk food I ate in secret.",
        "C) The ridiculous baby-talk voice I use when nobody else is home.",
        "D) That I'm actually their pet, not the other way around."
      ]
    },
    {
      id: "cat13_q116",
      question: "What fictional universe are you getting trapped in for a year?",
      options: [
        "A) Pokémon, so I can just pet creatures all day.",
        "B) The Office—pure chaos, zero real danger.",
        "C) Cyberpunk, just to drive a flying car.",
        "D) Absolutely none of them; I like indoor plumbing too much."
      ]
    },
    {
      id: "cat13_q117",
      question: "If you had to replace your left hand with a random tool, what are you picking?",
      options: [
        "A) A Swiss Army knife attachment.",
        "B) A built-in staple gun for maximum efficiency.",
        "C) A miniature blowtorch.",
        "D) A tape measure because I'm always guessing room dimensions."
      ]
    },
    {
      id: "cat13_q118",
      question: "Would you let a billionaire pay your entire life if you had to wear a ballgown/tuxedo 24/7?",
      options: [
        "A) 100%. I will sleep in a tuxedo if the bills are paid.",
        "B) Hard pass—I refuse to live life without sweatpants.",
        "C) Only if sweatpants count as formal wear under the right lighting.",
        "D) Let's negotiate: pajamas on weekends."
      ]
    },
    {
      id: "cat13_q119",
      question: "If you had to legally rename yourself after a fruit, vegetable, or weather pattern, what's your new name?",
      options: [
        "A) Hurricane [Last Name].",
        "B) Broccoli.",
        "C) Thunder Stacie.",
        "D) Tangerine."
      ]
    },
    {
      id: "cat13_q120",
      question: "If aliens demanded our finest cultural media, what are you showing them?",
      options: [
        "A) A chaotic compilation of internet meme history.",
        "B) Shrek 2. No explanation needed.",
        "C) A dramatic music video from 2003.",
        "D) Absolutely nothing—let's keep our secrets."
      ]
    }
  ]
};// Adding Category 14 to our cardDeck structure in cards.js
cardDeck.cat14 = {
  name: "Pure Silly Nonsense",
  tierMin: "unlocked",
  questions: [
    {
      id: "cat14_q141",
      question: "What animal is funniest if scaled up to minivan size?",
      options: [
        "A) A house cat—just knocking over SUVs instead of cups.",
        "B) A pigeon aggressively waddling down the highway.",
        "C) A raccoon digging through dumpsters the size of houses.",
        "D) A tiny hedgehog trying to cross a street."
      ]
    },
    {
      id: "cat14_q142",
      question: "What ridiculous royal decree are you passing in your neighborhood?",
      options: [
        "A) Mandatory quiet hours starting at 8 PM for everyone.",
        "B) Anyone walking a dog must let me pet it on command.",
        "C) No leaf blowers before noon on weekends under penalty of exile.",
        "D) Free snacks delivered to my porch every Tuesday."
      ]
    },
    {
      id: "cat14_q143",
      question: "What is your survival plan for a rogue Roomba with AI consciousness?",
      options: [
        "A) Lift it off the ground by its edges so its wheels spin uselessly.",
        "B) Put a piece of tape over its sensor and blind it.",
        "C) Accept my new robotic overlord and feed it dust bunnies.",
        "D) Throw a rug over it."
      ]
    },
    {
      id: "cat14_q144",
      question: "What clickbait YouTube title summarizes your last week?",
      options: [
        "A) 'I tried to survive adulting and it went horribly wrong (NOT CLICKBAIT).'",
        "B) 'We let a stray thought ruin our entire schedule at 3 AM!'",
        "C) 'Too many tabs open! (You won't believe what happened next).'",
        "D) 'I drank too much coffee and fought a printer.'"
      ]
    },
    {
      id: "cat14_q145",
      question: "What item inside your house enters a parallel dimension permanently?",
      options: [
        "A) Hair ties and bobby pins. They are gone forever.",
        "B) Tupperware lids that never match their base again.",
        "C) Phone chargers.",
        "D) The TV remote control."
      ]
    },
    {
      id: "cat14_q146",
      question: "If two historical figures played high-stakes Monopoly, who are you picking?",
      options: [
        "A) Abraham Lincoln and Albert Einstein arguing over park place.",
        "B) Two aggressive historical rulers flipping the board in rage.",
        "C) Cleopatra and a confused medieval knight.",
        "D) Pirates vs. economists."
      ]
    },
    {
      id: "cat14_q147",
      question: "What is your go-to fake fancy aristocrat accent?",
      options: [
        "A) An overly posh British accent complaining about 'the servants.'",
        "B) A mysterious European villain who whispers everything.",
        "C) A terrible southern plantation owner accent from an old movie.",
        "D) Just speaking in exaggerated whispers."
      ]
    },
    {
      id: "cat14_q148",
      question: "Whose voice is narrating your inner monologue all day?",
      options: [
        "A) A dramatic movie trailer guy announcing my boring daily tasks.",
        "B) A sarcastic cartoon character judging my life choices.",
        "C) A tired documentary narrator watching a human fail at basic math.",
        "D) Just my own voice, but sounding deeply annoyed."
      ]
    },
    {
      id: "cat14_q149",
      question: "What fake conspiracy theory would be hilarious if it were true?",
      options: [
        "A) Pigeons are government charging docks for surveillance drones.",
        "B) Left socks disappear in the dryer to fund an underground economy.",
        "C) Cats understand English fluently; they just choose to ignore us.",
        "D) Every automatic door is powered by a tiny wizard inside the wall."
      ]
    },
    {
      id: "cat14_q150",
      question: "If you got a lifetime supply of one snack, what's filling the pantry?",
      options: [
        "A) Spicy chips that burn my taste buds off.",
        "B) Premium gummy candy.",
        "C) Gourmet pretzels or popcorn.",
        "D) Ice cream, if my freezer can handle infinite refills."
      ]
    }
  ]
};// Adding Category 15 to our cardDeck structure in cards.js
cardDeck.cat15 = {
  name: "Weird Talents & Unfortunate Superpowers",
  tierMin: "unlocked",
  questions: [
    {
      id: "cat15_q151",
      question: "If you could turn into a random object for one hour every week to spy, what are you choosing?",
      options: [
        "A) A ceiling fan so I can judge everyone from above.",
        "B) The office stapler just to see who steals it.",
        "C) A house cat's collar to experience zero responsibilities.",
        "D) A dollar bill on the sidewalk to watch people's reactions."
      ]
    },
    {
      id: "cat15_q152",
      question: "What random sound makes your skin crawl instantly?",
      options: [
        "A) Someone chewing ice or biting silverware.",
        "B) Styrofoam rubbing together.",
        "C) Nails dragging across a textured wall.",
        "D) A fork scraping against a ceramic plate."
      ]
    },
    {
      id: "cat15_q153",
      question: "If your life had a laugh track that played after awkward moments, would it help?",
      options: [
        "A) Absolutely not; I'd commit a crime.",
        "B) Yes, at least my misery would be entertaining.",
        "C) It would turn my anxiety into a sitcom.",
        "D) I'd throw hands with whoever is operating the soundboard."
      ]
    },
    {
      id: "cat15_q154",
      question: "What is the most ridiculous thing you did purely because you refused to admit you were wrong?",
      options: [
        "A) Drove in the wrong direction for 40 minutes pretending I knew a shortcut.",
        "B) Argued about a movie plot with someone who actually starred in it.",
        "C) Ate something completely spoiled just to prove it was fine.",
        "D) Doubled down on a fake fact until the other person gave up."
      ]
    },
    {
      id: "cat15_q155",
      question: "Would you shout a loud battle cry if it meant instantly making any room the perfect temperature?",
      options: [
        "A) 100%. I'll scream at the top of my lungs for good AC.",
        "B) Absolutely not, I refuse to cause a scene.",
        "C) Only if nobody is looking at me.",
        "D) Yes, and I'd make it as dramatic as possible."
      ]
    },
    {
      id: "cat15_q156",
      question: "What weird childhood lie or myth did you believe way too long?",
      options: [
        "A) Thinking quicksand was going to be a daily life hazard.",
        "B) Believing turning on the car's interior dome light was illegal.",
        "C) Thinking swallowing fruit seeds meant a tree grows in your stomach.",
        "D) Believing crossing your eyes too long makes them stay that way."
      ]
    },
    {
      id: "cat15_q157",
      question: "If you were a video game character, what are your two passive stats?",
      options: [
        "A) +10 Caffeine Tolerance, -5 Patience for Nonsense.",
        "B) +15 Sarcasm, -10 Morning Functionality.",
        "C) +20 Overthinking, +5 Snack Efficiency.",
        "D) +10 Sneaking, -5 Directional Sense."
      ]
    },
    {
      id: "cat15_q158",
      question: "What trivial skill are you shockingly bad at?",
      options: [
        "A) Tearing a straight piece of tin foil.",
        "B) Wrapping a present without it looking like a crumpled paper bag.",
        "C) Folding fitted sheets without crying.",
        "D) Pouring a drink without spilling a drop on the counter."
      ]
    },
    {
      id: "cat15_q159",
      question: "What theme song plays every time you walk through your front door?",
      options: [
        "A) An aggressive hip-hop hype beat.",
        "B) The Curb Your Enthusiasm theme.",
        "C) Dramatic circus music.",
        "D) Absolute deafening silence."
      ]
    },
    {
      id: "cat15_q160",
      question: "What weird, specific smell do you low-key love?",
      options: [
        "A) Fresh asphalt on a hot summer day.",
        "B) Old library books and dusty paper.",
        "C) Gasoline at the pump.",
        "D) Sharpie markers."
      ]
    }
  ]
};// Adding Category 16 to our cardDeck structure in cards.js
cardDeck.cat16 = {
  name: "Modern Debates & High-Stakes Domestic Choices",
  tierMin: "unlocked",
  questions: [
    {
      id: "cat16_q161",
      question: "One single alarm and you're up, or a cascade of 7 alarms spaced 5 minutes apart?",
      options: [
        "A) One alarm gang. Up and moving instantly.",
        "B) Seven alarms because I like torturing myself.",
        "C) Snooze button hit ten times until the last possible second.",
        "D) Waking up three minutes before my alarm out of pure fear."
      ]
    },
    {
      id: "cat16_q162",
      question: "Grocery store etiquette: return the cart to the corral, or leave it on the curb?",
      options: [
        "A) Corral always. We live in a society.",
        "B) I walk it all the way back to the front doors like a hero.",
        "C) Leaving it wedged on the curb is savage behavior.",
        "D) If the corral is too far, it's staying right there."
      ]
    },
    {
      id: "cat16_q163",
      question: "If you could delete one day of the week from existence forever, which one goes?",
      options: [
        "A) Monday, obviously. Burn it down.",
        "B) Sunday night because the dread of Monday ruins it anyway.",
        "C) Wednesday; it's an unnecessary speed bump.",
        "D) Keep all seven; I need days to recover from my days off."
      ]
    },
    {
      id: "cat16_q164",
      question: "Is it acceptable to wear outside-clothes on top of bed covers?",
      options: [
        "A) Absolute crime against humanity. Zero outdoor germs on the bed.",
        "B) Fine if I'm just sitting on top for two minutes.",
        "C) I don't care at all; my bed is a landing pad.",
        "D) Only if the clothes haven't touched public transit."
      ]
    },
    {
      id: "cat16_q165",
      question: "What is the maximum number of rings before you hang up and assume avoidance?",
      options: [
        "A) Three rings and I'm out.",
        "B) Let it ring out; if they wanted to talk, they'd answer.",
        "C) Five rings, then I text 'you good?'",
        "D) I let it ring till voicemail catches it."
      ]
    },
    {
      id: "cat16_q166",
      question: "How do you put on shoes and socks?",
      options: [
        "A) Sock-sock, shoe-shoe. The only logical way.",
        "B) Sock-shoe, sock-shoe like a psychopath.",
        "C) Whatever happens first depending on how cold the floor is.",
        "D) I don't wear shoes inside."
      ]
    },
    {
      id: "cat16_q167",
      question: "What discontinued fast-food item are we bringing back forever?",
      options: [
        "A) McDonald's snack wraps. Bring them home.",
        "B) Taco Bell volcano tacos.",
        "C) KFC potato wedges.",
        "D) Whatever limited-time item everyone forgot about."
      ]
    },
    {
      id: "cat16_q168",
      question: "Pizza crust: first, last, or left behind?",
      options: [
        "A) Saved for last like a reward with garlic dip.",
        "B) Eaten first so I get the boring part out of the way.",
        "C) Left behind like a monster.",
        "D) Fed to whatever pet is staring at me."
      ]
    },
    {
      id: "cat16_q169",
      question: "What is your strategy when you walk into a room and forget why?",
      options: [
        "A) Stand frozen in the middle of the room until my brain reboots.",
        "B) Walk back out to the exact spot I started to trigger my memory.",
        "C) Pretend I came in for something random so nobody notices.",
        "D) Give up and go back to the couch."
      ]
    },
    {
      id: "cat16_q170",
      question: "Yelling everything or whispering everything forever?",
      options: [
        "A) Whispering everything sounds like an elite spy movie.",
        "B) Yelling everything so nobody ever asks me to repeat myself.",
        "C) Absolute silence instead.",
        "D) Yelling indoors, whispering outdoors just to confuse people."
      ]
    }
  ]
};// Adding Category 17 to our cardDeck structure in cards.js
cardDeck.cat17 = {
  name: "Absurd Hypotheticals & Eccentric Lifestyles",
  tierMin: "unlocked",
  questions: [
    {
      id: "cat17_q171",
      question: "If an island's only entertainment was a single DVD copy of Shrek 2, how long do you last?",
      options: [
        "A) Years. I'll memorize every single line of dialogue.",
        "B) About three days before I throw the disc into the ocean.",
        "C) I'm thriving; Shrek 2 is a masterpiece.",
        "D) I'll watch it on loop until I lose my mind."
      ]
    },
    {
      id: "cat17_q172",
      question: "If you could put an exact life-sized statue right in your living room, what is it of?",
      options: [
        "A) A confused-looking golden retriever.",
        "B) A dramatic medieval knight holding a snack bowl.",
        "C) A replica of a weird internet meme.",
        "D) Myself, just to terrify houseguests."
      ]
    },
    {
      id: "cat17_q173",
      question: "What chaotic name are you giving a newly discovered color?",
      options: [
        "A) 'Pain.'",
        "B) 'Neon Panic.'",
        "C) 'Error 404.'",
        "D) 'Electric Mustard.'"
      ]
    },
    {
      id: "cat17_q174",
      question: "Living in a medieval castle for a month: royal ruler or chaotic court jester?",
      options: [
        "A) Court jester; zero pressure, maximum chaos.",
        "B) Royal ruler sitting on a throne eating grapes.",
        "C) The person locked in the dungeon for asking too many questions.",
        "D) The blacksmith minding my own business."
      ]
    },
    {
      id: "cat17_q175",
      question: "If you could replace the moon with a giant pop-culture item, what looks coolest?",
      options: [
        "A) A giant glowing disco ball.",
        "B) A massive floating slice of pizza.",
        "C) The 8-ball toy that gives yes/no answers.",
        "D) Keep the real moon; leave space alone."
      ]
    },
    {
      id: "cat17_q176",
      question: "Cursed to only eat foods starting with the first letter of your name: how miserable are you?",
      options: [
        "A) Extremely miserable; my diet is now three sad ingredients.",
        "B) Thriving if my name starts with P (pizza, pasta, potatoes).",
        "C) Living off snacks and regret.",
        "D) Finding loopholes in the dictionary."
      ]
    },
    {
      id: "cat17_q177",
      question: "If you joined a circus tomorrow, what fake act are you pitching?",
      options: [
        "A) Professional couch potato endurance artist.",
        "B) Extreme overthinking under pressure.",
        "C) Unhinged spoon-balancing on my nose.",
        "D) Staring blankly at walls until people clap."
      ]
    },
    {
      id: "cat17_q178",
      question: "What complex machine are you instantly downloading into your brain?",
      options: [
        "A) A fully functional flying submarine.",
        "B) A time machine because I want answers.",
        "C) A mechanical watch that never breaks.",
        "D) A coffee machine that reads my mood."
      ]
    },
    {
      id: "cat17_q179",
      question: "If your life was an alien reality TV show, what plot twist are you dropping next?",
      options: [
        "A) Suddenly winning the lottery and moving to the mountains.",
        "B) Dropping out of society to become a forest hermit.",
        "C) Random musical numbers in the middle of grocery stores.",
        "D) A complete career pivot into professional napping."
      ]
    },
    {
      id: "cat17_q180",
      question: "Would you keep a magical, hyper-efficient butler who constantly judges you with heavy sighs?",
      options: [
        "A) 100%. I need someone to check my bad decisions.",
        "B) Absolutely not; I get enough judgment from myself.",
        "C) Only if I'm allowed to roast them back.",
        "D) Yes, as long as they clean the kitchen."
      ]
    }
  ]
};// Adding Category 18 to our cardDeck structure in cards.js
cardDeck.cat18 = {
  name: "The Ultimate 'Silly Dilemmas'",
  tierMin: "unlocked",
  questions: [
    {
      id: "cat18_q181",
      question: "Skip everywhere you go, or always run at full sprint?",
      options: [
        "A) Skipping everywhere. It looks ridiculous, but running everywhere is exhausting.",
        "B) Full sprint. Get where I'm going in three seconds.",
        "C) Neither; I'm walking at my normal sluggish pace.",
        "D) Skipping, but only while humming cartoon music."
      ]
    },
    {
      id: "cat18_q182",
      question: "Hands permanently covered in sticky syrup, or sand inside your shoes forever?",
      options: [
        "A) Sticky syrup; at least I can wash things. Sand in shoes is pure torture.",
        "B) Sand in shoes because syrup ruins every single thing I touch.",
        "C) I'm cutting my feet and hands off, thank you.",
        "D) Neither, this is a horror movie question."
      ]
    },
    {
      id: "cat18_q183",
      question: "Read minds, but only when people are thinking about lunch?",
      options: [
        "A) Yes, knowing what people want to eat is a superpower.",
        "B) Useless, but at least I can pick restaurant spots easily.",
        "C) No, hearing people debate tacos all day sounds exhausting.",
        "D) Absolutely; I'll weaponize lunch cravings."
      ]
    },
    {
      id: "cat18_q184",
      question: "Heavy winter coat in summer, or thin swimsuit in a freezing blizzard?",
      options: [
        "A) Swimsuit in a blizzard. Let's embrace the chaos and freeze fast.",
        "B) Winter coat in summer so I can sweat out my problems.",
        "C) Neither; I'm staying inside with the AC blasting.",
        "D) Blizzard swimsuit, purely for the screenshot."
      ]
    },
    {
      id: "cat18_q185",
      question: "15 minutes late to everything, or 45 minutes awkwardly early?",
      options: [
        "A) 45 minutes early. I'll sit in my car and scroll my phone in peace.",
        "B) 15 minutes late; punctuality is a social construct.",
        "C) Neither; arriving on time is my toxic trait.",
        "D) Early so I can stake out the best seating."
      ]
    },
    {
      id: "cat18_q186",
      question: "Clothes slightly damp all the time, or shoes that squeak loudly with every step?",
      options: [
        "A) Squeaky shoes. I'll become a human percussion instrument.",
        "B) Damp clothes is a fungal nightmare. Hard pass.",
        "C) Walking barefoot instead.",
        "D) Squeaky shoes so people hear me coming a mile away."
      ]
    },
    {
      id: "cat18_q187",
      question: "Pinocchio nose when lying, or ears flap wildly when nervous?",
      options: [
        "A) Flapping ears. At least it's funny, not a straight-up giveaway.",
        "B) Pinocchio nose; I'll just stop lying (impossible).",
        "C) Ears flapping like helicopter blades.",
        "D) Neither; I choose absolute stealth."
      ]
    },
    {
      id: "cat18_q188",
      question: "Only watch 1980s movies, or only listen to 1920s music?",
      options: [
        "A) 80s movies all day every day. Give me synth-pop and action heroes.",
        "B) 1920s jazz music sounds classy until I go insane.",
        "C) 80s movies; at least there's color and dialogue.",
        "D) Absolute silence over both."
      ]
    },
    {
      id: "cat18_q189",
      question: "Invisible when you close your eyes, or fly two inches off the ground?",
      options: [
        "A) Fly two inches off the ground. Avoid stepping in puddles forever.",
        "B) Invisible when eyes are closed. How do I know where I'm going?",
        "C) Flying two inches up is the ultimate flex.",
        "D) Invisible eyes-closed mode for when door-to-door salesmen show up."
      ]
    },
    {
      id: "cat18_q190",
      question: "Fight one giant human-smart chicken, or 100 chicken-smart humans?",
      options: [
        "A) 100 chicken-smart humans. I can outsmart them easily.",
        "B) Giant human-smart chicken sounds like a horror boss fight.",
        "C) Neither; I'm negotiating a treaty with the chickens.",
        "D) Giant chicken. Let's settle this in the arena."
      ]
    }
  ]
};// Adding Category 19 to our cardDeck structure in cards.js
cardDeck.cat19 = {
  name: "Pure, Unadulterated Chaos",
  tierMin: "unlocked",
  questions: [
    {
      id: "cat19_q191",
      question: "What everyday object looks super suspicious if you carry 5+ of them at once?",
      options: [
        "A) Cucumbers.",
        "B) Spatulas.",
        "C) Tubes of toothpaste.",
        "D) Rolls of duct tape."
      ]
    },
    {
      id: "cat19_q192",
      question: "Swap lives with a cartoon character for 24 hours: who are you?",
      options: [
        "A) Homer Simpson—just eating donuts and slacking off.",
        "B) Bugs Bunny—pure chaotic neutral energy.",
        "C) Squidward—taking a well-deserved nap.",
        "D) SpongeBob—flipping burgers with zero stress."
      ]
    },
    {
      id: "cat19_q193",
      question: "Most chaotic thing to whisper to a stranger in an elevator before walking out?",
      options: [
        "A) 'They're onto us. Act normal.'",
        "B) 'Don't press floor four. Just trust me.'",
        "C) 'Did you hear that scratching noise in the ceiling?'",
        "D) 'Initiate countdown.'"
      ]
    },
    {
      id: "cat19_q194",
      question: "Describe your cooking style using a horror movie title.",
      options: [
        "A) The Texas Chainsaw Massacre (everything is chopped aggressively).",
        "B) Final Destination (every meal is an accident waiting to happen).",
        "C) Bird Box (cooking blindly and hoping it tastes good).",
        "D) The Blair Witch Project (lost in the kitchen, send help)."
      ]
    },
    {
      id: "cat19_q195",
      question: "Make one harmless thing illegal just to watch society adjust:",
      options: [
        "A) Walking slow in the middle of grocery store aisles.",
        "B) Using speakerphone in public spaces.",
        "C) Hitting reply-all on company emails.",
        "D) Wearing socks with sandals."
      ]
    },
    {
      id: "cat19_q196",
      question: "What secret superpower does your phone have that it won't admit?",
      options: [
        "A) Hiding my keys and wallet in a parallel dimension.",
        "B) Listening to my random thoughts to curate scary accurate ads.",
        "C) Slowing down intentionally when I have low battery.",
        "D) Emitting a frequency that attracts dust to the screen."
      ]
    },
    {
      id: "cat19_q197",
      question: "Combine two unrelated sports into a new sport—what are we playing?",
      options: [
        "A) Chess boxing, but with Mario Kart items.",
        "B) Bowling on roller skates.",
        "C) Competitive grocery cart racing.",
        "D) Golf, but with dodgeballs."
      ]
    },
    {
      id: "cat19_q198",
      question: "Bizarrest serious advice an older relative gave you:",
      options: [
        "A) 'Always keep a potato in your pocket for good luck.'",
        "B) 'Never look a pigeon directly in the eye or it will curse your lineage.'",
        "C) 'If you sleep with a spoon under your pillow, you'll win the lottery.'",
        "D) 'Always salt your shadow on Tuesdays.'"
      ]
    },
    {
      id: "cat19_q199",
      question: "What is your signature victory dance for minor achievements?",
      options: [
        "A) The awkward shoulder shimmy while nodding slowly.",
        "B) Two finger guns and a dramatic wink at nobody.",
        "C) A tiny hop and a low-key fist pump.",
        "D) Falling face-first onto the couch in pure relief."
      ]
    },
    {
      id: "cat19_q200",
      question: "What is your expertise in a field that does not matter at all?",
      options: [
        "A) World champion at guessing the exact temperature of leftovers in the fridge.",
        "B) Professional at untangling charging cords in the dark.",
        "C) Elite app-tab management and browser preservation.",
        "D) Knowing every meme format from 2012."
      ]
    }
  ]
};