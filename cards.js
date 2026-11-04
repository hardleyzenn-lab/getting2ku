// ==========================================
// 1. TIER LIMITS & ACCESS CONFIGURATION
// ==========================================
const TIER_CONFIG = {
  free: {
    maxCardsPerWeek: 5,
    allowedCategories: [1, 2, 3, 4, 5],
    videoBonusCards: 5, // Requires 5 video completions
    canManualSelect: false
  },
  tier_30_day: {
    baseWeeklyCards: 10,
    videoBonusCards: 5,
    allowedCategories: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    canManualSelect: false
  },
  unlocked: {
    monthlyCap: 50,
    cycleSize: 5, // Unlimited 5-card set cycles up to 50 cap
    allowedCategories: Array.from({ length: 19 }, (_, i) => i + 1), // 1 through 19
    manualSelectCategories: [6, 7, 8, 9, 10, 11, 12],
    maxManualPicksPerMonth: 20
  }
};

const TIER_ORDER = {
  free: 0,
  tier_30_day: 1,
  unlocked: 2
};

const questionsScript = document.createElement('script');
questionsScript.src = new URL('g2ku-questions.js', document.currentScript.src).href;
const questionsReady = new Promise((resolve, reject) => {
  questionsScript.addEventListener('load', () => {
    if (typeof cardDeck === 'undefined') {
      reject(new Error('The question deck did not initialize.'));
      return;
    }
    resolve();
  }, { once: true });
  questionsScript.addEventListener('error', () => {
    reject(new Error('Could not load the G2KU question deck.'));
  }, { once: true });
});
document.head.appendChild(questionsScript);

function getTierConfig(tier) {
  const config = TIER_CONFIG[tier];
  if (!config) {
    throw new Error(`Unknown G2KU access tier: ${tier}`);
  }
  return config;
}

function getQuestionCategories(tier, selectedCategoryIds = []) {
  const config = getTierConfig(tier);
  if (typeof cardDeck === 'undefined') {
    throw new Error('Load g2ku-questions.js before requesting cards.');
  }

  const selectedIds = new Set(selectedCategoryIds);
  return config.allowedCategories
    .map(categoryId => ({ categoryId, category: cardDeck[`cat${categoryId}`] }))
    .filter(({ categoryId, category }) =>
      category &&
      Array.isArray(category.questions) &&
      category.questions.length > 0 &&
      TIER_ORDER[category.tierMin] <= TIER_ORDER[tier] &&
      (selectedIds.size === 0 || selectedIds.has(categoryId))
    );
}

// ==========================================
// 2. USER SESSION & TRACKING STATE
// ==========================================
let userState = {
  tier: 'unlocked', // 'free' | 'tier_30_day' | 'unlocked'
  monthlyCardCount: 0,
  monthlyManualPicks: 0,
  weeklyCardCount: 0,
  selectedCategoryIds: []
};

// ==========================================
// 3. GATEKEEPER LOGIC: CHECK TIER LIMITS FIRST
// ==========================================
function canDrawCards(user, requestedPicksCount = 0) {
  const config = TIER_CONFIG[user.tier];
  if (!config) {
    return { allowed: false, reason: "Unknown access tier." };
  }

  if (user.tier === 'unlocked') {
    if (user.monthlyCardCount >= config.monthlyCap) {
      return { allowed: false, reason: "Monthly 50-card cap reached." };
    }
    if (requestedPicksCount > 0 && (user.monthlyManualPicks + requestedPicksCount > config.maxManualPicksPerMonth)) {
      return { allowed: false, reason: "Exceeds monthly manual pick limit (20 max for categories 6-12)." };
    }
  }

  if (user.tier === 'free' && user.weeklyCardCount >= config.maxCardsPerWeek) {
    return { allowed: false, reason: "Weekly free card limit reached." };
  }

  if (user.tier === 'tier_30_day' && user.weeklyCardCount >= (config.baseWeeklyCards + config.videoBonusCards)) {
    return { allowed: false, reason: "Weekly 30-day tier card limit reached." };
  }

  return { allowed: true };
}

function getRandomCategoryByWeight(availableCategories, randomValue = Math.random()) {
  const weights = {
    1: 10, 2: 10, 3: 10, 4: 10, 5: 10,
    6: 4.37, 7: 4.37, 8: 4.37, 9: 4.37, 10: 4.37, 11: 4.37, 12: 4.37, 16: 4.37,
    13: 2.5, 14: 2.5, 15: 2.5, 17: 2.5, 18: 2.5, 19: 2.5
  };

  const validEntries = availableCategories.map(cat => ({
    categoryId: cat.categoryId,
    category: cat.category,
    weight: weights[cat.categoryId] || 5
  }));

  const totalWeight = validEntries.reduce((sum, entry) => sum + entry.weight, 0);
  let randomNum = randomValue * totalWeight;

  for (const entry of validEntries) {
    if (randomNum < entry.weight) {
      return entry;
    }
    randomNum -= entry.weight;
  }

  return validEntries[0];
}

