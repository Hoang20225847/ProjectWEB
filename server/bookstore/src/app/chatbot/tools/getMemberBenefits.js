const MembershipTier = require('../../models/MembershipTier');
const MemberBenefit = require('../../models/MemberBenefit');
const ChatbotCache = require('../models/ChatbotCache');
const config = require('../config');

/**
 * Trả về thông tin hạng + ưu đãi public theo tier.
 * Không trả về dữ liệu kế toán/nội bộ.
 * @param {{tierSlug?:string}} args
 */
async function getMemberBenefits(args = {}) {
  const tierSlug = String(args.tierSlug || '').toLowerCase();
  const cacheKey = `member_benefits:${tierSlug || 'all'}`;
  const cached = await ChatbotCache.getValue(cacheKey);
  if (cached) return cached;

  const tierQuery = { active: true };
  if (tierSlug) tierQuery.slug = tierSlug;
  const tiers = await MembershipTier.find(tierQuery).sort({ sortOrder: 1 }).lean();
  if (!tiers.length) {
    const empty = { tiers: [] };
    await ChatbotCache.setValue(cacheKey, empty, config.cache.memberBenefitTtlSec);
    return empty;
  }

  const tierIds = tiers.map((t) => t._id);
  const benefits = await MemberBenefit.find({
    active: true,
    membershipTier: { $in: tierIds },
  })
    .sort({ sortOrder: 1 })
    .lean();

  const byTier = new Map();
  for (const b of benefits) {
    const key = String(b.membershipTier);
    if (!byTier.has(key)) byTier.set(key, []);
    byTier.get(key).push({
      kind: b.benefitKind,
      title: b.title,
      payload: b.payload || {},
    });
  }

  const result = {
    tiers: tiers.map((t) => ({
      slug: t.slug,
      name: t.name,
      minTotalSpentDong: t.minTotalSpentDong,
      discountPercent: t.discountPercent,
      shipFreeAll: t.shipFreeAll,
      shipFreeMinSubtotalDong: t.shipFreeMinSubtotalDong,
      pointsPer1000Vnd: t.pointsPer1000Vnd,
      benefits: byTier.get(String(t._id)) || [],
    })),
  };

  await ChatbotCache.setValue(cacheKey, result, config.cache.memberBenefitTtlSec);
  return result;
}

module.exports = getMemberBenefits;
