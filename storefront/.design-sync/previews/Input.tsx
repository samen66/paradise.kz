import { Input } from "@/components/ui/Input";

export function Basic() {
  return (
    <div className="flex max-w-sm flex-col gap-4">
      <Input label="Имя" placeholder="Введите имя" />
      <Input label="Телефон" type="tel" placeholder="+7 (___) ___-__-__" hint="Мы отправим СМС с кодом подтверждения" />
    </div>
  );
}

export function WithValue() {
  return (
    <div className="flex max-w-sm flex-col gap-4">
      <Input label="Email" type="email" defaultValue="info@paradise.kz" />
      <Input label="Промокод" defaultValue="PARADISE10" />
    </div>
  );
}

export function ErrorState() {
  return (
    <div className="flex max-w-sm flex-col gap-4">
      <Input label="Телефон" type="tel" defaultValue="+7 (777)" error="Введите номер телефона полностью" />
      <Input label="БИН компании" defaultValue="12345" error="БИН должен содержать 12 цифр" />
    </div>
  );
}

export function NoLabel() {
  return (
    <div className="flex max-w-sm flex-col gap-4">
      <Input placeholder="Поиск по каталогу..." />
      <Input disabled defaultValue="Недоступно для редактирования" />
    </div>
  );
}
