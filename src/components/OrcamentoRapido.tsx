import { useState, useEffect, type ReactElement } from "react";
import {
  Copy,
  MessageCircle,
  Printer,
  Plus,
  Trash2,
  Package,
  Lightbulb,
  Plug,
  ToggleLeft,
  Cable,
  Zap,
  Wrench,
  FileText,
  Check,
  ChevronRight,
  Minus,
  LayoutGrid,
  Cpu,
  HardHat,
  Star,
  TrendingUp,
  Sun,
  ShieldAlert,
  Activity,
} from "lucide-react";

/* ---------------- tipos ---------------- */

type ItemPre = {
  id: string;
  nome: string;
  quantidade: number;
  unidade?: string;
};

type ItemPersonalizado = {
  id: string;
  nome: string;
  quantidade: number;
};

type Comodo = {
  id: string;
  nome: string;
  items: ItemPre[];
  personalizado: ItemPersonalizado[];
};

type Categoria = {
  id: string;
  nome: string;
  icone: typeof Lightbulb;
  itens: { id: string; nome: string; unidade?: string }[];
};

/* ---------------- catálogo ---------------- */

const CATEGORIAS: Categoria[] = [
  {
    id: "tomadas",
    nome: "Tomadas",
    icone: Plug,
    itens: [
      { id: "tomada_10a", nome: "Tomada 2P+T 10A 250V" },
      { id: "tomada_16a", nome: "Tomada 2P+T 16A 250V" },
      { id: "tomada_20a", nome: "Tomada 2P+T 20A 250V" },
      { id: "tomada_32a", nome: "Tomada Industrial 2P+T 32A 250V" },
      { id: "tomada_trifasica_16a", nome: "Tomada Industrial 3P+T 16A 380V" },
      { id: "tomada_trifasica_32a", nome: "Tomada Industrial 3P+T 32A 380V" },
      { id: "tomada_trifasica_63a", nome: "Tomada Industrial 3P+N+T 63A 380V" },
      { id: "tomada_10a_dupla", nome: "Tomada 2P+T 10A Dupla" },
      { id: "tomada_20a_dupla", nome: "Tomada 2P+T 20A Dupla" },
      { id: "tomada_10a_tripla", nome: "Tomada 2P+T 10A Tripla" },
      { id: "tomada_20a_tripla", nome: "Tomada 2P+T 20A Tripla" },
      { id: "tomada_usb", nome: "Tomada USB 2.1A" },
      { id: "tomada_usb_dupla", nome: "Tomada USB Dupla 2.1A+2.1A" },
      { id: "tomada_usb_c", nome: "Tomada USB-C 20W" },
      { id: "tomada_hdmi", nome: "Tomada HDMI" },
      { id: "tomada_telefone_rj11", nome: "Tomada Telefone RJ11 4 pinos" },
      { id: "tomada_rede_rj45_cat5", nome: "Tomada de Rede RJ45 Cat5e" },
      { id: "tomada_rede_rj45_cat6", nome: "Tomada de Rede RJ45 Cat6" },
      { id: "tomada_tv", nome: "Tomada de TV (coaxial F)" },
      { id: "tomada_logica_2mod", nome: "Espelho 2 Postos 4x2 (vazio)" },
      { id: "tomada_logica_3mod", nome: "Espelho 3 Postos 4x2 (vazio)" },
      { id: "tomada_logica_4mod", nome: "Espelho 4 Postos 4x2 (vazio)" },
      { id: "suporte_4x2", nome: "Suporte/Placa 4x2 1 Módulo" },
      { id: "suporte_4x4", nome: "Suporte/Placa 4x4 2 Módulos" },
    ],
  },
  {
    id: "interruptores",
    nome: "Interruptores",
    icone: ToggleLeft,
    itens: [
      { id: "int_simples_1", nome: "Interruptor Simples 1 Tecla" },
      { id: "int_simples_2", nome: "Interruptor Simples 2 Teclas" },
      { id: "int_simples_3", nome: "Interruptor Simples 3 Teclas" },
      { id: "int_paralelo", nome: "Interruptor Paralelo (Two-Way)" },
      { id: "int_intermediario", nome: "Interruptor Intermediário (Four-Way)" },
      { id: "int_dimmer", nome: "Dimmer (regulador)" },
      { id: "int_mini", nome: "Interruptor Miniatura (borne)" },
      { id: "int_touch", nome: "Interruptor Touch (capacitivo)" },
      { id: "int_pulso", nome: "Interruptor de Pulso (campainha)" },
      { id: "int_treme", nome: "Bloco/Treme (sovela/sinalização)" },
    ],
  },
  {
    id: "combinacoes",
    nome: "Combinações (Int + Tomadas)",
    icone: LayoutGrid,
    itens: [
      { id: "c_int1_t10_1", nome: "1 Interruptor Simples + 1 Tomada 10A" },
      { id: "c_int1_t10_2", nome: "1 Interruptor Simples + 2 Tomadas 10A" },
      { id: "c_int1_t10_3", nome: "1 Interruptor Simples + 3 Tomadas 10A" },
      { id: "c_int1_t20_1", nome: "1 Interruptor Simples + 1 Tomada 20A" },
      { id: "c_int1_t20_2", nome: "1 Interruptor Simples + 2 Tomadas 20A" },
      { id: "c_int1_t10_1_t20_1", nome: "1 Int Simples + 1 Tomada 10A + 1 Tomada 20A" },
      { id: "c_int2_t10_1", nome: "2 Interruptores Simples + 1 Tomada 10A" },
      { id: "c_int2_t20_1", nome: "2 Interruptores Simples + 1 Tomada 20A" },
      { id: "c_int2_t10_2", nome: "2 Interruptores Simples + 2 Tomadas 10A" },
      { id: "c_int2_t10_t20", nome: "2 Interruptores + 1 Tomada 10A + 1 Tomada 20A" },
      { id: "c_int3_t10_1", nome: "3 Interruptores Simples + 1 Tomada 10A" },
      { id: "c_int_paralelo_t10", nome: "1 Interruptor Paralelo + 1 Tomada 10A" },
      { id: "c_int1_t10_dupla", nome: "1 Interruptor + 1 Tomada 10A Dupla" },
      { id: "c_int2_t10_dupla", nome: "2 Interruptores + 1 Tomada 10A Dupla" },
      { id: "c_int1_t10_dupla_t20", nome: "1 Int + 1 Tomada 10A Dupla + 1 Tomada 20A" },
      { id: "c_pulso_t10", nome: "1 Interruptor de Pulso + 1 Tomada 10A" },
    ],
  },
  {
    id: "iluminacao",
    nome: "Iluminação",
    icone: Lightbulb,
    itens: [
      { id: "lamp_led_7w", nome: "Lâmpada LED 7W" },
      { id: "lamp_led_9w", nome: "Lâmpada LED 9W" },
      { id: "lamp_led_12w", nome: "Lâmpada LED 12W" },
      { id: "lamp_led_15w", nome: "Lâmpada LED 15W" },
      { id: "lamp_led_20w", nome: "Lâmpada LED 20W" },
      { id: "painel_led_12w_sobrepor", nome: "Painel LED 12W Sobrepor" },
      { id: "painel_led_24w_sobrepor", nome: "Painel LED 24W Sobrepor" },
      { id: "painel_led_36w_sobrepor", nome: "Painel LED 36W Sobrepor" },
      { id: "painel_led_12w_embutir", nome: "Painel LED 12W Embutir" },
      { id: "painel_led_24w_embutir", nome: "Painel LED 24W Embutir" },
      { id: "spot_led_3w", nome: "Spot LED 3W Embutir" },
      { id: "spot_led_5w", nome: "Spot LED 5W Embutir" },
      { id: "spot_led_7w", nome: "Spot LED 7W Embutir" },
      { id: "refletor_led_10w", nome: "Refletor LED 10W Externo" },
      { id: "refletor_led_20w", nome: "Refletor LED 20W" },
      { id: "refletor_led_30w", nome: "Refletor LED 30W" },
      { id: "refletor_led_50w", nome: "Refletor LED 50W" },
      { id: "refletor_led_100w", nome: "Refletor LED 100W" },
      { id: "refletor_led_150w", nome: "Refletor LED 150W" },
      { id: "refletor_led_200w", nome: "Refletor LED 200W" },
      { id: "barramento_led_1m", nome: "Trilho/Barramento LED 1 metro" },
      { id: "calha_led_1m", nome: "Calha/Perfil de Alumínio LED 1 metro" },
      { id: "lamp_tubular_led_9w_60cm", nome: "Lâmpada Tubular LED T8 9W 60cm" },
      { id: "lamp_tubular_led_18w_120cm", nome: "Lâmpada Tubular LED T8 18W 120cm" },
      { id: "lamp_tubular_led_36w_240cm", nome: "Lâmpada Tubular LED T8 36W 240cm" },
      { id: "luminaria_tubular_2x18w", nome: "Luminária Calha 2x18W (para tubular)" },
      { id: "lamp_fluoresc_2u", nome: "Lâmpada Fluorescente Compacta 2U" },
      { id: "lamp_halog_50w", nome: "Lâmpada Halógena Dicróica 50W" },
      { id: "plafon_led_12w", nome: "Plafon LED 12W Redondo" },
      { id: "plafon_led_18w", nome: "Plafon LED 18W Redondo" },
      { id: "plafon_led_24w", nome: "Plafon LED 24W Quadrado" },
      { id: "plafon_led_24w_embutir", nome: "Plafon LED 24W Embutir Redondo" },
      { id: "pendente", nome: "Pendente" },
      { id: "pendente_vidro", nome: "Pendente Vidro/acrílico" },
      { id: "arandela", nome: "Arandela de Parede" },
      { id: "balizador_led", nome: "Balizador LED de Solo (embutir)" },
      { id: "fita_led_5m", nome: "Fita LED 3528 120 LEDs/m 5m (branca)" },
      { id: "fita_led_10m", nome: "Fita LED 3528 120 LEDs/m 10m" },
      { id: "fita_led_rgb_5m", nome: "Fita LED RGB 5m (com controle)" },
      { id: "perfil_aluminio_led", nome: "Perfil Alumínio LED Embutir 2m" },
      { id: "perfil_teto_led", nome: "Perfil Alumínio LED Sobrepor/Teto 2m" },
      { id: "driver_fita_led", nome: "Driver/Fonte 12V para Fita LED" },
    ],
  },
  {
    id: "fios",
    nome: "Fios e Cabos",
    icone: Cable,
    itens: [
      { id: "fio_1_5", nome: "Fio 1,5mm²", unidade: "metro" },
      { id: "fio_2_5", nome: "Fio 2,5mm²", unidade: "metro" },
      { id: "fio_4_0", nome: "Fio 4,0mm²", unidade: "metro" },
      { id: "fio_6_0", nome: "Fio 6,0mm²", unidade: "metro" },
      { id: "fio_10_0", nome: "Fio 10mm²", unidade: "metro" },
      { id: "fio_16_0", nome: "Fio 16mm²", unidade: "metro" },
      { id: "fio_25_0", nome: "Fio 25mm² (rígido)", unidade: "metro" },
      { id: "fio_35_0", nome: "Fio 35mm² (rígido)", unidade: "metro" },
      { id: "cabo_flex_1_5", nome: "Cabo Flexível 1,5mm²", unidade: "metro" },
      { id: "cabo_flex_2_5", nome: "Cabo Flexível 2,5mm²", unidade: "metro" },
      { id: "cabo_flex_4_0", nome: "Cabo Flexível 4,0mm²", unidade: "metro" },
      { id: "cabo_flex_6_0", nome: "Cabo Flexível 6,0mm²", unidade: "metro" },
      { id: "cabo_flex_10_0", nome: "Cabo Flexível 10mm²", unidade: "metro" },
      { id: "cabo_flex_16_0", nome: "Cabo Flexível 16mm²", unidade: "metro" },
      { id: "cabo_flex_25_0", nome: "Cabo Flexível 25mm²", unidade: "metro" },
      { id: "cabo_flex_35_0", nome: "Cabo Flexível 35mm²", unidade: "metro" },
      { id: "cabo_pp_2x1_0", nome: "Cabo PP 2x1,0mm²", unidade: "metro" },
      { id: "cabo_pp_2x1_5", nome: "Cabo PP 2x1,5mm²", unidade: "metro" },
      { id: "cabo_pp_2x2_5", nome: "Cabo PP 2x2,5mm²", unidade: "metro" },
      { id: "cabo_pp_3x1_0", nome: "Cabo PP 3x1,0mm²", unidade: "metro" },
      { id: "cabo_pp_3x1_5", nome: "Cabo PP 3x1,5mm²", unidade: "metro" },
      { id: "cabo_pp_4x1_5", nome: "Cabo PP 4x1,5mm²", unidade: "metro" },
      { id: "fio_telefone_rj11", nome: "Fio/Par Telefônico RJ11", unidade: "metro" },
      { id: "cabo_rede_cat6", nome: "Cabo de Rede CAT6", unidade: "metro" },
      { id: "cabo_coaxial", nome: "Cabo Coaxial (TV)", unidade: "metro" },
      { id: "cabo_hdmi", nome: "Cabo HDMI", unidade: "metro" },
      { id: "cabo_alum_ca_16", nome: "Cabo Alumínio CA-16 (rígido)", unidade: "metro" },
      { id: "cabo_alum_ca_25", nome: "Cabo Alumínio CA-25 (rígido)", unidade: "metro" },
      { id: "cabo_alum_ca_35", nome: "Cabo Alumínio CA-35 (rígido)", unidade: "metro" },
      { id: "cabo_alum_ca_50", nome: "Cabo Alumínio CA-50 (rígido)", unidade: "metro" },
      { id: "cabo_alum_ca_70", nome: "Cabo Alumínio CA-70 (rígido)", unidade: "metro" },
      { id: "cabo_alum_ca_95", nome: "Cabo Alumínio CA-95 (rígido)", unidade: "metro" },
      { id: "cabo_alum_ca_120", nome: "Cabo Alumínio CA-120 (rígido)", unidade: "metro" },
      { id: "cabo_alum_quadruplex_70", nome: "Cabo Quadruplex Alumínio 70mm (c/neutro)", unidade: "metro" },
      { id: "cabo_solar_4mm", nome: "Cabo Solar 4mm² (CC)", unidade: "metro" },
      { id: "cabo_solar_6mm", nome: "Cabo Solar 6mm² (CC)", unidade: "metro" },
    ],
  },
  {
    id: "disjuntores",
    nome: "Disjuntores e Proteção",
    icone: Zap,
    itens: [
      { id: "disj_10a_mono", nome: "Disjuntor Monopolar 10A" },
      { id: "disj_16a_mono", nome: "Disjuntor Monopolar 16A" },
      { id: "disj_20a_mono", nome: "Disjuntor Monopolar 20A" },
      { id: "disj_25a_mono", nome: "Disjuntor Monopolar 25A" },
      { id: "disj_32a_mono", nome: "Disjuntor Monopolar 32A" },
      { id: "disj_40a_mono", nome: "Disjuntor Monopolar 40A" },
      { id: "disj_50a_mono", nome: "Disjuntor Monopolar 50A" },
      { id: "disj_63a_mono", nome: "Disjuntor Monopolar 63A" },
      { id: "disj_10a_bi", nome: "Disjuntor Bipolar 10A" },
      { id: "disj_16a_bi", nome: "Disjuntor Bipolar 16A" },
      { id: "disj_25a_bi", nome: "Disjuntor Bipolar 25A" },
      { id: "disj_20a_bi", nome: "Disjuntor Bipolar 20A" },
      { id: "disj_32a_bi", nome: "Disjuntor Bipolar 32A" },
      { id: "disj_40a_bi", nome: "Disjuntor Bipolar 40A" },
      { id: "disj_50a_bi", nome: "Disjuntor Bipolar 50A" },
      { id: "disj_63a_bi", nome: "Disjuntor Bipolar 63A" },
      { id: "disj_10a_tri", nome: "Disjuntor Tripolar 10A" },
      { id: "disj_16a_tri", nome: "Disjuntor Tripolar 16A" },
      { id: "disj_25a_tri", nome: "Disjuntor Tripolar 25A" },
      { id: "disj_40a_tri", nome: "Disjuntor Tripolar 40A" },
      { id: "disj_63a_tri", nome: "Disjuntor Tripolar 63A" },
      { id: "dr_10a_30ma", nome: "DR 10A 30mA (2P)" },
      { id: "dr_16a_30ma", nome: "DR 16A 30mA (2P)" },
      { id: "dr_25a_30ma", nome: "DR 25A 30mA (2P)" },
      { id: "dr_40a_30ma", nome: "DR 40A 30mA (2P)" },
      { id: "dr_63a_30ma", nome: "DR 63A 30mA (2P)" },
      { id: "dr_tripolar_25a", nome: "DR Tripolar 25A 30mA" },
      { id: "dr_tripolar_40a", nome: "DR Tripolar 40A 30mA" },
      { id: "dps_classe_i", nome: "DPS Classe I (Tipo 1) 50kA" },
      { id: "dps_classe_ii", nome: "DPS Classe II (Tipo 2) 20kA" },
      { id: "dps_classe_i_ii", nome: "DPS Classe I+II (Tipo 1+2) 50kA" },
      { id: "barramento_bipolar", nome: "Barramento Bipolar" },
      { id: "barramento_tripolar", nome: "Barramento Tripolar" },
      { id: "barramento_neutro_12mod", nome: "Barramento Neutro 12 módulos" },
      { id: "barramento_terra_12mod", nome: "Barramento Terra 12 módulos" },
      { id: "trilho_din_30cm", nome: "Trilho DIN 30cm (perfurado)" },
      { id: "seletor_grupo", nome: "Seletor Manual/Automático (0-1-2)" },
    ],
  },
  {
    id: "conectores",
    nome: "Conectores e Wago",
    icone: Wrench,
    itens: [
      { id: "wago_2", nome: "Wago 221 - 2 entradas" },
      { id: "wago_3", nome: "Wago 221 - 3 entradas" },
      { id: "wago_5", nome: "Wago 221 - 5 entradas" },
      { id: "wago_8", nome: "Wago 221 - 8 entradas" },
      { id: "wago_combo", nome: "Wago Combo (misto)" },
      { id: "conector_derivacao", nome: "Conector Derivação (parafuso)" },
      { id: "conector_perfurante", nome: "Conector Perfurante (par)" },
      { id: "conector_isolado_10mm", nome: "Conector Isolado 10mm²" },
      { id: "conector_isolado_16mm", nome: "Conector Isolado 16mm²" },
      { id: "terminal_ilaf_2_5", nome: "Terminal Ilaf 2,5mm² (vermelho)" },
      { id: "terminal_ilaf_6", nome: "Terminal Ilaf 6mm² (azul)" },
      { id: "terminal_ilaf_10", nome: "Terminal Ilaf 10mm² (amarelo)" },
      { id: "terminal_ilaf_16", nome: "Terminal Ilaf 16mm²" },
      { id: "borne_teco_4", nome: "Borneira/Teco 4mm²" },
      { id: "fita_auto_fusao", nome: "Fita Auto-fusão 10m" },
      { id: "fita_isolante_18mm", nome: "Fita Isolante 18mm (rolo 20m)" },
      { id: "fita_isolante_20mm", nome: "Fita Isolante 20mm (rolo 20m)" },
      { id: "espaguete_termo", nome: "Espaguete Termo-retrátil", unidade: "metro" },
      { id: "massa_vedacao", nome: "Massa de Vedação 150g" },
      { id: "spray_vedacao", nome: "Spray Desmoldante/Vedação" },
      { id: "abracadeira_nylon_4mm", nome: "Abraçadeira Nylon 4mm x 200mm (pct 100)" },
      { id: "abracadeira_nylon_6mm", nome: "Abraçadeira Nylon 6mm x 250mm (pct 100)" },
      { id: "abracadeira_nylon_8mm", nome: "Abraçadeira Nylon 8mm x 360mm (pct 100)" },
      { id: "abracadeira_inox_8mm", nome: "Abraçadeira Inox 8mm (pct 20)" },
      { id: "fita_crepe_18mm", nome: "Fita Crepe 18mm x 50m" },
    ],
  },
  {
    id: "acessorios",
    nome: "Acessórios e Fixação",
    icone: Package,
    itens: [
      // Caixas
      { id: "caixa_4x2", nome: "Caixa 4x2 PVC" },
      { id: "caixa_4x4", nome: "Caixa 4x4 PVC" },
      { id: "caixa_octogonal", nome: "Caixa Octogonal 4x4" },
      { id: "caixa_3x3", nome: "Caixa 3x3 PVC" },
      { id: "caixa_sobrepor_4x2", nome: "Caixa Sobrepor 4x2" },
      { id: "caixa_4x2_com_furo", nome: "Tampa Cega 4x2" },
      { id: "caixa_4x4_com_furo", nome: "Placa 4x4 1 módulo" },
      { id: "tampa_4x2_cega", nome: "Tampa Cega 4x2" },
      { id: "tampa_4x2_furo", nome: "Tampa com Furo 4x2" },
      { id: "tampa_quadro", nome: "Porta/Tampo para Quadro" },
      // Quadros
      { id: "quadro_dist_4_sobrepor", nome: "Quadro Distribuição Sobrepor 4 disj." },
      { id: "quadro_dist_8_sobrepor", nome: "Quadro Distribuição Sobrepor 8 disj." },
      { id: "quadro_dist_12_16_sobrepor", nome: "Quadro Distribuição Sobrepor 12/16 disj." },
      { id: "quadro_dist_24_sobrepor", nome: "Quadro Distribuição Sobrepor 24 disj." },
      { id: "quadro_dist_32_sobrepor", nome: "Quadro Distribuição Sobrepor 32 disj." },
      { id: "quadro_dist_4_embutir", nome: "Quadro Distribuição Embutir 4 disj." },
      { id: "quadro_dist_8_embutir", nome: "Quadro Distribuição Embutir 8 disj." },
      { id: "quadro_dist_12_embutir", nome: "Quadro Distribuição Embutir 12 disj." },
      { id: "quadro_dist_24_embutir", nome: "Quadro Distribuição Embutir 24 disj." },
      // Canaletas e Fixadores
      { id: "canaleta_10x10_2m", nome: "Canaleta 10x10mm PVC 2m (sem adesivo)" },
      { id: "canaleta_15x10_2m", nome: "Canaleta 15x10mm PVC 2m" },
      { id: "canaleta_20x10_2m", nome: "Canaleta 20x10mm Minicanal 2m" },
      { id: "canaleta_20x15_2m", nome: "Canaleta 20x15mm PVC 2m" },
      { id: "canaleta_40x25_2m", nome: "Canaleta 40x25mm PVC 2m" },
      { id: "canaleta_tampa_10x10_2m", nome: "Tampa Canaleta 10x10mm 2m" },
      { id: "canaleta_tampa_20x10_2m", nome: "Tampa Canaleta 20x10mm 2m" },
      { id: "grampo_miguelao_25", nome: "Grampo Miguelão Fixa Fio 2,5mm (pct 30)" },
      { id: "grampo_miguelao_50", nome: "Grampo Miguelão Fixa Cabo 5mm (pct 30)" },
      { id: "grampo_miguelao_100", nome: "Grampo Miguelão Fixa Cabo 10mm (pct 30)" },
      // Buchas e Parafusos
      { id: "bucha_nylon_6mm", nome: "Bucha Nylon 6mm (pct 100)" },
      { id: "bucha_nylon_8mm", nome: "Bucha Nylon 8mm (pct 100)" },
      { id: "bucha_nylon_10mm", nome: "Bucha Nylon 10mm (pct 100)" },
      { id: "bucha_nylon_12mm", nome: "Bucha Nylon 12mm (pct 100)" },
      { id: "parafuso_4x25", nome: "Parafuso 4x25mm (pct 100)" },
      { id: "parafuso_4x30", nome: "Parafuso 4x30mm (pct 100)" },
      { id: "parafuso_4x40", nome: "Parafuso 4x40mm (pct 100)" },
      { id: "parafuso_5x50", nome: "Parafuso 5x50mm (pct 100)" },
      { id: "parafuso_bucha_kit", nome: "Kit Parafuso + Bucha 6/8/10mm (pct 200)" },
      // Eletrodutos PVC
      { id: "eletroduto_pvc_3_4", nome: "Eletroduto PVC 3/4\"", unidade: "metro" },
      { id: "eletroduto_pvc_1", nome: "Eletroduto PVC 1\"", unidade: "metro" },
      { id: "eletroduto_pvc_20mm", nome: "Eletroduto PVC 20mm", unidade: "metro" },
      { id: "eletroduto_pvc_25mm", nome: "Eletroduto PVC 25mm", unidade: "metro" },
      { id: "eletroduto_pvc_32mm", nome: "Eletroduto PVC 32mm", unidade: "metro" },
      { id: "eletroduto_pvc_40mm", nome: "Eletroduto PVC 40mm", unidade: "metro" },
      { id: "eletroduto_pvc_50mm", nome: "Eletroduto PVC 50mm", unidade: "metro" },
      { id: "eletroduto_solda_3_4", nome: "Eletroduto Soldável 3/4\"", unidade: "metro" },
      { id: "eletroduto_solda_1", nome: "Eletroduto Soldável 1\"", unidade: "metro" },
      // Eletrodutos Galvanizados
      { id: "eletroduto_zg_3_4", nome: "Eletroduto Zincado 3/4\"", unidade: "metro" },
      { id: "eletroduto_zg_1", nome: "Eletroduto Zincado 1\"", unidade: "metro" },
      { id: "eletroduto_zg_1_1_2", nome: "Eletroduto Zincado 1.1/2\"", unidade: "metro" },
      { id: "eletroduto_zg_2", nome: "Eletroduto Zincado 2\"", unidade: "metro" },
      { id: "curva_90_zg_3_4", nome: "Curva 90° Galvanizada 3/4\"" },
      { id: "curva_90_zg_1", nome: "Curva 90° Galvanizada 1\"" },
      { id: "curva_90_zg_1_1_2", nome: "Curva 90° Galvanizada 1.1/2\"" },
      { id: "curva_90_zg_2", nome: "Curva 90° Galvanizada 2\"" },
      { id: "luva_zg_3_4", nome: "Luva Galvanizada 3/4\"" },
      { id: "luva_zg_1", nome: "Luva Galvanizada 1\"" },
      { id: "luva_zg_1_1_2", nome: "Luva Galvanizada 1.1/2\"" },
      { id: "luva_zg_2", nome: "Luva Galvanizada 2\"" },
      { id: "reducao_zg_1_3_4", nome: "Redução Galvanizada 1\" x 3/4\"" },
      { id: "reducao_zg_1_1_2_1", nome: "Redução Galvanizada 1.1/2\" x 1\"" },
      // Roldanas e Acessórios
      { id: "roldana_3_4", nome: "Roldana 3/4\" PVC" },
      { id: "roldana_1", nome: "Roldana 1\" PVC" },
      { id: "roldana_1_1_2", nome: "Roldana 1.1/2\" PVC" },
      { id: "curva_pvc_3_4", nome: "Curva 90° PVC 3/4\"" },
      { id: "curva_pvc_1", nome: "Curva 90° PVC 1\"" },
      { id: "luva_pvc_3_4", nome: "Luva PVC 3/4\"" },
      { id: "luva_pvc_1", nome: "Luva PVC 1\"" },
      { id: "uniao_pvc_3_4", nome: "União PVC 3/4\"" },
      { id: "uniao_pvc_1", nome: "União PVC 1\"" },
      { id: "tbu_pvc_3_4", nome: "TBU PVC 3/4\"" },
      { id: "tbu_pvc_1", nome: "TBU PVC 1\"" },
      { id: "condulet_zg_3_4", nome: "Condulet Galvanizado 3/4\" tipo LR" },
      { id: "condulet_zg_1", nome: "Condulet Galvanizado 1\" tipo LR" },
      // Diversos
      { id: "fita_auto_fusao", nome: "Fita Auto-fusão 10m" },
      { id: "fita_butilica", nome: "Fita Butilica Auto-vulcanizável 19mm x 3m" },
      { id: "fita_isolante_18mm", nome: "Fita Isolante 18mm (rolo 20m)" },
      { id: "fita_isolante_20mm", nome: "Fita Isolante 20mm (rolo 20m)" },
      { id: "fita_crepe_18mm", nome: "Fita Crepe 18mm x 50m" },
      { id: "espaguete_termo", nome: "Espaguete Termo-retrátil 3:1", unidade: "metro" },
      { id: "presilha_eletroduto", nome: "Presilha/Grampo para Eletroduto (pct)" },
      { id: "silicone_eletrica", nome: "Silicone Acético para Elétrica 280g" },
      { id: "massa_ved_eletrica", nome: "Massa de Vedação Elétrica 150g" },
      { id: "estopa", nome: "Estopa (vedação elétrica)" },
    ],
  },
  {
    id: "aterramento",
    nome: "Aterramento",
    icone: Zap,
    itens: [
      { id: "haste_aterramento_58", nome: "Haste Aterramento Cobreadinha 5/8\" x 2,4m" },
      { id: "haste_aterramento_34", nome: "Haste Aterramento Cobreadinha 3/4\" x 2,4m" },
      { id: "haste_aterramento_1", nome: "Haste Aterramento Cobreadinha 1\" x 3m" },
      { id: "cabo_cobre_nu_16", nome: "Cabo Cobre Nu 16mm²", unidade: "metro" },
      { id: "cabo_cobre_nu_25", nome: "Cabo Cobre Nu 25mm²", unidade: "metro" },
      { id: "cabo_cobre_nu_35", nome: "Cabo Cobre Nu 35mm²", unidade: "metro" },
      { id: "cabo_cobre_nu_50", nome: "Cabo Cobre Nu 50mm²", unidade: "metro" },
      { id: "caixa_inspecao_aterr", nome: "Caixa de Inspeção Aterramento 30x30" },
      { id: "conector_perfurante_aterr", nome: "Conector Perfurante Haste-Cabo" },
      { id: "barramento_terra_principal", nome: "Barramento Terra Principal" },
      { id: "barramento_neutro", nome: "Barramento Neutro" },
      { id: "fita_sinalizacao", nome: "Fita Sinalizadora Aterramento (amarela)" },
    ],
  },
  {
    id: "bocais",
    nome: "Bocais e Soquetes",
    icone: Cpu,
    itens: [
      { id: "bocal_e27_porcelana", nome: "Bocal/Soquete E27 Porcelana" },
      { id: "bocal_e27_porcelana_rabicho", nome: "Bocal/Soquete E27 Porcelana c/ Rabicho" },
      { id: "bocal_e27_plastico", nome: "Bocal/Soquete E27 Plástico" },
      { id: "bocal_e27_plastico_rabicho", nome: "Bocal/Soquete E27 Plástico c/ Rabicho" },
      { id: "bocal_e27_emborrachado", nome: "Bocal/Soquete E27 Emborrachado E27" },
      { id: "bocal_e14_vela", nome: "Bocal/Soquete E14 Vela" },
      { id: "bocal_g13_t8", nome: "Soquete G13 para Lâmpada Tubular T8" },
      { id: "bocal_g5_t5", nome: "Soquete G5 para Lâmpada Tubular T5" },
      { id: "receptor_presilha_e27", nome: "Receptor/Presilha E27 para Bulbo" },
    ],
  },
  {
    id: "aereo",
    nome: "Aéreo e Infraestrutura",
    icone: HardHat,
    itens: [
      { id: "isolador_pimentao_54x72", nome: "Isolador Tipo Olhal (Pimentão) Porcelana 54x72mm" },
      { id: "isolador_pimentao_60x80", nome: "Isolador Tipo Olhal (Pimentão) Porcelana 60x80mm" },
      { id: "isolador_roldana_porcelana", nome: "Isolador Roldana Porcelana" },
      { id: "alca_pre_formada_dist", nome: "Alça Pré-formada Distribuição (DG)" },
      { id: "alca_pre_formada_serv", nome: "Alça Pré-formada Serviço (SG)" },
      { id: "alca_pre_formada_apcp", nome: "Alça Pré-formada Cabo Coberto (APCP)" },
      { id: "grampo_aterramento_aco", nome: "Grampo Aterramento Aço Inox (par)" },
      { id: "fio_acerado_18_awg", nome: "Fio Acerado 1,22mm (AWG 18) - estai", unidade: "metro" },
      { id: "chave_boia_10a", nome: "Chave Boia Elétrica 10A 1,20m" },
      { id: "chave_boia_16a", nome: "Chave Boia Elétrica 16A 1,50m" },
      { id: "chave_boia_20a", nome: "Chave Boia Elétrica 20A 2,00m" },
      { id: "mordaca_cabo", nome: "Mordça/Grampo Aço p/ Cabo 10mm" },
      { id: "estai_olhal_parafuso", nome: "Estai Olhal Parafuso 500mm" },
    ],
  },
  {
    id: "automacao",
    nome: "Automação e Sensores",
    icone: Activity,
    itens: [
      { id: "sensor_presenca_parede", nome: "Sensor de Presença de Parede 10A" },
      { id: "sensor_presenca_teto", nome: "Sensor de Presença de Teto (embutir)" },
      { id: "sensor_presenca_invisivel", nome: "Sensor de Presença Invisível 12/24V" },
      { id: "rele_fotoeletrico_3f", nome: "Relé Fotoelétrico 3 fios 220V (exterior)" },
      { id: "rele_fotoeletrico_4f", nome: "Relé Fotoelétrico 4 fios 220V" },
      { id: "fotocelula_bivolt", nome: "Fotocélula Bivolt p/ Iluminação" },
      { id: "timer_digital", nome: "Timer/Temporizador Digital 220V" },
      { id: "timer_analogico", nome: "Timer/Temporizador Analógico Bivolt" },
      { id: "minuteria", nome: "Minuteria 220V (escada)" },
      { id: "relogio_programador", nome: "Relógio Programador Semanal 220V" },
      { id: "sonoff_basic", nome: "Sonoff Basic (Wi-Fi)" },
      { id: "sonoff_shelly", nome: "Shelly 2.5 (Wi-Fi)" },
      { id: "interruptor_smart", nome: "Interruptor Smart Wi-Fi (1 tecla)" },
      { id: "modulo_wifi_4ch", nome: "Módulo Wi-Fi 4 Canais" },
      { id: "rele_interface_5v", nome: "Módulo Relé Interface 5V 1 Canal" },
      { id: "rele_interface_12v", nome: "Módulo Relé Interface 12V 1 Canal" },
      { id: "rele_interface_24v", nome: "Módulo Relé Interface 24V 1 Canal" },
      { id: "rele_estado_solido_ssr", nome: "Relé Estado Sólido SSR 5V/2A" },
      { id: "campainha_127v", nome: "Campainha Cigarra 127V" },
      { id: "campainha_220v", nome: "Campainha Cigarra 220V" },
      { id: "tomada_interna_wifi", nome: "Tomada Smart Wi-Fi 10A" },
    ],
  },
  {
    id: "ilum_publica",
    nome: "Iluminação Industrial",
    icone: Sun,
    itens: [
      { id: "luminaria_hermetica_1x36w", nome: "Luminária Hermética 1x36W IP65 120cm" },
      { id: "luminaria_hermetica_2x36w", nome: "Luminária Hermética 2x36W IP65 120cm" },
      { id: "luminaria_hermetica_4x36w", nome: "Luminária Hermética 4x36W IP65 120cm" },
      { id: "luminaria_led_hermetica_36w", nome: "Luminária LED Hermética 36W IP65 120cm" },
      { id: "luminaria_led_hermetica_72w", nome: "Luminária LED Hermética 72W IP65 120cm" },
      { id: "luminaria_calha_2x18w", nome: "Calha/Perfil 2x18W (sobrepor)" },
      { id: "luminaria_calha_4x18w", nome: "Calha/Perfil 4x18W (sobrepor)" },
      { id: "luminaria_publica_50w", nome: "Luminária Pública LED 50W (pétala)" },
      { id: "luminaria_publica_100w", nome: "Luminária Pública LED 100W (pétala)" },
      { id: "luminaria_publica_150w", nome: "Luminária Pública LED 150W (pétala)" },
      { id: "luminaria_publica_200w", nome: "Luminária Pública LED 200W (pétala)" },
      { id: "refletor_area_100w", nome: "Refletor LED 100W Externo (área externa)" },
      { id: "refletor_area_200w", nome: "Refletor LED 200W Externo (área externa)" },
      { id: "refletor_area_300w", nome: "Refletor LED 300W Externo (área externa)" },
      { id: "luminaria_emergencia_30led", nome: "Luminária de Emergência 30 LEDs" },
      { id: "luminaria_emergencia_60led", nome: "Luminária de Emergência 60 LEDs" },
      { id: "luminaria_emergencia_100led", nome: "Luminária de Emergência 100 LEDs" },
      { id: "plafon_emergencia_25w", nome: "Plafon LED c/ Emergência Integrada 25W 8h" },
      { id: "driver_led_18w", nome: "Driver/Fonte LED 18W (painel)" },
      { id: "driver_led_36w", nome: "Driver/Fonte LED 36W (painel)" },
      { id: "driver_led_50w", nome: "Driver/Fonte LED 50W" },
      { id: "reator_eletronico_2x18w", nome: "Reator Eletrônico 2x18W (tubular T8)" },
      { id: "reator_eletronico_2x36w", nome: "Reator Eletrônico 2x36W (tubular T8)" },
    ],
  },
  {
    id: "seguranca",
    nome: "Alarme e Segurança",
    icone: ShieldAlert,
    itens: [
      { id: "sensor_fumaca", nome: "Detector/Sensor de Fumaça 9V" },
      { id: "sensor_fumaca_wireless", nome: "Detector de Fumaça Wireless" },
      { id: "sensor_gas_glp", nome: "Detector de Gás GLP/GLP (tomada)" },
      { id: "sensor_monoxido", nome: "Detector de Monóxido de Carbono (CO)" },
      { id: "central_alarme", nome: "Central de Alarme 8/16 zonas" },
      { id: "sensor_magnetico", nome: "Sensor Magnético Porta/Janela" },
      { id: "sensor_iv", nome: "Sensor Infravermelho Passivo (IVP)" },
      { id: "sirene_12v", nome: "Sirene 12V (para central alarme)" },
      { id: "botao_panico", nome: "Botão de Pânico" },
      { id: "cerca_eletrica_16awg", nome: "Fio/Cabo para Cerca Elétrica 16 AWG", unidade: "metro" },
      { id: "central_cerca_eletrica", nome: "Central Cercana Elétrica 16/32 zonas" },
      { id: "concertina_300mm", nome: "Concertina 300mm (espira 450mm)" },
      { id: "concertina_500mm", nome: "Concertina 500mm (espira 630mm)" },
      { id: "sopraluz_cerca", nome: "Sopraluz/LED Cerca Elétrica" },
      { id: "strobo_alarme", nome: "Strobo Sirene para Alarme" },
    ],
  },
  {
    id: "industria",
    nome: "Automação Industrial",
    icone: Activity,
    itens: [
      { id: "inversor_frequencia_1cv", nome: "Inversor de Frequência 1CV 220V (WEG/CJXi)" },
      { id: "inversor_frequencia_2cv", nome: "Inversor de Frequência 2CV 220V" },
      { id: "inversor_frequencia_3cv", nome: "Inversor de Frequência 3CV 220V" },
      { id: "inversor_frequencia_5cv", nome: "Inversor de Frequência 5CV 220V" },
      { id: "motor_1_4cv", nome: "Motor Elétrico 1/4CV 220V (monofásico)" },
      { id: "motor_1_3cv", nome: "Motor Elétrico 1/3CV 220V (monofásico)" },
      { id: "motor_1_2cv", nome: "Motor Elétrico 1/2CV 220V (monofásico)" },
      { id: "motor_1cv", nome: "Motor Elétrico 1CV 220V (monofásico)" },
      { id: "motor_2cv", nome: "Motor Elétrico 2CV 220V (monofásico)" },
      { id: "motor_3cv", nome: "Motor Elétrico 3CV 220V/380V (trifásico)" },
      { id: "motor_5cv", nome: "Motor Elétrico 5CV 220V/380V (trifásico)" },
      { id: "motor_portao_1_4hp", nome: "Motor Basculante 1/4HP 300kg 127V" },
      { id: "motor_portao_1_3hp", nome: "Motor Basculante 1/3HP 300kg 127/220V" },
      { id: "motor_portao_1_2hp", nome: "Motor Basculante 1/2HP 350kg 220V" },
      { id: "motor_deslizante", nome: "Motor Deslizante (corrediço) 1/2HP" },
      { id: "motor_elevador", nome: "Motor Elevador de Portão Garagem 1/2HP" },
      { id: "placa_central_portao", nome: "Placa Central p/ Motor Portão" },
      { id: "cremalheira_portao", nome: "Cremalheira Nylon p/ Portão Deslizante (1m)" },
      { id: "contator_9a", nome: "Contator 9A 220V (3NA)" },
      { id: "contator_12a", nome: "Contator 12A 220V (3NA)" },
      { id: "contator_18a", nome: "Contator 18A 220V (3NA)" },
      { id: "contator_25a", nome: "Contator 25A 220V (3NA)" },
      { id: "contator_32a", nome: "Contator 32A 220V (3NA)" },
      { id: "contator_40a", nome: "Contator 40A 220V (3NA)" },
      { id: "rele_termico_1a_3a", nome: "Relé Térmico 1-3A" },
      { id: "rele_termico_3a_6a", nome: "Relé Térmico 3-6A" },
      { id: "rele_termico_6a_10a", nome: "Relé Térmico 6-10A" },
      { id: "rele_termico_10a_16a", nome: "Relé Térmico 10-16A" },
      { id: "rele_termico_16a_24a", nome: "Relé Térmico 16-24A" },
      { id: "botao_emergencia", nome: "Botão de Emergência (desliga)" },
      { id: "botao_seta", nome: "Botão Seta (liga)" },
      { id: "chave_turn", nome: "Chave Turn/Seletora 3 posições" },
      { id: "chave_joystick", nome: "Chave Joystick 4 direções" },
      { id: "limitador_curso", nome: "Limitador de Curso ( fim de curso)" },
      { id: "enconder_motor", nome: "Encoder para Motor (incremental)" },
      { id: "sensor_indutivo", nome: "Sensor Indutivo (NPN/PNP) 12-24V" },
      { id: "sensor_capacitivo", nome: "Sensor Capacitivo 12-24V" },
      { id: "sensor_fotoeletrico_indust", nome: "Sensor Fotoelétrico Barreira 12-24V" },
      { id: "modulo_plc_8i_8q", nome: "Módulo PLC 8 Entradas + 8 Saídas" },
      { id: "inversor_solar_1500w", nome: "Inversor Solar Off-Grid 1500W 12V/220V" },
      { id: "inversor_solar_3000w", nome: "Inversor Solar Off-Grid 3000W 24V/220V" },
      { id: "controlador_carga_solar", nome: "Controlador de Carga Solar 10A" },
      { id: "controlador_carga_solar_30a", nome: "Controlador de Carga Solar 30A" },
      { id: "bateria_solar_100ah", nome: "Bateria Solar 100Ah 12V (estacionária)" },
      { id: "bateria_solar_150ah", nome: "Bateria Solar 150Ah 12V (estacionária)" },
    ],
  },
];

