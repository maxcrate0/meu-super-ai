const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  // Identificação do site/página
  site: { 
    type: String, 
    required: true, 
    index: true,
    trim: true,
    lowercase: true
  },
  page: { 
    type: String, 
    required: true, 
    index: true,
    trim: true
  },
  
  // Dados do autor
  author: { 
    type: String, 
    default: 'Anônimo',
    trim: true,
    maxlength: 100
  },
  email: { 
    type: String, 
    trim: true,
    lowercase: true,
    select: false // Não retorna por padrão (privacidade)
  },
  
  // Conteúdo
  content: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 5000
  },
  
  // Resposta a outro comentário (threading)
  parentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Comment',
    default: null
  },
  
  // Status de moderação
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'flagged', 'deleted'],
    default: 'approved', // Mude para 'pending' se quiser moderação prévia
    index: true
  },
  
  // Metadata
  ipHash: { type: String }, // Hash do IP para anti-spam (não armazena IP real)
  userAgent: { type: String, select: false },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

// Índices compostos para queries frequentes
CommentSchema.index({ site: 1, page: 1, status: 1, createdAt: -1 });
CommentSchema.index({ site: 1, status: 1 });
CommentSchema.index({ parentId: 1 });

// Atualiza updatedAt automaticamente
CommentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Comment', CommentSchema);
