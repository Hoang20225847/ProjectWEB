import axios from '../../components/axios/axios.customize.js';

// Lấy danh sách hero images đang active
export async function getHeroImages() {
  try {
    const response = await axios.get('/api/hero-images');
    return response;
  } catch (error) {
    console.error('Lỗi khi lấy hero images:', error);
    return [];
  }
}

// Lấy tất cả hero images (cho admin)
export async function getAllHeroImages() {
  try {
    const response = await axios.get('/api/hero-images/all');
    return response;
  } catch (error) {
    console.error('Lỗi khi lấy tất cả hero images:', error);
    return [];
  }
}

// Tạo hero image mới
export async function createHeroImage(formData) {
  try {
    const response = await axios.post('/api/hero-images', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response;
  } catch (error) {
    console.error('Lỗi khi tạo hero image:', error);
    throw error;
  }
}

// Cập nhật hero image
export async function updateHeroImage(id, formData) {
  try {
    const response = await axios.put(`/api/hero-images/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response;
  } catch (error) {
    console.error('Lỗi khi cập nhật hero image:', error);
    throw error;
  }
}

// Xóa hero image
export async function deleteHeroImage(id) {
  try {
    const response = await axios.delete(`/api/hero-images/${id}`);
    return response;
  } catch (error) {
    console.error('Lỗi khi xóa hero image:', error);
    throw error;
  }
}

// Cập nhật thứ tự hero images
export async function reorderHeroImages(images) {
  try {
    const response = await axios.put('/api/hero-images/reorder', { images });
    return response;
  } catch (error) {
    console.error('Lỗi khi cập nhật thứ tự hero images:', error);
    throw error;
  }
}
