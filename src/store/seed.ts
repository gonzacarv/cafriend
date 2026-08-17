import { DEFAULT_FLOW_RATE, DEFAULT_HINT, newId, type Recipe, type Step } from './schema'

/**
 * Las 3 recetas que vienen cargadas.
 *
 * Los objetivos se guardan como fracción acumulada del agua total, así una sola
 * receta sirve para cualquier dosis. Los tiempos NO escalan con la dosis.
 *
 * Cada vertido declara además su estilo, que es la diferencia real entre las
 * escuelas:
 *
 *   pulse       vertés a `flowRate` y esperás el resto de la ventana, hasta que
 *               el lecho queda casi drenado (no seco: si se seca del todo, el
 *               vertido siguiente cae sobre café frío y canaliza).
 *   continuous  el vertido ocupa toda la ventana, sin pausa.
 *
 * El bloom es pulsado en las tres: se vierte rápido y se espera a que desgasifique.
 */

// Omit sobre una unión colapsa a las claves comunes, así que hay que
// distribuirlo para que cada variante conserve sus campos propios.
type StepInput = Step extends infer S ? (S extends Step ? Omit<S, 'id'> : never) : never

const s = (step: StepInput): Step => ({ ...step, id: newId() }) as Step

const now = () => new Date().toISOString()

export function seedRecipes(): Recipe[] {
  const t = now()
  return [
    {
      id: newId(),
      name: 'Hoffmann',
      author: 'James Hoffmann',
      ratio: 15,
      flowRate: DEFAULT_FLOW_RATE,
      notes:
        'Simple, consistente, balanceado. Taza limpia y dulce. Los dos vertidos son continuos, con una pausa corta entre medio. Tolerancia alta al error — el de todos los días y el de café desconocido.',
      steps: [
        s({
          kind: 'bloom',
          label: 'Bloom',
          startSec: 0,
          endSec: 30,
          cumulative: 40 / 240,
          style: 'pulse',
          hint: 'el lecho se hincha y libera CO₂; no viertas',
        }),
        s({ kind: 'pour', label: 'Pour 1', startSec: 30, endSec: 75, cumulative: 160 / 240, style: 'continuous' }),
        s({ kind: 'pour', label: 'Pour 2', startSec: 75, endSec: 105, cumulative: 1, style: 'continuous' }),
        s({ kind: 'drawdown', label: 'Drenado', startSec: 105, maxEndSec: 150, hint: DEFAULT_HINT.drawdown }),
      ],
      createdAt: t,
      updatedAt: t,
    },
    {
      id: newId(),
      name: 'Rao',
      author: 'Scott Rao',
      ratio: 15,
      flowRate: DEFAULT_FLOW_RATE,
      notes:
        'Control y precisión. Alta claridad, acidez definida. Después del bloom el vertido es continuo a propósito: Rao evita los pulsos porque reasientan el lecho. Para cafés de especialidad y tuestes claros.',
      steps: [
        s({
          kind: 'bloom',
          label: 'Bloom',
          startSec: 0,
          endSec: 45,
          cumulative: 48 / 240,
          style: 'pulse',
          hint: 'el lecho se hincha y libera CO₂; no viertas',
        }),
        s({ kind: 'pour', label: 'Pour 1', startSec: 45, endSec: 90, cumulative: 180 / 240, style: 'continuous' }),
        s({ kind: 'pour', label: 'Pour 2', startSec: 90, endSec: 120, cumulative: 1, style: 'continuous' }),
        s({ kind: 'drawdown', label: 'Drenado', startSec: 120, maxEndSec: 165, hint: DEFAULT_HINT.drawdown }),
      ],
      createdAt: t,
      updatedAt: t,
    },
    {
      // 4:6 canónico: 5 vertidos separados ~45 s, todos pulsados.
      //
      // El 40 % inicial (bloom + pour 2) define dulzor y acidez; el 60 %
      // restante, la fuerza. La tabla de la que salió esta app tenía 4 pulsos
      // cada 15 s, que no le da tiempo a drenar a nada entre medio: eso es un
      // vertido continuo disfrazado de pulsos y pierde el sentido del método.
      id: newId(),
      name: 'Kasuya 4:6',
      author: 'Tetsu Kasuya',
      ratio: 15,
      flowRate: DEFAULT_FLOW_RATE,
      notes:
        'Modulación total del perfil. Cinco vertidos cortos con esperas largas: cada pulso arranca cuando el anterior casi terminó de drenar. Para experimentar o entender un café frutal o complejo.',
      steps: [
        s({
          kind: 'bloom',
          label: 'Bloom',
          startSec: 0,
          endSec: 45,
          cumulative: 1 / 6,
          style: 'pulse',
          hint: 'el lecho se hincha y libera CO₂; no viertas',
        }),
        s({ kind: 'pour', label: 'Pour 2', startSec: 45, endSec: 90, cumulative: 0.4, style: 'pulse' , hint: DEFAULT_HINT.pulse }),
        s({ kind: 'pour', label: 'Pour 3', startSec: 90, endSec: 130, cumulative: 0.6, style: 'pulse' , hint: DEFAULT_HINT.pulse }),
        s({ kind: 'pour', label: 'Pour 4', startSec: 130, endSec: 170, cumulative: 0.8, style: 'pulse' , hint: DEFAULT_HINT.pulse }),
        s({ kind: 'pour', label: 'Pour 5', startSec: 170, endSec: 185, cumulative: 1, style: 'pulse' , hint: DEFAULT_HINT.pulse }),
        s({ kind: 'drawdown', label: 'Drenado', startSec: 185, maxEndSec: 210, hint: DEFAULT_HINT.drawdown }),
      ],
      createdAt: t,
      updatedAt: t,
    },
  ]
}
