import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { criarCalendario, deIso, paraIso } from "./calendario.js";
import { ouvirMes, criarEvento, atualizarEvento, excluirEvento } from "./eventos.js";

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

// ---------- Estado ----------
let usuario = null;
let calendario = null;
let selecionado = paraIso(new Date());
let eventosMes = [];
let mesAtual = { ano: new Date().getFullYear(), mes: new Date().getMonth() };
let pararEscuta = null;
let editandoId = null;

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

// ---------- Navegação ----------
function irPara(nome) {
  document.querySelectorAll(".view").forEach((v) => {
    v.hidden = v.id !== "view-" + nome;
  });
  document.querySelectorAll("#barra-nav button").forEach((b) => {
    b.classList.toggle("ativo", b.dataset.view === nome);
  });
  window.scrollTo(0, 0);
}

document.querySelectorAll("#barra-nav button").forEach((b) => {
  b.addEventListener("click", () => {
    if (b.dataset.view === "form") abrirForm(null);
    else irPara(b.dataset.view);
  });
});

// ---------- Cartões e listas ----------
function criarCartao(ev, comData) {
  const cartao = document.createElement("button");
  cartao.type = "button";
  cartao.className = "cartao" + (ev.realizado ? " feito" : "");

  const titulo = document.createElement("strong");
  titulo.textContent = ev.titulo;

  const meta = document.createElement("span");
  meta.className = "meta";
  const partes = [];
  if (comData) partes.push(formatarCurto(ev.data));
  partes.push(PUBLICOS[ev.publico] || "");
  if (ev.realizado) partes.push("✓ Realizado");
  meta.textContent = partes.filter(Boolean).join(" · ");

  cartao.append(titulo, meta);
  cartao.addEventListener("click", () => abrirForm(ev));
  return cartao;
}

function preencherLista(container, lista, comData, vazio) {
  container.textContent = "";
  if (lista.length === 0) {
    const p = document.createElement("p");
    p.className = "vazio";
    p.textContent = vazio;
    container.append(p);
    return;
  }
  lista.forEach((ev) => container.append(criarCartao(ev, comData)));
}

function renderDia() {
  $("dia-titulo").textContent = deIso(selecionado).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const doDia = eventosMes.filter((e) => e.data === selecionado);
  preencherLista($("dia-eventos"), doDia, false, "Nenhum evento neste dia.");
}

function renderLista() {
  $("lista-titulo").textContent = `${MESES[mesAtual.mes]} ${mesAtual.ano}`;
  preencherLista($("lista-mes"), eventosMes, true, "Nenhum evento neste mês.");
}

function renderTudo() {
  renderDia();
  renderLista();
  if (calendario) calendario.marcarDias(eventosMes.map((e) => e.data));
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
      $("aviso-eventos").textContent = "Erro ao carregar eventos: " + traduzirErro(erro);
    }
  );
}

function iniciarCalendario() {
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

// ---------- Formulário de evento ----------
function abrirForm(ev) {
  editandoId = ev ? ev.id : null;
  $("form-titulo").textContent = ev ? "Editar evento" : "Novo evento";
  $("ev-data").value = ev ? ev.data : selecionado;
  $("ev-titulo").value = ev ? ev.titulo : "";
  $("ev-publico").value = ev ? ev.publico || "ambos" : "criancas";
  $("ev-descricao").value = ev ? ev.descricao || "" : "";
  $("ev-materiais").value = ev ? ev.materiais || "" : "";
  $("ev-feito").value = ev ? ev.feito || "" : "";
  $("ev-observacoes").value = ev ? ev.observacoes || "" : "";
  $("ev-realizado").checked = ev ? !!ev.realizado : false;
  $("btn-excluir").hidden = !ev;
  mostrarMensagem($("form-msg"), "");
  irPara("form");
}

$("form-evento").addEventListener("submit", async (e) => {
  e.preventDefault();
  const dados = {
    data: $("ev-data").value,
    titulo: $("ev-titulo").value.trim(),
    publico: $("ev-publico").value,
    descricao: $("ev-descricao").value.trim(),
    materiais: $("ev-materiais").value.trim(),
    feito: $("ev-feito").value.trim(),
    observacoes: $("ev-observacoes").value.trim(),
    realizado: $("ev-realizado").checked
  };
  if (!dados.data || !dados.titulo) return;

  $("btn-salvar").disabled = true;
  try {
    if (editandoId) await atualizarEvento(editandoId, dados, usuario.email);
    else await criarEvento(dados, usuario.email);
    irPara("calendario");
  } catch (erro) {
    mostrarMensagem($("form-msg"), traduzirErro(erro));
  } finally {
    $("btn-salvar").disabled = false;
  }
});

$("btn-cancelar").addEventListener("click", () => irPara("calendario"));

$("btn-excluir").addEventListener("click", async () => {
  if (!editandoId) return;
  if (!confirm("Excluir este evento? As duas vão deixar de vê-lo.")) return;
  try {
    await excluirEvento(editandoId);
    irPara("calendario");
  } catch (erro) {
    mostrarMensagem($("form-msg"), traduzirErro(erro));
  }
});

$("btn-novo-dia").addEventListener("click", () => abrirForm(null));

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
      eventosMes = [];
      $("tela-app").hidden = true;
      $("barra-nav").hidden = true;
      $("tela-login").hidden = false;
    }
  },
  (erro) => {
    $("carregando").textContent = "Erro ao conectar: " + erro.message;
  }
);
