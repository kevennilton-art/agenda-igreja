// Anexos por link: vídeos do YouTube e arquivos do Google Drive (fotos, PDFs...).
// Só links são guardados (poucos bytes), então o app continua leve e rápido.

// Devolve o link completo e válido, "" se vazio, ou null se inválido.
export function normalizarUrl(texto) {
  let t = (texto || "").trim();
  if (!t) return "";
  if (!/^https?:\/\//i.test(t)) t = "https://" + t;
  try {
    const u = new URL(t);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    return u.href;
  } catch (e) {
    return null;
  }
}

function ehYoutube(href) {
  const h = new URL(href).hostname.replace(/^www\./, "").replace(/^m\./, "");
  return (
    h === "youtube.com" ||
    h === "youtu.be" ||
    h === "youtube-nocookie.com" ||
    h.endsWith(".youtube.com")
  );
}

function criarCampo(placeholder, valor, classe) {
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "url";
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;
  input.placeholder = placeholder;
  input.value = valor || "";
  if (classe) input.className = classe;
  return input;
}

function criarBotaoAbrir(campo) {
  const a = document.createElement("a");
  a.className = "abrir";
  a.textContent = "↗";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.setAttribute("aria-label", "Abrir link");
  const atualizar = () => {
    const href = normalizarUrl(campo.value);
    if (href) {
      a.href = href;
      a.hidden = false;
    } else {
      a.removeAttribute("href");
      a.hidden = true;
    }
  };
  campo.addEventListener("input", atualizar);
  atualizar();
  return a;
}

function criarBotaoRemover(linha) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "remover";
  b.textContent = "✕";
  b.setAttribute("aria-label", "Remover");
  b.addEventListener("click", () => linha.remove());
  return b;
}

function criarLinhaVideo(valor) {
  const linha = document.createElement("div");
  linha.className = "linha-link";
  const url = criarCampo("https://youtu.be/...", valor);
  const barra = document.createElement("div");
  barra.className = "linha-url";
  barra.append(url, criarBotaoAbrir(url), criarBotaoRemover(linha));
  linha.append(barra);
  linha.campos = { url };
  return linha;
}

function criarLinhaArquivo(nomeInicial, valor) {
  const linha = document.createElement("div");
  linha.className = "linha-link";
  const nome = criarCampo("Nome (ex.: Atividade em PDF)", nomeInicial, "campo-nome");
  nome.inputMode = "text";
  nome.maxLength = 80;
  nome.autocapitalize = "sentences";
  const url = criarCampo("Link do Google Drive", valor);
  const barra = document.createElement("div");
  barra.className = "linha-url";
  barra.append(url, criarBotaoAbrir(url), criarBotaoRemover(linha));
  linha.append(nome, barra);
  linha.campos = { nome, url };
  return linha;
}

// Liga os campos de anexos de um formulário.
export function montarEditorLinks({ videos, addVideo, arquivos, addArquivo }) {
  addVideo.addEventListener("click", () => {
    const linha = criarLinhaVideo("");
    videos.append(linha);
    linha.campos.url.focus();
  });
  addArquivo.addEventListener("click", () => {
    const linha = criarLinhaArquivo("", "");
    arquivos.append(linha);
    linha.campos.nome.focus();
  });

  return {
    carregar(listaVideos, listaArquivos) {
      videos.textContent = "";
      arquivos.textContent = "";
      (listaVideos || []).forEach((v) => videos.append(criarLinhaVideo(v)));
      (listaArquivos || []).forEach((a) =>
        arquivos.append(criarLinhaArquivo(a.nome, a.url))
      );
    },

    // Devolve { videos, arquivos, erro }. Se houver erro, não deve salvar.
    ler() {
      const outVideos = [];
      const outArquivos = [];
      let erro = null;

      [...videos.children].forEach((linha, i) => {
        if (erro) return;
        const bruto = linha.campos.url.value.trim();
        if (!bruto) return;
        const href = normalizarUrl(bruto);
        if (!href) {
          erro = `Vídeo ${i + 1}: o link não parece válido.`;
        } else if (!ehYoutube(href)) {
          erro = `Vídeo ${i + 1}: cole um link do YouTube (youtube.com ou youtu.be).`;
        } else {
          outVideos.push(href);
        }
      });

      [...arquivos.children].forEach((linha, i) => {
        if (erro) return;
        const nome = linha.campos.nome.value.trim();
        const bruto = linha.campos.url.value.trim();
        if (!bruto && !nome) return;
        if (!bruto) {
          erro = `Arquivo ${i + 1}: falta o link do Drive.`;
          return;
        }
        const href = normalizarUrl(bruto);
        if (!href) {
          erro = `Arquivo ${i + 1}: o link não parece válido.`;
          return;
        }
        outArquivos.push({ nome, url: href });
      });

      return { videos: outVideos, arquivos: outArquivos, erro };
    }
  };
}

function criarChip(href, texto, tipo) {
  const a = document.createElement("a");
  a.className = "link-chip " + tipo;
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = texto;
  // tocar no link abre o anexo, sem abrir o formulário do cartão
  a.addEventListener("click", (e) => e.stopPropagation());
  return a;
}

// Linha de atalhos (vídeos e arquivos) para mostrar dentro do cartão.
export function criarLinksCartao(ev) {
  const videos = (ev.videos || []).filter((u) => normalizarUrl(u));
  const arquivos = (ev.arquivos || []).filter((a) => a && normalizarUrl(a.url));
  if (!videos.length && !arquivos.length) return null;

  const caixa = document.createElement("div");
  caixa.className = "anexos-cartao";
  videos.forEach((u, i) => {
    const rotulo = "▶ Vídeo" + (videos.length > 1 ? " " + (i + 1) : "");
    caixa.append(criarChip(normalizarUrl(u), rotulo, "video"));
  });
  arquivos.forEach((a, i) => {
    caixa.append(criarChip(normalizarUrl(a.url), "📎 " + (a.nome || "Arquivo " + (i + 1)), "arquivo"));
  });
  return caixa;
}
