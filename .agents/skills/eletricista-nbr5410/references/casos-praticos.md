# Casos Práticos — Cálculos Elétricos

## Caso 1: Residência — Dimensionar circuito de chuveiro

**Dados:**
- Chuveiro: 5500 W
- Tensão: 220 V (monofásico)
- Fator de potência: 1,0 (carga resistiva)
- Distância do quadro: 18 m (ida) → 36 m (ida+volta)
- Temperatura ambiente: 30°C
- 3 circuitos no mesmo eletroduto

**Cálculos:**

**1) Corrente:**
```
I = P / (V × FP)
I = 5500 / (220 × 1,0)
I = 25 A
```

**2) Bitola (sem fator de correção):**
Tabela: precisa ampacidade ≥ 25 A → **6 mm² (41 A)** ou maior.

**3) Aplicar fatores:**
- Agrupamento (3 circuitos): fator 0,70
- Corrente corrigida: 25 / 0,70 = **35,7 A**
- Ampacidade necessária: ≥ 35,7 A
- Bitola: **10 mm² (57 A)** ← aumenta por causa do fator

**4) Queda de tensão:**
```
ΔV = (2 × 0,0172 × 36 × 25) / 10 = 3,10 V
ΔV% = (3,10 / 220) × 100 = 1,4%
```
✅ Bem abaixo do limite (7% para tomadas).

**Resultado:** Cabo de **10 mm²** cobre, disjuntor **32 A**.

---

## Caso 2: Comércio — Circuito de ar-condicionado

**Dados:**
- Ar-condicionado 12000 BTU: 1200 W
- Tensão: 220 V (monofásico)
- FP: 0,9
- Distância: 12 m (24 m total)
- Temperatura: 35°C → fator 0,94

**Cálculos:**

**1) Corrente:**
```
I = 1200 / (220 × 0,9) = 6,06 A
```

**2) Bitola (sem correção):**
Tabela: precisa ≥ 6 A → **2,5 mm² (24 A)** ou maior.

**3) Aplicar fator:**
- Temperatura 35°C: fator 0,94
- Corrente corrigida: 6,06 / 0,94 = **6,45 A**
- Bitola: **4 mm² (32 A)** ← mínimo comercial confiável

**Resultado:** Cabo de **4 mm²**, disjuntor **20 A**.

---

## Caso 3: Indústria — Cálculo de demanda

**Dados:**
- Cargas de uma pequena oficina:
  - Iluminação: 2000 W
  - Tomadas (TUGs): 5000 W
  - Ar-condicionado: 3000 W
  - Chuveiro: 5500 W
- Tensão: 220 V (monofásico)
- FP global: 0,92

**Cálculo de demanda:**

| Carga             | Potência (W) | Fator | Demanda (W) |
|-------------------|--------------|-------|-------------|
| Iluminação        | 2000         | 0,8   | 1600        |
| Tomadas (TUGs)    | 5000         | 0,5   | 2500        |
| Ar-condicionado   | 3000         | 1,0   | 3000        |
| Chuveiro          | 5500         | 1,0   | 5500        |
| **Total**         | **15500**    |       | **12600**   |

**Demanda = 12,6 kW**
**Corrente demanda = 12600 / (220 × 0,92) = 62,3 A**

**Disjuntor geral recomendado: 63 A** (padrão comercial mais próximo)

---

## Caso 4: Fator de potência e correção

**Dados:**
- Potência ativa: 30 kW
- FP atual: 0,75
- FP desejado: 0,92 (limite da concessionária)

**Cálculo do capacitor:**

```
φ1 = arccos(0,75) = 41,4°
φ2 = arccos(0,92) = 23,1°

Qc = 30 × (tan(41,4°) - tan(23,1°))
Qc = 30 × (0,882 - 0,425)
Qc = 30 × 0,457
Qc = 13,7 kVAr
```

**Resultado:** Banco de capacitores de **15 kVAr** (próximo valor comercial).

---

## Caso 5: Queda de tensão crítica

**Dados:**
- Carga: 15000 W
- Tensão: 220 V (monofásico)
- Distância: 80 m
- Cabo atual: 6 mm²

**Cálculos:**

**1) Corrente:**
```
I = 15000 / 220 = 68,2 A
```

**2) Queda de tensão:**
```
ΔV = (2 × 0,0172 × 160 × 68,2) / 6 = 62,5 V
ΔV% = (62,5 / 220) × 100 = 28,4%
```

❌ **Muito acima do limite de 7%!**

**3) Cabo necessário para limitar a 4% (= 8,8V):**
```
A = (2 × 0,0172 × 160 × 68,2) / 8,8 = 42,6 mm²
```

