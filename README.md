# Clube Gula & Gole — Sistema avançado sem custo inicial

Estrutura:
- GitHub Pages: hospeda as páginas.
- Google Sheets: guarda dados.
- Google Apps Script: funciona como backend.
- QR Code fixo: aponta para a página principal.

Arquivos:
- index.html: tela do cliente.
- admin.html: painel interno.
- telao.html: tela para sorteio no telão.
- style.css: visual.
- config.js: URL do Apps Script.
- common.js: comunicação com Apps Script.
- app.js: lógica da tela do cliente.
- admin.js: lógica do painel.
- telao.js: lógica do telão.
- apps-script/Code.gs: código do Google Apps Script.

Passo resumido:
1. Crie uma planilha Google.
2. Copie o ID da planilha.
3. Cole o código apps-script/Code.gs no Apps Script.
4. Troque SPREADSHEET_ID e ADMIN_PIN.
5. Rode a função setup().
6. Publique como Web App.
7. Copie a URL do Web App.
8. Cole no arquivo config.js.
9. Suba todos os arquivos no GitHub Pages.
10. Gere QR Code apontando para a URL do GitHub Pages.
