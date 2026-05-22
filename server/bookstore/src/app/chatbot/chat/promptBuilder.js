const { listPriceVndFromBookPrice } = require('../../utils/moneyVnd');

/**
 * Build prompt cuối cùng gửi cho LLM chính.
 * - system: vai trò + giới hạn + format
 * - chatContext: 6 tin gần nhất
 * - toolResults: kết quả từ tools (đã chạy trước đó)
 * - ragBooks: sách top-K từ vector search
 * - question: câu hỏi user
 */
function buildSystemPrompt() {
  return [
    'Bạn là trợ lý tư vấn của BookStore, trả lời bằng tiếng Việt thân thiện, ngắn gọn, đúng trọng tâm.',
    'Nhiệm vụ: tư vấn sách, voucher, flash sale, ưu đãi hội viên và trả lời câu hỏi khách đặt mua đồ cửa hiệu sách.',
    '',
    'QUY TẮC NỘI DUNG:',
    '1. TUYỆT ĐỐI không bịa thông tin sách / giá / khuyến mãi. Nếu thiếu dữ liệu, hãy nói thẳng "mình chưa có thông tin này".',
    '2. Khi nhắc đến sách, gắn kèm tên + tác giả + giá nếu có trong CONTEXT.',
    '2b. Nếu khối SÁCH LIÊN QUAN ghi "giảm X% từ ZZ.ZZZđ" — đó là KM thường xuyên của riêng cuốn sách (không phải flash sale). Hiển thị giá đã giảm và nói rõ mức giảm khi gợi ý.',
    '2c. Nếu cùng cuốn sách vừa có giá đã giảm trong SÁCH LIÊN QUAN, vừa xuất hiện trong KẾT QUẢ TOOL getFlashSale — ƯU TIÊN flash sale (giá có khung giờ); ghi chú ngắn "đang flash sale" nếu hợp lý.',
    '3. Không tiết lộ giá vốn, supplier, tồn kho tối thiểu hay dữ liệu nội bộ — chỉ dùng giá bán & còn hàng/hết hàng.',
    '4. Khi user hỏi voucher mà chưa cung cấp mã, hỏi lại 1 lần ngắn gọn.',
    '5. Nếu có sách phù hợp, gợi ý 2-4 cuốn rõ ràng.',
    '6. Luôn lịch sự, khuyến khích user xem chi tiết / thêm vào giỏ.',
    '7. Đơn hàng cá nhân: CHỈ tư vấn dựa trên đơn hàng / lịch sử mua khi user ĐÃ đăng nhập (thông tin USER bên dưới ghi rõ isLoggedIn). Nếu chưa đăng nhập, KHÔNG hỏi email, hãy mời họ đăng nhập rồi quay lại — và vẫn có thể tư vấn sách chung.',
    '9. Flash sale / voucher / ưu đãi: dùng dữ liệu trong khối "KẾT QUẢ TOOL" và "USER" để giải thích; không cần sách trong SÁCH LIÊN QUAN nếu hỏi về KM.',
    '10. Nếu có khối RAG FAQ hoặc RAG PROMOTIONS (tìm semantic tách domain): dùng làm gợi ý khái niệm; giá và thời hạn KM vẫn ưu tiên KẾT QUẢ TOOL (getFlashSale, checkVoucher) khi có.',
    '11. Sở thích đọc: nếu user mô tả gu (kinh dị, tự truyện, trẻ em, học tiếng Anh…) thì căn vào danh SÁCH LIÊN QUAN và thể loại trong khối sách để gợi ý thích hợp; không được bịa đầu sách không nằm trong CONTEXT.',
    'QUY TẮC ĐỊNH DẠNG (BẮT BUỘC):',
    'A. KHÔNG viết câu trả lời thành 1 khối liền. Chia thành các ĐOẠN ngắn, mỗi đoạn 1-2 câu, các đoạn cách nhau bằng 1 dòng trống (xuống dòng đôi).',
    'B. Khi liệt kê từ 2 mục trở lên (sách, voucher, ưu đãi...), DÙNG gạch đầu dòng, mỗi mục 1 dòng bắt đầu bằng "- ".',
    'C. Bôi đậm TÊN SÁCH bằng cú pháp **Tên sách**. KHÔNG bôi đậm giá tiền hay cả câu.',
    'D. Mỗi câu trả lời nên có cấu trúc: (1) câu mở ngắn → (2) danh sách hoặc đoạn nội dung → (3) câu chốt mời xem chi tiết / thêm vào giỏ. Mỗi phần cách nhau 1 dòng trống.',
    'E. KHÔNG dùng tiêu đề Markdown (#, ##), KHÔNG dùng bảng. Chỉ dùng **bold** và "- " bullet.',
    'F. Mỗi câu trả lời tối đa ~120 từ. Ngắn gọn, dễ đọc trong khung chat.',
  ].join('\n');
}

function formatUserBlock(user) {
  if (!user) return '';
  const lines = [];
  lines.push(`- isLoggedIn: ${user.isLoggedIn ? 'true' : 'false'}`);
  if (user.isLoggedIn) {
    if (user.email) lines.push(`- email: ${user.email}`);
    lines.push(`- isMember: ${user.isMember ? 'true' : 'false'}`);
    if (user.tierSlug) lines.push(`- tierSlug: ${user.tierSlug}`);
  }
  return `USER:\n${lines.join('\n')}`;
}

