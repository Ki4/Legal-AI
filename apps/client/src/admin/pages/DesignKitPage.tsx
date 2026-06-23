// In-app design-system gallery (Claude Design canvas) — browse every component in one place,
// in light/dark. Route /design, no auth. Pages compose from src/admin/ui; add here when a new
// component lands. Mirrors the «Бібліотека» section of the .dc.html canvas.
import { Plus, Trash2, Eye, Pencil, Search } from 'lucide-react'
import { Button, IconButton, Badge, Chip, Label, Input, Textarea, Card, SectionLabel, ReviewItem } from '../ui'
import { ServiceCard } from '../components/ServiceCard'
import { ThemeToggle } from '../theme/ThemeToggle'

export function DesignKitPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-5xl mx-auto px-6 md:px-8 py-10">
        {/* header */}
        <div className="flex items-start justify-between gap-4 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-medium text-brand bg-brand/10 border border-brand/20 px-3 py-1 rounded-full mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-brand" />
              Дизайн-система · бібліотека
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">Компоненти</h1>
            <p className="text-[15px] text-inkSoft mt-2 max-w-xl">
              Будівельні блоки в стилі канви. Сторінки збираються з них; чогось бракує — додаємо сюди.
            </p>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Buttons */}
          <Card className="p-6">
            <SectionLabel>Кнопки</SectionLabel>
            <div className="flex flex-wrap items-center gap-3 mt-5">
              <Button variant="primary"><Plus size={16} strokeWidth={2} /> Нова послуга</Button>
              <Button variant="secondary">Редагувати</Button>
              <Button variant="ghost">Форма клієнта</Button>
              <Button variant="danger"><Trash2 size={15} strokeWidth={1.8} /> Видалити</Button>
            </div>
            <div className="flex items-center gap-2.5 mt-4">
              <IconButton title="Переглянути"><Eye size={17} strokeWidth={1.7} /></IconButton>
              <IconButton title="Редагувати"><Pencil size={16} strokeWidth={1.7} /></IconButton>
              <IconButton title="Пошук"><Search size={16} strokeWidth={1.7} /></IconButton>
            </div>
          </Card>

          {/* Inputs */}
          <Card className="p-6">
            <SectionLabel>Поля вводу</SectionLabel>
            <div className="mt-5">
              <Label>Назва послуги</Label>
              <Input defaultValue="Розірвання шлюбу" className="mb-4" />
              <Label>Опис</Label>
              <Textarea defaultValue="Кому потрібно та в якій ситуації…" className="h-[62px] text-inkSoft" />
            </div>
          </Card>

          {/* Statuses */}
          <Card className="p-6">
            <SectionLabel>Статуси та health-світлофор</SectionLabel>
            <div className="flex flex-wrap gap-2.5 mt-5 mb-6">
              <Badge tone="ok">Активна</Badge>
              <Badge tone="neutral">Чернетка</Badge>
              <Badge tone="warn">Потребує уваги</Badge>
              <Badge tone="danger">Проблема</Badge>
            </div>
            <div className="flex flex-col gap-3">
              {[
                { dot: 'bg-ok', t: 'Готова до роботи', s: 'Форма й документ повністю узгоджені' },
                { dot: 'bg-warn', t: 'Потребує уваги', s: 'Шаблон очікує дані, яких форма не питає' },
                { dot: 'bg-danger', t: 'Проблема', s: 'Документ не збереться без виправлення' },
              ].map((h) => (
                <div key={h.t} className="flex items-start gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${h.dot}`} />
                  <div>
                    <div className="text-sm font-semibold text-ink">{h.t}</div>
                    <div className="text-[12.5px] text-inkMute">{h.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Field chips */}
          <Card className="p-6">
            <SectionLabel>Чипи полів — анатомія документа</SectionLabel>
            <p className="text-[12.5px] text-inkMute mt-2 mb-4">Як поля форми зіставляються з тим, що друкує документ.</p>
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex items-center gap-2 mb-2 text-[13px] font-semibold text-ink">
                  <span className="w-2 h-2 rounded-full bg-ok" /> Використовуються
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip tone="used">first_name</Chip><Chip tone="used">marriage_date</Chip><Chip tone="used">alimony_amount</Chip>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2 text-[13px] font-semibold text-ink"><span className="w-2 h-2 rounded-full bg-warn" /> Не в шаблоні</div>
                  <div className="flex flex-wrap gap-1.5"><Chip tone="extra">has_children</Chip></div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2 text-[13px] font-semibold text-ink"><span className="w-2 h-2 rounded-full bg-danger" /> Бракує у формі</div>
                  <div className="flex flex-wrap gap-1.5"><Chip tone="missing">debt_details</Chip></div>
                </div>
              </div>
            </div>
          </Card>


          {/* Review queue */}
          <Card className="p-6 lg:col-span-2">
            <SectionLabel>Черга на ревʼю</SectionLabel>
            <p className="text-[12.5px] text-inkMute mt-2 mb-4">Єдиний патерн для коментарів, заявок і змін законів. «Вирішено» — очевидна дія, а не бейдж.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ReviewItem
                title="Стягнення аліментів" timestamp="2 дні тому"
                body="Уточнити формулювання щодо розміру аліментів у відсотках від доходу."
                onResolve={() => {}} onOpen={() => {}}
              />
              <ReviewItem title="Розірвання шлюбу" resolved onReopen={() => {}} />
            </div>
          </Card>
        </div>

        {/* Service card — composite */}
        <div className="mt-6">
          <SectionLabel className="mb-4">Картка послуги</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
            <ServiceCard
              title="Розірвання шлюбу" description="Підготовка позовної заяви про розірвання шлюбу."
              fields={55} tabs={4} price={0} healthDot="bg-warn" healthTitle="Потребує уваги — шаблон/поля не узгоджені"
              status="active" formHref="#"
              onOpen={() => {}} onEdit={() => {}} onDelete={() => {}} onStatus={() => {}}
            />
            <ServiceCard
              title="Стягнення аліментів" description="Стягнення аліментів на дитину в судовому порядку."
              fields={24} tabs={4} price={0} healthDot="bg-ok" healthTitle="Готова — шаблон і поля узгоджені"
              status="active" formHref="#"
              onOpen={() => {}} onEdit={() => {}} onDelete={() => {}} onStatus={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
