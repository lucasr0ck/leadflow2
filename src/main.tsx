import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// 🔥 CRITICAL DEBUG: Full environment variables check
console.log('=================================================');
console.log('🔍 ENVIRONMENT VARIABLES CHECK');
console.log('=================================================');
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_ANON_KEY (first 50 chars):', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 50) + '...');
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
  
  const root = createRoot(rootElement);
  root.render(<App />);
} catch (error) {
  console.error('Failed to initialize application:', error);
  
  // Display error on page
  const rootElement = document.getElementById("root");
  if (rootElement) {
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
            Application Initialization Error
          </h1>
          <p style="color: #475569; margin-bottom: 1rem;">
            The application failed to start. Please check the browser console for more details.
          </p>
          <details style="margin-bottom: 1rem;">
            <summary style="cursor: pointer; color: #64748b;">Error Details</summary>
            <pre style="
              background: #f1f5f9;
              padding: 0.5rem;
              border-radius: 4px;
              font-size: 0.875rem;
              overflow: auto;
              margin-top: 0.5rem;
            ">${error instanceof Error ? error.message : String(error)}</pre>
          </details>
          <button onclick="window.location.reload()" style="
            padding: 0.5rem 1rem;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          ">
            Reload Page
          </button>
        </div>
      </div>
    `;
  }
}
