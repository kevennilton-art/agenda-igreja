import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { criarCalendario, deIso, paraIso } from "./calendario.js";
import { ouvirMes, criarEvento, atualizarEvento, excluirEvento } from "./eventos.js";
import {
  ouvirEspeciais,
  criarEspecial,
  atualizarEspecial,
  excluirEspecial
} from "./especiais.js";
import { montarEditorLinks, criarLinksCartao } from "./anexos.js";

const $ = (id) => document.getElementById(id);

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const PUBLICOS = {
  criancas: "Crianças",
  mulheres: "Mulheres",
  ambos: "Crianças e mulheres"
};

// ---------- Tela de abertura (ovelhinha) ----------
const SPLASH_MIN_MS = 2500;
let splashEscondida = false;

function esconderSplash() {
  const splash = $("splash");
  if (splashEscondida || !splash) return;
  splashEscondida = true;
  // performance.now() = tempo desde que a página começou a abrir
  const falta = Math.max(0, SPLASH_MIN_MS - performance.now());
  setTimeout(() => {
    splash.classList.add("saindo");
    setTimeout(() => splash.remove(), 500);
  }, falta);
}

// ---------- Estado ----------
let usuario = null;
let calendario = null;
let selecionado = paraIso(new Date());
let eventosMes = [];          // aulas do mês exibido
let especiais = [];           // todos os eventos especiais
let mesAtual = { ano: new Date().getFullYear(), mes: new Date().getMonth() };
let pararEscuta = null;
let pararEscutaEsp = null;
let editandoId = null;
let editandoEspId = null;

// ---------- Utilidades ----------
function mostrarMensagem(el, texto, ok = false) {
  el.textContent = texto;
  el.className = ok ? "ok" : "";
}

function traduzirErro(erro) {
  switch (erro.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou senha incorretos.";
    case "auth/invalid-email":
      return "E-mail inválido.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Espere alguns minutos e tente de novo.";
    case "auth/network-request-failed":
      return "Sem conexão com a internet.";
    case "permission-denied":
      return "Sem permissão. Confira as regras do Firestore e o e-mail liberado.";
    default:
      return "Erro: " + erro.message;
  }
}

function formatarCurto(iso) {
  return deIso(iso).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  });
}

// Aviso rápido com a ovelhinha (some sozinho)
function mostrarToast(texto) {
  const antigo = $("toast");
  if (antigo) antigo.remove();
  const toast = document.createElement("div");
  toast.id = "toast";
  toast.setAttribute("role", "status");
  const img = document.createElement("img");
  img.src = "ovelha-cabeca.png";
  img.alt = "";
  const span = document.createElement("span");
  span.textContent = texto;
  toast.append(img, span);
  document.body.append(toast);
  setTimeout(() => toast.remove(), 2400);
}

// Mensagem de "nada por aqui" com a ovelhinha
function criarVazio(texto) {
  const caixa = document.createElement("div");
  caixa.className = "vazio-ovelha";
  const img = document.createElement("img");
  img.src = "ovelha-cabeca.png";
  img.alt = "";
  const p = document.createElement("p");
  p.textContent = texto;
  caixa.append(img, p);
  return caixa;
}

// ---------- Navegação ----------
// nome: qual tela abrir; navAtivo: qual botão da barra fica destacado
function irPara(nome, navAtivo = nome) {
  document.querySelectorAll(".view").forEach((v) => {
    v.hidden = v.id !== "view-" + nome;
  });
  document.querySelectorAll("#barra-nav button").forEach((b) => {
    b.classList.toggle("ativo", b.dataset.view === navAtivo);
  });
  window.scrollTo(0, 0);
}

document.querySelectorAll("#barra-nav button").forEach((b) => {
  b.addEventListener("click", () => {
    if (b.dataset.view === "form") abrirForm(null);
    else irPara(b.dataset.view);
  });
});

// ---------- Nomes (sugestões para professoras e responsáveis) ----------
const CHAVE_NOMES = "mimp-professoras";

function lerNomesSalvos() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_NOMES)) || [];
  } catch (e) {
    return [];
  }
}

