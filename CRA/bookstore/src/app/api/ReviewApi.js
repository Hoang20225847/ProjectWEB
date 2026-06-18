  import axios from'../../components/axios/axios.customize'
  export async function getReviewBook(id) {
    try {
      
      const data = await axios.get(`/api/review?id=${encodeURIComponent(id)}`);
       console.log("data o day ne:",data) 
      
        return data
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu:', err);
    }
  }

  export async function getUserReviews(email) {
    try {
      const data = await axios.get(`/api/reviews/user/${encodeURIComponent(email)}`);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Lỗi khi lấy đánh giá của user:', err);
      return [];
    }
  }
 