const COMODOS_PADRAO = [
  "Quarto 1",
  "Quarto 2",
  "Suíte",
  "Sala",
  "Cozinha",
  "Banheiro Social",
  "Banheiro Suíte",
  "Área de Serviço",
  "Garagem",
  "Escritório",
  "Corredor",
  "Área Externa",
  "Área Gourmet",
  "Depósito",
];

/* ---------------- storage ---------------- */

const STORAGE_KEY = "orcamento_rapido_v2";
const USAGE_KEY = "orcamento_rapido_usados_v1";

type UsoItem = {
  id: string;
  nome: string;
  count: number;
};

function carregarUsados(): UsoItem[] {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (u): u is UsoItem =>
        u && typeof u.id === "string" && typeof u.nome === "string" && typeof u.count === "number"
    );
  } catch {
    return [];
  }
}

// buffer de escritas pendentes, com flush por debounce ou antes de fechar a aba
let bufferUsados: UsoItem[] | null = null;
let timerFlush: ReturnType<typeof setTimeout> | null = null;

function flushUsados() {
  if (bufferUsados) {
    try {
      localStorage.setItem(USAGE_KEY, JSON.stringify(bufferUsados));
    } catch {
      // storage cheio — ignora silenciosamente
    }
    bufferUsados = null;
  }
  if (timerFlush) {
    clearTimeout(timerFlush);
    timerFlush = null;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushUsados);
}

