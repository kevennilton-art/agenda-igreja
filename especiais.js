import { db } from "./firebase.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Eventos especiais ficam numa coleção separada das aulas do dia a dia.
const colecao = collection(db, "especiais");

// Escuta em tempo real todos os eventos especiais (são poucos por ano).
// Devolve uma função para parar de escutar.
export function ouvirEspeciais(aoMudar, aoErro) {
  const q = query(colecao, orderBy("data"));
  return onSnapshot(
    q,
    (snap) => aoMudar(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    aoErro
  );
}

export function criarEspecial(dados, email) {
  return addDoc(colecao, {
    ...dados,
    criadoPor: email,
    atualizadoPor: email,
    atualizadoEm: serverTimestamp()
  });
}

export function atualizarEspecial(id, dados, email) {
  return updateDoc(doc(db, "especiais", id), {
    ...dados,
    atualizadoPor: email,
    atualizadoEm: serverTimestamp()
  });
}

export function excluirEspecial(id) {
  return deleteDoc(doc(db, "especiais", id));
}
