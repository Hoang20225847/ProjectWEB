const MembershipTier = require('../models/MembershipTier');
const MemberBenefit = require('../models/MemberBenefit');
const PointTransaction = require('../models/PointTransaction');
const MembershipLog = require('../models/MembershipLog');
const Voucher = require('../models/Voucher');
const AccountUser = require('../models/AccountUsers');
const UserVoucher = require('../models/UserVoucher');
const Order = require('../models/Orders');

/** Phí ship mặc định (đồng) khi chưa áp dụng miễn phí */
const DEFAULT_SHIPPING_FEE_DONG = 40000;

let seedPromise = null;

async function ensureMembershipSeed() {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const n = await MembershipTier.countDocuments();
    if (n > 0) return;
    await MembershipTier.insertMany([
      {
        slug: 'silver',
        name: 'Bạc',
        sortOrder: 1,
        minTotalSpentDong: 0,
        discountPercent: 5,
        shipFreeAll: false,
        shipFreeMinSubtotalDong: 300_000,
        pointsPer1000Vnd: 10,
        active: true,
      },
      {
        slug: 'gold',
        name: 'Vàng',
        sortOrder: 2,
        minTotalSpentDong: 1_000_000,
        discountPercent: 10,
        shipFreeAll: false,
        shipFreeMinSubtotalDong: 200_000,
        pointsPer1000Vnd: 12,
        active: true,
      },
      {
        slug: 'diamond',
        name: 'Kim cương',
        sortOrder: 3,
        minTotalSpentDong: 5_000_000,
        discountPercent: 15,
        shipFreeAll: true,
        shipFreeMinSubtotalDong: null,
        pointsPer1000Vnd: 15,
        active: true,
      },
    ]);
  })();
  return seedPromise;
}

async function pickTierBySpend(totalSpentDong) {
  await ensureMembershipSeed();
  const spend = Math.max(0, Math.round(Number(totalSpentDong) || 0));
  const tiers = await MembershipTier.find({ active: true }).sort({ minTotalSpentDong: -1 }).lean();
  const t = tiers.find((x) => spend >= x.minTotalSpentDong);
  return t || tiers[tiers.length - 1] || null;
}

/**
 * Tiến độ chi tiêu tích lũy trong khoảng từ hạng hiện tại → hạng kế tiếp (theo minTotalSpentDong).
 */
async function computeMembershipSpendProgress(totalSpentDong) {
  await ensureMembershipSeed();
  const spend = Math.max(0, Math.round(Number(totalSpentDong) || 0));
  const current = await pickTierBySpend(spend);
  if (!current) {
    return {
      totalSpentDong: spend,
      currentTierMin: 0,
      currentTierName: '',
      currentTierSlug: '',
      nextTierName: null,
      nextTierSlug: null,
      nextTierMin: null,
      remainingDongToNext: null,
      progressPercent: 0,
      isMaxTier: true,
    };
  }
  const tiersAsc = await MembershipTier.find({ active: true }).sort({ minTotalSpentDong: 1, sortOrder: 1 }).lean();
  const curMin = Math.max(0, Math.round(Number(current.minTotalSpentDong) || 0));
  const nextTier = tiersAsc.find((t) => Math.round(Number(t.minTotalSpentDong) || 0) > curMin) || null;

  if (!nextTier) {
    return {
      totalSpentDong: spend,
      currentTierMin: curMin,
      currentTierName: current.name,
      currentTierSlug: current.slug,
      nextTierName: null,
      nextTierSlug: null,
      nextTierMin: null,
      remainingDongToNext: 0,
      progressPercent: 100,
      isMaxTier: true,
    };
  }

  const rangeEnd = Math.round(Number(nextTier.minTotalSpentDong) || 0);
  const span = Math.max(1, rangeEnd - curMin);
  const rawPct = ((spend - curMin) / span) * 100;
  const progressPercent = Math.max(0, Math.min(100, Math.round(rawPct * 10) / 10));
  const remainingDongToNext = Math.max(0, rangeEnd - spend);

  return {
    totalSpentDong: spend,
    currentTierMin: curMin,
    currentTierName: current.name,
    currentTierSlug: current.slug,
    nextTierName: nextTier.name,
    nextTierSlug: nextTier.slug,
    nextTierMin: rangeEnd,
    remainingDongToNext,
    progressPercent,
    isMaxTier: false,
  };
}

