export const PLAN_DEFINITIONS = {
  free: {
    id: 'free',
    title: 'Free',
    subtitle: 'Perfect to get started',
    monthly: 0,
    yearly: 0,
    monthlyPrice: 0,
    yearlyPrice: 0,
    duration: 'unlimited',
    popular: false,
    features: [
      'Generic AI chatbot',
      'Limited business chatbot',
      'Basic data visualization',
      '15 chats per month',
      '30-day chat history',
      'Community support',
    ],
  },
  starter: {
    id: 'starter',
    title: 'Starter',
    subtitle: 'For students and learners',
    monthly: 199,
    yearly: 1999,
    monthlyPrice: 199,
    yearlyPrice: 1999,
    duration: 'unlimited',
    popular: true,
    features: [
      'Generic + Business chatbot',
      'Interactive visualization',
      '150 chats per month',
      '60-day chat history',
      'Export chat history',
      'Priority support',
    ],
  },
  plus: {
    id: 'plus',
    title: 'Plus',
    subtitle: 'For power users',
    monthly: 999,
    yearly: 9999,
    monthlyPrice: 999,
    yearlyPrice: 9999,
    duration: 'unlimited',
    popular: false,
    features: [
      'Advanced business workflows',
      'Enhanced data visualization',
      '600 chats per month',
      'File upload (50 files, 100MB)',
      'Premium support',
      'Export reports & charts',
    ],
  },
  pro: {
    id: 'pro',
    title: 'Pro',
    subtitle: 'For teams & SMEs',
    monthly: 1999,
    yearly: 19999,
    monthlyPrice: 1999,
    yearlyPrice: 19999,
    duration: 'unlimited',
    popular: false,
    features: [
      'Team collaboration (5 users)',
      'Advanced analytics',
      'Custom branding',
      'API access',
      '1,500 chats per month',
      'Priority technical support',
    ],
  },
  business: {
    id: 'business',
    title: 'Business',
    subtitle: 'For enterprises',
    monthly: 2499,
    yearly: 24999,
    monthlyPrice: 2499,
    yearlyPrice: 24999,
    duration: 'unlimited',
    popular: false,
    features: [
      'Unlimited chats',
      'Unlimited file uploads',
      'Dedicated support manager',
      'Team management',
      'Advanced security',
      'SLA guarantee',
    ],
  },
};

export const PLAN_ORDER = ['free', 'starter', 'plus', 'pro', 'business'];
export const PERSONAL_PLAN_IDS = ['free', 'starter', 'plus', 'pro'];
export const BUSINESS_PLAN_IDS = ['business'];

export function getDefaultPricing() {
  return PLAN_ORDER.reduce((acc, planId) => {
    const plan = PLAN_DEFINITIONS[planId];
    acc[planId] = {
      name: plan.title,
      monthly: plan.monthly,
      yearly: plan.yearly,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      yearlyDiscountPercentage: plan.monthly > 0
        ? Number((((plan.monthly * 12) - plan.yearly) / (plan.monthly * 12) * 100).toFixed(1))
        : 0,
    };
    return acc;
  }, {});
}

export function mergePricingWithCatalog(pricing = {}) {
  return PLAN_ORDER.reduce((acc, planId) => {
    const base = PLAN_DEFINITIONS[planId];
    const override = pricing?.[planId] || {};
    const monthly = Number(override.monthly ?? override.monthlyPrice ?? base.monthly);
    const yearly = Number(override.yearly ?? override.yearlyPrice ?? base.yearly);
    acc[planId] = {
      ...base,
      name: base.title,
      monthly,
      yearly,
      monthlyPrice: monthly,
      yearlyPrice: yearly,
      yearlyDiscountPercentage: monthly > 0
        ? Number((override.yearlyDiscountPercentage ?? (((monthly * 12) - yearly) / (monthly * 12) * 100)).toFixed(1))
        : 0,
    };
    return acc;
  }, {});
}
