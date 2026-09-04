export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Cabeçalho */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Dashboard
          </h1>

          <p className="text-gray-500 mt-1">
            Visão geral do seu negócio
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* Faturamento */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-500">
              Faturamento do mês
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-2">
              R$ 0,00
            </h2>

            <p className="text-sm text-gray-400 mt-2">
              Nenhum lançamento ainda
            </p>
          </div>

          {/* Recebimentos */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-500">
              A receber
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-2">
              R$ 0,00
            </h2>

            <p className="text-sm text-gray-400 mt-2">
              Nenhum pagamento pendente
            </p>
          </div>

          {/* Despesas */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-500">
              Despesas do mês
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-2">
              R$ 0,00
            </h2>

            <p className="text-sm text-gray-400 mt-2">
              Nenhuma despesa registrada
            </p>
          </div>

          {/* Lucro */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-500">
              Lucro do mês
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-2">
              R$ 0,00
            </h2>

            <p className="text-sm text-gray-400 mt-2">
              Sem movimentações
            </p>
          </div>

        </div>

        {/* Ações rápidas */}
        <div className="mt-8 bg-white rounded-xl shadow-sm p-6">

          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Ações rápidas
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <button className="border border-gray-200 rounded-lg p-4 text-left hover:bg-gray-50">
              <strong className="block text-gray-900">
                Novo cliente
              </strong>

              <span className="text-sm text-gray-500">
                Cadastrar um novo cliente
              </span>
            </button>

            <button className="border border-gray-200 rounded-lg p-4 text-left hover:bg-gray-50">
              <strong className="block text-gray-900">
                Novo orçamento
              </strong>

              <span className="text-sm text-gray-500">
                Criar um orçamento
              </span>
            </button>

            <button className="border border-gray-200 rounded-lg p-4 text-left hover:bg-gray-50">
              <strong className="block text-gray-900">
                Registrar despesa
              </strong>

              <span className="text-sm text-gray-500">
                Adicionar uma despesa
              </span>
            </button>

          </div>

        </div>

      </div>
    </div>
  );
}