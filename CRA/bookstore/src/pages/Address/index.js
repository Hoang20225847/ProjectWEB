import { AuthContext } from '../../components/context/auth.context';
import Header from '../Home'
import { useState,useContext, useEffect } from 'react';
import axios from '../../components/axios/axios.customize'
import  {getAddress,setAddressDefault,deleteAddress }from '../../app/api/AddressApi';
import Validator from '../../components/function/Validator';
import {useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
function Address() {
  const navigate=useNavigate();
  const {auth} =useContext(AuthContext)
  const [data,setData]=useState(null)
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
  const provincePath = [selectedWardName, selectedDistrictName, selectedProvinceName]
    .filter(Boolean)
    .join(', ');
  const mapQuery = `${detailsInput || ''} ${provincePath || ''} Việt Nam`.trim() || 'Việt Nam';
  const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&hl=vi&z=14&output=embed`;
  const mapSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;

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
  useEffect(()=>{
const addBtn=document.querySelector('.js-add-address')
const modal=document.querySelector('.modal')
const removeBtn=document.querySelector('.js-modal-back')
const modalContainer=document.querySelector('.modal-container')
  function showAddAddress( ){
   if(modal)
   {
    modal.classList.add('open')
   }
  }
  function hideAddAddress(){
    if(modal)
        {
          modal.classList.remove('open')
        }
  }
  if(modal)
  {
    modal.addEventListener('click',hideAddAddress)
  }
  if(modalContainer)
  {
    modalContainer.addEventListener('click',function(event)
  {
    event.stopPropagation();
  })
  }
if(addBtn)
{
  addBtn.addEventListener('click', showAddAddress)
}
if(removeBtn){
  removeBtn.addEventListener('click',hideAddAddress)
}
 async function fetchData() {
  console.log(" Email trong useEffect:", auth.user.email);
      const json = await getAddress(auth.user.email);
      
       setData(json);
      
    }
    fetchData();
return ()=>{
   if (addBtn) addBtn.removeEventListener('click', showAddAddress);
    if (removeBtn) removeBtn.removeEventListener('click', hideAddAddress);
    if (modal) modal.removeEventListener('click', hideAddAddress);
    if (modalContainer) modalContainer.removeEventListener('click', function(event)
  {
    event.stopPropagation();
  });
}
  },[auth?.user?.email])
  const handleAdd= async (e) =>{
    e.preventDefault()
    if (!selectedProvinceName || !selectedDistrictName || !selectedWardName) {
      toast.error('Vui lòng chọn đầy đủ Tỉnh/Thành, Quận/Huyện, Phường/Xã');
      return;
    }
    const fullName=e.target.fullName.value;
    const phone=e.target.phone.value;
    const normalizedPhone = String(phone || '').replace(/\s+/g, '');
    const phoneError = Validator.validatePhoneVn(normalizedPhone);
    if (phoneError) {
      toast.error('Số điện thoại không hợp lệ. Vui lòng nhập 10 số và bắt đầu bằng số 0.');
      return;
    }
    const province = [selectedWardName, selectedDistrictName, selectedProvinceName].join(', ');
    const detailsAdrs=e.target.detailsAdrs.value;
    const formAddress={
      user:auth.user.email,
      name:fullName,
      phone:normalizedPhone,
      province:province,
       details:detailsAdrs,
       isDefault:false,
    }
    console.log(formAddress)
    try{
      const data = await axios.post('/api/address',formAddress)
      toast.success(data.message);
      setSelectedProvinceCode('');
      setSelectedDistrictCode('');
      setSelectedWardCode('');
      setSelectedProvinceName('');
      setSelectedDistrictName('');
      setSelectedWardName('');
      setDistricts([]);
      setWards([]);
      setDetailsInput('');
       window.location.reload();
    }
    catch(error){
        toast.error('Thêm địa chỉ không thành công')
    }


  }
  const handeSetDefault =async (id )=>{
   await setAddressDefault(id);
   const json = await getAddress(auth.user.email);
      
       setData(json);
  }
  
  const handleDelete= async (id) =>{
   await deleteAddress(id) 
   const json = await getAddress(auth.user.email);
      
       setData(json);
  }

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
  
    return (
       <div className='AddressPage-container'>
        <div className="AddressPage-header">
          <h1 className="AddressPage-title">Địa chỉ của tôi</h1>
          <p className="AddressPage-subtitle">Quản lý địa chỉ giao hàng của bạn</p>
        </div>
        <div className="Address-title">
          <span className='Address-text'>Địa chỉ</span>
          <button className='btn btn--primary btn-add-address js-add-address'>Thêm địa chỉ mới</button>
        </div>
        <ul className="Address-list">
         {Array.isArray(data) && data.length > 0 ? (
        data.map((item, idx) => (
          <li key={idx} className="Address-item">
            <div className='Address-info-update'>
              <div className='Address-user'>
                <span className='Address-name'>{item.name}</span>
                <span className='Address-phone text-blur'>{item.phone}</span>
              </div>
              <a onClick={()=>{handleDelete(item._id)}} className="Address-update">Xóa</a>
            </div>
            <div className="Address-info">
              <div className="Address-details">
                <span className='text-blur'>{item.details}</span>
                <span className='text-blur'>{item.province}</span>
              </div>
              { !item.isDefault ?
                 ( <button onClick={()=>handeSetDefault(item._id)} className='address-setfault'>Thiết lập mặc định</button>):<></>}
            </div>
           { item.isDefault ?
            (<span className="Address-current">Mặc định</span>):<></>}
          </li>
        ))
      ) : (
        <div className="Address-empty">
          <div className="Address-empty-icon">
            <i className="fas fa-map-marker-alt"></i>
          </div>
          <p className="Address-empty-text">Bạn chưa có địa chỉ nào</p>
        </div>
      )}
          
        </ul>
       
          <form onSubmit={handleAdd}>
            <div className='modal'>
              <div className='modal-container'>
                <div className='modal-header'>
                  <h2 className='modal-title'>Thêm địa chỉ mới</h2>
                  <button type="button" className="modal-close js-modal-back">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className='address-modal'>
                  <div className='address-modal-info'>
                    <input name="fullName" className='address-modal-name' type="text" placeholder='Họ và tên' required/>
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
                    className='Address-district'
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
                    className='Address-ward'
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
                  <div className="modal-address-btn">
                    <button type="button" className="btn modal-btn-back js-modal-back">Hủy</button>
                    <button type="submit" className="btn modal-btn-submit">Thêm địa chỉ</button>
                  </div>
                </div>
              </div>
            </div>
          </form >
       </div>
       
     );
}

export default Address;