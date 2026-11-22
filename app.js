import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const $ = (id) => document.getElementById(id);

const carregando = $("carregando");
const telaLogin = $("tela-login");
const telaApp = $("tela-app");
const barra = $("usuario-barra");
const emailInput = $("email");
const senhaInput = $("senha");
const mensagem = $("mensagem");
const btnEntrar = $("btn-entrar");

function mostrarMensagem(texto, ok = false) {
  mensagem.textContent = texto;
  mensagem.className = ok ? "ok" : "";
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
    default:
      return "Erro: " + erro.message;
  }
}

$("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  mostrarMensagem("");
  btnEntrar.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, emailInput.value.trim(), senhaInput.value);
    senhaInput.value = "";
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro));
  } finally {
    btnEntrar.disabled = false;
  }
});

$("btn-esqueci").addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!email) {
    mostrarMensagem("Digite seu e-mail acima e toque em \"Esqueci minha senha\" de novo.");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    mostrarMensagem("Enviamos um link para redefinir a senha. Confira o e-mail (e o spam).", true);
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro));
  }
});

$("btn-sair").addEventListener("click", () => signOut(auth));

onAuthStateChanged(
  auth,
  (user) => {
    carregando.hidden = true;
    if (user) {
      telaLogin.hidden = true;
      telaApp.hidden = false;
      barra.hidden = false;
      $("usuario-email").textContent = user.email;
    } else {
      telaApp.hidden = true;
      barra.hidden = true;
      telaLogin.hidden = false;
    }
  },
  (erro) => {
    carregando.textContent = "Erro ao conectar: " + erro.message;
  }
);
