const mongoose = require('mongoose');
const AccountUser = require('../models/AccountUsers');
const MembershipTier = require('../models/MembershipTier');
const MemberBenefit = require('../models/MemberBenefit');
const Voucher = require('../models/Voucher');
const UserVoucher = require('../models/UserVoucher');
const MembershipLog = require('../models/MembershipLog');
const PointTransaction = require('../models/PointTransaction');
const { createNotificationHelper } = require('./NotificationController');
const {
  ensureMembershipSeed,
  quoteCheckout,
  incrementVoucherUse,
} = require('../services/membershipService');

function requireAdmin(req, res) {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Chỉ quản trị viên.' });
    return true;
  }
  return false;
}

class MembershipController {
  constructor() {
    this.normalizeTierSlugs = this.normalizeTierSlugs.bind(this);
    this.normalizeBookIds = this.normalizeBookIds.bind(this);
    this.normalizeVoucherPayload = this.normalizeVoucherPayload.bind(this);
    this.targetEmailsForVoucher = this.targetEmailsForVoucher.bind(this);
    this.publishPublicVoucherToWallet = this.publishPublicVoucherToWallet.bind(this);
    this.ensurePublicWalletForUser = this.ensurePublicWalletForUser.bind(this);

    this.quote = this.quote.bind(this);
    this.adminListTiers = this.adminListTiers.bind(this);
    this.adminTierAccountStats = this.adminTierAccountStats.bind(this);
    this.adminUpdateTier = this.adminUpdateTier.bind(this);
    this.adminListBenefits = this.adminListBenefits.bind(this);
    this.adminUpdateBenefit = this.adminUpdateBenefit.bind(this);
    this.adminCreateBenefit = this.adminCreateBenefit.bind(this);
    this.adminListVouchers = this.adminListVouchers.bind(this);
    this.adminCreateVoucher = this.adminCreateVoucher.bind(this);
    this.adminUpdateVoucher = this.adminUpdateVoucher.bind(this);
    this.adminListLogs = this.adminListLogs.bind(this);
    this.adminListPoints = this.adminListPoints.bind(this);
    this.myVouchers = this.myVouchers.bind(this);
  }

  normalizeTierSlugs(v) {
    return (Array.isArray(v) ? v : [])
      .map((x) => String(x || '').trim().toLowerCase())
      .filter(Boolean);
  }

