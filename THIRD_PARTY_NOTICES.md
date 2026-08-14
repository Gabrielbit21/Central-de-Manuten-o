# Third-party notices — Central de Manutenção SE v1.9.0

## Supabase JavaScript Client
- Componente: `@supabase/supabase-js`
- Versão fixada: `2.57.4`
- Licença: MIT
- Arquivo local esperado: `vendor/supabase-js-2.57.4.min.js`
- Texto de licença: `vendor/LICENSE-supabase-js.txt`

## SheetJS Community Edition
- Componente: SheetJS CE
- Versão fixada: `0.20.3`
- Licença: Apache-2.0
- Arquivo local esperado: `vendor/xlsx-0.20.3.full.min.js`
- Texto de licença: `vendor/LICENSE-sheetjs.txt`

A v1.9.0 não referencia essas bibliotecas em CDN durante a execução. O script
`PREPARAR_RELEASE.bat` faz a aquisição uma única vez durante a preparação do release,
calcula SHA-256 e gera o pacote READY para publicação/empacotamento.
