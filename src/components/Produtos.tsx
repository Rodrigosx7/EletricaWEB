import { useEffect, useState } from "react";
import { supabase } from "../supabase";

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

export default function Produtos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [usuario, setUsuario] = useState<any>(null);

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

  function formatarInputMoeda(valor: number) {
    return Number(valor).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatarMoeda(valor: number) {
    return Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function converterMoeda(
    valor: string,
    setValor: (valor: string) => void
  ) {
    const somenteNumeros = valor.replace(/\D/g, "");

    if (!somenteNumeros) {
      setValor("");
      return;
    }

    const numero = Number(somenteNumeros) / 100;

    setValor(
      numero.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  function converterNumero(valor: string) {
    return Number(
      valor
        .replace(/\./g, "")
        .replace(",", ".")
    );
  }

  async function salvarProduto(e: React.FormEvent) {
    e.preventDefault();

    if (!nome.trim()) {
      alert("Digite o nome do produto.");
      return;
    }

    if (!usuario) {
      alert("Usuário não identificado.");
      return;
    }

    const custo = converterNumero(precoCusto);
    const venda = converterNumero(precoVenda);
    const estoqueAtual = converterNumero(estoque);
    const estoqueMin = converterNumero(estoqueMinimo);

    if (isNaN(custo) || custo < 0) {
      alert("Digite um preço de custo válido.");
      return;
    }

    if (isNaN(venda) || venda < 0) {
      alert("Digite um preço de venda válido.");
      return;
    }

    if (isNaN(estoqueAtual) || estoqueAtual < 0) {
      alert("Digite um estoque válido.");
      return;
    }

    if (isNaN(estoqueMin) || estoqueMin < 0) {
      alert("Digite um estoque mínimo válido.");
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
        alert("Erro ao editar produto.");
        setCarregando(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from("produtos")
        .insert({
          ...dados,
          user_id: usuario.id,
        });

      if (error) {
        console.error("Erro ao cadastrar produto:", error);
        alert("Erro ao cadastrar produto.");
        setCarregando(false);
        return;
      }
    }

    await carregarProdutos(usuario.id);

    limparFormulario();
    setMostrarFormulario(false);
    setCarregando(false);
  }

  async function excluirProduto(id: number) {
    const confirmar = confirm(
      "Deseja realmente excluir este produto?"
    );

    if (!confirmar || !usuario) return;

    const { error } = await supabase
      .from("produtos")
      .delete()
      .eq("id", id)
      .eq("user_id", usuario.id);

    if (error) {
      console.error("Erro ao excluir produto:", error);
      alert("Erro ao excluir produto.");
      return;
    }

    setProdutos((lista) =>
      lista.filter((produto) => produto.id !== id)
    );
  }

  const produtosFiltrados = produtos.filter((produto) => {
    const termo = busca.toLowerCase().trim();

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

  const produtosEstoqueBaixo = produtos.filter(
    (produto) =>
      produto.estoque <= produto.estoque_minimo
  );

  const valorEstoque = produtos.reduce(
    (total, produto) =>
      total + produto.estoque * produto.preco_custo,
    0
  );

  function estoqueBaixo(produto: Produto) {
    return produto.estoque <= produto.estoque_minimo;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">

      <div className="max-w-7xl mx-auto">

        {/* CABEÇALHO */}
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
            className="bg-[#FFD60A] text-[#0D1B2A] font-bold px-5 py-3 rounded-lg hover:opacity-90 transition shadow-sm"
          >
            + Novo produto
          </button>

        </div>

        {/* CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">

          <div className="bg-white rounded-xl shadow-sm p-6">

            <p className="text-sm text-gray-500">
              Total de produtos
            </p>

            <p className="text-3xl font-bold text-gray-900 mt-2">
              {produtos.length}
            </p>

          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">

            <p className="text-sm text-gray-500">
              Estoque baixo
            </p>

            <p className="text-3xl font-bold text-red-600 mt-2">
              {produtosEstoqueBaixo.length}
            </p>

          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">

            <p className="text-sm text-gray-500">
              Valor do estoque
            </p>

            <p className="text-2xl font-bold text-gray-900 mt-2">
              {formatarMoeda(valorEstoque)}
            </p>

          </div>

        </div>

        {/* BUSCA */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">

          <label className="block text-sm font-medium text-gray-700 mb-2">
            Buscar produto
          </label>

          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, categoria, código ou fornecedor..."
            className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent"
          />

        </div>

        {/* LISTA */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">

          <div className="p-6 border-b border-gray-100">

            <h2 className="text-xl font-bold text-gray-900">
              Produtos cadastrados
            </h2>

          </div>

          {produtosFiltrados.length === 0 ? (

            <div className="p-10 text-center">

              <div className="text-4xl mb-3">
                📦
              </div>

              <h3 className="font-semibold text-gray-900">
                {busca
                  ? "Nenhum produto encontrado"
                  : "Nenhum produto cadastrado"}
              </h3>

              <p className="text-gray-500 text-sm mt-1">
                {busca
                  ? "Tente pesquisar por outro termo."
                  : "Cadastre seus materiais para começar a controlar o estoque."}
              </p>

            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-gray-50">

                  <tr>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Produto
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Categoria
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Preço
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Estoque
                    </th>

                    <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">
                      Ações
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-gray-100">

                  {produtosFiltrados.map((produto) => (

                    <tr
                      key={produto.id}
                      className="hover:bg-gray-50 transition"
                    >

                      <td className="px-6 py-4">

                        <div className="flex items-center gap-3">

                          <div className="w-10 h-10 rounded-full bg-[#0D1B2A] text-white flex items-center justify-center">
                            📦
                          </div>

                          <div>

                            <p className="font-semibold text-gray-900">
                              {produto.nome}
                            </p>

                            <p className="text-xs text-gray-400">
                              {produto.codigo
                                ? `Código: ${produto.codigo}`
                                : `Produto #${produto.id}`}
                            </p>

                          </div>

                        </div>

                      </td>

                      <td className="px-6 py-4">

                        {produto.categoria ? (

                          <span className="inline-flex px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">
                            {produto.categoria}
                          </span>

                        ) : (

                          <span className="text-sm text-gray-400">
                            Sem categoria
                          </span>

                        )}

                      </td>

                      <td className="px-6 py-4">

                        <div>

                          <p className="font-bold text-gray-900">
                            {formatarMoeda(
                              produto.preco_venda
                            )}
                          </p>

                          <p className="text-xs text-gray-400">
                            Custo:{" "}
                            {formatarMoeda(
                              produto.preco_custo
                            )}
                          </p>

                        </div>

                      </td>

                      <td className="px-6 py-4">

                        <div>

                          <p
                            className={`font-bold ${
                              estoqueBaixo(produto)
                                ? "text-red-600"
                                : "text-gray-900"
                            }`}
                          >
                            {produto.estoque}{" "}
                            {produto.unidade}
                          </p>

                          <p className="text-xs text-gray-400">
                            Mínimo:{" "}
                            {produto.estoque_minimo}{" "}
                            {produto.unidade}
                          </p>

                        </div>

                      </td>

                      <td className="px-6 py-4">

                        <div className="flex justify-end gap-2">

                          <button
                            onClick={() =>
                              abrirEditarProduto(produto)
                            }
                            className="px-3 py-2 rounded-lg text-sm font-medium text-[#0D1B2A] bg-gray-100 hover:bg-gray-200 transition"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() =>
                              excluirProduto(produto.id)
                            }
                            className="px-3 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition"
                          >
                            Excluir
                          </button>

                        </div>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

      {/* MODAL */}
      {mostrarFormulario && (

        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">

          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8">

            {/* CABEÇALHO */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">

              <div>

                <h2 className="text-xl font-bold text-gray-900">
                  {produtoEditando
                    ? "Editar produto"
                    : "Novo produto"}
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Cadastre os dados do material e controle seu estoque.
                </p>

              </div>

              <button
                onClick={() => {
                  limparFormulario();
                  setMostrarFormulario(false);
                }}
                className="text-gray-400 hover:text-gray-700 text-2xl"
              >
                ×
              </button>

            </div>

            {/* FORMULÁRIO */}
            <form
              onSubmit={salvarProduto}
              className="p-6"
            >

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* NOME */}
                <div className="md:col-span-2">

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do produto *
                  </label>

                  <input
                    type="text"
                    value={nome}
                    onChange={(e) =>
                      setNome(e.target.value)
                    }
                    placeholder="Ex: Cabo flexível 2,5mm²"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A]"
                  />

                </div>

                {/* CATEGORIA */}
                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>

                  <input
                    type="text"
                    value={categoria}
                    onChange={(e) =>
                      setCategoria(e.target.value)
                    }
                    placeholder="Ex: Cabos"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A]"
                  />

                </div>

                {/* UNIDADE */}
                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unidade *
                  </label>

                  <select
                    value={unidade}
                    onChange={(e) =>
                      setUnidade(e.target.value)
                    }
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] bg-white"
                  >
                    <option value="un">
                      Unidade (un)
                    </option>

                    <option value="m">
                      Metro (m)
                    </option>

                    <option value="cm">
                      Centímetro (cm)
                    </option>

                    <option value="kg">
                      Quilograma (kg)
                    </option>

                    <option value="g">
                      Grama (g)
                    </option>

                    <option value="l">
                      Litro (L)
                    </option>

                    <option value="caixa">
                      Caixa
                    </option>

                    <option value="rolo">
                      Rolo
                    </option>

                    <option value="peca">
                      Peça
                    </option>

                  </select>

                </div>

                {/* CUSTO */}
                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preço de custo
                  </label>

                  <div className="relative">

                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                      R$
                    </span>

                    <input
                      type="text"
                      value={precoCusto}
                      onChange={(e) =>
                        converterMoeda(
                          e.target.value,
                          setPrecoCusto
                        )
                      }
                      placeholder="0,00"
                      className="w-full border border-gray-200 rounded-lg pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A]"
                    />

                  </div>

                </div>

                {/* VENDA */}
                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preço de venda
                  </label>

                  <div className="relative">

                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                      R$
                    </span>

                    <input
                      type="text"
                      value={precoVenda}
                      onChange={(e) =>
                        converterMoeda(
                          e.target.value,
                          setPrecoVenda
                        )
                      }
                      placeholder="0,00"
                      className="w-full border border-gray-200 rounded-lg pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A]"
                    />

                  </div>

                </div>

                {/* ESTOQUE */}
                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estoque atual
                  </label>

                  <input
                    type="text"
                    value={estoque}
                    onChange={(e) =>
                      setEstoque(e.target.value)
                    }
                    placeholder="Ex: 150"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A]"
                  />

                </div>

                {/* ESTOQUE MÍNIMO */}
                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estoque mínimo
                  </label>

                  <input
                    type="text"
                    value={estoqueMinimo}
                    onChange={(e) =>
                      setEstoqueMinimo(e.target.value)
                    }
                    placeholder="Ex: 30"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A]"
                  />

                </div>

                {/* CÓDIGO */}
                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código / SKU
                  </label>

                  <input
                    type="text"
                    value={codigo}
                    onChange={(e) =>
                      setCodigo(e.target.value)
                    }
                    placeholder="Ex: CAB25"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A]"
                  />

                </div>

                {/* FORNECEDOR */}
                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fornecedor
                  </label>

                  <input
                    type="text"
                    value={fornecedor}
                    onChange={(e) =>
                      setFornecedor(e.target.value)
                    }
                    placeholder="Nome do fornecedor"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A]"
                  />

                </div>

              </div>

              {/* BOTÕES */}
              <div className="flex justify-end gap-3 mt-7">

                <button
                  type="button"
                  onClick={() => {
                    limparFormulario();
                    setMostrarFormulario(false);
                  }}
                  className="px-5 py-3 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={carregando}
                  className="px-5 py-3 rounded-lg bg-[#FFD60A] text-[#0D1B2A] font-bold hover:opacity-90 disabled:opacity-50"
                >
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

    </div>
  );
}