# Conarmas O.S. Manager Brownfield Enhancement PRD

## 1. Intro Project Analysis and Context

### 1.1. Existing Project Overview

* **Análise de Fonte:** Análise da base de código `conarmas-os-manager` fornecida.
* **Estado Atual do Projeto:** O sistema é uma aplicação full-stack construída com React (Vite) e Supabase. Atualmente, ele gerencia a criação, edição e listagem de Ordens de Serviço (O.S.) para manutenção de armas, incluindo upload de imagens e geração de PDF.

### 1.2. Available Documentation Analysis
* [X] Documentação do Tech Stack (Analisado do `package.json` e `supabase/config.toml`)
* [X] Estrutura de Pastas/Arquitetura (Analisado dos arquivos do projeto)
* [X] Padrões de Código (Analisado de `eslint.config.js` e `tailwind.config.ts`)
* [X] Documentação de API (Inferido das funções Supabase e tipos)
* [ ] Documentação de API Externa (N/A)
* [X] Diretrizes de UX/UI (Inferido de `src/components/ui` e `src/index.css`)
* [ ] Documentação de Dívida Técnica (N/A)

A documentação existente é derivada do código. Nenhuma documentação formal de planejamento (PRD/Arquitetura) foi fornecida.

### 1.3. Enhancement Scope Definition
* **Tipo de Melhoria:**
    * [X] Adição de Nova Funcionalidade (Serviços de Despachante)
    * [X] Modificação de Funcionalidade Principal (Adicionar telefone à O.S., Assinaturas no PDF)
    * [ ] Integração com Novos Sistemas
    * [ ] Melhorias de Performance/Escalabilidade
    * [X] Reformulação de UI/UX (Novo layout de dashboard dividido)
    * [ ] Atualização de Tech Stack
    * [ ] Correção de Bugs e Melhorias de Estabilidade
* **Descrição da Melhoria:** Dividir a aplicação em dois módulos principais (O.S. e Despachante), criar um novo fluxo CRUD completo para "Serviços de Despachante" (incluindo campos específicos, status e uploads) e fazer pequenas atualizações no fluxo de O.S. existente e na geração de PDF.
* **Avaliação de Impacto:**
    * [ ] Impacto Mínimo
    * [ ] Impacto Moderado
    * [X] Impacto Significativo (Requer nova estrutura de dados no Supabase e grandes mudanças na navegação/UI)
    * [ ] Impacto Maior

### 1.4. Goals and Background Context
* **Metas:**
    * Expandir a utilidade do sistema para além das O.S., incluindo Serviços de Despachante.
    * Melhorar a coleta de dados para O.S. (adicionando Telefone).
    * Aumentar a formalidade dos PDFs de O.S. com assinaturas.
    * Organizar a UI para acomodar ambos os serviços de forma clara.
* **Contexto:** O sistema atual lida bem com Ordens de Serviço de manutenção. A empresa Conarmas também oferece serviços de despachante, que atualmente não são rastreados pelo sistema. Esta melhoria visa trazer o gerenciamento desses serviços para a mesma plataforma, otimizando o fluxo de trabalho da empresa.

### 1.5. Change Log
| Mudança | Data | Versão | Descrição | Autor |
| :--- | :--- | :--- | :--- | :--- |
| Criação Inicial | 28/10/2025 | 1.0 | Documento inicial baseado nos requisitos do usuário. | PM (John) |

## 2. Requisitos

### 2.1. Funcional (FR)
1.  **FR1:** O sistema deve ser atualizado para apresentar dois módulos principais no dashboard: "Ordens de Serviço" e "Serviços de Despachante".
2.  **FR2:** Deve ser criado um novo fluxo CRUD (Criar, Ler, Atualizar, Excluir) para "Serviços de Despachante".
3.  **FR3:** O formulário de criação de "Serviço de Despachante" deve ter os seguintes campos:
    * Nome Completo (Texto)
    * Endereço (Texto)
    * Telefone (Apenas números)
    * CPF (Apenas números)
    * Serviço de Despachante (Lista de Seleção)
    * Observações (Texto longo)
    * Upload de Imagens (Funcionalidade de upload).