function registrarUso(itemId: string, nomeItem: string) {
  const usados = bufferUsados ?? carregarUsados();
  const existente = usados.find((u) => u.id === itemId);
  if (existente) {
    existente.count += 1;
  } else {
    usados.push({ id: itemId, nome: nomeItem, count: 1 });
  }
  // mantém só os top 50 por count
  usados.sort((a, b) => b.count - a.count);
  bufferUsados = usados.slice(0, 50);
  // debounce: agrupa múltiplos cliques numa escrita só
  if (timerFlush) clearTimeout(timerFlush);
  timerFlush = setTimeout(flushUsados, 500);
}

function carregarComodos(): Comodo[] {
  try {
    const bruto = localStorage.getItem(STORAGE_KEY);
    if (!bruto) return [];
    const parsed = JSON.parse(bruto);
    // migração: detectar formato antigo ou corrompido
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is Comodo =>
        c &&
        typeof c.id === "string" &&
        typeof c.nome === "string" &&
        Array.isArray(c.items) &&
        c.items.every(
          (it: { id: unknown; nome: unknown; quantidade: unknown }) =>
            typeof it.id === "string" &&
            typeof it.nome === "string" &&
            typeof it.quantidade === "number" &&
            Number.isFinite(it.quantidade)
        ) &&
        Array.isArray(c.personalizado) &&
        c.personalizado.every(
          (it: { id: unknown; nome: unknown; quantidade: unknown }) =>
            typeof it.id === "string" &&
            typeof it.nome === "string" &&
            typeof it.quantidade === "number" &&
            Number.isFinite(it.quantidade)
        )
    );
  } catch {
    return [];
  }
}

