import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// 🔥 CRITICAL DEBUG: Full environment variables check
console.log('=================================================');
console.log('🔍 ENVIRONMENT VARIABLES CHECK');
console.log('=================================================');
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? 'DEFINED' : 'UNDEFINED');
console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'DEFINED' : 'UNDEFINED');
console.log('MODE:', import.meta.env.MODE);
console.log('DEV:', import.meta.env.DEV);
console.log('PROD:', import.meta.env.PROD);
console.log('BASE_URL:', import.meta.env.BASE_URL);
console.log('=================================================');

// Wrap the render in a try-catch to catch any initialization errors
try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }

  // Detect missing Supabase env vars before rendering
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  let missingVars = [];
  if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missingVars.push('VITE_SUPABASE_ANON_KEY');

  if (missingVars.length > 0) {
    rootElement.innerHTML = `
      <div style="
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #f8fafc;
        padding: 1rem;
        font-family: system-ui, -apple-system, sans-serif;
      ">
        <div style="
          max-width: 500px;
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        ">
          <h1 style="color: #dc2626; margin-bottom: 1rem; font-size: 1.25rem;">
            Variáveis de ambiente ausentes
          </h1>
          <p style="color: #475569; margin-bottom: 1rem;">
            O aplicativo não pode iniciar porque as seguintes variáveis não estão definidas:<br>
            <strong>${missingVars.join(', ')}</strong>
          </p>
          <ul style="color: #64748b; margin-bottom: 1rem;">
            <li>Crie um arquivo <code>.env.local</code> na raiz do projeto.</li>
            <li>Adicione as variáveis conforme o exemplo abaixo:</li>
          </ul>
          <pre style="background: #f1f5f9; padding: 0.5rem; border-radius: 4px; font-size: 0.875rem; overflow: auto; margin-bottom: 1rem;">
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
          </pre>
          <p style="color: #475569; margin-bottom: 1rem;">
            Após salvar, reinicie o servidor de desenvolvimento.<br>
            <code>npm run dev</code>
          </p>
          <button onclick="window.location.reload()" style="
            padding: 0.5rem 1rem;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          ">
            Recarregar página
          </button>
        </div>
      </div>
    `;
    throw new Error('Missing required environment variables: ' + missingVars.join(', '));
  }

  const root = createRoot(rootElement);
  root.render(<App />);
} catch (error) {
  console.error('Failed to initialize application:', error);
}
