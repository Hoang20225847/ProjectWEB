const  mongoose  = require("mongoose");

const Schema=mongoose.Schema;
const Book =new Schema({
    name:{type:String,default:'',maxLength:255},
    /** Tên tác giả (đồng bộ từ bản ghi Author — dùng tìm kiếm / tương thích cũ) */
    author:{type:String,default:''},
    /** Tham chiếu tác giả (bảng Author) */
    authorRef: { type: Schema.Types.ObjectId, ref: 'Author', default: null },
    /** Nhà xuất bản */
    publisher: { type: String, default: '', trim: true, maxlength: 200 },
    /** Thương hiệu (VD: OEM) */
    brand: { type: String, default: '', trim: true, maxlength: 120 },
    /** Nhà cung cấp / đại lý (có thể khác NXB) */
    supplier: { type: String, default: '', trim: true, maxlength: 200 },
    /** Ngôn ngữ: vi | en | zh | other */
    language: { type: String, default: 'vi', trim: true, maxlength: 16 },
    /** Tag thể loại nội dung (comedy, romance, …) */
    genres: { type: [String], default: [] },
    /** Chủ đề / motif nội dung (semantic, VD: tuổi thơ, chữa lành) */
    themes: { type: [String], default: [] },
    /** Tông cảm xúc (semantic, VD: buồn, nhẹ nhàng) — phục vụ vector search & filter */
    mood: { type: [String], default: [] },
    /** Tag nội dung tự do bổ sung cho genres (semantic) */
    contentTags: { type: [String], default: [] },
    /** Đối tượng đề xuất (VD: teen, adult, middle_grade) — filter cứng + RAG metadata */
    audience: { type: [String], default: [] },
    /** Quốc gia / bối cảnh gợi ý (xuất xứ nội dung hoặc NXB — tùy nhập liệu) */
    country: { type: String, default: '', trim: true, maxlength: 80 },
    /** Độ tuổi đề xuất: "18+", "10+", … */
    ageRange: { type: String, default: '', trim: true, maxlength: 32 },
    /** Nơi gia công / sản xuất */
    manufacturingOrigin: { type: String, default: '', trim: true, maxlength: 120 },
    /** Xuất xứ thương hiệu */
    brandOrigin: { type: String, default: '', trim: true, maxlength: 120 },
    /** Màu bìa (gợi ý lọc) */
    coverColor: { type: String, default: '', trim: true, maxlength: 40 },
    /** Năm xuất bản (nếu không có, có thể lọc theo năm tạo bản ghi) */
    publishedYear:{type:Number,default:null},
    /** Năm sản xuất / tái bản (tách với năm xuất bản nếu cần) */
    productionYear: { type: Number, default: null },
    /** Số trang */
    pages: { type: Number, default: null, min: 0 },
    /** Trọng lượng (gram) */
    weight: { type: Number, default: null, min: 0 },
    /** Kiểu bìa: paperback | hardcover | spiral | flexibound | other (validate ở API) */
    format: { type: String, default: null, trim: true, maxlength: 32 },
    description:{type:String},
    img:{type:String},
    /** Ảnh phụ trang chi tiết (gallery, tối đa 4) */
    img1: { type: String, default: '' },
    img2: { type: String, default: '' },
    img3: { type: String, default: '' },
    img4: { type: String, default: '' },
    createAt:{type:Date,default:Date.now},
    updateAt:{type:Date,default:Date.now},
    category:{type:Schema.Types.ObjectId,ref:'Category',required:true},
    /** Bộ sách / series (tùy chọn) */
    series: { type: Schema.Types.ObjectId, ref: 'Series', default: null },
    /** Giá niêm yết — chuỗi số đồng đầy đủ (VD "150000"), đồng bộ lọc & giỏ hàng */
    price: { type: String },
    discount:{type:Number,default:0},
    /** Sách có ưu đãi dành riêng cho hội viên */
    isMemberOnly: { type: Boolean, default: true },
    evaluate:{type:Number,default:5},
    sold:{type:Number,default:0},
    /** Tồn kho: chỉ khi có giá trị số — không set = không quản lý tồn theo SL */
    stock: { type: Number },
    /** Ngưỡng cảnh báo sắp hết (so với stock) — mặc định 5 */
    minStock: { type: Number, default: 5 },
    /** Lần nhập kho gần nhất (cập nhật khi nhập) */
    stockImportedAt: { type: Date, default: null },
    /** Giá vốn đơn vị (đồng VNĐ, cùng đơn vị với totalAmount / giá bán) — phục vụ COGS & LN */
    costPrice: { type: Number, default: 0 },
    /** Lần bán gần nhất (cập nhật khi có đơn) */
    lastSoldAt: { type: Date, default: null },
    isFavourite:{type:Boolean,default:true},
    /** Trạng thái nội dung / catalog (biên tập) — không phải trạng thái kho */
    status: {
      type: String,
      enum: ['draft', 'published', 'unlisted', 'archived'],
      default: 'draft',
    },
    /** Ghi khi chuyển sang published; giữ khi về draft/unlisted */
    publishedAt: { type: Date, default: null },
    /**
     * Soft delete: khi != null, sách bị ẩn khỏi catalog/storefront/RAG/vector
     * nhưng vẫn còn document để Order.items.bookId không vỡ.
     * Chỉ hard delete khi không có Order/Cart/FlashSale tham chiếu.
     */
    deletedAt: { type: Date, default: null, index: true },
});


module.exports=mongoose.model('Book',Book);