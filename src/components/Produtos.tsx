import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Search,
  Package,
  PackagePlus,
  X,
  TrendingDown,
  DollarSign,
  Boxes,
  Tag,
} from "lucide-react";
import { supabase } from "../supabase";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./ui/toast";

type Produto = {
  id: number;
  nome: string;
  categoria: string | null;
  unidade: string;
  preco_custo: number;
  preco_venda: number;
  estoque: number;
  estoque_minimo: number;
  codigo: string | null;
  fornecedor: string | null;
  user_id: string;
  created_at?: string;
};

function formatarMoeda(valor: number) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarInputMoeda(valor: number) {
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte string formatada em moeda ("1.234,56") em número (1234.56).
 */
function converterNumero(valor: string): number {
  return Number(valor.replace(/\./g, "").replace(",", "."));
}

/**
 * Máscara monetária: ao digitar "1234", vira "12,34"; "123456" vira "1.234,56".
 */
function mascaraMoeda(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  if (!digitos) return "";
  const numero = Number(digitos) / 100;
  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Máscara de estoque: aceita números com até 3 casas decimais (ex: 1.5, 0.250).
 */
function mascaraNumero(valor: string): string {
  const limpo = valor.replace(/[^\d,]/g, "");
  const partes = limpo.split(",");
  if (partes.length > 2) return `${partes[0]},${partes.slice(1).join("").slice(0, 3)}`;
  if (partes[1] && partes[1].length > 3) {
    return `${partes[0]},${partes[1].slice(0, 3)}`;
  }
  return limpo;
}

export default function Produtos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [usuario, setUsuario] = useState<User | null>(null);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [unidade, setUnidade] = useState("un");
  const [precoCusto, setPrecoCusto] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");
  const [estoque, setEstoque] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [fornecedor, setFornecedor] = useState("");

  const [busca, setBusca] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const [produtoEditando, setProdutoEditando] =
    useState<Produto | null>(null);
  const [produtoParaExcluir, setProdutoParaExcluir] =
    useState<Produto | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const [filtroEstoqueBaixo, setFiltroEstoqueBaixo] =
    useState(false);

  const { mostrarToast } = useToast();

  useEffect(() => {
    async function iniciar() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUsuario(user);

      if (user) {
        carregarProdutos(user.id);
      }
    }

    iniciar();
  }, []);

  async function carregarProdutos(userId: string) {
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: false });

    if (error) {
      console.error("Erro ao carregar produtos:", error);
      mostrarToast("Erro ao carregar produtos.", "erro");
      return;
    }

    setProdutos(data || []);
  }

  function limparFormulario() {
    setNome("");
    setCategoria("");
    setUnidade("un");
    setPrecoCusto("");
    setPrecoVenda("");
    setEstoque("");
    setEstoqueMinimo("");
    setCodigo("");
    setFornecedor("");
    setProdutoEditando(null);
  }

  function abrirNovoProduto() {
    limparFormulario();
    setMostrarFormulario(true);
  }

  function abrirEditarProduto(produto: Produto) {
    setProdutoEditando(produto);
    setNome(produto.nome);
    setCategoria(produto.categoria || "");
    setUnidade(produto.unidade);
    setPrecoCusto(formatarInputMoeda(produto.preco_custo));
    setPrecoVenda(formatarInputMoeda(produto.preco_venda));
    setEstoque(String(produto.estoque).replace(".", ","));
    setEstoqueMinimo(
      String(produto.estoque_minimo).replace(".", ",")
    );
    setCodigo(produto.codigo || "");
    setFornecedor(produto.fornecedor || "");
    setMostrarFormulario(true);
  }

  async function salvarProduto(e: FormEvent) {
    e.preventDefault();

    if (!nome.trim()) {
      mostrarToast("Digite o nome do produto.", "alerta");
      return;
    }

    if (!usuario) {
      mostrarToast("Usuário não identificado.", "erro");
      return;
    }

    const custo = precoCusto ? converterNumero(precoCusto) : 0;
    const venda = precoVenda ? converterNumero(precoVenda) : 0;
    const estoqueAtual = estoque ? converterNumero(estoque) : 0;
    const estoqueMin = estoqueMinimo
      ? converterNumero(estoqueMinimo)
      : 0;

    if (isNaN(custo) || custo < 0) {
      mostrarToast("Digite um preço de custo válido.", "alerta");
      return;
    }

    if (isNaN(venda) || venda < 0) {
      mostrarToast("Digite um preço de venda válido.", "alerta");
      return;
    }

    if (isNaN(estoqueAtual) || estoqueAtual < 0) {
      mostrarToast("Digite um estoque válido.", "alerta");
      return;
    }

    if (isNaN(estoqueMin) || estoqueMin < 0) {
      mostrarToast(
        "Digite um estoque mínimo válido.",
        "alerta"
      );
      return;
    }

    setCarregando(true);

    const dados = {
      nome: nome.trim(),
      categoria: categoria.trim() || null,
      unidade,
      preco_custo: custo,
      preco_venda: venda,
      estoque: estoqueAtual,
      estoque_minimo: estoqueMin,
      codigo: codigo.trim() || null,
      fornecedor: fornecedor.trim() || null,
    };

    if (produtoEditando) {
      const { error } = await supabase
        .from("produtos")
        .update(dados)
        .eq("id", produtoEditando.id)
        .eq("user_id", usuario.id);

      if (error) {
        console.error("Erro ao editar produto:", error);
        mostrarToast("Erro ao editar produto.", "erro");
        setCarregando(false);
        return;
      }

      mostrarToast("Produto atualizado com sucesso!", "sucesso");
    } else {
      const { error } = await supabase
        .from("produtos")
        .insert({ ...dados, user_id: usuario.id });

      if (error) {
        console.error("Erro ao cadastrar produto:", error);
        mostrarToast("Erro ao cadastrar produto.", "erro");
        setCarregando(false);
        return;
      }

      mostrarToast("Produto cadastrado com sucesso!", "sucesso");
    }

    await carregarProdutos(usuario.id);

    limparFormulario();
    setMostrarFormulario(false);
    setCarregando(false);
  }

  async function confirmarExclusao() {
    if (!produtoParaExcluir || !usuario) return;

    setExcluindo(true);

    const { error } = await supabase
      .from("produtos")
      .delete()
      .eq("id", produtoParaExcluir.id)
      .eq("user_id", usuario.id);

    setExcluindo(false);

    if (error) {
      console.error("Erro ao excluir produto:", error);
      mostrarToast("Erro ao excluir produto.", "erro");
      return;
    }

    setProdutos((lista) =>
      lista.filter((p) => p.id !== produtoParaExcluir.id)
    );
    mostrarToast("Produto excluído com sucesso.", "sucesso");
    setProdutoParaExcluir(null);
  }

  const produtosEstoqueBaixo = produtos.filter(
    (p) => p.estoque <= p.estoque_minimo
  );

  const valorEstoque = produtos.reduce(
    (total, p) => total + p.estoque * p.preco_custo,
    0
  );

  const produtosFiltrados = produtos.filter((produto) => {
    const termo = busca.toLowerCase().trim();
    if (filtroEstoqueBaixo) {
      if (produto.estoque > produto.estoque_minimo) return false;
    }
    if (!termo) return true;
    return (
      produto.nome.toLowerCase().includes(termo) ||
      (produto.categoria || "")
        .toLowerCase()
        .includes(termo) ||
      (produto.codigo || "")
        .toLowerCase()
        .includes(termo) ||
      (produto.fornecedor || "")
        .toLowerCase()
        .includes(termo)
    );
  });

  function margemLucro(p: Produto): number {
    if (!p.preco_custo || p.preco_custo === 0) return 0;
    return ((p.preco_venda - p.preco_custo) / p.preco_custo) * 100;
  }

  function estoqueBaixo(produto: Produto) {
    return produto.estoque <= produto.estoque_minimo;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Produtos
            </h1>
            <p className="text-gray-500 mt-1">
              Gerencie materiais, preços e estoque
            </p>
          </div>

          <button
            onClick={abrirNovoProduto}
            className="inline-flex items-center gap-2 bg-[#FFD60A] text-[#0D1B2A] font-bold px-5 py-3 rounded-lg hover:bg-yellow-400 transition shadow-lg shadow-yellow-500/20"
          >
            <PackagePlus className="w-5 h-5" />
            Novo produto
          </button>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center shrink-0">
              <Boxes className="w-6 h-6 text-[#FFD60A]" />
            </div>
            <div>
              <p className="text-sm text-gray-500">
                Total de produtos
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {produtos.length}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setFiltroEstoqueBaixo(!filtroEstoqueBaixo)
            }
            className={`text-left bg-white rounded-xl shadow-sm p-6 flex items-start gap-4 transition border-2 ${
              filtroEstoqueBaixo
                ? "border-red-300 bg-red-50/50"
                : "border-transparent hover:border-gray-200"
            }`}
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                filtroEstoqueBaixo
                  ? "bg-red-100"
                  : "bg-red-50"
              }`}
            >
              <TrendingDown
                className={`w-6 h-6 ${
                  filtroEstoqueBaixo
                    ? "text-red-600"
                    : "text-red-500"
                }`}
              />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-500">
                Estoque baixo
              </p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                {produtosEstoqueBaixo.length}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {filtroEstoqueBaixo
                  ? "Clique para remover o filtro"
                  : "Clique para filtrar"}
              </p>
            </div>
          </button>

          <div className="bg-white rounded-xl shadow-sm p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">
                Valor do estoque
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatarMoeda(valorEstoque)}
              </p>
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <label
            htmlFor="busca_produto"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            Buscar produto
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
            <input
              id="busca_produto"
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, categoria, código ou fornecedor..."
              className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Produtos cadastrados
            </h2>
            <div className="flex items-center gap-3">
              {filtroEstoqueBaixo && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Filtrando: estoque baixo
                </span>
              )}
              <span className="text-sm text-gray-500">
                {produtosFiltrados.length}{" "}
                {produtosFiltrados.length === 1
                  ? "produto"
                  : "produtos"}
              </span>
            </div>
          </div>

          {produtosFiltrados.length === 0 ? (
            <div className="p-10 text-center">
              <div className="inline-flex w-16 h-16 rounded-full bg-yellow-50 items-center justify-center mb-4">
                <Package className="w-8 h-8 text-[#FFD60A]" />
              </div>
              <h3 className="font-semibold text-gray-900">
                {busca || filtroEstoqueBaixo
                  ? "Nenhum produto encontrado"
                  : "Nenhum produto cadastrado"}
              </h3>
              <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
                {busca
                  ? "Tente pesquisar por outro termo."
                  : filtroEstoqueBaixo
                  ? "Nenhum produto com estoque abaixo do mínimo."
                  : "Cadastre seus materiais para começar a controlar o estoque."}
              </p>
              {!busca && !filtroEstoqueBaixo && (
                <button
                  onClick={abrirNovoProduto}
                  className="mt-5 inline-flex items-center gap-2 bg-[#FFD60A] hover:bg-yellow-400 text-[#0D1B2A] font-bold px-5 py-2.5 rounded-lg transition shadow-lg shadow-yellow-500/20"
                >
                  <PackagePlus className="w-4 h-4" />
                  Cadastrar primeiro produto
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="text-left px-6 py-4 text-sm font-semibold text-gray-600"
                    >
                      Produto
                    </th>
                    <th
                      scope="col"
                      className="text-left px-6 py-4 text-sm font-semibold text-gray-600"
                    >
                      Categoria
                    </th>
                    <th
                      scope="col"
                      className="text-left px-6 py-4 text-sm font-semibold text-gray-600"
                    >
                      Preço
                    </th>
                    <th
                      scope="col"
                      className="text-left px-6 py-4 text-sm font-semibold text-gray-600"
                    >
                      Estoque
                    </th>
                    <th
                      scope="col"
                      className="text-right px-6 py-4 text-sm font-semibold text-gray-600"
                    >
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {produtosFiltrados.map((produto) => {
                    const baixo = estoqueBaixo(produto);
                    const margem = margemLucro(produto);
                    return (
                      <tr
                        key={produto.id}
                        className={`hover:bg-gray-50 transition ${
                          baixo ? "bg-red-50/30" : ""
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD60A] to-yellow-500 text-[#0D1B2A] font-bold flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate">
                                {produto.nome}
                              </p>
                              <p className="text-xs text-gray-400 truncate">
                                {produto.codigo
                                  ? `Código: ${produto.codigo}`
                                  : `Produto #${produto.id}`}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          {produto.categoria ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">
                              <Tag className="w-3 h-3" />
                              {produto.categoria}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400 italic">
                              Sem categoria
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-900">
                            {formatarMoeda(produto.preco_venda)}
                          </p>
                          <p className="text-xs text-gray-400">
                            Custo:{" "}
                            {formatarMoeda(produto.preco_custo)}
                            {margem > 0 && (
                              <span
                                className={`ml-1 font-semibold ${
                                  margem > 30
                                    ? "text-green-600"
                                    : margem > 15
                                    ? "text-yellow-600"
                                    : "text-red-600"
                                }`}
                              >
                                ({margem.toFixed(0)}%)
                              </span>
                            )}
                          </p>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {baixo && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                                <TrendingDown className="w-3 h-3" />
                                Baixo
                              </span>
                            )}
                            <div>
                              <p
                                className={`font-bold ${
                                  baixo
                                    ? "text-red-600"
                                    : "text-gray-900"
                                }`}
                              >
                                {produto.estoque} {produto.unidade}
                              </p>
                              <p className="text-xs text-gray-400">
                                Mín: {produto.estoque_minimo}{" "}
                                {produto.unidade}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                abrirEditarProduto(produto)
                              }
                              className="px-3 py-2 rounded-lg text-sm font-medium text-[#0D1B2A] bg-gray-100 hover:bg-gray-200 transition"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setProdutoParaExcluir(produto)
                              }
                              className="px-3 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de cadastro/edição */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {produtoEditando
                    ? "Editar produto"
                    : "Novo produto"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Cadastre os dados do material e controle seu
                  estoque.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  limparFormulario();
                  setMostrarFormulario(false);
                }}
                className="text-gray-400 hover:text-gray-700 transition p-1 rounded-lg hover:bg-gray-100"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={salvarProduto} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Nome */}
                <div className="md:col-span-2">
                  <label
                    htmlFor="produto_nome"
                    className="block text-sm font-semibold text-gray-700 mb-1"
                  >
                    Nome do produto{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="produto_nome"
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Cabo flexível 2,5mm²"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    required
                  />
                </div>

                {/* Categoria */}
                <div>
                  <label
                    htmlFor="produto_categoria"
                    className="block text-sm font-semibold text-gray-700 mb-1"
                  >
                    Categoria
                  </label>
                  <input
                    id="produto_categoria"
                    type="text"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    placeholder="Ex: Cabos"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  />
                </div>

                {/* Unidade */}
                <div>
                  <label
                    htmlFor="produto_unidade"
                    className="block text-sm font-semibold text-gray-700 mb-1"
                  >
                    Unidade{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="produto_unidade"
                    value={unidade}
                    onChange={(e) => setUnidade(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] bg-white transition"
                  >
                    <option value="un">Unidade (un)</option>
                    <option value="m">Metro (m)</option>
                    <option value="cm">Centímetro (cm)</option>
                    <option value="kg">Quilograma (kg)</option>
                    <option value="g">Grama (g)</option>
                    <option value="l">Litro (L)</option>
                    <option value="caixa">Caixa</option>
                    <option value="rolo">Rolo</option>
                    <option value="peca">Peça</option>
                  </select>
                </div>

                {/* Custo */}
                <div>
                  <label
                    htmlFor="produto_custo"
                    className="block text-sm font-semibold text-gray-700 mb-1"
                  >
                    Preço de custo
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                      R$
                    </span>
                    <input
                      id="produto_custo"
                      type="text"
                      inputMode="numeric"
                      value={precoCusto}
                      onChange={(e) =>
                        setPrecoCusto(mascaraMoeda(e.target.value))
                      }
                      placeholder="0,00"
                      className="w-full border border-gray-200 rounded-lg pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    />
                  </div>
                </div>

                {/* Venda */}
                <div>
                  <label
                    htmlFor="produto_venda"
                    className="block text-sm font-semibold text-gray-700 mb-1"
                  >
                    Preço de venda
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                      R$
                    </span>
                    <input
                      id="produto_venda"
                      type="text"
                      inputMode="numeric"
                      value={precoVenda}
                      onChange={(e) =>
                        setPrecoVenda(mascaraMoeda(e.target.value))
                      }
                      placeholder="0,00"
                      className="w-full border border-gray-200 rounded-lg pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    />
                  </div>
                </div>

                {/* Estoque */}
                <div>
                  <label
                    htmlFor="produto_estoque"
                    className="block text-sm font-semibold text-gray-700 mb-1"
                  >
                    Estoque atual
                  </label>
                  <input
                    id="produto_estoque"
                    type="text"
                    inputMode="decimal"
                    value={estoque}
                    onChange={(e) =>
                      setEstoque(mascaraNumero(e.target.value))
                    }
                    placeholder="Ex: 150"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  />
                </div>

                {/* Estoque mínimo */}
                <div>
                  <label
                    htmlFor="produto_estoque_minimo"
                    className="block text-sm font-semibold text-gray-700 mb-1"
                  >
                    Estoque mínimo
                  </label>
                  <input
                    id="produto_estoque_minimo"
                    type="text"
                    inputMode="decimal"
                    value={estoqueMinimo}
                    onChange={(e) =>
                      setEstoqueMinimo(mascaraNumero(e.target.value))
                    }
                    placeholder="Ex: 30"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  />
                </div>

                {/* Código */}
                <div>
                  <label
                    htmlFor="produto_codigo"
                    className="block text-sm font-semibold text-gray-700 mb-1"
                  >
                    Código / SKU
                  </label>
                  <input
                    id="produto_codigo"
                    type="text"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="Ex: CAB25"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  />
                </div>

                {/* Fornecedor */}
                <div>
                  <label
                    htmlFor="produto_fornecedor"
                    className="block text-sm font-semibold text-gray-700 mb-1"
                  >
                    Fornecedor
                  </label>
                  <input
                    id="produto_fornecedor"
                    type="text"
                    value={fornecedor}
                    onChange={(e) => setFornecedor(e.target.value)}
                    placeholder="Nome do fornecedor"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-7">
                <button
                  type="button"
                  onClick={() => {
                    limparFormulario();
                    setMostrarFormulario(false);
                  }}
                  className="px-5 py-3 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={carregando}
                  className="px-5 py-3 rounded-lg bg-[#FFD60A] text-[#0D1B2A] font-bold hover:bg-yellow-400 disabled:opacity-60 transition shadow-lg shadow-yellow-500/20 inline-flex items-center gap-2"
                >
                  {carregando && (
                    <div className="w-4 h-4 border-2 border-[#0D1B2A]/30 border-t-[#0D1B2A] rounded-full animate-spin" />
                  )}
                  {carregando
                    ? "Salvando..."
                    : produtoEditando
                    ? "Salvar alterações"
                    : "Cadastrar produto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmação de exclusão */}
      <ConfirmDialog
        aberto={produtoParaExcluir !== null}
        titulo="Excluir produto?"
        descricao={
          <>
            Tem certeza que deseja excluir{" "}
            <strong className="text-gray-900">
              {produtoParaExcluir?.nome}
            </strong>
            ? Esta ação não pode ser desfeita.
          </>
        }
        textoBotaoConfirmar="Excluir"
        corBotaoConfirmar="vermelho"
        carregando={excluindo}
        aoConfirmar={confirmarExclusao}
        aoCancelar={() => setProdutoParaExcluir(null)}
      />
    </div>
  );
}
