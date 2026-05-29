import avt from '../../components/assets/img/unnamed.jpg'
import { useContext,useState,useEffect } from 'react';
import { AuthContext } from '../../components/context/auth.context';
import axios from '../../components/axios/axios.customize'
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import { getMyAccount } from '../../app/api/AccountApi';
import { formatVndDisplay } from '../../components/function/function.js';

function Profile() {
  const [isMember, setIsMember] = useState(false);
  const [tierName, setTierName] = useState('');
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [totalSpentDong, setTotalSpentDong] = useState(0);
  const [membershipProgress, setMembershipProgress] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [userData, setUserData] = useState({ name: '', phone: '0862408708' });

  const {auth, setAuth} = useContext(AuthContext);
  const [name, setName] = useState('');

  // Đồng bộ hội viên từ context (App.js gọi /api/account sau F5) — tránh nút "Đăng ký" sai khi API my đã đúng nhưng state local chưa cập nhật
  useEffect(() => {
    if (!auth?.user?.email) return;
    setIsMember(!!auth.user.isMember);
    setTierName(auth.user.membershipTierName || '');
    setLoyaltyPoints(auth.user.loyaltyPoints ?? 0);
    setTotalSpentDong(auth.user.totalSpentDong ?? 0);
    setMembershipProgress(auth.user.membershipProgress ?? null);
  }, [
    auth?.user?.email,
    auth?.user?.isMember,
    auth?.user?.membershipTierName,
    auth?.user?.loyaltyPoints,
    auth?.user?.totalSpentDong,
    auth?.user?.membershipProgress,
  ]);

  // Fetch user data from API
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const data = await getMyAccount();
        if (data?.user) {
          setUserData({
            name: data.user.name || '',
            phone: data.user.phone || '0862408708'
          });
          setName(data.user.name || '');
          setIsMember(!!(data.user.isMember || data.user.membershipTier));
          setTierName(data.user.membershipTierName || '');
          setLoyaltyPoints(data.user.loyaltyPoints ?? 0);
          setTotalSpentDong(data.user.totalSpentDong ?? 0);
          setMembershipProgress(data.user.membershipProgress ?? null);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    fetchUserData();
  }, []);

  // Fetch reviews của user
  useEffect(() => {
    const fetchReviews = async () => {
      if (!auth.user?.email) return;
      setLoadingReviews(true);
      try {
        const response = await axios.get(`/api/reviews/user/${auth.user.email}`);
        setReviews(response.data || []);
      } catch (error) {
        console.error('Error fetching reviews:', error);
      } finally {
        setLoadingReviews(false);
      }
    };
    fetchReviews();
  }, [auth.user?.email]);

  const handleChange= async (e)=>{
    e.preventDefault();
    const formData={
      email:auth.user.email,
      name:name
    };
    try{
      const data=await axios.post('/api/account',formData)
      
        toast.success("Cập nhật thành công")
        window.location.reload();
    }
    catch(error){
      toast.error(error)
    }
    
  }

  const handleMembershipToggle = async () => {
    try {
      const newStatus = !isMember;
      const response = await axios.put('/api/account/membership', {
        email: auth.user.email,
        register: newStatus,
      });
      setIsMember(!!response.isMember);
      if (response.isMember) {
        setTierName(response.membershipTierName || '');
        setLoyaltyPoints(response.loyaltyPoints ?? 0);
        setTotalSpentDong(response.totalSpentDong ?? totalSpentDong);
      } else {
        setTierName('');
      }
      setAuth({
        ...auth,
        user: {
          ...auth.user,
          isMember: !!response.isMember,
          membershipTierSlug: response.isMember ? response.membershipTierSlug || '' : '',
          membershipTierName: response.isMember ? response.membershipTierName || '' : '',
          loyaltyPoints: response.loyaltyPoints ?? auth.user.loyaltyPoints ?? 0,
          totalSpentDong: response.totalSpentDong ?? auth.user.totalSpentDong ?? 0,
          memberSince: response.isMember ? response.memberSince ?? auth.user.memberSince ?? null : null,
          membershipProgress: response.isMember ? auth.user.membershipProgress : null,
        },
      });
      if (response.isMember) {
        try {
          const fresh = await getMyAccount();
          if (fresh?.user) {
            const mp = fresh.user.membershipProgress ?? null;
            setMembershipProgress(mp);
            setAuth((prev) => ({
              ...prev,
              user: { ...prev.user, membershipProgress: mp },
            }));
          }
        } catch {
          /* ignore */
        }
      } else {
        setMembershipProgress(null);
        setAuth((prev) => ({
          ...prev,
          user: { ...prev.user, membershipProgress: null },
        }));
      }
      toast.success(newStatus ? 'Đăng ký hội viên thành công! Bạn được xếp hạng Bạc và nhận ưu đãi khi thanh toán.' : 'Đã hủy đăng ký hội viên');
    } catch (error) {
      toast.error('Có lỗi xảy ra');
    }
  }
