const mongoose = require('mongoose');
const Book= require('../models/Books')
const Category = require('../models/Category')
const categoryCtl = require('./CategoryController')
const Account=require('../models/AccountUsers')

const Address=require('../models/Address')
const  AccountAdmin=require('../models/AccountAdmins')
const Books = require('../models/Books');
const Series = require('../models/Series');
const Author = require('../models/Author');
const Orders = require('../models/Orders')
const {
  mongoFilterPublishedCatalog,
  canViewBookOnStorefront,
  computeStockTier,
  LISTING_STATUSES,
} = require('../utils/bookVisibility');
const { bookPriceToStorageString } = require('../utils/moneyVnd');
const { computeMembershipSpendProgress } = require('../services/membershipService');
const flashSaleService = require('../services/flashSaleService');

const BOOK_FORMATS = new Set([
  'paperback',
  'hardcover',
  'spiral',
  'flexibound',
  'box_set',
  'leather',
  'other',
]);

function parseCsvParam(v) {
  if (v == null || v === '') return [];
  return String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Chuẩn hóa mảng nhãn semantic (themes, mood, tags, ...) — lowercase, có giới hạn. */
function parseSemanticLabelArray(raw, max = 48) {
  if (Array.isArray(raw)) {
    return raw
      .map((g) => String(g).trim().toLowerCase())
      .filter(Boolean)
      .slice(0, max);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(',')
      .map((g) => g.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, max);
  }
  return [];
}

function normalizeCountryField(raw) {
  if (raw == null || raw === '') return '';
  return String(raw).trim().toLowerCase().slice(0, 80);
}

/** Giá bìa (đồng) từ trường price — cùng quy ước listPriceVnd */
function priceDongRangeExpr(minDong, maxDong) {
  const parts = [];
  if (minDong != null && Number.isFinite(minDong)) {
    parts.push({
      $gte: [
        {
          $cond: [
            {
              $gte: [{ $convert: { input: '$price', to: 'double', onError: 0, onNull: 0 } }, 1000],
            },
            { $convert: { input: '$price', to: 'double', onError: 0, onNull: 0 } },
            {
              $multiply: [{ $convert: { input: '$price', to: 'double', onError: 0, onNull: 0 } }, 1000],
            },
          ],
        },
        minDong,
      ],
    });
  }
  if (maxDong != null && Number.isFinite(maxDong)) {
    parts.push({
      $lte: [
        {
          $cond: [
            {
              $gte: [{ $convert: { input: '$price', to: 'double', onError: 0, onNull: 0 } }, 1000],
            },
            { $convert: { input: '$price', to: 'double', onError: 0, onNull: 0 } },
            {
              $multiply: [{ $convert: { input: '$price', to: 'double', onError: 0, onNull: 0 } }, 1000],
            },
          ],
        },
        maxDong,
      ],
    });
  }
  if (parts.length === 0) return null;
  return { $expr: parts.length === 1 ? parts[0] : { $and: parts } };
}

function priceBandsOrMatch(bands) {
  const ors = [];
  for (const b of bands) {
    const m = String(b).match(/^(\d+)-(\d+)$/);
    if (m) {
      const lo = Number.parseInt(m[1], 10);
      const hi = Number.parseInt(m[2], 10);
      if (!Number.isNaN(lo) && !Number.isNaN(hi)) {
        const e = priceDongRangeExpr(lo, hi);
        if (e) ors.push(e);
      }
    }
  }
  if (ors.length === 0) return null;
  return ors.length === 1 ? ors[0] : { $or: ors };
}

function toNullableInt(v, { min = null, max = null } = {}) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number.parseInt(String(v).trim(), 10);
  if (Number.isNaN(n)) return null;
  if (min != null && n < min) return null;
  if (max != null && n > max) return null;
  return n;
}

function toNullableFormat(v) {
  if (v === '' || v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  return BOOK_FORMATS.has(s) ? s : null;
}

function toBooleanLoose(v, fallback = false) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(s)) return true;
    if (['false', '0', 'no', 'off', ''].includes(s)) return false;
  }
  return fallback;
}

/** Chuỗi 24 hex hợp lệ → dùng lọc theo authorRef (schema Author._id). */
function strictObjectId24String(v) {
  const t = String(v ?? '').trim();
  if (!/^[a-fA-F0-9]{24}$/.test(t)) return null;
  if (!mongoose.Types.ObjectId.isValid(t)) return null;
  try {
    if (String(new mongoose.Types.ObjectId(t)) !== t) return null;
  } catch {
    return null;
  }
  return t;
}

function authorSlugifyBase(name) {
  const s = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return s || 'author';
}

async function authorUniqueSlug(base) {
  let slug = authorSlugifyBase(base);
  let n = 0;
  while (await Author.findOne({ slug }).select('_id').lean()) {
    n += 1;
    slug = `${authorSlugifyBase(base)}-${n}`;
  }
  return slug;
}

function escapeAuthorRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Trả về { authorRef, author } cho tạo/cập nhật sách (author = chuỗi hiển thị). */
async function resolveAuthorFromBody(body) {
  const newName =
    body.authorNewName != null && String(body.authorNewName).trim() !== ''
      ? String(body.authorNewName).trim().slice(0, 200)
      : '';
  if (newName) {
    const existing = await Author.findOne({
      name: new RegExp(`^${escapeAuthorRe(newName)}$`, 'i'),
    })
      .select('_id name')
      .lean();
    if (existing) {
      return { authorRef: existing._id, author: existing.name };
    }
    const slug = await authorUniqueSlug(newName);
    const created = await Author.create({
      name: newName,
      slug,
      description: '',
      sortOrder: 0,
    });
    return { authorRef: created._id, author: created.name };
  }
  const refRaw = body.authorRef;
  if (refRaw !== undefined && refRaw !== null && String(refRaw).trim() !== '') {
    const idStr = String(refRaw).trim();
    if (!mongoose.Types.ObjectId.isValid(idStr)) {
      const err = new Error('INVALID_AUTHOR_REF');
      throw err;
    }
    const adoc = await Author.findById(idStr).select('_id name').lean();
    if (!adoc) {
      const err = new Error('AUTHOR_NOT_FOUND');
      throw err;
    }
    return { authorRef: adoc._id, author: adoc.name };
  }
  return { authorRef: null, author: '' };
}

