import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Shield } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export default function Privacy() {
  const { lang } = useLanguage();
  
  const content = {
    pt: {
      title: 'Política de Privacidade',
      lastUpdate: 'Última atualização: Dezembro de 2024',
      sections: [
        {
          title: '1. Coleta de Dados',
          content: 'Coletamos apenas os dados necessários para o funcionamento da plataforma: nome de usuário, senha (criptografada) e histórico de conversas com a IA. Não vendemos ou compartilhamos seus dados com terceiros.'
        },
        {
          title: '2. Uso dos Dados',
          content: 'Seus dados são usados exclusivamente para: manter seu acesso à plataforma, salvar seu histórico de conversas e melhorar nossos serviços. Não utilizamos seus dados para fins publicitários.'
        },
        {
          title: '3. Segurança',
          content: 'Utilizamos criptografia e práticas de segurança para proteger seus dados. Senhas são armazenadas de forma segura usando bcrypt. Todas as comunicações são feitas via HTTPS.'
        },
        {
          title: '4. Seus Direitos',
          content: 'Você tem direito a: acessar seus dados, solicitar exclusão da sua conta, exportar suas conversas. Para exercer esses direitos, entre em contato conosco.'
        },
        {
          title: '5. Contato',
          content: 'Para questões sobre privacidade, entre em contato: contato@jgsp.me'
        }
      ]
    },
    en: {
      title: 'Privacy Policy',
      lastUpdate: 'Last update: December 2024',
      sections: [
        {
          title: '1. Data Collection',
          content: 'We only collect data necessary for the platform to function: username, password (encrypted), and AI conversation history. We do not sell or share your data with third parties.'
        },
        {
          title: '2. Data Usage',
          content: 'Your data is used exclusively to: maintain your access to the platform, save your conversation history, and improve our services. We do not use your data for advertising purposes.'
        },
        {
          title: '3. Security',
          content: 'We use encryption and security practices to protect your data. Passwords are stored securely using bcrypt. All communications are made via HTTPS.'
        },
        {
          title: '4. Your Rights',
          content: 'You have the right to: access your data, request deletion of your account, export your conversations. To exercise these rights, contact us.'
        },
        {
          title: '5. Contact',
          content: 'For privacy questions, contact us: contato@jgsp.me'
        }
      ]
    }
  };

  const t = content[lang] || content.pt;

  return (
    <>
      <Helmet>
        <title>{t.title} | JGSP</title>
        <meta name="description" content={t.title} />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 text-white py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            {lang === 'pt' ? 'Voltar ao Início' : 'Back to Home'}
          </Link>
          
          <div className="flex items-center gap-4 mb-8">
            <Shield className="h-12 w-12 text-indigo-400" />
            <div>
              <h1 className="text-3xl font-bold">{t.title}</h1>
              <p className="text-gray-400 text-sm">{t.lastUpdate}</p>
            </div>
          </div>
          
          <div className="space-y-8">
            {t.sections.map((section, i) => (
              <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-3 text-indigo-300">{section.title}</h2>
                <p className="text-gray-300 leading-relaxed">{section.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
