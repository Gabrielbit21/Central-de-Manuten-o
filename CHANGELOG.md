# Changelog — Central de Manutenção SE

## v0.9.5 — HOMOLOGAÇÃO

### Refinamento visual
- Removida da tela inicial a tag `Acesso administrativo` / `Acesso de campo`.
- Botões de retorno das telas do fluxo passam a exibir somente a seta para a esquerda.
- Retorno com aparência mais clean e corporativa: fundo transparente em repouso, realce sutil no hover/foco e área de toque preservada.
- Adicionados rótulos de acessibilidade (`aria-label`) e dicas (`title`) aos retornos iconográficos.

### Mantido
- Todos os ajustes de autenticação, cache e atualização da v0.9.4.

## v0.9.4 — HOMOLOGAÇÃO

### Refinamento visual
- Removidos o título do sistema e o subtítulo da tela inicial de autenticação.
- Reduzida a logo Energisa na autenticação, com dimensões específicas para desktop e celular.
- Aumentado o respiro entre a marca e o card de login para uma composição mais limpa e corporativa.

### Mantido
- Controle de build e atualização por `version.json` da v0.9.3.
- Logo embutida no próprio HTML.
- Logout automático na virada do dia, sem texto explicativo permanente na tela de login.

## v0.9.3 — HOMOLOGAÇÃO
- Tratamento de cache/stale em navegadores móveis com verificação de versão.
- Remoção do registro incompleto de `service-worker.js`.
- Logo de autenticação embutida no HTML.

## v0.9.2 — HOMOLOGAÇÃO
- Logo da tela de login embutida no HTML.
- Removida a mensagem visual sobre encerramento diário da sessão.

## v0.9.1 — HOMOLOGAÇÃO
- Autocadastro com aprovação administrativa.
- Perfil solicitado pelo usuário.
- Logout diário automático.
