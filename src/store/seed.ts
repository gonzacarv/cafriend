import { newId, type Recipe, type Step } from './schema'

/**
 * Las 3 recetas derivadas de las notas de Obsidian.
 *
 * Las 9 filas de la tabla original (Hoff.1/2/3, Rao.1/2/3, Kasu.1/2/3) son en
 * realidad 3 estilos escalados a 16/20/24 g, todos a ratio 1:15. Guardando los
 * objetivos como fracción acumulada del agua total, una sola receta reproduce
 * las tres filas — y cualquier dosis intermedia. Ver scaling.test.ts.
 *
 * Los tiempos NO escalan con la dosis: en la tabla original solo variaba el
 * "Fin" (2:30 → 3:00). Se toma el valor del tamaño mediano; es editable.
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
      notes:
        'Simple, consistente, balanceado. Taza limpia y dulce. Tolerancia alta al error — el de todos los días y el de café desconocido.',
      steps: [
        s({ kind: 'bloom', label: 'Bloom', startSec: 0, endSec: 30, cumulative: 40 / 240 }),
        s({ kind: 'pour', label: 'Pour 1', startSec: 30, endSec: 75, cumulative: 160 / 240 }),
        s({ kind: 'pour', label: 'Pour 2', startSec: 75, endSec: 105, cumulative: 1 }),
        s({ kind: 'drawdown', label: 'Drenado', startSec: 105, maxEndSec: 150 }),
      ],
      createdAt: t,
      updatedAt: t,
    },
    {
      id: newId(),
      name: 'Rao',
      author: 'Scott Rao',
      ratio: 15,
      notes:
        'Control y precisión. Alta claridad, acidez definida. Bloom largo y vertido estricto. Para cafés de especialidad y tuestes claros.',
      steps: [
        s({ kind: 'bloom', label: 'Bloom', startSec: 0, endSec: 45, cumulative: 48 / 240 }),
        s({ kind: 'pour', label: 'Pour 1', startSec: 45, endSec: 90, cumulative: 180 / 240 }),
        s({ kind: 'pour', label: 'Pour 2', startSec: 90, endSec: 120, cumulative: 1 }),
        s({ kind: 'drawdown', label: 'Drenado', startSec: 120, maxEndSec: 165 }),
      ],
      createdAt: t,
      updatedAt: t,
    },
    {
      id: newId(),
      name: 'Kasuya 4:6',
      author: 'Tetsu Kasuya',
      ratio: 15,
      notes:
        'Modulación total del perfil. Múltiples pours con pausas claras. Para experimentar o entender un café frutal o complejo.',
      steps: [
        s({ kind: 'bloom', label: 'Bloom', startSec: 0, endSec: 30, cumulative: 40 / 240 }),
        // 0.40 exacto: es el corte 4:6 del método (bloom + pour 1 = el "4").
        // La tabla original usaba 100/240 y 150/360 (41.7 %) y 120/300 (40 %);
        // se toma el valor con sentido y las otras dos filas caen ~4 ml abajo.
        s({ kind: 'pour', label: 'Pour 1', startSec: 30, endSec: 45, cumulative: 0.4 }),
        s({ kind: 'pour', label: 'Pour 2', startSec: 45, endSec: 60, cumulative: 160 / 240 }),
        s({ kind: 'pour', label: 'Pour 3', startSec: 60, endSec: 75, cumulative: 1 }),
        s({ kind: 'drawdown', label: 'Drenado', startSec: 75, maxEndSec: 165 }),
      ],
      createdAt: t,
      updatedAt: t,
    },
  ]
}