**Resultado:** Cabo de **50 mm²** (próximo valor comercial acima de 42,6 mm²). Ou dividir o circuito em 2 com cabos de 25 mm².

**Alternativa prática:** Aumentar tensão para trifásico 380V, recálculo:

```
I = 15000 / (√3 × 380) = 22,8 A
ΔV% = (17,4 / 380) × 100 = 4,6% (ainda alto, mas reduziu)
```

---

## Caso 6: Eletroduto superlotado

**Dados:**
- 3 condutores de 10 mm² (cobre, diâmetro externo ~7mm)
- 2 condutores de 6 mm² (cobre, diâmetro externo ~5,6mm)
- Eletroduto disponível: 25 mm (PVC rígido)

**Cálculos:**

**1) Área total dos condutores:**
- 3 × 10 mm² = 3 × 38 mm² = 114 mm²
- 2 × 6 mm² = 2 × 25 mm² = 50 mm²
- Total = **164 mm²**

**2) Capacidade do eletroduto:**
- 25 mm PVC rígido: 215 mm² total
- 40% = **86 mm² disponíveis**

**Resultado:** ❌ Eletroduto **suportado por 164 mm²** mas só cabem 86 mm²!

**Solução:** Usar eletroduto de **32 mm** (553 mm² × 40% = 221 mm²) ou separar em 2 eletrodutos de 25 mm.

---

## Caso 7: Aterramento residencial

**Dados:**
- 1 haste de aço cobreado (2,4 m, ø 13 mm)
- Solo argiloso (resistividade ~100 Ω·m)

**Cálculo:**

**Resistência da haste:**
```
R = ρ / (2 × π × L)
R = 100 / (2 × 3,14159 × 2,4)
R ≈ 6,6 Ω
```

✅ **Bem abaixo de 50 Ω** (limite NBR 5410).

**Adicionar 2ª haste em paralelo:**
```
R_eq = 6,6 / 2 = 3,3 Ω
```

Em solos arenosos (ρ ~ 500 Ω·m), hastes adicionais podem ser necessárias.

---

## Caso 8: Conversor monofásico-trifásico

**Cliente tem:**
- Chuveiro 5500W, 220V (mono)
- Motor trifásico 7,5cv (5,5 kW), 380V

**Chuveiro (monofásico):**
```
I = 5500 / 220 = 25 A
Cabo: 6 mm² (FP=1)
Disjuntor: 32 A
```

**Motor trifásico:**
```
P_mec = 7,5 cv × 736 = 5520 W
η (rendimento) = 0,85
P_el = 5520 / 0,85 = 6494 W

I = P / (√3 × V × FP × η)
I = 6494 / (1,732 × 380 × 0,85 × 0,85)
I = 13,7 A
```

**Cabo (motor):** 4 mm² (32 A) ou 2,5 mm² (24 A) → usar **4 mm²** com margem.
**Disjuntor:** 20 A trifásico.

---

## Padrões comuns de referência rápida

| Equipamento              | Potência típica | FP    | Circuito sugerido |
|--------------------------|-----------------|-------|-------------------|
| Lâmpada LED              | 9-15 W          | 0,9   | C1               |
| Tomada comum (TUG)       | 600 VA máx      | 0,8   | C2 ou C3          |
| Chuveiro elétrico        | 4400-8000 W     | 1,0   | dedicado         |
| Ar-condicionado 9000 BTU | 900 W           | 0,9   | dedicado         |
| Ar-condicionado 12000 BTU| 1200 W          | 0,9   | dedicado         |
| Forno micro-ondas        | 1200 W          | 0,9   | C4 ou C5          |
| Geladeira               | 350 W           | 0,7   | C6 (pequeno)      |
| Máquina de lavar        | 500 W           | 0,7   | dedicado         |
| Chuveiro a gás (exaustão)| 100 W           | 0,9   | C2               |
| Bomba d'água 1/2 cv      | 368 W           | 0,7   | C4 (pequeno)      |
| Motor trifásico 7,5 cv   | 5.520 W (mec)   | 0,85  | dedicado         |

## Dicas práticas

1. **Cozinhas e banheiros** sempre em circuito dedicado (corrente alta + umidade)
2. **Ar-condicionado** sempre em circuito dedicado (corrente de partida alta)
3. **Iluminação** agrupa 10-15 lâmpadas por circuito
4. **Tomadas** agrupa 4-6 por circuito (sem aquecedor)
5. **Chuveiro + cozinha** nunca no mesmo circuito
6. **Disjuntor geral** com margem de 25% sobre a corrente total
7. **Cabo de entrada** dimensionado para a demanda total da residência (consultar concessionária)