function idAleatorio(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------------- componente ---------------- */

export default function OrcamentoRapido(): ReactElement {
  const [estadoInicial] = useState(() => {
    const dados = carregarComodos();
    return { dados, ativo: dados[0]?.id ?? "" };
  });
  const [comodos, setComodos] = useState<Comodo[]>(estadoInicial.dados);
  const [comodoAtivo, setComodoAtivo] = useState<string>(estadoInicial.ativo);
  const [mostrarListaGeral, setMostrarListaGeral] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [novoComodo, setNovoComodo] = useState("");
  const [itemPersonalizado, setItemPersonalizado] = useState("");
  const [mostrarTodasCats, setMostrarTodasCats] = useState(false);
  const [usados, setUsados] = useState<UsoItem[]>(() => carregarUsados());

  // persiste com debounce de 500ms para evitar writes síncronos a cada clique
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(comodos));
    }, 500);
    return () => clearTimeout(timer);
  }, [comodos]);

  // sincroniza com alterações de outras abas
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const dados = carregarComodos();
      setComodos(dados);
      if (comodoAtivo && !dados.find((c) => c.id === comodoAtivo)) {
        setComodoAtivo(dados[0]?.id ?? "");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [comodoAtivo]);

  const comodoAtual = comodos.find((c) => c.id === comodoAtivo);

  function adicionarComodo() {
    const nome = novoComodo.trim();
    if (!nome) return;
    const novo: Comodo = {
      id: idAleatorio(),
      nome,
      items: [],
      personalizado: [],
    };
    setComodos((prev) => [...prev, novo]);
    setComodoAtivo(novo.id);
    setNovoComodo("");
  }

  function removerComodo(id: string) {
    const restantes = comodos.filter((c) => c.id !== id);
    setComodos(restantes);
    if (comodoAtivo === id) setComodoAtivo(restantes[0]?.id ?? "");
    if (restantes.length === 0) setMostrarListaGeral(false);
  }

  function adicionarItemPreDefinido(
    itemId: string,
    nomeItem: string,
    unidade?: string
  ) {
    if (!comodoAtivo) return;
    // registra uso para "mais usados"
    registrarUso(itemId, nomeItem);
    setUsados(carregarUsados());
    setComodos((prev) =>
      prev.map((c) => {
        if (c.id !== comodoAtivo) return c;
        const jaTem = c.items.find((it) => it.id === itemId);
        if (jaTem) {
          return {
            ...c,
            items: c.items.map((it) =>
              it.id === itemId ? { ...it, quantidade: it.quantidade + 1 } : it
            ),
          };
        }
        return {
          ...c,
          items: [
            ...c.items,
            { id: itemId, nome: nomeItem, quantidade: 1, unidade },
          ],
        };
      })
    );
  }

  function ajustarItem(itemId: string, delta: number) {
    setComodos((prev) =>
      prev.map((c) => {
        if (c.id !== comodoAtivo) return c;
        const prox = c.items
          .map((it) =>
            it.id === itemId
              ? { ...it, quantidade: Math.max(0, Math.round(it.quantidade + delta)) }
              : it
          )
          .filter((it) => it.quantidade > 0);
        return { ...c, items: prox };
      })
    );
  }

  function removerItem(itemId: string) {
    const targetId = comodoAtivo;
    setComodos((prev) =>
      prev.map((c) =>
        c.id === targetId
          ? { ...c, items: c.items.filter((it) => it.id !== itemId) }
          : c
      )
    );
  }

  function adicionarItemPersonalizado() {
    const nome = itemPersonalizado.trim();
    if (!nome || !comodoAtivo) return;
    setComodos((prev) =>
      prev.map((c) => {
        if (c.id !== comodoAtivo) return c;
        const jaTem = c.personalizado.find(
          (it) => it.nome.trim().toLowerCase() === nome.toLowerCase()
        );
        if (jaTem) {
          return {
            ...c,
            personalizado: c.personalizado.map((it) =>
              it.nome.trim().toLowerCase() === nome.toLowerCase()
                ? { ...it, quantidade: it.quantidade + 1 }
                : it
            ),
          };
        }
        return {
          ...c,
          personalizado: [
            ...c.personalizado,
            { id: idAleatorio(), nome, quantidade: 1 },
          ],
        };
      })
    );
    setItemPersonalizado("");
  }

  function ajustarPersonalizado(personalizadoId: string, delta: number) {
    setComodos((prev) =>
      prev.map((c) => {
        if (c.id !== comodoAtivo) return c;
        const prox = c.personalizado
          .map((it) =>
            it.id === personalizadoId
              ? { ...it, quantidade: Math.max(0, Math.round(it.quantidade + delta)) }
              : it
          )
          .filter((it) => it.quantidade > 0);
        return { ...c, personalizado: prox };
      })
    );
  }

  function removerPersonalizado(personalizadoId: string) {
    setComodos((prev) =>
      prev.map((c) =>
        c.id === comodoAtivo
          ? {
              ...c,
              personalizado: c.personalizado.filter(
                (it) => it.id !== personalizadoId
              ),
            }
          : c
      )
    );
  }

  function limparComodo(id: string) {
    const targetId = id;
    setComodos((prev) =>
      prev.map((c) =>
        c.id === targetId ? { ...c, items: [], personalizado: [] } : c
      )
    );
  }

  function formatarLinhaItem(nome: string, qtd: number, unidade?: string): string {
    if (!nome.trim()) return "";
    if (unidade === "metro") {
      const sufixo = qtd === 1 ? "metro" : "metros";
      return `  ${qtd} ${sufixo} - ${nome}`;
    }
    return `  ${qtd} un - ${nome}`;
  }

  function gerarTextoGeral(): string {
    const linhas: string[] = [];
    linhas.push("*LISTA DE MATERIAIS*");
    linhas.push("==============================");
    linhas.push("");

    for (const comodo of comodos) {
      const temItens =
        comodo.items.length > 0 || comodo.personalizado.length > 0;
      if (!temItens) continue;

      linhas.push(`*${comodo.nome.toUpperCase()}*`);
      linhas.push("------------------------------");

      for (const it of comodo.items) {
        linhas.push(formatarLinhaItem(it.nome, it.quantidade, it.unidade));
      }
      for (const it of comodo.personalizado) {
        linhas.push(formatarLinhaItem(it.nome, it.quantidade));
      }
      linhas.push("");
    }

    linhas.push("==============================");
    linhas.push("Enviado via Portal Elétrico");

    return linhas.join("\n");
  }

  function copiarTexto() {
    const texto = gerarTextoGeral();
    navigator.clipboard.writeText(texto).then(
      () => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      },
      () => {
        // fallback: mostra alerta se clipboard falhar
        alert("Não foi possível copiar. Tente novamente ou selecione o texto manualmente.");
      }
    );
  }

  function enviarWhatsApp() {
    const texto = encodeURIComponent(gerarTextoGeral());
    const opened = window.open(`https://wa.me/?text=${texto}`, "_blank");
    if (!opened) {
      alert("Não foi possível abrir o WhatsApp. Verifique se o popup está bloqueado e tente novamente.");
    }
  }

  function imprimir() {
    window.print();
  }

  const totalItens = comodos.reduce((acc, c) => {
    return (
      acc +
      c.items.reduce((s, it) => s + it.quantidade, 0) +
      c.personalizado.reduce((s, it) => s + it.quantidade, 0)
    );
  }, 0);

  function chipItemPre(
    it: ItemPre,
    ehAtivo: boolean
  ): ReactElement {
    return (
      <span
        key={it.id}
        className="material-selected-item"
      >
        <span className="truncate max-w-[180px]">{it.nome}</span>
        {ehAtivo && (
          <span className="inline-flex items-center gap-1 ml-1">
            <button
              type="button"
              onClick={() => ajustarItem(it.id, -1)}
              className="material-quantity-button"
              aria-label={`Diminuir ${it.nome}`}
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="material-quantity-value">
              {it.unidade === "metro" ? `${it.quantidade}m` : it.quantidade}
            </span>
            <button
              type="button"
              onClick={() => ajustarItem(it.id, +1)}
              className="material-quantity-button"
              aria-label={`Aumentar ${it.nome}`}
            >
              <Plus className="w-3 h-3" />
            </button>
          </span>
        )}
        <button
          type="button"
          onClick={() => removerItem(it.id)}
          className="material-remove-button"
          aria-label={`Remover ${it.nome}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </span>
    );
  }

  function chipPersonalizado(
    it: ItemPersonalizado,
    ehAtivo: boolean
  ): ReactElement {
    return (
      <span
        key={it.id}
        className="material-selected-item"
      >
        <span className="truncate max-w-[180px]">{it.nome}</span>
        {ehAtivo && (
          <span className="inline-flex items-center gap-1 ml-1">
            <button
              type="button"
              onClick={() => ajustarPersonalizado(it.id, -1)}
              className="material-quantity-button"
              aria-label={`Diminuir ${it.nome}`}
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="material-quantity-value">
              {it.quantidade}
            </span>
            <button
              type="button"
              onClick={() => ajustarPersonalizado(it.id, +1)}
              className="material-quantity-button"
              aria-label={`Aumentar ${it.nome}`}
            >
              <Plus className="w-3 h-3" />
            </button>
          </span>
        )}
        <button
          type="button"
          onClick={() => removerPersonalizado(it.id)}
          className="material-remove-button"
          aria-label={`Remover ${it.nome}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </span>
    );
  }

  return (
    <div className="product-page material-page">
      <div>
        <header className="page-header no-print">
          <div>
            <span className="page-kicker">Ferramentas / levantamento</span>
            <h1>Orçamento rápido</h1>
            <p>Monte uma lista de materiais por ambiente e envie ao cliente sem incluir preços.</p>
          </div>
          <div className="page-actions">
            <button
              onClick={copiarTexto}
              className="btn-secondary"
              disabled={totalItens === 0}
            >
              {copiado ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copiado ? "Copiado!" : "Copiar"}
            </button>
            <button
              onClick={enviarWhatsApp}
              className="btn-primary"
              disabled={totalItens === 0}
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </button>
            <button
              onClick={imprimir}
              aria-label="Imprimir orçamento"
              className="icon-button"
              disabled={totalItens === 0}
            >
              <Printer className="w-4 h-4" />
              <span className="hidden print:inline">Imprimir</span>
            </button>
          </div>
        </header>

        <section className="metric-strip no-print" aria-label="Resumo do levantamento">
          <div className="metric">
            <span>Ambientes</span>
            <strong>{comodos.length}</strong>
            <small>organizados no orçamento</small>
          </div>
          <div className="metric">
            <span>Quantidade total</span>
            <strong>{totalItens}</strong>
            <small>unidades e metros</small>
          </div>
          <div className="metric">
            <span>Ambiente atual</span>
            <strong className="material-current-room">{comodoAtual?.nome || "Nenhum"}</strong>
            <small>{comodoAtual ? `${totalItensDoComodo(comodoAtual)} itens selecionados` : "adicione ou escolha um ambiente"}</small>
          </div>
        </section>

        <div className="material-workspace">
          {/* Painel esquerdo: cômodos */}
          <aside className="surface-card material-room-panel no-print">
              <div className="material-panel-heading">
                <div>
                  <span>Etapa 01</span>
                  <h2>Ambientes</h2>
                </div>
                <strong>{comodos.length}</strong>
              </div>

              {/* Adicionar cômodo */}
              <label className="field-label" htmlFor="novo-comodo">Adicionar ambiente</label>
              <div className="material-add-row">
                <input
                  id="novo-comodo"
                  type="text"
                  value={novoComodo}
                  onChange={(e) => setNovoComodo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && adicionarComodo()}
                  placeholder="Ex.: Quarto suíte"
                  list="comodos-lista"
                  className="input-base"
                />
                <datalist id="comodos-lista">
                  {COMODOS_PADRAO.filter(
                    (c) => !comodos.find((x) => x.nome === c)
                  ).map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <button
                  onClick={adicionarComodo}
                  className="material-add-button"
                  aria-label="Adicionar cômodo"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Lista de cômodos */}
              <div className="material-room-list">
                {comodos.length === 0 && (
                  <p className="material-room-empty">
                    Comece adicionando o primeiro ambiente.
                  </p>
                )}
                {comodos.map((c) => {
                  const qtd =
                    c.items.reduce((s, it) => s + it.quantidade, 0) +
                    c.personalizado.reduce((s, it) => s + it.quantidade, 0);
                  const ativo = c.id === comodoAtivo;
                  return (
                    <div key={c.id} className="room-row" data-active={ativo}>
                      <button type="button" onClick={() => setComodoAtivo(c.id)} aria-pressed={ativo}>
                        <span className="material-room-index">{String(comodos.indexOf(c) + 1).padStart(2, "0")}</span>
                        <span className="truncate font-medium">{c.nome}</span>
                        {qtd > 0 && (
                          <span className="material-room-count">
                            {qtd}
                          </span>
                        )}
                      </button>
                      <button type="button" onClick={() => removerComodo(c.id)} className="icon-button" aria-label={`Remover ambiente ${c.nome}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Resumo */}
              {comodos.length > 0 && (
                <div className="material-room-footer">
                  <button
                    onClick={() => setMostrarListaGeral(!mostrarListaGeral)}
                    className="btn-secondary"
                    aria-expanded={mostrarListaGeral}
                  >
                    <FileText className="w-4 h-4" />
                    {mostrarListaGeral ? "Ocultar lista" : "Ver lista completa"}
                    <ChevronRight
                      className={`w-4 h-4 transition ${
                        mostrarListaGeral ? "rotate-90" : ""
                      }`}
                    />
                  </button>
                </div>
              )}
          </aside>

          {/* Painel direito */}
          <main className="material-main">
            {!comodoAtivo ? (
              <div className="surface-card empty-state material-empty-state no-print">
                <Package />
                <h2>Escolha um ambiente</h2>
                <p>
                  Selecione um ambiente ao lado para começar o levantamento de materiais.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => document.getElementById("novo-comodo")?.focus()}
                >
                  <Plus className="w-4 h-4" />
                  Adicionar ambiente
                </button>
              </div>
            ) : (
              <div className="surface-card material-editor no-print">
                {/* Info do cômodo ativo */}
                <div className="material-editor-header">
                  <div>
                    <span>Etapa 02 · Materiais do ambiente</span>
                    <h2>{comodoAtual?.nome}</h2>
                    {(() => {
                      const qtdDoComodo = totalItensDoComodo(comodoAtual);
                      return (
                        <p>
                          {qtdDoComodo}{" "}
                          {qtdDoComodo === 1 ? "item adicionado" : "itens adicionados"}
                        </p>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => limparComodo(comodoAtivo)}
                    className="material-clear-button"
                  >
                    <Trash2 className="w-4 h-4" />
                    Limpar
                  </button>
                </div>

                {/* Itens já adicionados neste cômodo */}
                {comodoAtual &&
                  (comodoAtual.items.length > 0 ||
                    comodoAtual.personalizado.length > 0) && (
                    <section className="material-selection">
                      <h3>
                        <Check className="w-4 h-4" />
                        Selecionados neste ambiente
                      </h3>
                      <div className="material-selection-list">
                        {comodoAtual.items.map((it) =>
                          chipItemPre(it, true)
                        )}
                        {comodoAtual.personalizado.map((it) =>
                          chipPersonalizado(it, true)
                        )}
                      </div>
                      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                        {(comodoAtual.items.length + comodoAtual.personalizado.length)} item(s) no cômodo.
                      </p>
                      <p className="material-help">
                        Ajuste quantidade com menos e mais. Use lixeira para remover.
                      </p>
                    </section>
                  )}

                {/* Campo personalizado */}
                <section className="material-section material-custom-item">
                  <div className="material-section-heading">
                    <div>
                      <span>Entrada manual</span>
                      <h3>Item fora do catálogo</h3>
                    </div>
                  </div>
                  <label className="field-label" htmlFor="item-personalizado">Descrição do material</label>
                  <div className="material-add-row">
                    <input
                      id="item-personalizado"
                      type="text"
                      value={itemPersonalizado}
                      onChange={(e) => setItemPersonalizado(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && adicionarItemPersonalizado()
                      }
                      placeholder="Ex: Fio flex 4mm², Tubo 20mm..."
                      className="input-base"
                    />
                    <button
                      onClick={adicionarItemPersonalizado}
                      className="material-add-button material-add-button-wide"
                      aria-label="Adicionar item personalizado"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </section>

                {/* Mais Usados */}
                {usados.filter((u) => u.count >= 1).length > 0 && (
                  <section className="material-section">
                    <div className="material-section-heading">
                      <div>
                        <span>Atalhos pessoais</span>
                        <h3><TrendingUp className="w-4 h-4" /> Mais usados</h3>
                      </div>
                      <small>Baseado nas seleções recentes</small>
                    </div>
                    <div className="material-item-grid">
                      {usados
                        .filter((u) => u.count >= 1)
                        .slice(0, 12)
                        .map((u) => {
                          // busca item no catálogo para obter unidade
                          let unidade: string | undefined;
                          for (const cat of CATEGORIAS) {
                            const achado = cat.itens.find((it) => it.id === u.id);
                            if (achado) {
                              unidade = achado.unidade;
                              break;
                            }
                          }
                          const jaAdicionado = comodoAtual?.items.find(
                            (it) => it.id === u.id
                          );
                          const qtdJa = jaAdicionado?.quantidade || 0;
                          return (
                            <button
                              key={u.id}
                              onClick={() =>
                                adicionarItemPreDefinido(u.id, u.nome, unidade)
                              }
                              className="material-catalog-item"
                              data-selected={qtdJa > 0}
                            >
                              <Star className="w-4 h-4 shrink-0" />
                              <span className="truncate flex-1">{u.nome}</span>
                              {qtdJa > 0 && (
                                <span className="material-item-count">
                                  {qtdJa}
                                </span>
                              )}
                              <span className="material-use-count">
                                {u.count}x
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </section>
                )}

                {/* Categorias */}
                <section className="material-catalog">
                  <button
                    onClick={() => setMostrarTodasCats(!mostrarTodasCats)}
                    className="material-catalog-toggle"
                    aria-expanded={mostrarTodasCats}
                  >
                    <span><span>Catálogo técnico</span><strong>Todas as categorias</strong></span>
                    <small>{CATEGORIAS.length} categorias</small>
                    <ChevronRight
                      className={`w-4 h-4 transition ${
                        mostrarTodasCats ? "rotate-90" : ""
                      }`}
                    />
                  </button>

                  {mostrarTodasCats &&
                    CATEGORIAS.map((cat) => {
                      const Icon = cat.icone;
                      return (
                        <section
                          key={cat.id}
                          className="material-category"
                        >
                          <div className="material-category-heading">
                            <Icon className="w-4 h-4" />
                            <h3>
                              {cat.nome}
                            </h3>
                            <span>
                              {cat.itens.length} opções
                            </span>
                          </div>
                          <div className="material-item-grid">
                            {cat.itens.map((item) => {
                              const jaAdicionado =
                                comodoAtual?.items.find(
                                  (it) => it.id === item.id
                                );
                              const qtdJa = jaAdicionado?.quantidade || 0;
                              return (
                                <button
                                  key={item.id}
                                  onClick={() =>
                                    adicionarItemPreDefinido(
                                      item.id,
                                      item.nome,
                                      item.unidade
                                    )
                                  }
                                  className="material-catalog-item"
                                  data-selected={qtdJa > 0}
                                >
                                  {qtdJa > 0 ? (
                                    <span className="material-item-count">
                                      {qtdJa}
                                    </span>
                                  ) : (
                                    <Plus className="w-4 h-4 shrink-0" />
                                  )}
                                  <span className="truncate">{item.nome}</span>
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                </section>
              </div>
            )}

            {/* Lista completa geral */}
            {mostrarListaGeral && comodos.length > 0 && (
              <section className="surface-card material-summary print:mt-2">
                <div className="material-summary-header">
                  <div>
                    <span>Documento para envio</span>
                    <h2><FileText className="w-5 h-5" /> Lista completa</h2>
                  </div>
                  <strong>{totalItens} itens</strong>
                </div>
                {comodos
                  .filter((c) => {
                    const qtd =
                      c.items.reduce((s, it) => s + it.quantidade, 0) +
                      c.personalizado.reduce((s, it) => s + it.quantidade, 0);
                    return qtd > 0;
                  })
                  .map((c) => {
                    const qtd =
                      c.items.reduce((s, it) => s + it.quantidade, 0) +
                      c.personalizado.reduce((s, it) => s + it.quantidade, 0);
                    return (
                      <section key={c.id} className="material-summary-room">
                        <header>
                          <span>{c.nome}</span>
                          <small>{qtd} {qtd === 1 ? "item" : "itens"}</small>
                          <button
                            onClick={() => limparComodo(c.id)}
                            className="material-clear-button no-print"
                          >
                            <Trash2 className="w-4 h-4" /> Limpar
                          </button>
                        </header>
                        <ul>
                          {c.items.map((it) => (
                            <li
                              key={it.id}
                              className="material-summary-item"
                            >
                              <span>{formatarLinhaItem(it.nome, it.quantidade, it.unidade).trim()}</span>
                            </li>
                          ))}
                          {c.personalizado.map((it) => (
                            <li
                              key={it.id}
                              className="material-summary-item"
                            >
                              <span>{formatarLinhaItem(it.nome, it.quantidade).trim()}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                <div className="material-summary-footer">
                  <span>Total do levantamento</span>
                  <strong>{totalItens} itens em {comodos.length} ambientes</strong>
                </div>
              </section>
            )}
          </main>
        </div>

        {/* Print styles */}
        <style>{`
          @media print {
            button, input, .no-print { display: none !important; }
            .print\\:inline { display: inline !important; }
            .bg-slate-50 { background: white !important; }
            .shadow-sm { box-shadow: none !important; }
            .min-h-screen { min-height: auto !important; }
            body { background: white !important; }
          }
        `}</style>
      </div>
    </div>
  );
}

function totalItensDoComodo(c?: Comodo): number {
  if (!c) return 0;
  return (
    c.items.reduce((s, it) => s + it.quantidade, 0) +
    c.personalizado.reduce((s, it) => s + it.quantidade, 0)
  );
}
