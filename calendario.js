const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function paraIso(data) {
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${m}-${d}`;
}

export function deIso(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
}

/**
 * Desenha um calendário mensal dentro de `container`.
 * - aoSelecionar(iso): chamado quando um dia é selecionado
 * - aoMudarMes(ano, mes): chamado quando o mês exibido muda (mes: 0 a 11)
 */
export function criarCalendario(container, { aoSelecionar, aoMudarMes } = {}) {
  const hoje = new Date();
  let ano = hoje.getFullYear();
  let mes = hoje.getMonth();
  let selecionado = paraIso(hoje);
  let marcados = new Set();

  function mudarMes(delta) {
    mes += delta;
    if (mes < 0) { mes = 11; ano -= 1; }
    if (mes > 11) { mes = 0; ano += 1; }
    selecionado =
      ano === hoje.getFullYear() && mes === hoje.getMonth()
        ? paraIso(hoje)
        : paraIso(new Date(ano, mes, 1));
    desenhar();
    if (aoSelecionar) aoSelecionar(selecionado);
    if (aoMudarMes) aoMudarMes(ano, mes);
  }

  function desenhar() {
    container.textContent = "";

    const nav = document.createElement("div");
    nav.className = "cal-nav";

    const anterior = document.createElement("button");
    anterior.type = "button";
    anterior.textContent = "‹";
    anterior.setAttribute("aria-label", "Mês anterior");
    anterior.addEventListener("click", () => mudarMes(-1));

    const titulo = document.createElement("strong");
    titulo.textContent = `${MESES[mes]} ${ano}`;

    const proximo = document.createElement("button");
    proximo.type = "button";
    proximo.textContent = "›";
    proximo.setAttribute("aria-label", "Próximo mês");
    proximo.addEventListener("click", () => mudarMes(1));

    nav.append(anterior, titulo, proximo);

    const grade = document.createElement("div");
    grade.className = "cal-grade";

    DIAS_SEMANA.forEach((nome) => {
      const cab = document.createElement("div");
      cab.className = "cal-cab";
      cab.textContent = nome;
      grade.append(cab);
    });

    const vazios = new Date(ano, mes, 1).getDay();
    for (let i = 0; i < vazios; i++) {
      grade.append(document.createElement("div"));
    }

    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const hojeIso = paraIso(hoje);

    for (let dia = 1; dia <= totalDias; dia++) {
      const iso = paraIso(new Date(ano, mes, dia));
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "cal-dia";
      botao.textContent = dia;
      if (iso === hojeIso) botao.classList.add("hoje");
      if (iso === selecionado) botao.classList.add("selecionado");
      if (marcados.has(iso)) botao.classList.add("marcado");
      botao.addEventListener("click", () => {
        selecionado = iso;
        desenhar();
        if (aoSelecionar) aoSelecionar(iso);
      });
      grade.append(botao);
    }

    container.append(nav, grade);
  }

  desenhar();
  if (aoSelecionar) aoSelecionar(selecionado);
  if (aoMudarMes) aoMudarMes(ano, mes);

  return {
    marcarDias(conjunto) {
      marcados = new Set(conjunto);
      desenhar();
    },
    getSelecionado() {
      return selecionado;
    }
  };
}
