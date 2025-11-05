#!/bin/bash

# ============================================================================
# DEPLOY EDGE FUNCTION - redirect-handler
# ============================================================================
# Este script faz o deploy da edge function redirect-handler para o Supabase
# ============================================================================

echo "============================================================================"
echo "DEPLOY DA EDGE FUNCTION: redirect-handler"
echo "============================================================================"
echo ""

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não está instalado!"
    echo ""
    echo "Instale com:"
    echo "  brew install supabase/tap/supabase"
    echo ""
    echo "Ou use o método manual (veja abaixo)"
    exit 1
fi

echo "✅ Supabase CLI encontrado"
echo ""

# Verificar se está logado
echo "Verificando autenticação..."
if ! supabase projects list &> /dev/null; then
    echo "❌ Você não está logado no Supabase CLI"
    echo ""
    echo "Execute:"
    echo "  supabase login"
    echo ""
    exit 1
fi

echo "✅ Autenticado no Supabase"
echo ""

# Fazer link com o projeto (se necessário)
echo "Fazendo link com o projeto..."
if [ ! -f ".supabase/config.toml" ]; then
    echo "⚠️  Projeto não está linkado"
    echo ""
    echo "Execute:"
    echo "  supabase link --project-ref SEU_PROJECT_REF"
    echo ""
    echo "Você pode encontrar o PROJECT_REF em:"
    echo "  https://supabase.com/dashboard → Settings → General"
    echo ""
    exit 1
fi

echo "✅ Projeto linkado"
echo ""

# Deploy da função
echo "Fazendo deploy da função redirect-handler..."
echo ""

supabase functions deploy redirect-handler

if [ $? -eq 0 ]; then
    echo ""
    echo "============================================================================"
    echo "✅ DEPLOY CONCLUÍDO COM SUCESSO!"
    echo "============================================================================"
    echo ""
    echo "A edge function está disponível em:"
    echo "https://SEU_PROJECT_REF.supabase.co/functions/v1/redirect-handler"
    echo ""
    echo "Teste com:"
    echo "curl -X POST 'https://SEU_PROJECT_REF.supabase.co/functions/v1/redirect-handler' \\"
    echo "  -H 'Authorization: Bearer SEU_ANON_KEY' \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{\"slug\": \"caio-martins-ig-bio\"}'"
    echo ""
else
    echo ""
    echo "============================================================================"
    echo "❌ ERRO NO DEPLOY!"
    echo "============================================================================"
    echo ""
    echo "Veja os erros acima e tente novamente."
    echo ""
    echo "Se o erro persistir, use o método MANUAL (veja DEPLOY_EDGE_FUNCTION.md)"
    echo ""
    exit 1
fi
