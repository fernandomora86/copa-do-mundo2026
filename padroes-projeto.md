# Padrões e Lições do Projeto — Simulador Copa 2026

---

## 🏗️ Padrões de Código Utilizados

* **Framework base:** Vanilla HTML/CSS/JS — single-file app (`simulador-copa-2026.html`). Zero dependências externas, zero build step. Todo o app vive em um único arquivo `<style>` + `<script>` inline.
* **Banco de dados e persistência:** `localStorage` puro — chaves `copa2026_scores` (placar) e `copa2026_played` (jogos interagidos). Sem backend.
* **Padrão de estrutura interna que funcionou:**
  * Estado global em variáveis JS no topo (`tempScores`, `playedMatches`, `simMode`, `lockedMatches`)
  * Funções de render separadas por seção (`renderGroupStandings`, `renderBracket`, `autoRefreshKO`)
  * Assets pesados (imagem da taça) embutidos como base64 — elimina dependência de path externo
* **PWA:** `manifest.json` + `sw.js` com cache estático (cache v2). Ícones em SVG (any + maskable).
* **Responsividade:** Mobile-first. Breakpoint único em `768px`. Grid de grupos: 1 coluna no celular, 4 colunas no desktop. Safe area insets para notch/iPhone.

---

## 🛠️ Desafios Superados (O que deu certo)

* **Chaveamento de 8 melhores terceiros:** O chaveamento oficial FIFA para R32 depende de qual grupo o terceiro veio — não é só pegar os 8 melhores e jogar numa ordem fixa. A solução foi um mapa condicional de slots baseado na combinação de grupos dos terceiros classificados. Replique essa lógica se precisar de chaveamento FIFA-oficial.

* **Simulação em cascata (Modo ⚡):** Após simular jogos, quando o usuário edita manualmente um placar, é preciso re-simular apenas os jogos KO downstream. O ponto crítico: `getPairs()` deve ser chamado **dentro** do `forEach` (lazy), não antes — do contrário os pares são calculados antes dos winners serem atualizados e toda a cascata quebra. Função: `simKOCascade()`.

* **Placar com dois estados (simulado vs. manual):** Criamos dois Sets — `lockedMatches` (editado pelo usuário) e a flag `simMode`. Scores simulados recebem classe `simulated` (ouro translúcido), scores manuais recebem `locked` (branco). Isso permite saber visualmente o que o usuário tocou e o que foi gerado automaticamente.

* **Imagem da taça sem quebrar no deploy:** Embed da taça como base64 direto no JS/HTML — elimina qualquer problema de caminho relativo no Vercel ou PWA offline.

* **Demo antes de implementar visual:** Para cada mudança de UI nova (datas, setas de navegação, cabeçalhos), criamos um arquivo `demo-*.html` separado com 2–3 variações para aprovação antes de tocar o arquivo principal. Evita retrabalho no arquivo de produção.

* **Calendário abre no dia certo automaticamente:** `findBestCalDate()` — abre no dia atual se tiver jogo, senão no próximo com jogo, senão no último. Nunca abre num dia vazio.

---

## ⚠️ O que EVITAR (Erros do passado)

* **Não use nenhuma biblioteca externa (jQuery, lodash, framework JS):** O app é zero-dependência por design. Qualquer lib externa complica o deploy single-file e aumenta o tamanho sem necessidade. Use Vanilla JS.

* **Não chame `getPairs()` fora do loop de cascata:** Chamar antes do `forEach` congela os pares no estado pré-simulação. Sempre lazy, dentro do loop.

* **Não faça mudanças de CSS global sem testar em viewport ~375px primeiro:** O mobile é prioridade absoluta. Mudanças que parecem inofensivas no desktop quebram o layout em celular.

* **Não hardcode datas, grupos ou chaveamento sem fonte oficial (FIFA/Wikipedia):** O simulador replica a Copa 2026 real. Dados inventados geram retrabalho de correção posterior.

* **Não edite o arquivo principal sem ter um backup funcional:** O arquivo é single-file — um erro sem backup pode derrubar tudo. Mantenha sempre um `*-BACKUP.html` atualizado antes de mudanças grandes.

* **Não referencie assets por caminho relativo no código:** Use base64 embutido. Caminhos relativos quebram em contextos PWA e em algumas configurações de deploy.

---

## 🚀 Deploy

> Conta Vercel: `fernandomora86` | Conta GitHub: `fernandomora86`
> Vercel CLI e GitHub CLI (`gh`) já estão instalados e autenticados globalmente.

### Subir no GitHub

Basta pedir **"sobe no GitHub"**. O Claude executa automaticamente:

```powershell
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
git add -A
git commit -m "descrição da alteração"
git push
```

* Na primeira vez num projeto novo (sem git): Claude inicializa com `git init` e cria o repositório com `gh repo create`.

### Subir no Vercel

Basta pedir **"sobe no Vercel"**. O Claude executa automaticamente:

```powershell
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
vercel --prod --yes
```

* Na primeira vez num projeto novo no Vercel, o Claude pergunta o nome do projeto antes de fazer o deploy.

### Fluxo combinado

Pedir **"sobe no GitHub e no Vercel"** → Claude faz o `git push` primeiro, depois o `vercel --prod`.
