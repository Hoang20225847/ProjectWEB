
import styles from './Checkout.module.scss'
import classNames from 'classnames/bind'
import momo from '../../components/assets/img/momo.png'
import cash from '../../components/assets/img/cash.png'

import '../../components/assets/css/main.css'
import '@fortawesome/fontawesome-free/css/all.min.css';
import axios from '../../components/axios/axios.customize'
import { useNavigate } from 'react-router-dom';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {getCart,updateCart, validateCheckoutItems} from '../../app/api/CartApi'
import { getAddress, getAddressDefault } from '../../app/api/AddressApi'
import { AuthContext } from '../../components/context/auth.context';
import { formatVndDisplay } from '../../components/function/function.js';
import Validator from '../../components/function/Validator';
import { toast } from 'react-toastify';
import CheckoutChangesModal from '../../components/modal/CheckoutChangesModal';
const cx = classNames.bind(styles)

function Checkout() {
  const [paymentMethod,setPayMentMethod]=useState(0)
  const navigate=useNavigate();
  const[data,setData]=useState(null)
  const[address,setAddress]=useState(null)
  const [addresses, setAddresses] = useState([]);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [showAddressSelect, setShowAddressSelect] = useState(false);
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState('');
  const [selectedDistrictCode, setSelectedDistrictCode] = useState('');
  const [selectedWardCode, setSelectedWardCode] = useState('');
  const [selectedProvinceName, setSelectedProvinceName] = useState('');
  const [selectedDistrictName, setSelectedDistrictName] = useState('');
  const [selectedWardName, setSelectedWardName] = useState('');
  const [detailsInput, setDetailsInput] = useState('');
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
  const [changesModal, setChangesModal] = useState({
    open: false,
    changes: [],
    validatedItems: null,
  });
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  const provincePath = [selectedWardName, selectedDistrictName, selectedProvinceName]
    .filter(Boolean)
    .join(', ');
  const mapQuery = `${detailsInput || ''} ${provincePath || ''} Việt Nam`.trim() || 'Việt Nam';
  const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&hl=vi&z=14&output=embed`;
  const mapSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;

  const resetAddressForm = () => {
    setSelectedProvinceCode('');
    setSelectedDistrictCode('');
    setSelectedWardCode('');
    setSelectedProvinceName('');
    setSelectedDistrictName('');
    setSelectedWardName('');
    setDistricts([]);
    setWards([]);
    setDetailsInput('');
  };

  /// <summary>
  /// Tải danh sách địa chỉ; ưu tiên giữ địa chỉ đang chọn, rồi mặc định, rồi phần tử đầu.
  /// </summary>
  const fetchAddresses = async (preserveSelected = true) => {
    if (!auth?.user?.email) {
      setAddresses([]);
      setAddress(null);
      return;
    }
    try {
      const list = await getAddress(auth.user.email);
      const normalizedList = Array.isArray(list) ? list : [];
      setAddresses(normalizedList);
      if (normalizedList.length === 0) {
        setAddress(null);
        return;
      }
      const currentSelectedId = preserveSelected ? address?._id : null;
      const selectedByCurrent = normalizedList.find((item) => item._id === currentSelectedId);
      const selectedByDefault = normalizedList.find((item) => item.isDefault);
      setAddress(selectedByCurrent || selectedByDefault || normalizedList[0]);
    } catch (error) {
      setAddresses([]);
      setAddress(null);
    }
  };

  useEffect(() => {
    const { items } = location.state || { items: [] };
    setData(items);
  }, [location.state]);

  useEffect(() => {
    if (!auth?.user?.email) return;
    fetchAddresses(false);
    (async () => {
      try {
        const info = await getAddressDefault(auth.user.email);
        if (info) setAddress(info);
      } catch (error) {
        console.log(error);
      }
    })();
  }, [auth?.user?.email]);

  useEffect(() => {
    async function loadProvinces() {
      try {
        const res = await fetch('https://provinces.open-api.vn/api/p/');
        const json = await res.json();
        setProvinces(Array.isArray(json) ? json : []);
      } catch (error) {
        setProvinces([]);
      }
    }
    loadProvinces();
  }, []);

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

  const handleChangeProvince = async (e) => {
    const code = e.target.value;
    setSelectedProvinceCode(code);
    setSelectedDistrictCode('');
    setSelectedWardCode('');
    setSelectedDistrictName('');
    setSelectedWardName('');
    setWards([]);

    const picked = provinces.find((p) => String(p.code) === String(code));
    setSelectedProvinceName(picked?.name || '');

    if (!code) {
      setDistricts([]);
      return;
    }

    try {
      const res = await fetch(`https://provinces.open-api.vn/api/p/${code}?depth=2`);
      const json = await res.json();
      setDistricts(Array.isArray(json?.districts) ? json.districts : []);
    } catch (error) {
      setDistricts([]);
    }
  };

  const handleChangeDistrict = async (e) => {
    const code = e.target.value;
    setSelectedDistrictCode(code);
    setSelectedWardCode('');
    setSelectedWardName('');

    const picked = districts.find((d) => String(d.code) === String(code));
    setSelectedDistrictName(picked?.name || '');

    if (!code) {
      setWards([]);
      return;
    }

    try {
      const res = await fetch(`https://provinces.open-api.vn/api/d/${code}?depth=2`);
      const json = await res.json();
      setWards(Array.isArray(json?.wards) ? json.wards : []);
    } catch (error) {
      setWards([]);
    }
  };

  const handleChangeWard = (e) => {
    const code = e.target.value;
    setSelectedWardCode(code);
    const picked = wards.find((w) => String(w.code) === String(code));
    setSelectedWardName(picked?.name || '');
  };

  /// <summary>
  /// Thêm địa chỉ mới tại checkout (API tỉnh/huyện/xã + POST /api/address).
  /// </summary>
  const handleAddAddressAtCheckout = async (e) => {
    e.preventDefault();
    if (!selectedProvinceName || !selectedDistrictName || !selectedWardName) {
      toast.error('Vui lòng chọn đầy đủ Tỉnh/Thành, Quận/Huyện, Phường/Xã');
      return;
    }
    const fullName = e.target.fullName.value;
    const phone = e.target.phone.value;
    const normalizedPhone = String(phone || '').replace(/\s+/g, '');
    const phoneError = Validator.validatePhoneVn(normalizedPhone);
    if (phoneError) {
      toast.error('Số điện thoại không hợp lệ. Vui lòng nhập 10 số và bắt đầu bằng số 0.');
      return;
    }
    const province = [selectedWardName, selectedDistrictName, selectedProvinceName].join(', ');
    const detailsAdrs = e.target.detailsAdrs.value;
    const formAddress = {
      user: auth.user.email,
      name: fullName,
      phone: normalizedPhone,
      province,
      details: detailsAdrs,
      isDefault: false,
    };
    try {
      const res = await axios.post('/api/address', formAddress);
      toast.success(res?.message || 'Thêm địa chỉ thành công');
      await fetchAddresses(false);
      setAddressModalOpen(false);
      resetAddressForm();
    } catch (error) {
      toast.error('Thêm địa chỉ không thành công');
    }
  };

  /// <summary>
  /// Gửi đơn: COD (POST /api/order) hoặc MoMo (redirect + sessionStorage xóa giỏ sau thanh toán).
  /// </summary>
  const submitOrder = async (itemsToSubmit) => {
    const formData = {
      email: auth.user.email,
      items: itemsToSubmit,
      voucherCode: voucherCode.trim() || undefined,
      redeemPoints,
      address: {
        name: address.name,
        phone: address.phone,
        details: address.details,
        province: address.province,
      },
    };

    if (paymentMethod === 0) {
      const res = await axios.post('/api/order', formData);
      if (from === 'cart') {
        const cart = await getCart(auth.user.email);
        const remainingItems = cart.items.filter((item) => !item.selected);
        await updateCart(auth.user.email, remainingItems);
      }
      navigate('/profile/purchase');
      toast.success(res.message);
      return;
    }

    if (paymentMethod === 1) {
      const paymentUrl = await axios.post('/payapi/Momo', formData);
      if (typeof paymentUrl === 'string' && paymentUrl.startsWith('http')) {
        if (from === 'cart') {
          sessionStorage.setItem('checkout_momo_clear_cart', auth.user.email);
        }
        window.location.href = paymentUrl;
        return;
      }
      toast.error('Không nhận được link thanh toán MoMo');
    }
  };

  /// <summary>
  /// Validate checkout trước khi đặt; nếu có thay đổi thì mở CheckoutChangesModal thay vì gửi đơn ngay.
  /// </summary>
  const handleOrder = async () => {
    if (address == null) {
      toast.error('Vui lòng thêm địa chỉ');
      return;
    }
    if (!data?.length) {
      toast.error('Không có sản phẩm để đặt hàng');
      return;
    }

    setOrderSubmitting(true);
    try {
      const validation = await validateCheckoutItems(auth.user.email, data);

      if (!validation.canProceed) {
        setData(validation.validatedItems);
        toast.error('Không thể đặt hàng: tất cả sách đã không còn khả dụng.');
        return;
      }

      if (validation.hasChanges) {
        setData(validation.validatedItems);
        setChangesModal({
          open: true,
          changes: validation.changes,
          validatedItems: validation.validatedItems,
        });
        return;
      }

      await submitOrder(data);
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'Đặt hàng không thành công';
      toast.error(msg);
    } finally {
      setOrderSubmitting(false);
    }
  };

  /// <summary>
  /// Người dùng chấp nhận thay đổi giá/tồn kho và tiếp tục đặt hàng với validatedItems.
  /// </summary>
  const handleConfirmOrderChanges = async () => {
    const nextItems = changesModal.validatedItems;
    if (!nextItems?.length) {
      setChangesModal({ open: false, changes: [], validatedItems: null });
      return;
    }

    setOrderSubmitting(true);
    try {
      setData(nextItems);
      setChangesModal({ open: false, changes: [], validatedItems: null });
      await submitOrder(nextItems);
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'Đặt hàng không thành công';
      toast.error(msg);
    } finally {
      setOrderSubmitting(false);
    }
  };

  /// <summary>
  /// Đóng dialog thay đổi; giữ dữ liệu đã cập nhật trên trang, không gửi đơn.
  /// </summary>
  const handleCancelOrderChanges = () => {
    setChangesModal({ open: false, changes: [], validatedItems: null });
  };
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

              <div className={cx('addressPanel')}>
                {address ? (
                  <div className={cx('addressDisplay')}>
                    <div className={cx('addressDisplayTop')}>
                      <span className={cx('checkout-name')}>{address.name}</span>
                      <span className={cx('checkout-phone')}>{address.phone}</span>
                      {address.isDefault && (
                        <span className={cx('addressDefaultBadge')}>Mặc định</span>
                      )}
                    </div>
                    <p className={cx('addressDisplayText')}>
                      {address.details}, {address.province}
                    </p>
                  </div>
                ) : (
                  <div className={cx('addressEmpty')}>
                    <div className={cx('addressEmptyIcon')}>
                      <i className="fa-solid fa-map-location-dot" />
                    </div>
                    <p className={cx('addressEmptyTitle')}>Chưa có địa chỉ</p>
                    <p className={cx('addressEmptyDesc')}>
                      Thêm địa chỉ mới hoặc chọn địa chỉ có sẵn để tiếp tục đặt hàng
                    </p>
                  </div>
                )}

                <div className={cx('addressActions')}>
                  <button
                    type="button"
                    className={cx('addressActionBtn', 'addressActionBtnPrimary')}
                    onClick={() => {
                      resetAddressForm();
                      setAddressModalOpen(true);
                    }}
                  >
                    <i className="fa-solid fa-plus" />
                    Thêm địa chỉ mới
                  </button>
                  <button
                    type="button"
                    className={cx('addressActionBtn', showAddressSelect && 'addressActionBtnActive')}
                    onClick={() => setShowAddressSelect((prev) => !prev)}
                    disabled={!Array.isArray(addresses) || addresses.length === 0}
                  >
                    <i className="fa-solid fa-list" />
                    Chọn địa chỉ có sẵn
                  </button>
                </div>

                {Array.isArray(addresses) && addresses.length > 0 && showAddressSelect && (
                  <div className={cx('addressSelectWrap')}>
                    <label className={cx('addressSelectLabel')} htmlFor="checkout-address-select">
                      Chọn địa chỉ giao hàng
                    </label>
                    <select
                      id="checkout-address-select"
                      className={cx('addressSelect')}
                      value={address?._id || ''}
                      onChange={(e) => {
                        const selected = addresses.find((item) => item._id === e.target.value);
                        if (selected) setAddress(selected);
                      }}
                    >
                      {addresses.map((item) => (
                        <option key={item._id} value={item._id}>
                          {item.name} — {item.phone} — {item.details}, {item.province}
                          {item.isDefault ? ' (Mặc định)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
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
                            <input type="radio" name="my_radio_group" value="1" checked={paymentMethod === 1} onChange={() => { setPayMentMethod(1); }} />
                            <img className={cx('logo-payment')} src={momo} alt="MoMo" /> MoMo 
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
                      <button
                        type="button"
                        onClick={handleOrder}
                        className="btn btn--primary"
                        disabled={orderSubmitting}
                      >
                        {orderSubmitting ? 'Đang xử lý...' : 'Đặt Hàng'}
                      </button>
                     </div>
                      </div>  
              </div> 
            </div>
          </div>
          {voucherModalOpen && (
            <div className={cx('voucherModalOverlay')} role="presentation">
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
          {addressModalOpen && (
            <form onSubmit={handleAddAddressAtCheckout}>
              <div className="modal open" onClick={() => setAddressModalOpen(false)}>
                <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                  <div className='modal-header'>
                    <h2 className='modal-title'>Thêm địa chỉ mới</h2>
                    <button type="button" className="modal-close" onClick={() => setAddressModalOpen(false)}>
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                  <div className='address-modal'>
                    <div className='address-modal-info'>
                      <input name="fullName" className='address-modal-name' type="text" placeholder='Họ và tên' required />
                      <input
                        name="phone"
                        className='address-modal-phone'
                        type="tel"
                        placeholder='Số điện thoại'
                        required
                        pattern="0[0-9]{9}"
                        maxLength={10}
                        title="Số điện thoại gồm 10 số và bắt đầu bằng số 0"
                      />
                    </div>
                    <select
                      name="province"
                      className='Address-province'
                      required
                      value={selectedProvinceCode}
                      onChange={handleChangeProvince}
                    >
                      <option value="">Chọn Tỉnh / Thành phố</option>
                      {provinces.map((province) => (
                        <option key={province.code} value={province.code}>
                          {province.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className='Address-province'
                      required
                      value={selectedDistrictCode}
                      onChange={handleChangeDistrict}
                      disabled={!selectedProvinceCode}
                    >
                      <option value="">Chọn Quận / Huyện</option>
                      {districts.map((district) => (
                        <option key={district.code} value={district.code}>
                          {district.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className='Address-province'
                      required
                      value={selectedWardCode}
                      onChange={handleChangeWard}
                      disabled={!selectedDistrictCode}
                    >
                      <option value="">Chọn Phường / Xã</option>
                      {wards.map((ward) => (
                        <option key={ward.code} value={ward.code}>
                          {ward.name}
                        </option>
                      ))}
                    </select>
                    <input
                      name="detailsAdrs"
                      className='Address-details'
                      type="text"
                      placeholder='Địa chỉ cụ thể (số nhà, đường...)'
                      required
                      value={detailsInput}
                      onChange={(e) => setDetailsInput(e.target.value)}
                    />
                    <div className="address-map-box">
                      <div className="address-map-header">
                        <span className="address-map-title">Bản đồ giao hàng (Việt Nam)</span>
                        <a href={mapSearchUrl} target="_blank" rel="noreferrer" className="address-map-open">
                          Mở bản đồ lớn
                        </a>
                      </div>
                      <iframe
                        className="address-map-embed"
                        src={mapEmbedUrl}
                        title="Bản đồ địa chỉ giao hàng"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                    <div className='modal-address-btn'>
                      <button type="button" className="btn modal-btn-back" onClick={() => setAddressModalOpen(false)}>
                        Hủy
                      </button>
                      <button type="submit" className="btn btn--primary">Thêm địa chỉ</button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}
          <CheckoutChangesModal
            open={changesModal.open}
            changes={changesModal.changes}
            loading={orderSubmitting}
            onConfirm={handleConfirmOrderChanges}
            onCancel={handleCancelOrderChanges}
          />
      </>
     );
}

export default Checkout;
