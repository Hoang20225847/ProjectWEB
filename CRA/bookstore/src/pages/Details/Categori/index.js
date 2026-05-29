
import React, { useEffect, useState } from 'react';
import { getBookList } from '../../../app/api/siteApi.js';
import { bookMatchesCategoryQuery } from '../../../utils/categoryUtils.js';
import { useLocation } from 'react-router-dom';
import BookCard, { BookCardGrid } from '../../../components/BookCard/BookCard.js';



function Category() {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const category=queryParams.get('category');
  const [data, setData] = useState(null);

  useEffect(() => {
    async function fetchData() {
      const json = await getBookList();
      setData(json);
    }
    fetchData();
  }, []);
  if(!category) return <div>Không có sản phẩm</div>
  if (!data) return <div>Đang tải...</div>;
    return ( 
      <div className="grid__column-10">
      <div className="home-filter">
          <span className="home-filter__label">Sắp xếp theo</span>
          <button onClick={(e)=>{handleFilter(e,1)}} className="home-filter__btn btn">Phổ biến</button>
          <button onClick={(e)=>{handleFilter(e,)}} className="home-filter__btn btn  btn--primary">Mới nhất</button>
          <button onClick={(e)=>{handleFilter(e,)}} className="home-filter__btn btn">Bán chạy</button>
          <div className="select-input">
              <span className="select-input__label">
                  Giá
                  
              </span>
              <i className="select-input__icon fa-solid fa-angle-down"></i>
              <ul className="select-input__list">
                  <li className="select-input__item">
                      <a href="" className="select-input__link">Giá:Thấp đến cao</a>
                      
                      
                  </li>
                  <li className="select-input__item">
                     
                      <a href="" className="select-input__link">Giá:Cao đến thấp</a>
                  </li>
              </ul>
          </div>
          <div className="home-filter__page">
              <span className="home-filter__page-num">
                  <span className="home-filter__page-current">1</span>/14
              </span>
              <div className="home-filter__page-control">
                  <a href="" className="home-filter__page-btn home-filter__page-btn--disable">
                      <i className="home-filter__page-icon fa-solid fa-angle-left"></i>
                  </a>
                  <a href="" className="home-filter__page-btn">
                      <i className="home-filter__page-icon fa-solid fa-angle-right"></i>
                  </a>
              </div>
          </div>
      </div>
      <BookCardGrid>
        {data
          .filter((item) => bookMatchesCategoryQuery(item, category))
          .map((item) => (
            <BookCard key={item._id} book={item} layout="grid" />
          ))}
      </BookCardGrid>
      <ul className="pagination home-product__pagination">
          <li className="pagination-item">
              <a href="" className="pagination-item_link">
                  <i className="pagination-item__icon fa-solid fa-angle-left">

                  </i>
              </a>
          </li>
          <li className="pagination-item pagination-item--active">
              <a href="" className="pagination-item_link">
                 1
              </a>
          </li>
          <li className="pagination-item">
              <a href="" className="pagination-item_link">
                 2
              </a>
          </li>
          <li className="pagination-item">
              <a href="" className="pagination-item_link">
                 3
              </a>
          </li>
          <li className="pagination-item">
              <a href="" className="pagination-item_link">
                 4
              </a>
          </li>
          <li className="pagination-item">
              <a href="" className="pagination-item_link">
                 5
              </a>
          </li>
          <li className="pagination-item">
              <a href="" className="pagination-item_link">
                 ...
              </a>
          </li>
          <li className="pagination-item">
              <a href="" className="pagination-item_link">
                 14
              </a>
          </li>
          <li className="pagination-item">
              <a href="" className="pagination-item_link">
                  <i className="pagination-item__icon fa-solid fa-angle-right">

                  </i>
              </a>
          </li>
      </ul>
 </div>
     );
}

export default Category;