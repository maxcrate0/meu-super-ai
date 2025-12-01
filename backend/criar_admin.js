require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); 

const NEW_ADMIN_USER = 'admin';
const NEW_ADMIN_PASS = '@admin2306#'; 

async function createAdmin() {
  try {
    console.log('🔌 Conectando...');
    // Conecta usando a string passada no terminal
    await mongoose.connect(process.env.MONGODB_URI); 
    
    // --- DIAGNÓSTICO ---
    console.log('✅ Conectado com sucesso!');
    console.log('📂 NOME DO BANCO DE DADOS:', mongoose.connection.db.databaseName);
    // -------------------

    // 1. Apaga qualquer admin existente (FORÇA BRUTA)
    console.log(`🗑️  Apagando usuário "${NEW_ADMIN_USER}" antigo se existir...`);
    await User.deleteOne({ username: NEW_ADMIN_USER });

    // 2. Cria o Hash
    console.log('🔒 Criptografando senha...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(NEW_ADMIN_PASS, salt);

    // 3. Cria o Usuário Novo
    console.log('👤 Criando novo admin...');
    await User.create({
      username: NEW_ADMIN_USER,
      password: hashedPassword,
      role: 'admin',
      personal_api_key: ''
    });

    console.log(`
    🎉 SUCESSO TOTAL!
    Usuário criado no banco: ${mongoose.connection.db.databaseName}
    Login: ${NEW_ADMIN_USER}
    Senha: ${NEW_ADMIN_PASS}
    `);

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

createAdmin();