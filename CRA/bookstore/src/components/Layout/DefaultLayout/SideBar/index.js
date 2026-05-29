import   '../../../assets/css/main.css'
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCategoryList } from '../../../../app/api/siteApi.js';

function Sidebar() {
    const [filter,setFilter]=useState(5);
    const [categories, setCategories] = useState([]);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const list = await getCategoryList();
            if (!cancelled && Array.isArray(list)) setCategories(list);
        })();
        return () => { cancelled = true; };
    }, []);
    return (
       
                    <div className="grid__column-2">
                        <nav className="category">
                            
                            <h3 className="category__heading">
                                <i className="category__heading-icon fa-solid fa-list"></i>
                                Danh mục
                            </h3>
                            <ul className="category-list">
                                <a href="/" className={`category-item__link ${filter ==5 ?'category-item--active':'' } `}>Sản Phẩm</a>
                                {categories.map((cat, idx) => (
                                <li key={cat._id} onClick={(e)=>{
                                e.preventDefault();
                                setFilter(idx)

                                }} className="category-item">
                                        <Link to={`/search?category=${encodeURIComponent(cat.slug)}`} className={`category-item__link ${filter === idx ?'category-item--active':'' } `}>{cat.name}</Link>
                                </li>
                                ))}
                            </ul>
                        </nav>
                       
                    </div>
                    
     
      )
}

export default Sidebar