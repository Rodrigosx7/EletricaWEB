import type { ReactElement, ReactNode } from "react";
import {
  FileText,
  Wrench,
  DollarSign,
  Zap,
  Palette,
  Shield,
  CheckCircle2,
} from "lucide-react";

/**
 * Hero lateral exibido em telas de autenticação.
 * Mostra valor/proposta do produto + ícones das features.
 * Visível em telas grandes (lg+), oculto em mobile/tablet.
 */
export default function AuthHero(): ReactElement {
  return (
    <div className="hidden lg:flex flex-col justify-between w-full max-w-xl px-8 py-10 text-white relative overflow-hidden">
      {/* Brilho decorativo */}
      <div
        className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{
          background:
            "radial-gradient(closest-side, #FFD60A, transparent 70%)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-10"
        style={{
          background:
            "radial-gradient(closest-side, #FFD60A, transparent 70%)",
        }}
      />

      {/* Conteúdo */}
      <div className="relative z-10 space-y-8">
        {/* Logo + nome */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#FFD60A] flex items-center justify-center shadow-lg shadow-yellow-500/20">
            <Zap className="w-7 h-7 text-[#0D1B2A]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Portal Elétrico</h1>
            <p className="text-sm text-gray-400">Sistema para eletricistas</p>
          </div>
        </div>

        {/* Headline */}
        <div>
          <h2 className="text-4xl font-bold leading-tight mb-3">
            Tudo que sua empresa
            <br />
            elétrica precisa
            <br />
            <span className="text-[#FFD60A]">em um só lugar.</span>
          </h2>
          <p className="text-gray-400 text-lg">
            De orçamentos a controle financeiro. Sem complicação.
          </p>
        </div>

        {/* Features */}
        <ul className="space-y-3.5">
          <FeatureItem
            icon={<FileText className="w-5 h-5" />}
            color="#FFD60A"
            title="Orçamentos profissionais"
            desc="Com PDF white-label e logo da sua empresa"
          />
          <FeatureItem
            icon={<Wrench className="w-5 h-5" />}
            color="#10B981"
            title="Ordens de serviço"
            desc="Controle de status, histórico e baixa automática de estoque"
          />
          <FeatureItem
            icon={<DollarSign className="w-5 h-5" />}
            color="#F59E0B"
            title="Financeiro e relatórios"
            desc="Receitas automáticas ao concluir OS + gráficos de BI"
          />
          <FeatureItem
            icon={<Zap className="w-5 h-5" />}
            color="#3B82F6"
            title="Calculadora NBR 5410"
            desc="Corrente, bitola, queda de tensão e fator de potência"
          />
          <FeatureItem
            icon={<Palette className="w-5 h-5" />}
            color="#A855F7"
            title="White-label completo"
            desc="Logo, cores e dados de contato da sua empresa"
          />
          <FeatureItem
            icon={<Shield className="w-5 h-5" />}
            color="#06B6D4"
            title="Multi-tenant seguro"
            desc="Cada empresa vê só os próprios dados com RLS"
          />
        </ul>

        {/* Prova social simples */}
        <div className="pt-2 flex items-center gap-3 text-sm text-gray-400">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>Sem cartão de crédito</span>
          <span className="text-gray-600">·</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>Cancele quando quiser</span>
          <span className="text-gray-600">·</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>Suporte por e-mail</span>
        </div>
      </div>
    </div>
  );
}

type FeatureItemProps = {
  icon: ReactNode;
  color: string;
  title: string;
  desc: string;
};

function FeatureItem({
  icon,
  color,
  title,
  desc,
}: FeatureItemProps): ReactElement {
  return (
    <li className="flex items-start gap-3">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: `${color}25`, color }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-white text-sm leading-tight">
          {title}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
    </li>
  );
}
