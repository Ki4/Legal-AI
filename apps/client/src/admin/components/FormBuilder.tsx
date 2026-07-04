import { useState } from 'react'
import { useConfirm } from '../ui'
import type { FormConfig, FormField, FormTab, FieldType, SingleCondition } from '../../types/form'

const FIELD_TYPES: { value: FieldType; label: string; icon: string }[] = [
  { value: 'text',       label: 'Текст',          icon: '✏️' },
  { value: 'textarea',   label: 'Великий текст',  icon: '📝' },
  { value: 'date',       label: 'Дата',           icon: '📅' },
  { value: 'boolean',    label: 'Так / Ні',       icon: '☑️' },
  { value: 'choice',     label: 'Вибір (один)',   icon: '🔘' },
  { value: 'multicheck', label: 'Вибір (кілька)', icon: '☑️' },
  { value: 'number',     label: 'Число',          icon: '🔢' },
  { value: 'phone',      label: 'Телефон',        icon: '📱' },
]

// ── Transliteration (Ukrainian → Latin slug) ─────────────────────────────────
const UA_MAP: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'h',ґ:'g',д:'d',е:'e',є:'ye',ж:'zh',з:'z',и:'y',
  і:'i',ї:'yi',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',
  т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ь:'',ю:'yu',я:'ya',
}