4.  **FR4:** A lista de seleção "Serviço de Despachante" deve ser pré-populada com as 21 opções fornecidas (ex: "2ª via de CRAF", "Apostilamento (Caça/Colecionador)", etc.).
5.  **FR5:** O sistema deve permitir que um administrador gerencie (adicione/edite/remova) as opções na lista de "Serviço de Despachante".
6.  **FR6:** Os "Serviços de Despachante" devem ter os seguintes status gerenciáveis: "Criado" (padrão), "Em Análise", "Deferido", "Indeferido".
7.  **FR7:** O formulário de criação de "Ordem de Serviço" existente deve ser modificado para incluir um novo campo "Telefone".
8.  **FR8:** A funcionalidade de geração de PDF existente deve ser modificada para incluir duas linhas de assinatura no final do documento: uma para "Cliente" e uma para "Conarmas".

### 2.2. Não Funcional (NFR)
* **NFR1:** O desempenho do dashboard deve permanecer rápido, mesmo ao carregar os dados dos dois módulos (O.S. e Despachante).
* **NFR2:** O novo fluxo de Despachante deve reutilizar os componentes de UI existentes (como Botões, Cards, Inputs, etc.) para manter a consistência visual.
* **NFR3:** A lista de "Serviços de Despachante" (FR4/FR5) deve ser armazenada no banco de dados (provavelmente uma nova tabela `dispatch_service_types`) para permitir gerenciamento.

### 2.3. Requisitos de Compatibilidade (CR)
* **CR1:** A funcionalidade existente de Ordens de Serviço (listagem, edição, geração de PDF) deve continuar funcionando sem regressões.
* **CR2:** O novo fluxo de "Serviços de Despachante" exigirá uma nova tabela no Supabase (ex: `dispatch_services`) e não deve interferir na tabela `service_orders` existente.
* **CR3:** O sistema de autenticação e os tipos de banco de dados devem ser reutilizados.

## 3. Metas de UI (Interface do Usuário)

### 3.1. Integração com a UI Existente
A nova funcionalidade de "Serviços de Despachante" deve integrar-se perfeitamente à UI existente (baseada em `shadcn/ui` e Tailwind). A navegação principal será movida para um **Menu Lateral** (provavelmente uma atualização do `Sidebar` existente), que permitirá ao usuário alternar entre os contextos de "Ordens de Serviço" e "Serviços de Despachante".

### 3.2. Telas Modificadas/Novas
* **Telas Modificadas:**
    * `App.tsx` / Layout Principal: Para implementar o novo Menu Lateral de navegação principal.
    * `Dashboard.tsx`: Será a tela padrão para "Ordens de Serviço".
    * `NewServiceOrder.tsx`: Para adicionar o campo "Telefone".
    * Geração de PDF (função Supabase ou biblioteca de PDF): Para adicionar as linhas de assinatura.
* **Telas Novas:**
    * `DashboardDispatchServices.tsx` (ou similar): A nova tela de listagem/dashboard para "Serviços de Despachante".
    * `NewDispatchService.tsx`: Novo formulário para FR3.
    * `EditDispatchService.tsx`: Novo formulário de edição para FR2.
    * `DispatchServiceDetails.tsx`: Nova visualização de detalhes para FR2.
    * `AdminDispatchServiceTypes.tsx` (ou similar): Uma nova tela de administração para FR5.

### 3.3. Requisitos de Consistência de UI
* A UI deve reutilizar rigorosamente os componentes `shadcn/ui` existentes encontrados em `src/components/ui`.
* A paleta de cores, tipografia e espaçamento devem seguir o `tailwind.config.ts` e `index.css`.
* O novo formulário de Despachante deve ter um layout e comportamento semelhantes ao formulário de O.S. existente, incluindo validação e feedback de upload.

## 4. Restrições Técnicas e Requisitos de Integração

### 4.1. Stack de Tecnologia Existente
* **Frontend:** React 18.2.0 com Vite 5.3.1.
* **Linguagem:** TypeScript 5.2.2.
* **UI:** `tailwindcss` e `shadcn/ui` (inferido de `src/components/ui` e `components.json`).
* **Backend & DB:** Supabase (inferido de `config.toml`, `client.ts`, `functions/`, `migrations/`).
* **Validação:** `zod` e `react-hook-form`.