/**
 * Build chuỗi giá cho 1 cuốn sách, kèm % giảm "thường xuyên" (không phải flash sale).
 * - listPrice: giá niêm yết (Book.price, đồng).
 * - discount: % giảm trên Book.discount (0–100); flash sale xử lý riêng trong tool getFlashSale.
 */
function formatBookPriceWithDiscount(book) {
  const listPrice = listPriceVndFromBookPrice(book?.price);
  if (listPrice <= 0) return { text: 'liên hệ', listPrice: 0, discountPercent: 0, salePrice: 0 };
  const pct = Math.max(0, Math.min(99, Math.round(Number(book?.discount) || 0)));
  if (pct <= 0) {
    return {
      text: `${listPrice.toLocaleString('vi-VN')}đ`,
      listPrice,
      discountPercent: 0,
      salePrice: listPrice,
    };
  }
  const salePrice = Math.max(0, Math.round(listPrice * (1 - pct / 100)));
  const text = `${salePrice.toLocaleString('vi-VN')}đ (giảm ${pct}% từ ${listPrice.toLocaleString('vi-VN')}đ)`;
  return { text, listPrice, discountPercent: pct, salePrice };
}

function formatBooksBlock(books) {
  if (!Array.isArray(books) || !books.length) return '';
  const lines = books.map((b, idx) => {
    const priceInfo = formatBookPriceWithDiscount(b);
    const stockTxt = typeof b.stock === 'number' ? (b.stock > 0 ? `còn ${b.stock}` : 'hết hàng') : 'còn hàng';
    const genres = Array.isArray(b.genres) && b.genres.length ? ` | thể loại: ${b.genres.join(', ')}` : '';
    const mood = Array.isArray(b.mood) && b.mood.length ? ` | tông: ${b.mood.join(', ')}` : '';
    const themes =
      Array.isArray(b.themes) && b.themes.length ? ` | chủ đề: ${b.themes.join(', ')}` : '';
    const cat =
      typeof b.category === 'object' && b.category?.name ? ` | danh mục: ${b.category.name}` : '';
    return `[${idx + 1}] ${b.name} — ${b.author || 'N/A'} — ${priceInfo.text} (${stockTxt})${cat}${genres}${themes}${mood}`;
  });
  return `SÁCH LIÊN QUAN:\n${lines.join('\n')}`;
}

function formatRagFaq(rows) {
  if (!Array.isArray(rows) || !rows.length) return '';
  const lines = rows.map((r, i) => {
    const qtxt = String(r.question || '').slice(0, 420);
    const atxt = String(r.answer || '').slice(0, 800);
    return `[FAQ ${i + 1}] ${qtxt} → ${atxt}`;
  });
  return `RAG FAQ (vector, có thể bổ sung chính sách — kiểm tra với cửa hàng thực tế):\n${lines.join('\n')}`;
}

function formatRagPromotions(rows) {
  if (!Array.isArray(rows) || !rows.length) return '';
  const lines = rows.map((r, i) => {
    const t = String(r.title || '').slice(0, 200);
    const d = String(r.description || '').slice(0, 400);
    return `[Khuyến mãi ${i + 1}] ${t}${d ? `: ${d}` : ''}`;
  });
  return `RAG PROMOTIONS (chỉ là mô tả chương trình semantic — giá/còn KM xem BLOCK TOOL getFlashSale nếu có):\n${lines.join('\n')}`;
}

function formatToolResultsBlock(toolResults) {
  if (!Array.isArray(toolResults) || !toolResults.length) return '';
  const lines = toolResults.map((r) => {
    if (!r.ok) return `- ${r.name}: lỗi (${r.error || 'không rõ'})`;
    try {
      return `- ${r.name}: ${JSON.stringify(r.data).slice(0, 1500)}`;
    } catch (_e) {
      return `- ${r.name}: [không serialize được]`;
    }
  });
  return `KẾT QUẢ TOOL:\n${lines.join('\n')}`;
}

function buildMessages({
  chatContext = [],
  toolResults = [],
  ragBooks = [],
  ragFaq = [],
  ragPromotions = [],
  question = '',
  user = null,
} = {}) {
  const systemBlocks = [buildSystemPrompt()];
  const userBlock = formatUserBlock(user);
  const booksBlock = formatBooksBlock(ragBooks);
  const faqBlock = formatRagFaq(ragFaq);
  const promoBlock = formatRagPromotions(ragPromotions);
  const toolBlock = formatToolResultsBlock(toolResults);
  if (userBlock) systemBlocks.push(userBlock);
  if (booksBlock) systemBlocks.push(booksBlock);
  if (faqBlock) systemBlocks.push(faqBlock);
  if (promoBlock) systemBlocks.push(promoBlock);
  if (toolBlock) systemBlocks.push(toolBlock);

  const messages = [
    { role: 'system', content: systemBlocks.join('\n\n') },
    ...chatContext,
    { role: 'user', content: question },
  ];
  return messages;
}

module.exports = { buildMessages, buildSystemPrompt, formatBookPriceWithDiscount };
