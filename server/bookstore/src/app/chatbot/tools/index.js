const searchBooks = require('./searchBooks');
const getFlashSale = require('./getFlashSale');
const checkVoucher = require('./checkVoucher');
const getMemberBenefits = require('./getMemberBenefits');
const getUserOrders = require('./getUserOrders');

/**
 * TOOL_DEFINITIONS theo schema OpenAI function-calling.
 * Khi đổi provider có thể map lại sang format khác (ví dụ Anthropic tools).
 */
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'searchBooks',
      description:
        'Tìm sách trong kho dựa trên từ khoá, thể loại, giá, ngôn ngữ. Chỉ trả sách đang bán và còn hàng. Dùng khi user hỏi gợi ý sách, so sánh, tìm sách theo chủ đề.',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: 'Từ khoá: tên sách, tác giả, hoặc chủ đề ngắn.' },
          genres: { type: 'array', items: { type: 'string' }, description: 'Danh sách thể loại.' },
          themes: { type: 'array', items: { type: 'string' }, description: 'Chủ đề semantic (tuổi thơ, chữa lành...).' },
          mood: { type: 'array', items: { type: 'string' }, description: 'Tông cảm xúc (buồn, nhẹ nhàng...).' },
          contentTags: { type: 'array', items: { type: 'string' }, description: 'Nhãn nội dung bổ sung.' },
          audience: { type: 'array', items: { type: 'string' }, description: 'Đối tượng (teen, adult...).' },
          country: { type: 'string', description: 'Quốc gia / bối cảnh (lọc metadata).' },
          minPrice: { type: 'number', description: 'Giá tối thiểu (đồng).' },
          maxPrice: { type: 'number', description: 'Giá tối đa (đồng).' },
          language: { type: 'string', description: 'vi | en | zh' },
          sort: {
            type: 'string',
            enum: ['price_asc', 'price_desc', 'best_selling', 'newest'],
          },
          limit: { type: 'number', description: 'Số sách (tối đa 6).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getFlashSale',
      description: 'Lấy các chương trình flash sale đang chạy và danh sách sách kèm giá sale.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'checkVoucher',
      description:
        'Kiểm tra mã voucher: còn hạn, đủ điều kiện đơn tối thiểu, và ước lượng tiền giảm.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Mã voucher (UPPERCASE).' },
          orderTotalDong: { type: 'number', description: 'Tổng giá trị đơn (đồng) nếu có.' },
          isMember: { type: 'boolean' },
          tierSlug: { type: 'string', description: 'silver | gold | diamond ...' },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getMemberBenefits',
      description: 'Trả về ưu đãi hội viên theo tier (silver / gold / diamond...).',
      parameters: {
        type: 'object',
        properties: {
          tierSlug: { type: 'string', description: 'Bỏ trống để lấy tất cả hạng.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getUserOrders',
      description:
        'Lấy đơn hàng của CHÍNH user đang đăng nhập (email được hệ thống bơm vào, KHÔNG nhận email từ user). Chỉ dùng khi câu hỏi liên quan tới đơn của họ (trạng thái, lịch sử mua, hoá đơn, gợi ý dựa trên sách đã mua). Nếu user chưa đăng nhập, tool trả requiresLogin=true.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Số đơn gần nhất (mặc định 5, tối đa 10).' },
          status: {
            type: 'string',
            description: 'Lọc trạng thái: "Chờ xử lý" | "Đang giao" | "Hoàn thành" | "Đã hủy".',
          },
        },
      },
    },
  },
];

/** Map tên tool -> hàm thực thi. Mọi tool phải nhận 1 object args. */
const TOOLS = {
  searchBooks,
  getFlashSale,
  checkVoucher,
  getMemberBenefits,
  getUserOrders,
};

/**
 * Thực thi an toàn 1 tool theo tên. Trả về { ok, name, data, error }.
 * Không bao giờ throw — để LLM có thể đọc lỗi và xử lý mượt.
 */
async function runTool(name, args) {
  const fn = TOOLS[name];
  if (!fn) return { ok: false, name, error: `Tool ${name} không tồn tại.` };
  try {
    const data = await fn(args || {});
    return { ok: true, name, data };
  } catch (err) {
    console.error(`[chatbot.tools] ${name} failed:`, err?.message || err);
    return { ok: false, name, error: err?.message || 'tool_error' };
  }
}

module.exports = { TOOL_DEFINITIONS, TOOLS, runTool };