### 4.2. Abordagem de Integração
* **Banco de Dados:** A funcionalidade de Despachante exigirá novas tabelas no Supabase (ex: `dispatch_services` para FR2, `dispatch_service_types` para NFR3). Essas tabelas devem ser adicionadas usando o sistema de migração do Supabase em `supabase/migrations/`.
* **API:** As novas funcionalidades devem reutilizar o cliente Supabase existente. Funções de upload de arquivos devem ser adaptadas ou duplicadas para o fluxo de Despachante.
* **Frontend:** A navegação principal será centralizada em um Menu Lateral (Sidebar), modificando o layout raiz em `App.tsx`.
* **Testes:** A validação de formulário para os novos campos (FR3, FR7) deve usar `zod`, seguindo o padrão existente em `src/lib/validations.ts`.

### 4.3. Organização de Código e Padrões
* **Estrutura de Pastas:** O novo código deve seguir a estrutura existente:
    * Novas páginas em `src/pages/` (ex: `NewDispatchService.tsx`).
    * Novas validações em `src/lib/validations.ts`.
    * Novas migrações em `supabase/migrations/`.
    * Novas funções de backend em `supabase/functions/`.
* **Padrões:** Reutilizar componentes `shadcn/ui` e seguir os padrões de linting e Tailwind definidos.

### 4.4. Implantação e Operações
* **Backend:** Novas tabelas e funções devem ser implantadas via migrações e CLI do Supabase.
* **Frontend:** A implantação do frontend (Vite) permanece inalterada.

### 4.5. Avaliação de Risco e Mitigação
* **Risco Técnico (Alto):** Reutilização de código. Os formulários de O.S. e Despachante (FR3) são muito semelhantes.
    * **Mitigação:** O Arquiteto deve projetar um componente de formulário genérico (`<ServiceForm />`) que possa ser reutilizado por ambas as telas, em vez de duplicar a lógica.
* **Risco de Performance (Médio):** O dashboard principal (FR1) precisará carregar dados de duas tabelas (`service_orders` e `dispatch_services`).
    * **Mitigação:** O Arquiteto deve planejar paginação ou carregamento assíncrono (lazy loading) para garantir que o NFR1 seja atendido.
* **Risco de Dados (Médio):** A criação da tabela `dispatch_service_types` (NFR3) e `dispatch_services` (CR2) deve ser feita via migrações SQL para garantir consistência entre ambientes.

## 5. Estrutura de Épicos e Histórias

### 5.1. Abordagem do Épico
**Decisão da Estrutura do Épico**: Para esta melhoria brownfield, usaremos um **Único Épico**.

**Justificativa**: Todos os requisitos (FR1-FR8) fazem parte de uma única iniciativa de melhoria (a divisão da UI, o novo módulo de Despachante e as atualizações da O.S.). Agrupá-los em um único épico garante que a implementação seja coesa e que o valor só seja entregue quando todas as partes estiverem funcionando juntas.

## 6. Épico 1: Melhoria de Módulos (Despachante e O.S.)

**Objetivo do Épico**: Expandir o sistema para incluir o gerenciamento de Serviços de Despachante, melhorar a UI de navegação e aprimorar o fluxo existente de Ordens de Serviço (O.S.).

**Requisitos de Integração**: Requer a criação de novas tabelas no Supabase, modificação da navegação principal da UI e reutilização de componentes de UI `shadcn`.

### História 1.1: Configuração do Backend (Novas Tabelas)
Como Arquiteto, eu quero criar as novas tabelas de banco de dados no Supabase para "Serviços de Despachante" e "Tipos de Serviço de Despachante", para que os dados possam ser armazenados (NFR3, CR2).

* **Critérios de Aceitação (AC):**
    1.  Um novo arquivo de migração SQL é criado em `supabase/migrations/`.
    2.  Uma nova tabela `dispatch_services` é criada, contendo colunas para os campos do FR3 (nome, endereço, telefone, cpf, observações, etc.).
    3.  Uma nova tabela `dispatch_service_types` é criada (colunas: id, nome_servico).
    4.  A tabela `dispatch_service_types` é populada com as 21 opções iniciais (FR4).
