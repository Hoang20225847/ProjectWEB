/**
 * FAQ semantic — không gộp vào vector sản phẩm.
 * Admin có thể mở rộng FAQ_SEED hoặc thay thế sync từ DB sau.
 */

const { embedText } = require('./embedder');
const qdrant = require('../clients/qdrantClient');

const FAQ_SEED = [
  {
    id: 'delivery',
    category: 'vận hành',
    question: 'Cửa hàng giao hàng như thế nào và mất khoảng bao lâu?',
    answer:
      'Thời gian giao phụ thuộc địa chỉ và đơn vị vận chuyển. Thông thường nội thành 1–3 ngày, tỉnh khác có thể 3–7 ngày. Bạn có thể xem mốc cụ thể ở bước thanh toán.',
  },
  {
    id: 'return',
    category: 'chính sách',
    question: 'Đổi hoặc trả sách thì được không?',
    answer:
      'Sản phẩm lỗi in ấn hoặc hư khi nhận sẽ được hỗ trợ đổi trong thời hạn quy định của cửa hàng. Chi tiết thời hạn và điều kiện được ghi trong trang chính sách của website.',
  },
  {
    id: 'payment',
    category: 'thanh toán',
    question: 'Cửa hàng chấp nhận các hình thức thanh toán nào?',
    answer:
      'Thường hỗ trợ COD, chuyển khoản, và các cổng thanh toán trực tuyến. Phần hiển thị khi đặt đơn sẽ liệt kê phương thức đang bật cho đơn của bạn.',
  },
  {
    id: 'member',
    category: 'hội viên',
    question: 'Hội viên được ưu đãi những quyền lợi gì?',
    answer:
      'Ưu đãi và quyền lợi hội viên được cấu hình theo tier. Bạn có thể xem mức giảm, quyền truy cập sách member-only và tích điểm trong mục thành viên trên site.',
  },
  {
    id: 'order_help',
    category: 'mua hàng',
    question: 'Làm sao để đặt sách trên website?',
    answer:
      'Chọn sách, thêm vào giỏ, điền thông tin nhận hàng và chọn thanh toán. Sau khi đặt thành công bạn sẽ nhận mã đơn để theo dõi trạng thái.',
  },
];

function faqToEmbedText(row) {
  return [`Câu hỏi thường gặp: ${row.question}`, `Trả lời (tóm tắt): ${row.answer}`].join('\n');
}

function faqPayload(row) {
  return {
    domain: 'faq',
    faqId: String(row.id),
    category: String(row.category || 'general'),
    question: String(row.question || '').slice(0, 400),
    answer: String(row.answer || '').slice(0, 1200),
  };
}

async function syncFaqRow(row) {
  const id = qdrant.faqSlugToPointId(row.id);
  const text = faqToEmbedText(row).trim();
  if (!text) return { ok: false, reason: 'empty' };
  const vec = await embedText(text);
  if (!Array.isArray(vec) || vec.length === 0) return { ok: false, reason: 'embed_failed' };
  const ok = await qdrant.upsertPoint('faq', { id, vector: vec, payload: faqPayload(row) });
  return { ok, id: row.id };
}

async function syncAllFaq() {
  const out = { ok: 0, fail: 0 };
  for (const row of FAQ_SEED) {
    const r = await syncFaqRow(row);
    if (r.ok) out.ok += 1;
    else out.fail += 1;
  }
  return out;
}

module.exports = {
  FAQ_SEED,
  syncAllFaq,
  syncFaqRow,
  faqPayload,
};
