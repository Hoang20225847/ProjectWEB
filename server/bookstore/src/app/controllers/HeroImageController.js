const HeroImage = require('../models/HeroImages');
const fs = require('fs');
const path = require('path');

class HeroImageController {
    // GET /api/hero-images - Lấy danh sách hero images đang active
    async list(req, res, next) {
        try {
            const images = await HeroImage.find({ isActive: true })
                .sort({ order: 1, createdAt: -1 });
            return res.status(200).json(images);
        } catch (error) {
            return res.status(500).json({ message: 'Lỗi server', error: error.message });
        }
    }

    // GET /api/hero-images/all - Lấy tất cả hero images (kể cả inactive) - cho admin
    async listAll(req, res, next) {
        try {
            const images = await HeroImage.find()
                .sort({ order: 1, createdAt: -1 });
            return res.status(200).json(images);
        } catch (error) {
            return res.status(500).json({ message: 'Lỗi server', error: error.message });
        }
    }

    // GET /api/hero-images/:id - Lấy chi tiết 1 hero image
    async getOne(req, res, next) {
        try {
            const { id } = req.params;
            const image = await HeroImage.findById(id);
            if (!image) {
                return res.status(404).json({ message: 'Không tìm thấy hero image' });
            }
            return res.status(200).json(image);
        } catch (error) {
            return res.status(500).json({ message: 'Lỗi server', error: error.message });
        }
    }

    // POST /api/hero-images - Tạo hero image mới
    async create(req, res, next) {
        try {
            const { altText, link, order, isActive } = req.body;
            
            let imageUrl = '';
            if (req.file) {
                // Ảnh được upload lên server, lưu đường dẫn
                imageUrl = `/uploads/${req.file.filename}`;
            } else if (req.body.imageUrl) {
                // Hoặc nhận URL trực tiếp (cho ảnh từ bên ngoài)
                imageUrl = req.body.imageUrl;
            } else {
                return res.status(400).json({ message: 'Vui lòng cung cấp ảnh' });
            }

            const newImage = new HeroImage({
                imageUrl,
                altText: altText || '',
                link: link || '',
                order: order || 0,
                isActive: isActive !== undefined ? isActive : true
            });

            await newImage.save();
            return res.status(201).json({ 
                message: 'Tạo hero image thành công', 
                data: newImage 
            });
        } catch (error) {
            return res.status(500).json({ message: 'Lỗi server', error: error.message });
        }
    }

    // PUT /api/hero-images/:id - Cập nhật hero image
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const { altText, link, order, isActive } = req.body;

            const image = await HeroImage.findById(id);
            if (!image) {
                return res.status(404).json({ message: 'Không tìm thấy hero image' });
            }

            // Nếu có file mới upload
            if (req.file) {
                // Xóa ảnh cũ nếu là ảnh local (không phải URL ngoài)
                if (image.imageUrl && image.imageUrl.startsWith('/uploads/')) {
                    const oldPath = path.join(__dirname, '../../public' + image.imageUrl);
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }
                }
                image.imageUrl = `/uploads/${req.file.filename}`;
            }

            // Cập nhật các trường khác
            if (altText !== undefined) image.altText = altText;
            if (link !== undefined) image.link = link;
            if (order !== undefined) image.order = order;
            if (isActive !== undefined) image.isActive = isActive;
            image.updatedAt = Date.now();

            await image.save();
            return res.status(200).json({ 
                message: 'Cập nhật hero image thành công', 
                data: image 
            });
        } catch (error) {
            return res.status(500).json({ message: 'Lỗi server', error: error.message });
        }
    }

    // DELETE /api/hero-images/:id - Xóa hero image
    async remove(req, res, next) {
        try {
            const { id } = req.params;
            const image = await HeroImage.findById(id);

            if (!image) {
                return res.status(404).json({ message: 'Không tìm thấy hero image' });
            }

            // Xóa file ảnh nếu là ảnh local
            if (image.imageUrl && image.imageUrl.startsWith('/uploads/')) {
                const filePath = path.join(__dirname, '../../public' + image.imageUrl);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            await HeroImage.findByIdAndDelete(id);
            return res.status(200).json({ message: 'Xóa hero image thành công' });
        } catch (error) {
            return res.status(500).json({ message: 'Lỗi server', error: error.message });
        }
    }

    // PUT /api/hero-images/reorder - Sắp xếp lại thứ tự
    async reorder(req, res, next) {
        try {
            const { images } = req.body; // Array of { id, order }

            if (!Array.isArray(images)) {
                return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
            }

            // Cập nhật order cho từng image
            const updatePromises = images.map(({ id, order }) => 
                HeroImage.findByIdAndUpdate(id, { order, updatedAt: Date.now() })
            );

            await Promise.all(updatePromises);
            return res.status(200).json({ message: 'Cập nhật thứ tự thành công' });
        } catch (error) {
            return res.status(500).json({ message: 'Lỗi server', error: error.message });
        }
    }
}

module.exports = new HeroImageController;