function seriesSlugifyBase(name) {
  const s = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return s || 'series';
}

async function seriesUniqueSlug(base) {
  let slug = seriesSlugifyBase(base);
  let n = 0;
  while (await Series.findOne({ slug }).select('_id').lean()) {
    n += 1;
    slug = `${seriesSlugifyBase(base)}-${n}`;
  }
  return slug;
}

function escapeSeriesRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Trả về ObjectId series hoặc null (tạo series mới nếu có seriesNewName). */
async function resolveSeriesFromBody(body) {
  const newName =
    body.seriesNewName != null && String(body.seriesNewName).trim() !== ''
      ? String(body.seriesNewName).trim().slice(0, 200)
      : '';
  if (newName) {
    const existing = await Series.findOne({
      name: new RegExp(`^${escapeSeriesRe(newName)}$`, 'i'),
    })
      .select('_id')
      .lean();
    if (existing) return existing._id;
    const slug = await seriesUniqueSlug(newName);
    const created = await Series.create({
      name: newName,
      slug,
      description: '',
      sortOrder: 0,
    });
    return created._id;
  }
  const refRaw = body.series;
  if (refRaw !== undefined && refRaw !== null && String(refRaw).trim() !== '') {
    const idStr = String(refRaw).trim();
    if (!mongoose.Types.ObjectId.isValid(idStr)) {
      const err = new Error('INVALID_SERIES_REF');
      throw err;
    }
    const sdoc = await Series.findById(idStr).select('_id').lean();
    if (!sdoc) {
      const err = new Error('SERIES_NOT_FOUND');
      throw err;
    }
    return sdoc._id;
  }
  return null;
}

class SiteController{
    index(req,res ) 
    {
        res.render('cc')
    }
   async show(req,res,next)
       {    
              try {
                await categoryCtl.ensureSeedAndMigrate();
                const admin = req.user?.role === 'admin';
                const filter = admin ? {} : mongoFilterPublishedCatalog();
                const books = await Book.find(filter)
                  .populate('category')
                  .populate({ path: 'series', select: 'name slug' })
                  .populate({ path: 'authorRef', select: 'name slug' })
                  .sort({ publishedAt: -1, createAt: -1 })
                  .lean();
                const enriched = await flashSaleService.attachFlashSaleToBooks(books);
                return res.json(enriched);
              } catch (e) {
                return next(e);
              }
       }

  async getBookPublicDetail(req, res, next) {
    try {
      await categoryCtl.ensureSeedAndMigrate();
      const name = String(req.query.name || '').trim();
      if (!name) {
        return res.status(400).json({ message: 'Thiếu tham số name (tên sách đúng như trong hệ thống)' });
      }
      const book = await Book.findOne({ name })
        .populate('category')
        .populate({ path: 'series', select: 'name slug description' })
        .populate({ path: 'authorRef', select: 'name slug description' })
        .lean();
      if (!book) {
        return res.status(404).json({ message: 'Không tìm thấy sách' });
      }
      const admin = req.user?.role === 'admin';
      if (!canViewBookOnStorefront(book, { isAdmin: admin })) {
        return res.status(404).json({ message: 'Không tìm thấy sách' });
      }
      const pub = admin ? {} : mongoFilterPublishedCatalog();
      const catId =
        book.category && typeof book.category === 'object' && book.category._id
          ? book.category._id
          : book.category;

      let seriesBooks = [];
      const seriesId = book.series && typeof book.series === 'object' && book.series._id ? book.series._id : book.series;
      if (seriesId) {
        const q = { $and: [{ series: seriesId }, { _id: { $ne: book._id } }] };
        if (!admin) q.$and.push(pub);
        seriesBooks = await Book.find(q)
          .populate('category')
          .populate({ path: 'series', select: 'name slug' })
          .populate({ path: 'authorRef', select: 'name slug' })
          .sort({ publishedAt: -1, createAt: -1 })
          .limit(16)
          .lean();
      }

      const authorRefId =
        book.authorRef && typeof book.authorRef === 'object' && book.authorRef._id
          ? book.authorRef._id
          : book.authorRef;
      const authorBooksPageSize = 8;
      const authorPage = Math.max(1, Number.parseInt(String(req.query.authorPage || '1'), 10) || 1);
      let authorBooks = [];
      let authorBooksTotal = 0;
      if (authorRefId) {
        const aq = { $and: [{ authorRef: authorRefId }, { _id: { $ne: book._id } }] };
        if (!admin) aq.$and.push(pub);
        authorBooksTotal = await Book.countDocuments(aq);
        const skip = (authorPage - 1) * authorBooksPageSize;
        authorBooks = await Book.find(aq)
          .populate('category')
          .populate({ path: 'series', select: 'name slug' })
          .populate({ path: 'authorRef', select: 'name slug' })
          .sort({ publishedAt: -1, createAt: -1 })
          .skip(skip)
          .limit(authorBooksPageSize)
          .lean();
      }

      const excludeIds = [book._id, ...seriesBooks.map((b) => b._id)];
      const catQ = {
        $and: [{ category: catId }, { _id: { $nin: excludeIds } }],
      };
      if (!admin) catQ.$and.push(pub);
      const sameCategoryBooks = await Book.find(catQ)
        .populate('category')
        .populate({ path: 'series', select: 'name slug' })
        .populate({ path: 'authorRef', select: 'name slug' })
        .sort({ publishedAt: -1, createAt: -1 })
        .limit(16)
        .lean();

      const [enrichedBook, enrichedSeries, enrichedSame, enrichedAuthor] = await Promise.all([
        flashSaleService.attachFlashSaleToBooks([book]),
        flashSaleService.attachFlashSaleToBooks(seriesBooks),
        flashSaleService.attachFlashSaleToBooks(sameCategoryBooks),
        flashSaleService.attachFlashSaleToBooks(authorBooks),
      ]);
      return res.status(200).json({
        ...enrichedBook[0],
        stockTier: computeStockTier(book),
        seriesBooks: enrichedSeries,
        sameCategoryBooks: enrichedSame,
        authorBooks: enrichedAuthor,
        authorBooksTotal,
        authorBooksPage: authorPage,
        authorBooksPageSize,
      });
    } catch (e) {
      return next(e);
    }
  }