async function loadBenefitOverrides(tierId) {
  if (!tierId) return [];
  return MemberBenefit.find({ membershipTier: tierId, active: true }).sort({ sortOrder: 1 }).lean();
}

function applyBenefitOverrides(baseTier, benefits) {
  let discountPercent = baseTier.discountPercent;
  let shipFreeAll = baseTier.shipFreeAll;
  let shipFreeMin = baseTier.shipFreeMinSubtotalDong;
  let pointsPer1000 = baseTier.pointsPer1000Vnd;
  for (const b of benefits) {
    if (b.benefitKind === 'order_discount_override' && b.payload && Number.isFinite(Number(b.payload.percent))) {
      discountPercent = Number(b.payload.percent);
    }
    if (b.benefitKind === 'free_shipping_override') {
      if (b.payload && b.payload.all === true) shipFreeAll = true;
      if (b.payload && Number.isFinite(Number(b.payload.minOrderDong))) {
        shipFreeMin = Number(b.payload.minOrderDong);
        shipFreeAll = false;
      }
    }
    if (b.benefitKind === 'points_multiplier' && b.payload && Number.isFinite(Number(b.payload.multiplier))) {
      pointsPer1000 = Math.round(pointsPer1000 * Number(b.payload.multiplier));
    }
  }
  return { discountPercent, shipFreeAll, shipFreeMin, pointsPer1000 };
}

async function findActiveVoucher(code) {
  if (!code || !String(code).trim()) return null;
  const c = String(code).trim().toUpperCase();
  const now = new Date();
  const v = await Voucher.findOne({
    code: c,
    active: true,
    startsAt: { $lte: now },
    endsAt: { $gte: now },
  }).lean();
  if (!v) return null;
  if (v.maxRedemptions != null && v.redemptionCount >= v.maxRedemptions) return null;
  return v;
}

async function countVoucherUsesByAccount(email, code) {
  if (!email || !code) return 0;
  return Order.countDocuments({
    email: String(email).toLowerCase().trim(),
    voucherCode: String(code).toUpperCase().trim(),
    voucherConsumed: true,
    status: { $ne: 'Đã hủy' },
  });
}

function normalizeTierSlugList(list) {
  return (Array.isArray(list) ? list : [])
    .map((s) => String(s || '').trim().toLowerCase())
    .filter(Boolean);
}

function extractBookId(rawBookId) {
  if (!rawBookId) return '';
  if (typeof rawBookId === 'string') return rawBookId;
  if (rawBookId._id) return String(rawBookId._id);
  return String(rawBookId);
}

function computeVoucherEligibleSubtotal({ voucher, items, fallbackSubtotal }) {
  const allBooks = !!voucher?.applyAllBooks;
  const allowedIds = new Set((voucher?.eligibleBookIds || []).map((id) => String(id)));
  if (allBooks || allowedIds.size === 0 || !Array.isArray(items) || items.length === 0) {
    return Math.max(0, Math.round(Number(fallbackSubtotal) || 0));
  }
  let eligible = 0;
  for (const it of items) {
    const bid = extractBookId(it?.bookId);
    if (!bid || !allowedIds.has(String(bid))) continue;
    eligible += Math.max(0, Math.round(Number(it?.totalPrice) || 0));
  }
  return Math.max(0, eligible);
}

/**
 * @param {object} opts
 * @param {string} opts.email
 * @param {number} opts.goodsSubtotalDong — tổng tiền hàng (đồng)
 * @param {string} [opts.voucherCode]
 * @returns {Promise<object>}
 */
