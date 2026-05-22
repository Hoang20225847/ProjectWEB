const mongoose = require('mongoose');
const Book = require('../models/Books');
const Author = require('../models/Author');

function slugifyBase(name) {
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

async function uniqueSlug(base) {
  let slug = slugifyBase(base);
  let n = 0;
  while (await Author.findOne({ slug }).select('_id').lean()) {
    n += 1;
    slug = `${slugifyBase(base)}-${n}`;
  }
  return slug;
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Một lần: chuỗi author cũ → bản ghi Author + authorRef, đồng bộ trường author.
 */
async function migrateLegacyAuthorsToRefs() {
  const db = mongoose.connection.db;
  if (!db) return;
  const mig = db.collection('app_migrations');
  const key = 'books_legacy_author_to_authorref_v1';
  if (await mig.findOne({ _id: key })) return;

  const books = await Book.find({
    $and: [
      { $or: [{ authorRef: { $exists: false } }, { authorRef: null }] },
      { author: { $exists: true, $nin: ['', null] } },
    ],
  })
    .select('_id author')
    .lean();

  const cache = new Map();
  for (const b of books) {
    const raw = String(b.author || '').trim().replace(/\s+/g, ' ');
    if (!raw) continue;
    const keyName = raw.toLowerCase();
    let aid = cache.get(keyName);
    if (!aid) {
      const existing = await Author.findOne({ name: new RegExp(`^${escapeRe(raw)}$`, 'i') })
        .select('_id name')
        .lean();
      if (!existing) {
        const created = await Author.create({
          name: raw.slice(0, 200),
          slug: await uniqueSlug(raw),
          description: '',
          sortOrder: 0,
        });
        aid = created._id;
        cache.set(keyName, aid);
        await Book.updateOne({ _id: b._id }, { $set: { authorRef: aid, author: created.name } });
      } else {
        aid = existing._id;
        cache.set(keyName, aid);
        await Book.updateOne({ _id: b._id }, { $set: { authorRef: aid, author: existing.name } });
      }
    } else {
      const adoc = await Author.findById(aid).select('name').lean();
      await Book.updateOne(
        { _id: b._id },
        { $set: { authorRef: aid, author: adoc ? adoc.name : raw } }
      );
    }
  }

  await mig.insertOne({ _id: key, ranAt: new Date() });
}

module.exports = { migrateLegacyAuthorsToRefs };