function separarNomes(texto) {
  return (texto || "").split(",").map((n) => n.trim()).filter(Boolean);
}

function unicos(lista) {
  const mapa = new Map();
  lista.forEach((n) => {
    if (!mapa.has(n.toLowerCase())) mapa.set(n.toLowerCase(), n);
  });
  return [...mapa.values()];
}

function lembrarNomes(texto) {
  try {
    const todos = unicos([...lerNomesSalvos(), ...separarNomes(texto)]);
    localStorage.setItem(CHAVE_NOMES, JSON.stringify(todos));
  } catch (e) {
    /* sem armazenamento local: as sugestões vêm só dos dados já carregados */
  }
}

function nomesConhecidos() {
  return unicos([
    ...lerNomesSalvos(),
    ...eventosMes.flatMap((e) => separarNomes(e.professoras)),
    ...especiais.flatMap((e) => separarNomes(e.responsaveis))
  ]).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function desenharSugestoes(campoId, caixaId) {
  const campo = $(campoId);
  const caixa = $(caixaId);
  const usados = separarNomes(campo.value).map((n) => n.toLowerCase());
  caixa.textContent = "";
  nomesConhecidos()
    .filter((n) => !usados.includes(n.toLowerCase()))
    .forEach((nome) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = "+ " + nome;
      b.addEventListener("click", () => {
        const atuais = separarNomes(campo.value);
        atuais.push(nome);
        campo.value = atuais.join(", ");
        desenharSugestoes(campoId, caixaId);
      });
      caixa.append(b);
    });
}

// ---------- Cartões: aulas ----------
function criarCartao(ev, comData) {
  const cartao = document.createElement("div");
  cartao.setAttribute("role", "button");
  cartao.tabIndex = 0;
  cartao.className = "cartao" + (ev.realizado ? " feito" : "");

  const titulo = document.createElement("strong");
  titulo.textContent = ev.titulo;

  const meta = document.createElement("span");
  meta.className = "meta";
  const partes = [];
  if (comData) partes.push(formatarCurto(ev.data));
  partes.push(PUBLICOS[ev.publico] || "");
  if (ev.realizado) partes.push("✓ Realizada");
  meta.textContent = partes.filter(Boolean).join(" · ");

  cartao.append(titulo);
  if (ev.professoras) {
    const prof = document.createElement("span");
    prof.className = "meta";
    prof.textContent = "Professora(s): " + ev.professoras;
    cartao.append(prof);
  }
  cartao.append(meta);
  const links = criarLinksCartao(ev);
  if (links) cartao.append(links);
  cartao.addEventListener("click", () => abrirForm(ev));
  cartao.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      abrirForm(ev);
    }
  });
  return cartao;
}

function preencherLista(container, lista, comData, vazio) {
  container.textContent = "";
  if (lista.length === 0) {
    container.append(criarVazio(vazio));
    return;
  }
  lista.forEach((ev) => container.append(criarCartao(ev, comData)));
}

// ---------- Cartões: eventos especiais ----------
function porDataHora(a, b) {
  return (a.data + (a.hora || "")).localeCompare(b.data + (b.hora || ""));
}

function criarCartaoEspecial(ev, comData) {
  const cartao = document.createElement("div");
  cartao.setAttribute("role", "button");
  cartao.tabIndex = 0;
  cartao.className = "cartao especial";

  const titulo = document.createElement("strong");
  titulo.textContent = ev.titulo;
  cartao.append(titulo);

  const quando = [];
  if (comData) quando.push(formatarCurto(ev.data));
  if (ev.hora) quando.push(ev.hora);
  if (quando.length) {
    const q = document.createElement("span");
    q.className = "meta destaque";
    q.textContent = quando.join(" · ");
    cartao.append(q);
  }

  [
    ["Local: ", ev.local],
    ["Responsável(is): ", ev.responsaveis]
  ].forEach(([rotulo, valor]) => {
    if (!valor) return;
    const s = document.createElement("span");
    s.className = "meta";
    s.textContent = rotulo + valor;
    cartao.append(s);
  });

  if (ev.descricao) {
    const d = document.createElement("span");
    d.className = "meta resumo";
    d.textContent =
      ev.descricao.length > 110 ? ev.descricao.slice(0, 110).trim() + "…" : ev.descricao;
    cartao.append(d);
  }

  const links = criarLinksCartao(ev);
  if (links) cartao.append(links);
  cartao.addEventListener("click", () => abrirFormEspecial(ev));
  cartao.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      abrirFormEspecial(ev);
    }
  });
  return cartao;
}

