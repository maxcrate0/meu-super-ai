const axios = require('axios');

async function testAPIs() {
  console.log('Testando APIs de modelos...\n');

  // Teste Pollinations text models
  try {
    console.log('🔍 Testando Pollinations text models...');
    const textResponse = await axios.get('https://text.pollinations.ai/models', { timeout: 10000 });
    console.log(`✅ Pollinations text: ${textResponse.data?.length || 0} modelos`);
    if (textResponse.data?.length > 0) {
      console.log('   Primeiros 3:', textResponse.data.slice(0, 3));
    }
  } catch (e) {
    console.log('❌ Pollinations text error:', e.message);
  }

  // Teste Pollinations image models
  try {
    console.log('\n🔍 Testando Pollinations image models...');
    const imageResponse = await axios.get('https://image.pollinations.ai/models', { timeout: 10000 });
    console.log(`✅ Pollinations image: ${Array.isArray(imageResponse.data) ? imageResponse.data.length : 'N/A'} modelos`);
    if (Array.isArray(imageResponse.data) && imageResponse.data.length > 0) {
      console.log('   Modelos:', imageResponse.data.slice(0, 3));
    }
  } catch (e) {
    console.log('❌ Pollinations image error:', e.message);
  }

  // Teste G4F Python server
  try {
    console.log('\n🔍 Testando G4F Python server...');
    const g4fResponse = await axios.get('http://meu-super-ai-g4f.centralus.azurecontainer.io:8080/v1/models', { timeout: 10000 });
    console.log(`✅ G4F Python: ${g4fResponse.data?.data?.length || 0} modelos`);
  } catch (e) {
    console.log('❌ G4F Python error:', e.message);
  }

  // NOVO TESTE: G4F AnyProvider
  try {
    console.log('\n🔍 Testando G4F AnyProvider...');
    const g4fModule = await import('./backend/g4f-client.mjs');
    const client = new g4fModule.AnyProvider();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Olá! Responda apenas com "AnyProvider funcionando!"' }],
    });
    if (response?.choices?.[0]?.message?.content) {
      console.log('✅ G4F AnyProvider:', response.choices[0].message.content.trim());
    } else {
      console.log('❌ G4F AnyProvider: resposta vazia');
    }
  } catch (e) {
    console.log('❌ G4F AnyProvider error:', e.message);
  }

  console.log('\n🏁 Teste concluído');
}

testAPIs().catch(console.error);