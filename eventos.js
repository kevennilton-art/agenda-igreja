import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const colecao = collection(db, "eventos");

// Escuta em tempo real os eventos de um mês (mes: 0 a 11).
// Devolve uma função para parar de escutar.
export function ouvirMes(ano, mes, aoMudar, aoErro) {
  const prefixo = `${ano}-${String(mes + 1).padStart(2, "0")}`;
  const q = query(
    colecao,
    where("data", ">=", `${prefixo}-01`),
    where("data", "<=", `${prefixo}-31`),
    orderBy("data")
  );
  return onSnapshot(
    q,
    (snap) => aoMudar(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    aoErro
  );
}

export function criarEvento(dados, email) {
  return addDoc(colecao, {
    ...dados,
    criadoPor: email,
    atualizadoPor: email,
    atualizadoEm: serverTimestamp()
  });
}

export function atualizarEvento(id, dados, email) {
  return updateDoc(doc(db, "eventos", id), {
    ...dados,
    atualizadoPor: email,
    atualizadoEm: serverTimestamp()
  });
}

export function excluirEvento(id) {
  return deleteDoc(doc(db, "eventos", id));
}