// ---------- Telas ----------
function renderDia() {
  $("dia-titulo").textContent = deIso(selecionado).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const doDia = eventosMes.filter((e) => e.data === selecionado);
  preencherLista($("dia-eventos"), doDia, false, "Nenhuma aula neste dia.");

  const espDoDia = especiais.filter((e) => e.data === selecionado).sort(porDataHora);
  $("dia-especiais-bloco").hidden = espDoDia.length === 0;
  $("dia-especiais").textContent = "";
  espDoDia.forEach((e) => $("dia-especiais").append(criarCartaoEspecial(e, false)));
}

function renderLista() {
  $("lista-titulo").textContent = `${MESES[mesAtual.mes]} ${mesAtual.ano}`;
  preencherLista($("lista-mes"), eventosMes, true, "Nenhuma aula neste mês.");
}

function renderEspeciais() {
  const hoje = paraIso(new Date());
  const proximos = especiais.filter((e) => e.data >= hoje).sort(porDataHora);
  const passados = especiais.filter((e) => e.data < hoje).sort(porDataHora).reverse();

  const boxProx = $("esp-proximos");
  boxProx.textContent = "";
  if (proximos.length === 0) {
    boxProx.append(criarVazio("Nenhum evento especial por vir."));
  } else {
    proximos.forEach((e) => boxProx.append(criarCartaoEspecial(e, true)));
  }

  $("esp-passados-bloco").hidden = passados.length === 0;
  const boxPas = $("esp-passados");
  boxPas.textContent = "";
  passados.forEach((e) => boxPas.append(criarCartaoEspecial(e, true)));
}

function renderTudo() {
  renderDia();
  renderLista();
  renderEspeciais();
  if (calendario) {
    calendario.marcarDias(
      eventosMes.map((e) => e.data),
      especiais.map((e) => e.data)
    );
  }
}

// ---------- Firestore (tempo real) ----------
function escutar(ano, mes) {
  mesAtual = { ano, mes };
  if (pararEscuta) pararEscuta();
  pararEscuta = ouvirMes(
    ano,
    mes,
    (lista) => {
      eventosMes = lista;
      $("aviso-eventos").textContent = "";
      renderTudo();
    },
    (erro) => {
      $("aviso-eventos").textContent = "Erro ao carregar aulas: " + traduzirErro(erro);
    }
  );
}

function escutarEspeciais() {
  if (pararEscutaEsp) pararEscutaEsp();
  pararEscutaEsp = ouvirEspeciais(
    (lista) => {
      especiais = lista;
      $("aviso-especiais").textContent = "";
      renderTudo();
    },
    (erro) => {
      $("aviso-especiais").textContent =
        erro.code === "permission-denied"
          ? "Sem permissão para os eventos especiais. Atualize as regras do Firestore (coleção \"especiais\")."
          : "Erro ao carregar eventos: " + traduzirErro(erro);
    }
  );
}

function iniciarCalendario() {
  escutarEspeciais();
  if (calendario) {
    escutar(mesAtual.ano, mesAtual.mes);
    return;
  }
  calendario = criarCalendario($("calendario"), {
    aoSelecionar: (iso) => {
      selecionado = iso;
      renderDia();
    },
    aoMudarMes: (ano, mes) => escutar(ano, mes)
  });
}

// ---------- Anexos por link (YouTube e Drive) ----------
const editorAula = montarEditorLinks({
  videos: $("lista-videos"),
  addVideo: $("add-video"),
  arquivos: $("lista-arquivos"),
  addArquivo: $("add-arquivo")
});
const editorEsp = montarEditorLinks({
  videos: $("lista-videos-esp"),
  addVideo: $("add-video-esp"),
  arquivos: $("lista-arquivos-esp"),
  addArquivo: $("add-arquivo-esp")
});