* **Verificação de Integração (IV):**
    1.  A nova migração é executada sem afetar a tabela `service_orders`.
    2.  Os tipos de dados do Supabase são atualizados para incluir as novas tabelas.

### História 1.2: Melhorias na O.S. (Telefone e PDF)
Como funcionário da Conarmas, eu quero adicionar o campo "Telefone" ao criar uma O.S. (FR7) e ter linhas de "Assinatura" no PDF (FR8), para melhorar a coleta de dados e a formalidade.

* **Critérios de Aceitação (AC):**
    1.  O formulário `NewServiceOrder.tsx` é atualizado com um campo "Telefone".
    2.  O campo "Telefone" é salvo na tabela `service_orders` (requer modificação na migração e validação).
    3.  A função de geração de PDF é atualizada para incluir duas linhas de assinatura no final.
* **Verificação de Integração (IV):**
    1.  O formulário de edição (`EditServiceOrder.tsx`) também deve refletir o campo "Telefone".
    2.  A adição do campo não deve afetar O.S. antigas.

### História 1.3: Atualização da Navegação Principal (Menu Lateral)
Como usuário, eu quero ver um Menu Lateral claro que me permita navegar entre "Ordens de Serviço" e "Serviços de Despachante" (FR1).

* **Critérios de Aceitação (AC):**
    1.  O `App.tsx` e/ou o layout principal é modificado para incluir um `Sidebar` persistente.
    2.  O Menu Lateral tem dois links principais: "Ordens de Serviço" (apontando para `/`) e "Serviços de Despachante" (apontando para `/despachante`).
    3.  O `Dashboard.tsx` existente funciona como a rota principal (`/`).
* **Verificação de Integração (IV):**
    1.  A navegação existente (Configurações, Sair) deve ser integrada ao novo Menu Lateral.

### História 1.4: Fluxo CRUD de Serviços de Despachante (Frontend)
Como funcionário da Conarmas, eu quero Criar, Ler, Atualizar e Excluir Serviços de Despachante no novo módulo (FR2, FR3, FR6).

* **Critérios de Aceitação (AC):**
    1.  Uma nova rota (`/despachante`) é criada, mostrando uma listagem (datagrid ou cards) de todos os `dispatch_services`.
    2.  Uma nova rota (`/despachante/novo`) renderiza o formulário `NewDispatchService.tsx` com os campos do FR3.
    3.  O campo "Serviço de Despachante" (FR3) busca dinamicamente suas opções da tabela `dispatch_service_types` (NFR3).
    4.  O formulário usa `zod` para validação (Telefone e CPF como numéricos/string numérica).
    5.  O componente `FileUpload` é reutilizado para uploads (FR3).
    6.  O status inicial é "Criado". O usuário pode editar o status (Em Análise, Deferido, Indeferido) na tela de edição/detalhes (FR6).
* **Verificação de Integração (IV):**
    1.  O formulário reutiliza os componentes de `src/components/ui`.
    2.  O fluxo de dados (leitura/escrita) para as tabelas `dispatch_services` funciona corretamente.

### História 1.5: Gerenciamento de Tipos de Serviço de Despachante (Admin)
Como Administrador, eu quero uma tela para adicionar, editar ou remover os serviços oferecidos no formulário de Despachante (FR5).

* **Critérios de Aceitação (AC):**
    1.  Uma nova rota (ex: `/configuracoes/despachante` ou um link no Menu Lateral) leva à tela de gerenciamento.
    2.  A tela permite ao usuário ver a lista atual de `dispatch_service_types`.
    3.  O usuário pode adicionar um novo tipo de serviço.
    4.  O usuário pode editar o nome de um tipo de serviço existente.
    5.  O usuário pode excluir um tipo de serviço.
* **Verificação de Integração (IV):**
    1.  Mudanças feitas nesta tela devem ser refletidas imediatamente no dropdown do formulário `NewDispatchService.tsx` (FR3/FR4).