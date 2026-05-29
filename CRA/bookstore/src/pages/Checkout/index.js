
import styles from './Checkout.module.scss'
import classNames from 'classnames/bind'
import vnpay from '../../components/assets/img/vnpay.png'
import momo from '../../components/assets/img/momo.png'
import cash from '../../components/assets/img/cash.png'

import '../../components/assets/css/main.css'
import '@fortawesome/fontawesome-free/css/all.min.css';
import axios from '../../components/axios/axios.customize'
import { useNavigate } from 'react-router-dom';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {getCart,updateCart} from '../../app/api/CartApi'
import {getAddressDefault} from '../../app/api/AddressApi'
import { AuthContext } from '../../components/context/auth.context';
import { formatVndDisplay } from '../../components/function/function.js';
import { toast } from 'react-toastify';
const cx = classNames.bind(styles)

function Checkout() {
  const [paymentMethod,setPayMentMethod]=useState(0)
  const navigate=useNavigate();
  const[data,setData]=useState(null)
  const[address,setAddress]=useState(null)
  const location=useLocation();
  const {auth}=useContext(AuthContext)
  const from = location.state?.from || '';
  const [quote, setQuote] = useState(null);
  const [voucherDraft, setVoucherDraft] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [myVouchers, setMyVouchers] = useState([]);
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);
  const [voucherTab, setVoucherTab] = useState('active');
  const [redeemPointsDraft, setRedeemPointsDraft] = useState('');
  const [redeemPoints, setRedeemPoints] = useState(0);
  const lastAppliedVoucherRef = useRef('');

  useEffect(  ()=>{
   const fetchData = async () => {
    const {  items } = location.state || {  items: [] };
    setData(items);
   try{ const info = await getAddressDefault(auth.user.email);
    setAddress(info);}
    catch(error){
      console.log(error)
    }
  };
  fetchData();
},[auth?.user?.email, location.state])

  useEffect(() => {
    if (!auth?.user?.email) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await axios.get('/api/membership/my-vouchers');
        if (!cancelled) setMyVouchers(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setMyVouchers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth?.user?.email]);

  useEffect(() => {
    if (!data || !auth?.user?.email) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    const goodsSubtotalDong = data.reduce((s, it) => s + (Number(it.totalPrice) || 0), 0);
    (async () => {
      try {
        const q = await axios.post('/api/membership/quote', {
          goodsSubtotalDong,
          voucherCode: voucherCode.trim() || undefined,
          redeemPoints,
          items: data,
        });
        if (!cancelled) setQuote(q);
      } catch {
        if (!cancelled) setQuote(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, auth?.user?.email, voucherCode, redeemPoints]);

  const totalPriceItem = quote ? quote.goodsSubtotalDong : data
    ? data.reduce((s, it) => s + (Number(it.totalPrice) || 0), 0)
    : 0;
  const transCost = quote ? quote.shippingFeeDong : 40000;
  const totalCost = quote ? quote.totalDong : totalPriceItem + transCost;
  const activeVouchers = myVouchers.filter((v) => v.displayStatus === 'active');
  const expiringSoonVouchers = myVouchers.filter((v) => v.displayStatus === 'expiringSoon');
  const usableVoucherCount = activeVouchers.length + expiringSoonVouchers.length;
  const appliedVoucherCode = String(quote?.voucherCodeApplied || voucherCode || '').trim().toUpperCase();
  const appliedVoucherMeta = useMemo(() => {
    if (!appliedVoucherCode) return null;
    return myVouchers.find((v) => String(v.code || '').toUpperCase() === appliedVoucherCode) || null;
  }, [myVouchers, appliedVoucherCode]);

  useEffect(() => {
    if (!quote || quote.voucherDiscountDong <= 0 || !quote.voucherCodeApplied) return;
    const code = String(quote.voucherCodeApplied || '').trim().toUpperCase();
    if (!code || lastAppliedVoucherRef.current === code) return;
    lastAppliedVoucherRef.current = code;
    toast.success(`Áp dụng voucher ${code} thành công`);
  }, [quote]);

  const handleSelectVoucher = (code) => {
    const nextCode = String(code || '').trim();
    if (!nextCode) return;
    setVoucherDraft(nextCode);
    setVoucherCode(nextCode);
    setVoucherModalOpen(false);
    toast.success(`Đã chọn voucher ${nextCode}`);
  };

  const handleApplyVoucherCode = () => {
    const code = String(voucherDraft || '').trim();
    if (!code) {
      toast.error('Vui lòng nhập mã voucher');
      return;
    }
    setVoucherCode(code);
  };

  const handleApplyPoints = () => {
    const raw = String(redeemPointsDraft || '').replace(/\D/g, '');
    const nextPoints = Math.max(0, Math.round(Number(raw) || 0));
    if (nextPoints <= 0) {
      setRedeemPoints(0);
      toast.info('Đã bỏ áp dụng điểm');
      return;
    }
    setRedeemPoints(nextPoints);
    toast.success(`Đã áp dụng ${nextPoints.toLocaleString('vi-VN')} điểm`);
  };

  const handleUseMaxPoints = () => {
    const maxPoints = Math.max(0, Number(quote?.availablePoints) || 0);
    setRedeemPointsDraft(String(maxPoints));
    setRedeemPoints(maxPoints);
    toast.success('Đã chọn dùng tối đa điểm hiện có');
  };

  const handleOrder = async () =>{
    if(address==null)
    {
      toast.error('Vui lòng thêm địa chỉ')
      return;
    }
    const formData={
      email:auth.user.email,
      items:data,
      voucherCode: voucherCode.trim() || undefined,
      redeemPoints,
      address:{
        name:address.name,
        phone:address.phone,
        details:address.details,
        province:address.province
      }
    }
    console.log("form gửi đi khi đặt hàng là:",formData)
   if(paymentMethod==0){ try {
        const res=await axios.post('/api/order',formData)
         console.log(res);
        if(from === 'cart')
        {
          const cart = await getCart(auth.user.email)
          const remainingItems = cart.items.filter(item => !item.selected);
           await updateCart(auth.user.email, remainingItems);
        }
        navigate('/profile/purchase');
        toast.success(res.message)
    } catch(error){
        toast.error('Đặt Hàng không thành công')
    }}
    else if (paymentMethod === 1) {
      try {
        const paymentUrl = await axios.post('/payapi/VnPay', formData);
        if (typeof paymentUrl === 'string' && paymentUrl.startsWith('http')) {
          if (from === 'cart') {
            sessionStorage.setItem('checkout_vnpay_clear_cart', auth.user.email);
          }
          window.location.href = paymentUrl;
          return;
        }
        toast.error('Không nhận được link thanh toán VNPay');
      } catch (error) {
        const msg =
          error?.response?.data?.message ||
          error?.message ||
          'Thanh toán VNPay thất bại';
        toast.error(msg);
      }
    }
     else if( paymentMethod===2){
      try{
        const res = await axios.post('/payapi/Momo',formData)
         if(res) {
            window.location.href = res;
         }
      }
      catch(error){
        toast.error('Thanh Toan that bai')
      }
    }

  }
    return ( 
      <>
      <div className="grid">
        <div className={`${cx('checkout-container')} `}>
          <div className={cx('checkout-info-customer')}>
            <div className={cx('checkout-info-content')}>
              <div className={cx('checkout-address-title')}>
              <i className="fa-solid fa-location-dot"></i>
              <span className={cx('address-title')}>Địa Chỉ Nhận Hàng</span>
              </div>
              { address ? (
                <div className={cx('checkout-info')}>
                <span className={cx('checkout-name')}>{address.name}</span>
                <span className={cx('checkout-phone')}>{address.phone}</span>
                <span className={cx('checkout-address')}>{address.details} {address.province} </span>
              <a href='/profile/address' className={cx('change-address-btn')}>Thay đổi</a>
              </div>) : ( <><span className={cx('text')}>Chưa có địa chỉ </span>
                <a href='/profile/address' className={cx('change-address-btn')}>Cập nhật</a></>)
                }
            </div>
          </div>
              <div className={cx('checkout-product')}>
                <div className={cx('checkout-grid')}>
                  <div className={cx('checkout-info-product')}>
                    <span className= "text-blur">Sản phẩm</span>
                  </div>
                  <div className={cx('check-info-title')}>
                    <span className={`${cx('checkout-text')} text-blur`}>Đơn giá</span>
                    <span className={`${cx('checkout-text')} text-blur`}>Số Lượng</span>
                    <span className={`${cx('checkout-text')} text-blur`}>Số Tiền</span>
                  </div>
                </div>
                { data && data.length >0 ? (
                  data.map((item,idx) => (
                  <div key={idx} className={cx('checkout-grid')}>
                  <div className={cx('checkout-info-product')}>
                    <img className={cx('checkout-product-img')} src={item.bookId.img}/>
                    <span className={cx('checkout-product-name')}>{item.bookId.name}</span>             
                  </div>
                  <div className={cx('check-info-title')}>
                  <span className={`${cx('checkout-text')} `}>{formatVndDisplay(item.price)}</span>
                  <span className={`${cx('checkout-text')} `}>{item.quantity}</span>
                  <span className={`${cx('checkout-text')} `}>{formatVndDisplay(item.totalPrice)}</span>

                  </div>
                </div>
                ))):(
                  <div><p>Chưa có sản phẩm trong giỏ hàng</p></div>
                )
                }
                {auth?.isAuthenticated && (
                  <div style={{ padding: '12px 0', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      className={cx('attent-input')}
                      style={{ flex: 1, minWidth: 180 }}
                      placeholder="Mã voucher (nếu có)"
                      value={voucherDraft}
                      onChange={(e) => setVoucherDraft(e.target.value)}
                    />
                    <button type="button" className="btn btn--secondary" onClick={handleApplyVoucherCode}>
                      Áp dụng mã
                    </button>
                    <button
                      type="button"
                      className={cx('voucherPickerBtn')}
                      onClick={() => setVoucherModalOpen(true)}
                    >
                      Kho voucher {usableVoucherCount > 0 ? `(${usableVoucherCount})` : ''}
                    </button>
                  </div>
                )}
                {auth?.isAuthenticated && (
                  <div className={cx('pointsRedeemBox')}>
                    <div className={cx('pointsRedeemHeader')}>
                      <span className={cx('pointsRedeemTitle')}>Dùng điểm hội viên</span>
                      <span className={cx('pointsRedeemBalance')}>
                        Điểm hiện có: {(Number(quote?.availablePoints) || 0).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <div className={cx('pointsRedeemControls')}>
                      <input
                        className={cx('attent-input')}
                        style={{ flex: 1, minWidth: 180 }}
                        placeholder="Nhập số điểm muốn dùng"
                        value={redeemPointsDraft}
                        onChange={(e) => setRedeemPointsDraft(e.target.value.replace(/\D/g, ''))}
                      />
                      <button type="button" className="btn btn--secondary" onClick={handleApplyPoints}>
                        Áp dụng điểm
                      </button>
                      <button type="button" className={cx('voucherPickerBtn')} onClick={handleUseMaxPoints}>
                        Dùng tối đa
                      </button>
                    </div>
                    {(Number(quote?.pointsDiscountDong) || 0) > 0 && (
                      <div className={cx('pointsRedeemApplied')}>
                        Đã trừ {(Number(quote?.pointsRedeemed) || 0).toLocaleString('vi-VN')} điểm (
                        -{formatVndDisplay(quote.pointsDiscountDong)})
                      </div>
                    )}
                  </div>
                )}
                {quote && quote.voucherDiscountDong > 0 && (
                  <div className={cx('appliedVoucherCard')}>
                    <div className={cx('appliedVoucherTop')}>
                      <span className={cx('appliedVoucherCode')}>
                        {appliedVoucherCode || appliedVoucherMeta?.code || 'VOUCHER'}
                      </span>
                      <span className={cx('appliedVoucherDiscount')}>
                        -{formatVndDisplay(quote.voucherDiscountDong)}
                      </span>
                    </div>
                    <div className={cx('appliedVoucherTitle')}>
                      {quote.voucherTitle || appliedVoucherMeta?.voucher?.title || 'Voucher đã áp dụng'}
                    </div>
                    <div className={cx('appliedVoucherMeta')}>
                      {appliedVoucherMeta?.voucher?.endsAt
                        ? `HSD: ${new Date(appliedVoucherMeta.voucher.endsAt).toLocaleString('vi-VN')}`
                        : 'Voucher đang được áp dụng cho đơn hàng này'}
                    </div>
                  </div>
                )}
              </div>
              <div className={cx("wrapper-trans")}>
                <div className={cx('checkout-trans')}>
                  <div className={cx('checkout-attent')}>
                    <span className={cx('attent-title')}>Ghi chú</span>
                    <input className={cx('attent-input')} placeHolder="Lưu ý cho người bán"></input>
                  </div>
                  <div className={cx('checkout-trans-info')}>
                      <div className={cx('checkout-trans-method')}>
                        <span className={cx('method-title','right')}>Phương thức vận chuyển:   </span>
                        <span className={cx('method-title','center')}>Nhanh</span>
                        <a  className={cx('method-title','center','change-method')}>Thay đổi  </a>
                        <span className={cx('method-title','right')}>{formatVndDisplay(transCost)}</span>
                      </div>
                     
                  </div>
                </div>
              </div>
            
            
            
             
              <div className={cx('checkout-total-wrapper')}>
                    <div className={cx('checkout-total-content')}>
                      <div className={cx('checkout-pay')}>
                        <div >
                          <h2 className={cx('pay-method-title')}>Phương thức thanh toán</h2>
                          <label className={cx('payment-item')}>
                            
                            <input type="radio" name="my_radio_group" value="0" checked={paymentMethod===0} onChange={()=>{ setPayMentMethod(0)}} />
                            <img className={cx('logo-payment')} src={cash} />
                             Thanh Toán khi nhận hàng
                          </label>
                          <br />
                          <label className={cx('payment-item')}>
                            
                            <input type="radio" name="my_radio_group" value="1" checked={paymentMethod===1} onChange={()=>{ setPayMentMethod(1)}} />
                             <img className={cx('logo-payment')} src={vnpay} alt="" /> VNPay (sandbox demo)
                          </label>
                          <br />
                          <label className={cx('payment-item')}>
                            
                            <input type="radio" name="my_radio_group" value="2" checked={paymentMethod===2 } onChange={()=>{ setPayMentMethod(2)}} />
                             <img className={cx('logo-payment')} src={momo } /> MoMo
                          </label>
                          </div>
                       
                         <div className={cx('pay-method')}>
                          
                        
                          </div>                       
                      </div>
                     <div className={cx('cost-list')}>
                        {quote?.isMember && (
                          <div className={cx('cost-item')}>
                            <span className={`${cx('cost-title')} text-blur`}>Hạng hội viên</span>
                            <span className={cx('cost-value')}>{quote.tierName || quote.tierSlug || '—'}</span>
                          </div>
                        )}
                        <div className={cx('cost-item')}>
                          <span className={`${cx('cost-title')} text-blur`}>Tổng tiền hàng</span>
                          <span className={cx('cost-value')}>{formatVndDisplay(totalPriceItem)}</span>
                        </div>
                        {quote && quote.memberDiscountDong > 0 && (
                          <div className={cx('cost-item')}>
                            <span className={`${cx('cost-title')} text-blur`}>Giảm hội viên ({quote.discountPercent}%)</span>
                            <span className={cx('cost-value')}>-{formatVndDisplay(quote.memberDiscountDong)}</span>
                          </div>
                        )}
                        {quote && quote.voucherDiscountDong > 0 && (
                          <div className={cx('cost-item')}>
                            <span className={`${cx('cost-title')} text-blur`}>Voucher</span>
                            <span className={cx('cost-value')}>-{formatVndDisplay(quote.voucherDiscountDong)}</span>
                          </div>
                        )}
                        {quote && quote.pointsDiscountDong > 0 && (
                          <div className={cx('cost-item')}>
                            <span className={`${cx('cost-title')} text-blur`}>Điểm hội viên</span>
                            <span className={cx('cost-value')}>-{formatVndDisplay(quote.pointsDiscountDong)}</span>
                          </div>
                        )}
                        <div className={cx('cost-item')}>
                          <span className={`${cx('cost-title')} text-blur`}>Tổng tiền phí vận chuyển </span>
                          <span className={cx('cost-value')}>{formatVndDisplay(transCost)}</span>
                        </div>
                        <div className={cx('cost-item')}>
                          <span className={`${cx('cost-title')} text-blur`}>Tổng Thanh Toán </span>
                          <span className={cx('cost-value-total')}>{formatVndDisplay(totalCost)}</span>
                        </div>
                     </div>
                     <div className={`${cx('btn-total')}  `}>
                      <button onClick={handleOrder} className="btn btn--primary">Đặt Hàng</button>
                     </div>
                      </div>  
              </div> 
            </div>
          </div>
          {voucherModalOpen && (
            <div className={cx('voucherModalOverlay')} onClick={() => setVoucherModalOpen(false)}>
              <div className={cx('voucherModalCard')} onClick={(e) => e.stopPropagation()}>
                <div className={cx('voucherModalHeader')}>
                  <h3 className={cx('voucherModalTitle')}>Kho voucher của bạn</h3>
                  <button type="button" className={cx('voucherModalClose')} onClick={() => setVoucherModalOpen(false)}>
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
                <div className={cx('voucherTabs')}>
                  <button
                    type="button"
                    className={cx('voucherTab', voucherTab === 'active' && 'voucherTabActive')}
                    onClick={() => setVoucherTab('active')}
                  >
                    Khả dụng ({activeVouchers.length})
                  </button>
                  <button
                    type="button"
                    className={cx('voucherTab', voucherTab === 'expiring' && 'voucherTabActive')}
                    onClick={() => setVoucherTab('expiring')}
                  >
                    Sắp hết hạn ({expiringSoonVouchers.length})
                  </button>
                </div>
                <div className={cx('voucherList')}>
                  {(voucherTab === 'active' ? activeVouchers : expiringSoonVouchers).length === 0 ? (
                    <p className={cx('voucherEmpty')}>Không có voucher trong mục này.</p>
                  ) : (
                    (voucherTab === 'active' ? activeVouchers : expiringSoonVouchers).map((uv) => (
                      <div key={String(uv.userVoucherId || uv.code)} className={cx('voucherItem')}>
                        <div>
                          <div className={cx('voucherCode')}>{uv.code}</div>
                          <div className={cx('voucherName')}>{uv.voucher?.title || 'Voucher'}</div>
                          <div className={cx('voucherMeta')}>
                            HSD: {uv.voucher?.endsAt ? new Date(uv.voucher.endsAt).toLocaleString('vi-VN') : '—'}
                          </div>
                        </div>
                        <button type="button" className="btn btn--primary" onClick={() => handleSelectVoucher(uv.code)}>
                          Dùng mã này
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}    
      </>
     );
}

export default Checkout;