     async getAccount(req,res,next)
       {  
            try{ let account =null
              console.log(req.user)
              if(req.user.role === 'user'){
                 account = await Account.findOne({ email: req.user.email }).populate('membershipTier');

            }
              if(req.user.role ==='admin')
              {
                 account = await AccountAdmin.findOne({email:req.user.email});
              }
              if(!account)
              {
                return res.status(404).json({message:"Not login"})
              }
              const hasTier = !!(account.membershipTier && (account.membershipTier.slug || account.membershipTier.name));
              const isMemberLike = !!(account.isMember || hasTier);
              let membershipProgress = null;
              if (req.user.role === 'user' && isMemberLike) {
                membershipProgress = await computeMembershipSpendProgress(Number(account.totalSpentDong) || 0);
              }
              return res.json({user:{
                id:account._id,
                email:account.email,
                name:account.name,
                avt:account.avt,
                role:account.role,
                isMember: isMemberLike,
                phone:account.phone || '',
                membershipTierSlug: account.membershipTier?.slug || '',
                membershipTierName: account.membershipTier?.name || '',
                loyaltyPoints: account.loyaltyPoints || 0,
                totalSpentDong: account.totalSpentDong || 0,
                memberSince: account.memberSince || null,
                membershipProgress,
              }})
            }
            catch(error)
            { next(error)};
              
            
}
  async getMyAccount(req,res,next)
  {
    try{
      let account;
      if(req.user.role === 'user'){
        account = await Account.findOne({ email: req.user.email }).populate('membershipTier');
      }
      if(req.user.role ==='admin')
      {
        account = require('../models/AccountAdmins').findOne({email:req.user.email});
      }
      if(!account){
        return res.status(404).json({message:"Không tìm thấy tài khoản"});
      }
      const hasTier = !!(account.membershipTier && (account.membershipTier.slug || account.membershipTier.name));
      const isMemberLike = !!(account.isMember || hasTier);
      let membershipProgress = null;
      if (req.user.role === 'user' && isMemberLike) {
        membershipProgress = await computeMembershipSpendProgress(Number(account.totalSpentDong) || 0);
      }
      return res.json({
        user:{
          id:account._id,
          email:account.email,
          name:account.name,
          avt:account.avt,
          phone:account.phone || '',
          role:account.role,
          isMember: isMemberLike,
          membershipTierSlug: account.membershipTier?.slug || '',
          membershipTierName: account.membershipTier?.name || '',
          loyaltyPoints: account.loyaltyPoints || 0,
          totalSpentDong: account.totalSpentDong || 0,
          memberSince: account.memberSince || null,
          membershipProgress,
        }
      });
    }catch(error){
      next(error);
    }
  }
async changeInfo(req,res,next)
       {  
            try{
              const account = await Account.findOne({email:req.body.email});
              if(!account)
              {
                return res.status(404).json({message:"Not login"})
              }
              if(account.name !== req.body.name)
              {
                account.name=req.body.name;
                 await account.save()
              }
            
              return res.json({user:{
                email:account.email,
                name:account.name,
                avt:account.avt
              }})
            }
            catch(error)
            {  console.error("Error updating account:", error);  // Log chi tiết lỗi
              next(error)};
              
            
}
async createAddress(req,res,next)
       {
              
              
            try{// Lấy dữ liệu từ request body
            const { user,name, phone, province,details,isDefault} = req.body;
            console.log(req.body); 
              const count = await Address.countDocuments({ email:user });
            // Tạo tài khoản mới
            const newAddress = new Address({
                email:user,
                stt:count+1 ,
                name:name,
                phone:phone,
                details:details,
                province:province,
                isDefault:isDefault
            });

            // Lưu tài khoản mới vào cơ sở dữ liệu
            await newAddress.save();
                
            // Trả về phản hồi thành công
            return res.status(201).json({
                message: 'Tạo địa chỉ thành công!'
            });
            }
            catch(error)
            { return res.status(400).json(error)

            }
         
    }
      async  getAddress(req, res, next) {
  try {  
    const addresses = await Address.find({});
    res.status(200).json(addresses);  // Trả về JSON danh sách address
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi lấy địa chỉ', error });
  }
}
  async removeBook(req, res) {
    try {
      const id = req.params.id;
      if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        return res.status(400).json({ message: 'bookId không hợp lệ' });
      }
      const book = await Book.findById(id);
      if (!book) return res.status(404).json({ message: 'Không tìm thấy sách' });

      const Cart = require('../models/Carts');
      const FlashSale = require('../models/FlashSale');
      const [orderCount, cartCount, flashCount] = await Promise.all([
        Orders.countDocuments({ 'items.bookId': id }),
        Cart.countDocuments({ 'items.bookId': id }),
        FlashSale.countDocuments({ 'items.bookId': id }),
      ]);
      const refs = orderCount + cartCount + flashCount;

      const force = String(req.query?.force || req.body?.force || '').toLowerCase() === 'true';
      const isAdmin = req.user?.role === 'admin';

      try {
        const vectorSync = require('../chatbot/sync/vectorSync');
        await vectorSync.removeBookById(id);
      } catch (_vs) {}

      try {
        await Cart.updateMany(
          { 'items.bookId': id },
          { $pull: { items: { bookId: id } } },
        );
        await FlashSale.updateMany(
          { 'items.bookId': id },
          { $pull: { items: { bookId: id } } },
        );
      } catch (cleanupErr) {
        console.error('[removeBook] cleanup refs failed:', cleanupErr?.message || cleanupErr);
      }

      if (orderCount > 0 && !(force && isAdmin)) {
        book.status = 'archived';
        book.deletedAt = new Date();
        await book.save();
        return res.status(200).json({
          message:
            'Sách đã có trong đơn hàng — đã ngừng kinh doanh thay vì xóa hẳn (giữ lịch sử đơn).',
          mode: 'soft',
          bookId: String(id),
          refs: { orders: orderCount, carts: cartCount, flashSales: flashCount },
        });
      }

      await Book.findByIdAndDelete(id);
      return res.status(200).json({
        message: 'Đã xóa sách thành công.',
        mode: 'hard',
        bookId: String(id),
        cleaned: { carts: cartCount, flashSales: flashCount, orders: orderCount },
      });
    } catch (error) {
      console.error('removeBook error:', error);
      return res.status(400).json({ message: 'Lỗi dữ liệu', error: String(error.message || error) });
    }
  }
  async removeAccount(req, res) {
    try {
      const id = req.params.id;
      if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        return res.status(400).json({ message: 'ID tài khoản không hợp lệ' });
      }
      const user = await Account.findById(id);
      if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
      if (user.role === 'admin') {
        return res.status(403).json({ message: 'Không thể xóa tài khoản admin' });
      }

      const Cart = require('../models/Carts');
      const Notification = require('../models/Notifications');
      const Review = require('../models/Review');
      const UserVoucher = require('../models/UserVoucher');
      const PointTransaction = require('../models/PointTransaction');

      const email = String(user.email || '').toLowerCase().trim();
      const [orderTotal, openOrderCount, reviewCount] = await Promise.all([
        Orders.countDocuments({ email }),
        Orders.countDocuments({ email, status: { $in: ['Chờ xử lý', 'Đang giao'] } }),
        Review.countDocuments({ userId: user._id }),
      ]);

      const force = String(req.query?.force || req.body?.force || '').toLowerCase() === 'true';
      const isAdmin = req.user?.role === 'admin';

      if (openOrderCount > 0 && !(force && isAdmin)) {
        return res.status(400).json({
          message: `Tài khoản còn ${openOrderCount} đơn đang xử lý — không thể xóa. Hủy/hoàn tất đơn trước hoặc dùng ?force=true để vô hiệu hóa.`,
          pendingOrders: openOrderCount,
        });
      }

      if (orderTotal > 0 || reviewCount > 0) {
        user.deletedAt = new Date();
        user.deletedReason = String(req.body?.reason || 'admin-delete').slice(0, 200);
        await user.save();
        try {
          await Cart.deleteMany({ email });
        } catch (_) {}
        return res.status(200).json({
          message:
            'Tài khoản đã có lịch sử mua hàng/đánh giá — đã vô hiệu hóa (soft delete) để giữ lịch sử.',
          mode: 'soft',
          email,
          refs: { orders: orderTotal, reviews: reviewCount },
        });
      }

      try {
        await Promise.all([
          Cart.deleteMany({ email }),
          Address.deleteMany({ email }),
          Notification.deleteMany({ email }),
          UserVoucher.deleteMany({ email }),
          PointTransaction.deleteMany({ email }),
        ]);
      } catch (cleanupErr) {
        console.error('[removeAccount] cleanup failed:', cleanupErr?.message || cleanupErr);
      }

      await Account.findByIdAndDelete(id);
      return res.status(200).json({
        message: 'Đã xóa tài khoản và dữ liệu liên quan.',
        mode: 'hard',
        email,
      });
    } catch (error) {
      console.error('removeAccount error:', error);
      return res
        .status(400)
        .json({ message: 'Lỗi dữ liệu', error: String(error.message || error) });
    }
  }
     async createBook(req,res,next)
       {
              
              
            try{// Lấy dữ liệu từ request body
            const {
              name,
              description,
              image,
              category,
              price,
              publisher,
              pages,
              weight,
              format,
              productionYear,
              publishedYear,
              brand,
              supplier,
              language,
              genres,
              themes,
              mood,
              contentTags,
              audience,
              country,
              ageRange,
              manufacturingOrigin,
              brandOrigin,
              coverColor,
              series,
              seriesNewName,
              authorRef,
              authorNewName,
              isMemberOnly,
            } = req.body;
            console.log(req.body); 
            if (!category) {
              return res.status(400).json({ message: 'Thiếu danh mục (category)' });
            }
            if (!mongoose.Types.ObjectId.isValid(String(category))) {
              return res.status(400).json({ message: 'Danh mục không hợp lệ' });
            }
            const categoryDoc = await Category.findById(String(category)).select('_id').lean();
            if (!categoryDoc) {
              return res.status(400).json({ message: 'Danh mục không tồn tại' });
            }
            let seriesRef = null;
            try {
              seriesRef = await resolveSeriesFromBody({ series, seriesNewName });
            } catch (e) {
              if (e.message === 'INVALID_SERIES_REF') {
                return res.status(400).json({ message: 'Series không hợp lệ' });
              }
              if (e.message === 'SERIES_NOT_FOUND') {
                return res.status(400).json({ message: 'Series không tồn tại' });
              }
              throw e;
            }
            let authorBundle = { authorRef: null, author: '' };
            try {
              authorBundle = await resolveAuthorFromBody({ authorRef, authorNewName });
            } catch (e) {
              if (e.message === 'INVALID_AUTHOR_REF') {
                return res.status(400).json({ message: 'Tác giả không hợp lệ (authorRef)' });
              }
              if (e.message === 'AUTHOR_NOT_FOUND') {
                return res.status(400).json({ message: 'Tác giả không tồn tại' });
              }
              throw e;
            }
            const fmt = toNullableFormat(format);
            let genresArr = [];
            if (Array.isArray(genres)) {
              genresArr = genres
                .map((g) => String(g).trim().toLowerCase())
                .filter(Boolean)
                .slice(0, 32);
            } else if (typeof genres === 'string' && genres.trim()) {
              genresArr = genres
                .split(',')
                .map((g) => g.trim().toLowerCase())
                .filter(Boolean)
                .slice(0, 32);
            }
            const themesArr = parseSemanticLabelArray(themes);
            const moodArr = parseSemanticLabelArray(mood);
            const contentTagsArr = parseSemanticLabelArray(contentTags);
            const audienceArr = parseSemanticLabelArray(audience);
            const countryNorm = normalizeCountryField(country);
            const LANG = new Set(['vi', 'en', 'zh', 'other']);
            const langRaw = language != null ? String(language).trim().toLowerCase() : 'vi';
            const lang = LANG.has(langRaw) ? langRaw : 'vi';
            const priceNorm = bookPriceToStorageString(price);
            if (!priceNorm) {
              return res.status(400).json({ message: 'Giá không hợp lệ (VD: 150.000đ)' });
            }
            // Tạo tài khoản mới
            const newBooks = new Book({
                name,
                description,
                img:image,
                category: categoryDoc._id,
                price: priceNorm,
                publisher: publisher != null ? String(publisher).trim().slice(0, 200) : '',
                brand: brand != null ? String(brand).trim().slice(0, 120) : '',
                supplier: supplier != null ? String(supplier).trim().slice(0, 200) : '',
                language: lang,
                genres: genresArr,
                themes: themesArr,
                mood: moodArr,
                contentTags: contentTagsArr,
                audience: audienceArr,
                country: countryNorm,
                ageRange: ageRange != null ? String(ageRange).trim().slice(0, 32) : '',
                manufacturingOrigin:
                  manufacturingOrigin != null ? String(manufacturingOrigin).trim().slice(0, 120) : '',
                brandOrigin: brandOrigin != null ? String(brandOrigin).trim().slice(0, 120) : '',
                coverColor: coverColor != null ? String(coverColor).trim().slice(0, 40) : '',
                pages: toNullableInt(pages, { min: 0 }),
                weight: toNullableInt(weight, { min: 0 }),
                format: fmt,
                productionYear: toNullableInt(productionYear, { min: 0, max: 9999 }),
                publishedYear: toNullableInt(publishedYear, { min: 0, max: 9999 }),
                status: 'draft',
                publishedAt: null,
                series: seriesRef,
                author: authorBundle.author,
                authorRef: authorBundle.authorRef,
                isMemberOnly: toBooleanLoose(isMemberOnly, true),
            });
              console.log(newBooks)
            // Lưu tài khoản mới vào cơ sở dữ liệu
            await newBooks.save();
                
            // Trả về phản hồi thành công
            return res.status(201).json(newBooks);
            }
            catch(error)
            { return res.status(400).json(error)

            }
         
    }
    async updateBook(req,res,next){
            try{
                 const item = req.body;
                 if (!item?._id) {
                   return res.status(400).json({ message: 'Thiếu _id sách' });
                 }
                 const prev = await Book.findById(item._id);
                 if (!prev) {
                   return res.status(404).json({ message: 'Không tìm thấy sách' });
                 }
                 const restoreDeleted =
                   String(item?.restoreDeleted ?? '').toLowerCase() === 'true' || item?.restoreDeleted === true;
                 if (prev.deletedAt && !restoreDeleted) {
                   return res.status(400).json({
                     message:
                       'Sách đã bị xóa (ngừng kinh doanh do liên kết đơn hàng). Truyền restoreDeleted=true để khôi phục trước khi cập nhật.',
                   });
                 }
                 if (prev.status === 'archived' && item.status === 'published' && !restoreDeleted) {
                   return res.status(400).json({
                     message: 'Sách đã ngừng kinh doanh (archived) không thể đưa lại trạng thái published',
                   });
                 }
                 const updates = { ...item };
                 delete updates._id;
                 delete updates.publishedAt;
                 delete updates.restoreDeleted;
                 if (restoreDeleted) {
                   updates.deletedAt = null;
                   if (!updates.status) updates.status = 'archived';
                 }
                 if (updates.category != null) {
                   if (!mongoose.Types.ObjectId.isValid(String(updates.category))) {
                     return res.status(400).json({ message: 'Danh mục không hợp lệ' });
                   }
                   const cat = await Category.findById(String(updates.category)).select('_id').lean();
                   if (!cat) {
                     return res.status(400).json({ message: 'Danh mục không tồn tại' });
                   }
                   updates.category = cat._id;
                 }
                 if (updates.status != null) {
                   if (!LISTING_STATUSES.includes(updates.status)) {
                     delete updates.status;
                   } else if (updates.status === 'published' && prev.status !== 'published') {
                     updates.publishedAt = new Date();
                   }
                 }
                 if ('publisher' in updates) {
                   updates.publisher =
                     updates.publisher == null ? '' : String(updates.publisher).trim().slice(0, 200);
                 }
                 if ('pages' in updates) updates.pages = toNullableInt(updates.pages, { min: 0 });
                 if ('weight' in updates) updates.weight = toNullableInt(updates.weight, { min: 0 });
                 if ('productionYear' in updates) {
                   updates.productionYear = toNullableInt(updates.productionYear, { min: 0, max: 9999 });
                 }
                 if ('publishedYear' in updates) {
                   updates.publishedYear = toNullableInt(updates.publishedYear, { min: 0, max: 9999 });
                 }
                 if ('format' in updates) {
                   if (updates.format === '' || updates.format == null) {
                     updates.format = null;
                   } else {
                     const f = toNullableFormat(updates.format);
                     if (f) updates.format = f;
                     else delete updates.format;
                   }
                 }
                 const LANG = new Set(['vi', 'en', 'zh', 'other']);
                 if ('language' in updates && updates.language != null) {
                   const lr = String(updates.language).trim().toLowerCase();
                   updates.language = LANG.has(lr) ? lr : 'vi';
                 }
                 if ('genres' in updates && updates.genres != null) {
                   if (Array.isArray(updates.genres)) {
                     updates.genres = updates.genres
                       .map((g) => String(g).trim().toLowerCase())
                       .filter(Boolean)
                       .slice(0, 32);
                   } else if (typeof updates.genres === 'string') {
                     updates.genres = updates.genres
                       .split(',')
                       .map((g) => g.trim().toLowerCase())
                       .filter(Boolean)
                       .slice(0, 32);
                   }
                 }
                 if ('themes' in updates && updates.themes != null) {
                   updates.themes = parseSemanticLabelArray(updates.themes);
                 }
                 if ('mood' in updates && updates.mood != null) {
                   updates.mood = parseSemanticLabelArray(updates.mood);
                 }
                 if ('contentTags' in updates && updates.contentTags != null) {
                   updates.contentTags = parseSemanticLabelArray(updates.contentTags);
                 }
                 if ('audience' in updates && updates.audience != null) {
                   updates.audience = parseSemanticLabelArray(updates.audience);
                 }
                 if ('country' in updates && updates.country != null) {
                   updates.country = normalizeCountryField(updates.country);
                 }
                 if ('brand' in updates && updates.brand != null) {
                   updates.brand = String(updates.brand).trim().slice(0, 120);
                 }
                 if ('supplier' in updates && updates.supplier != null) {
                   updates.supplier = String(updates.supplier).trim().slice(0, 200);
                 }
                 if ('ageRange' in updates && updates.ageRange != null) {
                   updates.ageRange = String(updates.ageRange).trim().slice(0, 32);
                 }
                 if ('manufacturingOrigin' in updates && updates.manufacturingOrigin != null) {
                   updates.manufacturingOrigin = String(updates.manufacturingOrigin).trim().slice(0, 120);
                 }
                 if ('brandOrigin' in updates && updates.brandOrigin != null) {
                   updates.brandOrigin = String(updates.brandOrigin).trim().slice(0, 120);
                 }
                 if ('coverColor' in updates && updates.coverColor != null) {
                   updates.coverColor = String(updates.coverColor).trim().slice(0, 40);
                 }
                 if ('series' in updates && updates.series && typeof updates.series === 'object' && updates.series._id) {
                   updates.series = updates.series._id;
                 }
                 if ('seriesNewName' in updates || 'series' in updates) {
                   const seriesNewInput = updates.seriesNewName;
                   delete updates.seriesNewName;
                   const trimmedSeriesNew =
                     seriesNewInput != null && String(seriesNewInput).trim() !== ''
                       ? String(seriesNewInput).trim().slice(0, 200)
                       : '';
                   if (trimmedSeriesNew) {
                     try {
                       const sid = await resolveSeriesFromBody({ series: null, seriesNewName: trimmedSeriesNew });
                       updates.series = sid;
                     } catch (e) {
                       if (e.message === 'INVALID_SERIES_REF') {
                         return res.status(400).json({ message: 'Series không hợp lệ' });
                       }
                       if (e.message === 'SERIES_NOT_FOUND') {
                         return res.status(400).json({ message: 'Series không tồn tại' });
                       }
                       throw e;
                     }
                   } else {
                     let sv = updates.series;
                     if (sv === '' || sv == null) {
                       updates.series = null;
                     } else if (!mongoose.Types.ObjectId.isValid(String(sv))) {
                       return res.status(400).json({ message: 'Series không hợp lệ' });
                     } else {
                       const sdoc = await Series.findById(String(sv)).select('_id').lean();
                       if (!sdoc) {
                         return res.status(400).json({ message: 'Series không tồn tại' });
                       }
                       updates.series = sdoc._id;
                     }
                   }
                 }
                 if ('authorRef' in updates && updates.authorRef && typeof updates.authorRef === 'object' && updates.authorRef._id) {
                   updates.authorRef = updates.authorRef._id;
                 }
                 if ('authorNewName' in updates || 'authorRef' in updates) {
                   const authorNewInput = updates.authorNewName;
                   delete updates.authorNewName;
                   const trimmedNew =
                     authorNewInput != null && String(authorNewInput).trim() !== ''
                       ? String(authorNewInput).trim().slice(0, 200)
                       : '';
                   if (trimmedNew) {
                     try {
                       const ab = await resolveAuthorFromBody({ authorRef: null, authorNewName: trimmedNew });
                       updates.authorRef = ab.authorRef;
                       updates.author = ab.author;
                     } catch (e) {
                       if (e.message === 'INVALID_AUTHOR_REF') {
                         return res.status(400).json({ message: 'Tác giả không hợp lệ' });
                       }
                       if (e.message === 'AUTHOR_NOT_FOUND') {
                         return res.status(400).json({ message: 'Tác giả không tồn tại' });
                       }
                       throw e;
                     }
                   } else {
                     let v = updates.authorRef;
                     if (v === '' || v == null) {
                       updates.authorRef = null;
                       updates.author = '';
                     } else if (!mongoose.Types.ObjectId.isValid(String(v))) {
                       return res.status(400).json({ message: 'Tác giả không hợp lệ' });
                     } else {
                       const adoc = await Author.findById(String(v)).select('_id name').lean();
                       if (!adoc) {
                         return res.status(400).json({ message: 'Tác giả không tồn tại' });
                       }
                       updates.authorRef = adoc._id;
                       updates.author = adoc.name;
                     }
                   }
                 }
                 if ('price' in updates && updates.price != null) {
                   const priceNorm = bookPriceToStorageString(updates.price);
                   if (!priceNorm) {
                     return res.status(400).json({ message: 'Giá không hợp lệ (VD: 150.000đ)' });
                   }
                   updates.price = priceNorm;
                 }
                if ('isMemberOnly' in updates) {
                  updates.isMemberOnly = toBooleanLoose(updates.isMemberOnly, !!prev.isMemberOnly);
                }
                 const updated = await Book.findByIdAndUpdate(item._id, updates, {
                   new: true,
                   runValidators: true,
                 }).lean();
                 try {
                   const { scheduleAutoEnrichOnPublish } = require('../chatbot/services/bookSemanticEnrichment');
                   const prevLean = prev.toObject ? prev.toObject() : prev;
                   scheduleAutoEnrichOnPublish(prevLean, updated, updates);
                 } catch (_enrichHook) {}
                 return res.status(200).json({ message: 'update thanh cong' });
            }
            catch(error){
                console.log(error);
                return res.status(400).json({ message: 'Lỗi dữ liệu', error: String(error.message) });
            }
       }     
  async setAddressDefault(req,res,next){
          try {
            
        const newAddress = await Address.findOne({_id:req.params.id});
         await Address.updateMany(
          { user: newAddress.user }, // hoặc req.user._id nếu bạn có sẵn user từ token
            { isDefault: false }
    );
          if (!newAddress) {
      return res.status(404).json({ error: 'Address not found' });}
           newAddress.isDefault=true; 
         await  newAddress.save();
    return res.status(200).json('Thanh cong')
  }
          catch(error){
              console.log('Loi')
              res.status(400).json('Lỗi dữ liệu')
          }
     }
  async deleteAddress(req, res) {
    try {
      const id = req.params.id;
      if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        return res.status(400).json({ message: 'addressId không hợp lệ' });
      }
      const addr = await Address.findById(id);
      if (!addr) {
        return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
      }
      const owner = addr.email;
      const wasDefault = !!addr.isDefault;

      await Address.findByIdAndDelete(id);

      let newDefaultId = null;
      if (wasDefault && owner) {
        const next = await Address.findOne({ email: owner }).sort({ stt: 1, createdAt: 1 });
        if (next) {
          next.isDefault = true;
          await next.save();
          newDefaultId = String(next._id);
        }
      }

      return res.status(200).json({
        message: 'Đã xóa địa chỉ',
        wasDefault,
        newDefaultId,
      });
    } catch (error) {
      console.error('deleteAddress error:', error);
      return res.status(400).json({ message: 'Lỗi dữ liệu', error: String(error.message || error) });
    }
  }
  /**
   * Lọc sách: categoryId / categorySlug, năm, NXB, giá (đồng), thể loại tag, ngôn ngữ,
   * thương hiệu, nhà cung cấp, độ tuổi, xuất xứ, màu, format (nhiều giá trị), …
   */
  async filterBooks(req, res, next) {
    try {
      await categoryCtl.ensureSeedAndMigrate();
      const {
        categoryId,
        categorySlug,
        year,
        productionYear,
        author,
        authorId,
        publisher,
        format,
        formats,
        pagesMin,
        pagesMax,
        weightMin,
        weightMax,
        priceBands,
        priceMinDong,
        priceMaxDong,
        genres,
        languages,
        brands,
        suppliers,
        ageRanges,
        manufacturingOrigins,
        brandOrigins,
        coverColors,
              memberOnly,
      } = req.query;
      const andConditions = [];

      if (categoryId && mongoose.Types.ObjectId.isValid(String(categoryId))) {
        andConditions.push({ category: new mongoose.Types.ObjectId(String(categoryId)) });
      } else if (categorySlug && String(categorySlug).trim()) {
        const cat = await Category.findOne({ slug: String(categorySlug).trim().toLowerCase() })
          .select('_id')
          .lean();
        if (cat) andConditions.push({ category: cat._id });
      }

      if (year && /^\d{4}$/.test(String(year))) {
        const y = parseInt(year, 10);
        andConditions.push({
          $or: [
            { publishedYear: y },
            {
              $and: [
                { $or: [{ publishedYear: null }, { publishedYear: { $exists: false } }] },
                { $expr: { $eq: [{ $year: '$createAt' }, y] } },
              ],
            },
          ],
        });
      }

      if (productionYear && /^\d{4}$/.test(String(productionYear))) {
        andConditions.push({ productionYear: parseInt(String(productionYear), 10) });
      }

      const authorIdTrim = authorId != null && String(authorId).trim() !== '' ? String(authorId).trim() : null;
      const authorTrim = author != null && String(author).trim() !== '' ? String(author).trim() : null;
      const oidFromAuthorId = authorIdTrim ? strictObjectId24String(authorIdTrim) : null;
      const oidFromAuthorText = !oidFromAuthorId && authorTrim ? strictObjectId24String(authorTrim) : null;
      const authorOid = oidFromAuthorId || oidFromAuthorText;
      if (authorOid) {
        const aid = new mongoose.Types.ObjectId(authorOid);
        const exists = await Author.findById(aid).select('_id').lean();
        if (exists) {
          andConditions.push({ authorRef: aid });
        } else {
          andConditions.push({ _id: { $in: [] } });
        }
      } else if (authorTrim) {
        const rx = new RegExp(authorTrim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const matchingAuthors = await Author.find({ name: rx }).select('_id').lean();
        const authorRefIds = matchingAuthors.map((a) => a._id);
        andConditions.push({
          $or: [
            { author: rx },
            { name: rx },
            { description: rx },
            ...(authorRefIds.length ? [{ authorRef: { $in: authorRefIds } }] : []),
          ],
        });
      }

      if (publisher && String(publisher).trim()) {
        const rx = new RegExp(
          String(publisher).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          'i'
        );
        andConditions.push({ publisher: rx });
      }

      const formatTokens = [
        ...new Set(
          [...parseCsvParam(format), ...parseCsvParam(formats)].map((x) => String(x).toLowerCase())
        ),
      ].filter((x) => BOOK_FORMATS.has(x));
      if (formatTokens.length === 1) {
        andConditions.push({ format: formatTokens[0] });
      } else if (formatTokens.length > 1) {
        andConditions.push({ format: { $in: formatTokens } });
      }

      const bands = parseCsvParam(priceBands);
      const bandExpr = priceBandsOrMatch(bands);
      if (bandExpr) {
        andConditions.push(bandExpr);
      } else {
        const pMinD = toNullableInt(priceMinDong, { min: 0 });
        const pMaxD = toNullableInt(priceMaxDong, { min: 0 });
        const singlePrice = priceDongRangeExpr(pMinD, pMaxD);
        if (singlePrice) andConditions.push(singlePrice);
      }

      const genreList = parseCsvParam(genres).map((g) => g.toLowerCase());
      if (genreList.length) {
        andConditions.push({ genres: { $in: genreList } });
      }

      const LANG_OK = new Set(['vi', 'en', 'zh', 'other']);
      const langList = parseCsvParam(languages)
        .map((l) => l.toLowerCase())
        .filter((l) => LANG_OK.has(l));
      if (langList.length === 1) {
        andConditions.push({ language: langList[0] });
      } else if (langList.length > 1) {
        andConditions.push({ language: { $in: langList } });
      }

      const brandList = parseCsvParam(brands);
      if (brandList.length) {
        andConditions.push({
          $or: brandList.map((b) => ({
            brand: new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
          })),
        });
      }

      const supplierList = parseCsvParam(suppliers);
      if (supplierList.length) {
        andConditions.push({
          $or: [
            { supplier: { $in: supplierList } },
            { publisher: { $in: supplierList } },
          ],
        });
      }

      const ageList = parseCsvParam(ageRanges);
      if (ageList.length === 1) {
        andConditions.push({ ageRange: ageList[0] });
      } else if (ageList.length > 1) {
        andConditions.push({ ageRange: { $in: ageList } });
      }

      const mfgList = parseCsvParam(manufacturingOrigins);
      if (mfgList.length) {
        andConditions.push({ manufacturingOrigin: { $in: mfgList } });
      }

      const boList = parseCsvParam(brandOrigins);
      if (boList.length) {
        andConditions.push({ brandOrigin: { $in: boList } });
      }

      const colorList = parseCsvParam(coverColors);
      if (colorList.length) {
        andConditions.push({ coverColor: { $in: colorList } });
      }

      if (memberOnly != null && String(memberOnly).trim() !== '') {
        andConditions.push({ isMemberOnly: toBooleanLoose(memberOnly, false) });
      }

      const pMin = toNullableInt(pagesMin, { min: 0 });
      const pMax = toNullableInt(pagesMax, { min: 0 });
      if (pMin != null || pMax != null) {
        const range = {};
        if (pMin != null) range.$gte = pMin;
        if (pMax != null) range.$lte = pMax;
        andConditions.push({ pages: range });
      }

      const wMin = toNullableInt(weightMin, { min: 0 });
      const wMax = toNullableInt(weightMax, { min: 0 });
      if (wMin != null || wMax != null) {
        const range = {};
        if (wMin != null) range.$gte = wMin;
        if (wMax != null) range.$lte = wMax;
        andConditions.push({ weight: range });
      }

      const admin = req.user?.role === 'admin';
      const pub = mongoFilterPublishedCatalog();
      const q =
        andConditions.length === 0
          ? admin
            ? {}
            : pub
          : admin
            ? { $and: andConditions }
            : { $and: [...andConditions, pub] };
      const books = await Books.find(q)
        .populate('category')
        .populate({ path: 'series', select: 'name slug' })
        .populate({ path: 'authorRef', select: 'name slug' })
        .sort({ publishedAt: -1, createAt: -1 })
        .lean();
      const enriched = await flashSaleService.attachFlashSaleToBooks(books);
      return res.status(200).json(enriched);
    } catch (error) {
      return res.status(500).json({ error: 'Lỗi khi lọc sách', message: String(error.message) });
    }
  }

     async getBookSearch(req,res,next){
      try{
        await categoryCtl.ensureSeedAndMigrate();
        const admin = req.user?.role === 'admin';
        const pub = mongoFilterPublishedCatalog();
        const keySearch=req.query.key || ''
        if (!String(keySearch).trim()) {
          const all = await Books.find(admin ? {} : pub)
            .populate('category')
            .populate({ path: 'series', select: 'name slug' })
            .populate({ path: 'authorRef', select: 'name slug' })
            .sort({ publishedAt: -1, createAt: -1 })
            .lean();
          const enrichedAll = await flashSaleService.attachFlashSaleToBooks(all);
          return res.status(200).json(enrichedAll);
        }
        const keyTrim = String(keySearch).trim();
        const keyOid = strictObjectId24String(keyTrim);
        let authorRefById = [];
        if (keyOid) {
          const a = await Author.findById(keyOid).select('_id').lean();
          if (a) authorRefById = [{ authorRef: a._id }];
        }
        const searchRegex = new RegExp(keySearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const matchingCats = await Category.find({ name: { $regex: searchRegex } }).select('_id');
        const catIds = matchingCats.map((c) => c._id);
        const matchingAuthors = await Author.find({ name: { $regex: searchRegex } }).select('_id');
        const authorIds = matchingAuthors.map((a) => a._id);
        const textOr = {
          $or: [
            ...authorRefById,
            { name: { $regex: searchRegex } },
            { category: { $in: catIds } },
            { genres: searchRegex },
            { publisher: searchRegex },
            { supplier: searchRegex },
            { brand: searchRegex },
            { author: searchRegex },
            ...(authorIds.length ? [{ authorRef: { $in: authorIds } }] : []),
          ],
        };
        const books = await Books.find(admin ? textOr : { $and: [textOr, pub] })
          .populate('category')
          .populate({ path: 'series', select: 'name slug' })
          .populate({ path: 'authorRef', select: 'name slug' })
          .sort({ publishedAt: -1, createAt: -1 })
          .lean();
        const enriched = await flashSaleService.attachFlashSaleToBooks(books);
        return res.status(200).json(enriched);
      }
      catch(error){
         res.status(500).json({ error: 'Lỗi khi tìm kiếm sách' });
      }
     }
     async getAccountSearch(req,res,next){
      try{
        const keySearch=req.query.key;
        const searchRegex=new RegExp(keySearch,'i')
        const accounts = await Account.find({ email: { $regex: searchRegex } })
          .populate('membershipTier', 'name slug sortOrder active')
          .lean();
        return res.status(200).json(accounts)
      }catch(error){
        console.log(error)
        return res.status(500).json('Lỗi Khi tìm kiếm')
      }
     }
    
}
module.exports= new SiteController;