const mongoose = require('mongoose');

const pageContentSchema = new mongoose.Schema({
    page: { 
        type: String, 
        required: true,
        enum: ['homepage', 'docs'],
        unique: true
    },
    sections: [{
        id: { type: String, required: true },
        type: { 
            type: String, 
            enum: ['hero', 'text', 'feature', 'image', 'cta', 'faq', 'code'],
            default: 'text' 
        },
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        content: { type: String, default: '' },
        imageUrl: { type: String, default: '' },
        buttonText: { type: String, default: '' },
        buttonLink: { type: String, default: '' },
        order: { type: Number, default: 0 },
        visible: { type: Boolean, default: true }
    }],
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('PageContent', pageContentSchema);