  normalizeBookIds(v) {
    return (Array.isArray(v) ? v : [])
      .map((x) => String(x || '').trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
  }

  normalizeVoucherPayload(raw = {}, { partial = false } = {}) {
    const body = { ...raw };
    if ('code' in body && body.code) body.code = String(body.code).trim().toUpperCase();
    if (!partial || 'audienceType' in body) {
      body.audienceType = ['all', 'member', 'tiers'].includes(String(body.audienceType || '').toLowerCase())
        ? String(body.audienceType).toLowerCase()
        : 'member';
    }
    if (!partial || 'visibility' in body) {
      body.visibility = ['public', 'private'].includes(String(body.visibility || '').toLowerCase())
        ? String(body.visibility).toLowerCase()
        : 'public';
    }
    if ('tierSlugs' in body) body.tierSlugs = this.normalizeTierSlugs(body.tierSlugs);
    if (!partial || 'applyAllBooks' in body) body.applyAllBooks = body.applyAllBooks !== false;
    if ('eligibleBookIds' in body || (!partial && !body.applyAllBooks)) {
      body.eligibleBookIds = body.applyAllBooks ? [] : this.normalizeBookIds(body.eligibleBookIds);
    }
    if ('audienceType' in body && body.audienceType !== 'tiers') body.tierSlugs = [];
    if ('maxDiscountDong' in body) {
      if (body.maxDiscountDong === '' || body.maxDiscountDong == null) body.maxDiscountDong = null;
      else body.maxDiscountDong = Math.max(0, Math.round(Number(body.maxDiscountDong) || 0));
    }
    if ('maxUsesPerAccount' in body) {
      if (body.maxUsesPerAccount === '' || body.maxUsesPerAccount == null) body.maxUsesPerAccount = null;
      else body.maxUsesPerAccount = Math.max(1, Math.round(Number(body.maxUsesPerAccount) || 1));
    }
    return body;
  }

  async targetEmailsForVoucher(voucher) {
    const audienceType = String(voucher.audienceType || 'member').toLowerCase();
    if (audienceType === 'all') {
      const rows = await AccountUser.find({}, { email: 1 }).lean();
      return [...new Set(rows.map((x) => String(x.email || '').toLowerCase().trim()).filter(Boolean))];
    }
    if (audienceType === 'member') {
      const rows = await AccountUser.find({ isMember: true }, { email: 1 }).lean();
      return [...new Set(rows.map((x) => String(x.email || '').toLowerCase().trim()).filter(Boolean))];
    }
    const tierSlugs = this.normalizeTierSlugs(voucher.tierSlugs);
    if (!tierSlugs.length) return [];
    const tiers = await MembershipTier.find({ slug: { $in: tierSlugs } }, { _id: 1 }).lean();
    const tierIds = tiers.map((t) => t._id);
    if (!tierIds.length) return [];
    const rows = await AccountUser.find({ isMember: true, membershipTier: { $in: tierIds } }, { email: 1 }).lean();
    return [...new Set(rows.map((x) => String(x.email || '').toLowerCase().trim()).filter(Boolean))];
  }

  async publishPublicVoucherToWallet(voucher) {
    const visibility = String(voucher.visibility || 'public').toLowerCase();
    if (visibility !== 'public' || !voucher.active) return;
    const emails = await this.targetEmailsForVoucher(voucher);
    if (!emails.length) return;
    const existing = await UserVoucher.find(
      { voucher: voucher._id, email: { $in: emails } },
      { email: 1 },
    ).lean();
    const existingSet = new Set(existing.map((x) => String(x.email || '').toLowerCase().trim()));
    const newEmails = emails.filter((e) => !existingSet.has(String(e).toLowerCase().trim()));
    const ops = emails.map((email) => ({
      updateOne: {
        filter: { email, voucher: voucher._id },
        update: {
          $setOnInsert: {
            email,
            voucher: voucher._id,
            code: String(voucher.code || '').toUpperCase(),
            status: 'active',
            assignedBy: 'system-public',
            assignedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));
    if (ops.length) await UserVoucher.bulkWrite(ops, { ordered: false });
    if (!newEmails.length) return;
    await Promise.all(
      newEmails.map((email) =>
        createNotificationHelper(
          email,
          'voucher',
          'Bạn có voucher mới',
          `Voucher ${voucher.code} vừa được phát hành: ${voucher.title}`,
          '/checkout',
          null,
          null,
          null,
          null,
          { voucherCode: voucher.code, voucherId: String(voucher._id) },
          'user',
        ),
      ),
    );
  }

  async ensurePublicWalletForUser(email) {
    const account = await AccountUser.findOne({ email }).populate('membershipTier').lean();
    if (!account) return;
    const now = new Date();
    const publicVouchers = await Voucher.find({
      visibility: 'public',
      active: true,
      startsAt: { $lte: now },
      endsAt: { $gte: now },
    }).lean();
    for (const v of publicVouchers) {
      const audienceType = String(v.audienceType || 'member').toLowerCase();
      let ok = false;
      if (audienceType === 'all') ok = true;
      else if (audienceType === 'member') ok = !!account.isMember;
      else {
        const tierSlug = account.membershipTier?.slug ? String(account.membershipTier.slug).toLowerCase() : '';
        ok = !!account.isMember && this.normalizeTierSlugs(v.tierSlugs).includes(tierSlug);
      }
      if (!ok) continue;
      await UserVoucher.updateOne(
        { email, voucher: v._id },
        {
          $setOnInsert: {
            email,
            voucher: v._id,
            code: String(v.code || '').toUpperCase(),
            status: 'active',
            assignedBy: 'system-public',
            assignedAt: new Date(),
          },
        },
        { upsert: true },
      );
    }
  }

  /** POST /api/membership/quote — người dùng đăng nhập, tính giảm giá / ship */
  async quote(req, res, next) {
    try {
      await ensureMembershipSeed();
      const goodsSubtotalDong = Math.round(Number(req.body?.goodsSubtotalDong) || 0);
      const voucherCode = req.body?.voucherCode;
      const redeemPoints = Math.max(0, Math.round(Number(req.body?.redeemPoints) || 0));
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      const email = req.user?.email;
      if (!email) return res.status(401).json({ message: 'Chưa đăng nhập' });
      const q = await quoteCheckout({ email, goodsSubtotalDong, voucherCode, redeemPoints, items });
      return res.status(200).json(q);
    } catch (e) {
      next(e);
    }
  }

  async adminListTiers(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      await ensureMembershipSeed();
      const rows = await MembershipTier.find({}).sort({ sortOrder: 1 }).lean();
      return res.json(rows);
    } catch (e) {
      next(e);
    }
  }

  /** GET /api/membership/admin/tier-account-stats — đếm tài khoản theo hạng + chưa gán hạng */
  async adminTierAccountStats(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      await ensureMembershipSeed();
      const tiers = await MembershipTier.find({}).sort({ sortOrder: 1 }).lean();
      const agg = await AccountUser.aggregate([{ $group: { _id: '$membershipTier', count: { $sum: 1 } } }]);
      const countByTierId = {};
      let withoutTier = 0;
      for (const row of agg) {
        if (row._id == null) withoutTier += row.count;
        else countByTierId[String(row._id)] = row.count;
      }
      const knownIds = new Set(tiers.map((t) => String(t._id)));
      let orphanAccounts = 0;
      for (const [id, n] of Object.entries(countByTierId)) {
        if (!knownIds.has(id)) orphanAccounts += n;
      }
      const withMembership = Object.values(countByTierId).reduce((a, b) => a + b, 0);
      const byTier = tiers.map((t) => ({
        tierId: t._id,
        name: t.name,
        slug: t.slug,
        sortOrder: t.sortOrder,
        active: t.active,
        accountCount: countByTierId[String(t._id)] || 0,
      }));
      return res.json({
        totalAccounts: withoutTier + withMembership,
        withoutTier,
        withMembership,
        orphanAccounts,
        byTier,
      });
    } catch (e) {
      next(e);
    }
  }

  async adminUpdateTier(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID không hợp lệ' });
      const allowed = [
        'name',
        'slug',
        'sortOrder',
        'minTotalSpentDong',
        'discountPercent',
        'shipFreeAll',
        'shipFreeMinSubtotalDong',
        'pointsPer1000Vnd',
        'active',
      ];
      const patch = {};
      for (const k of allowed) {
        if (k in req.body) patch[k] = req.body[k];
      }
      const doc = await MembershipTier.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
      if (!doc) return res.status(404).json({ message: 'Không tìm thấy' });
      return res.json(doc);
    } catch (e) {
      next(e);
    }
  }

  async adminListBenefits(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const rows = await MemberBenefit.find({}).populate('membershipTier', 'slug name').sort({ sortOrder: 1 }).lean();
      return res.json(rows);
    } catch (e) {
      next(e);
    }
  }

  async adminUpdateBenefit(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID không hợp lệ' });
      const allowed = ['title', 'benefitKind', 'active', 'sortOrder', 'payload', 'membershipTier'];
      const patch = {};
      for (const k of allowed) {
        if (k in req.body) patch[k] = req.body[k];
      }
      const doc = await MemberBenefit.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
      if (!doc) return res.status(404).json({ message: 'Không tìm thấy' });
      return res.json(doc);
    } catch (e) {
      next(e);
    }
  }