// ---------- Formulário da aula ----------
function abrirForm(ev) {
  editandoId = ev ? ev.id : null;
  $("form-titulo").textContent = ev ? "Editar aula" : "Nova aula";
  $("ev-data").value = ev ? ev.data : selecionado;
  $("ev-titulo").value = ev ? ev.titulo : "";
  $("ev-professoras").value = ev ? ev.professoras || "" : "";
  $("ev-publico").value = ev ? ev.publico || "ambos" : "criancas";
  $("ev-descricao").value = ev ? ev.descricao || "" : "";
  $("ev-materiais").value = ev ? ev.materiais || "" : "";
  $("ev-feito").value = ev ? ev.feito || "" : "";
  $("ev-observacoes").value = ev ? ev.observacoes || "" : "";
  $("ev-realizado").checked = ev ? !!ev.realizado : false;
  $("btn-excluir").hidden = !ev;
  mostrarMensagem($("form-msg"), "");
  desenharSugestoes("ev-professoras", "sugestoes-professoras");
  editorAula.carregar(ev ? ev.videos : [], ev ? ev.arquivos : []);
  irPara("form");
}

$("form-evento").addEventListener("submit", async (e) => {
  e.preventDefault();
  const dados = {
    data: $("ev-data").value,
    titulo: $("ev-titulo").value.trim(),
    professoras: separarNomes($("ev-professoras").value).join(", "),
    publico: $("ev-publico").value,
    descricao: $("ev-descricao").value.trim(),
    materiais: $("ev-materiais").value.trim(),
    feito: $("ev-feito").value.trim(),
    observacoes: $("ev-observacoes").value.trim(),
    realizado: $("ev-realizado").checked
  };
  if (!dados.data || !dados.titulo) return;
  const anexos = editorAula.ler();
  if (anexos.erro) {
    mostrarMensagem($("form-msg"), anexos.erro);
    return;
  }
  dados.videos = anexos.videos;
  dados.arquivos = anexos.arquivos;
  lembrarNomes(dados.professoras);

  $("btn-salvar").disabled = true;
  try {
    if (editandoId) await atualizarEvento(editandoId, dados, usuario.email);
    else await criarEvento(dados, usuario.email);
    irPara("calendario");
    mostrarToast("Aula salva!");
  } catch (erro) {
    mostrarMensagem($("form-msg"), traduzirErro(erro));
  } finally {
    $("btn-salvar").disabled = false;
  }
});

$("btn-cancelar").addEventListener("click", () => irPara("calendario"));

$("btn-excluir").addEventListener("click", async () => {
  if (!editandoId) return;
  if (!confirm("Excluir esta aula? As duas vão deixar de vê-la.")) return;
  try {
    await excluirEvento(editandoId);
    irPara("calendario");
    mostrarToast("Aula excluída.");
  } catch (erro) {
    mostrarMensagem($("form-msg"), traduzirErro(erro));
  }
});

$("btn-novo-dia").addEventListener("click", () => abrirForm(null));
$("ev-professoras").addEventListener("input", () =>
  desenharSugestoes("ev-professoras", "sugestoes-professoras")
);

// ---------- Formulário do evento especial ----------
function abrirFormEspecial(ev, dataPadrao) {
  editandoEspId = ev ? ev.id : null;
  $("esp-form-titulo").textContent = ev ? "Editar evento especial" : "Novo evento especial";
  $("es-data").value = ev ? ev.data : dataPadrao || selecionado;
  $("es-hora").value = ev ? ev.hora || "" : "";
  $("es-titulo").value = ev ? ev.titulo : "";
  $("es-descricao").value = ev ? ev.descricao || "" : "";
  $("es-local").value = ev ? ev.local || "" : "";
  $("es-responsaveis").value = ev ? ev.responsaveis || "" : "";
  $("es-observacoes").value = ev ? ev.observacoes || "" : "";
  $("btn-excluir-esp").hidden = !ev;
  mostrarMensagem($("form-esp-msg"), "");
  desenharSugestoes("es-responsaveis", "sugestoes-responsaveis");
  editorEsp.carregar(ev ? ev.videos : [], ev ? ev.arquivos : []);
  irPara("form-esp", "especiais");
}