function transliterate(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map((ch) => UA_MAP[ch] ?? (ch.match(/[a-z0-9]/) ? ch : '_'))
    .join('')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function uid() {
  return Math.random().toString(36).slice(2, 8)
}

// ── FieldRow ─────────────────────────────────────────────────────────────────
interface FieldRowProps {
  field: FormField
  index: number
  total: number
  onEdit:   (f: FormField) => void
  onDelete: (id: string)    => void
  onMove:   (from: number, to: number) => void
  onClone:  (f: FormField)  => void
}

function FieldRow({ field, index, total, onEdit, onDelete, onMove, onClone }: FieldRowProps) {
  const typeInfo = FIELD_TYPES.find((t) => t.value === field.type)
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-paperAlt rounded-xl border border-lineStrong hover:border-lineStrong transition-colors group">
      <span className="text-base">{typeInfo?.icon ?? '📄'}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink truncate">
          {field.label || <span className="text-inkMute italic">Без назви</span>}
          {field.required && <span className="text-danger ml-1 text-xs">*</span>}
        </div>
        <div className="text-xs text-inkMute flex items-center gap-2">
          <span>{typeInfo?.label}</span>
          <span className="font-mono text-inkMute">{field.id}</span>
          {field.show_if && <span className="text-warn">⚡ умова</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
          className="p-1.5 text-inkSoft hover:text-ink disabled:opacity-20 disabled:cursor-not-allowed"
          title="Вгору"
        >▲</button>
        <button
          disabled={index === total - 1}
          onClick={() => onMove(index, index + 1)}
          className="p-1.5 text-inkSoft hover:text-ink disabled:opacity-20 disabled:cursor-not-allowed"
          title="Вниз"
        >▼</button>
        <button
          onClick={() => onClone(field)}
          className="p-1.5 text-inkSoft hover:text-ok"
          title="Дублювати"
        >📋</button>
        <button
          onClick={() => onEdit(field)}
          className="p-1.5 text-inkSoft hover:text-brand"
          title="Редагувати"
        >✏️</button>
        <button
          onClick={() => onDelete(field.id)}
          className="p-1.5 text-inkSoft hover:text-danger"
          title="Видалити"
        >🗑</button>
      </div>
    </div>
  )
}

// ── FieldEditor ──────────────────────────────────────────────────────────────
interface FieldEditorProps {
  field:    FormField
  allFields: FormField[]
  tabs:     FormTab[]
  onSave:   (f: FormField) => void
  onCancel: () => void
}

function FieldEditor({ field, allFields, tabs, onSave, onCancel }: FieldEditorProps) {
  const [f, setF] = useState<FormField>({ ...field })
  const [optionInput, setOptionInput] = useState('')
  const [showTechnical, setShowTechnical] = useState(false)
  const needsOptions = ['choice', 'multicheck'].includes(f.type)
  const isAutoId = f.id.startsWith('field_') || f.id === ''

  function addOption() {
    if (!optionInput.trim()) return
    const opt = { value: optionInput.toLowerCase().replace(/\s+/g, '_'), label: optionInput.trim() }
    setF((prev) => ({ ...prev, options: [...(prev.options ?? []), opt] }))
    setOptionInput('')
  }

  // Auto-generate field ID from label when ID is auto-generated
  function handleLabelChange(label: string) {
    const updates: Partial<FormField> = { label }
    if (isAutoId && label.trim()) {
      updates.id = transliterate(label) || 'field_' + uid()
    }
    setF((p) => ({ ...p, ...updates }))
  }

  const showIf = f.show_if as SingleCondition | undefined

  return (
    <div className="bg-paperAlt border border-brand/40 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-bold text-ink">Редагування поля</h4>
        <button onClick={onCancel} className="text-inkSoft hover:text-ink text-lg leading-none">×</button>
      </div>

      {/* Type */}
      <div>
        <label className="block text-xs font-semibold text-inkSoft mb-1.5 uppercase tracking-wide">Тип поля</label>
        <select
          value={f.type}
          onChange={(e) => setF((p) => ({ ...p, type: e.target.value as FieldType, options: [] }))}
          className="w-full px-3 py-2 bg-paperAlt border border-lineStrong rounded-lg text-ink text-sm focus:outline-none focus:border-brand"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
          ))}
        </select>
      </div>

      {/* Label (primary — field ID auto-generates from this) */}
      <div>
        <label className="block text-xs font-semibold text-inkSoft mb-1.5 uppercase tracking-wide">Підпис *</label>
        <input
          value={f.label}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder="Прізвище позивача"
          className="w-full px-3 py-2 bg-paperAlt border border-lineStrong rounded-lg text-ink text-sm focus:outline-none focus:border-brand"
        />
      </div>

      {/* Tab selector */}
      {tabs.length > 1 && (
        <div>
          <label className="block text-xs font-semibold text-inkSoft mb-1.5 uppercase tracking-wide">Таб</label>
          <select
            value={f.tab}
            onChange={(e) => setF((p) => ({ ...p, tab: e.target.value }))}
            className="w-full px-3 py-2 bg-paperAlt border border-lineStrong rounded-lg text-ink text-sm focus:outline-none focus:border-brand"
          >
            {tabs.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Placeholder */}
      {!['boolean', 'date'].includes(f.type) && (
        <div>
          <label className="block text-xs font-semibold text-inkSoft mb-1.5 uppercase tracking-wide">Плейсхолдер</label>
          <input
            value={f.placeholder ?? ''}
            onChange={(e) => setF((p) => ({ ...p, placeholder: e.target.value }))}
            placeholder="Іванов"
            className="w-full px-3 py-2 bg-paperAlt border border-lineStrong rounded-lg text-ink text-sm focus:outline-none focus:border-brand"
          />
        </div>
      )}

      {/* Hint */}
      <div>
        <label className="block text-xs font-semibold text-inkSoft mb-1.5 uppercase tracking-wide">Підказка (hint)</label>
        <input
          value={f.hint ?? ''}
          onChange={(e) => setF((p) => ({ ...p, hint: e.target.value }))}
          placeholder="Коротке пояснення для користувача"
          className="w-full px-3 py-2 bg-paperAlt border border-lineStrong rounded-lg text-ink text-sm focus:outline-none focus:border-brand"
        />
      </div>

      {/* Legal explanation */}
      <div>
        <label className="block text-xs font-semibold text-inkSoft mb-1.5 uppercase tracking-wide">
          Правова пояснення (розгортається)
        </label>
        <textarea
          value={f.explanation ?? ''}
          onChange={(e) => setF((p) => ({ ...p, explanation: e.target.value }))}
          placeholder="Детальна юридична довідка для клієнта..."
          rows={2}
          className="w-full px-3 py-2 bg-paperAlt border border-lineStrong rounded-lg text-ink text-sm focus:outline-none focus:border-brand resize-none"
        />
      </div>

      {/* Options (choice/multicheck) */}
      {needsOptions && (
        <div>
          <label className="block text-xs font-semibold text-inkSoft mb-1.5 uppercase tracking-wide">Варіанти відповіді</label>
          <div className="space-y-2 mb-2">
            {(f.options ?? []).map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-ink bg-paperAlt px-3 py-1.5 rounded-lg">{opt.label}</span>
                <button
                  onClick={() => setF((p) => ({ ...p, options: p.options?.filter((_, j) => j !== i) }))}
                  className="text-inkSoft hover:text-danger text-xs px-2"
                >✕</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={optionInput}
              onChange={(e) => setOptionInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
              placeholder="Додати варіант..."
              className="flex-1 px-3 py-2 bg-paperAlt border border-lineStrong rounded-lg text-ink text-sm focus:outline-none focus:border-brand"
            />
            <button
              onClick={addOption}
              className="px-3 py-2 bg-brand hover:bg-brand/90 text-white text-sm rounded-lg"
            >+ Додати</button>
          </div>
        </div>
      )}

      {/* Conditional show_if */}
      <div>
        <label className="block text-xs font-semibold text-inkSoft mb-1.5 uppercase tracking-wide">
          Показувати якщо... (необов'язково)
        </label>
        <p className="text-xs text-inkMute mb-2">
          Наприклад: показувати «Кількість дітей» тільки якщо «Є діти» = true
        </p>
        <div className="flex gap-2">
          <select
            value={showIf?.field ?? ''}
            onChange={(e) => {
              const val = e.target.value
              setF((p) => val
                ? { ...p, show_if: { field: val, operator: '==', value: true } }
                : { ...p, show_if: undefined }
              )
            }}
            className="flex-1 px-3 py-2 bg-paperAlt border border-lineStrong rounded-lg text-ink text-sm focus:outline-none focus:border-brand"
          >
            <option value="">— не використовувати —</option>
            {allFields.filter((af) => af.id !== f.id).map((af) => (
              <option key={af.id} value={af.id}>{af.label} ({af.id})</option>
            ))}
          </select>
          {showIf?.field && (
            <>
              <select
                value={showIf.operator ?? '=='}
                onChange={(e) =>
                  setF((p) => ({ ...p, show_if: { ...showIf, operator: e.target.value as '==' | '!=' } }))
                }
                className="w-24 px-2 py-2 bg-paperAlt border border-lineStrong rounded-lg text-ink text-sm focus:outline-none focus:border-brand"
              >
                <option value="==">дорівнює</option>
                <option value="!=">не дорівнює</option>
              </select>
              <input
                value={String(showIf.value ?? '')}
                onChange={(e) => {
                  const raw = e.target.value
                  const val = raw === 'true' ? true : raw === 'false' ? false : raw
                  setF((p) => ({ ...p, show_if: { ...showIf, value: val } }))
                }}
                placeholder="true / false / текст"
                className="w-32 px-3 py-2 bg-paperAlt border border-lineStrong rounded-lg text-ink text-sm focus:outline-none focus:border-brand"
              />
            </>
          )}
        </div>
      </div>

      {/* Flags */}
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={f.required ?? false}
            onChange={(e) => setF((p) => ({ ...p, required: e.target.checked }))}
            className="w-4 h-4 accent-brand"
          />
          <span className="text-sm text-inkSoft">Обов'язкове</span>
        </label>
      </div>

      {/* Technical details (collapsed by default) */}
      <div>
        <button
          onClick={() => setShowTechnical(!showTechnical)}
          className="text-xs text-inkMute hover:text-inkSoft transition-colors"
        >
          {showTechnical ? '▼' : '▶'} Технічні деталі
        </button>
        {showTechnical && (
          <div className="mt-2 space-y-2">
            <div>
              <label className="block text-xs font-semibold text-inkMute mb-1">
                ID поля <span className="font-normal text-inkMute">— використовується в show_if та шаблоні документа</span>
              </label>
              <input
                value={f.id}
                onChange={(e) => setF((p) => ({ ...p, id: e.target.value.toLowerCase().replace(/\s+/g,'_') }))}
                placeholder="field_id"
                className="w-full px-3 py-2 bg-paperAlt border border-lineStrong rounded-lg text-ink text-sm focus:outline-none focus:border-brand font-mono"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(f)}
          className="flex-1 py-2 bg-brand hover:bg-brand/90 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Зберегти поле
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-inkSoft hover:text-ink text-sm rounded-lg hover:bg-paperAlt transition-colors"
        >
          Скасувати
        </button>
      </div>
    </div>
  )
}

// ── FormBuilder (main) ───────────────────────────────────────────────────────
interface Props {
  config:    FormConfig
  onChange:  (c: FormConfig) => void
}

export function FormBuilder({ config, onChange }: Props) {
  const [activeTab, setActiveTab]       = useState(config.tabs[0]?.id ?? '')
  const [editingField, setEditingField] = useState<FormField | null>(null)
  const [newTabLabel, setNewTabLabel]   = useState('')
  const [addingTab, setAddingTab]       = useState(false)
  const [slugManual, setSlugManual]     = useState(false)
  const confirm = useConfirm()

  const tabFields = config.steps.filter((s) => s.tab === activeTab)

  function update(partial: Partial<FormConfig>) {
    onChange({ ...config, ...partial })
  }

  // Auto-slug from title
  function handleTitleChange(title: string) {
    const updates: Partial<FormConfig> = { title }
    if (!slugManual) {
      updates.service_id = transliterate(title)
    }
    update(updates)
  }

  // ── TABS ──────────────────────────────────────────────────────────────────
  function addTab() {
    if (!newTabLabel.trim()) return
    const id  = transliterate(newTabLabel) + '_' + uid()
    const tab: FormTab = { id, label: newTabLabel.trim() }
    update({ tabs: [...config.tabs, tab] })
    setActiveTab(id)
    setNewTabLabel('')
    setAddingTab(false)
  }

  async function deleteTab(tabId: string) {
    if (config.tabs.length <= 1) return
    const ok = await confirm({
      title: 'Видалити таб?',
      body: 'Таб буде видалено разом з усіма полями всередині нього. Дію не можна скасувати.',
      confirmLabel: 'Видалити',
      variant: 'danger',
    })
    if (!ok) return
    update({
      tabs:  config.tabs.filter((t) => t.id !== tabId),
      steps: config.steps.filter((s) => s.tab !== tabId),
    })
    if (activeTab === tabId) setActiveTab(config.tabs[0]?.id ?? '')
  }

  // ── FIELDS ────────────────────────────────────────────────────────────────
  function addField() {
    const newField: FormField = {
      id:    'field_' + uid(),
      tab:   activeTab,
      type:  'text',
      label: '',
    }
    setEditingField(newField)
  }

  function cloneField(f: FormField) {
    const clone: FormField = {
      ...f,
      id: f.id + '_copy_' + uid(),
    }
    const idx = config.steps.findIndex((s) => s.id === f.id)
    const steps = [...config.steps]
    steps.splice(idx + 1, 0, clone)
    update({ steps })
  }

  function saveField(f: FormField) {
    const exists = config.steps.find((s) => s.id === f.id)
    if (exists) {
      update({ steps: config.steps.map((s) => s.id === f.id ? f : s) })
    } else {
      update({ steps: [...config.steps, f] })
    }
    setEditingField(null)
  }

  function deleteField(id: string) {
    update({ steps: config.steps.filter((s) => s.id !== id) })
  }

  function moveField(from: number, to: number) {
    const all   = [...config.steps]
    const tabIdx = all.reduce<number[]>((acc, s, i) => s.tab === activeTab ? [...acc, i] : acc, [])
    const fromIdx = tabIdx[from]
    const toIdx   = tabIdx[to]
    const [item]  = all.splice(fromIdx, 1)
    all.splice(toIdx, 0, item)
    update({ steps: all })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Service meta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div>
          <label className="block text-xs font-semibold text-inkSoft mb-1.5 uppercase tracking-wide">Назва послуги</label>
          <input
            value={config.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Розлучення за згодою"
            className="w-full px-3 py-2 bg-paperAlt border border-lineStrong rounded-xl text-ink text-sm focus:outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-inkSoft mb-1.5 uppercase tracking-wide">Ідентифікатор (URL)</label>
          <div className="relative">
            <input
              value={config.service_id}
              onChange={(e) => {
                setSlugManual(true)
                update({ service_id: e.target.value.toLowerCase().replace(/\s+/g,'_') })
              }}
              placeholder="rozluchennya_za_zgodoyu"
              readOnly={!slugManual}
              className={`w-full px-3 py-2 pr-8 bg-paperAlt border border-lineStrong rounded-xl text-sm font-mono focus:outline-none focus:border-brand transition-colors
                ${slugManual ? 'text-ink' : 'text-inkSoft'}`}
            />
            <button
              onClick={() => setSlugManual(!slugManual)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-inkMute hover:text-ink text-xs"
              title={slugManual ? 'Повернути автоматичний' : 'Редагувати вручну'}
            >
              {slugManual ? '🔄' : '✏️'}
            </button>
          </div>
          <p className="text-xs text-inkMute mt-1">Автоматично з назви. Використовується в посиланні на форму</p>
        </div>
      </div>

      {/* Tabs bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {config.tabs.map((tab) => (
          <div key={tab.id} className="relative group/tab">
            <button
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? 'bg-brand text-white'
                  : 'bg-paperAlt text-inkSoft hover:text-ink'}`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-60">
                ({config.steps.filter((s) => s.tab === tab.id).length})
              </span>
            </button>
            {config.tabs.length > 1 && (
              <button
                onClick={() => deleteTab(tab.id)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-danger text-white text-xs rounded-full
                           items-center justify-center hidden group-hover/tab:flex leading-none"
              >×</button>
            )}
          </div>
        ))}

        {addingTab ? (
          <div className="flex gap-1">
            <input
              autoFocus
              value={newTabLabel}
              onChange={(e) => setNewTabLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addTab(); if (e.key === 'Escape') setAddingTab(false) }}
              placeholder="Назва табу"
              className="px-3 py-1.5 bg-paperAlt border border-brand rounded-lg text-ink text-sm w-32 focus:outline-none"
            />
            <button onClick={addTab} className="px-3 py-1.5 bg-brand text-white text-sm rounded-lg">OK</button>
            <button onClick={() => setAddingTab(false)} className="px-2 py-1.5 text-inkSoft hover:text-ink text-sm">✕</button>
          </div>
        ) : (
          <button
            onClick={() => setAddingTab(true)}
            className="px-3 py-1.5 rounded-lg text-sm text-inkMute hover:text-ink border border-dashed border-lineStrong hover:border-lineStrong transition-colors"
          >
            + Таб
          </button>
        )}
      </div>

      {/* Fields list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
        {tabFields.length === 0 && !editingField && (
          <div className="text-center py-12 space-y-3">
            <p className="text-inkSoft text-sm font-medium">Як створити форму:</p>
            <div className="text-inkMute text-xs space-y-1">
              <p>1. Введіть назву послуги вгорі</p>
              <p>2. Додайте таби (наприклад: Позивач, Відповідач, Шлюб)</p>
              <p>3. В кожному табі додайте поля натиснувши кнопку нижче</p>
            </div>
          </div>
        )}

        {tabFields.map((field, i) => (
          editingField?.id === field.id
            ? (
              <FieldEditor
                key={field.id}
                field={editingField}
                allFields={config.steps}
                tabs={config.tabs}
                onSave={saveField}
                onCancel={() => setEditingField(null)}
              />
            )
            : (
              <FieldRow
                key={field.id}
                field={field}
                index={i}
                total={tabFields.length}
                onEdit={setEditingField}
                onDelete={deleteField}
                onMove={moveField}
                onClone={cloneField}
              />
            )
        ))}

        {/* New field editor (when id is temp) */}
        {editingField && !config.steps.find((s) => s.id === editingField.id) && (
          <FieldEditor
            field={editingField}
            allFields={config.steps}
            tabs={config.tabs}
            onSave={saveField}
            onCancel={() => setEditingField(null)}
          />
        )}
      </div>

      {/* Add field button */}
      {!editingField && (
        <button
          onClick={addField}
          className="mt-3 w-full py-2.5 border border-dashed border-lineStrong hover:border-brand
                     text-inkSoft hover:text-ink text-sm rounded-xl transition-colors"
        >
          + Додати поле
        </button>
      )}
    </div>
  )
}