async function quoteCheckout(opts) {
  await ensureMembershipSeed();
  const goodsSubtotalDong = Math.max(0, Math.round(Number(opts.goodsSubtotalDong) || 0));
  const items = Array.isArray(opts.items) ? opts.items : [];
  const email = String(opts.email || '').toLowerCase().trim();

  const account = email
    ? await AccountUser.findOne({ email }).populate('membershipTier').lean()
    : null;
  const availablePoints = Math.max(0, Math.round(Number(account?.loyaltyPoints) || 0));

  let tier = null;
  let tierSlug = '';
  let tierName = '';
  let discountPercent = 0;
  let shipFreeAll = false;
  let shipFreeMin = null;
  let pointsPer1000 = 10;

  if (account && account.isMember) {
    const spend = Math.max(0, Math.round(Number(account.totalSpentDong) || 0));
    tier = await pickTierBySpend(spend);
    if (tier) {
      const benefits = await loadBenefitOverrides(tier._id);
      const eff = applyBenefitOverrides(tier, benefits);
      discountPercent = eff.discountPercent;
      shipFreeAll = eff.shipFreeAll;
      shipFreeMin = eff.shipFreeMin;
      pointsPer1000 = eff.pointsPer1000;
      tierSlug = tier.slug;
      tierName = tier.name;
    }
  }

  let memberDiscountDong = Math.floor((goodsSubtotalDong * discountPercent) / 100);
  let afterMember = Math.max(0, goodsSubtotalDong - memberDiscountDong);

  let voucherDiscountDong = 0;
  let voucherTitle = '';
  const v = await findActiveVoucher(opts.voucherCode);
  if (v) {
    const audienceType = String(v.audienceType || 'member').toLowerCase();
    const tiers = normalizeTierSlugList(v.tierSlugs);
    const isMember = !!(account && account.isMember);
    const tierOk = !tiers.length || (tierSlug && tiers.includes(String(tierSlug).toLowerCase()));
    let audienceOk = false;
    if (audienceType === 'all') audienceOk = !!account;
    else if (audienceType === 'member') audienceOk = isMember;
    else if (audienceType === 'tiers') audienceOk = isMember && tierOk;

    const voucherEligibleSubtotal = computeVoucherEligibleSubtotal({
      voucher: v,
      items,
      fallbackSubtotal: goodsSubtotalDong,
    });
    const ratio =
      goodsSubtotalDong > 0 ? Math.min(1, Math.max(0, voucherEligibleSubtotal / goodsSubtotalDong)) : 0;
    const voucherBaseDong = Math.floor(afterMember * ratio);

    const usesLimit = v.maxUsesPerAccount == null ? null : Math.max(1, Number(v.maxUsesPerAccount) || 1);
    let perAccountOk = true;
    if (audienceOk && usesLimit != null && email) {
      const usedCount = await countVoucherUsesByAccount(email, v.code);
      perAccountOk = usedCount < usesLimit;
    }
    if (audienceOk && perAccountOk && voucherBaseDong >= (v.minOrderDong || 0)) {
      if (v.discountType === 'percent') {
        voucherDiscountDong = Math.floor((voucherBaseDong * Number(v.discountValue)) / 100);
      } else {
        voucherDiscountDong = Math.min(voucherBaseDong, Math.round(Number(v.discountValue) || 0));
      }
      if (v.maxDiscountDong != null) {
        const cap = Math.max(0, Math.round(Number(v.maxDiscountDong) || 0));
        voucherDiscountDong = Math.min(voucherDiscountDong, cap);
      }
      voucherTitle = v.title;
    }
  }

  const afterVoucher = Math.max(0, afterMember - voucherDiscountDong);

  let shippingFeeDong = DEFAULT_SHIPPING_FEE_DONG;
  if (account && account.isMember && tier) {
    if (shipFreeAll) shippingFeeDong = 0;
    else if (shipFreeMin != null && afterVoucher >= shipFreeMin) shippingFeeDong = 0;
  }

  const redeemPointsRequested = Math.max(0, Math.round(Number(opts.redeemPoints) || 0));
  const canRedeemPoints = !!(account && account.isMember);
  const baseTotalBeforePoints = Math.max(0, afterVoucher + shippingFeeDong);
  const pointsDiscountDong = canRedeemPoints
    ? Math.min(redeemPointsRequested, availablePoints, baseTotalBeforePoints)
    : 0;
  const pointsRedeemed = pointsDiscountDong;
  const totalDong = Math.max(0, baseTotalBeforePoints - pointsDiscountDong);

  return {
    goodsSubtotalDong,
    memberDiscountDong,
    voucherDiscountDong,
    voucherTitle,
    pointsDiscountDong,
    pointsRedeemed,
    redeemPointsRequested,
    availablePoints,
    shippingFeeDong,
    totalDong,
    tierSlug,
    tierName,
    discountPercent,
    isMember: !!(account && account.isMember),
    voucherCodeApplied: voucherDiscountDong > 0 && v ? String(v.code || '').toUpperCase() : '',
    defaultShippingFeeDong: DEFAULT_SHIPPING_FEE_DONG,
  };
}

