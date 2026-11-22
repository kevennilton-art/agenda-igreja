import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const statusEl = document.getElementById("status");

onAuthStateChanged(
  auth,
  (user) => {
    statusEl.textContent = user
      ? "Logada como " + user.email
      : "Firebase conectado. Próximo passo: tela de login.";
  },
  (erro) => {
    statusEl.textContent = "Erro ao conectar: " + erro.message;
  }
);
