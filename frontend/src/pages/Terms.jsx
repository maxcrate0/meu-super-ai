import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, FileText } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export default function Terms() {
  const { lang } = useLanguage();
  
  const content = {
    pt: {
      title: 'Termos de Uso',
      lastUpdate: 'Última atualização: Dezembro de 2024',
      sections: [
        {
          title: '1. Aceitação dos Termos',
          content: 'Ao acessar e usar a plataforma JGSP (incluindo jgspAI), você concorda com estes termos de uso. Se não concordar, não utilize nossos serviços.'
        },
        {
          title: '2. Uso Permitido',
          content: 'Você pode usar nossa plataforma para interagir com modelos de IA, criar ferramentas personalizadas e automatizar tarefas legítimas. É proibido: usar para atividades ilegais, tentar acessar dados de outros usuários, sobrecarregar nossos sistemas intencionalmente.'
        },
        {
          title: '3. Conta do Usuário',
          content: 'Você é responsável por manter a segurança da sua conta. Não compartilhe sua senha. Notifique-nos imediatamente sobre qualquer uso não autorizado.'
        },
        {
          title: '4. Conteúdo Gerado por IA',
          content: 'O conteúdo gerado pela IA é fornecido "como está". Não garantimos precisão ou adequação para qualquer propósito específico. Você é responsável por verificar as informações antes de usá-las.'
        },
        {
          title: '5. Limitação de Responsabilidade',
          content: 'Não nos responsabilizamos por danos diretos ou indiretos resultantes do uso da plataforma. Nossos serviços podem ser interrompidos a qualquer momento para manutenção.'
        },
        {
          title: '6. Alterações nos Termos',
          content: 'Podemos atualizar estes termos a qualquer momento. Alterações significativas serão comunicadas. O uso contínuo da plataforma constitui aceitação das mudanças.'
        },
        {
          title: '7. Contato',
          content: 'Para dúvidas sobre os termos: contato@jgsp.me'
        }
      ]
    },
    en: {
      title: 'Terms of Use',
      lastUpdate: 'Last update: December 2024',
      sections: [
        {
          title: '1. Acceptance of Terms',
          content: 'By accessing and using the JGSP platform (including jgspAI), you agree to these terms of use. If you do not agree, do not use our services.'
        },
        {
          title: '2. Permitted Use',
          content: 'You may use our platform to interact with AI models, create custom tools, and automate legitimate tasks. Prohibited: using for illegal activities, attempting to access other users\' data, intentionally overloading our systems.'
        },
        {
          title: '3. User Account',
          content: 'You are responsible for maintaining the security of your account. Do not share your password. Notify us immediately of any unauthorized use.'
        },
        {
          title: '4. AI-Generated Content',
          content: 'AI-generated content is provided "as is". We do not guarantee accuracy or suitability for any specific purpose. You are responsible for verifying information before using it.'
        },
        {
          title: '5. Limitation of Liability',
          content: 'We are not responsible for direct or indirect damages resulting from platform use. Our services may be interrupted at any time for maintenance.'
        },
        {
          title: '6. Changes to Terms',
          content: 'We may update these terms at any time. Significant changes will be communicated. Continued use of the platform constitutes acceptance of changes.'
        },
        {
          title: '7. Contact',
          content: 'For questions about the terms: contato@jgsp.me'
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
            <FileText className="h-12 w-12 text-indigo-400" />
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