$("form-especial").addEventListener("submit", async (e) => {
  e.preventDefault();
  const dados = {
    data: $("es-data").value,
    hora: $("es-hora").value,
    titulo: $("es-titulo").value.trim(),
    descricao: $("es-descricao").value.trim(),
    local: $("es-local").value.trim(),
    responsaveis: separarNomes($("es-responsaveis").value).join(", "),
    observacoes: $("es-observacoes").value.trim()
  };
  if (!dados.data || !dados.titulo) return;
  const anexos = editorEsp.ler();
  if (anexos.erro) {
    mostrarMensagem($("form-esp-msg"), anexos.erro);
    return;
  }
  dados.videos = anexos.videos;
  dados.arquivos = anexos.arquivos;
  lembrarNomes(dados.responsaveis);

  $("btn-salvar-esp").disabled = true;
  try {
    if (editandoEspId) await atualizarEspecial(editandoEspId, dados, usuario.email);
    else await criarEspecial(dados, usuario.email);
    irPara("especiais");
    mostrarToast("Evento salvo!");
  } catch (erro) {
    mostrarMensagem($("form-esp-msg"), traduzirErro(erro));
  } finally {
    $("btn-salvar-esp").disabled = false;
  }
});

$("btn-cancelar-esp").addEventListener("click", () => irPara("especiais"));

$("btn-excluir-esp").addEventListener("click", async () => {
  if (!editandoEspId) return;
  if (!confirm("Excluir este evento? As duas vão deixar de vê-lo.")) return;
  try {
    await excluirEspecial(editandoEspId);
    irPara("especiais");
    mostrarToast("Evento excluído.");
  } catch (erro) {
    mostrarMensagem($("form-esp-msg"), traduzirErro(erro));
  }
});

$("btn-novo-especial").addEventListener("click", () => abrirFormEspecial(null));
$("btn-novo-esp-dia").addEventListener("click", () => abrirFormEspecial(null, selecionado));
$("es-responsaveis").addEventListener("input", () =>
  desenharSugestoes("es-responsaveis", "sugestoes-responsaveis")
);

// ---------- Login ----------
const emailInput = $("email");
const senhaInput = $("senha");

$("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  mostrarMensagem($("mensagem"), "");
  $("btn-entrar").disabled = true;
  try {
    await signInWithEmailAndPassword(auth, emailInput.value.trim(), senhaInput.value);
    senhaInput.value = "";
  } catch (erro) {
    mostrarMensagem($("mensagem"), traduzirErro(erro));
  } finally {
    $("btn-entrar").disabled = false;
  }
});

$("btn-esqueci").addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!email) {
    mostrarMensagem(
      $("mensagem"),
      "Digite seu e-mail acima e toque em \"Esqueci minha senha\" de novo."
    );
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    mostrarMensagem(
      $("mensagem"),
      "Enviamos um link para redefinir a senha. Confira o e-mail (e o spam).",
      true
    );
  } catch (erro) {
    mostrarMensagem($("mensagem"), traduzirErro(erro));
  }
});

$("btn-sair").addEventListener("click", () => signOut(auth));

onAuthStateChanged(
  auth,
  (user) => {
    usuario = user;
    $("carregando").hidden = true;
    if (user) {
      $("tela-login").hidden = true;
      $("tela-app").hidden = false;
      $("barra-nav").hidden = false;
      $("usuario-email").textContent = user.email;
      irPara("calendario");
      iniciarCalendario();
    } else {
      if (pararEscuta) {
        pararEscuta();
        pararEscuta = null;
      }
      if (pararEscutaEsp) {
        pararEscutaEsp();
        pararEscutaEsp = null;
      }
      eventosMes = [];
      especiais = [];
      $("tela-app").hidden = true;
      $("barra-nav").hidden = true;
      $("tela-login").hidden = false;
    }
    esconderSplash();
  },
  (erro) => {
    $("carregando").textContent = "Erro ao conectar: " + erro.message;
    esconderSplash();
  }
);
