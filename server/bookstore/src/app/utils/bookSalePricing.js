const { listPriceVndFromBookPrice } = require('./moneyVnd');



/// <summary>

/// Ưu tiên % giảm: (1) flash sale → (2) % riêng sách → (3) % hạng hội viên (chỉ sách isMemberOnly).

/// </summary>

function resolveBookSaleDiscountPercent({

  bookDiscount = 0,

  flashDiscountPercent = 0,

  isMemberOnly = false,

  isMember = false,

  memberTierDiscountPercent = 0,

} = {}) {

  const flash = Math.max(0, Math.min(99, Math.round(Number(flashDiscountPercent) || 0)));

  if (flash > 0) return flash;



  const bookDisc = Math.max(0, Math.min(99, Math.round(Number(bookDiscount) || 0)));

  if (bookDisc > 0) {

    if (isMemberOnly && !isMember) return 0;

    return bookDisc;

  }



  if (isMemberOnly && isMember) {

    return Math.max(0, Math.min(99, Math.round(Number(memberTierDiscountPercent) || 0)));

  }



  return 0;

}



/// <summary>

/// Giá bán sau giảm (đồng, làm tròn lên) từ giá gốc Book.price và ngữ cảnh khuyến mãi.

/// </summary>

function discountedBookPriceVnd(book, options = {}) {

  const base = listPriceVndFromBookPrice(book?.price);

  const pct = resolveBookSaleDiscountPercent({

    bookDiscount: book?.discount,

    flashDiscountPercent: options.flashDiscountPercent,

    isMemberOnly: !!book?.isMemberOnly,

    isMember: !!options.isMember,

    memberTierDiscountPercent: options.memberTierDiscountPercent,

  });

  return Math.max(0, Math.ceil(base * (1 - pct / 100)));

}



module.exports = {

  resolveBookSaleDiscountPercent,

  discountedBookPriceVnd,

};


