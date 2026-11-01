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

// ==========================================
// 4. ENGINE INTERFACE & ROUTER BRIDGE
// ==========================================
const G2KUCardEngine = {
  state: userState,
  ready: questionsReady,

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
    selectedCategoryIds = this.state.selectedCategoryIds
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

    const categoryEntry = categories[cardIndex % categories.length];
    const questionIndex = Math.floor(cardIndex / categories.length) %
      categoryEntry.category.questions.length;
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
    
    // Trigger private vibe check every 5 cards
    const triggerVibeCheck = ((this.state.weeklyCardCount % 5) === 0);
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
      roundIndex: 0,
      answers: {}
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

  getDuelCard(session) {
    const cardLimit = session.tier === 'unlocked'
      ? TIER_CONFIG.unlocked.monthlyCap
      : session.tier === 'tier_30_day'
        ? TIER_CONFIG.tier_30_day.baseWeeklyCards + TIER_CONFIG.tier_30_day.videoBonusCards
        : TIER_CONFIG.free.maxCardsPerWeek;
    if (session.roundIndex >= cardLimit) {
      throw new Error('This session has reached its card limit.');
    }
    return this.getCard(session.roundIndex, session.tier);
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
    const answerCount = Object.keys(session.answers).length;
    const answersRevealed = paired && answerCount === 2;
    return {
      roomCode: session.roomCode,
      tier: session.tier,
      role,
      status: !paired
        ? 'waiting_for_partner'
        : answersRevealed
          ? 'answers_revealed'
          : 'waiting_for_answers',
      roundIndex: session.roundIndex,
      hasSubmitted: Object.prototype.hasOwnProperty.call(session.answers, playerId),
      answerCount,
      revealedAnswers: answersRevealed
        ? [
            { role: 'host', answer: session.answers[session.hostPlayerId] },
            { role: 'guest', answer: session.answers[session.guestPlayerId] }
          ]
        : null
    };
  },

  submitDuelAnswer(session, playerId, answer) {
    if (!session.guestPlayerId) {
      throw new Error('Wait for your partner to join before answering.');
    }
    if (playerId !== session.hostPlayerId && playerId !== session.guestPlayerId) {
      throw new Error('This player is not part of the duel.');
    }
    if (typeof answer !== 'string' || !answer.trim() || answer.length > 1000) {
      throw new Error('Answers must contain 1 to 1000 characters.');
    }
    if (Object.prototype.hasOwnProperty.call(session.answers, playerId)) {
      throw new Error('This player has already answered this card.');
    }

    return {
      ...session,
      answers: { ...session.answers, [playerId]: answer.trim() }
    };
  },

  advanceDuelRound(session, playerId) {
    if (playerId !== session.hostPlayerId) {
      throw new Error('Only the host can advance to the next card.');
    }
    if (!session.guestPlayerId) {
      throw new Error('Wait for your partner to join before continuing.');
    }
    if (Object.keys(session.answers).length !== 2) {
      throw new Error('Both players must answer before continuing.');
    }
    const nextRound = session.roundIndex + 1;
    const nextCardLimit = session.tier === 'unlocked'
      ? TIER_CONFIG.unlocked.monthlyCap
      : session.tier === 'tier_30_day'
        ? TIER_CONFIG.tier_30_day.baseWeeklyCards + TIER_CONFIG.tier_30_day.videoBonusCards
        : TIER_CONFIG.free.maxCardsPerWeek;
    if (nextRound >= nextCardLimit) {
      throw new Error('This session has reached its card limit.');
    }

    return { ...session, roundIndex: nextRound, answers: {} };
  }
};