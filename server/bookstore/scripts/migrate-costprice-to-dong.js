/**
 * Một lần: quy đổi giá vốn / giá nhập từ "nghìn rút gọn" (VD 45 = 45.000đ) sang đồng đầy đủ (45000),
 * để khớp totalAmount đơn hàng và tính COGS / lãi đúng.
 *
 * Chạy:  node scripts/migrate-costprice-to-dong.js --dry-run
 * Áp dụng: node scripts/migrate-costprice-to-dong.js --apply
 *
 * Hệ số mặc định 1000; ghi đè: COST_SCALE=1000
 * URI: MONGODB_URI hoặc mặc định mongodb://localhost:27017/book_store
 *
 * Cảnh báo: không chạy --apply hai lần (sẽ nhân đôi). Sao lưu DB trước.
 */

const mongoose = require('mongoose');
const path = require('path');

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/book_store';
const SCALE = Number(process.env.COST_SCALE || 1000);
const dryRun = process.argv.includes('--dry-run');
const apply = process.argv.includes('--apply');

require(path.join(__dirname, '../src/app/models/Books'));
require(path.join(__dirname, '../src/app/models/Orders'));
require(path.join(__dirname, '../src/app/models/StockMovement'));
const Book = require(path.join(__dirname, '../src/app/models/Books'));
const Order = require(path.join(__dirname, '../src/app/models/Orders'));
const StockMovement = require(path.join(__dirname, '../src/app/models/StockMovement'));

async function previewBooks() {
  const rows = await Book.find({ costPrice: { $gt: 0 } })
    .select('name costPrice')
    .limit(8)
    .lean();
  return rows.map((b) => ({
    name: b.name,
    before: b.costPrice,
    after: Math.round(Number(b.costPrice) * SCALE),
  }));
}

async function migrateBooks() {
  const match = { costPrice: { $gt: 0 } };
  const n = await Book.countDocuments(match);
  if (dryRun) {
    console.log(`[dry-run] books.costPrice > 0: ${n} documents`);
    const prev = await previewBooks();
    if (prev.length) console.log('[dry-run] sample (name / before → after):', JSON.stringify(prev, null, 2));
    return { matched: n, modified: 0 };
  }
  const res = await Book.collection.updateMany(match, [
    { $set: { costPrice: { $round: [{ $multiply: ['$costPrice', SCALE] }, 0] } } },
  ]);
  console.log(`books: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  return { matched: res.matchedCount, modified: res.modifiedCount };
}

async function migrateStockMovements() {
  const match = { importPrice: { $gt: 0 } };
  const n = await StockMovement.countDocuments(match);
  if (dryRun) {
    console.log(`[dry-run] stock_movements.importPrice > 0: ${n} documents`);
    return { matched: n, modified: 0 };
  }
  const res = await StockMovement.collection.updateMany(match, [
    { $set: { importPrice: { $round: [{ $multiply: ['$importPrice', SCALE] }, 0] } } },
  ]);
  console.log(`stock_movements: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  return { matched: res.matchedCount, modified: res.modifiedCount };
}

async function migrateOrders() {
  const match = { items: { $elemMatch: { unitImportCost: { $gt: 0 } } } };
  const n = await Order.countDocuments(match);
  if (dryRun) {
    console.log(`[dry-run] orders with any items.unitImportCost > 0: ${n} documents`);
    return { matched: n, modified: 0 };
  }
  const res = await Order.collection.updateMany(match, [
    {
      $set: {
        items: {
          $map: {
            input: '$items',
            as: 'it',
            in: {
              $mergeObjects: [
                '$$it',
                {
                  unitImportCost: {
                    $let: {
                      vars: { u: { $toDouble: { $ifNull: ['$$it.unitImportCost', 0] } } },
                      in: {
                        $cond: {
                          if: { $gt: ['$$u', 0] },
                          then: { $round: [{ $multiply: ['$$u', SCALE] }, 0] },
                          else: '$$it.unitImportCost',
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
  ]);
  console.log(`orders: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  return { matched: res.matchedCount, modified: res.modifiedCount };
}

async function main() {
  if (!dryRun && !apply) {
    console.log('Thiếu cờ. Dùng: --dry-run (xem trước) hoặc --apply (ghi DB).');
    process.exit(1);
  }
  if (dryRun && apply) {
    console.log('Chỉ chọn một trong hai: --dry-run hoặc --apply.');
    process.exit(1);
  }
  if (!Number.isFinite(SCALE) || SCALE <= 0) {
    console.error('COST_SCALE không hợp lệ.');
    process.exit(1);
  }

  await mongoose.connect(mongoURI);
  console.log('Connected:', mongoURI.replace(/\/\/.*@/, '//***@'));
  console.log('MODE:', dryRun ? 'dry-run' : 'APPLY', '| SCALE:', SCALE);

  await migrateBooks();
  await migrateStockMovements();
  await migrateOrders();

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
