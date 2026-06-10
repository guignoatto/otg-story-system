# Como conectar Google Drive no OTG Creative OS

O sistema suporta dois modos:

1. **Drive API privada (recomendado)**: funciona com pastas privadas compartilhadas com uma service account da OTG.
2. **Fallback publico**: funciona apenas quando a pasta do Drive esta publica/compartilhavel por link.

## Modo recomendado: service account

### 1. Criar projeto no Google Cloud

1. Acesse o Google Cloud Console.
2. Crie ou selecione um projeto da OTG.
3. Ative a **Google Drive API**.
4. Crie uma **Service Account**.
5. Gere uma chave JSON para essa service account.

### 2. Configurar credencial no backend

Voce pode usar um destes dois caminhos.

Opcao A: arquivo JSON local

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/caminho/para/service-account.json"
```

No MVP local, o jeito mais simples e criar um arquivo:

```text
backend/.env
```

Com este conteudo:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/service-account.json
```

O arquivo `ABRIR_MVP.command` carrega `backend/.env` automaticamente ao iniciar.

Opcao B: JSON inteiro em variavel de ambiente

```bash
export GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account", ...}'
```

Para uso local no Mac, a opcao A costuma ser mais simples.

### 3. Compartilhar a pasta do cliente

1. Abra a pasta do cliente no Google Drive.
2. Clique em compartilhar.
3. Adicione o e-mail da service account, algo como:

```text
nome-da-conta@projeto.iam.gserviceaccount.com
```

4. Permissao suficiente: **Leitor/Viewer**.

### 4. Usar no sistema

1. Cole o link da pasta no campo **Pasta de midias do restaurante**.
2. Clique em **Importar do Drive**.
3. O sistema baixa imagens e videos para a biblioteca local do cliente.
4. Depois clique em **Gerar pacote**.

## Onde as midias ficam salvas

As midias importadas ficam em:

```text
/Users/pedrootto/Documents/New project/otg-story-system/uploads/{cliente}/
```

## Novo fluxo recomendado: catalogo antes de baixar

Com a **Drive API privada** conectada, o sistema pode listar a pasta do cliente sem baixar
as fotos e videos pesados.

Fluxo ideal:

1. Cole o link da pasta do cliente.
2. Clique em **Ver catalogo do Drive**.
3. O sistema lista imagens e videos por nome, tamanho, data e miniatura/link quando o
   Google fornece.
4. Marque apenas os arquivos que parecem bons para a campanha.
5. Clique em **Importar selecionadas**.
6. So esses arquivos selecionados sao baixados para:

```text
/Users/pedrootto/Documents/New project/otg-story-system/uploads/{cliente}/
```

Isso evita baixar a pasta inteira de cada cliente e deixa a operacao mais leve.

> Importante: esse catalogo seletivo exige service account. O modo publico/fallback
> com `gdown` nao consegue navegar com a mesma seguranca sem baixar a pasta.

## O que o sistema importa

- Imagens (`image/*`)
- Videos (`video/*`)
- Arquivos dentro da pasta principal
- Arquivos dentro de subpastas ate 2 niveis

No botao antigo **Importar do Drive**, por padrao o sistema importa ate 12 arquivos por
clique, priorizando imagens. No novo fluxo seletivo, voce escolhe os arquivos antes.

## Diagnostico rapido

Na interface, abaixo do campo da pasta, aparece o status:

- **Drive API conectada**: pastas privadas funcionam se estiverem compartilhadas com a service account.
- **Drive privado pendente**: ainda nao ha credencial. Apenas pastas publicas funcionam.

Tambem existe o endpoint:

```bash
curl http://127.0.0.1:8000/v1/drive/status
```

## Erros comuns

### A pasta existe, mas o sistema nao encontra arquivos

Verifique se:

- A pasta foi compartilhada com o e-mail correto da service account.
- Existem imagens ou videos na pasta.
- A pasta nao esta em uma conta sem permissao de compartilhamento externo.

### Funciona no navegador, mas nao no sistema

Isso normalmente significa que voce esta acessando com sua conta pessoal, mas a service account ainda nao tem permissao.

### Quero usar Drive sem service account

Deixe a pasta publica/compartilhavel por link. O sistema tenta usar o fallback antigo com `gdown`.
