type SidebarProps = {
  pagina: string;
  setPagina: (pagina: string) => void;
  sair: () => void;
};

export default function Sidebar({
  pagina,
  setPagina,
  sair,
}: SidebarProps) {
  const menu = [
    { id: "dashboard", nome: "Dashboard", icone: "⌂" },
    { id: "clientes", nome: "Clientes", icone: "♙" },
    { id: "orcamentos", nome: "Orçamentos", icone: "▤" },
    { id: "ordens-servico", nome: "Ordens de Serviço", icone: "▣" },
    { id: "servicos", nome: "Serviços", icone: "⌁" },
    { id: "produtos", nome: "Produtos", icone: "▦" },
    { id: "financeiro", nome: "Financeiro", icone: "R$" },
    { id: "relatorios", nome: "Relatórios", icone: "▥" },
    { id: "configuracoes", nome: "Configurações", icone: "⚙" },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#0D1B2A] text-white flex flex-col">

      {/* Logo */}
      <div className="h-20 flex items-center px-6 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold">
            ⚡ Portal Elétrico
          </h1>

          <p className="text-xs text-gray-400 mt-1">
            Gestão para eletricistas
          </p>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4 space-y-2">

        {menu.map((item) => (
          <button
            key={item.id}
            onClick={() => setPagina(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition ${
              pagina === item.id
                ? "bg-[#FFD60A] text-[#0D1B2A] font-semibold"
                : "text-gray-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="w-6 text-center">
              {item.icone}
            </span>

            <span>
              {item.nome}
            </span>
          </button>
        ))}

      </nav>

      {/* Usuário / Sair */}
      <div className="p-4 border-t border-white/10">

        <button
          onClick={sair}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition"
        >
          <span className="w-6 text-center">
            ⇥
          </span>

          <span>
            Sair
          </span>
        </button>

      </div>

    </aside>
  );
}