<div align="center">
  <h1>🌌 Projeto Observabilidade</h1>
  <p><i>Um laboratório completo de Observabilidade com Node.js, Grafana, Prometheus e Loki</i></p>

  <!-- Status Badges -->
  <a href="https://github.com/c4rlosfb/Observabilidade/actions/workflows/ci.yml"><img src="https://github.com/c4rlosfb/Observabilidade/actions/workflows/ci.yml/badge.svg" alt="CI/CD Pipeline"></a>
</div>

---

## 📖 Sobre o Projeto

Este projeto é um laboratório prático (PoC) focado em **Observabilidade**. Ele demonstra como monitorar métricas, logs e a infraestrutura de uma aplicação web (API Node.js) utilizando a stack completa da Grafana Labs (Loki, Promtail, Grafana) integrada com o Prometheus.

Além disso, o projeto conta com uma automação em **Ansible** para facilitar rotinas e processos.

## 🚀 Arquitetura & Stack Tecnológica

O ambiente é totalmente conteinerizado utilizando o **Docker Compose** e orquestra os seguintes serviços:

*   **🟢 Aplicação Node.js (App):** Uma API construída com Express e `prom-client` para expor métricas customizadas.
*   **📈 Prometheus:** Responsável por coletar (fazer o scraping) e armazenar as métricas da aplicação e do sistema.
*   **💻 Node Exporter:** Coleta métricas a nível de máquina/servidor (CPU, RAM, Disco) e as expõe para o Prometheus.
*   **🪵 Loki:** Sistema de agregação de logs altamente eficiente (inspirado no Prometheus).
*   **🕵️‍♂️ Promtail:** Agente responsável por ler os logs dos containers/Docker e enviá-los para o Loki.
*   **📊 Grafana:** A interface visual para construir dashboards ricos utilizando os dados do Prometheus (métricas) e do Loki (logs).
*   **⚙️ Ansible:** Playbooks para automação da infraestrutura.

---

## 🛠️ Pré-requisitos

Para rodar este projeto na sua máquina, você vai precisar de:

- [Docker](https://docs.docker.com/get-docker/) instalado.
- [Docker Compose](https://docs.docker.com/compose/install/) instalado.
- (Opcional) [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html) para rodar as automações.

---

## 🏃‍♂️ Como Executar

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/SEU_USUARIO/NOME_DO_REPOSITORIO.git
   cd NOME_DO_REPOSITORIO
   ```

2. **Suba a infraestrutura com Docker Compose:**
   ```bash
   docker-compose up -d
   ```
   *O parâmetro `-d` roda os containers em background.*

3. **Verifique se os containers estão rodando:**
   ```bash
   docker-compose ps
   ```

---

## 🌐 Acessando os Serviços

Após subir os containers, os serviços estarão disponíveis nas seguintes portas:

| Serviço | URL de Acesso | Descrição |
| :--- | :--- | :--- |
| **Grafana** | [http://localhost:3000](http://localhost:3000) | Dashboards e visualização (Login padrão: `admin` / `admin`) |
| **Node.js App** | [http://localhost:3001](http://localhost:3001) | A API da aplicação |
| **Prometheus** | [http://localhost:9090](http://localhost:9090) | Interface do Prometheus (Métricas raw) |
| **Loki** | `http://localhost:3100` | Serviço interno de Logs (Acessado via Grafana) |
| **Node Exporter** | `http://localhost:9100` | Serviço interno de métricas da máquina |

---

## 📂 Estrutura do Projeto

```text
📦 Projeto Observabilidade
 ┣ 📂 ansible       # Playbooks de automação da infraestrutura
 ┣ 📂 app           # Código fonte da API Node.js, Dockerfile e dependências
 ┣ 📂 grafana       # Configurações de provisionamento (Datasources e Dashboards pré-configurados)
 ┣ 📂 loki          # Arquivos de configuração do banco de logs Loki
 ┣ 📂 prometheus    # Configuração de scraping de métricas (prometheus.yml)
 ┣ 📂 promtail      # Configuração do agente coletor de logs
 ┣ 📜 docker-compose.yml # Orquestração de todos os containers
 ┗ 📜 README.md     # Documentação do projeto
```

---

## 💡 Dicas de Uso

1. **Gerando tráfego:** Acesse a porta `3001` da aplicação e faça algumas requisições na API para gerar logs e métricas.
2. **Visualizando no Grafana:**
   - Acesse `http://localhost:3000`.
   - Se o provisionamento automático funcionar, você já terá os *Data Sources* do Prometheus e Loki configurados.
   - Navegue pela aba de Dashboards para ver as métricas do Node Exporter e da Aplicação.
   - Explore o painel "Explore" e selecione o Loki para fazer consultas de logs usando LogQL.

## 🤝 Contribuindo

Fique à vontade para fazer um **Fork** deste projeto, abrir **Issues** ou enviar **Pull Requests**. Toda contribuição para melhorar os painéis do Grafana, métricas do App ou automações com Ansible é muito bem-vinda!

---
Feito com ☕ e 🐳 para a comunidade DevOps!