function getSeededRandomValue(seed) {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

// ==========================================
// 4. ENGINE INTERFACE & ROUTER BRIDGE
// ==========================================
const G2KUCardEngine = {
  state: userState,
  ready: questionsReady,

  getCardLimit(tier) {
    const config = getTierConfig(tier);
    if (tier === 'unlocked') return config.monthlyCap;
    if (tier === 'tier_30_day') {
      return config.baseWeeklyCards + config.videoBonusCards;
    }
    return config.maxCardsPerWeek;
  },

  isVibeCheckCheckpoint(cardIndex, tier) {
    if (!Number.isInteger(cardIndex) || cardIndex < 0) {
      throw new Error('Card index must be a non-negative integer.');
    }
    const cardLimit = this.getCardLimit(tier);
    if (cardIndex >= cardLimit) {
      throw new Error('Card index exceeds the card limit.');
    }
    return (cardIndex + 1) % 5 === 0 || cardIndex + 1 === cardLimit;
  },

  checkSubscriptionGate() {
    const gateCheck = canDrawCards(this.state);
    if (!gateCheck.allowed) {
      return {
        status: 'LOCKED',
        message: gateCheck.reason
      };
    }
    return { status: 'ALLOWED' };
  },

  getAvailableCategories() {
    return getQuestionCategories(this.state.tier, this.state.selectedCategoryIds)
      .map(({ categoryId }) => categoryId);
  },

  getCard(
    cardIndex = this.state.weeklyCardCount,
    tier = this.state.tier,
    selectedCategoryIds = this.state.selectedCategoryIds,
    seed = null
  ) {
    if (typeof cardDeck === 'undefined') {
      throw new Error('Wait for the question deck to finish loading.');
    }
    if (!Number.isInteger(cardIndex) || cardIndex < 0) {
      throw new Error('Card index must be a non-negative integer.');
    }

    const categories = getQuestionCategories(tier, selectedCategoryIds);
    if (categories.length === 0) {
      throw new Error('No question categories are available for this access tier.');
    }

    const categoryEntry = getRandomCategoryByWeight(
      categories,
      seed === null ? Math.random() : getSeededRandomValue(seed)
    );
    const questionIndex = cardIndex % categoryEntry.category.questions.length;
    const question = categoryEntry.category.questions[questionIndex];

    return {
      id: question.id,
      categoryId: categoryEntry.categoryId,
      category: categoryEntry.category.name,
      prompt: question.question,
      options: [...question.options]
    };
  },

  submitAnswer(cardIndex, answerText) {
    const gateCheck = canDrawCards(this.state);
    if (!gateCheck.allowed) {
      return { success: false, reason: gateCheck.reason, triggerVibeCheck: false };
    }

    this.state.weeklyCardCount++;
    this.state.monthlyCardCount++;
    
    const triggerVibeCheck = this.isVibeCheckCheckpoint(
      this.state.weeklyCardCount - 1,
      this.state.tier
    );
    return { success: true, triggerVibeCheck };
  },

  triggerVideoUnlock() {
    const config = TIER_CONFIG[this.state.tier];
    if (config.videoBonusCards) {
      this.state.weeklyCardCount = Math.max(0, this.state.weeklyCardCount - config.videoBonusCards);
      return { success: true, message: "Video bonus unlocked! Extra cards added." };
    }
    return { success: false, message: "No video bonus available for this tier." };
  },

  createDuelSession({ roomCode, hostPlayerId, guestPlayerId = null, tier = 'free' }) {
    if (!roomCode || !hostPlayerId || hostPlayerId === guestPlayerId) {
      throw new Error('A duel needs a room code and two distinct player IDs.');
    }
    getTierConfig(tier);
    return {
      roomCode,
      hostPlayerId,
      guestPlayerId,
      tier,
      hostAnswers: {},
      guestAnswers: {},
      hostCompleted: false,
      guestCompleted: false
    };
  },

  joinDuelSession(session, guestPlayerId) {
    if (!guestPlayerId || guestPlayerId === session.hostPlayerId) {
      throw new Error('The second player must be different from the host.');
    }
    if (session.guestPlayerId && session.guestPlayerId !== guestPlayerId) {
      throw new Error('This duel already has a second player.');
    }
    return { ...session, guestPlayerId };
  },

  getDuelState(session, playerId) {
    const role = playerId === session.hostPlayerId
      ? 'host'
      : session.guestPlayerId && playerId === session.guestPlayerId
        ? 'guest'
        : null;
    if (!role) {
      throw new Error('This player is not part of the duel.');
    }

    const paired = Boolean(session.guestPlayerId);
    const isHost = role === 'host';
    const myCompleted = isHost ? session.hostCompleted : session.guestCompleted;
    const partnerCompleted = isHost ? session.guestCompleted : session.hostCompleted;

    let status = 'in_progress';
    if (!paired) {
      status = 'waiting_for_partner';
    } else if (!myCompleted) {
      status = 'answering';
    } else if (!partnerCompleted) {
      status = 'waiting_for_partner_completion';
    } else {
      status = 'session_complete';
    }

    let revealedData = null;
    if (status === 'session_complete' || (!isHost && myCompleted)) {
      revealedData = {
        hostAnswers: session.hostAnswers,
        guestAnswers: session.guestAnswers
      };
    }

    return {
      roomCode: session.roomCode,
      tier: session.tier,
      role,
      status,
      myCompleted,
      partnerCompleted,
      revealedData
    };
  },

  submitDuelSessionAnswers(session, playerId, answersMap) {
    if (!session.guestPlayerId) {
      throw new Error('Wait for your partner to join before finishing.');
    }
    if (playerId !== session.hostPlayerId && playerId !== session.guestPlayerId) {
      throw new Error('This player is not part of the duel.');
    }

    const isHost = playerId === session.hostPlayerId;
    return {
      ...session,
      hostAnswers: isHost ? answersMap : session.hostAnswers,
      guestAnswers: !isHost ? answersMap : session.guestAnswers,
      hostCompleted: isHost ? true : session.hostCompleted,
      guestCompleted: !isHost ? true : session.guestCompleted
    };
  }
};