const handleAvatarChange = async(e)=>{
  const file= e.target.files[0];
  if(!file) return ;
  if(!['image/jpeg','image/png'].includes(file.type))
  {
    return toast.error('File định dạng sai')
  }
  const formData=new FormData();
  formData.append('avatar',file);
   formData.append('email',auth.user.email);
  try{
    const res=await axios.post('/api/account/upload-avt',formData,{
      headers:{
        'Content-Type':'multipart/form-data',
      }
    })
    toast.success("Cap nhat anh thanh cong")
     window.location.reload();
  }catch(error)
  {
    toast.error('Upload ảnh thất bại')
  }
}
    return ( 
       <div className='Account-container' >
        <div className="Account-Title">
          <span className="Account-Title-Name" >Hồ sơ của tôi</span>
          <span className="Account-Tittle-Description">Quản lý thông tin hồ sơ để bảo mật tài khoản</span>
        </div>
        <div className="Profile-content">
          <div className="Account-info">
            <div className="Account-info-name">
              <span className="Account-info-text">Tên Đăng Nhập</span>
              <span className="Account-name-current">{auth.user?.email || 'Chưa có email'}</span>
            </div>
            <div className="Account-info-name">
              <span className="Account-info-text account-info-text__name">Tên </span>
              <input onChange={(e)=>setName(e.target.value)} value={name} className="Account-name-current account-input-name"/>
            </div>
            <div className="Account-info-name">
              <span className="Account-info-text">Email</span>
              <span className="Account-name-current">{auth.user?.email}</span>
            </div>
            <div className="Account-info-name">
              <span className="Account-info-text">Số Điện thoại</span>
                <div className="Account-footer">
                  <span className="Account-name-current">{userData.phone}</span>
                  <button onClick={handleChange}  className="btn btn--size-s btn-account">Lưu</button>
                  </div>
              </div>
           
          </div>
          <div className="Account-avt">
            <img src={auth.user.avt} className="account-avt-img"/>
            <button className='Avt-button'
            onClick={()=>document.getElementById('avatarInput').click()}
            >Chọn ảnh</button>
            <input type="file"
            accept="image/*"
            id="avatarInput"
            style={{display:'none'}}
            name="avatar"
            onChange={handleAvatarChange}
            />
            <span className='Account-info-text Account-avt-text'> Dung lượng file tối đa 1mb</span>
            <span className='Account-info-text Account-avt-text'> Định dạng JPEG,.PNG</span>
  
          </div>
        </div>

        {/* Membership Section */}
        <div className="Profile-membership">
          <div className="Membership-card">
            <div className="Membership-info">
              <h3 className="Membership-title">Hội viên</h3>
              <p className="Membership-description">
                {isMember
                  ? `Bạn đang tham gia chương trình hội viên${tierName ? ` — hạng «${tierName}»` : ''}. Tích điểm khi đơn hàng hoàn thành; giảm giá & miễn phí ship tự áp dụng ở bước thanh toán.`
                  : 'Đăng ký để nhận giảm giá theo hạng, miễn phí ship theo ngưỡng đơn và tích điểm đổi quà (điểm cộng khi đơn chuyển sang Hoàn thành).'}
              </p>
              {isMember && (
                <ul style={{ marginTop: 12, paddingLeft: 18, fontSize: '1.35rem', color: '#94a3b8', lineHeight: 1.6 }}>
                  <li>Điểm hiện có: <strong style={{ color: '#ffb274' }}>{loyaltyPoints}</strong></li>
                  <li>Chi tiêu tích lũy: <strong style={{ color: '#e2e8f0' }}>{formatVndDisplay(totalSpentDong)}</strong></li>
                  <li>Bạc / Vàng / Kim cương: tự nâng hạng theo tổng chi (sau mỗi đơn hoàn thành).</li>
                </ul>
              )}
              {isMember && membershipProgress && (
                <div className="membershipSpendProgress">
                  <div className="membershipSpendProgress__title">Lộ trình lên hạng (chi tiêu tích lũy)</div>
                  <p className="membershipSpendProgress__sub">
                    Chi tiêu tích lũy là tổng giá trị các đơn đã <strong>Hoàn thành</strong>, dùng để xét hạng Bạc → Vàng → Kim cương.
                  </p>
                  {membershipProgress.isMaxTier ? (
                    <p className="membershipSpendProgress__done">
                      Bạn đã ở <strong>hạng cao nhất</strong> trong chương trình. Tiếp tục mua sắm để tích điểm và nhận ưu đãi theo hạng hiện tại.
                    </p>
                  ) : (
                    <>
                      <div
                        className="membershipSpendProgress__bar"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(membershipProgress.progressPercent)}
                        aria-label={`Đã đạt ${membershipProgress.progressPercent}% trên hành trình tới hạng ${membershipProgress.nextTierName}`}
                      >
                        <div
                          className="membershipSpendProgress__fill"
                          style={{ width: `${Math.min(100, Math.max(0, membershipProgress.progressPercent))}%` }}
                        />
                      </div>
                      <p className="membershipSpendProgress__hint">
                        Còn <strong>{formatVndDisplay(membershipProgress.remainingDongToNext)}</strong> chi tiêu tích lũy nữa để lên hạng{' '}
                        <strong>«{membershipProgress.nextTierName}»</strong> (mốc {formatVndDisplay(membershipProgress.nextTierMin)}).
                        <span className="membershipSpendProgress__pct"> Hiện tại ~{membershipProgress.progressPercent}% trên đoạn hạng hiện tại → tiếp theo.</span>
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
            <button 
              onClick={handleMembershipToggle}
              className={`btn ${isMember ? 'btn--secondary' : 'btn--primary'}`}
            >
              {isMember ? 'Hủy đăng ký hội viên' : 'Đăng ký hội viên'}
            </button>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="Profile-reviews">
          <div className="Reviews-header">
            <h3 className="Reviews-title">Đánh giá của tôi</h3>
            <span className="Reviews-count">({reviews.length} đánh giá)</span>
          </div>
          
          {loadingReviews ? (
            <p>Đang tải đánh giá...</p>
          ) : reviews.length === 0 ? (
            <div className="Reviews-empty">
              <p>Bạn chưa có đánh giá nào</p>
            </div>
          ) : (
            <div className="Reviews-list">
              {reviews.map((review, idx) => (
                <div key={idx} className="Review-item">
                  <Link to={`/details/${encodeURIComponent(review.bookId.name)}`} className="Review-product-link">
                    <img 
                      src={review.bookId.img} 
                      alt={review.bookId.name}
                      className="Review-product-img"
                    />
                    <div className="Review-product-info">
                      <h4 className="Review-product-name">{review.bookId.name}</h4>
                      <div className="Review-rating">
                        {[1,2,3,4,5].map(star => (
                          <span key={star} className={`Review-star ${star <= review.evaluate ? 'active' : ''}`}>
                            ★
                          </span>
                        ))}
                      </div>
                      <p className="Review-comment">{review.comment}</p>
                      <span className="Review-date">
                        {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

       </div>
     );
}

export default Profile;