async function consumeLoyaltyPoints(email, points, orderId) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const redeemPoints = Math.max(0, Math.round(Number(points) || 0));
  if (!normalizedEmail || redeemPoints <= 0) return true;
  const account = await AccountUser.findOneAndUpdate(
    { email: normalizedEmail, loyaltyPoints: { $gte: redeemPoints } },
    { $inc: { loyaltyPoints: -redeemPoints } },
    { new: true },
  );
  if (!account) return false;
  await PointTransaction.create({
    email: normalizedEmail,
    account: account._id,
    type: 'redeem',
    points: -redeemPoints,
    balanceAfter: Math.max(0, Math.round(Number(account.loyaltyPoints) || 0)),
    order: orderId || null,
    note: `Sử dụng điểm cho đơn #${String(orderId || '').slice(-6)}`,
    meta: { redeemPoints, orderId: orderId ? String(orderId) : null },
  });
  return true;
}

async function releaseLoyaltyPoints(email, points, orderId) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const refundPoints = Math.max(0, Math.round(Number(points) || 0));
  if (!normalizedEmail || refundPoints <= 0) return false;
  const account = await AccountUser.findOneAndUpdate(
    { email: normalizedEmail },
    { $inc: { loyaltyPoints: refundPoints } },
    { new: true },
  );
  if (!account) return false;
  await PointTransaction.create({
    email: normalizedEmail,
    account: account._id,
    type: 'adjust',
    points: refundPoints,
    balanceAfter: Math.max(0, Math.round(Number(account.loyaltyPoints) || 0)),
    order: orderId || null,
    note: `Hoàn điểm cho đơn hủy #${String(orderId || '').slice(-6)}`,
    meta: { refundPoints, orderId: orderId ? String(orderId) : null, reason: 'order_cancel' },
  });
  return true;
}

async function syncAccountTierDoc(accountDoc) {
  await ensureMembershipSeed();
  const spend = Math.max(0, Math.round(Number(accountDoc.totalSpentDong) || 0));
  const tier = await pickTierBySpend(spend);
  if (tier) accountDoc.membershipTier = tier._id;
  return tier;
}

async function registerMembership(email) {
  await ensureMembershipSeed();
  const account = await AccountUser.findOne({ email: String(email).toLowerCase().trim() });
  if (!account) return { ok: false, message: 'Không tìm thấy tài khoản' };
  account.isMember = true;
  account.memberSince = new Date();
  account.memberExpiredAt = null;
  await syncAccountTierDoc(account);
  await account.save();
  return { ok: true, account };
}

async function cancelMembership(email) {
  const account = await AccountUser.findOne({ email: String(email).toLowerCase().trim() });
  if (!account) return { ok: false, message: 'Không tìm thấy tài khoản' };
  account.isMember = false;
  account.membershipTier = null;
  account.memberExpiredAt = new Date();
  await account.save();
  return { ok: true, account };
}

async function appendPointTx(accountDoc, { type, points, orderId, note, meta }) {
  const nextBal = Math.max(0, Math.round((accountDoc.loyaltyPoints || 0) + points));
  accountDoc.loyaltyPoints = nextBal;
  await PointTransaction.create({
    email: accountDoc.email,
    account: accountDoc._id,
    type,
    points,
    balanceAfter: nextBal,
    order: orderId || null,
    note: note || '',
    meta: meta || {},
  });
}

/**
 * Gọi khi đơn chuyển sang Hoàn thành: cộng chi tiêu, xét nâng hạng, tích điểm.
 */
