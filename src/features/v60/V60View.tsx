import { useState } from 'react'
import { mmss } from '../../lib/format'
import { DEFAULT_FLOW_RATE, DEFAULT_HINT, hasTarget, newId, stepEnd, type Recipe } from '../../store/schema'
import { totalDurationSec } from '../../lib/scaling'
import { useStore } from '../../store/useStore'
import { RecipeEditor } from './RecipeEditor'
import { BrewSetup } from './BrewSetup'
import { BrewAssistant, type BrewParams } from './BrewAssistant'

export function V60View() {
  const { store, actions } = useStore()
  const [setup, setSetup] = useState<Recipe | null>(null)
  const [editing, setEditing] = useState<{ recipe: Recipe; isNew: boolean } | null>(null)
  const [brew, setBrew] = useState<BrewParams | null>(null)

  const newRecipe = (): Recipe => {
    const t = new Date().toISOString()
    return {
      id: newId(),
      name: '',
      ratio: 15,
      flowRate: DEFAULT_FLOW_RATE,
      // Pulso por defecto: es lo correcto para quien no conoce la distinción,
      // y el bloom es pulsado en todas las escuelas.
      steps: [
        {
          id: newId(),
          kind: 'bloom',
          label: 'Bloom',
          startSec: 0,
          endSec: 30,
          cumulative: 1 / 6,
          style: 'pulse',
          hint: 'el lecho se hincha y libera CO₂; no viertas',
        },
        {
          id: newId(),
          kind: 'pour',
          label: 'Pour 1',
          startSec: 30,
          endSec: 75,
          cumulative: 1,
          style: 'pulse',
          hint: DEFAULT_HINT.pulse,
        },
        { id: newId(), kind: 'drawdown', label: 'Drenado', startSec: 75, maxEndSec: 150, hint: DEFAULT_HINT.drawdown },
      ],
      createdAt: t,
      updatedAt: t,
    }
  }

  if (brew) {
    return (
      <BrewAssistant
        params={brew}
        settings={store.settings}
        onExit={() => setBrew(null)}
      />
    )
  }

  return (
    <>
      <div className="header">
        <div>
          <h1 className="header__title">V60</h1>
          <div className="subtitle">Recetas y asistente de brewing</div>
        </div>
        <button
          type="button"
          className="btn btn--primary btn--icon"
          onClick={() => setEditing({ recipe: newRecipe(), isNew: true })}
        >
          + Receta
        </button>
      </div>

      {store.recipes.length === 0 ? (
        <div className="empty">
          <span className="empty__icon">🌀</span>
          <div>No tenés recetas. Creá una con “+ Receta”.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {store.recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onBrew={() => setSetup(recipe)}
              onEdit={() => setEditing({ recipe, isNew: false })}
            />
          ))}
        </div>
      )}

      {setup && (
        <BrewSetup
          recipe={setup}
          onClose={() => setSetup(null)}
          onStart={(dose, totalWater, coffeeId) => {
            const coffee = store.coffees.find((c) => c.id === coffeeId)
            setBrew({
              recipe: setup,
              dose,
              totalWater,
              coffeeName: coffee ? [coffee.brand, coffee.type].filter(Boolean).join(' · ') : undefined,
            })
            setSetup(null)
          }}
        />
      )}

      {editing && (
        <RecipeEditor
          recipe={editing.recipe}
          onClose={() => setEditing(null)}
          onSave={actions.saveRecipe}
          onDelete={editing.isNew ? undefined : () => actions.deleteRecipe(editing.recipe.id)}
        />
      )}
    </>
  )
}

function RecipeCard({
  recipe,
  onBrew,
  onEdit,
}: {
  recipe: Recipe
  onBrew: () => void
  onEdit: () => void
}) {
  const duration = totalDurationSec(recipe)
  const pours = recipe.steps.filter(hasTarget).length

  return (
    <div className="card">
      <div className="recipe__head">
        <div>
          <div className="recipe__name">{recipe.name}</div>
          <div className="subtitle">
            {recipe.author ? `${recipe.author} · ` : ''}1:{recipe.ratio} · {pours} vertidos · {mmss(duration)}
          </div>
        </div>
        <button
          type="button"
          className="btn btn--icon btn--ghost"
          aria-label={`Editar ${recipe.name}`}
          onClick={onEdit}
        >
          ✎
        </button>
      </div>

      {/* Perfil visual: el ancho de cada tramo es su duración real. */}
      <div className="recipe__profile" aria-hidden="true">
        {recipe.steps.map((step) => (
          <div
            key={step.id}
            className={`recipe__seg recipe__seg--${step.kind}`}
            style={{ flex: Math.max(1, stepEnd(step) - step.startSec) }}
          />
        ))}
      </div>

      {recipe.notes && (
        <div className="subtitle" style={{ marginTop: 12 }}>
          {recipe.notes}
        </div>
      )}

      <button
        type="button"
        className="btn btn--primary btn--block"
        style={{ marginTop: 14 }}
        aria-label={`Preparar ${recipe.name}`}
        onClick={onBrew}
      >
        ▶ Preparar
      </button>
    </div>
  )
}
