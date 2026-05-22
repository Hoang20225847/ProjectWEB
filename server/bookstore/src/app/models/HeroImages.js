const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const HeroImage = new Schema({
    imageUrl: { 
        type: String, 
        required: true 
    },
    altText: { 
        type: String, 
        default: '' 
    },
    link: { 
        type: String, 
        default: '' 
    },
    order: { 
        type: Number, 
        default: 0 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

// Index để sort theo order
HeroImage.index({ order: 1 });

module.exports = mongoose.model('HeroImage', HeroImage);