async function onOrderCompleted(order) {
  await ensureMembershipSeed();
  const email = String(order.email || '').toLowerCase().trim();
  if (!email) return;
  const account = await AccountUser.findOne({ email });
  if (!account) return;
  /** Đồng bộ với getAccount: tham gia chương trình nếu isMember HOẶC đã gán hạng */
  const inMembershipProgram = !!(account.isMember || account.membershipTier);
  if (!inMembershipProgram) return;

  const amount = Math.max(0, Math.round(Number(order.totalAmount) || 0));
  const prevTierId = account.membershipTier ? String(account.membershipTier) : null;

  account.totalSpentDong = Math.max(0, Math.round(Number(account.totalSpentDong) || 0)) + amount;
  const newTier = await pickTierBySpend(account.totalSpentDong);
  if (newTier) {
    const nextId = String(newTier._id);
    account.membershipTier = newTier._id;
    if (prevTierId && nextId !== prevTierId) {
      const fromT = await MembershipTier.findById(prevTierId).select('slug').lean();
      await MembershipLog.create({
        email,
        fromTierSlug: fromT?.slug || '',
        toTierSlug: newTier.slug,
        totalSpentDong: account.totalSpentDong,
        reason: 'spend_threshold',
        order: order._id,
      });
    }
  }

  const tier = account.membershipTier
    ? await MembershipTier.findById(account.membershipTier).lean()
    : null;
  const earnRate = tier ? Number(tier.pointsPer1000Vnd) || 10 : 10;
  const earnPts = Math.max(0, Math.floor(amount / 1000) * earnRate);
  if (earnPts > 0) {
    await appendPointTx(account, {
      type: 'earn',
      points: earnPts,
      orderId: order._id,
      note: `Tích điểm đơn #${String(order._id).slice(-6)}`,
      meta: { orderTotalDong: amount },
    });
  }

  await account.save();
}

async function incrementVoucherUse(code) {
  if (!code) return;
  await Voucher.updateOne(
    { code: String(code).trim().toUpperCase() },
    { $inc: { redemptionCount: 1 } },
  );
}

async function consumeUserVoucher(email, code, orderId) {
  if (!email || !code) return;
  const normalizedEmail = String(email).toLowerCase().trim();
  const normalizedCode = String(code).toUpperCase().trim();
  const usedAt = new Date();
  const updated = await UserVoucher.findOneAndUpdate(
    {
      email: normalizedEmail,
      code: normalizedCode,
      status: 'active',
    },
    {
      $set: {
        status: 'used',
        usedAt,
        orderId: orderId || null,
      },
    },
    { sort: { assignedAt: 1 }, new: true },
  );
  if (updated) return true;
  const voucher = await Voucher.findOne({ code: normalizedCode }, { _id: 1 }).lean();
  if (!voucher) return false;
  await UserVoucher.updateOne(
    { email: normalizedEmail, voucher: voucher._id },
    {
      $set: {
        code: normalizedCode,
        status: 'used',
        usedAt,
        orderId: orderId || null,
      },
      $setOnInsert: {
        email: normalizedEmail,
        voucher: voucher._id,
        assignedBy: 'manual-code',
        assignedAt: usedAt,
      },
    },
    { upsert: true },
  );
  return true;
}

async function releaseUserVoucher(email, code, orderId) {
  if (!email || !code || !orderId) return;
  const result = await UserVoucher.updateOne(
    {
      email: String(email).toLowerCase().trim(),
      code: String(code).toUpperCase().trim(),
      orderId,
      status: 'used',
    },
    {
      $set: { status: 'active', usedAt: null, orderId: null },
    },
  );
  if ((result?.modifiedCount || 0) > 0) return true;
  const fallback = await UserVoucher.updateOne(
    { orderId, status: 'used' },
    { $set: { status: 'active', usedAt: null, orderId: null } },
  );
  return (fallback?.modifiedCount || 0) > 0;
}

async function decrementVoucherUse(code) {
  if (!code) return;
  await Voucher.updateOne(
    { code: String(code).trim().toUpperCase(), redemptionCount: { $gt: 0 } },
    { $inc: { redemptionCount: -1 } },
  );
}

module.exports = {
  ensureMembershipSeed,
  pickTierBySpend,
  computeMembershipSpendProgress,
  quoteCheckout,
  registerMembership,
  cancelMembership,
  onOrderCompleted,
  syncAccountTierDoc,
  DEFAULT_SHIPPING_FEE_DONG,
  incrementVoucherUse,
  decrementVoucherUse,
  consumeUserVoucher,
  releaseUserVoucher,
  findActiveVoucher,
  consumeLoyaltyPoints,
  releaseLoyaltyPoints,
};
