
import styles from '../Details.module.scss'
import classNames from 'classnames/bind';
import avt from '../../../components/assets/img/unnamed.jpg'
import '@fortawesome/fontawesome-free/css/all.min.css';
import {getReviewBook} from '../../../app/api/ReviewApi'
import { useEffect,useState } from 'react';
const cx=classNames.bind(styles)
function Review({book}) {
  console.log(book);
  const [data,setData]=useState(null)
  const [datafilter,setDataFilter]=useState(null)
  const [filter,setFilter]=useState(0)
  const renderStars = (ratingValue = 0) => {
    const rating = Number(ratingValue) || 0;
    const fullStars = Math.floor(rating);

    return Array.from({ length: 5 }, (_, index) => (
      <li key={`star-${index + 1}`}>
        <i className={index < fullStars ? 'fa-solid fa-star' : 'fa-regular fa-star'}></i>
      </li>
    ));
  };
  useEffect(()=>{
    async function fetchData(){
      const json =await getReviewBook(book._id);
      setData(json)
    }
     fetchData();
  },[])
  const handleFilterReview = async (e,type) =>{
    e.preventDefault()
    setFilter(type);
    if(type==0&&data)
    {
      setDataFilter(data)
      return;
      
    }
    
    if(Array.isArray(data))
    {
     const datafilters= data.filter(item=>(item.evaluate == type))
     setDataFilter(datafilters)
    }
    
  }
    return (
    <div className={cx('Review-content')}>
      <h3 className={cx('suggest-title')}>Đánh giá sản phẩm </h3>
      <div className={cx('nav-review')}>
        <div className={cx('margin')}>
          <div className={cx('review-point-total')}>
            <div className={cx('review-point')}>
              <span className={cx('review-point-current')}>{book.evaluate}</span>
              <span>trên 5</span>
            </div>
            <ul className={cx('review-star')}>
              {renderStars(book?.evaluate)}
            </ul>
          </div>
          <div className={cx('choice-star')}>
             <button onClick={(e)=>{handleFilterReview(e,0)}} className={`home-filter__btn btn ${filter==0 ? 'btn--primary':''}`}>Tất cả</button>
              <button onClick={(e)=>{handleFilterReview(e,1)}} className={`home-filter__btn btn ${filter==1 ? 'btn--primary':''}`}>1 sao</button>
               <button onClick={(e)=>{handleFilterReview(e,2)}} className={`home-filter__btn btn ${filter==2 ? 'btn--primary':''}`}>2 sao</button>
                <button onClick={(e)=>{handleFilterReview(e,3)}} className={`home-filter__btn btn ${filter==3 ? 'btn--primary':''}`}>3 sao</button>
                 <button onClick={(e)=>{handleFilterReview(e,4)}} className={`home-filter__btn btn ${filter==4 ? 'btn--primary':''}`}>4 sao</button>
                  <button onClick={(e)=>{handleFilterReview(e,5)}}className={`home-filter__btn btn ${filter==5 ? 'btn--primary':''}`}>5 sao</button>
  
          </div>
        </div>
      </div>
      <div className={cx('review-list')}>
       
      
      {!datafilter?(Array.isArray(data) && data.map((item,idx)=>{
        return (

     <div key={idx} className={cx('review-item')}>
          <img className={cx('reviewer-avt')} src={item.userId.avt} />
          <div className={cx('review-list')}>
            <span >{item.userId.name}</span>
            <span className={cx('review-point-star')}>Đánh giá: {item.evaluate} sao</span>
            <span className="text-blur">{item.createAt}</span>
            <span className={cx('comment-review')}>{item.comment}</span>
          </div>
        </div>
        )
      }
    ) ):(Array.isArray(datafilter)&&
      datafilter.map((item,idx)=>{
      return (

     <div key={idx} className={cx('review-item')}>
          <img className={cx('reviewer-avt')} src={item.userId.avt} />
          <div className={cx('review-list')}>
            <span >{item.userId.name}</span>
            <span className={cx('review-point-star')}>Đánh giá: {item.evaluate} sao</span>
            <span className="text-blur">{item.createAt}</span>
            <span className={cx('comment-review')}>{item.comment}</span>
          </div>
        </div>
        )
     })
    )
        }
      </div>
    </div>
      );
}

export default Review;