  async adminCreateBenefit(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const doc = await MemberBenefit.create(req.body);
      return res.status(201).json(doc);
    } catch (e) {
      next(e);
    }
  }

  async adminListVouchers(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const q = {};
      if (req.query.code) {
        q.code = new RegExp(String(req.query.code).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      }
      if (req.query.visibility && ['public', 'private'].includes(String(req.query.visibility))) {
        q.visibility = String(req.query.visibility);
      }
      if (req.query.audienceType && ['all', 'member', 'tiers'].includes(String(req.query.audienceType))) {
        q.audienceType = String(req.query.audienceType);
      }
      if (req.query.active != null && String(req.query.active) !== '') {
        q.active = String(req.query.active).toLowerCase() === 'true';
      }
      if (req.query.endsBefore || req.query.endsAfter) {
        q.endsAt = {};
        if (req.query.endsBefore) q.endsAt.$lte = new Date(String(req.query.endsBefore));
        if (req.query.endsAfter) q.endsAt.$gte = new Date(String(req.query.endsAfter));
      }
      const rows = await Voucher.find(q)
        .populate('eligibleBookIds', 'name')
        .sort({ createdAt: -1 })
        .lean();
      return res.json(rows);
    } catch (e) {
      next(e);
    }
  }

  async adminCreateVoucher(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const body = this.normalizeVoucherPayload(req.body);
      const doc = await Voucher.create(body);
      await this.publishPublicVoucherToWallet(doc);
      return res.status(201).json(doc);
    } catch (e) {
      next(e);
    }
  }

  async adminUpdateVoucher(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID không hợp lệ' });
      const patch = this.normalizeVoucherPayload(req.body, { partial: true });
      delete patch._id;
      const doc = await Voucher.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
      if (!doc) return res.status(404).json({ message: 'Không tìm thấy' });
      await this.publishPublicVoucherToWallet(doc);
      return res.json(doc);
    } catch (e) {
      next(e);
    }
  }

  async adminListLogs(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
      const rows = await MembershipLog.find({}).sort({ createdAt: -1 }).limit(limit).lean();
      return res.json(rows);
    } catch (e) {
      next(e);
    }
  }

  async adminListPoints(req, res, next) {
    try {
      if (requireAdmin(req, res)) return;
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
      const q = {};
      if (req.query.email) q.email = String(req.query.email).toLowerCase().trim();
      const rows = await PointTransaction.find(q).sort({ createdAt: -1 }).limit(limit).lean();
      return res.json(rows);
    } catch (e) {
      next(e);
    }
  }

  async myVouchers(req, res, next) {
    try {
      const email = String(req.user?.email || '').toLowerCase().trim();
      if (!email) return res.status(401).json({ message: 'Chưa đăng nhập' });
      await this.ensurePublicWalletForUser(email);
      const rows = await UserVoucher.find({ email })
        .populate('voucher')
        .sort({ assignedAt: -1 })
        .lean();
      const now = Date.now();
      const withStatus = rows
        .filter((uv) => uv.voucher)
        .map((uv) => {
          const starts = uv.voucher?.startsAt ? new Date(uv.voucher.startsAt).getTime() : 0;
          const ends = uv.voucher?.endsAt ? new Date(uv.voucher.endsAt).getTime() : 0;
          const isExpired = now > ends || !uv.voucher.active;
          const isUsed = uv.status === 'used';
          const expiringSoon = !isUsed && !isExpired && ends - now <= 72 * 60 * 60 * 1000;
          let displayStatus = 'active';
          if (isUsed) displayStatus = 'used';
          else if (isExpired) displayStatus = 'expired';
          else if (expiringSoon) displayStatus = 'expiringSoon';
          return {
          userVoucherId: uv._id,
          code: uv.code,
          assignedAt: uv.assignedAt,
          usedAt: uv.usedAt || null,
          status: uv.status,
          displayStatus,
          voucher: uv.voucher,
        };
        });
      return res.json(withStatus);
    } catch (e) {
      next(e);
    }
  }
}

module.exports = new MembershipController();
